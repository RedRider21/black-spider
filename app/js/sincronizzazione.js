/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Daniele Deplano (RedRider21) */

/* Black Spider — la sincronizzazione.
 *
 * Due peer che si incontrano si scambiano ciò che all'altro manca. Il protocollo è
 * volutamente elementare e simmetrico: entrambi fanno le stesse mosse, nessuno dei due
 * comanda.
 *
 *   1. appena il canale è aperto, ognuno si presenta (identità + chiave pubblica);
 *   2. ognuno manda la propria **frontiera**: l'ultimo evento che conosce per ogni autore;
 *   3. ognuno manda all'altro gli eventi che la frontiera dichiara mancanti;
 *   4. chi riceve **verifica** prima di credere: firma, identificativo, catena.
 *
 * Il punto 4 è quello che conta. Uno scambio fra pari in cui ci si fida di ciò che
 * arriva non è uno scambio fra pari: è una porta aperta. Qui un evento entra
 * nell'archivio solo se la firma regge e appartiene davvero all'autore che dichiara.
 *
 * **Il limite noto di questa versione.** Se arriva un evento di un autore di cui non
 * abbiamo la chiave, non lo buttiamo e non lo crediamo: resta *in attesa*. Quando la
 * chiave arriva, l'evento viene verificato e ammesso. Serve perché nella v0 le chiavi
 * si imparano solo dai peer connessi, mentre la versione con gossip (§9.3) dovrà
 * chiederle esplicitamente a chi le ha.
 */

import { verificaEvento, verificaCatena, confrontaHlc } from './eventi.js';
import { t } from './lingua.js';
import { schedaPubblica, codiceASpki } from './identita.js';
import { STORE, leggi, scrivi, leggiTutti, scriviMolti } from './archivio.js';

/* ------------------------------------------------------- chiavi conosciute */

let cacheChiavi = null;
const inAttesa = new Map();          // autore → eventi in attesa della chiave

export async function chiavi() {
  if (cacheChiavi) return cacheChiavi;
  const salvato = await leggi(STORE.STATO, 'chiavi');
  cacheChiavi = (salvato && salvato.mappa) || {};
  return cacheChiavi;
}

export async function registraChiave(spiderId, spki, algoritmo, nome) {
  const mappa = await chiavi();
  const gia = mappa[spiderId];
  if (gia && gia.algoritmo === algoritmo) {
    if (nome && gia.nome !== nome) { gia.nome = nome; await salvaChiavi(mappa); }
    return false;
  }
  mappa[spiderId] = { spki, algoritmo, nome: nome || null };
  await salvaChiavi(mappa);
  return true;
}

async function salvaChiavi(mappa) {
  await scrivi(STORE.STATO, { chiave: 'chiavi', mappa });
}

/* ------------------------------------------------------------- eventi */

/** Gli eventi di una stanza, in ordine di HLC (l'ordine in cui vanno mostrati). */
export async function eventiDellaStanza(stanza) {
  const tutti = await leggiTutti(STORE.EVENTI);
  return tutti
    .filter((e) => e.room === stanza)
    .sort((a, b) => confrontaHlc(a.hlc, b.hlc));
}

/** La frontiera: l'ultimo evento conosciuto per ogni autore, in una stanza. */
export async function frontiera(stanza) {
  const eventi = await eventiDellaStanza(stanza);
  const f = {};
  for (const e of eventi) {
    const attuale = f[e.author];
    if (!attuale || e.seq > attuale.seq) f[e.author] = { seq: e.seq, id: e.id };
  }
  return f;
}

/* --------------------------------------------------------- il protocollo */

/**
 * Lega un trasporto appena aperto alla conversazione.
 * Restituisce un oggetto per mandare in giro gli eventi appena creati.
 */
