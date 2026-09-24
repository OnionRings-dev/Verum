// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Smoke test del bundle distribuito (dist/verum.html) in un DOM simulato.
 *
 * Non verifica l'aspetto grafico: verifica che il file che consegni si avvii
 * senza errori e che le tre schermate, i temi e il footer siano collegati.
 * Esecuzione:  node build.mjs && node test/smoke.test.mjs
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/verum.html', import.meta.url), 'utf8');
const runtimeErrors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
  beforeParse(window) {
    window.onerror = message => runtimeErrors.push(String(message));
    window.console.error = (...args) => runtimeErrors.push(args.map(String).join(' '));
    window.console.info = () => {};
    window.scrollTo = () => {};
    window.structuredClone = globalThis.structuredClone;
  }
});
await new Promise(resolve => setTimeout(resolve, 300));
const d = dom.window.document;

let pass = 0, fail = 0;
const t = (name, condition) => { condition ? pass++ : (fail++, console.log('  FALLITO:', name)); };

t('nessun errore all\u2019avvio', runtimeErrors.length === 0);
t('footer in ogni schermata', d.querySelectorAll('.screen .foot').length === 4);
t('footer con il copyright', [...d.querySelectorAll('.foot')].every(f => f.textContent.includes('2026 Liam Michael Boland')));
t('selettore tema in ogni schermata', d.querySelectorAll('[data-themes]').length === 4);

for (const theme of ['neon', 'dark', 'minimal']) {
  d.querySelector(`[data-themes] button[data-look="${theme}"]`).click();
  t(`tema ${theme} applicato`, d.documentElement.dataset.look === theme);
  t(`tema ${theme} sincronizzato su tutti i selettori`,
    d.querySelectorAll(`button[data-look="${theme}"][aria-pressed="true"]`).length === 4);
}
t('tema ricordato', dom.window.localStorage.getItem('verum:theme') === '"minimal"');

// all'ingresso ogni strumento è vuoto
t('tavole: nessun enunciato precaricato', [...d.querySelectorAll('#tt-rows .finput')].every(i => i.value === ''));
t('tavole: nessuna tavola finche\u2019 non si scrive', !d.querySelector('#tt-out table.tt'));
t('tavole: stato vuoto spiegato', !!d.querySelector('#tt-out .blank'));
t('mondi: tavolo vuoto', d.querySelectorAll('#wd-board .blk').length === 0);
t('mondi: nessun enunciato precaricato', [...d.querySelectorAll('#wd-rows .finput')].every(i => i.value === ''));
t('derivazioni: nessun obiettivo', d.querySelector('#pf-goal').value === '');
t('derivazioni: righe vuote', [...d.querySelectorAll('#pf-proof .pf')].every(i => i.value === ''));
t('derivazioni: nessun verdetto su prova vuota', d.querySelector('#pf-verdict').textContent === '');
t('pannello regole: invito a caricare il PDF', !!d.querySelector('#pf-rules .pdfdrop'));
t('pannello regole: vecchia tabella rimossa', !d.body.textContent.includes('Regole disponibili'));

t('tavolo 8x8', d.querySelectorAll('#wd-board .cell').length === 64);
t('scacchiera alternata', d.querySelectorAll('#wd-board .cell.dark').length === 32);
t('gradienti condivisi presenti', !!d.getElementById('vg-top'));

d.querySelector('#wd-example').click();
t('pezzi disegnati', d.querySelectorAll('#wd-board .blk svg').length > 0);
t('valutazione nel mondo', d.querySelectorAll('#wd-rows .chip').length === 5);
// regola dei blocchi grandi, sull'esempio: a è grande in colonna 2, riga 7
const cellAt = (x, y) => d.querySelectorAll('#wd-board .cell')[y * 8 + x];
const blocksNow = () => d.querySelectorAll('#wd-board .blk').length;
t('area del grande tratteggiata', cellAt(2, 2).classList.contains('blocked') && cellAt(0, 0).classList.contains('blocked'));
t('fuori dall\u2019area non tratteggiata', !cellAt(3, 1).classList.contains('blocked'));
const before = blocksNow();
cellAt(2, 2).click();
t('clic nell\u2019area del grande: nessun blocco aggiunto', blocksNow() === before);
t('clic nell\u2019area del grande: spiegazione mostrata', d.querySelector('#wd-insp .notice')?.textContent.includes('grande'));
cellAt(3, 1).click();
t('clic su casella libera: blocco aggiunto', blocksNow() === before + 1);
// il blocco f (piccolo, colonna 6 riga 2) ha e in diagonale: non può diventare grande
d.querySelectorAll('#wd-board .cell')[6 * 8 + 5].querySelector('.blk').click();
const grande = [...d.querySelectorAll('#wd-insp .seg')].find(b => b.textContent === 'Grande');
t('crescere a grande con un vicino: bottone disattivato', grande?.disabled === true);

