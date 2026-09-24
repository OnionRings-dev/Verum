// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Prova · ProofChecker
 *
 * Servizio di dominio. Risolve le citazioni contro la struttura della prova,
 * poi delega alla regola. Non sa nulla di DOM, di persistenza o di quale
 * interfaccia lo stia usando.
 */
import { Proof, Justification } from './Proof.js';
import { RULES } from './rules.js';
import { tryParse } from '../language/Parser.js';
import { citationTokens } from './citations.js';
import { equals, freeTerms } from '../language/Formula.js';

export const Status = Object.freeze({
  OK: 'ok', INVALID: 'invalid', MALFORMED: 'malformed', UNJUSTIFIED: 'unjustified', EMPTY: 'empty'
});

const RANGE = /^(\d+)\s*[-–]\s*(\d+)$/;

export class ProofChecker {
  check(proof) {
    const index = proof.index();
    const formulas = new Map();
    for (const { line } of index.lines) {
      const parsed = tryParse(line.text);
      formulas.set(line.id, parsed.ok ? parsed.formula : null);
    }

    const results = new Map();
    for (const entry of index.lines) {
      results.set(entry.line.id, this.checkLine(entry, index, formulas, proof));
    }
    return { results, index, formulas, verdict: this.verdictFor(proof, index, formulas, results) };
  }

  checkLine(entry, index, formulas, proof) {
    const { line } = entry;
    if (!line.text.trim()) return { status: Status.EMPTY };

    const formula = formulas.get(line.id);
    if (!formula) return { status: Status.MALFORMED, message: `formula non valida: ${tryParse(line.text).error}` };

    if (line.rule === Justification.PREMISE)    return this.checkPremise(entry, proof);
    if (line.rule === Justification.ASSUMPTION) return this.checkAssumption(entry);
    if (!line.rule) return { status: Status.UNJUSTIFIED };

    const rule = RULES.get(line.rule);
    if (!rule) return { status: Status.INVALID, message: `regola non riconosciuta: ${line.rule}` };

    const resolved = this.resolveCitations(line.citations, entry, index, formulas, proof);
    if (resolved.error) return { status: Status.INVALID, message: resolved.error };

    const outcome = rule.check({ conclusion: formula, lines: resolved.lines, subproofs: resolved.subproofs });
    return outcome.ok ? { status: Status.OK } : { status: Status.INVALID, message: outcome.reason };
  }

  /**
   * Una premessa sta solo al livello principale, prima di ogni riga derivata:
   * è il punto di partenza dichiarato, non una mossa della prova.
   */
  checkPremise(entry, proof) {
    const container = entry.chain[entry.chain.length - 1];
    if (container !== proof)
      return { status: Status.INVALID, message: 'una premessa non puo\u2019 stare dentro una sottodimostrazione: li\u2019 si usa un\u2019assunzione' };
    const position = proof.items.indexOf(entry.line);
    const derivedBefore = proof.items.slice(0, position)
      .some(item => item.kind !== 'line' || item.rule !== Justification.PREMISE);
    return derivedBefore
      ? { status: Status.INVALID, message: 'le premesse vanno tutte in cima, prima di ogni riga derivata' }
      : { status: Status.OK };
  }

  /**
   * Un'assunzione è lecita solo come prima riga di una sottodimostrazione:
   * è proprio l'apertura della sottodimostrazione a renderla temporanea.
   */
  checkAssumption(entry) {
    const container = entry.chain[entry.chain.length - 1];
    if (container.kind !== 'subproof')
      return { status: Status.INVALID, message: 'un\u2019assunzione e\u2019 lecita solo come prima riga di una sottodimostrazione: creala con \u201c+ Sottodimostrazione\u201d' };
    if (container.items[0] !== entry.line)
      return { status: Status.INVALID, message: 'solo la prima riga di una sottodimostrazione e\u2019 un\u2019assunzione' };
    return { status: Status.OK };
  }

