# PayKR — v5.0 테스트 보고서

## 1. 환경
- 대상 HEAD: `9436f77ae20fcb07ca2856e6ead4d3294d2a3a63` (`develop`, working tree 수정·미커밋).
- Node.js: v24.21.0 (번들 런타임). OS: Windows.
- 브라우저: Google Chrome (Playwright `chromium.launch`, executablePath=Chrome).
- 테스트 명령: `node scripts/check.mjs` (비브라우저 9종 + 생성 검증),
  `node scripts/check.mjs --browser` (브라우저 3종), `--screenshots` 추가 시 스크린샷.

## 2. 결과 요약
| 테스트 | 결과 |
|---|---|
| scripts/pages.mjs --check (39 로케일 앱 + 브랜드 디렉터리 + 사이트맵) | PASS |
| scripts/pwa-assets.mjs --check (166 오프라인 자산) | PASS |
| tests/map-ui.test.mjs (168 카테고리 소속, 전체 순회 14배치) | PASS |
| tests/directory.test.mjs (37 온라인 자산·엔티티) | PASS |
| tests/cache.test.mjs | PASS |
| tests/ads.test.mjs (미발급 슬롯 ID 억제 포함) | PASS |
| tests/locale.test.mjs (13개 사전 키·플레이스홀더 일치) | PASS |
| tests/project.test.mjs | PASS |
| tests/seo.test.mjs (42 canonical URL, 165 브랜드) | PASS |
| tests/pwa.test.mjs (비브라우저) | PASS |
| tests/reviews.test.mjs (커뮤니티 상태·mock OAuth·삭제) | PASS |
| tests/browser-ui.mjs (지도 SDK mock·전체 순회·리뷰·다국어·반응형) | PASS |
| tests/storage-browser.mjs (IndexedDB·교차탭·비활성 저장소) | PASS |
| tests/pwa.test.mjs --browser (서비스워커 controller 대기) | FAIL(기존) |

## 3. FAIL 상세 및 한계
- `tests/pwa.test.mjs --browser`는 `navigator.serviceWorker.controller !== null` 대기에서 20s 타임아웃.
  **변경 전 baseline에서도 동일하게 실패**하는 기존 이슈(환경·headless Chrome에서의 SW activation
  지연/제약)로, 본 작업이 유발한 회귀가 아니다. 비브라우저 PWA 테스트(매니페스트·PNG·integrity·
  오프라인 내비게이션·업데이트 승인 등)는 PASS.
- 실제 Kakao/Discord/AdSense 환경 검증은 자격 증명이 없어 수행하지 않았다. 검색·리뷰·광고는
  mock/fixture로 검증했고, 운영 활성화는 별도 승인·설정 절차로 분리했다.

## 4. 회귀 수정 내역
- 기존 12개 호출 기대(저수준 배치)는 유지하고, 전체 순회 controller 테스트를 별도 추가.
- 160/163/36 고정 수치를 165/168/37로 갱신하고 신규 브랜드·로고 assertion 추가.
- 광고 미발급 슬롯 ID 억제 회귀 테스트 추가.

## 5. 남은 운영자 설정
- Discord OAuth 앱·봇·전용 채널·Worker secrets(`docs/reviews-operator-guide.md`).
- Kakao REST 프록시 배포(`docs/hybrid-map-deploy.md`).
- AdSense CMP·슬롯 ID·승인 상태(임의 변경 금지).
