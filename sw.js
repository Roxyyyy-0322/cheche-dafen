/* 七车打分 · 离线缓存层
   策略：页面导航走「网络优先 + 2 秒超时回退缓存」，静态资源走「缓存优先」。
   这样有网时总能拿到最新版本，断网/弱网（4S 店展厅）时也能秒开。 */

var VERSION = 'car-v2';
var SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.map(function (k) {
          return k === VERSION ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function fallback(req) {
  return caches.match(req).then(function (r) {
    return r || caches.match('./index.html');
  });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    function done(resp) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(resp);
    }
    var timer = setTimeout(function () { done(fallback(req)); }, 2000);
    fetch(req).then(function (resp) {
      if (resp && resp.ok) {
        var copy = resp.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      done(resp);
    }).catch(function () { done(fallback(req)); });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (r) {
    if (r) return r;
    return fetch(req).then(function (resp) {
      if (resp && resp.ok) {
        var copy = resp.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return resp;
    }).catch(function () { return fallback(req); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(req.mode === 'navigate' ? networkFirst(req) : cacheFirst(req));
});

self.addEventListener('message', function (e) {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
