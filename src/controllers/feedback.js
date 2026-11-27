import { $ } from '../views/dom.js';
import { openChat } from '../services/feedback.js';
export function feedback() {
  const dialog = $('feedback-dialog');
  function open() {
    if (!dialog.open) dialog.showModal();
  }
  async function chat() {
    const trigger = $('open-discord');
    if (trigger.disabled) return;
    const fromDialog = dialog.open;
    trigger.disabled = true;
    try {
      await openChat();
      dialog.close();
    } catch {
      if (fromDialog && !dialog.open) return;
      open();
      trigger.hidden = true;
      $('chat-error').hidden = false;
      $('discord-fallback').hidden = false;
      $('discord-fallback').focus();
    } finally {
      trigger.disabled = false;
    }
  }
  $('feedback-open').onclick = () => open();
  $('open-discord').onclick = chat;
  if (document.body.dataset.pageType === 'guide' && location.hash === '#feedback') open();
  if (new URLSearchParams(location.search).get('chat') === 'open') chat();
  return open;
}
