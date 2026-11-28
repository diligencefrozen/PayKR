# PayKR v0.5 — 운영 안정화 및 제한된 재검증

## 설치 순서 (v0.4 안내보다 이 문서 우선)
1. DB 모드는 아직 활성화하지 않는다. 기존 GitHub Actions의 모든 수집 실행/대기가 끝났는지 확인한다. 가능하면 적용 중 잠시 스케줄을 비활성화한다. DB CSV 및 sync state를 백업한다.
2. Supabase SQL Editor에서 001/002가 이미 적용됐는지 확인한다. 002 미적용이면 먼저 적용한다. **202611290003_merchant_quality_access.sql** 전체를 복사해 실행한다. 트랜잭션이 성공하면 기존 행이 보존되며 quality_status/quality_reason/source_change_day 컬럼과 RPC가 추가/변경된다. 이전 공개 테이블 SELECT는 차단되므로 옛 keepalive 실행은 실패할 수 있다. 새 keepalive는 기존 검색 RPC를 사용한다.
3. 누적 패치 내부를 기존 저장소에 덮어쓴 뒤 검토하고 GitHub Desktop으로 커밋/Push한다. src/config/merchants.js와 .env/키는 패치에 포함하지 않는다. SQL이 성공하기 전 새 sync는 초기 상태를 변경하지 않고 실패한다.
4. 수집 워크플로 main에서 `auto`, `max_pages=10`으로 시험한다. 성공 후 `auto / 500` 또는 예약 실행. 멈춘 initial.page에서 개선된 v2 기준으로 이어서 진행한다. `quality_v5_plan.end`는 이 전환 시점까지 v1으로 읽은 지역의 개수이다. 서울 511페이지 상황이면 end=1. 페이지 순서 변화 가능성이 있으므로 이미 일부 읽은 지역은 전체 재검증한다. 초기 수집 완료 뒤 auto가 그 지역들만 다시 조회한다. 기존 v0.4 quality 진행 중이면 그 체크포인트를 보존한다. v0.4 quality 완료 상태였다면 재검증을 생략한다. 이후 delta로 자동 전환한다.
5. `supabase/diagnostics/merchant_quality_v5.sql`로 상태/품질/브랜드 분포를 확인한다. `initial.complete` 및 `quality_v5_plan.replay.complete` 모두 true, delta catch-up 완료, 품질 검토 및 실제 운영 테스트 완료 전 DB 검색 활성화를 보류한다.

## 품질 상태
- legacy: 이전 적재 데이터. accepted: 새 기준 통과. review: 기존 ID가 현재 기준을 통과하지 못함. excluded: 운영자가 개별 확인하여 검색에서 제외. review는 아직 노출되므로 운영 전 점검한다. 오탐 가능성 때문에 자동 삭제/폐업 처리를 하지 않는다. 리뷰 대상 신규 ID는 삽입되지 않는다. 중복은 자동 병합하지 않는다.
- 진단 SQL 하단의 주석 처리된 개별 ID UPDATE 예시로 수동 제외/복구할 수 있다. excluded는 자동 upsert가 되살리지 않는다. 소스에 없는 레코드는 폐업으로 추정하지 않는다. C/U 외의 공식 의미 미확인 변경 코드는 스킵한다.
- delta는 최근 3일을 별도 체크포인트로 재확인한다. 조회 일자보다 오래된 변경 재생이 새 날짜 기록을 덮어쓰지 않게 source_change_day를 기록한다. 같은 날의 순서/공급처 스냅샷 변경까지 보장하지 않는다.

## 공식 업종 코드
공단 제공 가이드 `smallUpjongList` API의 실제 명세를 사용한 후보 사전 생성 도구를 추가했다. 실제 전체 응답과 누락 여부는 미검증이므로 기본 `category-codes.json`은 기존 빈 사전 상태를 유지한다. 현재 진행을 우선할 경우 그대로 두면 된다. 후보를 생성하려면 Node 22에서 환경변수 PUBLIC_DATA_API_KEY를 설정한 상태로 `node scripts/merchants/fetch-category-codes.mjs category-codes-candidate.json` 실행. 결과를 공단 명세와 대조한 후 **새 수집 계획 시작 전에만** 사전으로 채택한다. 최초 계획은 사전/매핑 소스/브랜드 카탈로그 해시를 고정하며 변경 시 sync를 중지한다. 변경하려면 별도 운영 마이그레이션이 필요하다. 카카오 데이터는 영구 저장하지 않는다.

## 접근 보호와 진단
- 검색 RPC는 제한된 반환 열, 최대 101개, offset 최대 10000, 좌표와 검색어/브랜드 배열 검증, 고정 search_path를 사용한다. anon/authenticated의 직접 가맹점 SELECT를 철회한다. 공개 RPC 자체는 계속 공개이며 스크래핑/반복 호출 방지용 서버 rate limit이 아니다. 클라이언트 캐시/기존 sync 420MiB 및 페이지 상한은 유지한다. 실제 무료 Egress 한도를 모니터링하고 필요 시 별도 Edge 보호 계층을 검토한다.
- 개발자 도구 Console에서 `PayKR.cacheStats()` 호출. 현재 세션 L1/L2/source/merged/stale 및 hitRate(캐시 적중/(적중+원본 시도)) 확인. 전역 사용자 통계가 아니며 좌표/검색어 전송 없음. 버전 변경 직후 원본 실패 시 이전 버전의 동일 조건 7일 이내 비어 있지 않은 캐시를 stale로 표시. GPS 영속 저장 제한 유지. 이전 캐시에는 최근 제외/폐업 반영이 안 될 수 있다.
- 쿼리 실행 계획 예시만 제공. 실제 DB 성능/인덱스 변경은 미검증이며 임의 적용하지 않는다. 카테고리 균형 페이지 정책과 L3/서버 rate limit은 후속 과제.

## 테스트
Node 22 `node scripts/check.mjs`: 페이지/PWA 검사 및 13개 테스트 모듈. mock HTTP 기반 수집 테스트, 전환 경계, 마이그레이션 가드, 검토 상태, 공식 코드 파서, 롤링 delta, 캐시 회귀와 이전 버전 장애 대응. 실제 SQL 실행, 실제 공급처 요청, 브라우저 테스트 및 운영 GitHub 배포는 하지 않았다.
