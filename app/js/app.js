/* Black Spider — l'applicazione.
 *
 * Lega insieme i pezzi: identità, archivio, invito, trasporto, sincronizzazione,
 * e le schermate che li mostrano. È l'unico file che conosce la pagina.
 *
 * Due cose che vale la pena sapere leggendolo:
 *
 *  - **Il nome sta sull'identità, non sulla sessione.** Prima era scritto in due
 *    posti e i due divergevano: il nome si salvava nella sessione mentre la carta
 *    d'identità che parte con l'invito leggeva quello dell'identità, che restava
 *    vuoto. Un nome in due posti è un nome sbagliato in uno dei due.
 *
 *  - **Il log è la verità, lo schermo è una proiezione.** Nessuna funzione qui
 *    dentro tiene «lo stato della conversazione»: ogni volta che qualcosa cambia
 *    si rilegge l'archivio e si ridisegna. Costa poco e rende impossibile che lo
 *    schermo racconti una storia diversa da quella degli eventi.
 */

import { creaOErecupera, schedaPubblica, numeroSicurezza } from './identita.js';
import { creaOrologio, crea as creaEvento, confrontaHlc } from './eventi.js';
import { STORE, leggi, scrivi, conta, leggiTutti, chiediPersistenza } from './archivio.js';
import { decodifica, creaPeer, creaInvito, creaRisposta, completa,
         statistiche, nomeTipo, spiegaTipo, ICE } from './invito.js';
import { creaTrasporto, STATO } from './trasporto.js';
import { creaChiamate, CHIAMATA } from './chiamate.js';
import { sincronizza, eventiDellaStanza, chiavi } from './sincronizzazione.js';
import { t, lingue, lingua, imposta as impostaLingua, applica as applicaLingua }
  from './lingua.js';
import { leggi as prefLeggi, scrivi as prefScrivi, TEMI, temaPreferito,
         applicaTema, barraPreferita, applicaBarra, schermoStretto, cambiaSchermo }
  from './preferenze.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const FUGA = (s) => String(s).replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* --------------------------------------------------------------- stato vivo */

let identita = null;
let orologio = null;
let sessione = null;          // { stanza, catena, hlcUltimo }
let trasporto = null;
let sinc = null;
let pcCorrente = null;
let attesaRisposta = null;    // { pc } mentre si aspetta il codice di ritorno
let statoTrasporto = null;    // l'ultimo stato detto dal trasporto
let persistenza = { concesso: false };
let chiamate = null;          // il motore delle chiamate, o null se non c'è nessuno
let polite = false;           // chi ha *risposto* all'invito cede nelle negoziazioni
let schedaLontano = null;     // la scheda pubblica dell'altro, imparata dallo scambio
let infoChiamata = {};        // l'ultimo stato della chiamata, per ridisegnarla

/* ---------------------------------------------------------------- registro */

function nota(testo, grave) {
  const riga = document.createElement('div');
  const ora = new Date().toLocaleTimeString(lingua() === 'it' ? 'it-IT' : 'en-GB');
  riga.innerHTML = `<span class="t">${ora}</span> ${FUGA(testo)}`;
  if (grave) riga.classList.add('grave');
  const c = $('#registro');
  c.append(riga);
  c.scrollTop = c.scrollHeight;
}

/** Nota da una chiave di traduzione: `N('nota.archivio', { n: 3 })`. */
const N = (chiave, valori) => nota(t(chiave, valori));

const locale = () => (lingua() === 'it' ? 'it-IT' : 'en-GB');
const breve = (id) => String(id).slice(0, 14) + '…';

/* ------------------------------------------------------ preferenze e aspetto */

/** I due segmenti — tema e lingua — disegnati in tutti i posti in cui compaiono. */
function disegnaSegmenti() {
  disegnaSegmento('tema', TEMI.map((v) => [v, t('tema.' + v)]), temaPreferito());
  disegnaSegmento('lingua', lingue().map((l) => [l.codice, l.nome]), lingua());
}

/**
 * Un segmento, riscritto solo se serve.
 *
 * Se i pulsanti ci sono già si aggiorna loro l'etichetta e chi è premuto, invece
 * di buttarli giù e rifarli: ricostruire il contenuto a ogni cambio staccherebbe
 * dal documento i pulsanti che c'erano un momento fa — e chi usa la tastiera si
 * ritroverebbe senza fuoco, perché il pulsante che aveva sotto le dita non
 * esiste più. Si rifà solo quando le voci cambiano davvero, che succede una
 * volta sola, o quando cambia la lingua delle etichette.
 */
