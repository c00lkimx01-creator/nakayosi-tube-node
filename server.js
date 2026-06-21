/**
 * 仲良しTube+ — Express サーバー (改良版)
 * - 静的ファイル配信 + SPA フォールバック
 * - /api/yt/* : youtubei.js による自前 YouTube API
 * - /disguise : 偽装 HTML をランダムに返す (file/ と public/disguise/ から選択)
 * - 簡易 LRU メモリキャッシュで負荷軽減 & 高速化
 * - Vercel / Render / CodeSandbox / Railway / Replit / ローカル すべて対応
 */
'use strict';

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const archiver = require('archiver');
const yt       = require('./youtube.js');

const app    = express();
const PORT   = process.env.PORT || 3000;
const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DISGUISE_DIRS = [
  path.join(ROOT, 'file'),
  path.join(PUBLIC, 'disguise'),
];

/* =================== 簡易キャッシュ =================== */
const CACHE_TTL = { default: 60_000, search: 90_000, trending: 300_000, video: 180_000, streams: 30_000, comments: 60_000, channel: 600_000 };
const cache = new Map(); // key -> { data, exp }
const MAX_CACHE = 300;
function cacheGet(k) { const v = cache.get(k); if (!v) return null; if (v.exp < Date.now()) { cache.delete(k); return null; } return v.data; }
function cacheSet(k, data, ttl) { if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); cache.set(k, { data, exp: Date.now() + ttl }); }

/* =================== 静的ファイル =================== */
app.disable('x-powered-by');
app.use(express.static(PUBLIC, {
  maxAge: '5m',
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

/* =================== 偽装 (Disguise) =================== */
function listDisguiseFiles() {
  const out = [];
  for (const dir of DISGUISE_DIRS) {
    try {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) {
          out.push(path.join(dir, f));
        }
      }
    } catch (_) {}
  }
  return out;
}

app.get('/disguise', (req, res) => {
  const files = listDisguiseFiles();
  if (!files.length) {
    return res
      .status(200)
      .type('html')
      .send('<!doctype html><meta charset="utf-8"><title>About:blank</title><body style="font-family:sans-serif;padding:40px;color:#555"><h2>偽装 HTML がありません</h2><p>file/ または public/disguise/ に .html を追加してください。</p></body>');
  }
  const pick = files[Math.floor(Math.random() * files.length)];
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(pick);
});

app.get('/disguise/list', (_req, res) => {
  res.json(listDisguiseFiles().map(f => path.basename(f)));
});

/* =================== ZIP ダウンロード =================== */
app.get('/download/zip', (req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="nakaoshi-tube-plus.zip"');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => { if (!res.headersSent) res.status(500).end('ZIP error'); console.error(err); });
  archive.pipe(res);
  archive.glob('**/*', { cwd: ROOT, ignore: ['node_modules/**', '.git/**', '*.log', '.env', '*.zip'] });
  archive.finalize();
});

/* =================== 汎用プロキシ =================== */
app.get('/api-proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'missing url param' });
  try {
    const { default: fetch } = await import('node-fetch');
    const upstream = await fetch(decodeURIComponent(target), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000,
    });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    upstream.body.pipe(res);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

/* =================== /api/yt — youtubei.js =================== */
function _err(res, err) {
  console.error('[api/yt]', err?.message || err);
  res.status(502).json({ error: String(err?.message || err) });
}
function _ok(res, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(data);
}
async function _cached(key, ttl, producer) {
  const hit = cacheGet(key);
  if (hit) return hit;
  const data = await producer();
  cacheSet(key, data, ttl);
  return data;
}

app.get('/api/yt/search', async (req, res) => {
  const q = req.query.q;
  const type = req.query.type === 'channel' ? 'channel' : 'video';
  const page = parseInt(req.query.page, 10) || 1;
  if (!q) return res.status(400).json({ error: 'missing q param' });
  try { _ok(res, await _cached(`search:${type}:${page}:${q}`, CACHE_TTL.search, () => yt.search(q, { type, page }))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/suggest', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  try { _ok(res, await _cached(`sug:${q}`, 600_000, () => yt.searchSuggestions(q))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/trending', async (req, res) => {
  const region = req.query.region || 'JP';
  try { _ok(res, await _cached(`trend:${region}`, CACHE_TTL.trending, () => yt.getTrending(region))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/video/:id', async (req, res) => {
  try { _ok(res, await _cached(`video:${req.params.id}`, CACHE_TTL.video, () => yt.getVideoInfo(req.params.id))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/streams/:id', async (req, res) => {
  try { _ok(res, await _cached(`streams:${req.params.id}`, CACHE_TTL.streams, () => yt.getVideoStreams(req.params.id))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/comments/:id', async (req, res) => {
  const sort = req.query.sort_by || 'top';
  try { _ok(res, await _cached(`cmt:${sort}:${req.params.id}`, CACHE_TTL.comments, () => yt.getComments(req.params.id, sort))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/channel/:id', async (req, res) => {
  try { _ok(res, await _cached(`ch:${req.params.id}`, CACHE_TTL.channel, () => yt.getChannel(req.params.id))); }
  catch (e) { _err(res, e); }
});

app.get('/api/yt/channel/:id/videos', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  try { _ok(res, await _cached(`chv:${page}:${req.params.id}`, CACHE_TTL.channel, () => yt.getChannelVideos(req.params.id, page))); }
  catch (e) { _err(res, e); }
});

/* =================== ヘルス =================== */
app.get('/healthz', (_, res) => res.json({ ok: true, ts: Date.now(), cacheSize: cache.size }));

/* =================== SPA フォールバック =================== */
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

/* =================== 起動 =================== */
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => console.log(`[仲良しTube+] http://localhost:${PORT}`));
}
module.exports = app;
