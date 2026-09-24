// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Applicazione · Porte
 *
 * Interfacce possedute dall'applicazione, non dall'infrastruttura. Il dominio
 * e i casi d'uso dipendono da queste firme; chi le implementa (localStorage,
 * un backend HTTP, un file .wld) sta fuori e viene iniettato dal composition
 * root. Cambiare adattatore non tocca nulla di ciò che sta dentro.
 *
 * In JavaScript non esistono interfacce: queste classi documentano il
 * contratto e falliscono rumorosamente se un metodo non viene implementato.
 */
const missing = name => { throw new Error(`porta non implementata: ${name}`); };

/** Persistenza dello stato di lavoro dell'utente (mondi, enunciati, prove). */
export class WorkspaceRepository {
  async load(key)        { missing('WorkspaceRepository.load'); }
  async save(key, value) { missing('WorkspaceRepository.save'); }
  async remove(key)      { missing('WorkspaceRepository.remove'); }
}

/** Sorgente del tempo: mai `new Date()` dentro dominio o casi d'uso. */
export class Clock {
  now() { missing('Clock.now'); }
}

/** Importazione di esercizi da un formato esterno. */
export class ExerciseImporter {
  supports(filename) { missing('ExerciseImporter.supports'); }
  async importFrom(content) { missing('ExerciseImporter.importFrom'); }
}
