// Supabase 클라이언트 초기화
let supabase;
let posts = [];
let currentPostId = null;
let userIP = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    // Supabase 초기화
    if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
        alert('⚠️ config.js 파일에서 Supabase 설정을 완료해주세요!\n\nSUPABASE_SETUP.md 파일을 참고하세요.');
        return;
    }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    await getUserIP();
    loadUserCredentials();
    await loadPosts();
    
    // 실시간 구독 설정
    setupRealtimeSubscription();
    
    // 오래된 게시글 자동 삭제 (6개월)
    await cleanOldPosts();
});

// IP 주소 가져오기
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        const fullIP = data.ip;
        
        const ipParts = fullIP.split('.');
        if (ipParts.length >= 2) {
            userIP = ipParts.slice(0, 2).join('.');
        } else {
            userIP = fullIP.substring(0, 8);
        }
        
        if (!getCookie('userNickname')) {
            document.getElementById('write-nickname').value = userIP;
            document.getElementById('comment-nickname').value = userIP;
        }
    } catch (error) {
        console.log('IP를 가져올 수 없습니다:', error);
        userIP = Math.random().toString(36).substring(2, 8);
    }
}

// 쿠키에서 사용자 정보 로드
function loadUserCredentials() {
    const nickname = getCookie('userNickname');
    
    if (nickname) {
        document.getElementById('write-nickname').value = nickname;
        document.getElementById('comment-nickname').value = nickname;
    } else if (userIP) {
        document.getElementById('write-nickname').value = userIP;
        document.getElementById('comment-nickname').value = userIP;
    }
}

// 쿠키 설정
function setCookie(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

// 쿠키 가져오기
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Supabase에서 게시글 로드
async function loadPosts() {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                comments (
                    id,
                    nickname,
                    ip,
                    content,
                    created_at
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        posts = data || [];
        renderPosts();
    } catch (error) {
        console.error('게시글 로드 실패:', error);
        alert('게시글을 불러오는데 실패했습니다.');
    }
}

// 실시간 구독 설정
function setupRealtimeSubscription() {
    // 게시글 변경 감지
    supabase
        .channel('posts_channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'posts' },
            () => loadPosts()
        )
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'comments' },
            () => loadPosts()
        )
        .subscribe();
}

