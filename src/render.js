// Turns an audit.json object into report HTML, and the audit list into the dashboard.
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const HIGHLIGHTS = { risk: 'hl-risk', fix: 'hl-fix', gain: 'hl-gain', key: 'hl-key' };

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Inline markup: [risk:text] [fix:text] [gain:text] [key:text] [mute:text]
function inline(s) {
  return esc(s).replace(/\[(risk|fix|gain|key|mute):([^\]]+)\]/g, (m, kind, text) =>
    kind === 'mute' ? `<span class="mute">${text}</span>` : `<mark class="${HIGHLIGHTS[kind]}">${text}</mark>`);
}

const pad = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const band = n => (n < 50 ? 'band-low' : n < 70 ? 'band-mid' : 'band-good');
const bandLabel = n => (n < 50 ? 'Needs urgent work' : n < 70 ? 'Needs work' : 'In good shape');
// impact rows may name one finding ("01") or several ("02, 03")
const findingIds = v => String(v ?? '').split(/[,\s]+/).filter(Boolean);
const pips = sev => `<i class="pips sev-${sev}" aria-hidden="true"></i>`;

function css(names) {
  return names.map(n => fs.readFileSync(path.join(SRC, 'styles', n), 'utf8')).join('\n');
}

const FONTS = [
  ['Inter', 'inter-400.woff2', '400'], ['Inter', 'inter-500.woff2', '500'],
  ['Inter', 'inter-600.woff2', '600'], ['Inter', 'inter-700.woff2', '700'],
  ['Bricolage Grotesque', 'bricolage-grotesque.woff2', '200 800'],
  ['Plex Mono', 'ibm-plex-mono-500.woff2', '500'],
];
// inline=true embeds fonts as data URIs (self-contained export); otherwise served from /fonts/.
function fontFaces(inline) {
  return FONTS.map(([family, file, weight]) => {
    const url = inline
      ? `data:font/woff2;base64,${fs.readFileSync(path.join(SRC, 'fonts', file)).toString('base64')}`
      : `/fonts/${file}`;
    return `@font-face{font-family:'${family}';src:url(${url}) format('woff2');font-weight:${weight};font-style:normal;font-display:swap}`;
  }).join('\n');
}

function page({ title, body, styles, inlineAssets, extraHead = '' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${fontFaces(inlineAssets)}\n${css(['tokens.css', ...styles])}</style>${extraHead}</head><body>
${body}
</body></html>`;
}

/* ------------------------------------------------------------------ report */

function severityCounts(audit) {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  (audit.findings?.items || []).forEach(f => { if (c[f.severity] !== undefined) c[f.severity]++; });
  return c;
}

function renderCover(a) {
  const s = a.score;
  return `<header class="cover"><div class="wrap">
 <div class="brandrow"><div class="logo"><i>${esc(a.agency.initial)}</i>${esc(a.agency.name)}</div><span class="cover-meta">${esc(a.reportType)} · ${esc(a.date)}</span></div>
 <div class="cover-title"><span class="eyebrow-site">${esc(a.auditKind)} · ${esc(a.site)}</span><h1>${inline(a.title).replace(esc(a.site), `<span style="white-space:nowrap">${esc(a.site)}</span>`)}</h1></div>
 <div class="hero-grid">
  <p class="lede">${inline(a.lede)}</p>
  ${s ? `<div class="scorecard">
   <div><span class="score-lbl">UX score</span><div class="score-num ${band(s.overall)}"><b>${s.overall}</b><span>/100</span></div><span class="score-band ${band(s.overall)}">${bandLabel(s.overall)}</span></div>
   <div class="bars">${(s.areas || []).map(r => `<div class="row ${band(r.score)}"><span>${esc(r.label)}</span><b>${r.score}</b><div class="track"><i style="width:${Math.max(0, Math.min(100, r.score))}%"></i></div></div>`).join('')}</div>
  </div>` : ''}
 </div>
 ${a.meta?.length ? `<dl class="meta">${a.meta.map(m => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>` : ''}
 <div class="legend" role="note">
  <span class="legend-title">How to read this report</span>
  <ul>
   <li><mark class="hl-risk">Problem</mark>what is costing you</li>
   <li><mark class="hl-fix">Action</mark>what to change</li>
   <li><mark class="hl-gain">Gain</mark>expected result</li>
   <li><mark class="hl-key">Key fact</mark>number or detail to notice</li>
  </ul>
  <div class="legend-sev"><b>Severity</b>${SEVERITIES.map(sev => `<span>${pips(sev)}${cap(sev)}</span>`).join('')}<span>Orange boxes on screenshots mark the problem area</span></div>
 </div>
</div></header>`;
}

function sectionHead(no, label, sec) {
  return `<div class="sec-head"><span class="sec-no">${pad(no)} · ${esc(label)}</span><div><h2>${inline(sec.heading)}</h2>${sec.intro ? `<p>${inline(sec.intro)}</p>` : ''}</div></div>`;
}

function renderShot(slug, shot, asset) {
  const marks = (shot.marks || []).map(m =>
    `<div class="mk" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%"><span class="pin pin-${m.pin || 'tl'}">${m.n}</span></div>`).join('');
  const img = `<div class="shot-img"><img src="${asset(slug, shot.src)}" alt="${esc(shot.alt || shot.caption)}"${shot.width ? ` width="${shot.width}" height="${shot.height}"` : ''}>${marks}</div>`;
  const frame = shot.device === 'mobile'
    ? `<div class="phone">${img}</div>`
    : `<div class="browser"><div class="bar"><i></i><i></i><i></i><span>${esc(shot.url || '')}</span></div>${img}</div>`;
  return `<figure class="fig fig-${shot.device === 'mobile' ? 'mobile' : 'desktop'}">${frame}${shot.caption ? `<figcaption>${inline(shot.caption)}</figcaption>` : ''}</figure>`;
}

const plain = s => String(s ?? '').replace(/\[(\w+):([^\]]*)\]/g, '$2');

