# PayKR v0.3 — 공간 캐시, 데이터 버전, 초기 수집 자동 재개

## 적용 순서

1. 현재 실행 중인 `PayKR merchant sync` 작업이 종료된 후 아래 SQL을 실행하는 것을 권장합니다. 기존 데이터·체크포인트는 삭제하지 않습니다. 트리거 설치는 짧은 DDL 잠금이 필요합니다.
2. Supabase PayKR SQL Editor에서 `supabase/migrations/202611290002_merchant_cache_version.sql` 전체를 실행합니다. 이전 `202611290001_merchants.sql`을 이미 실행했다면 다시 실행할 필요가 없습니다.
3. `select public.paykr_merchant_version();` 결과가 숫자 문자열인지 확인합니다. 처음에는 보통 `1`이며 기존 버전이 존재하면 유지합니다.
4. GitHub Desktop에서 작업 브랜치를 만들고 이 패치 내부의 파일/폴더를 저장소 루트에 덮어씁니다. .git 및 기존 환경변수는 보존합니다. v0.2.2 변경 파일도 포함한 누적 패치입니다. 다른 수정사항이 있다면 Changes에서 충돌을 확인하세요.
5. 프로젝트에서 `node scripts/pwa-assets.mjs`와 `node scripts/check.mjs`를 실행합니다. 특히 DB 검색 설정을 이미 변경했다면 PWA 해시를 다시 생성해야 합니다.
6. 커밋/Push 및 main 병합. 기존 Secrets/Variables 그대로 사용. 실행 중인 워크플로의 코드와 체크포인트는 건드리지 않습니다.
7. 초기 수집 완료 및 delta 확인 전 `src/config/merchants.js`를 활성화하지 않습니다. 이 패치에는 설정 파일이 포함되지 않습니다.

## 검색 캐시

- L1 메모리와 L2 IndexedDB, 중복 요청 병합, 일반 결과 24시간/빈 결과 10분, 장애 시 비어 있지 않은 캐시 최대 7일 정책 유지.
- 가로·세로 0.005도 격자(한국에서 대략 450×550m)를 사용. 지도 화면이 최대 4개 격자에 걸치는 작은 영역일 때만 적용.
- 격자의 전체 카테고리 데이터를 읽고 실제 화면 범위 및 선택 브랜드로 필터링한 뒤 ID 중복을 제거하고 화면 중심 거리 기준으로 정렬.
- 하나의 격자가 61행 이상이면 데이터 누락 방지를 위해 기존 정확한 지도 범위·페이지 기반 RPC로 전환. 넓은 화면, 문자 검색 및 단일 브랜드 명시 검색도 기존 조회 방식 사용.
- 밀집 지역 첫 조회에 추가 격자 요청이 발생할 수 있음. 실제 Egress 절감은 실측 필요. L3 공유 CDN 캐시는 아직 도입하지 않음.
- GPS에서 유래한 화면 및 직접 입력 검색어는 영속 캐시로 저장하지 않음. GPS 화면 플래그는 기존처럼 보수적으로 유지. 일반 지도 화면 전체 검색의 자동 순회 여부는 영속 캐시 제한과 분리함.
- 초기 GPS 및 원주 fallback, 전체 선택 시 지도 위치 유지, 기존 카카오 모드의 165브랜드 순회, DB 모드 600개 자동 로딩 및 더 보기 유지.

## 데이터 버전

- 새로운 테이블 대신 기존 비공개 `paykr_sync_state`의 `merchant_cache_version` 한 행 사용.
- 가맹점 INSERT/UPDATE/DELETE 문장이 실제 행을 처리하면 버전 증가. 기존 upsert의 동일 데이터 no-op은 버전 증가 없음. 수집 체크포인트 수정만으로는 버전이 바뀌지 않음. 직접 동일값 UPDATE는 안전하게 무효화될 수 있음.
- 공개 읽기 RPC `paykr_merchant_version()`은 버전 숫자만 반환. 동기화 테이블 자체를 공개하지 않음.
- 검색 시 최대 5분 간격으로 버전 확인. 버전이 바뀌면 이전 L1/L2 키를 사용하지 않음. 이전 항목은 기존 TTL/개수 제한에 따라 자연 정리됨. 별도의 지역별 버전이나 즉시 push 무효화는 도입하지 않음.
- 버전 요청 실패/마이그레이션 미설치 시 마지막 정상 버전 또는 legacy 키로 TTL 캐싱 유지. 공개 버전만 localStorage에 저장하고 GPS/검색어는 저장하지 않음. 이미 새 버전을 알게 된 뒤에는 구버전 데이터로 자동 회귀하지 않음.

## 초기 수집 자동화

- 기존 `initial`, `delta` 수동 실행 유지; `auto` 선택 추가(기본값).
- 03:17 KST: 초기 수집 미완료면 initial 재개, 완료면 delta 실행.
- 09:17 / 15:17 / 21:17 KST: 초기 수집 미완료 시에만 재개, 완료 시 조회 후 종료.
- 기존 페이지 체크포인트, 500페이지 기본값, 60분 실행 제한, 420MiB 보호 기준 및 concurrency 그룹 유지.
- 예약 실행은 GitHub 정책에 따라 지연/비활성화될 수 있으며 모든 무료 한도 준수를 보장하지 않음. 실제 실행 로그와 DB 사용량 확인.
- 12시간 휴면 방지 workflow는 변경하지 않음.

## 확인 및 남은 작업

`node scripts/check.mjs`의 12개 테스트 묶음 및 페이지/PWA 검사를 로컬에서 통과. Supabase 버전 RPC, 실제 PostgreSQL 트리거, IndexedDB 실브라우저, 예약 실행은 이 패치 제작 환경에서 미검증. 추가 SQL 검증은 아래 참조. 브랜드 매핑 기준, 삭제 코드 및 폐업 자동화, L3 공유 캐시, 운영 Egress 측정은 보류. 진행 중인 전국 수집에 서로 다른 매핑 기준을 섞지 않음.

```sql
select public.paykr_merchant_version() as cache_version;
select id, value from public.paykr_sync_state where id in ('initial','delta');
select count(*) from public.paykr_merchants;
```

롤백은 GitHub Desktop에서 v0.3 커밋을 revert하는 방법을 권장합니다. SQL 추가 변경은 기존 버전 코드와 호환되므로 남겨도 됩니다. 트리거까지 제거하려면 별도 SQL에서 paykr_version_insert/update/delete 트리거만 제거(가맹점 및 체크포인트 삭제 금지)하세요.
