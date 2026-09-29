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
| **Licenza AGPL-3.0-or-later**, con `SPDX-License-Identifier` e copyright in testa a ogni file di programma | scelta dell'utente; per un progetto senza server è la licenza che chiude la scappatoia di chi ne ospita una copia modificata |
| **Non si dichiara verificato quello che non è stato eseguito** | vedi §6 |

## 3. Dove sta cosa

```
black-spider/
├── index.html           la pagina d'ingresso del sito: porta dentro l'applicazione
├── README.md            la porta d'ingresso, per una persona
├── CLAUDE.md            questo file
├── LICENSE              AGPL-3.0, il testo completo
├── .nojekyll            dice a Pages di servire i file come sono
├── ARCHITETTURA.md      il documento di progetto — 929 righe, 17 sezioni + 2 appendici.
│                        È la fonte della verità sul *perché*. **Si modifica solo
│                        il .md, poi si rigenera l'HTML** (comando qui sotto)
├── presentazione.html   pagina di presentazione autonoma (nessun file esterno), IT/EN
├── prove.sh             esegue tutte le prove e dice l'esito
├── Black Spider.pdf     versione stampabile, ricavata da `presentazione.html`
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
| `js/chiamate.js` | la chiamata: traccia audio, video come aggiunta, negoziazione, conto dei byte |
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
| Chiamate (voce e video) | **c'è, dentro l'app.** Solo voce fra due per difetto; la telecamera si accende e si spegne a chiamata avviata. Provata: §7 |
| File | progettata |
| Bacheca | progettata |
| Blocchi | progettata |

## 5. Come si esegue

```sh
# tutte le prove, con verdetto finale
./prove.sh

# una sola
./prove.sh avvio
./prove.sh collegamento
./prove.sh chiamata
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

