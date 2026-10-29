/**
 * Pack & ship - "We send packaging news. Not jewellery. Sorry."
 *
 * The shortest route on purpose: nothing comes before the email field. A real Westpack mailer with jewellery boxes,
 * a shipping label whose address line prints what the visitor types, and on signup the parcel is stamped, taped
 * and sent. This is the experience that tests whether a strong, short moment beats interaction-first.
 */
(function () {
  function mount(stage, ctx) {
    const { el, copy, t } = ctx;
    const address = el("span", { class: "ps-address is-empty", text: ctx.shell.emailPlaceholder });
    const caret = el("span", { class: "ps-caret", "aria-hidden": "true" });
    const label = el("div", { class: "ps-label", "aria-hidden": "true" }, [
      el("div", { class: "ps-label-top" }, [el("span", { class: "ps-from", text: copy.labelFrom }), el("span", { class: "ps-barcode" })]),
      el("div", { class: "ps-label-to" }, [el("span", { class: "ps-to", text: copy.labelTo }), el("span", { class: "ps-address-line" }, [address, caret])]),
      el("div", { class: "ps-label-foot" }, [el("span", { text: copy.labelContents }), el("span", { class: "ps-fragile", text: "↑↑" })]),
      el("span", { class: "ps-stamp", text: copy.stamp }),
      el("span", { class: "ps-tape" }, [el("span", { text: Array(8).fill(copy.tape).join("  ·  ") })]),
    ]);
    const photo = el("img", { class: "ps-photo", alt: "", src: ctx.asset("ship/mailer-720.webp"), srcset: `${ctx.asset("ship/mailer-720.webp")} 720w, ${ctx.asset("ship/mailer-1200.webp")} 1200w`, sizes: "(min-width: 760px) 440px, 100vw", decoding: "async", onerror: (e) => { e.target.style.visibility = "hidden"; } });
    const parcel = el("div", { class: "ps-parcel" }, [photo, label]);
    const today = new Intl.DateTimeFormat(ctx.market.locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
    const postmark = el("div", { class: "ps-postmark", "aria-hidden": "true" }, [el("span", { class: "ps-postmark-ring" }, [el("b", { text: "WESTPACK" }), el("span", { text: today }), el("b", { text: "HOLSTEBRO · DK" })])]);
    const scene = el("div", { class: "ps-scene" }, [parcel, postmark]);

    const form = ctx.signupForm({ buttonText: copy.signup, invalidText: copy.invalidEmail, compact: true, onSuccess: (r) => ship(r) });
    const success = el("div", { class: "ps-success", hidden: true, tabindex: "-1" });
    const side = el("div", { class: "ps-side" }, [
      el("p", { class: "wps-kicker wps-rise", text: copy.kicker }),
      el("h2", { class: "wps-title wps-rise wps-rise-2", text: copy.title }),
      el("p", { class: "wps-lede wps-rise wps-rise-3", text: copy.lede }),
      el("div", { class: "ps-form wps-rise wps-rise-4" }, [form.form]),
      success,
    ]);
    const layout = el("div", { class: "ps" }, [scene, side]);
    stage.appendChild(layout);

    // the address prints onto the label as it is typed
    form.input.addEventListener("input", () => {
      const v = form.input.value.trim();
      address.textContent = v || ctx.shell.emailPlaceholder;
      address.classList.toggle("is-empty", !v);
      label.classList.toggle("is-long", v.length > 24);
    });
    form.input.addEventListener("focus", () => layout.classList.add("is-writing"));
    form.input.addEventListener("blur", () => layout.classList.remove("is-writing"));
    // a wrong address makes the label shudder along with the field
    form.form.addEventListener("submit", () => { setTimeout(() => { if (form.form.classList.contains("has-error")) { label.classList.remove("is-shaking"); void label.offsetWidth; label.classList.add("is-shaking"); } }, 0); });

    function ship(result) {
      ctx.track("shipped");
      layout.classList.add("is-shipping");
      const done = () => {
        layout.classList.add("is-shipped");
        [...side.children].forEach((c) => { if (c !== success) c.hidden = true; });
        success.hidden = false;
        success.append(
          el("p", { class: "wps-kicker", text: copy.kicker }),
          el("h2", { class: "wps-title ps-success-title", text: result.doubleOptIn ? ctx.shell.doiTitle : copy.successTitle }),
          el("p", { class: "wps-lede", text: result.doubleOptIn ? ctx.shell.doiBody : copy.successBody }),
          el("button", { type: "button", class: "wps-btn wps-btn-ghost", onclick: () => ctx.close("done"), text: ctx.shell.close }),
        );
        success.focus({ preventScroll: true });
      };
      setTimeout(done, ctx.reducedMotion ? 0 : 1700);
    }

    return { initialFocus: ctx.device === "desktop" ? form.input : null };
  }

  function peekVisual(ctx) {
    return ctx.el("img", { src: ctx.asset("ship/mailer-720.webp"), alt: "" });
  }

  window.WestpackSignup.registerConcept("pack-and-ship", { mount, peekVisual });
})();
