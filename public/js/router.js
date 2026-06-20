/* =================== History API ルーター =================== */

let currentView = 'home';
let _progressTimer = null;

/* ---------- プログレスバー ---------- */
function progressStart() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  clearTimeout(_progressTimer);
  bar.style.width = '0%';
  bar.classList.add('active');
  let w = 0;
  const tick = () => {
    w = w < 70 ? w + Math.random() * 15 : w + Math.random() * 3;
    if (w > 92) w = 92;
    bar.style.width = w + '%';
    if (w < 92) _progressTimer = setTimeout(tick, 200 + Math.random() * 200);
  };
  _progressTimer = setTimeout(tick, 80);
}

function progressDone() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  clearTimeout(_progressTimer);
  bar.style.width = '100%';
  setTimeout(() => { bar.classList.remove('active'); bar.style.width = '0%'; }, 400);
}

/* ---------- ビュー切り替えコア ---------- */
function navigate(viewName, opts = {}) {
  progressStart();

  /* 全ビュー非表示 */
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  /* サイドバーアクティブ */
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const navEl = document.getElementById(`nav-${viewName}`);
  if (navEl) navEl.classList.add('active');

  /* カテゴリバー */
  const showCats = ['home', 'search', 'history', 'subscriptions'].includes(viewName);
  const catsBar = document.getElementById('categories-bar');
  if (catsBar) catsBar.style.display = showCats ? 'flex' : 'none';

  /* メインコンテントのマージン */
  const mc = document.getElementById('main-content');
  if (mc) {
    if (viewName === 'shorts') {
      mc.style.padding = '0';
      mc.style.marginTop = '56px';
    } else {
      mc.style.padding = '24px';
      mc.style.marginTop = showCats ? '112px' : '56px';
    }
  }

  currentView = viewName;

  /* ウォッチ時はサイドバー/カテゴリ非表示 */
  document.body.classList.toggle('is-watching', viewName === 'watch');

  /* ウォッチ以外でプレーヤーをクリア */
  if (viewName !== 'watch') {
    const wrapper = document.getElementById('player-wrapper');
    if (wrapper) {
      wrapper.innerHTML = '<iframe id="yt-player" allow="autoplay; fullscreen" allowfullscreen></iframe>';
      window.currentGVFormats = null;
      window.currentGVAllFormats = null;
    }
  }

  /* ショート以外でショート停止 */
  if (viewName !== 'shorts') {
    document.querySelectorAll('#shorts-container .short-snap-item').forEach(item => {
      const iframe = item.querySelector('iframe');
      if (iframe) iframe.src = 'about:blank';
      item.querySelectorAll('video, audio').forEach(el => { try { el.pause(); el.src = ''; } catch (_) {} });
    });
    if (window.shortObserver) { window.shortObserver.disconnect(); window.shortObserver = null; }
  }

  /* ショートを開いた時: 初回ロード */
  if (viewName === 'shorts' && document.getElementById('shorts-container')?.children.length === 0) {
    document.getElementById('shorts-loader')?.classList.remove('hidden');
    window.shortSrcMap = {};
    window.shortStreamType = getAppConfig().shortStream || 1;
    triggerSearch(((window.lastQuery) ? window.lastQuery : '人気') + ' #shorts', 'shorts');
  }

  /* ページ固有初期化 */
  if (viewName === 'history')       renderLocalList('history');
  if (viewName === 'settings')      { renderSettingsSubsList(); syncSettingsUI(); }
  if (viewName === 'subscriptions') renderSubscriptionsPage();
  if (viewName === 'playlists')     renderPlaylistsPage();

  window.scrollTo(0, 0);

  /* History API push */
  if (!opts.noHistory) {
    const url = buildUrl(viewName, opts);
    try { history.pushState({ view: viewName, ...opts }, '', url); } catch (_) {}
  }

  setTimeout(progressDone, 400);
}

