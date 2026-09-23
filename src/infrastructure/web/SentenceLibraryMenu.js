// SPDX-FileCopyrightText: 2026 Liam Michael Boland
// SPDX-License-Identifier: LicenseRef-Verum-Proprietary
/**
 * Infrastruttura · Web · menu "Carica sentences" (schermata Mondi).
 *
 * L'utente carica dal proprio computer i file di enunciati del corso, uno
 * per uno, a gruppi o dentro uno zip (anche l'archivio completo del corso).
 * Le raccolte vengono ricordate in questo browser e compaiono in un menu:
 * sceglierne una la carica nell'elenco degli enunciati.
 * I file non fanno parte del progetto: sono materiale di terzi.
 */
import { el, clear } from './dom.js';
import { readZipEntries } from '../import/ZipReader.js';

const KEY = 'sentence-library';
const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

export class SentenceLibraryMenu {
  constructor({ button, host, repository, importer, onPick }) {
    this.button = button;
    this.host = host;
    this.repository = repository;
    this.importer = importer;
    this.onPick = onPick;
    this.library = [];
    this.message = null;
    this.filter = '';
    this.open = false;
  }

  async start() {
    const saved = await this.repository.load(KEY);
    this.library = (Array.isArray(saved) ? saved : []).filter(c =>
      c && typeof c.title === 'string' && Array.isArray(c.sentences));

    this.button.setAttribute('aria-haspopup', 'true');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.addEventListener('click', e => { e.stopPropagation(); this.toggle(); });
    document.addEventListener('click', e => {
      if (this.open && !this.host.contains(e.target)) this.toggle(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.open) this.toggle(false); });
  }

  toggle(force) {
    this.open = force ?? !this.open;
    this.button.setAttribute('aria-expanded', String(this.open));
    this.render();
    if (this.open) this.host.querySelector('.libsearch, .libdrop button')?.focus();
  }

  persist() { return this.repository.save(KEY, this.library); }

  /* ---------- importazione ---------- */

  async importFiles(files) {
    const found = [], problems = [];
    for (const file of files) {
      try {
        if (/\.zip$/i.test(file.name)) {
          const entries = await readZipEntries(await file.arrayBuffer(), name => this.importer.supports(name));
          if (!entries.length) problems.push(`${file.name}: nessun file .sen dentro lo zip`);
          for (const entry of entries) found.push(await this.importer.importFrom(entry.bytes, entry.name));
        } else if (this.importer.supports(file.name)) {
          found.push(await this.importer.importFrom(new Uint8Array(await file.arrayBuffer()), file.name));
        } else {
          problems.push(`${file.name}: non e\u2019 un file .sen o .zip`);
        }
      } catch (error) {
        problems.push(error.message);
      }
    }

    // una raccolta con lo stesso titolo viene sostituita, non duplicata
    const byTitle = new Map(this.library.map(c => [c.title, c]));
    found.forEach(c => byTitle.set(c.title, c));
    this.library = [...byTitle.values()].sort((a, b) => collator.compare(a.title, b.title));
    await this.persist();

    this.message = found.length
      ? { kind: 'ok', text: `${found.length} raccolt${found.length === 1 ? 'a caricata' : 'e caricate'}` + (problems.length ? `, ${problems.length} problemi` : '') , details: problems }
      : { kind: 'err', text: problems[0] ?? 'Nessun file caricato.', details: problems.slice(1) };
    this.render();
  }

  fileInput() {
    const input = el('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.sen,.zip,application/zip';
    input.hidden = true;
    input.addEventListener('change', () => { if (input.files.length) this.importFiles([...input.files]); });
    return input;
  }

  /* ---------- rendering ---------- */

  render() {
    const host = clear(this.host);
    if (!this.open) return;

    const pop = el('div', 'libpop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Raccolte di enunciati');
    pop.addEventListener('click', e => e.stopPropagation());
    const input = this.fileInput();
    pop.appendChild(input);

    if (this.message) {
      pop.appendChild(el('p', this.message.kind === 'ok' ? 'libmsg' : 'err', this.message.text));
      if (this.message.details?.length) {
        const more = el('details', 'libdetails');
        more.appendChild(el('summary', null, 'Dettagli'));
        this.message.details.forEach(d => more.appendChild(el('p', 'hint', d)));
        pop.appendChild(more);
      }
    }

    if (!this.library.length) {
      pop.appendChild(this.dropZone(input));
    } else {
      pop.appendChild(this.list());
      const footer = el('div', 'libfoot');
      const add = el('button', 'btn sm', 'Aggiungi file\u2026');
      add.type = 'button';
      add.addEventListener('click', () => input.click());
      const wipe = el('button', 'btn sm ghost', 'Svuota raccolte');
      wipe.type = 'button';
      wipe.addEventListener('click', async () => {
        this.library = []; this.message = null; this.filter = '';
        await this.persist(); this.render();
      });
      footer.append(add, wipe);
      pop.appendChild(footer);
      this.acceptDrops(pop);
    }
    host.appendChild(pop);
  }

  dropZone(input) {
    const zone = el('div', 'libdrop');
    zone.appendChild(el('p', 'libtitle', 'Nessuna raccolta caricata'));
    zone.appendChild(el('p', 'hint',
      'Scegli i file .sen del corso (puoi selezionarli tutti insieme) oppure uno zip che li contiene, ' +
      'anche l\u2019archivio completo dei programmi. Restano salvati solo in questo browser.'));
    const choose = el('button', 'btn primary', 'Scegli file .sen o .zip');
    choose.type = 'button';
    choose.addEventListener('click', () => input.click());
    zone.appendChild(choose);
    this.acceptDrops(zone);
    return zone;
  }

  acceptDrops(target) {
    target.addEventListener('dragover', e => { e.preventDefault(); target.classList.add('over'); });
    target.addEventListener('dragleave', () => target.classList.remove('over'));
    target.addEventListener('drop', e => {
      e.preventDefault(); target.classList.remove('over');
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) this.importFiles(files);
    });
  }

  list() {
    const wrap = el('div');
    const search = el('input', 'finput libsearch');
    search.type = 'search';
    search.placeholder = `Cerca fra ${this.library.length} raccolte`;
    search.value = this.filter;
    search.setAttribute('aria-label', 'Cerca una raccolta');

    const items = el('div', 'liblist');
    items.setAttribute('role', 'listbox');
    const fill = () => {
      clear(items);
      const q = this.filter.trim().toLowerCase();
      const visible = this.library.filter(c => c.title.toLowerCase().includes(q));
      if (!visible.length) { items.appendChild(el('p', 'hint', 'Nessuna raccolta trovata.')); return; }
      visible.forEach(collection => {
        const option = el('button', 'libitem');
        option.type = 'button';
        option.setAttribute('role', 'option');
        option.appendChild(el('span', 'libname', collection.title));
        option.appendChild(el('span', 'libcount', String(collection.sentences.length)));
        option.addEventListener('click', () => {
          this.onPick(collection);
          this.message = null;
          this.toggle(false);
        });
        items.appendChild(option);
      });
    };
    search.addEventListener('input', () => { this.filter = search.value; fill(); });
    search.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); items.querySelector('.libitem')?.click(); }
    });
    fill();
    wrap.append(search, items);
    return wrap;
  }
}
