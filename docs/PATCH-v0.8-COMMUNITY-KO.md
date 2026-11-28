# PayKR v0.8 커뮤니티 연동 준비 (v0.7 위에 덮어쓰기)

## 1. GitHub Desktop 적용
ZIP 내부의 `src`, `workers`, `scripts`, `tests`, `docs`, `extensions.css`, `pwa-assets.js`를 기존 PayKR 저장소 루트에 복사해 덮어씁니다. GitHub Desktop에서 변경 목록을 확인하고 `Add Turso community API and store detail UI`로 커밋/Push합니다. 기존 Turso 4개 테이블, 초기화 Actions, 수집 및 지도 설정은 유지됩니다. API 주소를 설정하기 전에는 쓰기 폼이 노출되지 않습니다.

## 2. Cloudflare Worker 배포 (GitHub Pages에 DB 토큰을 공개하지 않기 위해 필요)
Node 22 이상이 설치된 PowerShell을 PayKR 루트에서 엽니다. Wrangler 4.36 이상 필요: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

```powershell
cd workers/community
npx wrangler@4 login
npx wrangler@4 deploy
npx wrangler@4 secret put TURSO_DATABASE_URL
npx wrangler@4 secret put TURSO_AUTH_TOKEN
npx wrangler@4 secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler@4 secret put ACTOR_SECRET
```
각 명령의 입력 프롬프트에 실제 값을 입력합니다. Turso URL은 기존 GitHub Variable, 토큰은 기존 Secret에 입력했던 값(분실했으면 Turso에서 새 DB 전용 쓰기 토큰 발급), Supabase 키는 해당 PayKR 프로젝트의 서버 전용 service_role 키, ACTOR_SECRET은 길이 32자 이상의 별도 안전한 랜덤 문자열입니다. 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` 로 로컬에서 생성. 이 값들을 채팅, 저장소, 브라우저 코드, 터미널 명령 인자에 넣지 마세요. Worker는 비밀값이 없으면 오류를 반환합니다. 기존 리뷰/카카오 Worker와 별개입니다. Rate limit namespace 1001/1002를 다른 Worker에서 사용하는 경우 고유 정수 문자열로 변경하세요. Cloudflare 제한은 지역별 근사값으로 절대 한도나 봇 차단을 보장하지 않습니다.

## 3. 프론트 연결
실제 Worker 주소를 확인하고 PayKR 저장소 루트에서 아래 명령을 실행합니다. `YOUR-SUBDOMAIN`은 실제 값으로 교체합니다.

```powershell
cd ../..
node scripts/community/configure.mjs https://paykr-community.YOUR-SUBDOMAIN.workers.dev
node scripts/check.mjs
node --test tests/community-api.test.mjs tests/community-turso.test.mjs
```
GitHub Desktop에서 새 변경 사항을 다시 커밋/Push합니다. configure는 공개 Worker 주소만 저장하고 PWA 무결성 목록을 갱신합니다. 철회 시 `node scripts/community/configure.mjs --disable` 후 커밋/Push.

**중요:** 원본의 `src/config/merchants.js`는 `enabled:false`입니다. 현재 Kakao 검색 결과에는 제보 기능을 열지 않습니다. 공공데이터 업소 ID만 저장하며 서버에서 Supabase의 실제 활성 업소인지 검증합니다. 전국 수집/품질검토/preflight가 끝난 후 기존 v0.6 가이드에 따라 DB 검색 모드를 별도 활성화해야 합니다. 기존 활성화 절차에서 PWA 자산도 다시 생성해야 합니다. 사진이나 Kakao ID는 저장하지 않습니다.

## 4. 검토 및 테스트
결제 성공/실패와 댓글, 가맹점 정보 오류는 모두 pending 저장. 본인 브라우저에서는 자신의 검토 대기 댓글 및 결제 상태를 조회하고 다른 사용자는 공개된 댓글 및 결제 제보만 봅니다. 동일 브라우저의 결제 제보는 가맹점당 한 행으로 갱신되며 다시 제보하면 재검토 상태로 돌아갑니다. 폐업 제보는 실제 가맹점 정보 자동 수정으로 이어지지 않습니다. 브라우저 토큰은 무작위 익명 소유권 토큰이지 회원 인증이 아닙니다. 저장소 삭제 시 동일 사용자 판별 불가. DB에는 HMAC 식별자만 저장되며 IP는 속도 제한에 사용합니다. 사용자에게 실제 데이터 수집/보관 및 삭제 요청 절차를 안내한 뒤 운영 개시하세요.

Turso SQL 콘솔에서 관리자만 실행하는 검토 예시:
```sql
SELECT id, merchant_id, nickname, body, created_at FROM comments WHERE status='pending' ORDER BY created_at DESC LIMIT 50;
SELECT id, merchant_id, outcome, observed_at FROM payment_reports WHERE status='pending' ORDER BY observed_at DESC LIMIT 50;
SELECT id, merchant_id, kind, body, created_at FROM merchant_reports WHERE status='pending' ORDER BY created_at DESC LIMIT 50;
-- 실제 검토한 행 ID로 교체하고 개별 실행. 모든 행 일괄 승인은 금지.
UPDATE comments SET status='published' WHERE id='REVIEWED_ID' AND status='pending';
UPDATE payment_reports SET status='published' WHERE id='REVIEWED_ID' AND status='pending';
UPDATE merchant_reports SET status='accepted' WHERE id='REVIEWED_ID' AND status='pending';
```
거절 시 댓글/결제는 hidden, 가맹점 오류는 rejected. 민감정보 또는 삭제 요청은 운영자가 해당 행을 확인하고 처리합니다. 테스트용 데이터는 검토 후 삭제합니다. 실제 운영 DB에 위 SQL을 이 패치 작성 과정에서 실행하지 않았습니다.

## 5. 범위와 제한
스크린샷을 참고한 결제 성공/실패 버튼·댓글 입력/목록·오류 제보 폼. 회원가입/로그인, 별점, 좋아요, 댓글 이미지, 비밀번호로 수정·삭제, 관리자 웹페이지는 미구현. 한국어/영어 UI(나머지 언어는 영어 표시). 기존 Discord 리뷰 mock은 건드리지 않으며 새 경로에서는 가짜 성공을 표시하지 않습니다. Node 모의 HTTP 테스트 및 기존 check 통과. 실제 Worker 배포, 브라우저 시각 테스트, Turso 실쓰기, 공개 운영 검증은 미실행. 공개 출시 전 익명 남용 방지, 모니터링, 삭제 요청과 개인정보 안내 검토 필요. GitHub Actions 비밀값을 Worker가 자동으로 가져오는 구조가 아닙니다.
