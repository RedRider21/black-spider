# Black Spider — Architettura

> Documento di progetto. Versione 0.2 — 29 settembre 2026.
> Stato: l'**applicazione v0 è costruita e verificata** — chat fra due browser, **chiamata a
> sola voce dentro l'app** (con la telecamera che si accende e si spegne a chiamata avviata),
> guscio PWA, due temi, due lingue; `./prove.sh` la mette alla prova in un comando (esiti in
> `app/README.md`). Il resto di questo documento — gruppi, indirizzario, file, bacheca,
> blocchi — è **progetto da costruire**: qui sta il perché delle scelte, non la descrizione di
> ciò che esiste. Le sezioni che dipendono da misure non ancora fatte sono §7, §11 e §14.
> La v0.2 integra una ricerca sul panorama P2P web al 2026 (§7, §11, §12 e Appendice B).

---

## 0. In una frase

Black Spider è una **rete peer-to-peer tra browser**: nessun server, nessun account, nessun
operatore che custodisce i tuoi dati. Ogni browser tiene il proprio database in locale; i
peer si connettono direttamente tra loro via WebRTC e si scambiano le modifiche, così la
storia di un gruppo può essere replicata su tutti coloro che la vogliono — anche su chi non
ha mai incontrato direttamente l'autore originale.

Il ragno non ha un centro: la tela regge perché è magliata.

---

## 1. Cosa è, e cosa non è

**È** una PWA statica che gira interamente nel browser, distribuibile su hosting statico
(GitHub Pages), che offre:

- **identità** generata localmente (coppia di chiavi, nessuna registrazione);
- **stanze** P2P con storico replicato;
- **chat**, **file**, **videocall 1:1 e di gruppo piccolo**;
- un'**API interna** (`spider.*`) su cui montare moduli applicativi ("software via web").

**Non è**:

- una piattaforma con backend, utenti, moderazione centralizzata o push notification;
- un sostituto di Slack/Discord per comunità grandi (la mesh non scala a migliaia);
- un sistema che garantisce la consegna: senza un peer online i messaggi attendono;
- un sistema che può cancellare davvero un dato da un peer che non collabora (§10.4).

Questi non sono difetti da correggere: sono le proprietà del modello. Ogni scelta a valle
discende da qui.

---

## 2. I tre vincoli duri

Vanno accettati all'inizio, altrimenti si scoprono a metà strada.

### 2.1 Il signaling serve sempre

Due browser non possono "trovarsi" dal nulla: devono almeno scambiarsi i parametri di
connessione (SDP e candidati ICE). Un protocollo di discovery totalmente privo di canale è
impossibile. L'unica soluzione a infrastruttura zero è **spostare lo scambio fuori banda**:
l'handshake viaggia dentro un link o un QR code che le persone si scambiano con qualunque
mezzo già disponibile (WhatsApp, email, di persona).

### 2.2 Il NAT è il vero nemico, e ha un numero

I dati 2025-2026 sono concordi: **circa il 10% delle sessioni WebRTC fallisce del tutto
senza STUN/TURN**; STUN da solo risolve il 70-80% dei casi; **il 15-20% delle sessioni
consumer richiede un relay TURN**. Su alcune configurazioni di NAT (port-restricted cone) i
fallimenti con solo STUN arrivano al 63%.

Tradotto: non è un caso limite da ignorare, è **una sessione su cinque**. Su **LAN**,
invece, due browser si connettono senza alcun intermediario.

Conseguenza progettuale: il trasporto deve saper *degradare*, non solo funzionare, e il
prodotto deve dire all'utente quando non riesce invece di restare muto.

### 2.3 Niente store-and-forward

Se nessun peer che possiede una stanza è online, un messaggio nuovo resta nella coda locale
(`outbox`) finché non incontra qualcuno con cui sincronizzarsi. Non esiste un server che
tiene il messaggio per te.

**La soluzione non è un server nostro**: è permettere che *qualsiasi peer* accetti di
restare sempre acceso (§11). Stesso protocollo, zero infrastruttura da amministrare.

---

## 3. Principi di progetto

1. **Local-first.** Il dato è scritto localmente per primo e la UI non aspetta la rete. La
   sincronizzazione è un dettaglio del trasporto, non una precondizione.
2. **Nessuna autorità.** Nessun peer è speciale: chiunque può fare da relay, chiunque può
   uscire senza rompere nulla.
3. **Verificabile, non fidato.** Ogni evento è firmato e concatenato: un peer non può
   riscrivere la propria storia né fabbricare quella altrui.
4. **Sostituibile ai bordi.** Signaling, trasporto e persistenza sono moduli con
   interfaccia definita. Si può cambiare provider di signaling senza toccare il protocollo.
5. **Degrada, non fallisce.** Senza internet: LAN. Senza peer online: outbox. Senza TURN:
   si prova comunque, e si dice chiaramente all'utente quando non riesce.

---

## 4. Strati

```
┌────────────────────────────────────────────────────────────┐
│ 5. MODULI APPLICATIVI   chat · file · call · app di terzi   │
├────────────────────────────────────────────────────────────┤
│ 4. API INTERNA          spider.db · spider.log · spider.call│
├────────────────────────────────────────────────────────────┤
│ 3. SINCRONIZZAZIONE     log di eventi, gossip, anti-entropia│
├────────────────────────────────────────────────────────────┤
│ 2. TRASPORTI            WebRTC DataChannel (mesh)           │
├────────────────────────────────────────────────────────────┤
│ 1. IDENTITÀ             chiavi WebCrypto, spiderId, firma   │
├────────────────────────────────────────────────────────────┤
│ 0. PERSISTENZA          IndexedDB + OPFS (log, stato, blob) │
└────────────────────────────────────────────────────────────┘
        ↑ attraversato da: SIGNALING (modulo intercambiabile, §7)
```

---

## 5. Identità

### 5.1 Generazione

Alla prima apertura il browser genera una coppia di chiavi con WebCrypto. La chiave privata
viene creata **non estraibile** (`extractable: false`) e salvata in IndexedDB: gli oggetti
`CryptoKey` sono clonabili in struttura, quindi il byte della chiave privata non esiste mai
come stringa in memoria JavaScript. È la difesa più efficace contro l'esfiltrazione via XSS.

Ordine di preferenza dell'algoritmo:

| Algoritmo | Supporto | Note |
|---|---|---|
| Ed25519 | **Chrome ≥ 137, Firefox ≥ 130, Safari ≥ 17** | firme corte (64 B), veloce, deterministico |
| ECDSA P-256 | universale | ripiego per i browser più vecchi |

**Verificato** (settembre 2026), non più stimato: Ed25519 è ormai baseline su tutti e tre i
motori. Il polifill `@yoursunny/webcrypto-ed25519`, che serviva a coprire il vuoto, risulta
deprecato dalla fine del 2025 proprio perché non serve più.

La conseguenza pratica è che l'ordine di preferenza sopra **non è più una scommessa**: si
prova Ed25519, e se `crypto.subtle.generateKey` lo rifiuta si ripiega su P-256 senza
conseguenze sul resto del progetto. L'algoritmo scelto va però registrato dentro l'identità
(§5.2), perché una firma Ed25519 e una P-256 non sono intercambiabili una volta che gli
eventi sono stati emessi: la stessa identità deve firmare allo stesso modo per sempre.

### 5.2 Identificativo

```
spiderId = "sp_" + base32( SHA-256( SPKI della chiave pubblica ) [0..19] )   // 160 bit
```

L'ID **è** la chiave: nessuna autorità lo assegna. Non è revocabile e non è riciclabile.

