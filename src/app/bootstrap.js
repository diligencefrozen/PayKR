import { initLocale, t } from '../i18n/registry.js';
import { shell } from '../views/shell.js';
import { CatalogService } from '../services/catalog.js';
import { CatalogRepository } from '../repositories/catalog.js';
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
let storage;
try {
  storage = new CatalogStore(window.indexedDB, scope);
} catch {
  /* Memory-only mode. */
}
const repository = new CatalogRepository(fetchCatalog, storage);
const catalog = new CatalogService(repository);
repository.notify = invalidations(scope, () => repository.invalidate());
document.getElementById('clear-cache').onclick = async () => {
  const status = document.getElementById('cache-status');
  try {
    await repository.clear();
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
    search: new SearchService(provider, catalog, branchClaims),
    catalog,
    ads,
    report,
  });
} else if (type === 'online') {
  const { directory } = await import('../controllers/directory.js');
  directory(catalog, ads);
} else if (type === 'guide') {
  ads.show(1);
  document
    .querySelector('main')
    .addEventListener('click', () => document.dispatchEvent(new Event('paykr:explored')), { once: true });
}
