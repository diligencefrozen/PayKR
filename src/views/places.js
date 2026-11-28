import { renderCommunityPanel } from './community.js';
import { el, button, badge, link } from './dom.js';
import { metersBetween } from '../models/payment.js';
import { t, formatDate, formatNumber, pageLink } from '../i18n/registry.js';

import { brandName } from './brand-name.js';
function distanceLabel(position, place) {
  return t('place.distance', {
    distance: formatNumber(metersBetween(position, place), { style: 'unit', unit: 'meter' }),
  });
}
export function brandRow(brand, choose) {
  const row = button('', () => choose(brand), 'search-result-item');
  row.dataset.id = brand.id;
  const icon = el('img');
  icon.src = brand.icon;
  icon.loading = 'lazy';
  icon.alt = '';
  icon.width = 40;
  icon.height = 40;
  const text = el('span', undefined, 'result-info');
  text.append(
    el('strong', brandName(brand)),
    el('small', t('category.' + brand.categories[0])),
    badge(brand.claim, t),
  );
  row.append(icon, text);
  return row;
}
export function placeRow(place, choose, position, format, index) {
  const row = button('', () => choose(place), 'search-result-item');
  const icon = el('span', String(index + 1), 'result-number');
  const text = el('span', undefined, 'result-info');
  text.append(
    el('strong', format ? format.name(place.name) : place.name),
    el('span', format ? format.address(place.address) : place.address),
    badge(place.claim, t),
  );
  if (position) text.append(el('small', distanceLabel(position, place)));
  row.dataset.id = place.id;
  row.append(icon, text);
  return row;
}
export function detailContent(record, { brand, format, position, back, find, verify }) {
  const panel = el('div', undefined, 'detail-card');
  if (back) panel.append(button(t('place.back'), back, 'back-link'));
  const claim = record.claim;
  const name = brand ? brandName(record) : format?.name(record.name) || record.name;
  panel.append(el('h2', name), badge(claim, t), el('p', t('place.channelStore')));
  if (!brand && position) panel.append(el('small', distanceLabel(position, record)));
  if (!brand && format && name !== record.name)
    panel.append(el('small', t('place.romanized')), el('p', record.name));
  if (brand && record.names.ko !== name) panel.append(el('p', record.names.ko));
  const entries = claim.evidence.filter(e => e.note || e.observedAt || e.sourceUrl?.startsWith('https://'));
  if (entries.length) {
    const evidence = el('section', undefined, 'evidence');
    evidence.append(el('h3', t('place.evidence')));
    for (const entry of entries) {
      if (entry.note) evidence.append(el('p', entry.note));
      if (entry.sourceUrl?.startsWith('https://')) evidence.append(link(new URL(entry.sourceUrl).hostname, entry.sourceUrl));
      if (entry.observedAt) evidence.append(el('small', formatDate(entry.observedAt)));
    }
    panel.append(evidence);
  }
  if (brand && find) panel.append(button(t('map.area'), () => find(record), 'primary'));
  if (!brand) {
    const status = el('p');
    status.setAttribute('role', 'status');
    function address(value, key) {
      const p = el('p', value);
      p.className = 'address';
      const action = button(t(key), async () => {
        try {
          await navigator.clipboard.writeText(value);
          status.textContent = t('place.copied');
        } catch {
          status.textContent = t('place.copyFailed');
        }
      });
      panel.append(p, action);
    }
    if (record.address) {
      address(record.address, 'place.copyOriginal');
      if (format && format.address(record.address) !== record.address)
        address(format.address(record.address), 'place.copyLocalized');
    } else panel.append(el('p', t('place.noAddress')));
    panel.append(status);
    const actions = el('div', undefined, 'detail-actions');
    const id = encodeURIComponent(record.id);
    if (record.source === 'public') {
      actions.append(link(t('place.directions'), 'https://map.kakao.com/link/to/' + encodeURIComponent(record.name) + ',' + record.lat + ',' + record.lng), link(t('place.details'), 'https://map.kakao.com/link/search/' + encodeURIComponent(record.name + ' ' + record.address)));
      panel.append(el('small', t('merchant.source')));
      if (verify) { const result = el('p'); result.setAttribute('role','status'); const action = button(t('merchant.verify'), async () => { action.disabled=true; result.textContent=t('search.loading'); try { result.textContent=t('merchant.'+await verify(record)); } finally { action.disabled=false; } }); panel.append(action,result); }
    } else actions.append(link(t('place.directions'), 'https://map.kakao.com/link/to/' + id), link(t('place.details'), 'https://place.map.kakao.com/' + id));
    if (/^[+0-9() -]+$/.test(record.phone))
      actions.append(link(t('place.call'), 'tel:' + record.phone.replace(/[^+0-9]/g, '')));
    panel.append(actions, renderCommunityPanel(record));
  }
  const staff = el('a', t('place.showStaff'));
  staff.href = pageLink('guide.html#phrases');
  panel.append(staff);
  return panel;
}

export function markerOverlay(place) {
  const box = el('div', undefined, 'infoWindow');
  box.append(
    el('strong', place.name),
    el('p', place.address || t('place.noAddress'), 'info-address'),
    badge(place.claim, t),
  );
  const actions = el('div', undefined, 'info-actions');
  if (place.source === 'public') actions.append(link(t('place.details'), 'https://map.kakao.com/link/search/' + encodeURIComponent(place.name + ' ' + place.address)), link(t('place.directions'), 'https://map.kakao.com/link/to/' + encodeURIComponent(place.name) + ',' + place.lat + ',' + place.lng));
  else actions.append(link(t('place.details'), 'https://place.map.kakao.com/' + encodeURIComponent(place.id)), link(t('place.directions'), 'https://map.kakao.com/link/to/' + encodeURIComponent(place.id)));
  box.append(actions);
  return box;
}
