/* =================== チャンネルページ =================== */

let currentChannelId = null;
let currentChannelTab = 'home';
let currentChannelShortsPage = 1;
let currentChannelShortsName = '';

/* =================== チャンネルを開く =================== */
async function openChannel(channelName, thumbOrNull) {
  if (!channelName) return;
  navigate('channel', { channelName, noHistory: false });
  document.body.classList.remove('is-watching');
  currentChannelShortsPage = 1;
  currentChannelShortsName = channelName;
  currentChannelId = null;

  /* リセット */
  const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  const setAttr = (id, a, v) => { const el = document.getElementById(id); if (el) el[a] = v; };
  setTxt('channel-page-name', channelName);
  setTxt('channel-page-handle', '@' + channelName);
  setTxt('channel-page-meta', '読み込み中...');
  setTxt('channel-page-desc', '');
  setAttr('channel-page-icon', 'src', thumbOrNull || `https://i.pravatar.cc/80?u=${encodeURIComponent(channelName)}`);
  document.getElementById('channel-banner-img')?.setAttribute('style', 'display:none');
  document.getElementById('channel-banner-canvas')?.setAttribute('style', 'display:block');
  updateChannelSubscribeUI(channelName);

  /* デフォルトタブ */
  switchChannelTab('home');

  /* チャンネル情報 */
  const [info] = await Promise.allSettled([fetchChannelInfo(channelName)]);
  if (info.status === 'fulfilled' && info.value) {
    const d = info.value;
    currentChannelId = d.authorId || d.channelId || channelName;
    setTxt('channel-page-name', d.author || channelName);
    setTxt('channel-page-handle', d.authorUrl || '@' + channelName);
    const subs = d.subCount ? formatViews(d.subCount) + '人登録' : '';
    const vids = d.totalViews ? '• 総視聴 ' + formatViews(d.totalViews) : '';
    setTxt('channel-page-meta', subs + vids);

    const descEl = document.getElementById('channel-page-desc');
    if (descEl && d.description) { descEl.innerHTML = _linkifyText(d.description); }

    /* アイコン */
    const icon = document.getElementById('channel-page-icon');
    if (icon && d.authorThumbnails?.length) icon.src = d.authorThumbnails[d.authorThumbnails.length - 1].url;

    /* バナー */
    if (d.authorBanners?.length) {
      const img = document.getElementById('channel-banner-img');
      const cvs = document.getElementById('channel-banner-canvas');
      if (img) { img.src = d.authorBanners[0].url; img.style.display = 'block'; }
      if (cvs) cvs.style.display = 'none';
    } else {
      drawChannelBanner(channelName);
    }
    updateChannelSubscribeUI(d.author || channelName);

    /* ホームタブに動画を読み込む */
    renderChannelHomeTab(channelName, d.latestVideos || []);
  } else {
    drawChannelBanner(channelName);
    renderChannelHomeTab(channelName, []);
  }

  /* 購読ボタンイベント */
  const subBtn = document.getElementById('channel-subscribe-btn');
  if (subBtn) {
    subBtn.onclick = () => {
      const name = document.getElementById('channel-page-name')?.textContent || channelName;
      const thumb = document.getElementById('channel-page-icon')?.src || '';
      let subs = getSubscriptions();
      if (isSubscribed(name)) {
        subs = subs.filter(s => s.name !== name);
      } else {
        subs.unshift({ name, thumb, channelId: currentChannelId || null, isLive: false });
      }
      saveSubscriptions(subs);
      updateChannelSubscribeUI(name);
      renderSidebarSubscriptions();
    };
  }

  history.pushState({ view: 'channel', channelName }, '', `/@${currentChannelId || channelName}`);
}

