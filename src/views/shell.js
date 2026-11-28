import { getLocale, formatDate, t } from '../i18n/registry.js';
import { el } from './dom.js';

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
  const archive = document.getElementById('release-archive');
  let history;
  async function showHistory() {
    try {
      history ||= fetch(new URL('../data/release-history.json', import.meta.url)).then(response => {
        if (!response.ok) throw Error();
        return response.json();
      });
      const records = await history;
      const yearGroups = new Map();
      for (const record of records) {
        const date = record.date.replace(/^(\d{4})(\d{2})(\d{2})\.\d+$/, '$1-$2-$3');
        const year = date.slice(0, 4);
        if (!yearGroups.has(year)) {
          const group = el('details');
          group.open = !yearGroups.size;
          group.append(el('summary', year), el('ol'));
          yearGroups.set(year, group);
        }
        const item = el('li'), stamp = el('time', formatDate(date));
        stamp.dateTime = date;
        const lang = getLocale() === 'ko' ? 'ko' : 'en';
        const body = el('p', record[lang]);
        body.lang = lang;
        item.append(stamp, body);
        yearGroups.get(year).lastChild.append(item);
      }
      archive.replaceChildren(...yearGroups.values());
    } catch {
      history = null;
      archive.replaceChildren(el('p', t('search.error')));
    }
  }
  window.addEventListener('localechange', () => {
    if (document.getElementById('releases-dialog').open) showHistory();
  });
  for (const button of document.querySelectorAll('[data-notes]')) {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.notes + '-dialog').showModal();
      if (button.dataset.notes === 'releases') showHistory();
    });
  }
  const dock = document.querySelector('.app-dock');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--dock-height', dock.offsetHeight + 'px');
  }).observe(dock);
}
