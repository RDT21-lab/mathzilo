/* Avisos del servidor (se carga dentro del service worker que genera Workbox). Al tocar el aviso
   se abre el modo padre: en una ventana ya abierta si la hay. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Mathzilo', {
    body: d.body || '', tag: d.tag, renotify: !!d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: new URL(d.url || './#/padre', self.registration.scope).href }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) return c.navigate(url).then(w => (w || c).focus()).catch(() => c.focus());
    return self.clients.openWindow(url);
  }));
});
