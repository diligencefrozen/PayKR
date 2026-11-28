# PayKR 매장 리뷰 패치 v0.8.2

## 변경 사항
- 매장 상세의 이용자 제보 → 매장 리뷰, 댓글 → 이용 후기. 가맹점 정보 오류 제보 폼 제거.
- 공공데이터 매장과 Kakao SDK/REST 검색 매장 모두 결제 성공/실패, 익명 후기, 공개 후기 조회 가능. 구형 캐시의 출처 없는 숫자 ID도 지원.
- 공공데이터 ID와 기존 후기는 그대로 유지. Kakao ID는 API 경로에서 `kakao:<숫자 ID>`로 구분하며 서버는 Turso에 `kakao:<HMAC-SHA256>` 형태의 키만 저장. 카카오 이름·주소·좌표 등 검색 데이터 및 원본 ID는 DB에 저장하지 않음. 같은 Kakao ID는 동일한 후기를 조회.
- 공공데이터는 기존 Supabase 활성 매장 확인 유지. Kakao ID는 형식만 검사하며 실재 매장을 서버가 검증하는 방식은 아님. 기존 익명 토큰, Origin 검사, 속도 제한, 운영자 승인 후 공개 유지. 구버전 공공데이터 오류 제보 API 및 데이터는 호환성을 위해 유지하되 새 UI에서는 제거.
- 두 출처가 같은 실제 매장을 가리켜도 자동 합치지 않음(오연결 방지). 별점·즉시 공개·사진은 추가하지 않음.
- Turso 테이블 스키마는 변경하지 않음. `ACTOR_SECRET`은 기존 값을 유지해야 함. 변경하면 기존 익명 소유권 및 Kakao 후기 조회 키가 달라짐.

## 적용 방법
1. ZIP의 경로 구조 그대로 기존 저장소 루트에 덮어쓰기. 변경 파일만 포함. `src/config/community.js`는 포함하지 않아 기존 운영 주소를 덮어쓰지 않음.
2. 기존 커뮤니티 Worker와 비밀값을 유지하여 `workers/community`에서 `npx wrangler@4 deploy` 실행. 신규 설치라면 `docs/PATCH-v0.8-COMMUNITY-KO.md`의 설정 및 Turso 초기화 절차 참조(공공데이터 전용 제한 설명은 본 패치로 대체).
3. 기존 API 주소가 설정되어 있다면 그대로 유지. 주소가 비어 있다면 저장소 루트에서 `node scripts/community/configure.mjs https://paykr-community.YOUR-SUBDOMAIN.workers.dev` 실행(실제 Worker 주소로 교체).
4. 저장소 루트에서 `node scripts/pwa-assets.mjs` (운영 설정과 자산 해시 일치), `node scripts/check.mjs` 실행. GitHub Desktop으로 커밋/Push. 브라우저 새로고침 후 두 출처 매장에서 실제 후기 등록/조회 확인.
5. 관리자는 기존 Turso `comments`, `payment_reports` 검토/공개 절차를 그대로 사용. 사용자에게 이용자 후기임을 표시하며 결제 상태 자동 확정은 하지 않음.

## 운영 전 확인
첨부 원본은 커뮤니티 API 주소가 비어 있음. 이 작업에서 실제 Worker/Turso/Supabase 연결, 브라우저 화면 또는 운영 배포는 실행하지 않음. 모의 HTTP 테스트 및 기본 `scripts/check.mjs` 통과. 카카오의 장소 식별자 기반 장기 연결 사용 허용 여부(기존 `docs/policy-review.md`에 미확인으로 기록)를 운영자가 확인해야 하며, HMAC 사용 자체가 정책 준수를 보장하지 않음. 실제 Kakao ID 검증/등록 남용 감시가 필요할 수 있음.
