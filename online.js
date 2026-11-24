(() => {
  const input = document.getElementById('searchInput');
  const cards = Array.from(document.querySelectorAll('.brand'));
  const filters = document.querySelectorAll('.filters button');
  const middleAd = document.getElementById('directory-middle-ad');
  let category = 'all';
  // Ignore spacing and punctuation in both the original names and search aliases.
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const names = cards.map(card => [card.dataset.name, card.dataset.english, ...(card.dataset.aliases || '').split('|')].map(normalize));
  function filterBrands() {
    const query = normalize(input.value);
    const visible = [];
    cards.forEach((card, index) => {
      const matches = (category === 'all' || category === card.dataset.category) && names[index].some(name => name.includes(query));
      card.hidden = !matches;
      if (matches) visible.push(card);
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(category === button.dataset.category)));
    translatedText(document.getElementById('totalCount'), 'ecommerce.count', { count: visible.length });
    document.getElementById('empty').hidden = visible.length > 0;
    middleAd.hidden = visible.length < 12;
    if (!middleAd.hidden) visible[7].after(middleAd);
    document.getElementById('directory-top-ad').hidden = !visible.length;
    document.getElementById('directory-bottom-ad').hidden = visible.length < 8;
  }
  input.addEventListener('input', filterBrands);
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    filterBrands();
  }));
  document.getElementById('reset').addEventListener('click', () => {
    input.value = '';
    category = 'all';
    filterBrands();
    input.focus();
  });
  filterBrands();
})();
