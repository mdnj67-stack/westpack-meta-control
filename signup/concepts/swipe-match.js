/**
 * Swipe match - "Love it or leave it?"
 *
 * Six real Westpack boxes as a card stack: drag a card right or left (or use the buttons, or the arrow keys).
 * Each box belongs to one or two of four looks, and the likes add up to a packaging profile that is shown in full
 * before anything is asked. A signup carries the profile to Klaviyo, so later emails can be in the reader's style.
 */
(function () {
  const CARDS = [
    { id: "torino", worlds: { noir: 1 } },
    { id: "seoul", worlds: { forest: 1 } },
    { id: "madrid", worlds: { cocoa: 1 } },
    { id: "oslo", worlds: { sand: 1 } },
    { id: "monaco", worlds: { forest: 0.6, noir: 0.4 } },
    { id: "tokyo", worlds: { cocoa: 0.6, sand: 0.4 } },
  ];
  const WORLDS = ["noir", "cocoa", "forest", "sand"];
  const THRESHOLD = 90;
  const HEART = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="currentColor"/></svg>';
  const CROSS = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

  function mount(stage, ctx) {
    const { el, copy, t, svg } = ctx;
    const src = (id, w) => ctx.asset(`swipe/${id}-${w}.webp`);
    let index = 0, likes = [], busy = false, finished = false;

    // ---- the deck ----
    const cards = CARDS.map((c, i) => {
      const like = el("span", { class: "sm-stamp sm-stamp-like", "aria-hidden": "true", text: copy.like });
      const nope = el("span", { class: "sm-stamp sm-stamp-nope", "aria-hidden": "true", text: copy.nope });
      return el("article", { class: "sm-card", "data-i": String(i), "aria-hidden": i ? "true" : "false" }, [
        el("img", { src: src(c.id, 600), srcset: `${src(c.id, 600)} 600w, ${src(c.id, 900)} 900w`, sizes: "340px", alt: copy.cardNames[c.id], draggable: "false", loading: i < 2 ? "eager" : "lazy", decoding: "async", onerror: (e) => { e.target.style.visibility = "hidden"; } }),
        like, nope,
        el("div", { class: "sm-card-text" }, [el("h3", { class: "sm-card-name", text: copy.cardNames[c.id] }), el("p", { class: "sm-card-line", text: copy.cards[c.id] })]),
      ]);
    });
    const deck = el("div", { class: "sm-deck" }, cards.slice().reverse());
    const live = el("p", { class: "wps-visually-hidden", "aria-live": "polite" });
    const nopeBtn = el("button", { type: "button", class: "sm-btn sm-nope", "aria-label": copy.nope, onclick: () => decide(false) }, [svg(CROSS)]);
    const likeBtn = el("button", { type: "button", class: "sm-btn sm-like", "aria-label": copy.like, onclick: () => decide(true) }, [svg(HEART)]);
    const progress = el("p", { class: "sm-progress", "aria-hidden": "true" });
    const dots = el("div", { class: "sm-dots", "aria-hidden": "true" }, CARDS.map(() => el("span")));
    const play = el("div", { class: "sm-play" }, [deck, el("div", { class: "sm-actions" }, [nopeBtn, el("div", { class: "sm-meter" }, [dots, progress]), likeBtn]), live]);

    const head = el("div", { class: "sm-head" }, [
      el("p", { class: "wps-kicker wps-rise", text: copy.kicker }),
      el("h2", { class: "wps-title wps-rise wps-rise-2", text: copy.title }),
      el("p", { class: "wps-lede wps-rise wps-rise-3", text: copy.lede }),
      el("p", { class: "sm-keys wps-small", text: copy.keysHint }),
    ]);

    // ---- the result ----
    const result = el("div", { class: "sm-result", hidden: true });
    const layout = el("div", { class: "sm" }, [head, play, result]);
    stage.appendChild(layout);

    function update() {
      cards.forEach((c, i) => {
        const pos = i - index;
        c.classList.toggle("is-top", pos === 0);
        c.style.setProperty("--pos", String(Math.max(0, Math.min(3, pos))));
        c.setAttribute("aria-hidden", pos === 0 ? "false" : "true");
        if (pos < 0) c.classList.add("is-gone");
      });
      [...dots.children].forEach((d, i) => d.classList.toggle("is-done", i < index));
      progress.textContent = t(copy.progress, { n: Math.min(index + 1, CARDS.length), total: CARDS.length });
      if (index < CARDS.length) live.textContent = `${t(copy.progress, { n: index + 1, total: CARDS.length })}: ${copy.cardNames[CARDS[index].id]}. ${copy.cards[CARDS[index].id]}`;
    }

    function decide(like, fromDrag) {
      if (busy || finished || index >= CARDS.length) return;
      busy = true;
      const card = cards[index];
      if (like) likes.push(CARDS[index].id);
      ctx.track(`swipe_${index + 1}_${like ? "y" : "n"}`);
      const dir = like ? 1 : -1;
      card.classList.add(like ? "is-liked" : "is-noped");
      card.style.transition = ctx.reducedMotion ? "opacity 160ms" : "transform 460ms cubic-bezier(.4,0,.6,1), opacity 460ms";
      card.style.transform = ctx.reducedMotion ? "" : `translate(${dir * 135}%, ${fromDrag ? fromDrag.dy * 0.4 : -20}px) rotate(${dir * 22}deg)`;
      card.style.opacity = "0";
      index++;
      setTimeout(() => {
        card.classList.add("is-gone"); card.style.transition = ""; busy = false;
        update();
        if (index >= CARDS.length) finish();
      }, ctx.reducedMotion ? 160 : 380);
      update();
    }

    // ---- dragging the top card ----
    let drag = null;
    deck.addEventListener("pointerdown", (e) => {
      const card = cards[index];
      if (!card || !card.contains(e.target) || busy) return;
      drag = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, id: e.pointerId, card };
      card.setPointerCapture(e.pointerId);
      card.classList.add("is-dragging");
      if (!firstDrag) { firstDrag = true; ctx.track("drag_start"); }
    });
    let firstDrag = false;
    deck.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x0; drag.dy = e.clientY - drag.y0;
      drag.card.style.transform = `translate(${drag.dx}px, ${drag.dy * 0.25}px) rotate(${drag.dx / 16}deg)`;
      drag.card.style.setProperty("--like", String(Math.max(0, Math.min(1, drag.dx / THRESHOLD))));
      drag.card.style.setProperty("--nope", String(Math.max(0, Math.min(1, -drag.dx / THRESHOLD))));
    });
    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      d.card.classList.remove("is-dragging");
      d.card.style.removeProperty("--like"); d.card.style.removeProperty("--nope");
      if (Math.abs(d.dx) > THRESHOLD) decide(d.dx > 0, d);
      else { d.card.style.transform = ""; }
    };
    deck.addEventListener("pointerup", endDrag);
    deck.addEventListener("pointercancel", endDrag);

    const onKey = (e) => {
      if (finished || (e.target && e.target.tagName === "INPUT")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); decide(true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); decide(false); }
    };
    ctx.dialog.addEventListener("keydown", onKey);

    // ---- the profile ----
    function profile() {
      const scores = Object.fromEntries(WORLDS.map((w) => [w, 0]));
      for (const id of likes) for (const [w, v] of Object.entries(CARDS.find((c) => c.id === id).worlds)) scores[w] += v;
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      const ranked = WORLDS.filter((w) => scores[w] > 0).sort((a, b) => scores[b] - scores[a]);
      const pct = (w) => Math.round((scores[w] / total) * 100);
      return { scores, total, top: ranked[0] || "", second: ranked[1] || "", pct };
    }

    function finish() {
      finished = true;
      ctx.track("result");
      const p = profile();
      layout.classList.add("is-result");
      head.hidden = true;
      const topWorld = p.top ? copy.worlds[p.top] : null;
      const liked = likes.slice(0, 3);
      const collage = el("div", { class: "sm-collage", "aria-hidden": "true" }, (liked.length ? liked : ["torino", "oslo", "seoul"]).map((id, i) => el("img", { src: src(id, 600), alt: "", style: `--i:${i}` })));
      const pctEl = el("span", { class: "sm-pct", text: "0" });
      const title = topWorld
        ? el("h2", { class: "wps-title sm-result-title" }, [t(copy.resultTitle, { pct: "\u0000", world: topWorld.name }).split("\u0000")[0], pctEl, t(copy.resultTitle, { pct: "\u0000", world: topWorld.name }).split("\u0000")[1] || ""])
        : el("h2", { class: "wps-title sm-result-title", text: copy.noneTitle });
      const form = ctx.signupForm({
        properties: () => ({ wp_style_profile: p.top || "picky", wp_style_scores: p.scores, wp_liked_boxes: likes }),
        onSuccess: (r) => success(r, topWorld),
      });
      const seeBoxes = el("a", { class: "sm-see", href: ctx.market.boxesUrl, onclick: () => { ctx.track("see_boxes"); ctx.close("link"); } }, [`${copy.seeBoxes} →`]);
      result.append(
        collage,
        el("div", { class: "sm-result-body" }, [
          el("p", { class: "wps-kicker", text: copy.resultKicker }),
          title,
          el("p", { class: "sm-world-line", text: topWorld ? topWorld.line : copy.noneLine }),
          p.second ? el("p", { class: "sm-second", text: t(copy.resultSecond, { pct: p.pct(p.second), world: copy.worlds[p.second].name }) }) : null,
          seeBoxes,
          el("h3", { class: "sm-cta-title", text: copy.ctaTitle }),
          el("ul", { class: "wps-promise" }, ctx.shell.promise.map((x) => el("li", { text: x }))),
          form.form,
          el("button", { type: "button", class: "wps-link", onclick: restart, text: `↺ ${copy.restart}` }),
        ]),
      );
      result.hidden = false;
      layout.setAttribute("data-world", p.top || "none");
      // count the percentage up: the number is the punchline, so it gets a moment
      if (topWorld) {
        const target = p.pct(p.top);
        if (ctx.reducedMotion) pctEl.textContent = String(target);
        else { const t0 = performance.now(); const tick = (now) => { const k = Math.min(1, (now - t0) / 900); pctEl.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
      }
      ctx.dialog.scrollTo({ top: 0 });
      title.setAttribute("tabindex", "-1"); title.focus({ preventScroll: true });
    }

    function success(r, topWorld) {
      const body = result.querySelector(".sm-result-body");
      body.textContent = "";
      body.append(
        el("p", { class: "wps-kicker", text: copy.resultKicker }),
        el("h2", { class: "wps-title", tabindex: "-1", text: r.doubleOptIn ? ctx.shell.doiTitle : t(copy.successTitle, { world: topWorld ? topWorld.name : copy.noneTitle }) }),
        el("p", { class: "wps-lede", text: r.doubleOptIn ? ctx.shell.doiBody : copy.successBody }),
        el("button", { type: "button", class: "wps-btn wps-btn-ghost", onclick: () => ctx.close("done"), text: ctx.shell.close }),
      );
      layout.classList.add("is-success");
      body.querySelector("h2").focus();
    }

    function restart() {
      ctx.track("restart");
      index = 0; likes = []; finished = false;
      result.textContent = ""; result.hidden = true; head.hidden = false;
      layout.classList.remove("is-result");
      cards.forEach((c) => { c.classList.remove("is-gone", "is-liked", "is-noped"); c.style.transform = ""; c.style.opacity = ""; });
      update();
    }

    update();
    let wiggle = null;
    if (!ctx.reducedMotion) wiggle = setTimeout(() => { if (index === 0 && !drag) { cards[0].classList.add("is-hinting"); setTimeout(() => cards[0].classList.remove("is-hinting"), 1400); } }, 1400);
    return { initialFocus: ctx.device === "desktop" ? likeBtn : null, destroy() { clearTimeout(wiggle); ctx.dialog.removeEventListener("keydown", onKey); } };
  }

  function peekVisual(ctx) {
    return ctx.el("img", { src: ctx.asset("swipe/seoul-600.webp"), alt: "" });
  }

  window.WestpackSignup.registerConcept("swipe-match", { mount, peekVisual });
})();