function disegnaSegmento(nome, voci, corrente) {
  for (const contenitore of $$(`[data-controllo="${nome}"]`)) {
    const stessaForma = contenitore.children.length === voci.length
      && voci.every(([v], i) => contenitore.children[i].dataset.valore === v);
    if (!stessaForma) {
      contenitore.innerHTML = voci
        .map(([v]) => `<button type="button" data-valore="${FUGA(v)}"></button>`)
        .join('');
    }
    voci.forEach(([v, testo], i) => {
      const b = contenitore.children[i];
      if (b.textContent !== testo) b.textContent = testo;
      const premuto = String(v === corrente);
      if (b.getAttribute('aria-pressed') !== premuto) b.setAttribute('aria-pressed', premuto);
    });
  }
}

/* Il colore della barra del browser non sa leggere le media query del sistema:
 * glielo si dice leggendo il colore vero della testata, che è già quello giusto. */
function aggiornaMetaTema() {
  const meta = $('meta[name="theme-color"]');
  const testata = $('.testata');
  if (meta && testata) meta.content = getComputedStyle(testata).backgroundColor;
}

function cambiaTema(valore) {
  prefScrivi('tema', valore);
  applicaTema(valore);
  aggiornaMetaTema();
  disegnaSegmenti();
}

function cambiaLingua(codice) {
  prefScrivi('lingua', codice);
  impostaLingua(codice);
  applicaLingua();
  disegnaSegmenti();
  aggiornaEtichettaBarra();
  aggiornaTitolo();
  aggiornaStatoPill();
  aggiornaPulsanteChiama();
  // La barra della chiamata non è una vista: si ridisegna a parte, con l'ultimo
  // stato che il motore ha detto.
  disegnaChiamata(document.body.dataset.chiamata, infoChiamata);
  ridisegna();
}

/* ------------------------------------------------------------------- menu */

function apriMenu() {
  document.documentElement.dataset.menu = 'aperto';
  aggiornaEtichettaBarra();
}

function chiudiMenu() {
  document.documentElement.dataset.menu = 'chiuso';
  aggiornaEtichettaBarra();
}

function aggiornaEtichettaBarra() {
  const b = $('#btnBarra');
  const stretto = schermoStretto();
  const aperto = document.documentElement.dataset.menu === 'aperto';
  const compressa = barraPreferita() === 'stretta';
  const chiave = stretto
    ? (aperto ? 'barra.chiudi' : 'barra.apri')
    : (compressa ? 'barra.espandi' : 'barra.comprimi');
  b.setAttribute('title', t(chiave));
  b.setAttribute('aria-label', t(chiave));
  b.setAttribute('aria-expanded', String(stretto ? aperto : !compressa));
}

/* ------------------------------------------------------------------ viste */

const VISTE = ['chat', 'persone', 'archivio', 'app', 'impostazioni'];

/* Le applicazioni previste, nell'ordine in cui hanno senso: la chat c'è, le
 * altre si appoggiano agli stessi pezzi. L'elenco è lo stesso della tabella in
 * ARCHITETTURA.md §13.3 — se qui e là non dicono la stessa cosa, uno dei due
 * sta mentendo. */
const MODULI = [
  { id: 'chat', icona: 'i-chat', pronta: true, apre: 'chat' },
  { id: 'chiamate', icona: 'i-chiamate', pronta: true, apre: 'chat' },
  { id: 'file', icona: 'i-file' },
  { id: 'bacheca', icona: 'i-bacheca' },
  { id: 'blocchi', icona: 'i-note' },
];

function aggiornaTitolo() {
  const v = document.body.dataset.vista || 'chat';
  document.title = `${t('app.nome')} — ${t('voce.' + v)}`;
}

