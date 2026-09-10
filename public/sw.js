// Service Worker cho Web Push Notification.
// LƯU Ý: file này phải nằm ở /public (scope gốc "/") để có quyền nhận push
// và điều hướng cho toàn bộ site, không chỉ riêng 1 thư mục con.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Thông báo cuộc họp', body: '', url: '/dashboard' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Nếu server gửi text thuần thay vì JSON, vẫn hiển thị được nội dung thô.
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url || '/dashboard' },
      tag: payload.tag || undefined
    })
  );
});

// Bấm vào thông báo -> mở đúng trang cuộc họp (hoặc focus tab đang mở sẵn).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
