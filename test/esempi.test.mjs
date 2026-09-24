// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Esempi di riferimento.
 *
 * Casi con la risposta nota in anticipo, presi dalla logica classica e dal
 * tipo di esercizi del corso. Sono la rete di sicurezza contro le regressioni
 * silenziose: se un giorno una modifica rende valido un argomento invalido,
 * qui si vede subito, con il nome dell'esempio.
 */
import { parse } from '../src/domain/language/Parser.js';
import { World, Block, Shape, Size } from '../src/domain/world/World.js';
import { Proof, Line, Subproof, Justification, resetIds } from '../src/domain/proof/Proof.js';
import { BuildTruthTable } from '../src/application/BuildTruthTable.js';
import { EvaluateInWorld } from '../src/application/EvaluateInWorld.js';
import { CheckProof } from '../src/application/CheckProof.js';

/* ---------- argomenti proposizionali, con esito noto ---------- */
const ARGUMENTS = [
  { name: 'modus ponens',            sentences: ['P → Q', 'P', 'Q'],                 valid: true },
  { name: 'modus tollens',           sentences: ['P → Q', '¬Q', '¬P'],               valid: true },
  { name: 'sillogismo ipotetico',    sentences: ['P → Q', 'Q → R', 'P → R'],         valid: true },
  { name: 'sillogismo disgiuntivo',  sentences: ['P ∨ Q', '¬P', 'Q'],                valid: true },
  { name: 'dilemma costruttivo',     sentences: ['P ∨ Q', 'P → R', 'Q → R', 'R'],    valid: true },
  { name: 'De Morgan',               sentences: ['¬(P ∧ Q)', '¬P ∨ ¬Q'],             valid: true },
  { name: 'contrapposizione',        sentences: ['P → Q', '¬Q → ¬P'],                valid: true },
  { name: 'affermazione del conseguente', sentences: ['P → Q', 'Q', 'P'],            valid: false },
  { name: 'negazione dell\u2019antecedente', sentences: ['P → Q', '¬P', '¬Q'],       valid: false },
  { name: 'disgiunzione inclusiva',  sentences: ['P ∨ Q', 'P', '¬Q'],                valid: false },
  { name: 'scambio del condizionale', sentences: ['P → Q', 'Q → P'],                 valid: false }
];

const TAUTOLOGIES = [
  'P ∨ ¬P', 'P → P', '(P ∧ Q) → P', 'P → (Q → P)',
  '(P → Q) ∨ (Q → P)', '¬(P ∧ ¬P)', '((P → Q) ∧ (Q → R)) → (P → R)',
  '(P ↔ Q) ↔ ((P ∧ Q) ∨ (¬P ∧ ¬Q))'
];
const CONTRADICTIONS = ['P ∧ ¬P', '⊥', '(P → Q) ∧ P ∧ ¬Q', '(P ↔ ¬P)'];

/* ---------- un mondo fisso, con enunciati dall'esito noto ----------
 *   colonna 0 = sinistra, riga 0 = fondo del tavolo
 *   a: cubo grande   (1,1)      d: dodecaedro grande (2,5)
 *   b: cubo medio    (4,1)      e: tetraedro medio   (4,5)
 *   c: tetraedro piccolo (6,3)  f: cubo piccolo      (6,6)
 */
const WORLD = new World([
  new Block({ id: 1, shape: Shape.CUBE,  size: Size.LARGE,  x: 1, y: 1, names: ['a'] }),
  new Block({ id: 2, shape: Shape.CUBE,  size: Size.MEDIUM, x: 4, y: 1, names: ['b'] }),
  new Block({ id: 3, shape: Shape.TET,   size: Size.SMALL,  x: 6, y: 3, names: ['c'] }),
  new Block({ id: 4, shape: Shape.DODEC, size: Size.LARGE,  x: 2, y: 5, names: ['d'] }),
  new Block({ id: 5, shape: Shape.TET,   size: Size.MEDIUM, x: 4, y: 5, names: ['e'] }),
  new Block({ id: 6, shape: Shape.CUBE,  size: Size.SMALL,  x: 6, y: 6, names: ['f'] })
]);

