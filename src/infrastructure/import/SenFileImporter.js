// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Import · adattatore della porta ExerciseImporter per i
 * file di enunciati (.sen) dei programmi del corso.
 *
 * Formato, ricavato dai file stessi: intestazione su righe separate da CR
 * (versione, piattaforma, "SntP", numero di enunciati), poi gli enunciati
 * separati da form feed. Il testo dopo ';' e' un commento. In coda c'e' una
 * somma di controllo "s=NNNN;". La notazione ASCII (~ & | $ % @ / # ^ [ ])
 * e' quella che il parser di Verum accetta gia'.
 *
 * Gli enunciati vuoti restano: servono a mantenere la numerazione usata dal
 * libro negli esercizi. Gli enunciati mal formati restano come testo: alcuni
 * esercizi chiedono proprio di riconoscerli.
 */
import { ExerciseImporter } from '../../application/ports.js';
import { tryParse } from '../../domain/language/Parser.js';
import { print } from '../../domain/language/Printer.js';

const HEADER = /^[^\r\n]*[\r\n]+[^\r\n]*[\r\n]+SntP[\r\n]+(\d+)[\r\n]/;
const CHECKSUM = /[\r\n]*s=\d+;\s*$/;

export const basename = path => path.split(/[\\/]/).pop();
const isJunk = path => /(^|[\\/])__MACOSX[\\/]/.test(path) || basename(path).startsWith('._');

export class SenFormatError extends Error {}

export class SenFileImporter extends ExerciseImporter {
  supports(filename) { return /\.sen$/i.test(filename) && !isJunk(filename); }

  /** @param {Uint8Array|string} content */
  async importFrom(content, filename = 'enunciati.sen') {
    const text = typeof content === 'string' ? content : new TextDecoder('windows-1252').decode(content);
    const header = text.match(HEADER);
    if (!header) throw new SenFormatError(`${basename(filename)}: non e\u2019 un file di enunciati riconosciuto`);

    const declared = Number(header[1]);
    const items = text.slice(header[0].length).replace(CHECKSUM, '').split('\f');
    while (items.length > declared && !items[items.length - 1].trim()) items.pop();

    return {
      title: basename(filename).replace(/\.sen$/i, ''),
      sentences: items.map(item => this.sentence(item))
    };
  }

  sentence(item) {
    const code = [], notes = [];
    for (const line of item.split(/\r\n|\r|\n/)) {
      const cut = line.indexOf(';');
      code.push(cut < 0 ? line : line.slice(0, cut));
      if (cut >= 0) notes.push(line.slice(cut + 1).trim());
    }
    const raw = code.join(' ').replace(/\s+/g, ' ').trim();
    const parsed = tryParse(raw);
    return {
      text: parsed.ok ? print(parsed.formula) : raw,
      note: notes.filter(Boolean).join(' ')
    };
  }
}
