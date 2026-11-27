import { mapChrome } from '../views/map-chrome.js';
import { brandName } from '../views/brand-name.js';
import { $, button, el } from '../views/dom.js';
import { placeRow, brandRow, detailContent } from '../views/places.js';
import { cities, acquirePosition } from '../services/search.js';
import { normalize, placeRecord, paymentFor } from '../models/payment.js';
import { t, getLocale } from '../i18n/registry.js';

export function mapController({ provider, search, catalog, ads, report }) {
  const list = $('results'),
    panel = $('detail');
  let city = 'seoul',
    atPreset = true,
    directoryMode = false,
    category = 'all',
    live = false,
    starting = false,
    revision = 0,
    locating = false;
  let state = { kind: 'brands', rows: [], status: 'map.locatingHint' },
    selected = null,
    position = null,
    formatter = null;
  let formatLoading = false;
  let brandContext = null;
  let inputTerm = '',
    areaOnly = false,
    offset = 0,
    page = 1,
    scope = null,
    brandLimit = 12,
    expanded = false,
    evidence = 'all';
  let categories = [];
  let browsing = true,
    statusTimer,
    lastStatus;
  const chrome = mapChrome({ category: selectCategory, locate, report, submit, render, edit:()=>{if(locating)cancel();} });
  const explored = () => document.dispatchEvent(new Event('paykr:explored'));
  function cancel() {
    revision++;
    search.cancel();
  }
  function sheet(open) {
    expanded = open;
    $('sheet-content').hidden = !open;
    $('place-sheet').classList.toggle('is-expanded', open);
    requestAnimationFrame(chrome.layout);
    $('sheet-toggle').setAttribute('aria-expanded', String(open));
    $('sheet-toggle').dataset.i18nAriaLabel=open?'place.collapse':'place.expand';
    $('sheet-toggle').setAttribute('aria-label', t(open ? 'place.collapse' : 'place.expand'));
    $('sheet-mode').textContent = t(open ? 'common.map' : 'map.list');
  }
  function closeDetail() {
    const previous = selected;
    selected = null;
    if (live) provider.deselect();
    render();
    if (previous) Array.from(list.children).find(row => row.dataset.id === previous.id)?.focus({ preventScroll: true });
  }
  function choose(row) {
    if (selected?.id === row.id) {
      closeDetail();
      return;
    }
    selected = row;
    if (state.kind === 'places' && live) {
      leavePreset();
      provider.select(row);
    }
    sheet(true);
    render();
    panel.scrollIntoView({ block: 'nearest' });
    $('place-clear').focus({ preventScroll: true });
    explored();
  }
  function statusText() {
    if (state.status) return t(state.status);
    const count = t(state.kind === 'places' ? 'search.count' : 'ecommerce.count', {
      count: visibleRows().length,
    });
    return [count, state.partial && t('search.partial'), state.limited && t('search.limit')]
      .filter(Boolean)
      .join(' · ');
  }
  function visibleRows() {
    return evidence === 'all' ? state.rows : state.rows.filter(row => row.claim?.status === evidence);
  }
  function render() {
    if (
      state.kind === 'places' &&
      state.rows.length &&
      getLocale() !== 'ko' &&
      !formatter &&
      !formatLoading
    ) {
      formatLoading = true;
      import('../../place-text.js')
        .then(({ placeText }) => {
          formatter = placeText;
          render();
        })
        .catch(() => {})
        .finally(() => {
          formatLoading = false;
        });
    }
    const isBrand = state.kind === 'brands',
      format = getLocale() === 'ko' ? null : formatter;
    $('place-sheet').classList.toggle('has-selection', Boolean(selected));
    $('sheet-mode').textContent = t(expanded ? 'common.map' : 'map.list');
    $('results-host').hidden = !browsing || (chrome.mobile() && Boolean(selected));
    $('search-results-header').hidden = !browsing;
    const title = isBrand ? 'map.fallback' : scope ? 'map.results' : 'search.results';
    $('search-results-title').textContent = t(title);
    $('search-results-count').textContent = statusText();
    $('place-title').textContent = selected
      ? isBrand
        ? brandName(selected)
        : format?.name(selected.name) || selected.name
      : t(browsing ? title : 'place.emptyTitle');
    $('place-subtitle').textContent = selected
      ? isBrand
        ? selected.categories.map(key => t('category.' + key)).join(' · ')
        : format?.category(selected.category) || selected.category
      : browsing
        ? statusText()
        : t('place.emptyHint');
    $('place-clear').hidden = !selected;
    if (
      state.status &&
      state.status !== lastStatus &&
      !['map.locatingHint', 'map.areaHint'].includes(state.status)
    ) {
      clearTimeout(statusTimer);
      $('map-status').textContent = t(state.status);
      $('map-status').hidden = false;
      statusTimer = setTimeout(() => {
        $('map-status').hidden = true;
      }, 3800);
    }
    if (!state.status || state.status === 'map.areaHint') $('map-status').hidden = true;
    lastStatus = state.status;
    const filtered = visibleRows();
    const rows = isBrand ? filtered.slice(0, brandLimit) : filtered;
    list.replaceChildren(
      ...rows.map((r, i) => (isBrand ? brandRow(r, choose) : placeRow(r, choose, position, format, i))),
    );
    for (const row of list.children) row.classList.toggle('active', row.dataset.id === selected?.id);
    if (state.rows.length && !rows.length) list.append(el('p', t('search.none'), 'empty-filter'));
    panel.hidden = !selected;
    list.hidden = chrome.mobile() && Boolean(selected);
    if (selected)
      panel.replaceChildren(
        detailContent(selected, {
          brand: isBrand,
          format,
          position,
          back: closeDetail,
          find: live ? findBrand : null,
        }),
      );
    $('more-results').hidden = Boolean(selected) || !(isBrand ? rows.length < filtered.length : state.more);
    $('retry-search').hidden = !(state.status === 'search.error' || state.partial);
    $('area').hidden = !live;
    $('map-zoom').hidden = !live;
    $('source-switch').hidden = !live;
    $('source-switch').textContent = t(isBrand ? 'map.results' : 'map.brands');
    $('browse-brands').hidden = browsing && isBrand && (!chrome.mobile() || expanded);
    ads.show(!browsing || isBrand || selected ? 0 : filtered.length);
    for (const b of document.querySelectorAll('[data-category]'))
      b.setAttribute('aria-pressed', String(b.dataset.category === category));
  }
  async function brands(term = '', message) {
    cancel();
    const current = revision;
    try {
      const rows = await catalog.query('stores', category, term);
      if (current !== revision) return;
      selected = null;
      brandLimit = 12;
      state = { kind: 'brands', rows, status: message || (!rows.length ? 'ecommerce.empty' : null) };
      render();
    } catch {
      if (current === revision) {
        state = { kind: 'brands', rows: [], status: 'search.error' };
        render();
      }
    }
  }
  async function run({ append = false, area = areaOnly, interaction = true } = {}) {
    browsing = true;
    if (!live || directoryMode) {
      await brands(inputTerm);
      if (interaction) explored();
      return;
    }
    cancel();
    const current = revision;
    areaOnly = area;
    if (!append) {
      page = 1;
      offset = 0;
      selected = null;
      scope = area || !inputTerm ? provider.bounds() : null;
      state = { kind: 'places', rows: [], status: 'search.loading' };
      provider.render([], choose);
    } else state.status = 'search.loading';
    render();
    try {
      const result = await search.search({
        input: inputTerm,
        brand: brandContext,
        category: inputTerm ? 'all' : category,
        bounds: scope,
        page,
        offset,
      });
      if (current !== revision || !result) return;
      const previous = append ? state.rows : [];
      const rows = [...new Map([...previous, ...result.items].map((r) => [r.id, r])).values()];
      state = {
        kind: 'places',
        rows,
        status: result.failed ? 'search.error' : !rows.length && !result.errors ? 'search.none' : null,
        partial: result.errors > 0,
        limited: result.limited,
        more: result.more,
      };
      provider.render(visibleRows(), choose);
      if (inputTerm && !scope && !append && rows.length) {
        leavePreset();
        provider.center(rows[0]);
      }
      if (result.failed && append) {
        if (inputTerm) page--;
        else offset -= 12;
        state.more = true;
      }
      render();
      if (interaction) explored();
    } catch {
      if (current === revision) {
        state.status = 'search.error';
        render();
      }
    }
  }
  function findBrand(brand) {
    directoryMode = false;
    brandContext = brand;
    inputTerm = brand.names.ko;
    chrome.sync(inputTerm);
    run({ area: true });
  }
  function selectCategory(value) {
    brandContext = null;
    category = value;
    inputTerm = '';
    chrome.sync('');
    areaOnly = true;
    chrome.setFilter(false);
    sheet(true);
    run();
    explored();
  }
  function controls() {
    chrome.controls(categories);
    $('location-button').disabled = locating;
    $('location-button').setAttribute('aria-description', t('location.purpose'));
    const placeholder = el('option', t('map.city'));
    placeholder.value = '';
    placeholder.disabled = true;
    $('city').replaceChildren(placeholder,
      ...Object.keys(cities).map((key) => {
        const opt = el('option', t('city.' + key));
        opt.value = key;
        return opt;
      }),
    );
    $('city').value = atPreset ? city : '';
    const center = cities[city];
    $('city-map').href = 'https://map.kakao.com/link/map/' + encodeURIComponent(t('city.' + city)) + ',' + center.lat + ',' + center.lng;
    $('evidence-filter').replaceChildren(...['all', 'verified', 'brand_listed', 'community_reported', 'unknown', 'not_supported', 'conflict'].map(key => {
      const opt = el('option', t(key === 'all' ? 'filter.all' : 'status.' + key));
      opt.value = key;
      return opt;
    }));
    $('evidence-filter').value = evidence;
    render();
  }
  function selectCity(key) {
    brandContext = null;
    cancel();
    city = key;
    atPreset = true;
    directoryMode = false;
    inputTerm = '';
    chrome.sync('');
    selected = null;
    category = 'all';
    areaOnly = true;
    controls();
    explored();
    if (live) {
      provider.center(cities[key]);
      run();
    } else {
      brands('');
      start();
    }
  }
  async function locate() {
    if (!live) {
      state.status = 'map.unavailable';
      render();
      return;
    }
    if (locating) return;
    cancel();
    const current = revision;
    locating = true;
    controls();
    state.status = 'location.loading';
    render();
    try {
      const p = await acquirePosition(navigator.geolocation);
      if (current !== revision) return;
      position = p;
      leavePreset();
      directoryMode = false;
      provider.locate(p);
      inputTerm = '';
      chrome.sync('');
      brandContext = null;
      areaOnly = true;
      await run();
    } catch (key) {
      if (current === revision) {
        state.status = key;
        render();
      }
    } finally {
      locating = false;
      controls();
    }
  }
  function moved() {
    leavePreset();
    cancel();
    state.more = false;
    state.status = 'map.areaHint';
    render();
  }
  function leavePreset() {
    atPreset = false;
    $('city').value = '';
  }
  async function start() {
    if (starting || live) return;
    starting = true;
    try {
      if (!navigator.onLine) throw new Error();
      await provider.start($('map'), cities[city], moved, () => {
        if (selected) closeDetail();
      });
      if (!navigator.onLine) throw new Error('Offline');
      live = true;
      $('map').style.visibility = '';
      atPreset = true;
      $('city').value = city;
      provider.center(cities[city]);

      $('map-failure').hidden = true;

      if (selected || directoryMode) render();
      else await run({ area: !inputTerm || areaOnly, interaction: false });
    } catch {
      $('map-failure').hidden = false;
      render();
    } finally {
      starting = false;
    }
  }
  function submit(input) {
    if (!normalize(input.value)) {
      state.status = 'search.required';
      render();
      input.focus();
      return;
    }
    brandContext = null;
    inputTerm = input.value.trim().slice(0, 100);
    category = 'all';
    sheet(true);
    run({ area: false });
    explored();
  }
  $('evidence-filter').onchange = (event) => {
    evidence = event.target.value;
    selected = null;
    brandLimit = 12;
    if (live && state.kind === 'places') provider.render(visibleRows(), choose);
    render();
  };
  $('source-switch').onclick = () => {
    directoryMode = state.kind === 'places';
    evidence = 'all';
    $('evidence-filter').value = evidence;
    if (directoryMode) provider.render([], choose);
    sheet(true);
    run({ area: !inputTerm });
  };
  $('zoom-in').onclick = () => provider.zoom(-1);
  $('zoom-out').onclick = () => provider.zoom(1);
  $('location-button').onclick = locate;
  $('browse-brands').onclick = () => {
    browsing = true;
    sheet(true);
    brands(inputTerm);
    explored();
  };
  $('place-clear').onclick = closeDetail;
  $('area').onclick = () => { directoryMode = false; sheet(true); run({ area: true }); };
  $('city').onchange = (e) => selectCity(e.target.value);
  $('retry-map').onclick = start;
  $('retry-search').onclick = () => run();

  $('more-results').onclick = () => {
    if (state.status === 'search.loading') return;
    if (state.kind === 'brands') {
      brandLimit += 12;
      render();
    } else {
      if (inputTerm) page++;
      else offset += 12;
      run({ append: true });
    }
  };
  $('sheet-toggle').onclick = () => { sheet(!expanded); render(); };
  let startY = null,
    dragged = false;
  $('sheet-toggle').onpointerdown = (e) => {
    startY = e.clientY;
    dragged = false;
    e.target.setPointerCapture(e.pointerId);
  };
  $('sheet-toggle').onpointermove = (e) => {
    if (startY !== null && Math.abs(e.clientY - startY) > 24) {
      sheet(e.clientY < startY);
      render();
      dragged = true;
    }
  };
  $('sheet-toggle').onpointerup = $('sheet-toggle').onpointercancel = () => {
    startY = null;
  };
  $('sheet-toggle').addEventListener(
    'click',
    (e) => {
      if (dragged) {
        e.stopImmediatePropagation();
        dragged = false;
      }
    },
    true,
  );
  window.addEventListener('localechange', controls);
  window.addEventListener('offline', () => {
    cancel();
    if (live) provider.render([], choose);
    $('map').style.visibility = 'hidden';
    live = false;
    atPreset = true;
    $('city').value = city;
    $('map-failure').hidden = false;
    brands(inputTerm, 'offline.body');
  });
  window.addEventListener('online', start);
  const query = new URLSearchParams(location.search).get('q');
  if (query && query.length <= 100 && normalize(query)) {
    inputTerm = query;
    chrome.sync(query);
  }
  controls();
  catalog
    .categories()
    .then((keys) => {
      categories = keys;
      controls();
    })
    .catch(() => {});
  sheet(true);
  brands(inputTerm);
  start();
  return {
    selectPlace(raw) {
      const place = placeRecord(raw);
      if (!place) return;
      place.claim = paymentFor(place.id, null);
      state = { kind: 'places', rows: [place] };
      browsing = true;
      choose(place);
    },
    resetPlace() {
      cancel();
      selected = null;
      browsing = false;
      state = { kind: 'brands', rows: [] };
      if (live) provider.deselect();
      sheet(false);
      render();
    },
  };
}
