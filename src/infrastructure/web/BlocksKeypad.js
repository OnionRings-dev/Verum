// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · tastierino del linguaggio dei blocchi (schermata Mondi).
 *
 * Simboli, nomi, variabili e predicati a portata di clic. I predicati e le
 * loro arieta' vengono dalla segnatura del dominio: se il linguaggio cambia,
 * il tastierino cambia da solo.
 */
import { el, insertAround } from './dom.js';
import { SIGNATURE, CONSTANTS } from '../../domain/world/World.js';

const GROUPS = [
  { label: 'Connettivi',  keys: ['¬', '∧', '∨', '→', '↔', '⊥'] },
  { label: 'Quantificatori e identita\u2019', keys: ['∀', '∃', '=', '≠', '(', ')', ','] },
  { label: 'Nomi',        keys: [...CONSTANTS] },
  { label: 'Variabili',   keys: ['x', 'y', 'z', 'u', 'v', 'w'] }
];

/* tre colonne: forma, dimensione, posizione */
const PREDICATE_ROWS = [
  ['Tet', 'Small', 'LeftOf'],
  ['Cube', 'Medium', 'RightOf'],
  ['Dodec', 'Large', 'FrontOf'],
  ['SameShape', 'SameSize', 'BackOf'],
  ['SameRow', 'SameCol', 'Adjoins'],
  ['Larger', 'Smaller', 'Between']
];

const ARGS = ['x', 'y', 'z'];

export class BlocksKeypad {
  constructor({ host, fields }) {
    this.host = host;       // dove disegnare il tastierino
    this.fields = fields;   // contenitore dei campi degli enunciati
    this.last = null;
  }

  start() {
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

    const predicates = el('div', 'kp-preds');
    PREDICATE_ROWS.flat().forEach(name => {
      const arity = SIGNATURE[name];
      const button = this.key(name, 'kp-pred', () => this.type(`${name}(`, ')'));
      button.title = `${name}(${ARGS.slice(0, arity).join(', ')})`;
      predicates.appendChild(button);
    });

    this.host.append(groups, predicates);
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
