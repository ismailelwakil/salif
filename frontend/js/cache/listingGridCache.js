/* سلف — IndexedDB listing-grid cache with TTL (stale-while-revalidate). */
'use strict';
(function () {
  const DB = 'salif';
  const STORE = 'grid';
  const TTL_MS = 5 * 60 * 1000;

  function available() {
    try { return typeof indexedDB !== 'undefined' && !!indexedDB; } catch (e) { return false; }
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function read(key) {
    if (!available()) return null;
    try {
      const db = await openDB();
      const row = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
      db.close();
      if (!row || !row.savedAt) return null;
      return { data: row.data, savedAt: row.savedAt, stale: Date.now() - row.savedAt > TTL_MS };
    } catch (e) { return null; }
  }

  async function write(key, data) {
    if (!available()) return;
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ data: data, savedAt: Date.now() }, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {}
  }

  window.SalifCache = { read: read, write: write, TTL_MS: TTL_MS };
})();