Insieme alla chiave, l'identità registra l'**algoritmo di firma** scelto alla nascita
(ED25519 o ECDSA-P256). Serve perché chi verifica deve sapere *come* verificare: un evento
firmato Ed25519 e uno firmato P-256 non si distinguono a occhio, e l'algoritmo non è
deducibile dal solo SPKI in modo abbastanza economico da volerlo fare a ogni verifica.
L'identità è creata una volta e vive per sempre, quindi la scelta si fa una volta sola e
non si cambia più.

### 5.3 Nome e avatar

Soprannome e avatar sono **auto-dichiarati** e firmati, ma non univoci. Due peer possono
chiamarsi "Marco". La UI mostra sempre, accanto al nome, una parte dell'ID, e offre il
**numero di sicurezza** (impronta leggibile, stile Signal) da confrontare fuori banda quando
l'identità conta davvero.

### 5.4 Dispositivi

v0: **un'identità per profilo browser**. Multi-dispositivo (telefono + desktop con la stessa
identità) è una fase successiva: si fa con un link di accoppiamento firmato dal dispositivo
primario, e richiede la gestione della revoca di un dispositivo. Non complicare v0 con
questo.

---

## 6. Modello dei dati

### 6.1 Il log di eventi

Il cuore di Black Spider è un **log di eventi immutabili, firmati e concatenati**. Non si
modifica e non si cancella: si aggiunge.

```jsonc
{
  "id":     "b3:9f2a…",        // hash della serializzazione canonica (sotto)
  "author": "sp_7f3a…",        // chi l'ha creato
  "seq":    42,                // progressivo monotono per autore, senza buchi
  "prev":   "b3:1c07…",        // hash dell'evento precedente dello stesso autore
  "refs":   ["b3:aa10…"],      // dipendenze causali (es. il messaggio a cui rispondo)
  "room":   "rm_c5e1…",        // contesto di appartenenza
  "kind":   "chat/msg",        // namespace per tipo
  "hlc":    [1759141200123, 3, "sp_7f3a…"],   // orologio ibrido logico
  "body":   { "text": "…" },
  "sig":    "…"                // firma sull'intero contenuto sopra
}
```

`id` è l'hash di `{author, seq, prev, refs, room, kind, hlc, body}`: la firma copre gli
stessi byte. Chiunque può verificare che un evento sia integro e che appartenga a chi dice.

**Due catene, due scopi:**

- `prev` lega ogni autore a se stesso: la propria storia è una catena hash, quindi
  riscrivere il passato richiederebbe di rifare tutta la filiera. È la difesa contro la
  manomissione.
- `refs` lega gli autori tra loro: una risposta non può esistere prima del messaggio a cui
  risponde. È la difesa contro la riscrittura del contesto.

Questo modello non è un'invenzione: è quello di **Secure Scuttlebutt** (log append-only per
autore, firma Ed25519, gossip) e del più recente **Willow/Earthstar**, nato per risolvere i
limiti di SSB. Vale la pena studiarli come riferimento di progetto — non adottarli come
dipendenza: `ssb-browser-core` gira in browser (~2 MB) ma la linea originale è ferma dal
2024, e Willow è ancora immaturo per la produzione.

### 6.2 Ordinamento: HLC

Ordine fisico (`Date.now()`) non è affidabile in P2P: gli orologi dei dispositivi sono
sfalsati e i peer stanno offline per giorni. Si usa un **Hybrid Logical Clock**:
`[millisecondi fisici, contatore, autore]`. La tupla è un ordine totale, coerente con la
causalità, e stabile tra peer. Gli orologi storti producono ordinamenti "strani ma
consistenti", mai divergenti — che è la proprietà che conta davvero.

### 6.3 Lo stato è una proiezione

Lo stato dell'applicazione **non** è il log: ne è una riduzione deterministica.

```
state₀ = stato iniziale
stateₙ = reduce(stateₙ₋₁, eventoₙ)      // deterministico, nessun I/O, nessun Date.now()
```

Regola assoluta: **`reduce` non deve leggere nulla dall'esterno** — né orologio, né rete, né
`Math.random()`. Se due peer applicano lo stesso insieme di eventi nel loro ordine
deterministico, ottengono lo stesso stato. Ogni violazione di questa regola è una
divergenza silenziosa.

### 6.4 Schema di persistenza

**IndexedDB** per i dati strutturati:

| Store | Chiave | Contenuto | Note |
|---|---|---|---|
| `identity` | `singleton` | `CryptoKey` privata non estraibile, pubblica | mai esportato |
| `events` | `id` | eventi (header sempre, corpo in `bodies`) | indici: `author+seq`, `room+hlc` |
| `bodies` | `id` | corpo degli eventi vecchi | sacrificabile dopo compattazione |
| `heads` | `room+author` | ultimo `seq` e hash di ciascun autore | base del version vector |
| `snapshots` | `room` | proiezione + frontiera a una certa altezza | permette compattazione |
| `outbox` | autoincrement | eventi non ancora consegnati | con contatore di tentativi |
| `peers` | `spiderId` | chiave pubblica, ultimo contatto, reputazione | |
| `rooms` | `roomId` | nome, chiave simmetrica, politica di replica | |
| `apps` | `appId` | stato privato dei moduli applicativi | non sincronizzato |

**OPFS** per il contenuto dei file (`blobs`). Non sono un dettaglio: OPFS ha oggi un
supporto *più ampio e più stabile* dell'uso di IndexedDB per i grandi binari, è pensato per
i file, e permette letture a flusso invece di caricare tutto in memoria. Su OPFS il progetto
è al sicuro anche su Firefox e Safari; l'API `showSaveFilePicker` (che invece è solo
Chromium) non ci serve.

**Perché `bodies` separato da `events`:** la catena di header è minuscola e va conservata
per sempre (serve a verificare l'integrità), i corpi sono grandi e possono essere scartati
dopo che uno snapshot li ha incorporati. Un dispositivo leggero può conservare la storia
verificabile senza conservarne il contenuto.

### 6.5 Compattazione e orizzonte

Il log cresce senza limite, e "tutti hanno tutto" significa che chi entra in una stanza
vecchia vorrebbe scaricare anni di storia. Servono due strumenti:

- **Snapshot**: ogni N eventi (o M byte) si salva la proiezione e la frontiera. Serve per
  ricostruire lo stato senza riapplicare tutto e per scartare i corpi.
- **Orizzonte di storia**: politica per stanza.
  - `full` — chi partecipa replica tutto (stanze piccole, di fiducia);
  - `horizon: <data|n_eventi>` — si condividono solo gli ultimi N giorni/eventi, e chi ha
    la storia precedente la offre come "archivio" su richiesta esplicita;
  - `ephemeral` — niente storia (chat effimere, presenza, segnali di chiamata).

Questo è un **punto di progettazione aperto**, non un dettaglio: determina l'esperienza di
chi entra in una stanza esistente. Va deciso con prove reali (§14).

### 6.6 Più schede dello stesso browser

Un caso che è facile dimenticare e che rompe i sistemi P2P ingenui: l'utente apre Black
Spider in tre schede. Se ogni scheda apre le proprie connessioni WebRTC e scrive nel proprio
IndexedDB, si ottengono connessioni duplicate, eventi scritti due volte e `seq` in conflitto
dentro la *stessa* identità.

Soluzione, con API ampiamente disponibili:

- **`Web Locks`** (widely available da settembre 2024) elegge una **scheda leader** per
  l'origine: è l'unica che parla con la rete.
- **`BroadcastChannel`** distribuisce alle altre schede gli eventi ricevuti e le modifiche
  locali, così la UI di ogni scheda resta viva e coerente.
- Se il leader viene chiuso, il lock si rilascia e una delle altre schede viene eletta.

Questo è **lo stesso schema** che servirà al peer ancora (§11) e va implementato in M1, non
aggiunto dopo: retrofittarlo significa toccare tutto il livello di trasporto.

---

## 7. Signaling: la decisione

**Criteri.** Deve funzionare in LAN e su internet; non deve dipendere da un singolo servizio
di terzi che può chiudere; deve essere implementabile da noi; non deve richiedere un nostro
backend; deve poter funzionare anche **senza internet**.

**Decisione: l'handshake fuori banda è la base obbligatoria; un broker pubblico (uno solo,
scelto bene) è l'acceleratore; il TURN è il ripiego per la minoranza di reti ostili.**

