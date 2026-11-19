/* Played & Made — Offline-capable Service Worker (Sprint 2: split shell + immutable hashed assets + SWR) */
"use strict";

const CACHE_NAME = "pm-shell-581458e33a";
const RUNTIME_CACHE = "pm-runtime-v2";
const FONT_CACHE = "pm-fonts-v1";
const PRECACHE = [
  "./index.html",
  "./app.f6e6986d92.css",
  "./app.7379ce4440.js",
  "./data.3817b99494.json",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./icon-monochrome-512.png",
  "./apple-touch-icon.png"
];

const IMMUTABLE_RE = /\/(?:data|app)\.[a-f0-9]{8,16}\.(?:json|js|css)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("pm-shell-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(async (cache) => {
    const cached = (await cache.match(req)) || (await caches.match(req));
    const net = fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => cached || Response.error());
    return cached || net;
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fonts: Stale-While-Revalidate in dedicated cache
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // Never intercept cross-origin APIs (Supabase, Steam, Wikimedia, IGDB, Cloudflare)
  if (url.origin !== self.location.origin) return;

  // Immutable content-hashed assets (data.<hash>.json, app.<hash>.js, app.<hash>.css): Cache-First
  if (IMMUTABLE_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // HTML navigations & manifest: Network-First with offline precache fallback
  if (
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.webmanifest")
  ) {
    const isHtml = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(isHtml ? "./index.html" : req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          if (isHtml) {
            return (await cache.match(req)) || (await cache.match("./index.html")) || (await cache.match("./"));
          }
          return await cache.match(req);
        })
    );
    return;
  }

  // Everything else on same origin (icons, OG/PWA previews, misc): Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});
