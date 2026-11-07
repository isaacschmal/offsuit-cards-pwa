const CACHE_NAME = 'offsuit-pwa-v2';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SHOW_TURN_NOTIFICATION') {
    const title = data.title || '¡Es tu turno en la mesa!';
    const options = {
      body: data.body || 'Te toca actuar en tu partida de Texas Hold’em.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'offsuit-turn',
      renotify: true,
      data: {
        roomCode: data.roomCode || 'OFFSUIT',
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: '¡Es tu turno en la mesa!',
    body: 'Tus amigos ya jugaron. Entra para ver tus cartas y actuar.',
    roomCode: 'OFFSUIT',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `offsuit-turn-${payload.roomCode}`,
      renotify: true,
      data: { roomCode: payload.roomCode },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return Promise.resolve();
    })
  );
});
