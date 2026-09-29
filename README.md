# Black Spider

Una **rete peer-to-peer tra browser**. Nessun server, nessun account, nessun operatore che
custodisce i tuoi dati: ogni browser tiene il proprio database in locale, i peer si
connettono direttamente via WebRTC e si scambiano le modifiche.

Il ragno non ha un centro: la tela regge perché è magliata.

La prima applicazione costruita sopra questa architettura — una chat fra due browser — **è
fatta e verificata**. Il resto è progetto.

---

## Usarla adesso

**<https://redrider21.github.io/black-spider/app/>** — l'applicazione è pubblicata su GitHub
Pages e funziona così com'è, senza installare e senza avviare niente.

Per far parlare due browser bisogna aprirne due — **uno normale e uno in incognito**, o due
profili diversi — e scambiarsi il codice d'invito a mano (a voce, per messaggio, per email):
è l'unico momento in cui qualcosa passa da fuori, ed è anche il punto di un'app che non ha un
server. HTTPS serve per il service worker e per il microfono; il sito ce l'ha, `file://` no.

Da lì si può **installare come applicazione** (Chrome: l'icona nella barra degli indirizzi) e
aprirla senza rete. La porta d'ingresso del sito è [`index.html`](index.html).

## Da dove cominciare

| Se vuoi… | Vai a |
|---|---|
| **usare l'applicazione subito** | <https://redrider21.github.io/black-spider/app/> |
| **vedere com'è fatto**, in una pagina sola da leggere o da mandare a qualcuno | [`index.html`](index.html) — è la pagina d'ingresso del sito |
| capire **perché** è fatto così — tutte le decisioni, i vincoli, i rischi, la ricerca | [`ARCHITETTURA.md`](ARCHITETTURA.md) — 929 righe, è il documento principale |
| **sapere cosa c'è dentro l'applicazione**, e come si prova | [`app/README.md`](app/README.md) |
| vedere le **prove di fattibilità** che hanno preceduto il codice | [`spikes/README.md`](spikes/README.md) |

## Provare l'applicazione in locale

Serve Python 3 e un browser basato su Chromium. Niente da installare, niente compilare.

```sh
# 1. guardare il sito: la pagina d'ingresso e l'applicazione
python3 -m http.server 8766 --bind 127.0.0.1
#      → http://127.0.0.1:8766/            (la pagina d'ingresso)
#      → http://127.0.0.1:8766/app/

# 2. eseguire tutte le prove e avere il verdetto
./prove.sh
```

Il server serve a **consegnare i file**, non a far funzionare l'applicazione: i moduli ES e
il service worker non si caricano da `file://`. Si può spegnere dopo il primo caricamento.
Per far parlare due browser bisogna aprirne due — uno normale e uno in incognito — su
`http://127.0.0.1:8766/app/`, e scambiarsi il codice d'invito a mano. **Lo stesso sito è
pubblicato su Pages**: in locale serve per lavorarci, non per usarlo.

## Com'è disposta la cartella

```
black-spider/
├── index.html           la pagina d'ingresso del sito: la presentazione, autonoma e bilingue
├── README.md            questo file — la porta d'ingresso, per una persona
├── LICENSE              AGPL-3.0 — il testo della licenza
├── .nojekyll            dice a Pages di servire i file come sono
├── ARCHITETTURA.md      il documento di progetto: il *perché* di ogni scelta
├── prove.sh             esegue tutte le prove e dice l'esito
├── app/                 l'applicazione: il guscio PWA e la chat
│   ├── js/              identità, eventi, archivio, invito, trasporto, sincronizzazione
│   └── prove/           le prove, che aprono l'app vera e le cliccano i pulsanti
├── spikes/              le prove di fattibilità fatte prima di scrivere il codice
└── riferimenti/         le fonti: 22 documenti, in copia HTML e in testo
```

## Le tre cose che non si rinegoziano

1. **Niente server.** Non «nessun server nostro»: nessun server. Il primo scambio di codici
   lo fanno le persone, a mano, una volta per connessione.
2. **La chiave privata non è estraibile.** Firma, ma non si può leggere.
3. **Le prove si eseguono davvero.** Non si dichiara verificato quello che non è stato
   eseguito: le prove aprono l'applicazione vera e la usano come la userebbe una persona.

## Licenza

**AGPL-3.0-or-later** — Copyright (C) 2026 Daniele Deplano (RedRider21). Il testo completo è
in [`LICENSE`](LICENSE); l'intestazione di licenza e autore è in testa a ogni file di
programma.

Chi modifica Black Spider e lo mette a disposizione di altri **attraverso una rete** deve
rendere pubblico il sorgente modificato. Per un progetto che non ha un server non è una
formalità: è il modo di chiudere l'unica scappatoia che resta — ospitarne una copia
modificata e continuare a dire a chi la usa che è Black Spider. L'obbligo non tocca chi la
esegue e basta: chi apre `app/`, parla con un'altra finestra e chiude la scheda non deve
niente a nessuno.