Per **rigenerare `ARCHITETTURA.html`** dal `.md` — l'unico modo, perché non diverga in
silenzio (è già successo una volta: il `.md` aveva un paragrafo che l'HTML non aveva):

```sh
pandoc ARCHITETTURA.md -s --toc --toc-depth=4 -V lang=it \
  --css riferimenti/stile.css --metadata title="Black Spider — Architettura" \
  --include-before-body=nav-root.html -o ARCHITETTURA.html
```

I flag non sono decorativi: senza `-V lang=it` la pagina dichiara `lang=""`, senza `--css`
perde il foglio di stile, e senza `--metadata title` perde il titolo e l'intestazione.

Per **guardare** invece che provare:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
#   http://127.0.0.1:8766/presentazione.html
#   http://127.0.0.1:8766/app/
#   http://127.0.0.1:8766/app/prove/stile.html?tema=chiaro   (il campione di stile)
```

E per guardare **la chiamata** mentre si svolge, che è un'altra domanda ancora:

```sh
python3 app/prove/sguardo.py     # fotografie in /tmp/bsapp/sguardo/fotografie
```

`sguardo.py` non è una prova: apre due browser con la porta di debug, parla il protocollo
DevTools sopra un WebSocket scritto a mano (qui non ci sono `websocket`, `playwright` né
`node`, e non si installano), **clicca con il mouse** sulle coordinate dei pulsanti e
fotografa. Serve perché «funziona» e «si vede bene» sono due domande diverse: il primo giro
ha trovato tre cose che 62 asserzioni non vedevano.

### Le quattro prove, una per una

| prova | cosa verifica | come |
|---|---|---|
| `m0.html` | firme, catene, orologi, persistenza — **senza rete** | da sola |
| `avvio.html` | che l'applicazione si accenda: identità, archivio, service worker, menu, temi, lingue, manifesto, icone | da sola |
| `collegamento.html` | **il collegamento vero fra due browser**: invito, risposta, canale, messaggi, sopravvivenza al ricaricamento | in due esemplari, `?ruolo=A` e `?ruolo=B`, profili diversi |
| `chiamata.html` | **la chiamata dentro l'app**: due esemplari dell'app vera che si chiamano cliccando i loro pulsanti — squillo, accetta, muto, telecamera accesa e spenta, riattacca | in due esemplari, con microfono finto (`prove.sh` lo passa da sé) |
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
| `avvio` — l'applicazione si accende | **56 / 56** |
| `collegamento` — due browser veri | **21 / 21** (7 nel ruolo A + 14 nel ruolo B) |
| `chiamata` — chiamata dentro l'app, due browser veri | **62 / 62** (36 + 26) |

Il collegamento è stato misurato fra **due processi Chrome distinti, profili distinti,
identità distinte**: invito → risposta → canale aperto in circa un secondo, **in diretto
(`host`), 2 ms di andata e ritorno**. Poi un messaggio da A a B, la risposta, e la ricarica di
B: i due messaggi erano ancora lì e nessun evento era duplicato.

La chiamata, misurata il 29 settembre 2026 fra due esemplari dell'**app vera** con microfono
finto e **niente STUN**. Non si chiamano funzioni: la prova apre l'app in un riquadro e le
clicca i pulsanti. La voce arriva — **8 763 byte in tre secondi**, ≈23 kbps in Opus, lo stesso
ordine dei 24-40 dichiarati. Accendendo la telecamera ne arrivano **70 977** solo di video
negli stessi tre secondi, e **zero** dopo averla spenta. Nessun video in ingresso a chi non ne
manda. La chiamata passa dalla **stessa connessione** della chat: non ha un secondo signaling.

**E poi guardata**, che è un'altra cosa da misurata. `sguardo.py` (§5) apre due browser veri,
clicca i pulsanti con il mouse e fotografa: il primo giro ha trovato tre cose che 62
asserzioni non vedevano — il video che arriva e non si vede, «Chiama» che resta acceso per
tutta la chiamata, e l'intestazione che va sotto il chip dell'identità sotto i 410 px. Le altre
due sono riparate; **il video in ingresso no**, perché non è un guasto ma una funzione che
manca (§7).

**Costruito e funzionante**: la chat fra due browser; la chiamata dentro l'app (solo voce per
difetto, telecamera accesa e spenta a chiamata avviata, **durata a vista** come su un
telefono); installabile come PWA, apribile senza rete; il guscio con le cinque sezioni; tema
chiaro/scuro; italiano e inglese.

**Progettato ma non costruito**: gruppi, indirizzario, file, bacheca, blocchi; **il video che
si riceve non compare da nessuna parte** (si contano i byte, non si guarda l'immagine).

**Non fatto, e va detto**: le prove 1-4 di `spikes/` (invito fra browser su reti diverse, LAN
senza internet, scheda in background per ore, quanti NAT richiedono un relay). Il banco è
pronto e verificato, le quattro domande no. `ARCHITETTURA.md` §7, §11 e §14 **non sono
definitive** finché non sono state misurate.

## 7. La chiamata, e perché è fatta così

L'utente l'ha chiesta esplicitamente, e ha chiesto anche la **sola voce**. La posizione
onesta, che sta anche in `app/README.md` e in `ARCHITETTURA.md` §12 e §12.1.

**La chiamata è dentro l'app**, non accanto: è la **stessa connessione** che porta i messaggi,
con una traccia audio sopra. Chi è già collegato non rifà l'invito — l'invito è la parte che
si scambia a mano — quindi il segnale della chiamata passa nel canale dati già aperto. Il
pulsante «Chiama» è il primo momento in cui si chiede il microfono: chi apre l'app per leggere
l'archivio non deve vedersi chiedere di ascoltare.

**Solo voce per difetto, il video è l'aggiunta.** Una voce in Opus costa 24-40 kbps, un video
quasi dieci volte tanto — misurato: **8 763 byte in tre secondi** di voce contro **70 977** di
solo video. L'offerta contiene `m=audio` e nient'altro; il pulsante «Video» aggiunge la
traccia con una rinegoziazione, senza rifare l'invito.

**Muto e spento sono due cose diverse.** Muto mette `enabled = false`: la traccia resta, la
riga resta, si ripara all'istante, non si rinegozia niente. Spegnere la telecamera **ferma**
la traccia e la toglie dalla connessione, perché una telecamera accesa consuma uplink anche se
l'immagine è ferma. Dopo averla spenta i byte di video in ingresso sono **zero**.

**Chi risponde all'invito cede.** Due rinegoziazioni che partono insieme (due che accendono la
telecamera nello stesso istante) non possono passare tutte e due: cede chi ha *ricevuto*
l'invito. È la stessa asimmetria che c'è già fra chi invita e chi risponde, riusata invece che
inventata.

**Niente trickle ICE**: i candidati si aspettano e l'SDP si manda intero, come fa l'invito.

**Una traccia che arriva non è una voce che si sente.** Serve un elemento `<audio>`, e il
numero che conta è quanti byte sono arrivati davvero — una traccia «collegata» con zero byte è
il guasto classico delle chiamate WebRTC.

**E una traccia che si sente non è un'immagine che si vede.** I byte di video in ingresso si
contano e sono la prova che il video arriva; ma **l'app non lo mostra**: non c'è nessun
`<video>` che lo riceva. È il buco che la misura non poteva vedere e che `sguardo.py` ha
trovato al primo giro — la differenza fra «arriva» e «si vede». Sta nell'elenco di ciò che
manca, non in quello dei guasti.

**La durata sta a vista, grande.** L'utente l'ha chiesta come sui telefoni normali: nella
barra della chiamata il nome sopra e il tempo sotto, in corpo 25 con cifre a larghezza fissa
(`tabular-nums`, altrimenti il numero balla a ogni secondo). Un «0:03» in coda a una frase è
un numero che non guarda nessuno; sotto il nome, da solo, è quello che si guarda. Il tempo
parte quando la chiamata è **in corso** — non quando si compone, non quando squilla — e non
esiste per gli altri due stati, dove non ha senso.

Per il resto la risposta è articolata, e vale per il futuro:

- **in due** è quasi banale una volta che il canale dati esiste: è la stessa
  `RTCPeerConnection`, il flusso si aggiunge con `addTrack`;
- **in tre o quattro** si può, disponendosi a maglia, ma ogni partecipante manda il proprio
  video a tutti gli altri: con quattro sono ~1,5 Mbps di uscita a testa. Regge su fibra, non
  su molte connessioni mobili. Da notare che il video non è un problema per i gruppi *di
  voce*: la sola voce in Opus è 24 kbps, e la maglia regge molto più a lungo;
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
2. **L'indirizzario.** Chi si è incontrato, la sua chiave pubblica, il percorso che aveva
   funzionato — in IndexedDB. Serve a smettere di rifare lo scambio a mano ogni volta: la
   **nuova** offerta (l'invito vecchio non si può riusare, §11) viaggia attraverso i peer già
   collegati. È il pezzo che rende il gruppo utilizzabile invece che dimostrabile.
3. **Le chiavi si imparano solo dai peer connessi.** Se arriva un evento di un autore
   sconosciuto, resta in coda in `sincronizzazione.js` (`inAttesa`) invece di essere creduto.
   Funziona, ma il gossip dovrà chiedere le chiavi mancanti a chi le ha.
4. **La cifratura dei contenuti.** Le firme dicono *chi* ha scritto, non *nascondono cosa*.
   In transito il canale è già cifrato, ma gli eventi restano in chiaro nell'archivio, e chi
   esporta il proprio archivio esporta tutto.
5. **Mostrare il video che si riceve.** È poco lavoro — un `<video>` legato alla traccia in
   ingresso — ma è la differenza fra «il video arriva» e «il video si vede»: oggi l'app conta
   i byte e non disegna l'immagine. È il buco trovato da `sguardo.py`, non dalle asserzioni.
6. **Le quattro prove di `spikes/`.** Costano poco e decidono il progetto: la 1 e la 3 in
   particolare (l'invito regge su Firefox? la scheda in background tiene?).
7. Poi: file, bacheca, blocchi, e le chiamate di gruppo.

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
- **Il conto dei byte va all'indietro dopo una rinegoziazione.** Rifacendo il transceiver
  dell'audio, `getStats()` riporta una voce nuova che parte da zero e la vecchia sparisce: il
  totale **scende**, e la differenza fra due letture dà un numero negativo. È successo: la
  prova ha misurato **−34 446 byte in tre secondi**. Si sommano i passi avanti per voce, non si
  fa la differenza fra due totali.
- **Un elenco che cresce non è una misura.** `tipi` diceva «video» anche dopo che la telecamera
  era stata spenta, perché era un insieme a cui si aggiungeva e da cui non si toglieva mai.
  Ora si guardano i transceiver vivi (`currentDirection` + traccia non `muted`).
- **Confrontare l'audio con e senza video non misura niente**: è lo stesso audio due volte, e
  il controllo passa per rumore (9 313 contro 9 284). Se si vuole misurare il video, si
  contano i **byte di video**.
- **Il browser senza testa suona davvero.** `--use-fake-device-for-media-stream` genera un
  tono, e senza `--mute-audio` esce dalle casse della macchina. È successo in ufficio.
- **`#registro` non ha a capo**: le note sono `<div>` accodate, e `textContent` le incolla in
  una riga sola. Per contarle si usa `children.length`, non `split('\n')`.
- **Un controllo che chiama `Date.now()` due volte chiede che il tempo non passi.** In `m0`
  l'istante di confronto era ricalcolato: la condizione era «l'orologio sta avanti di un minuto
  rispetto a un momento *successivo* a sé stesso», che è vera solo se le due chiamate cadono
  nello stesso millisecondo. Falliva ogni tanto **da sola** — l'asserzione era sbagliata, non
  l'orologio (`osserva()` implementa l'HLC correttamente). Un falso guasto dell'applicazione è
  la specie peggiore: fa cercare a lungo un difetto che non c'è. L'istante si calcola **una
  volta sola**.
