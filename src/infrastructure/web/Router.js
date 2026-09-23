// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/** Infrastruttura · Web · navigazione fra schermate. */
import { $$ } from './dom.js';

export class Router {
  constructor(screens = ['home', 'tt', 'wd', 'pf']) { this.screens = screens; }

  start() {
    $$('[data-go]').forEach(b => b.addEventListener('click', () => this.go(b.dataset.go)));
    $$('[data-home]').forEach(b => b.addEventListener('click', () => this.go('home')));
    const hash = (location.hash || '').slice(1);
    if (this.screens.includes(hash)) this.go(hash);
  }

  go(id) {
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + id));
    window.scrollTo(0, 0);
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  }
}
