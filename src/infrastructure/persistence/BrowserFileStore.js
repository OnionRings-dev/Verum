// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Persistenza · archivio di file nel browser.
 *
 * Conserva un file scelto dall'utente (es. il PDF delle regole) in IndexedDB,
 * così resta disponibile tra una sessione e l'altra. Il file non lascia mai
 * il computer dell'utente e non fa parte del repository.
 * Se IndexedDB non c'è (navigazione privata, ambienti di test) ripiega sulla
 * memoria: il file vale per la sessione corrente.
 */
const DB_NAME = 'verum-files';
const STORE = 'files';

export class BrowserFileStore {
  constructor() { this.memory = new Map(); this.dbPromise = null; }

  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise(resolve => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
    return this.dbPromise;
  }

  async run(mode, action) {
    const db = await this.open();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request?.result ?? null);
        tx.onerror = tx.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  /** @returns {Promise<{name:string, type:string, blob:Blob}|null>} */
  async get(key) {
    const stored = await this.run('readonly', s => s.get(key));
    return stored ?? this.memory.get(key) ?? null;
  }
  async put(key, file) {
    const record = { name: file.name, type: file.type || 'application/pdf', blob: file };
    this.memory.set(key, record);
    await this.run('readwrite', s => s.put(record, key));
  }
  async remove(key) {
    this.memory.delete(key);
    await this.run('readwrite', s => s.delete(key));
  }
}
