/* =================== 定数 & インスタンス管理 =================== */
const KAHOOT_KEY_URL = 'https://apis.kahoot.it/media-api/youtube/key';
const CORS_PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url='
];

/* Invidious インスタンスリスト (起動時に /instances/invidious.json から補強) */
window.INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.f5.si',
  'https://iv.melmac.space',
  'https://yt.omada.cafe',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://yewtu.be',
  'https://invidious.ducks.party',
  'https://inv7.nadeko.net',
  'https://invidious.xyz',
  'https://invidious.kavin.rocks',
  'https://iv.catgirl.cloud',
  'https://invidious.einfachzocken.eu',
  'https://invidious.tiekoetter.com',
  'https://invidious.io.lol',
  'https://invidious-us.kavin.rocks',
  'https://invidious.zee.li',
  'https://inv.eu.projectsegfau.lt',
  'https://inv.jp.projectsegfau.lt',
  'https://inv.in.projectsegfau.lt',
  'https://inv.us.projectsegfau.lt',
  'https://inv.de.projectsegfau.lt'
];

window.PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi-libre.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.projectsegfau.lt'
];

/* 役割分担 */
function _splitInstances(arr, n) {
  const out = Array.from({ length: n }, () => []);
  arr.forEach((x, i) => out[i % n].push(x));
  return out;
}

const INVIDIOUS_ROLES = {
  trend: [], search: [], shorts: [], channel: [], video: []
};

function rebuildRoles() {
  const g = _splitInstances(window.INVIDIOUS_INSTANCES, 5);
  INVIDIOUS_ROLES.trend   = g[0].concat(g[1]).slice(0, 14);
  INVIDIOUS_ROLES.search  = g[1].concat(g[2]).slice(0, 14);
  INVIDIOUS_ROLES.shorts  = g[2].concat(g[3]).slice(0, 14);
  INVIDIOUS_ROLES.channel = g[3].concat(g[4]).slice(0, 14);
  INVIDIOUS_ROLES.video   = g[4].concat(g[0]).slice(0, 12);
}
rebuildRoles();

/* 死亡/速度キャッシュ */
const DEAD_KEY  = '__inv_dead_v2';
const ALIVE_KEY = '__inv_alive_v2';
const DEAD_TTL  = 10 * 60 * 1000;
const ALIVE_TTL =  2 * 60 * 1000;

function loadDeadSet() {
  try {
    const o = JSON.parse(sessionStorage.getItem(DEAD_KEY) || '{}');
    const now = Date.now();
    for (const k in o) if (o[k] < now) delete o[k];
    return o;
  } catch (_) { return {}; }
}
function markDead(base) {
  const d = loadDeadSet();
  d[base] = Date.now() + DEAD_TTL;
  try { sessionStorage.setItem(DEAD_KEY, JSON.stringify(d)); } catch (_) {}
}
function isDead(base) {
  const d = loadDeadSet();
  return !!(d[base] && d[base] > Date.now());
}

let _aliveList = null;
function loadAlive() {
  try {
    const o = JSON.parse(sessionStorage.getItem(ALIVE_KEY) || 'null');
    if (!o || (Date.now() - o.t) > ALIVE_TTL) return null;
    return o.list;
  } catch (_) { return null; }
}
function saveAlive(list) {
  try { sessionStorage.setItem(ALIVE_KEY, JSON.stringify({ t: Date.now(), list })); } catch (_) {}
}

async function refreshAlive() {
  const dead = loadDeadSet();
  const pool = window.INVIDIOUS_INSTANCES.filter(b => !(dead[b] && dead[b] > Date.now())).slice(0, 30);
  if (!pool.length) return;
  const results = [];
  await Promise.all(pool.map(base => {
    const ctrl = new AbortController();
    const t0 = performance.now();
    const to = setTimeout(() => ctrl.abort(), 1500);
    return fetch(base + '/api/v1/stats', { signal: ctrl.signal, cache: 'no-store', mode: 'cors' })
      .then(r => { clearTimeout(to); if (!r.ok) throw 0; results.push({ base, ms: performance.now() - t0 }); })
      .catch(() => { clearTimeout(to); markDead(base); });
  }));
  results.sort((a, b) => a.ms - b.ms);
  const list = results.slice(0, 12).map(x => x.base);
  if (list.length) { _aliveList = list; saveAlive(list); }
}

/* 起動後に1回測定 */
_aliveList = loadAlive();
setTimeout(() => refreshAlive(), 800);
setInterval(() => refreshAlive(), 90_000);

function getInvidiousFor(role) {
  const dead = loadDeadSet();
  const alive = (_aliveList || []).filter(b => !dead[b]);
  const roleList = (INVIDIOUS_ROLES[role] || window.INVIDIOUS_INSTANCES.slice(0, 12)).filter(b => !dead[b]);
  const seen = new Set();
  const out = [];
  for (const u of alive.concat(roleList)) {
    if (u && !seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out.length ? out : window.INVIDIOUS_INSTANCES.slice(0, 8);
}

/* =================== 設定管理 =================== */
function getAppConfig() {
  const defaults = {
    proxy: true,
    stream: 1,
    shortStream: 1,
    trend: true,
    theme: null,
    themeManual: false,
    isFirstVisit: true
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('study2525_config') || '{}') };
  } catch (e) {
    return defaults;
  }
}