/* =================== タブ切り替え =================== */
function switchChannelTab(tab) {
  currentChannelTab = tab;
  document.querySelectorAll('.channel-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`ch-tab-${tab}`)?.classList.add('active');
  const tabs = ['home', 'shorts', 'videos', 'live', 'playlists', 'collabs'];
  tabs.forEach(t => {
    const el = document.getElementById(`channel-tab-${t}`);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  const name = document.getElementById('channel-page-name')?.textContent || '';
  if (tab === 'shorts' && name)   loadChannelShorts(name);
  if (tab === 'videos' && name)   loadChannelVideos(name);
  if (tab === 'live' && name)     loadChannelLive(name);
  if (tab === 'playlists' && name) loadChannelPlaylists(name);
}

/* =================== チャンネルホームタブ =================== */
async function renderChannelHomeTab(channelName, latestVideos) {
  const homeGrid = document.getElementById('channel-home-grid');
  const homeRow  = document.getElementById('channel-home-row');
  const homePopular = document.getElementById('channel-home-popular-row');
  const homeShorts  = document.getElementById('channel-home-shorts-row');

  /* 既存動画をレンダリング */
  if (latestVideos?.length) {
    const norm = latestVideos.map(v => window.__normalizeVid(v, channelName)).filter(Boolean);
    renderHorizontalRow(homeRow, norm.slice(0, 12));
    renderHorizontalRow(homePopular, norm.filter(v => !v.isShort).slice(0, 12));
  } else {
    if (homeRow) homeRow.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">読み込み中...</div>';
  }

  /* 非同期で更に取得 */
  const data = await fetchChannelVideos(channelName, 1).catch(() => null);
  if (!data?.videos?.length) {
    if (homeRow) homeRow.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">動画を取得できませんでした</div>';
    return;
  }
  const all = data.videos.map(v => window.__normalizeVid(v, channelName)).filter(Boolean);
  const regularVids = all.filter(v => !v.isShort && v.duration > 60);
  const shortVids   = all.filter(v => v.isShort || (v.duration > 0 && v.duration <= 65));

  renderHorizontalRow(homeRow, regularVids.slice(0, 12));
  renderHorizontalRow(homePopular, regularVids.slice().sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 12));
  if (shortVids.length) renderShortCardsTo(homeShorts, shortVids.slice(0, 12));

  /* ホームグリッド */
  if (homeGrid) {
    homeGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    regularVids.slice(0, 24).forEach(v => frag.appendChild(makeVideoCard(v)));
    homeGrid.appendChild(frag);
  }
}

function renderHorizontalRow(container, videos) {
  if (!container) return;
  container.innerHTML = '';
  if (!videos?.length) { container.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">動画なし</div>'; return; }
  videos.forEach(v => {
    const card = document.createElement('div');
    card.className = 'video-card-h';
    card.style.cssText = 'flex:0 0 220px;cursor:pointer;';
    card.onclick = () => playVideo(v.id, v.title, v.channel, v.authorThumb);
    card.innerHTML = `
      <div class="vh-thumb">
        <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" loading="lazy">
        ${formatDuration(v.duration) ? `<span class="duration-badge">${formatDuration(v.duration)}</span>` : ''}
        ${v.liveNow ? '<span class="live-thumb-badge">🔴 LIVE</span>' : ''}
      </div>
      <div class="vh-title">${v.title || ''}</div>`;
    container.appendChild(card);
  });
}

/* =================== ショートタブ =================== */
async function loadChannelShorts(channelName, page = 1) {
  const grid = document.getElementById('channel-shorts-grid');
  const loader = document.getElementById('channel-shorts-loader');
  const moreBtn = document.getElementById('channel-shorts-more-btn');
  if (!grid) return;
  if (page === 1) { grid.innerHTML = ''; if (loader) loader.classList.remove('hidden'); }
  const data = await fetchChannelShorts(channelName, page).catch(() => null);
  if (loader) loader.classList.add('hidden');
  if (!data?.videos?.length && !data?.shorts?.length) {
    if (page === 1) grid.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">ショートなし</div>';
    return;
  }
  const items = data.videos || data.shorts || [];
  items.forEach(v => {
    const div = document.createElement('div');
    div.className = 'channel-short-card';
    div.onclick = () => navigateToShortPage(v.videoId || v.id, v.title, channelName, v.authorThumbnails?.[0]?.url);
    div.innerHTML = `
      <div class="channel-short-thumb">
        <img src="https://i.ytimg.com/vi/${v.videoId || v.id}/hqdefault.jpg" loading="lazy">
        ${formatDuration(v.lengthSeconds || v.duration) ? `<span class="duration-badge">${formatDuration(v.lengthSeconds || v.duration)}</span>` : ''}
      </div>
      <div class="channel-short-title">${v.title || ''}</div>`;
    grid.appendChild(div);
  });
  if (moreBtn) moreBtn.style.display = items.length >= 12 ? 'block' : 'none';
}

function loadMoreChannelShorts() {
  currentChannelShortsPage++;
  loadChannelShorts(currentChannelShortsName, currentChannelShortsPage);
}

/* =================== 動画タブ =================== */
let _channelFilterState = 'latest';
async function loadChannelVideos(channelName, page = 1) {
  const grid = document.getElementById('channel-grid');
  const loader = document.getElementById('channel-loader');
  if (!grid) return;
  if (page === 1) { grid.innerHTML = ''; if (loader) loader.classList.remove('hidden'); }
  const data = await fetchChannelVideos(channelName, page).catch(() => null);
  if (loader) loader.classList.add('hidden');
  if (!data?.videos?.length) {
    if (page === 1) grid.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">動画なし</div>';
    return;
  }
  let videos = data.videos.map(v => window.__normalizeVid(v, channelName)).filter(Boolean);
  if (_channelFilterState === 'popular') videos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  if (_channelFilterState === 'oldest') videos.sort((a, b) => (a.publishedTimestamp || 0) - (b.publishedTimestamp || 0));
  const frag = document.createDocumentFragment();
  videos.forEach(v => frag.appendChild(makeVideoCard(v)));
  grid.appendChild(frag);
}

function setChannelFilter(btn, filter) {
  _channelFilterState = filter;
  document.querySelectorAll('.channel-filter-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const name = document.getElementById('channel-page-name')?.textContent || '';
  if (name) loadChannelVideos(name);
}

/* =================== ライブタブ =================== */
async function loadChannelLive(channelName) {
  const grid = document.getElementById('channel-live-grid');
  const loader = document.getElementById('channel-live-loader');
  if (!grid) return;
  grid.innerHTML = ''; if (loader) loader.classList.remove('hidden');
  const data = await fetchChannelVideos(channelName, 1).catch(() => null);
  if (loader) loader.classList.add('hidden');
  const liveVids = (data?.videos || []).filter(v => v.liveNow || v.isLive || v.isUpcoming);
  if (!liveVids.length) { grid.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">配信なし</div>'; return; }
  const frag = document.createDocumentFragment();
  liveVids.map(v => window.__normalizeVid(v, channelName)).filter(Boolean).forEach(v => frag.appendChild(makeVideoCard(v)));
  grid.appendChild(frag);
}

/* =================== 再生リストタブ =================== */
async function loadChannelPlaylists(channelName) {
  const listEl = document.getElementById('channel-playlists-list');
  const loader = document.getElementById('channel-playlists-loader');
  if (!listEl) return;
  listEl.innerHTML = ''; if (loader) loader.classList.remove('hidden');
  const data = await fetchChannelPlaylists(channelName).catch(() => null);
  if (loader) loader.classList.add('hidden');
  if (!data?.playlists?.length) { listEl.innerHTML = '<div style="padding:16px;color:var(--text-secondary);">再生リストなし</div>'; return; }
  listEl.innerHTML = data.playlists.map(p => `
    <div class="playlist-card" onclick="openChannelPlaylist('${(p.playlistId || '').replace(/'/g, "\\'")}', '${(p.title || '').replace(/'/g, "\\'")}')">
      <div class="playlist-card-thumb">
        <img src="${p.playlistThumbnail || `https://i.ytimg.com/vi/${p.videos?.[0]?.videoId || ''}/mqdefault.jpg`}" loading="lazy">
      </div>
      <div>
        <div style="font-weight:700;">${p.title || ''}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${p.videoCount || 0}本</div>
      </div>
    </div>`).join('');
}

function openChannelPlaylist(playlistId, title) {
  /* シンプル実装: タイトル表示のみ */
  alert('再生リスト: ' + title);
}

/* =================== チャンネル内検索 =================== */
function searchInChannel() {
  const inp = document.getElementById('channel-search-input');
  const q = inp?.value?.trim();
  if (!q) return;
  const channelName = document.getElementById('channel-page-name')?.textContent || '';
  handleSearch(null, channelName + ' ' + q);
}

/* =================== バナー生成 =================== */
function drawChannelBanner(name) {
  const canvas = document.getElementById('channel-banner-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width = 1200; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  /* グラデーション */
  let hue = 0;
  for (let i = 0; i < name.length; i++) hue = (hue + name.charCodeAt(i) * 37) % 360;
  const grad = ctx.createLinearGradient(0, 0, 1200, 180);
  grad.addColorStop(0, `hsl(${hue}, 60%, 30%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 60%, 20%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 180);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.charAt(0).toUpperCase(), 600, 90);
}

/* =================== 購読UI ---------- */
function updateChannelSubscribeUI(name) {
  const btn  = document.getElementById('channel-subscribe-btn');
  const bell = document.getElementById('channel-bell-btn');
  const join = document.getElementById('channel-join-btn');
  if (!btn) return;
  const subbed = isSubscribed(name);
  btn.textContent = subbed ? '登録済み' : 'チャンネル登録';
  btn.classList.toggle('subscribed', subbed);
  if (bell) bell.style.display = subbed ? 'flex' : 'none';
  if (join) join.style.display = subbed ? 'block' : 'none';
}
