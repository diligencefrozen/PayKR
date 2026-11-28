# PayKR — 하이브리드 지도 설계 (MapLibre + OSM, 실험 모드)

## 1. 목표 아키텍처
```
PayKR UI / Map Controller (src/controllers/map.js)
  ├─ MapRenderer            start, bounds, resetView, center, locate, zoom, render,
  │                         addMarkers, select, deselect, destroy
  │   ├─ KakaoMapRenderer    (기본, 운영·롤백용)
  │   └─ MapLibreMapRenderer (신규, 실험 모드)
  ├─ SearchService           (요청 예산·취소·병합·결과 정규화)
  │   └─ PlaceSearchProvider search(keyword, bounds, page) -> { rows, more }
  │       ├─ KakaoSearchProvider     (기존 SDK Places)
  │       └─ KakaoRestSearchProvider (Kakao Local REST → 서버리스 프록시)
  ├─ OwnedCatalog            (자체 브랜드·독립 지점 근거)
  └─ Browser Geolocation     (현재 위치)
```

## 2. 계약
- Renderer: `start(container, center, onExplore, onDeselect)`, `bounds()`,
  `resetView(point)`, `center(point)`, `locate(point)`, `zoom(delta)`,
  `render(places, select)`, `addMarkers(places, select)`, `select(place)`,
  `deselect()`, `destroy()`.
- SearchProvider: `search(keyword, bounds, page) -> { rows, more }`.
- 좌표: `bounds = [southLat, westLng, northLat, eastLng]`. Kakao REST rect는
  `westLng,southLat,eastLng,northLat`, MapLibre는 `[lng, lat]`.
- zoom 부호: Kakao `level`은 커질수록 축소, MapLibre `zoom`은 커질수록 확대 → `zoomBy(-delta)` 매핑.

## 3. 구현 결과
- `src/infrastructure/providers/kakao.js`를 `KakaoMapRenderer` + `KakaoSearchProvider`로 분리.
- `src/infrastructure/providers/maplibre.js`(MapLibre GL JS 4.7.1 고정 + OpenFreeMap `liberty` 스타일)
  신규. WebGL 미지원·로드 실패 시 기존 방식대로 지도 없는 브랜드/온라인/가이드 목록으로 접근 가능.
- `src/infrastructure/providers/kakao-rest.js`: REST 프록시 검색(프록시 미설정 시 검색 비활성, 0행 반환).
- `src/config/map.js`: `renderer: 'maplibre' | 'kakao'`(기본 **maplibre**), `search: 'sdk' | 'rest'`
  (기본 **sdk**), `restProxyBase`.
- 기본 모드(maplibre + sdk)에서는 **지도 타일만 OSM으로 대체**하고 검색은 기존 Kakao SDK
  Places를 그대로 사용한다. Kakao Map 객체를 만들지 않으므로 **지도 Web SDK(타일) 쿼터는 0**,
  키워드 검색 쿼터는 기존과 동일하다.
- Attribution은 항상 표시.

## 4. 타일·폰트·라이선스
- OpenFreeMap(OSM 벡터 타일, `https://tiles.openfreemap.org/styles/liberty`) 사용.
- OSM 데이터 ODbL 및 타일·스타일·폰트 제공자 조건 준수. 대량 프리페치·오프라인 다운로드 미구현.
- 한국 도로·건물·POI·한글/다국어 라벨 품질은 후속 실험에서 비교(운영 전 별도 검증).

## 5. 검색 공급자
- 기본: Kakao JS SDK Places(기존 의존 유지, 프록시·REST 키 불필요).
- 선택: `search: 'rest'` + `restProxyBase` 지정 시 `KakaoRestSearchProvider`(REST 프록시)로
  전환하여 Kakao SDK 자체를 내려놓는다. REST 키는 프록시에만 존재(브라우저·커밋에 노출 금지).
  프록시는 `workers/kakao-proxy/`에 구현되어 있으며 입력 검증, bounds/page 제한, 일간 예산,
  CORS 허용 Origin, 응답 `Cache-Control: no-store`, 로그 본문 수집 금지를 수행한다
  (`docs/hybrid-map-deploy.md` 참조).

## 6. 전환·롤백
기본값은 OSM 타일(maplibre) + 카카오 SDK Places 검색(sdk). Kakao SDK 지도로 되돌리려면
`src/config/map.js`의 `renderer`를 `kakao`로 바꾼다. 상세는 `docs/hybrid-map-deploy.md` 참조.
