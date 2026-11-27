/**
 * Direct - the permission experience (2026-11-27, the user: "en ny sign-up idé/koncept, som virkeligt er hardcore med
 * permission indsamling").
 *
 * Built on what the live funnel showed of Logo studio in CZ and IT (19-27 Nov): 663 of 888 exposures opened, 407 were
 * closed at the first frame, 43 typed a name, 27 ever reached the email field and 8 signed up. Whatever stands in
 * front of the field loses the visitor. So here nothing does:
 *
 * - The first frame is the reason, the field and the button, with the store's own consent sentence under them. On a
 *   computer the cursor is already in the field.
 * - The reason is concrete and seasonal (rules.directSeason): news, deadlines and the New Year sale; from 15 December
 *   to 3 January the sale alone, because it is days away.
 * - Proof is real: six customers' own logo boxes, and how many already get it.
 * - A "not now" is not the end: the shell docks a pill at the foot of the page (rules.dockAllowed), one tap from the
 *   field, while the popup itself backs off as every experience's does.
 * - What we want to know comes after the permission, never before: one optional tap on what they sell, sent as its
 *   own event (rules.buildAnswerEvent), so a skipped question costs nothing.
 *
 * Hardcore on how early, how often and how easily the question is asked - never on whether the answer is free: no
 * pre-ticked box, no consent in a click on anything else, a close button that is always there, no guilt in a "no".
 */
(function () {
  // six customers' own logo boxes on Westpack packaging (the same photos as Logo studio's proof strip)
  const WALL = ["proof-02", "proof-14", "proof-04", "proof-20", "proof-03", "proof-05"];
  const CHECK = '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".28"/><path class="dr-check-path" d="M14 25l7 7 13-15" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function mount(stage, ctx) {
    const { el, copy, shell } = ctx;
    const season = copy.seasons[ctx.season] ? ctx.season : "default";
    const hook = copy.seasons[season];
    const phone = ctx.device !== "desktop";

    const tile = (id, i) => el("span", { class: "dr-tile", style: `--i:${i}` }, [
      el("img", { src: ctx.asset(`logo/${id}-360.webp`), alt: "", decoding: "async", loading: i < 3 ? "eager" : "lazy", onerror: (e) => { e.target.style.visibility = "hidden"; } }),
    ]);
    const wall = el("div", { class: "dr-wall", "aria-hidden": "true" }, (phone ? WALL.slice(0, 3) : WALL).map(tile));

    const form = ctx.signupForm({
      properties: () => ({ wp_signup_season: season, wp_signup_trigger: ctx.trigger || "" }),
      onSuccess: () => done(),
    });
    form.input.setAttribute("enterkeyhint", "send");

    const ask = el("div", { class: "dr-ask" }, [
      el("p", { class: "wps-kicker dr-kicker wps-rise", text: shell.dialogLabel }),
      el("h2", { class: "wps-title dr-title wps-rise wps-rise-2", text: hook.title }),
      el("p", { class: "dr-proof wps-rise wps-rise-3" }, [faces(ctx, ["proof-03", "proof-20", "proof-05"]), el("span", { text: copy.proof })]),
      el("div", { class: "dr-form wps-rise wps-rise-4" }, [form.form]),
    ]);

    const thanks = el("p", { class: "dr-thanks", role: "status", hidden: true, text: copy.thanks });
    const closeBtn = el("button", { type: "button", class: "wps-btn wps-btn-ghost dr-done-close", hidden: true, onclick: () => ctx.close("done"), text: shell.close });
    const skip = el("button", { type: "button", class: "wps-link dr-skip", onclick: () => { ctx.track("answer_skipped"); ctx.close("done"); }, text: copy.skip });
    const types = el("div", { class: "dr-types", role: "group", "aria-label": copy.askTitle }, Object.keys(copy.types).map((id) =>
      el("button", { type: "button", class: "dr-type", "data-type": id, onclick: (e) => pick(id, e.currentTarget), text: copy.types[id] })));
    const doneView = el("div", { class: "dr-done", hidden: true, tabindex: "-1" }, [
      el("span", { class: "dr-check" }, [ctx.svg(CHECK)]),
      el("h2", { class: "wps-title dr-done-title", text: copy.successTitle }),
      el("p", { class: "dr-ask-title", text: copy.askTitle }),
      el("p", { class: "wps-lede dr-ask-lede", text: copy.askLede }),
      types, thanks,
      el("div", { class: "dr-done-foot" }, [skip, closeBtn]),
    ]);

    const side = el("div", { class: "dr-side" }, [ask, doneView]);
    const layout = el("div", { class: "dr", "data-season": season }, [wall, side]);
    stage.appendChild(layout);

    function done() {
      layout.classList.add("is-done");
      ask.hidden = true;
      doneView.hidden = false;
      doneView.focus({ preventScroll: true });
    }

    let answered = false;
    function pick(id, button) {
      if (answered) return;
      answered = true;
      [...types.children].forEach((b) => { b.disabled = true; b.classList.toggle("is-picked", b === button); });
      ctx.answer(id);
      thanks.hidden = false;
      skip.hidden = true;
      closeBtn.hidden = false;
      setTimeout(() => { try { closeBtn.focus({ preventScroll: true }); } catch (e) { /* gone */ } }, 60);
    }

    // a computer has no keyboard to pop up, so the cursor waits in the field: the one thing to do is already begun
    return { initialFocus: ctx.device === "desktop" ? form.input : null };
  }

  // customers' boxes as small round faces, overlapping, the way a row of subscribers' avatars would be
  function faces(ctx, ids) {
    return ctx.el("span", { class: "dr-faces", "aria-hidden": "true" }, ids.map((id) => ctx.el("img", { src: ctx.asset(`logo/${id}-360.webp`), alt: "", decoding: "async" })));
  }
  function dockVisual(ctx) { return faces(ctx, ["proof-02", "proof-14"]); }

  window.WestpackSignup.registerConcept("direct", { mount, dockVisual });
})();
