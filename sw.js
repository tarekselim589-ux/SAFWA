/* Safwa — كاش علشان التطبيق يفتح ويشتغل من غير نت.
   يترفع في نفس الفولدر اللي فيه index.html. */
const V = "safwa-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(
        CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// الدخول وفايرستور لازم يروحوا للنت على طول — مالهمش كاش
const LIVE = /identitytoolkit|securetoken|firestore\.googleapis|firebaseinstallations|google-analytics/;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (LIVE.test(req.url)) return;

  // صفحة التطبيق: النت الأول علشان يشوف آخر تحديث، والكاش لو مفيش نت
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(V).then(c => c.put("./index.html", copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // باقي الملفات (فايربيز، الخطوط، الأيقونات): الكاش الأول وبعدين النت
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(r => {
        if (r && (r.ok || r.type === "opaque")) {
          const copy = r.clone();
          caches.open(V).then(c => c.put(req, copy)).catch(() => {});
        }
        return r;
      });
    })
  );
});
