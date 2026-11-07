// Export an audit as one self-contained HTML file plus a PDF printed by local Chrome or Edge.
// usage: npm run export -- <slug>   |   npm run export -- --all
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { renderReport } = require('./render');
const { AUDITS, EXPORTS, listSlugs, loadAudit, validate } = require('./audits');

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const inlineAsset = (slug, file) => {
  const ext = path.extname(file).slice(1).toLowerCase();
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${fs.readFileSync(path.join(AUDITS, slug, 'shots', file)).toString('base64')}`;
};

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

function printPdf(htmlFile, pdfFile) {
  const browser = findBrowser();
  if (!browser) return Promise.reject(new Error('Chrome or Edge not found. Set CHROME_PATH to the browser executable.'));
  const args = ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--generate-pdf-document-outline', `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href];
  return new Promise((resolve, reject) => {
    execFile(browser, args, { timeout: 180000 }, err => {
      if (err && !fs.existsSync(pdfFile)) reject(err); else resolve();
    });
  });
}

async function exportAudit(slug) {
  const audit = loadAudit(slug);
  const problems = validate(audit);
  if (problems.length) throw new Error(`audits/${slug} has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  const outDir = path.join(EXPORTS, slug);
  fs.mkdirSync(outDir, { recursive: true });
  const html = path.join(outDir, `${audit.exportName}.html`);
  const pdf = path.join(outDir, `${audit.exportName}.pdf`);
  fs.writeFileSync(html, renderReport(audit, { asset: inlineAsset, inlineAssets: true }));
  if (fs.existsSync(pdf)) fs.unlinkSync(pdf);
  await printPdf(html, pdf);
  return { html, pdf };
}

module.exports = { exportAudit };

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) { console.error('Usage: npm run export -- <slug>  (or --all)'); process.exit(1); }
  const slugs = arg === '--all' ? listSlugs() : [arg];
  (async () => {
    for (const slug of slugs) {
      try {
        const { html, pdf } = await exportAudit(slug);
        console.log(`✓ ${slug}\n  ${path.relative(process.cwd(), html)}\n  ${path.relative(process.cwd(), pdf)}`);
      } catch (e) { console.error(`✗ ${slug}: ${e.message}`); process.exitCode = 1; }
    }
  })();
}
