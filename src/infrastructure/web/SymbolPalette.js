// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/** Infrastruttura · Web · tastierino dei simboli logici. */
import { $$, el } from './dom.js';

const SYMBOLS = ['¬','∧','∨','→','↔','⊥','∀','∃','=','≠'];

export class SymbolPalette {
  constructor() { this.lastField = null; }

  start() {
    document.addEventListener('focusin', e => {
      if (e.target.matches('.finput, .pf')) this.lastField = e.target;
    });
    $$('.palette').forEach(palette => SYMBOLS.forEach(symbol => {
      const button = el('button', null, symbol);
      button.type = 'button';
      button.title = symbol;
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => this.insert(symbol));
      palette.appendChild(button);
    }));
  }

  insert(symbol) {
    const field = this.lastField?.closest('.screen.on') ? this.lastField : null;
    if (!field) return;
    const start = field.selectionStart, end = field.selectionEnd;
    field.value = field.value.slice(0, start) + symbol + field.value.slice(end);
    field.focus();
    field.selectionStart = field.selectionEnd = start + symbol.length;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
