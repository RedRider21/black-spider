---
title: "Il dialogo di origine"
---

# Il dialogo di origine

**Documento fondativo del progetto.** La conversazione da cui è nata l'idea di Black
Spider: come far comunicare tra loro gli IndexedDB di browser diversi, e con quali
tecnologie.

- **Fonte**: `https://chat.deepseek.com/share/giua35no5rxappywst`
- **Consultata**: 29 settembre 2026
- **Natura**: conversazione con un modello AI, generata automaticamente. Il contenuto è
  riportato come materiale di partenza, **non come fonte verificata**: le affermazioni
  tecniche sono state poi controllate una per una nella ricerca confluita in
  `ARCHITETTURA.md` (Appendice B).

> **Nota sulla trascrizione.** Il testo è stato ripulito dalla cronologia di navigazione
> dell'interfaccia (indicatori di ricerca, elenchi dei risultati aperti, tempi di
> elaborazione) e dai marcatori di nota che, senza la bibliografia originale, risultavano
> privi di significato. Le risposte sono riportate integralmente nel contenuto.

---

## 1. La domanda da cui è partito tutto

> Vorrei sapere se in qualche modo sia possibile intercettare utilizzando la rete internet
> i vari IndexedDB di più browser in rete per coordinare delle webapp PWA che ne fanno uso.

## 2. La risposta: no, e perché

No, non è possibile intercettare direttamente gli IndexedDB di browser diversi attraverso
la rete internet per coordinarli. Il motivo principale è una restrizione di sicurezza
fondamentale del web: la **Same-Origin Policy**.

### Perché l'accesso diretto è bloccato

IndexedDB, come la maggior parte dei sistemi di archiviazione web, è confinato a una
specifica origine (protocollo + dominio + porta). Questo significa che:

- un'applicazione web può leggere e scrivere solo nel proprio database IndexedDB, non in
  quello di un'altra origine;
- di conseguenza, un browser non può accedere all'IndexedDB di un altro browser, anche se
  entrambi sono sulla stessa macchina o nella stessa rete;
- la restrizione non è aggirabile tramite richieste di rete;
- l'unica eccezione è se più schede o finestre della stessa origine sono aperte nello
  stesso browser. In questo caso possono comunicare e accedere agli stessi dati, ma questo
  non si estende a browser diversi.

### Come coordinare le PWA tra browser diversi

Poiché non si può accedere direttamente ai database, la soluzione è sincronizzare i dati
attraverso un canale di comunicazione esterno. La strategia consiste nel far comunicare le
diverse istanze della PWA con un backend, che funge da punto di incontro e coordinamento.

**1. Sincronizzazione tramite server (WebSocket)** — l'architettura più comune per la
collaborazione in tempo reale. Ogni istanza apre una connessione WebSocket persistente
verso un server. Quando un utente modifica i dati nel proprio IndexedDB locale, la PWA
invia la modifica al server; il server la trasmette a tutte le altre istanze connesse, che
aggiornano i propri IndexedDB locali. Supporta nativamente la comunicazione bidirezionale
in tempo reale; è la soluzione ideale per applicazioni collaborative come editor di
documenti o dashboard condivise.

**2. Sincronizzazione peer-to-peer (WebRTC)** — per gli scenari in cui si vuole ridurre la
dipendenza da un server centrale. Le istanze stabiliscono connessioni dirette (data
channel) tra loro e possono scambiarsi aggiornamenti in tempo reale senza che i dati
passino attraverso un server, anche se è comunque necessario un server di signaling per la
fase iniziale di connessione. Riduce la latenza e il carico sul server; adatto ad
applicazioni come giochi multiplayer o condivisione di file.

**3. Sincronizzazione in background (Service Worker)** — per garantire che i dati rimangano
aggiornati anche quando l'app non è in primo piano: Background Sync (riprova le richieste
fallite), Periodic Background Sync (sincronizza a intervalli regolari) e Background Fetch
(per download di grandi dimensioni). Il Service Worker, in esecuzione in background, può
contattare il server, scaricare gli aggiornamenti e scriverli nell'IndexedDB locale,
mantenendo i dati allineati anche quando l'utente non sta attivamente utilizzando l'app.

