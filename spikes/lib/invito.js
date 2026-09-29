/* Black Spider — M0.5
 * Utility condivise dalle prove: scambio dell'handshake fuori banda.
 *
 * Vincoli che questo modulo rispetta di proposito:
 *  - nessun crypto.subtle e nessuna API che richieda un contesto sicuro, così le prove
 *    funzionano anche su http:// in rete locale (dove localhost non c'è);
 *  - nessun server, nessuna dipendenza esterna;
 *  - ICE in modalità NON trickle: si aspettano tutti i candidati prima di produrre il
 *    codice da scambiare, così basta un solo andata-e-ritorno (ed è la difesa contro i
 *    timeout stretti di Firefox, cfr. ARCHITETTURA.md §7.1).
 */

export const Invito = (() => {

  /* ---------------------------------------------------------------- base64url */

  function b64uEnc(bytes) {
    let s = '';
    const pezzo = 0x8000;                       // evita lo stack overflow su SDP grandi
    for (let i = 0; i < bytes.length; i += pezzo) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + pezzo));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64uDec(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  /* ------------------------------------------------------------ compressione */

  // Primo byte = modalità: 0 non compresso, 1 deflate-raw.
  // CompressionStream esiste in tutti i browser moderni, ma il ripiego evita che una
  // prova fallisca per una API accessoria.

  async function comprimi(bytes) {
    const crudo = new Uint8Array([0, ...bytes]);
    if (typeof CompressionStream === 'undefined') return crudo;

    const cs = new CompressionStream('deflate-raw');
    // La lettura va avviata PRIMA della scrittura, altrimenti lo stream si blocca.
    const lettura = new Response(cs.readable).arrayBuffer();
    const w = cs.writable.getWriter();
    await w.write(bytes);
    await w.close();
    const compresso = new Uint8Array([1, ...new Uint8Array(await lettura)]);

    // Sui carichi piccoli deflate costa più di quanto renda (misurato: un SDP di 587
    // caratteri passava a 607). Si tiene sempre il minore dei due: la modalità viaggia
    // nel primo byte, quindi chi legge non deve sapere quale sia stato scelto.
    return compresso.length < crudo.length ? compresso : crudo;
  }

  async function decomprimi(bytes) {
    const modo = bytes[0];
    const corpo = bytes.subarray(1);
    if (modo === 0) return corpo;
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Questo browser non sa decomprimere il codice ricevuto.');
    }
    const ds = new DecompressionStream('deflate-raw');
    const lettura = new Response(ds.readable).arrayBuffer();
    const w = ds.writable.getWriter();
    await w.write(corpo);
    await w.close();
    return new Uint8Array(await lettura);
  }

  /* ------------------------------------------------- codice e decodifica */

  async function codifica(oggetto) {
    const json = new TextEncoder().encode(JSON.stringify(oggetto));
    return b64uEnc(await comprimi(json));
  }

  async function decodifica(codice) {
    const pulito = String(codice).trim().replace(/\s+/g, '');
    return JSON.parse(new TextDecoder().decode(await decomprimi(b64uDec(pulito))));
  }

  /* ---------------------------------------------------------------- peer */

  const STUN_GOOGLE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const STUN_CLOUDFLARE = [{ urls: 'stun:stun.cloudflare.com:3478' }];

  function creaPeer(iceServers) {
    return new RTCPeerConnection({ iceServers: iceServers || [] });
  }

  /** Aspetta la fine della raccolta ICE. Torna 'complete', 'quiete', 'timeout' o null.
   *
   * `quieteMs` è la parte che conta davvero. Aspettare che Chrome dichiari `complete` è
   * la scelta sbagliata quando i server STUN non rispondono: la raccolta non finisce mai e
   * si paga il timeout intero a ogni invito (misurato: 12 s su una rete che blocca la STUN
   * in uscita, con un solo candidato host raccolto). Quindi si chiude quando i candidati
   * smettono di arrivare — che è la domanda vera: "ne ho abbastanza per provarci?".
   */
  function aspettaGathering(pc, timeoutMs = 12000, quieteMs = 700) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res('complete');
      let quiete = null;

      const pulisci = () => {
        clearTimeout(scaduto);
        clearTimeout(quiete);
        pc.removeEventListener('icegatheringstatechange', guarda);
        pc.removeEventListener('icecandidate', nuovo);
      };
      const scaduto = setTimeout(() => { pulisci(); res('timeout'); }, timeoutMs);
      const riarma = () => {
        clearTimeout(quiete);
        quiete = setTimeout(() => { pulisci(); res('quiete'); }, quieteMs);
      };
      function guarda() {
        if (pc.iceGatheringState === 'complete') { pulisci(); res('complete'); }
      }
      function nuovo(e) {
        // e.candidate === null è il segnale di fine; ci pensa `guarda`.
        if (e.candidate) riarma();
      }
      pc.addEventListener('icegatheringstatechange', guarda);
      pc.addEventListener('icecandidate', nuovo);
      riarma();
    });
  }

  /** Lato A: crea il canale, l'offerta e il codice di invito. */
  async function creaInvito(pc, iceServers, timeoutMs) {
    const dc = pc.createDataChannel('spider', { ordered: true });
    const offerta = await pc.createOffer();
    await pc.setLocalDescription(offerta);
    const gathering = await aspettaGathering(pc, timeoutMs);
    const codice = await codifica({
      v: 1, t: 'offer', sdp: pc.localDescription.sdp,
      chi: 'A', gathering, quando: Date.now(),
    });
    return { dc, codice, gathering };
  }

  /** Lato B: legge l'invito e produce il codice di ritorno. */
  async function creaRisposta(pc, invito, timeoutMs) {
    await pc.setRemoteDescription({ type: 'offer', sdp: invito.sdp });
    const risposta = await pc.createAnswer();
    await pc.setLocalDescription(risposta);
    const gathering = await aspettaGathering(pc, timeoutMs);
    const codice = await codifica({
      v: 1, t: 'answer', sdp: pc.localDescription.sdp,
      chi: 'B', gathering, quando: Date.now(),
    });
    return { codice, gathering };
  }

  /** Lato A: chiude il cerchio con il codice di ritorno. */
  async function completa(pc, risposta) {
    if (risposta.t !== 'answer') throw new Error('Il codice incollato non è una risposta.');
    await pc.setRemoteDescription({ type: 'answer', sdp: risposta.sdp });
  }

  /* ------------------------------------------------------------ statistiche */

  // Copre sia i nomi nuovi degli stats sia quelli vecchi.
  const TIPO_LOCALE  = ['local-candidate', 'localcandidate'];
  const TIPO_REMOTO  = ['remote-candidate', 'remotecandidate'];

  function mascheraIp(ip) {
    if (!ip) return null;
    if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::';   // IPv6
    const p = ip.split('.');
    return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : ip;                        // IPv4
  }

  function nomeTipo(t) {
    return ({
      host:  'host (diretto)',
      srflx: 'srflx (riflesso dallo STUN)',
      prflx: 'prflx (riflesso dal peer)',
      relay: 'relay (attraverso TURN)',
    })[t] || t || 'sconosciuto';
  }

  /** Report leggibile: stato, coppia di candidati scelta, RTT. */
  async function statistiche(pc) {
    const out = {
      stato: pc.connectionState,
      gathering: pc.iceGatheringState,
      coppia: null,
      tipoLocale: null,
      tipoRemoto: null,
      viaRelay: false,
      rtt: null,
      note: null,
    };
    let report;
    try { report = await pc.getStats(); } catch { return out; }

    const cand = {};
    report.forEach((r) => {
      if (TIPO_LOCALE.includes(r.type)) cand[r.id] = { lato: 'locale', tipo: r.candidateType, ip: mascheraIp(r.address || r.ip) };
      if (TIPO_REMOTO.includes(r.type)) cand[r.id] = { lato: 'remoto', tipo: r.candidateType, ip: mascheraIp(r.address || r.ip) };
    });

    let coppia = null;
    report.forEach((r) => {
      if (r.type !== 'candidate-pair') return;
      if (r.selected === true || (r.state === 'succeeded' && r.nominated === true)) coppia = r;
    });

    if (coppia) {
      const l = cand[coppia.localCandidateId] || null;
      const rm = cand[coppia.remoteCandidateId] || null;
      out.coppia = { stato: coppia.state, protocollo: coppia.protocol || null };
      out.tipoLocale = l ? l.tipo : null;
      out.tipoRemoto = rm ? rm.tipo : null;
      out.viaRelay = (l && l.tipo === 'relay') || (rm && rm.tipo === 'relay');
      out.rtt = coppia.currentRoundTripTime != null
        ? Math.round(coppia.currentRoundTripTime * 1000) : null;
      out.note = `${nomeTipo(l && l.tipo)} ↔ ${nomeTipo(rm && rm.tipo)}`;
    }
    return out;
  }

  /* ------------------------------------------------------------ diagnostica */

  /** Traduce gli errori ICE più comuni in qualcosa di comprensibile. */
  function spiegaFallimento(stato) {
    return ({
      failed: 'Connessione fallita: probabilmente le due reti non riescono a vedersi. ' +
              'È il caso in cui nella prova reale servirebbe un TURN.',
      disconnected: 'Connessione interrotta: può essere transitorio, o una scheda sospesa dal browser.',
      'checking': 'In corso: se resta così a lungo, la coppia di candidati non si trova.',
      closed: 'Connessione chiusa.',
    })[stato] || null;
  }

  return {
    codifica, decodifica, comprimi, decomprimi,
    creaPeer, creaInvito, creaRisposta, completa, aspettaGathering,
    statistiche, nomeTipo, spiegaFallimento,
    ICE: { STUN_GOOGLE, STUN_CLOUDFLARE },
  };
})();
