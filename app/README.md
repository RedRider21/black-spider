# Black Spider — l'applicazione

Due browser che si parlano direttamente. **Nessun server**, nostro o di altri: i
messaggi passano da una finestra all'altra, e tutto quello che viene scritto
resta nel browser di chi l'ha scritto.

Questa cartella è la prima applicazione costruita sull'architettura descritta in
[`../ARCHITETTURA.md`](../ARCHITETTURA.md) — che è il documento dove sta tutto il
ragionamento, e dove guardare quando qui c'è scritto troppo poco. L'app è
volutamente la cosa più piccola che funziona davvero: una stanza sola, due
persone, messaggi firmati, storico che sopravvive alla chiusura della pagina.

## Com'è fatta

Non è una pagina con dentro una chat: è un **guscio** con dentro più
applicazioni, una accanto all'altra.

- **Menu laterale in verticale**, con icona e scritta per ogni sezione. Si
  comprime a sole icone con il pulsante in alto a sinistra; su schermo stretto
  diventa un cassetto che esce da sinistra e si chiude toccando fuori.
- **Cinque sezioni:** Chat, Persone, Archivio, App, Impostazioni. Sono tutte
  proiezioni della stessa cosa — il log — guardato da punti di vista diversi.
- **Tema chiaro e scuro**, in tre scelte: *auto* (segue il sistema), *chiaro*,
  *scuro*. La scelta è ricordata e applicata **prima** che la pagina si disegni,
  quindi non si vede il lampo del tema sbagliato.
- **Italiano e inglese**, commutabili a caldo: cambia anche il titolo della
  finestra e lo stato della connessione, non solo le scritte ferme.
- **Flat e responsivo**: nessuna ombra, nessun gradiente, una sola famiglia di
  caratteri; la stessa pagina su un telefono e su un monitor, senza una seconda
  versione da tenere allineata.

Le preferenze (tema, lingua, barra) stanno in `localStorage` e non in IndexedDB:
sono scelte di *questo dispositivo*, non dati dell'utente, e vanno lette in modo
sincrono prima del primo disegno. Identità e archivio stanno in IndexedDB, che è
dove vanno le cose che contano.

## Cosa c'è dentro

| file | cosa fa |
|---|---|
| `index.html` | il guscio: testata, menu, cinque sezioni |
| `stile.css` | l'aspetto, tema chiaro e scuro dalla stessa dichiarazione |
| `js/lingua.js` | i due dizionari e la traduzione delle scritte |
| `js/preferenze.js` | tema, lingua e larghezza della barra, ricordati |
| `manifest.webmanifest` | fa installare l'app come applicazione vera |
| `sw.js` | la rende apribile senza rete |
| `icone/` | il marchio e le icone, con `genera.py` che le ridisegna |
| `js/archivio.js` | IndexedDB: dove vivono gli eventi |
| `js/identita.js` | chiavi, firma, `spiderId` |
| `js/eventi.js` | il log firmato: orologio, eventi, verifica |
| `js/invito.js` | i due codici da scambiarsi, e le statistiche del collegamento |
| `js/trasporto.js` | il canale dati, a pezzi quando i messaggi sono lunghi |
| `js/sincronizzazione.js` | lo scambio: cosa manca all'altro, e la verifica di ciò che arriva |
| `js/app.js` | lega tutto: le sezioni, i temi, le lingue, e parla con la pagina |
| `prove/` | le prove, che aprono l'app vera |

## Come si prova

Serve un server locale — i moduli ES e il service worker non funzionano da
`file://` — e due finestre, perché **una** finestra non può parlare con sé
stessa in modo onesto.

```sh
cd app
python3 -m http.server 8765 --bind 127.0.0.1
```

Poi si aprono due finestre diverse (una normale e una in incognito, o due
profili) su <http://127.0.0.1:8765/>:

1. nella prima, «Crea un invito»;
2. si copia il link e lo si incolla nella seconda, che preme «Prepara la risposta»;
3. si copia il codice di ritorno e lo si incolla nella prima, che preme
   «Completa il collegamento».

Il codice d'invito va scambiato **fuori**: a voce, per messaggio, per email. Non
c'è nessun server che lo faccia al posto vostro — è il prezzo, ed è anche il
punto, di un'app che non ha un server. È l'unico momento in cui qualcosa passa da
fuori, e passa da fuori davvero, a mano.

La casella «Prova anche attraverso internet» fa usare i server STUN di Google.
Senza, si resta dentro la rete locale. Con, due browser su reti diverse hanno una
possibilità di trovarsi; in entrambi i casi i messaggi, se si trovano, vanno
dritti da uno all'altro.

Il server locale serve a consegnare i file, non a far parlare le due finestre. Si
può spegnere dopo aver caricato la pagina: l'app continua a funzionare, perché il
service worker tiene una copia dei suoi file.

## Le prove

Le pagine in `prove/` aprono l'app vera in un riquadro e la usano come la userebbe
una persona: premono i pulsanti del menu, cambiano tema, cambiano lingua,
riempiono i campi. Non chiamano le funzioni di sotto — è lì, fra il pulsante e la
funzione, che stanno quasi tutti i guasti.

| prova | cosa verifica |
|---|---|
| `m0.html` | le fondamenta: firme, catene, orologi, archivio (26 controlli) |
| `avvio.html` | che l'applicazione si accenda: identità, archivio, service worker, menu, temi, lingue, manifesto, icone |
| `collegamento.html` | il collegamento vero fra due browser, lo scambio di messaggi, la sopravvivenza al ricaricamento |
| `stile.html` | un campione del foglio di stile con tutti i pezzi in vista — anche quelli che si vedono solo a conversazione avviata |

