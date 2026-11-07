// Loading and validating audits from audits/<slug>/audit.json.
const fs = require('fs');
const path = require('path');
const { SEVERITIES, severityCounts, findingIds } = require('./render');

const ROOT = path.resolve(__dirname, '..');
const AUDITS = path.join(ROOT, 'audits');
const EXPORTS = path.join(ROOT, 'exports');
const SAFE = /^[a-z0-9][a-z0-9._-]*$/i;

function listSlugs() {
  if (!fs.existsSync(AUDITS)) return [];
  return fs.readdirSync(AUDITS, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(AUDITS, d.name, 'audit.json')))
    .map(d => d.name).sort();
}

function loadAudit(slug) {
  if (!SAFE.test(slug)) throw new Error(`Invalid audit slug: ${slug}`);
  const file = path.join(AUDITS, slug, 'audit.json');
  if (!fs.existsSync(file)) throw new Error(`No audit at audits/${slug}/audit.json`);
  let audit;
  try { audit = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`audits/${slug}/audit.json is not valid JSON: ${e.message}`); }
  audit.slug = slug;
  audit.exportName = audit.exportName || `${slug}-UX-Audit-Report`;
  return audit;
}

// Returns human-readable problems; an empty list means the audit is ready to export.
function validate(audit) {
  const p = [];
  const need = (v, name) => { if (v === undefined || v === null || v === '') p.push(`Missing ${name}`); };
  need(audit.site, 'site'); need(audit.title, 'title'); need(audit.date, 'date');
  need(audit.agency?.name, 'agency.name'); need(audit.agency?.initial, 'agency.initial');

  const texts = [];
  const walk = (o, at) => {
    if (typeof o === 'string') texts.push([at, o]);
    else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, at ? `${at}.${k}` : k));
  };
  walk(audit, '');
  for (const [at, s] of texts) {
    for (const m of s.matchAll(/\[([a-z]+):/g)) {
      if (!['risk', 'fix', 'gain', 'key', 'mute'].includes(m[1])) p.push(`${at}: unknown highlight [${m[1]}:…]`);
    }
    const open = (s.match(/\[(risk|fix|gain|key|mute):/g) || []).length;
    const close = (s.match(/\]/g) || []).length;
    if (open > close) p.push(`${at}: highlight is missing its closing ]`);
  }

  const shotsDir = path.join(AUDITS, audit.slug, 'shots');
  (audit.findings?.items || []).forEach((f, i) => {
    const at = `Finding ${f.id || i + 1}`;
    if (!SEVERITIES.includes(f.severity)) p.push(`${at}: severity must be one of ${SEVERITIES.join(', ')}`);
    if (!f.title) p.push(`${at}: missing title`);
    (f.shots || []).forEach((s, j) => {
      if (!s.src) p.push(`${at} shot ${j + 1}: missing src`);
      else if (!SAFE.test(s.src) || !fs.existsSync(path.join(shotsDir, s.src))) p.push(`${at}: screenshot shots/${s.src} not found`);
      (s.marks || []).forEach(m => {
        if ([m.x, m.y, m.w, m.h].some(v => typeof v !== 'number' || v < 0 || v > 100)) p.push(`${at}: mark ${m.n} needs x, y, w, h as percentages 0–100`);
        if (m.x + m.w > 100.5 || m.y + m.h > 100.5) p.push(`${at}: mark ${m.n} runs off the screenshot`);
      });
    });
  });
  const ids = new Set((audit.findings?.items || []).map((f, i) => f.id || String(i + 1).padStart(2, '0')));
  (audit.impact?.rows || []).forEach(r => findingIds(r.finding).forEach(id => {
    if (!ids.has(id)) p.push(`Impact row "${r.metric}": no finding ${id}`);
  }));
  return p;
}

function newestMtime(dir) {
  let max = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return max;
}

function summaries() {
  return listSlugs().map(slug => {
    try {
      const a = loadAudit(slug);
      const pdf = path.join(EXPORTS, slug, `${a.exportName}.pdf`);
      const html = path.join(EXPORTS, slug, `${a.exportName}.html`);
      // Chrome can stamp the PDF with an odd mtime; the HTML is written by Node, so use its time.
      const builtAt = fs.existsSync(pdf) && fs.existsSync(html) ? fs.statSync(html).mtimeMs : 0;
      return {
        slug, site: a.site, auditKind: a.auditKind, date: a.date, score: a.score?.overall,
        counts: severityCounts(a), problems: validate(a), exportName: a.exportName,
        exported: builtAt ? new Date(builtAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null,
        // stale: the audit data or the templates changed after the last export
        stale: !builtAt || newestMtime(path.join(AUDITS, slug)) > builtAt || newestMtime(__dirname) > builtAt,
      };
    } catch (e) {
      return { slug, site: slug, auditKind: '', date: '', score: null, counts: {}, problems: [e.message], exportName: slug, exported: null };
    }
  });
}

module.exports = { ROOT, AUDITS, EXPORTS, SAFE, listSlugs, loadAudit, validate, summaries };

if (require.main === module) {
  // npm run check [slug]
  const slugs = process.argv[2] ? [process.argv[2]] : listSlugs();
  let bad = 0;
  for (const slug of slugs) {
    try {
      const problems = validate(loadAudit(slug));
      console.log(problems.length ? `✗ ${slug}\n  - ${problems.join('\n  - ')}` : `✓ ${slug}`);
      bad += problems.length ? 1 : 0;
    } catch (e) { console.log(`✗ ${slug}\n  - ${e.message}`); bad++; }
  }
  process.exitCode = bad ? 1 : 0;
}
