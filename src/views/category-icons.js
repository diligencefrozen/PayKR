const paths = {
  store: '<path d="M3 10l2-6h14l2 6M4 12v8h16v-8M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M8 20v-5h4v5"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  food: '<path d="M5 3v6m3-6v6M2 3v6c0 4 6 4 6 0M5 12v9M17 3v18M17 3c-5 3-5 10 0 10"/>',
  bed: '<path d="M3 5v16m18-12v12M3 17h18M3 10h18v7M7 7h4v3"/>',
  bag: '<rect x="4" y="8" width="16" height="13" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
  coffee: '<path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 9h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
};
export function categoryIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}
