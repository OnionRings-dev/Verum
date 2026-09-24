// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Mondo · World
 *
 * Il mondo di blocchi e' l'interpretazione: fissa il dominio (i blocchi),
 * il riferimento delle costanti e l'estensione di ogni predicato.
 * Convenzione: colonna 0 = sinistra, riga 0 = fondo del tavolo.
 */
import { Block, CONSTANTS, Size } from './Block.js';

export class UndefinedReference extends Error {}

export const SIGNATURE = Object.freeze({
  Tet:1, Cube:1, Dodec:1, Small:1, Medium:1, Large:1,
  SameSize:2, SameShape:2, SameRow:2, SameCol:2,
  Larger:2, Smaller:2, LeftOf:2, RightOf:2, BackOf:2, FrontOf:2, Adjoins:2,
  Between:3
});

/** Un mondo che viola le regole di costruzione del tavolo. */
export class WorldInvariantViolation extends Error {
  constructor(message, blockIds = []) { super(message); this.name = 'WorldInvariantViolation'; this.blockIds = blockIds; }
}

export const PLACEMENT = Object.freeze({
  SAME_SQUARE: 'due blocchi non possono occupare la stessa casella',
  LARGE_NEIGHBOUR: 'un blocco grande occupa anche le 8 caselle intorno: nessun blocco puo\u2019 stargli accanto, nemmeno in diagonale'
});

export class World {
  constructor(blocks = []) {
    this.blocks = [...blocks];
    const seen = new Set();
    for (const b of this.blocks) for (const n of b.names) {
      if (seen.has(n)) throw new WorldInvariantViolation(`la costante "${n}" è assegnata a più di un blocco`);
      seen.add(n);
    }
    for (let i = 0; i < this.blocks.length; i++)
      for (let j = i + 1; j < this.blocks.length; j++) {
        const reason = World.conflict(this.blocks[i], this.blocks[j]);
        if (reason) throw new WorldInvariantViolation(reason, [this.blocks[i].id, this.blocks[j].id]);
      }
  }

  /**
   * Regola di costruzione del tavolo: ogni blocco occupa la propria casella;
   * un blocco grande occupa anche le otto caselle che lo circondano (un 3x3,
   * ridotto dal bordo del tavolo: 2x2 in un angolo, 2x3 lungo un lato).
   * Due blocchi sono in conflitto se le loro aree si sovrappongono.
   * Restituisce il motivo del conflitto, oppure null.
   */
  static conflict(a, b) {
    if (a.x === b.x && a.y === b.y) return PLACEMENT.SAME_SQUARE;
    const touching = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
    if (touching && (a.size === Size.LARGE || b.size === Size.LARGE)) return PLACEMENT.LARGE_NEIGHBOUR;
    return null;
  }

  /**
   * Verifica se `candidate` ({x, y, size}) puo' stare su un tavolo che contiene
   * `blocks`, ignorando il blocco `ignoreId` (quello che si sta spostando o
   * ridimensionando). Lavora su dati semplici, cosi' l'interfaccia puo'
   * interrogarla prima di modificare qualunque cosa.
   * @returns {{reason:string, blocking:object}|null}
   */
  static placementConflict(blocks, candidate, ignoreId = null) {
    for (const other of blocks) {
      if (other.id === ignoreId) continue;
      const reason = World.conflict(candidate, other);
      if (reason) return { reason, blocking: other };
    }
    return null;
  }
  get isEmpty() { return this.blocks.length === 0; }

  referentOf(name, assignment) {
    if (assignment && Object.prototype.hasOwnProperty.call(assignment, name)) return assignment[name];
    const block = this.blocks.find(b => b.names.includes(name));
    if (!block) throw new UndefinedReference(`la costante "${name}" non è assegnata a nessun blocco`);
    return block;
  }

  holds(predicate, args) {
    const [p, q, r] = args;
    switch (predicate) {
      case 'Tet': case 'Cube': case 'Dodec': return p.shape === predicate;
      case 'Small':  return p.size === 1;
      case 'Medium': return p.size === 2;
      case 'Large':  return p.size === 3;
      case 'SameSize':  return p.size === q.size;
      case 'SameShape': return p.shape === q.shape;
      case 'SameRow':   return p.y === q.y;
      case 'SameCol':   return p.x === q.x;
      case 'Larger':    return p.size > q.size;
      case 'Smaller':   return p.size < q.size;
      case 'LeftOf':    return p.x < q.x;
      case 'RightOf':   return p.x > q.x;
      case 'BackOf':    return p.y < q.y;
      case 'FrontOf':   return p.y > q.y;
      case 'Adjoins':   return p !== q && Math.abs(p.x-q.x) + Math.abs(p.y-q.y) === 1;
      case 'Between':   return this.isBetween(p, q, r);
      default: throw new UndefinedReference(`predicato sconosciuto: ${predicate}`);
    }
  }

  /** a sta fra b e c: collineari su riga, colonna o diagonale, a strettamente interno. */
  isBetween(a, b, c) {
    if (a === b || a === c || b === c) return false;
    const dx = c.x - b.x, dy = c.y - b.y;
    if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
    if ((a.x - b.x) * dy !== (a.y - b.y) * dx) return false;
    const inside = (p, q, r) =>
      (p > Math.min(q,r) && p < Math.max(q,r)) || (q === r && p === q);
    return inside(a.x, b.x, c.x) && inside(a.y, b.y, c.y);
  }

  /** Verita' di una formula in questo mondo, sotto l'assegnazione g. */
  satisfies(f, g = {}) {
    switch (f.t) {
      case 'bot': return false;
      case 'eq':  return this.referentOf(f.l, g) === this.referentOf(f.r, g);
      case 'atom': {
        const arity = SIGNATURE[f.p];
        if (arity === undefined) throw new UndefinedReference(`predicato sconosciuto: ${f.p}`);
        if (f.args.length !== arity)
          throw new UndefinedReference(`${f.p} richiede ${arity} argoment${arity > 1 ? 'i' : 'o'}`);
        return this.holds(f.p, f.args.map(a => this.referentOf(a, g)));
      }
      case 'not': return !this.satisfies(f.a, g);
      case 'and': return this.satisfies(f.l, g) && this.satisfies(f.r, g);
      case 'or':  return this.satisfies(f.l, g) || this.satisfies(f.r, g);
      case 'imp': return !this.satisfies(f.l, g) || this.satisfies(f.r, g);
      case 'iff': return this.satisfies(f.l, g) === this.satisfies(f.r, g);
      case 'all': return this.blocks.every(b => this.satisfies(f.a, { ...g, [f.v]: b }));
      case 'ex':  return this.blocks.some (b => this.satisfies(f.a, { ...g, [f.v]: b }));
    }
  }
}

export { Block, CONSTANTS };
export { Shape, Size } from './Block.js';