const SENTENCES = [
  ['Cube(a)', true],                            ['Tet(a)', false],
  ['Large(a) ∧ Small(f)', true],                ['SameShape(a, b)', true],
  ['SameShape(a, d)', false],                   ['SameRow(a, b)', true],
  ['SameCol(c, f)', true],                      ['Larger(a, b)', true],
  ['Smaller(f, e)', true],                      ['LeftOf(a, b)', true],
  ['RightOf(c, e)', true],                      ['BackOf(a, d)', true],
  ['FrontOf(f, c)', true],                      ['Adjoins(a, b)', false],
  ['Between(e, d, c)', false],                  ['a = a', true],
  ['a = b', false],                             ['∀x (Cube(x) → ¬Tet(x))', true],
  ['∀x Cube(x)', false],                        ['∃x Dodec(x)', true],
  ['∃x (Tet(x) ∧ Small(x))', true],             ['∃x (Dodec(x) ∧ Small(x))', false],
  ['∀x ∃y (Larger(y, x) ∨ x = y)', true],       ['∀x ∀y (SameRow(x, y) → SameShape(x, y))', false],
  ['¬∃x ∃y (Large(x) ∧ Adjoins(x, y))', true],  ['∀x (Small(x) → ¬Large(x))', true],
  ['∃x ∃y (SameCol(x, y) ∧ ¬x = y)', true],     ['∀x (Tet(x) → ∃y Larger(y, x))', true]
];

/* ---------- prove complete, da verificare riga per riga ---------- */
const L = (text, rule = '', citations = '') => new Line({ text, rule, citations });
const PREM = text => new Line({ text, rule: Justification.PREMISE });
const ASSUME = text => new Line({ text, rule: Justification.ASSUMPTION });

function proofs() {
  return [
    {
      name: 'P ⊢ Q → P',
      goal: 'Q → P',
      items: [PREM('P'), new Subproof({ items: [ASSUME('Q'), L('P', 'Reit', '1')] }), L('Q → P', '→ Intro', '2-3')],
      complete: true
    },
    {
      name: 'P ∧ Q ⊢ Q ∧ P',
      goal: 'Q ∧ P',
      items: [PREM('P ∧ Q'), L('P', '∧ Elim', '1'), L('Q', '∧ Elim', '1'), L('Q ∧ P', '∧ Intro', '3,2')],
      complete: true
    },
    {
      name: 'modus tollens per ¬ Intro',
      goal: '¬P',
      items: [
        PREM('P → Q'), PREM('¬Q'),
        new Subproof({ items: [ASSUME('P'), L('Q', '→ Elim', '1,3'), L('⊥', '⊥ Intro', '4,2')] }),
        L('¬P', '¬ Intro', '3-5')
      ],
      complete: true
    },
    {
      name: '¬A ∨ (B ∧ C) ⊢ ¬(A ∧ B) ∨ C',
      goal: '¬(A ∧ B) ∨ C',
      items: [
        PREM('¬A ∨ (B ∧ C)'),
        new Subproof({ items: [
          ASSUME('¬A'),
          new Subproof({ items: [ASSUME('A ∧ B'), L('A', '∧ Elim', '3'), L('⊥', '⊥ Intro', '4,2')] }),
          L('¬(A ∧ B)', '¬ Intro', '3-5'),
          L('¬(A ∧ B) ∨ C', '∨ Intro', '6')
        ]}),
        new Subproof({ items: [ASSUME('B ∧ C'), L('C', '∧ Elim', '8'), L('¬(A ∧ B) ∨ C', '∨ Intro', '9')] }),
        L('¬(A ∧ B) ∨ C', '∨ Elim', '1,2-7,8-10')
      ],
      complete: true
    },
    {
      name: '∀x Cube(x) ⊢ Cube(a) ∧ Cube(b)',
      goal: 'Cube(a) ∧ Cube(b)',
      items: [PREM('∀x Cube(x)'), L('Cube(a)', '∀ Elim', '1'), L('Cube(b)', '∀ Elim', '1'),
              L('Cube(a) ∧ Cube(b)', '∧ Intro', '2,3')],
      complete: true
    },
    {
      name: '∀ Intro con costante nuova',
      goal: '∀x (Cube(x) ∨ ¬Cube(x))',
      items: [
        new Subproof({ constant: 'c', items: [ASSUME(''), L('Cube(c) ∨ ¬Cube(c)', 'Taut Con')] }),
        L('∀x (Cube(x) ∨ ¬Cube(x))', '∀ Intro', '1-2')
      ],
      complete: true
    },
    {
      name: '∃ Elim: ∃x Cube(x), ∀x (Cube(x) → Small(x)) ⊢ ∃x Small(x)',
      goal: '∃x Small(x)',
      items: [
        PREM('∃x Cube(x)'), PREM('∀x (Cube(x) → Small(x))'),
        new Subproof({ constant: 'k', items: [
          ASSUME('Cube(k)'), L('Cube(k) → Small(k)', '∀ Elim', '2'),
          L('Small(k)', '→ Elim', '4,3'), L('∃x Small(x)', '∃ Intro', '5')
        ]}),
        L('∃x Small(x)', '∃ Elim', '1,3-6')
      ],
      complete: true
    },
    {
      name: '= Elim: Cube(a), a = b ⊢ Cube(b)',
      goal: 'Cube(b)',
      items: [PREM('Cube(a)'), PREM('a = b'), L('Cube(b)', '= Elim', '1,2')],
      complete: true
    },
    /* --- prove che devono essere rifiutate --- */
    {
      name: 'salto: da P a Q senza giustificazione',
      goal: 'Q', items: [PREM('P'), L('Q', 'Reit', '1')], complete: false
    },
    {
      name: '∀ Intro con costante non nuova',
      goal: '∀x Cube(x)',
      items: [PREM('Cube(a)'), new Subproof({ constant: 'a', items: [ASSUME(''), L('Cube(a)', 'Reit', '1')] }),
              L('∀x Cube(x)', '∀ Intro', '2-3')],
      complete: false
    },
    {
      name: 'citazione dentro una sottodimostrazione chiusa',
      goal: 'Q',
      items: [PREM('P'), new Subproof({ items: [ASSUME('Q')] }), L('Q', 'Reit', '2')],
      complete: false
    },
    {
      name: '∨ Elim con un solo caso trattato',
      goal: 'C',
      items: [PREM('A ∨ B'), new Subproof({ items: [ASSUME('A'), L('C', 'Taut Con', '2')] }),
              L('C', '∨ Elim', '1,2-3')],
      complete: false
    }
  ];
}

