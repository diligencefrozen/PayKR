import { getLocale } from '../i18n/registry.js';

export function brandName(brand) {
  return brand.names[getLocale()] || (getLocale() !== 'ko' && brand.names.en) || brand.names.ko;
}
