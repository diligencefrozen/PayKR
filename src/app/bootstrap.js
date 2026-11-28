import { merchants } from '../config/merchants.js';
import { MerchantSearch } from '../services/merchant-search.js';
import { initLocale, t } from '../i18n/registry.js';
import { shell } from '../views/shell.js';
import { CatalogService } from '../services/catalog.js';
import { CatalogRepository } from '../repositories/catalog.js';
import { MerchantCache } from '../infrastructure/cache/merchant-cache.js';
import { MerchantStore } from '../infrastructure/cache/merchant-store.js';
import { CatalogStore, invalidations } from '../infrastructure/cache/catalog-store.js';
import { fetchCatalog } from '../infrastructure/providers/owned.js';
import { AdService } from '../infrastructure/ads/service.js';
import { advertising } from '../config/advertising.js';
import { initPwa } from '../infrastructure/pwa/install.js';
import { branchClaims } from '../data/evidence.js';
import { feedback } from '../controllers/feedback.js';

const type = document.body.dataset.pageType;
shell(type);
document.dispatchEvent(new Event('paykr:shell'));
await initLocale();
const scope = new URL('../../', import.meta.url).pathname;
let storage, merchantStorage;
try {
  storage = new CatalogStore(window.indexedDB, scope);
  merchantStorage = new MerchantStore(window.indexedDB, scope);
} catch {
  /* Memory-only mode. */
}
const repository = new CatalogRepository(fetchCatalog, storage);
const catalog = new CatalogService(repository);
const merchantCache = new MerchantCache(merchantStorage);
repository.notify = invalidations(scope, () => { repository.invalidate(); merchantCache.invalidate(); });
document.getElementById('clear-cache').onclick = async () => {
  const status = document.getElementById('cache-status');
  try {
    const results = await Promise.allSettled([merchantCache.clear()]);
    await repository.clear();
    if (results[0].status === 'rejected') throw results[0].reason;
    status.textContent = t('common.cleared');
  } catch {
    status.textContent = t('common.cacheFailed');
  }
};
const report = feedback();
const ads = new AdService(advertising);
ads.start(t);
initPwa(t);
if (type === 'map') {
  const [{ mapController }, { KakaoProvider }, { SearchService }] = await Promise.all([
    import('../controllers/map.js'),
    import('../infrastructure/providers/kakao.js'),
    import('../services/search.js'),
  ]);
  const { markerOverlay } = await import('../views/places.js');
  const provider = new KakaoProvider(markerOverlay);
  window.PayKR = mapController({
    provider,
    search: merchants.enabled ? new MerchantSearch(merchants, catalog, provider, branchClaims, fetch, merchantCache) : new SearchService(provider, catalog, branchClaims),
    catalog,
    ads,
    report,
  });
  // Explicit console-only diagnostic; no telemetry, no coordinates or search terms.
  Object.defineProperty(window.PayKR,'cacheStats',{value:()=>merchantCache.snapshot(),enumerable:false});
} else if (type === 'online') {
  const { directory } = await import('../controllers/directory.js');
  directory(catalog, ads);
} else if (type === 'guide') {
  ads.show(1);
  document
    .querySelector('main')
    .addEventListener('click', () => document.dispatchEvent(new Event('paykr:explored')), { once: true });
}
