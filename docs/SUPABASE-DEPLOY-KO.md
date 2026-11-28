# PayKR DB-first 개편: 설치·운영 가이드 (v0.1)

## 현재 상태

이 패키지는 제공된 PayKR-main.zip을 기준으로 재구성한 소스코드입니다. develop의 MapLibre/OSM, 하이브리드 지도, REST 프록시, 신규 Discord 리뷰 DB 실험은 가져오지 않았습니다. 기존 Discord 채팅과 main의 UI, 카카오 SDK, 다국어, 광고, PWA는 유지했습니다. develop의 가맹점 브랜드 5개(신세계면세점, 컴포즈커피, 복호두, 코레일, 아이스토어), 온라인 이랜드몰 1개 및 로고만 추가로 보존했습니다. 기존 브랜드 지원 목록은 결제 가능성의 후보이며 지점별 결제 확인이 아닙니다.

Git 이력 없는 ZIP만 제공되었으므로 실제 커밋 80% 삭제·되돌리기는 수행하지 않았습니다. DB 검색 코드는 구현했지만 설정 파일은 `enabled:false`로 출고합니다. 실제 DB 초기화 및 전국 데이터를 적재하기 전에 운영 사이트의 검색을 중단시키지 않기 위해서입니다. 활성화하면 일반 검색에서 카카오 Places API를 호출하지 않으며, 데이터 오류 시 기존 브랜드별 대량 검색으로 자동 회귀하지 않습니다.

## 1. Supabase DB 초기화

1. Supabase에서 PayKR 프로젝트 (`ygalarpikucdnpmadqto`)를 선택합니다. ForumliteKR의 다른 프로젝트와 혼동하지 마세요.
2. SQL Editor에 `supabase/migrations/202611290001_merchants.sql` 전체를 복사해 한 번 실행합니다. PostGIS를 `extensions` 스키마에 설치하는 새 프로젝트를 가정합니다. 이미 다른 스키마에 PostGIS가 있다면 먼저 스키마를 확인하고 SQL을 조정합니다. 실행 오류를 무시하지 마세요.
3. 아래 SQL로 초기 상태 및 권한을 확인합니다.

```sql
select count(*) from public.paykr_merchants;
select id, value from public.paykr_sync_state;
select pg_size_pretty(pg_database_size(current_database()));
select has_table_privilege('anon','public.paykr_merchants','INSERT') as anon_can_insert,
       has_table_privilege('anon','public.paykr_merchants','UPDATE') as anon_can_update,
       has_table_privilege('anon','public.paykr_merchants','DELETE') as anon_can_delete;
```

마지막 세 값은 false여야 합니다. SQL 마이그레이션은 실제 DB에서 아직 실행·검증되지 않았습니다. 가맹점의 공개 읽기, RLS, 공간 검색 RPC, 서버 전용 upsert, 동기화 체크포인트를 구성합니다. 공개 데이터를 누구나 읽을 수 있으므로 악의적 대량 조회에 의한 전송량 위험은 남습니다. 공개 쿼리 제한을 위한 추가 백엔드는 이번 단계에서 만들지 않았습니다.

## 2. GitHub 설정 (무료 public repo 기준)

기존 GitHub 저장소의 `Settings > Secrets and variables > Actions`에서 아래를 설정합니다. Supabase GitHub 연동 기능을 별도로 설치할 필요는 없습니다. 해당 워크플로는 기본 브랜치에 존재해야 예약 실행됩니다.

| 종류 | 이름 | 값 |
|---|---|---|
| Variables | SUPABASE_URL | https://ygalarpikucdnpmadqto.supabase.co |
| Variables | SUPABASE_PUBLISHABLE_KEY | Supabase의 공개 sb_publishable_ 키 |
| Secrets | SUPABASE_SERVICE_ROLE_KEY | 서버 전용 sb_secret_ 또는 기존 service_role JWT |
| Secrets | PUBLIC_DATA_API_KEY | 공공데이터 운영계정 일반 인증키 (인코딩/디코딩 모두 처리) |