async function mostra(nome) {
  if (!VISTE.includes(nome)) nome = 'chat';
  document.body.dataset.vista = nome;
  for (const v of VISTE) $('#vista-' + v).hidden = v !== nome;
  for (const b of $$('.voce[data-vista]')) {
    if (b.dataset.vista === nome) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  $('#contenuto').scrollTop = 0;
  aggiornaTitolo();
  await ridisegna(nome);
}

/** Ridisegna una vista sola, o tutte quando cambia la lingua. */
async function ridisegna(solo) {
  if (!identita || !sessione) return;
  if (!solo || solo === 'persone') await disegnaPersone();
  if (!solo || solo === 'archivio') await disegnaArchivio();
  if (!solo || solo === 'app') disegnaModuli();
  if (!solo || solo === 'impostazioni') await disegnaImpostazioni();
  if (!solo || solo === 'chat') await disegnaMessaggi();
}

/* ------------------------------------------------------- stato persistente */

async function caricaSessione() {
  sessione = await leggi(STORE.STATO, 'sessione') || {
    chiave: 'sessione',
    stanza: 'rm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    catena: { seq: 0, prev: null },
    hlcUltimo: 0,
  };
  return sessione;
}

async function salvaSessione() {
  await scrivi(STORE.STATO, sessione);
}

/**
 * Crea un evento mio, lo concatena e aggiorna la sessione.
 * Ogni evento avanza tre cose insieme — numero di sequenza, collegamento al
 * precedente, ultimo istante dell'orologio — e devono avanzare insieme: se una
 * delle tre resta indietro, al riavvio successivo si producono eventi ambigui.
 */
async function creaEventoLocale(kind, body) {
  const evento = await creaEvento(identita, orologio, sessione.catena, {
    room: sessione.stanza, kind, body,
  });
  sessione.catena = { seq: evento.seq, prev: evento.id };
  sessione.hlcUltimo = evento.hlc[0];
  await salvaSessione();
  return evento;
}

/* ------------------------------------------------------------ la proiezione */

/** Da log a schermo: gli eventi di chat della stanza, in ordine di HLC. */
async function disegnaMessaggi() {
  if (!identita || !sessione) return;
  const eventi = (await eventiDellaStanza(sessione.stanza))
    .filter((e) => e.kind === 'chat/msg');
  const mappa = await chiavi();
  const contenitore = $('#messaggi');

  if (eventi.length === 0) {
    contenitore.innerHTML = `<p class="vuoto">${FUGA(t('chat.vuoto'))}</p>`;
    return;
  }

  contenitore.innerHTML = eventi.map((e) => {
    const mio = e.author === identita.spiderId;
    const chi = mappa[e.author];
    const nome = mio ? (identita.nome || t('chat.tu'))
      : (chi && chi.nome) || breve(e.author);
    const ora = new Date(e.hlc[0]).toLocaleTimeString(locale(),
      { hour: '2-digit', minute: '2-digit' });
    return `<div class="messaggio ${mio ? 'mio' : 'altrui'}">
      <div class="intestazione"><span class="chi">${FUGA(nome)}</span>
      <span class="quando">${ora}</span></div>
      <div class="corpo">${FUGA(e.body.testo || '')}</div>
    </div>`;
  }).join('');
  contenitore.scrollTop = contenitore.scrollHeight;
}

/* --------------------------------------------------------------- identità */

async function disegnaPersone() {
  if (!identita || !sessione) return;

  $('#mioId').textContent = breve(identita.spiderId);
  $('#mioNome').textContent = identita.nome || t('testata.senzaNome');
  $('#tuoId').textContent = identita.spiderId;
  $('#numeroSicurezza').textContent = await numeroSicurezza(identita);

  // Non si riscrive il campo mentre qualcuno ci sta scrivendo dentro.
  const campo = $('#inpNome');
  if (document.activeElement !== campo) campo.value = identita.nome || '';

  const mappa = await chiavi();
  const eventi = await eventiDellaStanza(sessione.stanza);
  const autori = [...new Set(eventi.map((e) => e.author))];

  $('#datiArchivio').innerHTML = autori.map((a) => {
    const chi = mappa[a];
    const nome = a === identita.spiderId
      ? `${identita.nome || t('testata.senzaNome')} (${t('chat.tu')})`
      : (chi && chi.nome) || t('testata.senzaNome');
    return `<dt>${FUGA(nome)}</dt><dd><code>${FUGA(a)}</code></dd>`;
  }).join('') || `<dt>—</dt><dd>${FUGA(t('comune.nessuno'))}</dd>`;

  // Le chiavi conosciute: chi si è incontrato, abbia scritto o no.
  const altre = Object.entries(mappa).filter(([id]) => id !== identita.spiderId);
  $('#elencoChiavi').innerHTML = altre.length
    ? altre.map(([id, c]) => `<li class="riga-dato">
        <span class="nome">${FUGA(c.nome || t('testata.senzaNome'))}</span>
        <code>${FUGA(id)}</code>
        <span class="stato tenue">${FUGA(t(autori.includes(id)
          ? 'persone.scriveAnche' : 'persone.scriveNonAncora'))}</span>
      </li>`).join('')
    : `<li class="vuoto">${FUGA(t('persone.nessunoIncontrato'))}</li>`;
}

/** Il nome è un evento come gli altri: firmato, e quindi non falsificabile. */
async function annunciaNome() {
  const evento = await creaEventoLocale('profilo/nome', { nome: identita.nome || '' });
  await sinc.annuncia(evento);
}

$('#btnSalvaNome').addEventListener('click', async () => {
  const nuovo = $('#inpNome').value.trim();
  identita.nome = nuovo || null;
  await scrivi(STORE.IDENTITA, identita);
  await disegnaPersone();
  N('nota.nomeSalvato');
  if (sinc) await annunciaNome();
});

/* --------------------------------------------------------------- archivio */

const MAX_RIGHE = 200;

async function disegnaArchivio() {
  const tutti = (await leggiTutti(STORE.EVENTI))
    .sort((a, b) => confrontaHlc(a.hlc, b.hlc));

  $('#arcTotali').textContent = tutti.length;
  $('#arcAutori').textContent = new Set(tutti.map((e) => e.author)).size;
  $('#arcStanze').textContent = new Set(tutti.map((e) => e.room)).size;

  const mostrati = tutti.slice(-MAX_RIGHE).reverse();
  $('#arcTabella').innerHTML = mostrati.map((e) => `<tr>
      <td class="mono">${e.seq}</td>
      <td>${FUGA(e.kind)}</td>
      <td class="mono">${FUGA(breve(e.author))}</td>
      <td class="mono">${new Date(e.hlc[0]).toLocaleString(locale(),
        { dateStyle: 'short', timeStyle: 'medium' })}</td>
      <td class="mono">${FUGA(e.room)}</td>
    </tr>`).join('')
    || `<tr><td colspan="5" class="vuoto">${FUGA(t('archivio.vuoto'))}</td></tr>`;

  $('#arcNota').textContent = tutti.length > MAX_RIGHE
    ? t('archivio.troncato', { mostrati: MAX_RIGHE, totale: tutti.length }) : '';
}

/* ------------------------------------------------------------- i moduli */

function disegnaModuli() {
  $('#elencoModuli').innerHTML = MODULI.map((m) => {
    const dentro = `
      <svg class="icona"><use href="#${m.icona}"></use></svg>
      <span class="modulo-testo">
        <span class="modulo-nome">${FUGA(t('mod.' + m.id + '.nome'))}
          <span class="pill ${m.pronta ? 'ok' : ''}">${FUGA(t(m.pronta ? 'mod.pronta' : 'mod.inArrivo'))}</span>
        </span>
        <span class="modulo-desc">${FUGA(t('mod.' + m.id + '.desc'))}</span>
      </span>`;
    return m.pronta
      ? `<button class="modulo pronto" type="button" data-apre="${m.apre}">${dentro}
          <svg class="icona freccia"><use href="#i-freccia"></use></svg></button>`
      : `<div class="modulo spento">${dentro}</div>`;
  }).join('');
}

/* ---------------------------------------------------------- impostazioni */

async function disegnaImpostazioni() {
  const quanti = await conta(STORE.EVENTI);
  $('#impEventi').textContent = quanti;
  $('#impMemoria').textContent = t(persistenza.concesso
    ? 'imp.persistente' : 'imp.nonPersistente');
  $('#btnChiedi').hidden = !!persistenza.concesso;
}

$('#btnChiedi').addEventListener('click', async () => {
  persistenza = await chiediPersistenza();
  await disegnaImpostazioni();
  if (!persistenza.concesso) nota(t('nota.memoriaNegata'), true);
});

$('#btnEsporta').addEventListener('click', async () => {
  const eventi = await leggiTutti(STORE.EVENTI);
  const pacchetto = {
    formato: 'black-spider/archivio/1',
    esportato: new Date().toISOString(),
    identita: { ...schedaPubblica(identita), algoritmo: identita.algoritmo },
    eventi,
  };
  const indirizzo = URL.createObjectURL(
    new Blob([JSON.stringify(pacchetto, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = indirizzo;
  a.download = `black-spider-archivio-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(indirizzo);
  N('nota.esportato', { n: eventi.length });
});

/* --------------------------------------------------------------- collegamento */

function nuovoPeer(conStun) {
  return creaPeer(conStun ? ICE.STUN : ICE.NESSUNO);
}

const PILLOLE = {
  [STATO.APERTO]: ['ok', 'stato.collegato'],
  [STATO.IN_CORSO]: ['warn', 'stato.instabile'],
  [STATO.CHIUSO]: ['warn', 'stato.chiuso'],
  [STATO.FALLITO]: ['err', 'stato.fallito'],
};

/** Rimette la pillola sullo stato vero: dopo un cambio di lingua va rifatto. */
function aggiornaStatoPill() {
  const pillola = $('#pillStato');
  if (!statoTrasporto) {
    pillola.textContent = t('stato.nonCollegato');
    pillola.className = 'pill';
    return;
  }
  const [classe, chiave] = PILLOLE[statoTrasporto] || ['', null];
  pillola.textContent = chiave ? t(chiave) : statoTrasporto;
  pillola.className = 'pill ' + classe;
}

function collega(trasportoNuovo) {
  trasporto = trasportoNuovo;

  sinc = sincronizza(trasporto, {
    identita, stanza: sessione.stanza,
    onNuovi: async () => { await disegnaMessaggi(); await disegnaPersone(); },
    onNota: nota,
  });

  /* La chiamata nasce con la connessione e muore con lei. Si crea qui, dove si
   * sa già chi ha invitato e chi ha risposto — è quella la differenza che serve
   * alla negoziazione. */
  chiamate = creaChiamate({
    trasporto,
    polite,
    scheda: schedaPubblica(identita),
    chiIniziale: schedaLontano,
    onStato: disegnaChiamata,
    nota,
  });
  disegnaChiamata(CHIAMATA.NESSUNA, {});

  trasporto.onStato((stato, dettaglio) => {
    statoTrasporto = stato;
    aggiornaStatoPill();
    if (dettaglio) nota(dettaglio, stato === STATO.FALLITO);
    if (stato === STATO.APERTO) {
      $('#pannelloCollegamento').hidden = true;
      $('#pannelloChat').hidden = false;
      misuraPercorso();
      sinc.avvia();
    }
    // Una chiamata non sopravvive alla connessione che la porta: non c'è un
    // secondo canale su cui continuarla, quindi si dichiara finita invece di
    // restare lì a far finta.
    if ((stato === STATO.CHIUSO || stato === STATO.FALLITO) && chiamate) {
      chiamate.connessionePersa();
    }
    aggiornaPulsanteChiama();
  });
}

async function misuraPercorso() {
  if (!trasporto || !trasporto.aperto) return;
  const s = await statistiche(trasporto.pc);
  const percorso = $('#pillPercorso');
  if (!s.tipoLocale && !s.tipoRemoto) { percorso.textContent = ''; return; }
  percorso.textContent = t(s.viaRelay ? 'percorso.relay' : 'percorso.diretto',
    { tipo: nomeTipo(s.tipoLocale) });
  percorso.title = spiegaTipo(s.tipoLocale);
  percorso.className = 'pill ' + (s.viaRelay ? 'warn' : 'ok');
  $('#pillRtt').textContent = s.rtt != null ? `${s.rtt} ms` : '';
  return s;
}

setInterval(() => { if (trasporto && trasporto.aperto) misuraPercorso(); }, 5000);

/* ---------------------------------------------------------------- chiamata */

/**
 * La barra della chiamata, disegnata dallo stato che le passa il motore.
 *
 * Non tiene stato suo: se la chiamata finisce mentre la si sta disegnando, il
 * disegno successivo lo dice. È la stessa regola dell'archivio — lo schermo è
 * una proiezione, non una seconda verità.
 *
 * Le due tracce per le prove: `body.dataset.chiamata` (in che stato è) e
 * `body.dataset.chiamataByte` (quanta voce è arrivata). Sono numeri e parole
 * chiave, non frasi da leggere: le frasi cambiano con la lingua.
 */
function disegnaChiamata(stato, info = {}) {
  infoChiamata = info;
  const barra = $('#barraChiamata');
  if (!barra) return;

  document.body.dataset.chiamata = stato || CHIAMATA.NESSUNA;
  document.body.dataset.chiamataByte = String(info.byte || 0);
  document.body.dataset.chiamataVideoByte = String(info.byteVideo || 0);
  document.body.dataset.chiamataTipi = info.tipi || '';

  // «Chiama» dipende anche dalla chiamata, non solo dalla connessione: mentre si
  // parla deve spegnersi, e quando si riattacca deve riaccendersi. Sta qui, sopra
  // l'uscita anticipata, perché una chiamata che finisce è proprio uno dei casi in
  // cui la barra sparisce — e da sotto non lo si aggiornerebbe più: il pulsante
  // resterebbe spento per sempre, che è peggio di com'era prima.
  aggiornaPulsanteChiama();

  const viva = stato === CHIAMATA.CHIAMANDO || stato === CHIAMATA.SQUILLA
    || stato === CHIAMATA.IN_CORSO;
  barra.hidden = !viva;
  if (!viva) return;

  barra.dataset.stato = stato;
  const chi = (info.chi && (info.chi.nome || info.chi.spiderId)) || t('chiamata.sconosciuto');
  const modo = info.video ? t('chiamata.conVideo') : t('chiamata.soloVoce');
  const mostra = (sel, si) => { $(sel).hidden = !si; };

  $('#chiamataTesto').textContent = stato === CHIAMATA.SQUILLA
    ? `${chi} ${t('chiamata.tiChiama')} · ${modo}`
    : stato === CHIAMATA.CHIAMANDO
      ? `${t('chiamata.stoChiamando', { chi })} · ${modo}`
      // Niente «Riattacca» in fondo alla frase: il pulsante che lo fa è a due
      // centimetri, e ripeterlo qui era rumore. Al suo posto, sotto, il tempo.
      : `${t('chiamata.inCorso')} ${chi} · ${modo}`;

  const secondi = info.durata || 0;
  $('#chiamataDurata').textContent = stato === CHIAMATA.IN_CORSO
    ? `${Math.floor(secondi / 60)}:${String(secondi % 60).padStart(2, '0')}` : '';

  // Il segno dice com'è messa la voce: accesa, muta, o in attesa di risposta.
  const segno = barra.querySelector('.chiamata-segno use');
  if (segno) segno.setAttribute('href', info.muto ? '#i-microfono-spento' : '#i-microfono');

  mostra('#btnAccetta', stato === CHIAMATA.SQUILLA);
  mostra('#btnRifiuta', stato === CHIAMATA.SQUILLA);
  mostra('#btnMuto', stato === CHIAMATA.IN_CORSO);
  mostra('#btnVideo', stato === CHIAMATA.IN_CORSO);
  mostra('#btnRiattacca', stato !== CHIAMATA.SQUILLA);

  const muto = $('#btnMuto');
  muto.textContent = t(info.muto ? 'chiamata.riparla' : 'chiamata.muto');
  muto.classList.toggle('attivo', !!info.muto);
  muto.setAttribute('aria-pressed', String(!!info.muto));

  const vid = $('#btnVideo');
  vid.textContent = t(info.video ? 'chiamata.videoSpegni' : 'chiamata.videoAccendi');
  vid.classList.toggle('attivo', !!info.video);
  vid.setAttribute('aria-pressed', String(!!info.video));
}

/** Si può chiamare solo se c'è qualcuno dall'altra parte. */
function aggiornaPulsanteChiama() {
  const b = $('#btnChiama');
  if (!b) return;
  const possibile = !!trasporto && trasporto.aperto
    && (!chiamate || chiamate.stato === CHIAMATA.NESSUNA || chiamate.stato === CHIAMATA.CHIUSA);
  b.disabled = !possibile;
  b.setAttribute('title', t(possibile ? 'chiamata.spiega' : 'chiamata.nonCollegato'));
}

async function conChiamata(azione) {
  if (!chiamate) return N('chiamata.nonCollegato');
  try { await azione(); }
  catch (e) { nota((e && e.message) || String(e), true); }
}

$('#btnChiama').addEventListener('click', () => conChiamata(() => chiamate.chiama()));
$('#btnAccetta').addEventListener('click', () => conChiamata(() => chiamate.accetta()));
$('#btnRifiuta').addEventListener('click', () => conChiamata(() => chiamate.rifiuta()));
$('#btnRiattacca').addEventListener('click', () => conChiamata(() => chiamate.riattacca()));
$('#btnMuto').addEventListener('click', () => chiamate && chiamate.cambiaMuto());
$('#btnVideo').addEventListener('click', () => conChiamata(() => chiamate.cambiaVideo()));

/* ------------------------------------------------------------------ invito */

$('#btnCrea').addEventListener('click', async () => {
  try {
    $('#btnCrea').disabled = true;
    // Chi invita non cede: chi risponde cede. Serve alla negoziazione della
    // chiamata, ed è la stessa asimmetria che c'è già fra i due ruoli.
    polite = false;
    schedaLontano = null;   // si imparerà dalla risposta
    const conStun = $('#usaStun').checked;
    N(conStun ? 'nota.creaStun' : 'nota.creaLocale');

    pcCorrente = nuovoPeer(conStun);
    const { dc, codice, gathering } = await creaInvito(
      pcCorrente, schedaPubblica(identita), sessione.stanza,
      conStun ? ICE.STUN : ICE.NESSUNO, 12000);

    N('nota.raccolta', { esito: t('ice.esito.' + gathering) });
    const link = `${location.origin}${location.pathname}#invito=${codice}`;
    $('#invitoOut').value = link.length < 3000 ? link : codice;
    $('#riquadroInvito').hidden = false;
    N('nota.invitoPronto', { n: codice.length });

    collega(creaTrasporto(pcCorrente, dc));
    attesaRisposta = { pc: pcCorrente };
  } catch (e) {
    N('nota.invitoFallito', { errore: e.message });
  } finally {
    $('#btnCrea').disabled = false;
  }
});

$('#btnCompleta').addEventListener('click', async () => {
  try {
    if (!attesaRisposta) return N('nota.primaInvito');
    const testo = $('#rispostaIn').value.trim();
    if (!testo) return N('nota.incollaRisposta');
    const risposta = await decodifica(testo);
    await completa(attesaRisposta.pc, risposta);
    // La risposta porta anche la scheda di chi ha risposto: da qui in poi si sa
    // con chi si parla, e la barra della chiamata può dirlo per nome.
    if (risposta.chi) {
      schedaLontano = risposta.chi;
      if (chiamate) chiamate.conosci(risposta.chi);
    }
    N('nota.rispostaAccettata');
  } catch (e) {
    N('nota.rispostaNonValida', { errore: e.message });
  }
});

$('#btnRispondi').addEventListener('click', async () => {
  try {
    const testo = $('#invitoIn').value.trim();
    if (!testo) return N('nota.incollaInvito');
    polite = true;

    const codice = testo.includes('#invito=') ? testo.split('#invito=')[1] : testo;
    const invito = await decodifica(codice);
    const conStun = !!invito.stun;
    schedaLontano = invito.chi || null;
    N('nota.invitoDi', {
      chi: invito.chi.nome || breve(invito.chi.spiderId),
      stun: t(conStun ? 'nota.conStun' : 'nota.soloLocale'),
    });

    // Si entra nella stanza di chi invita: è lui che l'ha creata.
    if (invito.stanza && invito.stanza !== sessione.stanza) {
      N('nota.entroStanza', { stanza: invito.stanza });
      sessione.stanza = invito.stanza;
      await salvaSessione();
    }

    pcCorrente = nuovoPeer(conStun);
    const { codice: rispostaCodice, gathering } = await creaRisposta(
      pcCorrente, invito, schedaPubblica(identita),
      conStun ? ICE.STUN : ICE.NESSUNO, 12000);

    N('nota.raccolta', { esito: t('ice.esito.' + gathering) });
    $('#rispostaOut').value = rispostaCodice;
    $('#riquadroRisposta').hidden = false;
    N('nota.rispostaPronta', { n: rispostaCodice.length });

    const dc = await new Promise((r) => { pcCorrente.ondatachannel = (ev) => r(ev.channel); });
    collega(creaTrasporto(pcCorrente, dc));
  } catch (e) {
    N('nota.invitoNonValido', { errore: e.message });
  }
});

/* ------------------------------------------------------------ copia/incolla */

function collegaCopia(pulsante, selettore, chiaveCosa) {
  pulsante.addEventListener('click', async () => {
    const campo = $(selettore);
    campo.select();
    const cosa = t(chiaveCosa);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(campo.value);
        N('nota.copiato', { cosa });
        return;
      }
      throw new Error('contesto non sicuro');
    } catch {
      N('nota.copiaAMano', { cosa });
    }
  });
}
collegaCopia($('#btnCopiaLink'), '#invitoOut', 'comune.link');
collegaCopia($('#btnCopiaRisposta'), '#rispostaOut', 'comune.codice');

/* ---------------------------------------------------------------- messaggi */

$('#moduloInvio').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const testo = $('#testo').value.trim();
  if (!testo) return;
  if (!trasporto || !trasporto.aperto) return N('nota.nonCollegato');
  try {
    $('#testo').value = '';
    const evento = await creaEventoLocale('chat/msg', { testo });
    await sinc.annuncia(evento);
    await disegnaMessaggi();
    await disegnaPersone();
  } catch (e) {
    N('nota.messaggioFallito', { errore: e.message });
  }
});

