// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Applicazione · Caso d'uso · Costruisci una tavola di verità
 *
 * Riceve testo grezzo, restituisce un DTO piatto e serializzabile.
 * Non conosce il DOM: lo stesso caso d'uso serve una CLI, un test o un'API.
 */
import { tryParse } from '../domain/language/Parser.js';
import { print } from '../domain/language/Printer.js';
import { tableFor, MAX_ATOMS } from '../domain/truth/TruthTable.js';

export class BuildTruthTable {
  execute({ sentences }) {
    const parsed = [], errors = [];
    sentences.forEach((text, position) => {
      const result = tryParse(text);
      if (result.ok) parsed.push({ position, text, formula: result.formula });
      else if (!result.empty) errors.push({ position, message: result.error });
    });

    if (errors.length) return { status: 'invalid', errors };
    if (!parsed.length) return { status: 'empty', errors: [] };

    const table = tableFor(parsed.map(p => p.formula));
    if (!table) return { status: 'too-large', limit: MAX_ATOMS, errors: [] };

    return {
      status: 'ok',
      errors: [],
      atoms: table.atoms,
      headers: parsed.map(p => print(p.formula)),
      rows: table.assignments.map((assignment, r) => ({
        reference: table.atoms.map(a => assignment[a]),
        values: table.columns.map(col => col[r])
      })),
      analysis: this.analyse(parsed, table)
    };
  }

  analyse(parsed, table) {
    const perColumn = table.columns.map((col, j) => ({
      header: print(parsed[j].formula),
      kind: col.every(Boolean) ? 'tautology' : col.every(v => !v) ? 'contradiction' : 'contingent'
    }));

    if (parsed.length < 2) return { perColumn };

    const last = table.columns.length - 1;
    let counterexample = null;
    for (let r = 0; r < table.rowCount; r++) {
      const premisesHold = table.columns.slice(0, last).every(col => col[r]);
      if (premisesHold && !table.columns[last][r]) {
        counterexample = { row: r + 1, assignment: { ...table.assignments[r] } };
        break;
      }
    }
    const satisfiable = [...Array(table.rowCount).keys()]
      .some(r => table.columns.every(col => col[r]));

    return { perColumn, valid: counterexample === null, counterexample, satisfiable };
  }
}