- **Il service worker dell'app è «prima quello che ho, poi aggiorno»**, quindi un profilo
  Chrome riusato fra due esecuzioni guarda il codice della prima. Le misure sembrano giuste e
  parlano di una revisione che non è più quella sul disco. `prove.sh` già cancella il profilo
  prima di aprirlo; `sguardo.py` lo fa con `shutil.rmtree(profilo, ignore_errors=True)`.
- **Una correzione messa dopo un'uscita anticipata non esiste.** Il pulsante «Chiama» andava
  spento durante la chiamata *e* riacceso dopo: la riga era stata messa dopo `if (!viva)
  return;`, cioè nel punto che la chiamata che finisce non attraversa mai — il pulsante
  restava spento **per sempre**, peggio di prima. L'ha visto una misura (`dopo aver
  riattaccato: [True, '0.5'] <- atteso [False, 1]`), non una lettura.
- **Nell'app `$` non è globale.** `const $ = (s, r = document) => r.querySelector(s)` è di
  modulo (`app.js:33`): da `Runtime.evaluate` non esiste e ogni espressione lancia `Uncaught`.
  Nelle prove si scrive `document.querySelector` per esteso.
- **`document.body.dataset.pronto` non è pronto quando la pagina è caricata.** È l'ultima riga
  di un'IIFE asincrona, dopo aver letto l'invito dal link: si aspetta, non si legge subito.
- **Una funzione di pulizia nel `finally` che chiama `sys.exit` sostituisce l'eccezione che sta
  salendo** con un'uscita pulita: il guasto diventa un silenzio. `ferma()` (termina i processi)
  sta nel `finally`, `pulisci()` (esce) solo nel gestore del segnale.
- **Un `case` con la condizione rovesciata** (`case "$ko" in 0\|*)`) fa uscire il ciclo dopo un
  giro solo: sembra che tutto passi perché non si guarda più niente dopo la prima riga.

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

## 11. Le tre domande che tornano sempre

### Servono server STUN esterni?

**No, in tre casi su quattro.** Si usa uno STUN solo quando i due peer sono su **reti diverse
e tutte e due dietro un NAT**, perché in quel caso nessuno dei due conosce il proprio
indirizzo come lo vede il mondo, e solo uno STUN lo può dire.

| situazione | serve uno STUN? |
|---|---|
| stessa macchina, o stessa rete locale | **no** — bastano i candidati `host`, l'indirizzo locale |
| due dispositivi sulla stessa LAN, anche con NAT | **quasi mai** |
| reti diverse, dietro NAT | **sì**, per conoscere l'indirizzo pubblico; poi il traffico va diretto |
| NAT simmetrico da entrambi i lati | lo STUN non basta: serve un **relay** (TURN) |

**Cosa vede uno STUN: niente contenuto.** Gli si chiede «da che indirizzo mi vedi?» e
risponde con la tua coppia IP:porta pubblica. Nessun pacchetto dei tuoi dati passa di lì.
Sa però che quella coppia esiste e in che momento: è **metadato**, e questo va detto.

Nell'app lo STUN è **spento per difetto** (la casella `#usaStun` non è preselezionata):
senza la casella, creare un invito non contatta nessuno. Tutte le prove girano a STUN spento
e dentro `127.0.0.1`, quindi **non esce niente da questa macchina** — è la ragione per cui si
possono eseguire in un ufficio su una rete monitorata.

