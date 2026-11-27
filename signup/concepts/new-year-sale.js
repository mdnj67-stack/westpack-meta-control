/**
 * New Year sale - its own experience (2026-11-27, the user: "Tilmeld dig og få besked når nytårsudsalget starter direkte
 * i din indbakke ... sådan 10. dec agtigt" and "jeg ville have en specifik og separat").
 *
 * One promise, said plainly: get told when the New Year sale starts, straight to your inbox. The first frame is that
 * sentence, the email field, the button and the store's own consent sentence - nothing before the email.
 *
 * The look (the user: "lidt mere lækker, lidt mere nytår ... uden at stikke totalt ud", then "lidt mere lækkert og
 * imponerende"): the store's own hero is a deep green bag foil-printed in gold beside a cream one, so the palette stays -
 * a deep green night on one side, the calm cream form on the other - and New Year lives in the picture:
 * - the coming year set large in gold foil in the house display face, "20" over "27" on a computer like a magazine
 *   cover, with a glint of light across the foil that follows the pointer (as Logo studio's light does) and passes by
 *   itself now and then;
 * - an opening: three gold bursts bloom behind the year as the popup arrives, then the night settles into slow
 *   champagne bubbles and an occasional burst;
 * - the mail they ask for arrives as a notification at the foot of the night;
 * - the signup is celebrated: confetti falls across the whole card and the foil flashes.
 * Motion is transforms and background positions only. A phone gets one glint on opening and no pointer light; reduced
 * motion gets everything in place and nothing moving.
 *
 * Never "exclusive", "first", "before anyone" or "early access": the sale is on the store for everyone; the email only
 * says when it starts (the user, same day). It runs until 3 January (rules.inSeason): once the sale has started, "when
 * it starts" is no longer true, so a store left on it gets Logo studio by itself.
 */
