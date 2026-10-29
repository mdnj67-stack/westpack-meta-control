/**
 * Logo studio - "Type your brand name. We'll put it in gold."
 *
 * The visitor's own brand name, foil-printed live on a real Westpack lid: one of two close-ups from the Content
 * Library with Westpack's demo print removed (tools/signup/clean-plate.html), and the name set back at the angle
 * the demo print had. Lid, foil and lettering can be changed; the foils are the ones the logo-printing page lists.
 * The result is shown in full before anything is asked, then real customers' boxes, then the signup.
 */
(function () {
  const LIDS = {
    // anchor: centre of the print area in % of the image, angle of the print, widest the name may run (% of width)
    black: { img: "logo/lid-black", x: 48.5, y: 44, angle: 41, maxw: 52, tone: "dark" },
    cream: { img: "logo/lid-cream", x: 51, y: 38.5, angle: 38.5, maxw: 50, tone: "light" },
  };
  const FOILS = ["gold", "silver", "rose", "white", "deboss"];
  const TYPES = ["classic", "script", "clean"];
  const MAX_NAME = 28;

  function mount(stage, ctx) {
    const { el, copy, t } = ctx;
    const choice = { lid: "black", foil: "gold", type: "classic", name: "" };
    const firstChange = {};
    const once = (key) => { if (!firstChange[key]) { firstChange[key] = true; ctx.track(key); } };
    const displayName = () => (choice.name.trim() || copy.defaultName);

    // ---- the lid ----
    const img = (id, w) => `${ctx.asset(id)}-${w}.webp`;
    const lidImg = el("img", { class: "ls-lid-img", alt: "", src: img(LIDS.black.img, 720), srcset: `${img(LIDS.black.img, 720)} 720w, ${img(LIDS.black.img, 1200)} 1200w`, sizes: "(min-width: 760px) 460px, 100vw", decoding: "async", onerror: (e) => { e.target.style.visibility = "hidden"; } });
    const print = el("span", { class: "ls-print", "aria-hidden": "true" });
    const printWrap = el("div", { class: "ls-print-wrap" }, [print]);
    const sheen = el("div", { class: "ls-sheen", "aria-hidden": "true" });
    const visual = el("figure", { class: "ls-visual", role: "img" }, [lidImg, printWrap, sheen, el("figcaption", { class: "ls-illustration", text: copy.disclaimer })]);

    // ---- the controls ----
    const nameId = "ls-name";
    const nameInput = el("input", { id: nameId, class: "ls-name-input", type: "text", maxlength: String(MAX_NAME), autocomplete: "organization", autocapitalize: "words", spellcheck: "false", placeholder: copy.namePlaceholder, enterkeyhint: "done" });
    const hint = el("p", { class: "ls-hint", "aria-live": "polite" });
    const group = (labelText, key, values, labels) => {
      const gid = `ls-${key}`;
      const buttons = values.map((v) => el("button", { type: "button", class: `ls-chip ls-chip-${key}`, "data-value": v, "aria-pressed": String(choice[key] === v), onclick: () => set(key, v) }, [
        key === "foil" ? el("span", { class: `ls-swatch ls-swatch-${v}`, "aria-hidden": "true" }) : key === "lid" ? el("span", { class: `ls-swatch ls-lid-${v}`, "aria-hidden": "true" }) : null,
        el("span", { class: key === "type" ? `ls-type-sample ls-type-${v}` : "", text: labels[v] }),
      ]));
      return { node: el("div", { class: "ls-group", role: "group", "aria-labelledby": gid }, [el("span", { id: gid, class: "ls-group-label", text: labelText }), el("div", { class: "ls-chips" }, buttons)]), buttons };
    };
    const lidGroup = group(copy.lidLabel, "lid", Object.keys(LIDS), copy.lid);
    const foilGroup = group(copy.foilLabel, "foil", FOILS, copy.foil);
    const typeGroup = group(copy.typeLabel, "type", TYPES, copy.type);
    const nextBtn = el("button", { type: "button", class: "wps-btn wps-btn-primary ls-next", onclick: () => toResult() }, [el("span", { class: "wps-btn-label", text: `${copy.next} →` })]);

    const editPanel = el("div", { class: "ls-panel ls-edit" }, [
      el("p", { class: "wps-kicker wps-rise", text: copy.kicker }),
      el("h2", { class: "wps-title wps-rise wps-rise-2", text: copy.title }),
      el("p", { class: "wps-lede wps-rise wps-rise-3", text: copy.lede }),
      el("div", { class: "ls-name wps-rise wps-rise-3" }, [el("label", { class: "ls-name-label", for: nameId, text: copy.nameLabel }), nameInput]),
      hint,
      el("div", { class: "ls-options wps-rise wps-rise-4" }, [lidGroup.node, foilGroup.node, typeGroup.node]),
      nextBtn,
    ]);

    // ---- the result and the signup ----
    const resultTitle = el("h2", { class: "wps-title" });
    const proof = el("div", { class: "ls-proof", "aria-hidden": "true" }, [el("div", { class: "ls-proof-track" },
      ["02", "04", "05", "14", "20", "03", "02", "04", "05", "14", "20", "03"].map((n) => el("img", { src: ctx.asset(`logo/proof-${n}-360.webp`), alt: "", loading: "lazy", decoding: "async", onerror: (e) => { e.target.hidden = true; } })))]);
    const success = el("div", { class: "ls-success", hidden: true, tabindex: "-1" });
    const form = ctx.signupForm({
      buttonText: ctx.shell.signup,
      properties: () => ({ wp_brand_name: choice.name.trim(), wp_logo_finish: choice.foil, wp_logo_lid: choice.lid, wp_logo_type: choice.type }),
      organization: () => choice.name.trim(),
      onSuccess: (r) => showSuccess(r),
    });
    const resultPanel = el("div", { class: "ls-panel ls-result", hidden: true }, [
      el("p", { class: "wps-kicker", text: copy.kicker }),
      resultTitle,
      el("p", { class: "wps-lede", text: copy.resultLede }),
      el("p", { class: "ls-proof-title", text: copy.proofTitle }),
      proof,
      el("ul", { class: "wps-promise" }, ctx.shell.promise.map((p) => el("li", { text: p }))),
      form.form,
      el("button", { type: "button", class: "wps-link ls-back", onclick: () => toEdit(), text: `← ${copy.back}` }),
      success,
    ]);

    const layout = el("div", { class: "ls" }, [el("div", { class: "ls-stage" }, [visual]), el("div", { class: "ls-side" }, [editPanel, resultPanel])]);
    stage.appendChild(layout);

    // ---- behaviour ----
    function render() {
      const lid = LIDS[choice.lid];
      layout.dataset.lid = choice.lid; layout.dataset.foil = choice.foil; layout.dataset.type = choice.type; layout.dataset.tone = lid.tone;
      if (!lidImg.src.includes(lid.img)) {
        lidImg.classList.add("is-swapping");
        const next = new Image();
        next.onload = next.onerror = () => { lidImg.src = img(lid.img, 720); lidImg.srcset = `${img(lid.img, 720)} 720w, ${img(lid.img, 1200)} 1200w`; lidImg.classList.remove("is-swapping"); };
        next.src = img(lid.img, ctx.device === "desktop" ? 1200 : 720);
      }
      printWrap.style.setProperty("--x", `${lid.x}%`);
      printWrap.style.setProperty("--y", `${lid.y}%`);
      printWrap.style.setProperty("--angle", `${lid.angle}deg`);
      printWrap.style.setProperty("--maxw", lid.maxw);
      print.textContent = displayName();
      print.classList.toggle("is-placeholder", !choice.name.trim());
      visual.setAttribute("aria-label", `${displayName()} – ${copy.foil[choice.foil]}, ${copy.lid[choice.lid]}`);
      for (const [key, g] of [["lid", lidGroup], ["foil", foilGroup], ["type", typeGroup]]) g.buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === choice[key])));
      fit();
    }
    // shrink the name until it fits the print area; a long brand name is scaled, never cut
    function fit() {
      print.style.fontSize = "";
      const box = visual.getBoundingClientRect().width;
      if (!box) return;
      const allowed = (box * LIDS[choice.lid].maxw) / 100;
      const base = parseFloat(getComputedStyle(print).fontSize);
      const w = print.scrollWidth;
      if (w > allowed) print.style.fontSize = `${Math.max(9, base * (allowed / w))}px`;
    }
    function sweep() {
      if (ctx.reducedMotion) return;
      sheen.classList.remove("is-sweeping"); void sheen.offsetWidth; sheen.classList.add("is-sweeping");
      print.classList.remove("is-pressed"); void print.offsetWidth; print.classList.add("is-pressed");
    }
    function set(key, value) {
      if (choice[key] === value) return;
      choice[key] = value; once(`option_${key}`); render(); sweep();
    }
    let typingTimer = null;
    nameInput.addEventListener("input", () => {
      choice.name = nameInput.value.slice(0, MAX_NAME);
      once("name_typed");
      render();
      const n = choice.name.trim();
      hint.textContent = /^westpack$/i.test(n) ? copy.hintWestpack : n.length > 16 ? copy.hintLong : "";
      clearTimeout(typingTimer);
      typingTimer = setTimeout(sweep, 420);
    });
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); toResult(); } });

    function toResult() {
      ctx.track("result");
      resultTitle.textContent = t(copy.resultTitle, { name: displayName() });
      layout.classList.add("is-result");
      editPanel.hidden = true; resultPanel.hidden = false;
      resultPanel.classList.remove("wps-rise"); void resultPanel.offsetWidth; resultPanel.classList.add("wps-rise");
      sweep();
      // the email field gets focus only on a keyboard device; on a phone the keyboard would cover the result
      if (ctx.device === "desktop") form.focus(); else ctx.dialog.scrollTo({ top: 0, behavior: ctx.reducedMotion ? "auto" : "smooth" });
    }
    function toEdit() {
      ctx.track("back");
      layout.classList.remove("is-result");
      resultPanel.hidden = true; editPanel.hidden = false;
      nameInput.focus();
    }
    function showSuccess(result) {
      layout.classList.add("is-success");
      [...resultPanel.children].forEach((c) => { if (c !== success) c.hidden = true; });
      success.hidden = false;
      success.append(
        el("p", { class: "wps-kicker", text: copy.kicker }),
        el("h2", { class: "wps-title ls-success-title", text: result.doubleOptIn ? ctx.shell.doiTitle : t(copy.successTitle, { name: displayName() }) }),
        el("p", { class: "wps-lede", text: result.doubleOptIn ? ctx.shell.doiBody : copy.successBody }),
        el("button", { type: "button", class: "wps-btn wps-btn-ghost", onclick: () => ctx.close("done"), text: ctx.shell.close }),
      );
      success.focus();
      sweep();
    }

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fit()) : null;
    if (ro) ro.observe(visual);
    document.fonts && document.fonts.ready.then(fit);
    render();
    setTimeout(sweep, 700);
    return { initialFocus: ctx.device === "desktop" ? nameInput : null, destroy() { if (ro) ro.disconnect(); clearTimeout(typingTimer); } };
  }

  function peekVisual(ctx) {
    return ctx.el("img", { src: ctx.asset("logo/proof-04-360.webp"), alt: "" });
  }

  window.WestpackSignup.registerConcept("logo-studio", { mount, peekVisual });
})();
