// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · selettore dell'aspetto.
 *
 * L'aspetto e' pura presentazione: vive interamente qui e nel CSS. Riempie ogni
 * segnaposto [data-themes] (uno per schermata), tiene i bottoni sincronizzati
 * e salva la scelta attraverso la porta WorkspaceRepository.
 *
 * Usa l'attributo data-look, non data-theme: data-theme può essere impostato
 * dall'ambiente che ospita la pagina (sistema o visualizzatore) e non deve
 * essere sovrascritto. Finche' l'utente non sceglie, Verum segue quello.
 */
import { $$, el } from './dom.js';

export const LOOKS = Object.freeze([
  { id: 'minimal', label: 'Minimal' },
  { id: 'neon',    label: 'Neon' },
  { id: 'dark',    label: 'Dark' }
]);

export class ThemeSwitcher {
  constructor({ repository }) { this.repository = repository; this.chosen = null; }

  async start() {
    const saved = await this.repository.load('theme');
    if (LOOKS.some(l => l.id === saved)) this.apply(saved, { persist: false });

    $$('[data-themes]').forEach(group => {
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Aspetto');
      LOOKS.forEach(look => {
        const button = el('button', null, look.label);
        button.type = 'button';
        button.dataset.look = look.id;
        button.addEventListener('click', () => this.apply(look.id));
        group.appendChild(button);
      });
    });

    // se l'utente non ha scelto, i bottoni seguono il tema del sistema quando cambia
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.sync());
    this.sync();
  }

  /** L'aspetto in uso: quello scelto, altrimenti quello ereditato dall'ambiente. */
  effective() {
    if (this.chosen) return this.chosen;
    const host = document.documentElement.dataset.theme;
    if (host === 'dark') return 'dark';
    if (host === 'light') return 'minimal';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'minimal';
  }

  apply(id, { persist = true } = {}) {
    this.chosen = id;
    document.documentElement.dataset.look = id;
    this.sync();
    if (persist) this.repository.save('theme', id);
  }

  sync() {
    const current = this.effective();
    $$('[data-themes] button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.look === current)));
  }
}
