// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · disegno dei solidi in rilievo.
 *
 * Ogni solido è disegnato in vista di tre quarti con tre livelli di luce
 * (faccia illuminata, faccia frontale, faccia in ombra), contorno scuro,
 * riflesso e ombra portata. I colori non sono scritti qui: i gradienti
 * leggono i token --pc-* del tema attivo, quindi cambiare tema cambia il
 * materiale dei pezzi senza ridisegnarli.
 */

const SCALE = { 1: 0.52, 2: 0.72, 3: 0.94 };   // frazione della casella
const EDGE = 'stroke:var(--pc-edge);stroke-width:3.2;stroke-linejoin:round;stroke-linecap:round';

/** Gradienti condivisi, inseriti una volta sola nel documento. */
export function ensureShapeDefs() {
  if (document.getElementById('verum-shape-defs')) return;
  const stop = (offset, token, opacity = 1) =>
    `<stop offset="${offset}" style="stop-color:var(${token});stop-opacity:${opacity}"/>`;
  const holder = document.createElement('div');
  holder.innerHTML = `
  <svg id="verum-shape-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="vg-top" x1="0" y1="0" x2="1" y2="1">${stop(0,'--pc-hi')}${stop(1,'--pc-mid')}</linearGradient>
      <linearGradient id="vg-front" x1="0" y1="0" x2="0.35" y2="1">${stop(0,'--pc-mid')}${stop(1,'--pc-lo')}</linearGradient>
      <linearGradient id="vg-side" x1="0" y1="0" x2="1" y2="1">${stop(0,'--pc-lo')}${stop(1,'--pc-deep')}</linearGradient>
      <radialGradient id="vg-center" cx="0.38" cy="0.32" r="0.8">${stop(0,'--pc-hi')}${stop(0.7,'--pc-mid')}${stop(1,'--pc-lo')}</radialGradient>
      <linearGradient id="vg-shine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style="stop-color:#fff;stop-opacity:0"/>
        <stop offset="0.5" style="stop-color:#fff;stop-opacity:.75"/>
        <stop offset="1" style="stop-color:#fff;stop-opacity:0"/>
      </linearGradient>
    </defs>
  </svg>`;
  document.body.appendChild(holder.firstElementChild);
}

const face = (points, gradient) =>
  `<polygon points="${points}" style="fill:url(#${gradient});${EDGE}"/>`;
const shadow = (cx, cy, rx, ry) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" style="fill:var(--pc-edge);opacity:.28"/>`;
const shine = (x1, y1, x2, y2) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:url(#vg-shine);stroke-width:3;stroke-linecap:round"/>`;

function cube() {
  return shadow(54, 90, 38, 6)
    + face('18,34 34,20 86,20 70,34', 'vg-top')
    + face('70,34 86,20 86,72 70,86', 'vg-side')
    + face('18,34 70,34 70,86 18,86', 'vg-front')
    + `<rect x="25" y="41" width="38" height="38" rx="2" style="fill:none;stroke:#fff;stroke-opacity:.18;stroke-width:1.6"/>`
    + shine(24, 37, 62, 37);
}

function tetrahedron() {
  return shadow(52, 88, 40, 6)
    + face('50,8 90,70 70,90', 'vg-side')
    + face('50,8 12,84 70,90', 'vg-front')
    + shine(47, 14, 20, 76);
}

function dodecahedron() {
  const cx = 50, cy = 50, R = 41, r = 24;
  const at = (radius, deg) => {
    const a = deg * Math.PI / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  };
  const pts = list => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const inner = [...Array(5).keys()].map(k => at(r, -90 + 72 * k));
  const outer = [...Array(10).keys()].map(j => at(R, -90 + 36 * j));
  const light = -127;                                   // luce da in alto a sinistra

  let faces = '';
  for (let k = 0; k < 5; k++) {
    const direction = -54 + 72 * k;
    const brightness = Math.cos((direction - light) * Math.PI / 180);
    const gradient = brightness > 0.6 ? 'vg-top' : brightness > -0.2 ? 'vg-front' : 'vg-side';
    faces += face(pts([inner[k], outer[2 * k], outer[(2 * k + 1) % 10], outer[(2 * k + 2) % 10], inner[(k + 1) % 5]]), gradient);
  }
  return shadow(52, 92, 36, 5) + faces
    + face(pts(inner), 'vg-center')
    + shine(34, 30, 48, 20);
}

const DRAW = { Cube: cube, Tet: tetrahedron, Dodec: dodecahedron };

export function blockSvg({ shape, size }) {
  const k = SCALE[size];
  const style = `width:calc(var(--cell) * ${k});height:calc(var(--cell) * ${k})`;
  return `<svg viewBox="0 0 100 100" style="${style}" role="img" aria-label="${shape}">${DRAW[shape]()}</svg>`;
}
