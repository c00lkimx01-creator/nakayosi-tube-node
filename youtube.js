/**
 * youtube.js — youtubei.js (InnerTube) を使ったサーバーサイド YouTube API ラッパー
 * --------------------------------------------------------------------------
 * Invidious/Piped の公開インスタンスはダウンすることが多いため、
 * このモジュールはサーバー自身が YouTube の InnerTube API に直接アクセスし、
 * 検索・動画情報・ストリームURL・コメント・チャンネル情報を取得するための
 * "自前バックエンド" を提供します。
 *
 * server.js からは以下のように使います:
 *   const yt = require('./youtube.js');
 *   const info = await yt.getVideoInfo(videoId);
 *
 * 公開 API (すべて async):
 *   getInnertube()                      — 共有 Innertube インスタンスを取得 (内部キャッシュ)
 *   search(query, { type, page })       — 動画/チャンネル検索
 *   searchSuggestions(query)            — 検索サジェスト
 *   getVideoInfo(videoId)               — 動画メタデータ + 関連動画
 *   getVideoStreams(videoId)            — デコード済みストリームURL一覧 (mp4/m4a/hls)
 *   getComments(videoId, sortBy)        — コメント一覧
 *   getChannel(channelIdOrHandle)       — チャンネル基本情報
 *   getChannelVideos(channelIdOrHandle) — チャンネルの動画一覧
 *   getTrending(region)                 — トレンド動画
 */

'use strict';

let Innertube, UniversalCache;
try {
  // eslint-disable-next-line global-require
  ({ Innertube, UniversalCache } = require('youtubei.js'));
} catch (e) {
  // youtubei.js が未インストールの場合でもサーバー全体は落とさない
  console.warn('[youtube.js] youtubei.js が見つかりません。`npm install` を実行してください。', e.message);
}

/* =================== Innertube セッション (シングルトン + 再生成) =================== */

let _innertubePromise = null;
let _innertubeCreatedAt = 0;
const SESSION_TTL_MS = 1000 * 60 * 30; // 30分でセッションを再生成 (cipher更新対策)

async function getInnertube() {
  if (!Innertube) {
    throw new Error('youtubei.js is not installed');
  }
  const stale = Date.now() - _innertubeCreatedAt > SESSION_TTL_MS;
  if (!_innertubePromise || stale) {
    _innertubeCreatedAt = Date.now();
    _innertubePromise = Innertube.create({
      lang: 'ja',
      location: 'JP',
      retrieve_player: true,
      generate_session_locally: true,
      cache: new UniversalCache(false)
    }).catch(err => {
      // 失敗したら次回また作り直せるようにする
      _innertubePromise = null;
      throw err;
    });
  }
  return _innertubePromise;
}

/* =================== ヘルパー: サムネイル取り出し =================== */
function _bestThumb(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return '';
  return thumbnails[thumbnails.length - 1].url || thumbnails[0].url || '';
}

function _secondsFromDuration(d) {
  if (typeof d === 'number') return d;
  if (d && typeof d.seconds === 'number') return d.seconds;
  return 0;
}

/* =================== 動画アイテムを Invidious 互換の形に正規化 =================== */
function _normalizeVideoItem(v) {
  if (!v) return null;
  const id = v.id || v.video_id || v.videoId;
  if (!id) return null;
  const author =
    (v.author && (v.author.name || v.author)) ||
    v.channel?.name ||
    v.uploader?.name ||
    '';
  const authorThumb =
    _bestThumb(v.author?.thumbnails) ||
    _bestThumb(v.channel?.thumbnails) ||
    '';
  return {
    videoId: id,
    title: typeof v.title === 'string' ? v.title : (v.title?.text || ''),
    author,
    authorThumbnails: authorThumb ? [{ url: authorThumb }] : [],
    lengthSeconds: _secondsFromDuration(v.duration ?? v.length_seconds),
    viewCount: v.view_count?.text ? parseInt(String(v.view_count.text).replace(/[^\d]/g, ''), 10) || 0 : (v.short_view_count?.text ? 0 : 0),
    viewCountText: v.view_count?.text || v.short_view_count?.text || '',
    published: 0,
    publishedText: v.published?.text || '',
    liveNow: !!v.is_live,
    isUpcoming: !!v.is_upcoming,
    videoThumbnails: (v.thumbnails || []).map(t => ({ url: t.url, width: t.width, height: t.height }))
  };
}