### 7.1 Livello A — Invito (base, sempre disponibile)

Il peer che crea la stanza produce un **link di invito** che contiene, compresso e
codificato, l'offerta WebRTC (SDP + candidati, in modalità *non-trickle* per evitare lo
scambio multiplo) più l'identificativo e la chiave della stanza:

```
https://…/#invito=<blob compresso base64url>
```

Chi lo riceve apre la pagina, l'app genera automaticamente la risposta e mostra un **codice
di ritorno** breve da rimandare al primo peer. Due messaggi scambiati in tutto, con
qualunque mezzo: WhatsApp, email, QR code mostrato a schermo, SMS, o anche un foglio di
carta.

**Questo non è un'idea teorica: è già stato costruito.** Il progetto **QWBP (QR-WebRTC
Bootstrap Protocol)** comprime l'SDP da ~2.500 byte a **55-100 byte**, abbastanza per un QR
di versione 4-5, senza backend. Esistono anche `webrtc-via-qr` (due QR: invito e
accettazione) e **ThinAir** (handshake via QR, via testo, *o via "chirp" audio*, più la
modalità manuale copia/incolla). Da studiare come riferimento: riducono il rischio che
questa parte sia più difficile del previsto.

Proprietà:

- **zero infrastruttura**, per sempre;
- funziona **senza internet**, in LAN, su una rete isolata o in aereo;
- il link *contiene* la chiave della stanza: possederlo significa poter entrare — e questo
  è anche il suo modello di sicurezza (§10.3);
- costo: due passaggi manuali. È l'attrito che si paga per non avere padroni.

**Trappola nota**: i timeout ICE di Firefox sono stretti (~5 s). Lo scambio non-trickle con
un link da incollare può superarli.

**Misurato il 2026-09-29, e la prima stesura di questa sezione sbagliava.** Diceva di
aspettare la raccolta ICE *completa* prima di generare il link. Su una rete che blocca la
STUN in uscita (una rete aziendale normale: bastano un firewall che filtra l'UDP o una VPN
solo-TCP) la raccolta **non arriva mai a `complete`**: il browser continua a ritentare finché
non scade il timeout. Risultato osservato: un solo candidato `host`, zero `srflx`, e **12,5
secondi di attesa a ogni singolo invito** — con l'invito che poi funzionava comunque.

La regola giusta non è "aspetta che abbia finito" ma **"aspetta che smetta di arrivarne"**:
si chiude la raccolta dopo ~700 ms senza nuovi candidati. Stesso esito, **1,2 s** invece di
12,5. Il valore di default di `aspettaGathering` in `spikes/lib/invito.js` è stato corretto
di conseguenza, e il timeout lungo resta solo come rete di sicurezza.

Due conseguenze da tenere presenti:

- la modalità `quiete` va preferita anche perché **regge sui timeout stretti di Firefox**:
  è la risposta al problema che questa sezione segnalava;
- su una rete senza STUN raggiungibile i candidati sono **solo `host`**, quindi si resta
  dentro la stessa rete locale. Non è un guasto della LAN (§2.2), è l'assenza di una via
  riflessa: per uscire serve o una STUN che risponda, o un TURN.

Per la LAN si aggiunge una scorciatoia: con i candidati host e mDNS i due browser si
connettono direttamente, e l'utente può incollare un **codice stanza corto** invece del link
completo quando i peer sono già sulla stessa rete.

### 7.2 Livello B — Broker pubblico: Trystero su Nostr

Quando c'è internet e la comodità conta, un modulo di signaling si appoggia a servizi
pubblici che non gestiamo. La scelta, allo stato attuale delle informazioni:

| Opzione | Verdetto | Motivo |
|---|---|---|
| **Trystero**, strategia **Nostr** | **scelta** | strategie intercambiabili con una riga di import; Nostr descritto come la più robusta ("centinaia di relay attivi"); opzione `redundancy` per ridondare i relay; i dati applicativi non passano mai dal mezzo di signaling |
| PeerJS public cloud | **da evitare** | `listAllPeers()` disabilitato in modo permanente; issue di ottobre 2025 documenta ritardi WebSocket di 6+ minuti intermittenti anche con status page "operational"; gli endpoint Heroku sono morti dal 2022 |
| y-webrtc (default pubblici) | **da evitare** | due dei tre endpoint di default (`*.herokuapp.com`) sono morti; libreria definita "mostly unmaintained", ultimi commit 2023-2024 |
| Broker MQTT pubblici | ripiego | nessuna garanzia, spesso abusati; nessuna lista affidabile trovata: da verificare empiricamente prima di affidarcisi |

Trystero offre strategie alternative (`torrent`, `mqtt`, `supabase`, `firebase`, `ipfs`,
`ws-relay`) con la stessa interfaccia. **Non adottiamo una sola rete**: l'astrazione esiste
già, e il costo di tenere una seconda strategia configurabile è quasi nullo. Questa è
l'assicurazione contro il rischio "il servizio di terzi sparisce".

**Alternativa da considerare in una fase successiva**: **Nostr direttamente** o **js-waku**
(light node nel browser, ~147 kB). Su Nostr gli eventi sono già firmati e la propagazione è
già gossip: è il modello concettualmente più vicino a Black Spider, e in futuro potrebbe
assorbire sia il signaling sia il relay degli eventi.

### 7.3 Livello C — STUN e TURN

- **STUN**: Google (`stun.l.google.com:19302`, con i repliche `stun1..4`) e Cloudflare
  (`stun.cloudflare.com`). Entrambi gratuiti, nessuna garanzia di uptime: se ne configurano
  più di uno e si passa al successivo.
- **TURN**: serve al 15-20% delle sessioni (§2.2). Non esiste un TURN pubblico affidabile:
  esiste un *tetto gratuito* che basta per far funzionare il progetto e per un uso reale
  contenuto.

| Servizio | Gratuito | Limite | Note |
|---|---|---|---|
| **Metered / Open Relay** | sì | **20 GB/mese** | porte 80/443, TCP/UDP+TLS; rate-limited, nessuna SLA |
| Cloudflare Realtime | sì | ~**1.000 GB/mese** | **fonte comunitaria: da verificare sul contratto attuale**; STUN sempre gratis |
| Hugging Face + FastRTC | sì | 10 GB/mese | richiede account HF |
| Xirsys | sì | 500 MB/mese | banda capped, una sola regione |
| Twilio | STUN sì, TURN no | a consumo | $0,40-0,80/GB secondo la regione |

**Decisione**: il TURN non è obbligatorio nel codice, è **configurabile**. Default: STUN
multiplo, nessun TURN. Chi vuole la massima raggiungibilità inserisce le proprie credenziali
(Metered gratuito come primo suggerimento documentato). L'app deve **dire chiaramente**
quando una connessione è fallita per NAT, invece di restare in "connessione in corso".