function buildUrl(viewName, opts = {}) {
  if (viewName === 'home')          return '/';
  if (viewName === 'watch')         return opts.videoId ? `/watch?v=${opts.videoId}` : '/watch';
  if (viewName === 'shorts')        return opts.videoId ? `/shorts/${opts.videoId}` : '/shorts';
  if (viewName === 'search')        return window.lastQuery ? `/search?q=${encodeURIComponent(window.lastQuery)}` : '/search';
  if (viewName === 'channel')       return window.currentChannelId ? `/@${window.currentChannelId}` : '/channel';
  if (viewName === 'history')       return '/feed/history';
  if (viewName === 'subscriptions') return '/feed/subscriptions';
  if (viewName === 'settings')      return '/settings';
  if (viewName === 'playlists')     return '/playlists';
  if (viewName === 'welcome')       return '/';
  return '/' + viewName;
}

/* ---------- 初期 URL 解析 ---------- */
function parseInitialUrl() {
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  if (path === '/' || path === '') return { view: 'home' };
  if (path.startsWith('/watch'))        return { view: 'watch',  videoId: params.get('v') || '' };
  if (path.startsWith('/shorts/'))      return { view: 'shorts', videoId: path.replace('/shorts/', '') };
  if (path.startsWith('/shorts'))       return { view: 'shorts' };
  if (path.startsWith('/search'))       return { view: 'search', query: params.get('q') || params.get('v') || '' };
  if (path.startsWith('/feed/history')) return { view: 'history' };
  if (path.startsWith('/feed/subs'))    return { view: 'subscriptions' };
  if (path.startsWith('/settings'))     return { view: 'settings' };
  if (path.startsWith('/playlists'))    return { view: 'playlists' };
  if (path.startsWith('/@'))            return { view: 'channel', channelId: path.slice(2) };
  if (path.startsWith('/channel'))      return { view: 'channel', channelId: params.get('id') || '' };
  return { view: 'home' };
}

/* ---------- ポップステート ---------- */
window.addEventListener('popstate', e => {
  if (!e.state) { navigate('home', { noHistory: true }); return; }
  const { view, videoId, title, channel, thumb, query, channelId, channelName } = e.state;
  if (view === 'watch' && videoId)  playVideo(videoId, title || '', channel || '', thumb || null, true);
  else if (view === 'shorts' && videoId) navigateToShortPage(videoId, title, channel, thumb, true);
  else if (view === 'channel') {
    if (channelName || channelId) openChannel(channelName || channelId, null);
    else navigate('channel', { noHistory: true });
  } else if (view === 'search') {
    const q = query || new URLSearchParams(location.search).get('q') || '';
    if (q) {
      const inp = document.getElementById('search-input');
      if (inp) inp.value = q;
      window.lastQuery = q;
      navigate('search', { noHistory: true });
      triggerSearch(q, 'search');
    } else navigate('search', { noHistory: true });
  } else if (view) navigate(view, { noHistory: true });
});

/* ---------- 設定スライドパネル ---------- */
function openSettings() {
  let panel = document.getElementById('__settings_panel');
  let backdrop = document.getElementById('__settings_backdrop');
  if (!panel) {
    backdrop = document.createElement('div');
    backdrop.id = '__settings_backdrop';
    backdrop.onclick = closeSettings;
    panel = document.createElement('div');
    panel.id = '__settings_panel';
    panel.innerHTML = `
      <div class="sp-head">
        <h3>⚙️ 設定</h3>
        <button class="sp-close" onclick="closeSettings()">×</button>
      </div>
      <div class="sp-body" id="__settings_body"></div>`;
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  }
  const body = document.getElementById('__settings_body');
  if (body && !body.firstChild) {
    const src = document.querySelector('#view-settings .settings-panel') || document.getElementById('view-settings');
    if (src) {
      const clone = src.cloneNode(true);
      clone.style.display = 'block';
      body.appendChild(clone);
    }
  }
  panel.classList.add('open');
  backdrop.classList.add('open');
  syncSettingsUI();
}

function closeSettings() {
  document.getElementById('__settings_panel')?.classList.remove('open');
  document.getElementById('__settings_backdrop')?.classList.remove('open');
}

/* navigate('settings') → スライドパネルへ */
const _origNavigate = navigate;
window.navigate = function(viewName, opts = {}) {
  if (viewName === 'settings') { openSettings(); return; }
  return _origNavigate(viewName, opts);
};