d.querySelector('#tt-example').click();
t('tavola di verita\u2019', d.querySelectorAll('#tt-out tbody tr').length === 8);
d.querySelector('#pf-example').click();
t('prova di esempio completa', d.querySelector('#pf-verdict').textContent.includes('completa'));

// caricamento del PDF delle regole
const W = dom.window;
W.URL.createObjectURL = () => 'blob:verum-test';
W.URL.revokeObjectURL = () => {};
const pick = async file => {
  const input = d.querySelector('#pf-rules input[type=file]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new W.Event('change'));
  await new Promise(r => setTimeout(r, 50));
};
await pick(new W.File(['testo'], 'appunti.txt', { type: 'text/plain' }));
t('pannello regole: rifiuta un file non PDF', d.querySelector('#pf-rules .err')?.textContent.includes('non'));
await pick(new W.File(['%PDF-1.4'], 'FitchRules.pdf', { type: 'application/pdf' }));
t('pannello regole: mostra il PDF', d.querySelector('#pf-rules iframe.pdfframe')?.getAttribute('src').startsWith('blob:'));
t('pannello regole: nome del file', d.querySelector('#pf-rules .pdfname')?.textContent === 'FitchRules.pdf');
[...d.querySelectorAll('#pf-rules .pdfbar button')].find(b => b.textContent === 'Rimuovi').click();
await new Promise(r => setTimeout(r, 50));
t('pannello regole: rimozione', !!d.querySelector('#pf-rules .pdfdrop'));

// menu "Carica sentences"
const senText = ['6.0','test:Verum','SntP','2',
  '@x Cube(x)\n; ogni cosa e\u2019 un cubo\fa # b\f', 's=1;'].join('\r');
const libButton = d.querySelector('#wd-library');
libButton.click();
t('sentences: il menu si apre', !!d.querySelector('#wd-libpop .libpop'));
t('sentences: invito a caricare i file', !!d.querySelector('#wd-libpop .libdrop'));
const libInput = d.querySelector('#wd-libpop input[type=file]');
const senFile = new W.File([senText], 'Raccolta di prova.sen', { type: '' });
if (!senFile.arrayBuffer) senFile.arrayBuffer = async () => new TextEncoder().encode(senText).buffer;
Object.defineProperty(libInput, 'files', { value: [senFile], configurable: true });
libInput.dispatchEvent(new W.Event('change'));
await new Promise(r => setTimeout(r, 80));
const libItems = d.querySelectorAll('#wd-libpop .libitem');
t('sentences: raccolta nel menu', libItems.length === 1 && libItems[0].textContent.includes('Raccolta di prova'));
libItems[0].click();
const loaded = [...d.querySelectorAll('#wd-rows .finput')].map(i => i.value);
t('sentences: enunciati caricati', loaded[0] === '\u2200x Cube(x)' && loaded[1] === '\u00aca = b');
t('sentences: nota mostrata', d.querySelector('#wd-rows .snote')?.textContent.includes('cubo'));
t('sentences: titolo della raccolta', d.querySelector('#wd-collection').textContent.includes('Raccolta di prova'));
t('sentences: menu chiuso dopo la scelta', !d.querySelector('#wd-libpop .libpop'));
t('sentences: raccolta ricordata', JSON.parse(W.localStorage.getItem('verum:sentence-library'))?.length === 1);

// tastierino dei blocchi
const tabLabels = [...d.querySelectorAll('#wd-keypad .kp-tab')].map(b => b.textContent);
t('tastierino: tre schede di predicati', tabLabels.join() === 'Forma,Dimensione,Posizione');
t('tastierino: la prima scheda mostra le forme', [...d.querySelectorAll('#wd-keypad .kp-pred')].map(b => b.textContent).join() === 'Tet,Cube,Dodec,SameShape');
const openTab = name => [...d.querySelectorAll('#wd-keypad .kp-tab')].find(b => b.textContent === name).click();
let seen = new Set();
['Forma','Dimensione','Posizione'].forEach(name => { openTab(name); d.querySelectorAll('#wd-keypad .kp-pred').forEach(b => seen.add(b.textContent)); });
t('tastierino: 18 predicati in tutto', seen.size === 18);
t('tastierino: la scheda scelta viene ricordata', JSON.parse(W.localStorage.getItem('verum:keypad-tab')) === 'posizione');
t('tastierino: nomi e variabili', ['a','f','x','w','\u2200','\u22a5'].every(k => [...d.querySelectorAll('#wd-keypad .kp-key')].some(b => b.textContent === k)));
d.querySelector('#wd-add').click();
const fresh = [...d.querySelectorAll('#wd-rows .finput')].pop();
fresh.focus();
const press = label => [...d.querySelectorAll('#wd-keypad button')].find(b => b.textContent === label).click();
openTab('Posizione');
['\u2200', 'x', 'LeftOf', 'x', ',', 'a'].forEach(press);
t('tastierino: scrive nel campo', fresh.value === '\u2200x LeftOf(x, a)');
t('tastierino: il risultato e\u2019 una formula', !!fresh.value && d.querySelectorAll('#wd-rows .finput.bad').length === 0);

// casella della costante nelle sottodimostrazioni
d.querySelector('#pf-reset').click();
d.querySelector('#pf-addsub').click();
let pconst = d.querySelector('#pf-proof .pconst');
t('costante: nessun esempio precompilato', pconst.value === '' && pconst.placeholder === '');
pconst.focus();
t('costante: menu con a-f, nessuna e nuova', (() => {
  const labels = [...d.querySelectorAll('#pf-proof .cpick-menu .cpick-opt')].map(b => b.textContent);
  return ['nessuna','a','b','c','d','e','f','nuova'].every(l => labels.includes(l));
})());
[...d.querySelectorAll('#pf-proof .cpick-opt')].find(b => b.textContent === 'c').click();
t('costante: scelta dal menu', d.querySelector('#pf-proof .pconst').value === 'c');
d.querySelector('#pf-proof .pconst').focus();
[...d.querySelectorAll('#pf-proof .cpick-opt')].find(b => b.textContent === 'nuova').click();
t('costante: "nuova" propone un nome libero', /^[a-f]$|^n\d+$/.test(d.querySelector('#pf-proof .pconst').value));
d.querySelector('#pf-proof .pconst').blur();
[...d.querySelectorAll('#pf-proof .cpick-opt')].find(b => b.textContent === 'nessuna')?.dispatchEvent(new W.MouseEvent('click'));
d.querySelector('#pf-proof .pconst').focus();
[...d.querySelectorAll('#pf-proof .cpick-opt')].find(b => b.textContent === 'nessuna').click();
t('costante: si puo\u2019 lasciare vuota', d.querySelector('#pf-proof .pconst').value === '');

// riferimenti con un clic
d.querySelector('#pf-reset').click();
d.querySelector('#pf-addsub').click();
d.querySelector('#pf-addline').click();
const rifOf = n => d.querySelectorAll('#pf-proof .prefs')[n];
const numOf = n => [...d.querySelectorAll('#pf-proof .pnum')].find(b => b.textContent === String(n));
const rowOf = n => numOf(n).closest('.pline').parentElement;   // il contenitore della riga, non il blocco che la racchiude
rifOf(3).focus();   // ultima riga (4), al livello principale
t('rif: modalita\u2019 citazione attiva', d.querySelector('#pf-proof').classList.contains('citing'));
t('rif: avviso visibile mentre si cita', d.querySelector('#pf-citehint').hidden === false);
t('rif: la riga 1 e\u2019 citabile', rowOf(1).classList.contains('citable'));
t('rif: la riga dentro la sottodim. non e\u2019 citabile da sola', !rowOf(3).classList.contains('citable'));
numOf(1).click();
t('rif: numero inserito', rifOf(3).value === '1');
t('rif: riga citata evidenziata', rowOf(1).classList.contains('cited'));
d.querySelector('#pf-proof .subhandle').click();
t('rif: sottodimostrazione citata', rifOf(3).value === '1, 3-3');
t('rif: blocco evidenziato', !!d.querySelector('#pf-proof .sub.cited'));
numOf(1).click();
t('rif: secondo clic toglie', rifOf(3).value === '3-3');
// passaggio diretto da un campo rif. a un altro: il fuoco deve seguire l'utente
const target = rifOf(0);
rifOf(3).dispatchEvent(new W.FocusEvent('blur', { relatedTarget: target }));
target.focus();
t('rif: il fuoco segue il campo successivo', d.activeElement?.dataset.fk === target.dataset.fk);
t('rif: evidenziazione solo della riga attiva', d.querySelectorAll('#pf-proof .cited').length === 0);
d.activeElement.blur();
t('rif: avviso nascosto fuori dalla citazione', d.querySelector('#pf-citehint').hidden === true);
t('rif: la riga 1 non puo\u2019 citare se stessa', !rowOf(1).classList.contains('citable'));

// rientra e sporgi dall'interfaccia
d.querySelector('#pf-reset').click();
t('derivazioni: stato vuoto spiegato', d.querySelector('#pf-empty').hidden === false);
const lines = () => [...d.querySelectorAll('#pf-proof .pf')];
const structure = () => [...d.querySelectorAll('#pf-proof .pline')].map(l => l.closest('.sub') ? 'dentro' : 'fuori').join(',');
lines()[0].value = 'P'; lines()[0].dispatchEvent(new W.Event('input', { bubbles: true }));
lines()[1].value = 'Q'; lines()[1].dispatchEvent(new W.Event('input', { bubbles: true }));
t('derivazioni: stato vuoto sparisce quando si scrive', (d.querySelector('#pf-check').click(), d.querySelector('#pf-empty').hidden === true));
const second = lines()[1];
second.focus();
second.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
t('derivazioni: Tab crea la sottodimostrazione', structure() === 'fuori,dentro');
t('derivazioni: la riga rientrata diventa assunzione', d.querySelector('#pf-proof .sub .prule').textContent === 'Assunz');
lines()[1].focus();
lines()[1].dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
t('derivazioni: Maiusc+Tab la fa uscire', structure() === 'fuori,fuori');
const indentButton = [...d.querySelectorAll('#pf-proof .pact')].filter(b => b.title.startsWith('Rientra'));
t('derivazioni: la premessa non puo\u2019 rientrare', indentButton[0].disabled === true);
indentButton.find(b => !b.disabled).click();
t('derivazioni: anche il pulsante rientra', structure() === 'fuori,dentro');
const premiseIndent = [...d.querySelectorAll('#pf-proof .pline')]
  .map(l => l.querySelector('.pact'))
  .filter(Boolean);
t('derivazioni: comandi presenti su ogni riga', premiseIndent.length >= 2);

// menu delle regole al posto della tendina
t('derivazioni: niente piu\u2019 menu a tendina', d.querySelectorAll('#pf-proof select').length === 0);
const ruleLabel = d.querySelector('#pf-proof .prule');
ruleLabel.click();
t('regole: il menu si apre', !!d.querySelector('#pf-proof .rule-menu:not([hidden])'));
t('regole: raggruppate', [...d.querySelectorAll('#pf-proof .rule-group')].length >= 2);
const ruleSearch = d.querySelector('#pf-proof .rule-search');
ruleSearch.value = 'elim';
ruleSearch.dispatchEvent(new W.Event('input', { bubbles: true }));
const filtered = [...d.querySelectorAll('#pf-proof .rule-opt')].map(b => b.textContent);
t('regole: la ricerca filtra', filtered.length > 0 && filtered.every(n => n.toLowerCase().includes('elim')));
[...d.querySelectorAll('#pf-proof .rule-opt')].find(b => b.textContent === '\u2227 Elim').click();
t('regole: la scelta si applica', d.querySelector('#pf-proof .prule').textContent === '\u2227 Elim');

// tavola viva
W.location.hash = '#tt';
d.querySelectorAll('.screen').forEach(sec => sec.classList.toggle('on', sec.id === 's-tt'));
d.querySelector('#tt-clear').click();
const ttLive = d.querySelector('#tt-rows .finput');
ttLive.value = 'P \u2228 \u00acP';
ttLive.dispatchEvent(new W.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 500));
t('tavole: la tavola si costruisce da sola', d.querySelectorAll('#tt-out table.tt tbody tr').length === 2);
t('tavole: e riconosce la tautologia', d.querySelector('#tt-out .sum')?.textContent.includes('tautologia'));

