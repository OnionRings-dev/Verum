// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
import domainSuite from './domain.test.mjs';
import architectureSuite from './architecture.test.mjs';
import importSuite from './import.test.mjs';
import robustnessSuite from './robustness.test.mjs';

let pass = 0, fail = 0;
const t = (name, condition) => { condition ? pass++ : (fail++, console.log('  FALLITO:', name)); };

console.log('Dominio e casi d\u2019uso');
domainSuite(t);
console.log('\nImportazione dei file del corso');
await importSuite(t);
console.log('\nRobustezza');
await robustnessSuite(t);
const afterDomain = pass;

console.log('\nConformita\u2019 architetturale');
await architectureSuite(t);

console.log(`\n${afterDomain} test di comportamento, ${pass - afterDomain} test di architettura`);
console.log(`${pass} passati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
