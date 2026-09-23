// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · schermata Mondi.
 * Tiene lo stato di modifica come dati grezzi e costruisce un World del
 * dominio solo al momento della valutazione: l'aggregato resta sempre valido.
 */
import { $, $$, el, clear } from './dom.js';
import { blockSvg, ensureShapeDefs } from './BlockShapes.js';
import { World, Block, Shape, Size, CONSTANTS, WorldInvariantViolation } from '../../domain/world/World.js';

const SHAPE_LABELS = [[Shape.TET, 'Tetraedro'], [Shape.CUBE, 'Cubo'], [Shape.DODEC, 'Dodecaedro']];
const SIZE_LABELS  = [[Size.SMALL, 'Piccolo'], [Size.MEDIUM, 'Medio'], [Size.LARGE, 'Grande']];
const VALUE_CHIP = {
  true:      ['t', 'vero'],
  false:     ['f', 'falso'],
  undefined: ['w', 'indefinito'],
  malformed: ['f', 'non valida']
};

export class WorldView {
  constructor({ evaluateInWorld, repository }) {
    this.evaluateInWorld = evaluateInWorld;
    this.repository = repository;
    this.blocks = [];
    this.selected = null;
    this.nextId = 1;
    this.dragging = null;
    this.notice = '';
    this.sentences = [''];
    this.notes = [''];
    this.collection = '';
  }

  async start() {
    this.restore(await this.repository.load('world'));

    $('#wd-add').addEventListener('click', () => { this.sentences.push(''); this.notes.push(''); this.renderSentences(); });
    $('#wd-clearsent').addEventListener('click', () => { this.setSentences([]); this.persist(); });
    $('#wd-clearworld').addEventListener('click', () => {
      this.blocks = []; this.selected = null; this.renderBoard(); this.renderInspector(); this.persist();
    });
    $('#wd-eval').addEventListener('click', () => this.evaluate());
    $('#wd-example').addEventListener('click', () => {
      this.loadExampleWorld();
      this.setSentences([
        '∀x (Cube(x) → ¬Tet(x))', '∃x (Tet(x) ∧ Small(x))',
        'Larger(a, b)', '∀x ∃y (Larger(y, x) ∨ x = y)', 'Between(e, d, c)'
      ].map(text => ({ text, note: '' })));
      this.renderBoard(); this.renderInspector(); this.renderSentences(); this.evaluate();
    });

    this.renderBoard(); this.renderInspector(); this.renderSentences();
  }

  /**
   * Ripristina il mondo salvato scartando cio' che non e' costruibile:
   * i dati possono venire da una versione precedente o essere stati modificati.
   */
  restore(saved) {
    this.blocks = []; this.selected = null; this.nextId = 1;
    if (!saved || typeof saved !== 'object') return;
    try {
      const valid = (Array.isArray(saved.blocks) ? saved.blocks : []).filter(b => {
        try { new Block(b); return Number.isInteger(b.id); } catch { return false; }
      });
      this.blocks = valid.map(b => ({ ...b, names: Array.isArray(b.names) ? [...b.names] : [] }));
      this.nextId = Math.max(0, ...this.blocks.map(b => b.id)) + 1;

      const sentences = (Array.isArray(saved.sentences) ? saved.sentences : []).filter(s => typeof s === 'string');
      if (sentences.length) this.sentences = sentences;
      this.notes = this.sentences.map((_, i) => (typeof saved.notes?.[i] === 'string' ? saved.notes[i] : ''));
      this.collection = typeof saved.collection === 'string' ? saved.collection : '';
    } catch (error) {
      console.warn('mondo salvato illeggibile, si riparte da un tavolo vuoto', error);
      this.repository.remove('world');
      this.blocks = []; this.sentences = ['']; this.notes = ['']; this.collection = '';
    }
  }

  persist() { this.repository.save('world', { blocks: this.blocks, sentences: this.sentences, notes: this.notes, collection: this.collection }); }

  loadExampleWorld() {
    this.blocks = [
      { id:1, shape:Shape.CUBE,  size:Size.LARGE,  x:1, y:1, names:['a'] },
      { id:2, shape:Shape.CUBE,  size:Size.MEDIUM, x:4, y:1, names:['b'] },
      { id:3, shape:Shape.TET,   size:Size.SMALL,  x:6, y:3, names:['c'] },
      { id:4, shape:Shape.DODEC, size:Size.LARGE,  x:2, y:5, names:['d'] },
      { id:5, shape:Shape.TET,   size:Size.MEDIUM, x:4, y:5, names:['e'] },
      { id:6, shape:Shape.CUBE,  size:Size.SMALL,  x:5, y:6, names:['f'] }
    ];
    this.nextId = 7; this.selected = null; this.notice = '';
  }

  /** Traduce lo stato di editing nell'aggregato di dominio. */
  toWorld() { return new World(this.blocks.map(b => new Block(b))); }

