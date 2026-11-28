// Kakao Local REST keyword search via a serverless proxy (see docs/hybrid-map-deploy.md).
// GitHub Pages is static, so the REST key never ships to the browser: the proxy holds it.
// With no proxy configured, search is disabled (returns no rows) so the experimental
// MapLibre renderer can still be demonstrated without any Kakao SDK or REST key.
export class KakaoRestSearchProvider {
  constructor(proxyBase = null) {
    this.proxyBase = proxyBase;
  }
  async search(keyword, bounds, page) {
    if (!this.proxyBase) return { rows: [], more: false };
    const params = new URLSearchParams({ query: String(keyword).slice(0, 100), page: String(page), size: '15' });
    if (bounds) params.set('rect', [bounds[1], bounds[0], bounds[3], bounds[2]].join(',')); // west,south,east,north
    const res = await fetch(this.proxyBase + '/api/search?' + params.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Search unavailable');
    const data = await res.json();
    return { rows: Array.isArray(data.rows) ? data.rows : [], more: Boolean(data.more) };
  }
}
