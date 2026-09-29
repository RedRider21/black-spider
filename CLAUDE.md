# Black Spider — da dove si riprende

> Questo file lo legge da solo una sessione di Claude Code aperta in questa cartella.
> Serve a farle sapere cosa c'è, cosa è già stato verificato e da dove si continua, senza
> che debba ricostruirlo leggendo il codice. **Tienilo aggiornato**: quando cambia lo stato
> del progetto, cambia qui. Un documento di ripresa vecchio è peggio di nessun documento,
> perché manda a cercare cose che non ci sono più.
>
> Ultimo aggiornamento: **29 settembre 2026**.

---

## 1. Cos'è, in due righe

Una **rete peer-to-peer tra browser**: nessun server, nessun account, nessun operatore che
custodisce i dati. Ogni browser tiene il proprio database in IndexedDB, i peer si connettono
direttamente via WebRTC e si scambiano gli eventi di un **log firmato** — ogni evento porta
la firma di chi l'ha scritto ed è legato al precedente, quindi si può verificare invece che
credere sulla parola.

Idea dell'utente, nata da un dialogo su come coordinare gli IndexedDB di più browser senza
metterci in mezzo un server.

## 2. Le regole di casa

Queste vengono prima di qualunque preferenza tecnica. Sono richieste esplicite dell'utente
o conseguenze di dove lavora.

| Regola | Perché |
|---|---|
| **Si risponde in italiano**, sempre | la lingua di lavoro dell'utente |
| **Accenti corretti** nei testi visibili (è, à, ù, ò, é, ì) | una pagina con «e» al posto di «è» sembra scritta male |
| **Interfaccia piatta**: niente ombre, niente gradienti, una sola famiglia di caratteri | scelta di stile dichiarata, non un'omissione |
| **Niente menzioni di Claude** nei contenuti pubblici: né firme nei commit, né trailer, né «generato con» | decisione presa per NovaOS e valida per tutti i progetti dell'utente |
| **I server di prova si legano a `127.0.0.1`**, mai a `0.0.0.0` | l'utente lavora in un ufficio su una **rete locale monitorata dalla cyber security**. Un servizio in ascolto su tutta la rete è una porta aperta su una rete che non è sua. Se una prova ha davvero bisogno di un altro dispositivo, si apre la porta solo allora e lo si dice |
| **STUN spento per difetto** nell'app (la casella non è preselezionata) | senza la casella, creare un invito non contatta nessuno. Acceso solo se l'utente lo chiede |
| **README sempre aggiornati** | |
| **Non si dichiara verificato quello che non è stato eseguito** | vedi §6 |

## 3. Dove sta cosa

```
black spider/
├── README.md            la porta d'ingresso, per una persona
├── CLAUDE.md            questo file
├── ARCHITETTURA.md      il documento di progetto — 929 righe, 17 sezioni + 2 appendici.
│                        È la fonte della verità sul *perché*.
├── ARCHITETTURA.html    la stessa cosa in versione da leggere
├── presentazione.html   pagina di presentazione autonoma (nessun file esterno), IT/EN
├── prove.sh             esegue tutte le prove e dice l'esito
├── Black Spider.pdf     6 pagine, versione stampabile
├── app/                 l'applicazione
│   ├── index.html       il guscio: testata, menu, cinque sezioni
│   ├── stile.css        l'aspetto; tema chiaro e scuro dalla stessa dichiarazione
│   ├── sw.js            il service worker (offline)
│   ├── manifest.webmanifest
│   ├── icone/           il marchio; `genera.py` le ridisegna da zero in ~35 s
│   ├── js/              i moduli (vedi §4)
│   └── prove/           le prove + `server.py`, il banco
├── spikes/              le quattro prove di fattibilità fatte *prima* del codice
│                        (prova 1: l'invito, 2: la LAN, 3: la scheda in background, 4: il NAT)
└── riferimenti/         le fonti — 22 documenti, in copia HTML e in testo
```

