// Each entry contains the Korean default and its English translation.
const messages = {
  "theme.label": ["화면 테마", "Appearance"],
  "theme.system": ["기기 설정", "System"],
  "theme.light": ["라이트", "Light"],
  "theme.dark": ["다크", "Dark"],
  "common.language": ["언어 선택", "Language"],
  "common.map": ["매장 지도", "Store map"],
  "common.online": ["온라인 사용처", "Online directory"],
  "common.issue": ["문의하기", "Contact"],
  "map.title": ["애플페이 가맹점 찾기", "Apple Pay store map in South Korea | PayKR"],
  "map.description": ["대한민국에서 애플페이를 지원하는 매장을 지도로 확인할 수 있습니다.", "Find stores that accept Apple Pay in South Korea. Search by name or address, browse categories and check store details."],
  "map.sticker": ["스티커를 꼭 확인하세요!", "Look for the Apple Pay sticker."],
  "map.how": ["사용 방법", "Using the map"],
  "map.notice": ["필독사항", "Important information"],
  "map.releases": ["패치노트", "Release notes"],
  "release.2026-11-25": ["주변 매장에 카페를 추가했습니다. 화면 테마를 선택할 수 있으며, 카테고리를 여는 동안 Discord 버튼을 숨깁니다.", "Nearby searches now include cafés. You can choose a display theme, and the Discord button is hidden while categories are open."],
  "notice.location": ["지도를 열 때 위치 접근을 허용하면 주변 편의점, 카페, 마트·슈퍼, 제과·디저트 매장과 음식점을 표시합니다. 현재 위치 버튼으로 다시 시도하거나 매장명·주소로 검색할 수 있습니다.", "Allow location access when the map opens to see nearby convenience stores, cafés, supermarkets, bakeries, dessert shops and restaurants. Use the location button to try again, or search by store name or address."],
  "notice.building": ["같은 건물에 있는 여러 매장이 지도에서 한곳에 표시될 수 있습니다.", "Stores in the same building may appear at the same point on the map."],
  "notice.marker": ["지도 마커를 클릭하면 매장 주소와 상세 정보를 볼 수 있습니다.", "Select a map marker to see the store address and details."],
  "notice.source": ["업종 분류는 현대카드의 Apple Pay 안내를 참고했습니다.", "The categories are based on Hyundai Card’s Apple Pay guide."],
  "release.2026-11-24": ["한·영 전환과 온라인 브랜드 검색을 개선했습니다. 지도 접속 시 현재 위치를 확인해 주변 매장을 표시하며, PC에서 필독사항과 패치노트를 볼 수 있습니다.", "Improved language switching and online brand search. The map now requests your location on arrival to show nearby stores. Notices and release notes are available in the desktop sidebar."],
  "release.20260510.1": ["사용자 편의성 개선 (현재 위치를 불러오지 못하면, IP 주소로 사용자 위치를 확인 시도함.)", "Introduced IP-based location lookup when device location was unavailable."],
  "release.20251105.3": ["사용자 편의성 업데이트 (💬 포럼 기능 추가)", "Added the community forum."],
  "release.20251031.2": ["사용자 인터페이스 개선 (검색 결과 표시 방식 개선)", "Updated the search results display."],
  "release.20251030.1": ["사용자 인터페이스 개선 (데스크탑 최적화)", "Improved the desktop layout."],
  "release.20251021.2": ["사용자 인터페이스 개선 (모바일 최적화)", "Improved the mobile layout."],
  "release.20250517.11": ["기능 개선 (영어 지원 1/10)", "Introduced partial English support."],
  "release.20250101.5": ["가맹점 업데이트 (생활/가전, 커피, 제과/디저트, 온라인)", "Updated home and electronics, cafés, bakeries, desserts and online stores."],
  "release.20240914.10": ["가맹점 업데이트 및 UI 개선 (편의점, 패션, 카페, 외식)", "Updated convenience stores, fashion, cafés and dining listings and improved the interface."],
  "release.20240613.3": ["가맹점 업데이트 (커피, 백화점, 온라인)", "Updated cafés, department stores and online stores."],
  "release.20240225.2": ["가맹점 업데이트 (커피, 외식)", "Updated cafés and dining listings."],
  "release.20240125.7": ["사용자 인터페이스 개선 (사이트 하단에 애플페이 스티커 관련 안내 문구 추가)", "Added an Apple Pay sticker reminder."],
  "release.20231226.6": ["가맹점 업데이트 (외식, 백화점/쇼핑) 및 사용자 인터페이스 개선", "Updated dining and department store listings and the interface."],
  "release.20231221.3": ["가맹점 업데이트 (외식, 온라인)", "Updated dining and online stores."],
  "release.20231201.6": ["가맹점 업데이트 (백화점/쇼핑, 마트/슈퍼, 커피, 외식, 온라인)", "Updated department stores, supermarkets, cafés, dining and online stores."],
  "release.20231105.10": ["사용자 인터페이스 개선 ('기타' 메뉴 삭제(약국 삭제), 온라인 메뉴 추가, 문의 메뉴 추가)", "Removed the Other menu and pharmacy category and added online stores and contact options."],
  "release.20231017.2": ["사용자 인터페이스 수정 (검색 버튼 수정)", "Updated the search button."],
  "release.20231014.1": ["사용자 인터페이스 수정 (화면 비율 수정)", "Adjusted the layout for different screen sizes."],
  "release.20231008.5": ["사용자 인터페이스 수정 (카테고리, 필독사항)", "Updated categories and notices."],
  "release.20230822.1": ["가맹점 수정 (기타, 생활&가전)", "Corrected miscellaneous, home and electronics listings."],
  "release.20230821.3": ["사용자 인터페이스 개선 (패치노트 영역, 현재 위치 표시 기능 개선)", "Updated the release notes and current location display."],
  "release.20230818.5": ["가맹점 추가(약국) 및 수정(외식) 그리고 사용자 인터페이스 개선(패치노트, 필독사항 영역)", "Added pharmacies, corrected dining listings and updated the notes and notices."],
  "release.20230811.1": ["가맹점 추가(레저, 여행)", "Added leisure and travel listings."],
  "release.20230809.2": ["가맹점 추가(영화, 도서) 및 가맹점 수정(편의점)", "Added cinemas and bookstores and corrected convenience store listings."],
  "release.20230808.1": ["가맹점 추가(주유,충전)", "Added fuel and charging stations."],
  "release.20230805.8": ["사용자 인터페이스 개선", "Updated the interface."],
  "release.20230804.4": ["가맹점 추가(호텔,리조트) 및 사용자 인터페이스 업데이트", "Added hotels and resorts and updated the interface."],
  "release.20230803.11": ["가맹점 추가(외식/생활,가전) 및 사용자 인터페이스 개선", "Added dining, home and electronics listings and updated the interface."],
  "release.20230802.9": ["사용자 인터페이스 개선", "Updated the interface."],
  "release.20230726.16": ["가맹점 수정 (롯데마트/롯데백화점/롯데슈퍼)", "Corrected listings for Lotte Mart, Lotte Department Store and Lotte Super."],
  "release.20230724.1": ["사용자 인터페이스 개선", "Updated the interface."],
  "release.20230723.9": ["사용자 인터페이스 개선 (검색 기능 디자인 변경 / 모바일 기기로 접속시 반응하는 인터페이스 개선)", "Updated search controls and the mobile layout."],
  "release.20230721.9": ["가맹점 추가 (제과/디저트) 및 사용자 인터페이스 개선 (검색 기능 개선 / 마커 기능 추가)", "Added bakeries and dessert shops, improved search and added map markers."],
  "release.20230720.11": ["가맹점 추가 (마트/슈퍼) 및 사용자 인터페이스 개선 (검색 기능 추가)", "Added supermarkets and a search feature."],
  "release.20230718.7": ["사용자 인터페이스 업데이트 및 가맹점 추가 (편의점, 카페)", "Updated the interface and added convenience stores and cafés."],
  "release.20230524.1": ["초기 버전 출시", "First release."],
  "map.searchStep": ["검색창에 매장명을 입력하세요", "Enter a store name in the search box."],
  "map.categoryStep": ["카테고리 버튼을 클릭하세요", "Select a category to see stores on the map."],
  "map.zoomStep": ["마우스 휠로 지도를 확대/축소하세요", "Scroll to zoom in or out."],
  "map.filter": ["카테고리", "Categories"],
  "map.openFilter": ["카테고리 필터 열기", "Toggle category filters"],
  "map.closeFilter": ["필터 닫기", "Close filters"],
  "map.unavailable": ["지도를 불러오지 못했습니다. 연결을 확인한 뒤 새로고침해 주세요.", "The map could not load. Check your connection and refresh."],
  "map.wait": ["지도를 불러온 뒤 다시 시도해 주세요.", "Please try again once the map has loaded."],
  "search.input": ["장소, 주소 검색", "Search places or addresses"],
  "search.placeholder": ["장소, 주소 검색…", "Search places or addresses…"],
  "search.required": ["검색할 장소나 주소를 입력해 주세요.", "Enter a place or address to search."],
  "search.none": ["검색 결과가 없습니다.", "No places found."],
  "search.error": ["검색 결과를 불러오지 못했습니다. 다시 시도해 주세요.", "Unable to load results. Please try again."],
  "search.title": ["“{query}” 검색 결과", "Results for “{query}”"],
  "search.count": ["검색 결과 {count}곳", "Places found · {count}"],
  "search.results": ["장소 검색 결과", "Place search results"],
  "location.button": ["현재 위치로 이동", "Go to my location"],
  "location.current": ["현재 위치", "Current location"],
  "location.loading": ["현재 위치를 확인하고 있습니다.", "Finding your location…"],
  "location.success": ["현재 위치로 이동했습니다.", "Map centered on your location."],
  "location.nearby": ["현재 위치 주변의 편의점, 카페, 마트·슈퍼, 제과·디저트 매장과 음식점을 찾고 있습니다.", "Finding convenience stores, cafés, supermarkets, bakeries, dessert shops and restaurants near you."],
  "location.secure": ["HTTPS로 접속해야 위치를 확인할 수 있습니다. 장소나 주소로도 검색할 수 있습니다.", "Open the site over HTTPS to use location, or search for a place or address."],
  "location.unsupported": ["이 브라우저는 위치 확인을 지원하지 않습니다. 장소나 주소를 검색해 주세요.", "Your browser does not support location. Search for a place or address."],
  "location.denied": ["위치 접근이 차단되었습니다. 기기의 위치 서비스와 브라우저의 사이트 위치 권한을 확인하거나 주소를 검색해 주세요.", "Location access is blocked. Check device Location Services and site permissions, or search by address."],
  "location.unavailable": ["위치를 확인할 수 없습니다. 기기의 위치 서비스를 확인하거나 주소를 검색해 주세요.", "Location is unavailable. Check your device’s location settings or search by address."],
  "location.timeout": ["위치 요청 시간이 초과되었습니다. 다시 시도하거나 주소를 검색해 주세요.", "The location request timed out. Try again or search by address."],
  "place.emptyTitle": ["이 지역의 장소 찾기", "Find a place nearby"],
  "place.emptyHint": ["지도에서 장소를 선택하면 상세 정보가 표시됩니다.", "Select a place on the map to see its details."],
  "place.info": ["장소 정보", "Place details"],
  "place.expand": ["장소 패널 펼치기", "Expand place details"],
  "place.collapse": ["장소 패널 접기", "Collapse place details"],
  "place.clear": ["장소 선택 해제", "Clear selected place"],
  "place.noAddress": ["주소 정보 없음", "Address unavailable"],
  "place.call": ["전화", "Call"],
  "place.details": ["상세 정보 · 리뷰", "Details & reviews"],
  "place.review": ["리뷰", "Reviews"],
  "place.directions": ["길찾기", "Directions"],
  "place.note": ["결제 전 매장의 Apple Pay 스티커를 꼭 확인하세요.", "Check for an Apple Pay sticker before paying."],
  "common.chatFallback": ["채팅 연결 실패 · Discord에서 열기", "Chat unavailable · Open Discord"],
  "advertisement.label": ["광고", "Advertisement"],
  "advertisement.preview": ["광고 배치 미리보기", "Ad placement preview"],
  "ecommerce.title": ["온라인 애플페이 사용처 | PayKR", "Online Apple Pay directory | PayKR"],
  "ecommerce.heading": ["온라인 애플페이 사용처", "Apple Pay online"],
  "ecommerce.description": ["대한민국에서 Apple Pay로 결제할 수 있는 온라인 쇼핑몰과 서비스를 찾아보세요.", "Find online shops and services in South Korea that accept Apple Pay."],
  "ecommerce.search": ["브랜드 검색", "Search brands"],
  "ecommerce.placeholder": ["브랜드명 검색 (예: 무신사, Costco)", "Search brands (e.g. MUSINSA, Costco)"],
  "ecommerce.list": ["지원 브랜드", "Brands"],
  "ecommerce.count": ["{count}개 브랜드", "Brands · {count}"],
  "ecommerce.empty": ["검색 결과가 없습니다", "No brands found"],
  "ecommerce.reset": ["검색 및 필터 초기화", "Clear search and filters"],
  "ecommerce.note": ["결제 지원 여부는 변경될 수 있습니다. 구매 전 가맹점에서 확인해 주세요.", "Payment support can change. Check with the merchant before ordering."],
  "ecommerce.map": ["오프라인 매장 지도 보기", "View the in-store map"],
  "ecommerce.faq": ["온라인에서 Apple Pay 지원 여부를 어떻게 확인하나요?", "How can I check if a store accepts Apple Pay online?"],
  "ecommerce.answer": ["브랜드를 검색한 뒤 해당 쇼핑몰의 결제 화면에서 Apple Pay 옵션을 확인하세요.", "Search for the brand, then look for the Apple Pay option at checkout."],
  "category.전체": ["전체", "All"],
  "category.생활/가전": ["생활/가전", "Home & electronics"],
  "category.외식": ["외식", "Dining"],
  "category.호텔/리조트": ["호텔/리조트", "Hotels & resorts"],
  "category.백화점/쇼핑": ["백화점/쇼핑", "Department stores"],
  "category.패션/뷰티": ["패션/뷰티", "Fashion & beauty"],
  "category.편의점&카페": ["편의점&카페", "Convenience & cafés"],
  "category.마트/슈퍼": ["마트/슈퍼", "Supermarkets"],
  "category.제과/디저트": ["제과/디저트", "Bakeries & desserts"],
  "category.주유/충전": ["주유/충전", "Fuel & charging"],
  "category.영화/도서": ["영화/도서", "Cinema & books"],
  "category.레저/여행": ["레저/여행", "Leisure & travel"],
  "category.온라인": ["온라인", "Online"],
  "category.문의하기": ["문의하기", "Contact"],
  "brandCategory.음식 배달": ["음식 배달", "Food delivery"],
  "brandCategory.쇼핑": ["쇼핑", "Shopping"],
  "brandCategory.패션": ["패션", "Fashion"],
  "brandCategory.항공": ["항공", "Airline"],
  "brandCategory.이커머스": ["이커머스", "E-commerce"],
  "brandCategory.패스트푸드": ["패스트푸드", "Fast food"],
  "brandCategory.카페": ["카페", "Café"],
  "brandCategory.배달": ["배달", "Delivery"],
  "brandCategory.편의점": ["편의점", "Convenience store"],
  "brandCategory.홈쇼핑": ["홈쇼핑", "Home shopping"],
  "brandCategory.영화관": ["영화관", "Cinema"],
  "brandCategory.백화점": ["백화점", "Department store"],
  "brandCategory.식품": ["식품", "Groceries"],
  "brandCategory.뷰티": ["뷰티", "Beauty"],
  "brandCategory.라이프스타일": ["라이프스타일", "Lifestyle"],
  "brandCategory.기차": ["기차", "Rail"],
  "brandCategory.전자제품": ["전자제품", "Electronics"],
  "brandCategory.여행사": ["여행사", "Travel agency"],
  "brandCategory.서점": ["서점", "Bookshop"],
  "brandCategory.운동복": ["운동복", "Activewear"],
  "brandCategory.헬스케어": ["헬스케어", "Personal care"],
  "brandCategory.면세점": ["면세점", "Duty free"],
  "brandCategory.반려동물": ["반려동물", "Pet supplies"],
  "filter.all": ["전체", "All"],
  "filter.shopping": ["쇼핑", "Shopping"],
  "filter.food": ["음식", "Food"],
  "filter.travel": ["여행", "Travel"],
  "filter.convenience": ["편의점", "Convenience"],
  "filter.other": ["기타", "Other"],
  "place.phone": ["전화 {phone}", "Call {phone}"],
};

