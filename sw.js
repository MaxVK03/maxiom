const CACHE = 'maxiom-cloud-v2';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './public/icon.svg',
  './vendor/codemirror/codemirror.css', './vendor/codemirror/codemirror.js',
  './vendor/codemirror/mode/markdown/markdown.js',
  './vendor/codemirror/mode/gfm/gfm.js',
  './vendor/codemirror/addon/mode/overlay.js',
  './vendor/codemirror/keymap/vim.js',
  './vendor/codemirror/addon/dialog/dialog.js',
  './vendor/codemirror/addon/dialog/dialog.css',
  './vendor/codemirror/addon/search/searchcursor.js',
  './vendor/codemirror/addon/search/search.js',
  './vendor/codemirror/addon/edit/closebrackets.js',
  './vendor/codemirror/addon/edit/matchbrackets.js',
  './vendor/codemirror/addon/fold/foldcode.js',
  './vendor/codemirror/addon/fold/foldgutter.js',
  './vendor/codemirror/addon/fold/foldgutter.css',
  './vendor/codemirror/addon/fold/markdown-fold.js',
  './vendor/marked/marked.js', './vendor/mathjax/tex-svg.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && (key.startsWith('maxiom-') || key.startsWith('axiom-notes-'))).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' || event.request.url.endsWith('/supabase-config.js')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
