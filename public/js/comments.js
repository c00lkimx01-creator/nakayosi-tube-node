/* =================== コメント =================== */

let _commentSortState = 'top';

/* ---------- コメントセクション初期化 ---------- */
function initCommentsSection(videoId) {
  const container = document.getElementById('comments-container');
  const countEl = document.getElementById('comment-count');
  if (container) container.innerHTML = '';
  if (countEl) countEl.textContent = '0';
  injectCommentSortUI();
}

/* ---------- ソートUI注入 ---------- */
function injectCommentSortUI() {
  const header = document.querySelector('.comments-header');
  if (!header || header.__sortAdded) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-flex;gap:6px;margin-left:8px;';
  wrap.innerHTML = `
    <button data-sort="top" class="sort-btn active-sort" style="padding:4px 12px;border-radius:14px;border:1px solid var(--border-color);background:var(--text-color);color:var(--bg-color);font-size:12px;">話題順</button>
    <button data-sort="new" class="sort-btn" style="padding:4px 12px;border-radius:14px;border:1px solid var(--border-color);background:var(--chip-bg);color:var(--text-color);font-size:12px;">新しい順</button>`;
  header.appendChild(wrap);
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('button[data-sort]');
    if (!btn) return;
    _commentSortState = btn.dataset.sort;
    wrap.querySelectorAll('.sort-btn').forEach(b => {
      const active = b.dataset.sort === _commentSortState;
      b.style.background = active ? 'var(--text-color)' : 'var(--chip-bg)';
      b.style.color = active ? 'var(--bg-color)' : 'var(--text-color)';
    });
    if (window.currentVideoId) fetchComments(window.currentVideoId, _commentSortState);
  });
  header.__sortAdded = true;
}

/* ---------- コメント取得・表示 ---------- */
async function fetchComments(videoId, sort) {
  if (!videoId) return;
  sort = sort || _commentSortState || 'top';
  const container = document.getElementById('comments-container');
  const countEl = document.getElementById('comment-count');
  if (container) container.innerHTML = `<div class="loader"><div class="spinner-ring"></div><span>コメントを取得中...</span></div>`;

  try {
    const data = await fetchCommentsFromInvidious(videoId, sort);
    if (!data) throw new Error('no data');
    const comments = data.comments || [];
    if (countEl) countEl.textContent = (data.commentCount || comments.length).toLocaleString();
    if (!comments.length) {
      if (container) container.innerHTML = '<div style="padding:24px;color:var(--text-secondary);">コメントはありません</div>';
      return;
    }
    renderComments(comments, container);
  } catch (e) {
    if (container) {
      container.innerHTML = `
        <div style="padding:24px;color:var(--text-secondary);text-align:center;">
          コメントの取得に失敗しました<br>
          <button onclick="fetchComments('${videoId}')" 
                  style="margin-top:12px;padding:8px 16px;border-radius:18px;background:var(--chip-bg);border:1px solid var(--border-color);cursor:pointer;font-size:13px;">
            再試行
          </button>
        </div>`;
    }
  }
}

/* ---------- コメントレンダリング ---------- */
function renderComments(comments, container) {
  if (!container) return;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  comments.slice(0, 100).forEach(c => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    const avatarUrl = c.authorThumbnails?.[0]?.url || `https://i.pravatar.cc/40?u=${encodeURIComponent(c.author || '')}`;
    const likeStr = c.likeCount ? formatViews(c.likeCount) + ' 高評価' : '';
    const isPinned = !!(c.isPinned || c.isOwner);
    const isHearted = !!(c.creatorHeart);
    const isOwner = !!c.isOwner;
    const publishedText = c.publishedText || c.published || '';
    div.innerHTML = `
      <img class="comment-avatar" src="${avatarUrl}"
           onerror="this.src='https://i.pravatar.cc/40?u=${encodeURIComponent(c.author || '')}'"
           loading="lazy">
      <div class="comment-body">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="comment-author">${c.author || ''}</span>
          ${isPinned  ? `<span style="font-size:11px;color:var(--text-secondary);">📌 ピン留め</span>` : ''}
          ${isOwner   ? `<span style="font-size:11px;background:var(--chip-bg);border-radius:4px;padding:1px 5px;">投稿者</span>` : ''}
          ${isHearted ? `<span style="font-size:14px;" title="チャンネルオーナーがハートを付けました">❤️</span>` : ''}
          ${publishedText ? `<span style="font-size:11px;color:var(--text-secondary);">${publishedText}</span>` : ''}
        </div>
        <div class="comment-text">${parseCommentContent(c.content || c.contentHtml || '')}</div>
        <div class="comment-likes">
          ${likeStr}
          <button class="comment-reply-btn" onclick="toggleReplies(this, '${videoId || window.currentVideoId}', '${(c.replyToken || c.commentId || '').replace(/'/g, "\\'")}')">
            返信 ${c.replyCount ? `(${c.replyCount})` : ''}
          </button>
        </div>
        <div class="comment-replies" style="display:none;margin-top:8px;padding-left:16px;border-left:2px solid var(--border-color);"></div>
      </div>`;
    frag.appendChild(div);
  });
  container.appendChild(frag);
}

