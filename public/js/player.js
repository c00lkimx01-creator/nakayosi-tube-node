/* =================== 動画プレーヤー =================== */

let currentVideoId = null;
let currentVideoTitle = '';
let currentChannelName = '';
let currentChannelThumb = '';
let currentGVFormats = null;
let currentGVAllFormats = null;
let watchLoopEnabled = false;
let selectedQuality = null;
let theaterMode = false;
let currentEduKey = null;
let shortSrcMap = {};
let shortStreamType = 1;

/* =================== メイン動画再生 =================== */
async function playVideo(videoId, title, channel, thumb, noHistory = false) {
  if (!videoId) return;
  currentVideoId = videoId;
  currentVideoTitle = title || '';
  currentChannelName = channel || '';
  currentChannelThumb = thumb || '';

  /* 履歴 */
  addToHistory({ id: videoId, title, channel, authorThumb: thumb || '', duration: 0 });

  navigate('watch', { videoId, title, channel, thumb, noHistory });

  /* タイトルセット */
  const titleEl = document.getElementById('watch-title');
  if (titleEl) titleEl.textContent = title || '';
  document.title = (title || 'Premium +') + ' — 仲良しTube+';

  /* チャンネル情報 */
  const nameEl = document.getElementById('watch-channel-name');
  const iconEl = document.getElementById('watch-channel-icon');
  if (nameEl) nameEl.textContent = channel || '';
  if (iconEl) {
    iconEl.src = thumb || `https://i.pravatar.cc/80?u=${encodeURIComponent(channel || videoId)}`;
    iconEl.onerror = () => { iconEl.src = `https://i.pravatar.cc/80?u=${encodeURIComponent(channel || videoId)}`; };
  }
  updateWatchSubscribeUI(channel || '');

  /* 購読ボタン */
  const subBtn = document.getElementById('watch-subscribe-btn');
  if (subBtn) {
    subBtn.onclick = () => toggleSubscribeFromWatch();
  }

  /* ストリーム再生 */
  const cfg = getAppConfig();
  await switchStream(cfg.stream || 1);

  /* 説明文・メタデータ取得 (非同期) */
  fetchAndRenderDescription(videoId);

  /* 関連動画 */
  fetchRelatedVideos(videoId);
}

async function fetchAndRenderDescription(videoId) {
  const descEl  = document.getElementById('api-desc');
  const viewsEl = document.getElementById('api-views');
  const likesEl = document.getElementById('api-likes');
  const dateEl  = document.getElementById('api-date');
  if (descEl) descEl.innerHTML = '読み込み中...';
  try {
    const d = await fetchVideoDescription(videoId);
    if (!d) { if (descEl) descEl.textContent = '概要はありません。'; return; }
    if (viewsEl && d.viewCount) viewsEl.textContent = Number(d.viewCount).toLocaleString();
    if (likesEl && d.likeCount)  likesEl.textContent = Number(d.likeCount).toLocaleString();
    if (dateEl  && d.published)  dateEl.textContent  = ` • ${new Date(d.published * 1000).toLocaleDateString('ja-JP')}`;
    if (descEl) {
      const raw = d.descriptionHtml || d.description || '';
      descEl.innerHTML = raw ? _linkifyText(d.description || '') : '概要はありません。';
    }
  } catch (e) {
    if (descEl) descEl.textContent = '概要の取得に失敗しました';
  }
}

function toggleDescription() {
  const desc = document.querySelector('.video-description');
  if (!desc) return;
  desc.classList.toggle('expanded');
  const toggleText = document.getElementById('desc-toggle-text');
  if (toggleText) toggleText.textContent = desc.classList.contains('expanded') ? '閉じる' : '続きを読む';
}

async function fetchRelatedVideos(videoId) {
  const loader = document.getElementById('related-loader');
  if (loader) loader.classList.remove('hidden');
  try {
    const results = await fetchFromInvidious(currentVideoTitle || videoId, 'search', 1);
    renderRelatedVideos(results || []);
  } catch (_) {
    if (loader) loader.classList.add('hidden');
  }
}

