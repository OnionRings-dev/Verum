<!--
SPDX-FileCopyrightText: 2026 Liam Michael Boland
SPDX-License-Identifier: LicenseRef-Verum-Proprietary
-->
# Come dimostrare che Verum è tuo

> Non sono un avvocato: questa è una guida tecnica, non consulenza legale.
> Per una controversia reale serve un legale.

## Il punto di partenza

In Italia il diritto d'autore nasce da solo, nel momento in cui scrivi il
codice: non serve registrare niente. Il problema in caso di copia non è *avere*
il diritto, è **provare due cose**: che il codice esisteva in una certa data e
che l'hai scritto tu. Tutto quello che segue serve a costruire prove di questo
tipo, in ordine di forza crescente.

Una distinzione importante: il footer, le intestazioni `SPDX` nei file, il
`<meta name="author">` e il banner nel bundle **non sono prove**. Chi copia li
cancella in due minuti. Servono come avviso ("questo ha un proprietario") e ti
aiutano solo se chi copia è sbadato. Le prove vere sono i passi 2–5.

---

## 0. Due condizioni senza le quali il resto non regge

**Il nome dev'essere il tuo nome anagrafico.** Footer, `LICENSE`, `AUTHORS`,
email dei commit: tutto deve riportare la stessa identità, quella che compare
sul tuo documento e sul libretto universitario. Un avviso di copyright intestato
a un nome che non si può ricondurre a te non prova nulla.

**Il codice scritto da un'IA è il punto debole.** Buona parte di questa prima
versione è stata generata con un assistente IA. In Italia e nell'UE il diritto
d'autore protegge la creazione intellettuale *umana*: le parti prodotte da una
macchina senza un tuo contributo creativo sono le più difficili da rivendicare,
e chi ti copia potrebbe sostenerlo. Due conseguenze pratiche:

- la protezione cresce man mano che il progetto diventa tuo davvero: le scelte
  di progetto, le regole che aggiungi, le modifiche, le estensioni, i test che
  scrivi. La storia dei commit (passo 1) è ciò che documenta questo lavoro;
- il regolamento del tuo ateneo quasi certamente richiede di **dichiarare
  l'uso di strumenti di IA** nella tesi. Fallo per esteso e fallo prima che
  qualcuno lo scopra da solo: un'omissione qui è molto più grave di qualunque
  copia.

## Controllo da fare subito: file di terzi nel repository

Hai già fatto push. Verifica che non ci siano finiti i programmi LPL:

```powershell
git log --all --name-only --format="" | Select-String -Pattern "\.(jar|exe|dll|prf|sen|wld)$|LPL Software"
```

Se il comando stampa qualcosa, quei file sono nella storia pubblica anche se li
hai cancellati dopo: rendi subito il repository privato e chiedi aiuto prima di
fare altro, perché ripulire la storia (`git filter-repo`) va fatto una volta
sola e bene. Il nuovo `.gitignore` impedisce che succeda in futuro.

---

## 1. Non riscrivere la storia già pubblicata

Hai già fatto push della prima versione: quella è la tua prima traccia datata.
Da adesso in poi:

- niente `git push --force` sui branch pubblicati;
- niente `rebase` o `commit --amend` su commit già inviati.

La storia dei commit è il diario del lavoro: centinaia di commit piccoli che
mostrano il progetto crescere sono molto più convincenti di un unico dump
finale. Chi copia ha il risultato, non il percorso.

Attenzione: le date dei commit si possono falsificare in locale. Per questo
servono anche i passi successivi, che producono date indipendenti da te.

## 2. Firma i commit (badge "Verified" su GitHub)

Una firma lega ogni commit a una chiave che possiedi solo tu. Con Git per
Windows, da PowerShell:

```powershell
# 1. crea una chiave (se non ne hai già una), usa l'email del tuo account GitHub
ssh-keygen -t ed25519 -C "liammichael.boland@studenti.unimi.it"

# 2. di' a Git di firmare con quella chiave
git config --global gpg.format ssh
git config --global user.signingkey "$HOME/.ssh/id_ed25519.pub"
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# 3. copia la chiave pubblica negli appunti
Get-Content "$HOME/.ssh/id_ed25519.pub" | Set-Clipboard
```

Poi su GitHub: **Settings → SSH and GPG keys → New SSH key**, e come
**Key type** scegli **Signing Key** (non Authentication). Incolla, salva.

Dal commit successivo GitHub mostrerà **Verified**. I commit già pubblicati
restano non firmati: va bene così, non riscriverli.

Controlla che `git config user.email` sia un'email verificata sul tuo account,
altrimenti il badge non compare.

