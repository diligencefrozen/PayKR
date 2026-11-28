// Discord OAuth2 callback page (auth/discord-callback.html). No ads, analytics or indexing.
// The code/state are read once, exchanged server-side, and removed from the URL.
const params = new URLSearchParams(location.search);
const code = params.get('code');
const state = params.get('state');
let stored = {};
try {
  stored = JSON.parse(sessionStorage.getItem('paykr-oauth') || '{}');
} catch {
  /* fall through */
}
const { verifier, apiBase, returnPath } = stored;
const safeReturn = String(returnPath || './').startsWith('/PayKR/') ? returnPath || './' : './';
history.replaceState(null, '', location.pathname);
sessionStorage.removeItem('paykr-oauth');

if (!code || !state || !verifier || !apiBase) {
  location.replace(safeReturn);
} else {
  fetch(apiBase + '/api/auth/discord/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state, verifier }),
    cache: 'no-store',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('exchange failed');
      const data = await res.json();
      sessionStorage.setItem(
        'paykr-reviews-session',
        JSON.stringify({ displayName: data.displayName, expiresAt: data.expiresAt, bearer: data.bearer }),
      );
      location.replace(safeReturn);
    })
    .catch(() => location.replace(safeReturn));
}
