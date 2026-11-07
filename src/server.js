// Local dev server: dashboard, live report preview, one-click export. No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { AUDITS, EXPORTS, SAFE } = require('./audits');
// Load app modules per request so code edits under src/ apply without restarting the server.
const SRC_MODULES = ['./render', './audits', './export'].map(m => require.resolve(m));
const app = () => ({ ...require('./render'), ...require('./audits'), ...require('./export') });

const PORT = Number(process.env.PORT) || 4710;
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.html': 'text/html; charset=utf-8' };

// Live reload: pages listen on /events and reload when audits/ or src/ change.
const clients = new Set();
const RELOAD = `<script class="live-reload">new EventSource('/events').onmessage=()=>location.reload()</script>`;
let timer;
const notify = () => { SRC_MODULES.forEach(m => delete require.cache[m]); clearTimeout(timer); timer = setTimeout(() => clients.forEach(res => res.write('data: reload\n\n')), 150); };
for (const dir of [AUDITS, __dirname]) { try { fs.watch(dir, { recursive: true }, notify); } catch { /* watching is optional */ } }

const send = (res, code, body, type = 'text/html; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
const sendFile = (res, file, download = false) => {
  if (!fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(file).replace(/"/g, '')}"`;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
};
const errorPage = (res, e) => send(res, 500, `<!doctype html><meta charset="utf-8"><title>Error</title><pre style="font:14px/1.5 monospace;padding:32px;white-space:pre-wrap">${String(e.message).replace(/</g, '&lt;')}</pre>${RELOAD}`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.some(p => !SAFE.test(p))) return send(res, 400, 'Bad path', 'text/plain');
  try {
    // inside try: a half-saved file under src/ shows an error page instead of crashing the server
    const { renderReport, renderDashboard, loadAudit, summaries, exportAudit } = app();
    if (parts.length === 0) return send(res, 200, renderDashboard(summaries(), { extraHead: RELOAD }));
    if (parts[0] === 'events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': connected\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    if (parts[0] === 'fonts' && parts.length === 2) return sendFile(res, path.join(__dirname, 'fonts', parts[1]));
    if (parts[0] === 'a' && parts.length === 2) {
      const audit = loadAudit(parts[1]);
      return send(res, 200, renderReport(audit, { asset: (slug, file) => `/a/${encodeURIComponent(slug)}/shots/${encodeURIComponent(file)}`, extraHead: RELOAD, backHref: '/' }));
    }
    if (parts[0] === 'a' && parts[2] === 'shots' && parts.length === 4) return sendFile(res, path.join(AUDITS, parts[1], 'shots', parts[3]));
    if (parts[0] === 'exports' && parts.length === 3) return sendFile(res, path.join(EXPORTS, parts[1], parts[2]), url.searchParams.has('download'));
    if (parts[0] === 'api' && parts[1] === 'export' && parts.length === 3 && req.method === 'POST') {
      try {
        const out = await exportAudit(parts[2]);
        const base = `/exports/${encodeURIComponent(parts[2])}/`;
        return send(res, 200, JSON.stringify({ pdfUrl: base + encodeURIComponent(path.basename(out.pdf)), htmlUrl: base + encodeURIComponent(path.basename(out.html)) }), 'application/json');
      }
      catch (e) { return send(res, 422, JSON.stringify({ error: e.message }), 'application/json'); }
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) { errorPage(res, e); }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is in use. Start on another port, e.g. PORT=4711 npm run dev`);
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1',() => console.log(`Audit Studio running at http://localhost:${PORT}`));