**La chiave privata (`id_ed25519`, senza `.pub`) è la tua prova.** Non
condividerla, non caricarla da nessuna parte, fanne un backup cifrato. Il
`.gitignore` impedisce di committarla per sbaglio, ma la cosa più sicura è che
non stia mai dentro la cartella del progetto.

## 3. Un tag firmato per ogni versione

```powershell
git tag -s v0.2.0 -m "Verum 0.2.0: temi, tavolo in rilievo, footer"
git push origin v0.2.0
```

Un tag firmato è una fotografia autenticata del progetto in quel momento.
Fallo a ogni tappa: prima di mostrarlo al relatore, prima della consegna.

## 4. Marca temporale indipendente (OpenTimestamps, gratuito)

Questa è la prova che non dipende né da te né da GitHub: registra l'impronta
del tuo codice su una blockchain pubblica, così nessuno può sostenere che l'hai
retrodatata.

```powershell
pip install opentimestamps-client

# archivio esatto della versione taggata
git archive --format=tar -o verum-v0.2.0.tar v0.2.0

# impronta, da conservare insieme all'archivio
Get-FileHash .\verum-v0.2.0.tar -Algorithm SHA256

# marca temporale: crea verum-v0.2.0.tar.ots
ots stamp .\verum-v0.2.0.tar

# dopo qualche ora la prova diventa completa
ots upgrade .\verum-v0.2.0.tar.ots
ots verify  .\verum-v0.2.0.tar.ots
```

Conserva **insieme** `verum-v0.2.0.tar` e `verum-v0.2.0.tar.ots`: la prova
vale solo con l'archivio originale, identico al byte. Tienili fuori dal
repository (il `.gitignore` esclude i `.tar`) e in almeno due posti diversi.

## 5. Archivio pubblico di terza parte (Software Heritage)

Software Heritage è l'archivio universale del codice sorgente, gestito
dall'INRIA con l'UNESCO. Su <https://archive.softwareheritage.org/save/>
incolli l'URL del repository GitHub (deve essere pubblico) e lui ne archivia
una copia datata, che resta anche se cancelli il repo. Ripeti a ogni tag
importante.

## 6. Prove che arrivano da sole

- **Il deposito della tesi** in ateneo ha una data certa e il tuo nome sopra.
  Includi nella tesi l'URL del repository e l'hash del tag consegnato.
- **Le email al relatore** con allegati o link alle versioni.
- **Registro SIAE dei programmi per elaboratore** (facoltativo, a pagamento):
  deposito ufficiale del codice con data. Di solito ha senso solo se il
  progetto viene adottato o commercializzato.

## 7. Pubblico o privato?

Un repository pubblico è più esposto alla copia, ma è anche prova pubblica e
datata. Uno privato riduce il rischio e puoi comunque aggiungere il relatore
come collaboratore. Per una tesi ancora in corso, **privato fino alla
discussione** è la scelta prudente. Nota che Software Heritage (passo 5)
funziona solo su repository pubblici; OpenTimestamps (passo 4) funziona in
entrambi i casi.

Verifica anche il regolamento del tuo ateneo sulla proprietà intellettuale
delle tesi: di norma resta allo studente, ma alcuni atenei prevedono clausole
per il software sviluppato con risorse del dipartimento.

## 8. Se trovi una copia

1. Salva subito le prove: URL, screenshot con data, e se è su GitHub fai tu
   stesso un fork o un download (può essere cancellata).
2. Confronta: le parti identiche, i nomi di funzione, gli errori di battitura
   condivisi, i commenti. Le coincidenze inutili sono la prova più forte di una
   copia.
3. Metti accanto il tuo primo commit firmato, il tag e la marca temporale.
4. Se la copia è su GitHub, esiste una procedura di segnalazione per violazione
   del diritto d'autore (DMCA takedown) nelle pagine di supporto di GitHub.

---

## Riepilogo da fare adesso

- [x] Nome anagrafico in footer, `LICENSE`, `AUTHORS` (passo 0)
- [ ] `git config user.name` e `git config user.email` impostati con gli stessi dati
- [ ] Nessun file LPL nella storia del repository (controllo sopra)
- [ ] Uso dell'IA dichiarato al relatore
- [ ] Firma dei commit attiva (passo 2) e badge Verified visibile
- [ ] Tag firmato `v0.2.0` pubblicato (passo 3)
- [ ] `.tar` + `.ots` salvati in due posti (passo 4)
- [x] Email di contatto inserita in `LICENSE` e in `AUTHORS`
- [ ] Decisione pubblico/privato presa (passo 7)