  resolveCitations(citations, entry, index, formulas, proof) {
    const tokens = citationTokens(citations);
    const lines = [], subproofs = [];

    for (const token of tokens) {
      const range = token.match(RANGE);
      if (range) {
        const [first, last] = [Number(range[1]), Number(range[2])];
        const found = index.subproofs.find(s => s.first === first && s.last === last);
        if (!found) return { error: `non esiste una sottodimostrazione ${token}` };
        if (!Proof.isAccessible(found.chain, entry.chain))
          return { error: `la sottodimostrazione ${token} non e\u2019 accessibile da qui` };
        if (entry.chain.includes(found.subproof))
          return { error: 'non puoi citare la sottodimostrazione in cui ti trovi' };
        if (found.last >= entry.number) return { error: `la sottodimostrazione ${token} non e\u2019 ancora chiusa` };

        const innerLines = found.subproof.items.filter(i => i.kind === 'line');
        const constant = (found.subproof.constant || '').trim();
        subproofs.push({
          assumption: innerLines.length ? formulas.get(innerLines[0].id) : null,
          conclusion: this.lastFormulaOf(found.subproof, formulas),
          constant,
          isFresh: constant ? this.isFreshOutside(constant, found.subproof, index, formulas, proof) : false,
          label: token
        });
        continue;
      }

      if (!/^\d+$/.test(token)) return { error: `citazione non riconosciuta: "${token}"` };
      const number = Number(token);
      const target = index.lines.find(l => l.number === number);
      if (!target) return { error: `non esiste la riga ${number}` };
      if (number >= entry.number) return { error: `la riga ${number} non precede questa` };
      if (!Proof.isAccessible(target.chain, entry.chain))
        return { error: `la riga ${number} e\u2019 dentro una sottodimostrazione chiusa: non e\u2019 accessibile` };
      const formula = formulas.get(target.line.id);
      if (!formula) return { error: `la riga ${number} non contiene una formula valida` };
      lines.push({ formula, number });
    }
    return { lines, subproofs };
  }

  /**
   * La condizione che rende sane ∀ Intro ed ∃ Elim: la costante introdotta non
   * deve comparire da nessuna parte fuori dalla sottodimostrazione che la
   * introduce, obiettivo compreso. Senza questo controllo da Cube(a) si
   * dimostrerebbe ∀x Cube(x).
   */
  isFreshOutside(constant, subproof, index, formulas, proof) {
    for (const entry of index.lines) {
      if (entry.chain.includes(subproof)) continue;       // dentro: non conta
      const formula = formulas.get(entry.line.id);
      if (formula && freeTerms(formula).has(constant)) return false;
    }
    const goal = tryParse(proof.goal);
    if (goal.ok && freeTerms(goal.formula).has(constant)) return false;
    return true;
  }

  lastFormulaOf(container, formulas) {
    for (let i = container.items.length - 1; i >= 0; i--) {
      const item = container.items[i];
      if (item.kind === 'line') return formulas.get(item.id);
      const inner = this.lastFormulaOf(item, formulas);
      if (inner) return inner;
    }
    return null;
  }

  verdictFor(proof, index, formulas, results) {
    // le righe ancora vuote sono spazio di lavoro, non errori: non contano
    const written = index.lines.filter(l => results.get(l.line.id)?.status !== Status.EMPTY);
    if (!written.length) return { kind: 'empty', message: '' };
    const everyLineOk = written.every(l => results.get(l.line.id)?.status === Status.OK);
    if (!everyLineOk) return { kind: 'incomplete', message: 'ci sono righe non giustificate' };

    const goal = tryParse(proof.goal);
    if (!goal.ok) return { kind: 'sound', message: 'tutte le righe sono corrette' };

    const topLevel = proof.items.filter(i => i.kind !== 'line' || i.text.trim());
    const last = topLevel[topLevel.length - 1];
    const lastFormula = last && last.kind === 'line' ? formulas.get(last.id) : null;
    return lastFormula && equals(lastFormula, goal.formula)
      ? { kind: 'complete', message: 'prova completa' }
      : { kind: 'off-goal', message: 'righe corrette, ma l\u2019ultima non e\u2019 l\u2019obiettivo' };
  }
}
