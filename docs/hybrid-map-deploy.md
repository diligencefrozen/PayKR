# PayKR — 하이브리드 지도 전환·롤백 가이드 (v5.0)

## 1. 기본값과 전환
- 운영 기본값: **OSM 타일 + 카카오 SDK Places 검색** (`src/config/map.js`의
  `renderer: 'maplibre'`, `search: 'sdk'`). 지도 타일만 OSM으로 바꾸고 검색·가맹점 위치 데이터는
  기존 카카오 의존을 유지한다. Kakao Map 객체를 만들지 않으므로 지도 Web SDK(타일) 쿼터는 0이다.
- Kakao SDK 지도로 되돌리기(롤백): `renderer: 'kakao'`로 변경.
- 변경 후 `node scripts/pages.mjs && node scripts/pwa-assets.mjs` 재생성.
- URL 파라미터 오버라이드(개발용): `?renderer=kakao`, `?renderer=maplibre`, `?search=rest`.

## 2. 기본 하이브리드 모드 동작
- 지도 배경·확대/축소·이동·마커·현재 위치는 MapLibre GL JS + OpenFreeMap(OSM 벡터 타일) 처리.
- 검색은 `KakaoSearchProvider`(Kakao JS SDK Places)가 담당하며 프록시·REST 키 없이 동작한다.
- `search: 'rest'`로 바꾸면 `KakaoRestSearchProvider`가 담당하며, `restProxyBase`가 비어 있으면
  **검색 비활성**(0행 반환, 실패 아님) — SDK/REST 키 없이도 지도 렌더링만 시연하는 상태다.

## 3. Kakao Local REST 프록시 (하이브리드 검색용)
프록시 Worker 코드는 `workers/kakao-proxy/`에 구현되어 있다. GitHub Pages는 정적 호스팅이므로
REST 키를 HTML/JS/커밋에 노출하지 않고, 이 프록시가 키를 Secret으로 보관한다.

배포:
```sh
cd workers/kakao-proxy
npm install
wrangler secret put KAKAO_REST_KEY   # Kakao REST API 키
wrangler deploy
```

공개 변수(`wrangler.toml` [vars]): `ALLOWED_ORIGINS`, `MAX_DAILY_REQUESTS`.

프록시 동작:
- 고정 Kakao endpoint(`https://dapi.kakao.com/v2/local/search/keyword.json`)만 호출, 임의 URL 금지.
- 입력 검증(`validateQuery`/`parseRect`/`normalizePage`), `rect`=west,south,east,north,
  `page` 1~45, `size` 15 고정.
- REST 키는 `Authorization: KakaoAK {KAKAO_REST_KEY}` 헤더로만 사용.
- CORS 허용 Origin 제한(인증 수단 아님), in-memory 일간 예산(`MAX_DAILY_REQUESTS`),
  429는 `Retry-After` 전달, 401/403/5xx는 안정적 오류 코드로 매핑.
- 응답 `Cache-Control: no-store`, 로그 본문·좌표·검색어 수집 금지.
- 응답을 `{ rows, more }`로 매핑(`meta.is_end` 기준). `src/infrastructure/providers/kakao-rest.js`가
  이 계약을 소비한다.

운영 강화(별도 승인): 지속적인 일/월 쿼터는 KV/D1 기반 카운터, 요청 제한은 Cloudflare
rate-limit binding으로 교체한다.

## 4. 롤백
- `renderer`를 `kakao`로 되돌리고 재생성한다. 기존 Kakao SDK 경로는 그대로 유지된다.
- MapLibre 오류 시 자동으로 Kakao SDK를 반복 호출하지 않는다. 지도 없는 브랜드/온라인/가이드
  목록으로 접근 가능하며, 명시적 전환 또는 운영 설정으로만 복귀한다.

## 5. 운영 전환 게이트
운영 전환은 별도 승인 후. 실제 REST 키·프록시 배포·유료 계정은 승인 없이 활성화하지 않는다.
