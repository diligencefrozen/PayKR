import { issueLink } from '../src/services/feedback.js';

export function shellMarkup(type) {
  const skip = '<a class="skip" href="#main-content" data-i18n="common.skip"></a>';
  const pages = [['map', './', 'nav.explore'], ['online', './online.html', 'nav.online'], ['guide', './guide.html', 'nav.guide']];
  const links = pages.map(([page, path, key]) =>
    `<a href="${path}" data-page="${path}" ${page === type ? 'aria-current="page"' : ''} data-i18n="${key}"></a>`
  ).join('');
  const more = '<button type="button" data-more aria-haspopup="dialog" data-i18n="nav.more"></button>';
  const heading = (id, key) => `<div class="feedback-heading"><h2 id="${id}" data-i18n="${key}"></h2>
    <form method="dialog"><button class="feedback-close" data-i18n-aria-label="common.close">×</button></form></div>`;
  const notes = ['notice', 'releases'].map(key => `<button type="button" data-notes="${key}" aria-haspopup="dialog" data-i18n="map.${key}"></button>`).join('');
  const header = skip + `<div class="masthead"><div class="wrap"><a class="wordmark" href="./" data-page="./">Pay<span>KR</span></a>
    <nav class="top-nav" data-i18n-aria-label="common.navigation">${links}${more}</nav>
    <div class="header-actions"><select data-locale data-compact class="language" data-i18n-aria-label="common.language"></select>
    <select class="header-theme theme-choice" data-theme-choice data-i18n-aria-label="theme.label"><option value="system" data-i18n="theme.system"></option><option value="light" data-i18n="theme.light"></option><option value="dark" data-i18n="theme.dark"></option></select>
    <button class="header-install" data-install data-i18n="install.action" hidden></button></div></div></div>`;
  const footer = `<div class="app-dock"><div data-pwa-panel></div><nav class="bottom-nav" data-i18n-aria-label="common.navigation">${links}${more}</nav></div>
    <button class="feedback-trigger" id="feedback-open"><span data-i18n="feedback.open"></span></button>
    <dialog id="settings" aria-labelledby="settings-title">${heading('settings-title', 'nav.more')}<div class="settings-group">
      <label class="setting-row"><span data-i18n="theme.label"></span><select data-theme-choice>
      <option value="system" data-i18n="theme.system"></option><option value="light" data-i18n="theme.light"></option><option value="dark" data-i18n="theme.dark"></option></select></label>
      <button data-install data-i18n="install.action" hidden></button><button data-install-help data-i18n="install.iosGuide" hidden></button></div>
      <div class="settings-group">${notes}<a href="https://diligencefrozen.github.io/" lang="ko">PayKR · 한국어</a><a href="https://diligencefrozen.github.io/en/" lang="en">PayKR · English</a><a href="./brands.ko.html" lang="ko">애플페이 브랜드 목록</a><a href="./brands.html" lang="en">Apple Pay brand directory</a><a href="https://diligencefrozen.github.io/privacy.html" lang="ko">개인정보처리방침</a><a href="https://diligencefrozen.github.io/en/privacy.html" lang="en">Privacy policy</a><a href="./terms.html" hreflang="ko" data-i18n="common.terms"></a></div>
      <div class="settings-group"><button id="clear-cache" data-i18n="common.clearCache"></button><p id="cache-status" role="status"></p></div>
    </dialog>
    <dialog id="notice-dialog" aria-labelledby="notice-title">${heading('notice-title', 'map.notice')}
      <ul class="notice-list">${['notice.location','notice.building','notice.marker','map.sticker','notice.source'].map(key => `<li data-i18n="${key}"></li>`).join('')}</ul></dialog>
    <dialog id="releases-dialog" aria-labelledby="releases-title">${heading('releases-title', 'map.releases')}<div class="archive-years" id="release-archive"></div></dialog>
    <dialog id="feedback-dialog" aria-labelledby="feedback-title">
      <div class="feedback-heading"><h2 id="feedback-title" data-i18n="feedback.title"></h2>
      <form method="dialog"><button class="feedback-close" data-i18n-aria-label="common.close">×</button></form></div>
      <section aria-labelledby="issues-heading"><h3 id="issues-heading">GitHub Issues</h3>
      <p class="feedback-note" data-i18n="feedback.public"></p>
      <div id="issue-links">${['report', 'bug', 'feature', 'translation'].map(type =>
        `<a href="${issueLink(type)}" target="_blank" rel="noopener noreferrer" data-i18n="feedback.${type}"></a>`).join('')}</div></section>
      <button id="open-discord" class="chat-action" data-i18n="feedback.discord"></button>
      <p id="chat-error" class="feedback-note" role="status" data-i18n="feedback.unavailable" hidden></p>
      <a class="chat-action" id="discord-fallback" href="https://discord.com/channels/1574706452671504474/1574706454353412239" target="_blank" rel="noopener noreferrer" data-i18n="common.chatFallback" hidden></a></dialog>`;
  return { header, footer };
}
