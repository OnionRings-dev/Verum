// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · tastierino del linguaggio dei blocchi (schermata Mondi).
 *
 * Simboli, nomi, variabili e predicati a portata di clic. I predicati e le
 * loro arietà vengono dalla segnatura del dominio: se il linguaggio cambia,
 * il tastierino cambia da solo.
 */
import { el, clear, insertAround } from './dom.js';
import { SIGNATURE, CONSTANTS } from '../../domain/world/World.js';

const GROUPS = [
  { label: 'Connettivi',  keys: ['¬', '∧', '∨', '→', '↔', '⊥'] },
  { label: 'Quantificatori e identita\u2019', keys: ['∀', '∃', '=', '≠', '(', ')', ','] },
  { label: 'Nomi',        keys: [...CONSTANTS] },
  { label: 'Variabili',   keys: ['x', 'y', 'z', 'u', 'v', 'w'] }
];

/* i predicati a schede: diciotto pulsanti tutti in vista sono rumore */
const TABS = [
  { id: 'forma',      label: 'Forma',      rules: ['Tet', 'Cube', 'Dodec', 'SameShape'] },
  { id: 'dimensione', label: 'Dimensione', rules: ['Small', 'Medium', 'Large', 'SameSize', 'Larger', 'Smaller'] },
  { id: 'posizione',  label: 'Posizione',  rules: ['LeftOf', 'RightOf', 'FrontOf', 'BackOf', 'SameRow', 'SameCol', 'Adjoins', 'Between'] }
];

const ARGS = ['x', 'y', 'z'];

export class BlocksKeypad {
  constructor({ host, fields, repository }) {
    this.host = host;           // dove disegnare il tastierino
    this.fields = fields;       // contenitore dei campi degli enunciati
    this.repository = repository;
    this.last = null;
    this.tab = TABS[0].id;
  }

  async start() {
    const saved = await this.repository?.load('keypad-tab');
    if (TABS.some(t => t.id === saved)) this.tab = saved;
    this.draw();
  }

  draw() {
    this.fields.addEventListener('focusin', e => { if (e.target.matches('.finput')) this.last = e.target; });
    this.host.setAttribute('role', 'toolbar');
    this.host.setAttribute('aria-label', 'Tastierino del linguaggio dei blocchi');

    const groups = el('div', 'kp-groups');
    GROUPS.forEach(({ label, keys }) => {
      const group = el('div', 'kp-group');
      group.setAttribute('aria-label', label);
      keys.forEach(key => group.appendChild(this.key(key, 'kp-key', () => this.type(key))));
      groups.appendChild(group);
    });

    const tabs = el('div', 'kp-tabs');
    tabs.setAttribute('role', 'tablist');
    const predicates = el('div', 'kp-preds');

    const fill = () => {
      clear(predicates);
      const active = TABS.find(t => t.id === this.tab) ?? TABS[0];
      active.rules.forEach(name => {
        const arity = SIGNATURE[name];
        const button = this.key(name, 'kp-pred', () => this.type(`${name}(`, ')'));
        button.title = `${name}(${ARGS.slice(0, arity).join(', ')})`;
        predicates.appendChild(button);
      });
      [...tabs.children].forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
    };

    TABS.forEach(tab => {
      const button = this.key(tab.label, 'kp-tab', () => {
        this.tab = tab.id;
        this.repository?.save('keypad-tab', tab.id);
        fill();
      });
      button.dataset.tab = tab.id;
      button.setAttribute('role', 'tab');
      tabs.appendChild(button);
    });

    fill();
    this.host.append(groups, tabs, predicates);
  }

  key(text, className, action) {
    const button = el('button', className, text);
    button.type = 'button';
    button.addEventListener('mousedown', e => e.preventDefault()); // il cursore resta nel campo
    button.addEventListener('click', action);
    return button;
  }

  /** Il campo in cui scrivere: l'ultimo usato, altrimenti il primo vuoto, altrimenti l'ultimo. */
  target() {
    if (this.last && this.fields.contains(this.last)) return this.last;
    const inputs = [...this.fields.querySelectorAll('.finput')];
    return inputs.find(i => !i.value) ?? inputs[inputs.length - 1] ?? null;
  }

  type(before, after = '') {
    const field = this.target();
    if (!field) return;
    if (before === ',') before = ', ';
    // due nomi attaccati diventerebbero un nome solo (x + Cube = "xCube"): serve uno spazio
    const previous = field.value.slice(0, field.selectionStart ?? field.value.length).slice(-1);
    if (/^[A-Za-z]/.test(before) && /[A-Za-z0-9]/.test(previous)) before = ' ' + before;
    insertAround(field, before, after);
  }
}
