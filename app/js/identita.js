/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Daniele Deplano (RedRider21) */

/* Black Spider — l'identità.
 *
 * Una coppia di chiavi generata nel browser, senza autorità che la assegni.
 * L'identificativo *è* la chiave pubblica: non è revocabile e non è riciclabile.
 *
 * Sulla non-estraibilità: WebCrypto non permette di generare una coppia con la
 * chiave privata non estraibile e la pubblica estraibile insieme — `extractable`
 * vale per entrambe. Quindi si genera estraibile, si esporta la pubblica, e si
 * **reimporta la privata come non estraibile**, scartando subito i byte PKCS#8.
 * Quei byte esistono in memoria per il tempo di un giro di event loop: è il
 * prezzo da pagare, ed è molto meglio di tenere la chiave esportabile per
 * sempre. Da qui in avanti la privata non è più leggibile da JavaScript.
 *
 * Deliberatamente assente: qualunque esportazione della chiave privata, anche
 * per un "backup". Un backup è un file in chiaro su un disco, ed è il modo più
 * comune in cui queste cose finiscono male.
 */

import { STORE, leggi, scrivi } from './archivio.js';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz234567';   // RFC 4648, senza padding

/** base32 dei byte dati. */
export function base32(bytes) {
  let bit = 0, valore = 0, out = '';
  for (const b of bytes) {
    valore = (valore << 8) | b;
    bit += 8;
    while (bit >= 5) {
      out += ALFABETO[(valore >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) out += ALFABETO[(valore << (5 - bit)) & 31];
  return out;
}

export function daBase32(testo) {
  let bit = 0, valore = 0;
  const out = [];
  for (const c of testo.toLowerCase()) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) continue;
    valore = (valore << 5) | i;
    bit += 5;
    if (bit >= 8) { out.push((valore >>> (bit - 8)) & 255); bit -= 8; }
  }
  return new Uint8Array(out);
}

/** Da byte a esadecimale, per le impronte leggibili. */
export function esadecimale(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const CONFIGURAZIONE = {
  ED25519: { nome: 'Ed25519', parametri: 'Ed25519', firma: 64 },
  ECDSA_P256: {
    nome: 'ECDSA-P256',
    parametri: { name: 'ECDSA', namedCurve: 'P-256' },
    firma: 64,
  },
};

/**
 * Sceglie l'algoritmo. Si prova Ed25519 (verificato: Chrome ≥ 137, Firefox ≥ 130,
 * Safari ≥ 17) e si ripiega su P-256 se questo browser non lo conosce.
 * La scelta viene *registrata*: una firma Ed25519 e una P-256 non si distinguono
 * a occhio, quindi chi verifica deve sapere come verificare.
 */
async function scegliAlgoritmo() {
  try {
    const prova = await crypto.subtle.generateKey(
      CONFIGURAZIONE.ED25519.parametri, false, ['sign', 'verify']);
    if (prova && prova.privateKey) return 'ED25519';
  } catch { /* non supportato: si ripiega */ }
  return 'ECDSA_P256';
}

/** Crea l'identità e la deposita nell'archivio. Se esiste già, la restituisce. */
export async function creaOErecupera() {
  const esistente = await leggi(STORE.IDENTITA, 'locale');
  if (esistente) return esistente;

  const algoritmo = await scegliAlgoritmo();
  const cfg = CONFIGURAZIONE[algoritmo];

  const coppia = await crypto.subtle.generateKey(cfg.parametri, true, ['sign', 'verify']);

  // Esporta la pubblica (serve per l'ID e per farsi verificare) e la privata
  // solo per reimportarla non estraibile.
  const spki = await crypto.subtle.exportKey('spki', coppia.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', coppia.privateKey);

  const privata = await crypto.subtle.importKey(
    'pkcs8', pkcs8, cfg.parametri, false, ['sign']);

  // I byte della chiave privata non servono più: si sovrascrivono.
  new Uint8Array(pkcs8).fill(0);

  const impronta = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
  const spiderId = 'sp_' + base32(impronta.subarray(0, 20));   // 160 bit

  const identita = {
    id: 'locale',
    spiderId,
    algoritmo,
    privata,                       // CryptoKey non estraibile, clonata in struttura
    pubblicaSpki: spki,            // ArrayBuffer
    impronta: esadecimale(impronta).slice(0, 32),
    creato: Date.now(),
    nome: null,                    // auto-dichiarato, §5.3
  };

  await scrivi(STORE.IDENTITA, identita);
  return identita;
}

/* ------------------------------------------------------------- operazioni */

/** Firma dei byte con la chiave dell'identità. Restituisce base64url. */
export async function firma(identita, bytes) {
  const cfg = CONFIGURAZIONE[identita.algoritmo];
  const parametri = identita.algoritmo === 'ECDSA_P256'
    ? { name: 'ECDSA', hash: 'SHA-256' } : 'Ed25519';
  const firma = await crypto.subtle.sign(parametri, identita.privata, bytes);
  return aBase64url(new Uint8Array(firma));
}

/** Verifica una firma con una chiave pubblica data (SPKI). */
export async function verifica(identita, bytes, firmaB64, spki) {
  const chiave = await crypto.subtle.importKey(
    'spki', spki || identita.pubblicaSpki,
    CONFIGURAZIONE[identita.algoritmo].parametri, false, ['verify']);
  const parametri = identita.algoritmo === 'ECDSA_P256'
    ? { name: 'ECDSA', hash: 'SHA-256' } : 'Ed25519';
  return crypto.subtle.verify(parametri, chiave, daBase64url(firmaB64), bytes);
}

/** Ricalcola lo spiderId da una chiave pubblica. Serve a fidarsi di un peer nuovo. */
export async function idDaSpki(spki) {
  const impronta = new Uint8Array(await crypto.subtle.digest('SHA-256', spki));
  return 'sp_' + base32(impronta.subarray(0, 20));
}

/** Il numero di sicurezza da confrontare fuori banda (§5.3). */
export async function numeroSicurezza(identita, spki) {
  const impronta = new Uint8Array(
    await crypto.subtle.digest('SHA-256', spki || identita.pubblicaSpki));
  // Sei gruppi di quattro caratteri: leggibile ad alta voce senza errori.
  const t = base32(impronta.subarray(0, 15)).toUpperCase();
  return t.match(/.{1,4}/g).slice(0, 6).join(' ');
}

/* --------------------------------------------- la chiave pubblica in viaggio */

/* Un ArrayBuffer attraversa JSON diventando `{}`. La chiave pubblica viaggia
 * quindi come testo, e la conversione sta qui in un punto solo: sparsa nei
 * moduli è il tipo di cosa che si dimentica in un angolo e si scopre dopo. */

export function spkiACodice(spki) {
  return aBase64url(new Uint8Array(spki));
}

/**
 * La carta d'identità da mostrare agli altri: chi sono, con che algoritmo firmo,
 * come mi chiamo, e la chiave per verificarmi. È ciò che viaggia nell'invito e
 * nella presentazione — un solo posto, così le due cose non divergono.
 */
export function schedaPubblica(identita) {
  return {
    spiderId: identita.spiderId,
    spki: spkiACodice(identita.pubblicaSpki),
    algoritmo: identita.algoritmo,
    nome: identita.nome || null,
  };
}

export function codiceASpki(codice) {
  const b = daBase64url(codice);
  // Il buffer deve essere esatto: `importKey` rifiuta una vista su un buffer più grande.
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

/* ------------------------------------------------------------- base64url */

export function aBase64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function daBase64url(testo) {
  const s = atob(testo.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
