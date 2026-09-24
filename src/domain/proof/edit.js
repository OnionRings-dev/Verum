// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Prova · ristrutturazione
 *
 * Rientrare e sporgere una riga: si scrive la prova come viene e si sistema
 * dopo, invece di dover decidere in anticipo dove aprire una sottodimostrazione.
 *
 * Sono operazioni sulla struttura della prova, quindi stanno nel dominio: le
 * stesse regole valgono per la tastiera, per i pulsanti e per i test.
 */
import { Subproof, Justification } from './Proof.js';

/** Trova la riga e il contenitore che la ospita. */
export function locate(container, lineId, chain = []) {
  for (let i = 0; i < container.items.length; i++) {
    const item = container.items[i];
    if (item.kind === 'line' && item.id === lineId) return { container, index: i, line: item, chain };
    if (item.kind === 'subproof') {
      const found = locate(item, lineId, [...chain, container]);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Rientra una riga di un livello.
 * Se sopra c'è già una sottodimostrazione, la riga ci entra in coda.
 * Altrimenti nasce una nuova sottodimostrazione e la riga ne diventa
 * l'assunzione, che è l'unico ruolo lecito per la prima riga di un blocco.
 * Una premessa non rientra: perderebbe il suo significato.
 */
export function indentLine(proof, lineId) {
  const found = locate(proof, lineId);
  if (!found) return { ok: false, reason: 'riga non trovata' };
  const { container, index, line } = found;
  if (line.rule === Justification.PREMISE)
    return { ok: false, reason: 'una premessa non puo\u2019 entrare in una sottodimostrazione' };

  const previous = container.items[index - 1];
  container.items.splice(index, 1);

  if (previous && previous.kind === 'subproof') {
    previous.items.push(line);
    if (line.rule === Justification.ASSUMPTION) line.rule = '';
    return { ok: true, line };
  }

  const subproof = new Subproof({ items: [line] });
  line.rule = Justification.ASSUMPTION;
  line.citations = '';
  container.items.splice(index, 0, subproof);
  return { ok: true, line };
}

/**
 * Sporge una riga di un livello: esce dalla sottodimostrazione e si piazza
 * subito dopo di essa. Si può fare solo con l'ultima riga del blocco, perché
 * togliere una riga dal mezzo spezzerebbe le righe che la citano. Se il blocco
 * resta vuoto sparisce.
 */
export function outdentLine(proof, lineId) {
  const found = locate(proof, lineId);
  if (!found) return { ok: false, reason: 'riga non trovata' };
  const { container, index, line, chain } = found;
  if (container === proof) return { ok: false, reason: 'la riga e\u2019 gia\u2019 al livello principale' };
  if (index !== container.items.length - 1)
    return { ok: false, reason: 'si puo\u2019 far uscire solo l\u2019ultima riga di una sottodimostrazione' };

  const parent = chain[chain.length - 1];
  const position = parent.items.indexOf(container);
  container.items.splice(index, 1);
  if (line.rule === Justification.ASSUMPTION) line.rule = '';
  parent.items.splice(position + 1, 0, line);
  if (!container.items.length) parent.items.splice(parent.items.indexOf(container), 1);
  return { ok: true, line };
}

/** Le due operazioni sono possibili? Serve all'interfaccia per spegnere i pulsanti. */
export function canIndent(proof, lineId) {
  const found = locate(proof, lineId);
  return Boolean(found) && found.line.rule !== Justification.PREMISE;
}
export function canOutdent(proof, lineId) {
  const found = locate(proof, lineId);
  return Boolean(found) && found.container !== proof && found.index === found.container.items.length - 1;
}