Alle quote si aggiunge una considerazione di privacy: TURN significa che i byte passano da
un terzo in chiaro (se la stanza non è cifrata, §10.2). Va scritto nell'interfaccia, non solo
nel documento.

### 7.4 Libreria esistente o codice nostro?

La ricerca è netta su un punto: **nessuna libreria CRDT firma gli eventi**. Firma,
concatenazione e gossip sono responsabilità dell'applicazione, in ogni combinazione
esaminata. Le opzioni reali:

| Opzione | Pro | Contro |
|---|---|---|
| **Log firmato nostro** (proposta) | controllo totale; il modello di §6.1 è piccolo e ben compreso; nessuna dipendenza | va scritto e verificato, incluso il fuzz test di convergenza |
| Yjs + `y-indexeddb` | maturo, ~18 kB, enorme ecosistema editor, GC dei tombstone | **non firma gli eventi**, non conserva una storia verificabile, `y-webrtc` è unmaintained |
| Automerge 3 / Loro | storia completa stile Git, ottimi benchmark | ~320 kB / ~180 kB (WASM), trasporto da scrivere comunque; si sovrappongono al nostro log |

**Decisione: il log è nostro.** Motivi: (a) il nostro requisito primario è la
*verificabilità* per evento, che nessuna delle librerie offre; (b) `prev` + `refs` + HLC sono
poche centinaia di righe di logica ben definita; (c) adottare un CRDT significherebbe
comunque riscrivere sopra la firma, pagando la complessità due volte.

**Dove invece una libreria serve davvero**: i moduli con **stato mutabile ricco** (editor
collaborativi, bacheche). Per quelli, un CRDT *dentro* il corpo di un evento — l'evento
trasporta un aggiornamento CRDT firmato — è la soluzione corretta. **Yjs** è il candidato
naturale, e va tenuto presente in fase di progetto della proiezione: la proiezione di un
modulo può essere un documento Yjs, non necessariamente una struttura scritta a mano.

Questa distinzione (log nostro per il trasporto e l'identità, CRDT di terzi *dentro* i
moduli che ne hanno bisogno) è probabilmente la decisione architetturale più importante
dopo quella del log stesso.

### 7.5 Perché questa gerarchia

Le alternative erano tre: broker pubblico come base, handshake manuale come base, oppure
mesh con discovery locale.

Le prime due sono state scartate come *base* per motivi speculari: il broker pubblico fa
dipendere un prodotto senza infrastruttura da un servizio che non controlliamo — e i fatti
del 2025 (PeerJS, y-webrtc) mostrano che succede davvero; il solo handshake manuale rende
ogni connessione faticosa anche quando non serve. La gerarchia A→B→C tiene la proprietà (A
non può sparire) e compra la comodità solo dove è gratis (B).

La discovery locale non è stata scartata per pigrizia: è **irrealizzabile tra dispositivi
diversi**, perché `BroadcastChannel` e `localStorage` non attraversano i browser. Funziona
solo tra schede dello stesso browser, che è esattamente il caso di §6.6.

---

## 8. Trasporto

### 8.1 Topologia

Mesh completa per stanza: ogni peer ha una `RTCPeerConnection` verso ogni altro. Il numero
di connessioni cresce come **n(n−1)/2**. Regge fino a ~8-10 peer attivi per una applicazione
di soli dati; per il video il limite è molto più basso (§12). Oltre, il numero di uplink e
la banda di replica diventano il collo di bottiglia. Questo non è un limite da aggirare con
l'ingegno: è la ragione per cui esiste il concetto di *stanza* invece di un unico spazio
globale.

### 8.2 Canali

Tre DataChannel per ogni coppia, con semantiche diverse:

| Canale | Affidabilità | Uso |
|---|---|---|
| `ctrl` | ordinato, affidabile | handshake, frontiere, richieste, ack, presenza |
| `sync` | ordinato, affidabile | eventi, file a pezzi, batched |
| `live` | non ordinato, senza ritrasmissione | segnali effimeri: "sta scrivendo", cursori, stato chiamata |

Separare `live` da `sync` è ciò che permette a un segnale effimero di non bloccare la coda
dei dati persistenti, e viceversa a un trasferimento pesante di non gonfiare la latenza
della chat.

### 8.3 File

Trasferimento a pezzi (16-64 KB) con hash per pezzo e hash complessivo, riprendibile dopo
una disconnessione, con **controllo di flusso** via `bufferedAmountLowThreshold` — senza il
quale un file grande mangia la memoria del browser. Il contenuto non entra mai nel log: nel
log entra un evento `file/ref` con hash, dimensione, nome e tipo; i byte vivono in OPFS
(§6.4) e si scaricano su richiesta da chi li ha (con la stessa politica di replica della
stanza).

### 8.4 Il trasporto del futuro

**WebTransport** è diventato *Baseline Newly Available* nel marzo 2026 (Safari 26.4). Non
sostituisce WebRTC per la connessione tra browser (serve comunque l'hole punching), ma è
interessante per **il peer ancora e i relay**: una connessione QUIC verso un peer con IP
pubblico è più efficiente e più semplice da gestire di un DataChannel. Va tenuto d'occhio
per M6, sapendo che alcune reti aziendali bloccano UDP/QUIC e serve comunque un ripiego.

---

## 9. Sincronizzazione

### 9.1 Il problema in una riga

Due peer si incontrano: come fanno a sapere cosa manca a chi, senza trasmettersi tutto?

### 9.2 Frontiera

Per ogni coppia `(stanza, autore)` ogni peer conosce l'ultimo `seq` che possiede e l'hash
dell'evento a quel `seq`. L'insieme di queste coppie è la **frontiera**.

Alla connessione i due peer si scambiano la frontiera della stanza:

```
A → B:  { sp_7f3a: 42@b3:9f2a, sp_c5e1: 118@b3:aa10, … }
B → A:  { sp_7f3a: 40@b3:1c07, sp_c5e1: 118@b3:aa10, sp_bb02: 7@b3:01de }
```

Dal confronto:

- A ha gli eventi `41..42` di `sp_7f3a` che a B mancano → B li richiede;
- B ha `sp_bb02` (un autore che A non conosce affatto) → A lo scopre e lo richiede;
- `sp_c5e1` è identico → niente da fare.

Il costo del confronto è proporzionale al **numero di autori**, non al numero di eventi.
Questa è la proprietà che rende la sincronizzazione praticabile anche dopo assenze lunghe.

Se un autore è a `seq` molto distante, lo scambio avviene a **intervalli**, non evento per
evento: si richiede `(autore, da seq, a seq)` e si ricevono blocchi. Con una storia lunga si
confrontano prima gli hash a blocchi (struttura tipo Merkle) per capire dove divergono.

### 9.3 Gossip: come si tesse la tela

Questo è il punto che realizza "tutti hanno tutto" senza un server.

```
        A ────────────── B
         \              /
          \            /
           C ──────── D

A e D non si sono mai connessi. Ma A conosce la chat X, e D la riceve
attraverso B (o C), che fa da relay.
```

Un peer può chiedere a un vicino **eventi di un autore terzo**, purché entrambi appartengano
alla stessa stanza. Il vicino fa da relay: non è un server, è un favore che chiunque può
fare e chiunque può rifiutare.

Conseguenze da progettare, non da subire:

- **Costo del relay**: fare da ponte per una stanza grande consuma banda. Va reso visibile e
  configurabile (`relay: off | solo-connessi | completo`) e va misurato per peer.
- **Verifica sempre**: un relay può mentire o omettere, ma non può falsificare, perché ogni
  evento si verifica con firma e catena. Un relay disonesto si comporta al più come un peer
  lento. Questo è il motivo per cui il gossip è sicuro qui.
- **Anti-entropia**: oltre allo scambio all'apertura, un confronto periodico (es. ogni 5
  minuti) con i peer connessi guarisce le lacune createsi durante disconnessioni brevi.

