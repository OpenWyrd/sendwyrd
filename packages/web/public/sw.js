/**
 * SendWyrd service worker — minimal app-shell precache + runtime caching.
 *
 * Scope discipline (CTO calls):
 *   - App shell (HTML/JS/CSS/icons) is precached so the PWA cold-launches
 *     offline. Versioned cache name → updates invalidate.
 *   - /api/* → ALWAYS network-first; we do not want stale envelopes.
 *     Falls back to cache only if the network is dead, and only for GETs.
 *   - Static assets (icons, _next/static) → stale-while-revalidate.
 *   - Sensitive routes (/inbox, /settings, /compose, /w/*, /onboarding,
 *     /recover) → NEVER cached. The HTML for these is fetched fresh from
 *     the network every time, and we do not store responses, even on
 *     successful navigations. This keeps decrypted plaintext or
 *     local-state-bearing markup off persistent storage.
 *
 * Update behavior: on `install` we precache and call skipWaiting() so the
 * new SW takes over immediately. On `activate` we drop old caches and
 * claim clients. The user's next navigation gets the fresh shell. We do
 * NOT prompt — the app is small, no-loss, and the cypherpunk register
 * prefers silent honesty over modal dialogs.
 *
 * NO push notification handlers. ADR-010 forbids the protocol primitive
 * and we do not bring it back at the client layer either.
 */

const SHELL_CACHE = "sendwyrd-shell-v1";
const RUNTIME_CACHE = "sendwyrd-runtime-v1";

// Minimal precache list — landing only. Next.js chunks have hashed names so
// we can't enumerate them here; they'll be picked up by stale-while-revalidate
// on first navigation.
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// Routes whose HTML must never be cached — they hold or reveal local state.
const NO_CACHE_PATHS = [
  "/inbox",
  "/settings",
  "/compose",
  "/onboarding",
  "/recover",
];

function isNoCachePath(pathname) {
  if (NO_CACHE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  // /w/[handle] — wyrd view pages can render decrypted bodies.
  if (pathname.startsWith("/w/")) return true;
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs. Everything else (POST, DELETE, etc) goes straight
  // to the network — we never want to interfere with publish/burn/reply.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin requests: hands off entirely.
  if (url.origin !== self.location.origin) return;

  // /api/* — network-first, fall back to runtime cache only on failure.
  // We deliberately avoid caching successful API responses long-term:
  // envelopes can rotate, tombstones come and go, and we lean conservative
  // (the constraint says "if in doubt, network-first for /api/*").
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstNoStore(req));
    return;
  }

  // Sensitive HTML pages — never cache. Fall through to network only.
  if (req.mode === "navigate" && isNoCachePath(url.pathname)) {
    event.respondWith(fetch(req).catch(() => offlineFallback()));
    return;
  }

  // Static assets under /_next/static, /icons, /favicon, etc — SWR.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // Landing page — try cache, fall through to network.
  if (req.mode === "navigate" && url.pathname === "/") {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // Everything else (other HTML, etc) — network-first with cache fallback.
  event.respondWith(networkFirstNoStore(req));
});

async function networkFirstNoStore(req) {
  try {
    const res = await fetch(req);
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response("offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      // Only cache opaque-ok responses.
      if (res && res.status === 200 && res.type === "basic") {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => undefined);
  return cached || (await fetchPromise) || offlineFallback();
}

function offlineFallback() {
  return new Response(
    "<!doctype html><meta charset=\"utf-8\"><title>offline</title>" +
      "<body style=\"font-family:ui-monospace,monospace;background:#0a0a0a;color:#ededed;" +
      "min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0\">" +
      "<p>offline.</p></body>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
