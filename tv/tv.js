/*
 * Westpack TV - the stove's programme.
 *
 * Fetches ready-made scenes from /api/tv?action=kpis (Danish copy, built and checked on the
 * server), lets each one condense out of the smoke, hold, and burn away, with the fire alone in
 * between. The clock, the date and the Christmas countdown are the only things worked out here.
 *
 * URL options:  ?demo          sample figures, clearly marked DEMO on the stove, no login
 *               ?level=0.6     pin the fire's size (default follows the working day)
 *               ?debug         frame rate and render scale
 *               ?still=14&p=1&q=0&scene=0   one frozen frame, for screenshots
 */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const DEMO = params.has("demo");
  const DEBUG = params.has("debug");
  const STILL = params.has("still") ? Number(params.get("still")) || 12 : null;
  const PINNED_LEVEL = params.has("level") ? Number(params.get("level")) : null;
  const TZ = "Europe/Copenhagen";
  const API = "/api/tv";
  const REFRESH_MS = 10 * 60 * 1000;
  const TIMING = { appear: 3.6, hold: 12, exit: 3.2 };
  const PAUSE_BETWEEN = 4.5;
  const PAUSE_AFTER_ROUND = 14;

  const MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
  const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

  // Sample figures for ?demo only. They are never shown without the DEMO mark on the plate.
  const DEMO_SCENES = [
    { id: "meta_new_customers_mtd", eyebrow: "Nye kunder fra Meta", valueText: "143", suffix: "", line: "1.–9. november · 12 % flere end samme dage i oktober" },
    { id: "meta_cost_per_new_customer", eyebrow: "Pris pr. ny kunde", valueText: "812", suffix: "kr.", line: "1.–9. november · samme dage i oktober: 905 kr." },
    { id: "newsletter_subscribers", eyebrow: "Modtagere af nyhedsbrevet", valueText: "25.808", suffix: "", line: "på tværs af 18 markeder" }
  ];

  const els = {
    canvas: document.getElementById("tv-fire"),
    login: document.getElementById("tv-login"),
    password: document.getElementById("tv-login-password"),
    loginButton: document.getElementById("tv-login-button"),
    loginError: document.getElementById("tv-login-error"),
    hint: document.getElementById("tv-hint"),
    debug: document.getElementById("tv-debug"),
    fallback: document.getElementById("tv-fallback"),
    fbEyebrow: document.getElementById("tv-fallback-eyebrow"),
    fbValue: document.getElementById("tv-fallback-value"),
    fbSuffix: document.getElementById("tv-fallback-suffix"),
    fbLine: document.getElementById("tv-fallback-line")
  };

  const state = {
    scenes: [],
    fetchedAt: null,
    failingSince: null,
    authed: false,
    plateKey: "",
    startedAt: Date.now()
  };

  let engine = null;

  // ------------------------------------------------------------------ time in Copenhagen
  function cph(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    const y = get("year"), m = get("month"), d = get("day");
    return { y, m, d, hh: get("hour"), mm: get("minute"), weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function daysBetween(a, b) {
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }

  // The fire follows the working day: lit in the morning, burning down after hours.
  function scheduledLevel(date = new Date()) {
    if (PINNED_LEVEL != null && Number.isFinite(PINNED_LEVEL)) return PINNED_LEVEL;
    const t = cph(date);
    const h = t.hh + t.mm / 60;
    const lerp = (a, b, k) => a + (b - a) * Math.min(1, Math.max(0, k));
    if (h < 6) return 0.22;
    if (h < 7) return lerp(0.22, 1, h - 6);
    if (h < 17) return 1;
    if (h < 19) return lerp(1, 0.45, (h - 17) / 2);
    if (h < 22) return lerp(0.45, 0.22, (h - 19) / 3);
    return 0.22;
  }

  // ------------------------------------------------------------------ scenes worked out here
  function localScenes() {
    const today = cph();
    const scenes = [];
    const xmas = { y: today.y, m: 12, d: 24 };
    const days = daysBetween(today, xmas);
    if (days >= 2 && days <= 60) {
      const wd = WEEKDAYS[new Date(Date.UTC(xmas.y, 11, 24)).getUTCDay()];
      scenes.push({
        id: "christmas_countdown",
        eyebrow: "Dage til juleaften",
        valueText: String(days),
        suffix: "",
        line: `${wd} 24. december`
      });
    }
    return scenes;
  }

  function playlist() {
    const data = state.scenes.slice();
    const local = localScenes();
    // the countdown goes last, after the figures the department is measured on
    return data.concat(local);
  }

  // ------------------------------------------------------------------ text to texture
  function font(ctx, weight, size) {
    ctx.font = `${weight} ${Math.round(size)}px "IBM Plex Sans", system-ui, "Segoe UI", sans-serif`;
  }

  function drawTracked(ctx, text, x, y, tracking, align) {
    const chars = Array.from(text);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, cx, y);
      cx += widths[i] + tracking;
    });
    return total;
  }

  function fitSize(ctx, weight, size, text, maxWidth, tracking = 0) {
    let s = size;
    for (let i = 0; i < 12; i++) {
      font(ctx, weight, s);
      const w = ctx.measureText(text).width + tracking * s * Math.max(0, Array.from(text).length - 1);
      if (w <= maxWidth) break;
      s *= 0.92;
    }
    return s;
  }

  /*
   * Channels: alpha = coverage; red = amber accent; blue = dimmed. The shader picks colours, so
   * the canvas only says which part of the text is which.
   */
  function renderSceneCanvas(scene, W, H) {
    const box = engine ? engine.textBox : [0.06, 0.37, 0.94, 0.90];
    const bw = Math.max(16, Math.round((box[2] - box[0]) * W));
    const bh = Math.max(16, Math.round((box[3] - box[1]) * H));
    const c = document.createElement("canvas");
    c.width = bw;
    c.height = bh;
    const ctx = c.getContext("2d");
    const S = H / 1080;
    const cx = bw / 2;
    ctx.textBaseline = "alphabetic";

    // eyebrow
    const eyebrow = String(scene.eyebrow || "").toUpperCase();
    const ebSize = fitSize(ctx, 500, 31 * S, eyebrow, bw * 0.9, 0.3);
    font(ctx, 500, ebSize);
    ctx.fillStyle = "rgb(255,255,0)";
    drawTracked(ctx, eyebrow, cx, 50 * S, ebSize * 0.3, "center");

    // value and suffix
    const value = String(scene.valueText || "");
    const suffix = String(scene.suffix || "");
    let vSize = 250 * S;
    for (let i = 0; i < 14; i++) {
      font(ctx, 300, vSize);
      const vw = ctx.measureText(value).width;
      font(ctx, 400, vSize * 0.34);
      const sw = suffix ? ctx.measureText(suffix).width + vSize * 0.1 : 0;
      if (vw + sw <= bw * 0.9) break;
      vSize *= 0.92;
    }
    font(ctx, 300, vSize);
    const vw = ctx.measureText(value).width;
    font(ctx, 400, vSize * 0.34);
    const sw = suffix ? ctx.measureText(suffix).width + vSize * 0.1 : 0;
    const x0 = cx - (vw + sw) / 2;
    const base = 318 * S;
    ctx.fillStyle = "rgb(0,255,0)";
    font(ctx, 300, vSize);
    ctx.textAlign = "left";
    ctx.fillText(value, x0, base);
    if (suffix) {
      font(ctx, 400, vSize * 0.34);
      ctx.fillText(suffix, x0 + vw + vSize * 0.1, base);
    }

    // the line under it
    const line = String(scene.line || "");
    if (line) {
      const lSize = fitSize(ctx, 400, 41 * S, line, bw * 0.92);
      font(ctx, 400, lSize);
      ctx.fillStyle = "rgb(0,255,255)";
      ctx.textAlign = "center";
      ctx.fillText(line, cx, 400 * S);
      ctx.textAlign = "left";
    }

    // points on the letters, in text uv (y up), for sparks off the burning edge
    const glyphs = [];
    try {
      const img = ctx.getImageData(0, 0, bw, bh).data;
      for (let i = 0; i < 70000 && glyphs.length < 3200; i++) {
        const x = (Math.random() * bw) | 0;
        const y = (Math.random() * bh) | 0;
        if (img[(y * bw + x) * 4 + 3] > 150) glyphs.push([x / bw, 1 - y / bh]);
      }
    } catch (error) {
      // a tainted canvas cannot happen here, but sparks are decoration
    }
    return { canvas: c, glyphs };
  }

  // The plate on the stove's bottom bar: date, the maker's name, the time.
  function plateText() {
    const t = cph();
    const date = `${WEEKDAYS[t.weekday]} ${t.d}. ${MONTHS[t.m - 1]}`;
    let left = date;
    if (DEMO) left = "DEMO · IKKE RIGTIGE TAL";
    else if (state.failingSince && state.fetchedAt) {
      const f = cph(new Date(state.fetchedAt));
      left = `${date} · ingen forbindelse, tal fra ${pad2(f.hh)}:${pad2(f.mm)}`;
    }
    return { left, centre: "WESTPACK", right: `${pad2(t.hh)}:${pad2(t.mm)}` };
  }

  function renderPlate() {
    if (!engine) return;
    const info = plateText();
    const key = `${info.left}|${info.right}|${engine.width}x${engine.height}`;
    if (key === state.plateKey) return;
    state.plateKey = key;
    const W = engine.width, H = engine.height;
    const pb = engine.plateBox();
    const pw = Math.max(16, Math.round((pb[2] - pb[0]) * W));
    const ph = Math.max(8, Math.round((pb[3] - pb[1]) * H));
    const c = document.createElement("canvas");
    c.width = pw;
    c.height = ph;
    const ctx = c.getContext("2d");
    const S = H / 1080;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    font(ctx, 500, 25 * S);
    drawTracked(ctx, info.centre, pw / 2, ph * 0.52, 25 * S * 0.5, "center");
    font(ctx, 400, 19 * S);
    drawTracked(ctx, info.left.toUpperCase(), 26 * S, ph * 0.52, 19 * S * 0.16, "left");
    font(ctx, 400, 24 * S);
    drawTracked(ctx, info.right, pw - 26 * S, ph * 0.52, 24 * S * 0.1, "right");
    engine.setPlate(c);
  }

  // ------------------------------------------------------------------ data
  async function fetchScenes() {
    const res = await fetch(`${API}?action=kpis`, { credentials: "same-origin", cache: "no-store" });
    if (res.status === 401) {
      const error = new Error("Not signed in.");
      error.status = 401;
      throw error;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const scenes = Array.isArray(body?.scenes) ? body.scenes : [];
    return scenes.filter((s) => s && s.eyebrow && s.valueText != null && String(s.valueText).trim() !== "");
  }

  async function refresh() {
    if (DEMO) {
      state.scenes = DEMO_SCENES;
      return true;
    }
    try {
      state.scenes = await fetchScenes();
      state.fetchedAt = Date.now();
      state.failingSince = null;
      state.authed = true;
      return true;
    } catch (error) {
      if (error.status === 401) {
        state.authed = false;
        state.scenes = [];
        showLogin();
        return false;
      }
      // keep showing the last figures we had, and say on the plate that the line is down
      if (!state.failingSince) state.failingSince = Date.now();
      return false;
    } finally {
      renderPlate();
    }
  }

  // ------------------------------------------------------------------ login
  function showLogin() {
    els.login.hidden = false;
    els.login.classList.remove("is-leaving");
    setTimeout(() => els.password.focus(), 60);
  }

  function hideLogin() {
    els.login.classList.add("is-leaving");
    setTimeout(() => { els.login.hidden = true; }, 950);
  }

  els.login.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.hidden = true;
    els.loginButton.disabled = true;
    try {
      const res = await fetch(`${API}?action=login`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: els.password.value })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Det virkede ikke. Prøv igen.");
      els.password.value = "";
      hideLogin();
      if (engine) engine.pop(0, 0.2, 40);
      await refresh();
    } catch (error) {
      els.loginError.textContent = error.message || "Det virkede ikke. Prøv igen.";
      els.loginError.hidden = false;
    } finally {
      els.loginButton.disabled = false;
    }
  });

  // ------------------------------------------------------------------ the programme
  const sleep = (s) => (engine ? engine.wait(s) : new Promise((r) => setTimeout(r, s * 1000)));

  async function showScene(scene) {
    if (engine) {
      const { canvas, glyphs } = renderSceneCanvas(scene, engine.width, engine.height);
      await engine.showText(canvas, glyphs, TIMING);
      return;
    }
    // no WebGL: the same scene as plain text
    els.fbEyebrow.textContent = scene.eyebrow || "";
    els.fbValue.textContent = scene.valueText || "";
    els.fbSuffix.textContent = scene.suffix ? ` ${scene.suffix}` : "";
    els.fbLine.textContent = scene.line || "";
    els.fallback.classList.remove("is-out");
    await sleep(TIMING.appear + TIMING.hold);
    els.fallback.classList.add("is-out");
    await sleep(1.4);
  }

  async function programme() {
    await sleep(STILL == null ? 5.5 : 0);
    for (;;) {
      const list = playlist();
      if (!list.length) {
        await sleep(20);
        continue;
      }
      for (const scene of list) {
        await showScene(scene);
        await sleep(PAUSE_BETWEEN);
      }
      await sleep(PAUSE_AFTER_ROUND);
    }
  }

  // ------------------------------------------------------------------ the TV itself
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        await navigator.wakeLock.request("screen");
      }
    } catch (error) {
      // not every TV browser allows it; the TV's own settings then decide
    }
  }

  function toggleFullscreen() {
    const doc = document;
    if (!doc.fullscreenElement) {
      doc.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      doc.exitFullscreen?.().catch(() => {});
    }
  }

  function attachChrome() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        keepAwake();
        refresh();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.target === els.password) return;
      if (event.key === "f" || event.key === "F") toggleFullscreen();
    });
    els.canvas.addEventListener("click", () => {
      if (!document.fullscreenElement) toggleFullscreen();
      keepAwake();
    });
    let idleTimer = null;
    const wake = () => {
      document.body.classList.remove("is-idle");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => document.body.classList.add("is-idle"), 2500);
    };
    document.addEventListener("mousemove", wake);
    wake();

    if (STILL == null) {
      els.hint.hidden = false;
      setTimeout(() => els.hint.classList.add("is-gone"), 7000);
      setTimeout(() => { els.hint.hidden = true; }, 8500);
    }

    // Each minute: the clock, the fire's size for the time of day, and a fresh start each
    // morning so a deploy reaches the TV without anyone touching it.
    setInterval(() => {
      renderPlate();
      if (engine) engine.setLevel(scheduledLevel());
      const t = cph();
      if (t.hh === 5 && t.mm === 30 && Date.now() - state.startedAt > 3600000) location.reload();
    }, 15000);
  }

  function startDebug() {
    if (!DEBUG || !engine) return;
    els.debug.hidden = false;
    let frames = 0, acc = 0;
    engine.onFrame = (ms) => {
      frames++;
      acc += ms;
      if (acc >= 1000) {
        els.debug.textContent = `${Math.round(frames * 1000 / acc)} fps · scene ${engine.targets.scene.w}x${engine.targets.scene.h} (${engine.sceneScale.toFixed(2)}) · out ${engine.width}x${engine.height} · sparks ${engine.sparks.length} · fire ${engine.level.toFixed(2)}${engine.floatOk ? "" : " · 8-bit"}`;
        frames = 0;
        acc = 0;
      }
    };
  }

  async function fontsReady() {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('300 200px "IBM Plex Sans"'),
          document.fonts.load('400 40px "IBM Plex Sans"'),
          document.fonts.load('500 30px "IBM Plex Sans"')
        ]),
        new Promise((r) => setTimeout(r, 4000))
      ]);
    } catch (error) {
      // the system font stands in
    }
  }

  async function main() {
    try {
      engine = new FireplaceEngine(els.canvas, {
        preserveDrawingBuffer: STILL != null,
        fixedScale: STILL != null,
        sceneScale: STILL != null ? 0.75 : undefined
      });
    } catch (error) {
      console.error("Brændeovnen kunne ikke tændes, viser tallene uden ild:", error);
      engine = null;
      document.body.classList.add("is-fallback");
      els.fallback.hidden = false;
      els.fallback.classList.add("is-out");
    }

    window.__tv = { engine, state, renderSceneCanvas, scheduledLevel };
    await fontsReady();

    if (STILL != null && engine) {
      const list = DEMO_SCENES.concat(localScenes());
      const scene = list[Math.min(list.length - 1, Number(params.get("scene")) || 0)];
      renderPlate();
      const p = params.has("p") ? Number(params.get("p")) : 1;
      const q = params.has("q") ? Number(params.get("q")) : 0;
      if (p > 0 || q > 0) {
        const { canvas, glyphs } = renderSceneCanvas(scene, engine.width, engine.height);
        engine.showText(canvas, glyphs, TIMING);
      }
      engine.level = scheduledLevel();
      engine.levelTarget = engine.level;
      engine.still(STILL, p > 0 || q > 0 ? { p, q } : null);
      document.body.dataset.ready = "1";
      return;
    }

    attachChrome();
    keepAwake();
    if (engine) {
      engine.level = 0.04;
      engine.setLevel(scheduledLevel());
      engine.start();
      startDebug();
      setTimeout(() => engine && engine.pop(0, 0.16, 26), 1800);
    }
    renderPlate();
    await refresh();
    setInterval(refresh, REFRESH_MS);
    document.body.dataset.ready = "1";
    programme();
  }

  main();
})();
