// The operator supplies issued unit IDs and a verified, certified CMP integration.
export const advertising = {
  publisher: 'ca-pub-3313505766731703',
  slots: {
    map: null,
    'map-mobile': null,
    'directory-top': null,
    'directory-middle': null,
    'directory-bottom': null,
    guide: null,
  },
  recoveryEnabled: false,
  // Subscribe to a certified CMP's decision. Unknown, denied and revoked are false.
  subscribeConsent: (notify) => {
    notify(false);
    return () => {};
  },
  // Install the unmodified AdSense-issued recovery snippet on the approved page.
  mountOfficialRecovery: null,
};
