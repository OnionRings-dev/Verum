// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Prova · Proof
 *
 * Aggregato: una derivazione in stile Fitch e' un albero di righe e
 * sottodimostrazioni. La numerazione e le regole di accessibilita' (quali
 * righe una riga puo' citare) sono invarianti dell'aggregato, non della UI.
 */
let nextId = 1;
const newId = () => nextId++;
export function resetIds(n = 1) { nextId = n; }

export const Justification = Object.freeze({ PREMISE: 'Prem', ASSUMPTION: 'Assunz' });

export class Line {
  constructor({ id = newId(), text = '', rule = '', citations = '' } = {}) {
    this.kind = 'line'; this.id = id; this.text = text; this.rule = rule; this.citations = citations;
  }
}
export class Subproof {
  constructor({ id = newId(), constant = '', items = null } = {}) {
    this.kind = 'subproof'; this.id = id; this.constant = constant;
    this.items = items ?? [new Line({ rule: Justification.ASSUMPTION })];
  }
}
export class Proof {
  constructor({ items = null, goal = '' } = {}) {
    this.kind = 'proof';
    this.items = items ?? [new Line({ rule: Justification.PREMISE }), new Line()];
    this.goal = goal;
  }

  /**
   * Numera le righe e registra, per ciascuna, la catena dei contenitori che la
   * racchiudono. La catena e' ciò che rende decidibile l'accessibilita'.
   */
  index() {
    const lines = [], subproofs = [];
    let n = 0;
    const walk = (container, chain) => {
      const here = [...chain, container];
      for (const item of container.items) {
        if (item.kind === 'line') { n++; lines.push({ number: n, line: item, chain: here }); }
        else { const first = n + 1; walk(item, here); subproofs.push({ first, last: n, subproof: item, chain: here }); }
      }
    };
    walk(this, []);
    return { lines, subproofs, lineCount: n };
  }

  /** Una riga vede solo cio' che sta in un contenitore ancora aperto sopra di se'. */
  static isAccessible(targetChain, fromChain) {
    return targetChain.length <= fromChain.length && targetChain.every((c, i) => c === fromChain[i]);
  }

  lastLineOf(container) {
    for (let i = container.items.length - 1; i >= 0; i--) {
      const item = container.items[i];
      if (item.kind === 'line') return item;
      const inner = this.lastLineOf(item);
      if (inner) return inner;
    }
    return null;
  }
}