$('#btnChiudi').addEventListener('click', () => {
  // Prima la chiamata, poi la connessione: chiusa quella, la chiamata non ha più
  // nemmeno un canale per dire all'altro che è finita.
  if (chiamate && chiamate.stato !== CHIAMATA.NESSUNA
      && chiamate.stato !== CHIAMATA.CHIUSA) {
    chiamate.riattacca();
  }
  if (trasporto) trasporto.chiudi();
  trasporto = null; sinc = null; chiamate = null; statoTrasporto = null;
  // Chi era dall'altra parte non lo è più: tenerselo lo farebbe comparire nel
  // prossimo collegamento, che è un'altra persona.
  schedaLontano = null;
  $('#pannelloChat').hidden = true;
  $('#pannelloCollegamento').hidden = false;
  aggiornaStatoPill();
  aggiornaPulsanteChiama();
  disegnaChiamata(CHIAMATA.NESSUNA, {});
  $('#pillPercorso').textContent = '';
  $('#pillRtt').textContent = '';
  N('nota.chiuso');
});

/* -------------------------------------------------------- invito nel link */

async function leggiInvitoDalLink() {
  const h = location.hash;
  if (!h.startsWith('#invito=')) return;
  const codice = h.slice('#invito='.length);
  history.replaceState(null, '', location.pathname);
  await mostra('chat');
  $('#invitoIn').value = codice;
  N('nota.invitoNelLink');
}