Su internet esistono infrastrutture pubbliche che fanno già questo — i relay **Nostr**
(eventi già firmati, propagazione già gossip) e **Waku** — e sono candidate naturali a
diventare, in una fase successiva, un secondo canale di replica accanto alla mesh. Non in
v0: prima la tela deve funzionare tra peer veri.

### 9.4 Consegna e coda

```
modifica locale
   ├─ scrivi nel log locale          ← immediato, la UI non aspetta
   ├─ aggiorna la proiezione          ← immediato
   └─ accoda in outbox                ← da consegnare
          ↓ (peer connesso)
       invia su `sync` → attendi ack → rimuovi da outbox
          ↓ (nessun peer)
       resta in outbox, ritenta alla prossima connessione
```

L'ack è per peer, non globale: un evento è "consegnato" quando **tutti** i peer attuali
l'hanno. Non serve per la correttezza — serve solo a sapere cosa ritrasmettere.

### 9.5 Prova di convergenza

Il rischio più concreto di tutto il progetto è una divergenza silenziosa: due peer con gli
stessi eventi e stati diversi. Va reso impossibile per costruzione e verificato da un test
dedicato: un **fuzz test** che genera sequenze casuali di eventi concorrenti, le applica a
più repliche in ordini diversi, e verifica che le proiezioni finali siano identiche. Va
scritto **prima** dei moduli applicativi, non dopo.

---

## 10. Sicurezza

### 10.1 Modello di minaccia

| Minaccia | Difesa |
|---|---|
| Peer malevolo che riscrive la storia | catena `prev` + firma: impossibile senza la chiave |
| Peer che fabbrica messaggi altrui | firma: serve la chiave privata |
| Relay che altera o omette eventi | verifica di firma e catena a ogni ingresso; omissione = lentezza, non corruzione |
| Sito ostile che legge i dati locali | chiave privata non estraibile, nessun dato in chiaro fuori dall'origine |
| XSS nel rendering dei contenuti dei peer | **il rischio più concreto**: mai `innerHTML` di contenuto non fidato, sanitizzazione stretta, CSP severa |
| Sorgente di fiducia falsificata | numero di sicurezza da confrontare fuori banda |
| Estrazione dei dati da un dispositivo rubato | cifratura a riposo con passphrase opzionale (fase successiva) |
| Fornitore di signaling che osserva | Nostr/Trystero non vedono i dati applicativi; il TURN invece li vede (§7.3) |

### 10.2 Cifratura

- **Sempre**: firma. Ogni evento è autentico e integro.
- **Opzionale per stanza**: cifratura del corpo con chiave simmetrica di stanza (AES-GCM).
  La chiave viaggia nell'invito, quindi entra solo chi ha il link.
- **Per i media**, l'API giusta esiste ed è matura: **WebRTC Encoded Transform**
  (`RTCRtpScriptTransform`) è *Baseline Newly Available* da ottobre 2025 e permette la
  cifratura end-to-end dei flussi video/audio. Per una chiamata in una stanza già cifrata,
  è la strada corretta — e va prevista in fase di progetto del modulo call, perché
  aggiungerla dopo significa riscrivere la pipeline media.
- **Nota di trasparenza**: il traffico verso STUN e broker rivela gli indirizzi IP ai
  fornitori di quei servizi. Un relay TURN vede passare i byte. Su LAN: nessun terzo,
  nessun metadato. È la configurazione più privata, e va detto nell'interfaccia.

### 10.3 Modello di accesso alla stanza

Non esiste amministrazione centralizzata, quindi non esistono inviti revocabili nel senso
classico. Il modello onesto:

- entrare richiede l'invito (che contiene la chiave) → **chiuso per default**, niente spam;
- rimuovere qualcuno significa **ruotare la chiave della stanza** e ridistribuirla ai
  rimanenti: chi è stato rimosso perde l'accesso ai contenuti *futuri*, non a quelli già
  scaricati;
- ogni peer tiene una propria lista di blocco locale: non è una espulsione, è un rifiuto di
  parlare.

Va detto agli utenti nel modo più chiaro possibile. Un modello di moderazione che promette
più di questo è una bugia.

### 10.4 La cancellazione

Un evento non si cancella, si **ripudia** con un evento di tombstone: la proiezione lo
nasconde. Ma un peer che conserva i dati e ignora la richiesta li mantiene. In P2P la
cancellazione è una *richiesta*, non un comando. Le stanze con dati che devono essere
davvero cancellabili (sanitari, legali) non sono un buon caso d'uso per Black Spider, e
questo va scritto nella documentazione utente.

---

## 11. Offline, sospensione e peer sempre acceso

Questa sezione è stata riscritta dopo la ricerca: i comportamenti reali dei browser nel
2026 sono più aggressivi di quanto si tenda a supporre, e determinano il progetto.

### 11.1 Il punto debole §2.3 si risolve così

Un "peer ancora" è una scheda aperta che (a) partecipa a una o più stanze, (b) accetta di
ricevere e consegnare per conto di altri, (c) conserva la storia. Chiunque può esserlo: un
vecchio portatile, un Raspberry, un telefono lasciato in carica. **Non è un server**: è la
stessa PWA, con una spunta in più nelle impostazioni.

### 11.2 Cosa fanno davvero i browser (e cosa ne segue)

| Browser | Comportamento in background | Conseguenza di progetto |
|---|---|---|
| Chrome desktop | il throttling dei timer è **sospeso quando WebRTC è attivo** | un peer ancora è realistico |
| Firefox | timer inattivi a minimo 1 s, **non** throttlati se esiste un `AudioContext` | un peer ancora è realistico con un silenzio audio |
| **iOS Safari** | **distrugge lo stack WebRTC in background** — "connessioni zombie" | il ritorno va trattato come **riconnessione completa** via Page Visibility API; iOS **non può fare da peer ancora** |
| **Safari (storage)** | **eviction di tutto lo storage script-writable dopo 7 giorni di non uso**, tranne le **PWA installate** | **installare come app non è un consiglio, è un requisito** per non perdere i dati |

Misure concrete che ne derivano, da prendere in M1 e non dopo:

1. **`navigator.storage.persist()`** richiesto esplicitamente, e **invito esplicito a
   installare la PWA** — senza il quale Safari può cancellare tutto dopo 7 giorni. È il
   rischio di perdita dati più concreto del progetto e va comunicato all'utente nei termini
   giusti.
2. **Timer in un Web Worker**, non nel thread principale (che è throttlato).
3. **Page Visibility API**: al ritorno in primo piano si verifica lo stato di ogni
   connessione e si riconnette ciò che è morto. Non si assume mai che una connessione
   sopravvissuta alla sospensione sia ancora viva.
4. **`navigator.storage.estimate()`** a runtime per quote e avvisi — sapendo che il valore
   è approssimato di proposito (protezione dal fingerprinting) e che il tetto pratico è
   spesso la **RAM**, non il disco: ~100 MB comodi, ~1 GB al limite.

### 11.3 Quote reali

