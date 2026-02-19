/* Service Worker for Web Push - alerts when screen is locked */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BG Alert';
  const body = data.body || 'Glucose alert - please check your glucose';
  const tag = data.tag || 'bg-alert';
  const options = {
    body,
    tag,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus();
      } else if (clients.openWindow) {
        clients.openWindow('/');
      }
    })
  );
});
