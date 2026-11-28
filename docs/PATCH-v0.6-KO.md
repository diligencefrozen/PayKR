# PayKR v0.6 — 운영 전 읽기 전용 검증

v0.5를 기반으로 한 증분 패치입니다. 새 DB 마이그레이션, 비밀 키, 유료 인프라, 수집 체크포인트 수정, 검색 모드 활성화가 필요하지 않습니다. 기존 v0.5 SQL(001~003)이 적용되어 있어야 합니다.

## 적용 및 검증
1. 패치 폴더 내부를 PayKR 기존 저장소에 덮어쓰고 GitHub Desktop에서 변경 사항을 확인한 뒤 커밋/Push합니다. 수집 실행은 기존대로 계속해도 됩니다.
2. GitHub Actions에서 `PayKR merchant preflight (read only)`를 수동 실행합니다. `require_ready=false`로 시작하면 초기 수집 미완료 상태도 오류 없이 진단할 수 있습니다. RPC/권한 자체의 이상은 실패로 처리합니다. 서비스 키는 기존 Actions secret에서만 읽으며 로그에 출력하지 않습니다. 공공데이터 API를 호출하지 않습니다.
3. 출력의 `schema=5`, `publicRpc=true`, `directSelectDenied=true`, `invalidBoundsRejected=true`를 확인합니다. `initialComplete`, `qualityComplete`, `deltaCaughtUp`가 모두 true이고 데이터가 있고 DB 안전 용량 미만이면 `technicalGate=true`입니다. `deltaCaughtUp`는 한국 시간 당일 페이지 1 기준으로 보수적으로 판단합니다. `false`이면 새 모드를 활성화하지 않습니다.
4. SQL Editor에서 `supabase/diagnostics/merchant_preflight_v6.sql` 전체를 선택적으로 실행합니다. 조회 및 EXPLAIN ANALYZE만 실행하며 실제 가맹점 행을 수정하지 않습니다. anon/authenticated 직접 SELECT는 false, anon RPC 실행은 true를 기대합니다. 실제 공간 검색 실행 계획과 브랜드/품질/지역 분포를 검토합니다.
5. 전국 수집 및 targeted quality replay, delta catch-up, 품질 검토가 완료되면 require_ready=true로 다시 실행합니다. 사용자 기기에서 GPS 승인/거부, 전체 카테고리, 검색, 재접속, 네트워크 오류, 13개 언어, PWA를 검증합니다. 실제 Egress는 Supabase dashboard에서 확인합니다. 정식 전환은 별도 승인 후 기존 configure 명령으로 진행합니다.

## 검증 범위 및 제한
- Node 22 `node scripts/check.mjs`: 기존 13개 모듈 + preflight 테스트, 페이지/PWA 검사 모두 통과. 새 테스트는 모의 HTTP로 검사하며 실제 운영 DB의 권한을 대신 증명하지 않습니다.
- 기존 browser-ui.mjs에는 GPS 이전 원주 검색 및 전체 선택 시 원주 이동을 기대하는 오래된 단언이 남아 있어 새 동작에 맞춰 수정했습니다. 전체 브라우저 UI 테스트는 미완료입니다.
- 선택적 `python tests/merchant-browser.py`: Python Playwright와 Chromium이 설치된 개발 환경에서 실행하는 GPS/전체 및 실제 IndexedDB 회귀 테스트입니다. 이 작업 환경은 Chromium 정책으로 로컬 주소 접속이 차단되어 실행이 중단되었습니다. 테스트 통과로 간주하지 않습니다. 기존 Node Playwright 설치 환경은 `node scripts/check.mjs --browser`도 실행할 수 있습니다. Python 도구는 웹 배포에 필요하지 않습니다.
- 운영 DB SQL 실행, 실제 API 연결, 실제 Egress 및 지도 SDK/기기 검증은 이 패치 작성 중 수행하지 않았습니다. 공개 RPC 자체에 서버 rate limit이 있는 것은 아닙니다. 폐업/브랜드 정확도/리뷰 대상 처리 및 결제 정책 확인은 별도입니다.