**4. Comunicazione locale tra schede (BroadcastChannel)** — utile per coordinare più schede
dello stesso browser (non browser diversi), ma importante da conoscere. Permette a script
della stessa origine di scambiarsi messaggi tra diverse schede, finestre, iframe e Service
Worker. La si può usare, per esempio, per eleggere una scheda "leader" che mantiene una
singola connessione WebSocket, mentre le altre schede ricevono gli aggiornamenti tramite
BroadcastChannel, riducendo il numero di connessioni.

### In sintesi

Non si può "leggere" l'IndexedDB di un altro browser. La soluzione corretta è
sincronizzare i dati tra le istanze delle PWA utilizzando un backend. La strategia più
comune prevede l'uso di WebSocket per la comunicazione in tempo reale, supportata dalle API
di background sync dei Service Worker per mantenere i dati aggiornati anche quando l'app
non è aperta.

---

## 3. La seconda domanda: WebSocket e Service Worker, come funzionano

### WebSocket: la comunicazione in tempo reale

Immagina un WebSocket come una linea telefonica sempre aperta tra il tuo browser e il
server. A differenza delle normali richieste HTTP (che sono come inviare una lettera e
aspettare una risposta), con un WebSocket la connessione rimane attiva e entrambe le parti
possono parlare e ascoltare contemporaneamente (comunicazione full-duplex). Questo lo rende
perfetto per applicazioni collaborative, chat o qualsiasi scenario in cui i dati devono
essere aggiornati istantaneamente.

Come funziona nel contesto di una PWA:

- **Connessione**: quando l'app si avvia, apre una connessione WebSocket verso il server.
- **Invio modifiche**: quando l'utente modifica i dati (es. crea una nota), la PWA applica
  la modifica immediatamente al database locale IndexedDB per un feedback istantaneo e,
  contemporaneamente, invia la modifica al server attraverso il WebSocket.
- **Ricezione aggiornamenti**: il server, ricevuta la modifica, la trasmette a tutte le
  altre istanze connesse. Queste ricevono l'aggiornamento e lo applicano al proprio
  IndexedDB locale, mantenendo tutti i client sincronizzati.

**La sfida della connessione instabile.** Un WebSocket può cadere. Per gestire questo si
implementa un meccanismo di *heartbeat*: il client invia periodicamente un piccolo "ping" al
server. Se il server non risponde a due ping consecutivi (es. entro 60 secondi), il client
considera la connessione persa e tenta di riconnettersi, anche se `navigator.onLine` indica
che la rete è attiva (situazione comune su reti captive o DNS non funzionanti).

### Service Worker: il gestore delle attività in background

Il Service Worker è uno script che il browser esegue in background, separato dalla pagina
web. Funge da proxy di rete e da motore di sincronizzazione, anche quando l'app non è
aperta.

**Il ruolo chiave: la sincronizzazione in background.**

- **Coda di sincronizzazione**: quando l'utente modifica dei dati mentre è offline, la PWA
  non invia la richiesta al server (che fallirebbe). Invece memorizza la modifica in una
  coda (spesso in IndexedDB) e registra un evento di sincronizzazione presso il Service
  Worker.
- **Risveglio del Service Worker**: quando la connessione di rete viene ripristinata, il
  browser risveglia il Service Worker, anche se l'utente ha chiuso la scheda o il browser.
- **Elaborazione della coda**: il Service Worker legge la coda delle modifiche pendenti da
  IndexedDB e le invia al server una per una, gestendo anche i casi di errore (es. conflitti
  o fallimenti).