### Stiamo cifrando le comunicazioni, o usiamo solo HTTPS?

**Né l'una né l'altra come sono intese di solito: le comunicazioni sono cifrate *fra i due
browser*, non verso un server — e questo è più forte di HTTPS, non più debole.**

- WebRTC cifra **sempre**, e non è una scelta: i dati viaggiano in **DTLS**, i media in
  **SRTP**. Fra i due peer, punto a punto. Nessun intermediario può leggerli, perché non c'è
  nessun intermediario.
- **HTTPS protegge la consegna della pagina, non il contenuto della conversazione.** Qui il
  contenuto non passa da nessun HTTP.
- Le **firme** (Ed25519) dicono *chi* ha scritto. Non nascondono *cosa*: firma e cifratura
  sono due cose diverse. Il progetto ha la prima, non ancora la seconda.
- **Quello che manca davvero è la cifratura a riposo.** Il canale è cifrato, ma gli eventi
  restano **in chiaro dentro IndexedDB**: chi esporta il proprio archivio esporta tutto. È il
  punto 3 di §8, ed è il prossimo lavoro di sostanza.
- **Il metadato**: chi passa da un relay TURN non fa leggere il contenuto, ma dice a quel
  relay chi parla con chi, quando e quanto. Non è un difetto correggibile — è il prezzo di un
  relay.
