/* Public protection note. Does not decide eligibility and does not show a bound policy. */
'use strict';
(function () {
  function lang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }
  function t(key) {
    return (window.I18N && window.I18N[lang()] && window.I18N[lang()][key]) || (window.I18N && window.I18N.en[key]) || key;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  async function fill(slot, listingId) {
    if (!slot) return;
    slot.textContent = t('protection_loading');
    try {
      const data = await window.Salif.api('/api/listings/' + listingId + '/protection', { auth: false });
      const bound = data && data.protection_bound === true;
      slot.innerHTML = bound
        ? '<p class="protection-note">' + esc(t('protection_bound')) + '</p>'
        : '<p class="protection-note">' + esc(t('protection_unbound')) + '</p>';
    } catch (e) {
      slot.innerHTML = '<p class="protection-note">' + esc(t('protection_unbound')) + '</p>';
    }
  }
  window.SalifProtection = { fill };
})();
