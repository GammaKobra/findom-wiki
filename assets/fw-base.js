/* Findom Wiki kit: the base script every page loads before its module script. One classic script, no modules,
   no network, nothing stored. It exposes window.FW:
     FW.root                the .fw-page element
     FW.motionOK()          false under Pause motion or prefers-reduced-motion
     FW.onMotion(cb)        cb(ok) runs whenever Pause or the reduced-motion setting changes
     FW.token(name)         the computed value of a token, for canvas and 3D materials ("--fw-accent")
     FW.ease                GSAP ease names for the three token curves: out, inOut, sink
     FW.whenActive(el, cb)  cb(true|false) as el enters or leaves the screen or the tab hides or shows
     FW.loop(el, frame, o)  a requestAnimationFrame loop that only runs while el is on screen, the tab is visible
                            and motion is allowed; o.fps caps the rate; returns { stop(), once() }
     FW.icon(name)          an inline SVG from the kit's icon set (one stroke weight)
     FW.say(el, text, tone) writes feedback with an icon and words into an aria-live element (right, wrong, flag, none)
   It also wires the header: Pause motion, the search form (nothing is sent), badge and term tips (hover, focus,
   Escape, kept on screen, later tips open at once). */
(function () {
  "use strict";
  var root = document.querySelector(".fw-page");
  if (!root) return;
  var docEl = document.documentElement;

  /* ------------------------------------------------------------ tokens and eases */
  var cs = getComputedStyle(docEl);
  function token(name) { return cs.getPropertyValue(name).trim(); }
  var ease = { out: "power3.out", inOut: "power2.inOut", sink: "power2.inOut" };
  if (window.gsap && window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    [["out", "--fw-ease-out"], ["inOut", "--fw-ease-in-out"], ["sink", "--fw-ease-sink"]].forEach(function (p) {
      var m = token(p[1]).match(/cubic-bezier\(([^)]+)\)/);
      if (m) { CustomEase.create("fw-" + p[0], m[1].replace(/\s/g, "")); ease[p[0]] = "fw-" + p[0]; }
    });
  }

  /* ------------------------------------------------------------ motion policy */
  var reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var state = { paused: false, reduced: reducedMQ.matches };
  var motionListeners = [];
  function motionOK() { return !state.paused && !state.reduced; }
  function emitMotion() {
    var ok = motionOK();
    // each module decides what Pause means for its own tweens (finish them, or freeze a scrubbed scene)
    motionListeners.forEach(function (cb) { try { cb(ok); } catch (e) { /* a listener failed; others still run */ } });
  }
  function onMotion(cb) { motionListeners.push(cb); }
  if (reducedMQ.addEventListener) reducedMQ.addEventListener("change", function () { state.reduced = reducedMQ.matches; emitMotion(); });
  root.setAttribute("data-motion", "on");
  var motionBtn = root.querySelector("[data-fw-motion]");
  var motionLabel = motionBtn && motionBtn.querySelector(".fw-motion__label");
  if (motionBtn) motionBtn.addEventListener("click", function () {
    state.paused = !state.paused;
    root.setAttribute("data-motion", state.paused ? "paused" : "on");
    if (motionLabel) motionLabel.textContent = state.paused ? "Play motion" : "Pause motion";
    emitMotion();
  });

  /* ------------------------------------------------------------ on screen, tab visible */
  function whenActive(el, cb) {
    var onScreen = false, last = null;
    function check() {
      var active = onScreen && document.visibilityState === "visible";
      if (active !== last) { last = active; cb(active); }
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { onScreen = entries[entries.length - 1].isIntersecting; check(); }, { rootMargin: "80px 0px" }).observe(el);
    } else { onScreen = true; }
    document.addEventListener("visibilitychange", check);
    check();
    return function () { return last; };
  }

  /* a loop for a scene: it draws only while useful, and draws one still frame when motion is not allowed */
  function loop(el, frame, o) {
    o = o || {};
    var minDt = o.fps ? 1000 / o.fps : 0, raf = 0, prev = 0, stopped = false, active = false;
    function tick(t) {
      raf = 0;
      if (stopped || !active || !motionOK()) return;
      if (!prev || t - prev >= minDt) { frame(t, prev ? (t - prev) / 1000 : 0); prev = t; }
      raf = requestAnimationFrame(tick);
    }
    function sync() {
      if (active && motionOK()) { if (!raf) { prev = 0; raf = requestAnimationFrame(tick); } }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    whenActive(el, function (a) { active = a; sync(); });
    onMotion(sync);
    return {
      stop: function () { stopped = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
      once: function () { frame(performance.now(), 0); }   // one still frame (Pause, reduced motion, a jump)
    };
  }

  /* ------------------------------------------------------------ icons: one stroke weight, from version C */
  var PATHS = {
    check: '<path d="M4.6 12.6l4.6 4.6 10.2-10.4"/>',
    flag: '<path d="M5.6 21V3.7"/><path d="M5.6 4.4c4.5-2 7.6 2.2 12.8.3v8.7c-5.2 1.9-8.3-2.3-12.8-.3"/>',
    dash: '<path d="M7.4 12h9.2"/>',
    warn: '<path d="M12 4.2 3.4 19.2h17.2z"/><path d="M12 10.2v4.2"/><path d="M12 16.9v.1"/>',
    send: '<path d="M4 11.6 19.8 4.4l-5.4 15.4-3-6.6z"/><path d="M11.4 13.2 19.8 4.4"/>',
    lock: '<path d="M6.4 10.6h11.2v9.6H6.4z"/><path d="M8.8 10.4V8a3.2 3.2 0 0 1 6.4 0v2.4"/>',
    stop: '<circle cx="12" cy="12" r="8.3"/><path d="M8.9 8.9h6.2v6.2H8.9z"/>',
    clock: '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.4V12l3.2 2.1"/>',
    reset: '<path d="M5.2 12a6.8 6.8 0 1 0 2-4.8"/><path d="M4.6 3.9v4.3h4.3"/>',
    arrow: '<path d="M4.6 12h14.4"/><path d="M13.4 6.4 19 12l-5.6 5.6"/>',
    external: '<path d="M13.6 4.4h6v6"/><path d="M19.4 4.6 11 13"/><path d="M17.6 14.2v5.4H4.4V6.4h5.4"/>',
    phone: '<path d="M6.6 3.8l2.7.6 1.3 3.6-1.9 1.3c.9 2.2 2.6 3.9 4.8 4.8l1.3-1.9 3.6 1.3.6 2.7c-.2 1.5-1.5 2.4-3 2.2C9.3 17.6 6.4 14.7 5.6 8.1c-.2-1.5.6-2.8 1-4.3z"/>',
    pause: '<path d="M9 5.6v12.8"/><path d="M15 5.6v12.8"/>'
  };
  function icon(name) {
    return '<svg class="fw-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || "") + "</svg>";
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  /* feedback: an icon and the words, so nothing relies on colour */
  function say(el, text, tone) {
    if (!el) return;
    var name = { right: "check", wrong: "warn", flag: "flag", none: "dash" }[tone] || "dash";
    el.setAttribute("data-tone", tone || "none");
    el.innerHTML = icon(name) + "<span>" + esc(text) + "</span>";
  }

  /* ------------------------------------------------------------ search: nothing is sent */
  var searchForm = root.querySelector("[data-fw-search]");
  if (searchForm) searchForm.addEventListener("submit", function (e) { e.preventDefault(); });

  /* ------------------------------------------------------------ badge and term tips */
  function placeTip(host) {
    var tip = host.querySelector(".fw-tip");
    if (!tip) return;
    var inBox = host.closest("[data-fw-scrollbox]");
    tip.classList.toggle("is-fixed", !!inBox);
    tip.classList.remove("is-below");
    tip.style.setProperty("--tip-x", "0px");
    var hr = host.getBoundingClientRect(), r = tip.getBoundingClientRect();
    if (inBox) {
      tip.style.setProperty("--tip-l", Math.round(hr.left) + "px");
      tip.style.setProperty("--tip-t", Math.round(hr.top - r.height - 12) + "px");
      r = tip.getBoundingClientRect();
    }
    var vw = docEl.clientWidth, shift = 0;
    if (r.right > vw - 12) shift = vw - 12 - r.right;
    if (r.left + shift < 12) shift = 12 - r.left;
    tip.style.setProperty("--tip-x", Math.round(shift) + "px");
    tip.style.setProperty("--tip-origin", Math.max(12, Math.round(-shift + 18)) + "px");
    var prefersBelow = host.hasAttribute("data-tip-below");
    var roomBelow = window.innerHeight - hr.bottom - 8 >= r.height + 12;
    if (r.top < 8 || (prefersBelow && roomBelow)) {
      tip.classList.add("is-below");
      if (inBox) tip.style.setProperty("--tip-t", Math.round(hr.bottom + 12) + "px");
    }
    root.classList.add("is-tip-warm");
  }
  var warmTimer = 0;
  root.addEventListener("pointerover", function (e) {
    var host = e.target.closest && e.target.closest(".fw-ev, .fw-term");
    if (host && host.querySelector(".fw-tip")) { clearTimeout(warmTimer); host.classList.remove("is-dismissed"); placeTip(host); }
  });
  root.addEventListener("pointerout", function (e) {
    var host = e.target.closest && e.target.closest(".fw-ev, .fw-term");
    if (host && !host.contains(e.relatedTarget)) { warmTimer = setTimeout(function () { root.classList.remove("is-tip-warm"); }, 400); }
  });
  root.addEventListener("focusin", function (e) {
    var host = e.target.closest && e.target.closest(".fw-ev, .fw-term");
    if (host && host.querySelector(".fw-tip")) { host.classList.remove("is-dismissed"); placeTip(host); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    Array.prototype.forEach.call(root.querySelectorAll(".fw-ev, .fw-term"), function (h) {
      if (h.matches(":hover") || h.matches(":focus-within")) h.classList.add("is-dismissed");
    });
  });

  window.FW = {
    root: root, motionOK: motionOK, onMotion: onMotion, token: token, ease: ease,
    whenActive: whenActive, loop: loop, icon: icon, say: say, esc: esc
  };
})();
