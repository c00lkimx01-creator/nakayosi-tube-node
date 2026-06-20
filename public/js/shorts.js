/* =================== ショート =================== */

let currentShortItems = [];
let shortObserver = null;

/* ---------- ショートページへ移動 ---------- */
function navigateToShortPage(videoId, title, channel, thumb, noHistory = false) {
  navigate('shorts', { videoId, title, channel, thumb, noHistory });
  setTimeout(() => {
    const container = document.getElementById('shorts-container');
    if (!container) return;
    container.innerHTML = '';
    currentShortItems = [];
    initShortObserver();
    const targetVideo = {
      id: videoId, title: title || '', channel: channel || '',
      authorThumb: thumb || `https://i.pravatar.cc/80?u=${videoId}`, isShort: true
    };
    renderShorts([targetVideo], false);
    triggerSearch(((window.lastQuery) ? window.lastQuery : '人気') + ' #shorts', 'shorts', true);
  }, 80);
}

/* ---------- ショートレンダリング ---------- */
function renderShorts(videos, append = false) {
  const container = document.getElementById('shorts-container');
  if (!container) return;
  if (!append) { container.innerHTML = ''; currentShortItems = []; initShortObserver(); }
  currentShortItems = [...currentShortItems, ...videos];
  videos.forEach(v => {
    const item = document.createElement('div');
    item.className = 'short-snap-item';
    item.dataset.id = v.id;
    const channelSafe = (v.channel || '').replace(/'/g, "\\'");
    const titleSafe   = (v.title   || '').replace(/</g, '&lt;');
    const initialSrc  = buildShortNocookieSrc(v.id);
    shortSrcMap[v.id] = initialSrc;
    const likeCount = Math.floor(Math.random() * 50000) + 100;
    const likeStr = likeCount >= 10000 ? (likeCount / 1000).toFixed(0) + 'K' : likeCount.toLocaleString();
    const subbed = isSubscribed(v.channel || '');
    item.innerHTML = `
      <div class="short-center">
        <div class="short-video-wrap" id="short-wrap-${v.id}">
          <iframe src="about:blank" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          <div class="short-stream-selector">
            <button class="short-stream-btn ${shortStreamType===1?'active':''}" onclick="changeShortStream(1,'${v.id}')">NC</button>
            <button class="short-stream-btn ${shortStreamType===2?'active':''}" onclick="changeShortStream(2,'${v.id}')">Edu</button>
            <button class="short-stream-btn ${shortStreamType===3?'active':''}" onclick="changeShortStream(3,'${v.id}')">MF</button>
          </div>
          <div class="short-overlay-bottom">
            <div class="short-channel" onclick="openChannel('${channelSafe}','${v.authorThumb||''}')">
              <img src="${v.authorThumb || `https://i.pravatar.cc/80?u=${v.channel}`}"
                   onerror="this.src='https://i.pravatar.cc/80?u=${encodeURIComponent(v.channel||'')}'">
              <span class="short-channel-name">${v.channel || ''}</span>
              <button class="short-sub-btn ${subbed?'subscribed':''}" id="short-sub-btn-${v.id}"
                      onclick="event.stopPropagation();toggleSubscribeFromShort('${channelSafe}','${v.authorThumb||''}',this)">
                ${subbed ? '登録済み' : '登録'}
              </button>
            </div>
            <div class="short-title">${titleSafe}</div>
          </div>
        </div>
        <div class="short-side-actions">
          <div class="short-action-btn" onclick="openChannel('${channelSafe}','${v.authorThumb||''}')">
            <div class="icon short-avatar-btn">
              <img src="${v.authorThumb || `https://i.pravatar.cc/80?u=${v.channel}`}"
                   style="width:48px;height:48px;border-radius:50%;object-fit:cover;"
                   onerror="this.src='https://i.pravatar.cc/48?u=${encodeURIComponent(v.channel||'')}'">
            </div>
          </div>
          <div class="short-action-btn" onclick="toggleShortLike(this)">
            <div class="icon">
              <svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none;">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
              </svg>
            </div>
            <span class="short-like-count">${likeStr}</span>
          </div>
          <div class="short-action-btn" onclick="openShortComments('${v.id}','${titleSafe}')">
            <div class="icon">
              <svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none;">
                <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
              </svg>
            </div>
            <span>コメント</span>
          </div>
          <div class="short-action-btn" onclick="shareShort('${v.id}')">
            <div class="icon">
              <svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none;">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
              </svg>
            </div>
            <span>共有</span>
          </div>
          <div class="short-action-btn" onclick="playVideo('${v.id}','${titleSafe}','${channelSafe}','${v.authorThumb||''}')">
            <div class="icon">
              <svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none;">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <span>詳細</span>
          </div>
        </div>
      </div>`;
    container.appendChild(item);
    observeShortItem(item);
  });
  document.getElementById('shorts-loader')?.classList.add('hidden');
}

/* ---------- IntersectionObserver ---------- */
function initShortObserver() {
  if (shortObserver) shortObserver.disconnect();
  shortObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const item = entry.target;
      const id = item.dataset.id;
      if (!id) return;
      const iframe = item.querySelector('iframe');
      if (entry.isIntersecting) {
        if (iframe && iframe.src === 'about:blank' && shortSrcMap[id]) {
          iframe.src = shortSrcMap[id];
        }
      } else {
        if (iframe && !iframe.src.includes('about:blank')) {
          iframe.dataset.savedSrc = iframe.src;
          iframe.src = 'about:blank';
        }
        item.querySelectorAll('video, audio').forEach(el => { try { el.pause(); } catch (_) {} });
      }
    });
  }, { threshold: 0.5, rootMargin: '100px 0px' });
}

function observeShortItem(item) {
  if (shortObserver) shortObserver.observe(item);
}

/* ---------- ショートストリーム変更 ---------- */
async function changeShortStream(type, targetVideoId) {
  shortStreamType = type;
  setAppConfig({ shortStream: type });
  currentShortItems.forEach(v => {
    const wrap = document.getElementById(`short-wrap-${v.id}`);
    if (!wrap) return;
    wrap.querySelectorAll('.short-stream-btn').forEach((b, i) => b.classList.toggle('active', i + 1 === type));
  });
  if (type === 1) {
    currentShortItems.forEach(v => {
      const src = buildShortNocookieSrc(v.id);
      shortSrcMap[v.id] = src;
      const wrap = document.getElementById(`short-wrap-${v.id}`);
      if (!wrap) return;
      wrap.querySelectorAll('video, audio').forEach(el => el.remove());
      let iframe = wrap.querySelector('iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        wrap.insertBefore(iframe, wrap.firstChild);
      }
      iframe.style.display = '';
      iframe.src = src;
    });
  } else if (type === 2) {
    if (!currentEduKey) currentEduKey = await fetchKahootKey();
    if (!currentEduKey) { alert('Edu準備中'); shortStreamType = 1; changeShortStream(1, targetVideoId); return; }
    currentShortItems.forEach(v => {
      const src = buildShortEduSrc(v.id, currentEduKey);
      shortSrcMap[v.id] = src;
      const wrap = document.getElementById(`short-wrap-${v.id}`);
      if (!wrap) return;
      wrap.querySelectorAll('video, audio').forEach(el => el.remove());
      let iframe = wrap.querySelector('iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        wrap.insertBefore(iframe, wrap.firstChild);
      }
      iframe.style.display = '';
      iframe.src = src;
    });
  } else if (type === 3) {
    /* Manifest Hunter */
    currentShortItems.forEach(v => {
      const wrap = document.getElementById(`short-wrap-${v.id}`);
      if (!wrap) return;
      const iframe = wrap.querySelector('iframe');
      if (iframe) { iframe.src = 'about:blank'; iframe.style.display = 'none'; }
      wrap.querySelectorAll('video, audio').forEach(el => el.remove());
      const loading = document.createElement('div');
      loading.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);color:#fff;font-size:14px;';
      loading.innerHTML = '<div style="text-align:center;"><div class="spinner-ring" style="border-top-color:#fff;margin:0 auto 8px;"></div>読み込み中...</div>';
      wrap.appendChild(loading);
    });
    for (const v of currentShortItems) {
      const wrap = document.getElementById(`short-wrap-${v.id}`);
      if (!wrap) continue;
      (async () => {
        const loadingEl = wrap.querySelector('div[style*="rgba(0,0,0,0.6)"]');
        try {
          const formats = await fetchGoogleVideoStreamsInvidious(v.id);
          if (loadingEl) loadingEl.remove();
          if (!formats) { const i = wrap.querySelector('iframe'); if (i) { i.style.display = ''; i.src = buildShortNocookieSrc(v.id); } return; }
          const adaptiveV = formats.filter(f => f.url && f.type?.startsWith('video/mp4'));
          const adaptiveA = formats.filter(f => f.url && f.type?.startsWith('audio/'));
          if (adaptiveV.length) {
            const iframe = wrap.querySelector('iframe');
            if (iframe) iframe.style.display = 'none';
            const vid = document.createElement('video');
            vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;';
            vid.autoplay = true; vid.loop = true; vid.playsInline = true; vid.crossOrigin = 'anonymous';
            const target = adaptiveV.find(f => f.qualityLabel === '360p') || adaptiveV[0];
            vid.src = target.url;
            wrap.appendChild(vid);
            if (adaptiveA.length) {
              const aud = document.createElement('audio');
              aud.style.display = 'none'; aud.loop = true; aud.crossOrigin = 'anonymous';
              aud.src = adaptiveA[0].url; wrap.appendChild(aud);
              attachAudioVideoSync(vid, aud);
            } else { vid.muted = true; }
            vid.play().catch(() => { vid.muted = true; vid.play(); });
          } else {
            const i = wrap.querySelector('iframe');
            if (i) { i.style.display = ''; i.src = buildShortNocookieSrc(v.id); }
          }
        } catch (_) {
          if (loadingEl) loadingEl.remove();
          const i = wrap.querySelector('iframe');
          if (i) { i.style.display = ''; i.src = buildShortNocookieSrc(v.id); }
        }
      })();
    }
  }
}

function buildShortNocookieSrc(videoId) {
  const m = window._shortMuted ? 1 : 0;
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${m}&loop=1&playlist=${videoId}&rel=0`;
}
function buildShortEduSrc(videoId, key) {
  if (!key) return buildShortNocookieSrc(videoId);
  const cfg = encodeURIComponent(JSON.stringify({ enc: key, hideTitle: true }));
  return `https://www.youtubeeducation.com/embed/${videoId}?autoplay=1&origin=https%3A%2F%2Fcreate.kahoot.it&embed_config=${cfg}`;
}

/* ---------- ショートコメント ---------- */
function openShortComments(videoId, title) {
  const panelId = `short-comments-panel-${videoId}`;
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.style.display = 'block';
    loadShortComments(videoId);
    return;
  }
  /* グローバルコメントパネル */
  ensureShortCommentsPanel(videoId);
}

function ensureShortCommentsPanel(videoId) {
  let panel = document.getElementById('__short_cmt');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = '__short_cmt';
    panel.style.cssText = 'position:fixed;right:0;top:0;bottom:0;width:380px;max-width:92vw;background:var(--bg-color);color:var(--text-color);border-left:1px solid var(--border-color);transform:translateX(110%);transition:transform .25s;z-index:9999;display:flex;flex-direction:column;';
    panel.innerHTML = `
      <div style="padding:14px 18px;border-bottom:1px solid var(--border-color);display:flex;gap:8px;align-items:center;">
        <b style="flex:1;">コメント</b>
        <button data-sort="top" class="__scs" style="padding:4px 10px;border-radius:12px;border:1px solid var(--border-color);background:var(--text-color);color:var(--bg-color);font-size:11px;">話題順</button>
        <button data-sort="new" class="__scs" style="padding:4px 10px;border-radius:12px;border:1px solid var(--border-color);background:var(--chip-bg);color:var(--text-color);font-size:11px;">新しい順</button>
        <button onclick="document.getElementById('__short_cmt').style.transform='translateX(110%)'" style="width:32px;height:32px;border-radius:50%;background:var(--chip-bg);margin-left:6px;">×</button>
      </div>
      <div class="body" id="__short_cmt_body" style="flex:1;overflow-y:auto;padding:12px 16px;">
        <div style="padding:24px;color:var(--text-secondary);">コメントなし</div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelectorAll('.__scs').forEach(b => {
      b.onclick = () => {
        panel.querySelectorAll('.__scs').forEach(x => {
          const active = x.dataset.sort === b.dataset.sort;
          x.style.background = active ? 'var(--text-color)' : 'var(--chip-bg)';
          x.style.color = active ? 'var(--bg-color)' : 'var(--text-color)';
        });
        loadShortComments(panel.dataset.vid, b.dataset.sort);
      };
    });
  }
  panel.dataset.vid = videoId;
  panel.style.transform = 'translateX(0)';
  loadShortComments(videoId, 'top');
}

async function loadShortComments(videoId, sort = 'top') {
  const body = document.getElementById('__short_cmt_body');
  if (!body) return;
  body.innerHTML = '<div style="padding:24px;color:var(--text-secondary);">読み込み中...</div>';
  try {
    const data = await fetchCommentsFromInvidious(videoId, sort);
    if (!data || !data.comments?.length) {
      body.innerHTML = '<div style="padding:24px;color:var(--text-secondary);">コメントなし</div>';
      return;
    }
    body.innerHTML = data.comments.slice(0, 80).map(c => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border-color);font-size:13px;">
        <div style="font-weight:600;color:var(--text-secondary);font-size:12px;margin-bottom:4px;">${c.author || ''}</div>
        <div>${(c.content || '').replace(/</g, '&lt;')}</div>
      </div>`).join('');
  } catch (_) {
    body.innerHTML = '<div style="padding:24px;color:var(--text-secondary);">取得に失敗しました</div>';
  }
}

