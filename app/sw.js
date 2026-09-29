/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 Daniele Deplano (RedRider21) */

/* Black Spider — il service worker.
 *
 * Serve a una cosa sola: aprire l'app quando la rete non c'è. Non tocca niente
 * altro — non c'è nessun server da cui ricevere messaggi, quindi non c'è nessun
 * push da gestire, e i dati delle conversazioni restano in IndexedDB dove il
 * service worker non li vede nemmeno.
 *
 * La strategia è "prima quello che ho, poi aggiorno": si risponde subito dalla
 * copia salvata e intanto si scarica la versione nuova per la volta dopo. Con
 * "solo rete" l'app non funzionerebbe offline (e offline è il suo stato
 * normale); con "solo cache" resterebbe ferma alla prima versione installata e
 * non ci sarebbe modo di aggiornarla senza svuotare la memoria a mano.
 */

const VERSIONE = '2';
const CACHE = `black-spider-v${VERSIONE}`;

const GUSCIO = [
  './',
  './index.html',
  './stile.css',
  './manifest.webmanifest',
  './icone/icona.svg',
  './icone/icona-180.png',
  './icone/icona-192.png',
  './icone/icona-512.png',
  './icone/icona-maskable-512.png',
  './js/app.js',
  './js/archivio.js',
  './js/identita.js',
  './js/eventi.js',
  './js/invito.js',
  './js/trasporto.js',
  './js/sincronizzazione.js',
  './js/lingua.js',
  './js/preferenze.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Uno per uno invece di addAll: se un file manca, addAll fallisce in blocco
    // e non si installa niente. Così invece entra tutto il resto.
    await Promise.all(GUSCIO.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { /* il file manca: lo salteremo alla prossima versione */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi
      .filter((n) => n.startsWith('black-spider-') && n !== CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  // Un'app senza server non ha motivo di intercettare altro.
  if (url.origin !== self.location.origin) return;

  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const chiave = req.mode === 'navigate' ? './index.html' : req;
    const salvata = await cache.match(chiave, { ignoreSearch: true });

    const dallaRete = fetch(req).then(async (r) => {
      if (r && r.ok) await cache.put(chiave, r.clone());
      return r;
    }).catch(() => null);

    if (salvata) return salvata;

    const r = await dallaRete;
    if (r) return r;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Black Spider</title>' +
      '<p style="font:16px system-ui;padding:2rem;color:#e8eaf2;background:#0c0d14;' +
      'height:100vh;margin:0">Questa pagina non è ancora stata scaricata: ' +
      'apri l\'app una volta con la rete, poi funzionerà anche senza.</p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  })());
});