const supportedLanguage = value => value === 'ko' || value === 'en';
function preferredLanguage() {
  const forced = new URLSearchParams(location.search).get('lang');
  if (supportedLanguage(forced)) return forced;
  try {
    const stored = localStorage.getItem('paykr-language');
    if (supportedLanguage(stored)) return stored;
  } catch { /* Storage can be disabled by the browser. */ }
  return /^en(?:-|$)/i.test(navigator.language || '') ? 'en' : 'ko';
}

let language = preferredLanguage();
const substitutions = new WeakMap();
function t(key, values = {}) {
  const pair = messages[key];
  const template = (language === 'en' && pair?.[1]) || pair?.[0] || key;
  return template.replace(/\{(\w+)\}/g, (token, name) => values[name] ?? token);
}
function translatedText(element, key, values = {}) {
  element.dataset.i18n = key;
  substitutions.set(element, values);
  element.textContent = t(key, values);
}
function pageLink(path) {
  const url = new URL(path, location.href);
  url.searchParams.set('lang', language);
  if (new URLSearchParams(location.search).get('adpreview') === '1') url.searchParams.set('adpreview', '1');
  return url.href;
}
function translateTextNodes(root) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n, substitutions.get(el));
  });
}
function applyI18n() {
  document.documentElement.lang = language;
  translateTextNodes(document);
  for (const attr of ['aria-label', 'title', 'placeholder', 'content']) {
    const binding = 'data-i18n-' + attr;
    document.querySelectorAll('[' + binding + ']').forEach(el => el.setAttribute(attr, t(el.getAttribute(binding))));
  }
  document.querySelectorAll('[data-language]').forEach(el => { el.value = language; });
  document.querySelectorAll('[data-page]').forEach(el => { el.href = pageLink(el.dataset.page); });
  document.querySelectorAll('.brand[data-english]').forEach(card => {
    card.querySelector('.brand-name').textContent = language === 'en' ? card.dataset.english : card.dataset.name;
  });
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = document.querySelector('link[hreflang="' + language + '"]').href;
}
function selectLanguage(value) {
  if (!supportedLanguage(value)) return;
  language = value;
  try { localStorage.setItem('paykr-language', language); } catch { /* The URL still carries the choice. */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', value);
  history.replaceState(history.state, '', url);
  applyI18n();
}
document.querySelectorAll('[data-language]').forEach(select => {
  select.addEventListener('change', () => selectLanguage(select.value));
});
if (new URLSearchParams(location.search).get('adpreview') === '1') {
  document.documentElement.classList.add('ad-preview');
}
applyI18n();
