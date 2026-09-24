// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · schermata Tavole.
 * Sa disegnare, non sa di logica: riceve un DTO dal caso d'uso e lo rende.
 */
import { $, $$, el, clear, debounce } from './dom.js';

const KIND_LABEL = { tautology:['t','tautologia'], contradiction:['f','contraddizione'], contingent:['n','contingente'] };

export class TruthTableView {
  constructor({ buildTruthTable, repository }) {
    this.buildTruthTable = buildTruthTable;
    this.repository = repository;
    this.sentences = [''];
    this.refresh = debounce(() => this.build(), 350);
  }

  async start() {
    const saved = await this.repository.load('truth-table');
    const sentences = (Array.isArray(saved?.sentences) ? saved.sentences : []).filter(s => typeof s === 'string');
    if (sentences.length) this.sentences = sentences;

    $('#tt-add').addEventListener('click', () => { this.sentences.push(''); this.renderInputs(); this.focusLast(); });
    $('#tt-clear').addEventListener('click', () => { this.sentences = ['']; this.renderInputs(); this.persist(); this.build(); });
    $('#tt-example').addEventListener('click', () => {
      this.sentences = ['P → Q', 'Q → R', 'P → R'];
      this.renderInputs(); this.build();
    });
    this.renderInputs();
    this.build();
  }

  removeAt(i) {
    this.sentences.splice(i, 1);
    if (!this.sentences.length) this.sentences = [''];
    this.renderInputs(); this.persist(); this.build();
    const fields = $$('#tt-rows .finput');
    (fields[Math.max(0, i - 1)] ?? fields[0])?.focus();
  }

  addRow() {
    this.sentences.push('');
    this.renderInputs();
    this.focusLast();
  }

  persist() { this.repository.save('truth-table', { sentences: this.sentences }); }
  focusLast() { const all = $$('#tt-rows .finput'); all[all.length - 1]?.focus(); }

  renderInputs() {
    const host = clear($('#tt-rows'));
    this.sentences.forEach((value, i) => {
      const row = el('div', 'frow');
      row.appendChild(el('div', 'n', i === this.sentences.length - 1 ? '∴' : `${i + 1}.`));

      const input = el('input', 'finput formula');
      input.value = value;
      input.placeholder = 'es. P ∧ ¬Q';
      input.addEventListener('input', () => {
        this.sentences[i] = input.value;
        input.classList.remove('bad');
        this.refresh();                     // la tavola si rifa' da sola
      });
      input.addEventListener('change', () => this.persist());
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.refresh.now(); this.addRow(); }
        if (e.key === 'Backspace' && !input.value && this.sentences.length > 1) {
          e.preventDefault();
          this.removeAt(i);
        }
      });

      const remove = el('button', 'xbtn', '×');
      remove.title = 'Elimina';
      remove.addEventListener('click', () => {
        this.sentences.splice(i, 1);
        if (!this.sentences.length) this.sentences = [''];
        this.renderInputs(); this.persist(); this.build();
      });

      row.append(input, remove);
      host.appendChild(row);
    });
  }

  build() {
    this.persist();
    const out = clear($('#tt-out'));
    const result = this.buildTruthTable.execute({ sentences: this.sentences });
    const inputs = $$('#tt-rows .finput');
    inputs.forEach(i => i.classList.remove('bad'));

    if (result.status === 'invalid') {
      result.errors.forEach(e => inputs[e.position]?.classList.add('bad'));
      out.appendChild(el('p', 'err', `Riga ${result.errors[0].position + 1}: ${result.errors[0].message}`));
      return;
    }
    if (result.status === 'empty') { out.appendChild(this.emptyState()); return; }
    if (result.status === 'too-large') {
      out.appendChild(el('p', 'err', `Troppe lettere proposizionali: il limite è ${result.limit}.`));
      return;
    }

    out.appendChild(this.renderTable(result));
    out.appendChild(this.renderAnalysis(result));
  }

  /** Cosa si vede prima di aver scritto qualcosa. */
  emptyState() {
    const box = el('div', 'blank');
    box.appendChild(el('p', 'blank-title', 'La tavola compare qui'));
    box.appendChild(el('p', 'hint',
      'Scrivi un enunciato a sinistra: la tavola si costruisce da sola mentre digiti. ' +
      'Con piu\u2019 enunciati, l\u2019ultimo vale come conclusione e i precedenti come premesse.'));
    const example = el('button', 'btn', 'Carica un esempio');
    example.type = 'button';
    example.addEventListener('click', () => $('#tt-example').click());
    box.appendChild(example);
    return box;
  }

  renderTable({ atoms, headers, rows }) {
    const wrap = el('div', 'ttwrap');
    const table = el('table', 'tt');
    const head = el('thead'), headRow = el('tr');
    atoms.forEach(a => headRow.appendChild(el('th', null, a)));
    headers.forEach((h, j) => headRow.appendChild(el('th', j === 0 ? 'sep' : null, h)));
    head.appendChild(headRow); table.appendChild(head);

    const body = el('tbody');
    rows.forEach(row => {
      const tr = el('tr');
      row.reference.forEach(v => tr.appendChild(el('td', `ref ${v ? 'T' : 'F'}`, v ? 'T' : 'F')));
      row.values.forEach((v, j) => {
        const cell = el('td', `main ${v ? 'T' : 'F'}`, v ? 'T' : 'F');
        if (j === 0) cell.classList.add('sep');
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
    table.appendChild(body); wrap.appendChild(table);
    return wrap;
  }

  renderAnalysis({ analysis }) {
    const summary = el('div', 'sum');
    summary.style.marginTop = '16px';
    const add = (label, text, chip) => {
      const row = el('div', 'row');
      row.appendChild(el('span', 'k', label));
      const value = el('span'); value.style.flex = '1';
      if (chip) { value.appendChild(el('span', `chip ${chip[0]}`, chip[1])); value.append(' '); }
      value.append(text || '');
      row.appendChild(value); summary.appendChild(row);
    };

    analysis.perColumn.forEach((c, j) => add(`Colonna ${j + 1}`, c.header, KIND_LABEL[c.kind]));

    if (analysis.valid !== undefined) {
      add('Argomento',
        analysis.valid
          ? 'ogni riga che rende vere tutte le premesse rende vera anche la conclusione'
          : `controesempio alla riga ${analysis.counterexample.row}: ` +
            Object.entries(analysis.counterexample.assignment).map(([k, v]) => `${k}=${v ? 'T' : 'F'}`).join(', '),
        analysis.valid ? ['t', 'valido (conseguenza tautologica)'] : ['f', 'non valido']);

      add('Insieme',
        analysis.satisfiable ? 'esiste almeno una riga che le rende tutte vere' : 'nessuna riga le rende tutte vere',
        analysis.satisfiable ? ['t', 'congiuntamente soddisfacibile'] : ['w', 'insoddisfacibile']);
    }
    return summary;
  }
}
