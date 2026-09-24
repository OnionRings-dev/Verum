// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · schermata Derivazioni.
 * Rende l'aggregato Proof e mostra l'esito che riceve dal caso d'uso.
 * Nessuna regola di inferenza vive in questo file.
 */
import { $, el, clear } from './dom.js';
import { Proof, Line, Subproof, Justification, resetIds } from '../../domain/proof/Proof.js';
import { citationTokens, toggleCitation } from '../../domain/proof/citations.js';
import { indentLine, outdentLine, canIndent, canOutdent } from '../../domain/proof/edit.js';
import { rulePicker } from './RulePicker.js';
import { namesInUse, freshConstant } from '../../domain/proof/constants.js';
import { constantPicker } from './ConstantPicker.js';

const VERDICT_CHIP = {
  complete:   't', sound: 'n', incomplete: 'w', 'off-goal': 'w', empty: null
};

export class ProofView {
  constructor({ checkProof, repository }) {
    this.checkProof = checkProof;
    this.repository = repository;
    this.proof = null;
    this.focusKey = null;
    this.notice = '';
    this.openRule = null;
    this.rows = new Map();
    this.dirty = false;   // c'è qualcosa da salvare e da riverificare?
    this.active = null;   // riga su cui si sta lavorando: si evidenziano i suoi riferimenti
    this.citing = null;   // riga il cui campo rif. ha il fuoco: i bersagli diventano cliccabili
  }

  async start() {
    this.proof = this.restore(await this.repository.load('proof'));

    $('#pf-goal').value = this.proof.goal;
    $('#pf-goal').addEventListener('input', e => { this.proof.goal = e.target.value; });
    $('#pf-goal').addEventListener('blur', () => { this.render(); this.persist(); });
    $('#pf-check').addEventListener('click', () => this.render());
    $('#pf-reset').addEventListener('click', () => {
      this.proof = this.blankProof(); $('#pf-goal').value = ''; this.render(); this.persist();
    });
    $('#pf-addprem').addEventListener('click', () => {
      let last = -1;
      this.proof.items.forEach((item, i) => { if (item.kind === 'line' && item.rule === Justification.PREMISE) last = i; });
      this.proof.items.splice(last + 1, 0, new Line({ rule: Justification.PREMISE }));
      this.render(); this.persist();
    });
    $('#pf-addline').addEventListener('click', () => { this.proof.items.push(new Line()); this.render(); this.persist(); });
    $('#pf-addsub').addEventListener('click',  () => { this.proof.items.push(new Subproof()); this.render(); this.persist(); });
    $('#pf-example').addEventListener('click', () => { this.proof = this.exampleProof(); $('#pf-goal').value = this.proof.goal; this.render(); this.persist(); });

    this.render();
  }

  blankProof() { resetIds(1); return new Proof({ goal: '' }); }

  /** Se i dati salvati sono inservibili si riparte puliti, e si buttano via. */
  restore(saved) {
    if (!saved) return this.blankProof();
    try {
      const proof = this.deserialize(saved);
      this.checkProof.execute({ proof });   // se non è verificabile non è una prova
      return proof;
    } catch (error) {
      console.warn('prova salvata illeggibile, si riparte da una prova vuota', error);
      this.repository.remove('proof');
      return this.blankProof();
    }
  }

  exampleProof() {
    resetIds(1);
    return new Proof({
      goal: 'Q → P',
      items: [
        new Line({ text: 'P', rule: Justification.PREMISE }),
        new Subproof({ items: [
          new Line({ text: 'Q', rule: Justification.ASSUMPTION }),
          new Line({ text: 'P', rule: 'Reit', citations: '1' })
        ]}),
        new Line({ text: 'Q → P', rule: '→ Intro', citations: '2-3' })
      ]
    });
  }

