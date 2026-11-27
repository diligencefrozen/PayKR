const forms = {
  report: 'merchant.yml',
  feature: 'feature.yml',
  bug: 'bug.yml',
  translation: 'translation.yml',
};
export function issueLink(type, name = '') {
  const url = new URL('https://github.com/diligencefrozen/PayKR/issues/new');
  url.searchParams.set('template', forms[type]);
  if (type === 'report' && name)
    url.searchParams.set('title', '[Merchant] ' + name.replace(/[\u0000-\u001f]/g, ' ').slice(0, 120));
  return url.href;
}
let crate, loading;
export async function openChat() {
  if (!window.Crate) {
    loading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(fail, 9000);
      function fail() {
        clearTimeout(timer);
        script.remove();
        reject(new Error('Chat unavailable'));
      }
      script.src = 'https://cdn.jsdelivr.net/npm/@widgetbot/crate@3.9.1';
      script.async = true;
      script.onerror = fail;
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      document.head.append(script);
    }).catch((error) => {
      loading = null;
      throw error;
    });
    await loading;
  }
  if (!crate)
    crate = new window.Crate({
      server: '1574706452671504474',
      channel: '1574706454353412239',
      defer: true,
      notifications: false,
      indicator: false,
      // Crate scopes this CSS to its instance root and toggles .open on that root.
      // PayKR's feedback button is the launcher when the conversation is closed.
      css: '&:not(.open) { display: none; }',
      location: chatLocation(),
      color: '#5a55cf',
    });
  crate.show();
  crate.toggle(true);
}

let chatBottom = 132;
function chatLocation() {
  const trigger = document.getElementById('feedback-open').getBoundingClientRect();
  return [-chatBottom, -Math.ceil(innerWidth-trigger.left+8)];
}
export function positionChat(bottom) {
  chatBottom = bottom;
  crate?.setOptions?.({ location: chatLocation() });
}
