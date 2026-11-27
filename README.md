# PayKR

한국에서 Apple Pay 사용처를 찾고 결제 근거를 확인하는 지도와 온라인 브랜드 목록입니다. 도시를 고르거나 기존 검색창과 가로 카테고리로 지점을 찾은 다음, PC 왼쪽 패널이나 모바일 하단 시트에서 결제 근거와 한국어 주소를 확인합니다. 지도·온라인 사용처·여행 가이드는 PC 상단 메뉴와 모바일 하단 탭에서 열 수 있습니다. 온라인 페이지에서는 기존 로고 카드의 상태 표시를 펼쳐 근거를 확인합니다.

## 로컬 실행

Node.js 24로 저장소 루트에서 실행합니다. 별도 서버 계정이나 빌드 패키지 설치 없이 생성된 페이지를 열 수 있습니다.

```sh
node scripts/preview.mjs
```

브라우저에서 [로컬 지도](http://127.0.0.1:8766/PayKR/)를 엽니다. Kakao SDK는 허용된 origin이 필요합니다. 연결 실패 화면에서 **브랜드 목록**을 열면 자체 카탈로그를 조회할 수 있습니다. 위치는 사용자가 위치 버튼을 눌렀을 때 요청합니다.

## 페이지와 데이터 관리

- 지도, 온라인, 가이드의 HTML 원본은 `templates/`에 있습니다. 지도·온라인·공통 기본 CSS는 기존 파일을 유지합니다. 추가 기능 스타일은 `extensions.css`에 있습니다.
- `src/data/stores.json`은 오프라인 브랜드 160개와 카테고리 연결 163개를, `online.json`은 온라인 항목 36개를 담습니다. 원래의 브랜드명·별칭·로고를 유지합니다. 과거 목록 등재는 지점별 결제 확인과 구분합니다.
- ‘의견 남기기 → 매장 정보 제보’에서 제출한 글은 GitHub Issues에 저장됩니다. 운영자가 지점·결제 경로·확인 날짜를 검토하고 `src/data/evidence.js`에 출처와 함께 반영한 버전을 배포해야 지도에 표시됩니다. 현재 확인된 지점 레코드는 0개입니다. Discord 채팅 내용도 지도에 자동 등록되지 않습니다.
- `src/i18n/`에는 언어 등록부와 한국어·영어·일본어·중국어 간체·번체 사전이 있습니다. 명시적 URL 언어, 저장된 선택, 브라우저 선호 언어 순서로 결정합니다. 지원 언어가 없으면 영어를 사용합니다.
- `?lang=`, `?adpreview=1`, `?chat=open`, `online.html`, `forum/`을 지원합니다. 지도 검색 딥링크는 `?q=Myeongdong` 형식입니다. 현재 좌표를 URL에 기록하지 않습니다.

원본이나 사전을 수정하면 아래 순서로 정적 페이지와 오프라인 자산 해시를 갱신합니다. 생성물도 함께 버전 관리합니다.

```sh
node scripts/pages.mjs
node scripts/pwa-assets.mjs
node scripts/check.mjs
```

`scripts/check.mjs`는 HTML·사이트맵·오프라인 자산 일치 검사와 Node 회귀 테스트를 실행합니다. 브라우저 테스트는 Playwright와 Chromium을 사용할 수 있는 환경에서 실행합니다. 필요한 경우 `PAYKR_PLAYWRIGHT`에 로컬 Playwright 패키지 경로, `PAYKR_CHROME`에 브라우저 실행 파일 경로를 지정합니다.

```sh
node scripts/check.mjs --browser --screenshots
node tests/performance.mjs
node tests/browser-perf.mjs
```

## 운영

기존 GitHub Pages의 프로젝트 경로는 `/PayKR/`입니다. 운영자가 검증 후 기존 배포 브랜치에 소스와 생성 파일을 함께 반영합니다. 릴리스 롤백 시에는 이전 HTML, 모듈, 서비스 워커, 자산 해시를 같은 버전으로 복원합니다. 사용자에게 업데이트가 준비되면 직접 새로고침하도록 안내합니다.

AdSense 게시자 설정은 `src/config/advertising.js`에 있습니다. 발급된 광고 단위, 인증 CMP 동의 연결, 계정의 공식 복구 태그 및 게시 메시지는 운영자 설정 항목입니다. 일반 개발 검증에는 비대화형 광고 미리보기를 사용합니다.

- [아키텍처, 데이터 이관, 전후 실측 및 검증 기록](docs/implementation.md)
- [외부 정책 근거와 운영자 검증 절차](docs/policy-review.md)
- [기존 업데이트 기록](docs/release-history.txt)
- [공개 GitHub Issues](https://github.com/diligencefrozen/PayKR/issues)
