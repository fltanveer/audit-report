// Static build for hosting (Vercel or any static host): writes dist/ with the dashboard,
// a preview page per audit, the screenshots, fonts and the committed PDF/HTML exports.
// The hosted site cannot rebuild PDFs (no Chrome there): run `npm run export` locally and commit exports/.
const fs = require('fs');
const path = require('path');
const { ROOT, AUDITS, EXPORTS, listSlugs, loadAudit, summaries } = require('./audits');
const { renderReport, renderDashboard } = require('./render');

const DIST = path.join(ROOT, 'dist');
const write = (rel, body) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
const copyDir = (from, to) => { if (fs.existsSync(from)) fs.cpSync(from, path.join(DIST, to), { recursive: true }); };

fs.rmSync(DIST, { recursive: true, force: true });
write('index.html', renderDashboard(summaries(), { isStatic: true }));
for (const slug of listSlugs()) {
  try {
    const audit = loadAudit(slug);
    write(`a/${slug}/index.html`, renderReport(audit, { asset: (s, file) => `/a/${encodeURIComponent(s)}/shots/${encodeURIComponent(file)}`, backHref: '/' }));
    copyDir(path.join(AUDITS, slug, 'shots'), `a/${slug}/shots`);
  } catch (e) { console.warn(`Skipped ${slug}: ${e.message}`); }
}
copyDir(path.join(__dirname, 'fonts'), 'fonts');
copyDir(EXPORTS, 'exports');
console.log(`Built ${path.relative(ROOT, DIST)}/`);
