/**
 * Logo studio - "Type your brand name. We'll put it in gold."
 *
 * The visitor's brand name, or their own logo, foil-printed live on six real Westpack lids: close-ups from the
 * Content Library with Westpack's demo print removed (tools/signup/clean-plate.html), and the print set back at
 * the angle the demo print had. The print is drawn as SVG with real lighting - a specular highlight from a light
 * that follows the pointer or finger, fine metal grain, and the print pressed into the surface (a shadow on one
 * inner wall, light on the other) - so the foil catches the light the way hot foil does. The foils are the ones
 * the logo-printing page lists. Nothing is asked before the result is shown in full.
 */
(function () {
  // anchor: centre of the print area in % of the photo, the print's angle, its foreshortening (skew, vertical
  // scale), and the widest the print may run (% of the photo's width) - measured on a grid over each photo
  const BOXES = [
    { id: "seville", tone: "dark", x: 48.5, y: 44, angle: 41, skew: -7, sy: 0.9, maxw: 60, foil: "gold" },
    { id: "london", tone: "light", x: 51, y: 38.5, angle: 38.5, skew: -7, sy: 0.9, maxw: 56, foil: "silver" },
    { id: "torino", tone: "dark", x: 51, y: 62, angle: -26, skew: -12, sy: 0.8, maxw: 48, foil: "gold" },
    { id: "seoul", tone: "mid", x: 55, y: 36, angle: -25.6, skew: -6, sy: 0.85, maxw: 55, foil: "white" },
    { id: "madrid", tone: "mid", x: 52, y: 34, angle: 1, skew: 0, sy: 0.96, maxw: 52, foil: "rose" },
    { id: "frankfurt", tone: "dark", x: 50, y: 44, angle: 40, skew: -7, sy: 0.9, maxw: 64, foil: "white" },
  ];
  // the colours the logo-printing page lists, drawn as metal (a gradient that catches light) or as pigment
  const FOILS = {
    gold: { kind: "metal", light: "#fff3d6", stops: ["#5c4318", "#a7813e", "#f4e3ab", "#c39d57", "#7c5c26", "#e8d093", "#9b7636", "#f2dea3"] },
    silver: { kind: "metal", light: "#ffffff", stops: ["#5a5e63", "#adb2b8", "#f8f9fa", "#989da3", "#6d7176", "#e5e8eb", "#888d93", "#f4f5f7"] },
    rose: { kind: "metal", light: "#fff0e6", stops: ["#683626", "#b8745f", "#f7cfb9", "#a96a53", "#7a4231", "#eab69c", "#91533d", "#f3c8af"] },
    oldrose: { kind: "pigment", color: "#c4908a", spec: 0.35 },
    white: { kind: "pigment", color: "#f5f3ee", spec: 0.3 },
    black: { kind: "pigment", color: "#141414", spec: 1.05 },
    deboss: { kind: "deboss" },
  };
  const TYPES = { classic: { size: 150, family: "WPS Fraunces, Georgia, serif", weight: 520, upper: true, spacing: 14 }, script: { size: 230, family: "WPS Pinyon Script, cursive", weight: 400, upper: false, spacing: 0 }, clean: { size: 118, family: "WPS Jost, Futura, sans-serif", weight: 500, upper: true, spacing: 30 } };
  const MAX_NAME = 28;
  const VB = { w: 1000, h: 300, fitW: 920, fitH: 250 };
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs, children) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, String(v));
    for (const c of [].concat(children || [])) if (c) n.appendChild(c);
    return n;
  }

  // ---- the print: one SVG, rebuilt filter per foil, light moved by attribute ----
  function makePrint(uid) {
    const grad = svgEl("linearGradient", { id: `${uid}-g`, x1: "0", y1: "0", x2: "1", y2: "0.35" });
    const filter = svgEl("filter", { id: `${uid}-f`, x: "-10%", y: "-35%", width: "120%", height: "170%", "color-interpolation-filters": "sRGB" });
    const maskImg = svgEl("image", { preserveAspectRatio: "xMidYMid meet" });
    const mask = svgEl("mask", { id: `${uid}-m`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: VB.w, height: VB.h }, [maskImg]);
    const text = svgEl("text", { x: VB.w / 2, y: VB.h / 2, "text-anchor": "middle", "dominant-baseline": "central" });
    const logo = svgEl("rect", { x: 0, y: 0, width: VB.w, height: VB.h, mask: `url(#${uid}-m)` });
    const group = svgEl("g", { filter: `url(#${uid}-f)` }, [text, logo]);
    const svg = svgEl("svg", { class: "ls-print", viewBox: `0 0 ${VB.w} ${VB.h}`, "aria-hidden": "true", focusable: "false" }, [svgEl("defs", {}, [grad, filter, mask]), group]);
    let light = null;

    function setFoil(name) {
      const f = FOILS[name];
      grad.textContent = "";
      if (f.kind === "metal") f.stops.forEach((c, i) => grad.appendChild(svgEl("stop", { offset: `${(i / (f.stops.length - 1)) * 100}%`, "stop-color": c })));
      const fill = f.kind === "metal" ? `url(#${uid}-g)` : f.kind === "deboss" ? "#000" : f.color;
      text.setAttribute("fill", fill); logo.setAttribute("fill", fill);
      filter.textContent = "";
      const add = (tag, attrs, kids) => { const n = svgEl(tag, attrs, kids); filter.appendChild(n); return n; };
      // the pressed edges, shared by every finish: shadow on the inner upper-left wall, light on the lower-right
      const edges = (dark, lite) => {
        add("feOffset", { in: "SourceAlpha", dx: 1.7, dy: 2.1, result: "o1" });
        add("feComposite", { in: "SourceAlpha", in2: "o1", operator: "out", result: "rimA" });
        add("feGaussianBlur", { in: "rimA", stdDeviation: 0.9, result: "rimAb" });
        add("feFlood", { "flood-color": "#000", "flood-opacity": dark, result: "dk" });
        add("feComposite", { in: "dk", in2: "rimAb", operator: "in", result: "sh" });
        add("feComposite", { in: "sh", in2: "SourceAlpha", operator: "in", result: "shadow" });
        add("feOffset", { in: "SourceAlpha", dx: -1.3, dy: -1.5, result: "o2" });
        add("feComposite", { in: "SourceAlpha", in2: "o2", operator: "out", result: "rimB" });
        add("feGaussianBlur", { in: "rimB", stdDeviation: 0.8, result: "rimBb" });
        add("feFlood", { "flood-color": "#fff", "flood-opacity": lite, result: "lt" });
        add("feComposite", { in: "lt", in2: "rimBb", operator: "in", result: "gl" });
        add("feComposite", { in: "gl", in2: "SourceAlpha", operator: "in", result: "glow" });
      };
      if (f.kind === "deboss") {
        // no foil at all: only the relief the cliché leaves in the surface
        edges(0.62, 0.42);
        add("feFlood", { "flood-color": "#000", "flood-opacity": 0.07, result: "tint" });
        add("feComposite", { in: "tint", in2: "SourceAlpha", operator: "in", result: "floor" });
        add("feMerge", {}, [svgEl("feMergeNode", { in: "floor" }), svgEl("feMergeNode", { in: "shadow" }), svgEl("feMergeNode", { in: "glow" })]);
        light = null;
        return;
      }
      add("feGaussianBlur", { in: "SourceAlpha", stdDeviation: 1.5, result: "h" });
      light = svgEl("fePointLight", { x: 300, y: -120, z: 260 });
      add("feSpecularLighting", { in: "h", surfaceScale: 3, specularConstant: f.kind === "metal" ? 1.35 : f.spec, specularExponent: f.kind === "metal" ? 24 : 34, "lighting-color": f.light || "#ffffff", result: "sp" }, [light]);
      add("feComposite", { in: "sp", in2: "SourceAlpha", operator: "in", result: "spIn" });
      // hot foil has a fine grain along the direction it was pulled
      add("feTurbulence", { type: "fractalNoise", baseFrequency: f.kind === "metal" ? "0.9 0.07" : "1.4 1.4", numOctaves: 2, seed: 4, result: "n" });
      add("feColorMatrix", { in: "n", type: "saturate", values: 0, result: "ng" });
      add("feComposite", { in: "ng", in2: "SourceAlpha", operator: "in", result: "grain" });
      add("feBlend", { in: "SourceGraphic", in2: "grain", mode: "soft-light", result: "foil" });
      add("feComposite", { in: "foil", in2: "spIn", operator: "arithmetic", k1: 0, k2: 1, k3: f.kind === "metal" ? 1 : 0.8, k4: 0, result: "lit" });
      edges(f.kind === "metal" ? 0.5 : 0.42, f.kind === "metal" ? 0.32 : 0.22);
      add("feMerge", {}, [svgEl("feMergeNode", { in: "lit" }), svgEl("feMergeNode", { in: "shadow" }), svgEl("feMergeNode", { in: "glow" })]);
    }
    function setName(name, type) {
      const t = TYPES[type];
      logo.setAttribute("display", "none"); text.removeAttribute("display");
      text.textContent = t.upper ? name.toLocaleUpperCase() : name;
      text.setAttribute("font-family", t.family); text.setAttribute("font-weight", t.weight); text.setAttribute("letter-spacing", t.spacing);
      text.setAttribute("font-size", t.size);
      // a long name is scaled to the print area, never cut
      try {
        const b = text.getBBox();
        if (b.width && b.height) text.setAttribute("font-size", Math.max(24, t.size * Math.min(1, VB.fitW / b.width, VB.fitH / b.height)).toFixed(1));
      } catch (e) { /* not laid out yet: the default size stands */ }
    }
    function setLogo(url, aspect) {
      text.setAttribute("display", "none"); logo.removeAttribute("display");
      let w = VB.fitW, h = VB.fitW / aspect;
      if (h > VB.fitH) { h = VB.fitH; w = h * aspect; }
      maskImg.setAttribute("href", url);
      maskImg.setAttribute("x", (VB.w - w) / 2); maskImg.setAttribute("y", (VB.h - h) / 2);
      maskImg.setAttribute("width", w); maskImg.setAttribute("height", h);
    }
    function setLight(x, y) { if (light) { light.setAttribute("x", x.toFixed(0)); light.setAttribute("y", y.toFixed(0)); } }
    return { svg, setFoil, setName, setLogo, setLight };
  }

  /**
   * The visitor's own logo, made into a one-colour foil mask in the browser. Hot foil prints one colour, so every
   * part of the logo that differs from its background becomes foil. The file never leaves the browser.
   */
  async function logoMask(file) {
    if (!file || !/^image\//.test(file.type) || file.size > 12e6) throw new Error("type");
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      let w = img.naturalWidth || 600, h = img.naturalHeight || 300;
      const k = Math.min(1, 900 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
      const p = g.getImageData(0, 0, w, h).data;
      let clear = 0, n = 0, sr = 0, sg = 0, sb = 0, sn = 0;
      const border = (x, y) => { const i = (y * w + x) * 4; n++; if (p[i + 3] < 24) clear++; else { sr += p[i]; sg += p[i + 1]; sb += p[i + 2]; sn++; } };
      for (let x = 0; x < w; x++) { border(x, 0); border(x, h - 1); }
      for (let y = 0; y < h; y++) { border(0, y); border(w - 1, y); }
      const transparent = clear / n > 0.5, bg = [sr / Math.max(1, sn), sg / Math.max(1, sn), sb / Math.max(1, sn)];
      const ink = new Float32Array(w * h);
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, a = p[i * 4 + 3] / 255;
        let v = a;
        if (!transparent) { const d = Math.hypot(p[i * 4] - bg[0], p[i * 4 + 1] - bg[1], p[i * 4 + 2] - bg[2]) / 441; v = Math.max(0, Math.min(1, (d - 0.1) / 0.22)) * a; }
        ink[i] = v;
        if (v > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < x0) throw new Error("empty");
      const pad = Math.round(0.02 * Math.max(w, h));
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const o = document.createElement("canvas"); o.width = bw; o.height = bh;
      const og = o.getContext("2d"), od = og.createImageData(bw, bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const j = (y * bw + x) * 4; od.data[j] = od.data[j + 1] = od.data[j + 2] = 255; od.data[j + 3] = Math.round(ink[(y + y0) * w + (x + x0)] * 255); }
      og.putImageData(od, 0, 0);
      return { url: o.toDataURL("image/png"), aspect: bw / bh };
    } finally { URL.revokeObjectURL(src); }
  }

  function mount(stage, ctx) {
    const { el, copy, t } = ctx;
    const uid = `ls${Math.random().toString(36).slice(2, 7)}`;
    const choice = { box: "seville", foil: "gold", type: "classic", name: "", logo: null };
    let foilTouched = false;
    const firstChange = {};
    const once = (key) => { if (!firstChange[key]) { firstChange[key] = true; ctx.track(key); } };
    const displayName = () => (choice.name.trim() || copy.defaultName);
    const img = (id, w) => ctx.asset(`logo/box-${id}-${w}.webp`);
    const hide = (e) => { e.target.style.visibility = "hidden"; };
    const fine = Boolean(window.matchMedia && matchMedia("(pointer: fine)").matches);

    // ---- the scene: the photo, the print, a light hint ----
    const photo = el("img", { class: "ls-photo", alt: "", src: img("seville", 720), srcset: `${img("seville", 720)} 720w, ${img("seville", 1200)} 1200w`, sizes: "(min-width: 760px) 520px, 100vw", decoding: "async", draggable: "false", onerror: hide });
    const print = makePrint(uid);
    const printWrap = el("div", { class: "ls-print-wrap" }, [print.svg]);
    const loupe = el("div", { class: "ls-loupe", "aria-hidden": "true" });
    const scene = el("div", { class: "ls-scene" }, [photo, printWrap]);
    const frame = el("figure", { class: "ls-frame", role: "img" }, [scene, loupe, el("figcaption", { class: "ls-illustration", text: copy.disclaimer })]);
    const hintEl = el("p", { class: "ls-light-hint", "aria-hidden": "true", text: fine ? copy.lightHintMouse : copy.lightHintTouch });
    const zoomBtn = el("button", { type: "button", class: "ls-zoom", "aria-pressed": "false", onclick: () => toggleZoom() }, [el("span", { text: copy.zoomIn })]);
    const thumbs = BOXES.map((b) => el("button", { type: "button", class: "ls-thumb", "data-box": b.id, "aria-pressed": "false", "aria-label": copy.boxes[b.id], title: copy.boxes[b.id], onclick: () => setBox(b.id, "thumb") }, [el("img", { src: img(b.id, 160), alt: "", loading: "lazy", decoding: "async", onerror: hide })]));
    const boxName = el("p", { class: "ls-box-name", "aria-live": "polite" });
    const stageInner = el("div", { class: "ls-stage-inner" }, [frame, el("div", { class: "ls-under" }, [boxName, zoomBtn]), el("div", { class: "ls-thumbs", role: "group", "aria-label": copy.boxLabel }, thumbs), hintEl]);

    // ---- the controls ----
    const nameId = `${uid}-name`;
    const nameInput = el("input", { id: nameId, class: "ls-name-input", type: "text", maxlength: String(MAX_NAME), autocomplete: "organization", autocapitalize: "words", spellcheck: "false", placeholder: copy.namePlaceholder, enterkeyhint: "done" });
    const fileInput = el("input", { type: "file", class: "wps-visually-hidden", accept: "image/png,image/jpeg,image/webp,image/svg+xml", tabindex: "-1", "aria-hidden": "true" });
    const uploadBtn = el("button", { type: "button", class: "ls-upload", onclick: () => fileInput.click() }, [el("span", { class: "ls-upload-icon", "aria-hidden": "true", text: "↑" }), el("span", { text: copy.uploadCta })]);
    const useNameBtn = el("button", { type: "button", class: "wps-link ls-use-name", hidden: true, onclick: () => clearLogo(), text: copy.useName });
    const hint = el("p", { class: "ls-hint", "aria-live": "polite" });
    const group = (labelText, key, values, labels) => {
      const gid = `${uid}-${key}`;
      const buttons = values.map((v) => el("button", { type: "button", class: `ls-chip ls-chip-${key}`, "data-value": v, "aria-pressed": "false", onclick: () => setFoilOrType(key, v) }, [
        key === "foil" ? el("span", { class: `ls-swatch ls-swatch-${v}`, "aria-hidden": "true" }) : null,
        el("span", { class: key === "type" ? `ls-type-sample ls-type-${v}` : "", text: labels[v] }),
      ]));
      return { node: el("div", { class: "ls-group", role: "group", "aria-labelledby": gid }, [el("span", { id: gid, class: "ls-group-label", text: labelText }), el("div", { class: "ls-chips" }, buttons)]), buttons };
    };
    const foilGroup = group(copy.foilLabel, "foil", Object.keys(FOILS), copy.foil);
    const typeGroup = group(copy.typeLabel, "type", Object.keys(TYPES), copy.type);
    const nextBtn = el("button", { type: "button", class: "wps-btn wps-btn-primary ls-next", onclick: () => toResult() }, [el("span", { class: "wps-btn-label", text: `${copy.next} →` })]);

    const nameBlock = el("div", { class: "ls-name-block" }, [
      el("div", { class: "ls-name" }, [el("label", { class: "ls-name-label", for: nameId, text: copy.nameLabel }), nameInput]),
      el("div", { class: "ls-upload-row" }, [uploadBtn, useNameBtn, el("span", { class: "ls-upload-hint", text: copy.uploadHint })]),
      fileInput,
      hint,
    ]);
    // on a phone the field sits right under the box, so the first screen is the box and the field, and the box
    // stays in view above the keyboard while the name is typed (see is-typing in the CSS)
    const onPhone = ctx.device !== "desktop";
    if (onPhone) stageInner.insertBefore(nameBlock, stageInner.querySelector(".ls-thumbs"));
    // on a phone a small live copy of the box floats in the corner once the big one has scrolled away, so the
    // foil is never chosen blind
    const pip = onPhone ? el("div", { class: "ls-pip", "aria-hidden": "true" }) : null;
    const editPanel = el("div", { class: "ls-panel ls-edit" }, [
      el("p", { class: "wps-kicker wps-rise", text: copy.kicker }),
      el("h2", { class: "wps-title wps-rise wps-rise-2", text: copy.title }),
      el("p", { class: "wps-lede wps-rise wps-rise-3", text: copy.lede }),
      // anchored beside the foil options, where the column keeps room for it
      pip ? el("div", { class: "ls-pip-anchor" }, [pip]) : null,
      onPhone ? null : nameBlock,
      el("div", { class: "ls-options wps-rise wps-rise-4" }, [foilGroup.node, typeGroup.node]),
      nextBtn,
    ]);

    const resultTitle = el("h2", { class: "wps-title" });
    const proof = el("div", { class: "ls-proof", "aria-hidden": "true" }, [el("div", { class: "ls-proof-track" },
      ["02", "04", "05", "14", "20", "03", "02", "04", "05", "14", "20", "03"].map((n) => el("img", { src: ctx.asset(`logo/proof-${n}-360.webp`), alt: "", loading: "lazy", decoding: "async", onerror: (e) => { e.target.hidden = true; } })))]);
    const success = el("div", { class: "ls-success", hidden: true, tabindex: "-1" });
    const form = ctx.signupForm({
      buttonText: ctx.shell.signup,
      properties: () => ({ wp_brand_name: choice.name.trim(), wp_logo_finish: choice.foil, wp_logo_lid: choice.box, wp_logo_type: choice.type, wp_logo_uploaded: choice.logo ? "yes" : "no" }),
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

    const layout = el("div", { class: "ls" }, [el("div", { class: "ls-stage" }, [stageInner]), el("div", { class: "ls-side" }, [editPanel, resultPanel])]);
    stage.appendChild(layout);

    // ---- rendering ----
    function place() {
      const b = BOXES.find((x) => x.id === choice.box);
      printWrap.style.setProperty("--x", `${b.x}%`); printWrap.style.setProperty("--y", `${b.y}%`);
      printWrap.style.setProperty("--angle", `${b.angle}deg`); printWrap.style.setProperty("--skew", `${b.skew}deg`);
      printWrap.style.setProperty("--sy", String(b.sy)); printWrap.style.setProperty("--maxw", String(b.maxw));
      layout.dataset.tone = b.tone;
      scene.style.setProperty("--zx", `${b.x}%`); scene.style.setProperty("--zy", `${b.y}%`);
    }
    function render() {
      layout.dataset.foil = choice.foil; layout.dataset.box = choice.box;
      print.setFoil(choice.foil);
      if (choice.logo) print.setLogo(choice.logo.url, choice.logo.aspect);
      else print.setName(displayName(), choice.type);
      layout.classList.toggle("is-placeholder", !choice.name.trim() && !choice.logo);
      boxName.textContent = copy.boxes[choice.box];
      frame.setAttribute("aria-label", `${choice.logo ? copy.uploadCta : displayName()} – ${copy.foil[choice.foil]}, ${copy.boxes[choice.box]}`);
      thumbs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.box === choice.box)));
      if (pip) { pip.textContent = ""; const c = scene.cloneNode(true); c.style.setProperty("--tilt", "rotateX(0deg) rotateY(0deg)"); pip.appendChild(c); }
      foilGroup.buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === choice.foil)));
      typeGroup.buttons.forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.value === choice.type)); b.disabled = Boolean(choice.logo); });
      refreshLoupe();
    }
    function setBox(id, how) {
      if (id === choice.box) return;
      choice.box = id; once("option_box");
      // a box shows its own natural finish until the visitor has picked one
      if (!foilTouched) choice.foil = BOXES.find((b) => b.id === id).foil;
      scene.classList.add("is-swapping");
      const next = new Image();
      next.onload = next.onerror = () => {
        photo.src = img(id, 720); photo.srcset = `${img(id, 720)} 720w, ${img(id, 1200)} 1200w`;
        place(); render(); scene.classList.remove("is-swapping"); sweep();
      };
      next.src = img(id, ctx.device === "desktop" ? 1200 : 720);
      if (how === "swipe") thumbs.find((b) => b.dataset.box === id).scrollIntoView({ inline: "nearest", block: "nearest" });
    }
    function setFoilOrType(key, value) {
      if (choice[key] === value) return;
      choice[key] = value; if (key === "foil") foilTouched = true;
      once(`option_${key}`); render(); sweep();
    }

    // ---- light: follows the pointer or finger, drifts on its own, and sweeps across on every change ----
    let lightX = 300, lightY = -120, raf = 0, idleT = 0, interacting = false, sweepUntil = 0, sweepFrom = 0;
    function frameLight(now) {
      raf = 0;
      if (!stage.isConnected) return;
      if (now < sweepUntil) {
        const k = 1 - (sweepUntil - now) / 950;
        lightX = -350 + k * 1700; lightY = -160 + Math.sin(k * Math.PI) * 140;
        print.setLight(lightX, lightY); schedule(); return;
      }
      if (!interacting && !ctx.reducedMotion) {
        idleT = now / 1000;
        lightX = 500 + 620 * Math.sin(idleT * 0.42); lightY = -40 + 200 * Math.cos(idleT * 0.31);
        print.setLight(lightX, lightY); schedule();
      }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(frameLight); }
    function sweep() { if (ctx.reducedMotion) { print.setLight(520, -140); return; } sweepFrom = performance.now(); sweepUntil = sweepFrom + 950; schedule(); }
    function lightFromPointer(e) {
      const r = frame.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      lightX = -250 + u * 1500; lightY = -320 + v * 820;
      print.setLight(lightX, lightY);
      // a small tilt of the whole scene, as a box tilts in the hand
      if (!ctx.reducedMotion && fine) scene.style.setProperty("--tilt", `rotateX(${((0.5 - v) * 5).toFixed(2)}deg) rotateY(${((u - 0.5) * 6).toFixed(2)}deg)`);
      moveLoupe(e, u, v);
    }
    frame.addEventListener("pointermove", (e) => { interacting = true; once("light_moved"); lightFromPointer(e); });
    frame.addEventListener("pointerleave", () => { interacting = false; scene.style.setProperty("--tilt", "rotateX(0deg) rotateY(0deg)"); loupe.classList.remove("is-on"); schedule(); });

    // ---- loupe (mouse) and zoom (touch): the foil up close ----
    let clone = null;
    function refreshLoupe() {
      if (!fine) return;
      loupe.textContent = "";
      clone = scene.cloneNode(true);
      clone.classList.add("ls-loupe-scene");
      clone.style.setProperty("--tilt", "rotateX(0deg) rotateY(0deg)");
      loupe.appendChild(clone);
    }
    function moveLoupe(e, u, v) {
      if (!fine || !clone || layout.classList.contains("is-zoomed")) return;
      const r = frame.getBoundingClientRect(), z = 2.6, R = loupe.offsetWidth / 2 || 85;
      loupe.classList.add("is-on");
      loupe.style.transform = `translate(${u * r.width - R}px, ${v * r.height - R}px)`;
      clone.style.width = `${r.width}px`; clone.style.height = `${r.height}px`;
      clone.style.transform = `translate(${R - u * r.width * z}px, ${R - v * r.height * z}px) scale(${z})`;
    }
    function toggleZoom() {
      const on = !layout.classList.contains("is-zoomed");
      layout.classList.toggle("is-zoomed", on);
      zoomBtn.setAttribute("aria-pressed", String(on));
      zoomBtn.firstChild.textContent = on ? copy.zoomOut : copy.zoomIn;
      if (on) { ctx.track("zoom"); sweep(); }
    }

    // ---- swipe between boxes on the photo (touch) ----
    let sx = null;
    frame.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { sx = e.clientX; interacting = true; lightFromPointer(e); } });
    frame.addEventListener("pointerup", (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null; interacting = false; schedule();
      if (Math.abs(dx) > 60 && !layout.classList.contains("is-zoomed")) {
        const i = BOXES.findIndex((b) => b.id === choice.box);
        setBox(BOXES[(i + (dx < 0 ? 1 : BOXES.length - 1)) % BOXES.length].id, "swipe");
      }
    });

    // ---- name and logo ----
    let typingTimer = null;
    nameInput.addEventListener("input", () => {
      choice.name = nameInput.value.slice(0, MAX_NAME);
      once("name_typed");
      if (!choice.logo) render();
      const n = choice.name.trim();
      hint.textContent = /^westpack$/i.test(n) ? copy.hintWestpack : n.length > 16 ? copy.hintLong : "";
      clearTimeout(typingTimer);
      typingTimer = setTimeout(sweep, 380);
    });
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nameInput.blur(); if (!onPhone) toResult(); } });
    if (onPhone) {
      nameInput.addEventListener("focus", () => { layout.classList.add("is-typing"); ctx.dialog.scrollTo({ top: 0 }); });
      nameInput.addEventListener("blur", () => { layout.classList.remove("is-typing"); });
    }
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        choice.logo = await logoMask(file);
        ctx.track("logo_uploaded");
        uploadBtn.classList.add("is-active"); useNameBtn.hidden = false;
        hint.textContent = copy.uploadOneColour;
        render(); sweep();
      } catch (e) {
        ctx.track("logo_failed");
        hint.textContent = copy.uploadError;
      }
    });
    function clearLogo() {
      choice.logo = null; uploadBtn.classList.remove("is-active"); useNameBtn.hidden = true; hint.textContent = "";
      render(); sweep(); nameInput.focus();
    }

    // ---- result and success ----
    function toResult() {
      ctx.track("result");
      resultTitle.textContent = t(copy.resultTitle, { name: choice.logo && !choice.name.trim() ? copy.defaultName : displayName() });
      layout.classList.add("is-result");
      if (layout.classList.contains("is-zoomed")) toggleZoom();
      editPanel.hidden = true; resultPanel.hidden = false;
      resultPanel.classList.remove("wps-rise"); void resultPanel.offsetWidth; resultPanel.classList.add("wps-rise");
      sweep();
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
        el("h2", { class: "wps-title ls-success-title", text: result.doubleOptIn ? ctx.shell.doiTitle : t(copy.successTitle, { name: choice.name.trim() || copy.defaultName }) }),
        el("p", { class: "wps-lede", text: result.doubleOptIn ? ctx.shell.doiBody : copy.successBody }),
        el("button", { type: "button", class: "wps-btn wps-btn-ghost", onclick: () => ctx.close("done"), text: ctx.shell.close }),
      );
      success.focus();
      sweep();
    }

    let io = null;
    if (pip && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => { for (const e of entries) layout.classList.toggle("is-pip", !e.isIntersecting && !layout.classList.contains("is-result")); }, { root: ctx.dialog, threshold: 0.3 });
      io.observe(frame);
    }
    place(); render();
    // the fonts arrive after the first paint; measure the name again once they have
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
    setTimeout(sweep, 650);
    schedule();
    return { initialFocus: ctx.device === "desktop" ? nameInput : null, destroy() { cancelAnimationFrame(raf); raf = 0; clearTimeout(typingTimer); if (io) io.disconnect(); } };
  }

  function peekVisual(ctx) {
    return ctx.el("img", { src: ctx.asset("logo/proof-04-360.webp"), alt: "" });
  }

  window.WestpackSignup.registerConcept("logo-studio", { mount, peekVisual });
})();
