/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Daniele Deplano (RedRider21) */

/* Black Spider — gli eventi.
 *
 * Il log è la verità; lo stato è una sua proiezione (§6.2). Un evento è un fatto
 * firmato che appartiene a un autore: una volta emesso non si modifica e non si
 * cancella, si aggiunge un evento che dice il contrario.
 *
 * Tre cose che valgono la pena di essere spiegate:
 *
 *  - **L'identificativo è il contenuto.** `id` è l'impronta dei byte dell'evento,
 *    quindi due peer che ricevono lo stesso evento ne calcolano lo stesso id senza
 *    doversi accordare. Non serve un contatore globale né un arbitro.
 *
 *  - **La serializzazione è canonica.** Firmare JSON "come viene" non funziona:
 *    due implementazioni che ordinano le chiavi diversamente producono byte
 *    diversi e firme che non tornano. Qui le chiavi sono ordinate, sempre.
 *
 *  - **La firma copre tutto tranne sé stessa.** `sig` è esclusa dal calcolo,
 *    altrimenti sarebbe auto-referente.
 */

import { firma, verifica, idDaSpki } from './identita.js';
import { base32, aBase64url, daBase64url } from './identita.js';

/* --------------------------------------------------------- serializzazione */

/** JSON con le chiavi ordinate, a ogni livello. È il formato su cui si firma. */
export function canonico(valore) {
  if (valore === null || typeof valore !== 'object') return JSON.stringify(valore);
  if (Array.isArray(valore)) return '[' + valore.map(canonico).join(',') + ']';
  const chiavi = Object.keys(valore).sort();
  return '{' + chiavi.map((k) => JSON.stringify(k) + ':' + canonico(valore[k])).join(',') + '}';
}

export function byteDi(valore) {
  return new TextEncoder().encode(canonico(valore));
}

async function improntaDi(valore) {
  const g = new Uint8Array(await crypto.subtle.digest('SHA-256', byteDi(valore)));
  return 'b3:' + base32(g.subarray(0, 20));
}

/* ------------------------------------------------------------- orologio HLC */

/**
 * Orologio logico ibrido. Serve a ordinare eventi che vengono da macchine con
 * orologi diversi senza fidarsi dei loro orologi.
 *
 * La parte fisica in testa dà un ordine che "assomiglia al tempo" e rende il log
 * leggibile; il contatore dirime i pareggi; lo spiderId rompe i pareggi rimasti
 * in modo *deterministico*, così tutti ordinano allo stesso modo.
 */
export function creaOrologio(spiderId) {
  let ms = 0, contatore = 0;

  return {
    /** Un istante per un evento che stiamo per creare. */
    adesso() {
      const ora = Date.now();
      if (ora > ms) { ms = ora; contatore = 0; }
      else { contatore += 1; }
      return [ms, contatore, spiderId];
    },

    /** Aggiorna l'orologio con quello visto in un evento ricevuto. */
    osserva(remoto) {
      if (!Array.isArray(remoto) || remoto.length !== 3) return;
      const [rMs, rC] = remoto;
      const ora = Date.now();
      const nuovoMs = Math.max(ms, rMs, ora);

      if (nuovoMs === ms && nuovoMs === rMs) contatore = Math.max(contatore, rC) + 1;
      else if (nuovoMs === ms) contatore += 1;
      else if (nuovoMs === rMs) contatore = rC + 1;
      else contatore = 0;

      ms = nuovoMs;
    },

    get stato() { return [ms, contatore, spiderId]; },
  };
}

/** Confronta due HLC. Negativo se `a` viene prima di `b`. */
export function confrontaHlc(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
}

/* ------------------------------------------------------- creazione e firma */

/**
 * Costruisce e firma un evento.
 *
 * `catena` è lo stato della catena dell'autore: { seq, prev }. Ogni evento di un
 * autore punta al precedente, quindi la catena di ciascuno è verificabile da sola
 * e non si possono inserire eventi nel mezzo senza romperla.
 */
export async function crea(identita, orologio, catena, { room, kind, body, refs = [] }) {
  const nucleo = {
    author: identita.spiderId,
    seq: catena.seq + 1,
    prev: catena.prev,
    refs,
    room,
    kind,
    hlc: orologio.adesso(),
    body,
  };

  const sig = await firma(identita, byteDi(nucleo));
  const evento = { id: await improntaDi(nucleo), ...nucleo, sig };
  return evento;
}

/* ------------------------------------------------------------- verifica */

/**
 * Verifica un evento: che l'id corrisponda al contenuto, che la firma sia valida,
 * e che chi lo firma sia davvero l'autore dichiarato.
 *
 * `chiavi` è una mappa spiderId → { spki, algoritmo }. L'algoritmo va dichiarato
 * insieme alla chiave perché non è deducibile: una firma Ed25519 e una P-256 non
 * si distinguono guardandole, e va detto (§5.2).
 *
 * Se la chiave dell'autore non è nota l'esito è `'chiave-ignota'`, che non è un
 * fallimento: è "non lo so ancora". Trattarlo come falso sarebbe sbagliato — un
 * peer può mandarci eventi di autori di cui non abbiamo ancora la chiave.
 */
export async function verificaEvento(evento, chiavi) {
  const { id, sig, ...nucleo } = evento;

  if (await improntaDi(nucleo) !== id) {
    return { valido: false, motivo: 'l\'identificativo non corrisponde al contenuto' };
  }

  const voce = chiavi && chiavi[evento.author];
  if (!voce) return { valido: 'chiave-ignota', motivo: `chiave di ${evento.author} non nota` };

  const { spki, algoritmo } = voce;

  // La chiave dichiarata deve appartenere davvero a quell'autore: senza questo
  // controllo chiunque potrebbe firmare spacciandosi per un altro.
  if (await idDaSpki(spki) !== evento.author) {
    return { valido: false, motivo: 'la chiave pubblica non appartiene all\'autore dichiarato' };
  }

  const ok = await verifica({ algoritmo }, byteDi(nucleo), sig, spki);
  return ok ? { valido: true } : { valido: false, motivo: 'firma non valida' };
}

/** Verifica della *catena* di un autore: seq consecutivi e prev coerenti. */
export function verificaCatena(eventi) {
  const ordinati = [...eventi].sort((a, b) => a.seq - b.seq);
  let prev = null;
  for (const e of ordinati) {
    if (e.prev !== prev) {
      return { valida: false, motivo: `catena rotta all'evento ${e.seq}: atteso prev=${prev}` };
    }
    prev = e.id;
  }
  return { valida: true, ultimo: prev, quanti: ordinati.length };
}

/* --------------------------------------------------------- codifica di rete */

export function impacchetta(evento) {
  return aBase64url(byteDi(evento));
}

export function spacchetta(testo) {
  return JSON.parse(new TextDecoder().decode(daBase64url(testo)));
}
