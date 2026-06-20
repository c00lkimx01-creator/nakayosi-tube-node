/* =================== 検索 =================== */

let lastQuery = '';
let isFetching = false;
let currentPage = 1;
let searchContext = 'trend';
const seenVideoIds = new Set();

/* ---------- 検索フォーム ---------- */
function handleSearch(event, externalQuery) {
  if (event) event.preventDefault();
  const inp = document.getElementById('search-input');
  const query = externalQuery || (inp ? inp.value.trim() : '');
  if (!query) return;
  lastQuery = query;
  if (inp) inp.value = query;
  hideSearchSuggestions();
  navigate('search', { query });
  triggerSearch(query, 'search');
  /* ショート & チャンネルも同時取得 */
  fetchShortsForSearch(query);
  searchChannelsFromInvidious(query, 5).then(renderSearchChannels).catch(() => {});
}

/* ---------- カテゴリ検索 ---------- */
function handleCategorySearch(category, btn) {
  document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (category === 'すべて') {
    loadTrend();
    navigate('home');
  } else {
    const inp = document.getElementById('search-input');
    if (inp) inp.value = category;
    handleSearch(null, category);
  }
}

/* ---------- 検索実行コア ---------- */
async function triggerSearch(query, context, append = false) {
  if (isFetching && !append) return;
  isFetching = true;
  searchContext = context;
  if (!append) {
    seenVideoIds.clear();
    currentPage = 1;
  }

  try {
    if (context === 'search') {
      /* 検索ビュー */
      const loader = document.getElementById('search-loader');
      if (!append) {
        const list = document.getElementById('search-results-list');
        if (list) list.innerHTML = '';
        const ss = document.getElementById('search-shorts-section');
        if (ss) ss.classList.add('hidden');
        const sc = document.getElementById('search-channels-section');
        if (sc) { sc.classList.add('hidden'); sc.innerHTML = ''; }
        showSkeleton('search-results-list', 'video', 8);
      }
      if (loader && append) loader.classList.remove('hidden');

      /* Invidious と Piped を並列レース */
      const [invResults, pipedResults] = await Promise.allSettled([
        fetchFromInvidious(query, 'search', currentPage),
        currentPage === 1 ? fetchFromPiped(query) : Promise.resolve([])
      ]);

      let combined = [];
      if (invResults.status === 'fulfilled' && invResults.value?.length) combined = invResults.value;
      else if (pipedResults.status === 'fulfilled' && pipedResults.value?.length) {
        combined = pipedResults.value.map(v => window.__normalizeVid(v)).filter(Boolean);
      }

      hideSkeleton('search-results-list');
      const unique = combined.filter(v => {
        const id = v.videoId || v.id;
        if (!id || seenVideoIds.has(id)) return false;
        seenVideoIds.add(id);
        return true;
      });
      renderSearchResults(unique, append);

    } else if (context === 'shorts') {
      /* ショートビュー */
      const combined = [];
      try {
        const data = await fetchFromInvidious(query, 'shorts', 1);
        if (data?.length) {
          data.forEach(v => {
            if (!v.videoId || seenVideoIds.has(v.videoId)) return;
            if (!(v.lengthSeconds >= 0 && v.lengthSeconds <= 65)) return;
            seenVideoIds.add(v.videoId);
            combined.push({ id: v.videoId, title: v.title || '', channel: v.author || '', authorThumb: v.authorThumbnails?.[0]?.url || '', isShort: true });
          });
        }
      } catch (_) {}
      if (combined.length) renderShorts(combined, append);

    } else {
      /* トレンド (ホーム) */
      const loader = document.getElementById('home-loader');
      if (!append) {
        const grid = document.getElementById('home-grid');
        if (grid) grid.innerHTML = '';
        showSkeleton('home-grid', 'video');
      }
      const data = await fetchTrending();
      hideSkeleton('home-grid');
      if (loader) loader.classList.add('hidden');
      const unique = (data || []).filter(v => {
        const id = v.videoId || v.id;
        if (!id || seenVideoIds.has(id)) return false;
        seenVideoIds.add(id);
        return true;
      });
      renderHomeGrid(unique, append);
    }
  } catch (err) {
    console.warn('[search] error:', err);
    hideSkeleton('search-results-list');
    hideSkeleton('home-grid');
  } finally {
    isFetching = false;
  }
}

/* ---------- 無限スクロール ---------- */
function loadMore() {
  if (isFetching) return;
  currentPage++;
  if (searchContext === 'search') {
    triggerSearch(lastQuery, 'search', true);
  } else if (searchContext === 'trend') {
    const loader = document.getElementById('home-loader');
    if (loader) loader.classList.remove('hidden');
    fetchTrending().then(data => {
      if (loader) loader.classList.add('hidden');
      renderHomeGrid(data || [], true);
    });
  }
}

/* スクロール末尾で自動ロード */
let _scrollThrottle = false;
window.addEventListener('scroll', () => {
  if (_scrollThrottle) return;
  _scrollThrottle = true;
  setTimeout(() => { _scrollThrottle = false; }, 200);
  if (currentView === 'shorts') return;
  const scrollBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  if (scrollBottom < 600) loadMore();
}, { passive: true });

/* ---------- ホームトレンド読み込み ---------- */
async function loadTrend() {
  if (currentView !== 'home') return;
  searchContext = 'trend';
  seenVideoIds.clear();
  showSkeleton('home-grid', 'video');
  document.getElementById('home-loader')?.classList.remove('hidden');
  try {
    const data = await fetchTrending();
    hideSkeleton('home-grid');
    document.getElementById('home-loader')?.classList.add('hidden');
    renderHomeGrid(data || []);
  } catch (_) {
    hideSkeleton('home-grid');
    document.getElementById('home-loader')?.classList.add('hidden');
  }
  /* ショートも並行取得 */
  fetchShortsForHome();
}