/* =================== ストリーム切替 =================== */
async function switchStream(type) {
  const cfg = getAppConfig();
  setAppConfig({ stream: type });
  shortStreamType = type;

  /* ストリームボタン UI */
  const lbl = document.getElementById('stream-label');
  if (lbl) lbl.textContent = type === 1 ? 'Nocookie' : type === 2 ? 'Edu' : type === 3 ? 'Stream' : 'Preview';
  document.querySelectorAll('#stream-panel .stream-option').forEach(o => {
    o.classList.toggle('active', parseInt(o.dataset.s) === type);
  });
  const sp = document.getElementById('stream-panel');
  if (sp) sp.classList.remove('open');

  /* プレーヤーラッパーをクリア */
  const wrapper = document.getElementById('player-wrapper');
  if (!wrapper) return;
  currentGVFormats = null;
  currentGVAllFormats = null;
  document.getElementById('quality-wrap')?.style.setProperty('display', 'none');

  if (type === 1) {
    /* Nocookie */
    wrapper.innerHTML = '<iframe id="yt-player" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    await new Promise(r => setTimeout(r, 0));
    const iframe = document.getElementById('yt-player');
    if (iframe) {
      let url = `https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1&rel=0`;
      if (watchLoopEnabled) url += `&loop=1&playlist=${currentVideoId}`;
      iframe.src = url;
    }
  } else if (type === 2) {
    /* Edu */
    wrapper.innerHTML = '<iframe id="yt-player" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    const key = await fetchKahootKey();
    await new Promise(r => setTimeout(r, 0));
    const iframe = document.getElementById('yt-player');
    if (iframe) {
      if (key) {
        const cfg2 = encodeURIComponent(JSON.stringify({ enc: key, hideTitle: true }));
        iframe.src = `https://www.youtubeeducation.com/embed/${currentVideoId}?autoplay=1&origin=https%3A%2F%2Fcreate.kahoot.it&embed_config=${cfg2}`;
      } else {
        iframe.src = `https://www.youtubeeducation.com/embed/${currentVideoId}?autoplay=1&rel=0`;
      }
    }
  } else if (type === 3) {
    /* Stream / Manifest Hunter */
    await setupWatchManifest(currentVideoId);
  } else if (type === 4) {
    /* Preview */
    wrapper.innerHTML = '<iframe id="yt-player" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>';
    await new Promise(r => setTimeout(r, 0));
    const iframe = document.getElementById('yt-player');
    if (iframe) {
      let url = `https://www.youtube.com/embed/${currentVideoId}?autoplay=1&mute=0&rel=0`;
      if (watchLoopEnabled) url += `&loop=1&playlist=${currentVideoId}`;
      iframe.src = url;
    }
  }
}

/* =================== Manifest Hunter =================== */
async function setupWatchManifest(videoId) {
  const wrapper = document.getElementById('player-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '<div class="loader-spinner-wrap"><div class="spinner-ring"></div></div>';

  const formats = await fetchGoogleVideoStreamsInvidious(videoId);
  if (!formats) { switchStream(1); return; }

  currentGVAllFormats = formats;
  const hlsFormat = formats.find(f => f.url && (f.type?.includes('application/x-mpegURL') || f.url.includes('.m3u8') || f.url.includes('googlevideo') && f.itag === 95));
  const adaptiveV  = formats.filter(f => f.url && f.type?.startsWith('video/mp4') && f.bitrate);
  const adaptiveA  = formats.filter(f => f.url && f.type?.startsWith('audio/'));
  const combos     = formats.filter(f => f.url && !f.type?.startsWith('audio/') && f.quality);

  wrapper.innerHTML = '';

  if (hlsFormat) {
    const vid = document.createElement('video');
    vid.style.cssText = 'width:100%;height:100%;background:#000;';
    vid.controls = true;
    vid.autoplay = true;
    wrapper.appendChild(vid);
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsFormat.url);
      hls.attachMedia(vid);
      hls.on(Hls.Events.ERROR, () => switchStream(1));
    } else {
      vid.src = hlsFormat.url;
    }
  } else if (adaptiveV.length && adaptiveA.length) {
    const vid = document.createElement('video');
    vid.style.cssText = 'width:100%;height:100%;background:#000;';
    vid.controls = true;
    vid.autoplay = true;
    vid.crossOrigin = 'anonymous';
    wrapper.appendChild(vid);
    const aud = document.createElement('audio');
    aud.style.display = 'none';
    aud.crossOrigin = 'anonymous';
    wrapper.appendChild(aud);
    currentGVFormats = adaptiveV;
    buildQualityPanel(adaptiveV, vid, aud, adaptiveA[0]);
    const target = adaptiveV.find(f => f.qualityLabel === '360p') || adaptiveV[0];
    vid.src = target.url;
    aud.src = adaptiveA[0].url;
    attachAudioVideoSync(vid, aud);
    vid.play().catch(() => { vid.muted = true; vid.play(); });
    document.getElementById('quality-wrap')?.style.setProperty('display', '');
  } else if (combos.length) {
    const vid = document.createElement('video');
    vid.style.cssText = 'width:100%;height:100%;background:#000;';
    vid.controls = true;
    vid.autoplay = true;
    wrapper.appendChild(vid);
    vid.src = combos[0].url;
  } else {
    switchStream(1);
  }
}

/* =================== 画質パネル =================== */
function buildQualityPanel(formats, vid, aud, audioFmt) {
  const panel = document.getElementById('quality-panel');
  if (!panel) return;
  selectedQuality = null;
  panel.innerHTML = formats.map((f, i) =>
    `<div class="quality-option ${i === 0 ? 'active' : ''}" onclick="selectQuality(${i})">${f.qualityLabel || f.quality || '?'}</div>`
  ).join('');
  panel._formats = formats;
  panel._vid = vid;
  panel._aud = aud;
  panel._audio = audioFmt;
}

