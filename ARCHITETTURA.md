<!--
SPDX-FileCopyrightText: 2026 Liam Michael Boland
SPDX-License-Identifier: LicenseRef-Verum-Proprietary
-->
# Architettura

Questo documento spiega come è organizzato Verum e perché. È scritto pensando
a chi legge la tesi, non a chi ha già il codice davanti.

> **Nota sulla fonte.** L'impianto segue i principi di *Advanced Web Application
> Architecture* di Matthias Noback. Il libro usa PHP e parla soprattutto di
> applicazioni con backend; qui è applicato a un'applicazione che gira
> interamente nel browser. Dove l'adattamento cambia le carte in tavola l'ho
> segnalato esplicitamente nella sezione "Cosa non ho applicato, e perché".
> Prima di citare il libro in tesi, verifica le formulazioni sulla tua copia:
> quelle qui sotto sono riformulazioni, non citazioni.

---

## 1. L'idea centrale

La tesi del libro, ridotta all'osso: il codice che risolve il problema del
dominio deve poter essere eseguito senza nulla intorno. Niente database, niente
richieste HTTP, niente filesystem, niente framework, niente orologio, niente
caso. Tutto ciò che tocca il mondo esterno sta fuori e viene collegato dal
bordo.

Per Verum questa distinzione è netta e felice, perché il dominio è vera
matematica:

- **Nucleo** — che cos'è una formula ben formata, quando un enunciato è vero in
  un mondo, quando una riga di una derivazione è giustificata.
- **Infrastruttura** — come si disegna una tavola di verità in HTML, dove si
  salva il lavoro dell'utente, come si trascina un blocco su una casella.

La prima parte è stabile e verificabile. La seconda cambia ogni volta che cambi
idea sul design.

## 2. Gli strati

    ┌─ infrastructure ──────────────────────────────┐
    │  DOM, localStorage, orologio, disegno SVG     │
    │      ↓ implementa le porte, chiama i casi d'uso│
    ├─ application ─────────────────────────────────┤
    │  casi d'uso + porte (interfacce)              │
    │      ↓ usa il dominio                          │
    ├─ domain ──────────────────────────────────────┤
    │  linguaggio, tavole, mondi, prove, regole     │
    └───────────────────────────────────────────────┘

Le frecce vanno in una direzione sola. Il dominio non sa che esiste un browser;
l'applicazione non sa che esiste `localStorage`.

### `src/domain/`

| File | Responsabilità |
|---|---|
| `language/Lexer.js` | stringa → token |
| `language/Parser.js` | token → formula (discesa ricorsiva) |
| `language/Formula.js` | value object immutabile, α-equivalenza, sostituzione |
| `language/Printer.js` | formula → stringa con parentesi minime |
| `truth/TruthTable.js` | semantica veritativo-funzionale, conseguenza tautologica |
| `world/Block.js` | entità blocco, invarianti su forma/dimensione/posizione |
| `world/World.js` | l'interpretazione: dominio, riferimento, estensioni |
| `proof/Proof.js` | aggregato derivazione, numerazione, accessibilità |
| `proof/rules.js` | registro delle regole di inferenza |
| `proof/ProofChecker.js` | servizio di dominio: risolve citazioni e delega |

### `src/application/`

Un caso d'uso per azione dell'utente: `BuildTruthTable`, `EvaluateInWorld`,
`CheckProof`. Ricevono dati grezzi (stringhe, stato di editing), restituiscono
DTO piatti e serializzabili. Non lanciano eccezioni per errori attesi: un errore
di sintassi è un risultato possibile, non un guasto.

`ports.js` dichiara le interfacce che l'applicazione *possiede*:
`WorkspaceRepository`, `Clock`, `ExerciseImporter`. In JavaScript non ci sono
interfacce, quindi sono classi base che falliscono rumorosamente se un metodo
non viene implementato: sono documentazione eseguibile, non type checking.

### `src/infrastructure/`

Gli adattatori. `LocalStorageWorkspaceRepository` e
`InMemoryWorkspaceRepository` soddisfano la stessa porta; il secondo esiste per
i test e come rete di sicurezza quando il browser è in navigazione privata. Le
tre viste web traducono DTO in nodi DOM e basta.

### Temi

I tre aspetti (Minimal, Neon, Dark) sono interamente infrastruttura: un insieme
di token CSS per tema e l'adattatore `ThemeSwitcher`, che salva la scelta
attraverso la porta `WorkspaceRepository`. Anche il materiale dei solidi nel
tavolo dei blocchi legge i token del tema, quindi i pezzi non vanno ridisegnati.
Dominio e casi d'uso non sanno che i temi esistono, e il test architetturale lo
verifica.

### `src/main.js`

Il **composition root**: l'unico file che nomina insieme tutti e tre gli strati.
Nessun'altra classe costruisce le proprie dipendenze, nessuno cerca un servizio
in un registro globale. Cambiare persistenza è una riga.

---

## 3. Le scelte che discendono dai principi

**Dipendenze iniettate, mai cercate.** Le viste ricevono i casi d'uso nel
costruttore. `ProofChecker` riceve il registro delle regole. Non esiste un
container globale né un singleton.