function closeShortComments(videoId) {
  const panel = document.getElementById(`short-comments-panel-${videoId}`);
  if (panel) panel.style.display = 'none';
  const global = document.getElementById('__short_cmt');
  if (global) global.style.transform = 'translateX(110%)';
}

/* ---------- ショートホーム用 ---------- */
async function fetchShortsForHome() {
  const container = document.getElementById('home-shorts-container');
  const section = document.getElementById('home-shorts');
  const container2 = document.getElementById('home-shorts2-container');
  const section2 = document.getElementById('home-shorts2');
  if (!container || !section) return;
  const queries = ['人気 #shorts','#shorts 人気','ショート 人気','shorts popular japan','おすすめ #shorts','面白い #shorts'];
  const seen = new Set();
  let shorts = [];
  let firstShown = false;
  const FIRST_LIMIT = 48, SECOND_LIMIT = 48;
  const tasks = queries.map(q => fetchFromInvidious(q, 'shorts', 1).then(data => {
    if (!data?.length) return;
    for (const v of data) {
      if (!v.videoId || seen.has(v.videoId)) continue;
      if (v.lengthSeconds < 0 || (v.lengthSeconds > 65 && !v.isShort)) continue;
      if (!_isWithinOneYear(v)) continue;
      seen.add(v.videoId); shorts.push(v);
    }
    if (!firstShown && shorts.length >= 1) {
      firstShown = true;
      renderShortCardsTo(container, shorts.slice(0, FIRST_LIMIT));
      section.classList.remove('hidden');
    } else if (firstShown) {
      renderShortCardsTo(container, shorts.slice(0, FIRST_LIMIT));
      if (container2 && section2 && shorts.length > FIRST_LIMIT) {
        renderShortCardsTo(container2, shorts.slice(FIRST_LIMIT, FIRST_LIMIT + SECOND_LIMIT));
        section2.classList.remove('hidden');
      }
    }
  }).catch(() => null));
  await Promise.all(tasks);
  if (!shorts.length) return;
  if (!firstShown) { renderShortCardsTo(container, shorts.slice(0, FIRST_LIMIT)); section.classList.remove('hidden'); }
  if (container2 && section2 && shorts.length > FIRST_LIMIT) {
    renderShortCardsTo(container2, shorts.slice(FIRST_LIMIT, FIRST_LIMIT + SECOND_LIMIT));
    section2.classList.remove('hidden');
  }
}

