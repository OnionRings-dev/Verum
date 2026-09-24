// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Test del nucleo. Nessun browser, nessun mock, nessuna dipendenza esterna:
 * il dominio e i casi d'uso si testano perche' non toccano infrastruttura.
 * Esecuzione:  node test/run.mjs
 */
import { parse, tryParse } from '../src/domain/language/Parser.js';
import { print } from '../src/domain/language/Printer.js';
import { equals, substitute, freeTerms, conjuncts, disjuncts, equalsUpToSubstitution } from '../src/domain/language/Formula.js';
import { isTautologicalConsequence } from '../src/domain/truth/TruthTable.js';
import { World, Block, Shape, Size, WorldInvariantViolation, PLACEMENT } from '../src/domain/world/World.js';
import { Proof, Line, Subproof, Justification, resetIds } from '../src/domain/proof/Proof.js';
import { freshConstant, namesInUse, isConstantName } from '../src/domain/proof/constants.js';
import { citationTokens, toggleCitation } from '../src/domain/proof/citations.js';
import { indentLine, outdentLine, canIndent, canOutdent } from '../src/domain/proof/edit.js';
import { BuildTruthTable } from '../src/application/BuildTruthTable.js';
import { EvaluateInWorld } from '../src/application/EvaluateInWorld.js';
import { CheckProof } from '../src/application/CheckProof.js';