**Value object immutabili.** Una formula si crea solo tramite i costruttori di
`Formula.js` e i nodi sono congelati. Un `Block` valida forma, dimensione e
posizione nel costruttore: non esiste un blocco in stato illegale. `World`
rifiuta di esistere se due blocchi portano la stessa costante. Allo stesso modo rifiuta i blocchi in conflitto: un blocco grande occupa anche le otto caselle intorno, quindi nessun altro blocco può stargli accanto, nemmeno in diagonale. La regola è stata verificata sui 39 mondi distribuiti con il software originale (nessuna eccezione su 84 coppie di blocchi vicini) e vive nel dominio, non nell'interfaccia: vale per l'editor, per un mondo importato e per i test. L'interfaccia si limita a chiedere al dominio `World.placementConflict()` prima di aggiungere, spostare o ingrandire un blocco.

**Niente modello anemico.** `World.satisfies()` sta su `World`, non in un
`WorldService` che fruga nei campi altrui. `Proof.index()` e
`Proof.isAccessible()` sono regole della derivazione, non della UI: se domani
aggiungi un editor da tastiera, la nozione di "riga accessibile" non si
duplica.

**Il registro delle regole è aperto all'estensione.** Ogni regola di inferenza è
un oggetto con il proprio `check`. Aggiungere `Ana Con`, `FO Con` o un sistema
alla Hilbert significa aggiungere una voce, non modificare uno `switch` lungo
duecento righe. Questo è il punto in cui l'architettura si ripaga: il tuo
relatore quasi certamente vorrà un set di regole diverso da quello del libro di
testo.

**Il nucleo non conosce il tempo né il caso.** Nessun `new Date()`, nessun
`Math.random()` sotto `domain/` e `application/`. Se serviranno (timestamp di
consegna, generazione di mondi casuali per gli esercizi) passeranno dalle porte
`Clock` e da un futuro `RandomSource`. È la condizione perché i test siano
deterministici.

**L'architettura è verificata, non solo dichiarata.**
`test/architecture.test.mjs` legge i sorgenti, ricostruisce il grafo degli
import e fallisce se qualcuno importa infrastruttura dentro il dominio. Cerca
anche i simboli proibiti nel nucleo (`document`, `localStorage`, `fetch`,
`new Date(`, `Math.random(`). Al momento sono 196 asserzioni automatiche: una
regola che nessuno controlla viene violata al primo commit di fretta.

---

## 4. Cosa non ho applicato, e perché

Applicare un libro alla lettera quando il contesto è diverso produce
architettura cargo-cult. Queste sono le omissioni deliberate; se le difendi in
tesi, difendile così.

**Non c'è un layer di persistenza vero.** Il libro dedica molto spazio a
separare le entità dal loro salvataggio, e ha ragione: è lì che la maggior parte
dei progetti si incastra. Verum però non ha ancora un database. Ho comunque
definito la porta `WorkspaceRepository` con due adattatori, perché il giorno in
cui serviranno account studente e consegne quel confine è già disegnato. Ma è
onesto dire che oggi paga poco.

**Non c'è un service bus, né command/query handler separati.** Con tre casi
d'uso sarebbe cerimonia pura. Il libro stesso insiste che l'architettura si paga
quando il costo del cambiamento è alto.

**Non c'è una distinzione read model / write model.** Le letture qui sono
calcoli, non query: ricalcolare una tavola di verità costa microsecondi.

**Il dominio non lancia eccezioni per gli errori dell'utente.** Il libro tende a
usare eccezioni di dominio per gli stati invalidi. Qui una formula malformata
non è un guasto: è l'input tipico di uno studente che sta imparando. È un valore
di ritorno (`tryParse`), perché deve arrivare all'interfaccia come messaggio
didattico, non come stack trace.

**I test degli adattatori sono solo di fumo.** `test/smoke.test.mjs` avvia il
bundle distribuito in jsdom e verifica che schermate, temi e footer siano
collegati e che l'avvio non produca errori. Non verifica l'aspetto grafico né
le interazioni fini (trascinamento, focus): per quello servirebbe un browser
vero con Playwright. Resta la lacuna più seria del progetto ed è onesto
scriverla nella sezione "sviluppi futuri".

---

## 5. Dove crescerà

Il punto dell'architettura è rendere queste cose aggiunte, non riscritture.

- **Importazione dei file di esercizio.** I formati `.sen`, `.wld` e `.prf` dei
  software esistenti sono testo semplice e si leggono senza decompilare nulla.
  Un adattatore che implementa `ExerciseImporter` li traduce in `World` e
  `Proof`; il dominio non cambia di una riga. È la funzione che rende il
  progetto adottabile davvero, perché i materiali del corso sopravvivono.
- **Il gioco di Henkin** (la partita semantica che spiega perché un enunciato
  quantificato è falso) è un servizio di dominio nuovo sopra `World`, non una
  modifica a `World`.
- **Backend e consegne.** Sostituire `LocalStorageWorkspaceRepository` con un
  adattatore HTTP e aggiungere un caso d'uso `SubmitExercise`. Il composition
  root è l'unico file che cambia.
- **Regole aggiuntive.** Una voce nel registro, un test, fine.
