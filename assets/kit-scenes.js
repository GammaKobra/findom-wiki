(function () {
  "use strict";
  var FW = window.FW;
  var page = FW && FW.root;
  if (!page) return;
  var docEl = document.documentElement;
  function $(s, el) { return (el || page).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || page).querySelectorAll(s)); }

  var hasGsap = typeof window.gsap !== "undefined";
  var hasThree = typeof window.THREE !== "undefined";
  if (hasGsap && window.SplitText) gsap.registerPlugin(SplitText);
  var reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return reducedMQ.matches; }
  function seconds(name) { var v = parseFloat(FW.token(name)); return isNaN(v) ? 0 : v / 1000; }

  var stats = { rain: 0, descent: 0, studio: 0 };
  window.fwScenes = { renders: stats };

  var tweens = [];
  function track(t) { if (t) tweens.push(t); return t; }
  function finishTweens() { tweens.forEach(function (t) { try { t.progress(1); } catch (e) { /* gone */ } }); tweens = []; }
  FW.onMotion(function (ok) { if (!ok) finishTweens(); });

  var probe = null;
  function colour(expr, scope) {
    if (!probe) {
      probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.position = "absolute"; probe.style.width = "0"; probe.style.height = "0"; probe.style.overflow = "hidden";
    }
    (scope || page).appendChild(probe);
    probe.style.color = expr.indexOf("(") < 0 ? "var(" + expr + ")" : expr;
    var css = getComputedStyle(probe).color;
    probe.parentNode.removeChild(probe);
    var n = (css.match(/-?\d*\.?\d+(e-?\d+)?/g) || []).map(Number);
    var unit = css.indexOf("color(") === 0 ? 1 : 255;
    return { css: css, r: (n[0] || 0) / unit, g: (n[1] || 0) / unit, b: (n[2] || 0) / unit, a: n.length > 3 ? n[3] : 1 };
  }
  function alpha(name, pct, scope) { return colour("color-mix(in srgb, var(" + name + ") " + pct + "%, transparent)", scope).css; }
  function tc(name, scope, k) {
    var c = colour(name, scope);
    var t = new THREE.Color().setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
    if (k !== undefined) t.multiplyScalar(k);
    return t;
  }

  function isLight() { return docEl.getAttribute("data-theme") === "light"; }
  var themeCbs = [], themeNow = docEl.getAttribute("data-theme");
  function onTheme(cb) { themeCbs.push(cb); }
  if ("MutationObserver" in window) {
    new MutationObserver(function () {
      var t = docEl.getAttribute("data-theme");
      if (t === themeNow) return;
      themeNow = t;
      inkCache = {};
      themeCbs.forEach(function (cb) { try { cb(isLight()); } catch (e) { /* one scene failing never stops the others */ } });
    }).observe(docEl, { attributes: true, attributeFilter: ["data-theme"] });
  }
  var FONT_D = FW.token("--fw-font-display"), FONT_UI = FW.token("--fw-font-ui"), FONT_M = FW.token("--fw-font-mono");

  function rng(seed) { // mulberry32: the same paper every time
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var all = Promise.all([
      document.fonts.load('400 120px "fw-display"'), document.fonts.load('italic 400 40px "fw-ui"'),
      document.fonts.load('400 40px "fw-mono"'), document.fonts.load('400 40px "fw-ui"'),
      document.fonts.load('400 40px "fw-read"'), document.fonts.load('italic 400 40px "fw-read"')
    ]);
    return Promise.race([all, new Promise(function (r) { setTimeout(r, 1500); })]).catch(function () {});
  }

  function makeRenderer(canvas, name, preserve) {
    if (!hasThree || !canvas) return null;
    try {
      var gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!preserve, powerPreference: "high-performance" });
      if (!gl) return null;
      var r = new THREE.WebGLRenderer({ canvas: canvas, context: gl, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!preserve });
      if (!r.getContext()) return null;
      var render = r.render.bind(r);
      r.render = function (s, c) { stats[name]++; render(s, c); };
      return r;
    } catch (e) { return null; }
  }

  var INK_PARTS = ["ground", "deep", "light", "line", "soft", "ink", "ink-soft", "frame", "seal", "ring"];
  var inkCache = {};
  function ink(name, scope) {
    if (inkCache[name]) return inkCache[name];
    var P = {};
    INK_PARTS.forEach(function (k) { P[k.replace("-s", "S")] = colour("--fws-" + name + "-" + k, scope).css; });
    inkCache[name] = P;
    return P;
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function paper(g, P, W, H, s, seed) {
    g.fillStyle = P.ground; g.fillRect(0, 0, W, H);
    var rg = g.createRadialGradient(W * 0.3, H * 0.15, 0, W * 0.3, H * 0.15, W * 0.8);
    rg.addColorStop(0, P.light); rg.addColorStop(0.55, P.ground); rg.addColorStop(1, P.deep);
    g.globalAlpha = 0.6; g.fillStyle = rg; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    var r = rng(seed);
    g.strokeStyle = P.soft; g.lineWidth = 1.1 * s;
    for (var i = 0; i < 1400; i++) {
      var x = r() * W, y = r() * H, a = r() * Math.PI, l = (5 + r() * 14) * s;
      g.globalAlpha = 0.3 + r() * 0.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function frame(g, P, W, H, s) {
    g.strokeStyle = P.frame;
    g.lineWidth = 3 * s; rrect(g, 34 * s, 34 * s, W - 68 * s, H - 68 * s, 16 * s); g.stroke();
    g.lineWidth = 1.2 * s; rrect(g, 56 * s, 56 * s, W - 112 * s, H - 112 * s, 6 * s); g.stroke();
    g.save();
    g.fillStyle = P.inkSoft; g.globalAlpha = 0.75;
    g.font = "400 " + (11 * s) + "px " + FONT_M; g.textBaseline = "middle";
    var unit = "FINDOM WIKI · ", line = "";
    while (g.measureText(line).width < W - 150 * s) line += unit;
    g.beginPath(); g.rect(72 * s, 0, W - 144 * s, H); g.clip();
    g.fillText(line, 72 * s, 45 * s);
    g.fillText(line, 72 * s, H - 45 * s);
    g.restore();
  }
  function seal(g, P, cx, cy, R, s, vSize, scope) {
    g.fillStyle = P.seal; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.save();
    g.lineWidth = 7 * s;
    g.strokeStyle = alpha("--fws-emboss", 30, scope); g.beginPath(); g.arc(cx - 2 * s, cy - 2 * s, R + 3 * s, Math.PI * 0.85, Math.PI * 1.75); g.stroke();
    g.strokeStyle = alpha("--fws-contact", 34, scope); g.beginPath(); g.arc(cx + 2 * s, cy + 2 * s, R + 3 * s, Math.PI * 1.85, Math.PI * 2.75); g.stroke();
    g.restore();
    g.strokeStyle = P.ring;
    g.lineWidth = 3 * s; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.2 * s; g.beginPath(); g.arc(cx, cy, R - 46 * s, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.8 * s;
    for (var i = 0; i < 144; i++) {
      var a = (i / 144) * Math.PI * 2, r1 = R - 10 * s, r2 = R - (i % 6 === 0 ? 38 : 26) * s;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    }
    g.fillStyle = P.ink; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = "400 " + vSize + "px " + FONT_D;
    var m = g.measureText("V");
    var asc = m.actualBoundingBoxAscent || vSize * 0.7, desc = m.actualBoundingBoxDescent || 0;
    g.fillText("V", cx, cy + (asc - desc) / 2);
    g.textAlign = "left";
  }
  function drawFront(P, W, scope) {
    var H = W / 2, s = W / 2048;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    paper(g, P, W, H, s, 7);
    var cx = W * 0.75, cy = H * 0.5, R = 236 * s, sig = R * 1.3;
    function engrave(gg, stroke) {
      gg.save();
      gg.beginPath(); gg.rect(57 * s, 57 * s, W - 114 * s, H - 114 * s); gg.clip();
      gg.strokeStyle = stroke; gg.lineWidth = 1.7 * s;
      for (var y = 66 * s; y < H - 60 * s; y += 8 * s) {
        gg.beginPath();
        for (var x = 57 * s; x <= W - 57 * s + 1; x += 6 * s) {
          var dx = x - cx, dy = y - cy;
          var k = Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
          var yy = y + dy * 0.62 * k + Math.sin(x * 0.0042 / s + y * 0.011 / s) * 4.5 * s;
          if (x === 57 * s) gg.moveTo(x, yy); else gg.lineTo(x, yy);
        }
        gg.stroke();
      }
      gg.restore();
    }
    var lg = g.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, P.soft); lg.addColorStop(0.42, P.soft); lg.addColorStop(0.66, P.line); lg.addColorStop(1, P.line);
    engrave(g, lg);
    var px = 57 * s, py = H * 0.37, pw = cx - R - 30 * s - px, ph = H * 0.36;
    var band = document.createElement("canvas"); band.width = W; band.height = H;
    var bg = band.getContext("2d");
    var vg = bg.createLinearGradient(0, py, 0, py + ph);
    vg.addColorStop(0, "transparent"); vg.addColorStop(0.18, P.deep); vg.addColorStop(0.82, P.deep); vg.addColorStop(1, "transparent");
    bg.fillStyle = vg; bg.fillRect(px, py, pw, ph);
    bg.fillStyle = P.line;
    bg.fillRect(px, py + ph * 0.1, pw, 1.4 * s); bg.fillRect(px, py + ph * 0.9, pw, 1.4 * s);
    var hg = bg.createLinearGradient(px, 0, px + pw, 0);
    hg.addColorStop(0, P.ground); hg.addColorStop(0.7, P.ground); hg.addColorStop(1, "transparent");
    bg.globalCompositeOperation = "destination-in"; bg.fillStyle = hg; bg.fillRect(0, 0, W, H);
    g.globalAlpha = 0.5; g.drawImage(band, 0, 0); g.globalAlpha = 1;
    g.fillStyle = P.ground; g.globalAlpha = 0.55; g.beginPath(); g.arc(cx, cy, R + 22 * s, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    seal(g, P, cx, cy, R, s, 300 * s, scope);
    frame(g, P, W, H, s);
    var maxW = cx - R - 120 * s - 118 * s, fs = 172 * s;
    g.fillStyle = P.ink; g.textBaseline = "alphabetic";
    g.font = "400 " + fs + "px " + FONT_D;
    var w = g.measureText("FINDOM WIKI").width;
    if (w > maxW) { fs *= maxW / w; g.font = "400 " + fs + "px " + FONT_D; }
    var wm = g.measureText("FINDOM WIKI");
    var capH = wm.actualBoundingBoxAscent || fs * 0.7;
    g.fillText("FINDOM WIKI", 118 * s, H * 0.55 + capH / 2);
    return c;
  }
  function drawBack(P, W, scope) {
    var H = W / 2, s = W / 2048;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    paper(g, P, W, H, s, 11);
    var cx = W * 0.27, cy = H * 0.5, R = 150 * s;
    g.save();
    g.beginPath(); g.rect(57 * s, 57 * s, W - 114 * s, H - 114 * s); g.clip();
    g.strokeStyle = P.line; g.lineWidth = 1.6 * s; g.lineJoin = "miter";
    var step = 30 * s, amp = 24 * s, gap = 7 * s, nest = 5, rowH = nest * gap + 16 * s;
    for (var y0 = 40 * s; y0 < H; y0 += rowH) {
      for (var i = 0; i < nest; i++) {
        var y = y0 + i * gap;
        g.beginPath();
        for (var k = 0, x = 40 * s; x <= W; k++, x = 40 * s + k * step) {
          var yy = y + (k % 2 ? amp : 0);
          if (k === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.stroke();
      }
    }
    g.restore();
    g.fillStyle = P.ground; g.beginPath(); g.arc(cx, cy, R + 44 * s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = P.frame; g.lineWidth = 1.2 * s; g.beginPath(); g.arc(cx, cy, R + 44 * s, 0, Math.PI * 2); g.stroke();
    seal(g, P, cx, cy, R, s, 190 * s, scope);
    frame(g, P, W, H, s);
    return c;
  }

  var VS = [
    "uniform float uTime; uniform float uAmp; uniform float uCurl; uniform float uPhase;",
    "#ifdef INST",
    "attribute float aPhase;",
    "#endif",
    "varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDepth;",
    "#ifdef PAPER",
    "float disp(vec2 p, float ph) {",
    "  float cw = sin(uTime * 1.25 + ph * 6.2831);",
    "  return uCurl * p.x * p.x + uAmp * (p.x * p.x * 0.42 * cw + sin(p.x * 2.6 + uTime * 1.9 + ph * 9.0) * 0.035",
    "       + p.y * p.y * 0.18 * sin(uTime * 0.9 + ph * 4.0));",
    "}",
    "#endif",
    "void main() {",
    "  vec3 p = position; vec3 n = normal;",
    "#ifdef PAPER",
    "  float ph = uPhase;",
    "#ifdef INST",
    "  ph = aPhase;",
    "#endif",
    "  float z = disp(p.xy, ph);",
    "  float dx = (disp(p.xy + vec2(0.01, 0.0), ph) - z) / 0.01;",
    "  float dy = (disp(p.xy + vec2(0.0, 0.01), ph) - z) / 0.01;",
    "  if (abs(n.z) > 0.5) n = normalize(vec3(-dx, -dy, 1.0)) * sign(n.z);",
    "  p.z += z;",
    "#endif",
    "  mat4 m = modelMatrix;",
    "#ifdef USE_INSTANCING",
    "  m = modelMatrix * instanceMatrix;",
    "#endif",
    "  vec4 wp = m * vec4(p, 1.0);",
    "  vW = wp.xyz; vN = normalize(mat3(m) * n); vUv = uv;",
    "  vec4 mv = viewMatrix * wp; vDepth = -mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");
  var FS = [
    "uniform sampler2D map; uniform float uHasMap; uniform vec3 uSolid;",
    "uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uRimCol;",
    "uniform float uRim; uniform float uSpec; uniform float uAO; uniform float uFloorY;",
    "uniform float uEdge; uniform float uGlaze;",
    "uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;",
    "varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vDepth;",
    "void main() {",
    "  vec3 albedo = uHasMap > 0.5 ? texture2D(map, vUv).rgb : uSolid;",
    "  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;",
    "  vec3 V = normalize(cameraPosition - vW); vec3 L = normalize(uKeyDir); vec3 H = normalize(L + V);",
    "  float wrap = clamp((dot(N, L) + 0.4) / 1.4, 0.0, 1.0);",
    "  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);",
    "  vec3 c = albedo * (hemi + uKeyCol * wrap);",
    "  c += uKeyCol * pow(max(dot(N, H), 0.0), 12.0) * uSpec;",
    "  float fres = 1.0 - clamp(abs(dot(N, V)), 0.0, 1.0);",
    "  c += uRimCol * pow(fres, 2.6) * uRim;",
    "  c += uKeyCol * pow(max(dot(N, H), 0.0), 70.0) * uGlaze;",
    "  c += uKeyCol * pow(fres, 6.0) * uEdge * smoothstep(-0.1, 0.7, N.y);",
    "  c *= mix(1.0 - uAO, 1.0, smoothstep(0.0, 0.42, vW.y - uFloorY));",
    "  c = mix(c, uFogCol, smoothstep(uFogNear, uFogFar, vDepth));",
    "  gl_FragColor = vec4(c, 1.0);",
    "  #include <colorspace_fragment>",
    "}"
  ].join("\n");
  function lightUniforms(o, scope) {
    return {
      uTime: { value: 0 }, uAmp: { value: o.amp || 0 }, uCurl: { value: o.curl || 0 },
      uKeyDir: { value: new THREE.Vector3(-0.35, 1, 0.65) }, uKeyCol: { value: tc("--fws-key", scope, o.key) },
      uSky: { value: tc("--fws-sky", scope, o.sky) }, uGround: { value: tc("--fws-floor", scope, o.ground) },
      uRimCol: { value: tc("--fws-rim", scope) }, uRim: { value: o.rim }, uSpec: { value: o.spec || 0 },
      uAO: { value: 0 }, uFloorY: { value: 0 }, uEdge: { value: o.edge || 0 }, uGlaze: { value: o.glaze || 0 },
      uFogCol: { value: tc("--fws-fog", scope) }, uFogNear: { value: o.fogNear || 100 }, uFogFar: { value: o.fogFar || 200 }
    };
  }
  function relight(U, o, scope) {
    U.uKeyCol.value.copy(tc("--fws-key", scope, o.key)); U.uSky.value.copy(tc("--fws-sky", scope, o.sky));
    U.uGround.value.copy(tc("--fws-floor", scope, o.ground)); U.uRimCol.value.copy(tc("--fws-rim", scope));
    U.uFogCol.value.copy(tc("--fws-fog", scope));
  }
  function surface(U, o) {
    var u = {};
    for (var k in U) u[k] = U[k];
    u.map = { value: o.map || null }; u.uHasMap = { value: o.map ? 1 : 0 };
    u.uSolid = { value: o.solid ? o.solid.clone() : new THREE.Color(1, 1, 1) };
    u.uPhase = { value: o.phase || 0 };
    ["ao", "spec", "rim", "edge", "glaze"].forEach(function (key) {
      if (o[key] !== undefined) u["u" + (key === "ao" ? "AO" : key.charAt(0).toUpperCase() + key.slice(1))] = { value: o[key] };
    });
    var defines = {};
    if (o.paper) defines.PAPER = "";
    if (o.inst) defines.INST = "";
    return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, defines: defines, side: o.double ? THREE.DoubleSide : THREE.FrontSide });
  }
  function texFrom(canvas, renderer) {
    var t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  var NOTE_W = 1.2, NOTE_H = 0.6, NOTE_D = 0.007;
  function noteMaterials(U, P, renderer, W, inst, scope) {
    var front = surface(U, { map: texFrom(drawFront(P, W, scope), renderer), paper: true, inst: inst });
    var back = surface(U, { map: texFrom(drawBack(P, W, scope), renderer), paper: true, inst: inst });
    var edge = surface(U, { solid: tc("--fws-paper-core", scope), paper: true, inst: inst });
    return [edge, edge, edge, edge, front, back];
  }
  function repaintNote(mats, P, renderer, W, scope) {
    [[4, drawFront], [5, drawBack]].forEach(function (f) {
      var u = mats[f[0]].uniforms.map, old = u.value;
      u.value = texFrom(f[1](P, W, scope), renderer);
      if (old) old.dispose();
    });
    mats[0].uniforms.uSolid.value.copy(tc("--fws-paper-core", scope));
  }

  function initHero(hero) {
    var canvas = $("[data-fw-rain]", hero);
    var searchBtn = $("[data-fw-hero-search]", hero);
    if (searchBtn) searchBtn.addEventListener("click", function () {
      var input = $("#fw-search-input");
      if (!input) return;
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: "center", behavior: FW.motionOK() ? "smooth" : "auto" });
    });
    if (!canvas) return;
    emerge(hero);
    var kicker = $(".fw-hero__kicker", hero) || $(".fw-hero__title", hero);
    var wordsTop = function () {
      if (kicker) hero.style.setProperty("--fws-words-top", Math.round(kicker.getBoundingClientRect().top - hero.getBoundingClientRect().top) + "px");
    };
    wordsTop();
    if ("ResizeObserver" in window) new ResizeObserver(wordsTop).observe(hero);
    var rain = createRain(canvas, hero);
    if (!rain) rainFallback(hero);
  }

  function emerge(hero) {
    var title = $(".fw-hero__title", hero);
    if (!title || !$("[data-fw-rain]", hero) || !hasGsap || !window.SplitText || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      if (!FW.motionOK()) return;
      fontsReady().then(function () {
        if (!FW.motionOK()) return;
        var split = SplitText.create(title, { type: "words,chars", aria: "auto" });
        var tl = gsap.timeline({ defaults: { ease: FW.ease.out }, onComplete: function () { split.revert(); } });
        tl.from(split.chars, { opacity: 0, yPercent: 38, duration: seconds("--fw-dur-draw"), stagger: seconds("--fw-stagger") * 0.7 }, 0.1);
        tl.from([$(".fw-hero__kicker", hero), $(".fw-hero__lead", hero), $(".fw-hero__actions", hero), $(".fw-hero__meta", hero)],
          { opacity: 0, y: 14, duration: seconds("--fw-dur-explain"), stagger: seconds("--fw-stagger") * 1.8 }, 0.45);
        track(tl);
      });
    }, { threshold: 0.5 });
    io.observe(title);
  }

  function createRain(canvas, hero) {
    var renderer = makeRenderer(canvas, "rain", false);
    if (!renderer) return null;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 0, 10);
    var LIGHT = { amp: 0.8, key: 1.0, sky: 0.8, ground: 0.75, rim: 0.32, spec: 0.02, fogNear: 10, fogFar: 38 };
    var U = lightUniforms(LIGHT, hero);
    var KEYS = ["rose", "blush", "wine"], PER = [22, 28, 22];
    var meshes = [], notes = [];
    var dummy = new THREE.Object3D();
    KEYS.forEach(function (key, m) {
      var geo = new THREE.BoxGeometry(NOTE_W, NOTE_H, NOTE_D, 20, 6, 1);
      var phase = new Float32Array(PER[m]);
      for (var i = 0; i < PER[m]; i++) phase[i] = Math.random();
      geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
      var mesh = new THREE.InstancedMesh(geo, noteMaterials(U, ink(key, hero), renderer, 1024, true, hero), PER[m]);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
      meshes.push(mesh);
      for (var j = 0; j < PER[m]; j++) notes.push({ m: m, i: j, rank: Math.random() });
    });
    var T = 0, density = 1, densityTarget = 1;
    var tanH = Math.tan(THREE.MathUtils.degToRad(19));
    function halfH(z) { return tanH * (camera.position.z - z); }
    function seed(n, top) {
      n.z = -16 + Math.random() * 19.5;
      var hh = halfH(n.z), hw = hh * camera.aspect;
      n.x = (Math.random() * 2 - 1) * hw * 1.05;
      n.y = top ? hh + 0.7 + Math.random() * 2.2 : (Math.random() * 2 - 1) * hh * 1.05;
      n.vy = 0.3 + Math.random() * 0.26;
      n.f1 = 0.5 + Math.random() * 0.45; n.p1 = Math.random() * 6.28; n.a1 = 0.5 + Math.random() * 0.5;
      n.f2 = 0.3 + Math.random() * 0.35; n.p2 = Math.random() * 6.28; n.a2 = 0.16 + Math.random() * 0.36;
      n.rx0 = (Math.random() - 0.5) * 0.5; n.ry0 = Math.random() * 6.28; n.spin = (Math.random() - 0.5) * 0.45;
      n.sway = 0.22 + Math.random() * 0.3;
      n.s = 0.86 + Math.random() * 0.4;
      n.alive = n.rank < density;
    }
    function step(dt) {
      T += dt;
      U.uTime.value = T;
      density += (densityTarget - density) * Math.min(1, dt * 2);
      for (var q = 0; q < notes.length; q++) {
        var n = notes[q];
        var rx = n.rx0 + Math.sin(T * n.f1 + n.p1) * n.a1;
        var rz = Math.sin(T * n.f2 + n.p2) * n.a2;
        var ry = n.ry0 + T * n.spin;
        if (dt > 0) {
          n.x += Math.cos(T * n.f1 + n.p1) * n.sway * dt;
          n.y -= n.vy * dt * (0.75 + 0.6 * Math.abs(Math.sin(rx)));
          if (n.y < -halfH(n.z) - 0.9) seed(n, true);
          if (!n.alive && n.rank < density && n.y > halfH(n.z)) n.alive = true;
        }
        dummy.position.set(n.x, n.y, n.z);
        dummy.rotation.set(rx, ry, rz, "YXZ");
        dummy.scale.setScalar(n.alive ? n.s : 0);
        dummy.updateMatrix();
        meshes[n.m].setMatrixAt(n.i, dummy.matrix);
      }
      meshes.forEach(function (mm) { mm.instanceMatrix.needsUpdate = true; });
    }
    function render() { renderer.render(scene, camera); }
    function resize() {
      var w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function still() {
      var rnd = rng(20261102);
      var cr = canvas.getBoundingClientRect(), W = Math.max(1, cr.width), H = Math.max(1, cr.height), PAD = 24;
      var keep = $$(".fw-hero__kicker, .fw-hero__title, .fw-hero__lead, .fw-hero__actions > *, .fw-hero__meta", hero).map(function (el) {
        var r = el.getBoundingClientRect();
        return { l: r.left - cr.left - PAD, t: r.top - cr.top - PAD, r: r.right - cr.left + PAD, b: r.bottom - cr.top + PAD };
      });
      function clear(px, py, rad) { return keep.every(function (k) { return px + rad < k.l || px - rad > k.r || py + rad < k.t || py - rad > k.b; }); }
      var share = W < 760 ? 0.16 : 0.36; // on a phone the words fill the width: only the strip above them is free
      density = densityTarget = share;
      notes.forEach(function (n) {
        n.alive = n.rank < share;
        if (!n.alive) return;
        for (var tries = 0; tries < 48; tries++) {
          n.z = -16 + rnd() * 19.5;
          var hh = halfH(n.z), hw = hh * camera.aspect;
          n.x = (rnd() * 2 - 1) * hw * 0.96; n.y = (rnd() * 2 - 1) * hh * 0.96;
          var px = (n.x / hw + 1) / 2 * W, py = (1 - n.y / hh) / 2 * H, rad = 0.6 * NOTE_W * n.s * (W / 2) / hw;
          if (clear(px, py, rad)) return;
        }
        n.alive = false; // no clear place: this note is left out of the still
      });
      T = 4.2; step(0); render();
    }
    resize();
    notes.forEach(function (n) { seed(n, false); });
    try { renderer.compile(scene, camera); } catch (e) { /* pre-warm only */ }
    if (reduced()) still(); else { step(0); render(); }

    FW.loop(hero, function (t, dt) { step(Math.min(0.05, dt)); render(); }, { fps: 64 });
    FW.onMotion(function (ok) {
      if (ok) { densityTarget = 1; return; }
      if (reduced()) still();   // reduced motion: the still frame; Pause: every note stops where it is
    });
    onTheme(function () {
      relight(U, LIGHT, hero);
      meshes.forEach(function (mm, m) { repaintNote(mm.material, ink(KEYS[m], hero), renderer, 1024, hero); });
      render();
    });
    if ("ResizeObserver" in window) new ResizeObserver(function () {
      resize();
      if (reduced()) still(); else if (!FW.motionOK()) render();
    }).observe(canvas);
    var heroOn = false;
    FW.whenActive(hero, function (a) { heroOn = a; });
    window.addEventListener("scroll", function () {
      if (!FW.motionOK() || !heroOn) return;
      var r = hero.getBoundingClientRect();
      var gone = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height)));
      densityTarget = 1 - gone * 0.85;
      notes.forEach(function (n) { if (n.rank >= densityTarget && n.y > halfH(n.z)) n.alive = false; });
    }, { passive: true });
    return { still: still };
  }
  function rainFallback(hero) {
    hero.setAttribute("data-fws-nogl", "");
    var fb = $("[data-fw-rain-fallback]", hero);
    if (!fb || fb.childElementCount) return;
    var NOTES = [["rose", 1], ["blush", 2], ["rose", 3], ["blush", 4]], imgs = [];
    function paintAll() {
      imgs.forEach(function (img, i) {
        var d = NOTES[i];
        img.src = (i === 2 ? drawBack(ink(d[0], hero), 640, hero) : drawFront(ink(d[0], hero), 640, hero)).toDataURL("image/png");
      });
    }
    fontsReady().then(function () {
      NOTES.forEach(function (d) {
        var img = document.createElement("img");
        img.alt = ""; img.className = "fw-rain__note"; img.setAttribute("data-n", String(d[1]));
        fb.appendChild(img); imgs.push(img);
      });
      paintAll();
      onTheme(paintAll);
    });
  }

  var descent3dUsed = false;
  function initDescent(root) {
    var steps = $$("[data-fw-step]", root);
    var N = steps.length;
    if (!N) return;
    var word = root.getAttribute("data-fw-descent-word") || "step";
    var Word = word.charAt(0).toUpperCase() + word.slice(1);
    var names = steps.map(function (s) { var h = $(".fw-descent__name", s); return h ? h.textContent.trim() : ""; });
    var live = $("[data-fw-descent-live]", root);
    var exitBar = $("[data-fw-exitbar]", root);
    var line = exitBar && $("[data-fw-exitbar-line]", exitBar);
    var state = { step: 0, onScreen: false };

    steps.forEach(function (s, i) {
      var num = $(".fw-descent__num", s);
      if (num && !$(".fw-descent__of", num)) {
        var of = document.createElement("span"); of.className = "fw-descent__of"; of.textContent = "of " + N; num.appendChild(of);
      }
      var h = $(".fw-descent__name", s);
      if (h && !$(".fw-visually-hidden", h)) {
        var pre = document.createElement("span"); pre.className = "fw-visually-hidden"; pre.textContent = Word + " " + (i + 1) + " of " + N + ": ";
        h.insertBefore(pre, h.firstChild);
      }
      var depth = depthOf(i), prev = i ? depthOf(i - 1) : 1;
      s.setAttribute("data-fws-depth", String(depth));
      s.style.setProperty("--fws-prev", "var(--fw-depth-" + prev + ")");
    });
    function depthOf(i) { return N === 1 ? 1 : Math.round(1 + 4 * i / (N - 1)); }

    var marks = $("[data-fw-descent-marks]", root), markBtns = [], fill = null;
    if (marks) {
      var ol = document.createElement("ol"); ol.className = "fw-descent__list";
      names.forEach(function (name, i) {
        var li = document.createElement("li");
        var b = document.createElement("button");
        b.type = "button"; b.className = "fw-descent__mark"; b.setAttribute("data-step", String(i + 1));
        b.setAttribute("aria-label", "Go to " + word + " " + (i + 1) + ": " + name);
        b.innerHTML = '<span class="fw-descent__dot" aria-hidden="true"></span><span class="fw-descent__mname" aria-hidden="true">' + FW.esc(name) + "</span>";
        b.addEventListener("click", function () { goTo(i + 1); });
        li.appendChild(b); ol.appendChild(li); markBtns.push(b);
      });
      fill = document.createElement("span"); fill.className = "fw-descent__fill"; fill.setAttribute("aria-hidden", "true");
      ol.appendChild(fill);
      marks.appendChild(ol);
    }
    $$("[data-fw-descent-go]", root).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); goTo(Number(a.getAttribute("data-fw-descent-go"))); });
    });
    function goTo(k) {
      var t = steps[k - 1];
      if (!t) return;
      window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset, behavior: FW.motionOK() ? "smooth" : "auto" });
      var h = $(".fw-descent__name", t);
      if (h) h.focus({ preventScroll: true });
    }

    if (exitBar) {
      if (!docEl.classList.contains("bare") && document.querySelector("nav.review")) exitBar.setAttribute("data-fws-review", "");
      var measureBar = function () {
        var off = parseFloat(getComputedStyle(exitBar).getPropertyValue("--fws-bar-off")) || 0;
        root.style.setProperty("--fws-bar-h", Math.ceil(exitBar.offsetHeight + off) + "px");
      };
      measureBar();
      if (window.ResizeObserver) new ResizeObserver(measureBar).observe(exitBar);
    }
    function barState() {
      if (!exitBar) return;
      var r = root.getBoundingClientRect(), b = exitBar.getBoundingClientRect();
      var on = r.top <= window.innerHeight * 0.35 || exitBar.classList.contains("fw-exitbar--fixed");
      if (on) exitBar.removeAttribute("data-fws-off"); else exitBar.setAttribute("data-fws-off", "");
      if (r.bottom - b.bottom > 1) exitBar.setAttribute("data-fws-pinned", ""); else exitBar.removeAttribute("data-fws-pinned");
    }
    var LINE_REST = 0.72;
    function exitLight() {
      if (!hasGsap || !FW.motionOK() || !line) return;
      gsap.killTweensOf(line, "opacity");
      track(gsap.timeline()
        .to(line, { opacity: 1, duration: seconds("--fw-dur-turn"), ease: FW.ease.out })
        .to(line, { opacity: LINE_REST, duration: seconds("--fw-dur-settle"), ease: "sine.inOut" }));
    }
    FW.onMotion(function (ok) { if (!ok && line) { if (hasGsap) gsap.killTweensOf(line); line.style.opacity = ""; } });

    var anchors = [];
    function measureAnchors() {
      var y0 = window.pageYOffset, top = root.getBoundingClientRect().top + y0;
      anchors = [{ y: top, d: 0 }];
      steps.forEach(function (t, i) { anchors.push({ y: t.getBoundingClientRect().top + y0, d: i + 1 }); });
    }
    function depthAt(y) {
      if (y <= anchors[0].y) return 0;
      for (var i = 1; i < anchors.length; i++) {
        if (y < anchors[i].y) { var a = anchors[i - 1], b = anchors[i]; return a.d + (b.d - a.d) * (y - a.y) / Math.max(1, b.y - a.y); }
      }
      return anchors[anchors.length - 1].d;
    }
    function stepAt(y) {
      var mid = y + window.innerHeight * 0.5, k = 0;
      for (var i = 1; i < anchors.length; i++) if (anchors[i].y <= mid) k = i;
      return k;
    }
    var liveTimer = 0;
    function setStep(k) {
      if (k === state.step) return;
      var prev = state.step;
      state.step = k;
      root.setAttribute("data-fws-step", String(k));
      markBtns.forEach(function (b, i) { if (i + 1 === k) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
      if (fill) fill.style.transform = "scaleY(" + (k <= 1 || N < 2 ? 0 : (k - 1) / (N - 1)) + ")";
      root.style.setProperty("--fws-fb-o", String(k <= 1 || N < 2 ? 1 : 1 - 0.84 * (k - 1) / (N - 1)));
      clearTimeout(liveTimer);
      if (live && k > 0) liveTimer = setTimeout(function () { live.textContent = Word + " " + k + " of " + N + ": " + names[k - 1] + "."; }, 450);
      if (k > prev && prev > 0) exitLight();
      if (scene && !FW.motionOK()) scene.still(k);
    }
    var scrollRaf = 0;
    function onScroll() {
      scrollRaf = 0;
      var y = window.pageYOffset;
      barState();
      setStep(stepAt(y));
      if (scene) { scene.target(depthAt(y)); if (!FW.motionOK() && state.onScreen) scene.follow(); }
    }
    function queue() { if (!scrollRaf) scrollRaf = requestAnimationFrame(onScroll); }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", function () { measureAnchors(); queue(); });
    if (window.ResizeObserver) new ResizeObserver(function () { measureAnchors(); queue(); }).observe(root);

    var scene = null;
    var wants3d = root.getAttribute("data-fw-descent-mode") !== "drawn" && !descent3dUsed;
    var canvas = $("[data-fw-descent-canvas]", root);
    if (wants3d && canvas) {
      var renderer = makeRenderer(canvas, "descent", false);
      if (renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        try { scene = createSpiral(renderer, canvas, root, N, state); descent3dUsed = true; } catch (e) { scene = null; }
      }
    }
    if (!scene) { root.setAttribute("data-fws-drawn", ""); drawSpiral($("[data-fw-descent-fb]", root), N); }
    FW.whenActive(root, function (a) { state.onScreen = a; if (a && scene && !FW.motionOK()) scene.still(state.step); });
    measureAnchors();
    onScroll();
    if (scene) {
      if (FW.motionOK()) scene.draw(); else scene.still(state.step);
      FW.loop(root, scene.tick, { fps: 64 });
      FW.onMotion(function (ok) { if (!ok) scene.still(state.step); });
      window.addEventListener("resize", function () { scene.resize(); });
    }
  }

  function createSpiral(renderer, canvas, root, N, state) {
    var Q = 0.5, R0 = 10, K = 0.95, B = 0.3;
    var S0 = 0, S1 = N + 2.5, PER_TURN = 240, ACROSS = 6;
    function grow(s) { var x = Math.max(0, Math.min(1, s / 0.45)); return x * x * (3 - 2 * x); } // the band begins as a narrow tongue at the rim
    function R(s) { return R0 * Math.pow(Q, s); }
    function Y(s) { return K * R(s); }
    function strip(fn, across) {
      var n = Math.round((S1 - S0) * PER_TURN) + 1;
      var pos = new Float32Array(n * (across + 1) * 3), colr = new Float32Array(n * (across + 1) * 3), idx = [];
      var p = 0, q = 0;
      for (var i = 0; i < n; i++) {
        var s = S0 + (S1 - S0) * i / (n - 1), th = s * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        for (var j = 0; j <= across; j++) {
          var ry = fn(s, j / across);
          pos[p++] = ry[0] * cs; pos[p++] = ry[1]; pos[p++] = ry[0] * sn;
          colr[q++] = ry[2]; colr[q++] = ry[2]; colr[q++] = ry[2];   // soft shade: the foot of each step lies in shadow
        }
      }
      for (var a = 0; a < n - 1; a++) {
        for (var b = 0; b < across; b++) {
          var v0 = a * (across + 1) + b, v1 = v0 + 1, v2 = v0 + across + 1, v3 = v2 + 1;
          idx.push(v0, v2, v1, v1, v2, v3);
        }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(colr, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    var band = strip(function (s, u) {
      var ro = R(s), ri = ro - (ro - R(s + 1) * 1.002) * Math.max(0.04, grow(s));
      var r = ro + (ri - ro) * u, sag = Math.sin(u * Math.PI) * 0.05 * (ro - ri);
      return [r, Y(s) - B * (ro - r) - sag, 0.22 + 0.78 * Math.pow(u, 0.8)];
    }, ACROSS);
    var wall = strip(function (s, u) {
      var ro = R(s), g = Math.max(0.04, grow(s)), ri = ro - (ro - R(s + 1) * 1.002) * g;
      var top = Y(s) - B * (ro - ri), bottom = top + (Y(s + 1) - top) * g;
      return [ri - 0.002 * R(s + 1) * u, top + (bottom - top) * u, 0.85 - 0.65 * u];
    }, 2);

    var fade = { value: new THREE.Vector2(1, 2) };
    var MAXR = 40, rectList = [];
    for (var i0 = 0; i0 < MAXR; i0++) rectList.push(new THREE.Vector4(0, 0, 0, 0));
    var mask = { uRects: { value: rectList }, uNR: { value: 0 }, uFeather: { value: 48 }, uCap: { value: 0.09 }, uLight: { value: 0 } };
    var MASK_GLSL = [
      "uniform vec4 uRects[" + MAXR + "]; uniform int uNR; uniform float uFeather; uniform float uCap; uniform float uLight;",
      "float fwsUnder() {",
      "  float m = 0.0;",
      "  for (int i = 0; i < " + MAXR + "; i++) {",
      "    if (i >= uNR) break;",
      "    vec4 r = uRects[i];",
      "    vec2 dd = max(vec2(0.0), max(r.xy - gl_FragCoord.xy, gl_FragCoord.xy - r.zw));",
      "    m = max(m, 1.0 - smoothstep(0.0, uFeather, length(dd)));",
      "  }",
      "  return m;",
      "}"
    ].join("\n");
    var mat = new THREE.MeshPhysicalMaterial({
      color: tc("--fws-satin", root), vertexColors: true, roughness: 0.72, metalness: 0,
      sheen: 1, sheenRoughness: 0.38, sheenColor: tc("--fws-satin-sheen", root),
      clearcoat: 0.5, clearcoatRoughness: 0.34,
      emissive: tc("--fws-satin-glow", root), emissiveIntensity: 0,
      side: THREE.DoubleSide, transparent: true
    });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uFade = fade;
      sh.uniforms.uRects = mask.uRects; sh.uniforms.uNR = mask.uNR; sh.uniforms.uFeather = mask.uFeather; sh.uniforms.uCap = mask.uCap; sh.uniforms.uLight = mask.uLight;
      sh.fragmentShader = "uniform vec2 uFade;\n" + MASK_GLSL + "\n" + sh.fragmentShader.replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\n  float fwsVis = 1.0 - smoothstep(uFade.x, uFade.y, vViewPosition.z);\n  float fwsU = fwsUnder();\n  float fwsL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));\n  gl_FragColor.rgb *= mix(1.0, min(1.0, uCap / max(fwsL, 0.0001)), fwsU * (1.0 - uLight));\n  gl_FragColor = vec4(gl_FragColor.rgb, gl_FragColor.a * fwsVis * (1.0 - 0.28 * fwsU * uLight));"
      );
    };
    function lipPoint(s) {
      var ro = R(s), g = Math.max(0.04, grow(s)), ri = ro - (ro - R(s + 1) * 1.002) * g, th = s * Math.PI * 2;
      return [ri * Math.cos(th), Y(s) - B * (ro - ri) + 0.0015 * R(s), ri * Math.sin(th)];
    }
    var LN = Math.round((S1 - S0) * PER_TURN) + 1;
    var lPos = new Float32Array(LN * 6), lNext = new Float32Array(LN * 6), lSide = new Float32Array(LN * 2), lS = new Float32Array(LN * 2), lIdx = [], pts = [];
    var li;
    for (li = 0; li < LN; li++) pts.push(lipPoint(S0 + (S1 - S0) * li / (LN - 1)));
    for (li = 0; li < LN; li++) {
      var pa = pts[li], pb = li < LN - 1 ? pts[li + 1] : [2 * pa[0] - pts[li - 1][0], 2 * pa[1] - pts[li - 1][1], 2 * pa[2] - pts[li - 1][2]];
      for (var sd = 0; sd < 2; sd++) {
        var v = li * 2 + sd;
        lPos.set(pa, v * 3); lNext.set(pb, v * 3);
        lSide[v] = sd ? 1 : -1;
        lS[v] = S0 + (S1 - S0) * li / (LN - 1);
      }
      if (li < LN - 1) lIdx.push(li * 2, li * 2 + 1, li * 2 + 2, li * 2 + 1, li * 2 + 3, li * 2 + 2);
    }
    var lipGeo = new THREE.BufferGeometry();
    lipGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lipGeo.setAttribute("aNext", new THREE.BufferAttribute(lNext, 3));
    lipGeo.setAttribute("aSide", new THREE.BufferAttribute(lSide, 1));
    lipGeo.setAttribute("aS", new THREE.BufferAttribute(lS, 1));
    lipGeo.setIndex(lIdx);
    var lipMat = new THREE.ShaderMaterial({
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 2.4 }, uFade: fade, uDepth: { value: 0 },
        uColor: { value: tc("--fws-lip", root) }, uOpacity: { value: 0.6 },
        uRects: mask.uRects, uNR: mask.uNR, uFeather: mask.uFeather, uCap: mask.uCap, uLight: mask.uLight
      },
      vertexShader: [
        "uniform vec2 uRes; uniform float uWidth; uniform vec2 uFade;",
        "attribute vec3 aNext; attribute float aSide; attribute float aS;",
        "varying float vVis; varying float vS; varying float vSide;",
        "void main() {",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  vec4 c0 = projectionMatrix * mv;",
        "  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);",
        "  vec2 dir = normalize((c1.xy / c1.w - c0.xy / c0.w) * uRes);",
        "  vec2 n = vec2(-dir.y, dir.x);",
        "  c0.xy += n * aSide * uWidth / uRes * c0.w;",
        "  vVis = 1.0 - smoothstep(uFade.x, uFade.y, -mv.z);",
        "  vS = aS; vSide = aSide;",
        "  gl_Position = c0;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColor; uniform float uOpacity; uniform float uDepth;",
        MASK_GLSL,
        "varying float vVis; varying float vS; varying float vSide;",
        "void main() {",
        "  float here = smoothstep(uDepth - 0.12, uDepth + 0.04, vS) * (1.0 - smoothstep(uDepth + 0.96, uDepth + 1.12, vS));",
        "  float passed = 1.0 - smoothstep(uDepth - 0.12, uDepth + 0.04, vS);",
        "  float a = mix(mix(0.42, 0.5, passed), 1.0, here);",
        "  float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));",
        "  gl_FragColor = vec4(uColor, uOpacity * a * vVis * edge * (1.0 - fwsUnder()));",
        "}"
      ].join("\n"),
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide
    });
    var lip = new THREE.Mesh(lipGeo, lipMat);
    lip.renderOrder = 2; lip.frustumCulled = false;
    var group = new THREE.Group();
    group.add(new THREE.Mesh(band, mat), new THREE.Mesh(wall, mat), lip);
    var sceneObj = new THREE.Scene();
    sceneObj.add(group);
    var KEY = 1.25, HEMI = 0.16;
    var key = new THREE.DirectionalLight(tc("--fws-key", root), KEY);
    key.position.set(-0.7, 1, 0.5);
    var hemi = new THREE.HemisphereLight(tc("--fws-sky", root), tc("--fws-floor", root), HEMI);
    sceneObj.add(key, hemi);
    var glowK = 0;
    function dress() {
      var light = isLight();
      mat.color.copy(tc("--fws-satin", root));
      mat.sheenColor.copy(tc("--fws-satin-sheen", root));
      mat.emissive.copy(tc("--fws-satin-glow", root));
      glowK = light ? 0.92 : 0;
      lipMat.uniforms.uColor.value.copy(tc("--fws-lip", root));
      key.color.copy(tc("--fws-key", root));
      hemi.color.copy(tc("--fws-sky", root)); hemi.groundColor.copy(tc("--fws-floor", root));
      mask.uLight.value = light ? 1 : 0;
    }
    dress();
    var camera = new THREE.PerspectiveCamera(46, 1, 0.05, 500);
    camera.up.set(0, 0, -1);

    var size = { w: 0, h: 0 };
    function resize() {
      var w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      if (w === size.w && h === size.h) return false;
      size.w = w; size.h = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var pr = renderer.getPixelRatio();
      lipMat.uniforms.uRes.value.set(w * pr, h * pr);
      lipMat.uniforms.uWidth.value = 2.6 * pr;
      mask.uFeather.value = 48 * pr;
      return true;
    }
    var maskEls = $$(".fw-descent__open .fw-descent__col > *, .fw-descent__num, .fw-descent__name, .fw-descent__text > *", root);
    function lineBoxes(cr) {
      var out = [];
      maskEls.forEach(function (el) {
        var b = el.getBoundingClientRect();
        if (b.bottom < cr.top - 80 || b.top > cr.bottom + 80) return;
        var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          var node = w.currentNode;
          if (!node.textContent.trim() || node.parentElement.closest(".fw-visually-hidden, .fw-tip")) continue;
          var rg = document.createRange(); rg.selectNodeContents(node);
          var rs = rg.getClientRects();
          for (var k = 0; k < rs.length; k++) {
            var r = rs[k];
            if (r.width < 4 || r.height < 4) continue;
            var merged = false;
            for (var j = 0; j < out.length && !merged; j++) {
              var o = out[j], ov = Math.min(o.b, r.bottom) - Math.max(o.t, r.top);
              if (ov > 0.5 * Math.min(o.b - o.t, r.height) && r.left - o.r < 40 && o.l - r.right < 40) {
                o.l = Math.min(o.l, r.left); o.r = Math.max(o.r, r.right); o.t = Math.min(o.t, r.top); o.b = Math.max(o.b, r.bottom);
                merged = true;
              }
            }
            if (!merged) out.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
          }
        }
      });
      return out;
    }
    function updateMask() {
      var cr = canvas.getBoundingClientRect(), pr = renderer.getPixelRatio(), n = 0, PAD = 8;
      var boxes = lineBoxes(cr);
      for (var i = 0; i < boxes.length && n < MAXR; i++) {
        var r = boxes[i];
        rectList[n++].set((r.l - cr.left - PAD) * pr, (cr.bottom - r.b - PAD) * pr, (r.r - cr.left + PAD) * pr, (cr.bottom - r.t + PAD) * pr);
      }
      mask.uNR.value = n;
    }
    function lerp(arr, d) {
      var i = Math.max(0, Math.min(arr.length - 2, Math.floor(d))), f = Math.max(0, Math.min(1, d - i));
      return arr[i] + (arr[i + 1] - arr[i]) * f;
    }
    var ROOM = [1.3, 1.15, 1, 0.8, 0.55, 0.3];
    var GROUND_LUMA = [0.12, 0.12, 0.11, 0.07, 0.06, 0.05];
    function scaled(arr, d) { return lerp(arr, d <= 1 ? d : 1 + (d - 1) * 4 / Math.max(1, N - 1)); }
    var C_OPEN = 4.5, C_TURN = 2.9;
    var depth = 0, goal = 0, spin = 0, drawn = { depth: -1, spin: 0 }, last = 0, lastDraw = 0, followRaf = 0, lastFollow = 0;
    function draw() {
      resize();
      var d = depth;
      var portrait = camera.aspect < 1 ? 1.35 : 1;
      var c = (d < 1 ? C_OPEN - (C_OPEN - C_TURN) * (d * (2 - d)) : C_TURN - 0.08 * (d - 1) * 4 / Math.max(1, N - 1)) * portrait;
      var h = c * R(d);
      camera.position.set(0, h, h * 0.1);
      camera.lookAt(0, 0, 0);
      camera.near = h * 0.02; camera.far = h * 4;
      var sx = size.w >= 1100 ? 0.22 : size.w >= 761 ? 0.14 : 0.1;
      if (d < 1 && size.w >= 1100) sx += 0.04 * (1 - d);
      camera.setViewOffset(size.w, size.h, -Math.round(sx * size.w), 0, size.w, size.h);
      camera.updateProjectionMatrix();
      group.rotation.y = d * 1.15 + spin;
      fade.value.set((c - K * 0.7) * R(d), (c - K * Q * Q * Q) * R(d));
      var lit = scaled(ROOM, d);
      key.intensity = KEY * lit;
      hemi.intensity = HEMI * lit;
      mat.emissiveIntensity = glowK * (0.82 + 0.18 * lit);   // light theme: the pearl band deepens a little with the room
      lipMat.uniforms.uDepth.value = d;
      lipMat.uniforms.uOpacity.value = 0.18 + 0.45 * lit;   // deepen: the line dims with the room
      mask.uCap.value = scaled(GROUND_LUMA, d);
      updateMask();
      renderer.render(sceneObj, camera);
      drawn.depth = d; drawn.spin = spin;
    }
    function tick(t) {
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      if (t - last > 200) dt = 0.016;    // back after a pause: no jump
      last = t;
      spin += dt * 0.025;                                  // the slow, quiet turn
      depth += (goal - depth) * (1 - Math.exp(-dt * 3.2)); // sink: the depth follows the scroll softly
      var moving = Math.abs(depth - drawn.depth) > 0.0005, turned = Math.abs(spin - drawn.spin) > 0.002;
      if ((moving && t - lastDraw > 21) || (turned && t - lastDraw > 80)) { draw(); lastDraw = t; }
    }
    onTheme(function () { dress(); draw(); });
    return {
      draw: draw,
      tick: tick,
      target: function (d) { goal = d; },
      still: function (k) { depth = goal = k; draw(); },
      follow: function () {
        if (followRaf) return;
        var wait = Math.max(0, 33 - (performance.now() - lastFollow));
        followRaf = setTimeout(function () { requestAnimationFrame(function () { followRaf = 0; lastFollow = performance.now(); draw(); }); }, wait);
      },
      resize: function () { if (resize() && !FW.motionOK()) draw(); }
    };
  }

  function drawSpiral(svg, N) {
    if (!svg || svg.childElementCount) return;
    var NS = "http://www.w3.org/2000/svg";
    var Q = 0.5, R0 = 128, S1 = N + 1.5, STEPS = Math.round(S1 * 240), A0 = -Math.PI * 0.6;
    function taper(s) { var x = Math.max(0, Math.min(1, s / 0.9)); return x * x * (3 - 2 * x); }
    function pt(s, u, share) {
      var r = R0 * Math.pow(Q, s), w = r * (1 - Q) * share * taper(s);
      var rr = r + w * (0.5 - u), th = s * Math.PI * 2 + A0;
      return (rr * Math.cos(th)).toFixed(2) + " " + (rr * Math.sin(th)).toFixed(2);
    }
    function edge(u, share, reverse) {
      var out = [];
      for (var i = 0; i <= STEPS; i++) out.push(pt(S1 * i / STEPS, u, share));
      if (reverse) out.reverse();
      return out;
    }
    function el(name, attrs, parent) {
      var e = document.createElementNS(NS, name);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(e);
      return e;
    }
    function ribbon(u0, u1, share, o) {
      el("path", { d: "M" + edge(u0, share, false).join("L") + "L" + edge(u1, share, true).join("L") + "Z", "data-fws-band": "", opacity: String(o) });
    }
    ribbon(0, 1, 0.62, 0.34);
    ribbon(0, 0.55, 0.62, 0.42);
    el("path", { d: "M" + edge(0, 0.62, false).join("L"), "data-fws-arm": "", "stroke-width": "0.9", opacity: "0.72" });
    var id = "fws-well-" + Math.random().toString(36).slice(2, 8);
    var defs = el("defs", {});
    var g = el("radialGradient", { id: id }, defs);
    [["0", ".92"], [".45", ".55"], ["1", "0"]].forEach(function (st) { el("stop", { offset: st[0], "stop-opacity": st[1] }, g); });
    el("circle", { cx: "0", cy: "0", r: "92", fill: "url(#" + id + ")" });
  }

  function roundRect(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function extrude(shape, depth, bevel) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 28 });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }
  function curve(pts) { return new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2] || 0); })); }
  function ribbonGeo(cv, segs, widthFn, upFn) {
    var pos = [], uv = [], idx = [], t = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();
    for (var i = 0; i <= segs; i++) {
      var u = i / segs, p = cv.getPointAt(u);
      cv.getTangentAt(u, t);
      up.copy(upFn(u));
      side.copy(up).addScaledVector(t, -up.dot(t)).normalize();
      var w = widthFn(u) / 2;
      pos.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
      uv.push(u, 0, u, 1);
      if (i < segs) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function mesh(geo, m, x, y, z) { var o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); return o; }
  var BUILD = {
    basics: function (Pm, Am, Dm, Rm) { // an open book: deep crimson covers, stepped leaves, a ribbon bookmark
      var g = new THREE.Group();
      function half(sign, w, th, lift, m, y0, depth) {
        var geo = new THREE.BoxGeometry(w, th, depth, 28, 1, 1), p = geo.attributes.position;
        for (var i = 0; i < p.count; i++) {
          var u = (p.getX(i) + w / 2) / w;
          p.setX(i, sign * u * w);
          p.setY(i, p.getY(i) + y0 + lift * Math.sin(Math.min(1, u * 1.25) * Math.PI / 2) - 0.05 * u);
        }
        geo.computeVertexNormals();
        return new THREE.Mesh(geo, m);
      }
      g.add(half(-1, 0.74, 0.03, 0.14, Rm, -0.03, 0.96), half(1, 0.74, 0.03, 0.14, Rm, -0.03, 0.96));
      for (var k = 0; k < 4; k++) {
        var w = 0.69 - k * 0.014, y0 = 0.005 + k * 0.03, d = 0.9 - k * 0.012, lift = 0.15 + k * 0.006;
        g.add(half(-1, w, 0.022, lift, Pm, y0, d), half(1, w, 0.022, lift, Pm, y0, d));
      }
      var spine = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.96, 20), Rm, 0, -0.03, 0); spine.rotation.x = Math.PI / 2; g.add(spine);
      var bm = ribbonGeo(curve([[0.03, 0.115, -0.47], [0.09, 0.16, -0.12], [0.13, 0.17, 0.3], [0.14, 0.1, 0.5], [0.15, -0.02, 0.53]]), 48,
        function () { return 0.06; }, function () { return new THREE.Vector3(1, 0, 0); });
      g.add(mesh(bm, Am));
      g.rotation.x = 1.0;
      return g;
    },
    variants: function (Pm, Am) { // a branching fork: one stem, two ways
      var g = new THREE.Group(), r = 0.07;
      g.add(mesh(new THREE.TubeGeometry(curve([[0, 0, 0], [0.01, 0.3, 0], [0, 0.58, 0]]), 24, r, 18), Pm));
      g.add(mesh(new THREE.TubeGeometry(curve([[0, 0.58, 0], [-0.14, 0.8, 0.02], [-0.42, 1.0, 0]]), 32, r, 18), Pm));
      g.add(mesh(new THREE.TubeGeometry(curve([[0, 0.58, 0], [0.16, 0.78, -0.02], [0.44, 0.96, 0]]), 32, r, 18), Pm));
      g.add(mesh(new THREE.SphereGeometry(0.1, 28, 18), Pm, 0, 0.58, 0));
      g.add(mesh(new THREE.SphereGeometry(0.14, 32, 20), Pm, 0, -0.02, 0));
      g.add(mesh(new THREE.SphereGeometry(0.14, 32, 20), Pm, -0.44, 1.02, 0));
      g.add(mesh(new THREE.SphereGeometry(0.14, 32, 20), Pm, 0.46, 0.98, 0));
      var collar = mesh(new THREE.TorusGeometry(0.088, 0.026, 14, 48), Am, 0, 0.44, 0); collar.rotation.x = Math.PI / 2; g.add(collar);
      return g;
    },
    kinks: function (Pm, Am) { // a ribbon tied in a knot: two loops, two tails that cross under the knot
      var g = new THREE.Group();
      var Yv = function () { return new THREE.Vector3(0, 1, 0.1); };
      function loop(sx) {
        return ribbonGeo(curve([[0, 0, 0.06], [sx * 0.26, 0.1, 0.2], [sx * 0.56, 0.2, 0.17], [sx * 0.7, 0.12, 0.0], [sx * 0.58, 0.02, -0.15], [sx * 0.28, -0.02, -0.13], [0, 0, -0.05]]), 90,
          function (u) { return 0.3 + 0.12 * Math.sin(u * Math.PI); }, Yv);
      }
      function tail(sx, z) {
        return ribbonGeo(curve([[-sx * 0.1, 0.04, z], [0, -0.08, z + 0.03], [sx * 0.14, -0.24, z + 0.02], [sx * 0.24, -0.4, z - 0.02], [sx * 0.38, -0.52, z - 0.05]]), 48,
          function (u) { return 0.19 - 0.04 * u; }, function () { return new THREE.Vector3(1, 0.45, 0); });
      }
      g.add(mesh(loop(-1), Pm), mesh(loop(1), Pm), mesh(tail(-1, 0.02), Pm), mesh(tail(1, 0.07), Pm));
      var knot = mesh(new THREE.SphereGeometry(0.15, 32, 20), Am, 0, -0.01, 0.06); knot.scale.set(0.95, 1.2, 0.85); g.add(knot);
      return g;
    },
    dom: function (Pm, Am, Dm, Rm) { // a crown with five points
      var g = new THREE.Group();
      var geo = new THREE.CylinderGeometry(0.5, 0.44, 1, 120, 10, true), p = geo.attributes.position, v = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        var th = Math.atan2(v.z, v.x), k = v.y + 0.5;
        p.setY(i, k * (0.36 + 0.36 * Math.pow(Math.abs(Math.cos(th * 2.5)), 4)));
      }
      geo.computeVertexNormals();
      g.add(mesh(geo, Pm));
      var band = mesh(new THREE.TorusGeometry(0.455, 0.04, 14, 120), Rm, 0, 0.03, 0); band.rotation.x = Math.PI / 2; g.add(band);
      var band2 = mesh(new THREE.TorusGeometry(0.48, 0.02, 12, 120), Am, 0, 0.2, 0); band2.rotation.x = Math.PI / 2; g.add(band2);
      for (var k2 = 0; k2 < 5; k2++) {
        var a = (k2 / 5) * Math.PI * 2;
        g.add(mesh(new THREE.SphereGeometry(0.06, 20, 14), Pm, Math.cos(a) * 0.5, 0.75, Math.sin(a) * 0.5));
      }
      g.rotation.x = 0.16;
      return g;
    },
    subs: function (Pm, Am, Dm, Rm) { // a wallet: body with a stitched seam, a deep crimson flap, a round clasp
      var g = new THREE.Group();
      g.add(mesh(extrude(roundRect(1.0, 0.68, 0.1), 0.14, 0.035), Pm));
      var f = new THREE.Shape();
      f.moveTo(-0.5, 0.34); f.lineTo(0.5, 0.34); f.lineTo(0.5, 0.06);
      f.quadraticCurveTo(0.2, -0.02, 0.04, -0.16); f.quadraticCurveTo(0, -0.19, -0.04, -0.16);
      f.quadraticCurveTo(-0.2, -0.02, -0.5, 0.06); f.closePath();
      g.add(mesh(extrude(f, 0.03, 0.015), Rm, 0, 0, 0.11));
      var seam = curve([[-0.45, 0.08, 0.108], [-0.45, -0.2, 0.108], [-0.41, -0.28, 0.108], [0, -0.285, 0.108], [0.41, -0.28, 0.108], [0.45, -0.2, 0.108], [0.45, 0.08, 0.108]]);
      g.add(mesh(new THREE.TubeGeometry(seam, 120, 0.009, 8), Rm));
      var clasp = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 36), Am, 0, -0.12, 0.155); clasp.rotation.x = Math.PI / 2; g.add(clasp);
      g.add(mesh(new THREE.TorusGeometry(0.09, 0.014, 10, 48), Rm, 0, -0.12, 0.176));
      g.rotation.x = -0.08;
      return g;
    },
    safety: function (Pm, Am, Dm, Rm) { // a lifebuoy: eight bands in two crimson tones, a thin rope around it
      var g = new THREE.Group();
      for (var k = 0; k < 8; k++) {
        var t = mesh(new THREE.TorusGeometry(0.5, 0.17, 24, 24, Math.PI / 4), k % 2 ? Rm : Pm);
        t.rotation.z = k * Math.PI / 4 + Math.PI / 8;
        g.add(t);
      }
      g.add(mesh(new THREE.TorusGeometry(0.675, 0.016, 10, 160), Am));
      return g;
    },
    scams: function (Pm, Am) { // a fishing hook: a thick shank, a wide bowl, a real barb, a ringed eye
      var g = new THREE.Group(), r = 0.09;
      var c = curve([[0.2, 1.02], [0.2, 0.6], [0.2, 0.32], [0.15, 0.08], [-0.04, -0.07], [-0.27, -0.03], [-0.41, 0.15], [-0.43, 0.36]]);
      g.add(mesh(new THREE.TubeGeometry(c, 140, r, 22), Pm));
      g.add(mesh(new THREE.SphereGeometry(r, 22, 14), Pm, 0.2, 1.02, 0));
      g.add(mesh(new THREE.ConeGeometry(r, 0.28, 22), Pm, -0.43, 0.5, 0));
      var barb = mesh(new THREE.ConeGeometry(0.075, 0.26, 18), Pm, -0.33, 0.39, 0); barb.rotation.z = Math.PI + 0.62; g.add(barb);
      g.add(mesh(new THREE.TorusGeometry(0.13, 0.052, 18, 56), Am, 0.2, 1.2, 0));
      return g;
    },
    code: function (Pm, Am, Dm) { // a padlock: crystal body and shackle, a dark keyhole in a trim ring
      var g = new THREE.Group();
      g.add(mesh(extrude(roundRect(0.8, 0.62, 0.11), 0.24, 0.04), Pm, 0, 0, 0));
      var arch = curve([[-0.24, 0.24], [-0.24, 0.52], [-0.17, 0.7], [0, 0.76], [0.17, 0.7], [0.24, 0.52], [0.24, 0.36]]);
      g.add(mesh(new THREE.TubeGeometry(arch, 80, 0.068, 18), Pm));
      var hole = new THREE.Shape();
      hole.absarc(0, 0.05, 0.085, -Math.PI * 0.3, Math.PI * 1.3, false);
      hole.lineTo(-0.05, -0.17); hole.lineTo(0.05, -0.17); hole.closePath();
      g.add(mesh(extrude(hole, 0.02, 0.006), Dm, 0, 0, 0.172));
      g.add(mesh(extrude(hole, 0.02, 0.006), Dm, 0, 0, -0.172));
      g.add(mesh(new THREE.TorusGeometry(0.125, 0.014, 10, 64), Am, 0, 0.05, 0.164));
      return g;
    },
    dictionary: function (Pm, Am, Dm, Rm) { // a letter tile: the "A" inlaid in deep crimson, a short trim rule under it
      var g = new THREE.Group();
      g.add(mesh(extrude(roundRect(0.9, 0.9, 0.13), 0.16, 0.04), Pm));
      var a = new THREE.Shape();
      a.moveTo(-0.3, -0.3); a.lineTo(-0.17, -0.3); a.lineTo(-0.125, -0.17); a.lineTo(0.125, -0.17); a.lineTo(0.17, -0.3);
      a.lineTo(0.3, -0.3); a.lineTo(0.065, 0.32); a.lineTo(-0.065, 0.32); a.closePath();
      var h = new THREE.Path(); h.moveTo(-0.08, -0.07); h.lineTo(0.08, -0.07); h.lineTo(0, 0.15); h.closePath();
      a.holes.push(h);
      g.add(mesh(extrude(a, 0.03, 0.008), Rm, 0, 0.04, 0.104));
      g.add(mesh(extrude(a, 0.03, 0.008), Rm, 0, 0.04, -0.104));
      g.add(mesh(extrude(roundRect(0.26, 0.03, 0.015), 0.012, 0.004), Am, 0, -0.33, 0.124));
      g.rotation.x = -0.1;
      return g;
    },
    sources: function (Pm, Am, Dm, Rm) { // a document with a folded corner: deep crimson lines, the heading line in the trim
      var g = new THREE.Group();
      var s = new THREE.Shape();
      s.moveTo(-0.36, -0.48); s.lineTo(0.36, -0.48); s.lineTo(0.36, 0.28); s.lineTo(0.16, 0.48); s.lineTo(-0.36, 0.48); s.closePath();
      g.add(mesh(extrude(s, 0.05, 0.014), Pm));
      var f = new THREE.Shape(); f.moveTo(0.16, 0.48); f.lineTo(0.16, 0.28); f.lineTo(0.36, 0.28); f.closePath();
      var fold = mesh(extrude(f, 0.02, 0.008), Pm, 0, 0, 0.045); fold.rotation.set(0.12, -0.12, 0); g.add(fold);
      [[0.1, 0.4], [-0.06, 0.56], [-0.2, 0.56], [-0.34, 0.36]].forEach(function (l, i) {
        g.add(mesh(extrude(roundRect(l[1], i ? 0.04 : 0.055, 0.02), 0.02, 0.006), i ? Rm : Am, -0.36 + 0.1 + l[1] / 2, l[0], 0.04));
      });
      g.rotation.x = -0.12;
      return g;
    }
  };
  var SWING = 0.62;
  var STILL = { basics: 0.32, variants: -0.5, kinks: -0.2, dom: -0.4, subs: -0.5, safety: -0.45, scams: 0.28, code: -0.5, dictionary: -0.45, sources: -0.5 };
  var ICON = {
    basics: '<path d="M3.4 5.6c2.7-.7 5.5-.3 8.6 1.6v12.3c-3-1.9-5.9-2.2-8.6-1.6z"/><path d="M20.6 5.6c-2.7-.7-5.5-.3-8.6 1.6v12.3c3-1.9 5.9-2.2 8.6-1.6z"/>',
    variants: '<path d="M12.1 20.4c.3-3.2.1-6.2-.1-9.2"/><path d="M12 11.2C7.9 10 6 8 5.3 5.2"/><path d="M12 11.2c4.3-1.4 6.2-3.4 6.8-6.1"/><circle cx="5" cy="4" r="1.4"/><circle cx="19" cy="4" r="1.4"/><circle cx="12.1" cy="20.6" r="1.4"/>',
    kinks: '<path d="M3.6 17c3.5-.5 6.8-3.2 8.2-6.8 1-2.7-.4-5.5-2.9-5.3-2.7.2-3.1 3.9-.7 6.6 2.8 3.2 7.6 5.5 12.1 5.6"/><path d="M20.3 17.1c-.8 1.3-2 2.1-3.3 2.5"/>',
    dom: '<path d="M4.1 17.4 3.3 7.9l4.9 3.9 3.8-6.2 3.9 6.2 4.8-3.9-.8 9.5c-5.2-.9-10.4-.9-15.8 0z"/><path d="M4.4 20.4c5-.7 10.1-.7 15.2 0"/>',
    subs: '<path d="M4.2 10.2c0-3 3.5-5.1 7.8-5.1s7.8 2.1 7.8 5.1-3.5 5.2-7.8 5.2-7.8-2.2-7.8-5.2z"/><path d="M12 15.4v1.4"/><circle cx="12" cy="18.9" r="2.1"/>',
    safety: '<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="3.5"/><path d="M6.2 6.1l3.3 3.4"/><path d="M17.8 6.2l-3.3 3.3"/><path d="M6.1 17.8l3.4-3.3"/><path d="M17.9 17.8l-3.4-3.3"/>',
    scams: '<circle cx="15" cy="3.9" r="1.6"/><path d="M15 5.5v8c0 3.4-2.4 5.7-5.4 5.7-2.8 0-4.7-2.1-4.7-4.7v-2.3"/><path d="M4.9 12.2l3 2.7"/>',
    code: '<path d="M8.3 7 3.6 12l4.7 5"/><path d="M15.7 7l4.7 5-4.7 5"/><path d="M13.5 4.5 10.6 19.4"/>',
    dictionary: '<path d="M3.4 18.6 7.3 6.1l3.9 12.5"/><path d="M4.9 14.1h4.8"/><path d="M13.4 6.5h6.5l-6.7 11.8h7.1"/>',
    sources: '<path d="M6 3.6h8.3l3.9 3.9v12.9H6z"/><path d="M14.1 3.8v3.9h4"/><path d="M8.8 12.1h6.6"/><path d="M8.8 15.4h4.4"/>'
  };
  var warnedEmblem = false;
  function prepareEmblem(el) {
    var key = el.getAttribute("data-fw-emblem");
    if (!BUILD[key]) {
      if (!warnedEmblem && window.console) { warnedEmblem = true; console.warn("fw-emblem: unknown category \"" + key + "\"; use one of " + Object.keys(BUILD).join(", ")); }
      if (!$(".fw-emblem__fb", el)) {
        el.insertAdjacentHTML("beforeend", '<span class="fw-emblem__fb" aria-hidden="true"><svg class="fw-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICON.sources + "</svg></span>");
      }
      el.setAttribute("data-fws-nogl", "");
      return null;
    }
    if (!el.hasAttribute("data-cat") && !el.closest("[data-cat]")) el.setAttribute("data-cat", key);
    if (!$(".fw-emblem__cv", el)) {
      el.insertAdjacentHTML("beforeend", '<canvas class="fw-emblem__cv" aria-hidden="true"></canvas><span class="fw-emblem__fb" aria-hidden="true">' +
        '<svg class="fw-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICON[key] + "</svg></span>");
    }
    return key;
  }

  function createStudio(noteHosts, emblemEls) {
    var cv = document.createElement("canvas");
    var renderer = makeRenderer(cv, "studio", true);
    if (!renderer) return null;
    renderer.setPixelRatio(1);
    renderer.setScissorTest(true);
    var scope = noteHosts[0] || emblemEls[0];
    var DPR = Math.min(window.devicePixelRatio || 1, 2);

    var NOTE_LIGHT = { amp: 0.32, curl: 0.09, key: 1.15, sky: 0.95, ground: 0.8, rim: 0.42, spec: 0.03 };
    var NU = lightUniforms(NOTE_LIGHT, scope);
    var noteScene = new THREE.Scene(), noteCam = new THREE.PerspectiveCamera(30, 1.4, 0.1, 50);
    var notePivot = new THREE.Group(); noteScene.add(notePivot);
    var noteMeshes = {};
    function noteMesh(inkName, res) {
      var k = inkName + res;
      if (!noteMeshes[k]) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(NOTE_W, NOTE_H, NOTE_D, 72, 36, 1), noteMaterials(NU, ink(inkName, scope), renderer, res, false, scope));
        m.rotation.order = "YXZ"; m.visible = false;
        notePivot.add(m); noteMeshes[k] = m;
      }
      return noteMeshes[k];
    }

    var EM_LIGHT = { key: 0.8, sky: 0.42, ground: 0.5, rim: 0.3, spec: 0.05, edge: 0.34, glaze: 0.42 };
    var EU = lightUniforms(EM_LIGHT, scope);
    var emScene = new THREE.Scene(), emCam = new THREE.PerspectiveCamera(25, 1, 0.1, 50);
    emCam.position.set(0, 1.2, 4.9); emCam.lookAt(0, 0.52, 0);
    var plinthMat = surface(EU, { solid: tc("--fws-plinth", scope), spec: 0, rim: 0.03, edge: 0, glaze: 0.12, double: true });
    var prof = [[0, 0], [0.8, 0], [0.85, 0.015], [0.87, 0.05], [0.87, 0.12], [0.85, 0.155], [0.8, 0.168], [0, 0.168]].map(function (q) { return new THREE.Vector2(q[0], q[1]); });
    var plinth = mesh(new THREE.LatheGeometry(prof, 96), plinthMat, 0, -0.168, 0);
    var ringMat = surface(EU, { solid: tc("--fws-lip", scope), rim: 0.2, edge: 0, glaze: 0 });
    var ring = mesh(new THREE.TorusGeometry(0.83, 0.009, 8, 160), ringMat); ring.rotation.x = Math.PI / 2;
    var sc = document.createElement("canvas"); sc.width = sc.height = 128;
    var sg = sc.getContext("2d"), shadowTex = new THREE.CanvasTexture(sc);
    function contact() {
      var grd = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, alpha("--fws-contact", 75, scope)); grd.addColorStop(0.5, alpha("--fws-contact", 35, scope)); grd.addColorStop(1, alpha("--fws-contact", 0, scope));
      sg.clearRect(0, 0, 128, 128); sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
      shadowTex.needsUpdate = true;
    }
    contact();
    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.66, 48), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003;
    emScene.add(plinth, ring, shadow);
    var Pm = surface(EU, { solid: tc("--fws-porcelain", scope), ao: 0.34, double: true });
    var Rm = surface(EU, { solid: tc("--fws-porcelain-deep", scope), ao: 0.3, double: true });
    var Dm = surface(EU, { solid: tc("--fws-shade", scope), ao: 0, spec: 0, rim: 0.1, edge: 0, glaze: 0 });
    var Am = surface(EU, { solid: tc("--fws-trim", scope), ao: 0.3, double: true });
    var emblems = {};
    function emblem(key) {
      if (emblems[key]) return emblems[key];
      var obj = BUILD[key](Pm, Am, Dm, Rm);
      var holder = new THREE.Group(); holder.add(obj);
      var pivot = new THREE.Group(); pivot.add(holder);
      holder.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(holder), size = new THREE.Vector3(), c = new THREE.Vector3();
      box.getSize(size);
      var wide = Math.max(size.x, size.z * 0.8);
      holder.scale.setScalar(Math.min(1.42 / size.y, 1.3 / wide, Math.sqrt(1.06 / (wide * size.y))));
      holder.updateMatrixWorld(true);
      box.setFromObject(holder); box.getCenter(c);
      holder.position.set(-c.x, -box.min.y + 0.01, -c.z);
      pivot.visible = false;
      emScene.add(pivot);
      emblems[key] = { pivot: pivot };
      return emblems[key];
    }
    function dress() {
      relight(NU, NOTE_LIGHT, scope); relight(EU, EM_LIGHT, scope);
      plinthMat.uniforms.uSolid.value.copy(tc("--fws-plinth", scope));
      ringMat.uniforms.uSolid.value.copy(tc("--fws-lip", scope));
      Pm.uniforms.uSolid.value.copy(tc("--fws-porcelain", scope));
      Rm.uniforms.uSolid.value.copy(tc("--fws-porcelain-deep", scope));
      Dm.uniforms.uSolid.value.copy(tc("--fws-shade", scope));
      Am.uniforms.uSolid.value.copy(tc("--fws-trim", scope));
      contact();
      for (var k in noteMeshes) {
        var m = noteMeshes[k];
        notePivot.remove(m);
        m.geometry.dispose();
        m.material.forEach(function (mm, i) { if (i === 0 || i > 3) { if (mm.uniforms.map.value) mm.uniforms.map.value.dispose(); mm.dispose(); } });
      }
      noteMeshes = {};
    }

    var slots = [];
    noteHosts.forEach(function (host) {
      var c = $("[data-fw-note]", host);
      if (!c) return;
      slots.push({ note: true, host: host, el: c, cv: c, ctx: c.getContext("2d"), ink: host.getAttribute("data-fw-ink") || "rose",
        pose: { yaw: 0, lift: 0, t: Math.random() * 4, amp: 0.32 }, turn: null, w: 0, h: 0 });
    });
    emblemEls.forEach(function (el) {
      var key = el.getAttribute("data-fw-emblem"), c = $(".fw-emblem__cv", el);
      var host = el.closest("[data-fw-emblem-host]") || el;
      var s = { note: false, el: el, cv: c, ctx: c.getContext("2d"), key: key, host: host, phase: Math.random() * 6.28, speed: 0.3, target: 0.3, lift: 0, focus: false, w: 0, h: 0, frame: 0 };
      s.angle = STILL[key] + SWING * Math.sin(s.phase);
      var on = function () { s.focus = true; s.target = 1.25; };
      var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
      var off = function () { if (host.matches(":hover") || host.contains(document.activeElement)) return; s.focus = false; s.target = 0.3; };
      host.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch" && fine.matches) on(); });
      host.addEventListener("pointerleave", function () { setTimeout(off, 0); });
      host.addEventListener("focusin", on);
      host.addEventListener("focusout", function () { setTimeout(off, 0); });
      slots.push(s);
    });

    var bufW = 1, bufH = 1;
    function measure() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      var mw = 1, mh = 1;
      slots.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        var w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR));
        if (w !== s.w || h !== s.h) { s.w = s.cv.width = w; s.h = s.cv.height = h; }
        mw = Math.max(mw, w); mh = Math.max(mh, h);
      });
      if (mw !== bufW || mh !== bufH) { bufW = mw; bufH = mh; renderer.setSize(bufW, bufH, false); }
    }
    function paint(s) {
      var w = s.w, h = s.h;
      if (w < 2 || h < 2) return;
      renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h);
      var aspect = w / h;
      if (s.note) {
        var m = noteMesh(s.ink, w >= 900 ? 2048 : 1024), p = s.pose;
        for (var k in noteMeshes) noteMeshes[k].visible = false;
        m.visible = true;
        m.rotation.y = p.yaw + 0.36 * Math.sin(p.t * 0.32);
        m.rotation.x = -0.16 + 0.05 * Math.sin(p.t * 0.27);
        m.rotation.z = 0.04 * Math.sin(p.t * 0.41);
        notePivot.position.y = 0.03 * Math.sin(p.t * 0.5) + p.lift;
        NU.uTime.value = p.t; NU.uAmp.value = p.amp;
        noteCam.aspect = aspect;
        var th = Math.tan(THREE.MathUtils.degToRad(15));
        var d = Math.max((NOTE_W / 2) / (0.8 * th * aspect), (NOTE_H / 2) / (0.62 * th));
        noteCam.position.set(0, d * 0.07, d); noteCam.lookAt(0, 0, 0);
        noteCam.updateProjectionMatrix();
        renderer.render(noteScene, noteCam);
      } else {
        var e = emblem(s.key);
        for (var k2 in emblems) emblems[k2].pivot.visible = false;
        e.pivot.visible = true;
        e.pivot.rotation.y = s.angle; e.pivot.position.y = s.lift;
        var half = Math.tan(THREE.MathUtils.degToRad(12.5));
        emCam.fov = aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(half / aspect)) : 25;
        emCam.aspect = aspect; emCam.updateProjectionMatrix();
        renderer.render(emScene, emCam);
      }
      s.ctx.clearRect(0, 0, w, h);
      s.ctx.drawImage(cv, 0, bufH - h, w, h, 0, 0, w, h);
    }
    function paintAll() { measure(); slots.forEach(paint); }

    slots.forEach(function (s) {
      FW.loop(s.el, function (t, dt) {
        dt = Math.min(0.05, dt);
        if (s.note) { s.pose.t += dt; paint(s); return; }
        s.frame++;
        s.speed += (s.target - s.speed) * Math.min(1, dt * 3);
        s.lift += ((s.focus ? 0.07 : 0) - s.lift) * Math.min(1, dt * 4);
        s.phase += s.speed * dt;
        s.angle = STILL[s.key] + SWING * Math.sin(s.phase);
        if (s.focus || Math.abs(s.speed - 0.3) > 0.02 || s.lift > 0.002 || s.frame % 2 === 0) paint(s);
      }, { fps: 46 });
    });

    function setFace(host, face, onShown) {
      var s = slots.filter(function (x) { return x.note && x.host === host; })[0];
      if (!s) { if (onShown) onShown(); return; }
      var p = s.pose;
      if (s.turn) { s.turn.progress(1); s.turn = null; }
      var target = face === "back" ? Math.PI : 0;
      if (Math.abs(p.yaw - target) < 1e-4) { if (onShown) onShown(); return; }
      if (FW.motionOK() && hasGsap) {
        var dur = seconds("--fw-dur-explain");
        var tl = gsap.timeline({ onComplete: function () { p.yaw = target; s.turn = null; } });
        tl.to(p, { yaw: face === "back" ? Math.PI : Math.PI * 2, duration: dur, ease: FW.ease.inOut }, 0);
        tl.to(p, { lift: 0.07, amp: 0.62, duration: dur * 0.48, ease: "sine.out" }, 0);
        tl.to(p, { lift: 0, amp: 0.32, duration: dur * 0.6, ease: "sine.inOut" }, dur * 0.43);
        if (onShown) tl.call(onShown, null, dur * 0.5);
        s.turn = track(tl);
      } else {
        p.yaw = target; p.lift = 0; p.amp = 0.32;
        measure(); paint(s);
        if (onShown) onShown();
      }
    }
    function settle() { // Pause: everything stops where it is, a pending turn lands
      slots.forEach(function (s) {
        if (s.note) { if (s.turn) { s.turn.progress(1); s.turn = null; } s.pose.lift = 0; }
        else { s.speed = s.target; s.lift = 0; }
      });
      paintAll();
    }
    function stills() { // reduced motion: one telling frame each
      slots.forEach(function (s) {
        if (s.note) { s.pose.t = 2.2; s.pose.amp = 0.32; s.pose.lift = 0; }
        else { s.angle = STILL[s.key]; s.phase = 0; s.lift = 0; }
      });
      paintAll();
    }
    try { renderer.compile(noteScene, noteCam); } catch (e) { /* pre-warm only */ }
    measure();
    if (reduced()) stills(); else paintAll();
    FW.onMotion(function (ok) { if (!ok) { if (reduced()) stills(); else settle(); } });
    onTheme(function () { dress(); paintAll(); });
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () { measure(); if (!FW.motionOK()) paintAll(); });
      slots.forEach(function (s) { ro.observe(s.el); });
    }
    return { setFace: setFace };
  }

  function initNotecard(host, studio) {
    var btns = $$("[data-fw-face]", host);
    var label = $("[data-fw-face-label]", host);
    var stage = $("[data-fw-note-stage]", host);
    var flip = $("[data-fw-note-flip]", host);
    var name = host.getAttribute("data-fw-note-name") || "The tribute note";
    var live = $("[data-fw-note-live]", host);
    var current = "front", timer = 0;
    function faceName(f) { return f === "back" ? "Back" : "Front"; }
    function show(f) {
      if (label) label.textContent = faceName(f);
      if (live) live.textContent = name + ", " + faceName(f) + ".";
    }
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var face = btn.getAttribute("data-fw-face");
        if (face === current) return;
        current = face;
        btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        if (stage) stage.setAttribute("aria-label", name + ", " + faceName(face));
        if (flip) { if (face === "back") flip.setAttribute("data-fws-back", ""); else flip.removeAttribute("data-fws-back"); }
        clearTimeout(timer);
        if (studio) studio.setFace(host, face, function () { show(current); });
        else if (FW.motionOK()) timer = setTimeout(function () { show(current); }, seconds("--fw-dur-explain") * 500);
        else show(face);
      });
    });
  }
  function noteFallback(host) {
    host.setAttribute("data-fws-nogl", "");
    var f = $("[data-fw-note-front]", host), b = $("[data-fw-note-back]", host);
    var big = !host.classList.contains("fw-notecard--compact");
    function paintFaces(force) {
      var P = ink(host.getAttribute("data-fw-ink") || "rose", host);
      if (f && (force || !f.getAttribute("src"))) f.src = drawFront(P, big ? 1280 : 640, host).toDataURL("image/png");
      if (b && (force || !b.getAttribute("src"))) b.src = drawBack(P, big ? 1280 : 640, host).toDataURL("image/png");
    }
    paintFaces(false);
    onTheme(function () { paintFaces(true); });
  }

  function start() {
    $$("[data-fw-hero]").forEach(initHero);
    $$("[data-fw-descent]").forEach(initDescent);
    var noteHosts = $$("[data-fw-notecard]");
    var emblemEls = $$("[data-fw-emblem]").filter(prepareEmblem);
    var studio = (noteHosts.length || emblemEls.length) && hasThree ? createStudio(noteHosts, emblemEls) : null;
    if (!studio) {
      noteHosts.forEach(noteFallback);
      emblemEls.forEach(function (el) { el.setAttribute("data-fws-nogl", ""); });
    }
    noteHosts.forEach(function (h) { initNotecard(h, studio); });
  }
  if (page.getAttribute("data-module") === "scenes" && window.ScrollTrigger && window.ScrollTrigger.disable) window.ScrollTrigger.disable();
  fontsReady().then(start);
})();