  /* ---- serializzazione: dati semplici, non oggetti di dominio ---- */
  serialize(container = this.proof) {
    return {
      goal: this.proof.goal,
      items: container.items.map(item => item.kind === 'line'
        ? { kind:'line', text:item.text, rule:item.rule, citations:item.citations }
        : { kind:'subproof', constant:item.constant, items: this.serialize(item).items })
    };
  }
  /**
   * Ricostruisce la prova da dati salvati. Tutto è trattato come sospetto:
   * il contenuto di localStorage può essere di una versione precedente,
   * troncato o modificato a mano, e non deve mai impedire l'avvio.
   */
  deserialize(data) {
    resetIds(1);
    const text = value => (typeof value === 'string' ? value : '');
    const build = items => (Array.isArray(items) ? items : [])
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        if (item.kind === 'subproof')
          return new Subproof({ constant: text(item.constant), items: build(item.items) });
        return new Line({ text: text(item.text), rule: text(item.rule), citations: text(item.citations) });
      })
      .filter(Boolean);
    const items = build(data?.items);
    return new Proof({ goal: text(data?.goal), items: items.length ? items : undefined });
  }
  persist() { this.repository.save('proof', this.serialize()); }

  /* ---- rendering ---- */
  /**
   * Aggiorna solo gli esiti: pallini, messaggi, verdetto. Non tocca i campi,
   * quindi non sposta il cursore né chiude i menu aperti. Il disegno completo
   * (`render`) serve solo quando cambia la struttura della prova.
   */
  paint(outcome = this.checkProof.execute({ proof: this.proof })) {
    const byId = new Map(outcome.lines.map(l => [l.id, l]));
    this.rows.forEach(({ wrapper, status, note }, id) => {
      const result = byId.get(id) ?? { status: 'empty' };
      const wrong = result.status === 'invalid' || result.status === 'malformed';
      wrapper.classList.toggle('bad', wrong);
      wrapper.classList.toggle('good', result.status === 'ok');
      status.className = 'pstat' + (result.status === 'ok' ? ' ok' : wrong ? ' no' : '');
      status.textContent = result.status === 'ok' || wrong ? '●' : '○';
      status.style.color = result.status === 'ok' || wrong ? '' : 'var(--rule)';
      status.title = wrong ? (result.message || '') : result.status === 'ok' ? 'corretta' : '';
      note.hidden = !(wrong && result.message);
      note.firstChild.textContent = wrong ? (result.message || '') : '';
    });

    const verdict = clear($('#pf-verdict'));
    const chipClass = VERDICT_CHIP[outcome.verdict.kind];
    if (chipClass) verdict.appendChild(el('span', `chip ${chipClass}`, outcome.verdict.message));

    const written = outcome.lines.filter(l => l.status !== 'empty').length;
    const empty = $('#pf-empty');
    if (empty) empty.hidden = written > 0;
    const notice = $('#pf-notice');
    if (notice) { notice.textContent = this.notice || ''; notice.hidden = !this.notice; }
  }

  render() {
    const host = clear($('#pf-proof'));
    this.rows = new Map();
    const outcome = this.checkProof.execute({ proof: this.proof });
    const byId = new Map(outcome.lines.map(l => [l.id, l]));
    this.index = this.proof.index();
    this.rowsByNumber = new Map();
    this.boxesByRange = new Map();
    let number = 0;

    const renderLine = (line, container, isAssumption, subproof) => {
      number++;
      const wrapper = el('div');
      this.rowsByNumber.set(number, wrapper);
      const row = el('div', 'pline');
      const numberLabel = el('button', 'pnum', String(number));
      numberLabel.type = 'button';
      numberLabel.tabIndex = -1;
      numberLabel.dataset.number = String(number);
      numberLabel.addEventListener('mousedown', e => e.preventDefault()); // il campo rif. non perde il fuoco
      numberLabel.addEventListener('click', () => this.cite(String(numberLabel.dataset.number)));
      row.appendChild(numberLabel);
      const body = el('div', 'pbody');

      if (isAssumption && subproof) {
        // la costante di questa sottodimostrazione non conta come "già usata" per se stessa
        const without = compute => {
          const own = subproof.constant; subproof.constant = '';
          try { return compute(); } finally { subproof.constant = own; }
        };
        body.appendChild(constantPicker({
          value: subproof.constant || '',
          used: without(() => namesInUse(this.proof)),
          fresh: () => without(() => freshConstant(this.proof)),
          onChange: name => { subproof.constant = name; this.dirty = true; },
          onCommit: () => { this.render(); this.persist(); }
        }));
      }

      const text = el('input', 'pf formula');
      text.value = line.text; text.placeholder = 'formula'; text.dataset.fk = 'f' + line.id;
      text.addEventListener('focus', () => this.focusRow(line.id, false, text));
      text.addEventListener('input', () => { line.text = text.value; this.dirty = true; });
      text.addEventListener('blur', e => this.commit(e));
      text.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault(); line.text = text.value;
          const at = container.items.indexOf(line) + 1;
          const sub = new Subproof();
          container.items.splice(at, 0, sub);
          this.focusKey = 'f' + sub.items[0].id;
          this.render(); this.persist();
          return;
        }
        if (e.key === 'Enter') { e.preventDefault(); line.text = text.value; this.insertAfter(container, line); }
        if (e.key === 'Tab') { e.preventDefault(); line.text = text.value; this.restructure(line.id, e.shiftKey ? 'outdent' : 'indent'); }
        if (e.key === 'Backspace' && !text.value) {
          const previous = this.lineBefore(line.id);
          if (!previous) return;                       // la prima riga non si cancella da sola
          e.preventDefault();
          container.items.splice(container.items.indexOf(line), 1);
          if (container.kind === 'subproof' && !container.items.length) this.dropSubproof(container);
          this.focusKey = 'f' + previous.id;
          this.render(); this.persist();
        }
      });
      body.appendChild(text);

      const just = el('span', 'pjust');
      just.appendChild(rulePicker({
        value: line.rule || '',
        open: this.openRule === line.id,
        fk: 'rule' + line.id,
        onOpen: () => { this.openRule = line.id; this.focusKey = 'rule' + line.id; this.render(); },
        onClose: () => { if (this.openRule === line.id) { this.openRule = null; this.render(); } },
        onPick: name => {
          line.rule = name; this.openRule = null; this.dirty = false;
          this.focusKey = 'r' + line.id; this.render(); this.persist();
        }
      }));

      const citations = el('input', 'prefs');
      citations.value = line.citations || ''; citations.placeholder = 'rif.';
      citations.dataset.fk = 'r' + line.id;
      citations.title = 'Scrivi i riferimenti, oppure clicca il numero di una riga o il bordo di una sottodimostrazione';
      citations.addEventListener('focus', () => this.focusRow(line.id, true, citations));
      citations.addEventListener('input', () => { line.citations = citations.value; this.dirty = true; });
      citations.addEventListener('blur', e => { this.citing = null; this.applyHighlights(); this.commit(e); });
      just.appendChild(citations);
      body.appendChild(just);

      const status = el('span', 'pstat');
      body.appendChild(status);

      const actions = el('span', 'pacts');
      const command = (glyph, title, enabled, action) => {
        const button = el('button', 'pact', glyph);
        button.type = 'button';
        button.tabIndex = -1;
        button.title = title;
        button.setAttribute('aria-label', title);
        button.disabled = !enabled;
        button.addEventListener('mousedown', e => e.preventDefault());
        button.addEventListener('click', action);
        return button;
      };
      actions.append(
        command('⇥', 'Rientra di un livello (Tab)', canIndent(this.proof, line.id), () => this.restructure(line.id, 'indent')),
        command('⇤', 'Esci dalla sottodimostrazione (Maiusc+Tab)', canOutdent(this.proof, line.id), () => this.restructure(line.id, 'outdent')),
        command('×', 'Elimina la riga', true, () => {
          container.items.splice(container.items.indexOf(line), 1);
          this.render(); this.persist();
        })
      );
      body.appendChild(actions);

      row.appendChild(body);
      wrapper.appendChild(row);
      const note = el('p', 'pmsg');
      note.appendChild(el('span'));
      note.hidden = true;
      wrapper.appendChild(note);
      this.rows.set(line.id, { wrapper, status, note });
      return wrapper;
    };

    const renderContainer = (container, target) => {
      container.items.forEach((item, index) => {
        if (item.kind === 'line') {
          const isAssumption = container.kind === 'subproof' && index === 0;
          const node = renderLine(item, container, isAssumption, container);
          if (isAssumption) node.classList.add('assume');
          target.appendChild(node);
          return;
        }
        const box = el('div', 'sub');
        const first = number + 1;
        renderContainer(item, box);
        const range = `${first}-${number}`;
        this.boxesByRange.set(range, box);
        const handle = el('button', 'subhandle');
        handle.type = 'button';
        handle.tabIndex = -1;
        handle.title = `Cita la sottodimostrazione ${range}`;
        handle.setAttribute('aria-label', handle.title);
        handle.appendChild(el('span', 'subrange', range));
        handle.addEventListener('mousedown', e => e.preventDefault());
        handle.addEventListener('click', () => this.cite(range));
        box.prepend(handle);
        const tools = el('div', 'toolrow');
        tools.style.margin = '4px 0 2px 4px';
        const addLine = el('button', 'btn sm', '+ riga');
        addLine.addEventListener('click', () => { item.items.push(new Line()); this.render(); this.persist(); });
        const addSub = el('button', 'btn sm', '+ sottodim.');
        addSub.addEventListener('click', () => { item.items.push(new Subproof()); this.render(); this.persist(); });
        const drop = el('button', 'btn sm ghost', 'elimina blocco');
        drop.addEventListener('click', () => {
          container.items.splice(container.items.indexOf(item), 1); this.render(); this.persist();
        });
        tools.append(addLine, addSub, drop);
        box.appendChild(tools);
        target.appendChild(box);
      });
    };

    const scope = el('div', 'scope');
    renderContainer(this.proof, scope);

    let lastPremise = -1;
    this.proof.items.forEach((item, i) => {
      if (item.kind === 'line' && item.rule === Justification.PREMISE) lastPremise = i;
    });
    const children = [...scope.children];
    if (lastPremise >= 0 && children[lastPremise]) {
      Object.assign(children[lastPremise].style, {
        borderBottom: '1.5px solid var(--ink)', paddingBottom: '3px', marginBottom: '3px'
      });
    }
    host.appendChild(scope);
    this.paint(outcome);
    this.applyHighlights();

    if (this.focusKey) {
      const field = host.querySelector(`[data-fk="${this.focusKey}"]`);
      if (field) { field.focus(); field.selectionStart = field.selectionEnd = field.value.length; }
      this.focusKey = null;
    }
  }

  /**
   * Ridisegna la prova dopo una modifica, conservando il fuoco.
   * Ogni uscita da un campo provoca un nuovo disegno, quindi il campo verso cui
   * l'utente sta andando verrebbe distrutto sotto il suo clic: qui lo si
   * riconosce (relatedTarget) e gli si restituisce il fuoco dopo il disegno.
   */
  /**
   * Fine della scrittura in un campo: si riverifica e si salva, ma la struttura
   * resta quella che e'. Così il campo su cui l'utente sta passando non viene
   * sostituito sotto il suo clic e il cursore non salta.
   */
  commit() {
    if (!this.dirty) return;
    this.dirty = false;
    this.paint();
    this.applyHighlights();
    this.persist();
  }

  /** Segna la riga su cui si sta lavorando; con `citing` i bersagli diventano cliccabili. */
  focusRow(lineId, citing, field = null) {
    if (field && !field.isConnected) return;   // campo già sostituito da un nuovo disegno
    this.active = lineId;
    this.citing = citing ? lineId : null;
    this.applyHighlights();
  }

  /** Righe e sottodimostrazioni che la riga attiva può legittimamente citare. */
  citableFor(entry) {
    const numbers = this.index.lines
      .filter(l => l.number < entry.number && Proof.isAccessible(l.chain, entry.chain))
      .map(l => String(l.number));
    const ranges = this.index.subproofs
      .filter(s => s.last < entry.number && Proof.isAccessible(s.chain, entry.chain) && !entry.chain.includes(s.subproof))
      .map(s => `${s.first}-${s.last}`);
    return new Set([...numbers, ...ranges]);
  }

  applyHighlights() {
    const host = $('#pf-proof');
    if (!host || !this.index) return;
    host.classList.toggle('citing', this.citing !== null);
    const hint = $('#pf-citehint');
    if (hint) hint.hidden = this.citing === null;
    this.rowsByNumber.forEach(node => node.classList.remove('cited', 'citable'));
    this.boxesByRange.forEach(node => node.classList.remove('cited', 'citable'));

    const entry = this.index.lines.find(l => l.line.id === this.active);
    if (!entry) return;

    // i riferimenti della riga attiva, evidenziati solo finché si lavora su quella riga
    for (const token of citationTokens(entry.line.citations)) {
      this.rowsByNumber.get(Number(token))?.classList.add('cited');
      this.boxesByRange.get(token)?.classList.add('cited');
    }
    if (this.citing === null) return;

    for (const token of this.citableFor(entry)) {
      this.rowsByNumber.get(Number(token))?.classList.add('citable');
      this.boxesByRange.get(token)?.classList.add('citable');
    }
  }

  /** Aggiunge o toglie un riferimento cliccando il bersaglio. */
  cite(token) {
    if (this.citing === null) return;
    const entry = this.index.lines.find(l => l.line.id === this.citing);
    if (!entry || !this.citableFor(entry).has(token)) return;
    entry.line.citations = toggleCitation(entry.line.citations, token);
    this.focusKey = 'r' + entry.line.id;
    this.render();
    this.persist();
  }

  /** Rientra o fa uscire una riga, tenendo il fuoco dove sta lavorando l'utente. */
  restructure(lineId, direction) {
    const move = direction === 'indent' ? indentLine : outdentLine;
    const result = move(this.proof, lineId);
    if (!result.ok) { this.notice = result.reason; }
    else this.notice = '';
    this.focusKey = 'f' + lineId;
    this.render();
    this.persist();
  }

  /** La riga che precede, in ordine di numerazione. */
  lineBefore(lineId) {
    const lines = this.proof.index().lines;
    const at = lines.findIndex(l => l.line.id === lineId);
    return at > 0 ? lines[at - 1].line : null;
  }

  dropSubproof(subproof) {
    const strip = container => {
      container.items = container.items.filter(item => item !== subproof);
      container.items.forEach(item => { if (item.kind === 'subproof') strip(item); });
    };
    strip(this.proof);
  }

  insertAfter(container, line) {
    const created = new Line({ rule: line.rule === Justification.PREMISE ? Justification.PREMISE : '' });
    container.items.splice(container.items.indexOf(line) + 1, 0, created);
    this.focusKey = 'f' + created.id;
    this.render(); this.persist();
  }
}
