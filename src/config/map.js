// Base map tiles + search provider selection.
//
// renderer:
//   'maplibre' (default) — OpenStreetMap tiles via MapLibre GL JS. No Kakao Map object is
//     created, so the Kakao Map Web SDK (tile) quota stays at 0.
//   'kakao'              — Kakao Map SDK map (original, rollback path).
//
// search:
//   'sdk'  (default) — Kakao JS SDK Places keyword search. Keeps the existing Kakao dependency
//     and needs no proxy or REST key; keyword-search quota is unchanged.
//   'rest' — Kakao Local REST via the serverless proxy in workers/kakao-proxy/ (drops the
//     Kakao SDK entirely; set restProxyBase).
export const mapConfig = Object.freeze({
  renderer: 'maplibre',
  search: 'sdk',
  restProxyBase: null,
});
