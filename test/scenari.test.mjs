// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Percorsi d'uso completi sul bundle distribuito.
 *
 * Non verificano singoli pezzi: ripetono quello che fa davvero una persona,
 * dall'inizio alla fine, usando solo clic e tastiera come farebbe lei.
 * Se passano, la dimostrazione al professore funziona.
 *
 * Esecuzione:  node build.mjs && node test/scenari.test.mjs
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/verum.html', import.meta.url), 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
  beforeParse(window) {
    window.onerror = m => errors.push(String(m));
    window.addEventListener('unhandledrejection', e => errors.push('promessa non gestita: ' + e.reason));
    window.console.error = (...a) => errors.push(a.map(String).join(' '));
    window.console.info = () => {};
    window.scrollTo = () => {};
    window.alert = m => errors.push('alert: ' + m);
    window.structuredClone = globalThis.structuredClone;
  }
});
await new Promise(r => setTimeout(r, 300));
const d = dom.window.document;
const W = dom.window;

let pass = 0, fail = 0;
const t = (name, ok, detail) => {
  ok ? pass++ : (fail++, console.log('  FALLITO:', name, detail ? `\n     ${detail}` : ''));
};
const wait = (ms = 450) => new Promise(r => setTimeout(r, ms));

/* ---- piccole comodita' per "usare" l'interfaccia ---- */
const go = id => {
  W.location.hash = '#' + id;
  d.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + id));
};
const type = (field, value) => {
  field.focus();
  field.value = value;
  field.dispatchEvent(new W.Event('input', { bubbles: true }));
};
const press = (field, key, options = {}) =>
  field.dispatchEvent(new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
const byText = (selector, text) => [...d.querySelectorAll(selector)].find(e => e.textContent.trim() === text);

/* ==================================================================
   1. Tavole: uno studente verifica un argomento del libro
   ================================================================== */
go('tt');
d.querySelector('#tt-clear').click();
t('tavole: si parte da una schermata che spiega cosa fare', !!d.querySelector('#tt-out .blank'));

type(d.querySelector('#tt-rows .finput'), 'P → Q');
press(d.querySelector('#tt-rows .finput'), 'Enter');
type([...d.querySelectorAll('#tt-rows .finput')].pop(), 'P');
press([...d.querySelectorAll('#tt-rows .finput')].pop(), 'Enter');
type([...d.querySelectorAll('#tt-rows .finput')].pop(), 'Q');
await wait();

t('tavole: la tavola compare senza premere nulla', d.querySelectorAll('#tt-out table.tt tbody tr').length === 4);
t('tavole: tre colonne di enunciati', d.querySelectorAll('#tt-out thead th').length === 5);
t('tavole: modus ponens risulta valido', d.querySelector('#tt-out .sum').textContent.includes('valido'));

// ora lo studente sbaglia l'argomento: afferma il conseguente
type([...d.querySelectorAll('#tt-rows .finput')][1], 'Q');
type([...d.querySelectorAll('#tt-rows .finput')][2], 'P');
await wait();
t('tavole: affermare il conseguente risulta invalido',
  d.querySelector('#tt-out .sum').textContent.includes('non valido'));
t('tavole: viene mostrato il controesempio',
  /controesempio alla riga \d+/.test(d.querySelector('#tt-out .sum').textContent));

// e scrive una formula storta
type([...d.querySelectorAll('#tt-rows .finput')][2], 'P ∧');
await wait();
t('tavole: la formula storta viene segnalata', d.querySelectorAll('#tt-rows .finput.bad').length === 1);
t('tavole: con un messaggio leggibile', !!d.querySelector('#tt-out .err'));
type([...d.querySelectorAll('#tt-rows .finput')][2], 'P');
await wait();
t('tavole: correggendo, la tavola torna', !!d.querySelector('#tt-out table.tt'));

/* ==================================================================
   2. Mondi: costruire un mondo e vedere i verdetti cambiare
   ================================================================== */
go('wd');
d.querySelector('#wd-clearworld').click();
d.querySelector('#wd-clearsent').click();
await wait(100);

const cell = (x, y) => d.querySelectorAll('#wd-board .cell')[y * 8 + x];
const setShape = name => byText('#wd-insp .seg', name).click();
const setSize = name => byText('#wd-insp .seg', name).click();
const setName = letter => byText('#wd-insp .nametag', letter).click();

cell(1, 6).click(); setShape('Cubo'); setSize('Grande'); setName('a');
t('mondi: primo blocco piazzato e battezzato', d.querySelectorAll('#wd-board .blk').length === 1);
t('mondi: il nome compare sul tavolo', d.querySelector('#wd-board .lbl')?.textContent === 'a');

cell(5, 6).click(); setShape('Tetraedro'); setSize('Piccolo'); setName('b');
t('mondi: secondo blocco piazzato', d.querySelectorAll('#wd-board .blk').length === 2);

// il tastierino scrive l'enunciato al posto nostro
const keypad = label => [...d.querySelectorAll('#wd-keypad button')].find(b => b.textContent === label);
const sentenceField = () => d.querySelector('#wd-rows .finput');
sentenceField().focus();
byText('#wd-keypad .kp-tab', 'Dimensione').click();
keypad('Larger').click(); keypad('a').click(); keypad(',').click(); keypad('b').click();
await wait();
t('mondi: il tastierino compone l\u2019enunciato', sentenceField().value === 'Larger(a, b)');
t('mondi: verdetto immediato, senza premere nulla', d.querySelector('#wd-v0 .chip')?.textContent === 'vero');

// si rimpicciolisce a: il verdetto deve ribaltarsi da solo
byText('#wd-board .blk', '') ;
cell(1, 6).querySelector('.blk').click();
setSize('Piccolo');
byText('#wd-insp .seg', 'Piccolo');
await wait();
t('mondi: rimpicciolendo a, l\u2019enunciato diventa falso',
  d.querySelector('#wd-v0 .chip')?.textContent === 'falso');

// un enunciato quantificato
d.querySelector('#wd-add').click();
type([...d.querySelectorAll('#wd-rows .finput')].pop(), '∃x Tet(x)');
await wait();
t('mondi: l\u2019esistenziale e\u2019 vero', d.querySelector('#wd-v1 .chip')?.textContent === 'vero');

// nome non assegnato: indefinito, con spiegazione
d.querySelector('#wd-add').click();
type([...d.querySelectorAll('#wd-rows .finput')].pop(), 'Cube(f)');
await wait();
t('mondi: nome non assegnato da\u2019 indefinito', d.querySelector('#wd-v2 .chip')?.textContent === 'indefinito');
t('mondi: con la spiegazione sotto', d.querySelector('#wd-e2')?.textContent.includes('non è assegnata'));

// la regola del blocco grande, vissuta dall'interfaccia
cell(1, 6).querySelector('.blk').click();
setSize('Grande');
await wait(100);
t('mondi: le caselle intorno al grande sono segnate', cell(0, 5).classList.contains('blocked'));
const before = d.querySelectorAll('#wd-board .blk').length;
cell(0, 5).click();
t('mondi: non si puo\u2019 piazzare nell\u2019area del grande', d.querySelectorAll('#wd-board .blk').length === before);
t('mondi: e viene spiegato perche\u2019', d.querySelector('#wd-insp .notice')?.textContent.includes('grande'));

/* ==================================================================
   3. Derivazioni: costruire una prova intera cliccando
      P → Q, P ⊢ Q  con modus ponens, poi una con sottodimostrazione
   ================================================================== */
go('pf');
d.querySelector('#pf-reset').click();
type(d.querySelector('#pf-goal'), 'Q');

const pf = () => [...d.querySelectorAll('#pf-proof .pf')];
const rifs = () => [...d.querySelectorAll('#pf-proof .prefs')];
const rules = () => [...d.querySelectorAll('#pf-proof .prule')];
const setRule = (index, name) => {
  rules()[index].click();
  byText('#pf-proof .rule-opt', name).click();
};
const numberOf = n => [...d.querySelectorAll('#pf-proof .pnum')].find(b => b.textContent === String(n));

type(pf()[0], 'P → Q');
d.querySelector('#pf-addprem').click();
type(pf()[1], 'P');
setRule(1, 'Prem');
d.querySelector('#pf-addline').click();
type(pf()[2], 'Q');
setRule(2, '→ Elim');
// i riferimenti si compongono cliccando le righe
rifs()[2].focus();
numberOf(1).click();
numberOf(2).click();
t('derivazioni: riferimenti composti con un clic', rifs()[2].value === '1, 2');
d.querySelector('#pf-check').click();
t('derivazioni: modus ponens verificato',
  d.querySelector('#pf-verdict').textContent.includes('completa'),
  d.querySelector('#pf-proof .pmsg')?.textContent);

// prova con sottodimostrazione:  P ⊢ Q → P
d.querySelector('#pf-reset').click();
type(d.querySelector('#pf-goal'), 'Q → P');
type(pf()[0], 'P');
type(pf()[1], 'Q');
press(pf()[1], 'Tab');                       // la riga 2 rientra e diventa assunzione
t('derivazioni: Tab apre la sottodimostrazione', !!d.querySelector('#pf-proof .sub'));
t('derivazioni: la riga rientrata e\u2019 un\u2019assunzione', rules()[1].textContent === 'Assunz');

byText('#pf-proof .btn', '+ riga').click();  // riga dentro il blocco
type(pf()[2], 'P');
setRule(2, 'Reit');
rifs()[2].focus();
numberOf(1).click();
d.querySelector('#pf-addline').click();      // riga al livello principale
type(pf()[3], 'Q → P');
setRule(3, '→ Intro');
rifs()[3].focus();
d.querySelector('#pf-proof .subhandle').click();
t('derivazioni: sottodimostrazione citata con un clic', rifs()[3].value === '2-3');
d.querySelector('#pf-check').click();
t('derivazioni: la prova con sottodimostrazione e\u2019 completa',
  d.querySelector('#pf-verdict').textContent.includes('completa'),
  [...d.querySelectorAll('#pf-proof .pmsg')].map(p => p.textContent).join(' | '));

// uno sbaglio tipico: citare una riga dentro un blocco chiuso
d.querySelector('#pf-addline').click();
type(pf()[4], 'P');
setRule(4, 'Reit');
type(rifs()[4], '3');
d.querySelector('#pf-check').click();
t('derivazioni: citare dentro un blocco chiuso viene rifiutato',
  [...d.querySelectorAll('#pf-proof .pmsg')].some(p => p.textContent.includes('accessibile')));
t('derivazioni: la riga sbagliata e\u2019 marcata', !!d.querySelector('#pf-proof .bad'));

/* ==================================================================
   4. Temi, raccolte e persistenza fra una sessione e l'altra
   ================================================================== */
byText('.bar [data-themes] button', 'Dark')?.click();
t('temi: il tema si applica', d.documentElement.dataset.look === 'dark');

const senText = ['6.0', 'test:Verum', 'SntP', '2',
  '@x Cube(x)\n; commento di prova\fa # b\f', 's=1;'].join('\r');
go('wd');
d.querySelector('#wd-library').click();
const libInput = d.querySelector('#wd-libpop input[type=file]');
const file = new W.File([senText], 'Prova.sen', { type: '' });
if (!file.arrayBuffer) file.arrayBuffer = async () => new TextEncoder().encode(senText).buffer;
Object.defineProperty(libInput, 'files', { value: [file], configurable: true });
libInput.dispatchEvent(new W.Event('change'));
await wait(150);
d.querySelector('#wd-libpop .libitem').click();
await wait();
t('raccolte: gli enunciati vengono caricati',
  [...d.querySelectorAll('#wd-rows .finput')].map(i => i.value).join('|') === '∀x Cube(x)|¬a = b');
t('raccolte: il commento del libro e\u2019 visibile',
  d.querySelector('#wd-rows .snote')?.textContent.includes('commento'));

// seconda sessione: stesso browser, pagina ricaricata da capo
const storage = {};
for (let i = 0; i < W.localStorage.length; i++) {
  const key = W.localStorage.key(i);
  storage[key] = W.localStorage.getItem(key);
}
const second = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
  beforeParse(window) {
    window.onerror = m => errors.push('seconda sessione: ' + m);
    window.console.error = (...a) => errors.push('seconda sessione: ' + a.map(String).join(' '));
    window.console.info = () => {};
    window.scrollTo = () => {};
    window.structuredClone = globalThis.structuredClone;
    Object.entries(storage).forEach(([k, v]) => window.localStorage.setItem(k, v));
  }
});
await wait(400);
const d2 = second.window.document;
t('persistenza: il tema viene ricordato', d2.documentElement.dataset.look === 'dark');
t('persistenza: il mondo viene ricordato', d2.querySelectorAll('#wd-board .blk').length > 0);
t('persistenza: gli enunciati vengono ricordati',
  [...d2.querySelectorAll('#wd-rows .finput')].some(i => i.value.includes('Cube')));
t('persistenza: la raccolta resta nel menu',
  JSON.parse(second.window.localStorage.getItem('verum:sentence-library') || '[]').length === 1);
second.window.close();

/* ---------- esito ---------- */
if (errors.length) {
  console.log('\nErrori raccolti:');
  [...new Set(errors)].slice(0, 10).forEach(e => console.log('  -', e));
}
t('nessun errore durante i percorsi', errors.length === 0);
console.log(`\nscenari: ${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