export function sincronizza(trasporto, { identita, stanza, onNuovi, onNota }) {
  let frontieraRicevuta = false;
  let presentato = false;

  const nota = (m, grave) => { if (onNota) onNota(m, grave); };

  /* --- invio di ciò che all'altro manca, secondo la sua frontiera --- */
  async function mandaMancanti(loroFrontiera) {
    const miei = await eventiDellaStanza(stanza);
    const daMandare = miei.filter((e) => {
      const suo = loroFrontiera[e.author];
      return !suo || e.seq > suo.seq;
    });
    if (daMandare.length === 0) {
      nota(t('sinc.inPari'));
      return;
    }
    nota(t('sinc.mandoMancanti', { n: daMandare.length }));
    // A blocchi: un log lungo non deve diventare un messaggio solo.
    const BLOCCO = 200;
    for (let i = 0; i < daMandare.length; i += BLOCCO) {
      await trasporto.invia({ t: 'eventi', stanza, eventi: daMandare.slice(i, i + BLOCCO) });
    }
  }

  /* --- ricezione: verifica, poi credi --- */
  async function accogli(eventi) {
    const mappa = await chiavi();
    const accettati = [];
    let rifiutati = 0, rimandati = 0;

    for (const e of eventi) {
      if (e.room !== stanza) continue;
      const esito = await verificaEvento(e, mappa);

      if (esito.valido === true) {
        accettati.push(e);
      } else if (esito.valido === 'chiave-ignota') {
        // Non è un falso: è un "non lo so ancora". Si mette da parte.
        const coda = inAttesa.get(e.author) || [];
        if (!coda.some((x) => x.id === e.id)) coda.push(e);
        inAttesa.set(e.author, coda);
        rimandati += 1;
      } else {
        rifiutati += 1;
        nota(t('sinc.respinto', { autore: e.author.slice(0, 12) + '…', motivo: esito.motivo }), true);
      }
    }

    if (accettati.length) {
      // Non riscrivere ciò che c'è già: l'archivio è indicizzato per identificativo.
      const gia = new Set((await leggiTutti(STORE.EVENTI)).map((x) => x.id));
      const nuovi = accettati.filter((e) => !gia.has(e.id));
      if (nuovi.length) {
        await scriviMolti(STORE.EVENTI, nuovi);
        if (onNuovi) onNuovi(nuovi);
        nota(t('sinc.accettati', {
          n: nuovi.length, gia: accettati.length - nuovi.length,
        }));
      }
      // La catena di ogni autore deve restare continua: se non lo è, qualcosa non torna.
      const perAutore = new Map();
      for (const e of await eventiDellaStanza(stanza)) {
        if (!perAutore.has(e.author)) perAutore.set(e.author, []);
        perAutore.get(e.author).push(e);
      }
      for (const [autore, suoi] of perAutore) {
        const esito = verificaCatena(suoi);
        if (!esito.valida) nota(t('sinc.catenaRotta', {
          autore: autore.slice(0, 12) + '…', motivo: esito.motivo,
        }), true);
      }
    }
    if (rifiutati) nota(t('sinc.respinti', { n: rifiutati }), true);
    if (rimandati) nota(t('sinc.inAttesa', { n: rimandati }));
  }

  /* --- riprova gli eventi rimasti in attesa --- */
  async function riprovaInAttesa(autore) {
    const coda = inAttesa.get(autore);
    if (!coda || !coda.length) return;
    inAttesa.delete(autore);
    await accogli(coda);
  }

  /* --- le mosse --- */
  trasporto.onMessaggio(async (m) => {
    try {
      if (m.t === 'presentazione') {
        const nuovo = await registraChiave(
          m.chi.spiderId, codiceASpki(m.chi.spki), m.chi.algoritmo, m.chi.nome);
        nota(t('sinc.incontrato', {
          chi: m.chi.nome || m.chi.spiderId.slice(0, 14) + '…',
        }));
        if (nuovo) await riprovaInAttesa(m.chi.spiderId);
        // Chi riceve la presentazione risponde con la propria, se non l'ha già fatto.
        if (!presentato) await presenta();
        await trasporto.invia({ t: 'frontiera', stanza, frontiera: await frontiera(stanza) });

      } else if (m.t === 'frontiera') {
        frontieraRicevuta = true;
        await mandaMancanti(m.frontiera || {});

      } else if (m.t === 'eventi') {
        await accogli(m.eventi || []);
      }
    } catch (e) {
      nota(t('sinc.errore', { errore: (e && e.message) || e }), true);
    }
  });

  async function presenta() {
    presentato = true;
    await trasporto.invia({
      t: 'presentazione',
      stanza,
      chi: schedaPubblica(identita),
    });
  }

  return {
    /** Da chiamare quando il canale si apre. */
    avvia: presenta,

    /** Un evento appena creato qui: si deposita e si spedisce subito. */
    async annuncia(evento) {
      await scrivi(STORE.EVENTI, evento);
      if (trasporto.aperto) {
        try { await trasporto.invia({ t: 'eventi', stanza, eventi: [evento] }); }
        catch (e) {
          nota(t('sinc.nonSpedito', { errore: (e && e.message) || e }), true);
        }
      }
      return evento;
    },

    get frontieraRicevuta() { return frontieraRicevuta; },
  };
}
