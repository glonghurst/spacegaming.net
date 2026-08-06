/* ---------------------------------------------------------------------------
   Discreet visitor count — bottom right corner.

   Dropped in with a single line:

     <script src="vc.js" defer data-key="massdrivers-net" data-start="10"></script>

   The number is real and shared across everyone who loads the page.
   counterapi.dev holds it; abacus is the standby; a locally cached value
   covers both being unreachable. The element starts invisible and is only
   revealed once a number exists — a counter showing a dash or an error in
   the corner of a landing page looks worse than no counter at all.

   data-key    counter name, unique per site
   data-start  what the first visitor should see (default 10)
   data-ink    colour (default a muted slate that sits on a dark page)

   One increment per browser per 12 hours, so a reload is not a visit.
   Repeat loads inside that window read the number without bumping it.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  var me = document.currentScript;
  if (!me || !window.fetch) return;

  var NS       = "gavdev",
      KEY      = me.getAttribute("data-key"),
      START    = parseInt(me.getAttribute("data-start"), 10) || 10,
      INK      = me.getAttribute("data-ink") || "#7c8492",
      WINDOW_H = 12;

  if (!KEY) return;

  /* the service's first hit returns 1, so this offset lands the first
     visitor on START exactly */
  var SEED = START - 1;

  var css = document.createElement("style");
  css.textContent =
    "#vc{position:fixed;z-index:6;" +
    "right:max(14px,env(safe-area-inset-right));" +
    "bottom:max(12px,env(safe-area-inset-bottom));" +
    "display:flex;align-items:center;gap:.5em;font:inherit;" +
    "font-size:clamp(9px,1.1vw,11px);font-variant-numeric:tabular-nums;" +
    "font-weight:700;letter-spacing:.24em;color:" + INK + ";" +
    "text-shadow:0 1px 6px rgba(0,0,0,.9);" +
    "opacity:0;transition:opacity 1.1s ease;" +
    /* must never swallow a drag or a click aimed at the page beneath it */
    "pointer-events:none;-webkit-user-select:none;user-select:none}" +
    "#vc.on{opacity:.32}" +
    "#vc i{width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.65}";
  document.head.appendChild(css);

  var el = document.createElement("div");
  el.id = "vc";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = "<i></i><span></span>";
  document.body.appendChild(el);
  var out = el.querySelector("span");

  function readCache()  { try { return +localStorage.getItem("vc:" + KEY) || 0; } catch (e) { return 0; } }
  function writeCache(v){ try { localStorage.setItem("vc:" + KEY, v); } catch (e) {} return v; }

  function isNewVisit() {
    try {
      var t = +localStorage.getItem("vc:seen:" + KEY) || 0, now = Date.now();
      if (now - t < WINDOW_H * 3600e3) return false;
      localStorage.setItem("vc:seen:" + KEY, now);
      return true;
    } catch (e) {
      /* private browsing: count it rather than never count it */
      return true;
    }
  }

  function show(n) { out.textContent = String(n); el.classList.add("on"); }

  var chain = isNewVisit()
    ? ["https://api.counterapi.dev/v1/" + NS + "/" + KEY + "/up",
       "https://abacus.jasoncameron.dev/hit/" + NS + "/" + KEY]
    : ["https://api.counterapi.dev/v1/" + NS + "/" + KEY + "/",
       "https://abacus.jasoncameron.dev/get/" + NS + "/" + KEY];

  (function attempt(i) {
    if (i >= chain.length) {
      var c = readCache();
      if (c) show(c);          /* last known good, silently */
      return;                  /* nothing known: stay invisible */
    }
    fetch(chain[i], { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) {
        var n = typeof j.count === "number" ? j.count
              : typeof j.value === "number" ? j.value
              : null;
        if (n === null) return Promise.reject();
        /* the two services keep separate tallies — never let a fallback
           walk the number backwards for someone who saw the higher one */
        show(writeCache(Math.max(n + SEED, readCache())));
      })
      .catch(function () { attempt(i + 1); });
  })(0);
})();
