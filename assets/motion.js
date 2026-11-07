(function () {
  "use strict";
  var doc = document.documentElement;
  var FW = window.FW || {};
  var G = window.gsap;
  var ok = function () { return FW.motionOK ? FW.motionOK() : !matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = { set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage refused */ } } };
  if (G) {
    var plugins = [window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin, window.CustomEase].filter(Boolean);
    if (plugins.length) G.registerPlugin.apply(G, plugins);
    if (window.CustomEase) { window.CustomEase.create("fw", "0.23,1,0.32,1"); window.CustomEase.create("fwio", "0.77,0,0.175,1"); }
  }
  var EASE = window.CustomEase ? "fw" : "expo.out";
  var EASEIO = window.CustomEase ? "fwio" : "power3.inOut";

  $$("[data-fw-theme]").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = doc.getAttribute("data-theme") === "light" ? "dark" : "light";
      var apply = function () { doc.setAttribute("data-theme", next); store.set("fw-theme", next); };
      if (!document.startViewTransition || !ok()) { apply(); return; }
      var r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var vt = document.startViewTransition(apply);
      vt.ready.then(function () {
        doc.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + end + "px at " + x + "px " + y + "px)"] },
          { duration: 700, easing: "cubic-bezier(.77,0,.175,1)", pseudoElement: "::view-transition-new(root)" });
      });
    });
  });

  function ribbon() {
    var H = Math.max(document.body.scrollHeight, innerHeight), W = 1440, NS = "http://www.w3.org/2000/svg";
    var d = "M1490 -40 C1300 " + H * 0.04 + " 1440 " + H * 0.1 + " 1360 " + H * 0.16;
    var steps = Math.max(4, Math.round(H / 700));
    for (var i = 1; i <= steps; i++) {
      var y = H * (0.16 + 0.84 * i / steps), x = i % 2 ? 1400 : 1290;
      d += " S" + (x + (i % 2 ? 60 : -30)) + " " + (y - H * 0.42 / steps) + " " + x + " " + y;
    }
    var holder = document.createElement("div");
    holder.className = "fw-ribbon"; holder.setAttribute("aria-hidden", "true"); holder.style.height = H + "px";
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 " + W + " " + H); s.setAttribute("preserveAspectRatio", "xMaxYMin slice");
    s.setAttribute("focusable", "false"); s.style.height = H + "px";
    s.innerHTML = '<defs><linearGradient id="fw-rib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a61"/><stop offset=".35" stop-color="#d40e18"/>' +
      '<stop offset=".75" stop-color="#9a0d15"/><stop offset="1" stop-color="#59060e"/></linearGradient></defs>' +
      '<path d="' + d + '" stroke="url(#fw-rib)" stroke-width="40" fill="none" stroke-linecap="round"/>' +
      '<path d="' + d + '" stroke="#fff" stroke-opacity=".3" stroke-width="7" fill="none" stroke-linecap="round" transform="translate(-8 -10)"/>';
    holder.appendChild(s);
    document.body.insertBefore(holder, document.body.firstChild);
    if (G && window.DrawSVGPlugin && window.ScrollTrigger && ok()) {
      var paths = $$("path", s);
      G.set(paths, { drawSVG: "0% 0%" });
      G.to(paths, { drawSVG: "0% 14%", duration: 2.2, ease: EASEIO, delay: 0.4 });
      G.to(paths, { drawSVG: "0% 100%", ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1.2 } });
    }
  }

  function plume(wrap) {
    var THREE = window.THREE, canvas = wrap && $("canvas", wrap);
    if (!THREE || !canvas) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch (e) { wrap.classList.add("fw-plume--flat"); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    var cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 0.15, 7.4);
    var studio = new THREE.Scene(); studio.background = new THREE.Color("#241a22");
    function box(c, i, w, h, x, y, z) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
    }
    box("#ffffff", 5, 6, 1.2, 0, 6, 2); box("#ff8f96", 1.0, 3, 8, -7, 1, 1); box("#ff2a36", 2.4, 8, 2, 0, -6, 0);
    box("#ffffff", 2.2, 0.6, 5, 3, 2, 7); box("#ffffff", 1.4, 0.5, 4, -3.5, 0.5, 7);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio, 0.02).texture;

    function blade(L, w, d, S) {
      S = S || 10;
      var half = function (t) { return w * (t < 0.58 ? Math.pow(t / 0.58, 0.62) : Math.pow((1 - t) / 0.42, 1.05)); };
      var row = function (i) { var t = i / S, y = t * L, hw = half(t), z = -0.16 * t * t * L, dd = d * hw / w;
        return { l: [-hw, y, z], r: [hw, y, z], f: [0, y, z + dd], b: [0, y, z - dd] }; };
      var v = [], tri = function (a, b, c) { v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); };
      for (var i = 0; i < S; i++) {
        var A = row(i), B = row(i + 1);
        tri(A.l, A.f, B.f); tri(A.l, B.f, B.l); tri(A.f, A.r, B.r); tri(A.f, B.r, B.f);
        tri(A.l, B.b, A.b); tri(A.l, B.l, B.b); tri(A.b, B.r, A.r); tri(A.b, B.b, B.r);
      }
      var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
    }
    var crystal = new THREE.MeshPhysicalMaterial({ color: "#d0101b", side: THREE.DoubleSide, roughness: 0.05, metalness: 0.05, clearcoat: 1,
      clearcoatRoughness: 0.04, ior: 1.7, transmission: 0.18, thickness: 0.6, attenuationColor: new THREE.Color("#59060e"),
      attenuationDistance: 0.8, emissive: new THREE.Color("#2a0004"), envMapIntensity: 1.6, flatShading: true });
    var gold = new THREE.MeshPhysicalMaterial({ color: "#f0bd68", metalness: 1, roughness: 0.18, clearcoat: 0.6, envMapIntensity: 2.2, emissive: new THREE.Color("#3a2408") });
    var hs = new THREE.Shape(); hs.moveTo(0, -1); hs.lineTo(-0.86, -0.12); hs.bezierCurveTo(-1.45, 0.5, -0.85, 1.25, 0, 0.62);
    hs.bezierCurveTo(0.85, 1.25, 1.45, 0.5, 0.86, -0.12); hs.lineTo(0, -1);
    var hole = new THREE.Path(); hole.moveTo(0, -0.52); hole.lineTo(-0.48, -0.02); hole.bezierCurveTo(-0.82, 0.34, -0.46, 0.78, 0, 0.38);
    hole.bezierCurveTo(0.46, 0.78, 0.82, 0.34, 0.48, -0.02); hole.lineTo(0, -0.52); hs.holes.push(hole);
    var heartG = new THREE.ExtrudeGeometry(hs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 18 });
    heartG.center();

    var fan = new THREE.Group(); scene.add(fan);
    var blades = [], N = 11;
    for (var i = 0; i < N; i++) {
      var u = i / (N - 1) - 0.5, a = u * 2.55, L = 3.15 - Math.abs(a) * 0.62 + (i % 2 ? -0.35 : 0), w = 0.2 + (i % 2 ? -0.03 : 0);
      var g = new THREE.Group(); g.add(new THREE.Mesh(blade(L, w, 0.085), crystal));
      if (i % 2 === 0) { var h = new THREE.Mesh(heartG, gold); h.scale.setScalar(0.085); h.position.set(0, L * 0.5, 0.095 - 0.16 * 0.25 * L); g.add(h); }
      var target = { x: -0.06 + Math.abs(a) * 0.06, y: a * 0.3, z: -a };
      g.rotation.set(target.x, target.y, target.z);
      blades.push({ g: g, target: target, delay: 0.05 * Math.abs(i - (N - 1) / 2) + 0.15, dir: Math.sign(a) || 1 });
      fan.add(g);
    }
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 24, 64), gold); ring.position.z = 0.12; fan.add(ring);
    var gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), crystal); gem.scale.setScalar(0.8); gem.position.z = 0.14; fan.add(gem);
    fan.position.y = -1.4; fan.rotation.x = -0.08;
    var key = new THREE.DirectionalLight("#ffffff", 1.4); key.position.set(3, 5, 6); scene.add(key);
    var rim = new THREE.DirectionalLight("#ff9aa0", 1.0); rim.position.set(-6, 2, -3); scene.add(rim);

    function size() { var r = canvas.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height);
      renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
    size(); addEventListener("resize", size);
    var px = 0, py = 0, sp = 0, start = null, visible = true;
    addEventListener("pointermove", function (e) { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
    addEventListener("scroll", function () { sp = Math.min(1, scrollY / innerHeight); }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(canvas);
    var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
    var back = function (t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
    function draw(now) {
      var live = ok(), t = start === null ? 0 : (now - start) / 1000, tt = now / 1000;
      for (var k = 0; k < blades.length; k++) {
        var b = blades[k];
        var p = !live ? 1 : start === null ? 0 : Math.min(1, Math.max(0, (t - b.delay) / 1.4));
        var e = easeOut(p);
        b.g.scale.setScalar(Math.max(0.001, back(Math.min(1, p * 1.05))));
        b.g.rotation.z = b.target.z + (1 - e) * 0.9 * b.dir;
        b.g.position.y = -(1 - e) * 0.6;
      }
      var rp = !live ? 1 : start === null ? 0 : Math.min(1, Math.max(0, (t - 0.9) / 0.8));
      ring.scale.setScalar(Math.max(0.001, back(rp))); gem.scale.setScalar(Math.max(0.001, back(rp) * 0.8));
      fan.rotation.y = (live ? Math.sin(tt * 0.35) * 0.2 + px * 0.35 + sp * 0.5 : 0);
      fan.rotation.x = -0.08 + (live ? py * 0.15 + Math.sin(tt * 0.5) * 0.03 - sp * 0.25 : 0);
      fan.position.y = -1.4 + (live ? sp * 0.6 : 0);
      renderer.render(scene, cam);
    }
    function frame(now) { requestAnimationFrame(frame); if (visible) draw(now); }
    requestAnimationFrame(frame);
    return { start: function () { start = performance.now(); } };
  }

  function intro(plumes) {
    plumes.forEach(function (p) { if (p) p.start(); });
    if (!G || !ok()) { unveil(); return; }
    var band = $(".fw-band"); if (!band) { unveil(); return; }
    var tl = G.timeline({ defaults: { ease: EASE } });
    tl.from(".fw-top__row > *", { "--fw-rv": "-16px", opacity: 0, duration: 0.9, stagger: 0.06, clearProps: "--fw-rv,opacity" })
      .from(".fw-nav__link", { "--fw-rv": "-10px", opacity: 0, duration: 0.7, stagger: 0.03, clearProps: "--fw-rv,opacity" }, "<0.1");
    var h = $(".fw-band .fw-head__title, .fw-band .fw-hero__title");
    if (h && window.SplitText) {
      var split = window.SplitText.create(h, { type: "lines,words,chars", mask: "lines", linesClass: "fw-split-line", charsClass: "fw-ch", aria: "auto" });
      tl.from(split.chars, { yPercent: 115, rotate: 6, opacity: 0, filter: "blur(10px)", duration: 1.3, stagger: 0.028 }, 0.15);
    }
    var rest = $$(".fw-band__copy > *").filter(function (el) { return el !== h; });
    if (rest.length) tl.from(rest, { "--fw-rv": "26px", opacity: 0, filter: "blur(6px)", duration: 1.1, stagger: 0.08, clearProps: "--fw-rv,filter,opacity" }, 0.45);
    if ($(".fw-band .fw-plume__glow")) tl.from(".fw-band .fw-plume__glow", { scale: 0.4, opacity: 0, duration: 2, ease: EASEIO }, 0);
    if ($(".fw-band .fw-pom")) tl.from(".fw-band .fw-pom", { scale: 0, opacity: 0, duration: 1.2, ease: "back.out(1.6)", stagger: 0.15 }, 1.1);
    if ($(".fw-band__frame")) tl.from(".fw-band__frame", { clipPath: "inset(14% 14% 14% 14% round 28px)", opacity: 0, duration: 1.6, ease: EASEIO }, 0.2);
    unveil();   // the start states are set: the head can be painted, it is hidden by the timeline itself now
  }

  var hidden = [];   // elements hidden by reveals() and not reached yet
  function showAll() { if (G && hidden.length) G.set(hidden, { clearProps: "--fw-rv,filter,opacity" }); hidden = []; }
  function unveil() { doc.classList.remove("fw-pre"); }
  function reveals() {
    if (!G || !window.ScrollTrigger || !ok()) return;
    var ST = window.ScrollTrigger;
    var fold = window.innerHeight * 0.88;
    var targets = $$("[data-fw-reveal], .fw-tiles__item").filter(function (el) { return el.getBoundingClientRect().top > fold; });
    if (targets.length) {
      G.set(targets, { "--fw-rv": "40px", opacity: 0, filter: "blur(8px)" });
      hidden = targets.slice();
      ST.batch(targets, { start: "top 88%", once: true, onEnter: function (els) {
        hidden = hidden.filter(function (el) { return els.indexOf(el) < 0; });
        G.to(els, { "--fw-rv": "0px", opacity: 1, filter: "blur(0px)", duration: 1.2, ease: EASE, stagger: 0.08, clearProps: "--fw-rv,filter,opacity" });
      } });
    }
    var thread = $(".fw-h-thread path");
    if (thread && window.DrawSVGPlugin) G.fromTo(thread, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 2, ease: EASEIO,
      scrollTrigger: { trigger: ".fw-h-steps", start: "top 80%", once: true } });
    var img = $(".fw-band__img");
    if (img) G.fromTo(img, { yPercent: -4 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: ".fw-band", start: "top top", end: "bottom top", scrub: true } });
  }

  function pointerLight() {
    $$(".fw-tiles__link, .fw-glass, .fw-h-cat").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--fw-mx", x * 100 + "%"); el.style.setProperty("--fw-my", y * 100 + "%");
        el.style.setProperty("--mx", x * 100 + "%"); el.style.setProperty("--my", y * 100 + "%");
        if (ok() && el.classList.contains("fw-tiles__link")) { el.style.setProperty("--fw-ry", (x - 0.5) * 6 + "deg"); el.style.setProperty("--fw-rx", (0.5 - y) * 6 + "deg"); }
      });
      el.addEventListener("pointerleave", function () { el.style.setProperty("--fw-rx", "0deg"); el.style.setProperty("--fw-ry", "0deg"); });
    });
  }

  function go() {
    ribbon();
    var plumes = $$("[data-fw-plume]").map(plume);
    pointerLight(); reveals();
    var started = false;
    var begin = function () { if (started) return; started = true; intro(plumes); };
    if (doc.classList.contains("fw-gate-open")) {
      var mo = new MutationObserver(function () { if (!doc.classList.contains("fw-gate-open")) { mo.disconnect(); begin(); } });
      mo.observe(doc, { attributes: true, attributeFilter: ["class"] });
    } else begin();
    if (window.ScrollTrigger) addEventListener("load", function () { window.ScrollTrigger.refresh(); });
    if (FW.onMotion) FW.onMotion(function (on) { if (!on && G) { G.globalTimeline.progress(1); showAll(); } unveil(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
