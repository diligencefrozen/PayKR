// Experimental MapLibre GL JS + OpenFreeMap (OSM vector tiles) renderer.
// Default remains KakaoMapRenderer; enable via src/config/map.js (renderer: 'maplibre').
// In this mode the Kakao Maps SDK is never loaded (0 SDK requests); place search is served
// by KakaoRestSearchProvider (a serverless proxy) and is disabled until a proxy is deployed.
const LIBS = {
  css: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  js: 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
};
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

let loading;
export function loadMapLibre() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LIBS.css;
    document.head.append(css);
    const script = document.createElement('script');
    const timer = setTimeout(fail, 10000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error('MapLibre unavailable'));
    }
    script.src = LIBS.js;
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (window.maplibregl) resolve(window.maplibregl);
      else fail();
    };
    document.head.append(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export class MapLibreMapRenderer {
  constructor(overlayView) {
    this.overlayView = overlayView;
  }
  async start(container, center, onExplore, onDeselect) {
    if (this.map) return;
    this.maplibregl = await loadMapLibre();
    this.map = new this.maplibregl.Map({
      container,
      center: [center.lng, center.lat],
      zoom: 15,
      style: STYLE,
      attributionControl: { compact: true },
    });
    this.map.addControl(new this.maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    this.markers = new Map();
    this.onDeselect = onDeselect;
    this.map.on('click', () => onDeselect());
    this.map.on('dragstart', onExplore);
    this.map.on('zoomstart', onExplore);
    this.resize = new ResizeObserver(() => this.map.resize());
    this.resize.observe(container);
    if (!this.map.loaded()) await new Promise((resolve) => this.map.once('load', resolve));
  }
  bounds() {
    const b = this.map.getBounds();
    return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
  }
  resetView(point) {
    this.center(point);
  }
  center(point) {
    this.map.setCenter([point.lng, point.lat]);
  }
  locate(point) {
    this.center(point);
    this.position?.remove();
    const el = document.createElement('img');
    el.src = 'logo/mylocation.png';
    el.alt = '';
    el.width = 50;
    el.height = 45;
    this.position = new this.maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([point.lng, point.lat])
      .addTo(this.map);
  }
  zoom(delta) {
    this.map.zoomBy(-delta);
  }
  render(places, select) {
    this.popup?.remove();
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
    this.addMarkers(places, select);
  }
  addMarkers(places, select) {
    for (const place of places) {
      const el = document.createElement('img');
      el.src = place.icon || 'logo/marker.png';
      el.alt = '';
      el.width = 24;
      el.height = 35;
      const marker = new this.maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(this.map);
      marker.getElement().addEventListener('click', () => select(place));
      if (matchMedia('(hover:hover)').matches) {
        marker.getElement().addEventListener('mouseenter', () => this.showOverlay(place));
        marker.getElement().addEventListener('mouseleave', () => this.scheduleHide());
      }
      this.markers.set(place.id, marker);
    }
  }
  select(place) {
    this.showOverlay(place);
    this.center(place);
  }
  scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.popup?.remove(), 700);
  }
  showOverlay(place) {
    clearTimeout(this.hideTimer);
    this.popup?.remove();
    const marker = this.markers.get(place.id);
    if (!marker) return;
    const content = this.overlayView(place);
    this.popup = new this.maplibregl.Popup({ offset: 26, closeButton: false, closeOnClick: false })
      .setLngLat([place.lng, place.lat])
      .setDOMContent(content)
      .addTo(this.map);
  }
  deselect() {
    this.popup?.remove();
  }
  destroy() {
    this.resize?.disconnect();
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
    this.map?.remove();
  }
}
