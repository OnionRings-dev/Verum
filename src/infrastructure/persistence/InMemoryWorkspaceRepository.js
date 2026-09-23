// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Persistenza · adattatore in memoria.
 * Usato dai test e come fallback quando localStorage non e' disponibile.
 */
import { WorkspaceRepository } from '../../application/ports.js';

export class InMemoryWorkspaceRepository extends WorkspaceRepository {
  constructor() { super(); this.store = new Map(); }
  async load(key)        { return this.store.has(key) ? structuredClone(this.store.get(key)) : null; }
  async save(key, value) { this.store.set(key, structuredClone(value)); }
  async remove(key)      { this.store.delete(key); }
  async resetIfOutdated() { return false; }
}
