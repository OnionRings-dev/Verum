// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Test di conformità architetturale.
 *
 * L'architettura a strati è una regola, e una regola che nessuno verifica
 * viene violata al primo commit frettoloso. Questo test fallisce la build
 * se qualcuno importa infrastruttura dentro il dominio.
 *
 *   dominio        -> può importare solo dominio
 *   applicazione   -> può importare dominio e applicazione
 *   infrastruttura -> può importare tutto
 *   main.js        -> composition root, può importare tutto
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;

/** Simboli che il nucleo non deve mai nominare: sono I/O o stato globale. */
const FORBIDDEN_IN_CORE = [
  'document', 'window', 'localStorage', 'sessionStorage', 'fetch',
  'XMLHttpRequest', 'navigator', 'alert', 'new Date(', 'Date.now(', 'Math.random('
];

async function walk(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

const layerOf = path =>
  path.includes('/domain/') ? 'domain'
  : path.includes('/application/') ? 'application'
  : path.includes('/infrastructure/') ? 'infrastructure'
  : 'composition-root';

const ALLOWED = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'application', 'infrastructure'],
  'composition-root': ['domain', 'application', 'infrastructure', 'composition-root']
};

export default async function suite(t) {
  const files = await walk(ROOT);
  t('ci sono file da analizzare', files.length > 0);

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const name = relative(ROOT, file);
    const layer = layerOf(file);

    // 1. direzione delle dipendenze
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const target of imports) {
      if (!target.startsWith('.')) continue;
      const resolved = join(file, '..', target);
      const targetLayer = layerOf(resolved);
      t(`${name}: importa da ${targetLayer}`, ALLOWED[layer].includes(targetLayer));
    }

    // 2. il nucleo non tocca il mondo esterno
    if (layer === 'domain' || layer === 'application') {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const symbol of FORBIDDEN_IN_CORE) {
        t(`${name}: non usa ${symbol.replace('(', '')}`, !code.includes(symbol));
      }
    }
  }
}
