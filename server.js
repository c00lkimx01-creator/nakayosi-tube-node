/**
 * 仲良しTube+ — Express サーバー
 */
const express = require('express');
const path    = require('path');
const archiver = require('archiver');
const youtube = require('./youtube.js');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

app.use(express.static(PUBLIC, {
  maxAge: '1m',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

/* youtube.js API */
app.use('/youtube', youtube);

/* ZIP ダウンロード */
app.get('/download/zip', (req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="nakaoshi-tube-plus.zip"');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', e => { if (!res.headersSent) res.status(500).end('ZIP error'); });
  archive.pipe(res);
  archive.glob('**/*', { cwd: __dirname, ignore: ['node_modules/**', '.git/**', '*.log', '.env', '*.zip'] });
  archive.finalize();
});

/* 汎用プロキシ */
app.get('/api-proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'missing url param' });
  try {
    const upstream = await fetch(decodeURIComponent(target), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

app.get('/healthz', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`[仲良しTube+] http://localhost:${PORT}`));
}

module.exports = app;