서버 전용 키를 프론트엔드, README, Git 커밋, 채팅에 넣지 않습니다. 이미 공유된 공공데이터 키는 재발급/교체 가능 여부를 확인하세요. 브라우저 공개 키는 RLS가 적용된 공개 읽기에만 사용합니다. 유료 플랜이나 추가 유료 서비스를 활성화하지 않습니다.

## 3. 전국 초기 수집 및 변경사항 갱신

Actions에서 `PayKR merchant sync` > Run workflow > `initial` 선택. `max_pages` 기본 500입니다. 17개 시도 코드를 순회하면서 `/storeListInDong?divId=ctprvnCd&key=시도코드`로 가져옵니다. 페이지당 최대 1000행(가이드 기준), 실제 업종 및 브랜드 이름을 대조하여 일치 후보만 DB에 적재합니다. 모든 업소의 원본 데이터는 저장하지 않습니다.

실행 로그에서 `Initial scan complete`가 나오기 전까지 `initial`을 반복 실행합니다. 작업이 도중 종료되면 다음 수집이 이전 체크포인트에서 재개됩니다. 이후 `delta`를 수동 실행해 초기 수집 시작일부터 전날까지 변경 사항을 보완합니다. DB 사용량 420 MiB 초과 시 작업이 중단되도록 했으며, 50페이지마다 체크합니다. 이는 대략적인 안전 기준일 뿐 500MB 무료 한도 준수를 보증하지 않습니다.

자동 작업:
- `merchant-sync.yml`: 매일 03:17 KST, 신규·수정 업소 데이터 조회. 기본 수집이 미완료면 delta는 실행하지 않습니다.
- `supabase-keepalive.yml`: 매일 09:23 / 21:23 KST, 기존 가맹점 테이블에서 최대 1행 SELECT. 별도 keepalive 테이블 없음.
- GitHub Actions의 public 저장소 60일 비활성 정책, 예약 지연/누락 및 Supabase 휴면 정책을 고려하면 중단 방지는 보장되지 않습니다. 수동 실행 및 로그 확인이 필요합니다. 무료 요금제·실제 Actions 사용량 확인 필수.

**삭제 처리 제한:** 포털은 삭제된 업소를 포함한다고 설명하나 첨부 HWP(260805) 응답 명세의 `chgGb`는 C(생성)·U(수정)만 명시합니다. 실제 삭제 구분 및 `key`의 정확한 기간 의미는 운영 API 응답과 제공기관으로 확인해야 합니다. 현재 코드는 다른 구분(예: D)을 기록 집계하고 건너뛰며, 불완전한 결과나 브랜드/업종 불일치만으로 삭제하지 않습니다. 따라서 자동 폐업 비활성화는 아직 구현 완료가 아닙니다. 확인한 업소는 운영자가 SQL에서 `update public.paykr_merchants set active=false where id='확인한_업소번호';`로 처리할 수 있습니다. 재수집 시 같은 업소가 유효 후보로 다시 나타나면 활성화됩니다. 월별 전체 대조 및 장기 삭제 검증은 차기 개선 사항입니다.

## 4. 공개 DB 검색 전환

전국 초기 적재 완료 및 delta 보완 후, 우선 SQL로 브랜드별 적재 수를 점검합니다. 카탈로그 165개 전부가 공공 상가정보에 존재한다는 보장은 없습니다. 업종명과 브랜드 이름 대조가 보수적이므로 누락/오탐 검토 후 `src/models/merchant-match.js`를 수정할 수 있습니다.

```sql
select brand_id, count(*) from public.paykr_merchants where active group by brand_id order by count(*) desc;
select * from public.paykr_search_merchants(37.45,126.85,37.65,127.15,null,'',0,10);
```

로컬에 Node.js 22를 준비합니다. `.env.example`을 `.env`로 복사하고 URL과 공개 키를 설정한 뒤 실행합니다.

```sh
node --env-file=.env scripts/merchants/configure.mjs --enable
node scripts/pwa-assets.mjs
node scripts/check.mjs
```

