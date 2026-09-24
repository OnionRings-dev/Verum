// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Prova · riferimenti di una riga
 *
 * Un riferimento è un numero di riga ("4") o un intervallo che indica una
 * sottodimostrazione ("2-7"). Qui vivono la lettura e la modifica dell'elenco,
 * così che scriverlo a mano e comporlo a colpi di clic diano lo stesso
 * risultato.
 */
export const citationTokens = citations =>
  (citations || '').split(',').map(t => t.trim().replace(/\s*[-–]\s*/, '-')).filter(Boolean);

export const formatCitations = tokens => tokens.join(', ');

/** Se il riferimento c'è lo toglie, altrimenti lo aggiunge in ordine. */
export function toggleCitation(citations, token) {
  const tokens = citationTokens(citations);
  const at = tokens.indexOf(token);
  if (at >= 0) tokens.splice(at, 1);
  else tokens.push(token);
  return formatCitations(tokens.sort(byPosition));
}

const first = token => Number(token.split('-')[0]);
const byPosition = (a, b) => first(a) - first(b) || a.localeCompare(b);
