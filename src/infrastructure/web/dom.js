// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/** Infrastruttura · Web · minime utilita' DOM. Nessuno di questi simboli entra nel dominio. */
export const $  = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
export const clear = node => { node.innerHTML = ''; return node; };

/**
 * Inserisce `before` + testo selezionato + `after` nel campo, al cursore.
 * Senza selezione il cursore resta fra i due pezzi (es. dentro le parentesi
 * di un predicato); con una selezione la avvolge e si posiziona dopo.
 */
export function insertAround(field, before, after = '') {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const selected = field.value.slice(start, end);
  field.value = field.value.slice(0, start) + before + selected + after + field.value.slice(end);
  const caret = start + before.length + selected.length + (selected ? after.length : 0);
  field.focus();
  field.selectionStart = field.selectionEnd = caret;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