| Browser | Quota per origine (stime 2026) |
|---|---|
| Chrome / Edge | ~60% del disco |
| Firefox | ~10% (circa 50% con `persist()`) |
| Safari | ~60% (ma con l'eviction dei 7 giorni di §11.2) |

### 11.4 Push

Le notifiche push **non** richiedono un nostro backend: Web Push si appoggia comunque a un
push service, ma ci si può appoggiare a servizi gestiti o a funzioni serverless di terzi.
Su iOS richiede PWA installata e iOS ≥ 16.4. È una fase successiva, ma vale la pena sapere
che **il peer ancora può notificare** senza che il progetto smetta di essere "senza server
proprio".

---

## 12. Videocall

- **1:1**: banale una volta che il DataChannel esiste — stessa `RTCPeerConnection`, un
  `MediaStream` aggiunto con `addTrack`.
- **Gruppi piccoli**: la mesh di flussi regge **3-4 peer con video**, poi degrada. Il
  vincolo è **l'uplink**: ogni peer invia il proprio video a N−1 peer, quindi 4 peer sono
  ~1,5 Mbps di upload per ciascuno. Sostenibile su fibra, non su molte connessioni mobili.
  Oltre **10-12 peer** la mesh diventa problematica anche per soli dati.
- **Oltre**: serve un SFU, che è un server. L'unica alternativa coerente con "nessun server
  nostro" è un **peer che fa da relay** (riceve i flussi e li ridistribuisce): funziona se
  quel peer ha banda e stabilità, e va scelto esplicitamente. Fase successiva, non v0.
- **Degrado**: con più peer di quanti ne regga, la stanza deve proporre la modalità "audio +
  condivisione schermo" invece di fallire silenziosamente.
- **Cifratura dei media**: se la stanza è cifrata, i flussi vanno cifrati con WebRTC Encoded
  Transform (§10.2), previsto fin dal progetto del modulo.

### 12.1 Solo voce, come modalità di prima classe

La chiamata **a sola voce** non è una videocall con la telecamera spenta: è la modalità
predefinita, e il video è l'aggiunta.

- L'offerta contiene `m=audio` e nient'altro (`addTrack` di una sola traccia, nessun
  `m=video`). Una chiamata solo voce pesa circa **24-40 kbps** in Opus, contro 1,5 Mbps di
  un video: sta su qualunque uplink, ed è la ragione per cui è lei a essere il caso base e
  non il caso ridotto.
- Il bottone «Video» aggiunge la traccia a una chiamata in corso con una **rinegoziazione**
  (`addTrack` + nuova offerta sul canale dati già aperto). Non serve rifare l'invito: il
  canale dei dati c'è già, ci passa la rinegoziazione.
- Spegnere la telecamera **ferma la traccia** (`track.stop()`), non la mette in pausa: una
  traccia muta continua a consumare uplink, che è esattamente quello che una chiamata solo
  voce vuole evitare.
- Il degrado descritto sopra scende di conseguenza: prima si rinuncia al video, poi, se
  nemmeno l'audio passa, la chiamata si dichiara caduta invece di restare muta.

#### Dove vive la chiamata

La chiamata non è un secondo collegamento: è **la stessa `RTCPeerConnection`** che porta i
messaggi, con una traccia audio aggiunta sopra. Chi è già collegato non rifà l'invito —
l'invito è la parte che si scambia a mano — quindi il segnale della chiamata (`chiamata/chiedo`,
`chiamata/accetto`, `chiamata/negozia`, `chiamata/chiudo`) passa dentro il canale dati già
aperto. Il modulo è `js/chiamate.js`, e non ha un signaling suo.

Il microfono si chiede **quando si chiama**, non all'avvio dell'app: chi apre Black Spider per
leggere l'archivio non deve vedersi chiedere il permesso di ascoltare.

#### Le quattro scelte che sembrano dettagli

- **Il video è l'aggiunta, la voce è il caso base**, per la ragione di banda detta sopra.
- **Muto e spento sono due cose diverse.** Muto mette `enabled = false` sulla traccia: la
  traccia resta, la riga nella SDP resta, si riparla all'istante e non si rinegozia niente.
  Spegnere la telecamera **ferma** la traccia e la toglie dalla connessione, perché una
  telecamera accesa consuma uplink anche se l'immagine è ferma.
- **Chi risponde all'invito è il «polite» della negoziazione.** Una rinegoziazione può partire
  da entrambi i lati insieme — due che accendono la telecamera nello stesso istante — e in quel
  caso uno dei due deve ritirarsi. Cede chi ha *ricevuto* l'invito: è la stessa asimmetria che
  esiste già fra chi invita e chi risponde, riusata invece che inventata.
- **Niente trickle ICE.** I candidati si aspettano e l'SDP si manda intero, come fa già
  l'invito. Costa qualche decimo di secondo e toglie di mezzo una classe di guasti — il
  candidato che arriva prima della descrizione remota, la coda da tenere, l'ordine da
  rispettare — che altrimenti si paga in produzione.

#### La durata, a vista

La barra della chiamata mostra il nome sopra e la **durata sotto, in grande** (corpo 25, cifre
a larghezza fissa): la si guarda come su un telefono, non la si cerca in fondo a una frase. Il
tempo parte quando la chiamata è **in corso**, e non esiste negli altri due stati — chi squilla
non deve vedere un cronometro, e chi non ha ancora risposto nemmeno.

Una nota di dettaglio che non è un dettaglio: la durata si disegna con `font-variant-numeric:
tabular-nums`. Senza, ogni cifra ha la sua larghezza e il numero balla a ogni secondo che
cambia — un tremolio che in una schermata che si guarda di sfuggita si nota.

#### Il video arriva, ma non si vede

I byte di video in ingresso si contano, e sono la prova che il video **arriva**; ma
l'applicazione **non lo mostra**: non c'è nessun elemento `<video>` legato alla traccia in
ingresso. È una funzione che manca, non un guasto — e va detto perché la misura da sola non
poteva accorgersene: 62 controlli dicevano «il video arriva», e nessuno diceva «il video si
vede». Se n'è accorto `sguardo.py` (`app/prove/sguardo.py`), al primo giro in cui si è
*guardata* la chiamata invece di misurarla.

#### Verificato il 29 settembre 2026

In `app/prove/chiamata.html`, che **non chiama funzioni**: apre due esemplari dell'applicazione
vera in un riquadro e ne clicca i pulsanti — «Chiama», «Accetta», «Muto», «Video», «Riattacca».
Fra il pulsante e la funzione sta quasi tutto lo spazio in cui vivono i guasti veri.

| | misurato |
|---|---|
| la voce arriva | **8 763 byte in tre secondi** ≈ 23 kbps in Opus |
| il video, dopo aver acceso la telecamera | **70 977 byte** in tre secondi, **solo video** |
| dopo aver spento la telecamera | **0 byte** di video in tre secondi |
| a chi non manda video | non arriva nessuna traccia video |
| percorso | `host → host`, due browser, niente STUN, tutto dentro `127.0.0.1` |

62 controlli su 62. La differenza fra i due numeri — 23 kbps contro quasi dieci volte tanto —
è la ragione per cui la sola voce è il caso base e non il caso ridotto.

Il numero del video va letto con la sua avvertenza: **70 977 byte in tre secondi sono ≈ 190
kbps**, molto meno dei ~1,5 Mbps citati più sopra, perché il dispositivo finto di Chrome genera
un motivo sintetico che si comprime benissimo. Non è il video di una telecamera vera, che sta
molto più in alto. La misura dimostra che **arriva**, non quanto peserebbe una ripresa reale.

