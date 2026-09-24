// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Test di robustezza: input assurdi, storti o enormi.
 * Regola generale: il nucleo può rifiutare, non può esplodere.
 * Un errore previsto (formula non valida, mondo non valido) è un risultato;
 * un'eccezione non prevista è un difetto.
 */
import { tryParse, parse } from '../src/domain/language/Parser.js';
import { print } from '../src/domain/language/Printer.js';
import { equals, substitute } from '../src/domain/language/Formula.js';
import { tableFor, isTautologicalConsequence } from '../src/domain/truth/TruthTable.js';
import { World, Block, Shape, Size, WorldInvariantViolation } from '../src/domain/world/World.js';
import { Proof, Line, Subproof, Justification, resetIds } from '../src/domain/proof/Proof.js';
import { CheckProof } from '../src/application/CheckProof.js';
import { EvaluateInWorld } from '../src/application/EvaluateInWorld.js';
import { BuildTruthTable } from '../src/application/BuildTruthTable.js';
import { SenFileImporter } from '../src/infrastructure/import/SenFileImporter.js';
import { readZipEntries, ZipError } from '../src/infrastructure/import/ZipReader.js';
import { citationTokens, toggleCitation } from '../src/domain/proof/citations.js';
import { freshConstant } from '../src/domain/proof/constants.js';

const never = (name, fn) => { try { fn(); return true; } catch (e) { console.log(`   ${name}: ${e.message}`); return false; } };
const neverAsync = async (name, fn) => { try { await fn(); return true; } catch (e) { console.log(`   ${name}: ${e.message}`); return false; } };

/* generatore deterministico, così un fallimento è sempre riproducibile */
let seed = 20260921;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = list => list[Math.floor(rnd() * list.length)];

