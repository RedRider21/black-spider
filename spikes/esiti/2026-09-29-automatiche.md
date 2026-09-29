# Esiti delle prove automatiche — 2026-09-29

Eseguite da riga di comando, senza intervento umano, con `spikes/auto/esegui.sh`.
Le due parti sono **due processi Chrome distinti** con profili separati: non è un
loopback dentro una pagina sola, sono due peer veri che si scambiano i codici.

**Contesto della misura**: rete aziendale locale, con filtro sul traffico in uscita.
Questo conta per leggere i risultati — vedi la nota sulla STUN in fondo.

---

## Prova 2 — la LAN è davvero libera?

Modalità `host`: nessun server STUN configurato, quindi nessun contatto con l'esterno.

| | |
|---|---|
| Raccolta ICE | `complete` — A 142 ms, B 31 ms |
| Codice invito / risposta | 660 / 662 caratteri |
| Canale dati | **aperto** dopo 1.436 ms |
| Candidati scelti | `host` ↔ `host` |
| Via relay | no |
| RTT | 1 ms |
| Messaggi | A→B e B→A ricevuti correttamente |

**Superata.** Con zero server configurati la connessione si stabilisce comunque, in meno di
un secondo e mezzo. I candidati `host` per costruzione non richiedono internet: il traffico
non esce dalla macchina. Questo non prova la prova 2 nella sua forma letterale (staccare
davvero internet dal router), ma ne prova il meccanismo, che è la parte che il codice deve
azzeccare.

---

## Prova 1 — l'invito funziona?

Modalità `stun`: STUN di Google configurato, come nel flusso reale.

| | |
|---|---|
| Raccolta ICE | A: **timeout → poi `quiete`** — B: `complete` |
| Codice invito / risposta | 658 / 654 caratteri |
| Canale dati | **aperto** dopo 1.175 ms |
| Candidati scelti | `host` ↔ `host` |
| Messaggi | A→B e B→A ricevuti correttamente |

**Superata**, con una scoperta che ha cambiato il codice.

### La scoperta

Al primo tentativo il lato A **non ha completato la raccolta ICE**: ha bruciato tutti i
12 secondi del timeout. Ho decodificato l'invito rimasto per contare i candidati davvero
raccolti:

```
invito  (A, raccolta=timeout): candidati {'host': 1}   righe ICE: 1
risposta(B, raccolta=complete): candidati {'host': 1}   righe ICE: 1
```

**Zero candidati `srflx` da entrambi i lati.** Nessuna STUN ha risposto — il traffico UDP in
uscita verso i server STUN è bloccato da questa rete. Il lato A ha continuato a ritentare
fino allo scadere del timeout; il lato B ha rinunciato quasi subito.

Quindi: la raccolta ICE **non arriva a `complete`** quando la STUN è irraggiungibile. Il
documento diceva di aspettarla. Aspettarla costa il timeout intero a ogni invito.

### La correzione

`aspettaGathering` ora chiude quando i candidati **smettono di arrivare** (~700 ms di
quiete) invece di aspettare che Chrome dichiari di aver finito. Rimisurato:

| | prima | dopo |
|---|---|---|
| Creazione dell'invito | 12.529 ms | **1.175 ms** |
| Esito della connessione | riuscita | riuscita |

Dieci volte più veloce, stesso risultato. Ed è anche la risposta alla "trappola nota" dei
timeout stretti di Firefox: un invito prodotto in ~1 s non li sfiora nemmeno.

---

## Cosa resta da fare

| Prova | Stato |
|---|---|
| 1 — invito | **meccanismo verificato** fra due browser distinti; resta da provare fra due dispositivi fisici |
| 2 — LAN | **meccanismo verificato** senza alcun contatto esterno; resta da provare con internet davvero staccato |
| 3 — scheda in background | **da fare**: richiede tempo reale (ore) e una finestra vera, non headless |
| 4 — NAT e TURN | **non eseguibile qui**: servono due reti diverse |

### Perché la prova 4 non si può fare da qui

La prova 4 chiede "su reti diverse, quante connessioni passano dirette e quante no". Da una
sola macchina su una sola rete la risposta è nota in partenza: sempre diretto. Serve o un
secondo dispositivo su un'altra rete (telefono in 4G), o una seconda uscita.

### Nota importante sul contesto

Il blocco della STUN **è una proprietà di questa rete, non di internet**. A casa, o su una
rete normale, la STUN risponde e compaiono i candidati `srflx`, che sono quelli che
permettono di attraversare il NAT. Non va letto come "il progetto non funziona fuori dalla
LAN": va letto come "il progetto deve funzionare anche dove la STUN è bloccata", che è
esattamente il caso in cui serve un TURN.