/* ------------------------------------------------------------------- click */

document.addEventListener('click', (ev) => {
  const segmento = ev.target.closest('.segmento button');
  if (segmento) {
    const tipo = segmento.closest('.segmento').dataset.controllo;
    if (tipo === 'tema') cambiaTema(segmento.dataset.valore);
    else if (tipo === 'lingua') cambiaLingua(segmento.dataset.valore);
    return;
  }

  const voce = ev.target.closest('.voce[data-vista]');
  if (voce) {
    mostra(voce.dataset.vista);
    if (schermoStretto()) chiudiMenu();
    return;
  }

  const modulo = ev.target.closest('.modulo[data-apre]');
  if (modulo) { mostra(modulo.dataset.apre); return; }

  if (ev.target.closest('#velo')) chiudiMenu();
});

$('#btnBarra').addEventListener('click', () => {
  if (schermoStretto()) {
    if (document.documentElement.dataset.menu === 'aperto') chiudiMenu();
    else apriMenu();
  } else {
    const stato = barraPreferita() === 'stretta' ? 'larga' : 'stretta';
    prefScrivi('barra', stato);
    applicaBarra(stato);
    aggiornaEtichettaBarra();
  }
});

$('#btnIo').addEventListener('click', () => {
  mostra('persone');
  if (schermoStretto()) chiudiMenu();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') chiudiMenu();
});

