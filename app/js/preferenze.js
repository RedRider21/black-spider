/* Black Spider — le preferenze dell'interfaccia.
 *
 * Tema, lingua e menu stanno in `localStorage` e non in IndexedDB, e la ragione
 * è precisa: `localStorage` si legge **subito**, prima che la pagina si disegni,
 * mentre IndexedDB è asincrono e la pagina comparirebbe per un istante nel tema
 * sbagliato — un lampo bianco che dà fastidio e che sembra un difetto.
 *
 * Sono preferenze di questo dispositivo, non dati della persona: l'identità e
 * l'archivio restano in IndexedDB, dove sono cose vostre e non impostazioni
 * della scrivania. Chi apre la stessa app su un altro computer trova lì le
 * proprie chiavi, non il proprio tema.
 *
 * Tutto è avvolto in un `try`: in navigazione privata `localStorage` può
 * rifiutarsi di scrivere, e un'app che non parte perché non riesce a ricordare
 * il colore del menu non è un'app.
 */

const PREFISSO = 'bs.';

export function leggi(chiave, difetto = null) {
  try {
    const v = localStorage.getItem(PREFISSO + chiave);
    return v === null ? difetto : v;
  } catch (e) {
    return difetto;
  }
}

export function scrivi(chiave, valore) {
  try {
    localStorage.setItem(PREFISSO + chiave, String(valore));
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------ tema */

export const TEMI = ['auto', 'chiaro', 'scuro'];

export function temaPreferito() {
  const scelto = leggi('tema', 'auto');
  return TEMI.includes(scelto) ? scelto : 'auto';
}

/** Scrive il tema sulla pagina. «auto» non è un colore: è l'assenza di scelta. */
export function applicaTema(tema) {
  const radice = document.documentElement;
  if (tema === 'auto') radice.removeAttribute('data-tema');
  else radice.dataset.tema = tema;
}

/**
 * Il tema che si sta vedendo davvero, sciogliendo «auto».
 * Serve al colore della barra del browser, che non sa leggere le media query
 * del sistema.
 */
export function temaEffettivo() {
  const scelto = temaPreferito();
  if (scelto !== 'auto') return scelto;
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro';
  } catch (e) {
    return 'scuro';
  }
}

/* ------------------------------------------------------------------ menu */

/** 'larga' o 'stretta': vale solo su schermo grande, dove la barra è fissa. */
export function barraPreferita() {
  return leggi('barra', 'larga') === 'stretta' ? 'stretta' : 'larga';
}

export function applicaBarra(stato) {
  document.documentElement.dataset.barra = stato;
}

/** True quando la barra è un cassetto che si apre sopra il contenuto. */
export function schermoStretto() {
  try {
    return matchMedia('(max-width: 859px)').matches;
  } catch (e) {
    return false;
  }
}

export function cambiaSchermo(fn) {
  try {
    matchMedia('(max-width: 859px)').addEventListener('change', fn);
  } catch (e) { /* browser vecchio: si resta senza avviso, non è grave */ }
}
