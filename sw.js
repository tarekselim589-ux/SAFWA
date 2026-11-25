/* Safwa — كاش علشان التطبيق يفتح بسرعة حتى مع نت ضعيف.
   يترفع في نفس الفولدر اللي فيه index.html. */
const PREFIX = "safwa";
const V = PREFIX + "-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const FBV = "https://www.gstatic.com/firebasejs/10.12.2/";
const FBMODS = [FBV + "firebase-app.js", FBV + "firebase-auth.js", FBV + "firebase-firestore.js"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(
        CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))
          .concat(FBMODS.map(u => c.add(u).catch(() => {})))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      // يمسح بس كاشات التطبيق ده — باقي التطبيقات على نفس الدومين ماتتلمسش
      .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX + "-") && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// علامة "فيه نسخة جديدة" — التطبيق بيسأل عليها برسالة "safwa-check"
const NEWK = "./__safwa_new";
self.addEventListener("message", e => {
  if (e.data === "safwa-check" && e.ports && e.ports[0])
    e.waitUntil(caches.open(V).then(c => c.match(NEWK)).then(h => e.ports[0].postMessage(!!h)).catch(() => {}));
});

// الدخول وفايرستور لازم يروحوا للنت على طول — مالهمش كاش
const LIVE = /identitytoolkit|securetoken|firestore\.googleapis|firebaseinstallations|google-analytics|googleapis\.com\/(?!css)/;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (LIVE.test(req.url)) return;

  // صفحة التطبيق: يفتح من الكاش على طول، ويجيب آخر نسخة من النت في الخلفية.
  // لو النسخة اللي جت من النت مختلفة، بيعلّم إن فيه تحديث عشان التطبيق يقول "فيه نسخة جديدة"
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(V);
      const cached = await cache.match("./index.html");
      const oldTxt = cached ? cached.clone().text().catch(() => null) : Promise.resolve(null);
      await cache.delete(NEWK);   // الصفحة اللي بتتفتح دلوقتي هي أحدث نسخة عندنا
      const net = fetch(req.url, { cache: "no-cache" }).then(async r => {
        if (r && r.ok && !r.redirected) {
          const txt = await r.clone().text().catch(() => null), old = await oldTxt;
          await cache.put("./index.html", r.clone()).catch(() => {});
          if (old !== null && txt !== null && txt !== old) await cache.put(NEWK, new Response("1")).catch(() => {});
        }
        return r;
      });
      e.waitUntil(net.catch(() => {}));
      if (!cached) return fetch(req);
      return cached;
    })());
    return;
  }

  // باقي الملفات (فايربيز، الأيقونات...): الكاش الأول وبعدين النت
  e.respondWith(
    caches.open(V).then(c => c.match(req, { ignoreVary: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(r => {
        if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()).catch(() => {});
        return r;
      });
    }))
  );
});