/* ---------- テキスト解析 ---------- */
function parseCommentContent(content) {
  if (!content) return '';
  let s = String(content)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /* URLリンク化 */
  s = s.replace(/(https?:\/\/[^\s<]+)/g, url => {
    const safe = url.replace(/"/g, '&quot;');
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;word-break:break-all;" onclick="event.stopPropagation();">${url}</a>`;
  });
  /* タイムスタンプ */
  s = s.replace(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g, ts => {
    const parts = ts.split(':').map(Number);
    const sec = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts[0]*60+parts[1];
    return `<a href="javascript:void(0)" onclick="seekToTimestamp(${sec})" style="color:#3ea6ff;font-weight:600;">${ts}</a>`;
  });
  return s.replace(/\n/g, '<br>');
}

function seekToTimestamp(sec) {
  const vid = document.querySelector('#player-wrapper video, #view-watch video');
  if (vid) { vid.currentTime = sec; vid.play().catch(() => {}); return; }
  const iframe = document.getElementById('yt-player');
  if (iframe) {
    try {
      const url = new URL(iframe.src);
      url.searchParams.set('start', sec);
      iframe.src = url.toString();
    } catch (_) {}
  }
}

/* ---------- 返信表示 ---------- */
async function toggleReplies(btn, videoId, replyToken) {
  const repliesDiv = btn.closest('.comment-body')?.querySelector('.comment-replies');
  if (!repliesDiv) return;
  if (repliesDiv.style.display !== 'none') {
    repliesDiv.style.display = 'none';
    btn.textContent = btn.textContent.replace('▲', '');
    return;
  }
  repliesDiv.style.display = 'block';
  if (repliesDiv.dataset.loaded) return;
  repliesDiv.innerHTML = '<div style="padding:8px;color:var(--text-secondary);font-size:13px;">返信を読み込み中...</div>';
  try {
    const bases = getInvidiousFor('video');
    let data = null;
    for (const b of bases.slice(0, 5)) {
      try {
        const d = await apiFetch(`${b}/api/v1/comments/${videoId}?continuation=${encodeURIComponent(replyToken)}`, 5000);
        if (d?.comments?.length) { data = d; break; }
      } catch (_) {}
    }
    if (data?.comments?.length) {
      repliesDiv.innerHTML = data.comments.slice(0, 20).map(c => {
        const avatarUrl = c.authorThumbnails?.[0]?.url || `https://i.pravatar.cc/32?u=${encodeURIComponent(c.author || '')}`;
        return `<div style="display:flex;gap:10px;margin-bottom:12px;">
          <img src="${avatarUrl}" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;object-fit:cover;"
               onerror="this.src='https://i.pravatar.cc/32?u=${encodeURIComponent(c.author || '')}'" loading="lazy">
          <div>
            <div style="font-size:12px;font-weight:700;margin-bottom:2px;">${c.author || ''}</div>
            <div style="font-size:13px;">${parseCommentContent(c.content || '')}</div>
          </div>
        </div>`;
      }).join('');
      repliesDiv.dataset.loaded = '1';
    } else {
      repliesDiv.innerHTML = '<div style="padding:8px;color:var(--text-secondary);font-size:13px;">返信なし</div>';
    }
  } catch (_) {
    repliesDiv.innerHTML = '<div style="padding:8px;color:var(--text-secondary);font-size:13px;">返信の取得に失敗しました</div>';
  }
}

/* ウォッチビューが表示された時にコメントセクションを初期化 */
document.addEventListener('DOMContentLoaded', () => {
  setInterval(() => {
    if (document.getElementById('view-watch')?.classList.contains('active')) {
      injectCommentSortUI();
    }
  }, 1500);
});
