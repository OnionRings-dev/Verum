// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Esegue tutte le suite, compresa la costruzione del bundle.
 *   node test/tutto.mjs
 * Lo stress test gira su più semi: ogni seme è una sequenza di azioni diversa.
 */
import { execFileSync } from 'node:child_process';

const SEEDS = ['7734', '4242', '99'];
const steps = [
  ['nucleo, esempi, robustezza, architettura', ['test/run.mjs'], {}],
  ['costruzione del bundle', ['build.mjs'], {}],
  ['smoke test del bundle', ['test/smoke.test.mjs'], {}],
  ['percorsi d\u2019uso completi', ['test/scenari.test.mjs'], {}],
  ...SEEDS.map(seed => [`stress (seme ${seed})`, ['test/stress.test.mjs'], { VERUM_SEED: seed }])
];

let failed = 0;
for (const [name, args, env] of steps) {
  process.stdout.write(`\n── ${name}\n`);
  try {
    const out = execFileSync(process.execPath, args, { env: { ...process.env, ...env }, encoding: 'utf8' });
    process.stdout.write(out.trimEnd().split('\n').slice(-2).join('\n') + '\n');
  } catch (error) {
    failed++;
    process.stdout.write((error.stdout || '') + (error.stderr || ''));
  }
}
console.log(failed ? `\n${failed} fasi fallite` : '\nTutte le fasi superate');
process.exit(failed ? 1 : 0);
