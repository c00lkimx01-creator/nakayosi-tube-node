/* =================== Invidious / Piped API 取得関数 =================== */

const FETCH_TIMEOUT_MS = 5000;

async function _fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(to);
    return r;
  } catch (e) {
    clearTimeout(to);
    throw e;
  }
}

/* CORS プロキシ経由でフェッチ (設定次第) */
async function apiFetch(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const target = buildFetchUrl(url);
  const r = await _fetchWithTimeout(target, timeoutMs);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* =================== トレンド取得 =================== */
async function fetchTrending(region = 'JP') {
  const bases = getInvidiousFor('trend');
  const tasks = bases.slice(0, 8).map(b =>
    apiFetch(`${b}/api/v1/trending?region=${region}&hl=ja`, 3500)
      .then(d => { if (!Array.isArray(d) || !d.length) throw 0; return d; })
      .catch(() => null)
  );
  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return [];
}

/* =================== Invidious 検索 =================== */
async function fetchFromInvidious(query, type = 'search', page = 1) {
  const bases = getInvidiousFor(type === 'shorts' ? 'shorts' : 'search');
  const params = new URLSearchParams({ q: query, type: 'video', page, hl: 'ja', region: 'JP' });
  const tasks = bases.slice(0, 6).map(b =>
    apiFetch(`${b}/api/v1/search?${params}`, 4000)
      .then(d => { if (!Array.isArray(d) || !d.length) throw 0; return d; })
      .catch(() => null)
  );
  const results = await Promise.any(tasks.map(t => t.then(d => d || Promise.reject())));
  return results;
}

/* =================== Piped 検索 =================== */
async function fetchFromPiped(query) {
  const bases = window.PIPED_INSTANCES || [];
  for (const b of bases.slice(0, 4)) {
    try {
      const url = `${b}/search?q=${encodeURIComponent(query)}&filter=videos`;
      const d = await apiFetch(url, 4000);
      if (d && Array.isArray(d.items) && d.items.length) return d.items;
    } catch (_) {}
  }
  return [];
}

/* =================== チャンネル検索 =================== */
async function searchChannelsFromInvidious(query, maxResults = 5) {
  const bases = getInvidiousFor('search');
  for (const b of bases.slice(0, 5)) {
    try {
      const params = new URLSearchParams({ q: query, type: 'channel', hl: 'ja' });
      const d = await apiFetch(`${b}/api/v1/search?${params}`, 3500);
      if (Array.isArray(d) && d.length) return d.slice(0, maxResults);
    } catch (_) {}
  }
  return [];
}

/* =================== 動画メタデータ取得 =================== */
async function fetchVideoMeta(videoId) {
  const bases = getInvidiousFor('video');
  const tasks = bases.slice(0, 8).map(b =>
    apiFetch(`${b}/api/v1/videos/${videoId}?hl=ja&region=JP`, 4000)
      .catch(() => null)
  );
  const settled = await Promise.allSettled(tasks);
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value && r.value.title) return r.value;
  }
  return null;
}

/* =================== 動画説明文取得 =================== */
async function fetchVideoDescription(videoId) {
  const bases = getInvidiousFor('video');
  for (const b of bases.slice(0, 6)) {
    try {
      const d = await apiFetch(`${b}/api/v1/videos/${videoId}?fields=description,descriptionHtml,viewCount,likeCount,published,author,authorThumbnails&hl=ja`, 5000);
      if (d && (d.description || d.descriptionHtml)) return d;
    } catch (_) {}
  }
  return null;
}

/* =================== コメント取得 =================== */
async function fetchCommentsFromInvidious(videoId, sortBy = 'top') {
  const bases = getInvidiousFor('video');
  const tasks = bases.slice(0, 6).map(b =>
    apiFetch(`${b}/api/v1/comments/${videoId}?sort_by=${sortBy}`, 5000)
      .then(d => { if (!d || !Array.isArray(d.comments)) throw 0; return d; })
      .catch(() => null)
  );
  const result = await Promise.any(tasks.map(t => t.then(d => d || Promise.reject())).concat([new Promise((_, rej) => setTimeout(rej, 8000))]));
  return result;
}

/* =================== ストリーム取得 =================== */
async function fetchGoogleVideoStreamsInvidious(videoId) {
  const bases = getInvidiousFor('video');
  const tasks = bases.slice(0, 10).map(b =>
    apiFetch(`${b}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`, 3000)
      .then(d => {
        const fmts = [...(d.adaptiveFormats || []), ...(d.formatStreams || [])];
        if (!fmts.length) throw 0;
        return fmts;
      })
      .catch(() => null)
  );
  try {
    return await Promise.any(tasks.map(t => t.then(d => d || Promise.reject())));
  } catch (_) {
    return null;
  }
}

