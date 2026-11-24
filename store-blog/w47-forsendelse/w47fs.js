/* W47 blog post 'Den store forsendelsesguide', shared by every store view. Built from templates/w47-forsendelse-blog/src/forsendelse-da.html by sprog.js - edit there, not here. */
(function () {
  var root = document.getElementById("w47fs");
  if (!root || root.getAttribute("data-ready")) return;
  root.setAttribute("data-ready", "1");
  root.classList.add("is-js");
  var qsa = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IO = "IntersectionObserver" in window;

  // The post lives in every store with the Danish links in it; point them at the store this page is in.
  var store = location.pathname.split("/")[1] || "";
  if (/^[a-z]{3}_[a-z]{2}_[a-z]{3}$/.test(store) && store !== "dkk_dk_den") {
    qsa("a[href*='/dkk_dk_den/'],[data-r-h*='/dkk_dk_den/'],[data-w-h*='/dkk_dk_den/']").forEach(function (a) {
      ["href", "data-r-h", "data-w-h"].forEach(function (k) { var v = a.getAttribute(k); if (v) a.setAttribute(k, v.replace("/dkk_dk_den/", "/" + store + "/")); });
    });
  }

  // Hero: the five finished looks take turns until someone picks one.
  var hero = root.querySelector(".fs-hero"), frame = root.querySelector(".fs-stage"), chips = qsa(".fs-chip"), shots = qsa(".fs-shot"), cap = root.querySelector(".fs-cap");
  var tones = ["#eedcd6","#ead6cc","#ece1cb","#dadecf","#dde1e1"], cur = 0, timer = null, chosen = false, heroIn = true;
  // The caption's word ("Look 01") comes from the markup, so it reads in the page's own language.
  var capN = cap.querySelector(".fs-cap-n"), capT = capN.textContent;
  function show(i) {
    cur = i; frame.style.backgroundColor = tones[i];
    chips.forEach(function (c, k) { c.classList.toggle("is-on", k === i); c.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    shots.forEach(function (s, k) { var on = k === i; s.classList.toggle("is-on", on); s.setAttribute("tabindex", on ? "0" : "-1"); if (on) s.removeAttribute("aria-hidden"); else s.setAttribute("aria-hidden", "true"); });
    capN.textContent = capT.replace(/\d+/, "0" + (i + 1));
    cap.querySelector("a").setAttribute("href", "#look-0" + (i + 1));
  }
  function stop() { clearInterval(timer); timer = null; }
  function play() { if (still || chosen || timer || !heroIn) return; timer = setInterval(function () { show((cur + 1) % tones.length); }, 3800); }
  chips.forEach(function (c) { c.addEventListener("click", function () { chosen = true; stop(); show(+c.getAttribute("data-i")); }); });
  hero.addEventListener("mouseenter", stop); hero.addEventListener("mouseleave", play); hero.addEventListener("focusin", stop);
  if (IO) new IntersectionObserver(function (es) { heroIn = es[0].isIntersecting; if (heroIn) play(); else stop(); }).observe(hero); else play();

  // A link from the email (…#look-03) shows that look in the hero too, and marks its section.
  var m = /^#look-0([1-5])$/.exec(location.hash);
  if (m) {
    chosen = true; show(+m[1] - 1);
    var t = document.getElementById("look-0" + m[1]);
    if (t) {
      t.classList.add("is-target");
      // Web fonts and images settle after the browser has jumped; land on the look once they have.
      var land = function () { t.scrollIntoView({ block: "start" }); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(land);
      window.addEventListener("load", land);
    }
  }

  // Step guide: one stage, five steps, two looks.
  var steps = qsa(".fs-step"), simg = qsa(".fs-si"), prog = qsa(".fs-prog i"), playBtn = root.querySelector(".fs-play"), set = "r", si = 0, st = null;
  function step(i) {
    si = (i + steps.length) % steps.length;
    steps.forEach(function (li, k) { li.classList.toggle("is-on", k === si); li.querySelector(".fs-sh").setAttribute("aria-expanded", k === si ? "true" : "false"); });
    simg.forEach(function (im) { var on = im.getAttribute("data-set") === set && +im.getAttribute("data-i") === si; im.classList.toggle("is-on", on); if (on) im.loading = "eager"; });
    prog.forEach(function (p, k) { p.classList.toggle("is-on", k <= si); });
  }
  function halt() { clearInterval(st); st = null; playBtn.classList.remove("is-on"); }
  function run() { halt(); if (si === steps.length - 1) step(0); playBtn.classList.add("is-on"); st = setInterval(function () { if (si === steps.length - 1) { halt(); return; } step(si + 1); }, 3000); }
  steps.forEach(function (li, k) { li.querySelector(".fs-sh").addEventListener("click", function () { halt(); step(k); }); });
  root.querySelector(".fs-prev").addEventListener("click", function () { halt(); step(si - 1); });
  root.querySelector(".fs-next").addEventListener("click", function () { halt(); step(si + 1); });
  playBtn.addEventListener("click", function () { if (st) halt(); else run(); });
  qsa(".fs-seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      set = b.getAttribute("data-set");
      qsa(".fs-seg button").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      qsa("[data-r-t],[data-r-h]").forEach(function (el) {
        var t = el.getAttribute("data-" + set + "-t"), h = el.getAttribute("data-" + set + "-h");
        if (t !== null) { var s = el.querySelector("span"); if (el.classList.contains("fs-tolist")) el.firstChild.nodeValue = t; else if (s) s.innerHTML = t; else el.innerHTML = t; }
        if (h !== null) el.setAttribute("href", h);
      });
      step(si);
    });
  });
  var x0 = null, stage = root.querySelector(".fs-sstage");
  stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { halt(); step(si + (dx < 0 ? 1 : -1)); } });
  // The email's "Se trinene med Guldstjerner" (…#trin-guldstjerner) opens the guide on that look.
  if (location.hash === "#trin-guldstjerner") {
    var wb = root.querySelector('.fs-seg [data-set="w"]'), sec = document.getElementById("fs-trin");
    if (wb) wb.click();
    var go = function () { sec.scrollIntoView({ block: "start" }); };
    go(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); window.addEventListener("load", go);
  }
  // The email's "Se trin 4 og 5" (…#trin-4) opens the guide on that step and does not play it from the start.
  var ts = /^#trin-([1-5])$/.exec(location.hash);
  if (ts) {
    step(+ts[1] - 1);
    var tsec = document.getElementById("fs-trin"), tgo = function () { tsec.scrollIntoView({ block: "start" }); };
    tgo(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(tgo); window.addEventListener("load", tgo);
  }
  // A reader who came by a link came for something; the guide plays by itself only for one who scrolled to it.
  if (IO && !still && !location.hash) { var once = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { once.disconnect(); run(); } }, { threshold: .6 }); once.observe(stage); }
  // Look 06: "Bland igen" shows another postal box + paper + ribbon, never all three from one look and never the same
  // three twice running. The parts not shown yet get their photos the first time the button is touched.
  var mx = root.querySelector(".fs-mx"), shuf = root.querySelector(".fs-shuf");
  if (mx && shuf) {
    var cols = qsa(".fs-mc", mx).map(function (c) { return qsa(".fs-mo", c); }), now = "0,0,0", base = mx.querySelector("img").src.replace(/[^\/]+$/, "");
    var prime = function () { qsa("[data-m]", mx).forEach(function (a) { var im = new Image(); im.alt = ""; im.src = base + a.getAttribute("data-m") + ".jpeg"; a.prepend(im); a.removeAttribute("data-m"); }); };
    ["pointerenter", "focus", "touchstart"].forEach(function (e) { shuf.addEventListener(e, prime, { passive: true }); });
    shuf.addEventListener("click", function () {
      prime();
      var o, l;
      do {
        o = cols.map(function (c) { return Math.random() * c.length | 0; });
        l = o.map(function (j, k) { return cols[k][j].getAttribute("data-l"); });
      } while (o + "" === now || l[0].split("").some(function (d) { return l[1].indexOf(d) > -1 && l[2].indexOf(d) > -1; }));
      now = o + "";
      cols.forEach(function (c, k) { c.forEach(function (a, j) { a.classList.toggle("is-on", j === o[k]); }); });
    });
  }

  // Any other anchor in the post (#faq-logo, #look-06, #fs-logo …): open a question it names, and land on it again once
  // fonts and images have settled.
  var ht = location.hash && /^#[a-z0-9-]+$/.test(location.hash) && !m && !ts && location.hash !== "#trin-guldstjerner" ? root.querySelector(location.hash) : null;
  if (ht) {
    if (ht.tagName === "DETAILS") ht.open = true;
    var hgo = function () { ht.scrollIntoView({ block: "start" }); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(hgo); window.addEventListener("load", hgo);
  }
  // The store's cookie banner locks the page (overflow hidden on html and body) until the reader answers it, so the jump
  // to the email's anchor is lost on a first visit - the reader answers and stands at the top. Land again once it lets go.
  (function () {
    var h = location.hash; if (!/^#[a-z0-9-]+$/.test(h)) return;
    var el = document.getElementById(/^#trin-/.test(h) ? "fs-trin" : h.slice(1)); if (!el) return;
    var locked = function () { return getComputedStyle(document.documentElement).overflowY === "hidden" || getComputedStyle(document.body).overflowY === "hidden"; };
    var was = false, n = 0, own = false;
    ["wheel", "touchmove"].forEach(function (e) { window.addEventListener(e, function () { if (!locked()) own = true; }, { passive: true }); });
    var iv = setInterval(function () {
      n++;
      if (locked()) was = true;
      else if (was) { clearInterval(iv); if (!own) el.scrollIntoView({ block: "start" }); }
      if (n > 240 || (!was && n > 40)) clearInterval(iv);
    }, 250);
  })();
})();