  /** Il dominio decide dove un blocco puo' stare; la vista chiede e basta. */
  conflictFor(candidate, ignoreId = null) {
    return World.placementConflict(this.blocks, candidate, ignoreId);
  }

  /** Blocchi che violano gia' le regole (es. un mondo salvato con una versione precedente). */
  violatingIds() {
    const ids = new Set();
    for (let i = 0; i < this.blocks.length; i++)
      for (let j = i + 1; j < this.blocks.length; j++)
        if (World.conflict(this.blocks[i], this.blocks[j])) { ids.add(this.blocks[i].id); ids.add(this.blocks[j].id); }
    return ids;
  }

  refuse(message) { this.notice = message; this.renderInspector(); }

  renderBoard() {
    ensureShapeDefs();
    const board = clear($('#wd-board'));
    const violating = this.violatingIds();

    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      // vera scacchiera: la casella in basso a sinistra e' scura
      const cell = el('div', 'cell' + ((x + y) % 2 === 1 ? ' dark' : ''));
      // coordinate solo numeriche: le lettere si confonderebbero con le costanti a-f
      if (x === 0) cell.appendChild(el('span', 'coord row', String(8 - y)));
      if (y === 7) cell.appendChild(el('span', 'coord col', String(x + 1)));
      const block = this.blocks.find(b => b.x === x && b.y === y);

      if (block) {
        if (this.selected === block.id) cell.classList.add('selcell');
        if (violating.has(block.id)) cell.classList.add('conflict');
        const node = el('div', 'blk');
        node.innerHTML = blockSvg(block);
        node.draggable = true;
        node.addEventListener('click', e => {
          e.stopPropagation(); this.selected = block.id; this.notice = ''; this.renderBoard(); this.renderInspector();
        });
        node.addEventListener('dragstart', e => {
          this.dragging = block.id;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(block.id));
        });
        node.addEventListener('dragend', () => { this.dragging = null; });
        cell.appendChild(node);
        if (block.names.length) cell.appendChild(el('span', 'lbl', block.names.join(' ')));
      } else {
        // un blocco nuovo nasce medio: se anche un medio e' escluso, la casella e' nell'area di un grande
        const blocked = this.conflictFor({ x, y, size: Size.MEDIUM });
        if (blocked) {
          cell.classList.add('blocked');
          cell.title = 'Occupata dal blocco grande accanto';
        }
        cell.addEventListener('click', () => {
          if (blocked) { this.refuse(blocked.reason); return; }
          const created = { id: this.nextId++, shape: Shape.CUBE, size: Size.MEDIUM, x, y, names: [] };
          this.blocks.push(created); this.selected = created.id; this.notice = '';
          this.renderBoard(); this.renderInspector(); this.persist();
        });
      }

      const dropConflict = () => {
        const moved = this.blocks.find(b => b.id === this.dragging);
        return moved ? this.conflictFor({ x, y, size: moved.size }, moved.id) : null;
      };
      cell.addEventListener('dragover', e => {
        if (this.dragging == null) return;
        if (dropConflict()) { cell.classList.add('nodrop'); e.dataTransfer.dropEffect = 'none'; return; }
        e.preventDefault(); cell.classList.add('drop');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drop', 'nodrop'));
      cell.addEventListener('drop', e => {
        e.preventDefault(); cell.classList.remove('drop', 'nodrop');
        const id = this.dragging ?? Number(e.dataTransfer.getData('text/plain'));
        const moved = this.blocks.find(b => b.id === id);
        this.dragging = null;
        if (!moved) return;
        const conflict = this.conflictFor({ x, y, size: moved.size }, moved.id);
        if (conflict) { this.refuse(conflict.reason); this.renderBoard(); return; }
        moved.x = x; moved.y = y; this.selected = id; this.notice = '';
        this.renderBoard(); this.renderInspector(); this.persist();
      });
      board.appendChild(cell);
    }
  }

