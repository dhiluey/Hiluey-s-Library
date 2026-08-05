/* Hiluey's Library — funcionamento sem internet.
   Guarda o app no aparelho. Os dados nunca passam por aqui: ficam no
   armazenamento do navegador e sobem para o OneDrive quando há conexão. */

const CACHE = 'hiluey-library-v1';

const ESSENCIAIS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3/lib/msal-browser.min.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // um recurso indisponível não pode derrubar a instalação inteira
    await Promise.allSettled(ESSENCIAIS.map(u => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  // nunca interceptar login nem OneDrive: precisam ser sempre ao vivo
  if(/graph\.microsoft\.com|login\.microsoftonline\.com|login\.live\.com/.test(url.hostname)) return;

  // a página: rede primeiro, para pegar versões novas; cache se estiver sem sinal
  if(req.mode === 'navigate'){
    ev.respondWith((async () => {
      try{
        const r = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', r.clone());
        return r;
      }catch(e){
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // demais recursos: cache primeiro, com atualização silenciosa por trás
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const guardado = await c.match(req);
    const rede = fetch(req).then(r => {
      if(r && r.ok && (url.protocol === 'https:')) c.put(req, r.clone());
      return r;
    }).catch(() => null);
    return guardado || (await rede) || Response.error();
  })());
});
