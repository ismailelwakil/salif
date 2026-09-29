/* Salif — API client + session + local data cache */
'use strict';
(function () {
  const SESSION_KEY = 'salif.session';
  const LS_FAVS_GUEST = 'salif.favs.guest'; // hearts before login are remembered locally

  const state = {
    session: null,       // { access_token, refresh_token, user, profile }
    listings: [],        // all listings
    profiles: {},        // id -> profile
    reviews: [],         // all reviews
    favorites: new Set(),// listing ids for current user (or guest-local)
    loaded: false,
    listeners: new Set(),
  };

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) state.session = JSON.parse(raw);
    } catch (e) {}
    if (!state.session) {
      try {
        const gf = JSON.parse(localStorage.getItem(LS_FAVS_GUEST) || '[]');
        gf.forEach((id) => state.favorites.add(id));
      } catch (e) {}
    }
  }
  function saveSession() {
    if (state.session) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    else localStorage.removeItem(SESSION_KEY);
  }

  let csrfToken = '';
  function rememberCsrf(res) {
    const token = res && res.headers && res.headers.get && res.headers.get('x-csrf-token');
    if (token) csrfToken = token;
  }
  async function ensureCsrf() {
    if (csrfToken) return csrfToken;
    const r = await fetch('/api/csrf');
    rememberCsrf(r);
    try { const d = await r.json(); if (d && d.csrfToken) csrfToken = d.csrfToken; } catch (e) {}
    return csrfToken;
  }

  let refreshing = null;
  async function tryRefresh() {
    if (!state.session || !state.session.refresh_token) return false;
    if (!refreshing) {
      refreshing = (async () => {
        try {
          await ensureCsrf();
          const r = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify({ refresh_token: state.session.refresh_token }),
          });
          if (!r.ok) throw new Error('refresh failed');
          const d = await r.json();
          state.session = { ...state.session, ...d };
          saveSession();
          return true;
        } catch (e) {
          logout();
          return false;
        }
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function api(path, { method = 'GET', body, auth = true, _retried = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET' && method !== 'HEAD') {
      await ensureCsrf();
      headers['X-CSRF-Token'] = csrfToken;
    }
    if (auth && state.session && state.session.access_token) {
      headers['Authorization'] = 'Bearer ' + state.session.access_token;
    }
    const r = await fetch(path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    rememberCsrf(r);
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (r.status === 401 && auth && !_retried && state.session && state.session.refresh_token) {
      const ok = await tryRefresh();
      if (ok) return api(path, { method, body, auth, _retried: true });
    }
    if (!r.ok) {
      const msg = data && data.error ? data.error.message : 'Request failed';
      const err = new Error(msg);
      err.status = r.status;
      err.code = data && data.error ? data.error.code : 'UNKNOWN';
      throw err;
    }
    return data;
  }

  function applyBootstrap(d) {
    state.listings = d.listings || [];
    state.profiles = {};
    (d.profiles || []).forEach((p) => { state.profiles[p.id] = p; });
    state.reviews = d.reviews || [];
    state.ratings = {};
    (d.ratings || []).forEach((r) => { state.ratings[r.listing_id] = r; });
    state.locations = d.locations || [];
  }

  async function bootstrap(force = false) {
    if (state.loaded && !force) return;
    if (!force && window.SalifCache) {
      try {
        const cached = await window.SalifCache.read('bootstrap');
        if (cached && cached.data && cached.data.listings) {
          applyBootstrap(cached.data);
          notify();
          if (!cached.stale) { state.loaded = true; return; }
        }
      } catch (e) {}
    }
    const d = await api('/api/bootstrap', { auth: false });
    applyBootstrap(d);
    state.loaded = true;
    if (window.SalifCache) window.SalifCache.write('bootstrap', d);
    notify();
  }

  async function loadFavorites() {
    if (!isLoggedIn()) return;
    try {
      const d = await api('/api/favorites');
      state.favorites = new Set(d.favorites || []);
      notify();
    } catch (e) {}
  }

  function notify() { state.listeners.forEach((fn) => { try { fn(); } catch (e) {} }); }
  function subscribe(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); }

  function isLoggedIn() { return !!(state.session && state.session.access_token); }
  function me() { return state.session ? state.session.profile : null; }

  async function login(email, password) {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
    state.session = d; saveSession(); await loadFavorites(); notify(); return d;
  }
  async function demoLogin(email) {
    const d = await api('/api/auth/demo', { method: 'POST', body: { email }, auth: false });
    state.session = d; saveSession(); await loadFavorites(); notify(); return d;
  }
  async function register(payload) {
    const d = await api('/api/auth/register', { method: 'POST', body: payload, auth: false });
    if (d.access_token) { state.session = d; saveSession(); await loadFavorites(); notify(); }
    return d;
  }
  async function uploadIdDocument(file) {
    await ensureCsrf();
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    const r = await fetch('/api/auth/id-document', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Ext': ext,
        'X-CSRF-Token': csrfToken,
      },
      body: file,
    });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      const err = new Error(data && data.error ? data.error.message : 'Upload failed');
      err.status = r.status;
      err.code = data && data.error ? data.error.code : 'UNKNOWN';
      throw err;
    }
    return data;
  }
  async function uploadVerification(kind, file) {
    await ensureCsrf();
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    const headers = {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Upload-Ext': ext,
      'X-Upload-Kind': kind,
      'X-CSRF-Token': csrfToken,
    };
    if (state.session && state.session.access_token) headers.Authorization = 'Bearer ' + state.session.access_token;
    const r = await fetch('/api/verification/upload', { method: 'POST', headers, body: file });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
      const err = new Error(data && data.error ? data.error.message : 'Upload failed');
      err.status = r.status;
      err.code = data && data.error ? data.error.code : 'UNKNOWN';
      throw err;
    }
    return data;
  }
  function logout() {
    const token = state.session && state.session.access_token;
    state.session = null; saveSession();
    try {
      const favs = localStorage.getItem(LS_FAVS_GUEST);
      if (favs) state.favorites = new Set(JSON.parse(favs));
    } catch (e) { state.favorites = new Set(); }
    if (token) {
      ensureCsrf().then(function () {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'X-CSRF-Token': csrfToken },
        }).catch(function () {});
      }).catch(function () {});
    }
    notify();
  }

  async function toggleFavorite(listingId) {
    const had = state.favorites.has(listingId);
    // optimistic
    if (had) state.favorites.delete(listingId); else state.favorites.add(listingId);
    notify();
    if (isLoggedIn()) {
      try {
        await api('/api/favorites', { method: 'POST', body: { listing_id: listingId, remove: had } });
      } catch (e) {
        // revert
        if (had) state.favorites.add(listingId); else state.favorites.delete(listingId);
        notify();
        throw e;
      }
    } else {
      localStorage.setItem(LS_FAVS_GUEST, JSON.stringify([...state.favorites]));
    }
    return !had;
  }

  /* -------- selectors -------- */
  function activeListings() { return state.listings.filter((l) => l.status === 'ACTIVE'); }
  function listingById(id) { return state.listings.find((l) => l.id === id) || null; }
  function reviewsFor(listingId) { return state.reviews.filter((r) => r.listing_id === listingId); }
  function ratingFor(listingId) {
    const rs = reviewsFor(listingId);
    if (!rs.length) return null;
    return { avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length, count: rs.length };
  }
  function profileName(p, lang) {
    if (!p) return '—';
    if (lang === 'en' && p.full_name_latin) return p.full_name_latin;
    return p.full_name;
  }

  window.Salif = {
    state, api, bootstrap, loadFavorites, subscribe, notify,
    isLoggedIn, me, login, demoLogin, register, uploadIdDocument, uploadVerification, logout, toggleFavorite,
    activeListings, listingById, reviewsFor, ratingFor, profileName,
  };
  loadSession();
})();
