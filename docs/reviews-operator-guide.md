# PayKR — 리뷰·제보 운영자 가이드 (Discord OAuth2 + Cloudflare Worker)

## 1. 아키텍처 요약
- GitHub Pages는 정적 호스팅이므로 Discord client secret·봇 토큰을 브라우저에 둘 수 없다.
- 별도 **Cloudflare Worker** `workers/reviews/`가 OAuth2 인증과 리뷰/제보 API를 제공한다.
- 리뷰 원본은 Discord 전용 채널의 **봇 메시지**로 저장한다(별도 DB 없음). Discord 메시지 ID가 리뷰 ID.
- 프론트는 `src/config/reviews.js`의 `apiBase`가 비어 있으면 **in-memory mock**으로 동작한다
  (개발·테스트용, 실제 쓰기 없음). 실서비스는 `apiBase`를 Worker origin으로 설정하고 `useMock:false`.

## 2. Discord 설정
1. [Discord Developer Portal](https://discord.com/developers/applications)에서 새 애플리케이션 생성
   (PayKR 리뷰 전용, 기존 WidgetBot 서버와 분리).
2. **OAuth2** → Redirects에 실제 callback 등록:
   `https://diligencefrozen.github.io/PayKR/auth/discord-callback.html`
   로컬 테스트용 URI는 별도 허용 목록으로 관리.
3. **Bot** 탭에서 봇 생성. 봇 토큰은 Worker Secret(`DISCORD_BOT_TOKEN`)으로만 보관.
4. 전용 채널 생성(권장명 `paykr-place-reviews`). 봇에게 **View Channel, Send Messages,
   Read Message History, Embed Links** 최소 권한만 부여. 일반 사용자는 쓰기 금지(봇·운영자만).
5. (선택) 신고 전용 채널 생성 → `DISCORD_REPORT_CHANNEL_ID`에 지정.

## 3. Worker 배포
```sh
cd workers/reviews
npm install
# 공개 설정 (wrangler.toml의 [vars] 또는 CLI로)
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put SESSION_SIGNING_SECRET   # 긴 랜덤 문자열
wrangler secret put OAUTH_STATE_SECRET       # 긴 랜덤 문자열
wrangler secret put AUTHOR_KEY_SECRET        # 긴 랜덤 문자열 (Discord ID 해시용)
wrangler deploy
```
공개 값(`wrangler.toml` [vars]): `DISCORD_CLIENT_ID`, `DISCORD_REVIEW_CHANNEL_ID`,
`DISCORD_REVIEW_BOT_ID`, `ALLOWED_ORIGINS`(`,`구분), `REDIRECT_URIS`(`,`구분).

**Secret 이름(값 제외)**: `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `SESSION_SIGNING_SECRET`,
`OAUTH_STATE_SECRET`, `AUTHOR_KEY_SECRET` (필요 시 `TURNSTILE_SECRET`). 값은 절대 소스/커밋에 넣지 않는다.

## 4. 프론트 활성화
`src/config/reviews.js`에서:
```js
export const reviewsConfig = Object.freeze({
  apiBase: 'https://<your-worker>.workers.dev',
  useMock: false,
});
```
변경 후 `node scripts/pages.mjs && node scripts/pwa-assets.mjs` 재생성. 그 전까지는 mock으로만 동작한다.

## 5. 인증·세션 정책
- Authorization Code Grant + **PKCE S256 + state**. Worker가 서명·만료 state를 발급한다.
- 인증 후 Worker가 서명한 **짧은 수명 bearer(2시간)** 를 `sessionStorage`에만 보관
  (localStorage·URL·로그에 토큰 금지). 세션에 OAuth 토큰을 포함하지 않는다.
- `identify` 범위만 요청, 서버 가입 강제하지 않음. `GET /api/session`으로 검증.
- callback은 색인 방지(`noindex,nofollow`), 광고·분석 스크립트 미삽입, 사이트맵 제외.

## 6. 보안·남용 방지
- 작성·삭제·신고는 **서버에서** 인증 검증(프론트 버튼 숨김은 경계가 아님). 미인증 POST/DELETE는 401.
- 서버 측 요청 제한(Cloudflare rate-limit binding 권장), 입력 길이/크기 제한, `allowed_mentions parse:[]`,
  XSS는 `textContent`/`parse:[]`로 차단, 멘션 차단, 비밀값 로그 금지.
- 작성자 식별자는 요청 본문이 아니라 Worker가 세션에서 도출. Discord 원본 ID는 HMAC한 `authorKey`로만 사용.
- 같은 사용자+placeId의 **최신 유효 제보만** 집계에 포함(반복 제보가 여러 사람처럼 집계되지 않음).
- 실제 인증/봇 토큰/채널이 준비되기 전까지 운영 쓰기는 비활성화(fail-closed) 유지.

## 7. 데이터 권리 확인 게이트 (운영 활성화 전 필수)
카카오 장소 ID·매장명·좌표를 Discord에 영구 저장·재사용하는 것의 권리 확인이 완료되기 전까지
실제 운영 리뷰 쓰기를 활성화하지 않는다. 확인 전에는 mock으로 검증하고, 운영 데이터로 보고하지 않는다.
독립적으로 확보한 장소 키를 쓰는 경우 매칭 정확성·권리를 별도 검증 후 승인받는다.

## 8. 삭제·신고·개인정보
- `DELETE /api/reviews/:messageId`: 본인(authorKey 일치)만 삭제, 타인은 403/404.
- 신고: 인증 필요, `DISCORD_REPORT_CHANNEL_ID` 지정 시 해당 채널로 최소 정보 전송.
- 공개 응답에는 `messageId, displayName, content, paymentStatus, createdAt`만 노출.
  `authorKey`·Discord 원본 ID는 공개하지 않는다.

## 9. 검증 항목(운영 전)
미인증 쓰기/삭제 차단, OAuth 취소/오류, state·PKCE 불일치, code 재사용, redirect 변조, 세션 변조·만료,
작성자 위조 차단, 타인 리뷰 삭제 실패, 로그아웃 후 차단, 로그인 후 자동 등록 금지, Bot 저장 성공 후
상태 반영, 동일 계정 반복 제보·상이한 계정 제보. 로컬에서는 `tests/reviews.test.mjs`가 mock으로 검증한다.
