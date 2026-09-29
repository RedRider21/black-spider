/* Black Spider — il trasporto.
 *
 * Un canale dati WebRTC, con due cose che a prima vista sembrano dettagli e non lo sono.
 *
 * **I pezzi.** Un canale dati SCTP non accetta messaggi di dimensione arbitraria: il
 * limite dipende dal browser e dalla negoziazione, e oltre quello il messaggio viene
 * scartato o la connessione cade. Siccome qui ci si scambiano log interi, i messaggi
 * grandi vanno spezzati e ricomposti. La soglia è tenuta bassa di proposito: costa
 * poco e toglie di mezzo una differenza fra browser che altrimenti si scopre in
 * produzione.
 *
 * **La pressione sul buffer.** `send()` non blocca: se si spedisce un log intero a
 * raffica, il buffer cresce più in fretta di quanto la rete lo smaltisca e il browser
 * chiude il canale. Si aspetta che il buffer si svuoti invece di riempirlo.
 */

import { t } from './lingua.js';

const MAX_PEZZO = 12000;        // caratteri di JSON per messaggio
const SOGLIA_BUFFER = 512 * 1024;
const SOGLIA_RIPRESA = 64 * 1024;

export const STATO = {
  NUOVO: 'nuovo', IN_CORSO: 'in corso', APERTO: 'aperto',
  CHIUSO: 'chiuso', FALLITO: 'fallito',
};

export function creaTrasporto(pc, dc) {
  const ascoltatoriMessaggio = [];
  const ascoltatoriStato = [];
  const inArrivo = new Map();          // id del messaggio → pezzi già ricevuti
  let stato = STATO.NUOVO;

  dc.binaryType = 'arraybuffer';

  /* ------------------------------------------------------------- ricezione */

  function consegna(oggetto, daPezzi) {
    for (const f of ascoltatoriMessaggio) {
      try { f(oggetto, daPezzi); }
      catch (e) { console.error('errore in un ascoltatore di messaggi', e); }
    }
  }

  dc.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); }
    catch { console.warn('messaggio non leggibile, ignorato'); return; }

    if (m.t !== '_pezzo') { consegna(m, false); return; }

    // Ricomposizione. `id` distingue messaggi diversi che arrivano intrecciati.
    let gruppo = inArrivo.get(m.id);
    if (!gruppo) { gruppo = { pezzi: new Array(m.n), quanti: 0, n: m.n }; inArrivo.set(m.id, gruppo); }
    if (gruppo.pezzi[m.i] === undefined) {
      gruppo.pezzi[m.i] = m.d;
      gruppo.quanti += 1;
    }
    if (gruppo.quanti === gruppo.n) {
      inArrivo.delete(m.id);
      const intero = gruppo.pezzi.join('');
      let oggetto;
      try { oggetto = JSON.parse(intero); }
      catch { console.warn('messaggio ricomposto ma illeggibile, ignorato'); return; }
      consegna(oggetto, true);
    }
  };

  /* -------------------------------------------------------------- invio */

  /** Aspetta che il buffer scenda sotto la soglia di ripresa. */
  function attendiBuffer() {
    if (dc.bufferedAmount < SOGLIA_BUFFER) return Promise.resolve();
    return new Promise((risolvi) => {
      dc.bufferedAmountLowThreshold = SOGLIA_RIPRESA;
      const fine = () => { dc.removeEventListener('bufferedamountlow', fine); risolvi(); };
      dc.addEventListener('bufferedamountlow', fine);
    });
  }

  let contatorePezzi = 0;

  async function invia(oggetto) {
    if (dc.readyState !== 'open') {
      throw new Error(t('tr.canaleChiuso'));
    }
    const testo = JSON.stringify(oggetto);

    if (testo.length <= MAX_PEZZO) {
      await attendiBuffer();
      dc.send(testo);
      return;
    }

    const id = `${Date.now().toString(36)}-${(contatorePezzi++).toString(36)}`;
    const n = Math.ceil(testo.length / MAX_PEZZO);
    for (let i = 0; i < n; i++) {
      await attendiBuffer();
      dc.send(JSON.stringify({
        t: '_pezzo', id, i, n, d: testo.slice(i * MAX_PEZZO, (i + 1) * MAX_PEZZO),
      }));
    }
  }

  /* -------------------------------------------------------------- stato */

  function annuncia(nuovo, dettaglio) {
    if (stato === nuovo && !dettaglio) return;
    stato = nuovo;
    for (const f of ascoltatoriStato) {
      try { f(nuovo, dettaglio); } catch (e) { console.error(e); }
    }
  }

  dc.onopen = () => annuncia(STATO.APERTO);
  dc.onclose = () => annuncia(STATO.CHIUSO);
  dc.onerror = (e) => annuncia(STATO.FALLITO, e && e.error && e.error.message);

  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') annuncia(STATO.FALLITO, t('tr.rifiutata'));
    if (pc.connectionState === 'disconnected') annuncia(STATO.IN_CORSO, t('tr.interrotta'));
  });

  return {
    invia,
    onMessaggio(f) { ascoltatoriMessaggio.push(f); },
    onStato(f) { ascoltatoriStato.push(f); if (stato !== STATO.NUOVO) f(stato); },
    chiudi() { try { dc.close(); pc.close(); } catch { /* già chiuso */ } },
    get aperto() { return dc.readyState === 'open'; },
    get stato() { return stato; },
    pc, dc,
  };
}