- La chiave privata **non è estraibile**: la prova di chi ha scritto non si può rubare
  leggendo l'archivio locale.

### Possiamo salvare gli inviti e riusarli, invece di riscambiarli?

**No, e la ragione non è che le connessioni cambiano.** Quella si capisce subito. La ragione
è che **l'invito non è un indirizzo: è il verbale di uno scambio già avvenuto.** Dentro ci
sono quattro cose che nascono nuove a ogni collegamento:

| nell'invito | perché non si può riusare |
|---|---|
| `a=ice-ufrag` / `a=ice-pwd` | sono la credenziale dei controlli di connettività ICE, e i due lati devono averle **uguali**. Tu parti con le nuove, l'altro tiene le vecchie → ICE non connette |
| `a=fingerprint` (DTLS) | un `RTCPeerConnection` nuovo genera un **certificato nuovo**: l'impronta salvata non corrisponde più a quella che l'altro presenta → handshake DTLS fallito |
| i candidati | i nomi `.local` ruotano, e la mappatura IP:porta che il router ha dato per quel flusso la riprende dopo poco |
| la versione della sessione (`o=`) | deve crescere a ogni offerta: riusata, è vecchia e viene scartata |

Riusare l'invito di ieri è riusare la **fotografia di una porta**, non la porta. Non è una
limitazione di questo progetto: è cosa è fatto lo scambio. L'unica cosa che WebRTC sa
rinegoziare è una connessione **ancora viva** — è così che funziona il pulsante «Video» —
ma vive quanto la pagina.

