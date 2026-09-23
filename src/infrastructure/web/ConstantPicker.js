// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · casella della costante di una sottodimostrazione.
 *
 * Campo di testo libero, facoltativo, con un menu di scelte rapide:
 * nessuna costante, i nomi a-f, oppure "nuova", che propone un nome non
 * ancora usato nella prova (calcolato dal dominio).
 */
import { el } from './dom.js';
import { CONSTANTS } from '../../domain/world/Block.js';

export function constantPicker({ value, used, fresh, onChange, onCommit }) {
  const wrap = el('span', 'cpick');
  const input = el('input', 'pconst formula');
  input.value = value;
  input.maxLength = 4;
  input.setAttribute('aria-label', 'Costante della sottodimostrazione (facoltativa)');
  input.title = 'Costante nuova, facoltativa: serve per \u2200 Intro ed \u2203 Elim';

  const toggle = el('button', 'cpick-toggle', '\u25be');
  toggle.type = 'button';
  toggle.tabIndex = -1;
  toggle.setAttribute('aria-label', 'Scegli una costante');

  const menu = el('div', 'cpick-menu');
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  const choose = name => {
    input.value = name;
    onChange(name);
    menu.hidden = true;
    onCommit();
  };
  const option = (label, action, extra = '') => {
    const b = el('button', 'cpick-opt' + extra, label);
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', action);
    return b;
  };

  menu.appendChild(option('nessuna', () => choose(''), ' wide'));
  CONSTANTS.forEach(name => {
    const b = option(name, () => choose(name), used.has(name) ? ' used' : '');
    if (used.has(name)) b.title = `${name} compare gia\u2019 nella prova: non sarebbe nuova`;
    menu.appendChild(b);
  });
  menu.appendChild(option('nuova', () => {
    const name = fresh();
    input.value = name;
    onChange(name);
    menu.hidden = true;
    input.focus();
    input.select();   // si puo' rinominare subito scrivendo
  }, ' wide new'));

  const open = () => { menu.hidden = false; };
  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', () => onChange(input.value.trim()));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { menu.hidden = true; }
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });
  input.addEventListener('blur', () => { menu.hidden = true; onCommit(); });
  toggle.addEventListener('mousedown', e => e.preventDefault());
  toggle.addEventListener('click', () => { menu.hidden ? (input.focus(), open()) : (menu.hidden = true); });

  wrap.append(input, toggle, menu);
  return wrap;
}
