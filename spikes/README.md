# M0.5 — Le prove che vengono prima del codice

Quattro esperimenti, mezza giornata ciascuno, da fare **prima** di scrivere una riga del
progetto vero. Servono a verificare le scelte di `ARCHITETTURA.md` §7 (signaling) e §11
(peer sempre acceso) mentre costano ancora poco: se una fallisce, cambia il progetto, non
il codice.

Il banco di prova è già pronto. Non va installato niente.

---

## Come si avvia

```bash
cd "black spider/spikes"
./avvia.sh                 # porta 8080, solo questa macchina
./avvia.sh 8080 rete       # anche verso la rete locale — serve per le prove 2 e 4
```

**Per difetto ascolta solo su `127.0.0.1`.** Un servizio in ascolto su `0.0.0.0` è una
porta aperta verso una rete che quasi sempre non è tua, e le prove 1 e 3 non ne hanno
bisogno: si fanno da qui. Solo la prova 2 (la LAN senza internet) e la prova 4 (due
dispositivi su reti diverse) richiedono che qualcun altro si colleghi, e in quei casi lo
si chiede scrivendo `rete` — che è l'unico modo per cui lo script apre davvero la porta,
e lo dice a chiare lettere nell'output.

Con `rete` lo script stampa due indirizzi: quello per questa macchina e quello per gli
altri dispositivi della stessa rete. La prova 1 (l'invito fra due browser) e la 3 (la
scheda in background) funzionano con il solo indirizzo locale, aprendo due schede.

**Niente backend.** Lo script è solo un servizio di file statici in Python; nessuna
richiesta esce da lì. Quando lo fermi, non resta niente in esecuzione. E se lo lasci
acceso, spegnilo: `Ctrl+C`.

---

## Le quattro prove

### Prova 1 — L'invito funziona davvero?

**La domanda.** Due browser in luoghi diversi riescono a connettersi scambiandosi soltanto
un codice e un codice di ritorno, con nessun server in mezzo?

**Come.** Apri `prova-1-invito.html` su due dispositivi diversi. Lascia
**STUN Google**. Su uno premi *Crea l'invito*, copia il **link** e mandalo all'altro con
qualunque mezzo (WhatsApp, email). L'altro apre il link, copia il codice di ritorno e lo
rimanda. Il primo lo incolla e preme *Completa*. Poi scrivete qualcosa nella chat.

**Cosa registra la pagina.** Tempo di raccolta ICE, dimensione dei codici, tipo di
candidati scelti, RTT, esito. Compila a mano il campo *Esito* e premi *Salva il report*.

**Cosa guardare.**
- La connessione arriva a `connected` entro pochi secondi?
- I codici sono di dimensione accettabile (indicativamente qualche centinaio di caratteri)?
- Su Firefox in particolare: la raccolta ICE finisce prima che scada il tempo? È la trappola
  nota di §7.1 — se qui salta, la strategia dell'invito va ripensata.

**Se fallisce** significa che tutto il livello A crolla e il progetto dipende dal broker.

---

### Prova 2 — La LAN è davvero libera?

**La domanda.** Due dispositivi sulla stessa Wi-Fi si connettono **senza internet**?

**Come.** Due dispositivi sulla stessa rete. Su entrambi apri la pagina dall'indirizzo di
rete locale (quello che stampa `avvia.sh`, tipo `http://192.168.1.42:8080`). Su entrambi
scegli **Solo rete locale**. **Stacca internet** dal router, o disattiva i dati mobili e
sconnetti il Wi-Fi dalla rete esterna se puoi. Rifai lo scambio dei codici.

**Cosa guardare.**
- La connessione si stabilisce?
- I candidati scelti sono `host` (diretto) e non `srflx`?

**Attenzione.** Il browser dichiara "sicuro" solo `localhost` e `https`. Da
`http://192.168.x.x` il canale dati funziona comunque (le prove non usano API che
richiedono un contesto sicuro), ma il pulsante *Copia* userà il ripiego: se non copia,
seleziona il testo a mano e premi Ctrl+C. È previsto, non è un guasto.

**Se fallisce** significa che "funziona anche in aereo" è falso, e la LAN smette di essere
la strada maestra di §2.2.

---

### Prova 3 — La scheda in background tiene?

**La domanda.** Una connessione WebRTC sopravvive quando la scheda non è in primo piano?
Per quanto? È la prova che decide se un *peer sempre acceso* è realistico.

**Come.** Apri `prova-3-background.html` in **due schede** dello stesso browser. Nella prima
*Avvia come A*, nella seconda *Avvia come B*: si trovano da sole. Lascia la scheda **B in
background** — apri un'altra applicazione, non limitarti a cambiare scheda. Aspetta
**almeno un'ora**, meglio due. Poi torna e salva il report di entrambe.

