// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Prova · Regole di inferenza
 *
 * Ogni regola e' un oggetto con un proprio `check`. Aggiungere una regola
 * (Ana Con, FO Con, un sistema di Hilbert, la logica modale) significa
 * aggiungere un file, non modificare un `switch`: il registro e' aperto
 * all'estensione e chiuso alla modifica.
 *
 * Il contesto passato a `check` e' già risolto dal ProofChecker:
 *   { conclusion, lines: [{formula, number}], subproofs: [{assumption, conclusion, constant}] }
 */
import { equals, substitute, freeTerms, conjuncts, disjuncts, equalsUpToSubstitution } from '../language/Formula.js';
import { print } from '../language/Printer.js';
import { isTautologicalConsequence } from '../truth/TruthTable.js';
import { CONSTANTS } from '../world/Block.js';
import { isConstantName } from './constants.js';

const ok = () => ({ ok: true });
const no = reason => ({ ok: false, reason });
const shape = (ctx, nLines, nSubproofs, message) =>
  (ctx.lines.length !== nLines || ctx.subproofs.length !== nSubproofs) ? no(message) : null;

export const RULES = new Map();
const rule = (name, check) => RULES.set(name, { name, check });

rule('Reit', ctx => {
  const bad = shape(ctx, 1, 0, 'cita esattamente una riga'); if (bad) return bad;
  return equals(ctx.conclusion, ctx.lines[0].formula) ? ok() : no('la formula non coincide con la riga citata');
});

rule('∧ Intro', ctx => {
  if (ctx.subproofs.length) return no('cita solo righe');
  if (!ctx.lines.length) return no('cita i congiunti');
  const parts = conjuncts(ctx.conclusion);
  const covered = parts.every(c => ctx.lines.some(l => equals(l.formula, c)));
  const used    = ctx.lines.every(l => parts.some(c => equals(l.formula, c)));
  return covered && used ? ok() : no('i congiunti della conclusione devono corrispondere alle righe citate');
});

rule('∧ Elim', ctx => {
  const bad = shape(ctx, 1, 0, 'cita una sola riga'); if (bad) return bad;
  return conjuncts(ctx.lines[0].formula).some(c => equals(c, ctx.conclusion))
    ? ok() : no('la formula non e\u2019 un congiunto della riga citata');
});

rule('∨ Intro', ctx => {
  const bad = shape(ctx, 1, 0, 'cita una sola riga'); if (bad) return bad;
  return disjuncts(ctx.conclusion).some(d => equals(d, ctx.lines[0].formula))
    ? ok() : no('la riga citata deve essere uno dei disgiunti');
});

rule('∨ Elim', ctx => {
  if (ctx.lines.length !== 1) return no('cita una disgiunzione e una sottodimostrazione per ogni disgiunto');
  if (ctx.lines[0].formula.t !== 'or') return no(`la riga ${ctx.lines[0].number} non e\u2019 una disgiunzione`);
  const parts = disjuncts(ctx.lines[0].formula);
  if (ctx.subproofs.length !== parts.length)
    return no(`servono ${parts.length} sottodimostrazioni, una per disgiunto`);
  const used = new Set();
  for (const d of parts) {
    const i = ctx.subproofs.findIndex((s, k) => !used.has(k) && s.assumption && equals(s.assumption, d));
    if (i < 0) return no(`manca la sottodimostrazione che assume ${print(d)}`);
    used.add(i);
  }
  for (const s of ctx.subproofs)
    if (!s.conclusion || !equals(s.conclusion, ctx.conclusion))
      return no(`ogni sottodimostrazione deve terminare con ${print(ctx.conclusion)}`);
  return ok();
});

rule('¬ Intro', ctx => {
  const bad = shape(ctx, 0, 1, 'cita una sola sottodimostrazione'); if (bad) return bad;
  const s = ctx.subproofs[0];
  if (!s.assumption) return no('la sottodimostrazione non ha assunzione');
  if (!s.conclusion || s.conclusion.t !== 'bot') return no('la sottodimostrazione deve terminare con ⊥');
  return ctx.conclusion.t === 'not' && equals(ctx.conclusion.a, s.assumption)
    ? ok() : no('la conclusione deve essere la negazione dell\u2019assunzione');
});