export default function suite(t) {
  /* ---------- linguaggio ---------- */
  t('precedenza ∧ su ∨',        print(parse('P & Q | R')) === 'P ∧ Q ∨ R');
  t('parentesi conservate',     print(parse('(P | Q) & R')) === '(P ∨ Q) ∧ R');
  t('→ associa a destra',       print(parse('P -> Q -> R')) === 'P → Q → R');
  t('→ a sinistra parentesi',   print(parse('(P -> Q) -> R')) === '(P → Q) → R');
  t('∧ a destra parentesi',     print(parse('P & (Q & R)')) === 'P ∧ (Q ∧ R)');
  t('quantificatore ascii',     print(parse('@x (Cube(x) $ Small(x))')) === '∀x (Cube(x) → Small(x))');
  t('esistenziale ascii',       print(parse('/y Tet(y)')) === '∃y Tet(y)');
  t('identita',                 print(parse('a=b')) === 'a = b');
  t('disuguaglianza',           print(parse('a != b')) === '¬a = b');
  t('falso',                    print(parse('^')) === '⊥');
  t('# e\u2019 diverso da',        print(parse('x # y')) === '¬x = y');
  t('parentesi quadre',         print(parse('~[P | Q]')) === '¬(P ∨ Q)');
  t('quadre e tonde miste',     print(parse('@x [(Cube(x) & Small(x)) $ Tet(x)]')) === '∀x (Cube(x) ∧ Small(x) → Tet(x))');
  t('round-trip',               print(parse(print(parse('P & (Q & R)')))) === 'P ∧ (Q ∧ R)');

  t('errore: operatore pendente', tryParse('P &').ok === false);
  t('errore: giustapposizione',   tryParse('P Q').ok === false);
  t('errore: parentesi aperta',   tryParse('(P').ok === false);
  t('errore: variabile invalida', tryParse('@Cube Cube(x)').ok === false);

  /* ---------- alfa-equivalenza ---------- */
  t('alfa: rinomina',           equals(parse('@x Cube(x)'), parse('@y Cube(y)')));
  t('alfa: non confonde libere', !equals(parse('@x Larger(x,a)'), parse('@y Larger(a,y)')));
  t('alfa: annidati',           equals(parse('@x /y Larger(x,y)'), parse('@a /b Larger(a,b)')));
  t('alfa: ordine conta',       !equals(parse('@x /y Larger(x,y)'), parse('@x /y Larger(y,x)')));

  /* ---------- sostituzione ---------- */
  t('sost: semplice',           print(substitute(parse('Cube(x)'), 'x', 'c')) === 'Cube(c)');
  t('sost: variabile legata',   print(substitute(parse('@x Cube(x)'), 'x', 'c')) === '∀x Cube(x)');
  t('sost: solo libere',        print(substitute(parse('Larger(x,a) & /x Small(x)'), 'x', 'b')) === 'Larger(b, a) ∧ ∃x Small(x)');
  t('termini liberi',           [...freeTerms(parse('@x Larger(x,a)'))].join() === 'a');
  t('congiunti',                conjuncts(parse('P&Q&R')).length === 3);
  t('disgiunti',                disjuncts(parse('P|Q')).length === 2);
  t('sost strutturale',         equalsUpToSubstitution(parse('Larger(a,a)'), parse('Larger(a,b)'), 'a', 'b'));

  /* ---------- tavole ---------- */
  t('modus ponens',             isTautologicalConsequence([parse('P->Q'), parse('P')], parse('Q')) === true);
  t('affermazione conseguente', isTautologicalConsequence([parse('P->Q'), parse('Q')], parse('P')) === false);
  t('terzo escluso',            isTautologicalConsequence([], parse('P | ~P')) === true);
  t('sillogismo disgiuntivo',   isTautologicalConsequence([parse('P|Q'), parse('~P')], parse('Q')) === true);
  t('atomo quantificato',       isTautologicalConsequence([], parse('@x Cube(x) | ~@x Cube(x)')) === true);

  const table = new BuildTruthTable().execute({ sentences: ['P → Q', 'Q → R', 'P → R'] });
  t('tavola: 8 righe',          table.rows.length === 8);
  t('tavola: argomento valido', table.analysis.valid === true);
  const bad = new BuildTruthTable().execute({ sentences: ['P → Q', 'Q', 'P'] });
  t('tavola: controesempio',    bad.analysis.valid === false && bad.analysis.counterexample !== null);

  /* ---------- mondo ---------- */
  const world = new World([
    new Block({ id:1, shape:Shape.CUBE,  size:Size.LARGE,  x:1, y:1, names:['a'] }),
    new Block({ id:2, shape:Shape.CUBE,  size:Size.MEDIUM, x:4, y:1, names:['b'] }),
    new Block({ id:3, shape:Shape.TET,   size:Size.SMALL,  x:6, y:3, names:['c'] }),
    new Block({ id:4, shape:Shape.DODEC, size:Size.LARGE,  x:2, y:5, names:['d'] }),
  ]);
  const ev = new EvaluateInWorld();
  const val = s => ev.execute({ world, sentences: [s] })[0].value;
  t('mondo: Larger',            val('Larger(a, b)') === 'true');
  t('mondo: Larger falso',      val('Larger(b, a)') === 'false');
  t('mondo: SameRow',           val('SameRow(a, b)') === 'true');
  t('mondo: LeftOf',            val('LeftOf(a, b)') === 'true');
  t('mondo: BackOf',            val('BackOf(a, d)') === 'true');
  t('mondo: universale vero',   val('∀x (Cube(x) → ¬Tet(x))') === 'true');
  t('mondo: universale falso',  val('∀x Cube(x)') === 'false');
  t('mondo: esistenziale',      val('∃x (Tet(x) ∧ Small(x))') === 'true');
  t('mondo: annidato',          val('∀x ∃y (Larger(y, x) ∨ x = y)') === 'true');
  t('mondo: identita',          val('a = a') === 'true');
  t('mondo: nome non assegnato', val('Cube(f)') === 'undefined');
  t('mondo: predicato ignoto',  val('Verde(a)') === 'undefined');
  t('mondo: aritа errata',      val('Cube(a, b)') === 'undefined');
  t('mondo: Adjoins falso',     val('Adjoins(a, b)') === 'false');

  const wb = new World([
    new Block({ id:1, shape:Shape.CUBE, size:Size.SMALL, x:0, y:0, names:['a'] }),
    new Block({ id:2, shape:Shape.CUBE, size:Size.SMALL, x:2, y:0, names:['b'] }),
    new Block({ id:3, shape:Shape.CUBE, size:Size.SMALL, x:4, y:0, names:['c'] }),
  ]);
  const evb = new EvaluateInWorld();
  t('Between: vero',            evb.execute({ world: wb, sentences: ['Between(b, a, c)'] })[0].value === 'true');
  t('Between: falso',           evb.execute({ world: wb, sentences: ['Between(a, b, c)'] })[0].value === 'false');

  /* ---------- prove ---------- */
  const check = new CheckProof();

  // P ⊢ Q → P
  resetIds(1);
  const p1 = new Proof({
    goal: 'Q → P',
    items: [
      new Line({ text:'P', rule:Justification.PREMISE }),
      new Subproof({ items: [
        new Line({ text:'Q', rule:Justification.ASSUMPTION }),
        new Line({ text:'P', rule:'Reit', citations:'1' })
      ]}),
      new Line({ text:'Q → P', rule:'→ Intro', citations:'2-3' })
    ]
  });
  const r1 = check.execute({ proof: p1 });
  t('prova: completa',          r1.verdict.kind === 'complete');
  t('prova: ogni riga ok',      r1.lines.every(l => l.status === 'ok'));

  // citazione fuori scope
  resetIds(1);
  const p2 = new Proof({
    goal: 'P',
    items: [
      new Line({ text:'P', rule:Justification.PREMISE }),
      new Subproof({ items: [ new Line({ text:'Q', rule:Justification.ASSUMPTION }) ]}),
      new Line({ text:'Q', rule:'Reit', citations:'2' })
    ]
  });
  const r2 = check.execute({ proof: p2 });
  t('prova: scope rispettato',  r2.lines[2].status === 'invalid');

  // ∧ Elim corretta e scorretta
  resetIds(1);
  const p3 = new Proof({ goal:'P', items: [
    new Line({ text:'P ∧ Q', rule:Justification.PREMISE }),
    new Line({ text:'P', rule:'∧ Elim', citations:'1' })
  ]});
  t('prova: ∧ Elim ok',         check.execute({ proof:p3 }).lines[1].status === 'ok');

  resetIds(1);
  const p4 = new Proof({ goal:'R', items: [
    new Line({ text:'P ∧ Q', rule:Justification.PREMISE }),
    new Line({ text:'R', rule:'∧ Elim', citations:'1' })
  ]});
  t('prova: ∧ Elim rifiutata',  check.execute({ proof:p4 }).lines[1].status === 'invalid');

  // ∀ Intro con costante nuova
  resetIds(1);
  const p5 = new Proof({ goal:'∀x (Cube(x) → Cube(x))', items: [
    new Subproof({ constant:'k', items: [
      new Line({ text:'Cube(k)', rule:Justification.ASSUMPTION }),
      new Line({ text:'Cube(k)', rule:'Reit', citations:'1' })
    ]}),
    new Line({ text:'∀x (Cube(x) → Cube(x))', rule:'→ Intro', citations:'1-2' })
  ]});
  t('prova: → Intro non basta', check.execute({ proof:p5 }).lines[2].status === 'invalid');

  // ∀ Elim
  resetIds(1);
  const p6 = new Proof({ goal:'Cube(a)', items: [
    new Line({ text:'∀x Cube(x)', rule:Justification.PREMISE }),
    new Line({ text:'Cube(a)', rule:'∀ Elim', citations:'1' })
  ]});
  t('prova: ∀ Elim ok',         check.execute({ proof:p6 }).lines[1].status === 'ok');

  // ∃ Intro
  resetIds(1);
  const p7 = new Proof({ goal:'∃x Cube(x)', items: [
    new Line({ text:'Cube(a)', rule:Justification.PREMISE }),
    new Line({ text:'∃x Cube(x)', rule:'∃ Intro', citations:'1' })
  ]});
  t('prova: ∃ Intro ok',        check.execute({ proof:p7 }).lines[1].status === 'ok');

  // Taut Con
  resetIds(1);
  const p8 = new Proof({ goal:'Q', items: [
    new Line({ text:'P → Q', rule:Justification.PREMISE }),
    new Line({ text:'P', rule:Justification.PREMISE }),
    new Line({ text:'Q', rule:'Taut Con', citations:'1,2' })
  ]});
  t('prova: Taut Con ok',       check.execute({ proof:p8 }).lines[2].status === 'ok');

  // = Elim
  resetIds(1);
  const p9 = new Proof({ goal:'Cube(b)', items: [
    new Line({ text:'Cube(a)', rule:Justification.PREMISE }),
    new Line({ text:'a = b',   rule:Justification.PREMISE }),
    new Line({ text:'Cube(b)', rule:'= Elim', citations:'1,2' })
  ]});
  t('prova: = Elim ok',         check.execute({ proof:p9 }).lines[2].status === 'ok');

  // prova appena creata: nessun verdetto, non "righe non giustificate"
  resetIds(1);
  t('prova vuota: nessun verdetto', check.execute({ proof: new Proof() }).verdict.kind === 'empty');

  // una riga vuota in coda non rende incompleta una prova finita
  resetIds(1);
  const p10 = new Proof({ goal:'P', items: [
    new Line({ text:'P ∧ Q', rule:Justification.PREMISE }),
    new Line({ text:'P', rule:'∧ Elim', citations:'1' }),
    new Line()
  ]});
  t('riga vuota in coda ignorata', check.execute({ proof: p10 }).verdict.kind === 'complete');

  /* ---------- regola dei blocchi grandi ---------- */
  const B = (id, size, x, y) => new Block({ id, shape: Shape.CUBE, size, x, y });
  const throws = fn => { try { fn(); return false; } catch (e) { return e instanceof WorldInvariantViolation; } };

  t('grande: vicino ortogonale vietato',  throws(() => new World([B(1,Size.LARGE,3,3), B(2,Size.SMALL,4,3)])));
  t('grande: vicino diagonale vietato',   throws(() => new World([B(1,Size.LARGE,3,3), B(2,Size.SMALL,4,4)])));
  t('grande: vale anche se il grande e\u2019 il secondo', throws(() => new World([B(1,Size.SMALL,2,2), B(2,Size.LARGE,3,3)])));
  t('grande: due grandi vicini vietati',  throws(() => new World([B(1,Size.LARGE,0,0), B(2,Size.LARGE,1,1)])));
  t('grande: a distanza 2 consentito',    !throws(() => new World([B(1,Size.LARGE,3,3), B(2,Size.LARGE,5,5)])));
  t('grande in angolo: area 2x2',         throws(() => new World([B(1,Size.LARGE,0,0), B(2,Size.SMALL,1,0)])));
  t('medi vicini consentiti',             !throws(() => new World([B(1,Size.MEDIUM,3,3), B(2,Size.MEDIUM,4,4)])));
  t('stessa casella vietata',             throws(() => new World([B(1,Size.SMALL,3,3), B(2,Size.SMALL,3,3)])));

  const tableTop = [ { id:1, size:Size.LARGE, x:3, y:3 }, { id:2, size:Size.SMALL, x:6, y:6 } ];
  t('posizionamento: casella nell\u2019area del grande', World.placementConflict(tableTop, { x:2, y:4, size:Size.SMALL })?.reason === PLACEMENT.LARGE_NEIGHBOUR);
  t('posizionamento: casella libera',     World.placementConflict(tableTop, { x:5, y:3, size:Size.SMALL }) === null);
  t('posizionamento: crescere a grande lontano dagli altri', World.placementConflict(tableTop, { x:6, y:6, size:Size.LARGE }, 2) === null);
  t('posizionamento: spostare il grande su se stesso', World.placementConflict(tableTop, { x:3, y:3, size:Size.LARGE }, 1) === null);
  t('posizionamento: grande accanto al piccolo', World.placementConflict(tableTop, { x:5, y:5, size:Size.LARGE })?.blocking.id === 2);

  // Large(x) e Adjoins(x, y) non possono mai essere veri insieme in un mondo valido
  const legal = new World([B(1,Size.LARGE,1,1), B(2,Size.SMALL,4,1), B(3,Size.MEDIUM,5,1)]);
  t('Adjoins tra non grandi resta possibile', legal.satisfies(parse('\u2203x \u2203y Adjoins(x, y)')));
  t('nessun grande ha vicini',            legal.satisfies(parse('\u00ac\u2203x \u2203y (Large(x) \u2227 Adjoins(x, y))')));

  /* ---------- premesse e assunzioni solo dove sono lecite ---------- */
  const statusOf = (proof, i) => check.execute({ proof }).lines[i];

  // il caso dello screenshot: "Assunz" su righe del livello principale
  resetIds(1);
  const fake = new Proof({ goal:'Q', items: [
    new Line({ text:'P', rule:Justification.PREMISE }),
    new Line({ text:'Q', rule:Justification.ASSUMPTION }),
  ]});
  t('assunzione fuori da sottodim.: rifiutata', statusOf(fake, 1).status === 'invalid');
  t('assunzione fuori da sottodim.: spiegata',  statusOf(fake, 1).message.includes('Sottodimostrazione'));
  t('assunzione fuori da sottodim.: prova non completa', check.execute({ proof: fake }).verdict.kind !== 'complete');

  resetIds(1);
  const second = new Proof({ items: [
    new Subproof({ items: [
      new Line({ text:'P', rule:Justification.ASSUMPTION }),
      new Line({ text:'Q', rule:Justification.ASSUMPTION })
    ]})
  ]});
  t('seconda assunzione nella stessa sottodim.: rifiutata', statusOf(second, 1).status === 'invalid');
  t('prima assunzione della sottodim.: accettata',          statusOf(second, 0).status === 'ok');

  resetIds(1);
  const late = new Proof({ items: [
    new Line({ text:'P ∧ Q', rule:Justification.PREMISE }),
    new Line({ text:'P', rule:'∧ Elim', citations:'1' }),
    new Line({ text:'R', rule:Justification.PREMISE })
  ]});
  t('premessa dopo una riga derivata: rifiutata', statusOf(late, 2).status === 'invalid');

  resetIds(1);
  const nested = new Proof({ items: [
    new Subproof({ items: [
      new Line({ text:'P', rule:Justification.ASSUMPTION }),
      new Line({ text:'Q', rule:Justification.PREMISE })
    ]})
  ]});
  t('premessa dentro una sottodim.: rifiutata', statusOf(nested, 1).status === 'invalid');

  /* ---------- costanti delle sottodimostrazioni ---------- */
  resetIds(1);
  const withNames = new Proof({ goal:'Cube(c)', items: [
    new Line({ text:'Larger(a, b)', rule:Justification.PREMISE }),
    new Subproof({ constant:'d', items: [ new Line({ rule:Justification.ASSUMPTION }) ] })
  ]});
  t('nomi in uso: righe, obiettivo, costanti', [...namesInUse(withNames)].sort().join() === 'a,b,c,d');
  t('costante nuova: prima libera fra a-f', freshConstant(withNames) === 'e');
  resetIds(1);
  const crowded = new Proof({ items: [ new Line({ text:'Between(a, b, c) ∧ Between(d, e, f)', rule:Justification.PREMISE }) ] });
  t('costante nuova: dopo f si passa a n1', freshConstant(crowded) === 'n1');
  t('x non e\u2019 un nome di costante', !isConstantName('x') && !isConstantName('z2'));
  t('a e n1 sono nomi di costante', isConstantName('a') && isConstantName('n1'));

  // ∀ Intro con costante dichiarata e riga di assunzione lasciata vuota
  resetIds(1);
  const universal = new Proof({ goal:'∀x (Cube(x) ∨ ¬Cube(x))', items: [
    new Subproof({ constant:'c', items: [
      new Line({ rule:Justification.ASSUMPTION }),
      new Line({ text:'Cube(c) ∨ ¬Cube(c)', rule:'Taut Con' })
    ]}),
    new Line({ text:'∀x (Cube(x) ∨ ¬Cube(x))', rule:'∀ Intro', citations:'1-2' })
  ]});
  t('∀ Intro con sola costante: prova completa', check.execute({ proof: universal }).verdict.kind === 'complete');

  resetIds(1);
  const badName = new Proof({ items: [
    new Subproof({ constant:'x', items: [
      new Line({ rule:Justification.ASSUMPTION }),
      new Line({ text:'Cube(x) ∨ ¬Cube(x)', rule:'Taut Con' })
    ]}),
    new Line({ text:'∀y (Cube(y) ∨ ¬Cube(y))', rule:'∀ Intro', citations:'1-2' })
  ]});
  t('costante con nome di variabile: rifiutata', statusOf(badName, 2).status === 'invalid');

  /* ---------- riferimenti ---------- */
  t('riferimenti: lettura',        citationTokens(' 1, 2 - 7 ,8-10').join('|') === '1|2-7|8-10');
  t('riferimenti: aggiunta',       toggleCitation('1', '3') === '1, 3');
  t('riferimenti: in ordine',      toggleCitation('8-10, 1', '2-7') === '1, 2-7, 8-10');
  t('riferimenti: secondo clic toglie', toggleCitation('1, 2-7', '2-7') === '1');
  t('riferimenti: da vuoto',       toggleCitation('', '4') === '4');
  t('riferimenti: toglie l\u2019ultimo', toggleCitation('4', '4') === '');

  /* ---------- rientra e sporgi ---------- */
  const shape = proof => proof.items.map(i => i.kind === 'line'
    ? (i.text || '·')
    : '[' + i.items.map(x => x.kind === 'line' ? (x.text || '·') : '[…]').join(' ') + ']').join(' ');

  resetIds(1);
  const editable = new Proof({ items: [
    new Line({ text:'P', rule:Justification.PREMISE }),
    new Line({ text:'Q' }),
    new Line({ text:'R' })
  ]});
  t('rientra: nasce una sottodimostrazione', indentLine(editable, editable.items[1].id).ok && shape(editable) === 'P [Q] R');
  t('rientra: la riga diventa assunzione', editable.items[1].items[0].rule === Justification.ASSUMPTION);
  t('rientra: la riga sotto entra nel blocco esistente',
    indentLine(editable, editable.items[2].id).ok && shape(editable) === 'P [Q R]');
  t('rientra: la seconda non e\u2019 un\u2019assunzione', editable.items[1].items[1].rule === '');
  t('sporgi: l\u2019ultima esce', outdentLine(editable, editable.items[1].items[1].id).ok && shape(editable) === 'P [Q] R');
  t('sporgi: l\u2019assunzione rimasta sola scioglie il blocco',
    outdentLine(editable, editable.items[1].items[0].id).ok && shape(editable) === 'P Q R');
  t('sporgi: al livello principale non fa nulla', outdentLine(editable, editable.items[2].id).ok === false);

  resetIds(1);
  const premise = new Proof({ items: [ new Line({ text:'P', rule:Justification.PREMISE }) ] });
  t('rientra: una premessa non rientra', indentLine(premise, premise.items[0].id).ok === false);
  t('rientra: e il pulsante lo sa', canIndent(premise, premise.items[0].id) === false);

  resetIds(1);
  const middle = new Proof({ items: [ new Subproof({ items: [
    new Line({ text:'P', rule:Justification.ASSUMPTION }),
    new Line({ text:'Q' }),
    new Line({ text:'R' })
  ]})]});
  const inner = middle.items[0].items;
  t('sporgi: solo l\u2019ultima riga del blocco', outdentLine(middle, inner[1].id).ok === false);
  t('sporgi: il pulsante lo sa', canOutdent(middle, inner[1].id) === false && canOutdent(middle, inner[2].id) === true);

  // la prova resta verificabile dopo la ristrutturazione
  resetIds(1);
  const rebuilt = new Proof({ goal:'Q → P', items: [
    new Line({ text:'P', rule:Justification.PREMISE }),
    new Line({ text:'Q' }),
    new Line({ text:'P', rule:'Reit', citations:'1' }),
    new Line({ text:'Q → P', rule:'→ Intro' })
  ]});
  indentLine(rebuilt, rebuilt.items[1].id);
  indentLine(rebuilt, rebuilt.items[2].id);
  rebuilt.items[2].citations = '2-3';
  t('ristrutturata: la prova torna completa', check.execute({ proof: rebuilt }).verdict.kind === 'complete');

  /* ---------- la costante nuova deve esserlo davvero ---------- */
  resetIds(1);
  const notFresh = new Proof({ goal:'∀x Cube(x)', items: [
    new Line({ text:'Cube(a)', rule:Justification.PREMISE }),
    new Subproof({ constant:'a', items: [
      new Line({ rule:Justification.ASSUMPTION }),
      new Line({ text:'Cube(a)', rule:'Reit', citations:'1' })
    ]}),
    new Line({ text:'∀x Cube(x)', rule:'∀ Intro', citations:'2-3' })
  ]});
  const notFreshOutcome = check.execute({ proof: notFresh });
  t('∀ Intro: costante che compare fuori e\u2019 rifiutata', notFreshOutcome.lines[3].status === 'invalid');
  t('∀ Intro: il motivo e\u2019 spiegato', notFreshOutcome.lines[3].message.includes('fuori dalla sottodimostrazione'));

  resetIds(1);
  const inGoal = new Proof({ goal:'Cube(c)', items: [
    new Subproof({ constant:'c', items: [
      new Line({ rule:Justification.ASSUMPTION }),
      new Line({ text:'Cube(c) ∨ ¬Cube(c)', rule:'Taut Con' })
    ]}),
    new Line({ text:'∀x (Cube(x) ∨ ¬Cube(x))', rule:'∀ Intro', citations:'1-2' })
  ]});
  t('∀ Intro: costante presente nell\u2019obiettivo e\u2019 rifiutata', check.execute({ proof: inGoal }).lines[2].status === 'invalid');

  resetIds(1);
  const freshOk = new Proof({ goal:'∀x (Cube(x) ∨ ¬Cube(x))', items: [
    new Line({ text:'Tet(a)', rule:Justification.PREMISE }),
    new Subproof({ constant:'k', items: [
      new Line({ rule:Justification.ASSUMPTION }),
      new Line({ text:'Cube(k) ∨ ¬Cube(k)', rule:'Taut Con' })
    ]}),
    new Line({ text:'∀x (Cube(x) ∨ ¬Cube(x))', rule:'∀ Intro', citations:'2-3' })
  ]});
  t('∀ Intro: costante davvero nuova accettata', check.execute({ proof: freshOk }).verdict.kind === 'complete');

  resetIds(1);
  const existsReuse = new Proof({ goal:'Small(a)', items: [
    new Line({ text:'∃x Small(x)', rule:Justification.PREMISE }),
    new Line({ text:'Cube(a)', rule:Justification.PREMISE }),
    new Subproof({ constant:'a', items: [
      new Line({ text:'Small(a)', rule:Justification.ASSUMPTION }),
      new Line({ text:'Small(a)', rule:'Reit', citations:'3' })
    ]}),
    new Line({ text:'Small(a)', rule:'∃ Elim', citations:'1,3-4' })
  ]});
  t('∃ Elim: costante riutilizzata e\u2019 rifiutata', check.execute({ proof: existsReuse }).lines[4].status === 'invalid');
}