## 4. L'applicazione, modulo per modulo

Tutti i moduli sono ES nativi, senza build. Nessuna dipendenza esterna, nessuna libreria.

| modulo | cosa fa |
|---|---|
| `js/identita.js` | chiavi Ed25519 via WebCrypto; `spiderId = 'sp_' + base32(sha256(spki))` |
| `js/eventi.js` | il log: orologio HLC `[ms_fisici, contatore, autore]`, id indirizzati dal contenuto (`b3:`), JSON canonico, firma e verifica, catena |
| `js/archivio.js` | IndexedDB: dove vivono gli eventi |
| `js/invito.js` | i due codici da scambiarsi fuori banda, e le statistiche del percorso |
| `js/trasporto.js` | il canale dati, spezzato quando i messaggi sono lunghi |
| `js/sincronizzazione.js` | lo scambio: chi manda cosa e la **verifica di ciò che arriva** |
| `js/lingua.js` | i dizionari it/en, `t()`, `data-i18n` |
| `js/preferenze.js` | tema, lingua e larghezza della barra, in `localStorage` |
| `js/app.js` | lega tutto: sezioni, temi, lingue, rendering delle schermate |

**Il guscio, in breve.** Cinque sezioni — chat, persone, archivio, app, impostazioni — in un
menu laterale verticale con icona e scritta, comprimibile a sole icone e, sotto 860 px,
cassetto da sinistra con velo. Tema chiaro/scuro in tre scelte (auto, chiaro, scuro) e lingua
it/en, entrambi a caldo. Tutte le sezioni sono **proiezioni dello stesso log**: non sono tre
copie di un dato, sono tre modi di guardarne uno.

**Le app previste** — questo elenco deve restare identico in tre posti: `app/js/app.js`
(`MODULI`), i dizionari in `js/lingua.js` e la tabella in `ARCHITETTURA.md` §13.3. Se
divergono, uno dei tre mente.

| app | stato |
|---|---|
| Chat | **c'è.** Con tre o più persone è un gruppo: la sincronizzazione è già simmetrica |
| File | progettata |
| Chiamate (voce e video) | progettata — vedi §7 |
| Bacheca | progettata |
| Blocchi | progettata |

## 5. Come si esegue

```sh
# tutte le prove, con verdetto finale
./prove.sh

# una sola
./prove.sh avvio
./prove.sh collegamento
./prove.sh m0

# senza uccidere il server alla fine (per guardarci dentro)
./prove.sh tutte --tieni
```

`prove.sh` fa tutto: avvia `app/prove/server.py` su `127.0.0.1:8765`, apre le pagine di prova
in Chrome headless con profili separati, aspetta che depositino l'esito e stampa il verdetto.
Variabili utili: `CHROME=chromium`, `PORTA=9000`, `HEADLESS=--headless` (per browser vecchi
che non conoscono `--headless=new`).

**Le prove vanno eseguite in tempo reale**, una per una, con una pagina che deposita il
risultato quando ha finito. `--virtual-time-budget` di Chrome headless **non** funziona:
IndexedDB e ICE vivono su altri thread e la pagina viene chiusa prima che il lavoro finisca.
Questo è già stato pagato una volta; non ripagarlo.

