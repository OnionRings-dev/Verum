// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · scelta della regola.
 *
 * Al posto di un menu a tendina: un'etichetta che si legge come la
 * giustificazione scritta a mano ("∧ Elim"), e che aperta mostra le regole
 * raggruppate, filtrabili scrivendo. Così la riga resta leggibile come una
 * riga di dimostrazione, non come un campo di un modulo.
 */
import { el, clear } from './dom.js';
import { RULES } from '../../domain/proof/rules.js';
import { Justification } from '../../domain/proof/Proof.js';

const QUANTIFIER = /^[∀∃=]/;

function groups() {
  const names = [...RULES.keys()];
  return [
    { label: 'Struttura', rules: [Justification.PREMISE, Justification.ASSUMPTION] },
    { label: 'Proposizionali', rules: names.filter(n => !QUANTIFIER.test(n)) },
    { label: 'Quantificatori e identita\u2019', rules: names.filter(n => QUANTIFIER.test(n)) }
  ];
}

/**
 * Il menu non tiene lo stato per conto suo: chi apre e chi chiude lo decide la
 * vista (`open`). Ogni modifica ridisegna la prova, e un menu che vivesse solo
 * nel DOM verrebbe distrutto sotto il clic dell'utente.
 */
export function rulePicker({ value, open = false, fk, onOpen, onClose, onPick }) {
  const wrap = el('span', 'cpick rpick');
  const label = el('button', 'prule' + (value ? '' : ' empty'), value || 'regola');
  label.type = 'button';
  label.setAttribute('aria-haspopup', 'listbox');
  label.title = 'Scegli la regola';

  const menu = el('div', 'rule-menu');
  menu.setAttribute('role', 'listbox');
  menu.hidden = !open;

  const search = el('input', 'rule-search');
  if (fk) search.dataset.fk = fk;
  search.type = 'search';
  search.placeholder = 'Filtra le regole';
  search.setAttribute('aria-label', 'Filtra le regole');
  const list = el('div', 'rule-list');

  const choose = rule => onPick(rule);

  const fill = () => {
    clear(list);
    const query = search.value.trim().toLowerCase();
    const matches = rule => rule.toLowerCase().includes(query);

    if (!query || 'nessuna'.includes(query)) {
      const none = option('nessuna', () => choose(''), 'rule-none');
      list.appendChild(none);
    }
    for (const group of groups()) {
      const visible = group.rules.filter(matches);
      if (!visible.length) continue;
      list.appendChild(el('p', 'rule-group', group.label));
      visible.forEach(rule => list.appendChild(option(rule, () => choose(rule), value === rule ? 'on' : '')));
    }
    if (!list.children.length) list.appendChild(el('p', 'hint', 'Nessuna regola con questo nome.'));
  };

  function option(text, action, extra = '') {
    const button = el('button', 'rule-opt ' + extra, text);
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', action);
    return button;
  }

  label.addEventListener('mousedown', e => e.preventDefault());
  label.addEventListener('click', () => (open ? onClose() : onOpen()));
  search.addEventListener('input', fill);
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'Enter') { e.preventDefault(); list.querySelector('.rule-opt')?.click(); }
  });
  search.addEventListener('blur', () => onClose());

  if (open) fill();
  menu.append(search, list);
  wrap.append(label, menu);
  return wrap;
}