function setAppConfig(patch) {
  const cfg = { ...getAppConfig(), ...patch };
  try { localStorage.setItem('study2525_config', JSON.stringify(cfg)); } catch (_) {}
  return cfg;
}

function buildFetchUrl(targetUrl) {
  return getAppConfig().proxy
    ? CORS_PROXIES[0] + encodeURIComponent(targetUrl)
    : targetUrl;
}

/* =================== テーマ =================== */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
}

function initTheme() {
  const cfg = getAppConfig();
  if (cfg.themeManual && cfg.theme) {
    applyTheme(cfg.theme);
  } else {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(dark ? 'dark' : 'light');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      const c = getAppConfig();
      if (!c.themeManual) applyTheme(e.matches ? 'dark' : 'light');
    });
  }
}

function toggleTheme() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  setAppConfig({ theme: next, themeManual: true });
  syncSettingsUI();
}

/* =================== 設定UI同期 =================== */
function syncSettingsUI() {
  const cfg = getAppConfig();
  const byId = id => document.getElementById(id);
  const setChk = (id, v) => { const el = byId(id); if (el) el.checked = v; };
  const setVal = (id, v) => { const el = byId(id); if (el) el.value = v; };

  setChk('setting-proxy',    cfg.proxy);
  setChk('nav-setting-proxy', cfg.proxy);
  setChk('setting-trend',    cfg.trend);
  setChk('nav-setting-trend', cfg.trend);
  setChk('setting-theme',    cfg.theme === 'dark');
  setChk('nav-setting-theme', cfg.theme === 'dark');
  setVal('setting-stream',   cfg.stream);
  setVal('nav-setting-stream', cfg.stream);
  setVal('setting-short-stream',   cfg.shortStream);
  setVal('nav-setting-short-stream', cfg.shortStream);

  ['welcome-stream-options','nav-stream-options'].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.querySelectorAll('.stream-option-btn').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.val) === cfg.stream);
    });
  });
  ['welcome-short-stream-options','nav-short-stream-options'].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.querySelectorAll('.stream-option-btn').forEach(b => {
      b.classList.toggle('selected', parseInt(b.dataset.val) === cfg.shortStream);
    });
  });
}

function saveSettings() {
  const get = id => { const el = document.getElementById(id); return el ? el : null; };
  const cfg = {
    proxy:       get('setting-proxy')?.checked ?? getAppConfig().proxy,
    stream:      parseInt(get('setting-stream')?.value) || 1,
    shortStream: parseInt(get('setting-short-stream')?.value) || 1,
    trend:       get('setting-trend')?.checked ?? getAppConfig().trend,
    theme:       document.body.getAttribute('data-theme') || 'light',
    themeManual: true,
    isFirstVisit: false
  };
  setAppConfig(cfg);
  syncSettingsUI();
}

function saveNavSettings() {
  const get = id => document.getElementById(id);
  const cfg = {
    proxy:       get('nav-setting-proxy')?.checked ?? getAppConfig().proxy,
    stream:      parseInt(get('nav-setting-stream')?.value) || 1,
    shortStream: parseInt(get('nav-setting-short-stream')?.value) || 1,
    trend:       get('nav-setting-trend')?.checked ?? getAppConfig().trend,
    theme:       document.body.getAttribute('data-theme') || 'light',
    themeManual: true,
    isFirstVisit: false
  };
  setAppConfig(cfg);
  syncSettingsUI();
}

function selectNavStream(val) {
  const el = document.getElementById('nav-setting-stream');
  if (el) el.value = val;
  saveNavSettings();
}
function selectNavShortStream(val) {
  const el = document.getElementById('nav-setting-short-stream');
  if (el) el.value = val;
  saveNavSettings();
}
function selectWelcomeStream(val) {
  const el = document.getElementById('setting-stream');
  if (el) el.value = val;
  saveSettings();
}
function selectWelcomeShortStream(val) {
  const el = document.getElementById('setting-short-stream');
  if (el) el.value = val;
  saveSettings();
}
function toggleThemeFromSettings() {
  const dark = document.getElementById('setting-theme')?.checked;
  applyTheme(dark ? 'dark' : 'light');
  setAppConfig({ theme: dark ? 'dark' : 'light', themeManual: true });
}
function toggleThemeFromNavSettings() {
  const dark = document.getElementById('nav-setting-theme')?.checked;
  applyTheme(dark ? 'dark' : 'light');
  setAppConfig({ theme: dark ? 'dark' : 'light', themeManual: true });
}

