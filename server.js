/**
 * 仲良しTube+ — Express サーバー
 * - 静的ファイルを /public から配信
 * - すべての未知パスを index.html にフォールバック (History API SPA)
 * - GET /download/zip でソース ZIP を返す
 */
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const archiver = require('archiver');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

/* =================== 静的ファイル配信 =================== */
app.use(express.static(PUBLIC, {
  maxAge: '1m',                          // 開発中は短め
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    /* CORS: フォント等のクロスオリジン対応 */
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

/* =================== ZIP ダウンロード =================== */
app.get('/download/zip', (req, res) => {
  const name = 'nakaoshi-tube-plus.zip';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => {
    console.error('[zip]', err);
    if (!res.headersSent) res.status(500).end('ZIP error');
  });
  archive.pipe(res);

  /* プロジェクト全体を追加 (node_modules / .git 除外) */
  archive.glob('**/*', {
    cwd: __dirname,
    ignore: [
      'node_modules/**',
      '.git/**',
      '*.log',
      '.env',
      '*.zip'
    ]
  });
  archive.finalize();
});

/* =================== API プロキシ (任意エンドポイント) =================== */
/* /api-proxy?url=<encoded> — CORS 回避が必要なクライアントのため */
app.get('/api-proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'missing url param' });
  try {
    const { default: fetch } = await import('node-fetch');
    const upstream = await fetch(decodeURIComponent(target), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    upstream.body.pipe(res);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

/* =================== ヘルスチェック =================== */
app.get('/healthz', (_, res) => res.json({ ok: true, ts: Date.now() }));

/* =================== SPA フォールバック =================== */
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

/* =================== 起動 =================== */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[仲良しTube+] http://localhost:${PORT}`);
});
