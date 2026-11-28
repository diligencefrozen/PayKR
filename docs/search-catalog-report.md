# PayKR — 검색·카탈로그 보고서 (v5.0)

작성일: 2026-11-28 (KST) · 대상 HEAD: `9436f77ae20fcb07ca2856e6ead4d3294d2a3a63` (branch `develop`)

## 1. 전체 검색 누락 — 재현과 해결

### 1.1 재현
`src/services/search.js`의 `SearchService.search()`는 카탈로그를 카테고리별 round-robin으로 정렬한 뒤
`ordered.slice(offset, offset + 12)`로 한 번에 12개 브랜드만 호출했다. `src/controllers/map.js`의
`run()`은 `if (!nearby || !result.more) break;`로 **GPS 주변 검색(nearby)이 아닌 모든 경로**(All,
이 지역 검색, 초기 지도 검색, 개별 카테고리)에서 첫 12개 배치만 실행하고 종료했다. 따라서
"All" 클릭 시 나머지 148개 브랜드가 검색되지 않는 **탐색 범위 누락**이었다.

mock provider 실행으로 확인한 최초 호출 키워드 12개는 GS25, 롯데백화점, 코스트코, 파리바게뜨,
롯데리아, 이케아, 해비치호텔앤드리조트, 올리브영, GS칼텍스, 롯데시네마, 서울랜드, CU였고
`more=true`로 중단되었다.

### 1.2 해결
- `search.js`: `autoScan` 옵션 추가. `paginateBrands = nearby || autoScan`으로 브랜드별
  페이지(최대 3페이지, `hasNextPage` 기준) 탐색을 전체 순회에서도 수행. 결과에
  `progress { total, offset, attempted, succeeded, partial, failed }`와 `failedBrands` 반환.
  페이지 상한 초과는 `limited`, 개별 오류는 `errors`로 구분.
- `map.js`: `run({ autoScan })`을 도입해 All·이 지역 검색·초기 검색·개별 카테고리·GPS 주변 검색이
  **동일한 전체 순회 경로**를 사용. 배치 단위로 `scan.attempted/total` 진행 UI 표시, 실패 브랜드
  추적, `retry-search`에서 **실패 브랜드만 대상 재시도**(backoff + jitter, 성공 결과 유지).
  이 지역 검색 클릭 시 `category='all'; inputTerm=''; brandContext=null; chrome.sync('')`를
  적용해 이전 상태가 남지 않도록 수정.
- 12개 배치·동시 요청 4개·취소/epoch 보호·장소 ID dedupe·지도/목록 누적은 기존 정책 유지.

### 1.3 검증
- `tests/map-ui.test.mjs`에 전체 순회 테스트 추가: `autoScan`으로 14배치(마지막 4개)를 순회,
  고유 장소 165개 누적 확인.
- `tests/browser-ui.mjs`는 기존에 이미 "GPS 허용 후 전 브랜드 page 2 도달"을 검증하고 있으며
  통과(전체 순회 동작 유지).
- 11개 카테고리 커버리지: 168개 카테고리 소속(165개 브랜드) 확인.

## 2. 공식 가맹점 동기화

### 2.1 확인 결과
현대카드 공식 이용처 페이지(`https://www.hyundaicard.com/cpu/ug/CPUUG4001_01.hc?tabindex=1`)는
JS 렌더링 페이지로 정적 fetch에서 이용처 목록 본문을 직접 수집하지 못했다. 공개 검색 색인에서
**이랜드몰(온라인)**, **신세계면세점(오프라인)**을 확인했다. 나머지 후보는 이전 비교에서 확보한
후보이며 **확정(verified) 처리하지 않고 검색 후보(candidate)로만 등록**했다.

| 후보 | 채널 | 카테고리 | 확인 상태 |
|---|---|---|---|
| 신세계면세점 | 오프라인 | 백화점/쇼핑 | 공개 색인 확인 (오프라인 추가, 온라인 online-33 유지) |
| 컴포즈커피 | 오프라인 | 편의점&카페 | 후보 (일부 매장·키오스크 제한 기록) |
| 복호두 | 오프라인 | 제과/디저트 | 후보 |
| 한국철도공사(코레일) | 오프라인 | 레저/여행 | 후보 (역 창구/자동발매기 구분 확인 필요) |
| 아이스토어 | 오프라인 | 생활/가전 | 후보 (store-108 윌리스와의 관계는 별도 확인 필요, 독립 등록) |
| 이랜드몰 | 온라인 | shopping | 공개 색인 확인 |

브랜드 목록은 결제 가능 지점을 확정한 DB가 아니라 **검색 후보**임을 유지한다. 실제 지점 결제
여부는 `src/data/evidence.js`(현재 빈 배열)의 브랜치 근거로만 verified 처리한다.

### 2.2 등록 결과
- 오프라인: `store-161`~`store-165` 추가 → 총 **165개** 브랜드, 168개 카테고리 소속, 11개 카테고리.
- 온라인: `online-37` 추가 → 총 **37개** 항목.
- 기존 ID 유지, 신규 ID는 충돌 없는 값. `names.ko/en`, `aliases`, `categories`, `icon`은 기존 스키마 준수.

## 3. 신규 온라인 브랜드 로고

- 대상: 이랜드몰 (`online-37`)
- 출처: 이랜드몰 공식 사이트 푸터 워드마크
  `https://static.elandrs.com/f/img/pc/cn/common/logo.jpg` (헤더 로고는 인라인 SVG; 푸터 워드마크 PNG 계열 사용)
- 확인: HTTP 200, JPG 디코딩 성공(143×17 RGB), 이랜드몰 도메인 `elandrs.com`(이랜드 공식 CDN) 검증.
- 저장 파일: `logo_online/logo37.png` (240×128 RGBA, 투명 배경, 원본 종횡비 유지·여백 정렬,
  14,726 bytes, 불투명 픽셀 4,423). 기존 `logo36.png`(240×128)와 동일 캔버스 계열.
- 권리: 브랜드 식별 목적의 비상업적 사용. 별도 자산 출처 문서는 본 보고서가 담당한다.
- 검증: `tests/directory.test.mjs`가 신규 아이콘 파일 존재(비어있지 않음)를 검사하고 통과.
  외부 이미지 요청 차단 환경에서는 로컬 상대 경로만 사용하므로 표시됨.

## 4. 호출량과 페이지 상한

- 배치 크기 12, 동시 요청 최대 4, 브랜드별 최대 3페이지(`hasNextPage` 기준).
- 165개 브랜드 → 14배치(마지막 4개). 각 브랜드는 결과가 있는 동안 최대 3페이지까지 조회.
- `limited`는 브랜드 페이지 상한 초과를, `errors`는 요청 실패를 구분해 UI에 표시한다.
- 전체 순회는 정상 완료 또는 취소·쿼터 제한·장애에서만 종료하며, 예산을 이유로 12개에서
  "정상 완료"로 표시하지 않는다.
