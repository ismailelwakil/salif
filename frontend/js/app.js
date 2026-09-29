/* Salif — main application: router, views, components */
'use strict';
(function () {
  const S = window.Salif;
  const main = document.getElementById('main');
  const modalRegion = document.getElementById('modal-region');

  /* ================= i18n ================= */
  function lang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }
  function t(key, params) {
    let s = (window.I18N[lang()] && window.I18N[lang()][key]) || window.I18N.en[key] || key;
    if (params) Object.keys(params).forEach((k) => { s = s.split('{' + k + '}').join(params[k]); });
    return s;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      el.textContent = t(k);
    });
    const brand = lang() === 'ar' ? 'سلف' : 'Salif';
    document.title = brand + (lang() === 'ar'
      ? ' — شارك الأدوات والمهارات مع جيرانك'
      : ' — Share tools and skills with your neighbors');
    const brandEl = document.getElementById('brand-name');
    const legalEl = document.getElementById('brand-legal');
    if (brandEl) brandEl.textContent = brand;
    if (legalEl) legalEl.textContent = brand;
    const brandLink = document.querySelector('.brand');
    if (brandLink) brandLink.setAttribute('aria-label', brand);
    const target = lang() === 'ar' ? 'EN' : 'عربي';
    document.getElementById('lang-toggle-label').textContent = target;
    document.getElementById('lang-toggle-footer-label').textContent = lang() === 'ar' ? 'English' : 'العربية';
  }
  function setLang(l) {
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('salif.lang', l); } catch (e) {}
    applyStaticI18n();
    renderRoute(); // re-render current view in new language
  }
  function toggleLang() { setLang(lang() === 'ar' ? 'en' : 'ar'); }

  /* ================= utils ================= */
  const LOCALES = { ar: 'ar-EG-u-nu-arab', en: 'en-GB' };
  function fmtNum(n) { return new Intl.NumberFormat(LOCALES[lang()]).format(n); }
  function fmtPrice(listing) {
    const p = Number(listing.price_per_day);
    if (!p) return null; // free
    return fmtNum(p) + ' ' + (lang() === 'ar' ? 'ج.م' : 'EGP');
  }
  function priceLine(listing) {
    const p = fmtPrice(listing);
    const unit = listing.type === 'SKILL' ? t('per_session') : t('per_day');
    if (!p) return `<b>${esc(t('price_free'))}</b>`;
    return `<b>${esc(p)}</b> / ${esc(unit)}`;
  }
  function fmtDate(d) {
    try {
      return new Intl.DateTimeFormat(LOCALES[lang()], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
    } catch (e) { return d; }
  }
  function todayISO() {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  }

  const CATEGORIES = ['tools', 'kitchen', 'electronics', 'sports', 'crafts', 'lessons', 'repairs', 'garden', 'cleaning'];
  const CAT_ICON = {
    tools: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L3.6 17.4a2 2 0 1 0 2.8 2.8l5.9-5.9a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.3-2.3 2.6-2.6z"/></svg>',
    kitchen: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16M5 11a7 7 0 0 0 14 0M12 4v2M9 4l.5 2M15 4l-.5 2M8 20h8M12 17v3"/></svg>',
    electronics: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="15" height="11" rx="2"/><circle cx="10" cy="12.5" r="3"/><path d="M17.5 10l3-1.5v6L17.5 13"/></svg>',
    sports: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="16.5" r="3.2"/><circle cx="17.5" cy="16.5" r="3.2"/><path d="M6.5 16.5 9 9h5l3.5 7.5M9 9 8 6.5h2.5M12.5 9l2 4h-5"/></svg>',
    crafts: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M7.8 16.2 19 4M16.2 16.2 5 4M12 11.5l1.2-1.3"/></svg>',
    lessons: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10.5 5 8 4.5 4 4.7v13.6c4-.2 6.5.3 8 1.7 1.5-1.4 4-1.9 8-1.7V4.7c-4-.2-6.5.3-8 1.8zM12 6.5V20"/></svg>',
    repairs: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 5.5 18.5 10.5M3.5 20.5l7-7M11 8 16 3l5 5-5 5-2-2M10.5 13.5l-3-3L3 15a2.1 2.1 0 0 0 3 3l4.5-4.5z"/></svg>',
    garden: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c0-5 0-9 0-9M12 12c0-3.5-2.5-6-6.5-6C5.5 9.5 8 12 12 12zM12 10c0-4 3-7 7.5-7C19.5 7.5 16.5 10 12 10z"/></svg>',
    cleaning: '<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 8h6l1 12H8L9 8zM10 8V5h4v3M12 5V3M6 9l-2.5 1M6 13H3M18 10l2.5 1M18 13h3"/></svg>',
  };
  const CAT_DEFAULT_IMG = {
    tools: '/img/tools-drill.jpg', kitchen: '/img/kitchen-mixer.jpg', electronics: '/img/camera.jpg',
    sports: '/img/bike.jpg', crafts: '/img/sewing.jpg', lessons: '/img/study-books.jpg',
    repairs: '/img/handyman.jpg', garden: '/img/garden-green.jpg', cleaning: '/img/cleaning.jpg',
  };
  const ALL_PHOTOS = [
    '/img/tools-drill.jpg', '/img/tools-toolbox.jpg', '/img/tools-pegboard.jpg', '/img/tools-ladder.jpg',
    '/img/kitchen-mixer.jpg', '/img/kitchen-cook.jpg', '/img/sewing.jpg', '/img/art-supplies.jpg',
    '/img/camera.jpg', '/img/projector.jpg', '/img/laptop-code.jpg', '/img/bike.jpg', '/img/tent.jpg',
    '/img/guitar.jpg', '/img/handyman.jpg', '/img/garden-green.jpg', '/img/cleaning.jpg', '/img/study-books.jpg',
  ];
  const NEIGHBORHOODS = ['El-Bahri', 'El-Gaish St.', 'Shanawan', 'El-Khadra', 'City Center', 'East Branch'];
  const DEMO_ACCOUNTS = [
    { email: 'demo@salif.app', name_ar: 'جارك التجريبي', name_en: 'Demo Neighbor' },
    { email: 'ahmed@salif.app', name_ar: 'أحمد حسن', name_en: 'Ahmed Hassan' },
    { email: 'mona@salif.app', name_ar: 'منى إبراهيم', name_en: 'Mona Ibrahim' },
    { email: 'sara@salif.app', name_ar: 'سارة عادل', name_en: 'Sara Adel' },
  ];

  /* ================= small components ================= */
  function stars(avg) {
    if (avg == null) return '';
    let out = '<span class="stars" aria-hidden="true">';
    for (let i = 1; i <= 5; i++) out += `<svg width="13" height="13" viewBox="0 0 24 24" class="${i <= Math.round(avg) ? 'on' : ''}" fill="${i <= Math.round(avg) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8z"/></svg>`;
    return out + '</span>';
  }

  function avatarHtml(profile, cls) {
    const name = S.profileName(profile, lang()) || '?';
    if (profile && profile.avatar_url) return `<span class="avatar ${cls || ''}"><img src="${esc(profile.avatar_url)}" alt=""></span>`;
    return `<span class="avatar ${cls || ''}">${esc(initials(lang() === 'en' && profile && profile.full_name_latin ? profile.full_name_latin : name))}</span>`;
  }

  function listingTitle(l) { return lang() === 'ar' ? (l.title_ar || l.title) : l.title; }
  function listingDesc(l) { return lang() === 'ar' ? (l.description_ar || l.description) : l.description; }

  function listingCard(l) {
    const rat = S.ratingFor(l.id);
    const fav = S.state.favorites.has(l.id);
    const ratingHtml = rat
      ? `<span class="lcard-rating">★ ${fmtNum(Math.round(rat.avg * 10) / 10)}</span>`
      : `<span class="lcard-rating muted">${esc(t('no_reviews'))}</span>`;
    const owner = S.state.profiles[l.owner_id];
    const metaBits = [l.location, t('cat_' + l.category)];
    if (owner) metaBits.push(S.profileName(owner, lang()));
    const badge = rat && rat.avg >= 4.7 && rat.count >= 2 ? `<span class="lcard-badge">${esc(t('guest_favorite'))}</span>` : '';
    return `
      <article class="lcard" data-goto="#/listing/${l.id}">
        <div class="lcard-img-wrap">
          <img class="lcard-img" loading="lazy" src="${esc(l.images[0] || CAT_DEFAULT_IMG[l.category] || '/img/tools-pegboard.jpg')}" alt="${esc(listingTitle(l))}">
          ${badge}
          <span class="type-tag">${esc(l.type === 'SKILL' ? t('skill_word') : t('item_word'))}</span>
          <button class="heart-btn" data-fav="${l.id}" aria-label="${esc(fav ? t('saved') : t('save'))}" aria-pressed="${fav}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${fav ? '#ff385c' : 'rgba(0,0,0,.35)'}" stroke="#fff" stroke-width="1.8"><path d="M12 20.8S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.5 2.7c0 5.8-8.5 11.2-8.5 11.2z"/></svg>
          </button>
        </div>
        <div class="lcard-title"><span class="t">${esc(listingTitle(l))}</span>${ratingHtml}</div>
        <div class="lcard-meta">${esc(metaBits.join(' · '))}</div>
        <div class="lcard-price">${priceLine(l)}</div>
      </article>`;
  }

  function skeletons(n, wrap) {
    let out = '';
    for (let i = 0; i < n; i++) out += `<div class="skel-card"><div class="skel skel-img"></div><div class="skel skel-line w80"></div><div class="skel skel-line w60"></div></div>`;
    return `<div class="${wrap}">${out}</div>`;
  }

  function emptyState(emoji, title, p, btnHtml) {
    return `<div class="state-box"><div class="emoji">${emoji}</div><h3>${esc(title)}</h3><p>${esc(p)}</p>${btnHtml || ''}</div>`;
  }

  /* toast */
  function toast(msg, kind) {
    const region = document.getElementById('toast-region');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    region.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 3200);
  }

  /* modal */
  function openModal(html) {
    modalRegion.innerHTML = `<div class="modal-overlay" role="dialog" aria-modal="true"><div class="modal">${html}</div></div>`;
    modalRegion.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) closeModal();
    });
    document.addEventListener('keydown', escClose);
    const f = modalRegion.querySelector('input,select,textarea,button:not([data-close])');
    if (f) f.focus();
  }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() { modalRegion.innerHTML = ''; document.removeEventListener('keydown', escClose); }

  function confirmModal(msg, onYes) {
    openModal(`
      <h3>${esc(msg)}</h3>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-soft btn-sm" data-close onclick="document.getElementById('modal-region').innerHTML=''">${esc(t('confirm_no'))}</button>
        <button class="btn btn-dark btn-sm" id="confirm-yes">${esc(t('confirm_yes'))}</button>
      </div>`);
    modalRegion.querySelector('#confirm-yes').addEventListener('click', () => { closeModal(); onYes(); });
  }

  /* ================= header ================= */
  function renderUserArea() {
    const area = document.getElementById('user-area');
    if (!S.isLoggedIn()) {
      area.innerHTML = `
        <a href="#/login" class="btn btn-soft btn-sm hidden-sm">${esc(t('sign_in'))}</a>
        <a href="#/register" class="btn btn-dark btn-sm">${esc(t('join'))}</a>`;
      return;
    }
    const p = S.me();
    const name = p ? S.profileName(p, lang()) : '';
    area.innerHTML = `
      <button class="user-chip" id="user-chip" aria-haspopup="menu" aria-expanded="false">
        <span class="chip-name">${esc(name)}</span>
        ${avatarHtml(p)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="user-menu" id="user-menu" hidden>
        <div class="menu-email">${esc((p && p.email) || '')}</div>
        <div class="sep"></div>
        <a href="#/dashboard?tab=bookings">${esc(t('tab_bookings'))}</a>
        <a href="#/dashboard?tab=listings">${esc(t('my_listings'))}</a>
        <a href="#/dashboard?tab=favorites">${esc(t('tab_favorites'))}</a>
        <a href="#/new">${esc(t('share_something'))}</a>
        <a href="#/verify">${esc(t('verify_menu'))}</a>
        <div class="sep"></div>
        <button id="logout-btn">${esc(t('sign_out'))}</button>
        <button id="delete-account-btn">${esc(t('delete_account'))}</button>
      </div>`;
    const chip = area.querySelector('#user-chip');
    const menu = area.querySelector('#user-menu');
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      chip.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', () => { menu.hidden = true; });
    area.querySelector('#logout-btn').addEventListener('click', () => {
      S.logout(); toast(t('bye_toast')); location.hash = '#/';
    });
    area.querySelector('#delete-account-btn').addEventListener('click', () => {
      confirmModal(t('delete_confirm'), async () => {
        try {
          await S.api('/api/me', { method: 'DELETE' });
          S.logout();
          toast(t('bye_toast'));
          location.hash = '#/';
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  function markHeaderTab() {
    document.querySelectorAll('.htab').forEach((a) => {
      const tab = a.getAttribute('data-tab');
      const h = location.hash;
      const qs = parseHashQuery();
      let active = false;
      if (h.startsWith('#/explore')) {
        if (tab === 'all' && !qs.type) active = true;
        if (tab === 'items' && qs.type === 'ITEM') active = true;
        if (tab === 'skills' && qs.type === 'SKILL') active = true;
      }
      a.classList.toggle('active', active);
    });
  }

  /* ================= router ================= */
  function parseHashQuery() {
    const qIdx = location.hash.indexOf('?');
    const out = {};
    if (qIdx >= 0) {
      const usp = new URLSearchParams(location.hash.slice(qIdx + 1));
      usp.forEach((v, k) => { out[k] = v; });
    }
    return out;
  }
  function navigate(hash) { location.hash = hash; }

  function renderRoute() {
    closeModal();
    const hash = location.hash || '#/';
    const path = hash.split('?')[0];
    document.body.classList.remove('has-mobile-cta');
    let view = viewNotFound, after = null, arg = null;
    if (path === '#/' || path === '' || path === '#') view = viewHome;
    else if (path === '#/explore') view = viewExplore;
    else if (path.startsWith('#/listing/')) { view = viewListing; arg = path.split('/')[2]; }
    else if (path === '#/how-it-works') view = viewHow;
    else if (path === '#/safety') view = viewSafety;
    else if (path === '#/login') view = viewLogin;
    else if (path === '#/register') view = viewRegister;
    else if (path === '#/forgot') view = viewForgot;
    else if (path === '#/terms') view = viewTerms;
    else if (path === '#/privacy') view = viewPrivacy;
    else if (path === '#/verify' && window.SalifVerify) { view = window.SalifVerify.view; }
    else if (path === '#/dashboard') view = viewDashboard;
    else if (path === '#/new') { view = viewListingForm; arg = null; }
    else if (path.startsWith('#/edit/')) { view = viewListingForm; arg = path.split('/')[2]; }
    else if (path.startsWith('#/member/')) { view = viewMember; arg = path.split('/')[2]; }
    main.innerHTML = arg !== undefined && view.length ? view(arg) : view();
    markHeaderTab();
    window.scrollTo(0, 0);
    after = view.after;
    if (after) after();
  }

  /* ================= home ================= */
  function viewHome() {
    const q = parseHashQuery();
    const listings = S.activeListings();
    const items = listings.filter((l) => l.type === 'ITEM');
    const skills = listings.filter((l) => l.type === 'SKILL');
    const loaded = S.state.loaded;

    const catGrid = CATEGORIES.map((c) => `
      <a class="cat-btn" href="#/explore?cat=${c}">${CAT_ICON[c]}<span>${esc(t('cat_' + c))}</span></a>`).join('');

    const featuredRow = !loaded ? skeletons(4, 'cards-row')
      : items.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10).map(listingCard).join('');
    const skillsRow = !loaded ? skeletons(4, 'cards-row')
      : skills.slice().sort((a, b) => (S.ratingFor(b.id)?.avg || 0) - (S.ratingFor(a.id)?.avg || 0)).map(listingCard).join('');

    /* stats from real data */
    const neighbors = Object.keys(S.state.profiles).length || 6;
    const nListings = listings.length;
    const completed = S.state.reviews.length;
    const saved = Math.round(listings.reduce((s, l) => s + (Number(l.price_per_day) || 0), 0) * 4);

    return `
    <div class="page" style="padding-top:0">
      <section class="hero">
        <span class="hero-kicker"><span class="dot"></span>${esc(t('hero_kicker'))}</span>
        <h1 class="h-display">${esc(t('hero_title'))}</h1>
        <p class="hero-sub">${esc(t('hero_sub'))}</p>

        <form class="search-capsule" id="hero-search" role="search">
          <div class="sc-field">
            <div class="sc-label">${esc(t('search_where'))}</div>
            <select id="hs-where" aria-label="${esc(t('search_where'))}">
              <option value="">${esc(t('search_where_ph'))}</option>
              ${NEIGHBORHOODS.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
            </select>
          </div>
          <div class="sc-field">
            <div class="sc-label">${esc(t('search_what'))}</div>
            <input id="hs-what" type="search" placeholder="${esc(t('search_what_ph'))}" value="${esc(q.q || '')}">
          </div>
          <div class="sc-field" style="max-width:190px">
            <div class="sc-label">${esc(t('search_type'))}</div>
            <select id="hs-type" aria-label="${esc(t('search_type'))}">
              <option value="">${esc(t('search_type_all'))}</option>
              <option value="ITEM">${esc(t('search_type_item'))}</option>
              <option value="SKILL">${esc(t('search_type_skill'))}</option>
            </select>
          </div>
          <div class="sc-submit-wrap">
            <button class="sc-submit" type="submit" aria-label="${esc(t('search_btn'))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </button>
          </div>
        </form>

        <div class="quick-chips">
          ${['tools', 'kitchen', 'electronics', 'lessons'].map((c) => `<a class="chip" href="#/explore?cat=${c}">${CAT_ICON[c].replace('class="cat-icon"', 'width="16" height="16"')} ${esc(t('cat_' + c))}</a>`).join('')}
          <a class="chip" href="#/explore?type=SKILL">${esc(t('nav_skills'))} →</a>
        </div>
      </section>

      <section class="section" style="margin-top:48px">
        <div class="section-head"><h2 class="section-title">${esc(t('cat_title'))}</h2></div>
        <div class="cat-grid">${catGrid}</div>
      </section>

      <section class="section">
        <div class="section-head">
          <div><h2 class="section-title">${esc(t('featured_title'))}</h2><div class="section-sub">${esc(t('featured_sub'))}</div></div>
          <a class="btn btn-soft btn-sm" href="#/explore?type=ITEM">${esc(t('see_all'))}</a>
        </div>
        <div class="row-wrap">
          <div class="cards-row" id="row-items">${featuredRow}</div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div><h2 class="section-title">${esc(t('skills_title'))}</h2><div class="section-sub">${esc(t('skills_sub'))}</div></div>
          <a class="btn btn-soft btn-sm" href="#/explore?type=SKILL">${esc(t('see_all'))}</a>
        </div>
        <div class="row-wrap">
          <div class="cards-row" id="row-skills">${skillsRow}</div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><div><h2 class="section-title">${esc(t('how_title'))}</h2><div class="section-sub">${esc(t('how_sub'))}</div></div></div>
        <div class="steps">
          ${[['1', 'how1_t', 'how1_p'], ['2', 'how2_t', 'how2_p'], ['3', 'how3_t', 'how3_p']].map(([n, tk, pk]) => `
            <div class="step-card"><div class="step-num">${n}</div><h3>${esc(t(tk))}</h3><p>${esc(t(pk))}</p></div>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="trust-band">
          <div>
            <h2>${esc(t('trust_title'))}</h2>
            <p>${esc(t('trust_p'))}</p>
            <a class="btn btn-primary" href="#/safety">${esc(t('learn_safety'))}</a>
          </div>
          <div class="trust-list">
            ${[['trust1_t', 'trust1_p'], ['trust2_t', 'trust2_p'], ['trust3_t', 'trust3_p'], ['trust4_t', 'trust4_p']].map(([tk, pk]) => `
              <div class="trust-item">
                <span class="tick"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m4.5 12.5 5 5 10-11"/></svg></span>
                <div><b>${esc(t(tk))}</b><span>${esc(t(pk))}</span></div>
              </div>`).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="stats-row">
          <div class="stat-card"><div class="num">${fmtNum(neighbors)}</div><div class="lbl">${esc(t('stats_neighbors'))}</div></div>
          <div class="stat-card"><div class="num">${fmtNum(nListings)}</div><div class="lbl">${esc(t('stats_listings'))}</div></div>
          <div class="stat-card"><div class="num">${fmtNum(completed)}</div><div class="lbl">${esc(t('stats_exchanges'))}</div></div>
          <div class="stat-card"><div class="num">${fmtNum(saved)} ${lang() === 'ar' ? 'ج.م' : 'EGP'}</div><div class="lbl">${esc(t('stats_saved'))}</div></div>
        </div>
      </section>

      <section class="section" style="margin-bottom:8px">
        <div class="cta-band">
          <h2>${esc(t('cta_title'))}</h2>
          <p>${esc(t('cta_p'))}</p>
          <a class="btn btn-primary btn-lg" href="${S.isLoggedIn() ? '#/new' : '#/register'}">${esc(t('cta_btn'))}</a>
        </div>
      </section>
    </div>`;
  }
  viewHome.after = function () {
    const form = document.getElementById('hero-search');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('hs-what').value.trim();
      const type = document.getElementById('hs-type').value;
      const loc = document.getElementById('hs-where').value;
      const usp = new URLSearchParams();
      if (q) usp.set('q', q); if (type) usp.set('type', type); if (loc) usp.set('loc', loc);
      navigate('#/explore' + (usp.toString() ? '?' + usp.toString() : ''));
    });
  };

  /* ================= explore ================= */
  function viewExplore() {
    const q = parseHashQuery();
    const type = q.type || '';
    const cat = q.cat || '';
    const search = (q.q || '').toLowerCase();
    const loc = q.loc || '';
    const sort = q.sort || 'newest';

    let list = S.activeListings().filter((l) => {
      if (type && l.type !== type) return false;
      if (cat && l.category !== cat) return false;
      if (loc && l.location !== loc) return false;
      if (search) {
        const hay = [l.title, l.title_ar, l.description, l.description_ar, l.category, l.location].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    if (sort === 'price_low') list.sort((a, b) => (Number(a.price_per_day) || 0) - (Number(b.price_per_day) || 0));
    else if (sort === 'price_high') list.sort((a, b) => (Number(b.price_per_day) || 0) - (Number(a.price_per_day) || 0));
    else if (sort === 'rating') list.sort((a, b) => (S.ratingFor(b.id)?.avg || 0) - (S.ratingFor(a.id)?.avg || 0));
    else list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    const chips = [];
    if (type) chips.push({ label: type === 'ITEM' ? t('search_type_item') : t('search_type_skill'), clear: { ...q, type: undefined } });
    if (cat) chips.push({ label: t('cat_' + cat), clear: { ...q, cat: undefined } });
    if (loc) chips.push({ label: loc, clear: { ...q, loc: undefined } });
    if (search) chips.push({ label: `“${q.q}”`, clear: { ...q, q: undefined } });

    function buildHash(over) {
      const merged = { ...q, ...over };
      const usp = new URLSearchParams();
      Object.keys(merged).forEach((k) => { if (merged[k]) usp.set(k, merged[k]); });
      const s = usp.toString();
      return '#/explore' + (s ? '?' + s : '');
    }

    const grid = !S.state.loaded ? skeletons(8, 'cards-grid')
      : list.length ? `<div class="cards-grid">${list.map(listingCard).join('')}</div>`
      : emptyState('🔍', t('empty_title'), t('empty_p'), `
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <a class="btn btn-dark btn-sm" href="#/explore">${esc(t('empty_btn'))}</a>
            <a class="btn btn-ghost btn-sm" href="#/new">${esc(t('empty_btn2'))}</a>
          </div>`);

    return `
    <div class="page">
      <h1 class="h-page" style="margin-bottom:8px">${esc(t('explore_title'))}</h1>
      <div class="explore-toolbar">
        <div class="toolbar-row">
          <form class="search-inline" id="ex-search" role="search">
            <input type="search" id="ex-q" placeholder="${esc(t('search_what_ph'))}" value="${esc(q.q || '')}" aria-label="${esc(t('search_what'))}">
            <button class="go" type="submit" aria-label="${esc(t('search_btn'))}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </button>
          </form>
          <div class="seg" role="tablist" aria-label="${esc(t('search_type'))}">
            <button data-type="" class="${!type ? 'on' : ''}">${esc(t('nav_all'))}</button>
            <button data-type="ITEM" class="${type === 'ITEM' ? 'on' : ''}">${esc(t('nav_items'))}</button>
            <button data-type="SKILL" class="${type === 'SKILL' ? 'on' : ''}">${esc(t('nav_skills'))}</button>
          </div>
          <div class="select-wrap">
            <select id="ex-cat" aria-label="${esc(t('category_label'))}">
              <option value="">${esc(t('all_categories'))}</option>
              ${CATEGORIES.map((c) => `<option value="${c}" ${cat === c ? 'selected' : ''}>${esc(t('cat_' + c))}</option>`).join('')}
            </select>
          </div>
          <div class="select-wrap">
            <select id="ex-loc" aria-label="${esc(t('search_where'))}">
              <option value="">${esc(t('search_where_ph'))}</option>
              ${NEIGHBORHOODS.map((n) => `<option value="${esc(n)}" ${loc === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}
            </select>
          </div>
          <div class="select-wrap" style="margin-inline-start:auto">
            <select id="ex-sort" aria-label="${esc(t('sort_label'))}">
              <option value="newest" ${sort === 'newest' ? 'selected' : ''}>${esc(t('sort_newest'))}</option>
              <option value="price_low" ${sort === 'price_low' ? 'selected' : ''}>${esc(t('sort_price_low'))}</option>
              <option value="price_high" ${sort === 'price_high' ? 'selected' : ''}>${esc(t('sort_price_high'))}</option>
              <option value="rating" ${sort === 'rating' ? 'selected' : ''}>${esc(t('sort_rating'))}</option>
            </select>
          </div>
        </div>
        ${chips.length ? `<div class="quick-chips" style="justify-content:flex-start;margin-top:12px">
          ${chips.map((c, i) => `<a class="chip active" data-clear="${i}" href="${buildHash(c.clear)}">${esc(c.label)} ✕</a>`).join('')}
          <a class="chip" href="#/explore">${esc(t('clear_all'))}</a>
        </div>` : ''}
      </div>
      <div class="results-meta">${esc(t('results_count').replace('{n}', fmtNum(list.length)))}</div>
      ${grid}
    </div>`;
  }
  viewExplore.after = function () {
    const q = parseHashQuery();
    function go(over) {
      const merged = { ...q, ...over };
      const usp = new URLSearchParams();
      Object.keys(merged).forEach((k) => { if (merged[k]) usp.set(k, merged[k]); });
      const s = usp.toString();
      navigate('#/explore' + (s ? '?' + s : ''));
    }
    const sf = document.getElementById('ex-search');
    if (sf) sf.addEventListener('submit', (e) => { e.preventDefault(); go({ q: document.getElementById('ex-q').value.trim() || undefined }); });
    document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => go({ type: b.getAttribute('data-type') || undefined })));
    const c = document.getElementById('ex-cat'); if (c) c.addEventListener('change', () => go({ cat: c.value || undefined }));
    const l = document.getElementById('ex-loc'); if (l) l.addEventListener('change', () => go({ loc: l.value || undefined }));
    const s = document.getElementById('ex-sort'); if (s) s.addEventListener('change', () => go({ sort: s.value === 'newest' ? undefined : s.value }));
  };

  /* ================= listing detail ================= */
  function viewListing(id) {
    if (!S.state.loaded) return `<div class="page">${skeletons(2, 'cards-grid')}</div>`;
    const l = S.listingById(id);
    if (!l) return viewNotFound();
    const owner = S.state.profiles[l.owner_id];
    const reviews = S.reviewsFor(l.id);
    const rat = S.ratingFor(l.id);
    const fav = S.state.favorites.has(l.id);
    const isOwner = S.isLoggedIn() && S.me() && l.owner_id === S.me().id;
    const similar = S.activeListings().filter((x) => x.id !== l.id && (x.category === l.category || x.location === l.location)).slice(0, 4);
    const min = todayISO();

    const ownerRating = (() => {
      const ids = S.state.listings.filter((x) => x.owner_id === l.owner_id).map((x) => x.id);
      const rs = S.state.reviews.filter((r) => ids.includes(r.listing_id));
      if (!rs.length) return null;
      return rs.reduce((s, r) => s + r.rating, 0) / rs.length;
    })();

    const gallery = (l.images && l.images.length ? l.images : [CAT_DEFAULT_IMG[l.category] || '/img/tools-pegboard.jpg']);

    const bookingCardHtml = isOwner ? `
        <div class="booking-card">
          <div class="bc-price">${priceLine(l)}</div>
          <div id="protection-slot"></div>
          <p class="muted" style="margin-bottom:16px">${esc(t('own_listing_note'))}</p>
          <a class="btn btn-dark btn-block" href="#/edit/${l.id}">${esc(t('edit'))}</a>
        </div>`
      : `
        <div class="booking-card">
          <div class="bc-price">${priceLine(l)}</div>
          <div id="protection-slot"></div>
          ${l.status !== 'ACTIVE' ? `<p class="muted">${esc(t('not_available'))}</p>` : S.isLoggedIn() ? `
          <form id="booking-form" novalidate>
            <div class="dates-2">
              <div class="field"><label for="bk-from">${esc(t('date_from'))}</label>
                <input class="input" type="date" id="bk-from" min="${min}" required></div>
              <div class="field"><label for="bk-to">${esc(t('date_to'))}</label>
                <input class="input" type="date" id="bk-to" min="${min}" required></div>
            </div>
            <div class="field"><label for="bk-msg">${esc(t('message_label'))}</label>
              <textarea class="input" id="bk-msg" rows="3" placeholder="${esc(t('message_ph'))}"></textarea></div>
            <button class="btn btn-primary btn-block btn-lg" type="submit" style="border-radius:9999px">${esc(t('request_btn'))}</button>
          </form>` : `
          <a class="btn btn-primary btn-block btn-lg" href="#/login?next=${encodeURIComponent('#/listing/' + l.id)}" style="border-radius:9999px">${esc(t('must_login'))}</a>`}
          <div class="safety-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 5-3.4 8.3-7 10-3.6-1.7-7-5-7-10V6z"/></svg>
            <span>${esc(t('trust3_p'))}</span>
          </div>
        </div>`;

    return `
    <div class="page">
      <div class="breadcrumb">
        <a href="#/">Salif</a> · <a href="#/explore">${esc(t('detail_browse'))}</a> · <a href="#/explore?cat=${esc(l.category)}">${esc(t('cat_' + l.category))}</a>
      </div>
      <div class="detail-grid">
        <div>
          <h1 class="detail-title">${esc(listingTitle(l))}</h1>
          <div class="detail-meta">
            <span class="pill ${l.type === 'SKILL' ? 'rausch' : ''}">${esc(l.type === 'SKILL' ? t('skill_word') : t('item_word'))}</span>
            <span class="pill">${esc(t('location_word'))}: ${esc(l.location)}</span>
            ${rat ? `<span class="pill">★ ${fmtNum(Math.round(rat.avg * 10) / 10)} · ${fmtNum(rat.count)} ${esc(t('reviews_word'))}</span>` : ''}
            <button class="pill" data-fav="${l.id}" style="cursor:pointer" aria-pressed="${fav}">${fav ? '♥ ' + esc(t('saved')) : '♡ ' + esc(t('save'))}</button>
          </div>

          <img class="gallery-main" id="gallery-main" src="${esc(gallery[0])}" alt="${esc(listingTitle(l))}">
          ${gallery.length > 1 ? `<div class="gallery-thumbs">
            ${gallery.map((g, i) => `<img src="${esc(g)}" class="${i === 0 ? 'sel' : ''}" data-gi="${i}" alt="">`).join('')}
          </div>` : ''}

          <h2 class="section-title" style="margin:32px 0 12px">${lang() === 'ar' ? 'الوصف' : 'About this listing'}</h2>
          <div class="detail-desc">${esc(listingDesc(l))}</div>

          <div class="owner-card">
            ${avatarHtml(owner, 'lg')}
            <div class="oc-info">
              <b>${esc(t('offered_by'))} ${esc(S.profileName(owner, lang()))}</b>
              <span>${esc(t('member_since').replace('{n}', owner ? owner.neighborhood : l.location))}${ownerRating ? ` · ★ ${fmtNum(Math.round(ownerRating * 10) / 10)}` : ''}</span>
            </div>
            ${owner ? `<a class="btn btn-soft btn-sm" style="margin-inline-start:auto" href="#/member/${owner.id}">${lang() === 'ar' ? 'الملف' : 'Profile'}</a>` : ''}
          </div>

          <section id="reviews">
            <div class="rating-summary">
              <h2 class="section-title" style="margin:0">${esc(t('reviews_title'))}</h2>
              ${rat ? `<span class="big">★ ${fmtNum(Math.round(rat.avg * 10) / 10)}</span><span class="muted">(${fmtNum(rat.count)})</span>` : ''}
            </div>
            ${reviews.length ? reviews.map((r) => {
              const a = S.state.profiles[r.author_id];
              return `<div class="review-item">
                <div class="review-head">
                  ${avatarHtml(a)}
                  <div><b>${esc(S.profileName(a, lang()))}</b> <time class="muted"> · ${esc(fmtDate(r.created_at))}</time></div>
                  <span style="margin-inline-start:auto">${stars(r.rating)}</span>
                </div>
                <p class="review-text">${esc(r.comment)}</p>
              </div>`;
            }).join('') : `<p class="muted" style="padding:12px 0">${esc(t('no_reviews_yet'))}</p>`}
            ${S.isLoggedIn() && !isOwner ? `
              <form id="review-form" style="margin-top:20px">
                <div class="field">
                  <label>${esc(t('write_review'))}</label>
                  <div id="star-input" style="margin-bottom:8px" role="radiogroup" aria-label="${esc(t('write_review'))}">
                    ${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-star="${i}" style="font-size:26px;color:#c1c1c1;padding:2px" aria-label="${i}">★</button>`).join('')}
                  </div>
                  <textarea class="input" id="rv-text" rows="2" placeholder="${esc(t('review_ph'))}"></textarea>
                </div>
                <button class="btn btn-dark btn-sm" type="submit">${esc(t('submit_review'))}</button>
              </form>` : (!S.isLoggedIn() ? `<p class="muted" style="margin-top:12px"><a href="#/login" style="text-decoration:underline;font-weight:600">${esc(t('review_login'))}</a></p>` : '')}
          </section>
        </div>
        <div>${bookingCardHtml}</div>
      </div>

      ${similar.length ? `
      <section class="section" style="margin-top:48px">
        <div class="section-head"><h2 class="section-title">${esc(t('similar_title'))}</h2></div>
        <div class="cards-grid">${similar.map(listingCard).join('')}</div>
      </section>` : ''}

      <div style="margin-top:24px;text-align:end">
        <button class="btn btn-soft btn-sm" id="report-btn">${esc(t('report_listing'))}</button>
      </div>

      <div class="mobile-cta">
        <div><div style="font-weight:700">${priceLine(l)}</div></div>
        ${isOwner ? `<a class="btn btn-primary" href="#/edit/${l.id}">${esc(t('edit'))}</a>`
          : S.isLoggedIn() ? `<button class="btn btn-primary" id="m-cta">${esc(t('request_btn'))}</button>`
          : `<a class="btn btn-primary" href="#/login?next=${encodeURIComponent('#/listing/' + l.id)}">${esc(t('sign_in'))}</a>`}
      </div>`;
  }
  viewListing.after = function () {
    const id = (location.hash.split('?')[0] || '').split('/')[2];
    if (window.SalifProtection) window.SalifProtection.fill(document.getElementById('protection-slot'), id);
    document.body.classList.add('has-mobile-cta');
    const thumbs = document.querySelectorAll('.gallery-thumbs img');
    thumbs.forEach((im) => im.addEventListener('click', () => {
      document.getElementById('gallery-main').src = im.src;
      thumbs.forEach((x) => x.classList.remove('sel'));
      im.classList.add('sel');
    }));
    const bf = document.getElementById('booking-form');
    if (bf) bf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('bk-from').value;
      const to = document.getElementById('bk-to').value;
      const msg = document.getElementById('bk-msg').value.trim();
      if (!from || !to || to < from) { toast(t('booking_conflict'), 'err'); return; }
      const btn = bf.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await S.api('/api/bookings', { method: 'POST', body: { listing_id: id, start_date: from, end_date: to, message: msg } });
        toast(t('booking_success'), 'ok');
        navigate('#/dashboard?tab=bookings');
      } catch (err) {
        btn.disabled = false;
        toast(err.status === 409 ? t('booking_conflict') : (err.code === 'VERIFICATION_REQUIRED' ? t('verify_required') : err.message), 'err');
      }
    });
    const mc = document.getElementById('m-cta');
    if (mc) mc.addEventListener('click', () => {
      document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    let selStars = 5;
    const starInput = document.getElementById('star-input');
    if (starInput) {
      const paint = () => starInput.querySelectorAll('button').forEach((b) => {
        b.style.color = Number(b.getAttribute('data-star')) <= selStars ? '#ff385c' : '#c1c1c1';
      });
      paint();
      starInput.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { selStars = Number(b.getAttribute('data-star')); paint(); }));
      document.getElementById('review-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const comment = document.getElementById('rv-text').value.trim();
        try {
          await S.api('/api/reviews', { method: 'POST', body: { listing_id: id, rating: selStars, comment } });
          toast(t('review_posted'), 'ok');
          renderRoute();
        } catch (err) { toast(err.message, 'err'); }
      });
    }
    const rp = document.getElementById('report-btn');
    if (rp) rp.addEventListener('click', () => toast(t('reported'), 'ok'));
  };

  /* ================= static pages ================= */
  function viewHow() {
    const L = lang();
    return `
    <div class="page narrow">
      <h1 class="h-page" style="margin-bottom:24px">${esc(t('how_page_title'))}</h1>
      <div class="steps" style="margin-bottom:40px">
        ${[['1', 'how1_t', 'how1_p'], ['2', 'how2_t', 'how2_p'], ['3', 'how3_t', 'how3_p']].map(([n, tk, pk]) => `
          <div class="step-card"><div class="step-num">${n}</div><h3>${esc(t(tk))}</h3><p>${esc(t(pk))}</p></div>`).join('')}
      </div>
      <div class="prose">
        ${L === 'ar' ? `
          <h2>ليه سلف؟</h2>
          <p>كل بيت فيه أدوات بتستخدم مرة في السنة: دريل، سُلّم، عجّان، خيمة. بدل ما كل جار يشتري نسخة، بنشارك اللي عندنا — بنوفر فلوس، بنقلل نفايات، وبنعرف جيراننا أكتر.</p>
          <h2>إزاي بتتم العمليات؟</h2>
          <ul>
            <li>الجار صاحب الإعلان بيستقبل طلبك وبيوافق عليه أو بيرفضه.</li>
            <li>بعد الموافقة بتتفقوا على مكان الاستلام — التفاصيل بتفضل بينكم.</li>
            <li>بعد ما العملية تكتمل، كل طرف يقدر يسيّب تقييم للطرف التاني.</li>
          </ul>
          <div class="tip"><b>نصيحة:</b> الإعلانات اللي فيها صور واضحة ووصف صادق بتاخد طلبات أكتر بكتير.</div>
          <h2>هل لازم أدفع؟</h2>
          <p>مفيش أي عمولات على سلف. صاحب الإعلان هو اللي بيحدد إذا كان هيشارك الحاجة مجانًا أو بسعر رمزي لليوم أو الجلسة.</p>`
        : `
          <h2>Why Salif?</h2>
          <p>Every home owns things used once a year: a drill, a ladder, a mixer, a tent. Instead of every neighbor buying their own, we share what we already have — saving money, cutting waste, and actually getting to know the people next door.</p>
          <h2>How do exchanges work?</h2>
          <ul>
            <li>The owner receives your booking request and accepts or declines it.</li>
            <li>Once accepted, you agree on a handover spot — the details stay between you.</li>
            <li>After the exchange completes, both sides can leave a review.</li>
          </ul>
          <div class="tip"><b>Tip:</b> Listings with clear photos and honest descriptions receive far more requests.</div>
          <h2>Do I have to pay?</h2>
          <p>Salif charges no commissions. Owners decide whether to share for free or set a small price per day or session.</p>`}
      </div>
    </div>`;
  }

  function viewSafety() {
    const L = lang();
    return `
    <div class="page narrow">
      <h1 class="h-page" style="margin-bottom:24px">${esc(t('safety_page_title'))}</h1>
      <div class="prose">
        ${L === 'ar' ? `
          <h2>الثقة أولًا</h2>
          <p>سلف مبني على إن الجيران يتعاملوا بأمان. العضوية مربوطة بحيّ حقيقي، وكل عملية ليها سجل وتقييمات علنية.</p>
          <h2>قواعد المجتمع</h2>
          <ul>
            <li>اتعامل بصدق: صِف حاجة زي ما هي بالظبط.</li>
            <li>احترم المواعيد — لو فيه تأخير، بلّغ بدري.</li>
            <li>حافظ على الأدوات كأنها بتاعتك وردّها بنفس الحالة.</li>
            <li>التواصل كله جوه سلف عشان يفضل فيه سجل يحمي الكل.</li>
          </ul>
          <h2>خصوصية المكان</h2>
          <p>الإعلانات بتعرض الحي بس، من غير عناوين دقيقة. العنوان التفصيلي بيتشارك فقط بين طرفين الحجز بعد التأكيد.</p>
          <h2>الإبلاغ</h2>
          <p>شفت حاجة مش مناسبة؟ استخدم زر «الإبلاغ» الموجود في أي إعلان. فريق الإشراف بيراجع البلاغات وبيوصل لقرار بسرعة، وكل إجراء بيتسجل.</p>
          <div class="tip">لو حسيت إن تعامل غير آمن، أوقفه فورًا وبلّغنا. سلامتك أهم من أي أداة.</div>`
        : `
          <h2>Trust first</h2>
          <p>Salif is built so neighbors can deal safely. Membership is tied to a real neighborhood, and every exchange leaves a public record of reviews.</p>
          <h2>Community rules</h2>
          <ul>
            <li>Be honest: describe things exactly as they are.</li>
            <li>Respect agreed times — if something changes, say so early.</li>
            <li>Treat borrowed items like your own and return them in the same condition.</li>
            <li>Keep coordination inside Salif so there is always a record that protects everyone.</li>
          </ul>
          <h2>Location privacy</h2>
          <p>Listings show the neighborhood only — never exact addresses. Precise handover locations are shared only between confirmed booking participants.</p>
          <h2>Reporting</h2>
          <p>See something wrong? Use the Report button on any listing. Moderators review reports quickly, and every action is logged.</p>
          <div class="tip">If an exchange ever feels unsafe, stop it immediately and report it. Your safety matters more than any tool.</div>`}
      </div>
    </div>`;
  }

  /* ================= auth ================= */
  function viewLogin() {
    return `
    <div class="page narrow">
      <div class="auth-wrap">
        <div class="auth-card">
          <h1>${esc(t('login_title'))}</h1>
          <p class="sub">${esc(t('login_sub'))}</p>
          <form id="login-form" novalidate>
            <div class="field"><label for="li-email">${esc(t('email_label'))}</label>
              <input class="input" type="email" id="li-email" autocomplete="email" dir="ltr" required></div>
            <div class="field"><label for="li-pass">${esc(t('password_label'))}</label>
              <input class="input" type="password" id="li-pass" autocomplete="current-password" dir="ltr" required></div>
            <button class="btn btn-primary btn-block" type="submit" style="border-radius:9999px">${esc(t('login_btn'))}</button>
          </form>
          <p class="auth-switch"><a href="#/forgot">${esc(t('forgot_link'))}</a></p>
          <div class="divider">${esc(t('demo_title'))}</div>
          <div class="demo-grid">
            ${DEMO_ACCOUNTS.map((d) => `<button class="demo-btn" data-demo="${d.email}">${avatarHtml({ full_name: lang() === 'ar' ? d.name_ar : d.name_en, full_name_latin: d.name_en })} ${esc(lang() === 'ar' ? d.name_ar : d.name_en)}</button>`).join('')}
          </div>
          <p class="auth-switch">${esc(t('no_account'))} <a href="#/register">${esc(t('create_one'))}</a></p>
        </div>
      </div>
    </div>`;
  }
  viewLogin.after = function () {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('li-email').value.trim();
      const pass = document.getElementById('li-pass').value;
      if (!/.+@.+\..+/.test(email)) return toast(t('invalid_email'), 'err');
      if (pass.length < 8) return toast(t('short_password'), 'err');
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        const d = await S.login(email, pass);
        toast(t('welcome_toast').replace('{name}', S.profileName(d.profile, lang()) || ''), 'ok');
        afterAuth();
      } catch (err) { btn.disabled = false; toast(t('auth_failed'), 'err'); }
    });
    document.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const d = await S.demoLogin(b.getAttribute('data-demo'));
        toast(t('welcome_toast').replace('{name}', S.profileName(d.profile, lang()) || ''), 'ok');
        afterAuth();
      } catch (err) { b.disabled = false; toast(err.message, 'err'); }
    }));
  };
  function afterAuth() {
    const q = parseHashQuery();
    renderUserArea();
    navigate(q.next ? decodeURIComponent(q.next) : '#/dashboard?tab=bookings');
  }

  const POLICY_VERSION = '2026-09-28';
  const LEGAL = {
    en: [
      ['Terms of Service', 'You agree to follow سلف’s rules for lending, borrowing, and sharing skills. Bookings are arranged between neighbors. سلف does not charge a commission.'],
      ['Privacy Policy', 'We collect your name, email, neighborhood, national ID, and an ID photo so the marketplace can run and fraud is harder. Your neighborhood can appear on your public profile. The national ID and ID photo are encrypted and are not shown to other users, in page URLs, or in error messages.'],
      ['Data processing consent', 'You agree that this information may be processed to create your account, show your neighborhood, and handle bookings and reviews.'],
      ['Account security', 'You are responsible for keeping your password private and for activity in your signed-in session.'],
      ['Accurate information', 'You confirm that the registration details are yours and are accurate.'],
      ['Age requirement', 'You confirm that you are at least 18 years old.'],
      ['Acceptable use', 'You will not abuse, attack, exploit, reverse-engineer, or use سلف for anything illegal.'],
      ['Security monitoring', 'Login attempts, IP address, and session events may be recorded to prevent fraud. They are not published on your profile.'],
      ['Sessions', 'سلف does not set advertising cookies. A session token is stored in this browser and sent in an Authorization header. It expires, and logging out revokes it.'],
      ['Data retention and deletion', 'Account data is kept while the account exists. Delete account in the account menu removes the account and the stored ID document. Demo neighborhood accounts cannot be deleted.'],
      ['Third-party services', 'Supabase stores accounts and database records. Sentry may receive scrubbed error reports, never passwords or ID numbers. Google Fonts loads the typefaces. There is no payment provider, OAuth login, analytics product, AI API, or external map provider. The map is سلف’s own neighborhood list for Shibin El Kom.'],
      ['Security notifications', 'Important account notices may be sent to the email you register.'],
      ['Policy updates', 'If a later version of these terms needs new consent, registration will require that version. The version you accept is stored with the time you accepted it.'],
    ],
    ar: [
      ['شروط الخدمة', 'بتوافق تتبع قواعد سلف في الإعارة والمشاركة وحجز المهارات. الحجوزات بتتم بين الجيران. سلف مش بياخد عمولة.'],
      ['سياسة الخصوصية', 'بنجمع الاسم والبريد والحي والرقم القومي وصورة البطاقة عشان السوق يشتغل ويصعب الاحتيال. الحي ممكن يظهر في ملفك العام. الرقم القومي وصورة البطاقة بيتسجلوا مشفّرين ومش بيظهروا للجيران ولا في الروابط ولا في رسائل الخطأ.'],
      ['الموافقة على معالجة البيانات', 'بتوافق إن البيانات دي تتعالج لإنشاء الحساب وعرض الحي وإدارة الحجوزات والتقييمات.'],
      ['أمان الحساب', 'أنت مسؤول عن سرية كلمة المرور وعن النشاط اللي بيحصل وأنت مسجّل الدخول.'],
      ['صحة البيانات', 'بتأكد إن بيانات التسجيل بتاعتك وصحيحة.'],
      ['شرط السن', 'بتأكد إن سنك ١٨ سنة على الأقل.'],
      ['الاستخدام المقبول', 'مش هتسيء استخدام سلف أو تهاجمه أو تستغله أو تفكّه أو تستخدمه في عمل غير قانوني.'],
      ['مراقبة الأمان', 'محاولات الدخول وعنوان الشبكة وأحداث الجلسة ممكن تتسجل لمنع الاحتيال، ومش بتتنشر في ملفك.'],
      ['الجلسات', 'سلف مش بيستخدم كوكيز إعلانية. رمز الجلسة بيتخزن في المتصفح ويتبعت في ترويسة التفويض. بينتهي، وتسجيل الخروج بيلغيه.'],
      ['الاحتفاظ والحذف', 'بيانات الحساب بتفضل طول ما الحساب موجود. حذف الحساب من قائمة الحساب بيمسح الحساب ومستند الهوية. حسابات التجربة مش بتتتمسح.'],
      ['خدمات خارجية', 'Supabase بيحفظ الحسابات وقاعدة البيانات. Sentry ممكن يستقبل تقارير أخطاء من غير كلمات مرور أو أرقام قومية. Google Fonts بيحمّل الخطوط. مفيش بوابة دفع ولا تسجيل OAuth ولا تحليلات ولا واجهة ذكاء اصطناعي ولا مزود خرائط خارجي. الخريطة قائمة أحياء سلف في شبين الكوم.'],
      ['إشعارات الأمان', 'إشعارات الحساب المهمة ممكن تتبعت على البريد اللي سجّلت بيه.'],
      ['تحديث السياسات', 'لو نسخة لاحقة من الشروط احتاجت موافقة جديدة، التسجيل هيطلب النسخة دي. النسخة اللي وافقت عليها بتتسجل مع وقت الموافقة.'],
    ],
  };
  const MAP_POINTS = [
    { name: 'City Center', name_ar: 'وسط البلد', lat: 30.5545, lng: 31.011 },
    { name: 'El-Bahri', name_ar: 'البحري', lat: 30.559, lng: 31.0085 },
    { name: 'El-Gaish St.', name_ar: 'شارع الجيش', lat: 30.553, lng: 31.0145 },
    { name: 'El-Khadra', name_ar: 'الخضراء', lat: 30.549, lng: 31.005 },
    { name: 'East Branch', name_ar: 'الفرع الشرقي', lat: 30.551, lng: 31.02 },
    { name: 'Shanawan', name_ar: 'شنوان', lat: 30.5785, lng: 31.023 },
  ];
  function mapPoints() {
    const remote = S.state.locations || [];
    return MAP_POINTS.map((p) => {
      const hit = remote.find((r) => r.name === p.name);
      return { ...p, id: hit ? hit.id : '', lat: hit && hit.lat != null ? Number(hit.lat) : p.lat, lng: hit && hit.lng != null ? Number(hit.lng) : p.lng };
    });
  }
  function pointLabel(p) { return lang() === 'ar' ? p.name_ar : p.name; }
  window.SalifMap = { renderPickerMap, mapPoints, pointLabel };
  function renderPickerMap(selectedName) {
    const pts = mapPoints();
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const minLat = Math.min.apply(null, lats) - 0.004, maxLat = Math.max.apply(null, lats) + 0.004;
    const minLng = Math.min.apply(null, lngs) - 0.004, maxLng = Math.max.apply(null, lngs) + 0.004;
    const x = (lng) => ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = (lat) => ((maxLat - lat) / (maxLat - minLat)) * 100;
    return `<div class="picker-map" id="picker-map" data-minlat="${minLat}" data-maxlat="${maxLat}" data-minlng="${minLng}" data-maxlng="${maxLng}">
      <svg class="map-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="100" fill="#e7f2e4"/>
        <path d="M0 62 C 20 58, 40 70, 60 60 S 90 50, 100 56 L 100 100 L 0 100 Z" fill="#d7e7c8"/>
        <path d="M8 20 C 30 28, 48 18, 70 30 S 92 42, 100 36" fill="none" stroke="#8fb7d6" stroke-width="3"/>
        <path d="M0 48 H 100" stroke="#fff" stroke-width="1.4"/>
        <path d="M46 0 V 100" stroke="#fff" stroke-width="1.2"/>
      </svg>
      ${pts.map((p) => `<button type="button" class="map-pin${selectedName === p.name ? ' on' : ''}" data-loc="${esc(p.name)}" data-loc-id="${esc(p.id)}" style="left:${x(p.lng)}%;top:${y(p.lat)}%">${esc(pointLabel(p))}</button>`).join('')}
      <span class="map-pin drop" id="map-drop" hidden></span>
    </div>`;
  }
  function viewRegister() {
    return `
    <div class="page narrow">
      <div class="auth-wrap auth-wide">
        <div class="auth-card">
          <h1>${esc(t('register_title'))}</h1>
          <p class="sub">${esc(t('register_sub'))}</p>
          <form id="reg-form" novalidate>
            <h2 class="form-section">${esc(t('section_personal'))}</h2>
            <div class="field"><label for="rg-name">${esc(t('name_label'))}</label>
              <input class="input" id="rg-name" autocomplete="name" placeholder="${esc(t('name_ar_ph'))}" dir="rtl" required></div>
            <div class="field"><label for="rg-latin">${esc(t('name_latin_label'))}</label>
              <input class="input" id="rg-latin" autocomplete="name" placeholder="${esc(t('name_en_ph'))}" dir="ltr"></div>
            <div class="field"><label for="rg-email">${esc(t('email_label'))}</label>
              <input class="input" type="email" id="rg-email" autocomplete="email" dir="ltr" required></div>
            <div class="field"><label for="rg-phone">${esc(t('phone_label'))}</label>
              <input class="input" id="rg-phone" inputmode="tel" autocomplete="tel" placeholder="${esc(t('phone_ph'))}" dir="ltr" required>
              <p class="field-hint">${esc(t('phone_hint'))}</p></div>
            <div class="field"><label for="rg-pass">${esc(t('password_label'))}</label>
              <input class="input" type="password" id="rg-pass" autocomplete="new-password" minlength="10" dir="ltr" required>
              <p class="field-hint">${esc(t('weak_password'))}</p></div>

            <h2 class="form-section">${esc(t('section_identity'))}</h2>
            <div class="field"><label for="rg-nid">${esc(t('nid_label'))}</label>
              <input class="input" id="rg-nid" inputmode="numeric" autocomplete="off" placeholder="${esc(t('nid_ph'))}" dir="ltr" required></div>
            <div class="field"><label for="rg-doc">${esc(t('id_doc_label'))}</label>
              <label class="upload-btn" for="rg-doc">${esc(t('upload_id'))}</label>
              <input class="file-input" id="rg-doc" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">
              <p class="field-hint" id="rg-doc-name">${esc(t('id_doc_hint'))}</p></div>

            <h2 class="form-section">${esc(t('section_location'))}</h2>
            <p class="field-hint">${esc(t('loc_why'))}</p>
            <button class="btn btn-dark btn-block" type="button" id="open-map">${esc(t('open_map'))}</button>
            <div id="map-panel" hidden>
              ${renderPickerMap('')}
              <button class="btn btn-primary btn-block" type="button" id="confirm-loc" style="margin-top:10px">${esc(t('confirm_location'))}</button>
            </div>
            <p class="selected-loc" id="selected-loc">${esc(t('selected_location'))}: <b id="selected-loc-name">${esc(t('no_location_yet'))}</b></p>
            <input type="hidden" id="rg-loc-name" value="">
            <input type="hidden" id="rg-loc-id" value="">

            <div class="field"><label for="rg-bio">${esc(t('bio_label'))}</label>
              <textarea class="input" id="rg-bio" rows="2"></textarea></div>

            <h2 class="form-section">${esc(t('section_agreements'))}</h2>
            <label class="agree"><input type="checkbox" id="ag-tos"> <span>${esc(t('agree_tos_pre'))} <a href="#/terms">${esc(t('terms_link'))}</a>.</span></label>
            <label class="agree"><input type="checkbox" id="ag-pri"> <span>${esc(t('agree_pri_pre'))} <a href="#/privacy">${esc(t('privacy_link'))}</a>.</span></label>
            <label class="agree"><input type="checkbox" id="ag-pro"> <span>${esc(t('agree_processing'))}</span></label>
            <label class="agree"><input type="checkbox" id="ag-acc"> <span>${esc(t('agree_accuracy'))}</span></label>
            <p class="field-hint">${esc(t('policy_note'))}</p>
            <button class="btn btn-primary btn-block" id="rg-submit" type="submit" disabled style="border-radius:9999px">${esc(t('register_btn'))}</button>
          </form>
          <p class="auth-switch">${esc(t('have_account'))} <a href="#/login">${esc(t('sign_in'))}</a></p>
        </div>
      </div>
    </div>`;
  }
  viewRegister.after = function () {
    const form = document.getElementById('reg-form');
    const submit = document.getElementById('rg-submit');
    const panel = document.getElementById('map-panel');
    const boxes = ['ag-tos', 'ag-pri', 'ag-pro', 'ag-acc'].map((id) => document.getElementById(id));
    let pending = null;
    function syncAgree() { submit.disabled = boxes.some((box) => !box.checked); }
    boxes.forEach((box) => box.addEventListener('change', syncAgree));
    function nearest(lat, lng) {
      let best = mapPoints()[0], bestD = Infinity;
      mapPoints().forEach((p) => {
        const d = Math.hypot(p.lat - lat, p.lng - lng);
        if (d < bestD) { best = p; bestD = d; }
      });
      return best;
    }
    function markPending(p) {
      pending = p;
      document.querySelectorAll('.map-pin').forEach((pin) => pin.classList.toggle('on', pin.getAttribute('data-loc') === p.name));
    }
    function bindMap() {
      const map = document.getElementById('picker-map');
      if (!map) return;
      map.querySelectorAll('.map-pin').forEach((pin) => pin.addEventListener('click', (e) => {
        e.stopPropagation();
        markPending(mapPoints().find((p) => p.name === pin.getAttribute('data-loc')));
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
    document.getElementById('open-map').addEventListener('click', () => {
      panel.hidden = false;
      bindMap();
    });
    document.getElementById('confirm-loc').addEventListener('click', async () => {
      if (!pending) return toast(t('pick_on_map'), 'err');
      if (!pending.id) {
        try {
          const d = await S.api('/api/locations', { auth: false });
          const hit = (d.locations || []).find((l) => l.name === pending.name);
          if (hit) pending = { ...pending, id: hit.id };
        } catch (e) {}
      }
      if (!pending.id) return toast(t('loc_why'), 'err');
      document.getElementById('rg-loc-name').value = pending.name;
      document.getElementById('rg-loc-id').value = pending.id;
      document.getElementById('selected-loc-name').textContent = pointLabel(pending);
      panel.hidden = true;
    });
    document.getElementById('rg-doc').addEventListener('change', () => {
      const file = document.getElementById('rg-doc').files[0];
      document.getElementById('rg-doc-name').textContent = file ? file.name : t('id_doc_hint');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      const name = document.getElementById('rg-name').value.trim();
      const latin = document.getElementById('rg-latin').value.trim();
      const email = document.getElementById('rg-email').value.trim();
      const pass = document.getElementById('rg-pass').value;
      const bio = document.getElementById('rg-bio').value.trim();
      const file = document.getElementById('rg-doc').files[0];
      const locName = document.getElementById('rg-loc-name').value;
      const locId = document.getElementById('rg-loc-id').value;
      if (name.length < 5) return toast(t('required_field'), 'err');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast(t('invalid_email'), 'err');
      const phoneRaw = document.getElementById('rg-phone').value.replace(/[٠-٩]/g, (ch) => '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)).replace(/\D/g, '');
      if (!/^01(0|1|2|5)\d{8}$/.test(phoneRaw) && !/^201(0|1|2|5)\d{8}$/.test(phoneRaw)) return toast(t('phone_hint'), 'err');
      if (pass.length < 10 || !/[A-Za-z\u0600-\u06FF]/.test(pass) || !/\d/.test(pass)) return toast(t('weak_password'), 'err');
      if (!locName || !locId) return toast(t('pick_on_map'), 'err');
      if (!file || file.size > 2 * 1024 * 1024) return toast(t('id_doc_hint'), 'err');
      submit.disabled = true;
      try {
        const uploaded = await S.uploadIdDocument(file);
        const d = await S.register({
          email, password: pass, full_name: name, full_name_latin: latin, bio,
          neighborhood: locName,
          location_id: locId,
          national_id: document.getElementById('rg-nid').value,
          phone: document.getElementById('rg-phone').value,
          verification_flow: true,
          upload_id: uploaded.upload_id,
          policy_version: POLICY_VERSION,
          termsAccepted: true,
          privacyAccepted: true,
          dataProcessingConsent: true,
          accurateInformationAndAgeConfirmed: true,
        });
        if (!d.access_token) {
          toast(d.message || t('register_generic'));
          navigate('#/login');
          return;
        }
        toast(t('welcome_toast').replace('{name}', S.profileName(d.profile, lang()) || name), 'ok');
        renderUserArea();
        if (d.verification && d.verification.continue) navigate('#/verify');
        else afterAuth();
      } catch (err) {
        syncAgree();
        toast(err.message, 'err');
      }
    });
  };
  function policyPage(title, paragraphs) {
    return `<div class="page narrow"><div class="auth-wrap auth-wide"><div class="auth-card prose">
      <h1 class="h-page">${esc(title)}</h1>
      ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="auth-switch"><a href="#/register">${esc(t('back_register'))}</a></p>
    </div></div></div>`;
  }
  function viewTerms() {
    const copy = lang() === 'ar' ? [
      'باستخدام سلف أنت توافق على قواعد المشاركة بين الجيران: استعارة الأدوات، عرض المهارات، وطلب الحجوزات.',
      'الحجز اتفاق بينك وبين جارك. سلف لا يأخذ عمولة ولا يضمن تسليم الأداة.',
      'يُمنع إساءة الاستخدام أو الهجوم على الخدمة أو استخدامها في عمل غير قانوني.',
      'يمكنك حذف حسابك من قائمة الحساب، باستثناء حسابات التجربة.',
    ] : [
      'By using Salif you agree to the neighborhood sharing rules: lending tools, offering skills, and requesting bookings.',
      'A booking is an agreement between you and a neighbor. Salif does not charge a commission and does not guarantee handover.',
      'You must not abuse, attack, or use the service for anything illegal.',
      'You can delete your account from the account menu. Demo neighborhood accounts cannot be deleted.',
    ];
    return policyPage(lang() === 'ar' ? 'شروط الخدمة' : 'Terms of Service', copy);
  }
  function viewPrivacy() {
    const copy = lang() === 'ar' ? [
      'نجمع الاسم، والبريد، والحي الذي تختاره على الخريطة، والرقم القومي، وصورة وجه البطاقة، حتى يعمل السوق ويصعب الاحتيال. إذا أكملت تأكيد الحساب، قد نحفظ أيضًا رقم الموبايل وظهر البطاقة وصورة لك وأنت ماسك البطاقة وعنوانًا خاصًا.',
      'الرقم القومي وصور البطاقة والصورة الشخصية ورقم الموبايل والعنوان الدقيق تُشفَّر ولا تظهر للجيران ولا في الروابط ولا في رسائل الخطأ. الحي فقط يمكن أن يظهر في ملفك العام. رفع صورة ليس توثيقًا للهوية. مطابقة الوجه واختبار الحيوية غير متصلين.',
      'قد نسجل محاولات الدخول وعنوان الشبكة وأحداث الجلسة لمنع الاحتيال. هذه البيانات لا تُنشر في ملفك.',
      'الجلسة رمز يُحفظ في هذا المتصفح ويُرسل في ترويسة التفويض. لا نستخدم كوكيز إعلانية. كوكي الأمان المستخدم للطلبات يُضبط HttpOnly وSameSite، ويُضاف Secure عند التشغيل على HTTPS.',
      'تبقى بيانات الحساب طالما الحساب موجود. حذف الحساب يمسح الحساب ومستندات الهوية المحفوظة، بما فيها ظهر البطاقة والصورة الشخصية إن وُجدتا. لا توجد مدة حذف تلقائية.',
      'Supabase يحفظ الحسابات وقاعدة البيانات. Sentry قد يستقبل تقارير أخطاء منزوعة من كلمات المرور وأرقام الهوية. Google Fonts يحمّل الخطوط. لا يوجد دفع أو تسجيل OAuth أو تحليلات أو واجهة ذكاء اصطناعي أو شركة رسائل أو مزود خرائط أو شركة تأمين. صور الإعلانات لا تُرسل إلى خدمة ذكاء اصطناعي. الخريطة قائمة أحياء سلف في شبين الكوم.',
    ] : [
      'We collect your name, email, the neighborhood you pick on the map, your national ID, and the front of your ID card so the marketplace can run and fraud is harder. If you continue account confirmation, we may also store your mobile number, the back of the card, a private selfie holding the card, and a private address.',
      'The national ID, card images, selfie, mobile number, and exact address are encrypted. They are not shown to neighbors, not put in URLs, and not returned by normal APIs. Only the neighborhood can appear on your public profile. Uploading a photo is not identity verification. Face matching and liveness are not connected.',
      'Login attempts, IP address, and session events may be recorded to prevent fraud. They are not published on your profile.',
      'Your session is a token stored in this browser and sent in an Authorization header. Salif does not use advertising cookies. The security cookie used for requests is HttpOnly and SameSite, and Secure when the site is served over HTTPS.',
      'Account data is kept while the account exists. Deleting the account removes the account and stored identity documents, including the card back and selfie if you uploaded them. There is no automatic deletion period.',
      'Supabase stores accounts and database records. Sentry may receive error reports with passwords and ID numbers removed. Google Fonts loads the typefaces. There is no payment provider, OAuth login, analytics product, AI API, SMS company, external map provider, or insurer. Listing photos are not sent to an AI service. The map is Salif’s own Shibin El Kom neighborhood list.',
    ];
    return policyPage(lang() === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy', copy);
  }
  function viewForgot() {
    return `
    <div class="page narrow"><div class="auth-wrap"><div class="auth-card">
      <h1>${esc(t('forgot_title'))}</h1>
      <p class="sub">${esc(t('forgot_sub'))}</p>
      <form id="forgot-form">
        <div class="field"><label for="fp-email">${esc(t('email_label'))}</label>
          <input class="input" type="email" id="fp-email" autocomplete="email" dir="ltr" required></div>
        <button class="btn btn-primary btn-block" type="submit" style="border-radius:9999px">${esc(t('forgot_btn'))}</button>
      </form>
      <p class="auth-switch"><a href="#/login">${esc(t('sign_in'))}</a></p>
    </div></div></div>`;
  }
  viewForgot.after = function () {
    document.getElementById('forgot-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('fp-email').value.trim();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        await S.api('/api/auth/forgot', { method: 'POST', body: { email }, auth: false });
        toast(t('forgot_done'), 'ok');
        navigate('#/login');
      } catch (err) { btn.disabled = false; toast(err.message, 'err'); }
    });
  };

  /* ================= dashboard ================= */
  function viewDashboard() {
    if (!S.isLoggedIn()) {
      return `<div class="page narrow">${emptyState('🔐', t('must_login'), t('login_sub'), `<a class="btn btn-primary" href="#/login">${esc(t('sign_in'))}</a>`)}</div>`;
    }
    const q = parseHashQuery();
    const tab = q.tab || 'bookings';
    const tabs = [['bookings', 'tab_bookings'], ['listings', 'tab_my_listings'], ['favorites', 'tab_favorites']];
    return `
    <div class="page narrow">
      <div class="section-head" style="align-items:center">
        <h1 class="h-page">${esc(t('dash_title'))}</h1>
        <a class="btn btn-primary btn-sm" href="#/new">＋ ${esc(t('new_listing_btn'))}</a>
      </div>
      <div class="dash-tabs" role="tablist">
        ${tabs.map(([k, label]) => `<a class="dtab ${tab === k ? 'active' : ''}" role="tab" href="#/dashboard?tab=${k}">${esc(t(label))}</a>`).join('')}
      </div>
      <div id="dash-content"><div class="state-box"><div class="emoji">⏳</div><p>${esc(t('loading'))}</p></div></div>
    </div>`;
  }
  viewDashboard.after = async function () {
    const q = parseHashQuery();
    const tab = q.tab || 'bookings';
    const box = document.getElementById('dash-content');
    if (!box) return;
    try {
      if (tab === 'bookings') box.innerHTML = await renderBookings();
      else if (tab === 'listings') box.innerHTML = renderMyListings();
      else box.innerHTML = renderFavorites();
    } catch (e) {
      box.innerHTML = emptyState('⚠️', t('err_title'), t('err_p'), `<button class="btn btn-dark btn-sm" id="dash-retry" type="button">${esc(t('retry'))}</button>`);
      const retry = document.getElementById('dash-retry');
      if (retry) retry.addEventListener('click', () => renderRoute());
      return;
    }
    try { wireDashboard(tab); } catch (e) { /* list stays visible if a button cannot be wired */ }
  };

  async function renderBookings() {
    const d = await S.api('/api/bookings');
    const byId = {};
    S.state.listings.forEach((l) => { byId[l.id] = l; });
    const profById = S.state.profiles;

    function bookingRow(b, asOwner) {
      const l = byId[b.listing_id];
      if (!l) return '';
      const other = asOwner ? profById[b.requester_id] : profById[l.owner_id];
      const images = Array.isArray(l.images) ? l.images : [];
      const img = images[0] || CAT_DEFAULT_IMG[l.category] || '';
      const actions = [];
      if (asOwner) {
        if (b.status === 'PENDING') {
          actions.push(`<button class="btn btn-dark btn-sm" data-act="ACCEPTED" data-id="${b.id}">${esc(t('accept'))}</button>`);
          actions.push(`<button class="btn btn-soft btn-sm" data-act="DECLINED" data-id="${b.id}">${esc(t('decline'))}</button>`);
        } else if (b.status === 'ACCEPTED') actions.push(`<button class="btn btn-dark btn-sm" data-act="ACTIVE" data-id="${b.id}">${esc(t('mark_active'))}</button>`);
        else if (b.status === 'ACTIVE') actions.push(`<button class="btn btn-dark btn-sm" data-act="COMPLETED" data-id="${b.id}">${esc(t('mark_completed'))}</button>`);
        if (['ACTIVE', 'DISPUTED'].includes(b.status)) actions.push(`<button class="btn btn-soft btn-sm" data-claim="${b.id}">${esc(t('open_claim'))}</button>`);
      } else {
        if (['PENDING', 'ACCEPTED'].includes(b.status)) actions.push(`<button class="btn btn-soft btn-sm" data-act="CANCELLED" data-id="${b.id}">${esc(t('cancel'))}</button>`);
        if (['ACTIVE', 'DISPUTED'].includes(b.status)) actions.push(`<button class="btn btn-soft btn-sm" data-claim="${b.id}">${esc(t('open_claim'))}</button>`);
      }
      const who = asOwner ? `${esc(t('requester_word'))} ${esc(S.profileName(other, lang()))}` : `${esc(t('offered_by'))} ${esc(S.profileName(other, lang()))}`;
      return `
      <div class="booking-row">
        <img src="${esc(img)}" alt="">
        <div>
          <div class="b-title"><a href="#/listing/${l.id}">${esc(listingTitle(l))}</a></div>
          <div class="b-sub">${esc(t('booking_dates').replace('{a}', fmtDate(b.start_date)).replace('{b}', fmtDate(b.end_date)))} · ${who}</div>
          ${b.message ? `<div class="b-sub">“${esc(b.message.slice(0, 120))}${b.message.length > 120 ? '…' : ''}”</div>` : ''}
          <div style="margin-top:6px"><span class="status-pill status-${b.status}">${esc(t('status_' + b.status))}</span></div>
        </div>
        <div class="b-actions">${actions.join('')}</div>
      </div>`;
    }

    const requested = Array.isArray(d.as_requester) ? d.as_requester : [];
    const owned = Array.isArray(d.as_owner) ? d.as_owner : [];
    const reqHtml = requested.length ? requested.map((b) => bookingRow(b, false)).join('')
      : emptyState('📭', t('no_bookings'), t('no_bookings_p'), `<a class="btn btn-dark btn-sm" href="#/explore">${esc(t('browse_all'))}</a>`);
    const ownHtml = owned.length ? owned.map((b) => bookingRow(b, true)).join('')
      : emptyState('📭', t('no_bookings'), t('no_bookings_p'));

    return `
      <h3 class="section-title" style="margin-bottom:12px">${esc(t('as_requester'))}</h3>${reqHtml}
      <h3 class="section-title" style="margin:28px 0 12px">${esc(t('as_owner'))}</h3>${ownHtml}`;
  }

  function renderMyListings() {
    const mine = S.state.listings.filter((l) => S.me() && l.owner_id === S.me().id);
    if (!mine.length) {
      return emptyState('🌱', t('no_mylistings'), t('no_mylistings_p'), `<a class="btn btn-primary" href="#/new">＋ ${esc(t('new_listing_btn'))}</a>`);
    }
    return mine.map((l) => `
      <div class="mylisting-row">
        <img src="${esc(l.images[0] || CAT_DEFAULT_IMG[l.category])}" alt="">
        <div>
          <div class="b-title"><a href="#/listing/${l.id}">${esc(listingTitle(l))}</a></div>
          <div class="b-sub">${esc(t('cat_' + l.category))} · ${priceLine(l).replace(/<[^>]+>/g, '')}</div>
          <div style="margin-top:6px"><span class="status-pill status-${l.status === 'ACTIVE' ? 'ACTIVE_L' : l.status}">${esc(t('status_' + (l.status === 'ACTIVE' ? 'ACTIVE_L' : l.status)))}</span></div>
        </div>
        <div class="b-actions">
          <a class="btn btn-soft btn-sm" href="#/edit/${l.id}">${esc(t('edit'))}</a>
          ${l.status === 'ACTIVE'
            ? `<button class="btn btn-soft btn-sm" data-pause="${l.id}">${esc(t('pause'))}</button>`
            : `<button class="btn btn-dark btn-sm" data-resume="${l.id}">${esc(t('resume'))}</button>`}
          <button class="btn btn-ghost btn-sm" data-del="${l.id}">${esc(t('del'))}</button>
        </div>
      </div>`).join('');
  }

  function renderFavorites() {
    const favs = S.activeListings().filter((l) => S.state.favorites.has(l.id));
    if (!favs.length) {
      return emptyState('🤍', t('no_favorites'), t('no_favorites_p'), `<a class="btn btn-dark btn-sm" href="#/explore">${esc(t('browse_all'))}</a>`);
    }
    return `<div class="cards-grid">${favs.map(listingCard).join('')}</div>`;
  }

  function wireDashboard(tab) {
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await S.api(`/api/bookings/${b.getAttribute('data-id')}/status`, { method: 'PATCH', body: { status: b.getAttribute('data-act') } });
        toast(t('action_done'), 'ok');
        renderRoute();
      } catch (e) { b.disabled = false; toast(e.message, 'err'); }
    }));
    document.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', async () => {
      const summary = window.prompt(t('claim_prompt'));
      if (!summary) return;
      b.disabled = true;
      try {
        await S.api('/api/claims', { method: 'POST', body: { booking_id: b.getAttribute('data-claim'), summary } });
        toast(t('claim_opened'), 'ok');
      } catch (err) { b.disabled = false; toast(err.message, 'err'); }
    }));
    document.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', async () => {
      try { await S.api(`/api/listings/${b.getAttribute('data-pause')}`, { method: 'PATCH', body: { status: 'PAUSED' } }); S.state.listings.find((l) => l.id === b.getAttribute('data-pause')).status = 'PAUSED'; toast(t('updated_toast'), 'ok'); renderRoute(); } catch (e) { toast(e.message, 'err'); }
    }));
    document.querySelectorAll('[data-resume]').forEach((b) => b.addEventListener('click', async () => {
      try { await S.api(`/api/listings/${b.getAttribute('data-resume')}`, { method: 'PATCH', body: { status: 'ACTIVE' } }); S.state.listings.find((l) => l.id === b.getAttribute('data-resume')).status = 'ACTIVE'; toast(t('updated_toast'), 'ok'); renderRoute(); } catch (e) { toast(e.message, 'err'); }
    }));
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      confirmModal(t('confirm_delete'), async () => {
        try {
          await S.api(`/api/listings/${b.getAttribute('data-del')}`, { method: 'DELETE' });
          S.state.listings = S.state.listings.filter((l) => l.id !== b.getAttribute('data-del'));
          toast(t('action_done'), 'ok'); renderRoute();
        } catch (e) { toast(e.message, 'err'); }
      });
    }));
  }

  /* ================= new / edit listing ================= */
  function viewListingForm(id) {
    if (!S.isLoggedIn()) {
      return `<div class="page narrow">${emptyState('🔐', t('must_login'), t('register_sub'), `<a class="btn btn-primary" href="#/login?next=${encodeURIComponent(location.hash)}">${esc(t('sign_in'))}</a>`)}</div>`;
    }
    const editing = id ? S.listingById(id) : null;
    if (id && !editing) return viewNotFound();
    if (editing && S.me().id !== editing.owner_id) return viewNotFound();
    const sel = new Set(editing ? editing.images : []);
    window.__picked = sel;

    return `
    <div class="page narrow">
      <h1 class="h-page" style="margin-bottom:4px">${esc(editing ? t('edit_title') : t('new_title'))}</h1>
      <p class="muted" style="margin-bottom:28px">${esc(t('new_sub'))}</p>
      <form id="nl-form" style="max-width:720px" novalidate>
        <div class="field">
          <label>${esc(t('type_label'))}</label>
          <div class="seg" id="nl-type">
            <button type="button" data-v="ITEM" class="${!editing || editing.type === 'ITEM' ? 'on' : ''}">${esc(t('item_word'))}</button>
            <button type="button" data-v="SKILL" class="${editing && editing.type === 'SKILL' ? 'on' : ''}">${esc(t('skill_word'))}</button>
          </div>
        </div>
        <div class="form-2col">
          <div class="field"><label for="nl-title-en">${esc(t('title_en_label'))}</label>
            <input class="input" id="nl-title-en" dir="ltr" placeholder="${esc(t('title_en_ph'))}" value="${esc(editing ? editing.title : '')}"></div>
          <div class="field"><label for="nl-title-ar">${esc(t('title_ar_label'))}</label>
            <input class="input" id="nl-title-ar" dir="rtl" placeholder="${esc(t('title_ar_ph'))}" value="${esc(editing ? editing.title_ar : '')}"></div>
        </div>
        <div class="form-2col">
          <div class="field"><label for="nl-desc-en">${esc(t('desc_en_label'))}</label>
            <textarea class="input" id="nl-desc-en" rows="4" dir="ltr" placeholder="${esc(t('desc_en_ph'))}">${esc(editing ? editing.description : '')}</textarea></div>
          <div class="field"><label for="nl-desc-ar">${esc(t('desc_ar_label'))}</label>
            <textarea class="input" id="nl-desc-ar" rows="4" dir="rtl" placeholder="${esc(t('desc_ar_ph'))}">${esc(editing ? editing.description_ar : '')}</textarea></div>
        </div>
        <div class="form-2col">
          <div class="field"><label for="nl-cat">${esc(t('category_label'))}</label>
            <select class="input" id="nl-cat">
              ${CATEGORIES.map((c) => `<option value="${c}" ${editing && editing.category === c ? 'selected' : ''}>${esc(t('cat_' + c))}</option>`).join('')}
            </select></div>
          <div class="field"><label for="nl-price">${esc(t('price_label'))}</label>
            <input class="input" id="nl-price" type="number" min="0" step="1" dir="ltr" placeholder="${esc(t('price_ph'))}" value="${editing && editing.price_per_day != null ? esc(String(editing.price_per_day)) : ''}"></div>
          <div class="field"><label for="nl-value">${esc(t('replacement_label'))}</label>
            <input class="input" id="nl-value" type="number" min="0" step="1" dir="ltr" placeholder="${esc(t('price_ph'))}">
            <p class="field-hint">${esc(t('replacement_hint'))}</p></div>
        </div>
        <div class="field"><label for="nl-loc">${esc(t('location_label'))}</label>
          <select class="input" id="nl-loc">
            ${NEIGHBORHOODS.map((n) => `<option value="${esc(n)}" ${editing && editing.location === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}
          </select></div>
        <div class="field">
          <label>${esc(t('photos_label'))}</label>
          <div class="img-picker" id="img-picker">
            ${ALL_PHOTOS.map((p) => `
              <div class="img-opt ${sel.has(p) ? 'sel' : ''}" data-img="${p}" role="checkbox" aria-checked="${sel.has(p)}" tabindex="0">
                <img src="${p}" alt="" loading="lazy"><span class="chk">✓</span>
              </div>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" style="border-radius:9999px;max-width:360px">
          ${esc(editing ? t('save_btn') : t('publish_btn'))}
        </button>
      </form>
    </div>`;
  }
  viewListingForm.after = function () {
    const id = location.hash.split('?')[0].startsWith('#/edit/') ? location.hash.split('?')[0].split('/')[2] : null;
    let type = id && S.listingById(id) ? S.listingById(id).type : 'ITEM';
    document.querySelectorAll('#nl-type button').forEach((b) => b.addEventListener('click', () => {
      type = b.getAttribute('data-v');
      document.querySelectorAll('#nl-type button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    const picker = document.getElementById('img-picker');
    picker.querySelectorAll('.img-opt').forEach((el) => {
      const toggle = () => {
        const p = el.getAttribute('data-img');
        const selSet = window.__picked;
        if (selSet.has(p)) { selSet.delete(p); el.classList.remove('sel'); }
        else { if (selSet.size >= 6) return toast('Max 6', 'err'); selSet.add(p); el.classList.add('sel'); }
        el.setAttribute('aria-checked', String(selSet.has(p)));
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    document.getElementById('nl-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title_en = document.getElementById('nl-title-en').value.trim();
      const title_ar = document.getElementById('nl-title-ar').value.trim();
      const desc_en = document.getElementById('nl-desc-en').value.trim();
      const desc_ar = document.getElementById('nl-desc-ar').value.trim();
      const title = title_en || title_ar, desc = desc_en || desc_ar;
      if (!title) return toast(t('required_field'), 'err');
      if (!desc) return toast(t('required_field'), 'err');
      const images = [...window.__picked];
      if (!images.length) return toast(t('required_field'), 'err');
      const body = {
        type,
        title: title_en || title_ar, title_ar: title_ar || title_en,
        description: desc_en || desc_ar, description_ar: desc_ar || desc_en,
        category: document.getElementById('nl-cat').value,
        price_per_day: document.getElementById('nl-price').value,
        declared_replacement_value: document.getElementById('nl-value') ? document.getElementById('nl-value').value : '',
        location: document.getElementById('nl-loc').value,
        images,
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        let listing;
        if (id) {
          const d = await S.api(`/api/listings/${id}`, { method: 'PATCH', body });
          listing = d.listing;
        } else {
          const d = await S.api('/api/listings', { method: 'POST', body });
          listing = d.listing;
        }
        const idx = S.state.listings.findIndex((l) => l.id === listing.id);
        if (idx >= 0) S.state.listings[idx] = listing; else S.state.listings.unshift(listing);
        toast(t('published_toast'), 'ok');
        navigate('#/listing/' + listing.id);
      } catch (err) { btn.disabled = false; toast(err.code === 'VERIFICATION_REQUIRED' ? t('verify_required') : err.code === 'ITEM_NOT_ALLOWED' ? t('item_not_allowed') : err.message, 'err'); }
    });
  };

  /* ================= member profile ================= */
  function viewMember(id) {
    const p = S.state.profiles[id];
    if (!p) return viewNotFound();
    const theirs = S.activeListings().filter((l) => l.owner_id === id);
    const ids = S.state.listings.filter((l) => l.owner_id === id).map((l) => l.id);
    const rs = S.state.reviews.filter((r) => ids.includes(r.listing_id));
    const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : null;
    return `
    <div class="page narrow">
      <div class="owner-card" style="margin-top:8px">
        ${avatarHtml(p, 'lg')}
        <div class="oc-info">
          <b style="font-size:20px">${esc(S.profileName(p, lang()))}</b>
          <span>${esc(t('member_since').replace('{n}', p.neighborhood))}${avg ? ` · ★ ${fmtNum(Math.round(avg * 10) / 10)} (${fmtNum(rs.length)})` : ''} · ${fmtNum(theirs.length)} ${esc(t('stats_listings'))}</span>
          <span id="member-badges" class="verify-badges"></span>
        </div>
      </div>
      ${p.bio ? `<p class="detail-desc" style="margin:16px 0">${esc(p.bio)}</p>` : ''}
      <h2 class="section-title" style="margin:24px 0 16px">${esc(S.profileName(p, lang()))} — ${esc(t('tab_my_listings'))}</h2>
      ${theirs.length ? `<div class="cards-grid">${theirs.map(listingCard).join('')}</div>` : emptyState('🌱', t('no_mylistings'), '')}
    </div>`;
  }
  viewMember.after = function () {
    const id = (location.hash.split('?')[0].split('/')[2] || '');
    const box = document.getElementById('member-badges');
    if (!box || !/^[0-9a-f-]{36}$/i.test(id)) return;
    S.api('/api/verification/badges?ids=' + encodeURIComponent(id), { auth: false }).then((d) => {
      const b = (d.badges || [])[0];
      if (!b) return;
      const bits = [];
      if (b.phone_verified) bits.push(t('badge_phone'));
      if (b.identity_verified) bits.push(t('badge_identity'));
      box.textContent = bits.join(' · ');
    }).catch(() => {});
  };

  /* ================= 404 ================= */
  function viewNotFound() {
    return `<div class="page">${emptyState('🧭', t('notfound_title'), t('notfound_p'), `<a class="btn btn-dark" href="#/">${esc(t('go_home'))}</a>`)}</div>`;
  }

  /* ================= global events ================= */
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-goto]');
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.preventDefault(); e.stopPropagation();
      try {
        const now = await S.toggleFavorite(fav.getAttribute('data-fav'));
        if (fav.classList.contains('heart-btn')) {
          fav.querySelector('svg').setAttribute('fill', now ? '#ff385c' : 'rgba(0,0,0,.35)');
          fav.setAttribute('aria-pressed', String(now));
        } else {
          fav.innerHTML = now ? '♥ ' + esc(t('saved')) : '♡ ' + esc(t('save'));
        }
      } catch (err) { toast(t('must_login'), 'err'); navigate('#/login'); }
      return;
    }
    if (card && !e.target.closest('button,a')) navigate(card.getAttribute('data-goto'));
    if (card && e.target.closest('a[href^="#/listing"]')) { /* allow default */ }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const card = e.target.closest && e.target.closest('[data-goto]');
      if (card && e.target === card) navigate(card.getAttribute('data-goto'));
    }
  });

  document.getElementById('lang-toggle').addEventListener('click', toggleLang);
  document.getElementById('lang-toggle-footer').addEventListener('click', toggleLang);
  window.addEventListener('hashchange', renderRoute);

  /* ================= boot ================= */
  (async function boot() {
    renderUserArea();
    applyStaticI18n();
    renderRoute();
    S.subscribe(() => { renderUserArea(); });
    try {
      await S.bootstrap();
      if (S.isLoggedIn()) S.loadFavorites();
      renderRoute(); // re-render with data
    } catch (e) {
      if (main.querySelector('.skel')) {
        main.innerHTML = `<div class="page">${emptyState('⚠️', t('err_title'), t('err_p'), `<button class="btn btn-dark" onclick="location.reload()">${esc(t('retry'))}</button>`)}</div>`;
      }
    }
  })();
})();
