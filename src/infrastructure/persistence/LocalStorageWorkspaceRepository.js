// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Persistenza · adattatore su localStorage.
 * Sostituirlo con un adattatore HTTP verso un backend non richiede di toccare
 * né il dominio né i casi d'uso: cambia solo la riga del composition root.
 */
import { WorkspaceRepository } from '../../application/ports.js';

export class LocalStorageWorkspaceRepository extends WorkspaceRepository {
  constructor(prefix = 'verum:') { super(); this.prefix = prefix; }

  async load(key) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  async save(key, value) {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); }
    catch { /* quota o modalita' privata: lo stato resta solo in memoria */ }
  }
  /**
   * Svuota le chiavi indicate una sola volta, quando cambia la versione del
   * formato salvato. Serve a eliminare gli esempi precaricati dalle versioni
   * precedenti senza toccare le preferenze (come il tema).
   */
  async resetIfOutdated(version, keys) {
    try {
      const marker = this.prefix + 'schema';
      if (localStorage.getItem(marker) === String(version)) return false;
      keys.forEach(k => localStorage.removeItem(this.prefix + k));
      localStorage.setItem(marker, String(version));
      return true;
    } catch { return false; }
  }

  async remove(key) {
    try { localStorage.removeItem(this.prefix + key); } catch { /* ignorato */ }
  }
}
