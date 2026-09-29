/* Black Spider — le chiamate.
 *
 * Una chiamata non è un secondo collegamento: è **la stessa connessione** che
 * porta i messaggi, con una traccia audio aggiunta sopra. Chi è già collegato
 * non deve rifare l'invito — l'invito è la parte cara, quella che si fa a mano —
 * quindi il segnale della chiamata passa dentro il canale dati che è già aperto.
 *
 * Quattro scelte che sembrano dettagli e non lo sono.
 *
 * **Solo voce per difetto, il video è l'aggiunta.** Una voce in Opus sono 24-40
 * kbps, un video 1,5 Mbps: è la voce a essere il caso base, non il caso ridotto.
 * L'offerta di una chiamata vocale contiene `m=audio` e nient'altro, e il video
 * si aggiunge dopo, a chiamata avviata, con una rinegoziazione.
 *
 * **Niente trickle ICE.** I candidati si aspettano e l'SDP si manda intero, come
 * fa già l'invito. Costa qualche etto di secondo e toglie di mezzo una classe di
 * guasti — il candidato che arriva prima della descrizione remota, la coda da
 * tenere, l'ordine da rispettare — che altrimenti si paga in produzione.
 *
 * **Chi risponde all'invito è il "polite" della negoziazione.** Serve perché una
 * rinegoziazione può partire da entrambi i lati insieme (due che accendono il
 * video nello stesso istante), e in quel caso uno dei due deve cedere. Chi ha
 * *ricevuto* l'invito cede: è la stessa asimmetria che c'è già fra chi invita e
 * chi risponde, riusata invece che inventata.
 *
 * **Muto e spento sono due cose diverse.** Muto mette `enabled = false` sulla
 * traccia: la traccia resta, la riga nella SDP resta, si torna a parlare
 * all'istante e non si rinegozia niente. Spegnere la telecamera **ferma** la
 * traccia e la toglie dalla connessione, perché una telecamera accesa consuma
 * uplink anche se l'immagine è ferma, e l'uplink è esattamente quello che una
 * chiamata solo voce vuole risparmiare.
 */

import { aspettaGathering } from './invito.js';
import { t } from './lingua.js';

const M = {
  CHIEDO:  'chiamata/chiedo',
  ACCETTO: 'chiamata/accetto',
  RIFIUTO: 'chiamata/rifiuto',
  NEGOZIA: 'chiamata/negozia',
  CHIUDO:  'chiamata/chiudo',
};

export const CHIAMATA = {
  NESSUNA: 'nessuna',
  CHIAMANDO: 'chiamando',
  SQUILLA: 'squilla',
  IN_CORSO: 'in-corso',
  CHIUSA: 'chiusa',
};

/** Quanto si aspetta che la raccolta dei candidati si quieti, in una rinegoziazione. */
const QUIETE_MS = 2500;