function selectQuality(idx) {
  const panel = document.getElementById('quality-panel');
  if (!panel) return;
  const fmt = panel._formats?.[idx];
  if (!fmt) return;
  panel.querySelectorAll('.quality-option').forEach((o, i) => o.classList.toggle('active', i === idx));
  const lbl = document.getElementById('quality-label');
  if (lbl) lbl.textContent = fmt.qualityLabel || fmt.quality || '?';
  if (panel._vid) panel._vid.src = fmt.url;
  panel.classList.remove('open');
}

function toggleQualityPanel(e) {
  e?.stopPropagation();
  document.getElementById('quality-panel')?.classList.toggle('open');
}

function toggleDownloadPanel(e, ctx) {
  e?.stopPropagation();
  const panel = document.getElementById(`download-panel-${ctx}`);
  if (panel) panel.classList.toggle('open');
}

/* =================== ループ / シアター ---------- */
function toggleWatchLoop() {
  watchLoopEnabled = !watchLoopEnabled;
  const btn = document.getElementById('loop-btn');
  if (btn) btn.classList.toggle('active', watchLoopEnabled);
  applyWatchLoop();
}

function applyWatchLoop() {
  const iframe = document.getElementById('yt-player');
  if (!iframe || !currentVideoId) return;
  const src = iframe.src;
  if (!src || src.includes('about:blank')) return;
  try {
    const url = new URL(src);
    if (watchLoopEnabled) {
      url.searchParams.set('loop', '1');
      url.searchParams.set('playlist', currentVideoId);
    } else {
      url.searchParams.delete('loop');
      url.searchParams.delete('playlist');
    }
    iframe.src = url.toString();
  } catch (_) {}
}

function toggleTheaterMode() {
  theaterMode = !theaterMode;
  document.body.classList.toggle('theater-mode', theaterMode);
  const btn = document.getElementById('theater-btn');
  if (btn) btn.classList.toggle('active', theaterMode);
}

/* =================== ストリームパネル ---------- */
function toggleStreamPanel(e) {
  e?.stopPropagation();
  document.getElementById('stream-panel')?.classList.toggle('open');
}

/* =================== 登録ボタン (ウォッチ) ---------- */
function toggleSubscribeFromWatch() {
  const name = document.getElementById('watch-channel-name')?.textContent;
  const thumb = document.getElementById('watch-channel-icon')?.src;
  if (!name) return;
  let subs = getSubscriptions();
  if (isSubscribed(name)) {
    subs = subs.filter(s => s.name !== name);
  } else {
    subs.unshift({ name, thumb: thumb || '', isLive: false });
  }
  saveSubscriptions(subs);
  updateWatchSubscribeUI(name);
  renderSidebarSubscriptions();
}

function updateWatchSubscribeUI(name) {
  const btn = document.getElementById('watch-subscribe-btn');
  if (!btn) return;
  const subbed = isSubscribed(name);
  btn.textContent = subbed ? '登録済み' : 'チャンネル登録';
  btn.classList.toggle('subscribed', subbed);
}

/* =================== シェア / DL ---------- */
function shareVideo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  if (navigator.share) {
    navigator.share({ title: currentVideoTitle, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url);
    alert('URLをコピーしました: ' + url);
  }
}

/* =================== キーボードショートカット =================== */
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
  const vid = document.querySelector('#player-wrapper video, #view-watch video');
  if (!vid) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'k') { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
  else if (k === 'f') { e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : vid.requestFullscreen?.(); }
  else if (k === 'm') { e.preventDefault(); vid.muted = !vid.muted; }
  else if (k === 'j') { e.preventDefault(); vid.currentTime = Math.max(0, vid.currentTime - 10); }
  else if (k === 'l') { e.preventDefault(); vid.currentTime = Math.min(vid.duration || 1e9, vid.currentTime + 10); }
  else if (k === 'arrowleft')  { e.preventDefault(); vid.currentTime = Math.max(0, vid.currentTime - 5); }
  else if (k === 'arrowright') { e.preventDefault(); vid.currentTime = Math.min(vid.duration || 1e9, vid.currentTime + 5); }
  else if (k === 'arrowup')    { e.preventDefault(); vid.volume = Math.min(1, vid.volume + 0.05); }
  else if (k === 'arrowdown')  { e.preventDefault(); vid.volume = Math.max(0, vid.volume - 0.05); }
  else if (k >= '0' && k <= '9') { e.preventDefault(); vid.currentTime = (parseInt(k, 10) / 10) * (vid.duration || 0); }
}, true);

/* パネルを外クリックで閉じる */
document.addEventListener('click', e => {
  if (!e.target.closest('.stream-panel-wrap')) {
    document.getElementById('stream-panel')?.classList.remove('open');
  }
  if (!e.target.closest('.quality-wrap')) {
    document.getElementById('quality-panel')?.classList.remove('open');
  }
  if (!e.target.closest('.download-wrap')) {
    document.querySelectorAll('.download-panel').forEach(p => p.classList.remove('open'));
  }
});
