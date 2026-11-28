// Community payment reports and visitor reviews. See docs/reviews-operator-guide.md.
export const PAYMENT_STATUS = Object.freeze(['available', 'unavailable', 'unspecified']);
export const REVIEW_SCHEMA = 'paykr-review:v1';
export const MAX_CONTENT = 500;

// A review record as exposed to the public UI. `authorKey` and Discord IDs never leave the server.
export function publicReview(row) {
  return {
    messageId: String(row.messageId || ''),
    placeId: String(row.placeId || ''),
    placeName: String(row.placeName || ''),
    paymentStatus: PAYMENT_STATUS.includes(row.paymentStatus) ? row.paymentStatus : 'unspecified',
    content: String(row.content || '').slice(0, MAX_CONTENT),
    displayName: String(row.displayName || ''),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    isMine: Boolean(row.isMine),
  };
}

// Account-level latest valid report is aggregated server-side; the client only consumes counts.
// success/fail counts are the number of DISTINCT accounts whose latest valid report for this
// place is available / unavailable. A single account's repeated reports never stack.
export function deriveCommunityStatus(summary) {
  const success = Number(summary?.success) || 0;
  const fail = Number(summary?.fail) || 0;
  const latestAt = summary?.latestAt || null;
  if (success > 0 && fail > 0) return { status: 'conflict', success, fail, latestAt };
  if (success > 0) return { status: 'available', success, fail, latestAt };
  if (fail > 0) return { status: 'unavailable', success, fail, latestAt };
  return { status: 'none', success: 0, fail: 0, latestAt: null };
}

// Whether a report submission is acceptable: at least a payment experience or a text body.
export function validSubmission({ paymentStatus, content }) {
  const hasStatus = PAYMENT_STATUS.includes(paymentStatus) && paymentStatus !== 'unspecified';
  const text = String(content || '').trim();
  return hasStatus || text.length > 0;
}
