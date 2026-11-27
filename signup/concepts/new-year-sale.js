/**
 * New Year sale - its own experience (2026-11-27, the user: "Tilmeld dig og få besked når nytårsudsalget starter direkte
 * i din indbakke ... sådan 10. dec agtigt" and "jeg ville have en specifik og separat").
 *
 * One promise, said plainly: get told when the New Year sale starts, straight to your inbox. The first frame is that
 * sentence, the email field, the button and the store's own consent sentence - nothing before the email. The picture is
 * the promise itself: an inbox, and the mail "The New Year sale has started" landing on top, with the honest preview
 * (discontinued products are reduced, while stocks last). After the signup: "We'll write when the sale starts."
 *
 * Never "exclusive", "first", "before anyone" or "early access": the sale is on the store for everyone; the email only
 * says when it starts (the user, same day). It runs until 3 January (rules.inSeason): once the sale has started, "when
 * it starts" is no longer true, so a store left on it gets Logo studio by itself.
 */
(function () {
  const CHECK = '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".28"/><path class="ny-check-path" d="M14 25l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ENVELOPE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
    const layout = el("div", { class: "ny" }, [inbox(ctx, copy, phone), el("div", { class: "ny-side" }, [ask, doneView])]);
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
   * The picture: an inbox, and the mail the visitor is asking for landing on top of it - sender, subject, the honest
   * preview and the month. Decorative: the headline says the same in words. On a phone only the arriving mail.
   */
  function inbox(ctx, copy, phone) {
    const { el } = ctx;
    const mail = el("div", { class: "ny-mail is-new" }, [
      el("span", { class: "ny-mail-av", text: copy.mailFrom.charAt(0) }),
      el("span", { class: "ny-mail-body" }, [
        el("span", { class: "ny-mail-top" }, [el("b", { class: "ny-mail-from", text: copy.mailFrom }), el("span", { class: "ny-mail-time", text: copy.mailTime })]),
        el("span", { class: "ny-mail-subj", text: copy.mailSubject }),
        el("span", { class: "ny-mail-prev", text: copy.mailPreview }),
      ]),
    ]);
    const older = (i) => el("div", { class: "ny-mail is-older", style: `--i:${i}` }, [el("span", { class: "ny-mail-av" }), el("span", { class: "ny-mail-body" }, [el("i"), el("i"), el("i")])]);
    return el("div", { class: "ny-inbox", "aria-hidden": "true" }, [el("div", { class: "ny-inbox-list" }, phone ? [mail] : [mail, older(1), older(2), older(3)])]);
  }

  function peekVisual(ctx) {
    return ctx.el("span", { class: "ny-peek-mail" }, [ctx.svg(ENVELOPE)]);
  }

  window.WestpackSignup.registerConcept("new-year-sale", { mount, peekVisual });
})();
