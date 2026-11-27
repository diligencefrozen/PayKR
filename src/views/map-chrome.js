import { $, button, el } from './dom.js';
import { categoryIcon } from './category-icons.js';
import { t, getLocale, pageLink } from '../i18n/registry.js';
import { positionChat } from '../services/feedback.js';

const icons = {
  '생활/가전': 'home',
  외식: 'food',
  '호텔/리조트': 'bed',
  '백화점/쇼핑': 'bag',
  '패션/뷰티': 'bag',
  '편의점&카페': 'coffee',
};
export function mapChrome({ category, locate, report, submit, render, edit }) {
  const filter = $('filter-panel'),
    media = matchMedia('(max-width:768px)');
  const help = document.createElement('details');
  const summary = el('summary', t('map.how'));
  summary.dataset.i18n = 'map.how';
  help.append(summary, $('sidebar-welcome'), $('sidebar-guides'));
  $('settings').querySelector('form').before(help);
  const inputs = [$('search-input'), $('search-input-mobile')];
  let opener;
  function setFilter(open, focus = false) {
    filter.hidden = !open;
    document.body.classList.toggle('filter-open', open);
    document.querySelectorAll('.filter-toggle').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) $('filter-close').focus();
    else if (focus) opener?.focus();
  }
  for (const b of document.querySelectorAll('.filter-toggle'))
    b.onclick = () => {
      opener = b;
      setFilter(filter.hidden);
    };
  $('filter-close').onclick = () => setFilter(false, true);
  document.addEventListener('pointerdown', (e) => {
    if (!filter.hidden && !e.target.closest('#filter-panel,.filter-toggle')) setFilter(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !filter.hidden) setFilter(false, true);
  });
  function sync(value) {
    inputs.forEach((input) => (input.value = value));
  }
  inputs.forEach((input) => {
    input.oninput = () => {sync(input.value);edit();};
    input.form.onsubmit = (e) => {
      e.preventDefault();
      submit(input);
    };
  });
  function controls(categories) {
    const keys = [
      ...new Set([
        'all',
        '편의점&카페',
        '외식',
        '백화점/쇼핑',
        '생활/가전',
        '호텔/리조트',
        '패션/뷰티',
        ...categories,
        '온라인',
        '문의하기',
      ]),
    ];
    for (const id of ['desktop-categories', 'mobile-categories', 'filter-categories']) {
      $(id).replaceChildren(
        ...keys.map((key) => {
          const b = button('', () => {
            setFilter(false);
            if (key === '온라인') {
              location.assign(pageLink('online.html'));
              return;
            }
            if (key === '문의하기') {
              report();
              return;
            }
            category(key);
          });
          b.dataset.category = key;
          b.innerHTML = categoryIcon(icons[key] || 'grid');
          b.append(el('span', t('category.' + (key === 'all' ? '전체' : key))));
          return b;
        }),
      );
      if (id !== 'filter-categories') {
        const nearby = button(t('map.nearby'), locate);
        nearby.setAttribute('aria-description', t('location.purpose'));
        $(id).prepend(nearby);
      }
    }
  }
  function layout() {
    const sheet = $('place-sheet');
    const sheetParent = media.matches ? $('main-content') : $('sidebar-content');
    if (sheet.parentElement !== sheetParent) sheetParent.prepend(sheet);
    const host = $('results-host'),
      mount = media.matches ? $('mobile-results') : $('search-results-list');
    if (host.parentElement !== mount) mount.append(host);
    const short = matchMedia('(orientation:landscape) and (max-height:500px)').matches,
      rect = $('place-sheet').getBoundingClientRect();
    const bottom = !media.matches ? 16 : short ? Math.max(10, innerHeight - rect.bottom) : Math.ceil(innerHeight - rect.top + 12);
    document.documentElement.style.setProperty('--sheet-clearance', bottom + 'px');
    positionChat(bottom);
  }
  media.addEventListener('change', () => {
    layout();
    render();
  });
  new ResizeObserver(layout).observe($('place-sheet'));
  new ResizeObserver(layout).observe(document.querySelector('.app-dock'));
  new ResizeObserver(layout).observe(document.querySelector('.masthead'));
  window.visualViewport?.addEventListener('resize', layout);
  const guides = [...document.querySelectorAll('.guide-buttons button')];
  guides.forEach(
    (b) =>
      (b.onclick = async () => {
        const opening = b.getAttribute('aria-expanded') !== 'true';
        for (const node of guides) {
          const show = node === b && opening;
          node.setAttribute('aria-expanded', String(show));
          $(node.getAttribute('aria-controls')).hidden = !show;
        }
        if (opening && b.id === 'release-button') {
          const archive = $('release-list');
          try {
            const response = await fetch(new URL('../data/release-history.json', import.meta.url));
            if (!response.ok) throw Error();
            const records = await response.json();
            archive.replaceChildren(
              ...records.map((r) => {
                const item = el('li');
                item.append(el('b', r.date), el('span', getLocale() === 'ko' ? r.ko : r.en));
                return item;
              }),
            );
          } catch {
            const link = el('a', t('common.history'));
            link.href = './docs/release-history.txt';
            archive.replaceChildren(link);
          }
        }
      }),
  );
  layout();
  return { sync, controls, setFilter, layout, mobile: () => media.matches };
}