**Cosa registra.** Ogni cambio di visibilità, i congelamenti dichiarati dal browser
(`freeze`/`resume`), i buchi nel battito oltre 12 secondi, l'intervallo massimo, l'RTT.

**Cosa guardare.**
- Quanti buchi, e quanto lunghi: un buco di 30 secondi è trascurabile, uno di due ore
  significa che il peer ancora non funziona.
- Il canale è ancora `open` alla fine, o è passato a `failed`?

**Ripeti la prova due volte**, una con il battito dal *thread principale* e una da un
*Web Worker*: è il confronto che dice se la mitigazione di §11.2 serve davvero.

**Da rifare su Android**, perché il comportamento dei browser mobili è diverso da quello
desktop. Su iOS non vale la pena: la scheda viene chiusa e il peer ancora è impossibile —
è già scritto in §11.2, questa prova non lo cambierà.

---

### Prova 4 — Quanto TURN serve davvero?

**La domanda.** Nelle reti che usi davvero, quante connessioni passano dirette e quante
hanno bisogno di un relay?

**Come.** Due dispositivi su **reti diverse** — per esempio il PC su Wi-Fi di casa e il
telefono in 4G con il Wi-Fi spento. Prima rifai lo scambio con **STUN Google** e annota se
funziona. Poi, se hai credenziali TURN, rifallo con **STUN + TURN**.

**Cosa guardare.** Nel pannello *Stato*: il candidato scelto è `host`/`srflx` (diretto)
oppure `relay` (attraverso TURN)? La pillola verde dice "diretto", quella gialla "via relay".

**Perché conta.** La statistica dice che il 15-20% delle sessioni consumer richiede un
relay. Questa prova dice quanto vale *per te*, sulle reti che frequenti — che è
l'informazione con cui si decide se il TURN è un optional o una necessità (§2.2, §17.3).

**Nota.** Fra due schede della stessa macchina i candidati sono sempre `host`: la prova del
NAT richiede per forza due dispositivi su reti diverse.

---

## Come si registrano i risultati

Ogni prova produce un file JSON dal pulsante *Salva il report*. Tienili in una cartella
`spikes/esiti/` con un nome parlante: `prova-1-pc-ufficio-telefono-4g.json`.

Alla fine delle quattro prove, quello che conta è una riga per ciascuna:

| Prova | Esito | Cosa cambia se fallisce |
|---|---|---|
| 1 — invito | | Il livello A di §7.1 crolla, il progetto dipende dal broker |
| 2 — LAN | | La LAN smette di essere la strada maestra |
| 3 — background | | Il peer sempre acceso di §11 va ridimensionato o abbandonato |
| 4 — NAT | | Il TURN passa da opzionale a obbligatorio |

Questi esiti vanno poi riportati dentro `ARCHITETTURA.md`: le sezioni §7, §11 e §14 non
sono definitive finché non sono state misurate.

---

## Il banco di prova è già stato verificato

Prima di consegnarlo è stato eseguito davvero in Chrome headless, non solo riletto:

| Controllo | Esito |
|---|---|
| Andata e ritorno di un codice, carico piccolo | ok (35 → 48 caratteri, la compressione viene scartata quando non conviene) |
| Andata e ritorno, carico da 60 candidati ICE | ok (4.604 → 799 caratteri, **17,4%**) |
| Un SDP vero di WebRTC attraverso `codifica`/`decodifica` | ok, identico all'originale |
| Accenti, CJK ed emoji | ok |
| Codice corrotto | rifiutato con un errore, come deve |
| Raccolta ICE non-trickle | `complete` su entrambi i lati |
| Canale dati in loopback | aperto, messaggio di andata e ritorno ricevuto |
| Lettura delle statistiche | candidato `host` ↔ `host`, riconosciuta come diretta, non via relay |

Quello che **non** è stato verificato è ciò che richiede due macchine o del tempo vero: le
prove 1, 2, 3 e 4 restano da fare. La verifica dice che lo strumento misura correttamente,
non che il progetto funzionerà.

Per rieseguirla: `test-lib.html`, aprendola dall'indirizzo che stampa `avvia.sh`.

---

## Cosa c'è in questa cartella

| File | A cosa serve |
|---|---|
| `avvia.sh` | Serve le pagine — solo su questa macchina, salvo che gli si chieda `rete` |
| `prova-1-invito.html` | Prove 1, 2 e 4: l'invito, la LAN, il NAT |
| `prova-3-background.html` | Prova 3: la scheda in background nel tempo |
| `test-lib.html` | Verifica del banco di prova stesso, non una delle quattro prove |
| `lib/invito.js` | Codifica dell'invito, compressione, statistiche dei candidati |
| `stile.css` | Aspetto delle pagine |

Il codice delle prove è **usa e getta**: non è l'inizio di Black Spider e non va riutilizzato
senza ripensarlo. Serve a rispondere a quattro domande, e quando ha risposto ha finito il
suo lavoro.
