import { shouldContinue } from '../models/search-pagination.js';
import { mapChrome } from '../views/map-chrome.js';
import { brandName } from '../views/brand-name.js';
import { $ } from '../views/dom.js';
import { placeRow, brandRow, detailContent } from '../views/places.js';
import { wonjuTerminal, acquirePosition } from '../services/search.js';
import { normalize, placeRecord, paymentFor, metersBetween } from '../models/payment.js';
import { t, getLocale } from '../i18n/registry.js';

export function mapController({ provider, search, catalog, ads, report }) {
  const list = $('results'),
    panel = $('detail');
  let directoryMode = false,
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
    expanded = false;
  let arrival = true, gpsIntent = 0, nearbyMode = false, locationError = '';
  let categories = [];
  let autoLoading = false, gpsViewport = false, fullAreaMode = false;
  let browsing = true,
    statusTimer,
    lastStatus;
  const chrome = mapChrome({ category: selectCategory, locate, report, submit, render, edit: supersedeLocation });
  const explored = () => document.dispatchEvent(new Event('paykr:explored'));
  function cancel() {
    revision++;
    autoLoading = false;
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
  function supersedeLocation() {
    arrival = false;
    locationError = '';
    gpsIntent++;
    locating = false;
    $('location-button').disabled = false;
  }
  function choose(row) {
    supersedeLocation();
    if (selected?.id === row.id) {
      closeDetail();
      return;
    }
    selected = row;
    if (state.kind === 'places' && live) provider.select(row);
    sheet(true);
    render();
    if (chrome.mobile()) panel.scrollIntoView({ block: 'nearest' });
    else $('sheet-content').scrollTop = 0;
    $('place-clear').focus({ preventScroll: true });
    explored();
  }
  function chooseMarker(row) {
    if (!chrome.mobile()) return choose(row);
    supersedeLocation();
    provider.deselect();
    const dialog = $('marker-dialog');
    const content = $('marker-detail');
    const populate = () => content.replaceChildren(detailContent(row, {
      brand: false, format: getLocale() === 'ko' ? null : formatter, position, verify: search.dbMode ? (p) => search.verify(p) : null,
    }));
    populate();
    window.addEventListener('localechange', populate);
    dialog.addEventListener('close', () => {
      window.removeEventListener('localechange', populate);
      content.replaceChildren();
    }, { once: true });
    dialog.showModal();
    dialog.scrollTop = 0;
    explored();
  }
  function statusText() {
    if (state.status) return t(state.status);
    const count = t(state.kind === 'places' ? 'search.count' : 'ecommerce.count', {
      count: state.rows.length,
    });
    return [count, locationError && t(locationError), state.stale && t('search.cached'), state.partial && t('search.partial'), state.limited && t('search.limit')]
      .filter(Boolean)
      .join(' · ');
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
    const filtered = state.rows;
    const rows = isBrand ? filtered.slice(0, brandLimit) : filtered;
    list.replaceChildren(
      ...rows.map((r, i) => (isBrand ? brandRow(r, choose) : placeRow(r, choose, position, format, i))),
    );
    for (const row of list.children) row.classList.toggle('active', row.dataset.id === selected?.id);
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
          verify: search.dbMode ? (p) => search.verify(p) : null,
        }),
      );
    $('more-results').hidden = autoLoading || Boolean(selected) || !(isBrand ? rows.length < filtered.length : state.more);
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
  async function run({ append = false, area = areaOnly, interaction = true, nearby = false, fullArea = false } = {}) {
    browsing = true;
    nearbyMode = nearby;
    fullAreaMode = fullArea;
    const sweep = nearby || fullArea;
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
    autoLoading = true;
    render();
    try {
      let partial = Boolean(append && state.partial), limited = Boolean(append && state.limited), stale = Boolean(append && state.stale), pages = 0;
      const found = new Map((append ? state.rows : []).map(row => [row.id, row]));
      do {
        const result = await search.search({
          input: inputTerm,
          brand: brandContext,
          category: inputTerm ? 'all' : category,
          bounds: scope,
          page,
          offset,
          nearby: sweep,
          privateViewport: gpsViewport,
        });
        if (current !== revision || !result) return;
        const added = [];
        for (const place of result.items) {
          const earlier = found.get(place.id);
          if (!earlier) {
            found.set(place.id, place);
            added.push(place);
          } else if (earlier.claim.status === 'unknown' && place.claim.status !== 'unknown') {
            Object.assign(earlier, place);
          }
        }
        const rows = [...found.values()];
        if (nearby && position) rows.sort((a, b) => metersBetween(position, a) - metersBetween(position, b));
        pages++;
        stale ||= Boolean(result.stale);
        partial ||= result.errors > 0;
        limited ||= result.limited;
        state = {
          kind: 'places',
          rows,
          status: rows.length ? null : sweep && !search.dbMode && result.more ? 'search.loading' : partial ? 'search.error' : 'search.none',
          partial, limited, stale,
          more: (!sweep || search.dbMode) && result.more,
        };
        provider.addMarkers(added, chooseMarker);
        if (inputTerm && !scope && !append && rows.length) provider.center(rows[0]);
        if (result.failed && append) {
          if (inputTerm) page--;
          else offset -= 12;
          state.more = true;
        }
        if (!selected) render();
        if (!shouldContinue({dbMode:search.dbMode,nearby:sweep,all:category==='all',area:Boolean(scope),input:inputTerm,more:result.more,failed:result.failed,pages})) break;
        offset += 12;
      } while (current === revision);
      if (interaction) explored();
    } catch {
      if (current === revision) {
        state.status = state.rows.length ? null : 'search.error';
        state.partial = true;
        state.more = false;
        render();
      }
    } finally {
      if(current===revision){autoLoading=false; if(!selected)render();}
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
    supersedeLocation();
    if (value === 'all') directoryMode = false; // Preserve the current viewport in both modes.
    brandContext = null;
    category = value;
    inputTerm = '';
    chrome.sync('');
    areaOnly = true;
    chrome.setFilter(false);
    sheet(true);
    run({ fullArea: value === 'all' });
    explored();
  }
  function controls() {
    chrome.controls(categories);
    $('location-button').disabled = locating;
    $('location-button').setAttribute('aria-description', t('location.purpose'));
    $('city-map').href = 'https://map.kakao.com/link/map/원주종합버스터미널,' + wonjuTerminal.lat + ',' + wonjuTerminal.lng;
    render();
  }
  async function locate({ initial = false } = {}) {
    if (!live) {
      state.status = 'map.unavailable';
      render();
      return;
    }
    if (locating) return;
    locationError = '';
    const intent = ++gpsIntent;
    locating = true;
    controls();
    state.status = 'location.loading';
    render();
    try {
      const p = await acquirePosition(navigator.geolocation);
      if (intent !== gpsIntent || !live) return;
      position = p;
      gpsViewport = true;

      directoryMode = false;
      category = 'all';
      provider.locate(p);
      inputTerm = '';
      chrome.sync('');
      brandContext = null;
      areaOnly = true;
      void run({ nearby: true });
    } catch (key) {
      if (intent === gpsIntent && live) {
        locationError = key;
        state.status = key;
        render();
        // The map was initialized at the fallback center. Search it only if initial GPS failed.
        if (initial) void run({ area: true, fullArea: true, interaction: false });
      }
    } finally {
      if (intent === gpsIntent) {
        locating = false;
        controls();
      }
    }
  }
  function moved() {
    supersedeLocation();
    cancel();
    state.more = false;
    state.status = 'map.areaHint';
    render();
  }
  async function start() {
    if (starting || live) return;
    starting = true;
    try {
      if (!navigator.onLine) throw new Error();
      await provider.start($('map'), wonjuTerminal, moved, () => {
        if (selected) closeDetail();
      });
      if (!navigator.onLine) throw new Error('Offline');
      live = true;
      $('map').style.visibility = '';

      $('map-failure').hidden = true;

      if (selected || directoryMode) render();
      else {
        const autoLocate = arrival && !inputTerm;
        arrival = false;
        // Do not query the fallback viewport while GPS is pending.
        if (autoLocate) await locate({ initial: true });
        else await run({ area: !inputTerm || areaOnly, interaction: false, fullArea: category === 'all' && !inputTerm });
      }
    } catch {
      $('map-failure').hidden = false;
      render();
    } finally {
      starting = false;
    }
  }
  function submit(input) {
    supersedeLocation();
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
  $('source-switch').onclick = () => {
    directoryMode = state.kind === 'places';
    supersedeLocation();
    if (directoryMode) provider.render([], choose);
    sheet(true);
    run({ area: !inputTerm });
  };
  $('zoom-in').onclick = () => provider.zoom(-1);
  $('zoom-out').onclick = () => provider.zoom(1);
  $('location-button').onclick = locate;
  $('browse-brands').onclick = () => {
    supersedeLocation();
    directoryMode = true;
    browsing = true;
    sheet(true);
    brands(inputTerm);
    explored();
  };
  $('place-clear').onclick = closeDetail;
  $('area').onclick = () => { supersedeLocation(); directoryMode = false; sheet(true); run({ area: true, fullArea: category === 'all' && !inputTerm }); };
  $('retry-map').onclick = start;
  $('retry-search').onclick = () => run({ nearby: nearbyMode, fullArea: fullAreaMode });

  $('more-results').onclick = () => {
    if (autoLoading || state.status === 'search.loading') return;
    if (state.kind === 'brands') {
      brandLimit += 12;
      render();
    } else {
      if (inputTerm) page++;
      else offset += 12;
      run({ append: true, nearby: nearbyMode, fullArea: fullAreaMode });
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
    supersedeLocation();
    cancel();
    if (live) provider.render([], choose);
    $('map').style.visibility = 'hidden';
    live = false;

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
