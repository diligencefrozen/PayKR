export async function fetchCatalog(kind) {
  const url = new URL('../../data/' + kind + '.json', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Catalog unavailable');
  return response.json();
}
