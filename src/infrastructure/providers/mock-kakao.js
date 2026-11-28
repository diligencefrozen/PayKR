// Dev-only mock search provider, activated with the `?mock=1` query parameter.
// The Kakao JS SDK key is domain-restricted to the production GitHub Pages domain, so real
// Kakao search cannot run from localhost. This provider returns fixed, clearly-fictional
// sample places so the search / category / marker flow can be exercised locally without a key.
// It never ships into production behavior (see src/app/bootstrap.js gate).

const SAMPLES = [
  { id: 'mock-1', place_name: '스타벅스 강남역점', x: '127.026', y: '37.497', road_address_name: '서울 강남구 강남대로 396', category_name: '음식점 > 카페', phone: '02-0000-0001' },
  { id: 'mock-2', place_name: 'GS25 강남중앙점', x: '127.028', y: '37.499', road_address_name: '서울 강남구 테헤란로 123', category_name: '편의점', phone: '02-0000-0002' },
  { id: 'mock-3', place_name: '올리브영 강남점', x: '127.025', y: '37.496', road_address_name: '서울 강남구 강남대로 390', category_name: '화장품', phone: '02-0000-0003' },
  { id: 'mock-4', place_name: '이디야커피 역삼점', x: '127.033', y: '37.500', road_address_name: '서울 강남구 테헤란로 152', category_name: '음식점 > 카페', phone: '02-0000-0004' },
  { id: 'mock-5', place_name: '파리바게뜨 강남역점', x: '127.026', y: '37.498', road_address_name: '서울 강남구 강남대로 398', category_name: '음식점 > 베이커리', phone: '02-0000-0005' },
  { id: 'mock-6', place_name: '롯데리아 강남점', x: '127.027', y: '37.497', road_address_name: '서울 강남구 강남대로 401', category_name: '음식점 > 패스트푸드', phone: '02-0000-0006' },
];

export class MockKakaoSearchProvider {
  async search(keyword, bounds, page) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (String(keyword).includes('없는곳')) return { rows: [], more: false };
    return { rows: SAMPLES, more: page < 2 };
  }
}
