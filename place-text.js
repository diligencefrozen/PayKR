// English display values for Kakao Local results. Keep the provider's fields intact.
const placeText = (() => {
  const brands = new Map(Object.entries({
    'GS25': 'GS25', 'CU': 'CU', 'KFC': 'KFC', '세븐일레븐': '7-Eleven', '이마트24': 'emart24', '미니스톱': 'MINISTOP',
    '스타벅스': 'Starbucks', '투썸플레이스': 'A Twosome Place', '이디야커피': 'EDIYA COFFEE',
    '메가MGC커피': 'MEGA MGC COFFEE', '메가커피': 'MEGA COFFEE', '빽다방': "Paik’s Coffee",
    '할리스': 'HOLLYS', '공차': 'Gong cha', '폴바셋': 'Paul Bassett', '팀홀튼': 'Tim Hortons',
    '코스트코': 'Costco', '코스트코홀세일': 'Costco Wholesale', '롯데마트': 'LOTTE Mart',
    '홈플러스': 'Homeplus', '롯데슈퍼': 'LOTTE Super', '이마트': 'emart',
    '파리바게뜨': 'Paris Baguette', '뚜레쥬르': 'Tous Les Jours', '배스킨라빈스': 'Baskin-Robbins',
    '던킨': 'Dunkin’', '맥도날드': 'McDonald’s', '버거킹': 'Burger King', '롯데리아': 'Lotteria',
    '쉐이크쉑': 'Shake Shack', '파이브가이즈': 'Five Guys', '무신사': 'MUSINSA'
  }));
  const regions = new Map(Object.entries({
    '서울': 'Seoul', '부산': 'Busan', '대구': 'Daegu', '인천': 'Incheon', '광주': 'Gwangju',
    '대전': 'Daejeon', '울산': 'Ulsan', '세종': 'Sejong', '경기': 'Gyeonggi-do',
    '강원': 'Gangwon-do', '충북': 'Chungcheongbuk-do', '충남': 'Chungcheongnam-do',
    '전북': 'Jeonbuk', '전남': 'Jeollanam-do', '경북': 'Gyeongsangbuk-do',
    '경남': 'Gyeongsangnam-do', '제주': 'Jeju-do', '충청북': 'Chungcheongbuk-do',
    '충청남': 'Chungcheongnam-do', '전라북': 'Jeollabuk-do', '전라남': 'Jeollanam-do',
    '경상북': 'Gyeongsangbuk-do', '경상남': 'Gyeongsangnam-do'
  }));
  const categories = new Map(Object.entries({
    '음식점': 'Restaurant', '한식': 'Korean food', '중식': 'Chinese food', '일식': 'Japanese food',
    '양식': 'Western food', '카페': 'Café', '제과,베이커리': 'Bakery', '편의점': 'Convenience store',
    '가정,생활': 'Home & living', '쇼핑,유통': 'Shopping & retail', '슈퍼마켓': 'Supermarket',
    '마트': 'Market', '교통,수송': 'Transport', '문화,예술': 'Arts & culture', '여행': 'Travel'
  }));
  function romanize(text) {
    return text.normalize('NFC').replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]+/g, word =>
      koroman.romanize(word, { casingOption: 'capitalize-word' }));
  }
  function locationName(word) {
    if (word.endsWith('역') && word.length > 1) return romanize(word.slice(0, -1)) + ' Station';
    return romanize(word);
  }
  function name(text) {
    const [first, ...rest] = text.trim().split(/\s+/);
    return [brands.get(first) || romanize(first), ...rest.map(word => {
      if (word === '본점') return 'Main Branch';
      if (brands.has(first) && word.endsWith('점') && word.length > 1) return locationName(word.slice(0, -1)) + ' Branch';
      return romanize(word);
    })].join(' ');
  }
  function addressPart(word, index) {
    if (index === 0) {
      const region = regions.get(word.replace(/(?:특별자치시|특별자치도|특별시|광역시|도)$/, ''));
      if (region) return region;
    }
    const numberedRoad = word.match(/^(.+(?:대로|로))([0-9]+)(번길|길)$/);
    if (numberedRoad) return addressPart(numberedRoad[1], index) + ' ' + numberedRoad[2] + '-' + koroman.romanize(numberedRoad[3]);
    const unit = word.match(/^(.+?)(대로|번길|로|길|시|군|구|읍|면|동|리)$/);
    if (!unit) return romanize(word);
    return romanize(unit[1]) + '-' + koroman.romanize(unit[2], { useCustomDictionary: false });
  }
  function address(text) {
    if (!/[가-힣]/.test(text)) return text;
    const parts = text.trim().split(/\s+/).map(addressPart);
    // Kakao's street and lot addresses end in a building or lot number.
    if (/^\d+(?:-\d+)?$/.test(parts.at(-1))) return parts.reverse().join(', ');
    return parts.join(' ');
  }
  function category(path) {
    return path.split(/\s*>\s*/).map(part => categories.get(part) || brands.get(part) || romanize(part)).join(' › ');
  }
  return { name, address, category };
})();