Poi la chiamata è stata **guardata**, non solo misurata: `sguardo.py` apre due browser veri, li
pilota sul protocollo DevTools e clicca i pulsanti con il mouse, fotografando il risultato. Ha
trovato tre cose che le asserzioni non potevano vedere — il video che arriva e non si disegna,
il pulsante «Chiama» che resta acceso per tutta la chiamata, e l'intestazione che sotto i 410 px
finisce sotto il chip dell'identità. Le ultime due sono state riparate e rimisurate; la prima è
la funzione mancante descritta sopra. «Funziona» e «si vede bene» sono due domande diverse, e
servono due strumenti diversi per rispondere.

#### Riusare l'invito? No, e vale la pena dire perché

Domanda che torna: si potrebbe salvare l'invito e la risposta e riusarli, invece di
riscambiarli? **No — e la ragione non è che le connessioni cambiano**, quella si capisce
subito. La ragione è che **l'invito non è un indirizzo: è il verbale di uno scambio già
avvenuto.** Contiene quattro cose che nascono nuove a ogni collegamento:

| nell'invito | perché non si può riusare |
|---|---|
| `a=ice-ufrag` / `a=ice-pwd` | credenziale dei controlli di connettività ICE: i due lati devono averla **uguale**. Uno parte con le nuove, l'altro tiene le vecchie → ICE non connette |
| `a=fingerprint` (DTLS) | una `RTCPeerConnection` nuova genera un **certificato nuovo**: l'impronta salvata non corrisponde più a quella presentata → handshake DTLS fallito |
| i candidati | i nomi `.local` ruotano, e la mappatura IP:porta che il router ha dato per quel flusso la riprende dopo poco |
| la versione della sessione (`o=`) | deve crescere a ogni offerta: riusata, è vecchia e viene scartata |

Riusare l'invito di ieri è riusare la **fotografia di una porta**, non la porta. L'unica cosa
che WebRTC sa rinegoziare è una connessione **ancora viva** — è così che funziona il pulsante
«Video» — ma vive quanto la pagina.

**Cosa si riusa davvero:** *chi* è l'altro e *per dove* vi siete trovati, non *come*. Serve un
**indirizzario** in IndexedDB, che a sua volta serve a far viaggiare la **nuova** offerta
attraverso i peer già collegati invece che a mano. Il primo invito resta manuale, quelli dopo
no. **I candidati non si salvano**: sono indizi, non verità.

Onestà necessaria: **la videocall di gruppo in mesh non è una promessa che si può fare a
cuor leggero**. Va progettata con un limite dichiarato e una via d'uscita (relay peer).
Vale però la distinzione: il video non è un problema per i gruppi *di sola voce* — 24 kbps a
testa reggono una maglia molto più larga di 1,5 Mbps a testa.

---

## 13. API interna e moduli

### 13.1 API

```js
await spider.ready;

spider.me                      // { id, nickname, publicKey }
spider.on('peer:join' | 'peer:leave' | 'event' | 'call:incoming' | 'file:progress', fn)

const room = await spider.rooms.create({ name, history: 'full' })
const room = await spider.rooms.join(inviteLink)
await spider.rooms.leave(room.id)
spider.rooms.share(room.id)    // genera il link/QR di invito

spider.peers.list()            // { id, nickname, connected, relay, rtt }
spider.peers.block(id)

await spider.db.put(room.id, 'notes', { id, text })   // scrive nel log + proietta
spider.db.get(room.id, 'notes', id)
spider.db.query(room.id, 'notes', { where, order, limit })
spider.db.subscribe(room.id, 'notes', fn)             // notifica le modifiche

spider.files.send(room.id, file)      // → evento file/ref + trasferimento
spider.files.fetch(hash)

spider.call.start(peerIds, { video: true, audio: true })
```

Il modulo applicativo **non tocca mai** IndexedDB direttamente: usa `spider.db`. Questo è
ciò che permette di cambiare lo schema di persistenza senza riscrivere le app.

### 13.2 Moduli

Un modulo dichiara chi è, che tipi di evento produce, come si riduce lo stato e come si
disegna:

```js
spider.apps.define({
  id: 'chat',
  name: 'Chat',
  icon: '…',
  eventTypes: ['chat/msg', 'chat/edit', 'chat/delete', 'chat/react'],
  reduce(state, event) { /* deterministico, puro */ return stato },
  views: { main: ChatView },
  styles: '…',
  quota: { blobs: '100MB' }
})
```

L'isolamento percorre tre gradini, ed è importante che il primo sia **già** della forma
giusta:

1. **v0 — moduli interni, stessa origine.** Codice nostro, spedito con la PWA. Nessun
   confine di sicurezza, solo un confine di API e di disciplina.
2. **v1 — stato separato.** Ogni modulo ha il proprio store `apps/<id>` con quota, così un
   modulo non può gonfiare o corrompere gli altri.
3. **v2 — iframe sandboxato.** Moduli di terzi girano in un iframe con origine separata e
   parlano con il core via `postMessage`, con un bridge che espone **la stessa identica
   API** `spider.db`. Poiché l'API è già asincrona e serializzabile, la migrazione è
   meccanica — questa è la ragione per cui la scelta "PWA con moduli interni" è quella
   giusta: non chiude la porta all'apertura, la prepara.

### 13.3 Moduli previsti

| Modulo | Priorità | Note |
|---|---|---|
| Chat | v0 | testo, risposte, reazioni, presenza, "sta scrivendo" |
| Call | v1 | **fatto, dentro l'app**: solo voce per difetto (§12.1), telecamera accesa e spenta a chiamata avviata, **durata a vista** come su un telefono, sulla stessa connessione della chat. **Manca il disegno del video ricevuto**: i byte si contano, l'immagine non si mostra. Restano i gruppi piccoli e Encoded Transform. Provato: `app/prove/chiamata.html` |
| File | v1 | invio, ricezione, ripresa, quota, OPFS |
| Bacheca | v1 | stato condiviso modificabile (editor collaborativo semplice) |
| Blocchi | v2 | note/liste condivise, buon caso di test per lo stato mutabile e per Yjs |
| Moduli di terzi | v2 | sandbox + bridge |

---

## 14. Rischi, e le prove da fare prima

### 14.1 Le quattro prove che decidono tutto

Da fare **prima** di scrivere l'architettura definitiva del codice. Sono esperimenti di
mezza giornata l'uno, e se uno fallisce cambia il progetto.

1. **L'invito funziona?** Due browser diversi, in luoghi diversi, si connettono scambiandosi
   solo un link e un codice di ritorno? Attenzione ai timeout ICE di Firefox (~5 s):
   verificare con ICE gathering completo e non-trickle. (Se fallisce, §7.1 crolla e tutto
   il resto dipende dal broker.)
2. **La LAN è davvero libera?** Due dispositivi sulla stessa Wi-Fi si connettono con il solo
   invito, internet scollegato? (Se no, "funziona anche in aereo" è falso.)
3. **La scheda in background tiene?** Una scheda non in primo piano mantiene un DataChannel
   attivo e reattivo per ore, su Chrome desktop e su Android? E su iOS: la riconnessione al
   ritorno in primo piano funziona con lo schema di §11.2? (Se no, §11 va ridimensionato.)
4. **Quale TURN gratuito regge?** Verificare empiricamente la quota reale di Cloudflare
   Realtime (la cifra di 1.000 GB/mese è di fonte comunitaria) e provare Metered Open Relay.
   Provare anche a **misurare la percentuale di fallimenti senza TURN** sulle proprie reti,
   invece di fidarsi della statistica.

