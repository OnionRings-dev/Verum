// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · pannello del PDF delle regole (schermata Derivazioni).
 *
 * L'utente sceglie dal proprio computer il PDF delle regole del corso; il
 * pannello lo mostra accanto alla prova e lo ricorda per le volte successive.
 * Il PDF non e' incluso nel progetto: e' materiale di terzi e resta
 * nella copia personale di chi lo usa.
 */
import { el, clear } from './dom.js';

const KEY = 'rules-pdf';
const MAX_BYTES = 30 * 1024 * 1024;

export class RulesPdfPanel {
  constructor({ host, fileStore }) {
    this.host = host;
    this.fileStore = fileStore;
    this.url = null;
  }

  async start() {
    const stored = await this.fileStore.get(KEY);
    stored ? this.showPdf(stored) : this.showPicker();
  }

  isPdf(file) {
    return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
  }

  async accept(file) {
    if (!this.isPdf(file)) return this.showPicker('Il file scelto non e\u2019 un PDF.');
    if (file.size > MAX_BYTES) return this.showPicker('Il PDF supera i 30 MB.');
    await this.fileStore.put(KEY, file);
    this.showPdf({ name: file.name, blob: file });
  }

  fileInput() {
    const input = el('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.hidden = true;
    input.addEventListener('change', () => { if (input.files[0]) this.accept(input.files[0]); });
    return input;
  }

  releaseUrl() {
    if (this.url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.url);
    this.url = null;
  }

  showPicker(error = '') {
    this.releaseUrl();
    const host = clear(this.host);
    const zone = el('div', 'pdfdrop');
    zone.tabIndex = 0;
    zone.setAttribute('role', 'button');
    zone.setAttribute('aria-label', 'Carica il PDF delle regole');

    zone.appendChild(el('p', 'pdfdrop-title', 'Regole di Fitch'));
    zone.appendChild(el('p', 'hint',
      'Trascina qui il PDF delle regole del corso, oppure sceglilo dal computer. ' +
      'Resta salvato solo in questo browser e non viene inviato da nessuna parte.'));
    const input = this.fileInput();
    const choose = el('button', 'btn primary', 'Scegli il PDF');
    choose.type = 'button';
    choose.addEventListener('click', e => { e.stopPropagation(); input.click(); });
    zone.append(choose, input);
    if (error) zone.appendChild(el('p', 'err', error));

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('over');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.accept(file);
    });
    host.appendChild(zone);
  }

  showPdf({ name, blob }) {
    this.releaseUrl();
    const host = clear(this.host);
    if (typeof URL.createObjectURL !== 'function') { this.showPicker('Questo browser non puo\u2019 mostrare il PDF.'); return; }
    this.url = URL.createObjectURL(blob);

    const bar = el('div', 'pdfbar');
    bar.appendChild(el('span', 'pdfname', name || 'regole.pdf'));
    const open = el('a', 'btn sm', 'Apri a schermo intero');
    open.href = this.url; open.target = '_blank'; open.rel = 'noopener';
    const input = this.fileInput();
    const replace = el('button', 'btn sm', 'Sostituisci');
    replace.type = 'button';
    replace.addEventListener('click', () => input.click());
    const remove = el('button', 'btn sm ghost', 'Rimuovi');
    remove.type = 'button';
    remove.addEventListener('click', async () => { await this.fileStore.remove(KEY); this.showPicker(); });
    bar.append(open, replace, remove, input);

    const frame = el('iframe', 'pdfframe');
    frame.title = 'Regole di Fitch';
    frame.src = this.url + '#view=FitH';
    host.append(bar, frame);
  }
}
