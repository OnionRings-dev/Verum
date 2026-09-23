// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Import · lettore zip minimale, senza dipendenze.
 *
 * Legge l'indice centrale dell'archivio ed estrae solo le voci richieste,
 * decomprimendole con DecompressionStream('deflate-raw'), disponibile nei
 * browser moderni e in Node. Basta per gli archivi prodotti da Windows,
 * macOS e dagli strumenti comuni; non gestisce zip cifrati ne' ZIP64.
 */
const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50;

export class ZipError extends Error {}

export async function readZipEntries(buffer, wanted = () => true) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) { end = i; break; }
  }
  if (end < 0) throw new ZipError('il file non e\u2019 un archivio zip valido');

  const count = view.getUint16(end + 10, true);
  if (count === 0) throw new ZipError('l\u2019archivio zip e\u2019 vuoto');
  let p = view.getUint32(end + 16, true);
  const entries = [];

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CENTRAL) throw new ZipError('indice dello zip danneggiato');
    const flags      = view.getUint16(p + 8, true);
    const method     = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extra      = view.getUint16(p + 30, true);
    const comment    = view.getUint16(p + 32, true);
    const offset     = view.getUint32(p + 42, true);
    const name = new TextDecoder(flags & 0x800 ? 'utf-8' : 'windows-1252')
      .decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + extra + comment;

    if (name.endsWith('/') || !wanted(name)) continue;
    if (flags & 0x1) throw new ZipError(`"${name}" e\u2019 cifrato`);
    if (view.getUint32(offset, true) !== LOCAL) throw new ZipError(`voce "${name}" danneggiata`);

    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const raw = bytes.subarray(start, start + compressed);
    if (method === 0) entries.push({ name, bytes: raw.slice() });
    else if (method === 8) entries.push({ name, bytes: await inflateRaw(raw) });
    else throw new ZipError(`"${name}" usa una compressione non supportata`);
  }
  return entries;
}

async function inflateRaw(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
