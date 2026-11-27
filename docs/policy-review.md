# PayKR 2.0 외부 서비스 검토

확인일은 2026-11-26 한국 시간이다. 아래 날짜는 공식 자료 열람일이다. 매장 방문일, 결제 확인일이나 운영 콘솔 승인일을 뜻하지 않는다.

## 지도와 검색

카카오 운영정책 제5조 제20호는 앱의 사용자 환경 개선 외 목적으로 제공 데이터를 캐시하거나 캐시를 최신 상태로 유지하지 않는 행위를 제한한다. 같은 조 제13호와 제17호는 저작권 등 권리 고지 삭제와 카카오 표식 변경을 제한한다. PayKR의 적용 범위는 현재 탐색에 필요한 일시적 결과 표시와 진행 중인 동일 요청 병합이다. PayKR 소유의 브랜드·별칭·번역 데이터만 영속 캐시 대상으로 삼는다. 지도 타일, SDK, 공급자 장소 ID·좌표·주소·검색 결과를 오프라인 지점 DB로 수집하거나 재배포할 권한은 확인되지 않았다. [카카오 운영정책](https://developers.kakao.com/terms/ko/site-policies)

웹 지도에는 JavaScript 키와 등록된 SDK 도메인이 필요하다. 앱 콘솔에서 지도 사용 상태와 해당 앱의 무료 쿼터를 확인한다. API 활성화 순서에 따라 무료 쿼터 적용 대상이 다르다. 유료 전환이나 새 키 발급은 별도 운영 결정이다. 허용된 origin에서 지도 로고와 저작권 표시, 검색 성공·빈 응답·API 오류·영역 재검색과 실제 길찾기를 확인한다. [지도 사용 설정과 쿼터](https://developers.kakao.com/docs/ko/kakaomap/common) · [Web API 검색 및 페이지 이동](https://apis.map.kakao.com/web/documentation/#services_Places_keywordSearch)

## 관광객에게 표시할 결제 근거

| 상황 | 근거와 안내 |
| --- | --- |
| 오프라인 단말과 해외 카드 | 비접촉 기호를 확인하고, 해당 카드와 결제 네트워크를 이 지점에서 받는지 직원에게 묻는다. 승인 거절 시 발급사에 해외 사용 가능 여부를 확인한다. 검색 결과만으로 해외 카드 승인이나 특정 지점의 결제 성공을 단정할 수 없다. [Apple 사용자 가이드](https://support.apple.com/en-sg/guide/iphone/iphbd4cf42b4/27/ios/27) |
| 앱·웹 주문 | 결제 화면에 Apple Pay가 제공되는지 확인한다. 같은 브랜드의 앱, 웹사이트, 오프라인 지점은 각각 근거가 필요하다. 온라인 36개 항목의 현재 주문·로그인·국내 전화번호·배송지·특정 발급국 조건은 미검증이다. [Apple 구매 방법](https://support.apple.com/en-us/102626) |
| 대중교통 | 티머니는 지갑 앱의 티머니 교통카드 추가와 충전 절차를 안내한다. 이용할 노선 및 충전 수단 조건을 확인한다. 일반 해외 결제카드를 개찰구에 직접 대는 방식과 구별한다. [티머니 이용 안내](https://blog.tmoney.co.kr/en/tmoney-guide/iphone-transit-card-how-to-use-tmoney-with-apple-pay/) · [Apple 대중교통 안내](https://support.apple.com/ko-kr/118625) |
| 현금·ATM | 원화(KRW)가 필요하면 은행·공항 환전소를 이용할 수 있다. ATM에서는 해외 카드 표시와 카드 네트워크, 화면에 표시되는 수수료를 확인한다. 지점별 인출 가능 여부와 수수료는 미확인이다. [서울시 환전 안내](https://english.seoul.go.kr/service/entry/currency-exchange/) · [서울시 관광 안내의 Global ATM 설명](https://english.seoul.go.kr/wp-content/uploads/2014/03/guide.pdf) |

브랜드 목록의 출처와 과거 사용자 신고는 개별 지점의 공식 확인과 별도로 기록한다. 지점, 이용 채널, 확인 날짜, 네트워크나 발급 국가 조건을 뒷받침하는 출처가 있을 때에만 해당 필드를 갱신한다.

## GitHub Issues와 Discord

인증 없이 공개 GitHub REST API에 요청한 결과 저장소는 `public`, `has_issues: true`, 기본 브랜치는 `main`이었다. 공개 이슈 목록에 대한 별도 HTTP GET도 200을 반환했다. 개발 브랜치의 새 양식은 기본 브랜치에 반영한 뒤 이슈 작성 화면에서 검증한다. 공개 신고에는 지점명, 결제 결과, 날짜 등 필요한 정보만 적고 카드번호·영수증 번호·연락처·정밀 위치는 제외한다. 제출에는 GitHub 로그인이 필요하다. 이번 검토에서 공개 이슈를 생성하지 않았다. [저장소 메타데이터](https://api.github.com/repos/diligencefrozen/PayKR) · [공개 이슈 목록](https://github.com/diligencefrozen/PayKR/issues) · [GitHub 양식 설정](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)

Discord 운영자는 기존 서버에 WidgetBot이 설치되어 있는지, 채널 권한과 게스트 정책이 의도한 범위인지 확인한다. 로그인·메시지 실제 전송은 미검증이다. [WidgetBot Crate 설정](https://docs.widgetbot.io/embed/crate/tutorial)

## AdSense와 공식 광고 차단 복구

다음 항목은 운영자 확인용이다. 사이트 승인, 광고 단위 ID, 광고 수익, CMP 동작, Recovery 메시지 발행이나 노출은 이 문서의 확인 범위 밖이다.

1. **사이트와 광고 단위** — AdSense 사이트 승인 상태와 계정 게시자 ID를 확인하고 해당 사이트용 반응형 디스플레이 광고 단위 ID를 발급한다. 자동 광고를 사용한다면 계정의 오버레이 및 제외 영역까지 검토한다. 검색·길찾기·설치 버튼과 지도 조작 영역에서 충분한 여백을 확보하고 광고 영역에는 허용된 광고 라벨을 사용한다. [반응형 단위](https://support.google.com/adsense/answer/9183460?hl=en) · [광고 배치](https://support.google.com/adsense/answer/1282097)
2. **동의 관리** — EEA·영국·스위스 개인 맞춤 광고에 대해 Google 인증 TCF CMP와 지역별 메시지를 설정한다. 거부·철회·오프라인·차단 상태에서 지도, 가이드와 신고가 계속 열리는지 확인한다. 광고를 로드할지 결정하는 자체 설정 플래그나 언어 선택값은 방문자 동의의 근거로 쓸 수 없다. [Google CMP 요구사항](https://support.google.com/adsense/answer/13554116)
3. **복구 태그** — AdSense의 *Privacy & messaging → Ad blocking recovery → Tagging*에서 해당 계정에 발급된 태그 원문을 복사해 대상 페이지의 `head`에 넣는다. 기존 광고 연결 스크립트와 복구 태그의 기능은 다르다. Google이 제공하는 별도의 error protection 코드는 선택 사항이며, 영문 하단 메시지가 표시될 수 있으므로 모바일 하단 UI를 함께 확인한다. 수동 감지나 광고 우회 프록시는 필요하지 않다. [공식 태그 설치](https://support.google.com/adsense/answer/11575177) · [보호 코드 동작](https://support.google.com/adsense/answer/11575480)
4. **복구 메시지** — 대상 사이트·언어·메시지 위치를 선택하고 지원되는 메시지 유형에서 중앙 고정형(non-dismissible)을 기본 운영안으로 선택한다. 온라인 디렉터리와 정상 지도 화면만 포함하고 가이드·개인정보·신고·오프라인은 제외한다. AdSense의 메시지 테스트 기능으로 모바일·데스크톱별 노출 범위와 지원 경로를 확인한다. 운영자는 게시된 언어 목록과 대상 기기·지역별 동작을 기록한다. 일반 광고 미충전은 차단기 사용의 증거가 아니다. [공식 복구 메시지](https://support.google.com/adsense/answer/11576589?hl=en) · [미충전 슬롯 상태](https://support.google.com/adsense/answer/10762946?hl=en)
5. **검증과 수익 측정** — 개발 및 반복 화면 테스트에는 광고 프리뷰를 사용한다. 실광고를 클릭하거나 자동으로 반복 노출하지 않는다. 배포 후 정상 트래픽으로 AdSense 보고서의 노출·수익과 복구 전환을 비교한다. 캐시 또는 레이아웃의 로컬 벤치마크로 광고 수익을 추정하지 않는다. [프로그램 정책](https://support.google.com/adsense/answer/48182) · [메시지 지표](https://support.google.com/adsense/answer/12936184)
6. **ads.txt** — AdSense 계정에서 발급된 판매자 레코드를 사이트의 실제 루트 도메인에서 제공하고 크롤링 상태를 확인한다. GitHub Pages 프로젝트 경로인 `/PayKR/ads.txt`만으로 도메인 루트 파일이 생성되지는 않는다. 실제 도메인 루트 소유권과 계정 경고는 운영자 확인이 필요하다. [Google 크롤링 안내](https://support.google.com/adsense/answer/7679060?hl=en)