export default function suite(t) {
  const tables = new BuildTruthTable();
  const evaluate = new EvaluateInWorld();
  const check = new CheckProof();

  for (const { name, sentences, valid } of ARGUMENTS) {
    const result = tables.execute({ sentences });
    t(`argomento: ${name} ${valid ? 'valido' : 'invalido'}`, result.analysis.valid === valid);
    if (!valid) t(`argomento: ${name} mostra un controesempio`, result.analysis.counterexample !== null);
  }

  for (const formula of TAUTOLOGIES)
    t(`tautologia: ${formula}`, tables.execute({ sentences: [formula] }).analysis.perColumn[0].kind === 'tautology');
  for (const formula of CONTRADICTIONS)
    t(`contraddizione: ${formula}`, tables.execute({ sentences: [formula] }).analysis.perColumn[0].kind === 'contradiction');

  for (const [sentence, expected] of SENTENCES) {
    const [outcome] = evaluate.execute({ world: WORLD, sentences: [sentence] });
    t(`mondo: ${sentence} = ${expected ? 'vero' : 'falso'}`, outcome.value === String(expected));
  }

  for (const example of proofs()) {
    resetIds(1);
    const proof = new Proof({ goal: example.goal, items: example.items });
    const outcome = check.execute({ proof });
    const complete = outcome.verdict.kind === 'complete';
    t(`prova: ${example.name}`, complete === example.complete);
    if (example.complete && !complete) {
      const bad = outcome.lines.find(l => l.status !== 'ok');
      console.log(`   riga ${bad?.number}: ${bad?.message}`);
    }
  }

  // le formule degli esempi devono essere tutte leggibili dal parser
  const everySentence = [...ARGUMENTS.flatMap(a => a.sentences), ...TAUTOLOGIES, ...CONTRADICTIONS,
                         ...SENTENCES.map(s => s[0])];
  let readable = true;
  for (const text of everySentence) { try { parse(text); } catch { readable = false; console.log('   illeggibile:', text); } }
  t(`tutte le ${everySentence.length} formule degli esempi sono leggibili`, readable);
}
