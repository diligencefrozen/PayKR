# PayKR SEO 개선 및 배포 (2026-11-28)

- 기존 URL과 13개 언어 앱 페이지 유지. 깨끗한 언어별 URL, canonical, hreflang, 소셜 메타데이터, JSON-LD 개선.
- 한국어/영어 오프라인 브랜드 디렉터리 추가: 자체 카탈로그 160개 브랜드, 11개 업종(중복 업종 포함 163개 분류). 지점 결제 인증이 아닌 검색 후보이며 각 브랜드 링크는 지도 검색으로 연결.
- 사이트맵은 앱 39개 + 디렉터리 2개 + 이용약관 1개 = 42개. 루트 사이트맵은 별도 저장소에서 관리.
- 기존 지도·결제 정보·광고 설정을 유지. 검색 URL의 기본 언어를 해당 정적 페이지와 일치시킴. 기존 `?lang=` 직접 접근도 지원하며 언어 선택 시 실제 언어 URL로 이동 기록을 변경(지도 상태 유지).
- 기존 Ads 슬롯 ID/CMP 미설정 상태 유지. 광고를 임의 활성화하지 않음.

## 배포
1. 기존 PayKR 저장소를 백업하고 이 ZIP의 `PayKR-main` 내부 내용을 기존 저장소 루트에 덮어씁니다. ZIP 자체나 상위 폴더를 업로드하지 않습니다.
2. Node.js 22 이상에서 `node scripts/check.mjs` 실행. 콘텐츠 변경 후에는 `node scripts/pages.mjs` 및 `node scripts/pwa-assets.mjs` 실행.
3. 기존 GitHub Pages 설정을 유지하고 변경사항을 커밋합니다. 배포 후 `/PayKR/`, `/PayKR/index.ko.html`, `/PayKR/brands.ko.html`, `/PayKR/brands.html`, `/PayKR/sitemap.xml`을 확인합니다.
4. 별도 루트 저장소 패치를 적용합니다. 루트 ads.txt 및 기존 AdSense 심사 주소를 변경하지 않습니다.
5. Search Console에서 URL 접두어 속성 `https://diligencefrozen.github.io/`를 선택해 `/sitemap.xml`과 `/PayKR/sitemap.xml` 제출. 주요 페이지 URL 검사 및 색인 요청. Naver Search Advisor 및 Bing Webmaster Tools에서도 가능하면 사이트맵 제출.
6. 실서비스에서 Kakao 지도, 언어 변경, 모바일 레이아웃, PWA 업데이트 및 정책 링크를 직접 검증합니다. 브라우저/실제 Kakao API/애드센스 심사 상태는 이번 자동 테스트 범위 밖입니다.

검색 순위·색인·애드센스 승인은 보장되지 않으며, 데이터 출처와 확인일이 있는 지점별 결제 증거를 추가하는 것이 다음 우선순위입니다. 허위 리뷰, 미검증 LocalBusiness 마크업, 도시별 복제 페이지는 생성하지 않았습니다.