rule('¬ Elim', ctx => {
  const bad = shape(ctx, 1, 0, 'cita una sola riga'); if (bad) return bad;
  const f = ctx.lines[0].formula;
  return f.t === 'not' && f.a.t === 'not' && equals(f.a.a, ctx.conclusion)
    ? ok() : no(`la riga citata deve avere forma ¬¬${print(ctx.conclusion)}`);
});

rule('→ Intro', ctx => {
  const bad = shape(ctx, 0, 1, 'cita una sola sottodimostrazione'); if (bad) return bad;
  const s = ctx.subproofs[0], c = ctx.conclusion;
  if (c.t !== 'imp') return no('la conclusione deve essere un condizionale');
  if (!s.assumption || !equals(s.assumption, c.l)) return no(`la sottodimostrazione deve assumere ${print(c.l)}`);
  return s.conclusion && equals(s.conclusion, c.r)
    ? ok() : no(`la sottodimostrazione deve terminare con ${print(c.r)}`);
});

rule('→ Elim', ctx => {
  const bad = shape(ctx, 2, 0, 'cita due righe'); if (bad) return bad;
  for (const [i, j] of [[0,1],[1,0]]) {
    const c = ctx.lines[i].formula;
    if (c.t === 'imp' && equals(c.l, ctx.lines[j].formula) && equals(c.r, ctx.conclusion)) return ok();
  }
  return no('servono P → Q e P, con conclusione Q');
});

rule('↔ Intro', ctx => {
  const bad = shape(ctx, 0, 2, 'cita due sottodimostrazioni'); if (bad) return bad;
  const c = ctx.conclusion;
  if (c.t !== 'iff') return no('la conclusione deve essere un bicondizionale');
  const goes = (s, A, B) => s.assumption && s.conclusion && equals(s.assumption, A) && equals(s.conclusion, B);
  const [s1, s2] = ctx.subproofs;
  return (goes(s1,c.l,c.r) && goes(s2,c.r,c.l)) || (goes(s2,c.l,c.r) && goes(s1,c.r,c.l))
    ? ok() : no(`servono le due sottodimostrazioni ${print(c.l)} ⇒ ${print(c.r)} e viceversa`);
});

rule('↔ Elim', ctx => {
  const bad = shape(ctx, 2, 0, 'cita due righe'); if (bad) return bad;
  for (const [i, j] of [[0,1],[1,0]]) {
    const b = ctx.lines[i].formula, other = ctx.lines[j].formula;
    if (b.t !== 'iff') continue;
    if (equals(b.l, other) && equals(b.r, ctx.conclusion)) return ok();
    if (equals(b.r, other) && equals(b.l, ctx.conclusion)) return ok();
  }
  return no('servono P ↔ Q e uno dei due lati');
});

rule('⊥ Intro', ctx => {
  const bad = shape(ctx, 2, 0, 'cita due righe'); if (bad) return bad;
  if (ctx.conclusion.t !== 'bot') return no('la conclusione deve essere ⊥');
  const [A, B] = ctx.lines.map(l => l.formula);
  const contradicts = (x, y) => x.t === 'not' && equals(x.a, y);
  return contradicts(A,B) || contradicts(B,A)
    ? ok() : no('le due righe non sono una la negazione dell\u2019altra');
});

rule('⊥ Elim', ctx => {
  const bad = shape(ctx, 1, 0, 'cita una sola riga'); if (bad) return bad;
  return ctx.lines[0].formula.t === 'bot' ? ok() : no('la riga citata deve essere ⊥');
});

rule('Taut Con', ctx => {
  if (ctx.subproofs.length) return no('cita solo righe');
  const verdict = isTautologicalConsequence(ctx.lines.map(l => l.formula), ctx.conclusion);
  if (verdict === null) return no('troppe lettere proposizionali per la verifica');
  return verdict ? ok() : no('non e\u2019 una conseguenza tautologica delle righe citate');
});

rule('= Intro', ctx => {
  if (ctx.lines.length || ctx.subproofs.length) return no('non si cita nulla');
  const c = ctx.conclusion;
  return c.t === 'eq' && c.l === c.r ? ok() : no('la conclusione deve avere forma t = t');
});