/* =================== 自前バックエンド (/api/yt) — youtube.js (youtubei.js) =================== */
/* Invidious/Piped に依存しない自前 YouTube API。同一オリジンなのでプロキシ不要。 */
async function fetchFromYtBackend(path, timeoutMs = 8000) {
  const r = await _fetchWithTimeout(path, timeoutMs);
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return r.json();
}

/* ストリームURL (mp4/m4a/hls) — Native ストリーム用 */
async function fetchNativeStreams(videoId) {
  return fetchFromYtBackend(`/api/yt/streams/${encodeURIComponent(videoId)}`, 12000);
}

/* 動画メタデータ (Invidious 互換の形に整形済み) */
async function fetchNativeVideoInfo(videoId) {
  return fetchFromYtBackend(`/api/yt/video/${encodeURIComponent(videoId)}`, 10000);
}

/* 検索 (自前バックエンド版。Invidious が全滅した時のフォールバックにも使える) */
async function fetchNativeSearch(query, page = 1) {
  const params = new URLSearchParams({ q: query, page });
  return fetchFromYtBackend(`/api/yt/search?${params}`, 10000);
}

/* コメント (自前バックエンド版) */
async function fetchNativeComments(videoId, sortBy = 'top') {
  return fetchFromYtBackend(`/api/yt/comments/${encodeURIComponent(videoId)}?sort_by=${sortBy}`, 10000);
}

/* トレンド (自前バックエンド版) */
async function fetchNativeTrending(region = 'JP') {
  return fetchFromYtBackend(`/api/yt/trending?region=${region}`, 10000);
}

/* チャンネル情報・動画一覧 (自前バックエンド版) */
async function fetchNativeChannelInfo(channelNameOrId) {
  return fetchFromYtBackend(`/api/yt/channel/${encodeURIComponent(channelNameOrId)}`, 10000);
}
async function fetchNativeChannelVideos(channelNameOrId, page = 1) {
  return fetchFromYtBackend(`/api/yt/channel/${encodeURIComponent(channelNameOrId)}/videos?page=${page}`, 10000);
}

/* =================== チャンネル情報取得 =================== */
async function fetchChannelInfo(channelNameOrId) {
  const bases = getInvidiousFor('channel');
  const tryEndpoints = [
    `/api/v1/channels/${encodeURIComponent(channelNameOrId)}?hl=ja`,
    `/api/v1/channels/@${encodeURIComponent(channelNameOrId)}?hl=ja`,
  ];
  for (const b of bases.slice(0, 6)) {
    for (const ep of tryEndpoints) {
      try {
        const d = await apiFetch(`${b}${ep}`, 5000);
        if (d && d.author) return d;
      } catch (_) {}
    }
  }
  return null;
}

async function fetchChannelVideos(channelNameOrId, page = 1) {
  const bases = getInvidiousFor('channel');
  const endpoints = [
    `/api/v1/channels/${encodeURIComponent(channelNameOrId)}/videos?page=${page}&hl=ja`,
    `/api/v1/channels/@${encodeURIComponent(channelNameOrId)}/videos?page=${page}&hl=ja`,
  ];
  for (const b of bases.slice(0, 6)) {
    for (const ep of endpoints) {
      try {
        const d = await apiFetch(`${b}${ep}`, 5000);
        if (d && Array.isArray(d.videos)) return d;
      } catch (_) {}
    }
  }
  return null;
}

async function fetchChannelShorts(channelNameOrId, page = 1) {
  const bases = getInvidiousFor('channel');
  for (const b of bases.slice(0, 6)) {
    try {
      const d = await apiFetch(`${b}/api/v1/channels/${encodeURIComponent(channelNameOrId)}/shorts?page=${page}&hl=ja`, 5000);
      if (d && (Array.isArray(d.videos) || Array.isArray(d.shorts))) return d;
    } catch (_) {}
  }
  return null;
}

async function fetchChannelPlaylists(channelNameOrId) {
  const bases = getInvidiousFor('channel');
  for (const b of bases.slice(0, 5)) {
    try {
      const d = await apiFetch(`${b}/api/v1/channels/${encodeURIComponent(channelNameOrId)}/playlists?hl=ja`, 5000);
      if (d && Array.isArray(d.playlists)) return d;
    } catch (_) {}
  }
  return null;
}

