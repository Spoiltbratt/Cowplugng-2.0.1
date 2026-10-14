// CowPlug NG Service Worker
// Version 1.0.1 - Dynamic PWA Branding
const CACHE_VERSION = 'cowplug-v1.0.1';
const STATIC_CACHE_NAME = `cowplug-static-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `cowplug-runtime-${CACHE_VERSION}`;

// Core static assets for the App Shell
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/apple-touch-icon.png'
];

// Domains and endpoints that MUST ALWAYS be Network-Only and NEVER cached:
// 1. Firebase Firestore & Auth
// 2. Custom backend API endpoints (/api/*)
// 3. Cloudinary uploads (receipts, sensitive investor verification docs)
function isBypassedUrl(url) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  const pathname = urlObj.pathname;

  // Firebase Firestore, Auth, Storage, Google APIs
  if (
    hostname.includes('firestore.googleapis.com') ||
    hostname.includes('identitytoolkit.googleapis.com') ||
    hostname.includes('securetoken.googleapis.com') ||
    hostname.includes('firebaseinstallations.googleapis.com') ||
    hostname.includes('google.com') ||
    hostname.includes('googleapis.com') ||
    hostname.includes('firebaseio.com')
  ) {
    return true;
  }

  // Cloudinary (receipts, KYC documents, sensitive uploads)
  if (hostname.includes('cloudinary.com') || hostname.includes('res.cloudinary.com')) {
    return true;
  }

  // Internal Express API routes
  if (pathname.startsWith('/api/')) {
    return true;
  }

  return false;
}

// 1. Install event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[CowPlug NG SW] Pre-caching app shell assets');
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('[CowPlug NG SW] Pre-cache warning on some assets:', err);
      });
    })
  );
  // Do not automatically force-skip waiting here to prevent disrupting unsaved user inputs
});

// 2. Activate event: Clean up obsolete caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('cowplug-') &&
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== RUNTIME_CACHE_NAME
            );
          })
          .map((cacheName) => {
            console.log('[CowPlug NG SW] Removing legacy cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message handling for controlled updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch event: Stale-While-Revalidate for static assets, Network-First for navigations, Network-Only for dynamic data
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never intercept non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  // Strictly bypass private, financial, auth, Firestore, and API endpoints
  if (isBypassedUrl(request.url)) {
    return;
  }

  // Navigation requests (HTML pages): Network-first with app-shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return the root app shell for client-side routing
          const shell = await caches.match('/index.html');
          if (shell) {
            return shell;
          }
          return new Response('CowPlug NG is currently offline. Please check your network connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts, icons): Stale-While-Revalidate
  const isStaticAsset =
    requestUrl.origin === self.location.origin &&
    (requestUrl.pathname.startsWith('/assets/') ||
     requestUrl.pathname.startsWith('/icons/') ||
     requestUrl.pathname.endsWith('.js') ||
     requestUrl.pathname.endsWith('.css') ||
     requestUrl.pathname.endsWith('.svg') ||
     requestUrl.pathname.endsWith('.png') ||
     requestUrl.pathname.endsWith('.jpg') ||
     requestUrl.pathname.endsWith('.jpeg') ||
     requestUrl.pathname.endsWith('.webp') ||
     requestUrl.pathname.endsWith('.woff2') ||
     requestUrl.pathname.endsWith('.woff') ||
     requestUrl.pathname.endsWith('.ttf') ||
     requestUrl.pathname.includes('/src/assets/'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(RUNTIME_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: try network first, fallback to cache if available
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// ==========================================
// 5. PUSH NOTIFICATIONS & BACKGROUND FCM
// ==========================================

self.addEventListener('push', (event) => {
  console.log('[CowPlug NG SW] Push event received:', event);

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        notification: {
          title: 'CowPlug NG Alert',
          body: event.data.text()
        }
      };
    }
  }

  // Handle standard WebPush / FCM structures
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'CowPlug NG Alert';
  const body = notification.body || data.message || data.body || 'You have a new update in CowPlug NG.';
  const icon = notification.icon || data.icon || '/icons/icon-192x192.png';
  const badge = notification.badge || data.badge || '/icons/icon-192x192.png';
  const actionLink = data.actionLink || data.url || notification.click_action || '/?tab=dashboard';

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: badge,
    tag: data.tag || `cowplug-push-${Date.now()}`,
    data: {
      url: actionLink,
      actionLink: actionLink,
      notificationId: data.notificationId || null,
      timestamp: Date.now()
    },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.priority === 'CRITICAL' || data.priority === 'HIGH',
    actions: [
      { action: 'open', title: 'Open CowPlug NG' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[CowPlug NG SW] Notification click received:', event.notification);
  event.notification.close();

  const targetUrl = (event.notification.data && (event.notification.data.url || event.notification.data.actionLink)) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an existing window client matches the origin, focus and navigate it
      for (const client of windowClients) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // 2. Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

