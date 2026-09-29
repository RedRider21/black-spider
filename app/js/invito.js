/* Black Spider — l'invito.
 *
 * È il livello A di §7.1: due messaggi scambiati con qualunque mezzo, nessun
 * server, nessuna infrastruttura. Il link contiene l'offerta WebRTC completa
 * (SDP + candidati) più i dati di chi invita, così chi lo riceve può già
 * verificare le firme senza chiedere niente a nessuno.
 *
 * Due cose imparate misurando, entrambe in ARCHITETTURA.md §7.1:
 *
 *  - la raccolta ICE si chiude quando i candidati **smettono di arrivare**, non
 *    quando Chrome dichiara `complete`: su una rete che blocca la STUN la raccolta
 *    non finisce mai, e aspettarla costava 12 secondi a ogni invito invece di uno;
 *  - la compressione si applica solo se conviene: su un carico piccolo deflate
 *    costa più di quanto renda, quindi si tiene il minore dei due.
 */

import { aBase64url, daBase64url } from './identita.js';
// `t` qui è già il nome di un parametro in mezza pagina: la traduzione si chiama
// per esteso, che è anche più chiaro da leggere.
import { t as traduci } from './lingua.js';

/* ------------------------------------------------------------- compressione */

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

/** Oggetto → codice da incollare. */
export async function codifica(oggetto) {
  const json = new TextEncoder().encode(JSON.stringify(oggetto));
  return aBase64url(await comprimi(json));
}

/** Codice incollato → oggetto. */
export async function decodifica(codice) {
  const pulito = String(codice).trim().replace(/\s+/g, '');
  try {
    return JSON.parse(new TextDecoder().decode(await decomprimi(daBase64url(pulito))));
  } catch {
    throw new Error('Il codice non è leggibile: controlla di averlo copiato tutto, dall\'inizio alla fine.');
  }
}

/* ------------------------------------------------------------------- ICE */

export const ICE = {
  // Vuoto = solo rete locale. È il default prudente: nessun contatto con l'esterno.
  NESSUNO: [],
  STUN: [{ urls: 'stun:stun.l.google.com:19302' },
         { urls: 'stun:stun1.l.google.com:19302' }],
};

export function creaPeer(iceServers) {
  return new RTCPeerConnection({ iceServers: iceServers || [] });
}

/**
 * Aspetta che la raccolta ICE si stabilizzi.
 * Torna 'complete', 'quiete', 'timeout' o null.
 */
export function aspettaGathering(pc, timeoutMs = 12000, quieteMs = 700) {
  return new Promise((risolvi) => {
    if (pc.iceGatheringState === 'complete') return risolvi('complete');

    let quiete = null;
    const pulisci = () => {
      clearTimeout(scaduto);
      clearTimeout(quiete);
      pc.removeEventListener('icegatheringstatechange', guarda);
      pc.removeEventListener('icecandidate', nuovo);
    };
    const scaduto = setTimeout(() => { pulisci(); risolvi('timeout'); }, timeoutMs);
    const riarma = () => {
      clearTimeout(quiete);
      quiete = setTimeout(() => { pulisci(); risolvi('quiete'); }, quieteMs);
    };
    function guarda() {
      if (pc.iceGatheringState === 'complete') { pulisci(); risolvi('complete'); }
    }
    function nuovo(e) { if (e.candidate) riarma(); }

    pc.addEventListener('icegatheringstatechange', guarda);
    pc.addEventListener('icecandidate', nuovo);
    riarma();
  });
}

/* --------------------------------------------------------------- i due lati */

/** Chi invita: crea il canale, l'offerta e il codice da mandare. */
export async function creaInvito(pc, chi, stanza, iceServers, timeoutMs) {
  const dc = pc.createDataChannel('spider', { ordered: true });
  const offerta = await pc.createOffer();
  await pc.setLocalDescription(offerta);
  const gathering = await aspettaGathering(pc, timeoutMs);

  const codice = await codifica({
    v: 1, t: 'offer', sdp: pc.localDescription.sdp,
    stanza, chi, gathering, quando: Date.now(),
    // Chi risponde deve raccogliere gli stessi tipi di candidati di chi invita:
    // se uno dei due resta senza STUN mentre l'altro ce l'ha, la via riflessa
    // esiste da un lato solo e non serve a niente.
    stun: !!(iceServers && iceServers.length),
  });
  return { dc, codice, gathering };
}

/** Chi riceve: legge l'invito e produce il codice di ritorno. */
export async function creaRisposta(pc, invito, chi, iceServers, timeoutMs) {
  if (invito.v !== 1 || invito.t !== 'offer') {
    throw new Error('Questo non è un invito: serve un link creato da Black Spider.');
  }
  await pc.setRemoteDescription({ type: 'offer', sdp: invito.sdp });
  const risposta = await pc.createAnswer();
  await pc.setLocalDescription(risposta);
  const gathering = await aspettaGathering(pc, timeoutMs);

  const codice = await codifica({
    v: 1, t: 'answer', sdp: pc.localDescription.sdp,
    chi, gathering, quando: Date.now(),
  });
  return { codice, gathering };
}

/** Chi invita: chiude il cerchio con il codice di ritorno. */
export async function completa(pc, risposta) {
  if (risposta.t !== 'answer') {
    throw new Error('Il codice incollato non è una risposta: è un invito. ' +
      'L\'invito va aperto da chi riceve, non incollato qui.');
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: risposta.sdp });
}

/* ------------------------------------------------------------ diagnostica */

/* I nomi dei tipi di candidato stanno nel dizionario come tutto il resto: qui
 * restano le chiavi, non le parole. */

const TIPI = ['host', 'srflx', 'prflx', 'relay'];

/** Nome breve del tipo di candidato. Sta dentro una frase — «diretto (host)» —
 *  quindi non deve spiegarsi da solo: la spiegazione sta in `spiegaTipo`. */
export function nomeTipo(tipo) {
  return TIPI.includes(tipo) ? traduci('ice.' + tipo)
    : (tipo || traduci('ice.sconosciuto'));
}

/** La stessa cosa detta per esteso, per chi la passa il mouse sopra. */
export function spiegaTipo(tipo) {
  return TIPI.includes(tipo) ? traduci('ice.' + tipo + '.spiega') : '';
}

/** Cosa sta usando davvero la connessione: diretto o via relay. */
export async function statistiche(pc) {
  const out = { stato: pc.connectionState, tipoLocale: null, tipoRemoto: null,
                viaRelay: false, rtt: null };
  let report;
  try { report = await pc.getStats(); } catch { return out; }

  const cand = {};
  report.forEach((r) => {
    if (r.type === 'local-candidate' || r.type === 'localcandidate') {
      cand[r.id] = r.candidateType;
    } else if (r.type === 'remote-candidate' || r.type === 'remotecandidate') {
      cand[r.id] = r.candidateType;
    }
  });
  let coppia = null;
  report.forEach((r) => {
    if (r.type !== 'candidate-pair') return;
    if (r.selected === true || (r.state === 'succeeded' && r.nominated === true)) coppia = r;
  });
  if (coppia) {
    out.tipoLocale = cand[coppia.localCandidateId] || null;
    out.tipoRemoto = cand[coppia.remoteCandidateId] || null;
    out.viaRelay = out.tipoLocale === 'relay' || out.tipoRemoto === 'relay';
    out.rtt = coppia.currentRoundTripTime != null
      ? Math.round(coppia.currentRoundTripTime * 1000) : null;
  }
  return out;
}
