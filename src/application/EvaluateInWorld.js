// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Applicazione · Caso d'uso · Valuta enunciati in un mondo
 */
import { tryParse } from '../domain/language/Parser.js';
import { UndefinedReference } from '../domain/world/World.js';

export class EvaluateInWorld {
  execute({ world, sentences }) {
    return sentences.map((text, position) => {
      const parsed = tryParse(text);
      if (!parsed.ok) {
        if (parsed.empty) return { position, value: 'blank' };
        return { position, value: 'malformed', message: parsed.error };
      }
      if (world.isEmpty)
        return { position, value: 'undefined', message: 'il mondo e\u2019 vuoto: il dominio non puo\u2019 essere vuoto' };
      try {
        return { position, value: world.satisfies(parsed.formula) ? 'true' : 'false' };
      } catch (e) {
        if (e instanceof UndefinedReference) return { position, value: 'undefined', message: e.message };
        throw e;
      }
    });
  }
}