// 게시글 렌더링
function renderPosts() {
    const container = document.getElementById('posts-container');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-text">아직 게시글이 없습니다</div>
                <div class="empty-state-subtext">첫 번째 게시글을 작성해보세요!</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => {
        const likeCount = post.likes ? post.likes.length : 0;
        const commentCount = post.comments ? post.comments.length : 0;
        const isLiked = post.likes && post.likes.includes(getDeviceId());
        
        return `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-author">
                        <div class="author-avatar">${post.nickname.charAt(0)}</div>
                        <div class="author-info">
                            <div class="author-name">
                                ${escapeHtml(post.nickname)}
                                ${post.ip ? `<span class="user-ip">(${escapeHtml(post.ip)})</span>` : ''}
                            </div>
                            <div class="post-date">${formatDate(post.created_at)}</div>
                        </div>
                    </div>
                </div>
                <div class="post-title" onclick="viewPost(${post.id})">${escapeHtml(post.title)}</div>
                <div class="post-content" onclick="viewPost(${post.id})">${escapeHtml(post.content.substring(0, 200))}${post.content.length > 200 ? '...' : ''}</div>
                <div class="post-stats">
                    <span>👁️ ${post.views}</span>
                    <span>❤️ ${likeCount}</span>
                    <span>💬 ${commentCount}</span>
                </div>
                <div class="post-actions">
                    <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
                        ${isLiked ? '❤️' : '🤍'} 추천
                    </button>
                    <button class="action-btn" onclick="openCommentModal(${post.id})">
                        💬 댓글
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 게시글 상세보기
async function viewPost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    // 조회수 증가
    try {
        await supabase
            .from('posts')
            .update({ views: post.views + 1 })
            .eq('id', postId);
        
        post.views++;
    } catch (error) {
        console.error('조회수 업데이트 실패:', error);
    }
    
    const likeCount = post.likes ? post.likes.length : 0;
    const commentCount = post.comments ? post.comments.length : 0;
    
    document.getElementById('detail-content').innerHTML = `
        <div class="detail-post">
            <div class="detail-title">${escapeHtml(post.title)}</div>
            <div class="detail-author">
                <div class="author-avatar">${post.nickname.charAt(0)}</div>
                <div class="author-info">
                    <div class="author-name">
                        ${escapeHtml(post.nickname)}
                        ${post.ip ? `<span class="user-ip">(${escapeHtml(post.ip)})</span>` : ''}
                    </div>
                    <div class="post-date">${formatDate(post.created_at)}</div>
                </div>
            </div>
            <div class="detail-content-text">${escapeHtml(post.content)}</div>
            <div class="post-stats">
                <span>👁️ ${post.views}</span>
                <span>❤️ ${likeCount}</span>
                <span>💬 ${commentCount}</span>
            </div>
        </div>
    `;
    
    document.getElementById('detail-modal').style.display = 'block';
    renderPosts();
}

// 글쓰기 모달 열기
function openWriteModal() {
    document.getElementById('write-modal').style.display = 'block';
}

// 글쓰기 모달 닫기
function closeWriteModal() {
    document.getElementById('write-modal').style.display = 'none';
}

// 상세 모달 닫기
function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// 게시글 작성
async function submitPost() {
    const nickname = document.getElementById('write-nickname').value.trim();
    const title = document.getElementById('write-title').value.trim();
    const content = document.getElementById('write-content').value.trim();
    
    if (!nickname || !title || !content) {
        alert('모든 항목을 입력해주세요.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('posts')
            .insert([{
                nickname: nickname,
                ip: userIP,
                title: title,
                content: content,
                views: 0,
                likes: []
            }]);
        
        if (error) throw error;
        
        // 쿠키에 저장
        setCookie('userNickname', nickname);
        
        // 폼 초기화
        document.getElementById('write-title').value = '';
        document.getElementById('write-content').value = '';
        
        closeWriteModal();
        alert('게시글이 작성되었습니다!');
        
        // 게시글 다시 로드
        await loadPosts();
    } catch (error) {
        console.error('게시글 작성 실패:', error);
        alert('게시글 작성에 실패했습니다.');
    }
}

// 추천 토글
async function toggleLike(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const deviceId = getDeviceId();
    let newLikes = post.likes || [];
    
    const likeIndex = newLikes.indexOf(deviceId);
    
    if (likeIndex > -1) {
        newLikes.splice(likeIndex, 1);
    } else {
        newLikes.push(deviceId);
    }
    
    try {
        const { error } = await supabase
            .from('posts')
            .update({ likes: newLikes })
            .eq('id', postId);
        
        if (error) throw error;
        
        post.likes = newLikes;
        renderPosts();
    } catch (error) {
        console.error('추천 업데이트 실패:', error);
    }
}

// 디바이스 ID 생성 (추천 중복 방지)
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// 댓글 모달 열기
function openCommentModal(postId) {
    currentPostId = postId;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    document.getElementById('comment-modal').style.display = 'block';
    renderComments(post);
}

// 댓글 모달 닫기
function closeCommentModal() {
    document.getElementById('comment-modal').style.display = 'none';
    currentPostId = null;
}

// 댓글 렌더링
function renderComments(post) {
    const commentsList = document.getElementById('comments-list');
    
    if (!post.comments || post.comments.length === 0) {
        commentsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">첫 댓글을 작성해보세요!</div>
            </div>
        `;
        return;
    }
    
    // 최신순 정렬
    const sortedComments = [...post.comments].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    commentsList.innerHTML = sortedComments.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-author">
                    <div class="comment-avatar">${comment.nickname.charAt(0)}</div>
                    <div>
                        <div class="comment-name">
                            ${escapeHtml(comment.nickname)}
                            ${comment.ip ? `<span class="user-ip">(${escapeHtml(comment.ip)})</span>` : ''}
                        </div>
                        <div class="comment-date">${formatDate(comment.created_at)}</div>
                    </div>
                </div>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
        </div>
    `).join('');
}

// 댓글 작성
async function submitComment() {
    if (!currentPostId) return;
    
    const nickname = document.getElementById('comment-nickname').value.trim();
    const content = document.getElementById('comment-content').value.trim();
    
    if (!nickname || !content) {
        alert('모든 항목을 입력해주세요.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('comments')
            .insert([{
                post_id: currentPostId,
                nickname: nickname,
                ip: userIP,
                content: content
            }]);
        
        if (error) throw error;
        
        // 쿠키에 저장
        setCookie('userNickname', nickname);
        
        // 폼 초기화
        document.getElementById('comment-content').value = '';
        
        alert('댓글이 작성되었습니다!');
        
        // 게시글 다시 로드
        await loadPosts();
        
        // 댓글 다시 렌더링
        const post = posts.find(p => p.id === currentPostId);
        if (post) renderComments(post);
    } catch (error) {
        console.error('댓글 작성 실패:', error);
        alert('댓글 작성에 실패했습니다.');
    }
}

// 날짜 포맷팅
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// HTML 이스케이프
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 오래된 게시글 자동 삭제 (6개월 이상)
async function cleanOldPosts() {
    try {
        // 6개월 전 날짜 계산
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        // 6개월 지난 게시글 삭제
        const { data, error } = await supabase
            .from('posts')
            .delete()
            .lt('created_at', sixMonthsAgo.toISOString());
        
        if (error) {
            console.log('오래된 게시글 정리 중 오류:', error);
        } else {
            console.log('오래된 게시글 정리 완료 (6개월 이상 된 글 삭제)');
        }
    } catch (error) {
        console.error('자동 정리 실패:', error);
    }
}

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
    const writeModal = document.getElementById('write-modal');
    const commentModal = document.getElementById('comment-modal');
    const detailModal = document.getElementById('detail-modal');
    
    if (event.target === writeModal) {
        closeWriteModal();
    } else if (event.target === commentModal) {
        closeCommentModal();
    } else if (event.target === detailModal) {
        closeDetailModal();
    }
}
