const sdkUrl =
  'https://dapi.kakao.com/v2/maps/sdk.js?appkey=5a3cbf225c0d060b226dc5f1a8662069&libraries=services,clusterer&autoload=false';
let loading;
function loadMaps() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(fail, 10000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Map SDK unavailable'));
    }
    function ready() {
      if (!window.kakao?.maps?.load) return fail();
      window.kakao.maps.load(() => {
        clearTimeout(timer);
        resolve(window.kakao.maps);
      });
    }
    if (window.kakao?.maps?.load) {
      ready();
      return;
    }
    script.src = sdkUrl;
    script.async = true;
    script.onerror = fail;
    script.onload = ready;
    document.head.append(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export class KakaoProvider {
  constructor(overlayView) {
    this.overlayView = overlayView;
  }
  async start(container, center, onExplore, onDeselect) {
    if (this.map) return;
    this.sdk = await loadMaps();
    const sdk = this.sdk;
    this.map = new sdk.Map(container, { center: new sdk.LatLng(center.lat, center.lng), level: 4 });
    this.places = new sdk.services.Places(this.map);
    this.markers = new Map();
    if (sdk.MarkerClusterer)
      this.cluster = new sdk.MarkerClusterer({ map: this.map, averageCenter: true, minLevel: 6 });
    sdk.event.addListener(this.map, 'click', onDeselect);
    sdk.event.addListener(this.map, 'dragstart', onExplore);
    sdk.event.addListener(this.map, 'zoom_start', onExplore);
    this.resize = new ResizeObserver(() => this.map.relayout());
    this.resize.observe(container);
  }
  bounds() {
    const b = this.map.getBounds(),
      sw = b.getSouthWest(),
      ne = b.getNorthEast();
    return [sw.getLat(), sw.getLng(), ne.getLat(), ne.getLng()];
  }
  center(point) {
    this.map.setCenter(new this.sdk.LatLng(point.lat, point.lng));
  }
  locate(point) {
    this.center(point);
    this.position?.setMap(null);
    this.position = new this.sdk.Marker({
      map: this.map,
      position: new this.sdk.LatLng(point.lat, point.lng),
      title: 'GPS',
      image: new this.sdk.MarkerImage('logo/mylocation.png', new this.sdk.Size(50, 45)),
    });
  }
  zoom(delta) {
    this.map.setLevel(Math.max(1, Math.min(14, this.map.getLevel() + delta)));
  }
  search(keyword, bounds, page) {
    const sdk = this.sdk;
    const options = { page, size: 15 };
    if (bounds)
      options.bounds = new sdk.LatLngBounds(
        new sdk.LatLng(bounds[0], bounds[1]),
        new sdk.LatLng(bounds[2], bounds[3]),
      );
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Search timeout')), 9000);
      this.places.keywordSearch(
        keyword,
        (rows, status, pagination) => {
          clearTimeout(timeout);
          if (status === sdk.services.Status.ZERO_RESULT) return resolve({ rows: [], more: false });
          if (status !== sdk.services.Status.OK) return reject(new Error('Search unavailable'));
          resolve({ rows, more: Boolean(pagination?.hasNextPage) });
        },
        options,
      );
    });
  }
  render(places, select) {
    this.cluster?.clear();
    this.overlay?.setMap(null);
    for (const marker of this.markers.values()) marker.setMap(null);
    this.markers.clear();
    for (const place of places) {
      const marker = new this.sdk.Marker({
        position: new this.sdk.LatLng(place.lat, place.lng),
        title: place.name,
        image: new this.sdk.MarkerImage(place.icon || 'logo/marker.png', new this.sdk.Size(24, 35)),
      });
      this.sdk.event.addListener(marker, 'click', () => select(place));
      this.sdk.event.addListener(marker, 'mouseover', () => {
        if (matchMedia('(hover:hover)').matches) this.showOverlay(place);
      });
      this.sdk.event.addListener(marker, 'mouseout', () => this.scheduleHide());
      this.markers.set(place.id, marker);
      if (!this.cluster) marker.setMap(this.map);
    }
    this.cluster?.addMarkers([...this.markers.values()]);
  }
  select(place) {
    this.showOverlay(place);
    this.center(place);
  }
  scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.overlay?.setMap(null), 700);
  }
  showOverlay(place) {
    clearTimeout(this.hideTimer);
    this.overlay?.setMap(null);
    const marker = this.markers.get(place.id);
    if (!marker) return;
    const label = this.overlayView(place);
    label.onmouseenter = () => clearTimeout(this.hideTimer);
    label.onmouseleave = () => this.scheduleHide();
    this.overlay = new this.sdk.CustomOverlay({
      map: this.map,
      position: marker.getPosition(),
      content: label,
      yAnchor: 1.15,
      clickable: true,
    });
  }
  deselect() {
    this.overlay?.setMap(null);
  }
}