Le API disponibili: **Background Sync** (riprova le richieste fallite quando la connettività
è tornata), **Periodic Background Sync** (sincronizza a intervalli regolari in background,
mantenendo l'app aggiornata anche prima che l'utente la apra), **Background Fetch** (per
download di file di grandi dimensioni che possono continuare anche quando l'app è chiusa).

### WebSocket + Service Worker: la combinazione

La vera potenza si ottiene combinando i due approcci. I Service Worker, di norma, non
gestiscono direttamente le connessioni WebSocket persistenti, ma possono orchestrare la
sincronizzazione e inizializzare la logica basata su WebSocket quando l'app è attiva o
quando la rete torna disponibile.

Flusso tipico:

1. **Avvio dell'app (online)**: l'app carica i dati da IndexedDB e apre una connessione
   WebSocket con il server per ricevere aggiornamenti in tempo reale.
2. **Modifica (offline)**: l'utente modifica un dato. L'app aggiorna IndexedDB localmente e
   aggiunge l'operazione a una coda di modifiche in sospeso (*outbox*), sempre in IndexedDB.
   Quindi registra un evento di Background Sync tramite il Service Worker.
3. **Ripristino della connessione**: il browser rileva che la rete è tornata e attiva il
   Service Worker.
4. **Sincronizzazione**: il Service Worker legge la coda da IndexedDB. Invece di usare una
   semplice `fetch`, può notificare alla pagina principale (o a un Web Worker) di elaborare
   la coda usando la connessione WebSocket ristabilita. In alternativa, se la pagina è
   chiusa, il Service Worker può effettuare le richieste di sincronizzazione esso stesso
   (es. via `fetch` verso un endpoint REST).
5. **Pulizia**: una volta che il server conferma la ricezione delle modifiche, queste
   vengono rimosse dalla coda in IndexedDB.

| Tecnologia | Ruolo principale | Vantaggio chiave |
|---|---|---|
| WebSocket | Comunicazione bidirezionale in tempo reale | Aggiornamenti istantanei tra client e server |
| Service Worker | Esecuzione di codice in background e gestione della coda di sincronizzazione | Affidabilità: non perde dati se l'app è chiusa o la rete cade |
| Insieme | Sincronizzazione robusta e in tempo reale | Migliore esperienza utente: app sempre aggiornata e reattiva, anche con rete instabile |

In pratica, il WebSocket gestisce la velocità della comunicazione quando si è online, mentre
il Service Worker garantisce l'affidabilità e la persistenza delle operazioni quando si è
offline. **La coda in IndexedDB è l'elemento che fa da ponte tra i due mondi.**

---

## 4. La terza domanda: e con WebRTC?

Sì, WebRTC è un'alternativa molto interessante e potente, ma introduce una complessità
architetturale diversa rispetto a WebSocket. Il suo punto di forza è la possibilità di
creare una comunicazione **peer-to-peer** diretta tra i browser, senza che i dati debbano
passare attraverso un server centrale.

### Il ruolo cruciale del server di signaling

Qui sta la differenza fondamentale: **WebRTC non è completamente serverless**. Per potersi
connettere, due browser devono prima "presentarsi" e scambiarsi informazioni tecniche (come
gli indirizzi IP e le porte). Questo scambio iniziale avviene tramite un server di
signaling, che è un semplice servizio di matchmaking.

Il flusso:

1. **Connessione al server di signaling**: ogni istanza della PWA si connette a un server di
   signaling (spesso tramite WebSocket).
2. **Creazione della stanza**: un utente crea una stanza o un canale e ne condivide l'ID con
   gli altri.
3. **Scambio di informazioni (SDP/ICE)**: quando un secondo utente si unisce alla stessa
   stanza, i due browser scambiano, tramite il server di signaling, i parametri per
   stabilire la connessione diretta.
4. **Connessione P2P stabilita**: una volta completato lo scambio, la connessione WebRTC
   viene stabilita e i dati iniziano a fluire direttamente da browser a browser, aggirando
   il server di signaling.

### Sincronizzazione dei dati con WebRTC

Una volta stabilita la connessione P2P, la si può usare per sincronizzare gli IndexedDB tra
i vari client.

- **Modello di sincronizzazione**: il pattern più comune è quello in cui ogni peer mantiene
  la propria copia locale dei dati in IndexedDB. Quando un peer modifica un dato, invia
  l'aggiornamento a tutti gli altri peer connessi tramite il data channel; gli altri
  ricevono l'aggiornamento e lo applicano al proprio IndexedDB locale.
- **Gestione dei conflitti**: in un sistema P2P le modifiche possono avvenire
  contemporaneamente su peer diversi. Per risolvere i conflitti in modo automatico si
  utilizzano spesso **CRDT** (Conflict-free Replicated Data Type), come la libreria **Yjs**,
  progettati per fondere le modifiche senza intervento manuale. Un'altra strategia è l'uso
  di **Hybrid Logical Clock** (HLC) per ordinare gli eventi in modo coerente.

### Il punto critico: WebRTC e Service Worker

Qui arriviamo alla limitazione più importante. **WebRTC non è disponibile all'interno di un
Service Worker.** È una restrizione progettuale dei browser, dovuta al ciclo di vita breve e
imprevedibile dei Service Worker, che non sono adatti a mantenere connessioni di lunga
durata come quelle WebRTC.

In pratica: non si può far stabilire o mantenere una connessione WebRTC direttamente dal
Service Worker in background. La connessione P2P deve essere gestita dalla finestra
principale dell'applicazione (*window scope*).

**Come aggirare il problema con i Transferable Streams.** La finestra principale stabilisce
e mantiene la connessione WebRTC. Quando riceve dati da un peer, invece di elaborarli
direttamente, trasferisce lo stream di dati (o un `ArrayBuffer` per i browser meno recenti)
al Service Worker tramite `postMessage`. Il Service Worker riceve i dati e può elaborarli,
ad esempio per aggiornare l'IndexedDB o notificare la pagina, anche se la finestra
principale è in background.

### WebRTC contro WebSocket: quando scegliere cosa

| Caratteristica | WebSocket | WebRTC (data channel) |
|---|---|---|
| Architettura | Client-server | Peer-to-peer (con server di signaling) |
| Latenza | Bassa (ma passa dal server) | Molto bassa (diretto tra peer) |
| Carico sul server | Alto (tutto il traffico passa dal server) | Molto basso (solo signaling iniziale) |
| Complessità di setup | Bassa | Alta (gestione signaling, ICE, STUN/TURN) |
| Supporto in Service Worker | Sì (tramite `fetch` o API dedicate) | No (richiede Transferable Streams) |
| Caso d'uso ideale | Applicazioni collaborative con server centrale, chat, notifiche | Giochi multiplayer, condivisione file P2P, editor collaborativi senza server centrale |

### In sintesi

WebRTC è una scelta eccellente se l'obiettivo è minimizzare la dipendenza da un server
centrale per la sincronizzazione dei dati, puntando su un'architettura P2P. È
particolarmente adatto per applicazioni collaborative in cui la latenza è critica.

Tuttavia comporta una maggiore complessità implementativa (gestione del signaling, dei
server STUN/TURN, della logica di sincronizzazione e risoluzione dei conflitti) e richiede
di progettare la PWA tenendo conto che la connessione WebRTC deve essere gestita dalla
finestra principale, utilizzando i Service Worker solo per la persistenza e l'elaborazione
dei dati in background tramite Transferable Streams.

Se invece lo scenario richiede una logica di coordinamento centralizzata, o non c'è la
necessità di una comunicazione diretta P2P, WebSocket rimane la soluzione più semplice e
robusta.

---

## 5. Cosa ne è stato tratto

Questa conversazione pone le domande giuste ma si ferma alle risposte "da manuale": tutte
le soluzioni proposte presuppongono un **server centrale**, che è esattamente ciò che il
progetto vuole evitare. I tre semi utili che sono stati raccolti:

1. **La coda in IndexedDB (outbox)** come ponte tra il mondo online e quello offline — è
   diventata §9.4 di `ARCHITETTURA.md`.
2. **Gli Hybrid Logical Clock** per ordinare gli eventi in modo coerente tra peer — sono
   diventati §6.2.
3. **I CRDT per la fusione automatica dei conflitti** — sono diventati §7.4, con la
   distinzione tra log proprio e CRDT *dentro* i moduli.

Alcune affermazioni della conversazione sono state **corrette o ridimensionate** dalla
ricerca successiva:

| Affermazione nel dialogo | Stato dopo la verifica |
|---|---|
| "il Service Worker risveglia il browser quando la rete torna" | vero solo su Chromium: Background Sync **non esiste** su Firefox né Safari |
| I Service Worker "possono orchestrare la sincronizzazione" in background | su iOS lo stack WebRTC viene distrutto in background: il peer sempre-acceso **non è possibile** |
| Yjs come soluzione ai conflitti | non firma gli eventi: serve comunque un log firmato proprio |
| Il signaling "spesso tramite WebSocket" | vero, ma i broker pubblici del 2026 sono inaffidabili: serve una via che non dipenda da terzi |
