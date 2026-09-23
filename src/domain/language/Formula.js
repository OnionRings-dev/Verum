// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Dominio · Linguaggio · Formula
 *
 * Value object immutabile che rappresenta una formula del primo ordine.
 * Nessuna dipendenza da DOM, rete, storage, orologio o caso: questo file
 * e' eseguibile in Node, nel browser e in un test senza alcun adattatore.
 */

export const Sym = Object.freeze({
  not:'\u00ac', and:'\u2227', or:'\u2228', imp:'\u2192', iff:'\u2194',
  all:'\u2200', ex:'\u2203', bot:'\u22a5'
});

/* --- costruttori (l'unico modo per creare una formula) --- */
export const Bot   = ()        => Object.freeze({t:'bot'});
export const Atom  = (p,args=[]) => Object.freeze({t:'atom', p, args:Object.freeze([...args])});
export const Eq    = (l,r)     => Object.freeze({t:'eq', l, r});
export const Not   = (a)       => Object.freeze({t:'not', a});
export const And   = (l,r)     => Object.freeze({t:'and', l, r});
export const Or    = (l,r)     => Object.freeze({t:'or',  l, r});
export const Imp   = (l,r)     => Object.freeze({t:'imp', l, r});
export const Iff   = (l,r)     => Object.freeze({t:'iff', l, r});
export const All   = (v,a)     => Object.freeze({t:'all', v, a});
export const Ex    = (v,a)     => Object.freeze({t:'ex',  v, a});

/* --- uguaglianza fino ad alfa-equivalenza --- */
export function equals(a, b, ea = {}, eb = {}) {
  if (a.t !== b.t) return false;
  switch (a.t) {
    case 'bot':  return true;
    case 'eq':   return termEquals(a.l,b.l,ea,eb) && termEquals(a.r,b.r,ea,eb);
    case 'atom': return a.p === b.p && a.args.length === b.args.length &&
                        a.args.every((x,i)=>termEquals(x,b.args[i],ea,eb));
    case 'not':  return equals(a.a,b.a,ea,eb);
    case 'and': case 'or': case 'imp': case 'iff':
      return equals(a.l,b.l,ea,eb) && equals(a.r,b.r,ea,eb);
    case 'all': case 'ex': {
      const d = (ea.__d||0)+1;
      return equals(a.a, b.a, {...ea,__d:d,[a.v]:d}, {...eb,__d:d,[b.v]:d});
    }
  }
  return false;
}
function termEquals(x,y,ea,eb){
  const dx = ea[x], dy = eb[y];
  if (dx === undefined && dy === undefined) return x === y;
  return dx !== undefined && dy !== undefined && dx === dy;
}

/* --- sostituzione della variabile v con il termine t (cattura evitata) --- */
export function substitute(f, v, t) {
  switch (f.t) {
    case 'bot':  return f;
    case 'eq':   return Eq(f.l===v?t:f.l, f.r===v?t:f.r);
    case 'atom': return Atom(f.p, f.args.map(a=>a===v?t:a));
    case 'not':  return Not(substitute(f.a,v,t));
    case 'and':  return And(substitute(f.l,v,t), substitute(f.r,v,t));
    case 'or':   return Or (substitute(f.l,v,t), substitute(f.r,v,t));
    case 'imp':  return Imp(substitute(f.l,v,t), substitute(f.r,v,t));
    case 'iff':  return Iff(substitute(f.l,v,t), substitute(f.r,v,t));
    case 'all':  return f.v===v ? f : All(f.v, substitute(f.a,v,t));
    case 'ex':   return f.v===v ? f : Ex (f.v, substitute(f.a,v,t));
  }
}

/* --- termini liberi --- */
export function freeTerms(f, acc = new Set(), bound = new Set()) {
  const add = x => { if (!bound.has(x)) acc.add(x); };
  switch (f.t) {
    case 'bot': break;
    case 'eq': add(f.l); add(f.r); break;
    case 'atom': f.args.forEach(add); break;
    case 'not': freeTerms(f.a, acc, bound); break;
    case 'and': case 'or': case 'imp': case 'iff':
      freeTerms(f.l, acc, bound); freeTerms(f.r, acc, bound); break;
    case 'all': case 'ex': {
      const nb = new Set(bound); nb.add(f.v);
      freeTerms(f.a, acc, nb); break;
    }
  }
  return acc;
}

/* --- appiattimento di catene associative --- */
export const conjuncts = f => f.t==='and' ? [...conjuncts(f.l), ...conjuncts(f.r)] : [f];
export const disjuncts = f => f.t==='or'  ? [...disjuncts(f.l), ...disjuncts(f.r)] : [f];

/** Uguaglianza strutturale che ammette la sostituzione del termine a con b. */
export function equalsUpToSubstitution(P, Q, a, b) {
  if (P.t !== Q.t) return false;
  const tm = (x,y) => x===y || (x===a && y===b);
  switch (P.t) {
    case 'bot':  return true;
    case 'eq':   return tm(P.l,Q.l) && tm(P.r,Q.r);
    case 'atom': return P.p===Q.p && P.args.length===Q.args.length &&
                        P.args.every((x,i)=>tm(x,Q.args[i]));
    case 'not':  return equalsUpToSubstitution(P.a,Q.a,a,b);
    case 'and': case 'or': case 'imp': case 'iff':
      return equalsUpToSubstitution(P.l,Q.l,a,b) && equalsUpToSubstitution(P.r,Q.r,a,b);
    case 'all': case 'ex':
      return P.v===Q.v && equalsUpToSubstitution(P.a,Q.a,a,b);
  }
  return false;
}