// Previous / All findings / Next links at the end of each finding.
function renderPager(items, i) {
  const link = (j, dir) => {
    const f = items[j];
    if (!f) return '<span></span>';
    const id = f.id || pad(j + 1);
    return `<a class="pg-${dir}" href="#f${esc(id)}"><small>${dir === 'prev' ? '← Previous' : 'Next →'}</small><span><b>${esc(id)}</b> ${esc(plain(f.title))}</span></a>`;
  };
  return `<nav class="f-pager" aria-label="Finding navigation">${link(i - 1, 'prev')}<a class="pg-all" href="#findings-index">↑ All findings</a>${link(i + 1, 'next')}</nav>`;
}

function renderFinding(slug, f, i, asset, items = []) {
  const id = f.id || pad(i + 1);
  const shots = f.shots || [];
  const layout = f.layout || (shots.length && shots.every(s => s.device === 'mobile') ? 'side' : 'wide');
  const list = items => `<ul>${items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
  return `<article class="finding ${layout === 'side' ? 'f-two' : 'f-wide'} sev-${f.severity}" id="f${id}" data-id="${esc(id)}" data-sev="${f.severity}" data-title="${esc(plain(f.title))}">
  <header class="f-head"><div class="f-id">Finding ${esc(id)}</div><div class="f-title">
   <div class="chips"><span class="chip chip-sev sev-${f.severity}">${pips(f.severity)}${cap(f.severity)}</span>${f.area ? `<span class="chip">${esc(f.area)}</span>` : ''}${f.effort ? `<span class="chip">Effort: ${esc(f.effort)}</span>` : ''}</div>
   <h3>${inline(f.title)}</h3></div></header>
  <div class="f-body">
   ${shots.length ? `<div class="f-shots">${shots.map(s => renderShot(slug, s, asset)).join('')}</div>` : ''}
   <div class="f-text">
    ${f.why ? `<div class="blk why"><strong class="hd lbl lbl-risk">Why it costs you</strong><p>${inline(f.why)}</p></div>` : ''}
    ${f.found?.length ? `<div class="blk found"><strong class="hd lbl lbl-risk">What we found</strong>${list(f.found)}</div>` : ''}
    ${f.recommendations?.length ? `<div class="blk rec"><strong class="hd lbl lbl-fix">Recommendation</strong>${list(f.recommendations)}</div>` : ''}
    ${f.impact?.length ? `<div class="impact"><strong class="hd lbl lbl-gain">Expected impact if fixed</strong><div class="metrics">${f.impact.map(m => `<div class="metric"><b>${esc(m.value)}</b><span>${inline(m.label)}</span></div>`).join('')}</div></div>` : ''}
   </div>
  </div>
  ${items.length > 1 ? renderPager(items, i) : ''}
</article>`;
}

function renderReport(a, { asset, inlineAssets = false, extraHead = '', backHref = '' }) {
  const out = [renderCover(a)];
  const nav = [];
  let no = 0;
  const sec = (label, s, inner, short = label) => {
    if (!s) return;
    no++;
    const id = short.toLowerCase();
    nav.push({ id, label: short });
    out.push(`<section id="${id}"><div class="wrap">\n ${sectionHead(no, label, s)}\n ${inner}\n</div></section>`);
  };

  sec('Summary', a.summary, a.summary && `
 ${a.summary.kpis?.length ? `<div class="kpis">${a.summary.kpis.map(k => `<div class="kpi tone-${k.tone || 'neutral'}"><b>${esc(k.value)}</b><span>${inline(k.label)}</span></div>`).join('')}</div>` : ''}
 ${a.summary.takeaways?.length ? `<div class="take">${a.summary.takeaways.map(t => `<div><strong class="hd">${esc(t.label)}</strong><p>${inline(t.text)}</p></div>`).join('')}</div>` : ''}`);

  sec('Strengths', a.strengths, a.strengths && `<div class="goods">${a.strengths.items.map(g => `<div class="good"><strong class="hd">${inline(g.title)}</strong><p>${inline(g.text)}</p></div>`).join('')}</div>`);

  const items = a.findings?.items || [];
  const counts = severityCounts(a);
  const filter = `<div class="toc-filter" role="group" aria-label="Filter findings by severity"><button type="button" data-filter="all" aria-pressed="true">All <span>${items.length}</span></button>${SEVERITIES.filter(s => counts[s]).map(s => `<button type="button" data-filter="${s}" aria-pressed="false">${pips(s)}${cap(s)} <span>${counts[s]}</span></button>`).join('')}</div>`;
  sec('Findings', a.findings, a.findings && `
 <div id="findings-index">${filter}<nav class="toc" aria-label="Findings">${items.map((f, i) => { const id = f.id || pad(i + 1); return `<a href="#f${id}" data-sev="${f.severity}"><span class="n">${esc(id)}</span><span class="t">${inline(f.title)}</span><span class="sev-label sev-${f.severity}">${cap(f.severity)}</span>${pips(f.severity)}</a>`; }).join('')}</nav><p class="toc-empty" hidden>No findings at this severity.</p></div>
 ${items.map((f, i) => renderFinding(a.slug, f, i, asset, items)).join('\n')}`);

  sec('Business impact', a.impact, a.impact && `
 ${a.impact.rows?.length ? `<div class="tbl"><table><thead><tr><th>Metric</th><th>Driven by</th><th>Expected change</th><th>How to measure</th></tr></thead><tbody>${a.impact.rows.map(r => `<tr><td class="metric-name">${inline(r.metric)}</td><td class="driver">${findingIds(r.finding).map(id => `<a href="#f${esc(id)}">Finding ${esc(id)}</a>`).join('<br>')}</td><td class="change"><mark class="hl-gain">${esc(r.change)}</mark></td><td>${inline(r.measure)}</td></tr>`).join('')}</tbody></table></div>` : ''}
 ${a.impact.scenario ? (sc => `<div class="scenario">${[['', sc.before], ['after', sc.after]].map(([cls, s]) => `<div class="scn ${cls}"><span class="scn-lbl">${esc(s.label)}</span><div class="big">${esc(s.headline)}</div><dl>${s.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`).join('')}</div>${sc.note ? `<p class="note">${inline(sc.note)}</p>` : ''}`)(a.impact.scenario) : ''}`, 'Impact');

  let step = 0;
  sec('Roadmap', a.roadmap, a.roadmap && `<div class="roadmap">${a.roadmap.phases.map(p => `<div class="phase"><span class="phase-when">${esc(p.when)}</span><h3>${esc(p.title)}</h3><ul>${p.items.map(x => `<li><span>${pad(++step)}</span>${inline(x)}</li>`).join('')}</ul></div>`).join('')}</div>`);

  sec('Method', a.method, a.method && `<div class="method">${a.method.blocks.map(b => `<div><strong class="hd">${esc(b.title)}</strong><ul>${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>`).join('')}</div>`);

  out.push(`<footer class="end"><span>${esc(a.footer || `${a.agency.name}`)}</span><span>${esc(a.date)}</span></footer>`);
  out.unshift(renderTopNav(a, nav, items, backHref));
  out.push('<a class="to-top" href="#top" aria-label="Back to top" title="Back to top"><span aria-hidden="true">↑</span> Top</a>', NAV_SCRIPT);
  return page({ title: `${a.client || a.site} UX Audit`, body: out.join('\n'), styles: ['report.css'], inlineAssets, extraHead });
}

// Sticky bar: section links with scroll-spy, current finding with prev/next, reading progress. Screen only.
function renderTopNav(a, nav, items, backHref) {
  const n = items.length;
  return `<nav class="topnav" aria-label="Report sections">
 <div class="topnav-in">
  ${backHref ? `<a class="tn-back" href="${esc(backHref)}" title="Back to all audits"><span aria-hidden="true">←</span> Audits</a>` : ''}
  <a class="tn-brand" href="#top" title="Back to top"><i>${esc(a.agency.initial)}</i><span>${esc(a.site)}</span></a>
  <div class="tn-links">${nav.map(x => `<a href="#${x.id}" data-for="${x.id}">${esc(x.label)}</a>`).join('')}</div>
  ${n ? `<div class="tn-find">
   <button type="button" class="tn-prev" disabled aria-label="Previous finding" title="Previous finding (k)">‹</button>
   <button type="button" class="tn-cur" aria-expanded="false" aria-controls="tn-panel" title="Jump to any finding (f)"><i class="pips" hidden></i><span class="tn-cur-t"><span class="tn-off">${n} findings</span><span class="tn-on" hidden>Finding <b>01</b><em> of ${n}</em></span></span><i class="tn-caret" aria-hidden="true"></i></button>
   <button type="button" class="tn-next" aria-label="Next finding" title="Next finding (j)">›</button>
   <div class="tn-panel" id="tn-panel" hidden>
    <div class="tn-panel-head"><span>All findings</span><span class="tn-panel-key">Press <kbd>f</kbd> to open, <kbd>Esc</kbd> to close</span></div>
    <ol>${items.map((f, i) => { const id = f.id || pad(i + 1); return `<li><a href="#f${esc(id)}" data-id="${esc(id)}"><span class="n">${esc(id)}</span><span class="t">${esc(plain(f.title))}</span>${pips(f.severity)}</a></li>`; }).join('')}</ol>
   </div>
  </div>` : ''}
 </div>
 <i class="tn-progress" aria-hidden="true"></i>
</nav><div id="top"></div>`;
}

const NAV_SCRIPT = `<script class="nav-script">(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const bar=$('.topnav'),prog=$('.tn-progress'),find=$('.tn-find'),toTop=$('.to-top');
const links=$$('.tn-links a'),findings=$$('.finding'),panelLinks=$$('.tn-panel a');
let curSec=null,curF=-1;
const onScroll=()=>{const h=document.documentElement,max=h.scrollHeight-h.clientHeight;prog.style.transform='scaleX('+(max>0?h.scrollTop/max:0)+')';toTop.classList.toggle('show',h.scrollTop>innerHeight);
  const y=bar.offsetHeight+window.innerHeight*.3;let s=null;
  for(const sec of $$('main section, body>section'))if(sec.getBoundingClientRect().top<=y)s=sec.id;
  if(s!==curSec){curSec=s;links.forEach(l=>{const on=l.dataset.for===s;l.classList.toggle('on',on);if(on){l.setAttribute('aria-current','true');const p=l.parentNode;p.scrollLeft=l.offsetLeft-p.offsetLeft-8}else l.removeAttribute('aria-current')})}
  let f=-1;findings.forEach((el,i)=>{if(el.getBoundingClientRect().top<=y)f=i});
  const sec=$('#findings'),inF=sec&&f>=0&&sec.getBoundingClientRect().bottom>y;
  if(find&&(inF?f:-1)!==curF){curF=inF?f:-1;const el=findings[curF],on=!!el;$('.tn-off').hidden=on;$('.tn-on').hidden=!on;$('.tn-cur .pips').hidden=!on;
    if(on){$('.tn-cur b').textContent=el.dataset.id;$('.tn-cur .pips').className='pips sev-'+el.dataset.sev}
    $('.tn-prev').disabled=curF<=0;$('.tn-next').disabled=curF===findings.length-1;
    panelLinks.forEach((a,j)=>a.toggleAttribute('aria-current',j===curF))}
};
let raf=0;addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;onScroll()})},{passive:true});addEventListener('resize',onScroll);onScroll();
const go=d=>{const i=curF<0?(d>0?0:-1):curF+d;const el=findings[i];if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});history.replaceState(null,'','#'+el.id)}};
const panel=$('.tn-panel'),cur=$('.tn-cur');
const setPanel=open=>{if(!panel)return;panel.hidden=!open;cur.setAttribute('aria-expanded',open);if(open){const a=panelLinks[Math.max(curF,0)];a.focus({preventScroll:true});a.scrollIntoView({block:'nearest'})}};
if(find){$('.tn-prev').onclick=()=>go(-1);$('.tn-next').onclick=()=>go(1);cur.onclick=()=>setPanel(panel.hidden);panelLinks.forEach(a=>a.addEventListener('click',()=>setPanel(false)))}
document.addEventListener('click',e=>{if(panel&&!panel.hidden&&!find.contains(e.target))setPanel(false)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden){setPanel(false);cur.focus();return}if(e.metaKey||e.ctrlKey||e.altKey||/input|textarea|select/i.test(e.target.tagName))return;if(e.key==='j')go(1);else if(e.key==='k')go(-1);else if(e.key==='f'&&panel)setPanel(panel.hidden)});
const btns=$$('.toc-filter button'),rows=$$('.toc a'),empty=$('.toc-empty');
btns.forEach(b=>b.onclick=()=>{const v=b.dataset.filter;btns.forEach(x=>x.setAttribute('aria-pressed',x===b));let n=0;rows.forEach(r=>{const show=v==='all'||r.dataset.sev===v;r.hidden=!show;n+=show});if(empty)empty.hidden=n>0});
})()</script>`;

/* --------------------------------------------------------------- dashboard */

function renderDashboard(rows, { extraHead = '' } = {}) {
  const row = r => {
    const pdf = `/exports/${encodeURIComponent(r.slug)}/${encodeURIComponent(r.exportName)}.pdf`;
    const status = r.problems.length
      ? `<details class="warn"><summary>${r.problems.length} data issue${r.problems.length === 1 ? '' : 's'}</summary><ul>${r.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>`
      : r.exported
        ? `<span class="st ${r.stale ? 'st-stale' : 'st-ok'}">${r.stale ? 'Changed since export' : 'PDF ready'}</span><span class="when">Exported ${esc(r.exported)}</span>`
        : '<span class="st st-new">Not exported yet</span>';
    return `<tr>
  <td class="c-client"><a class="site" href="/a/${esc(r.slug)}">${esc(r.site)}</a><span class="sub">${esc(r.auditKind)} · ${esc(r.date)}</span></td>
  <td class="c-score"><span class="score ${band(r.score)}"><b>${r.score ?? '–'}</b><i style="--v:${Math.max(0, Math.min(100, r.score ?? 0))}%"></i></span></td>
  <td class="c-find"><span class="counts">${SEVERITIES.filter(s => r.counts[s]).map(s => `<span class="count sev-${s}" title="${r.counts[s]} ${s}"><b>${r.counts[s]}</b> ${s}</span>`).join('')}</span></td>
  <td class="c-status">${status}</td>
  <td class="c-act"><div class="actions"><a class="btn" href="/a/${esc(r.slug)}">Preview</a><button class="btn btn-primary" data-slug="${esc(r.slug)}" data-pdf="${esc(pdf)}" data-fresh="${r.exported && !r.stale ? 1 : 0}"${r.problems.length ? ' disabled title="Fix the data issues first"' : ''}><span class="ico" aria-hidden="true">↓</span><span class="lbl-t">Download PDF</span></button></div></td>
 </tr>`;
  };
  const body = `<main class="wrap dash">
 <header class="dash-head"><div class="logo"><i>C</i>Audit Studio</div></header>
 <h1>Audits</h1>
 ${rows.length ? `<div class="card"><table class="dash-table"><thead><tr><th>Client</th><th>Score</th><th>Findings</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
 ${rows.map(row).join('')}
 </tbody></table></div>` : `<div class="empty"><h2>No audits yet</h2><p>Add an audit folder under <code>audits/</code> to see it here.</p></div>`}
</main>
<script>
// Download PDF: rebuild first only when the audit or templates changed since the last export.
document.querySelectorAll('[data-slug]').forEach(b => b.addEventListener('click', async () => {
  const t = b.querySelector('.lbl-t'), label = t.textContent;
  const download = () => { location.href = b.dataset.pdf + '?download&t=' + Date.now(); };
  if (b.dataset.fresh === '1') return download();
  b.disabled = true; b.classList.add('busy'); t.textContent = 'Building PDF…';
  try {
    const r = await fetch('/api/export/' + b.dataset.slug, { method: 'POST' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    b.dataset.fresh = '1';
    const st = b.closest('tr').querySelector('.c-status');
    st.innerHTML = '<span class="st st-ok">PDF ready</span><span class="when">Exported just now</span>';
    download();
  } catch (e) { alert('Export failed: ' + e.message); }
  b.disabled = false; b.classList.remove('busy'); t.textContent = label;
}));
</script>`;
  return page({ title: 'Audit Studio', body, styles: ['dashboard.css'], inlineAssets: false, extraHead });
}

module.exports = { renderReport, renderDashboard, severityCounts, inline, findingIds, SEVERITIES, HIGHLIGHTS };
