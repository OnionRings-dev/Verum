// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Build: produce un singolo file HTML autonomo (dist/verum.html) inlinando
 * il bundle. Serve solo per la distribuzione; lo sviluppo usa i moduli ES.
 *   node build.mjs
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true, format: 'iife', target: 'es2022',
  write: false, minify: false, legalComments: 'none',
  banner: { js: '/*! Verum \u00a9 2026 Liam Michael Boland. Tutti i diritti riservati. SPDX-License-Identifier: LicenseRef-Verum-Proprietary */' }
});
const js = result.outputFiles[0].text;
const html = await readFile('index.html', 'utf8');
await mkdir('dist', { recursive: true });
await writeFile('dist/verum.html',
  // funzione come sostituto: con una stringa, String.replace interpreterebbe
  // "$$" e "$&" presenti nel bundle come pattern speciali, corrompendo il codice
  html.replace('<script type="module" src="./src/main.js"></script>', () => `<script>\n${js}\n</script>`));
console.log('dist/verum.html scritto:', (js.length / 1024).toFixed(1), 'kB di JS');
