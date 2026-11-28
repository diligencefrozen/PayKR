# PayKR — 광고 슬롯 미리보기·최적화 보고서 (v5.0)

## 1. CSS 숨김 충돌 — 원인과 해결
- `shared.css`의 `[hidden], .ad-space { display: none !important; }`가 모든 광고 슬롯을 기본 숨김 처리.
- `extensions.css`의 `[data-slot]:not([hidden]) { display: block !important; }`가 활성 슬롯을 재표시.
  `:not([hidden])` 선택자가 `.ad-space`보다 구체적이어서 `!important` 충돌이 해소된다.
- 이미 해결된 상태이므로 CSS는 변경하지 않고 `tests/ads.test.mjs`에 회귀(미발급 슬롯 ID 억제)를 추가했다.

## 2. 슬롯과 정책 (PC/태블릿/모바일)
| 슬롯 | 위치 | 노출 조건 |
|---|---|---|
| `map` | 지도 사이드바(#sidebar-ad) | 데스크톱, 결과 ≥3 |
| `map-mobile` | 모바일 시트(#place-ad) | 모바일, 결과 ≥3 |
| `directory-top/middle/bottom` | 온라인 디렉터리 | top>0, middle≥12, bottom≥8 |
| `guide` | 여행 가이드 | count>0 |

- 온라인 이커머스·여행 가이드를 우선 수익화 페이지로 지정.
- 지도 조작·장소 상세·제보 작성·리뷰 등록·링크 인접 배치 금지. 광고는 콘텐츠와 시각적으로 구분한다.

## 3. 송출 게이트 (실제 광고 요청 0 조건)
`src/infrastructure/ads/service.js`는 다음 조건이 모두 충족될 때만 실제 AdSense 요청을 보낸다.
- CMP 동의 `allowed === true` (미설정·거부·미확인은 false)
- 온라인 상태, 비민감 페이지(#privacy/offline 제외)
- `adpreview=1` 아님
- 슬롯 ID가 숫자(`/^\d+$/`)

현재 `src/config/advertising.js`는 `slots`가 모두 `null`, `subscribeConsent`는 항상 `false`,
`recoveryEnabled:false`이므로 **실제 광고 송출·요청은 발생하지 않는다.** 게시자 ID·ads.txt·사이트
인증·심사 설정은 변경하지 않는다.

## 4. CLS·중복 방지
- 활성 슬롯은 적정 높이(min-height 90px) 예약, 비활성/빈 응답은 `hidden`으로 빈 공간 제거.
- `WeakSet`으로 슬롯별 1회 마운트, 스크립트 1회 로드, 중복 `push` 방지.
- 광고 차단·네트워크 장애 시 서비스 기능은 정상(슬롯만 숨김).

## 5. 미리보기
`?adpreview=1`은 시각적 플레이스홀더만 렌더링(실제 요청·노출·클릭 없음). 온라인·가이드·지도
PC/태블릿/모바일 스크린샷은 `artifacts/screenshots/` 참조.

## 6. 실험·측정 방법(기본 off)
슬롯별 실험은 기본 off. 활성화 시 Active View 가시성, 페이지 RPM, 이탈·Core Web Vitals를
공식 보고서 집계로 비교한다. 클릭 유도·CTR 조작 금지, 광고 클릭 자체를 직접 추적하지 않는다.
실제 광고 계정 지표가 없으므로 수익 개선을 확정하지 않는다.