  renderInspector() {
    const host = clear($('#wd-insp'));
    const block = this.blocks.find(b => b.id === this.selected);
    const violating = this.violatingIds();
    if (violating.size)
      host.appendChild(el('p', 'err', 'Questo mondo viola le regole del tavolo: sposta o rimpicciolisci i blocchi evidenziati in rosso. Finche\u2019 non e\u2019 valido gli enunciati non si possono valutare.'));
    if (this.notice) host.appendChild(el('p', 'err notice', this.notice));
    if (!block) {
      host.appendChild(el('p', 'hint', 'Nessun blocco selezionato. Clic su una casella vuota per aggiungerne uno.'));
      return;
    }

    const group = (label, options, isActive, pick, whyNot = () => null) => {
      const wrap = el('div');
      wrap.appendChild(el('label', null, label));
      const row = el('div', 'grp');
      options.forEach(([value, text]) => {
        const button = el('button', 'seg' + (isActive(value) ? ' on' : ''), text);
        const reason = isActive(value) ? null : whyNot(value);
        if (reason) { button.disabled = true; button.title = reason; }
        button.addEventListener('click', () => {
          if (reason) return;
          pick(value); this.notice = '';
          this.renderBoard(); this.renderInspector(); this.persist();
        });
        row.appendChild(button);
      });
      wrap.appendChild(row);
      return wrap;
    };

    host.appendChild(group('Forma', SHAPE_LABELS, v => block.shape === v, v => block.shape = v));
    const noRoom = size => this.conflictFor({ x: block.x, y: block.y, size }, block.id)?.reason ?? null;
    host.appendChild(group('Dimensione', SIZE_LABELS, v => block.size === v, v => block.size = v, noRoom));
    if (block.size !== Size.LARGE && noRoom(Size.LARGE))
      host.appendChild(el('p', 'hint', 'Non puo\u2019 diventare grande: ha un blocco nelle caselle intorno.'));

    const names = el('div');
    names.appendChild(el('label', null, 'Nomi (una costante puo\u2019 stare su un solo blocco)'));
    const tags = el('div', 'nametags');
    CONSTANTS.forEach(name => {
      const active = block.names.includes(name);
      const tag = el('button', 'nametag' + (active ? ' on' : ''), name);
      tag.addEventListener('click', () => {
        if (active) block.names = block.names.filter(n => n !== name);
        else {
          this.blocks.forEach(b => { b.names = b.names.filter(n => n !== name); });
          block.names = [...block.names, name].sort();
        }
        this.renderBoard(); this.renderInspector(); this.persist();
      });
      tags.appendChild(tag);
    });
    names.appendChild(tags);
    host.appendChild(names);

    const remove = el('button', 'btn sm', 'Elimina blocco');
    remove.style.marginTop = '8px';
    remove.addEventListener('click', () => {
      this.blocks = this.blocks.filter(b => b.id !== block.id);
      this.selected = null;
      this.renderBoard(); this.renderInspector(); this.persist();
    });
    host.appendChild(remove);
  }

  /**
   * Sostituisce l'elenco degli enunciati (es. da una raccolta caricata).
   * @param {{text:string, note:string}[]} items
   */
  setSentences(items, collection = '') {
    this.sentences = items.length ? items.map(s => s.text) : [''];
    this.notes     = items.length ? items.map(s => s.note || '') : [''];
    this.collection = collection;
    this.renderSentences();
  }

  loadCollection({ title, sentences }) {
    this.setSentences(sentences, title);
    this.persist();
  }

  renderSentences() {
    const title = $('#wd-collection');
    if (title) title.textContent = this.collection ? ` · ${this.collection}` : '';
    const host = clear($('#wd-rows'));
    this.sentences.forEach((value, i) => {
      const row = el('div', 'frow');
      row.appendChild(el('div', 'n', `${i + 1}.`));

      const input = el('input', 'finput formula');
      input.value = value;
      input.placeholder = 'es. ∀x (Cube(x) → Small(x))';
      input.addEventListener('input', () => { this.sentences[i] = input.value; input.classList.remove('bad'); });
      input.addEventListener('change', () => this.persist());
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.evaluate(); } });

      const verdict = el('span'); verdict.id = `wd-v${i}`; verdict.style.minWidth = '72px'; verdict.style.flex = 'none';
      const remove = el('button', 'xbtn', '×');
      remove.addEventListener('click', () => {
        this.sentences.splice(i, 1);
        this.notes.splice(i, 1);
        if (!this.sentences.length) { this.sentences = ['']; this.notes = ['']; }
        this.renderSentences(); this.persist();
      });

      row.append(input, verdict, remove);
      host.appendChild(row);
      if (this.notes[i]) host.appendChild(el('p', 'snote', this.notes[i]));

      const error = el('p', 'err'); error.id = `wd-e${i}`; error.style.display = 'none';
      host.appendChild(error);
    });
  }

  evaluate() {
    this.persist();
    let world;
    try { world = this.toWorld(); }
    catch (e) {
      if (!(e instanceof WorldInvariantViolation)) throw e;
      this.refuse('Impossibile valutare: ' + e.message + '.');
      return;
    }

    const results = this.evaluateInWorld.execute({ world, sentences: this.sentences });
    const inputs = $$('#wd-rows .finput');

    results.forEach(({ position, value, message }) => {
      const verdict = clear($(`#wd-v${position}`));
      const error = $(`#wd-e${position}`);
      error.style.display = 'none';
      inputs[position]?.classList.remove('bad');
      if (value === 'blank') return;

      const chip = VALUE_CHIP[value];
      verdict.appendChild(el('span', `chip ${chip[0]}`, chip[1]));
      if (value === 'malformed') inputs[position]?.classList.add('bad');
      if (message) { error.textContent = message; error.style.display = 'block'; }
    });
  }
}
