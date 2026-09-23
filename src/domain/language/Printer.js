// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Linguaggio · Printer
 * Rende una formula in notazione standard, inserendo le parentesi minime.
 * Invariante verificata dai test: parse(print(f)) equivale a f.
 */
import { Sym } from './Formula.js';

const PRECEDENCE = { iff:1, imp:2, or:3, and:4, not:5, all:5, ex:5, atom:9, eq:9, bot:9 };

export function print(f, parent = null) {
  const precedence = PRECEDENCE[f.t];
  let text;
  switch (f.t) {
    case 'bot':  return Sym.bot;
    case 'eq':   return `${f.l} = ${f.r}`;
    case 'atom': return f.args.length ? `${f.p}(${f.args.join(', ')})` : f.p;
    case 'not':  text = Sym.not + print(f.a, f); break;
    case 'all':  text = `${Sym.all}${f.v} ${print(f.a, f)}`; break;
    case 'ex':   text = `${Sym.ex}${f.v} ${print(f.a, f)}`; break;
    case 'and':  text = `${print(f.l,f)} ${Sym.and} ${print(f.r,f)}`; break;
    case 'or':   text = `${print(f.l,f)} ${Sym.or} ${print(f.r,f)}`;  break;
    case 'imp':  text = `${print(f.l,f)} ${Sym.imp} ${print(f.r,f)}`; break;
    case 'iff':  text = `${print(f.l,f)} ${Sym.iff} ${print(f.r,f)}`; break;
  }
  if (!parent) return text;
  if (PRECEDENCE[parent.t] > precedence) return `(${text})`;
  if (PRECEDENCE[parent.t] === precedence) {
    if (parent.t === 'imp') { if (parent.l === f) return `(${text})`; }
    else if (parent.r === f) return `(${text})`;
  }
  return text;
}