`collegamento.html` va aperta in due esemplari — `?ruolo=A` e `?ruolo=B` — in due
profili diversi, con un piccolo server che fa da punto d'incontro per i due
codici (`prove/server.py`).

Le prove non cercano frasi italiane nel registro: le frasi cambiano con la
lingua, e una prova che si rompe traducendo l'app non segnala un guasto, segnala
sé stessa. Cercano i segni che l'app lascia su `body` — `data-pronto`,
`data-eventi`, `data-sw` — che sono uguali in tutte le lingue.

**Ultimo esito, 2026-09-29:** due processi Chrome separati, profili separati,
identità separate. Invito → risposta → canale aperto in circa un secondo, in
diretto (`host`), 2 ms di andata e ritorno. Messaggio da A a B, risposta da B ad
A, ricarica di B: i due messaggi erano ancora lì, e nessun evento duplicato.
21 controlli su 21, in entrambi i ruoli.

## Le scelte, e perché

**Niente server.** Il codice d'invito è l'unico momento in cui qualcosa passa da
fuori, e passa da fuori davvero, a mano.

**La chiave privata non è estraibile.** `js/identita.js` genera la chiave
estraibile, ne esporta le due parti, e reimporta la privata come **non
estraibile**. La copia esportata viene azzerata subito dopo. Da lì in poi la
chiave firma ma non si può leggere: un difetto nella pagina non basta a portarla
via. Il `spiderId` è l'impronta della chiave pubblica, quindi non cambia mai.

**Il nome è un evento come gli altri**, e vive in un posto solo: la scheda
dell'identità. Un nome scritto in due posti è un nome sbagliato in uno dei due.

**Il log è la verità.** Chat, persone e archivio mostrano la stessa cosa: il log.
Tenerli come tre copie separate era il modo più rapido di farle divergere.

**Tema chiaro e scuro dalla stessa dichiarazione.** La palette si scrive una
volta con `light-dark(chiaro, scuro)`; quale delle due si veda lo decide
`color-scheme`. Due blocchi separati andrebbero tenuti allineati a mano, e prima
o poi uno dei due resta indietro. Chi non conosce `light-dark()` trova una
dichiarazione di riserva, scura.

**Il testo tradotto non sta nel HTML.** Sta in `js/lingua.js`, e la pagina lo
dichiara con `data-i18n`. Una scritta nuova nella pagina e non nel dizionario si
vede subito, perché resta in italiano anche in inglese.

## Le applicazioni previste

Il guscio è pensato perché le applicazioni si aggiungano una alla volta, sopra
gli stessi pezzi. La chat c'è; le altre sono progettate e non ancora costruite —
lo stesso elenco, con le stesse priorità, sta in `ARCHITETTURA.md` §13.3.

| applicazione | quando | a cosa si appoggia |
|---|---|---|
| **Chat** | c'è | testo, firme, storico. Con tre o più persone è un gruppo: la sincronizzazione è già simmetrica |
| **File** | dopo | il canale dati già spezza i messaggi lunghi in pezzi, che è la parte difficile |
| **Chiamate** | dopo | la stessa connessione che oggi porta i messaggi porta anche il flusso della videocamera. In due è quasi banale; è nei gruppi che diventa un problema di banda |
| **Bacheca** | dopo | uno stato condiviso che più persone modificano: un editor semplice |
| **Blocchi** | dopo | note e liste fatte di pezzi. Il caso di prova più duro per uno stato che cambia mentre lo si guarda |

**La videocall c'è, ed è prevista.** Vale la pena dire come, perché la differenza
fra una promessa e un progetto sta qui:

- **in due** è quasi banale una volta che il canale dati esiste: è la stessa
  `RTCPeerConnection`, e il flusso si aggiunge con `addTrack`;
- **in tre o quattro** si può, con una rete a maglia: ogni partecipante manda il
  proprio video a tutti gli altri. Regge su fibra, non su molte connessioni
  mobili — perché ognuno paga N−1 volte l'uscita;
- **oltre** la maglia non basta. Servirebbe un server, e un server è esattamente
  la cosa che questo progetto non ha. L'unica via coerente resta un **peer che fa
  da ponte**: riceve i flussi e li ridistribuisce. Funziona se quel peer ha banda
  e stabilità, e va scelto esplicitamente, non deciso dal codice;
- **quando la banda non basta**, la stanza deve proporre «audio e schermo»
  invece di peggiorare in silenzio.

Quindi: la chiamata a due è una conseguenza diretta di quello che c'è già; la
chiamata di gruppo è una cosa che si può fare **con un limite dichiarato e una
via d'uscita**, non a cuor leggero.

## Cosa manca

- **Il gruppo**, appunto: tre o più persone nella stessa stanza. La
  sincronizzazione è già simmetrica, quindi non è un altro protocollo — ma non è
  stato provato, e finché non lo è non è vero.
- **Le chiavi si imparano solo dai peer connessi.** Se arriva un evento di un
  autore sconosciuto, resta in attesa invece di essere creduto. Funziona, ed è il
  motivo per cui `sincronizzazione.js` ha una coda `inAttesa`; la versione con
  gossip dovrà chiedere le chiavi mancanti a chi le ha.
- **Niente cifratura dei contenuti.** Le firme dicono *chi* ha scritto, non
  *nascondono cosa*. Fra due browser che parlano in WebRTC il canale è già
  cifrato in transito, ma gli eventi in chiaro restano nell'archivio, e chi
  esporta il proprio archivio esporta tutto.
- **Niente notifiche.** Con un'app che non ha un server non c'è nessun push da
  ricevere: una notifica può solo nascere da una pagina aperta.