export default async function suite(t) {
  /* ---------- parser: non deve mai lanciare fuori da tryParse ---------- */
  const nasty = [
    '', ' ', '\n\t', '(', ')', '()', '(((((', ')))))', '&&&', '~~~~~~~~', '∀', '∀x', '∃x',
    'P(', 'P()', 'P(,)', 'P(a,)', 'P(a b)', '=', 'a=', '=b', 'a==b', '#', '^', '[', ']', '[)',
    'Cube(a) Cube(b)', '∀x∀x∀x P(x)', 'P → → Q', 'P ∧', '∧ P', '1', '123', 'P1(a)', '_', '$',
    'P' + '∧P'.repeat(500), '('.repeat(200) + 'P' + ')'.repeat(200), '∀x '.repeat(300) + 'Cube(x)',
    'P'.repeat(5000), '🙂', 'Ω = Ω', 'null', 'undefined', 'constructor', '__proto__', 'toString',
    'P ∧ 🙂', 'a ≠ ', '∀🙂 Cube(x)', 'Cube(🙂)'
  ];
  let parserSafe = true, parserPrintable = true;
  for (const input of nasty) {
    let result;
    if (!never(`parse "${input.slice(0, 20)}"`, () => { result = tryParse(input); })) { parserSafe = false; continue; }
    if (result.ok && !never('print', () => { if (!equals(parse(print(result.formula)), result.formula)) parserPrintable = false; })) parserPrintable = false;
  }
  t('parser: nessuna eccezione su input storti', parserSafe);
  t('parser: cio\u2019 che accetta lo ristampa uguale', parserPrintable);
  t('parser: input enorme rifiutato senza bloccarsi', tryParse('('.repeat(50000)).ok === false);
  t('parser: i nomi non iniziano con _', tryParse('__proto__').ok === false);
  // un atomo che si chiama come una proprietà di Object non deve valere sempre vero
  const trap = tableFor([parse('constructor'), parse('toString ∧ valueOf')]);
  t('tavole: nomi come "constructor" non ereditano un valore',
    trap.columns[0].includes(true) && trap.columns[0].includes(false) && trap.columns[1].includes(false));
  t('tavole: nessuna colonna sempre vera per sbaglio',
    isTautologicalConsequence([], parse('toString')) === false);

  /* formule casuali: nessun crash, e ciò che si accetta si ristampa uguale */
  const atomPool = ['P', 'Q', 'Cube(a)', 'Larger(a, b)', 'a = b', '⊥'];
  const opPool = ['∧', '∨', '→', '↔'];
  const randomFormula = depth => {
    if (depth <= 0 || rnd() < 0.3) return pick(atomPool);
    const r = rnd();
    if (r < 0.2) return '¬' + randomFormula(depth - 1);
    if (r < 0.35) return `${pick(['∀', '∃'])}${pick(['x', 'y', 'z'])} ${randomFormula(depth - 1)}`;
    return `(${randomFormula(depth - 1)} ${pick(opPool)} ${randomFormula(depth - 1)})`;
  };
  let roundTrips = 0, fuzzSafe = true;
  for (let i = 0; i < 400; i++) {
    const source = randomFormula(6);
    let r;
    if (!never('fuzz', () => { r = tryParse(source); })) { fuzzSafe = false; break; }
    if (r.ok && equals(parse(print(r.formula)), r.formula)) roundTrips++;
  }
  t('parser: 400 formule casuali senza crash', fuzzSafe);
  t('parser: tutte ristampate fedelmente', roundTrips === 400);

  /* ---------- tavole: limiti e prestazioni ---------- */
  const twelve = Array.from({ length: 12 }, (_, i) => `P${i}`).join(' ∧ ');
  const started = Date.now();
  const big = tableFor([parse(twelve)]);
  t('tavole: 12 lettere = 4096 righe', big.rowCount === 4096);
  t('tavole: costruita in meno di un secondo', Date.now() - started < 1000);
  t('tavole: oltre il limite restituisce null', tableFor([parse(twelve + ' ∧ P12')]) === null);
  const tooBig = new BuildTruthTable().execute({ sentences: [twelve + ' ∧ P12'] });
  t('tavole: il caso d\u2019uso lo segnala invece di rompersi', tooBig.status === 'too-large');
  t('conseguenza tautologica: oltre il limite restituisce null', isTautologicalConsequence([parse(twelve + ' ∧ P12')], parse('P0')) === null);
  t('tavole: enunciati vuoti o storti non fanno crollare il caso d\u2019uso',
    never('tavole', () => new BuildTruthTable().execute({ sentences: ['', ' ', 'P ∧', '((', 'P'] })));

  /* ---------- mondi ---------- */
  const evaluate = new EvaluateInWorld();
  const world = new World([
    new Block({ id: 1, shape: Shape.CUBE, size: Size.LARGE, x: 0, y: 0, names: ['a'] }),
    new Block({ id: 2, shape: Shape.TET, size: Size.SMALL, x: 5, y: 5, names: ['b'] })
  ]);
  const values = evaluate.execute({ world, sentences: [
    'Cube(a)', 'Verde(a)', 'Cube(a, b)', 'Cube()', 'Between(a, b)', 'a = z', '∀x ∀y ∀z ∀u Cube(x)',
    '', 'P ∧', 'Cube(nonEsiste)'
  ]});
  t('mondi: ogni enunciato riceve un esito', values.length === 10);
  t('mondi: predicato sconosciuto = indefinito', values[1].value === 'undefined');
  t('mondi: arieta\u2019 sbagliata = indefinito', values[2].value === 'undefined');
  t('mondi: nome non assegnato = indefinito', values[9].value === 'undefined');
  t('mondi: formula storta = non valida', values[8].value === 'malformed');
  t('mondi: mondo vuoto non fa crollare nulla',
    evaluate.execute({ world: new World([]), sentences: ['∀x Cube(x)'] })[0].value === 'undefined');

  let outside = false;
  try { new Block({ id: 1, x: 9, y: 0 }); } catch { outside = true; }
  t('mondi: colonna 9 rifiutata', outside);
  let duplicate = false;
  try {
    new World([new Block({ id: 1, x: 0, y: 0, names: ['a'] }), new Block({ id: 2, x: 4, y: 4, names: ['a'] })]);
  } catch (e) { duplicate = e instanceof WorldInvariantViolation; }
  t('mondi: stessa costante su due blocchi rifiutata', duplicate);

  // tavolo pieno: 64 blocchi piccoli, quantificatori annidati
  const full = new World(Array.from({ length: 64 }, (_, i) =>
    new Block({ id: i + 1, shape: Shape.CUBE, size: Size.SMALL, x: i % 8, y: Math.floor(i / 8) })));
  const heavy = Date.now();
  const deep = evaluate.execute({ world: full, sentences: ['∀x ∀y ∀z (SameRow(x, y) ∨ ¬SameRow(y, z) ∨ Cube(z))'] });
  t('mondi: tavolo pieno, tre quantificatori annidati', deep[0].value === 'true' || deep[0].value === 'false');
  t('mondi: 262.144 combinazioni in meno di tre secondi', Date.now() - heavy < 3000);

  /* ---------- prove ---------- */
  const check = new CheckProof();
  resetIds(1);
  const messy = new Proof({ goal: 'P', items: [
    new Line({ text: 'P', rule: Justification.PREMISE, citations: 'ciao' }),
    new Line({ text: 'P', rule: 'Reit', citations: '999' }),
    new Line({ text: 'P', rule: 'Reit', citations: '1-' }),
    new Line({ text: 'P', rule: 'Reit', citations: '-3' }),
    new Line({ text: 'P', rule: 'Reit', citations: '5' }),
    new Line({ text: 'P', rule: 'Reit', citations: '1,1,1,1' }),
    new Line({ text: 'P', rule: 'Reit', citations: '999999999999-1' }),
    new Line({ text: 'P', rule: '∧ Intro', citations: '' }),
    new Line({ text: 'P', rule: 'regola inventata', citations: '1' }),
    new Line({ text: 'P ∧', rule: 'Reit', citations: '1' })
  ]});
  let outcome;
  t('prove: citazioni assurde non fanno crollare il verificatore',
    never('verifica', () => { outcome = check.execute({ proof: messy }); }));
  t('prove: ogni riga riceve un esito', outcome.lines.length === 10);
  t('prove: nessuna riga assurda passa', outcome.lines.slice(1).every(l => l.status !== 'ok'));
  t('prove: la riga non puo\u2019 citare se stessa', outcome.lines[4].status === 'invalid');

  // annidamento profondo
  resetIds(1);
  let inner = new Subproof({ items: [new Line({ text: 'P', rule: Justification.ASSUMPTION })] });
  for (let i = 0; i < 60; i++) inner = new Subproof({ items: [new Line({ text: 'P', rule: Justification.ASSUMPTION }), inner] });
  t('prove: 60 sottodimostrazioni annidate',
    never('annidamento', () => check.execute({ proof: new Proof({ items: [inner] }) })));

  // prova lunga
  resetIds(1);
  const long = new Proof({ goal: 'P', items: [
    new Line({ text: 'P', rule: Justification.PREMISE }),
    ...Array.from({ length: 400 }, (_, i) => new Line({ text: 'P', rule: 'Reit', citations: String(i + 1) }))
  ]});
  const longStart = Date.now();
  const longOutcome = check.execute({ proof: long });
  t('prove: 401 righe verificate', longOutcome.lines.length === 401);
  t('prove: 401 righe in meno di due secondi', Date.now() - longStart < 2000);
  t('prove: prova lunga tutta corretta', longOutcome.verdict.kind === 'complete');

  // Taut Con con molte lettere: deve rifiutare, non calcolare per sempre
  resetIds(1);
  const explosive = new Proof({ items: [
    new Line({ text: Array.from({ length: 20 }, (_, i) => `P${i}`).join(' ∧ '), rule: Justification.PREMISE }),
    new Line({ text: 'P0', rule: 'Taut Con', citations: '1' })
  ]});
  const tautStart = Date.now();
  const tautOutcome = check.execute({ proof: explosive });
  t('prove: Taut Con enorme rifiutata subito', tautOutcome.lines[1].status === 'invalid' && Date.now() - tautStart < 1000);

  t('riferimenti: testo storto non fa crollare la lettura',
    never('riferimenti', () => { citationTokens('a,,-,1-2-3, ,'); toggleCitation(undefined, '1'); }));
  resetIds(1);
  t('costante nuova: anche con una prova vuota', typeof freshConstant(new Proof({ items: [] })) === 'string');

  /* ---------- importazione ---------- */
  const importer = new SenFileImporter();
  const broken = [
    '', 'ciao', '6.0\rmacs\rSntP\r', '6.0\rmacs\rSntP\rabc\rP\f',
    '6.0\rmacs\rSntP\r99\rP\f', '6.0\rmacs\rSntP\r0\r\f\f\f', '\x00\x01\x02\x03'
  ];
  let importSafe = true;
  for (const content of broken) {
    try { await importer.importFrom(content, 'x.sen'); }
    catch (e) { if (e.name !== 'Error' && e.constructor.name !== 'SenFormatError') importSafe = false; }
  }
  t('import: file .sen rotti gestiti senza crash', importSafe);
  const mismatch = await importer.importFrom('6.0\rmacs\rSntP\r99\rP\f', 'x.sen');
  t('import: conteggio sbagliato non blocca l\u2019importazione', mismatch.sentences.length >= 1);

  let zipSafe = true;
  for (const bytes of [new Uint8Array(0), new Uint8Array(10), new Uint8Array(200).fill(0x50)]) {
    if (!await neverAsync('zip', async () => { try { await readZipEntries(bytes); } catch (e) { if (!(e instanceof ZipError)) throw e; } })) zipSafe = false;
  }
  t('import: zip rotti danno un errore chiaro, non un crash', zipSafe);

  /* ---------- sostituzione e uguaglianza su formule profonde ---------- */
  const deepFormula = parse('∀x '.repeat(200) + 'Cube(x)');
  t('formule profonde: sostituzione senza stack overflow',
    never('subst', () => substitute(deepFormula, 'y', 'a')));
  t('formule profonde: confronto senza stack overflow',
    never('equals', () => equals(deepFormula, deepFormula)));
}