async function fetchShortsForSearch(query) {
  const container = document.getElementById('search-shorts-container');
  const section = document.getElementById('search-shorts-section');
  if (!container || !section) return;
  const queries = [`${query} #shorts`, `${query} shorts`, `#shorts ${query}`, query];
  const seen = new Set();
  let collected = [];
  let shown = false;
  const renderNow = () => {
    container.innerHTML = '';
    collected.slice(0, 12).forEach(v => {
      const div = document.createElement('div');
      div.className = 'home-short-card';
      div.onclick = () => navigateToShortPage(v.videoId, v.title, v.author, v.authorThumbnails?.[0]?.url);
      div.innerHTML = `
        <div class="home-short-thumb">
          <img src="https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg" loading="lazy" decoding="async">
        </div>
        <div class="home-short-title">${v.title || ''}</div>`;
      container.appendChild(div);
    });
    section.classList.remove('hidden');
  };
  const tasks = queries.map(q => fetchFromInvidious(q, 'shorts', 1).then(data => {
    if (!data?.length) return;
    let added = 0;
    for (const v of data) {
      if (!v?.videoId || seen.has(v.videoId)) continue;
      if (!(v.lengthSeconds > 0 && v.lengthSeconds <= 61)) continue;
      seen.add(v.videoId); collected.push(v); added++;
    }
    if (added > 0) { if (!shown) { shown = true; renderNow(); } else renderNow(); }
  }).catch(() => null));
  await Promise.all(tasks);
}

