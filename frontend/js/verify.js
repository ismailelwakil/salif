/* Salif account confirmation. Additive. Does not replace registration or the neighborhood map. */
'use strict';
(function () {
  function lang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }
  function t(key) {
    return (window.I18N && window.I18N[lang()] && window.I18N[lang()][key]) || (window.I18N && window.I18N.en[key]) || key;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg, kind) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    region.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 4200);
  }
  function mark(status) {
    if (status === 'VERIFIED' || status === 'SUBMITTED' || status === 'USER_CONFIRMED' || status === 'PASS' || status === 'CONFIRMED') return 'ok';
    if (status === 'NEEDS_ACTION' || status === 'MISMATCH' || status === 'FAIL') return 'bad';
    return '';
  }

  function view() {
    const S = window.Salif;
    if (!S || !S.isLoggedIn()) {
      return `<div class="page narrow"><div class="auth-wrap"><div class="auth-card">
        <h1>${esc(t('verify_title'))}</h1>
        <p class="sub">${esc(t('must_login') || t('sign_in'))}</p>
        <p class="auth-switch"><a href="#/login?next=%23%2Fverify">${esc(t('sign_in'))}</a></p>
      </div></div></div>`;
    }
    return `<div class="page narrow"><div class="auth-wrap auth-wide"><div class="auth-card verify-card">
      <h1>${esc(t('verify_title'))}</h1>
      <p class="sub">${esc(t('verify_sub'))}</p>
      <p class="field-hint">${esc(t('verify_ocr'))}</p>
      <p class="verify-status" id="verify-status">${esc(t('loading'))}</p>
      <div id="verify-steps"></div>
      <p class="auth-switch"><a href="#/dashboard?tab=bookings">${esc(t('verify_done'))}</a></p>
    </div></div></div>`;
  }

  function field(label, inner) {
    return `<div class="field"><label>${esc(label)}</label>${inner}</div>`;
  }

  function renderSteps(st) {
    const c = st.components || {};
    const note = st.prototype ? t('verify_proto') : t('verify_noconnect');
    const emailBody = `
      <p class="field-hint">${esc(note)}</p>
      <p class="chip-status ${mark(c.email)}">${esc(c.email || 'NOT_STARTED')}</p>
      <button class="btn btn-dark" type="button" id="v-email-send">${esc(t('verify_send'))}</button>
      <div class="verify-code" id="v-email-code" hidden></div>
      ${field(t('verify_code_ph'), '<input class="input" id="v-email-input" inputmode="numeric" autocomplete="one-time-code" dir="ltr">')}
      <button class="btn btn-primary" type="button" id="v-email-ok">${esc(t('verify_confirm'))}</button>`;
    const phoneBody = `
      <p class="field-hint">${esc(t('phone_hint'))}</p>
      <p class="chip-status ${mark(c.phone)}">${esc(c.phone || 'NOT_STARTED')}</p>
      ${field(t('phone_label'), '<input class="input" id="v-phone" inputmode="tel" autocomplete="tel" placeholder="' + esc(t('phone_ph')) + '" dir="ltr">')}
      <button class="btn btn-dark" type="button" id="v-phone-send">${esc(t('verify_send'))}</button>
      <div class="verify-code" id="v-phone-code" hidden></div>
      ${field(t('verify_code_ph'), '<input class="input" id="v-phone-input" inputmode="numeric" autocomplete="one-time-code" dir="ltr">')}
      <button class="btn btn-primary" type="button" id="v-phone-ok">${esc(t('verify_confirm'))}</button>`;
    const idBody = `
      <p class="field-hint">${esc(t('id_doc_hint'))} ${esc(t('verify_quality'))}</p>
      <p class="chip-status ${mark(c.government_id)}">${esc(c.government_id || 'NOT_STARTED')}</p>
      <label class="upload-btn" for="v-back">${esc(t('verify_back'))}</label>
      <input class="file-input" id="v-back" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">
      <label class="agree"><input type="checkbox" id="v-name"> <span>${esc(t('verify_name_ok'))}</span></label>
      <label class="agree"><input type="checkbox" id="v-nid"> <span>${esc(t('verify_nid_ok'))}</span></label>
      ${field(t('verify_dob'), '<input class="input" id="v-dob" type="date" dir="ltr">')}
      <p class="field-hint">${esc(t('verify_face'))} · ${esc(t('verify_live'))}</p>
      <button class="btn btn-primary" type="button" id="v-id-ok">${esc(t('verify_save'))}</button>`;
    const selfieBody = `
      <p class="field-hint">${esc(t('verify_selfie_hint'))}</p>
      <p class="chip-status ${mark(c.selfie)}">${esc(c.selfie || 'NOT_STARTED')}</p>
      <p class="chip-status">${esc(t('verify_face'))}</p>
      <p class="chip-status">${esc(t('verify_live'))}</p>
      <label class="upload-btn" for="v-selfie">${esc(t('verify_selfie'))}</label>
      <input class="file-input" id="v-selfie" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">`;
    const mapHtml = window.SalifMap ? window.SalifMap.renderPickerMap(st.neighborhood || '') : '';
    const addressBody = `
      <p class="field-hint">${esc(t('verify_address_hint'))}</p>
      <p class="chip-status ${mark(c.location)}">${esc(c.location || 'NOT_STARTED')}</p>
      ${field(t('verify_address_label'), '<textarea class="input" id="v-address" rows="2"></textarea>')}
      <div id="verify-map-wrap">${mapHtml}</div>
      <p class="selected-loc">${esc(t('selected_location'))}: <b id="v-loc-name">${esc(st.neighborhood || t('no_location_yet'))}</b></p>
      <input type="hidden" id="v-loc-id" value="">
      <button class="btn btn-primary" type="button" id="v-address-ok">${esc(t('verify_save'))}</button>`;
    const reviewBody = `
      <p class="field-hint">${esc(t('verify_sub'))}</p>
      <button class="btn btn-dark" type="button" id="v-review">${esc(t('verify_review'))}</button>`;
    return [
      section(1, t('verify_email'), emailBody, c.email === 'VERIFIED'),
      section(2, t('verify_phone'), phoneBody, c.phone === 'VERIFIED'),
      section(3, t('verify_id'), idBody, c.government_id === 'SUBMITTED' && c.name_match === 'USER_CONFIRMED'),
      section(4, t('verify_selfie'), selfieBody, c.selfie === 'SUBMITTED'),
      section(5, t('verify_address'), addressBody, c.location === 'CONFIRMED'),
      section(6, t('verify_review'), reviewBody, st.status === 'VERIFIED'),
    ].join('');
  }

  function section(n, title, body, done) {
    return `<section class="verify-step${done ? ' done' : ''}"><h2><span class="verify-num">${n}</span>${esc(title)}</h2>${body}</section>`;
  }

  async function refresh() {
    const st = await window.Salif.api('/api/verification');
    const statusEl = document.getElementById('verify-status');
    const steps = document.getElementById('verify-steps');
    if (!statusEl || !steps) return st;
    const identity = st.status === 'VERIFIED' ? t('badge_identity') : t('verify_not_identity');
    statusEl.textContent = t('verify_status') + ': ' + st.status + ' · ' + identity;
    steps.innerHTML = renderSteps(st);
    bind(st);
    return st;
  }

  function showCode(id, code) {
    const box = document.getElementById(id);
    if (!box || !code) return;
    box.hidden = false;
    box.textContent = code;
  }

  function bind() {
    const S = window.Salif;
    const emailSend = document.getElementById('v-email-send');
    if (!emailSend) return;
    emailSend.addEventListener('click', async () => {
      emailSend.disabled = true;
      try {
        const d = await S.api('/api/verification/email/send', { method: 'POST', body: {} });
        showCode('v-email-code', d.prototype_code);
        toast(d.delivery === 'prototype' ? t('verify_proto') : t('action_done'), 'ok');
      } catch (err) { toast(err.message, 'err'); }
      emailSend.disabled = false;
    });
    document.getElementById('v-email-ok').addEventListener('click', async () => {
      try {
        await S.api('/api/verification/email/confirm', { method: 'POST', body: { code: document.getElementById('v-email-input').value } });
        toast(t('action_done'), 'ok');
        await refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    document.getElementById('v-phone-send').addEventListener('click', async () => {
      const btn = document.getElementById('v-phone-send');
      btn.disabled = true;
      try {
        const d = await S.api('/api/verification/phone/send', { method: 'POST', body: { phone: document.getElementById('v-phone').value } });
        showCode('v-phone-code', d.prototype_code);
        toast(d.delivery === 'prototype' ? t('verify_proto') : t('action_done'), 'ok');
      } catch (err) { toast(err.message, 'err'); }
      btn.disabled = false;
    });
    document.getElementById('v-phone-ok').addEventListener('click', async () => {
      try {
        await S.api('/api/verification/phone/confirm', { method: 'POST', body: { code: document.getElementById('v-phone-input').value } });
        toast(t('action_done'), 'ok');
        await refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    document.getElementById('v-id-ok').addEventListener('click', async () => {
      const file = document.getElementById('v-back').files[0];
      if (!document.getElementById('v-name').checked || !document.getElementById('v-nid').checked || !document.getElementById('v-dob').value) {
        toast(t('required_field'), 'err');
        return;
      }
      try {
        if (file) await S.uploadVerification('id_back', file);
        await S.api('/api/verification/identity', {
          method: 'POST',
          body: {
            name_matches_id: document.getElementById('v-name').checked,
            national_id_matches: document.getElementById('v-nid').checked,
            date_of_birth: document.getElementById('v-dob').value,
          },
        });
        toast(t('action_done'), 'ok');
        await refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    document.getElementById('v-selfie').addEventListener('change', async () => {
      const file = document.getElementById('v-selfie').files[0];
      if (!file) return;
      try {
        await S.uploadVerification('selfie', file);
        toast(t('verify_face'), 'ok');
        await refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    document.getElementById('v-address-ok').addEventListener('click', async () => {
      try {
        await S.api('/api/verification/address', {
          method: 'POST',
          body: {
            address: document.getElementById('v-address').value,
            location_id: document.getElementById('v-loc-id').value,
          },
        });
        toast(t('action_done'), 'ok');
        await refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    document.getElementById('v-review').addEventListener('click', async () => {
      try {
        await S.api('/api/verification/review', { method: 'POST', body: { reason: 'Member requested review' } });
        toast(t('action_done'), 'ok');
        await refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
    bindMap();
  }

  function bindMap() {
    const map = document.getElementById('picker-map');
    const Map = window.SalifMap;
    if (!map || !Map) return;
    let pending = null;
    function markPending(p) {
      pending = p;
      map.querySelectorAll('.map-pin').forEach((pin) => pin.classList.toggle('on', pin.getAttribute('data-loc') === p.name));
      document.getElementById('v-loc-name').textContent = Map.pointLabel(p);
      document.getElementById('v-loc-id').value = p.id || '';
    }
    function nearest(lat, lng) {
      let best = Map.mapPoints()[0], bestD = Infinity;
      Map.mapPoints().forEach((p) => {
        const d = Math.hypot(p.lat - lat, p.lng - lng);
        if (d < bestD) { best = p; bestD = d; }
      });
      return best;
    }
    map.querySelectorAll('.map-pin[data-loc]').forEach((pin) => pin.addEventListener('click', (e) => {
      e.stopPropagation();
      markPending(Map.mapPoints().find((p) => p.name === pin.getAttribute('data-loc')));
    }));
    map.addEventListener('click', (e) => {
      if (e.target.closest('.map-pin')) return;
      const rect = map.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const lng = Number(map.dataset.minlng) + px * (Number(map.dataset.maxlng) - Number(map.dataset.minlng));
      const lat = Number(map.dataset.maxlat) - py * (Number(map.dataset.maxlat) - Number(map.dataset.minlat));
      markPending(nearest(lat, lng));
    });
  }

  view.after = async function () {
    if (!window.Salif || !window.Salif.isLoggedIn()) return;
    try {
      if (!(window.Salif.state.locations || []).length) {
        const d = await window.Salif.api('/api/locations', { auth: false });
        window.Salif.state.locations = d.locations || [];
      }
      await refresh();
    } catch (err) {
      const statusEl = document.getElementById('verify-status');
      if (statusEl) statusEl.textContent = err.message;
    }
  };

  window.SalifVerify = { view };
})();
