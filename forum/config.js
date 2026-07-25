/*
 * 공개 설정만 이 파일에 둡니다.
 * GitHub App client ID는 공개 값입니다. client secret과 SESSION_SECRET은
 * 반드시 forum/oauth-worker의 Cloudflare Worker secret으로만 저장하세요.
 */
window.PAYKR_FORUM_CONFIG = Object.freeze({
  repository: Object.freeze({
    owner: 'diligencefrozen',
    name: 'PayKR'
  }),
  githubAppClientId: 'Iv23livqurqR6EHy4elO',
  oauthWorkerUrl: '',
  apiVersion: '2022-11-28',
  forumMarker: 'paykr-forum:v1',
  pageSize: 20,
  maxIssuePages: 3,
  cacheTtlMs: 60_000,
  categories: Object.freeze([
    Object.freeze({ slug: 'free', label: '자유' }),
    Object.freeze({ slug: 'tips', label: '꿀팁' }),
    Object.freeze({ slug: 'question', label: '질문' }),
    Object.freeze({ slug: 'review', label: '후기' }),
    Object.freeze({ slug: 'saving', label: '절약' }),
    Object.freeze({ slug: 'work', label: '직장인' }),
    Object.freeze({ slug: 'student', label: '학생' }),
    Object.freeze({ slug: 'suggestion', label: '문의/건의' })
  ])
});
