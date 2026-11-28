# PayKR v0.7 Turso 연결 준비 (증분 패치, v0.6 위에 적용)

1. Turso paykr-community에서 DB 전용 토큰 생성 (초기화는 쓰기 권한 필요). 만료기간은 운영 계획에 맞게 설정. 토큰을 채팅이나 저장소에 넣지 말 것.
2. GitHub PayKR Settings > Secrets and variables > Actions: Variables에 TURSO_DATABASE_URL, Secrets에 TURSO_AUTH_TOKEN 생성. URL은 libsql://paykr-community-diligencefrozen.aws-ap-northeast-1.turso.io. 토큰은 Secret에만 입력.
3. 패치 폴더 내부 파일을 기존 저장소 루트에 덮어쓰기, 커밋 및 Push. 기존 Supabase 설정과 수집 작업은 변경하지 않음.
4. Actions > PayKR Turso community setup > Run workflow > main > mode init. 성공하면 다시 mode check 실행. 정상 로그: Turso community schema 1: connected; 4 tables verified.
5. 이후 매일 12:41 KST에 읽기 점검. 10일 미사용 아카이브 위험을 줄이지만 예약 실행 및 정책에 따라 보장되지 않음. 실패 로그 확인. 토큰 만료 시 재발급. 무료 한도 확인, 초과 과금 비활성화 유지. 삭제 보호 활성화 권장.

초기화는 IF NOT EXISTS 및 기존 버전 보존을 사용함. 기존 데이터 삭제 없음. 사진 저장, 댓글/투표 UI 및 쓰기 API, 인증, 관리자 검토, 사용자 간 캐시, 가맹점 ID 유효성 검증은 이후 단계. 현재는 공공데이터의 고유 업소 ID를 merchant_id로 사용할 예정이며 Kakao ID를 혼용하지 않음. actor_id는 추후 검증된 사용자 ID만 서버에서 부여. 임의 사용자 입력으로 신뢰하지 말 것. 공개 웹에 DB 토큰 또는 임의 SQL 실행 API 금지. Supabase Edge Function 등 서버 측 중계 API에서 권한, 속도 제한, 입력 검증 적용 후 기능 활성화. 실제 Turso 연결은 사용자 Secret 등록 및 workflow 실행 이후 확인 가능. 이 패치는 운영 DB에 직접 실행되지 않았음.

로컬 테스트: node --test tests/community-turso.test.mjs
