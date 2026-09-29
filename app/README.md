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
| `js/chiamate.js` | la chiamata: la traccia audio, il video come aggiunta, e la negoziazione |
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
| `chiamata.html` | la **chiamata dentro l'app**: due esemplari dell'applicazione vera, che si chiamano cliccando i loro pulsanti — squillo, accetta, muto, telecamera accesa e spenta, riattacca |
| `stile.html` | un campione del foglio di stile con tutti i pezzi in vista — anche quelli che si vedono solo a conversazione avviata |

`collegamento.html` e `chiamata.html` vanno aperte in due esemplari — `?ruolo=A` e
`?ruolo=B` — in due profili diversi, con un piccolo server che fa da punto
d'incontro per i due codici (`prove/server.py`). La chiamata ha bisogno in più di
un microfono finto, che nei browser comandati da `prove.sh` è già previsto.

Il modo più semplice per eseguirle tutte resta `./prove.sh` dalla cartella di
progetto, che avvia il server se non c'è, aspetta i risultati e dice il verdetto.

Le prove non cercano frasi italiane nel registro: le frasi cambiano con la
lingua, e una prova che si rompe traducendo l'app non segnala un guasto, segnala
sé stessa. Cercano i segni che l'app lascia su `body` — `data-pronto`,
`data-eventi`, `data-sw` — che sono uguali in tutte le lingue.

**Ultimo esito, 2026-09-29.** Due processi Chrome separati, profili separati,
identità separate.

*Collegamento.* Invito → risposta → canale aperto in circa un secondo, in diretto
(`host`), 2 ms di andata e ritorno. Messaggio da A a B, risposta da B ad A,
ricarica di B: i due messaggi erano ancora lì, e nessun evento duplicato.
21 controlli su 21.

