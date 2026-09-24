// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Mondo · Block
 * Entita' con identità (id). Forma, dimensione, posizione e nomi assegnati.
 */
export const Shape = Object.freeze({ TET:'Tet', CUBE:'Cube', DODEC:'Dodec' });
export const Size  = Object.freeze({ SMALL:1, MEDIUM:2, LARGE:3 });
export const CONSTANTS = Object.freeze(['a','b','c','d','e','f']);

export class Block {
  constructor({ id, shape = Shape.CUBE, size = Size.MEDIUM, x = 0, y = 0, names = [] }) {
    if (!Object.values(Shape).includes(shape)) throw new Error(`forma non valida: ${shape}`);
    if (!Object.values(Size).includes(size))   throw new Error(`dimensione non valida: ${size}`);
    if (!Number.isInteger(x) || x < 0 || x > 7) throw new Error('colonna fuori dal tavolo');
    if (!Number.isInteger(y) || y < 0 || y > 7) throw new Error('riga fuori dal tavolo');
    this.id = id; this.shape = shape; this.size = size; this.x = x; this.y = y;
    this.names = [...names];
  }
  with(changes) { return new Block({ ...this, ...changes, names: changes.names ?? this.names }); }
}
