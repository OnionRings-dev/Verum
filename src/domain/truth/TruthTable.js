// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Verità · TruthTable
 * Semantica veritativo-funzionale. Tutto ciò che non è un connettivo
 * proposizionale viene trattato come atomo, incluse le formule quantificate.
 */
import { print } from '../language/Printer.js';

export const MAX_ATOMS = 12;

export function atomsOf(f, acc = new Map()) {
  switch (f.t) {
    case 'not': atomsOf(f.a, acc); break;
    case 'and': case 'or': case 'imp': case 'iff':
      atomsOf(f.l, acc); atomsOf(f.r, acc); break;
    case 'bot': break;
    default: acc.set(print(f), f);
  }
  return acc;
}

/** Oggetto senza prototipo: un atomo che si chiama "constructor" o "toString"
 *  non deve ereditare un valore di verità da Object.prototype. */
export const emptyAssignment = () => Object.create(null);

export function valueUnder(f, assignment) {
  switch (f.t) {
    case 'bot': return false;
    case 'not': return !valueUnder(f.a, assignment);
    case 'and': return valueUnder(f.l, assignment) && valueUnder(f.r, assignment);
    case 'or':  return valueUnder(f.l, assignment) || valueUnder(f.r, assignment);
    case 'imp': return !valueUnder(f.l, assignment) || valueUnder(f.r, assignment);
    case 'iff': return valueUnder(f.l, assignment) === valueUnder(f.r, assignment);
    default:    return assignment[print(f)] === true;
  }
}

/** Costruisce la tavola completa. `null` se supera MAX_ATOMS. */
export function tableFor(formulas) {
  const index = new Map();
  formulas.forEach(f => atomsOf(f, index));
  const atoms = [...index.keys()].sort();
  if (atoms.length > MAX_ATOMS) return null;

  const rowCount = 1 << atoms.length;
  const assignments = [];
  const columns = formulas.map(() => []);

  for (let r = 0; r < rowCount; r++) {
    const assignment = emptyAssignment();
    atoms.forEach((a, i) => { assignment[a] = !((r >> (atoms.length - 1 - i)) & 1); });
    assignments.push(assignment);
    formulas.forEach((f, j) => columns[j].push(valueUnder(f, assignment)));
  }
  return { atoms, assignments, columns, rowCount };
}

/** Conseguenza tautologica: premesse ⊨tt conclusione. `null` se troppo grande. */
export function isTautologicalConsequence(premises, conclusion) {
  const table = tableFor([...premises, conclusion]);
  if (!table) return null;
  const last = table.columns.length - 1;
  for (let r = 0; r < table.rowCount; r++) {
    const premisesHold = table.columns.slice(0, last).every(col => col[r]);
    if (premisesHold && !table.columns[last][r]) return false;
  }
  return true;
}