*Chiamata.* La voce arriva: **8 763 byte in tre secondi**, cioè ≈23 kbps in Opus —
lo stesso ordine dei 24-40 dichiarati. Accendendo la telecamera, solo per il
video ne arrivano **70 977** negli stessi tre secondi, e **zero** dopo averla
spenta. Niente STUN, microfono finto, tutto dentro `127.0.0.1`. 62 controlli su
62 (36 in un ruolo, 26 nell'altro).

Un numero vale più di una frase: la voce costa 23 kbps e il video quasi dieci
volte tanto. È quella differenza che rende la sola voce il caso base e il video
l'aggiunta.

## La chiamata, e perché è fatta così

La chiamata non è un secondo collegamento: è **la stessa connessione** che porta
i messaggi, con una traccia audio aggiunta sopra. Chi è già collegato non rifà
l'invito — l'invito è la parte cara, quella che si scambia a mano — quindi il
segnale della chiamata passa dentro il canale dati che è già aperto. Il pulsante
«Chiama» è il primo momento in cui l'app chiede il microfono: chi apre Black
Spider per leggere l'archivio non deve vedersi chiedere il permesso di ascoltare.

Quattro scelte che sembrano dettagli e non lo sono.

**Solo voce per difetto, il video è l'aggiunta.** Una voce in Opus costa 24-40
kbps, un video quasi dieci volte tanto — e i due numeri sono misurati, non
stimati. L'offerta di una chiamata vocale contiene `m=audio` e nient'altro; il
pulsante «Video» aggiunge la traccia dopo, a chiamata avviata, con una
rinegoziazione. Non è una modalità ridotta: è il caso base, perché sta su
qualunque uplink.

**Muto e spento sono due cose diverse.** *Muto* mette `enabled = false` sulla
traccia: la traccia resta, la riga resta, si torna a parlare all'istante e non si
rinegozia niente. *Spegnere la telecamera* invece **ferma** la traccia e la toglie
dalla connessione, perché una telecamera accesa consuma uplink anche se
l'immagine è ferma — e l'uplink è esattamente quello che una chiamata a sola voce
vuole risparmiare. La differenza si misura: dopo aver spento, i byte di video in
ingresso sono **zero**.

**Chi risponde all'invito è quello che cede.** Serve perché una rinegoziazione può
partire da entrambi i lati insieme — due che accendono la telecamera nello stesso
istante — e in quel caso uno dei due deve ritirarsi. Cede chi ha *ricevuto*
l'invito: è la stessa asimmetria che c'è già fra chi invita e chi risponde,
riusata invece che inventata.

**Niente trickle ICE.** I candidati si aspettano e l'SDP si manda intero, come fa
già l'invito. Costa qualche decimo di secondo e toglie di mezzo una classe intera
di guasti — il candidato che arriva prima della descrizione remota, la coda da
tenere, l'ordine da rispettare — che altrimenti si paga in produzione, sotto
forma di chiamate che si connettono una volta su tre.

**Una traccia che arriva non è una voce che si sente.** L'audio in ingresso va
dato a un elemento `<audio>`: senza, la traccia arriva, i byte passano, e non si
sente niente. E il numero che conta non è «connesso»: è quanti byte sono arrivati
davvero, perché una traccia collegata con zero byte è il guasto classico delle
chiamate WebRTC — si vede il nome dell'altro e non si sente nulla.

## Le due domande che tornano sempre

### Servono server STUN esterni?

**No, in tre casi su quattro.**

| situazione | serve uno STUN? |
|---|---|
| stessa macchina, o stessa rete locale | **no** — bastano i candidati `host`, l'indirizzo locale |
| due dispositivi sulla stessa LAN, anche con NAT | **quasi mai** |
| reti diverse, dietro NAT | **sì**, per conoscere il proprio indirizzo pubblico; poi il traffico va diretto |
| NAT simmetrico da entrambi i lati | lo STUN non basta: serve un **relay** (TURN) |

Uno STUN serve solo quando i due peer sono su reti diverse **e tutte e due dietro
un NAT**: in quel caso nessuno dei due conosce il proprio indirizzo come lo vede
il mondo, e solo uno STUN glielo può dire.

**Cosa vede uno STUN: niente contenuto.** Gli si chiede «da che indirizzo mi
vedi?» e risponde con la tua coppia IP:porta pubblica. Nessun pacchetto dei tuoi
dati passa di lì. Sa però che quella coppia esiste e in quel momento: è
**metadato**, e va detto.

Nell'app lo STUN è **spento per difetto** — la casella non è preselezionata.
Senza la casella, creare un invito non contatta nessuno. Tutte le prove girano a
STUN spento e dentro `127.0.0.1`, quindi non esce niente dalla macchina.

### Stiamo cifrando le comunicazioni, o usiamo solo HTTPS?

**Le comunicazioni sono cifrate *fra i due browser*, non verso un server — e
questo è più forte di HTTPS, non più debole.**

- WebRTC cifra **sempre**, e non è una scelta: i dati viaggiano in **DTLS**, i
  media in **SRTP**, punto a punto. Nessun intermediario può leggerli, perché non
  c'è nessun intermediario.
- **HTTPS protegge la consegna della pagina, non il contenuto della
  conversazione.** Qui il contenuto non passa da nessun HTTP.
- Le **firme** (Ed25519) dicono *chi* ha scritto. Non nascondono *cosa*: firma e
  cifratura sono due cose diverse, e il progetto ha la prima, non ancora la
  seconda.
- **Quello che manca davvero è la cifratura a riposo.** Il canale è cifrato, ma
  gli eventi restano **in chiaro dentro IndexedDB**: chi esporta il proprio
  archivio esporta tutto.
- Il **metadato**: chi passa da un relay TURN non fa leggere il contenuto, ma
  dice a quel relay chi parla con chi, quando e quanto. Non è un difetto
  correggibile — è il prezzo di un relay.

## Perché non si può riusare lo stesso invito

Domanda giusta, e la risposta non è «le connessioni cambiano». È che **l'invito
non è un indirizzo: è il verbale di uno scambio già avvenuto.** Dentro ci sono
quattro cose che nascono nuove a ogni collegamento:

| nell'invito | perché non si può riusare |
|---|---|
| `a=ice-ufrag` / `a=ice-pwd` | sono la credenziale dei controlli di connettività ICE: i due lati devono averle **uguali**. Tu parti con le nuove, l'altro tiene le vecchie, e ICE non connette |
| `a=fingerprint` (DTLS) | un `RTCPeerConnection` nuovo genera un **certificato nuovo**: l'impronta salvata non corrisponde più a quella che l'altro presenta, e l'handshake DTLS fallisce |
| i candidati | i nomi `.local` degli indirizzi locali ruotano, e la mappatura IP:porta che il router ha dato per quel flusso la riprende dopo poco |
| la versione della sessione (`o=`) | deve crescere a ogni offerta: riusata, è una versione vecchia e viene scartata |

Riusare l'invito di ieri è riusare la **fotografia di una porta**, non la porta.

**Cosa si riusa davvero:** *chi* è l'altro e *per dove* vi siete trovati — non
*come*. Quindi la strada giusta è un **indirizzario** in IndexedDB (`spiderId`,
chiave pubblica, nome, quando vi siete parlati, che percorso aveva funzionato),
che serve a far viaggiare la **nuova** offerta attraverso i peer già collegati
invece che a mano. Il primo invito resta manuale; quelli dopo no. **I candidati
non si salvano**: sono indizi, non verità.

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
| **Chiamate** | **c'è, dentro l'app**: solo voce fra due, con la telecamera che si accende e si spegne a chiamata avviata | la stessa connessione che porta i messaggi porta anche il suono — nessun secondo invito. Misurata in `prove/chiamata.html`; sono i gruppi, non il video, a diventare un problema di banda |
| **File** | dopo | il canale dati già spezza i messaggi lunghi in pezzi, che è la parte difficile |
| **Bacheca** | dopo | uno stato condiviso che più persone modificano: un editor semplice |
| **Blocchi** | dopo | note e liste fatte di pezzi. Il caso di prova più duro per uno stato che cambia mentre lo si guarda |

**La chiamata in due c'è.** Vale la pena dire cosa succede oltre, perché la
differenza fra una promessa e un progetto sta qui:

- **in due** è quasi banale una volta che il canale dati esiste: è la stessa
  `RTCPeerConnection`, e il flusso si aggiunge con `addTrack`. È fatto e misurato;
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

- **L'indirizzario.** Oggi per parlare con qualcuno si rifà lo scambio a mano,
  ogni volta. Salvando in IndexedDB chi si è incontrato e per quale percorso
  (vedi «Perché non si può riusare lo stesso invito»), l'offerta **nuova** può
  viaggiare attraverso i peer già collegati invece che a mano.
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
- **Niente notifiche a applicazione chiusa.** Mentre l'app è aperta si possono
  fare senza nessuno. A scheda chiusa non c'è codice in esecuzione e niente può
  svegliarlo: le notifiche push richiedono un *servizio* di push — quello di
  Mozilla per Firefox, quello di Google per Chrome — cioè un server di qualcun
  altro, che vedrebbe quando arriva un messaggio e quanto è grande. Il contenuto
  no, è cifrato; il metadato sì. Non è un difetto aggirabile: è come è fatta la
  piattaforma web.
