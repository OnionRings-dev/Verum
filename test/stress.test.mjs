// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Stress test del bundle distribuito.
 *
 * Pesta l'interfaccia a caso: clic su qualunque pulsante, testo storto nei
 * campi, cambi di tema e di schermata, celle del tavolo prese a caso. Serve a
 * rispondere a una domanda sola: durante la dimostrazione, qualunque cosa
 * combini chi guarda, l'applicazione regge?
 *
 * La sequenza e' deterministica: se fallisce, rieseguendolo fallisce uguale.
 * Esecuzione:  node build.mjs && node test/stress.test.mjs
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/verum.html', import.meta.url), 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
  beforeParse(window) {
    window.onerror = message => errors.push(String(message));
    window.addEventListener('unhandledrejection', e => errors.push('promessa non gestita: ' + e.reason));
    window.console.error = (...args) => errors.push(args.map(String).join(' '));
    window.console.info = () => {};
    window.scrollTo = () => {};
    window.alert = () => { errors.push('alert() mostrato all\u2019utente'); };
    window.structuredClone = globalThis.structuredClone;
    window.URL.createObjectURL = () => 'blob:stress';
    window.URL.revokeObjectURL = () => {};
  }
});
await new Promise(r => setTimeout(r, 300));
const d = dom.window.document;
const W = dom.window;

let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : (fail++, console.log('  FALLITO:', name)); };

/* sequenza pseudo-casuale riproducibile */
let seed = Number(process.env.VERUM_SEED ?? 7734);
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = list => list[Math.floor(rnd() * list.length)];

const GIBBERISH = [
  '', '   ', '(', '((((', '∀', '∀x', 'P ∧', '~~~', 'Cube(', 'Cube()', 'a =', '#', '^',
  'P → Q', '∀x (Cube(x) → Small(x))', 'Larger(a, b)', 'P'.repeat(400), '🙂', 'P ∧ Q ∨ R → S ↔ T',
  '∀x ∀y ∀z Between(x, y, z)', 'LeftOf(a, b) ∧ ¬RightOf(a, b)', '1234', 'select * from', '<script>'
];

const screens = ['home', 'tt', 'wd', 'pf'];
const show = id => d.querySelector(`[data-go="${id}"], .back`) && (W.location.hash = '#' + id);

function clickableIn(screen) {
  const root = d.querySelector('#s-' + screen);
  return [...root.querySelectorAll('button')].filter(b => !b.disabled);
}
function fieldsIn(screen) {
  const root = d.querySelector('#s-' + screen);
  return [...root.querySelectorAll('input.finput, input.pf, input.prefs, select.prule')];
}

const safely = (what, action) => {
  try { action(); } catch (e) { errors.push(`${what}: ${e.message}`); }
};

/* ---------- 1. avvio pulito ---------- */
t('avvio senza errori', errors.length === 0);

/* ---------- 2. pestaggio a caso ---------- */
let clicks = 0, edits = 0;
for (let round = 0; round < 600; round++) {
  const screen = pick(screens);
  W.location.hash = '#' + screen;
  d.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + screen));

  const action = rnd();
  if (action < 0.45) {
    const buttons = clickableIn(screen);
    if (buttons.length) { safely('clic', () => pick(buttons).click()); clicks++; }
  } else if (action < 0.8) {
    const fields = fieldsIn(screen);
    if (fields.length) {
      const field = pick(fields);
      safely('scrittura', () => {
        if (field.tagName === 'SELECT') {
          field.value = pick([...field.options]).value;
          field.dispatchEvent(new W.Event('change', { bubbles: true }));
        } else {
          field.focus();
          field.value = pick(GIBBERISH);
          field.dispatchEvent(new W.Event('input', { bubbles: true }));
          field.dispatchEvent(new W.Event('change', { bubbles: true }));
          field.blur();
        }
      });
      edits++;
    }
  } else {
    const cells = [...d.querySelectorAll('#wd-board .cell')];
    if (cells.length) safely('tavolo', () => pick(cells).click());
  }
}
t(`${clicks} clic e ${edits} modifiche a caso senza errori`, errors.length === 0);
if (errors.length) console.log('   primo errore:', errors[0]);

/* ---------- 3. l'applicazione e' ancora viva ---------- */
W.location.hash = '#tt';
d.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-tt'));
safely('svuota tavole', () => d.querySelector('#tt-clear').click());
const ttField = d.querySelector('#tt-rows .finput');
ttField.value = 'P → Q';
ttField.dispatchEvent(new W.Event('input', { bubbles: true }));
safely('costruisci tavola', () => d.querySelector('#tt-build').click());
t('Tavole funziona ancora dopo il pestaggio', d.querySelectorAll('#tt-out table.tt tbody tr').length === 4);

