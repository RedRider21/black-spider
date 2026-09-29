/* Black Spider — l'archivio locale.
 *
 * Un solo database IndexedDB per tutto: identità, eventi, stato.
 * Sta qui e non dentro i moduli che lo usano perché sia l'unico punto in cui si
 * apre una transazione: se un domani si cambia da IndexedDB a OPFS per i
 * binari, si tocca questo file e basta.
 */

const NOME_DB = 'black-spider';
const VERSIONE = 1;

export const STORE = {
  IDENTITA: 'identita',   // chiavi e profilo locale
  EVENTI: 'eventi',       // il log firmato
  STATO: 'stato',         // cursori, frontiera, preferenze
};

let promessaDb = null;

/** Apre (o crea) il database. La promessa è condivisa: si apre una volta sola. */
export function apri() {
  if (promessaDb) return promessaDb;
  promessaDb = new Promise((risolvi, rifiuta) => {
    const richiesta = indexedDB.open(NOME_DB, VERSIONE);

    richiesta.onupgradeneeded = (ev) => {
      const db = ev.target.result;

      if (!db.objectStoreNames.contains(STORE.IDENTITA)) {
        db.createObjectStore(STORE.IDENTITA, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE.EVENTI)) {
        const e = db.createObjectStore(STORE.EVENTI, { keyPath: 'id' });
        // Indici sui tre modi in cui guarderemo il log.
        e.createIndex('perAutore', ['author', 'seq'], { unique: true });
        e.createIndex('perHlc', 'hlc');
        e.createIndex('perStanza', ['room', 'hlc'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE.STATO)) {
        db.createObjectStore(STORE.STATO, { keyPath: 'chiave' });
      }
    };

    richiesta.onsuccess = () => risolvi(richiesta.result);
    richiesta.onerror = () => rifiuta(richiesta.error);
    richiesta.onblocked = () => rifiuta(new Error(
      'Un\'altra scheda tiene aperto il database con una versione vecchia. ' +
      'Chiudi le altre schede di Black Spider e ricarica.'));
  });
  return promessaDb;
}

/** Esegue `lavoro(store)` dentro una transazione. */
async function inTransazione(nomi, modo, lavoro) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const tx = db.transaction(nomi, modo);
    let risultato;
    try {
      risultato = lavoro(
        nomi.length === 1 ? tx.objectStore(nomi[0]) : nomi.map((n) => tx.objectStore(n)));
    } catch (e) {
      rifiuta(e);
      return;
    }
    tx.oncomplete = () => risolvi(risultato && risultato.__valore !== undefined
      ? risultato.__valore : risultato);
    tx.onerror = () => rifiuta(tx.error);
    tx.onabort = () => rifiuta(tx.error || new Error('transazione interrotta'));
  });
}

/** Avvolge una IDBRequest in una promessa, per l'uso dentro una transazione. */
export function comePromessa(richiesta) {
  const guscio = { __valore: undefined };
  guscio.__promessa = new Promise((risolvi, rifiuta) => {
    richiesta.onsuccess = () => { guscio.__valore = richiesta.result; risolvi(richiesta.result); };
    richiesta.onerror = () => rifiuta(richiesta.error);
  });
  return guscio;
}

/* --------------------------------------------------------------- comodità */

export async function leggi(store, chiave) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const r = db.transaction(store, 'readonly').objectStore(store).get(chiave);
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
}

export async function scrivi(store, valore) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(valore);
    tx.oncomplete = () => risolvi(valore);
    tx.onerror = () => rifiuta(tx.error);
  });
}

export async function scriviMolti(store, valori) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of valori) os.put(v);
    tx.oncomplete = () => risolvi(valori.length);
    tx.onerror = () => rifiuta(tx.error);
    tx.onabort = () => rifiuta(tx.error || new Error('transazione interrotta'));
  });
}

export async function leggiTutti(store, intervallo, conteggio) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const r = db.transaction(store, 'readonly').objectStore(store)
      .getAll(intervallo, conteggio);
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
}

export async function leggiPerIndice(store, indice, intervallo, conteggio) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const r = db.transaction(store, 'readonly').objectStore(store)
      .index(indice).getAll(intervallo, conteggio);
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
}

export async function conta(store) {
  const db = await apri();
  return new Promise((risolvi, rifiuta) => {
    const r = db.transaction(store, 'readonly').objectStore(store).count();
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
}

/* ------------------------------------------------------------- persistenza */

/** Chiede al browser di non buttare via i dati (§11.1). Può essere negato: non è un errore. */
export async function chiediPersistenza() {
  if (!navigator.storage || !navigator.storage.persist) {
    return { concesso: false, motivo: 'API non disponibile' };
  }
  try {
    const gia = await navigator.storage.persisted();
    const concesso = gia || await navigator.storage.persist();
    let stima = null;
    if (navigator.storage.estimate) stima = await navigator.storage.estimate();
    return { concesso, giaEra: gia, stima };
  } catch (e) {
    return { concesso: false, motivo: String(e && e.message || e) };
  }
}