/* =================== 検索 =================== */
async function search(query, { type = 'video', page = 1 } = {}) {
  const yt = await getInnertube();
  const results = await yt.search(query, {
    type: type === 'channel' ? 'channel' : 'video',
    sort_by: 'relevance'
  });

  let items = [];
  if (type === 'channel') {
    items = (results.results || results.videos || [])
      .filter(r => r.type === 'Channel')
      .map(c => ({
        author: c.author?.name || c.name || '',
        authorId: c.id || c.author?.id || '',
        authorThumbnails: c.author?.thumbnails || c.thumbnails || [],
        subCount: c.subscriber_count?.text || '',
        descriptionText: c.description_snippet?.text || ''
      }));
  } else {
    const pool = results.videos || results.results || [];
    items = pool
      .filter(r => r.type === 'Video' || r.id)
      .map(_normalizeVideoItem)
      .filter(Boolean);
  }

  // 簡易ページング: InnerTube の続きフィードを使ってページ送り
  if (page > 1 && typeof results.getContinuation === 'function') {
    let cont = results;
    for (let i = 1; i < page && cont?.has_continuation; i++) {
      cont = await cont.getContinuation();
    }
    if (cont) {
      const pool2 = cont.videos || cont.results || [];
      items = pool2.filter(r => r.type === 'Video' || r.id).map(_normalizeVideoItem).filter(Boolean);
    }
  }

  return items;
}

/* =================== 検索サジェスト =================== */
async function searchSuggestions(query) {
  const yt = await getInnertube();
  try {
    const res = await yt.getSearchSuggestions(query);
    return Array.isArray(res) ? res.slice(0, 8) : [];
  } catch (_) {
    return [];
  }
}

/* =================== 動画メタデータ =================== */
async function getVideoInfo(videoId) {
  const yt = await getInnertube();
  const info = await yt.getInfo(videoId);
  const basic = info.basic_info || {};

  const related = (info.watch_next_feed || [])
    .filter(v => v && (v.type === 'CompactVideo' || v.id))
    .map(_normalizeVideoItem)
    .filter(Boolean)
    .slice(0, 24);

  return {
    videoId,
    title: basic.title || '',
    description: basic.short_description || '',
    descriptionHtml: (basic.short_description || '').replace(/\n/g, '<br>'),
    author: basic.author || basic.channel?.name || '',
    authorId: basic.channel_id || basic.channel?.id || '',
    authorThumbnails: basic.channel?.thumbnails || [],
    viewCount: basic.view_count || 0,
    likeCount: basic.like_count || 0,
    lengthSeconds: basic.duration || 0,
    isLive: !!basic.is_live,
    isUpcoming: !!basic.is_upcoming,
    published: basic.start_timestamp ? Math.floor(new Date(basic.start_timestamp).getTime() / 1000) : 0,
    videoThumbnails: (basic.thumbnail || []).map(t => ({ url: t.url, width: t.width, height: t.height })),
    relatedVideos: related
  };
}

