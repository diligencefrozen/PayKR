// Pure, Worker-independent helpers for the Kakao Local REST proxy.
// Kept separate so they can be unit-tested without the Workers runtime.

// Normalize and validate the keyword query. Returns a trimmed string or null.
export function validateQuery(raw) {
  const query = String(raw ?? '').normalize('NFKC').trim().slice(0, 100);
  if (!query) return null;
  return query;
}

// Parse a Kakao REST rect "west,south,east,north" (WGS84 decimal degrees).
// Returns [west, south, east, north] or null when malformed or out of range.
export function parseRect(raw) {
  const parts = String(raw ?? '').split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (west < 124 || east > 132 || south < 32 || north > 40) return null;
  return [west, south, east, north];
}

// Map the Kakao Local REST response body to the frontend SearchService contract.
export function mapKakaoResponse(data) {
  const documents = Array.isArray(data?.documents) ? data.documents : [];
  const isEnd = data?.meta?.is_end !== false;
  return { rows: documents, more: !isEnd };
}

// Map a Kakao REST HTTP status to a stable client-facing error code.
export function kakaoErrorCode(status) {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 401 || status === 403) return 'KAKAO_AUTH';
  if (status >= 500) return 'KAKAO_ERROR';
  return 'KAKAO_REQUEST_FAILED';
}

// Clamp and validate the page number (Kakao allows 1..45).
export function normalizePage(raw) {
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1 || page > 45) return 1;
  return page;
}