`src/config/merchants.js`는 공개 브라우저 설정만 포함하므로 공개 URL과 publishable key가 저장되는 것이 정상입니다. 서비스 비밀키는 포함할 수 없도록 생성 스크립트가 제한합니다. 기존 GitHub Pages 배포 방식으로 새 브랜치를 검토한 뒤 배포하세요. PWA에서 기존 캐시가 남아 있다면 새 버전 설치/갱신을 확인합니다.

롤백: `node scripts/merchants/configure.mjs` (옵션 없음), `node scripts/pwa-assets.mjs`, 기존 방식으로 다시 배포합니다. 데이터베이스를 삭제하지 않습니다. main 기반의 기존 카카오 검색으로 돌아갑니다.

## 5. 검색 및 2차 대조

- 지도 렌더링은 기존 Kakao Maps JS SDK 하나만 사용합니다. 지도 SDK 자체 호출은 계속 발생합니다.
- 지도 화면, 카테고리, 검색어 또는 브랜드를 기준으로 Supabase에서 60개씩 검색하며 61번째 레코드로 추가 결과를 판단합니다. 자동 전체 순회 대신 기존 '더 보기'를 사용합니다. 지도 이동 시 기존 UI의 '이 지역 검색' 방식은 유지합니다.
- 지도 위치는 공공데이터의 좌표입니다. 공공업소 번호와 카카오 장소 ID는 서로 다르므로 상세 링크는 상호/주소 검색 또는 좌표 길찾기 링크로 변경했습니다.
- 상세 화면의 '카카오 장소 정보와 대조' 버튼에서만 Kakao Places 1회 호출(세션 최대 10회)을 실행합니다. 브랜드·업종·이름 또는 주소·거리(150m 이내) 조건이 단일 장소와 일치할 때만 일치로 표시합니다. 조회 실패/불일치는 폐업 또는 결제 불가를 뜻하지 않습니다. 카카오 응답, 비교 결과는 DB·스토리지에 저장하지 않습니다.
- 기존 브랜드 지원 데이터는 `brand_listed`로 유지합니다. 카카오 대조가 실제 애플페이 결제를 검증하는 것은 아닙니다.
- 한/영 이외 언어의 신규 대조 문구는 영문으로 제공됩니다. 기존 13개 언어 UI는 유지됩니다.
- 공공데이터 출처: 소상공인시장진흥공단 상가(상권)정보 API. https://www.data.go.kr/data/15012005/openapi.do

## 6. 운영 테스트 체크리스트

1. DB 초기화 및 RLS 실제 검증.
2. `initial` 수동 실행 후 적재 수, 표본 상호/주소/업종 및 좌표 확인. 165개 브랜드 커버리지와 누락 사유 확인.
3. `delta` 수동 실행 후 실제 변경 행이 반영되고 실패 시 체크포인트가 진행되지 않는지 확인.
4. `PayKR Supabase read` 수동 실행 및 Actions 로그에서 실제 DB SELECT 성공 확인.
5. DB 검색 활성화 후 브라우저 개발자 도구에서 정상 조회 RPC, 일반 검색의 카카오 Places 호출 0회, 상세 2차 대조 시만 호출 확인.
6. PC/모바일 검색, 마커, 다국어, 광고, PWA 및 Discord 채팅 확인. Supabase 일시 장애 시 불필요한 카카오 전체 검색이 발생하지 않는지 확인.
7. Supabase Database size 및 egress, GitHub Actions 실행 시간, 카카오 지도/검색 쿼터 추이를 모니터링. 공개 API 호출이 많더라도 DB 전송량이 무료 한도에 도달할 수 있습니다.

## 7. 테스트 범위

`node scripts/check.mjs`로 기존 8개 테스트 묶음 및 신규 2개 묶음(공공 API 파싱·브랜드/업종 필터·DB-first·카카오 실시간 대조, 수집 체크포인트·재개·delta 모의 동기화)을 실행했습니다. 외부 API는 모의 응답이며 실제 Supabase/PostGIS 실행, 운영 공공 API, 실제 카카오 SDK, Actions 예약 실행은 미검증입니다. Chromium 통합 테스트는 실행 환경에서 `ERR_BLOCKED_BY_ADMINISTRATOR` 오류로 시작되지 못했습니다. 이 결과를 실환경 성공으로 간주하지 마세요.