W.location.hash = '#wd';
d.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-wd'));
safely('mondo di esempio', () => d.querySelector('#wd-example').click());
t('Mondi funziona ancora dopo il pestaggio', d.querySelectorAll('#wd-board .blk').length === 6);
t('Mondi da ancora un verdetto', [...d.querySelectorAll('#wd-rows .chip')].some(c => ['vero', 'falso'].includes(c.textContent)));

W.location.hash = '#pf';
d.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-pf'));
safely('nuova prova', () => d.querySelector('#pf-reset').click());
safely('esempio prova', () => d.querySelector('#pf-example').click());
t('Derivazioni verifica ancora la prova di esempio',
  d.querySelector('#pf-verdict')?.textContent.includes('completa'));

/* ---------- 3b. carico: una prova lunga e poi svuotata ---------- */
safely('nuova prova', () => d.querySelector('#pf-reset').click());
const grow = Date.now();
for (let i = 0; i < 120; i++) safely('aggiunta riga', () => d.querySelector('#pf-addline').click());
t('120 righe aggiunte una a una', d.querySelectorAll('#pf-proof .pline').length >= 120);
t('aggiunta di 120 righe sotto i 25 secondi', Date.now() - grow < 25000);
const lastLine = [...d.querySelectorAll('#pf-proof .pf')].pop();
lastLine.focus();
lastLine.value = 'P ∨ ¬P';
lastLine.dispatchEvent(new W.Event('input', { bubbles: true }));
safely('verifica con prova lunga', () => d.querySelector('#pf-check').click());
t('la prova lunga si verifica ancora', d.querySelectorAll('#pf-proof .pstat').length >= 120);
safely('svuota prova', () => d.querySelector('#pf-reset').click());
t('e si svuota', d.querySelectorAll('#pf-proof .pline').length <= 2);

/* ---------- 3c. mondi: riempire e svuotare il tavolo ---------- */
W.location.hash = '#wd';
d.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-wd'));
safely('svuota mondo', () => d.querySelector('#wd-clearworld').click());
[...d.querySelectorAll('#wd-board .cell')].forEach(cell => safely('riempimento', () => cell.click()));
const placed = d.querySelectorAll('#wd-board .blk').length;
t('il tavolo si riempie senza errori', placed > 0 && placed <= 64);
for (let i = 0; i < 40; i++) safely('valutazione ripetuta', () => d.querySelector('#wd-eval').click());
t('40 valutazioni di fila reggono', true);
safely('svuota mondo', () => d.querySelector('#wd-clearworld').click());
t('il tavolo si svuota', d.querySelectorAll('#wd-board .blk').length === 0);

/* ---------- 4. stato salvato illeggibile ---------- */
const corrupt = [
  ['verum:world', '{'],
  ['verum:proof', 'null'],
  ['verum:truth-table', '{"sentences":42}'],
  ['verum:sentence-library', '[{"title":1}]'],
  ['verum:theme', '"inesistente"'],
  ['verum:world', '{"blocks":[{"id":"x","x":99,"y":-3,"size":9,"shape":"Sfera","names":"a"}]}'],
  ['verum:proof', '{"goal":{},"items":[{"kind":"line"},{"kind":"subproof"}]}']
];
let restarts = 0;
for (const [key, value] of corrupt) {
  const second = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(window) {
      window.onerror = m => errors.push(`riavvio con ${key}: ${m}`);
      window.console.error = (...a) => errors.push(`riavvio con ${key}: ` + a.map(String).join(' '));
      window.console.info = () => {};
      window.scrollTo = () => {};
      window.structuredClone = globalThis.structuredClone;
      window.localStorage.setItem('verum:schema', '2');   // niente ripulitura automatica
      window.localStorage.setItem(key, value);
    }
  });
  await new Promise(r => setTimeout(r, 250));
  const doc = second.window.document;
  const alive = doc.querySelectorAll('#wd-board .cell').length === 64
    && doc.querySelectorAll('#pf-proof .pline').length > 0
    && doc.querySelectorAll('#tt-rows .finput').length > 0;
  if (alive) restarts++;
  else console.log(`  FALLITO: avvio con ${key} = ${value}`);
  second.window.close();
}
t('si riavvia anche con lo stato salvato illeggibile', restarts === corrupt.length);

/* ---------- esito ---------- */
if (errors.length) {
  console.log('\nErrori raccolti:');
  [...new Set(errors)].slice(0, 12).forEach(e => console.log('  -', e));
}
t('nessun errore in tutta la sessione', errors.length === 0);
console.log(`\nstress test: ${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
