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
import { ReviewsService } from '../services/reviews.js';
import { reviewsConfig } from '../config/reviews.js';
import { initAuth } from '../views/auth.js';
import { mapConfig } from '../config/map.js';

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
const reviews = new ReviewsService(reviewsConfig);
const auth = initAuth(reviews);
if (type === 'map') {
  const [{ mapController }, { KakaoMapRenderer, KakaoSearchProvider }, { SearchService }] = await Promise.all([
    import('../controllers/map.js'),
    import('../infrastructure/providers/kakao.js'),
    import('../services/search.js'),
  ]);
  const { markerOverlay } = await import('../views/places.js');
  const params = new URLSearchParams(location.search);
  const renderer = params.get('renderer') || mapConfig.renderer;
  const useMapLibre = renderer === 'maplibre' || params.get('maplibre') === '1';
  const searchMode = params.get('search') || mapConfig.search;
  const useMock = params.get('mock') === '1';
  let provider, searchProvider;
  if (useMapLibre) {
    const { MapLibreMapRenderer } = await import('../infrastructure/providers/maplibre.js');
    provider = new MapLibreMapRenderer(markerOverlay);
    if (useMock) {
      const { MockKakaoSearchProvider } = await import('../infrastructure/providers/mock-kakao.js');
      searchProvider = new MockKakaoSearchProvider();
    } else if (searchMode === 'rest') {
      const { KakaoRestSearchProvider } = await import('../infrastructure/providers/kakao-rest.js');
      searchProvider = new KakaoRestSearchProvider(mapConfig.restProxyBase);
    } else {
      // Keep the Kakao search dependency; only the base map tiles are replaced by OSM.
      searchProvider = new KakaoSearchProvider();
    }
  } else {
    provider = new KakaoMapRenderer(markerOverlay);
    if (useMock) {
      const { MockKakaoSearchProvider } = await import('../infrastructure/providers/mock-kakao.js');
      searchProvider = new MockKakaoSearchProvider();
    } else {
      searchProvider = new KakaoSearchProvider();
    }
  }
  window.PayKR = mapController({
    provider,
    search: new SearchService(searchProvider, catalog, branchClaims),
    catalog,
    ads,
    report,
    reviews,
    auth,
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
