import { $ } from '../views/dom.js';
import { brandCard } from '../views/directory.js';

import { t } from '../i18n/registry.js';
export function directory(catalog, ads) {
  const input = $('searchInput'),
    grid = $('directory');
  let category = 'all',
    revision = 0;
  const filters = $('directory-filters');
  const toggle = $('directory-filter-toggle');
  function expandFilters(open) {
    filters.classList.toggle('is-expanded', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.dataset.i18nAriaLabel = open ? 'map.closeFilter' : 'map.openFilter';
    toggle.setAttribute('aria-label', t(toggle.dataset.i18nAriaLabel));
  }
  function measureFilters() {
    const wrapped = filters.firstElementChild.offsetTop !== filters.lastElementChild.offsetTop;
    toggle.hidden = !wrapped && filters.scrollWidth <= filters.clientWidth + 1;
    if (toggle.hidden) expandFilters(false);
  }
  const observer = new ResizeObserver(measureFilters);
  observer.observe(filters);
  for (const choice of filters.children) observer.observe(choice);
  toggle.onclick = () => expandFilters(!filters.classList.contains('is-expanded'));
  filters.parentElement.addEventListener('keydown', event => {
    if (event.key === 'Escape' && filters.classList.contains('is-expanded')) {
      expandFilters(false);
      toggle.focus();
    }
  });
  async function render() {
    const current = ++revision;
    try {
      const rows = await catalog.query('online', category, input.value);
      if (current !== revision) return;
      grid.dataset.ready = 'true';
      const cards = rows.map(brandCard);
      $('first-cards').replaceChildren(...cards.slice(0,8));
      $('other-cards').replaceChildren(...cards.slice(8));
      $('totalCount').textContent = t('ecommerce.count', { count: rows.length });
      $('empty').hidden = Boolean(rows.length);
      ads.show(rows.length);
    } catch {
      if (current !== revision) return;
      $('totalCount').textContent = t('search.error');
      ads.show(0);
    }
    for (const node of filters.children)
      node.setAttribute('aria-pressed', String(node.dataset.category === category));
  }
  filters.onclick = (event) => {
    const choice = event.target.closest('button[data-category]');
    if (!choice) return;
    category = choice.dataset.category;
    expandFilters(false);
    choice.scrollIntoView({block: 'nearest', inline: 'nearest'});
    window.scrollTo(0, 0);
    render();
    document.dispatchEvent(new Event('paykr:explored'));
  };
  input.oninput = () => {
    window.scrollTo(0, 0);
    render();
    if (input.value.trim()) document.dispatchEvent(new Event('paykr:explored'));
  };
  $('reset').onclick = () => {
    input.value = '';
    category = 'all';
    render();
    input.focus();
  };
  window.addEventListener('localechange', render);
  render();
}
