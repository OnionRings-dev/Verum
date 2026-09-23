// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Applicazione · Caso d'uso · Verifica una derivazione
 */
import { ProofChecker } from '../domain/proof/ProofChecker.js';

export class CheckProof {
  constructor(checker = new ProofChecker()) { this.checker = checker; }

  execute({ proof }) {
    const { results, index, verdict } = this.checker.check(proof);
    return {
      verdict,
      lines: index.lines.map(({ number, line }) => ({
        number, id: line.id, ...(results.get(line.id) ?? { status: 'empty' })
      }))
    };
  }
}