Per **guardare** invece che provare:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
#   http://127.0.0.1:8766/presentazione.html
#   http://127.0.0.1:8766/app/
#   http://127.0.0.1:8766/app/prove/stile.html?tema=chiaro   (il campione di stile)
```

### Le quattro prove, una per una

| prova | cosa verifica | come |
|---|---|---|
| `m0.html` | firme, catene, orologi, persistenza — **senza rete** | da sola |
| `avvio.html` | che l'applicazione si accenda: identità, archivio, service worker, menu, temi, lingue, manifesto, icone | da sola |
| `collegamento.html` | **il collegamento vero fra due browser**: invito, risposta, canale, messaggi, sopravvivenza al ricaricamento | in due esemplari, `?ruolo=A` e `?ruolo=B`, profili diversi |
| `stile.html` | un campione del foglio di stile con tutti i pezzi in vista | da guardare, non da eseguire |

`prove/server.py` serve `app/` **e** fa da messaggero per i due ruoli, con `/api/<chiave>`
GET/POST e `/api/azzera`. Il server è **solo il messaggero**: l'app non ne ha bisogno per
funzionare, e le prove spengono lo STUN di proposito, così non esce niente dalla macchina.

Le prove **non cercano frasi italiane** nel registro: aspettano i segni che l'app lascia su
`body` (`data-pronto`, `data-eventi`, `data-sw`, `data-avvio-fallito`). Le frasi cambiano con
la lingua, e una prova che si rompe traducendo l'app non segnala un guasto — segnala sé stessa.

## 6. Stato al 29 settembre 2026

**Verificato eseguendo, non leggendo** (esiti di `./prove.sh`):

| | esito |
|---|---|
| `m0` — le fondamenta | **tutto ok** (26 controlli) |
| `avvio` — l'applicazione si accende | **50 / 50** |
| `collegamento` — due browser veri | **21 / 21** (7 nel ruolo A + 14 nel ruolo B) |

Il collegamento è stato misurato fra **due processi Chrome distinti, profili distinti,
identità distinte**: invito → risposta → canale aperto in circa un secondo, **in diretto
(`host`), 2 ms di andata e ritorno**. Poi un messaggio da A a B, la risposta, e la ricarica di
B: i due messaggi erano ancora lì e nessun evento era duplicato.

**Costruito e funzionante**: la chat fra due browser, installabile come PWA, apribile senza
rete; il guscio con le cinque sezioni; tema chiaro/scuro; italiano e inglese.

**Progettato ma non costruito**: gruppi, file, chiamate, bacheca, blocchi.

**Non fatto, e va detto**: le prove 1-4 di `spikes/` (invito fra browser su reti diverse, LAN
senza internet, scheda in background per ore, quanti NAT richiedono un relay). Il banco è
pronto e verificato, le quattro domande no. `ARCHITETTURA.md` §7, §11 e §14 **non sono
definitive** finché non sono state misurate.

## 7. La videocall, e perché la risposta è articolata

L'utente l'ha chiesta esplicitamente. La posizione onesta, che sta anche in `app/README.md` e
in `ARCHITETTURA.md` §12:

- **in due** è quasi banale una volta che il canale dati esiste: è la stessa
  `RTCPeerConnection`, il flusso si aggiunge con `addTrack`;
- **in tre o quattro** si può, disponendosi a maglia, ma ogni partecipante manda il proprio
  video a tutti gli altri: con quattro sono ~1,5 Mbps di uscita a testa. Regge su fibra, non
  su molte connessioni mobili;
- **oltre 10-12** la maglia è problematica anche per soli dati;
- **oltre**, servirebbe un SFU — che è un server. L'unica via coerente resta un **peer che fa
  da ponte**, scelto esplicitamente, non deciso dal codice;
- quando la banda non basta, la stanza deve proporre «audio + schermo» invece di degradare in
  silenzio.

## 8. Da dove si riprende

In ordine di sensatezza, non di difficoltà:

1. **Il gruppo** — tre o più persone nella stessa stanza. La sincronizzazione è già
   simmetrica, quindi non è un altro protocollo: è la chat con più di due. Va **provato**, non
   dichiarato. Da qui passa la differenza fra «una demo» e «una cosa che si usa».
2. **Le chiavi si imparano solo dai peer connessi.** Se arriva un evento di un autore
   sconosciuto, resta in coda in `sincronizzazione.js` (`inAttesa`) invece di essere creduto.
   Funziona, ma il gossip dovrà chiedere le chiavi mancanti a chi le ha.
3. **La cifratura dei contenuti.** Le firme dicono *chi* ha scritto, non *nascondono cosa*.
   In transito il canale è già cifrato, ma gli eventi restano in chiaro nell'archivio, e chi
   esporta il proprio archivio esporta tutto.
4. **Le quattro prove di `spikes/`.** Costano poco e decidono il progetto: la 1 e la 3 in
   particolare (l'invito regge su Firefox? la scheda in background tiene?).
5. Poi: file, chiamate, bacheca, blocchi.

## 9. Le trappole già pagate

Non ripagarle.

- **`--virtual-time-budget` non funziona** con IndexedDB, ICE e i service worker: vivono su
  altri thread. Le prove vanno eseguite in tempo reale, con la pagina che deposita l'esito.
- **`pkill -f "<stringa>"` uccide la propria shell** quando la stringa compare nella riga di
  comando del comando stesso — e ci compare sempre. Si evita con una classe di caratteri
  (`pkill -f "bsapp/p[AB]"`) o uccidendo per PID, come fa `prove.sh`.
- **Chrome headless preferisce il tema chiaro**: gli screenshot escono chiari anche se il
  sistema è scuro. Per vedere il tema scuro si forza `data-tema="scuro"` o `?tema=scuro`.
- **La memoria di Claude Code è legata al percorso del progetto** e non viaggia con la
  cartella: su un altro computer, con un altro percorso, quella memoria non si carica. Per
  questo tutto quello che serve sapere sta **qui dentro il progetto**, non là fuori.
- **Rifare i pulsanti di un comando a ogni cambio li stacca dal documento.** I segmenti di
  tema e lingua ricostruivano il proprio `innerHTML` a ogni clic: chi usava la tastiera
  perdeva il fuoco, e le prove — che avevano già in mano i nodi — cliccavano nel vuoto. Ora
  `disegnaSegmento()` aggiorna le etichette sui nodi esistenti e ricostruisce solo se cambiano
  le voci. La prova controlla `isConnected`.
- **`overflow: hidden` su `body`** rende illeggibile qualunque pagina che usi il foglio di
  stile senza essere il guscio (era il caso di `m0.html`). Lo blocca `.app`, non il documento.

## 10. Le scelte che non si vedono nel codice

- **`light-dark(chiaro, scuro)` con `color-scheme`**, invece di due blocchi di variabili: il
  tema chiaro non è un secondo foglio da tenere allineato, è la stessa riga letta dall'altro
  lato. Prima di ogni `light-dark()` c'è il valore scuro scritto per esteso, per i browser che
  non conoscono la funzione.
- **Le preferenze in `localStorage`, i dati in IndexedDB.** Tema e lingua sono scelte di
  *questo dispositivo* e vanno lette in modo sincrono prima del primo disegno, altrimenti si
  vede il lampo del tema sbagliato. Identità e archivio sono dati dell'utente e stanno dove
  vanno i dati.
- **Un nome, un posto solo.** Il nome vive nella scheda dell'identità. Era anche in
  `sessione.nome`, e per questo non arrivava mai né all'invito né all'altro peer: un nome
  scritto in due posti è un nome sbagliato in uno dei due.
- **La chiave privata non è estraibile.** Si genera estraibile, si esportano le due parti e si
  **reimporta la privata come non estraibile**; la copia esportata viene azzerata subito dopo.
  Da lì in poi la chiave firma ma non si può leggere — un difetto nella pagina non basta a
  portarla via. Serve perché WebCrypto non sa generare le due con `extractable` diverso.
- **Il testo tradotto non sta nell'HTML**, sta in `js/lingua.js` e la pagina lo dichiara con
  `data-i18n`. Una scritta nuova in pagina e non nel dizionario resta in italiano anche in
  inglese: si vede subito.

## 11. Sulla storia di git

Il progetto è stato scritto **prima** che esistesse un repository. Il primo commit raccoglie
quindi uno stato già completo, diviso per **aree** (la ricerca, le fondamenta, il guscio, le
prove, i documenti) e non per cronologia: l'ordine dei commit racconta come è fatto il
progetto, non l'ordine in cui è stato scritto. Da quel commit in poi la storia è reale.
