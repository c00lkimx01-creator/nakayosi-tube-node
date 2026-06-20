/**
 * youtube.js — youtubei.js を使った YouTube データ取得モジュール
 * Express ルーター を export
 */
const express = require('express');
const router = express.Router();

let ytPromise = null;
async function getYT() {
  if (!ytPromise) {
    ytPromise = (async () => {
      const { Innertube } = await import('youtubei.js');
      return await Innertube.create({ lang: 'ja', location: 'JP', retrieve_player: false });
    })();
  }
  return ytPromise;
}

const json = (res, data) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(data);
};
const err = (res, e, code = 500) => {
  console.error('[youtube.js]', e);
  res.status(code).json({ error: String(e && e.message || e) });
};

/* 検索 */
router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return err(res, 'missing q', 400);
  try {
    const yt = await getYT();
    const r = await yt.search(q, { type: req.query.type || 'video' });
    json(res, r);
  } catch (e) { err(res, e); }
});

/* 動画詳細 */
router.get('/video/:id', async (req, res) => {
  try {
    const yt = await getYT();
    const info = await yt.getInfo(req.params.id);
    json(res, info);
  } catch (e) { err(res, e); }
});

/* 基本情報のみ (軽量) */
router.get('/basic/:id', async (req, res) => {
  try {
    const yt = await getYT();
    const info = await yt.getBasicInfo(req.params.id);
    json(res, info);
  } catch (e) { err(res, e); }
});

/* チャンネル */
router.get('/channel/:id', async (req, res) => {
  try {
    const yt = await getYT();
    const ch = await yt.getChannel(req.params.id);
    json(res, ch);
  } catch (e) { err(res, e); }
});

/* コメント */
router.get('/comments/:id', async (req, res) => {
  try {
    const yt = await getYT();
    const c = await yt.getComments(req.params.id);
    json(res, c);
  } catch (e) { err(res, e); }
});

/* 関連動画 / トレンド */
router.get('/trending', async (req, res) => {
  try {
    const yt = await getYT();
    const t = await yt.getTrending();
    json(res, t);
  } catch (e) { err(res, e); }
});

/* ヘルス */
router.get('/healthz', (_, res) => json(res, { ok: true, module: 'youtube.js' }));

module.exports = router;
