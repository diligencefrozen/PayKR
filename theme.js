// Apply the saved appearance before the first paint on either page.
(() => {
  const key = 'paykr-theme';
  const display = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';

  function apply() {
    const dark = preference === 'dark' || (preference === 'system' && display.matches);
    document.documentElement.dataset.scheme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-choice]').forEach(select => { select.value = preference; });
  }

  function restore() {
    try {
      const saved = localStorage.getItem(key);
      preference = saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch { /* Keep the in-page choice when storage is unavailable. */ }
    apply();
  }

  document.documentElement.classList.toggle('ad-preview',new URLSearchParams(location.search).get('adpreview')==='1');
  restore();
  display.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) restore();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  document.addEventListener('paykr:shell', apply);
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-theme-choice]')) return;
    preference = event.target.value;
    try { localStorage.setItem(key, preference); } catch { /* Optional persistence. */ }
    apply();
  });
})();
