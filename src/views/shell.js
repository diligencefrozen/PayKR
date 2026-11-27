export function shell() {
  const strip = document.querySelector('#desktop-categories, #directory-filters');
  strip?.addEventListener('wheel', (event) => {
    if (matchMedia('(max-width:768px)').matches || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const previous = strip.scrollLeft;
    strip.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1);
    if (strip.scrollLeft !== previous) event.preventDefault();
  }, { passive: false });
  const settings = document.getElementById('settings');
  document.querySelectorAll('[data-more]').forEach((b) => (b.onclick = () => settings.showModal()));
  settings.querySelector('[data-install]').addEventListener('click', () => settings.close());
  settings.querySelector('[data-install-help]').addEventListener('click', () => settings.close());
  const dock = document.querySelector('.app-dock');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--dock-height', dock.offsetHeight + 'px');
  }).observe(dock);
}
