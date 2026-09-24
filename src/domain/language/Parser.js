// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Linguaggio · Parser
 *
 * Discesa ricorsiva. Precedenza (dal piu' stretto): ¬ ∀ ∃ > ∧ > ∨ > → > ↔.
 * → associa a destra, gli altri binari a sinistra.
 * Funzione pura: nessun I/O, nessuno stato globale.
 */
import { tokenize, SyntaxError_ } from './Lexer.js';
import { Bot, Atom, Eq, Not, And, Or, Imp, Iff, All, Ex } from './Formula.js';

const VARIABLE = /^[a-z][0-9]?$/;

export function parse(source) {
  const tokens = tokenize(source);
  let p = 0;
  const peek   = () => tokens[p].kind;
  const next   = () => tokens[p++];
  const expect = kind => {
    if (tokens[p].kind !== kind) throw new SyntaxError_(`atteso "${kind}"`, tokens[p].position);
    return tokens[p++];
  };

  const biconditional = () => {
    let left = conditional();
    while (peek() === 'iff') { next(); left = Iff(left, conditional()); }
    return left;
  };
  const conditional = () => {
    const left = disjunction();
    return peek() === 'imp' ? (next(), Imp(left, conditional())) : left;
  };
  const disjunction = () => {
    let left = conjunction();
    while (peek() === 'or') { next(); left = Or(left, conjunction()); }
    return left;
  };
  const conjunction = () => {
    let left = unary();
    while (peek() === 'and') { next(); left = And(left, unary()); }
    return left;
  };
  const unary = () => {
    if (peek() === 'not') { next(); return Not(unary()); }
    if (peek() === 'all' || peek() === 'ex') {
      const quantifier = next().kind;
      const variable = expect('identifier').value;
      if (!VARIABLE.test(variable))
        throw new SyntaxError_(`"${variable}" non è una variabile: usa u, v, w, x, y, z`);
      return quantifier === 'all' ? All(variable, unary()) : Ex(variable, unary());
    }
    return primary();
  };
  const primary = () => {
    if (peek() === 'bot') { next(); return Bot(); }
    if (peek() === '(')   { next(); const f = biconditional(); expect(')'); return f; }
    if (peek() === 'identifier') {
      const name = next().value;
      if (peek() === '(') {
        next();
        const args = [];
        if (peek() !== ')') {
          args.push(expect('identifier').value);
          while (peek() === ',') { next(); args.push(expect('identifier').value); }
        }
        expect(')');
        return Atom(name, args);
      }
      if (peek() === 'eq')  { next(); return Eq(name, expect('identifier').value); }
      if (peek() === 'neq') { next(); return Not(Eq(name, expect('identifier').value)); }
      return Atom(name, []);
    }
    throw new SyntaxError_('formula incompleta', tokens[p].position);
  };

  const formula = biconditional();
  if (peek() !== 'end') throw new SyntaxError_('testo in eccesso dopo la formula', tokens[p].position);
  return formula;
}

/** Variante che non lancia: utile ai casi d'uso, che non devono gestire eccezioni di parsing. */
export function tryParse(source) {
  if (!source || !source.trim()) return { ok: false, empty: true, error: 'vuoto' };
  try { return { ok: true, formula: parse(source) }; }
  catch (e) { return { ok: false, empty: false, error: e.message }; }
}
