import { el } from './dom.js';
import { brandName } from './brand-name.js';
import { t } from '../i18n/registry.js';

export function brandCard(brand) {
  const article = el('article', undefined, 'brand');
  const frame = el('div', undefined, 'brand-logo'),
    logo = el('img');
  Object.assign(logo, { src: brand.icon, alt: '', loading: 'lazy', width: 240, height: 128 });
  frame.append(logo);
  const info = el('div', undefined, 'brand-info');
  info.append(el('span', brandName(brand), 'brand-name'), el('span', t(brand.label), 'brand-category'));
  const details = el('details');
  details.append(
    el('summary', t(brand.claim.status === 'brand_listed' ? 'ecommerce.paymentBadge' : 'status.' + brand.claim.status), 'badge ' + brand.claim.status),
    el('p', t('place.channelOnline')),
  );
  article.append(frame, info, details);
  return article;
}
