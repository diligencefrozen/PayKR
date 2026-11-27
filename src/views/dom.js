export const $ = (id) => document.getElementById(id);
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function button(text, click, className) {
  const node = el('button', text, className);
  node.type = 'button';
  node.addEventListener('click', click);
  return node;
}
export function link(text, url) {
  const node = el('a', text);
  node.href = url;
  if (url.startsWith('https://')) {
    node.rel = 'noopener noreferrer';
    node.target = '_blank';
  }
  return node;
}
export function badge(claim, t) {
  return el('span', t('status.' + claim.status), 'badge ' + claim.status);
}
