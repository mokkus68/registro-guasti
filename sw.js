// Service worker: permette di aprire l'app anche senza connessione.
// - Pagina e file dell'app: prima la rete (così arrivano sempre gli aggiornamenti),
//   se manca la rete usa la copia salvata.
// - Grafica (Tailwind) e miniature delle foto su Drive: copia salvata, aggiornata quando possibile.
// - Le richieste allo script Google (POST) non passano da qui.

const VERSIONE = 'registro-guasti-v1';
const CACHE_APP = VERSIONE + '-app';
const CACHE_FOTO = 'registro-guasti-foto';
const MAX_FOTO = 400;

const FILE_APP = ['./', './index.html', './manifest.json', './icon.png'];
const TAILWIND = 'https://cdn.tailwindcss.com';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    await cache.addAll(FILE_APP);
    try {
      const res = await fetch(new Request(TAILWIND, { mode: 'no-cors' }));
      await cache.put(TAILWIND, res);
    } catch (e) { /* verrà salvato al prossimo caricamento */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi
      .filter(n => n.startsWith('registro-guasti-') && n !== CACHE_APP && n !== CACHE_FOTO)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function primaLaRete(request, chiave) {
  const cache = await caches.open(CACHE_APP);
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(chiave || request, res.clone());
    return res;
  } catch (e) {
    const salvata = await cache.match(chiave || request, { ignoreSearch: true });
    if (salvata) return salvata;
    if (request.mode === 'navigate') {
      const pagina = await cache.match('./index.html');
      if (pagina) return pagina;
    }
    throw e;
  }
}

async function primaLaCopia(request, nomeCache, limite) {
  const cache = await caches.open(nomeCache);
  const salvata = await cache.match(request);
  const daRete = fetch(request).then(async (res) => {
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(request, res.clone());
      if (limite) {
        const chiavi = await cache.keys();
        for (let i = 0; i < chiavi.length - limite; i++) await cache.delete(chiavi[i]);
      }
    }
    return res;
  }).catch(() => null);
  return salvata || (await daRete) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(primaLaRete(req));
  } else if (url.href.startsWith(TAILWIND)) {
    event.respondWith(primaLaCopia(req, CACHE_APP));
  } else if (url.hostname === 'drive.google.com' && url.pathname.startsWith('/thumbnail')) {
    event.respondWith(primaLaCopia(req, CACHE_FOTO, MAX_FOTO));
  }
});