/* =================== Kahoot キー取得 =================== */
let _cachedEduKey = null;
async function fetchKahootKey() {
  if (_cachedEduKey) return _cachedEduKey;
  const url = KAHOOT_KEY_URL;
  try {
    const r = await _fetchWithTimeout(buildFetchUrl(url), 5000);
    if (r.ok) {
      const d = await r.json();
      _cachedEduKey = d.key || d.enc || d;
      return _cachedEduKey;
    }
  } catch (_) {}
  return null;
}

/* =================== 動画フォーマット解析 =================== */
function parseSiawaseokFormats(streams) {
  const mp4Video = streams.filter(f =>
    f.url && (f.ext === 'mp4' || (f.vcodec && f.vcodec !== 'none'))
    && f.vcodec !== 'none'
  );
  const mp4Audio = streams.filter(f =>
    f.url && (f.ext === 'm4a' || (f.acodec && f.acodec !== 'none'))
    && (!f.vcodec || f.vcodec === 'none')
  );
  const bestAudio = mp4Audio.reduce((a, b) => ((b.abr || 0) > (a?.abr || 0) ? b : a), null);
  const pairs = mp4Video.map(vf => ({
    label: vf.format_note || vf.quality_label || `${vf.height || '?'}p`,
    videoFmt: vf,
    audioFmt: bestAudio
  }));
  return { mp4Pairs: pairs };
}

function buildGoogleVideoPlayer(formats) {
  if (!formats || !formats.length) return null;
  const mp4combined = formats.filter(f =>
    f.url && f.type && f.type.includes('video/mp4') && !f.type.includes('codecs') === false
    && (f.container === 'mp4' || f.type.includes('mp4'))
    && (typeof f.fps !== 'undefined' || f.quality)
  );
  const adaptiveV = formats.filter(f => f.url && f.type && f.type.startsWith('video/mp4') && f.encoding);
  const adaptiveA = formats.filter(f => f.url && f.type && f.type.startsWith('audio/mp4'));
  if (adaptiveV.length && adaptiveA.length) {
    const vid = adaptiveV.find(f => f.qualityLabel === '360p') || adaptiveV[0];
    const aud = adaptiveA[0];
    return { type: 'dual', videoUrl: vid.url, audioUrl: aud.url };
  }
  const combo = formats.find(f => f.url && f.container === 'mp4' && f.fps) || mp4combined[0];
  if (combo) return { type: 'single', url: combo.url };
  return null;
}

/* =================== 検索サジェスト =================== */
async function fetchSearchSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const url = `https://suggestqueries-clients6.youtube.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&hl=ja`;
    const d = await apiFetch(url, 2000);
    if (Array.isArray(d) && Array.isArray(d[1])) return d[1].slice(0, 8);
  } catch (_) {}
  return [];
}

/* =================== 登録チャンネル新着取得 =================== */
async function fetchSubscriptionsNewUploads(subs) {
  const row = document.getElementById('subs-new-uploads');
  if (!row) return;
  const all = [];
  await Promise.all(subs.slice(0, 12).map(async s => {
    try {
      const r = await fetchChannelVideos(s.name, 1);
      if (r && r.videos) {
        r.videos.slice(0, 5).forEach(v => {
          if (v.videoId && (v.lengthSeconds || 0) > 65) {
            all.push({ ...v, _channel: s.name, _thumb: s.thumb, _ts: v.published || 0 });
          }
        });
      }
    } catch (_) {}
  }));
  if (!all.length) { row.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">新着動画はありません</div>'; return; }
  all.sort((a, b) => (b._ts || 0) - (a._ts || 0));
  row.innerHTML = '';
  all.slice(0, 24).forEach(v => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.style.cssText = 'flex:0 0 300px;cursor:pointer;';
    card.onclick = () => playVideo(v.videoId, v.title || '', v._channel, v._thumb);
    const isNew = v._ts && (Date.now() / 1000 - v._ts) < 86400 * 3;
    card.innerHTML = `
      <div style="aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;margin-bottom:10px;position:relative;">
        <img src="https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
        ${isNew ? '<span style="position:absolute;top:8px;left:8px;background:#ff0000;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">NEW</span>' : ''}
      </div>
      <div style="display:flex;gap:10px;">
        <img src="${v._thumb}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='https://i.pravatar.cc/72?u=${encodeURIComponent(v._channel)}'">
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${v.title || ''}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${v._channel}</div>
        </div>
      </div>`;
    row.appendChild(card);
  });
}