/* ---------- ショートいいね ---------- */
function toggleShortLike(btn) {
  btn.classList.toggle('active');
  const countEl = btn.querySelector('.short-like-count');
  if (!countEl) return;
  const cur = parseInt(countEl.textContent.replace(/[^0-9]/g, '')) || 0;
  countEl.textContent = btn.classList.contains('active') ? (cur + 1).toLocaleString() : cur.toLocaleString();
  if (btn.classList.contains('active')) {
    btn.querySelector('svg')?.style.setProperty('fill', 'var(--primary-color)');
  } else {
    btn.querySelector('svg')?.style.setProperty('fill', 'currentColor');
  }
}

function toggleShortDislike(btn) {
  btn.classList.toggle('active');
}

/* ---------- ショート登録 ---------- */
function toggleSubscribeFromShort(channelName, thumb, btnEl) {
  let subs = getSubscriptions();
  if (isSubscribed(channelName)) {
    subs = subs.filter(s => s.name !== channelName);
    if (btnEl) { btnEl.textContent = '登録'; btnEl.classList.remove('subscribed'); }
  } else {
    subs.unshift({ name: channelName, thumb: thumb || '', isLive: false });
    if (btnEl) { btnEl.textContent = '登録済み'; btnEl.classList.add('subscribed'); }
  }
  saveSubscriptions(subs);
  renderSidebarSubscriptions();
}

function shareShort(videoId) {
  const url = `https://www.youtube.com/shorts/${videoId}`;
  if (navigator.share) navigator.share({ url }).catch(() => {});
  else { navigator.clipboard?.writeText(url); alert('URLをコピーしました'); }
}

/* ショート表示外停止ウォッチャー */
setInterval(() => {
  if (!document.getElementById('view-shorts')?.classList.contains('active')) return;
  document.querySelectorAll('#shorts-container .short-snap-item').forEach(item => {
    const r = item.getBoundingClientRect();
    const vh = window.innerHeight;
    const visible = r.top < vh * 0.6 && r.bottom > vh * 0.4;
    const iframe = item.querySelector('iframe');
    if (!visible && iframe && !iframe.src.includes('about:blank')) {
      iframe.dataset.savedSrc = iframe.src;
      iframe.src = 'about:blank';
      item.querySelectorAll('video,audio').forEach(el => { try { el.pause(); } catch (_) {} });
    } else if (visible && iframe && iframe.src.includes('about:blank') && iframe.dataset.savedSrc) {
      iframe.src = iframe.dataset.savedSrc;
    }
  });
}, 600);
