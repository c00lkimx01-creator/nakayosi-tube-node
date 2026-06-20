/* =================== アプリ初期化 =================== */

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- テーマ適用 ---------- */
  initTheme();

  /* ---------- 設定UI同期 ---------- */
  syncSettingsUI();

  /* ---------- サイドバー購読 ---------- */
  renderSidebarSubscriptions();

  /* ---------- URL 解析してルーティング ---------- */
  const cfg = getAppConfig();
  const urlState = parseInitialUrl();

  if (urlState.view === 'watch' && urlState.videoId) {
    /* URLが /watch?v=... の場合: ホーム表示後に動画を開く */
    navigate('home', { noHistory: true });
    progressDone();
    /* 非同期でプレーヤー起動 */
    (async () => {
      try {
        const meta = await fetchVideoMeta(urlState.videoId);
        playVideo(
          urlState.videoId,
          meta?.title || urlState.videoId,
          meta?.author || '',
          meta?.authorThumbnails?.[0]?.url || null,
          true
        );
      } catch (_) {
        playVideo(urlState.videoId, urlState.videoId, '', null, true);
      }
    })();
  } else if (urlState.view === 'channel' && urlState.channelId) {
    openChannel(urlState.channelId, null);
  } else if (urlState.view === 'search' && urlState.query) {
    const inp = document.getElementById('search-input');
    if (inp) inp.value = urlState.query;
    window.lastQuery = urlState.query;
    navigate('search', { noHistory: true });
    triggerSearch(urlState.query, 'search');
    fetchShortsForSearch(urlState.query);
  } else if (urlState.view === 'shorts' && urlState.videoId) {
    navigate('shorts', { noHistory: true });
    /* 少し遅らせてショートロード */
    setTimeout(() => navigateToShortPage(urlState.videoId, '', '', null, true), 200);
  } else if (urlState.view === 'history') {
    navigate('history', { noHistory: true });
  } else if (urlState.view === 'subscriptions') {
    navigate('subscriptions', { noHistory: true });
  } else if (urlState.view === 'settings') {
    navigate('home', { noHistory: true });
    setTimeout(openSettings, 300);
  } else if (cfg.isFirstVisit) {
    navigate('welcome', { noHistory: true });
  } else {
    navigate('home', { noHistory: true });
    if (cfg.trend !== false) loadTrend();
  }

  /* ---------- 検索フォームイベント ---------- */
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  if (searchForm) searchForm.addEventListener('submit', handleSearch);
  if (searchInput) {
    searchInput.addEventListener('input', showSearchSuggestions);
    searchInput.addEventListener('keyup', e => {
      if (e.key === 'Escape') hideSearchSuggestions();
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(hideSearchSuggestions, 200);
    });
  }

  /* ---------- サイドバー折り畳み ---------- */
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const mc = document.getElementById('main-content');
    const cats = document.getElementById('categories-bar');
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    if (mc) mc.classList.toggle('collapsed-sidebar', collapsed);
    if (cats) cats.style.left = collapsed ? '72px' : '240px';
  });

  /* ---------- 設定ボタンのクリック横取り ---------- */
  document.addEventListener('click', e => {
    const it = e.target.closest('.sidebar-item, .icon-btn, button, a');
    if (!it) return;
    const oc = (it.getAttribute('onclick') || '') + ' ' + (it.dataset.view || '');
    if (/['"]settings['"]|view-settings/.test(oc) || it.textContent?.trim() === '設定') {
      e.preventDefault(); e.stopPropagation();
      openSettings();
    }
  }, true);

  /* ---------- ウェルカム初回バナー ---------- */
  if (!cfg.isFirstVisit) {
    const banner = document.getElementById('first-visit-banner');
    if (banner) banner.style.display = 'none';
  }
});

/* ---------- ウェルカムページ完了 ---------- */
function finishSetup() {
  saveSettings();
  setAppConfig({ isFirstVisit: false });
  navigate('home');
  loadTrend();
}

/* =================== グローバル公開 (インラインonclick用) =================== */
Object.assign(window, {
  /* ルーター */
  navigate,
  openSettings,
  closeSettings,
  hScroll,
  /* 検索 */
  handleSearch,
  handleCategorySearch,
  showSearchSuggestions,
  hideSearchSuggestions,
  /* 動画 */
  playVideo,
  switchStream,
  toggleStreamPanel,
  toggleQualityPanel,
  selectQuality,
  toggleDownloadPanel,
  toggleDescription,
  toggleWatchLoop,
  toggleTheaterMode,
  shareVideo,
  openAddToPlaylist,
  /* ショート */
  navigateToShortPage,
  changeShortStream,
  openShortComments,
  closeShortComments,
  loadShortComments,
  toggleShortLike,
  toggleShortDislike,
  toggleSubscribeFromShort,
  shareShort,
  /* チャンネル */
  openChannel,
  switchChannelTab,
  setChannelFilter,
  searchInChannel,
  loadMoreChannelShorts,
  openChannelPlaylist,
  /* 購読 */
  toggleSubscribeFromWatch,
  updateWatchSubscribeUI,
  unsubscribeChannelPage,
  /* コメント */
  fetchComments,
  seekToTimestamp,
  toggleReplies,
  /* 設定 */
  saveSettings,
  saveNavSettings,
  selectNavStream,
  selectNavShortStream,
  selectWelcomeStream,
  selectWelcomeShortStream,
  toggleTheme,
  toggleThemeFromSettings,
  toggleThemeFromNavSettings,
  /* 履歴 */
  clearHistory,
  /* 再生リスト */
  createPlaylistFromInput,
  openPlaylistDetail,
  openAddToPlaylist,
  /* その他 */
  finishSetup,
  dismissFirstVisitBanner,
  startVoiceSearch,
  loadTrend
});