// mondo vivo
W.location.hash = '#wd';
d.querySelectorAll('.screen').forEach(sec => sec.classList.toggle('on', sec.id === 's-wd'));
d.querySelector('#wd-example').click();
await new Promise(r => setTimeout(r, 200));
const wdLive = d.querySelector('#wd-rows .finput');
wdLive.value = '\u2203x Dodec(x)';
wdLive.dispatchEvent(new W.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 500));
t('mondi: verdetto senza premere nulla', d.querySelector('#wd-v0 .chip')?.textContent === 'vero');
[...d.querySelectorAll('#wd-board .blk')].forEach(b => { b.click(); const del = [...d.querySelectorAll('#wd-insp .btn')].find(x => x.textContent.includes('Elimina')); del?.click(); });
await new Promise(r => setTimeout(r, 100));
t('mondi: il verdetto segue le modifiche del tavolo', d.querySelector('#wd-v0 .chip')?.textContent === 'indefinito');

// scorciatoie da tastiera
const keyOn = (target, key, options = {}) =>
  target.dispatchEvent(new W.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));

t('scorciatoie: il pannello parte chiuso', d.querySelector('#shortcuts').hidden === true);
keyOn(d.body, '?');
t('scorciatoie: "?" apre l\u2019elenco', d.querySelector('#shortcuts').hidden === false);
t('scorciatoie: l\u2019elenco e\u2019 diviso per schermata', d.querySelectorAll('#shortcuts .sc-group').length === 4);
keyOn(d.body, 'Escape');
t('scorciatoie: Esc lo chiude', d.querySelector('#shortcuts').hidden === true);