rule('= Elim', ctx => {
  const bad = shape(ctx, 2, 0, 'cita due righe: un\u2019identita\u2019 e una formula'); if (bad) return bad;
  for (const [i, j] of [[0,1],[1,0]]) {
    const identity = ctx.lines[i].formula, P = ctx.lines[j].formula;
    if (identity.t !== 'eq') continue;
    if (equalsUpToSubstitution(P, ctx.conclusion, identity.l, identity.r)) return ok();
    if (equalsUpToSubstitution(P, ctx.conclusion, identity.r, identity.l)) return ok();
  }
  return no('la conclusione non si ottiene sostituendo i termini dell\u2019identita\u2019 citata');
});

rule('∀ Elim', ctx => {
  const bad = shape(ctx, 1, 0, 'cita una sola riga'); if (bad) return bad;
  const u = ctx.lines[0].formula;
  if (u.t !== 'all') return no('la riga citata non e\u2019 una generalizzazione universale');
  const candidates = new Set([...freeTerms(ctx.conclusion), ...freeTerms(u), ...CONSTANTS]);
  for (const t of candidates) if (equals(substitute(u.a, u.v, t), ctx.conclusion)) return ok();
  return no(`la formula non e\u2019 un\u2019istanza di ${print(u)}`);
});

rule('∃ Intro', ctx => {
  const bad = shape(ctx, 1, 0, 'cita una sola riga'); if (bad) return bad;
  const c = ctx.conclusion;
  if (c.t !== 'ex') return no('la conclusione deve essere una generalizzazione esistenziale');
  const witness = ctx.lines[0].formula;
  const candidates = new Set([...freeTerms(witness), ...CONSTANTS]);
  for (const t of candidates) if (equals(substitute(c.a, c.v, t), witness)) return ok();
  return no(`la riga citata non e\u2019 un\u2019istanza di ${print(c)}`);
});

rule('∀ Intro', ctx => {
  const bad = shape(ctx, 0, 1, 'cita una sola sottodimostrazione'); if (bad) return bad;
  const s = ctx.subproofs[0], c = ctx.conclusion;
  if (!s.constant) return no('la sottodimostrazione deve dichiarare una costante nuova nella casella squadrata');
  if (!isConstantName(s.constant)) return no(`"${s.constant}" non puo\u2019 fare da costante: u, v, w, x, y, z sono variabili`);
  if (!s.isFresh) return no(`la costante ${s.constant} compare anche fuori dalla sottodimostrazione: non e\u2019 nuova`);
  if (c.t !== 'all') return no('la conclusione deve essere universale');
  if (freeTerms(c).has(s.constant)) return no(`la costante ${s.constant} non puo\u2019 comparire nella conclusione`);
  if (!s.conclusion) return no('la sottodimostrazione e\u2019 vuota');
  const expected = substitute(c.a, c.v, s.constant);
  return equals(expected, s.conclusion)
    ? ok() : no(`la sottodimostrazione dovrebbe terminare con ${print(expected)}`);
});

rule('∃ Elim', ctx => {
  if (ctx.lines.length !== 1 || ctx.subproofs.length !== 1)
    return no('cita una riga esistenziale e una sottodimostrazione');
  const x = ctx.lines[0].formula, s = ctx.subproofs[0];
  if (x.t !== 'ex') return no(`la riga ${ctx.lines[0].number} non e\u2019 una generalizzazione esistenziale`);
  if (!s.constant) return no('la sottodimostrazione deve dichiarare una costante nuova');
  if (!isConstantName(s.constant)) return no(`"${s.constant}" non puo\u2019 fare da costante: u, v, w, x, y, z sono variabili`);
  if (!s.isFresh) return no(`la costante ${s.constant} compare anche fuori dalla sottodimostrazione: non e\u2019 nuova`);
  if (freeTerms(x).has(s.constant)) return no(`la costante ${s.constant} compare gia\u2019 nella riga citata: non e\u2019 nuova`);
  const expected = substitute(x.a, x.v, s.constant);
  if (!s.assumption || !equals(s.assumption, expected)) return no(`la sottodimostrazione deve assumere ${print(expected)}`);
  return s.conclusion && equals(s.conclusion, ctx.conclusion)
    ? ok() : no(`la sottodimostrazione deve terminare con ${print(ctx.conclusion)}`);
});

export const RULE_NAMES = ['', 'Prem', 'Assunz', ...RULES.keys()];
