export const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

export function legacyClaim(brandId, channel) {
  return {
    method: 'apple_pay',
    channel,
    brandId,
    placeId: null,
    status: 'brand_listed',
    evidence: [
      {
        scope: 'brand',
        sourceType: 'legacy',
        sourceUrl: null,
        observedAt: null,
        reviewedAt: null,
        note: null,
      },
    ],
    networkConditions: [],
    issuerCountryConditions: [],
  };
}

export function paymentFor(placeId, brand, claims = [], channel = 'in_store') {
  const branch = claims.filter(
    (c) =>
      placeId &&
      c.method === 'apple_pay' &&
      c.channel === channel &&
      c.placeId === placeId &&
      c.evidence.some((e) => e.scope === 'branch'),
  );
  if (branch.length) {
    const last = branch
      .slice()
      .sort((a, b) => (b.evidence[0].observedAt || '').localeCompare(a.evidence[0].observedAt || ''))[0];
    const statuses = new Set(branch.map((c) => c.status));
    return {
      ...last,
      status: statuses.has('not_supported') && statuses.size > 1 ? 'conflict' : last.status,
      evidence: branch.flatMap((c) => c.evidence),
    };
  }
  if (brand) return legacyClaim(brand.id, channel);
  return {
    method: 'apple_pay',
    channel,
    placeId,
    brandId: null,
    status: 'unknown',
    evidence: [],
    networkConditions: [],
    issuerCountryConditions: [],
  };
}

export function brandMatches(name, brand) {
  const original = name.normalize('NFKC').trim().toLowerCase();
  return Object.values(brand.names).some(
    (value) => original === value.toLowerCase() || original.startsWith(value.toLowerCase() + ' '),
  );
}

export function placeRecord(row) {
  const lat = Number(row.y),
    lng = Number(row.x);
  if (
    !row.id ||
    !row.place_name ||
    !row.y ||
    !row.x ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return {
    id: String(row.id),
    source: 'kakao',
    name: row.place_name,
    address: row.road_address_name || row.address_name || '',
    category: row.category_name || '',
    phone: row.phone || '',
    lat,
    lng,
  };
}

export function metersBetween(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.min(1, Math.sqrt(h))));
}
