/* Map presentation stays independent of Kakao and the third-party chat loader. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sheet = $('place-sheet');
  const toggle = $('sheet-toggle');
  let expanded = false;
  let crate = null;
  let chatLocation = '';
  let statusTimer;
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
    food: '<path d="M5 3v6m3-6v6M2 3v6c0 4 6 4 6 0M5 12v9M17 3v18M17 3c-5 3-5 10 0 10"/>',
    bed: '<path d="M3 5v16m18-12v12M3 17h18M3 10h18v7M7 7h4v3"/>',
    bag: '<rect x="4" y="8" width="16" height="13" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
    coffee: '<path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 9h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`; }
  function setExpanded(value) {
    expanded = value;
    sheet.classList.toggle('is-expanded', value);
    toggle.setAttribute('aria-expanded', String(value));
    const label = value ? 'place.collapse' : 'place.expand';
    toggle.setAttribute('data-i18n-aria-label', label);
    toggle.setAttribute('aria-label', t(label));
    $('sheet-content').hidden = !value;
    requestAnimationFrame(layoutControls);
  }
  function layoutControls() {
    const rect = sheet.getBoundingClientRect();
    // In short landscape windows the controls have their own column beside the sheet.
    const sideRail = window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
    const bottom = sideRail ? Math.max(16, window.innerHeight - rect.bottom) : Math.ceil(window.innerHeight - rect.top + 16);
    // Crate's documented numeric location uses negative coordinates from bottom/right.
    const right = Math.max(20, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-right')) || 0);
    document.documentElement.style.setProperty('--sheet-clearance', `${bottom}px`);
    const location = [-bottom, -right];
    if (crate && chatLocation !== location.join(',')) {
      chatLocation = location.join(',');
      crate.setOptions({ location });
    }
  }
  function resetPlace() {
    translatedText($('place-title'), 'place.emptyTitle');
    $('place-ad').hidden = true;
    translatedText($('place-subtitle'), 'place.emptyHint');
    $('place-details').replaceChildren();
    $('place-clear').hidden = true;
    setExpanded(false);
  }
  function addLink(parent, key, href, values) {
    const link = document.createElement('a');
    translatedText(link, key, values);
    link.href = href;
    if (!href.startsWith('tel:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    parent.append(link);
  }
  function placeContent(place, compact) {
    const content = document.createElement('div');
    if (compact) {
      content.className = 'infoWindow';
      const name = document.createElement('strong');
      name.textContent = place.place_name;
      content.append(name);
    }
    const address = document.createElement('p');
    address.className = compact ? 'info-address' : 'place-address';
    const addressText = place.road_address_name || place.address_name;
    if (addressText) address.textContent = addressText;
    else translatedText(address, 'place.noAddress');
    content.append(address);
    const actions = document.createElement('div');
    actions.className = compact ? 'info-actions' : 'place-actions';
    if (place.phone) {
      addLink(actions, compact ? 'place.call' : 'place.phone', 'tel:' + place.phone.replace(/[^+\d-]/g, ''), { phone: place.phone });
    }
    if (place.id) addLink(actions, compact ? 'place.review' : 'place.details', 'https://place.map.kakao.com/' + encodeURIComponent(place.id));
    if (Number.isFinite(Number(place.x)) && Number.isFinite(Number(place.y))) {
      addLink(actions, 'place.directions', `https://map.kakao.com/link/to/${encodeURIComponent(place.place_name)},${Number(place.y)},${Number(place.x)}`);
    }
    content.append(actions);
    return content;
  }
  function selectPlace(place) {
    const title = $('place-title');
    const subtitle = $('place-subtitle');
    delete title.dataset.i18n;
    title.textContent = place.place_name;
    if (place.category_name) {
      delete subtitle.dataset.i18n;
      subtitle.textContent = place.category_name;
    } else translatedText(subtitle, 'place.info');
    $('place-clear').hidden = false;
    $('place-ad').hidden = false;
    $('place-details').replaceChildren(placeContent(place, false));
    setExpanded(true);
    $('sheet-content').scrollTop = 0;
  }
  function resultButton(place, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result-item';
    const number = document.createElement('span');
    number.className = 'result-number'; number.textContent = index + 1;
    const info = document.createElement('span'); info.className = 'result-info';
    const name = document.createElement('strong'); name.textContent = place.place_name;
    const address = document.createElement('span'); address.textContent = place.road_address_name || place.address_name || '';
    info.append(name, address); button.append(number, info);
    return button;
  }
  function showResults(places, onSelect) {
    const list = $('mobile-results'); list.replaceChildren();
    const heading = document.createElement('h2'); translatedText(heading, 'search.count', { count: places.length });
    list.append(heading);
    places.forEach((place, index) => {
      const button = resultButton(place, index);
      button.addEventListener('click', () => onSelect(place));
      list.append(button);
    });
  }
  function setFilter(open) {
    $('filter-panel').hidden = !open;
    document.querySelectorAll('.filter-toggle').forEach(button => button.setAttribute('aria-expanded', String(open)));
  }
  function renderCategories(categories, onSelect) {
    const icons = { '전체': 'grid', '생활/가전': 'home', '외식': 'food', '호텔/리조트': 'bed', '백화점/쇼핑': 'bag', '패션/뷰티': 'bag', '편의점&카페': 'coffee' };
    const order = ['전체', '생활/가전', '외식', '호텔/리조트', '백화점/쇼핑', '패션/뷰티'];
    const sorted = [...categories].sort((a, b) => (order.indexOf(a.name) < 0 ? 99 : order.indexOf(a.name)) - (order.indexOf(b.name) < 0 ? 99 : order.indexOf(b.name)));
    ['desktop-categories', 'mobile-categories', 'filter-categories'].forEach(id => {
      const container = $(id); container.replaceChildren();
      sorted.forEach(cat => {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.category = cat.name;
        const navigation = cat.name === '온라인' || cat.name === '문의하기';
        if (!navigation) button.setAttribute('aria-pressed', String(cat.name === '전체'));
        button.innerHTML = icon(icons[cat.name]);
        const label = document.createElement('span'); translatedText(label, 'category.' + cat.name); button.append(label);
        button.addEventListener('click', () => {
          if (!navigation) document.querySelectorAll('[data-category][aria-pressed]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.category === cat.name)));
          setFilter(false);
          onSelect(cat);
        });
        container.append(button);
      });
    });
  }
  function status(key) {
    clearTimeout(statusTimer); translatedText($('map-status'), key); $('map-status').hidden = false;
    statusTimer = setTimeout(() => { $('map-status').hidden = true; }, 7000);
  }
  function initChat() {
    if (crate || typeof window.Crate !== 'function') return;
    crate = new window.Crate({
      server: '1574706452671504474', channel: '1574706454353412239',
      location: ['bottom', 'right'], color: '#5865F2', notifications: true, indicator: true, defer: true
    });
    layoutControls();
    if (new URLSearchParams(location.search).get('chat') === 'open') crate.toggle(true);
  }
  toggle.addEventListener('click', () => setExpanded(!expanded));
  // Drag only the handle, allowing the content to retain native scrolling.
  let startY = null;
  let dragged = false;
  toggle.addEventListener('pointerdown', event => { startY = event.clientY; dragged = false; toggle.setPointerCapture(event.pointerId); });
  toggle.addEventListener('pointermove', event => {
    if (startY === null || Math.abs(event.clientY - startY) < 24) return;
    setExpanded(event.clientY < startY); dragged = true;
  });
  toggle.addEventListener('pointerup', () => { startY = null; });
  toggle.addEventListener('pointercancel', () => { startY = null; });
  toggle.addEventListener('click', event => { if (dragged) { event.stopImmediatePropagation(); dragged = false; } }, true);
  $('place-clear').addEventListener('click', () => {
    selectedPlaceId = null;
    closeAllOverlays();
    resetPlace();
  });
  document.querySelectorAll('.filter-toggle').forEach(button => button.addEventListener('click', () => setFilter($('filter-panel').hidden)));
  $('filter-close').addEventListener('click', () => { setFilter(false); document.querySelector(window.innerWidth <= 768 ? '#search-box-mobile .filter-toggle' : '#search-box .filter-toggle').focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setFilter(false); setExpanded(false); if (crate) crate.toggle(false); }
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#filter-panel, .filter-toggle')) setFilter(false);
  });
  if ('ResizeObserver' in window) new ResizeObserver(layoutControls).observe(sheet);
  window.addEventListener('resize', layoutControls);
  window.visualViewport?.addEventListener('resize', layoutControls);
  window.PayKR = {
    placeOverlay: place => placeContent(place, true),
    selectPlace, resetPlace, resultButton, showResults, renderCategories, status, initChat
  };
  ['search-box', 'search-box-mobile'].forEach(id => $(id).addEventListener('submit', event => {
    event.preventDefault();
    if (!map) status('map.wait');
  }));
  $('location-button').addEventListener('click', () => { if (!map) status('map.wait'); });
  initChat();
  layoutControls();
})();
