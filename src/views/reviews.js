import { el, button } from './dom.js';
import { deriveCommunityStatus, validSubmission } from '../models/reviews.js';
import { t, formatDate } from '../i18n/registry.js';

function paymentLabel(status) {
  if (status === 'available') return t('review.reportAvailableShort');
  if (status === 'unavailable') return t('review.reportUnavailableShort');
  return '';
}

// Renders the payment-report + visitor-review block into `host` for one place record.
// `summary` is the batch aggregate for this place; `requireAuth(action)` gates writes.
export function renderCommunity(host, record, { summary, reviewsService, requireAuth, onChanged }) {
  const status = summary ? deriveCommunityStatus(summary) : null;
  const section = el('section', undefined, 'community');

  const statusLine = el('p', undefined, 'community-status');
  if (status && status.success + status.fail > 0) {
    statusLine.append(el('strong', communityStatusText(status), 'community-badge'));
    if (status.status === 'conflict')
      statusLine.append(' ', el('small', t('review.conflictDetail', { success: status.success, fail: status.fail })));
    if (status.latestAt) statusLine.append(' ', el('small', formatDate(status.latestAt)));
  } else {
    statusLine.append(el('em', t('review.noneYet')));
  }
  section.append(statusLine);

  section.append(el('p', t('review.title'), 'community-ask'));
  const quick = el('div', undefined, 'community-actions');
  quick.append(
    button(t('review.available'), () => openCompose('available'), 'primary'),
    button(t('review.unavailable'), () => openCompose('unavailable'), 'secondary'),
  );
  section.append(quick);
  section.append(el('p', t('review.notice'), 'community-notice'));

  // Compose form (inline, hidden until a quick button opens it).
  const compose = el('form', undefined, 'community-compose');
  compose.hidden = true;
  const selector = el('div', undefined, 'community-selector');
  for (const value of ['available', 'unavailable', 'unspecified']) {
    const label = el('label', undefined, 'community-select');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'paykr-report-' + record.id;
    radio.value = value;
    label.append(radio, el('span', t('review.' + value)));
    selector.append(label);
  }
  compose.append(selector);
  const textarea = el('textarea');
  textarea.placeholder = t('review.contentPlaceholder');
  textarea.maxLength = 500;
  compose.append(textarea);
  const submitRow = el('div', undefined, 'community-submit');
  const submitBtn = button(t('review.submit'), null, 'primary');
  submitBtn.type = 'submit';
  submitRow.append(submitBtn, button(t('common.close'), () => (compose.hidden = true), 'secondary'));
  compose.append(submitRow);
  section.append(compose);

  let draftStatus = 'unspecified';
  function openCompose(status) {
    draftStatus = status;
    compose.hidden = false;
    for (const radio of compose.querySelectorAll('input[type=radio]')) radio.checked = radio.value === status;
    textarea.focus();
  }

  compose.onsubmit = (event) => {
    event.preventDefault();
    submitReport();
  };

  async function submitReport() {
    const content = textarea.value.trim();
    const paymentStatus = compose.querySelector('input[type=radio]:checked')?.value || draftStatus;
    if (!validSubmission({ paymentStatus, content })) return;
    submitBtn.disabled = true;
    submitBtn.textContent = t('review.writing');
    try {
      await reviewsService.submit({
        placeId: record.id,
        placeName: record.name,
        paymentStatus,
        content,
        clientRequestId: (crypto.randomUUID?.() || String(Date.now())),
      });
      textarea.value = '';
      compose.hidden = true;
      submitBtn.disabled = false;
      submitBtn.textContent = t('review.submit');
      onChanged();
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = t('review.submit');
      if (error.code === 'AUTH_REQUIRED') requireAuth(() => submitReport());
      else statusLine.textContent = t('review.failed');
    }
  }

  section.append(el('h3', t('review.reports'), 'community-heading'));
  const listHost = el('div', undefined, 'community-list');
  section.append(listHost);
  reviewsService
    .list(record.id)
    .then(({ items }) => {
      if (!items.length) listHost.append(el('p', t('review.empty'), 'community-empty'));
      for (const item of items) listHost.append(reviewRow(item));
    })
    .catch(() => {});

  function reviewRow(item) {
    const row = el('article', undefined, 'community-item');
    if (!item.content && item.paymentStatus !== 'unspecified') {
      row.classList.add('activity');
      row.append(
        el('strong', item.displayName),
        ' ',
        el('span', paymentLabel(item.paymentStatus), 'community-payment'),
        ' ',
        el('small', item.createdAt ? formatDate(item.createdAt) : ''),
      );
      return row;
    }
    const head = el('div', undefined, 'community-item-head');
    head.append(el('strong', item.displayName));
    if (item.paymentStatus !== 'unspecified') head.append(' ', el('span', paymentLabel(item.paymentStatus), 'community-payment'));
    head.append(' ', el('small', item.createdAt ? formatDate(item.createdAt) : ''));
    row.append(head);
    if (item.content) row.append(el('p', item.content));
    if (item.isMine) {
      const actions = el('div', undefined, 'community-item-actions');
      const del = button(t('review.delete'), async () => {
        try {
          await reviewsService.remove(item.messageId);
          onChanged();
        } catch {
          /* Keep the review; surface failure via the status line. */
        }
      });
      del.classList.add('linkish');
      actions.append(del);
      row.append(actions);
    }
    return row;
  }

  host.replaceChildren(section);
}

function communityStatusText(status) {
  if (status.status === 'conflict') return t('review.reportConflict');
  if (status.status === 'available') return t('review.reportAvailable');
  if (status.status === 'unavailable') return t('review.reportUnavailable');
  return '';
}