**Cosa si riusa davvero:** *chi* è l'altro e *per dove* vi siete trovati — non *come*. Serve
un **indirizzario** in IndexedDB (`spiderId`, chiave pubblica, nome, quando vi siete parlati,
che percorso aveva funzionato), che a sua volta serve a far viaggiare la **nuova** offerta
attraverso i peer già collegati invece che a mano. Il primo invito resta manuale, quelli dopo
no: è il punto 1 di §8. **I candidati non si salvano**: sono indizi, non verità.

## 12. Sulla storia di git

Il progetto è stato scritto **prima** che esistesse un repository. Il primo commit raccoglie
quindi uno stato già completo, diviso per **aree** (la ricerca, le fondamenta, il guscio, le
prove, i documenti) e non per cronologia: l'ordine dei commit racconta come è fatto il
progetto, non l'ordine in cui è stato scritto. Da quel commit in poi la storia è reale.

## 13. Il repository e il sito pubblicato

| | |
|---|---|
| repository | <https://github.com/RedRider21/black-spider> (pubblico) |
| sito | <https://redrider21.github.io/black-spider/> |
| applicazione viva | <https://redrider21.github.io/black-spider/app/> |
| Pages | **ramo `main`, cartella `/`** — niente workflow, niente `docs/`: si pubblica ciò che è nel repo |
| licenza | **AGPL-3.0-or-later**, Copyright (C) 2026 Daniele Deplano (RedRider21) |

**Come si aggiorna il sito: si aggiorna il repository.** Pages serve `main` così com'è, quindi
un `git push` è la pubblicazione. Non c'è niente da rigenerare e niente da copiare in una
seconda cartella — è la ragione per cui Pages è puntato sulla radice invece che su `docs/`:
una copia sola, che non può divergere da sé stessa.

**Perché funziona così com'è:** tutti i percorsi dell'app sono **relativi**
(`manifest.webmanifest` ha `"start_url": "./"`, `sw.js` elenca asset `./...`,
`presentazione.html` linka `app/index.html`). Il sito sta quindi in una sottocartella come
`/black-spider/` senza una riga da riscrivere. `.nojekyll` serve perché Pages non passi i file
dentro Jekyll, che li rimaneggerebbe.

**Due cose che il sito pubblico cambia davvero**, e non sono cosmetiche:

- il service worker e il microfono vogliono **HTTPS**: su Pages ci sono, da `file://` no.
  Quindi l'app è **usabile davvero** da un indirizzo pubblico — installabile come applicazione
  e apribile senza rete — mentre `README.md` e `CLAUDE.md` §5 continuano a descrivere il giro
  locale, che serve per *lavorarci*, non per usarla;
- le **prove in `app/prove/`** sono pubblicate anche loro, ma `collegamento.html` e
  `chiamata.html` hanno bisogno di `prove/server.py` come messaggero fra i due ruoli: da Pages
  non funzionano. Non è un guasto da riparare, è il banco che serve una macchina. Se un
  giorno dà noia, si toglie `app/prove/` dal sito — non dal repo.

**Da sapere quando si lavora qui:** la cartella **non è più l'unica copia**. Prima di questa
sessione il repository non aveva remote (`git remote -v` vuoto) e il progetto viveva solo su
questo disco. Ora `origin` esiste: un `git push` è un punto di ripristino fuori dalla
macchina, e dall'altro PC si riparte con `git clone`.

**`pandoc` non è installato su questa macchina**, quindi `ARCHITETTURA.html` non si può
rigenerare da `ARCHITETTURA.md` finché non lo si installa (§5): finché è così,
`ARCHITETTURA.md` non si tocca, altrimenti i due divergono in silenzio — che è già successo
una volta, ed è la trappola che la riga di §5 esiste per evitare.
