export class AdService {
  constructor(config, doc = document, net = navigator) {
    Object.assign(this, { config, doc, net });
    this.mounted = new WeakSet();
    this.preview = new URLSearchParams(doc.location.search).get('adpreview') === '1';
    this.allowed = false;
  }
  start(t) {
    this.t = t;
    this.mobile = window.matchMedia?.('(max-width:768px)');
    this.mobile?.addEventListener('change', () => this.render());
    this.refresh = () => this.render();
    this.unsubscribe = this.config.subscribeConsent((value) => {
      this.allowed = value === true;
      this.render();
    });
    window.addEventListener('online', this.refresh);
    window.addEventListener('offline', this.refresh);
    window.addEventListener('localechange', this.refresh);
    window.addEventListener('hashchange', this.refresh);
  }
  eligibleSlot(slot, count) {
    if (slot === 'directory-middle') return count >= 12;
    if (slot === 'directory-bottom') return count >= 8;
    if (slot === 'map') return !this.mobile?.matches && count >= 3;
    if (slot === 'map-mobile') return this.mobile?.matches && count >= 3;
    return count > 0;
  }
  show(count) {
    this.count = count;
    this.render();
  }
  render() {
    const operational = this.allowed && this.net.onLine && !this.preview;
    const sensitive = this.doc.location.hash === '#privacy' || this.doc.body.dataset.pageType === 'offline';
    const serving = operational && !sensitive;
    for (const box of this.doc.querySelectorAll('[data-slot]')) {
      const slot = box.dataset.slot,
        unit = this.config.slots[slot];
      const welcomePreview = slot === 'map' && this.preview && !this.mobile?.matches;
      const eligible = (welcomePreview || this.eligibleSlot(slot, this.count || 0)) && !sensitive;
      box.classList.add('ad-space');
      box.hidden = !eligible || !(this.preview || (serving && /^\d+$/.test(unit)));
      if (box.hidden) continue;
      if (this.preview) {
        box.textContent = this.t('advertisement.preview');
        continue;
      }
      if (this.mounted.has(box)) continue;
      this.mounted.add(box);
      const label = this.doc.createElement('small');
      label.textContent = this.t('advertisement.label');
      const ad = this.doc.createElement('ins');
      ad.className = 'adsbygoogle';
      ad.style.display = 'block';
      Object.assign(ad.dataset, {
        adClient: this.config.publisher,
        adSlot: unit,
        adFormat: 'auto',
        fullWidthResponsive: 'true',
      });
      box.replaceChildren(label, ad);
      if (!this.script) {
        this.script = this.doc.createElement('script');
        this.script.async = true;
        this.script.crossOrigin = 'anonymous';
        this.script.src =
          'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + this.config.publisher;
        this.script.onerror = () => {
          this.failed = true;
          this.doc.querySelectorAll('[data-slot]').forEach((el) => (el.hidden = true));
        };
        this.doc.head.append(this.script);
      }
      try {
        (window.adsbygoogle ||= []).push({});
      } catch {
        box.hidden = true;
      }
    }
    if (this.failed && !this.preview)
      this.doc.querySelectorAll('[data-slot]').forEach((el) => (el.hidden = true));
    if (
      serving &&
      this.count > 0 &&
      !this.recovery &&
      this.doc.body.dataset.pageType !== 'guide' &&
      this.config.recoveryEnabled &&
      this.config.mountOfficialRecovery
    ) {
      this.recovery = true;
      try {
        this.config.mountOfficialRecovery(this.doc.head);
      } catch {
        /* Provider failures leave exploration available. */
      }
    }
  }
}
