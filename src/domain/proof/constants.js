// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Prova · costanti delle sottodimostrazioni
 *
 * Le regole ∀ Intro ed ∃ Elim chiedono una costante "nuova": che non compaia
 * fuori dalla sottodimostrazione in cui viene introdotta. Qui si calcola
 * quali nomi sono già in uso e se ne propone uno libero.
 */
import { tryParse } from '../language/Parser.js';
import { freeTerms } from '../language/Formula.js';
import { CONSTANTS } from '../world/Block.js';

/** Le variabili (u-z, eventualmente con un numero) non possono fare da costante. */
export const isVariableName = name => /^[u-z][0-9]*$/.test(name);
export const isConstantName = name => /^[a-z][a-z0-9]*$/.test(name) && !isVariableName(name);

/** Nomi usati nella prova: termini liberi di ogni riga, obiettivo e costanti già dichiarate. */
export function namesInUse(proof) {
  const used = new Set();
  const visit = container => container.items.forEach(item => {
    if (item.kind === 'line') {
      const parsed = tryParse(item.text);
      if (parsed.ok) freeTerms(parsed.formula).forEach(n => used.add(n));
    } else {
      if (item.constant) used.add(item.constant);
      visit(item);
    }
  });
  visit(proof);
  const goal = tryParse(proof.goal);
  if (goal.ok) freeTerms(goal.formula).forEach(n => used.add(n));
  return used;
}

/** Il primo nome libero: prima a-f, poi n1, n2, ... */
export function freshConstant(proof) {
  const used = namesInUse(proof);
  const first = CONSTANTS.find(c => !used.has(c));
  if (first) return first;
  for (let i = 1; ; i++) if (!used.has('n' + i)) return 'n' + i;
}
