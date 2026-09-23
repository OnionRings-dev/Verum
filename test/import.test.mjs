// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Test degli adattatori di importazione. I file usati qui sono sintetici,
 * scritti per il test nel formato .sen: nessun materiale del corso.
 */
import { deflateRawSync } from 'node:zlib';
import { readZipEntries, ZipError } from '../src/infrastructure/import/ZipReader.js';
import { SenFileImporter, SenFormatError } from '../src/infrastructure/import/SenFileImporter.js';

const SAMPLE = [
  '6.0', 'test:Verum', 'SntP', '4',
  '@x (Cube(x) $ Large(x))\n; tutti i cubi sono grandi\fa # b & [Small(a) | Tet(b)]      ;Premessa\f\fSmall(Cube(a))\f',
  's=1234;'
].join('\r');

/** Costruisce uno zip minimale: voci compresse (deflate) o memorizzate. */
function makeZip(files) {
  const enc = new TextEncoder(), locals = [], centrals = [];
  let offset = 0;
  for (const { name, text, store = false } of files) {
    const nameBytes = enc.encode(name), data = Buffer.from(text, 'latin1');
    const body = store ? data : deflateRawSync(data);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26); Buffer.from(nameBytes).copy(local, 30);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(store ? 0 : 8, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42); Buffer.from(nameBytes).copy(central, 46);
    locals.push(local, body); centrals.push(central);
    offset += local.length + body.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, end]));
}

export default async function suite(t) {
  const importer = new SenFileImporter();

  t('riconosce .sen',                 importer.supports('cartella/Prova.sen'));
  t('ignora altri formati',           !importer.supports('Prova.wld'));
  t('ignora i file nascosti di macOS', !importer.supports('__MACOSX/cartella/._Prova.sen'));

  const c = await importer.importFrom(new TextEncoder().encode(SAMPLE), 'dir/Raccolta di prova.sen');
  t('titolo dal nome del file',       c.title === 'Raccolta di prova');
  t('numero di enunciati dichiarato', c.sentences.length === 4);
  t('notazione ASCII convertita',     c.sentences[0].text === '∀x (Cube(x) → Large(x))');
  t('commento su riga propria',       c.sentences[0].note === 'tutti i cubi sono grandi');
  t('# come ≠ e quadre come tonde',   c.sentences[1].text === '¬a = b ∧ (Small(a) ∨ Tet(b))');
  t('commento a fine riga',           c.sentences[1].note === 'Premessa');
  t('enunciato vuoto conservato',     c.sentences[2].text === '');
  t('mal formato conservato com\u2019e\u2019', c.sentences[3].text === 'Small(Cube(a))');

  let rejected = false;
  try { await importer.importFrom('non sono un file di enunciati', 'x.sen'); } catch (e) { rejected = e instanceof SenFormatError; }
  t('rifiuta un file non .sen',       rejected);

  const zip = makeZip([
    { name: 'corso/Uno.sen', text: SAMPLE },
    { name: 'corso/Due.sen', text: SAMPLE, store: true },
    { name: 'corso/mondo.wld', text: 'altro' },
    { name: '__MACOSX/corso/._Uno.sen', text: 'spazzatura' }
  ]);
  const entries = await readZipEntries(zip, name => importer.supports(name));
  t('zip: solo i .sen utili',         entries.map(e => e.name).join() === 'corso/Uno.sen,corso/Due.sen');
  const fromZip = await importer.importFrom(entries[0].bytes, entries[0].name);
  t('zip: voce compressa letta',      fromZip.sentences[0].text === '∀x (Cube(x) → Large(x))');
  const stored = await importer.importFrom(entries[1].bytes, entries[1].name);
  t('zip: voce non compressa letta',  stored.title === 'Due' && stored.sentences.length === 4);

  const empty = new Uint8Array([0x50,0x4b,0x05,0x06, ...new Array(18).fill(0)]);
  let emptyError = '';
  try { await readZipEntries(empty); } catch (e) { emptyError = e instanceof ZipError ? e.message : ''; }
  t('zip vuoto: messaggio chiaro',    emptyError.includes('vuoto'));
  let notZip = false;
  try { await readZipEntries(new Uint8Array(40)); } catch (e) { notZip = e instanceof ZipError; }
  t('non uno zip: rifiutato',         notZip);
}