export function creaChiamate({ trasporto, polite, scheda, chiIniziale, onStato, nota }) {
  const pc = trasporto.pc;

  let stato = CHIAMATA.NESSUNA;
  // La scheda pubblica dell'altro. Si sa già dallo scambio dei codici — chi invita
  // la impara dalla risposta, chi risponde dall'invito — quindi non si aspetta il
  // segnale della chiamata per sapere con chi si sta parlando: chi chiama deve
  // poter dire *chi* sta chiamando fin dal primo istante, non «sconosciuto».
  let chi = chiIniziale || null;
  let descrizioneInArrivo = null; // l'offerta di chi chiama, tenuta da parte finché non si accetta
  let flussoLocale = null;
  let tracciaVoce = null;
  let video = null;               // { traccia, sender }
  let muto = false;
  let iniziata = null;
  let byteRicevuti = 0;           // voce arrivata
  let byteVideoRicevuti = 0;      // video arrivato: è traffico, non una riga nella SDP
  let politeIo = !!polite;
  let negoziando = false;
  let timerStato = null;
  let audio = null;               // dove si sente l'altro

  /* ------------------------------------------------------------------- stato */

  /* Che tracce stanno arrivando **adesso**.
   *
   * Non è un elenco di quelle arrivate in passato: quello direbbe «video» anche
   * dopo che la telecamera è stata spenta, e una misura che non torna indietro
   * non misura, ricorda. Si guarda invece come sono messi i transceiver della
   * connessione — dove sono diretti, e se la traccia in ingresso è viva — che è
   * la stessa cosa che vede il browser.
   *
   * `muted` è il pezzo che conta: un transceiver in ricezione con la traccia
   * silenziosa è una riga nella SDP, non una voce che arriva. Si dichiara quello
   * che si sente, non quello che è stato promesso. */
  function tipiInArrivo() {
    const tipi = new Set();
    let transceiver = [];
    try { transceiver = pc.getTransceivers(); } catch { return ''; }
    for (const tr of transceiver) {
      const direzione = tr.currentDirection || tr.direction;
      if (direzione !== 'recvonly' && direzione !== 'sendrecv') continue;
      const traccia = tr.receiver && tr.receiver.track;
      if (traccia && !traccia.muted) tipi.add(traccia.kind);
    }
    return [...tipi].sort().join(',');
  }

  function annuncia(extra = {}) {
    onStato(stato, { chi, muto, video: !!video, byte: byteRicevuti,
                     byteVideo: byteVideoRicevuti,
                     // Che tracce arrivano davvero. Serve a poter dire «solo
                     // voce» senza doverlo credere sulla parola: è la differenza
                     // fra una promessa e una misura.
                     tipi: tipiInArrivo(),
                     durata: iniziata ? Math.floor((Date.now() - iniziata) / 1000) : 0,
                     ...extra });
  }

  function vai(nuovo, extra) {
    if (stato === nuovo && !extra) return;
    stato = nuovo;
    annuncia(extra);
  }

  /* ---------------------------------------------------------------- l'audio */

  /* L'audio che arriva va consegnato a un elemento `<audio>`, non solo tenuto in
   * un oggetto: senza un elemento che lo riproduca, la traccia arriva, i byte
   * passano, e non si sente niente. Un guasto silenzioso, nel senso letterale. */
  function preparaAudio() {
    if (audio) return audio;
    audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.hidden = true;
    audio.id = 'audioChiamata';
    document.body.append(audio);
    return audio;
  }

  pc.addEventListener('track', (ev) => {
    annuncia();
    if (ev.track.kind !== 'audio') return;
    const flusso = ev.streams && ev.streams[0];
    const a = preparaAudio();
    a.srcObject = flusso || new MediaStream([ev.track]);
    a.play().catch(() => {
      // I browser vietano di far partire l'audio da soli: se succede, si dice
      // invece di lasciare la chiamata muta senza spiegazione.
      nota(t('nota.chiamataAudioBloccato'), true);
    });
  });

  /* -------------------------------------------------------------- microfono */

  /* Il microfono si chiede **quando si chiama**, non all'avvio dell'app: chi apre
   * Black Spider per leggere l'archivio non deve vedersi chiedere il permesso di
   * ascoltare. */
  async function apriMicrofono() {
    if (tracciaVoce) return tracciaVoce;
    let flusso;
    try {
      flusso = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      throw new Error(t('chiamata.microfonoNegato', { errore: (e && e.name) || e }));
    }
    flussoLocale = flusso;
    tracciaVoce = flusso.getAudioTracks()[0];
    pc.addTrack(tracciaVoce, flusso);
    return tracciaVoce;
  }

  /* ---------------------------------------------------------------- negozia */

  /* L'offerta e la risposta complete, raccolta dei candidati già finita. Chi
   * riceve un'offerta risponde; chi la manda aspetta. Vale sia per la chiamata
   * sia per la rinegoziazione del video, che è la stessa operazione. */
  async function offri(motivo) {
    negoziando = true;
    try {
      await pc.setLocalDescription();
      await aspettaGathering(pc, QUIETE_MS);
      // Chi chiama si presenta: senza la scheda, a chi squilla arriverebbe una
      // chiamata senza nome, e «sconosciuto ti sta chiamando» è esattamente
      // l'informazione che serve di più in quel momento.
      await trasporto.invia({
        t: motivo,
        descrizione: pc.localDescription,
        ...(motivo === M.CHIEDO ? { chi: scheda } : {}),
      });
    } finally {
      negoziando = false;
    }
  }

  async function rispondi(destinazione) {
    await pc.setLocalDescription();
    await aspettaGathering(pc, QUIETE_MS);
    await trasporto.invia({ t: destinazione, descrizione: pc.localDescription });
  }

  /* ------------------------------------------------------------ i messaggi */

  trasporto.onMessaggio(async (m) => {
    if (!m || typeof m.t !== 'string' || !m.t.startsWith('chiamata/')) return;
    try {
      if (m.t === M.CHIEDO) {
        if (stato !== CHIAMATA.NESSUNA) {
          await trasporto.invia({ t: M.RIFIUTO });
          return;
        }
        if (m.chi) chi = m.chi;
        descrizioneInArrivo = m.descrizione;
        vai(CHIAMATA.SQUILLA);
        nota(t('nota.chiamataArriva', { chi: nomeDi() }));

      } else if (m.t === M.ACCETTO) {
        await pc.setRemoteDescription(m.descrizione);
        iniziata = Date.now();
        vai(CHIAMATA.IN_CORSO);
        avviaContatore();
        nota(t('nota.chiamataAccettata', { chi: nomeDi() }));

      } else if (m.t === M.RIFIUTO) {
        pulisci();
        vai(CHIAMATA.CHIUSA);
        nota(t('nota.chiamataRifiutata', { chi: nomeDi() }), true);

      } else if (m.t === M.CHIUDO) {
        const quanto = iniziata ? Math.floor((Date.now() - iniziata) / 1000) : 0;
        pulisci();
        vai(CHIAMATA.CHIUSA);
        nota(t('nota.chiamataChiusaDa', { chi: nomeDi(), durata: durata(quanto) }));

      } else if (m.t === M.NEGOZIA) {
        // Qui sta la regola del "polite": due rinegoziazioni che si incrociano
        // non possono passare tutte e due. Chi ha ricevuto l'invito cede.
        const d = m.descrizione;
        const collisione = d.type === 'offer'
          && (negoziando || pc.signalingState !== 'stable');
        if (collisione && !politeIo) return;         // l'altro ha già risposto: questa è vecchia
        if (collisione && politeIo) {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(d);
        if (d.type === 'offer') await rispondi(M.NEGOZIA);
      }
    } catch (e) {
      nota(t('nota.chiamataErrore', { errore: (e && e.message) || e }), true);
    }
  });

  const nomeDi = () => (chi && (chi.nome || chi.spiderId)) || t('chiamata.sconosciuto');
  const durata = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ------------------------------------------------------------- il conto */

  /* Quanti byte di voce sono arrivati: è l'unica prova che la chiamata funziona
   * davvero. Una traccia «collegata» con zero byte è il guasto classico delle
   * chiamate WebRTC — si vede il nome dell'altro e non si sente niente.
   *
   * Si **sommano i passi avanti**, non si legge il totale e non si fa la
   * differenza con l'inizio. La ragione è che una rinegoziazione può rifare il
   * transceiver dell'audio: al giro dopo `getStats()` riporta una voce nuova che
   * parte da zero, e la voce vecchia sparisce. Il totale, allora, **scende** — e
   * una differenza fra due letture darebbe un numero negativo. È già successo:
   * la prova ha misurato −34446 byte in tre secondi. I byte ricevuti non tornano
   * indietro; se il contatore di sotto torna indietro, è il contatore che ha
   * ricominciato, non la voce che è stata risputata. */
  const byteVisti = new Map();     // id della voce di statistica → ultimo valore visto

  async function leggiByte() {
    let report;
    try { report = await pc.getStats(); } catch { return byteRicevuti; }
    report.forEach((s) => {
      if (s.type !== 'inbound-rtp') return;
      const tipo = s.kind || s.mediaType;
      if (tipo !== 'audio' && tipo !== 'video') return;
      const id = s.id || s.ssrc;
      if (id === undefined) return;
      const valore = s.bytesReceived || 0;
      const prima = byteVisti.get(id);
      // Prima volta che si vede questa voce: si prende per buono e non si conta,
      // altrimenti si conterebbe anche quello arrivato prima della chiamata.
      if (prima !== undefined && valore > prima) {
        if (tipo === 'audio') byteRicevuti += valore - prima;
        else byteVideoRicevuti += valore - prima;
      }
      byteVisti.set(id, valore);     // se è calato, ha ricominciato: si riparte da qui
    });
    return byteRicevuti;
  }

  /** Si azzera il conto: i byte di *questa* chiamata, non di tutte. */
  async function prendiBase() {
    byteVisti.clear();
    byteRicevuti = 0; byteVideoRicevuti = 0;
    await leggiByte();               // semina i valori di partenza senza contarli
  }

  function avviaContatore() {
    fermaContatore();
    timerStato = setInterval(async () => {
      byteRicevuti = await leggiByte();
      annuncia();
    }, 1000);
  }

  function fermaContatore() {
    if (timerStato) clearInterval(timerStato);
    timerStato = null;
  }

  /* --------------------------------------------------------------- pulizia */

  function pulisci() {
    fermaContatore();
    if (flussoLocale) flussoLocale.getTracks().forEach((tr) => tr.stop());
    if (video) { try { video.traccia.stop(); } catch { /* già ferma */ } }
    flussoLocale = null; tracciaVoce = null; video = null;
    descrizioneInArrivo = null;
    byteRicevuti = 0; byteVideoRicevuti = 0; byteVisti.clear(); iniziata = null;
    if (audio) { audio.srcObject = null; }
    muto = false;
  }

  /* ------------------------------------------------------------ le mosse */

  async function chiama() {
    if (stato !== CHIAMATA.NESSUNA) throw new Error(t('chiamata.giaInCorso'));
    await apriMicrofono();
    await prendiBase();
    vai(CHIAMATA.CHIAMANDO);
    await offri(M.CHIEDO);
  }

  async function accetta() {
    if (stato !== CHIAMATA.SQUILLA || !descrizioneInArrivo) return;
    await apriMicrofono();
    await prendiBase();
    await pc.setRemoteDescription(descrizioneInArrivo);
    descrizioneInArrivo = null;
    await rispondi(M.ACCETTO);
    iniziata = Date.now();
    vai(CHIAMATA.IN_CORSO);
    avviaContatore();
  }

  async function rifiuta() {
    if (stato !== CHIAMATA.SQUILLA) return;
    descrizioneInArrivo = null;
    await trasporto.invia({ t: M.RIFIUTO });
    vai(CHIAMATA.CHIUSA);
  }

  /** Riattaccare: si avvisa l'altro, poi si spegne tutto da questa parte. */
  async function riattacca() {
    if (stato === CHIAMATA.NESSUNA) return;
    const quanto = iniziata ? Math.floor((Date.now() - iniziata) / 1000) : 0;
    try { await trasporto.invia({ t: M.CHIUDO }); } catch { /* l'altro è già andato */ }
    pulisci();
    vai(CHIAMATA.CHIUSA);
    if (quanto) nota(t('nota.chiamataFinita', { durata: durata(quanto) }));
  }

  /** Muto: la traccia resta, si smette solo di mandarle quello che dice. */
  function cambiaMuto() {
    if (!tracciaVoce) return;
    muto = !muto;
    tracciaVoce.enabled = !muto;
    annuncia();
  }

  /** Il video: la traccia in più, aggiunta e tolta a chiamata avviata. */
  async function cambiaVideo() {
    if (stato !== CHIAMATA.IN_CORSO) return;
    if (video) {
      video.traccia.stop();
      try { pc.removeTrack(video.sender); } catch { /* già tolta */ }
      video = null;
      await offri(M.NEGOZIA);
      annuncia();
      return;
    }
    let flusso;
    try {
      flusso = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (e) {
      nota(t('chiamata.telecameraNegata', { errore: (e && e.name) || e }), true);
      return;
    }
    const traccia = flusso.getVideoTracks()[0];
    const sender = pc.addTrack(traccia, flusso);
    // La traccia locale vive quanto la chiamata: si tiene il riferimento per
    // poterla fermare, perché una telecamera accesa di nascosto è peggio di una
    // chiamata che non parte.
    if (flussoLocale) flussoLocale.addTrack(traccia);
    else flussoLocale = flusso;
    video = { traccia, sender };
    await offri(M.NEGOZIA);
    annuncia();
  }

  /** Si è imparato chi c'è dall'altra parte: chi chiama lo scopre rispondendo,
   *  chi risponde lo scopre dall'invito. */
  function conosci(scheda) {
    if (scheda) chi = scheda;
    annuncia();
  }

  /** La connessione è caduta: la chiamata non può sopravviverle. */
  function connessionePersa() {
    if (stato === CHIAMATA.NESSUNA) return;
    pulisci();
    vai(CHIAMATA.CHIUSA);
    nota(t('nota.chiamataPersa'), true);
  }

  return {
    chiama, accetta, rifiuta, riattacca, cambiaMuto, cambiaVideo, connessionePersa, conosci,
    get stato() { return stato; },
    get inCorso() { return stato === CHIAMATA.IN_CORSO; },
  };
}
