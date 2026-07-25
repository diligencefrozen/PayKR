(() => {
  'use strict';

  const config = window.PAYKR_FORUM_CONFIG;

  if (!config || !config.repository?.owner || !config.repository?.name) {
    throw new Error('PAYKR_FORUM_CONFIG 저장소 설정이 올바르지 않습니다.');
  }

  const STORAGE = Object.freeze({
    session: 'paykr.forum.session.v1',
    user: 'paykr.forum.user.v1',
    oauthState: 'paykr.forum.oauth.state.v1',
    pkceVerifier: 'paykr.forum.oauth.pkce.v1',
    pendingAction: 'paykr.forum.pending-action.v1',
    issueCache: 'paykr.forum.issues-cache.v2'
  });

  const limits = Object.freeze({
    title: 120,
    body: 5000,
    comment: 2000
  });

  const state = {
    issues: [],
    visibleIssues: [],
    comments: [],
    currentIssue: null,
    currentPage: 1,
    category: 'all',
    query: '',
    sort: 'new',
    session: null,
    user: null,
    pendingAction: null,
    issueLoadSequence: 0,
    commentLoadSequence: 0
  };

  const elements = {};
  const categoryMap = new Map(config.categories.map((category) => [category.slug, category.label]));
  const repositoryUrl = `https://github.com/${encodeURIComponent(config.repository.owner)}/${encodeURIComponent(config.repository.name)}`;
  const issueApiPath = `/repos/${encodeURIComponent(config.repository.owner)}/${encodeURIComponent(config.repository.name)}/issues`;

  class ForumError extends Error {
    constructor(message, status = 0, details = null) {
      super(message);
      this.name = 'ForumError';
      this.status = status;
      this.details = details;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      console.error('커뮤니티 초기화 실패:', error);
      setSyncStatus('커뮤니티를 불러오지 못했습니다', 'error');
      renderFeedError(error);
    });
  });

  async function init() {
    cacheElements();
    bindEvents();
    renderCategoryTabs();
    populateComposeCategories();

    await handleOAuthCallback();
    await restoreSession();
    updateAuthUI();
    await loadIssues();
    restorePendingAction();
  }

  function cacheElements() {
    const ids = [
      'auth-user',
      'auth-avatar',
      'auth-login',
      'auth-button',
      'write-button',
      'sync-status',
      'category-tabs',
      'contributor-ranking',
      'feed-search-input',
      'feed-sort-select',
      'forum-feed',
      'feed-pagination',
      'compose-dialog',
      'compose-form',
      'compose-category',
      'compose-title',
      'compose-title-count',
      'compose-content',
      'compose-content-count',
      'compose-author-name',
      'compose-submit',
      'post-dialog',
      'post-detail-category',
      'post-detail-title',
      'post-detail-author',
      'post-detail-body',
      'post-reaction-button',
      'post-reaction-count',
      'comments-count',
      'comments-list',
      'comment-form',
      'comment-content',
      'comment-content-count',
      'comment-submit',
      'comment-login-button',
      'auth-dialog',
      'auth-continue-button',
      'toast-region',
      'empty-state-template'
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`필수 UI 요소를 찾을 수 없습니다: #${id}`);
      }
      elements[id] = element;
    }
  }

  function bindEvents() {
    elements['auth-button'].addEventListener('click', handleAuthButtonClick);
    elements['write-button'].addEventListener('click', handleWriteRequest);
    elements['auth-continue-button'].addEventListener('click', beginGitHubLogin);
    elements['comment-login-button'].addEventListener('click', () => requestAuthentication(`post:${state.currentIssue?.number ?? ''}`));
    elements['compose-form'].addEventListener('submit', submitPost);
    elements['comment-form'].addEventListener('submit', submitComment);
    elements['post-reaction-button'].addEventListener('click', toggleReaction);

    elements['feed-search-input'].addEventListener('input', (event) => {
      state.query = event.target.value.trim().toLocaleLowerCase('ko');
      state.currentPage = 1;
      applyFiltersAndRender();
    });

    elements['feed-sort-select'].addEventListener('change', (event) => {
      state.sort = event.target.value;
      state.currentPage = 1;
      applyFiltersAndRender();
    });

    bindCounter(elements['compose-title'], elements['compose-title-count']);
    bindCounter(elements['compose-content'], elements['compose-content-count']);
    bindCounter(elements['comment-content'], elements['comment-content-count']);

    document.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => closeDialog(document.getElementById(button.dataset.closeDialog)));
    });

    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
          closeDialog(dialog);
        }
      });

      dialog.addEventListener('close', () => {
        syncDialogBodyState();
        if (dialog === elements['auth-dialog']) {
          state.pendingAction = null;
          sessionStorage.removeItem(STORAGE.pendingAction);
        }
        if (dialog === elements['post-dialog'] && state.currentIssue) {
          state.currentIssue = null;
          state.comments = [];
          clearPostHash();
        }
      });
    });

    window.addEventListener('popstate', () => {
      const issueNumber = issueNumberFromHash();
      if (issueNumber) {
        openIssue(issueNumber, { updateHistory: false });
      } else if (elements['post-dialog'].open) {
        closeDialog(elements['post-dialog'], { updateHistory: false });
      }
    });
  }

  function bindCounter(input, output) {
    const update = () => {
      output.textContent = String(input.value.length);
    };
    input.addEventListener('input', update);
    update();
  }

  function renderCategoryTabs() {
    elements['category-tabs'].replaceChildren();
    const categories = [{ slug: 'all', label: '전체' }, ...config.categories];

    for (const category of categories) {
      const button = createElement('button', 'category-tab', category.label);
      button.type = 'button';
      button.dataset.category = category.slug;
      button.classList.toggle('is-active', state.category === category.slug);
      button.setAttribute('aria-pressed', String(state.category === category.slug));
      button.addEventListener('click', () => {
        state.category = category.slug;
        state.currentPage = 1;
        renderCategoryTabs();
        applyFiltersAndRender();
      });
      elements['category-tabs'].append(button);
    }
  }

  function populateComposeCategories() {
    elements['compose-category'].replaceChildren();
    for (const category of config.categories) {
      const option = createElement('option', '', category.label);
      option.value = category.slug;
      elements['compose-category'].append(option);
    }
  }

  function oauthIsConfigured() {
    const clientId = String(config.githubAppClientId || '').trim();
    const workerUrl = String(config.oauthWorkerUrl || '').trim();
    if (!clientId || !workerUrl) return false;

    try {
      const parsed = new URL(workerUrl);
      return parsed.protocol === 'https:' || parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    } catch {
      return false;
    }
  }

  function workerBaseUrl() {
    return String(config.oauthWorkerUrl || '').trim().replace(/\/+$/, '');
  }

  async function handleOAuthCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (!code && !oauthError) return;

    removeOAuthQueryParameters(url);

    if (oauthError) {
      const description = url.searchParams.get('error_description') || '로그인이 취소되었습니다.';
      showToast(description, 'error');
      clearOAuthTransaction();
      return;
    }

    if (!oauthIsConfigured()) {
      clearOAuthTransaction();
      showToast('로그인 연결이 아직 완료되지 않았습니다.', 'error');
      return;
    }

    const expectedState = sessionStorage.getItem(STORAGE.oauthState);
    const verifier = sessionStorage.getItem(STORAGE.pkceVerifier);

    if (!expectedState || !verifier || !returnedState || !constantTimeEqual(expectedState, returnedState)) {
      clearOAuthTransaction();
      showToast('로그인 요청을 확인할 수 없습니다. 다시 시도해주세요.', 'error');
      return;
    }

    try {
      setSyncStatus('로그인을 확인하는 중');
      const result = await workerRequest('/oauth/token', {
        method: 'POST',
        includeSession: false,
        body: {
          code,
          codeVerifier: verifier,
          redirectUri: oauthRedirectUri()
        }
      });

      if (!result.session || !result.user?.login) {
        throw new ForumError('로그인 서버가 올바른 세션을 반환하지 않았습니다.');
      }

      state.session = result.session;
      state.user = normalizeSessionUser(result.user);
      sessionStorage.setItem(STORAGE.session, result.session);
      sessionStorage.setItem(STORAGE.user, JSON.stringify(state.user));
      showToast(`${state.user.login} 계정으로 로그인했습니다.`);
    } catch (error) {
      console.error('OAuth 콜백 처리 실패:', error);
      clearStoredSession();
      showToast(toUserMessage(error, '로그인에 실패했습니다.'), 'error');
    } finally {
      clearOAuthTransaction();
    }
  }

  function removeOAuthQueryParameters(url) {
    const cleanUrl = new URL(url);
    for (const key of ['code', 'state', 'error', 'error_description', 'error_uri']) {
      cleanUrl.searchParams.delete(key);
    }
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  async function restoreSession() {
    const storedSession = sessionStorage.getItem(STORAGE.session);
    const storedUser = safeParseJson(sessionStorage.getItem(STORAGE.user));

    if (!storedSession || !storedUser?.login || !oauthIsConfigured()) {
      clearStoredSession();
      return;
    }

    state.session = storedSession;
    state.user = normalizeSessionUser(storedUser);

    try {
      const result = await workerRequest('/api/session', { method: 'GET' });
      state.user = normalizeSessionUser(result.user);
      sessionStorage.setItem(STORAGE.user, JSON.stringify(state.user));
    } catch (error) {
      console.warn('저장된 로그인 세션이 만료되었습니다:', error);
      clearStoredSession();
      showToast('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    }
  }

  function normalizeSessionUser(user) {
    return {
      id: Number(user.id) || 0,
      login: String(user.login || ''),
      avatarUrl: String(user.avatarUrl || user.avatar_url || ''),
      htmlUrl: String(user.htmlUrl || user.html_url || `https://github.com/${encodeURIComponent(user.login || '')}`)
    };
  }

  function updateAuthUI() {
    const loggedIn = Boolean(state.session && state.user?.login);
    const authButtonLabel = elements['auth-button'].querySelector('span');

    elements['auth-user'].hidden = !loggedIn;
    elements['auth-avatar'].src = loggedIn && state.user.avatarUrl ? state.user.avatarUrl : '../favicon.svg';
    elements['auth-avatar'].alt = loggedIn ? `${state.user.login} 프로필` : '';
    elements['auth-login'].textContent = loggedIn ? state.user.login : '';

    if (loggedIn) {
      authButtonLabel.textContent = '로그아웃';
      elements['auth-button'].title = 'GitHub 로그아웃';
      elements['compose-author-name'].textContent = `@${state.user.login}`;
    } else {
      authButtonLabel.textContent = 'GitHub 로그인';
      elements['auth-button'].title = 'GitHub로 로그인';
      elements['compose-author-name'].textContent = '현재 로그인 계정';
    }

    const commentAllowed = loggedIn && !state.currentIssue?.locked;
    elements['comment-form'].hidden = !commentAllowed;
    elements['comment-login-button'].hidden = commentAllowed;

    if (state.currentIssue?.locked) {
      elements['comment-login-button'].hidden = false;
      elements['comment-login-button'].disabled = true;
      elements['comment-login-button'].querySelector('strong').textContent = '잠긴 게시글입니다.';
      elements['comment-login-button'].querySelector('span').textContent = '댓글을 작성할 수 없습니다.';
    } else {
      elements['comment-login-button'].disabled = false;
      elements['comment-login-button'].querySelector('strong').textContent = '댓글을 남기려면 GitHub 로그인이 필요합니다.';
      elements['comment-login-button'].querySelector('span').textContent = 'GitHub로 계속하기 →';
    }
  }

  function handleAuthButtonClick() {
    if (state.session) {
      clearStoredSession();
      updateAuthUI();
      showToast('로그아웃했습니다.');
      loadIssues({ force: true }).catch((error) => console.warn('로그아웃 후 새로고침 실패:', error));
      return;
    }

    requestAuthentication('');
  }

  function handleWriteRequest() {
    if (state.session) {
      openComposeDialog();
      return;
    }

    requestAuthentication('compose');
  }

  function requestAuthentication(pendingAction) {
    state.pendingAction = pendingAction || '';
    if (pendingAction) {
      sessionStorage.setItem(STORAGE.pendingAction, pendingAction);
    } else {
      sessionStorage.removeItem(STORAGE.pendingAction);
    }

    showDialog(elements['auth-dialog']);
  }

  async function beginGitHubLogin() {
    if (!oauthIsConfigured()) {
      showToast('로그인 연결이 아직 완료되지 않았습니다.', 'error');
      return;
    }

    const oauthState = randomBase64Url(32);
    const verifier = randomBase64Url(64);
    const challenge = await sha256Base64Url(verifier);

    sessionStorage.setItem(STORAGE.oauthState, oauthState);
    sessionStorage.setItem(STORAGE.pkceVerifier, verifier);

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', config.githubAppClientId.trim());
    authorizeUrl.searchParams.set('redirect_uri', oauthRedirectUri());
    authorizeUrl.searchParams.set('state', oauthState);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('allow_signup', 'true');

    window.location.assign(authorizeUrl.toString());
  }

  function oauthRedirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function clearOAuthTransaction() {
    sessionStorage.removeItem(STORAGE.oauthState);
    sessionStorage.removeItem(STORAGE.pkceVerifier);
  }

  function clearStoredSession() {
    state.session = null;
    state.user = null;
    sessionStorage.removeItem(STORAGE.session);
    sessionStorage.removeItem(STORAGE.user);
  }

  function restorePendingAction() {
    const pendingAction = sessionStorage.getItem(STORAGE.pendingAction) || state.pendingAction;
    sessionStorage.removeItem(STORAGE.pendingAction);
    state.pendingAction = null;

    if (!state.session || !pendingAction) {
      const hashIssue = issueNumberFromHash();
      if (hashIssue) openIssue(hashIssue, { updateHistory: false });
      return;
    }

    if (pendingAction === 'compose') {
      openComposeDialog();
      return;
    }

    if (pendingAction.startsWith('post:')) {
      const issueNumber = Number(pendingAction.slice(5));
      if (Number.isInteger(issueNumber) && issueNumber > 0) {
        openIssue(issueNumber);
      }
    }
  }

  async function loadIssues({ force = false } = {}) {
    const sequence = ++state.issueLoadSequence;
    setSyncStatus('게시글을 불러오는 중');
    elements['forum-feed'].setAttribute('aria-busy', 'true');

    if (!force) {
      const cache = readIssueCache();
      if (cache) {
        state.issues = cache;
        applyFiltersAndRender();
        setSyncStatus('최신 게시글로 갱신됨', 'ready');
        elements['forum-feed'].setAttribute('aria-busy', 'false');
        loadContributorRanking().catch((error) => console.warn('활동 랭킹 로드 실패:', error));
        return;
      }
    }

    try {
      const rawIssues = [];
      const perPage = 100;

      for (let page = 1; page <= config.maxIssuePages; page += 1) {
        const pageIssues = await fetchIssuePage(page, perPage);
        if (sequence !== state.issueLoadSequence) return;
        rawIssues.push(...pageIssues);
        if (pageIssues.length < perPage) break;
      }

      state.issues = rawIssues
        .filter((issue) => !issue.pull_request)
        .map(normalizeIssue)
        .filter(Boolean);

      writeIssueCache(state.issues);
      applyFiltersAndRender();
      setSyncStatus('최신 게시글로 갱신됨', 'ready');
      loadContributorRanking().catch((error) => console.warn('활동 랭킹 로드 실패:', error));
    } catch (error) {
      console.error('게시글 로드 실패:', error);
      setSyncStatus('게시글을 불러오지 못했습니다', 'error');
      renderFeedError(error);
    } finally {
      if (sequence === state.issueLoadSequence) {
        elements['forum-feed'].setAttribute('aria-busy', 'false');
      }
    }
  }

  async function fetchIssuePage(page, perPage) {
    const params = new URLSearchParams({
      state: 'all',
      sort: 'created',
      direction: 'desc',
      per_page: String(perPage),
      page: String(page)
    });

    if (state.session && oauthIsConfigured()) {
      return workerRequest(`/api/issues?${params}`);
    }

    return githubRequest(`${issueApiPath}?${params}`);
  }

  function normalizeIssue(issue) {
    const issueNumber = Number(issue.number);
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;

    const body = String(issue.body || '');
    const category = extractCategory(body, issue.title);
    const reactions = Number(issue.reactions?.total_count || issue.reactionsCount || 0);

    return {
      number: issueNumber,
      title: stripIssueTitle(String(issue.title || '제목 없음')),
      body: stripForumMetadata(body),
      category,
      author: normalizeAuthor(issue.user || issue.author),
      createdAt: String(issue.created_at || issue.createdAt || ''),
      updatedAt: String(issue.updated_at || issue.updatedAt || issue.created_at || ''),
      commentsCount: Number(issue.comments ?? issue.commentsCount ?? 0),
      reactionsCount: Number.isFinite(reactions) ? reactions : 0,
      htmlUrl: String(issue.html_url || issue.htmlUrl || `${repositoryUrl}/issues/${issueNumber}`),
      locked: Boolean(issue.locked),
      state: String(issue.state || 'open')
    };
  }

  function normalizeAuthor(author) {
    const login = String(author?.login || 'github-user');
    return {
      id: Number(author?.id) || 0,
      login,
      avatarUrl: String(author?.avatar_url || author?.avatarUrl || ''),
      htmlUrl: String(author?.html_url || author?.htmlUrl || `https://github.com/${encodeURIComponent(login)}`)
    };
  }

  function extractCategory(body, title = '') {
    const bodyMatch = body.match(/<!--\s*paykr-category:([a-z0-9-]+)\s*-->/i);
    if (bodyMatch && categoryMap.has(bodyMatch[1])) return bodyMatch[1];

    const titleMatch = String(title).match(/^\[(?:커뮤니티|거지방):([a-z0-9-]+)\]/i);
    if (titleMatch && categoryMap.has(titleMatch[1])) return titleMatch[1];
    return 'free';
  }

  function stripIssueTitle(title) {
    return title.replace(/^\[(?:커뮤니티|거지방):[a-z0-9-]+\]\s*/i, '').trim() || '제목 없음';
  }

  function stripForumMetadata(body) {
    return body
      .replace(new RegExp(`<!--\\s*${escapeRegExp(config.forumMarker)}\\s*-->`, 'gi'), '')
      .replace(/<!--\s*paykr-category:[a-z0-9-]+\s*-->/gi, '')
      .trim();
  }

  function applyFiltersAndRender() {
    const filtered = state.issues.filter((issue) => {
      const categoryMatches = state.category === 'all' || issue.category === state.category;
      const queryMatches = !state.query
        || issue.title.toLocaleLowerCase('ko').includes(state.query)
        || issue.body.toLocaleLowerCase('ko').includes(state.query)
        || issue.author.login.toLocaleLowerCase('ko').includes(state.query);
      return categoryMatches && queryMatches;
    });

    filtered.sort(issueSorter(state.sort));
    state.visibleIssues = filtered;

    const pageCount = Math.max(1, Math.ceil(filtered.length / config.pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), pageCount);
    renderFeed();
    renderPagination(pageCount);
  }

  function issueSorter(sort) {
    if (sort === 'updated') {
      return (a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt);
    }
    if (sort === 'comments') {
      return (a, b) => b.commentsCount - a.commentsCount || dateValue(b.createdAt) - dateValue(a.createdAt);
    }
    if (sort === 'reactions') {
      return (a, b) => b.reactionsCount - a.reactionsCount || dateValue(b.createdAt) - dateValue(a.createdAt);
    }
    return (a, b) => dateValue(b.createdAt) - dateValue(a.createdAt);
  }

  function renderFeed() {
    elements['forum-feed'].replaceChildren();

    if (state.visibleIssues.length === 0) {
      const fragment = elements['empty-state-template'].content.cloneNode(true);
      if (state.issues.length > 0) {
        fragment.querySelector('h3').textContent = '조건에 맞는 게시글이 없습니다.';
        fragment.querySelector('p').textContent = '검색어나 카테고리를 바꿔보세요.';
      }
      fragment.querySelector('[data-empty-write]').addEventListener('click', handleWriteRequest);
      elements['forum-feed'].append(fragment);
      return;
    }

    const start = (state.currentPage - 1) * config.pageSize;
    const pageIssues = state.visibleIssues.slice(start, start + config.pageSize);
    const fragment = document.createDocumentFragment();

    for (const issue of pageIssues) {
      fragment.append(renderFeedItem(issue));
    }

    elements['forum-feed'].append(fragment);
  }

  function renderFeedItem(issue) {
    const article = createElement('article', 'post-feed-item');
    const openButton = createElement('button', 'post-feed-open');
    openButton.type = 'button';
    openButton.setAttribute('aria-label', `${issue.title} 게시글 열기`);
    openButton.addEventListener('click', () => openIssue(issue.number));

    const topLine = createElement('div', 'post-feed-item-topline');
    const category = createElement('span', 'category-badge', categoryLabel(issue.category));
    const title = createElement('h3', 'post-feed-item-title', issue.title);
    topLine.append(category, title);

    const excerpt = createElement('p', 'post-feed-item-excerpt', issue.body || '내용이 없습니다.');

    const meta = createElement('div', 'post-feed-item-meta');
    const avatar = createAvatar(issue.author, 20);
    const author = createElement('span', 'post-feed-item-author', issue.author.login);
    const separator = createElement('span', '', '·');
    const time = createElement('time', '', formatRelativeTime(issue.createdAt));
    time.dateTime = issue.createdAt;
    time.title = formatAbsoluteTime(issue.createdAt);
    meta.append(avatar, author, separator, time);

    openButton.append(topLine, excerpt, meta);

    const stats = createElement('div', 'post-feed-item-stats');
    stats.setAttribute('aria-label', `공감 ${issue.reactionsCount}개, 댓글 ${issue.commentsCount}개`);
    const reactions = createElement('span', 'post-feed-stat', `👍 ${issue.reactionsCount}`);
    const comments = createElement('span', 'post-feed-stat', `💬 ${issue.commentsCount}`);
    stats.append(reactions, comments);

    article.append(openButton, stats);
    return article;
  }

  function renderPagination(pageCount) {
    elements['feed-pagination'].replaceChildren();
    if (pageCount <= 1) return;

    const previous = createElement('button', 'pagination-button', '‹');
    previous.type = 'button';
    previous.disabled = state.currentPage === 1;
    previous.setAttribute('aria-label', '이전 페이지');
    previous.addEventListener('click', () => setPage(state.currentPage - 1));
    elements['feed-pagination'].append(previous);

    for (const page of paginationWindow(state.currentPage, pageCount)) {
      if (page === '…') {
        const ellipsis = createElement('span', 'pagination-button', '…');
        ellipsis.setAttribute('aria-hidden', 'true');
        elements['feed-pagination'].append(ellipsis);
        continue;
      }

      const button = createElement('button', 'pagination-button', String(page));
      button.type = 'button';
      button.classList.toggle('is-active', page === state.currentPage);
      button.setAttribute('aria-current', page === state.currentPage ? 'page' : 'false');
      button.setAttribute('aria-label', `${page}페이지`);
      button.addEventListener('click', () => setPage(page));
      elements['feed-pagination'].append(button);
    }

    const next = createElement('button', 'pagination-button', '›');
    next.type = 'button';
    next.disabled = state.currentPage === pageCount;
    next.setAttribute('aria-label', '다음 페이지');
    next.addEventListener('click', () => setPage(state.currentPage + 1));
    elements['feed-pagination'].append(next);
  }

  function paginationWindow(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
  }

  function setPage(page) {
    state.currentPage = page;
    renderFeed();
    renderPagination(Math.max(1, Math.ceil(state.visibleIssues.length / config.pageSize)));
    elements['forum-feed'].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadContributorRanking() {
    if (state.issues.length === 0) {
      renderRanking([]);
      return;
    }

    const contributions = new Map();
    const forumIssueNumbers = new Set(state.issues.map((issue) => issue.number));

    for (const issue of state.issues) {
      addContribution(contributions, issue.author, 'posts');
    }

    try {
      const params = new URLSearchParams({
        sort: 'created',
        direction: 'desc',
        per_page: '100',
        page: '1'
      });
      const comments = state.session && oauthIsConfigured()
        ? await workerRequest(`/api/repository-comments?${params}`)
        : await githubRequest(`${issueApiPath}/comments?${params}`);

      for (const comment of comments) {
        const issueNumber = Number(String(comment.issue_url || '').split('/').pop());
        if (!forumIssueNumbers.has(issueNumber)) continue;
        addContribution(contributions, normalizeAuthor(comment.user), 'comments');
      }
    } catch (error) {
      console.warn('댓글 기반 활동 랭킹을 불러오지 못했습니다:', error);
    }

    const ranking = [...contributions.values()]
      .map((entry) => ({ ...entry, score: entry.posts * 3 + entry.comments }))
      .sort((a, b) => b.score - a.score || b.posts - a.posts || a.author.login.localeCompare(b.author.login))
      .slice(0, 10);
    renderRanking(ranking);
  }

  function addContribution(map, author, field) {
    const key = author.id || author.login;
    const existing = map.get(key) || { author, posts: 0, comments: 0 };
    existing[field] += 1;
    map.set(key, existing);
  }

  function renderRanking(ranking) {
    elements['contributor-ranking'].replaceChildren();

    if (ranking.length === 0) {
      elements['contributor-ranking'].append(createElement('li', 'rail-placeholder', '첫 활동자가 되어보세요.'));
      return;
    }

    ranking.forEach((entry, index) => {
      const item = createElement('li', 'ranking-item');
      const position = createElement('span', 'ranking-position', `#${index + 1}`);
      const avatar = createAvatar(entry.author, 32);
      const person = createElement('span', 'ranking-person');
      person.append(
        createElement('strong', '', entry.author.login),
        createElement('small', '', `글 ${entry.posts} · 댓글 ${entry.comments}`)
      );
      const score = createElement('span', 'ranking-score', String(entry.score));
      score.title = '활동 점수: 글 3점, 댓글 1점';
      item.append(position, avatar, person, score);
      elements['contributor-ranking'].append(item);
    });
  }

  function renderFeedError(error) {
    elements['forum-feed'].replaceChildren();
    const section = createElement('section', 'empty-state error-state');
    const icon = createElement('div', 'empty-state-icon', '!');
    icon.setAttribute('aria-hidden', 'true');
    const title = createElement('h3', '', '게시글을 불러오지 못했습니다.');
    const description = createElement('p', '', toUserMessage(error, '잠시 후 다시 시도해주세요.'));
    const retry = createElement('button', 'button button-primary', '다시 시도');
    retry.type = 'button';
    retry.addEventListener('click', () => loadIssues({ force: true }));
    section.append(icon, title, description, retry);
    elements['forum-feed'].append(section);
  }

  async function openIssue(issueNumber, { updateHistory = true } = {}) {
    const issue = state.issues.find((candidate) => candidate.number === Number(issueNumber));
    if (!issue) {
      showToast('해당 게시글을 찾을 수 없습니다.', 'error');
      return;
    }

    state.currentIssue = issue;
    state.comments = [];
    elements['post-detail-category'].textContent = categoryLabel(issue.category);
    elements['post-detail-title'].textContent = issue.title;
    elements['post-detail-body'].textContent = issue.body || '내용이 없습니다.';
    elements['post-reaction-count'].textContent = String(issue.reactionsCount);
    elements['post-reaction-button'].classList.remove('is-active');
    elements['comments-count'].textContent = String(issue.commentsCount);
    renderDetailAuthor(issue);
    updateAuthUI();
    showDialog(elements['post-dialog']);

    if (updateHistory) {
      window.history.pushState({}, '', `#post-${issue.number}`);
    }

    await loadComments(issue.number);
  }

  function renderDetailAuthor(issue) {
    elements['post-detail-author'].replaceChildren();
    const avatar = createAvatar(issue.author, 36);
    const info = createElement('div');
    const name = createElement('strong', '', issue.author.login);
    const date = createElement('small', '', `${formatAbsoluteTime(issue.createdAt)} · #${issue.number}`);
    info.append(name, date);
    elements['post-detail-author'].append(avatar, info);
  }

  async function loadComments(issueNumber) {
    const sequence = ++state.commentLoadSequence;
    elements['comments-list'].replaceChildren(createElement('div', 'comments-loading', '댓글을 불러오는 중입니다.'));

    try {
      const comments = [];
      const perPage = 100;

      for (let page = 1; page <= 3; page += 1) {
        const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
        const pageComments = state.session && oauthIsConfigured()
          ? await workerRequest(`/api/issues/${issueNumber}/comments?${params}`)
          : await githubRequest(`${issueApiPath}/${issueNumber}/comments?${params}`);

        if (sequence !== state.commentLoadSequence || state.currentIssue?.number !== issueNumber) return;
        comments.push(...pageComments);
        if (pageComments.length < perPage) break;
      }

      state.comments = comments.map(normalizeComment);
      renderComments();
    } catch (error) {
      console.error('댓글 로드 실패:', error);
      elements['comments-list'].replaceChildren(
        createElement('div', 'comments-empty', toUserMessage(error, '댓글을 불러오지 못했습니다.'))
      );
    }
  }

  function normalizeComment(comment) {
    return {
      id: Number(comment.id) || 0,
      body: String(comment.body || ''),
      author: normalizeAuthor(comment.user),
      createdAt: String(comment.created_at || comment.createdAt || ''),
      htmlUrl: String(comment.html_url || comment.htmlUrl || '')
    };
  }

  function renderComments() {
    elements['comments-list'].replaceChildren();
    elements['comments-count'].textContent = String(state.currentIssue?.commentsCount ?? state.comments.length);

    if (state.comments.length === 0) {
      elements['comments-list'].append(createElement('div', 'comments-empty', '아직 댓글이 없습니다. 첫 댓글을 남겨보세요.'));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const comment of state.comments) {
      const item = createElement('article', 'comment-item');
      const avatar = createAvatar(comment.author, 32);
      const content = createElement('div');
      const header = createElement('header', 'comment-item-header');
      const name = createElement('strong', '', comment.author.login);
      const time = createElement('time', '', formatRelativeTime(comment.createdAt));
      time.dateTime = comment.createdAt;
      time.title = formatAbsoluteTime(comment.createdAt);
      const body = createElement('p', 'comment-item-body', comment.body);
      header.append(name, time);
      content.append(header, body);
      item.append(avatar, content);
      fragment.append(item);
    }
    elements['comments-list'].append(fragment);
  }

  function openComposeDialog() {
    if (!state.session) {
      requestAuthentication('compose');
      return;
    }

    elements['compose-form'].reset();
    elements['compose-category'].value = state.category !== 'all' && categoryMap.has(state.category) ? state.category : 'free';
    elements['compose-title-count'].textContent = '0';
    elements['compose-content-count'].textContent = '0';
    elements['compose-author-name'].textContent = `@${state.user.login}`;
    showDialog(elements['compose-dialog']);
    window.setTimeout(() => elements['compose-title'].focus(), 30);
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!state.session || !oauthIsConfigured()) {
      requestAuthentication('compose');
      return;
    }

    const category = elements['compose-category'].value;
    const title = elements['compose-title'].value.trim();
    const content = elements['compose-content'].value.trim();

    if (!categoryMap.has(category) || title.length < 2 || title.length > limits.title || !content || content.length > limits.body) {
      showToast('카테고리, 제목, 내용을 다시 확인해주세요.', 'error');
      return;
    }

    setButtonBusy(elements['compose-submit'], true, '게시 중');
    try {
      const rawIssue = await workerRequest('/api/issues', {
        method: 'POST',
        body: { category, title, content }
      });
      const issue = normalizeIssue(rawIssue);
      if (!issue) throw new ForumError('생성된 게시글 응답이 올바르지 않습니다.');

      state.issues = [issue, ...state.issues.filter((item) => item.number !== issue.number)];
      state.category = 'all';
      state.query = '';
      state.currentPage = 1;
      elements['feed-search-input'].value = '';
      renderCategoryTabs();
      writeIssueCache(state.issues);
      applyFiltersAndRender();
      closeDialog(elements['compose-dialog']);
      showToast('게시글을 등록했습니다.');
      loadContributorRanking().catch(() => {});
      await openIssue(issue.number);
    } catch (error) {
      console.error('게시글 작성 실패:', error);
      handleAuthenticationFailure(error, '게시글을 등록하지 못했습니다.');
    } finally {
      setButtonBusy(elements['compose-submit'], false);
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!state.currentIssue) return;
    if (!state.session || !oauthIsConfigured()) {
      requestAuthentication(`post:${state.currentIssue.number}`);
      return;
    }

    const content = elements['comment-content'].value.trim();
    if (!content || content.length > limits.comment) {
      showToast('댓글 내용을 확인해주세요.', 'error');
      return;
    }

    setButtonBusy(elements['comment-submit'], true, '등록 중');
    try {
      const rawComment = await workerRequest(`/api/issues/${state.currentIssue.number}/comments`, {
        method: 'POST',
        body: { content }
      });
      state.comments.push(normalizeComment(rawComment));
      state.currentIssue.commentsCount += 1;
      elements['comment-content'].value = '';
      elements['comment-content-count'].textContent = '0';
      writeIssueCache(state.issues);
      renderComments();
      applyFiltersAndRender();
      showToast('댓글을 등록했습니다.');
      loadContributorRanking().catch(() => {});
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      handleAuthenticationFailure(error, '댓글을 등록하지 못했습니다.');
    } finally {
      setButtonBusy(elements['comment-submit'], false);
    }
  }

  async function toggleReaction() {
    if (!state.currentIssue) return;
    if (!state.session || !oauthIsConfigured()) {
      requestAuthentication(`post:${state.currentIssue.number}`);
      return;
    }

    elements['post-reaction-button'].disabled = true;
    elements['post-reaction-button'].setAttribute('aria-busy', 'true');
    try {
      const result = await workerRequest(`/api/issues/${state.currentIssue.number}/reaction`, {
        method: 'POST'
      });
      const delta = Number(result.delta) || 0;
      state.currentIssue.reactionsCount = Math.max(0, state.currentIssue.reactionsCount + delta);
      elements['post-reaction-count'].textContent = String(state.currentIssue.reactionsCount);
      elements['post-reaction-button'].classList.toggle('is-active', Boolean(result.active));
      writeIssueCache(state.issues);
      applyFiltersAndRender();
      showToast(result.active ? '게시글에 공감했습니다.' : '공감을 취소했습니다.');
    } catch (error) {
      console.error('공감 처리 실패:', error);
      handleAuthenticationFailure(error, '공감을 처리하지 못했습니다.');
    } finally {
      elements['post-reaction-button'].disabled = false;
      elements['post-reaction-button'].removeAttribute('aria-busy');
    }
  }

  function handleAuthenticationFailure(error, fallbackMessage) {
    if (error instanceof ForumError && error.status === 401) {
      clearStoredSession();
      updateAuthUI();
      showToast('로그인 세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
      return;
    }
    showToast(toUserMessage(error, fallbackMessage), 'error');
  }

  async function workerRequest(path, { method = 'GET', body, includeSession = true } = {}) {
    if (!oauthIsConfigured()) {
      throw new ForumError('OAuth Worker가 설정되지 않았습니다.', 503);
    }

    const headers = {
      Accept: 'application/json'
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (includeSession && state.session) headers.Authorization = `Bearer ${state.session}`;

    let response;
    try {
      response = await fetch(`${workerBaseUrl()}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store'
      });
    } catch (error) {
      throw new ForumError('로그인 서버에 연결할 수 없습니다.', 0, error);
    }

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new ForumError(payload?.error || '로그인 서버 요청에 실패했습니다.', response.status, payload);
    }
    return payload;
  }

  async function githubRequest(path) {
    let response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': config.apiVersion
        }
      });
    } catch (error) {
      throw new ForumError('커뮤니티에 연결할 수 없습니다. 네트워크를 확인해주세요.', 0, error);
    }

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const rateLimited = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0';
      const message = rateLimited
        ? '게시글 조회 요청이 많습니다. 잠시 후 다시 시도해주세요.'
        : '커뮤니티 요청에 실패했습니다.';
      throw new ForumError(message, response.status, payload);
    }
    return payload;
  }

  async function readJsonResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new ForumError('서버가 올바르지 않은 응답을 반환했습니다.', response.status);
    }
  }

  function readIssueCache() {
    const cache = safeParseJson(sessionStorage.getItem(STORAGE.issueCache));
    if (!cache || !Array.isArray(cache.issues) || !Number.isFinite(cache.savedAt)) return null;
    if (Date.now() - cache.savedAt > config.cacheTtlMs) {
      sessionStorage.removeItem(STORAGE.issueCache);
      return null;
    }
    return cache.issues.filter((issue) => Number.isInteger(issue.number) && issue.author?.login);
  }

  function writeIssueCache(issues) {
    try {
      sessionStorage.setItem(STORAGE.issueCache, JSON.stringify({
        savedAt: Date.now(),
        issues
      }));
    } catch (error) {
      console.warn('게시글 캐시 저장 실패:', error);
    }
  }

  function setSyncStatus(message, status = '') {
    if (!elements['sync-status']) return;
    elements['sync-status'].classList.toggle('is-ready', status === 'ready');
    elements['sync-status'].classList.toggle('is-error', status === 'error');
    elements['sync-status'].querySelector('span:last-child').textContent = message;
  }

  function showDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    syncDialogBodyState();
  }

  function closeDialog(dialog, { updateHistory = true } = {}) {
    if (!dialog?.open) return;
    const wasPostDialog = dialog === elements['post-dialog'];
    dialog.close();
    if (wasPostDialog && updateHistory) clearPostHash();
  }

  function syncDialogBodyState() {
    const anyOpen = [...document.querySelectorAll('dialog')].some((dialog) => dialog.open);
    document.body.classList.toggle('is-dialog-open', anyOpen);
    document.body.classList.toggle('is-post-open', Boolean(elements['post-dialog']?.open));
  }

  function issueNumberFromHash() {
    const match = window.location.hash.match(/^#post-(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  function clearPostHash() {
    if (!window.location.hash.startsWith('#post-')) return;
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  }

  function setButtonBusy(button, busy, label = '') {
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.disabled = true;
      if (label) button.textContent = label;
      return;
    }

    button.disabled = false;
    if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }

  function showToast(message, type = '') {
    const toast = createElement('div', `toast${type === 'error' ? ' is-error' : ''}`, message);
    elements['toast-region'].append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function categoryLabel(slug) {
    return categoryMap.get(slug) || categoryMap.get('free') || '자유';
  }

  function createAvatar(author, size) {
    const image = createElement('img');
    image.width = size;
    image.height = size;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = author.avatarUrl || '../favicon.svg';
    return image;
  }

  function createElement(tagName, className = '', text = null) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
  }

  function formatRelativeTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absolute = Math.abs(seconds);
    const formatter = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

    if (absolute < 60) return formatter.format(seconds, 'second');
    if (absolute < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
    if (absolute < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
    if (absolute < 2_592_000) return formatter.format(Math.round(seconds / 86400), 'day');
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function formatAbsoluteTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function dateValue(value) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function safeParseJson(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function toUserMessage(error, fallback) {
    if (error instanceof ForumError && error.message) return error.message;
    return fallback;
  }

  function randomBase64Url(byteLength) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return bytesToBase64Url(bytes);
  }

  async function sha256Base64Url(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return bytesToBase64Url(new Uint8Array(digest));
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function constantTimeEqual(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
})();