(function () {
  const CHECK = '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".28"/><path class="ny-check-path" d="M14 25l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ENVELOPE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // laid out by hand, not at random, so every visitor sees the same balanced night
  // bubbles: [left %, rise seconds, delay seconds, sway px, size px]
  const BUBBLES = [[8, 9, -1, 10, 7], [17, 12, -6, -8, 4], [27, 10, -3, 12, 9], [36, 13, -9, -6, 5], [46, 11, -4.5, 8, 6],
    [55, 9.5, -7.5, -12, 4], [64, 12.5, -2, 10, 8], [73, 10.5, -10, -10, 5], [82, 11.5, -5, 6, 7], [91, 13.5, -8, -8, 4]];
  // confetti drifting in the night: [left %, fall seconds, delay seconds, sway px, colour, shape, resting top %]
  const CONFETTI = [[12, 12, -2, 14, "gold", "strip", 22], [31, 14, -8, -10, "cream", "dot", 64], [52, 13, -4, 16, "gold", "strip", 40],
    [70, 15, -11, -12, "red", "strip", 78], [88, 12.5, -6, 10, "gold", "dot", 14]];
  // bursts: [left %, top %, size px, delay seconds]; the opening three bloom once as the popup arrives
  const OPENING = { desktop: [[34, 24, 250, 0.15], [74, 40, 190, 0.55], [26, 58, 210, 0.95]], phone: [[22, 50, 170, 0.15], [78, 46, 150, 0.6]] };
  const AMBIENT = { desktop: [[80, 14, 120, 2.4], [16, 80, 100, 4.6]], phone: [[88, 30, 90, 3]] };
  // the celebration after a signup: [left %, delay seconds, fall seconds, colour, shape, sway px]
  const SHOWER = Array.from({ length: 34 }, (_, i) => [
    (i * 37 + 11) % 100, ((i * 7) % 10) / 22, 1.9 + ((i * 13) % 9) / 10, ["gold", "cream", "gold", "red", "green"][i % 5], i % 3 ? "strip" : "dot", ((i % 7) - 3) * 9,
  ]);

  // the coming New Year: in November and December the next one, in January this one
  function comingYear(now) { return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear(); }

  function mount(stage, ctx) {
    const { el, copy, shell } = ctx;
    const phone = ctx.device !== "desktop";

    const form = ctx.signupForm({ onSuccess: () => done() });
    form.input.setAttribute("enterkeyhint", "send");

    const ask = el("div", { class: "ny-ask" }, [
      el("p", { class: "wps-kicker ny-kicker wps-rise", text: shell.dialogLabel }),
      // a long headline (French, Spanish, Italian) is set a size smaller on a phone, so the card stays small
      el("h2", { class: `wps-title ny-title wps-rise wps-rise-2${copy.title.length > 78 ? " is-long" : ""}`, text: copy.title }),
      el("span", { class: "ny-rule wps-rise wps-rise-2", "aria-hidden": "true" }),
      el("p", { class: "ny-proof wps-rise wps-rise-3", text: copy.proof }),
      el("div", { class: "ny-form wps-rise wps-rise-4" }, [form.form]),
    ]);
    const doneView = el("div", { class: "ny-done", hidden: true, tabindex: "-1" }, [
      el("span", { class: "ny-check" }, [ctx.svg(CHECK)]),
      el("h2", { class: "wps-title ny-done-title", text: copy.successTitle }),
      el("p", { class: "ny-done-line", text: copy.done }),
      el("button", { type: "button", class: "wps-btn wps-btn-ghost ny-done-close", onclick: () => ctx.close("done"), text: shell.close }),
    ]);
    const night = scene(ctx, copy, phone);
    const layout = el("div", { class: "ny" }, [night.node, el("div", { class: "ny-side" }, [ask, doneView])]);
    stage.appendChild(layout);

    // the foil's glint follows the pointer across the whole card (a computer only), and passes by itself when it rests
    let raf = 0, idle = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = night.year.getBoundingClientRect();
        const f = Math.max(-0.3, Math.min(1.3, (e.clientX - r.left) / Math.max(1, r.width)));
        night.year.style.setProperty("--lp", `${(100 - f * 100).toFixed(1)}%`);
        night.year.classList.add("is-lit");
        clearTimeout(idle);
        idle = setTimeout(() => night.year.classList.remove("is-lit"), 2600);
      });
    };
    if (!phone && !ctx.reducedMotion) ctx.dialog.addEventListener("pointermove", onMove);

    function done() {
      layout.classList.add("is-done");
      ask.hidden = true;
      doneView.hidden = false;
      doneView.focus({ preventScroll: true });
      if (ctx.reducedMotion) return;
      night.year.classList.remove("is-lit");
      night.year.classList.add("is-cheer");
      const shower = el("div", { class: "ny-shower", "aria-hidden": "true" }, (phone ? SHOWER.filter((s, i) => i % 3 !== 2) : SHOWER).map(([x, delay, d, colour, shape, sway]) =>
        el("span", { class: `ny-drop is-${colour} is-${shape}`, style: `--x:${x}%;--delay:${delay}s;--d:${d}s;--sway:${sway}px` }, [el("i")])));
      layout.appendChild(shower);
      setTimeout(() => shower.remove(), 4200);
    }

    // a computer has no keyboard to pop up, so the cursor waits in the field
    return {
      initialFocus: ctx.device === "desktop" ? form.input : null,
      destroy() { ctx.dialog.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); clearTimeout(idle); },
    };
  }

  /**
   * The picture: a deep green night - the opening bursts, slow champagne bubbles, a little confetti - with the coming
   * year in gold foil, and on a computer the notification of the mail they ask for at its foot. Decorative: the
   * headline says the same in words.
   */
  function scene(ctx, copy, phone) {
    const { el } = ctx;
    const kind = phone ? "phone" : "desktop";
    const burst = (cls) => ([x, y, s, delay]) => el("span", { class: `ny-burst ${cls}`, style: `--x:${x}%;--y:${y}%;--s:${s}px;--delay:${delay}s` });
    const bubbles = (phone ? BUBBLES.filter((b, i) => i % 2 === 0) : BUBBLES).map(([x, d, delay, sway, s]) =>
      el("span", { class: "ny-bub", style: `--x:${x}%;--d:${d}s;--delay:${delay}s;--sway:${sway}px;--s:${s}px` }, [el("i")]));
    const confetti = (phone ? CONFETTI.slice(0, 3) : CONFETTI).map(([x, d, delay, sway, colour, shape, rest]) =>
      el("span", { class: `ny-fall is-${colour} is-${shape}`, style: `--x:${x}%;--d:${d}s;--delay:${delay}s;--sway:${sway}px;--rest:${rest}%` }, [el("i")]));
    const sky = el("span", { class: "ny-sky" }, [...OPENING[kind].map(burst("is-opening")), ...AMBIENT[kind].map(burst("is-ambient")), ...bubbles, ...confetti]);

    const digits = String(comingYear(new Date()));
    const halves = phone ? [digits] : [digits.slice(0, 2), digits.slice(2)];
    const year = el("span", { class: "ny-year" }, halves.map((t, i) => el("span", { class: "ny-yl", "data-t": t, style: `--i:${i}`, text: t })));
    const parts = [sky, year];
    if (!phone) {
      parts.push(el("div", { class: "ny-note" }, [
        el("span", { class: "ny-note-av", text: copy.mailFrom.charAt(0) }),
        el("span", { class: "ny-note-body" }, [
          el("span", { class: "ny-note-top" }, [el("b", { class: "ny-mail-from", text: copy.mailFrom }), el("span", { class: "ny-mail-time", text: copy.mailTime })]),
          el("span", { class: "ny-mail-subj", text: copy.mailSubject }),
          el("span", { class: "ny-mail-prev", text: copy.mailPreview }),
        ]),
      ]));
    }
    return { node: el("div", { class: "ny-scene", "aria-hidden": "true" }, parts), year };
  }

  function peekVisual(ctx) {
    return ctx.el("span", { class: "ny-peek-mail" }, [ctx.svg(ENVELOPE)]);
  }

  window.WestpackSignup.registerConcept("new-year-sale", { mount, peekVisual });
})();