cambiaSchermo(() => {
  if (!schermoStretto()) chiudiMenu();
  aggiornaEtichettaBarra();
});

try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (temaPreferito() === 'auto') aggiornaMetaTema();
  });
} catch (e) { /* niente avviso: il colore resta quello del caricamento */ }

/* ----------------------------------------------------------------- avvio */

(async function avvia() {
  try {
    // Le preferenze per prime: tema e lingua decidono come si disegna tutto il
    // resto, e applicarle dopo vorrebbe dire disegnare due volte.
    impostaLingua(prefLeggi('lingua', 'it'));
    applicaTema(temaPreferito());
    applicaBarra(barraPreferita());
    applicaLingua();
    aggiornaMetaTema();
    disegnaSegmenti();
    aggiornaEtichettaBarra();
    await mostra('chat');

    identita = await creaOErecupera();
    await caricaSessione();
    orologio = creaOrologio(identita.spiderId);

    // L'orologio riparte da dove era: senza questo, un riavvio all'indietro
    // dell'orologio di sistema produrrebbe istanti già usati.
    if (sessione.hlcUltimo) orologio.osserva([sessione.hlcUltimo, 0, identita.spiderId]);

    await disegnaPersone();
    await disegnaMessaggi();

    // Si parte senza nessuno con cui parlare: la barra della chiamata è chiusa e
    // il pulsante per chiamare è spento, con scritto perché.
    aggiornaPulsanteChiama();
    disegnaChiamata(CHIAMATA.NESSUNA, {});

    const quanti = await conta(STORE.EVENTI);
    persistenza = await chiediPersistenza();
    N('nota.identita', { id: breve(identita.spiderId), algoritmo: identita.algoritmo });
    N('nota.archivio', { n: quanti });
    if (!persistenza.concesso) nota(t('nota.memoriaNegata'), true);

    let swOk = false;
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('sw.js');
        swOk = true;
        N('nota.offline');
      } catch (e) {
        N('nota.swFallito', { errore: e.message });
      }
    }

    // Due tracce per le prove automatiche: dicono che l'avvio è finito senza
    // che chi le legge debba indovinarlo da una frase, che cambia con la lingua.
    document.body.dataset.eventi = String(quanti);
    document.body.dataset.sw = swOk ? 'si' : 'no';

    await leggiInvitoDalLink();
    document.body.dataset.pronto = '1';
  } catch (e) {
    const messaggio = (e && e.message) || String(e);
    nota(t('nota.avvioFallito', { errore: (e && e.stack) || messaggio }), true);
    document.body.dataset.avvioFallito = messaggio;
    $('#contenuto').insertAdjacentHTML('afterbegin',
      `<p class="pannello grave">${FUGA(t('errore.avvio', { errore: messaggio }))}</p>`);
  }
})();
