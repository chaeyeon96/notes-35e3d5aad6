// Service worker for the private build (copied to /sw.js with base and version filled in).
// Everything it stores is the encrypted site, so the cache holds nothing readable without the password.
const BASE = __BASE__
const CACHE = "study-wiki-" + __VERSION__

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("study-wiki-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
)

async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match(BASE + "/")) || Response.error()
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok || res.type === "opaque") cache.put(req, res.clone())
  return res
}

self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  const sameOrigin = url.origin === location.origin
  // Pages, lock data and the search index change on every build: try the network first.
  if (req.mode === "navigate" || (sameOrigin && /\/(lock\.json|search-index\.bin|offline-list\.json)$/.test(url.pathname))) {
    return e.respondWith(networkFirst(req))
  }
  // Images, styles, scripts, fonts (also from CDNs): cache first.
  e.respondWith(cacheFirst(req))
})

self.addEventListener("message", async (e) => {
  if (!e.data || e.data.type !== "cache-all") return
  const client = e.source
  const list = await fetch(BASE + "/offline-list.json", { cache: "no-cache" }).then((r) => r.json())
  const cache = await caches.open(CACHE)
  let done = 0
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(
      list.slice(i, i + 6).map((u) =>
        fetch(u)
          .then((res) => res.ok && cache.put(u, res))
          .catch(() => {}),
      ),
    )
    done = Math.min(list.length, i + 6)
    client.postMessage({ type: "progress", done, total: list.length })
  }
  client.postMessage({ type: "done", total: list.length })
})