E una quinta, che non decide l'architettura ma decide se ci si crede: **si vede bene?** Le
quattro qui sopra dicono se il meccanismo regge; non dicono se la schermata è comprensibile,
se il pulsante è al posto giusto, se il numero si legge. Sono due domande diverse e vogliono
due strumenti diversi — le asserzioni e gli occhi. Per la chiamata il secondo strumento è
`app/prove/sguardo.py`, e al primo giro ha trovato quello che le 62 asserzioni non vedevano
(§12.1).

### 14.2 Rischi

| Rischio | Gravità | Mitigazione |
|---|---|---|
| **Perdita di dati per eviction (Safari 7 giorni)** | critica | `persist()` + PWA installata obbligatoria, avviso in interfaccia |
| Divergenza silenziosa tra repliche | critica | `reduce` puro + fuzz test di convergenza, prima di ogni app |
| La tela non si estende (gossip inaffidabile) | alta | politica di replica per stanza, relay misurabile, orizzonte di storia |
| NAT ostili senza TURN (~20% delle sessioni) | alta | STUN multiplo, TURN configurabile, LAN come strada maestra, dichiarare i fallimenti |
| XSS nel contenuto dei peer | alta | sanitizzazione rigorosa, CSP, chiavi non estraibili |
| Dipendenza da un broker di terzi che sparisce | media | l'astrazione Trystero esiste già: tenere una seconda strategia pronta |
| Consumo di spazio senza limite | media | `persist()`, quote per stanza e per modulo, compattazione, `estimate()` a runtime |
| Complessità del log che uccide la voglia | media | prototipi piccoli e dimostrabili a ogni tappa (§15) |
| Aspettative troppo larghe (video di gruppo, tante persone) | media | limiti dichiarati nel prodotto, non solo nel documento |

---

## 15. Roadmap

Ogni tappa è **dimostrabile**: se non si può mostrare qualcosa che funziona, la tappa è
troppo grande.

| Tappa | Cosa | Si dimostra con |
|---|---|---|
| **M0** | Identità, persistenza, log, firme, proiezione, Web Locks multi-scheda | test in un browser: log firmato, verifica, riduzione, convergenza |
| **M0.5** | **Le quattro prove di §14.1** | due dispositivi, LAN e internet |
| **M1** | Invito + DataChannel + handshake + sincronizzazione di un log | due peer si scambiano una chat fra due browser |
| **M2** | Modulo Chat: stanze, presenza, outbox, riconnessione, avvisi di persistenza | chat fra tre peer, uno dei quali va offline e torna |
| **M3** | Gossip e relay | A e C, mai connessi, si sincronizzano via B |
| **M4** | File su OPFS | invio di un file grande, ripresa dopo disconnessione |
| **M5** | Call | video 1:1, poi gruppo di 3-4, con cifratura dei media |
| **M6** | Peer ancora | una scheda su un PC dimenticato consegna i messaggi |
| **M7** | Apertura ai moduli di terzi | un modulo esterno in iframe sandboxato |

`M0.5` è volutamente prima di `M1`: sono le prove che possono ribaltare le scelte di §7 e §11,
e costano poco rispetto al prezzo di scoprirle tardi.

---

## 16. Distribuzione

- **PWA statica**: nessun backend, nessun processo, nessun dominio da amministrare.
  Pubblicabile su GitHub Pages come gli altri progetti.
- **Installazione obbligatoria**, non opzionale: è l'unico modo di non perdere i dati su
  Safari (§11.2). L'app deve proporla nel momento giusto e spiegare perché.
- **Service worker** per l'uso offline: dopo il primo caricamento Black Spider funziona
  anche senza internet, coerente con §7.1.
- **Senza build obbligatoria**: moduli ES nativi, così chiunque può leggere e modificare il
  codice senza toolchain — scelta coerente con uno strumento che promette indipendenza.
- **Licenza**: da decidere (AGPL-3.0 è coerente con lo spirito del progetto, come per
  Logyx; da confermare).

---

## 17. Questioni aperte

Da decidere, non da rimandare troppo.

1. **Orizzonte di storia** (§6.5): quanto passato ha un nuovo arrivato? È la decisione che
   pesa di più sull'esperienza e non ha una risposta ovvia.
2. **Cifratura di default o opt-in?** Opt-in è più semplice, ma il default insegna il
   modello; un default sbagliato è difficile da cambiare dopo.
3. **Chi paga il TURN, e come si dice all'utente**: si documenta il TURN gratuito di terzi
   come strada consigliata, o si accetta il 20% di connessioni fallite? La risposta cambia
   la percezione di affidabilità del prodotto.
4. **Nome e identità visiva**: "Black Spider" resta? (nota: "spider" richiama anche lo
   spider del web, bel doppio senso per un progetto di ragnatele e di crawling).
5. **Relay di default**: attivo o spento? Attivo aiuta la tela, spento rispetta la banda.
6. **Multi-dispositivo**: quando, e se prima o dopo i moduli di terzi.
7. **Cosa si fa quando due identità hanno lo stesso soprannome** e l'utente non vuole
   confrontare i numeri di sicurezza: quale default è meno pericoloso?

---

## Appendice A — Glossario

| Termine | Significato |
|---|---|
| **Peer** | un browser con un'identità Black Spider |
| **Stanza** (`room`) | contesto condiviso con una propria chiave e politica di replica |
| **Evento** | unità immutabile, firmata e concatenata, che modifica lo stato |
| **Frontiera** | per ogni autore, l'ultimo evento posseduto; serve a calcolare cosa manca |
| **Proiezione** | lo stato attuale, ottenuto riducendo il log |
| **Peer ancora** | peer che resta acceso per conservare e consegnare per conto di altri |
| **Relay** | peer che inoltra eventi di terzi senza esserne l'autore |
| **Tela** | l'insieme delle connessioni e delle repliche: la rete stessa |
| **OPFS** | Origin Private File System: file system privato dell'origine, per i grandi binari |
| **HLC** | Hybrid Logical Clock: orologio logico che tiene conto del tempo fisico |

---

## Appendice B — Fonti e cose da riverificare

Le informazioni che seguono provengono da una ricerca sul panorama 2025-2026. **Vanno
riverificate prima delle decisioni definitive**: in questo settore sei mesi cambiano le
risposte.

### Da verificare con priorità

1. **Quota gratuita di Cloudflare Realtime TURN** (la cifra di 1.000 GB/mese è di fonte
   comunitaria, non ufficiale).
2. ~~Supporto di Ed25519 in WebCrypto~~ — **chiuso**: confermato su tutti e tre i motori
   (§5.1).
3. **Stato reale di `signaling.yjs.dev`** e mantenimento di `y-webrtc`.
4. **Broker MQTT pubblici**: nessuna lista affidabile trovata, solo verifica empirica.

### Riferimenti utili

| Tema | Riferimento |
|---|---|
| Handshake via QR/URL | QWBP (github.com/magarcia/qwbp), `webrtc-via-qr`, ThinAir |
| Signaling multipiattaforma | Trystero (github.com/dmotz/trystero), strategia Nostr |
| Gossip firmato (modelli) | Secure Scuttlebutt, Willow / Earthstar |
| CRDT per moduli | Yjs (+ `y-indexeddb`), Automerge 3, Loro |
| TURN gratuito | Metered Open Relay, Cloudflare Realtime, Hugging Face + FastRTC |
| Quote e persistenza | MDN Storage quotas; `navigator.storage.persist()` |
| Media cifrati | WebRTC Encoded Transform (`RTCRtpScriptTransform`) |
| Trasporto futuro | WebTransport (Baseline da marzo 2026) |
