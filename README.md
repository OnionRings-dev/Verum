<!--
SPDX-FileCopyrightText: 2026 Liam Michael Boland
SPDX-License-Identifier: LicenseRef-Verum-Proprietary
-->
# Verum

© 2026 Liam Michael Boland. Tutti i diritti riservati: vedi `LICENSE`.
Come dimostrare la paternità del progetto: vedi `PROPRIETA.md`.

Tre strumenti web per un corso di logica del primo ordine:

- **Tavole** — tavole di verità complete, validita' dell'argomento, soddisfacibilita' congiunta,
  ricostruite mentre si scrive.
- **Mondi** — editor di mondi di blocchi e valutazione di enunciati quantificati, aggiornata a
  ogni modifica del tavolo.
  "Carica sentences" importa i file `.sen` del corso (singoli, a gruppi o in uno
  zip) e li offre in un menu; anche questi restano nel browser di chi li carica.
- **Derivazioni** — editor di prove in stile Fitch con verifica regola per regola.
  Le righe si rientrano e si fanno uscire con Tab e Maiusc+Tab, i riferimenti si
  compongono cliccando le righe citate.
  Il pannello a destra mostra il PDF delle regole del corso, che ogni utente
  carica dal proprio computer: il PDF resta nel suo browser e non fa parte del
  repository, perché è materiale di terzi.

Ogni schermata ha tre aspetti (Minimal, Neon, Dark), selezionabili dalla barra in alto; la scelta viene ricordata.

Il progetto è una riscrittura originale e indipendente. Non contiene, non decompila
e non deriva da codice di software didattici esistenti.

## Avvio

I moduli ES non si caricano da `file://`. Serve un server statico:

    python3 -m http.server 8000     # poi apri http://localhost:8000

Su Windows il comando spesso è `python` senza il 3:

    python -m http.server 8000

Se non hai Python, va bene qualunque server statico:

    npx serve .

## Scorciatoie

`?` apre l'elenco completo dentro l'applicazione. Le principali:

| tasto | dove | cosa fa |
|---|---|---|
| `Invio` | Derivazioni, Tavole, Mondi | aggiunge una riga sotto |
| `Ctrl + Invio` | Derivazioni | apre una sottodimostrazione |
| `Tab` / `Maiusc + Tab` | Derivazioni | fa rientrare o uscire la riga |
| `Backspace` su riga vuota | ovunque | elimina la riga |
| frecce | Mondi | spostano il blocco selezionato |
| `Backspace` o `Canc` | Mondi | elimina il blocco selezionato |
| `1` `2` `3` / `t` `c` `d` | Mondi | dimensione / forma del blocco |
| `a`–`f` | Mondi | assegna o toglie il nome |
| `Alt + 1 / 2 / 3` | ovunque | passa da uno strumento all'altro |

I tasti singoli valgono solo fuori dai campi di testo: dentro una formula,
`c` scrive una c.

## Test

Un comando solo esegue tutto, bundle compreso:

    node test/tutto.mjs

Le singole suite, nessuna delle quali avvia un browser vero:

| comando | cosa verifica |
|---|---|
| `node test/run.mjs` | nucleo (parser, semantica, regole), importazione dei file del corso, **esempi di riferimento** con esito noto, robustezza su input storti, conformità architetturale |
| `node test/smoke.test.mjs` | il bundle consegnato si avvia e le funzioni principali rispondono |
| `node test/scenari.test.mjs` | percorsi d'uso completi: si costruiscono tavole, mondi e prove usando solo clic e tastiera, e si controlla il risultato |
| `node test/stress.test.mjs` | pestaggio casuale dell'interfaccia, raffiche su rientra/sporgi e sui menu, prove lunghe, stato salvato corrotto |

Stress e scenari sono deterministici: `VERUM_SEED=101 node test/stress.test.mjs`
ripete esattamente la stessa sequenza di azioni, e `VERUM_ROUNDS` ne cambia la
durata. Smoke, scenari e stress richiedono `node build.mjs` prima.

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

## Autore

Liam Michael Boland — <liammichael.boland@studenti.unimi.it>
Università degli Studi di Milano, progetto di tesi.

## Licenza

Tutti i diritti riservati. Vedi `LICENSE`: la consultazione e l'esecuzione a
scopo di valutazione accademica sono consentite, ogni altro uso richiede una
licenza scritta. `PROPRIETA.md` descrive come è documentata la paternità del
progetto.

I materiali del corso (i programmi originali, il PDF delle regole, i file di
enunciati `.sen`) non fanno parte di questo repository: sono opera di terzi e
vanno caricati nell'applicazione dalla propria copia personale.
