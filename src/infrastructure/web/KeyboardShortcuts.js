// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · scorciatoie da tastiera.
 *
 * Due principi:
 *  - non si calpesta nulla di ciò che il browser e il sistema già usano
 *    (niente Ctrl+A, Ctrl+C, Ctrl+N, Ctrl+1…9);
 *  - i tasti nudi valgono solo quando non si sta scrivendo in un campo,
 *    così premere "c" dentro una formula scrive una c e basta.
 *
 * L'elenco vive qui ed è anche ciò che il pannello di aiuto mostra: non
 * possono divergere.
 */
import { $, $$, el, clear } from './dom.js';
import { Shape, Size, CONSTANTS } from '../../domain/world/Block.js';

export const SHORTCUTS = [
  {
    screen: 'Ovunque',
    keys: [
      ['?', 'apre e chiude questo elenco'],
      ['Esc', 'chiude menu e pannelli'],
      ['Alt + 1 / 2 / 3', 'passa a Tavole, Mondi, Derivazioni'],
      ['Alt + 0', 'torna alla pagina iniziale']
    ]
  },
  {
    screen: 'Derivazioni',
    keys: [
      ['Invio', 'aggiunge una riga sotto quella corrente'],
      ['Ctrl + Invio', 'apre una sottodimostrazione'],
      ['Tab', 'fa rientrare la riga di un livello'],
      ['Maiusc + Tab', 'fa uscire la riga dalla sottodimostrazione'],
      ['Backspace in una riga vuota', 'elimina la riga e torna a quella sopra'],
      ['clic sul numero di riga', 'cita quella riga, mentre il campo rif. è attivo']
    ]
  },
  {
    screen: 'Mondi (con un blocco selezionato, fuori dai campi di testo)',
    keys: [
      ['frecce', 'sposta il blocco di una casella'],
      ['Backspace o Canc', 'elimina il blocco'],
      ['1 / 2 / 3', 'piccolo, medio, grande'],
      ['t / c / d', 'tetraedro, cubo, dodecaedro'],
      ['da a a f', 'assegna o toglie quel nome'],
      ['n', 'aggiunge un blocco nella prima casella libera'],
      ['Esc', 'deseleziona']
    ]
  },
  {
    screen: 'Tavole',
    keys: [
      ['Invio', 'aggiunge un enunciato sotto'],
      ['Backspace in una riga vuota', 'elimina la riga']
    ]
  }
];

const TYPING = 'input, textarea, select, [contenteditable="true"]';

export class KeyboardShortcuts {
  constructor({ router, worldView }) {
    this.router = router;
    this.worldView = worldView;
    this.helpOpen = false;
  }

  start() {
    this.panel = $('#shortcuts');
    this.render();
    $$('[data-shortcuts]').forEach(b => b.addEventListener('click', () => this.toggleHelp()));
    document.addEventListener('keydown', e => this.handle(e));
  }

  currentScreen() { return document.querySelector('.screen.on')?.id.replace('s-', '') ?? 'home'; }
  isTyping(target) { return Boolean(target?.closest?.(TYPING)); }

  handle(event) {
    const typing = this.isTyping(event.target);

    if (event.key === 'Escape') { if (this.helpOpen) { this.toggleHelp(false); event.preventDefault(); } return; }
    if (event.key === '?' && !typing) { event.preventDefault(); this.toggleHelp(); return; }

    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const target = { '1': 'tt', '2': 'wd', '3': 'pf', '0': 'home' }[event.key];
      if (target) { event.preventDefault(); this.router.go(target); return; }
    }

    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.currentScreen() === 'wd') this.world(event);
  }

  world(event) {
    const world = this.worldView;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const sizes = { '1': Size.SMALL, '2': Size.MEDIUM, '3': Size.LARGE };
    const shapes = { t: Shape.TET, c: Shape.CUBE, d: Shape.DODEC };
    const key = event.key;

    if (moves[key]) { event.preventDefault(); world.moveSelected(...moves[key]); return; }
    if (key === 'Backspace' || key === 'Delete') { event.preventDefault(); world.deleteSelected(); return; }
    if (sizes[key]) { event.preventDefault(); world.changeSelected({ size: sizes[key] }); return; }
    if (shapes[key.toLowerCase()]) { event.preventDefault(); world.changeSelected({ shape: shapes[key.toLowerCase()] }); return; }
    if (CONSTANTS.includes(key)) { event.preventDefault(); world.nameSelected(key); return; }
    if (key === 'n') { event.preventDefault(); world.addBlockSomewhere(); return; }
    if (key === 'Escape') world.deselect();
  }

  toggleHelp(force) {
    this.helpOpen = force ?? !this.helpOpen;
    this.panel.hidden = !this.helpOpen;
    if (this.helpOpen) this.panel.querySelector('.sc-close')?.focus();
  }

  render() {
    const box = clear(this.panel);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Scorciatoie da tastiera');

    const card = el('div', 'sc-card');
    const head = el('div', 'sc-head');
    head.appendChild(el('h2', null, 'Scorciatoie'));
    const close = el('button', 'btn sm sc-close', 'Chiudi');
    close.type = 'button';
    close.addEventListener('click', () => this.toggleHelp(false));
    head.appendChild(close);
    card.appendChild(head);

    SHORTCUTS.forEach(group => {
      card.appendChild(el('h3', 'sc-group', group.screen));
      const table = el('table', 'sc-table');
      group.keys.forEach(([key, what]) => {
        const row = el('tr');
        const cell = el('td');
        cell.appendChild(el('kbd', null, key));
        row.append(cell, el('td', null, what));
        table.appendChild(row);
      });
      card.appendChild(table);
    });

    box.appendChild(card);
    box.addEventListener('click', e => { if (e.target === box) this.toggleHelp(false); });
  }
}
