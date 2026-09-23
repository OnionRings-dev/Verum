// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Linguaggio · Lexer
 * Converte una stringa in token. Funzione pura: stessa stringa, stessi token.
 */
export class SyntaxError_ extends Error {
  constructor(message, position) { super(message); this.name = 'SyntaxError'; this.position = position; }
}

/*
 * Le scorciatoie ASCII seguono la convenzione dei file di esercizio del corso,
 * verificata sui 67 file .sen originali: # e' "diverso da" (x # y), ^ e' ⊥,
 * [ ] valgono come parentesi tonde.
 */
const ONE_CHAR = [
  ['¬~!',  'not'], ['∧&', 'and'], ['∨|', 'or'],   ['→$', 'imp'],
  ['↔%',   'iff'], ['∀@', 'all'], ['∃/', 'ex'],   ['⊥^', 'bot'], ['≠#', 'neq'],
];

export function tokenize(source) {
  const out = [];
  let i = 0;
  const push = (kind, value) => out.push({ kind, value, position: i });

  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) { i++; continue; }

    if (source.startsWith('<->', i) || source.startsWith('<=>', i)) { push('iff'); i += 3; continue; }
    if (source.startsWith('_|_', i)) { push('bot'); i += 3; continue; }

    const two = source.substr(i, 2);
    if (two === '->' || two === '=>') { push('imp'); i += 2; continue; }
    if (two === '/\\')               { push('and'); i += 2; continue; }
    if (two === '\\/')               { push('or');  i += 2; continue; }
    if (two === '!=' || two === '~=') { push('neq'); i += 2; continue; }

    const hit = ONE_CHAR.find(([chars]) => chars.includes(c));
    if (hit) { push(hit[1]); i++; continue; }

    if (c === '(' || c === '[') { push('('); i++; continue; }
    if (c === ')' || c === ']') { push(')'); i++; continue; }
    if (c === ',') { push(','); i++; continue; }
    if (c === '=') { push('eq'); i++; continue; }

    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      push('identifier', source.slice(i, j));
      i = j;
      continue;
    }
    throw new SyntaxError_(`carattere non riconosciuto: "${c}"`, i);
  }
  push('end');
  return out;
}