// non devono rubare tasti a chi sta scrivendo
W.location.hash = '#wd';
d.querySelectorAll('.screen').forEach(sec => sec.classList.toggle('on', sec.id === 's-wd'));
d.querySelector('#wd-example').click();
await new Promise(r => setTimeout(r, 200));
const typingField = d.querySelector('#wd-rows .finput');
typingField.focus();
typingField.value = 'Cube(a)';
typingField.dispatchEvent(new W.Event('input', { bubbles: true }));
const blocksBefore = d.querySelectorAll('#wd-board .blk').length;
keyOn(typingField, '?');
keyOn(typingField, 'Backspace');
keyOn(typingField, 'd');
t('scorciatoie: dentro un campo non fanno nulla',
  d.querySelector('#shortcuts').hidden === true && d.querySelectorAll('#wd-board .blk').length === blocksBefore);

// con un blocco selezionato, fuori dai campi
const firstBlock = d.querySelector('#wd-board .blk');
firstBlock.click();
const selected = () => d.querySelector('#wd-board .selcell');
t('scorciatoie: blocco selezionato', !!selected());
const positionOf = () => [...d.querySelectorAll('#wd-board .cell')].indexOf(selected());
const start = positionOf();
keyOn(d.body, 'ArrowRight');
t('scorciatoie: la freccia sposta il blocco', positionOf() === start + 1);
keyOn(d.body, 'ArrowLeft');
t('scorciatoie: e torna indietro', positionOf() === start);
keyOn(d.body, 'd');
t('scorciatoie: "d" lo rende dodecaedro',
  [...d.querySelectorAll('#wd-insp .seg')].some(b => b.textContent === 'Dodecaedro' && b.classList.contains('on')));
