/* =================== UI レンダリング関数 =================== */

/* ---------- ホームグリッド ---------- */
function renderHomeGrid(videos, append = false) {
  const grid = document.getElementById('home-grid');
  const loader = document.getElementById('home-loader');
  if (!grid) return;
  if (!append) grid.innerHTML = '';
  if (!videos || !videos.length) {
    if (!append) showSkeleton('home-grid', 'video');
    return;
  }
  hideSkeleton('home-grid');
  if (loader) loader.classList.add('hidden');
  const frag = document.createDocumentFragment();
  videos.forEach(v => {
    const n = window.__normalizeVid ? window.__normalizeVid(v) : v;
    if (!n) return;
    const card = makeVideoCard(n);
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

/* ---------- 汎用動画カード ---------- */
function makeVideoCard(v) {
  const card = document.createElement('div');
  card.className = 'video-card';
  const ch = (v.channel || '').replace(/'/g, "\\'");
  const t  = (v.title   || '').replace(/'/g, "\\'");
  const thumb = v.authorThumb || `https://i.pravatar.cc/72?u=${encodeURIComponent(v.channel || '')}`;
  const dur = formatDuration(v.duration);
  const views = v.viewCount ? formatViews(v.viewCount) + '回視聴' : '';
  const pubTxt = v.published || '';
  const meta = [views, pubTxt].filter(Boolean).join(' • ');
  const isLive = v.liveNow || v.isLive;
  const badge = isLive
    ? `<span class="live-thumb-badge">🔴 LIVE</span>`
    : v.isArchived
      ? `<span class="archived-badge">配信済</span>`
      : dur ? `<span class="duration-badge">${dur}</span>` : '';
  card.onclick = () => playVideo(v.id, v.title || '', v.channel || '', v.authorThumb || null);
  card.innerHTML = `
    <div class="thumbnail-container">
      <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" loading="lazy"
           onerror="this.src='https://i.ytimg.com/vi/${v.id}/hqdefault.jpg'">
      ${badge}
    </div>
    <div class="video-info">
      <img class="channel-avatar" src="${thumb}"
           onclick="event.stopPropagation();openChannel('${ch}','${thumb}')"
           onerror="this.src='https://i.pravatar.cc/72?u=${encodeURIComponent(v.channel || '')}'"
           loading="lazy">
      <div class="video-details">
        <div class="video-title">${v.title || ''}</div>
        <div class="video-meta-channel"
             onclick="event.stopPropagation();openChannel('${ch}','${thumb}')">${v.channel || ''}</div>
        <div class="video-meta">${meta}</div>
      </div>
    </div>`;
  return card;
}

/* ---------- 検索結果 ---------- */
function renderSearchResults(videos, append = false) {
  const list = document.getElementById('search-results-list');
  const loader = document.getElementById('search-loader');
  if (!list) return;
  if (!append) list.innerHTML = '';
  if (!videos || !videos.length) return;
  if (loader) loader.classList.add('hidden');
  const frag = document.createDocumentFragment();
  videos.forEach(v => {
    const n = window.__normalizeVid ? window.__normalizeVid(v) : v;
    if (!n) return;
    frag.appendChild(makeSearchResultItem(n));
  });
  list.appendChild(frag);
}

function makeSearchResultItem(v) {
  const div = document.createElement('div');
  div.className = 'search-result-item';
  const ch = (v.channel || '').replace(/'/g, "\\'");
  const thumb = v.authorThumb || `https://i.pravatar.cc/72?u=${encodeURIComponent(v.channel || '')}`;
  const dur = formatDuration(v.duration);
  const isLive = v.liveNow || v.isLive;
  const badge = isLive
    ? `<span class="live-thumb-badge">🔴 LIVE</span>`
    : dur ? `<span class="duration-badge">${dur}</span>` : '';
  const views = v.viewCount ? formatViews(v.viewCount) + '回視聴' : '';
  const meta = [views, v.published].filter(Boolean).join(' • ');
  div.onclick = () => playVideo(v.id, v.title || '', v.channel || '', v.authorThumb || null);
  div.innerHTML = `
    <div class="search-result-thumb">
      <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" loading="lazy">
      ${badge}
    </div>
    <div class="search-result-info">
      <div class="search-result-title">${v.title || ''}</div>
      <div class="search-result-meta">${meta}</div>
      <div class="search-result-channel"
           onclick="event.stopPropagation();openChannel('${ch}','${thumb}')">
        <img src="${thumb}" onerror="this.src='https://i.pravatar.cc/40?u=${encodeURIComponent(v.channel || '')}'">
        ${v.channel || ''}
      </div>
    </div>`;
  return div;
}

function renderSearchChannels(channels) {
  const sec = document.getElementById('search-channels-section');
  if (!sec || !channels || !channels.length) return;
  sec.classList.remove('hidden');
  sec.innerHTML = channels.map(c => {
    const thumb = c.authorThumbnails?.[0]?.url || `https://i.pravatar.cc/80?u=${encodeURIComponent(c.author || '')}`;
    const safe  = (c.author || '').replace(/'/g, "\\'");
    return `<div class="search-channel-card" onclick="openChannel('${safe}','${thumb}')">
      <img src="${thumb}" onerror="this.src='https://i.pravatar.cc/80?u=${encodeURIComponent(c.author || '')}'">
      <div>
        <div class="search-channel-name">${c.author || ''}</div>
        <div class="search-channel-meta">${c.subCount ? formatViews(c.subCount) + '人登録' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- 関連動画 ---------- */
function renderRelatedVideos(videos, append = false) {
  const container = document.getElementById('related-videos');
  if (!container) return;
  const loader = document.getElementById('related-loader');
  if (loader) loader.classList.add('hidden');
  const html = (videos || []).map(v => {
    const isLive = v.isLive || v.liveNow;
    const dur = formatDuration(v.duration || v.lengthSeconds || 0);
    const ch  = (v.channel || v.author || '').replace(/'/g, "\\'");
    const t   = (v.title || '').replace(/'/g, "\\'");
    const thumb = v.authorThumb || `https://i.pravatar.cc/72?u=${encodeURIComponent(v.channel || v.author || '')}`;
    const id = v.id || v.videoId;
    const badge = isLive
      ? `<span class="live-thumb-badge">🔴 LIVE</span>`
      : dur ? `<span class="duration-badge">${dur}</span>` : '';
    const views = v.viewCount ? formatViews(v.viewCount) + '回視聴' : '';
    return `<div class="related-video" onclick="playVideo('${id}','${t}','${ch}','${thumb}')">
      <div class="related-thumb">
        <img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" loading="lazy">
        ${badge}
      </div>
      <div class="related-info">
        <div class="related-title">${v.title || ''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;cursor:pointer;"
             onclick="event.stopPropagation();openChannel('${ch}','${thumb}')">
          <img src="${thumb}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" loading="lazy">
          <span style="font-size:12px;color:var(--text-secondary);">${v.channel || v.author || ''}</span>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${views}</div>
      </div>
    </div>`;
  }).join('');
  if (append) container.insertAdjacentHTML('beforeend', html);
  else container.innerHTML = html;
}

/* ---------- ショートカード (ホーム) ---------- */
function renderShortCardsTo(container, shorts) {
  if (!container) return;
  container.innerHTML = '';
  shorts.forEach(v => {
    const div = document.createElement('div');
    div.className = 'home-short-card';
    div.onclick = () => navigateToShortPage(v.videoId || v.id, v.title, v.author, v.authorThumbnails?.[0]?.url);
    div.innerHTML = `
      <div class="home-short-thumb">
        <img src="https://i.ytimg.com/vi/${v.videoId || v.id}/hqdefault.jpg" loading="lazy"
             onerror="this.src='https://i.ytimg.com/vi/${v.videoId || v.id}/mqdefault.jpg'">
      </div>
      <div class="home-short-title">${v.title || ''}</div>`;
    container.appendChild(div);
  });
}

/* ---------- スケルトン ---------- */
function showSkeleton(containerId, type = 'video', count = 12) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (type === 'video') {
    el.innerHTML = `<div class="skeleton-grid">${Array.from({ length: count }, () => `
      <div class="skeleton-card">
        <div class="skeleton-thumb"></div>
        <div style="display:flex;gap:10px;">
          <div class="sk-base" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
  } else if (type === 'short') {
    el.innerHTML = `<div class="skeleton-shorts-row">${Array.from({ length: 8 }, () => `
      <div class="skeleton-short-card">
        <div class="skeleton-short-thumb"></div>
        <div class="skeleton-line" style="width:80%;"></div>
      </div>`).join('')}
    </div>`;
  }
}

function hideSkeleton(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sk = el.querySelector('.skeleton-grid, .skeleton-shorts-row');
  if (sk) sk.remove();
}

/* ---------- サイドバー登録チャンネル ---------- */
function renderSidebarSubscriptions() {
  const subs = getSubscriptions();
  const container = document.getElementById('sidebar-subscriptions');
  if (!container) return;
  if (!subs.length) { container.innerHTML = ''; return; }
  container.innerHTML = subs.slice(0, 8).map(s => `
    <div class="sidebar-channel-item" onclick="openChannel('${(s.name || '').replace(/'/g, "\\'")}', '${s.thumb}')">
      <img src="${s.thumb}" onerror="this.src='https://i.pravatar.cc/40?u=${encodeURIComponent(s.name)}'">
      <span class="channel-name-sidebar">${s.name}</span>
      ${s.isLive ? '<span class="live-badge">LIVE</span>' : ''}
    </div>`).join('');
}

/* ---------- 登録チャンネルページ ---------- */
function renderSubscriptionsPage() {
  const subs = getSubscriptions();
  const grid = document.getElementById('subs-grid');
  if (!grid) return;
  if (!subs.length) {
    grid.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-secondary);">
      チャンネルを登録するとここに表示されます<br><br>
      <button onclick="navigate('home')" style="padding:10px 24px;border-radius:20px;background:var(--primary-color);color:#fff;font-weight:bold;font-size:14px;margin-top:12px;">ホームへ戻る</button>
    </div>`;
    return;
  }
  grid.innerHTML = `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:18px;font-weight:700;margin:0 0 14px 0;">新着動画</h3>
      <div id="subs-new-uploads" class="home-row-scroll" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;">
        <div style="padding:16px;color:var(--text-secondary);">読み込み中...</div>
      </div>
    </div>
    <h3 style="font-size:18px;font-weight:700;margin:0 0 12px 0;">登録チャンネル</h3>
    ${subs.map(s => `
      <div class="sub-channel-card" onclick="openChannel('${(s.name || '').replace(/'/g, "\\'")}', '${s.thumb}')">
        <img src="${s.thumb}" onerror="this.src='https://i.pravatar.cc/56?u=${encodeURIComponent(s.name)}'">
        <div class="sub-channel-info">
          <div class="sub-channel-name">${s.name}</div>
          <div class="sub-channel-meta">${s.isLive ? '🔴 ライブ配信中' : '登録済みチャンネル'}</div>
        </div>
        <button class="unsub-btn" onclick="event.stopPropagation();unsubscribeChannelPage('${(s.name || '').replace(/'/g, "\\'")}')" >登録解除</button>
      </div>`).join('')}`;
  fetchSubscriptionsNewUploads(subs);
}

function unsubscribeChannelPage(name) {
  let subs = getSubscriptions().filter(s => s.name !== name);
  saveSubscriptions(subs);
  renderSubscriptionsPage();
  renderSidebarSubscriptions();
  renderSettingsSubsList();
}

/* ---------- 設定の登録チャンネルリスト ---------- */
function renderSettingsSubsList() {
  const subs = getSubscriptions();
  const el = document.getElementById('settings-subs-list');
  if (!el) return;
  if (!subs.length) { el.innerHTML = '<div style="color:var(--text-secondary);padding:8px 0;">登録チャンネルはありません</div>'; return; }
  el.innerHTML = subs.map(s => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color);">
      <img src="${s.thumb}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"
           onerror="this.src='https://i.pravatar.cc/40?u=${encodeURIComponent(s.name)}'">
      <span style="flex:1;font-weight:500;">${s.name}</span>
      ${s.isLive ? '<span class="live-badge">LIVE</span>' : ''}
      <button class="unsub-btn" onclick="unsubscribeChannelPage('${(s.name || '').replace(/'/g, "\\'")}')">削除</button>
    </div>`).join('');
}

/* ---------- 履歴 / プレイリスト ---------- */
function renderLocalList(type) {
  if (type === 'history') {
    const items = getHistory();
    const grid = document.getElementById('history-grid');
    const empty = document.getElementById('history-empty');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach(v => frag.appendChild(makeVideoCard(v)));
    grid.appendChild(frag);
  }
}

function clearHistory() {
  if (!confirm('視聴履歴を全て削除しますか？')) return;
  localStorage.removeItem('watch_history');
  renderLocalList('history');
}

function renderPlaylistsPage() {
  const pls = getPlaylists();
  const grid = document.getElementById('playlists-grid');
  if (!grid) return;
  if (!pls.length) {
    grid.innerHTML = '<div style="padding:40px;color:var(--text-secondary);text-align:center;">再生リストはまだありません</div>';
    return;
  }
  grid.innerHTML = pls.map((pl, i) => {
    const first = pl.videos?.[0];
    const thumb = first ? `https://i.ytimg.com/vi/${first.id}/mqdefault.jpg` : '';
    return `<div class="playlist-card" onclick="openPlaylistDetail(${i})">
      <div class="playlist-card-thumb">${thumb ? `<img src="${thumb}" loading="lazy">` : ''}</div>
      <div>
        <div style="font-weight:700;font-size:15px;">${pl.name || ''}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${pl.videos?.length || 0}本</div>
      </div>
    </div>`;
  }).join('');
}

function createPlaylistFromInput() {
  const inp = document.getElementById('new-playlist-input');
  if (!inp || !inp.value.trim()) return;
  const pls = getPlaylists();
  pls.push({ name: inp.value.trim(), videos: [] });
  savePlaylists(pls);
  inp.value = '';
  renderPlaylistsPage();
}

function openPlaylistDetail(idx) {
  const pls = getPlaylists();
  const pl = pls[idx];
  if (!pl) return;
  document.getElementById('playlist-detail-title').textContent = pl.name;
  const grid = document.getElementById('playlist-detail-grid');
  if (grid) {
    grid.innerHTML = '';
    (pl.videos || []).forEach(v => grid.appendChild(makeVideoCard(v)));
  }
  navigate('playlist-detail');
}

function openAddToPlaylist() {
  const vid = window.currentVideoId;
  if (!vid) return;
  const pls = getPlaylists();
  if (!pls.length) {
    const name = prompt('再生リスト名:');
    if (!name) return;
    pls.push({ name, videos: [] });
  }
  const idx = pls.length === 1 ? 0 : parseInt(prompt(pls.map((p, i) => `${i}: ${p.name}`).join('\n') + '\n番号:'));
  if (isNaN(idx) || !pls[idx]) return;
  pls[idx].videos.push({ id: vid, title: window.currentVideoTitle || '', channel: window.currentChannelName || '', authorThumb: window.currentChannelThumb || '' });
  savePlaylists(pls);
  alert('追加しました');
}

/* ---------- 検索サジェスト ---------- */
let _suggestTimer = null;
function showSearchSuggestions() {
  clearTimeout(_suggestTimer);
  const inp = document.getElementById('search-input');
  const box = document.getElementById('search-suggestions');
  if (!inp || !box) return;
  const q = inp.value.trim();
  if (!q) { box.classList.remove('visible'); return; }
  _suggestTimer = setTimeout(async () => {
    const items = await fetchSearchSuggestions(q);
    if (!items.length) { box.classList.remove('visible'); return; }
    box.innerHTML = items.map(s =>
      `<div class="suggestion-item" onclick="document.getElementById('search-input').value='${s.replace(/'/g, "\\'")}';handleSearch(null,'${s.replace(/'/g, "\\'")}')" >
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:var(--text-secondary);stroke:none;flex-shrink:0;"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        ${s}
      </div>`
    ).join('');
    box.classList.add('visible');
  }, 250);
}
function hideSearchSuggestions() {
  document.getElementById('search-suggestions')?.classList.remove('visible');
}

/* ---------- ファーストビジットバナー ---------- */
function dismissFirstVisitBanner() {
  const el = document.getElementById('first-visit-banner');
  if (el) el.style.display = 'none';
  setAppConfig({ isFirstVisit: false });
}

/* ---------- 水平スクロールボタン ---------- */
function hScroll(containerId, dir) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const amount = Math.max(240, el.clientWidth * 0.8);
  el.scrollBy({ left: amount * dir, behavior: 'smooth' });
}

/* ---------- 音声同期 ---------- */
function attachAudioVideoSync(vid, aud) {
  vid.addEventListener('play',   () => { try { aud.currentTime = vid.currentTime; aud.play(); } catch(_){} });
  vid.addEventListener('pause',  () => { try { aud.pause(); } catch(_){} });
  vid.addEventListener('seeking',() => { try { aud.currentTime = vid.currentTime; } catch(_){} });
  vid.addEventListener('volumechange', () => { try { aud.volume = vid.volume; aud.muted = vid.muted; } catch(_){} });
}

/* ---------- 音声検索 ---------- */
function startVoiceSearch() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('音声検索は未対応ブラウザです'); return; }
  const sr = new SR();
  sr.lang = 'ja-JP';
  sr.onresult = e => {
    const q = e.results[0]?.[0]?.transcript;
    if (q) {
      const inp = document.getElementById('search-input');
      if (inp) inp.value = q;
      handleSearch(null, q);
    }
  };
  sr.start();
}
