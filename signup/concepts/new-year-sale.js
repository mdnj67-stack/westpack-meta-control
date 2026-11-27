/**
 * New Year sale - its own experience (2026-11-27, the user: "Tilmeld dig og få besked når nytårsudsalget starter direkte
 * i din indbakke ... sådan 10. dec agtigt" and "jeg ville have en specifik og separat").
 *
 * One promise, said plainly: get told when the New Year sale starts, straight to your inbox. The first frame is that
 * sentence, the email field, the button and the store's own consent sentence - nothing before the email.
 *
 * The look (the user: "lidt mere lækker, lidt mere nytår ... uden at stikke totalt ud"): the store's own hero is a deep
 * green bag with gold foil print beside a cream one, so the popup keeps that palette - a deep green night on one side,
 * the cream form on the other - and puts New Year only in the picture: the coming year in gold foil (Westpack prints in
 * foil) with a light that sweeps across it, thin gold bursts that bloom and fade, and slow confetti in gold, cream and a
 * touch of the store's red. On a computer the mail they ask for lands below the year, on top of an inbox. The form side
 * stays calm. Motion is transforms only; a phone gets no light sweep, and reduced motion gets none at all.
 *
 * Never "exclusive", "first", "before anyone" or "early access": the sale is on the store for everyone; the email only
 * says when it starts (the user, same day). It runs until 3 January (rules.inSeason): once the sale has started, "when
 * it starts" is no longer true, so a store left on it gets Logo studio by itself.
 */
(function () {
  const CHECK = '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".28"/><path class="ny-check-path" d="M14 25l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ENVELOPE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // confetti, laid out by hand rather than at random so every visitor sees the same balanced scatter:
  // [left %, fall seconds, delay seconds, sway px, colour, shape, resting top % for reduced motion]
  const CONFETTI = [
    [6, 11, -2, 14, "gold", "strip", 18], [15, 9, -7, -10, "cream", "dot", 64], [24, 12.5, -4, 18, "gold", "dot", 36],
    [33, 10, -9, -12, "red", "strip", 82], [44, 13, -1, 10, "cream", "strip", 12], [53, 9.5, -6, -16, "gold", "strip", 52],
    [62, 11.5, -3, 12, "gold", "dot", 88], [71, 10.5, -8, -8, "cream", "strip", 28], [80, 12, -5, 16, "red", "dot", 70],
    [89, 9, -2.5, -14, "gold", "strip", 44], [94, 13.5, -10, 8, "cream", "dot", 8], [38, 14, -11.5, -6, "gold", "dot", 94],
  ];
  // bursts: [left %, top %, size px, delay seconds]
  const BURSTS = { desktop: [[18, 14, 130, 0], [82, 30, 96, 1.4], [30, 86, 110, 2.6]], phone: [[10, 30, 92, 0], [74, 78, 80, 1.6]] };

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
      el("p", { class: "ny-proof wps-rise wps-rise-3", text: copy.proof }),
      el("div", { class: "ny-form wps-rise wps-rise-4" }, [form.form]),
    ]);
    const doneView = el("div", { class: "ny-done", hidden: true, tabindex: "-1" }, [
      el("span", { class: "ny-check" }, [ctx.svg(CHECK)]),
      el("h2", { class: "wps-title ny-done-title", text: copy.successTitle }),
      el("p", { class: "ny-done-line", text: copy.done }),
      el("button", { type: "button", class: "wps-btn wps-btn-ghost ny-done-close", onclick: () => ctx.close("done"), text: shell.close }),
    ]);
    const layout = el("div", { class: "ny" }, [scene(ctx, copy, phone), el("div", { class: "ny-side" }, [ask, doneView])]);
    stage.appendChild(layout);

    function done() {
      layout.classList.add("is-done");
      ask.hidden = true;
      doneView.hidden = false;
      doneView.focus({ preventScroll: true });
    }

    // a computer has no keyboard to pop up, so the cursor waits in the field
    return { initialFocus: ctx.device === "desktop" ? form.input : null };
  }

  /**
   * The picture: a deep green night with gold bursts and confetti, the coming year in gold foil, and - on a computer -
   * the mail the visitor is asking for landing on top of an inbox (sender, subject, the honest preview, the month).
   * Decorative: the headline says the same in words.
   */
  function scene(ctx, copy, phone) {
    const { el } = ctx;
    const pieces = (phone ? CONFETTI.filter((c, i) => i % 3 !== 2) : CONFETTI).map(([x, d, delay, sway, colour, shape, rest]) =>
      el("span", { class: `ny-fall is-${colour} is-${shape}`, style: `--x:${x}%;--d:${d}s;--delay:${delay}s;--sway:${sway}px;--rest:${rest}%` }, [el("i")]));
    const bursts = BURSTS[phone ? "phone" : "desktop"].map(([x, y, s, delay]) => el("span", { class: "ny-burst", style: `--x:${x}%;--y:${y}%;--s:${s}px;--delay:${delay}s` }));
    const year = el("span", { class: "ny-year", text: String(comingYear(new Date())) });
    const parts = [el("span", { class: "ny-sky" }, [...bursts, ...pieces]), year];
    if (!phone) {
      const mail = el("div", { class: "ny-mail is-new" }, [
        el("span", { class: "ny-mail-av", text: copy.mailFrom.charAt(0) }),
        el("span", { class: "ny-mail-body" }, [
          el("span", { class: "ny-mail-top" }, [el("b", { class: "ny-mail-from", text: copy.mailFrom }), el("span", { class: "ny-mail-time", text: copy.mailTime })]),
          el("span", { class: "ny-mail-subj", text: copy.mailSubject }),
          el("span", { class: "ny-mail-prev", text: copy.mailPreview }),
        ]),
      ]);
      const older = (i) => el("div", { class: "ny-mail is-older", style: `--i:${i}` }, [el("span", { class: "ny-mail-av" }), el("span", { class: "ny-mail-body" }, [el("i"), el("i"), el("i")])]);
      parts.push(el("div", { class: "ny-inbox-list" }, [mail, older(1), older(2)]));
    }
    return el("div", { class: "ny-scene", "aria-hidden": "true" }, parts);
  }

  function peekVisual(ctx) {
    return ctx.el("span", { class: "ny-peek-mail" }, [ctx.svg(ENVELOPE)]);
  }

  window.WestpackSignup.registerConcept("new-year-sale", { mount, peekVisual });
})();