keyOn(d.body, '1');
t('scorciatoie: "1" lo rende piccolo',
  [...d.querySelectorAll('#wd-insp .seg')].some(b => b.textContent === 'Piccolo' && b.classList.contains('on')));
const beforeDelete = d.querySelectorAll('#wd-board .blk').length;
keyOn(d.body, 'Backspace');
t('scorciatoie: Backspace elimina il blocco', d.querySelectorAll('#wd-board .blk').length === beforeDelete - 1);
keyOn(d.body, 'n');
t('scorciatoie: "n" ne aggiunge uno', d.querySelectorAll('#wd-board .blk').length === beforeDelete);

// navigazione fra strumenti
keyOn(d.body, '3', { altKey: true });
t('scorciatoie: Alt+3 apre Derivazioni', d.querySelector('#s-pf').classList.contains('on'));
keyOn(d.body, '1', { altKey: true });
t('scorciatoie: Alt+1 apre Tavole', d.querySelector('#s-tt').classList.contains('on'));

// dentro le derivazioni
keyOn(d.body, '3', { altKey: true });
d.querySelector('#pf-reset').click();
const pfFields = () => [...d.querySelectorAll('#pf-proof .pf')];
pfFields()[1].focus();
keyOn(pfFields()[1], 'Enter', { ctrlKey: true });
t('scorciatoie: Ctrl+Invio apre una sottodimostrazione', !!d.querySelector('#pf-proof .sub'));
const rowsBefore = d.querySelectorAll('#pf-proof .pline').length;
keyOn(d.querySelector('#pf-proof .sub .pf'), 'Backspace');
t('scorciatoie: Backspace su riga vuota la elimina', d.querySelectorAll('#pf-proof .pline').length === rowsBefore - 1);

if (runtimeErrors.length) console.log(runtimeErrors.join('\n'));
console.log(`\nsmoke test: ${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