/* =================== 投稿日フィルタ =================== */
function _isWithinOneYear(item) {
  if (!item) return true;
  const ts = item.published || item.publishedTimestamp || 0;
  if (ts && ts > 1_000_000_000) {
    return (Date.now() / 1000 - ts) < 365 * 86400;
  }
  const txt = String(item.publishedText || item.published || '');
  if (/(\d+)\s*年前/.test(txt)) { const n = parseInt(RegExp.$1); if (n >= 1) return false; }
  if (/(\d+)\s*years?\s*ago/i.test(txt)) { const n = parseInt(RegExp.$1); if (n >= 1) return false; }
  return true;
}

/* =================== リンク化 =================== */
function _linkifyText(text) {
  if (!text) return '';
  let s = String(text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, url => {
    const safe = url.replace(/"/g, '&quot;');
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;text-decoration:none;word-break:break-all;" onclick="event.stopPropagation();">${url}</a>`;
  });
  s = s.replace(/(^|[\s>])@([A-Za-z0-9_\-.]{2,30})/g, (m, pre, h) => {
    return `${pre}<a href="javascript:void(0)" onclick="event.stopPropagation();openChannel('${h.replace(/'/g, "\\'")}',null);" style="color:#3ea6ff;text-decoration:none;">@${h}</a>`;
  });
  return s.replace(/\n/g, '<br>');
}

/* =================== 動画メタ正規化 =================== */
window.__normalizeVid = function(v, fallbackChannel) {
  if (!v || typeof v !== 'object') return null;
  let id = v.videoId || v.id || v.video_id || '';
  if (!id && typeof v.url === 'string') {
    const m = v.url.match(/(?:v=|\/watch\/|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (m) id = m[1];
  }
  if (!id) return null;
  const author = v.author || v.uploaderName || v.uploader || v.channelName || fallbackChannel || '';
  let authorThumb = '';
  if (v.authorThumbnails?.[0]) authorThumb = v.authorThumbnails[0].url;
  else if (v.uploaderAvatar) authorThumb = v.uploaderAvatar;
  else if (v.authorThumbnail) authorThumb = v.authorThumbnail;
  else authorThumb = `https://i.pravatar.cc/150?u=${encodeURIComponent(author || id)}`;
  const duration = (typeof v.lengthSeconds === 'number') ? v.lengthSeconds : (typeof v.duration === 'number' ? v.duration : 0);
  const liveNow = !!(v.liveNow || v.isLive || v.live);
  return {
    id, title: v.title || v.name || '',
    channel: author, authorThumb,
    duration: duration || 0,
    viewCount: v.viewCount || v.views || 0,
    published: v.publishedText || v.uploadedDate || v.uploaded || '',
    publishedTimestamp: (typeof v.published === 'number') ? v.published : 0,
    liveNow, isLive: liveNow, isUpcoming: !!v.isUpcoming, isShort: false, isArchived: false
  };
};

/* =================== 登録チャンネル =================== */
function getSubscriptions() {
  try { return JSON.parse(localStorage.getItem('subscriptions') || '[]'); } catch (_) { return []; }
}
function saveSubscriptions(subs) {
  localStorage.setItem('subscriptions', JSON.stringify(subs));
}
function isSubscribed(channelName) {
  return getSubscriptions().some(s => s.name === channelName);
}

/* =================== 視聴履歴 =================== */
function addToHistory(video) {
  try {
    const key = 'watch_history';
    let arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr = arr.filter(v => v.id !== video.id);
    arr.unshift({ ...video, watchedAt: Date.now() });
    if (arr.length > 500) arr.length = 500;
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (_) {}
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem('watch_history') || '[]'); } catch (_) { return []; }
}

/* =================== 再生リスト =================== */
function getPlaylists() {
  try { return JSON.parse(localStorage.getItem('playlists_v2') || '[]'); } catch (_) { return []; }
}
function savePlaylists(pls) {
  localStorage.setItem('playlists_v2', JSON.stringify(pls));
}

/* =================== フォーマット =================== */
function formatDuration(sec) {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function formatViews(n) {
  if (!n) return '';
  if (n >= 100_000_000) return Math.floor(n / 10_000_000) / 10 + '億';
  if (n >= 10_000) return Math.floor(n / 10_000) + '万';
  return n.toLocaleString();
}

/* =================== インスタンス JSON 読み込み =================== */
(async function loadInstanceFiles() {
  try {
    const [invRes, pipedRes] = await Promise.allSettled([
      fetch('/instances/invidious.json'),
      fetch('/instances/piped.json')
    ]);
    if (invRes.status === 'fulfilled' && invRes.value.ok) {
      const list = await invRes.value.json();
      if (Array.isArray(list) && list.length) {
        const seen = new Set(window.INVIDIOUS_INSTANCES);
        list.forEach(u => { if (!seen.has(u)) { window.INVIDIOUS_INSTANCES.push(u); seen.add(u); } });
        rebuildRoles();
      }
    }
    if (pipedRes.status === 'fulfilled' && pipedRes.value.ok) {
      const list = await pipedRes.value.json();
      if (Array.isArray(list) && list.length) {
        const seen = new Set(window.PIPED_INSTANCES);
        list.forEach(u => { if (!seen.has(u)) { window.PIPED_INSTANCES.push(u); seen.add(u); } });
      }
    }
  } catch (_) {}
})();
