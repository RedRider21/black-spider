# Black Spider

Una **rete peer-to-peer tra browser**. Nessun server, nessun account, nessun operatore che
custodisce i tuoi dati: ogni browser tiene il proprio database in locale, i peer si
connettono direttamente via WebRTC e si scambiano le modifiche.

Il ragno non ha un centro: la tela regge perché è magliata.

La prima applicazione costruita sopra questa architettura — una chat fra due browser — **è
fatta e verificata**. Il resto è progetto.

---

## Da dove cominciare

| Se vuoi… | Vai a |
|---|---|
| **vedere com'è fatto**, in una pagina sola da leggere o da mandare a qualcuno | [`presentazione.html`](presentazione.html) |
| capire **perché** è fatto così — tutte le decisioni, i vincoli, i rischi, la ricerca | [`ARCHITETTURA.md`](ARCHITETTURA.md) — 929 righe, è il documento principale |
| **usare l'applicazione** e sapere cosa c'è dentro | [`app/README.md`](app/README.md) |
| vedere le **prove di fattibilità** che hanno preceduto il codice | [`spikes/README.md`](spikes/README.md) |
| riprendere lo sviluppo dopo una pausa, o su un altro computer | [`CLAUDE.md`](CLAUDE.md) — stato, comandi, prossimi passi |

## Provare l'applicazione

Serve Python 3 e un browser basato su Chromium. Niente da installare, niente compilare.

```sh
# 1. guardare l'applicazione e la presentazione
python3 -m http.server 8766 --bind 127.0.0.1
#      → http://127.0.0.1:8766/presentazione.html
#      → http://127.0.0.1:8766/app/

# 2. eseguire tutte le prove e avere il verdetto
./prove.sh
```

Il server serve a **consegnare i file**, non a far funzionare l'applicazione: i moduli ES e
il service worker non si caricano da `file://`. Si può spegnere dopo il primo caricamento.
Per far parlare due browser bisogna aprirne due — uno normale e uno in incognito — su
`http://127.0.0.1:8766/app/`, e scambiarsi il codice d'invito a mano.

## Com'è disposta la cartella

```
black-spider/
├── README.md            questo file — la porta d'ingresso
├── CLAUDE.md            da dove si riprende: stato, comandi, prossimi passi
├── ARCHITETTURA.md      il documento di progetto (e .html, versione da leggere)
├── presentazione.html   la pagina di presentazione, autonoma e bilingue
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
