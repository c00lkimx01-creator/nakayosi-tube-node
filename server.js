/**
 * 仲良しTube+ — Express サーバー
 * - 静的ファイルを /public から配信
 * - すべての未知パスを index.html にフォールバック (History API SPA)
 * - GET /download/zip でソース ZIP を返す
 * - /api/yt/*  で youtubei.js (youtube.js モジュール) を使った自前 YouTube API を提供
 *
 * デプロイ対応: Render / Vercel / CodeSandbox / Railway / Replit
 *   いずれも `process.env.PORT` を見て待ち受け、'0.0.0.0' にバインドする。
 */
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const archiver = require('archiver');
const yt      = require('./youtube.js');

const app  = express();
/* Render / Railway / Replit / CodeSandbox はすべて PORT を環境変数で渡してくる。
   ローカル/Vercel(サーバーレス)では未設定なので 3000 にフォールバック。 */
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

/* =================== /api/yt — youtubei.js による自前 YouTube API =================== */
/*
 * Invidious/Piped の公開インスタンスが落ちている場合のフォールバック、
 * または「Native」ストリームとして直接利用できる自前バックエンド。
 * すべて youtube.js (youtubei.js のラッパー) を経由する。
 */
function _ytErrorHandler(res, err) {
  console.error('[api/yt]', err?.message || err);
  res.status(502).json({ error: String(err?.message || err) });
}

app.get('/api/yt/search', async (req, res) => {
  const q = req.query.q;
  const type = req.query.type === 'channel' ? 'channel' : 'video';
  const page = parseInt(req.query.page, 10) || 1;
  if (!q) return res.status(400).json({ error: 'missing q param' });
  try {
    const items = await yt.search(q, { type, page });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(items);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/suggest', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  try {
    const items = await yt.searchSuggestions(q);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(items);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/trending', async (req, res) => {
  try {
    const items = await yt.getTrending(req.query.region || 'JP');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(items);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/video/:id', async (req, res) => {
  try {
    const info = await yt.getVideoInfo(req.params.id);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(info);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/streams/:id', async (req, res) => {
  try {
    const streams = await yt.getVideoStreams(req.params.id);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(streams);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/comments/:id', async (req, res) => {
  try {
    const data = await yt.getComments(req.params.id, req.query.sort_by || 'top');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/channel/:id', async (req, res) => {
  try {
    const data = await yt.getChannel(req.params.id);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) { _ytErrorHandler(res, err); }
});

app.get('/api/yt/channel/:id/videos', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const data = await yt.getChannelVideos(req.params.id, page);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) { _ytErrorHandler(res, err); }
});

/* =================== ヘルスチェック =================== */
app.get('/healthz', (_, res) => res.json({ ok: true, ts: Date.now() }));

/* =================== SPA フォールバック =================== */
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

/* =================== 起動 =================== */
/* Vercel はサーバーレス関数として `app` を直接 require して使うため、
   そちらの場合は listen せず module.exports = app のみ行う。
   Render / Railway / Replit / CodeSandbox / ローカルでは通常通り listen する。 */
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[仲良しTube+] http://localhost:${PORT}`);
  });
}

module.exports = app;
