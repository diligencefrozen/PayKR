import { $ } from './dom.js';
import { t } from '../i18n/registry.js';

// Discord OAuth2 login for posting reviews/reports. The header button and dialog are
// injected by shell-markup; this module wires them and orchestrates the PKCE flow.
export function initAuth(reviews) {
  const accountButton = $('account-button');
  const dialog = $('auth-dialog');
  let pending = null; // action to run after authentication succeeds
  let returnPath = location.pathname + location.search + location.hash;

  function renderAccount() {
    reviews
      .currentSession()
      .then((session) => {
        accountButton.hidden = false;
        if (session.authed) {
          accountButton.textContent = session.displayName;
          accountButton.setAttribute('aria-label', t('account.signOut'));
          accountButton.dataset.authed = 'true';
        } else {
          accountButton.textContent = t('account.signIn');
          accountButton.setAttribute('aria-label', t('account.signIn'));
          accountButton.dataset.authed = 'false';
        }
      })
      .catch(() => {
        accountButton.hidden = false;
        accountButton.textContent = t('account.signIn');
        accountButton.dataset.authed = 'false';
      });
  }

  async function startLogin() {
    dialog.close();
    try {
      const { state, authorizeUrl } = await reviews.startAuth(returnPath);
      sessionStorage.setItem('paykr-oauth-state', state);
      if (authorizeUrl.startsWith('#paykr-auth')) {
        location.hash = authorizeUrl.slice(1);
      } else {
        location.assign(authorizeUrl);
      }
    } catch {
      // Fall through to keep the map and public reviews usable.
    }
  }

  accountButton.onclick = () => {
    reviews.currentSession().then((session) => {
      if (session.authed) {
        reviews.logout();
        renderAccount();
      } else {
        pending = { action: null };
        dialog.showModal();
        $('auth-continue').focus();
      }
    });
  };

  $('auth-continue').onclick = () => startLogin();
  $('auth-later').onclick = () => {
    pending = null;
    dialog.close();
  };

  // Mock flow completes in-page via a #paykr-auth hash (no network).
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#paykr-auth?')) return;
    const params = new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1));
    history.replaceState(null, '', location.pathname + location.search);
    reviews.exchange(params.get('code'), params.get('state'), params.get('verifier')).then(
      () => {
        renderAccount();
        const action = pending?.action;
        pending = null;
        if (action) action();
      },
      () => {},
    );
  });

  // Require an authenticated session before running `action`. The action (and any draft it
  // closes over) is preserved while the user signs in, and runs only after explicit login.
  function requireAuth(action) {
    reviews.currentSession().then((session) => {
      if (session.authed) {
        action();
      } else {
        pending = { action };
        dialog.showModal();
        $('auth-continue').focus();
      }
    });
  }

  renderAccount();
  return { renderAccount, requireAuth, reviews };
}