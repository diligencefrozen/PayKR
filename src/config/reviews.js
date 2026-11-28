// Community reviews and Discord OAuth are served by the separate Cloudflare Worker in
// workers/reviews/. Static GitHub Pages cannot hold the Discord client secret or bot token.
//
// Defaults keep the app fully functional with an in-memory mock (no network, no real writes)
// so local development and the test suite never require operator credentials.
// To enable the real service: deploy workers/reviews with its secrets, then set
//   apiBase to the Worker origin and useMock to false.
export const reviewsConfig = Object.freeze({
  apiBase: null,
  useMock: true,
});