/* =================== ストリームURL取得 (デコード済み) =================== */
async function getVideoStreams(videoId) {
  const yt = await getInnertube();
  const info = await yt.getBasicInfo(videoId, 'ANDROID');

  if (info.playability_status && info.playability_status.status !== 'OK') {
    throw new Error(`再生不可: ${info.playability_status.status} ${info.playability_status.reason || ''}`.trim());
  }

  const sd = info.streaming_data;
  if (!sd) throw new Error('streaming_data が取得できませんでした');

  const player = yt.session.player;
  const toFormat = (f, kind) => {
    let url = f.url;
    try {
      if (!url && typeof f.decipher === 'function' && player) {
        url = f.decipher(player);
      }
    } catch (_) {
      // decipher 失敗時はスキップ
    }
    if (!url) return null;
    return {
      url,
      itag: f.itag,
      mimeType: f.mime_type || '',
      type: f.mime_type || '',
      qualityLabel: f.quality_label || '',
      quality: f.quality || f.quality_label || '',
      bitrate: f.bitrate || 0,
      audioQuality: f.audio_quality || '',
      audioSampleRate: f.audio_sample_rate || 0,
      contentLength: f.content_length || 0,
      fps: f.fps || 0,
      container: kind === 'combined' ? 'mp4' : (f.mime_type?.includes('audio') ? 'm4a' : 'mp4'),
      encoding: kind === 'adaptive'
    };
  };

  const formatStreams = (sd.formats || []).map(f => toFormat(f, 'combined')).filter(Boolean);
  const adaptiveFormats = (sd.adaptive_formats || []).map(f => toFormat(f, 'adaptive')).filter(Boolean);

  const hlsManifestUrl = sd.hls_manifest_url || null;

  return {
    videoId,
    hlsManifestUrl,
    dashManifestUrl: sd.dash_manifest_url || null,
    formatStreams,
    adaptiveFormats
  };
}

/* =================== コメント =================== */
async function getComments(videoId, sortBy = 'top') {
  const yt = await getInnertube();
  const comments = await yt.getComments(videoId, sortBy === 'new' ? 'NEWEST_FIRST' : 'TOP_COMMENTS');

  const list = (comments.contents || []).map(c => {
    const cmt = c.comment || c;
    return {
      author: cmt.author?.name || '',
      authorId: cmt.author?.id || '',
      authorThumbnails: cmt.author?.thumbnails || [],
      authorIsChannelOwner: !!cmt.author_is_channel_owner,
      content: cmt.content?.text || '',
      contentHtml: (cmt.content?.text || '').replace(/\n/g, '<br>'),
      published: cmt.published_time?.text || '',
      likeCount: cmt.like_count || 0,
      replyCount: cmt.reply_count || 0,
      commentId: cmt.comment_id || cmt.id || ''
    };
  });

  return {
    videoId,
    commentCount: comments.estimated_item_count || list.length,
    comments: list
  };
}

/* =================== チャンネル情報 =================== */
async function getChannel(channelIdOrHandle) {
  const yt = await getInnertube();
  const target = channelIdOrHandle.startsWith('@') || channelIdOrHandle.startsWith('UC')
    ? channelIdOrHandle
    : `@${channelIdOrHandle}`;
  const ch = await yt.getChannel(target);
  const meta = ch.metadata || {};
  const header = ch.header || {};

  return {
    author: meta.title || '',
    authorId: meta.external_id || meta.channel_id || '',
    authorThumbnails: meta.avatar || [],
    authorBanners: header.banner || [],
    subCount: header.subscriber_count?.text || meta.subscriber_count_text || '',
    description: meta.description || '',
    isVerified: !!header.is_verified
  };
}

async function getChannelVideos(channelIdOrHandle, page = 1) {
  const yt = await getInnertube();
  const target = channelIdOrHandle.startsWith('@') || channelIdOrHandle.startsWith('UC')
    ? channelIdOrHandle
    : `@${channelIdOrHandle}`;
  const ch = await yt.getChannel(target);
  const videosTab = await ch.getVideos();

  let feed = videosTab;
  for (let i = 1; i < page && feed?.has_continuation; i++) {
    feed = await feed.getContinuation();
  }

  const videos = (feed.videos || [])
    .map(_normalizeVideoItem)
    .filter(Boolean);

  return { videos };
}

/* =================== トレンド =================== */
async function getTrending(region = 'JP') {
  const yt = await getInnertube();
  const trending = await yt.getTrending();
  const videos = (trending.videos || [])
    .map(_normalizeVideoItem)
    .filter(Boolean);
  return videos;
}

module.exports = {
  getInnertube,
  search,
  searchSuggestions,
  getVideoInfo,
  getVideoStreams,
  getComments,
  getChannel,
  getChannelVideos,
  getTrending
};
