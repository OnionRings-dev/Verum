<!--
SPDX-FileCopyrightText: 2026 Liam Michael Boland
SPDX-License-Identifier: LicenseRef-Verum-Proprietary
-->
# Verum

© 2026 Liam Michael Boland. Tutti i diritti riservati: vedi `LICENSE`.
Come dimostrare la paternità del progetto: vedi `PROPRIETA.md`.

Tre strumenti web per un corso di logica del primo ordine:

- **Tavole** — tavole di verita' complete, validita' dell'argomento, soddisfacibilita' congiunta.
- **Mondi** — editor di mondi di blocchi e valutazione di enunciati quantificati.
  "Carica sentences" importa i file `.sen` del corso (singoli, a gruppi o in uno
  zip) e li offre in un menu; anche questi restano nel browser di chi li carica.
- **Derivazioni** — editor di prove in stile Fitch con verifica regola per regola.
  Il pannello a destra mostra il PDF delle regole del corso, che ogni utente
  carica dal proprio computer: il PDF resta nel suo browser e non fa parte del
  repository, perché è materiale di terzi.

Ogni schermata ha tre aspetti (Minimal, Neon, Dark), selezionabili dalla barra in alto; la scelta viene ricordata.

Il progetto e' una riscrittura originale e indipendente. Non contiene, non decompila
e non deriva da codice di software didattici esistenti.

## Avvio

I moduli ES non si caricano da `file://`. Serve un server statico:

    python3 -m http.server 8000     # poi apri http://localhost:8000
    # oppure: npx serve .

## Test

    node test/run.mjs          # nucleo + conformita' architetturale
    npm run test:smoke         # avvia il bundle in un DOM simulato (richiede npm install)

Quattro suite, nessuna delle quali avvia un browser vero:

| comando | cosa verifica |
|---|---|
| `node test/run.mjs` | comportamento del nucleo (parser, semantica, regole), importazione dei file del corso, robustezza su input storti, e conformita' architetturale |
| `node test/smoke.test.mjs` | il bundle consegnato si avvia e le funzioni principali rispondono |
| `node test/stress.test.mjs` | pestaggio casuale dell'interfaccia, prove lunghe, stato salvato corrotto |

Lo stress test e' deterministico: `VERUM_SEED=101 node test/stress.test.mjs`
ripete esattamente la stessa sequenza di azioni.
Gli ultimi due richiedono `node build.mjs` prima.

## Build

    npm install && node build.mjs

Produce `dist/verum.html`, file singolo autonomo, comodo per la consegna e per
una demo offline.

## Struttura

    src/
      domain/          logica pura: linguaggio, tavole, mondi, prove
      application/     casi d'uso e porte
      infrastructure/  adattatori: DOM, localStorage, orologio
      main.js          composition root
    test/
    build.mjs

Le regole che tengono in piedi questa struttura sono descritte in ARCHITETTURA.md
e verificate da `test/architecture.test.mjs`.
