(function () {
  "use strict";
  if (!window.FW) return;
  var root = FW.root;
  var each = function (sel, fn, scope) { Array.prototype.forEach.call((scope || root).querySelectorAll(sel), fn); };
  function secs(name) { var v = parseFloat(FW.token(name)); return isNaN(v) ? 0 : v / 1000; }

  each("[data-fw-code]", function (box) {
    var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
    var files = [].slice.call(box.querySelectorAll(".fw-code__file"));
    var panels = [].slice.call(box.querySelectorAll('[role="tabpanel"]'));
    var tablist = box.querySelector('[role="tablist"]');
    var line = box.querySelector(".fw-code__tabline");
    var copyBtn = box.querySelector("[data-fw-copy]");
    var copyLabel = copyBtn && copyBtn.querySelector(".fw-code__copylabel");
    var status = box.querySelector("[data-fw-copy-status]");
    if (!tabs.length || tabs.length !== panels.length) return;
    var current = Math.max(0, tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; }));

    panels.forEach(function (p, i) {
      var code = p.querySelector(".fw-code__src"), gutter = p.querySelector(".fw-code__gutter"), scroller = p.querySelector(".fw-code__scroll");
      var n = code.textContent.replace(/\n$/, "").split("\n").length, nums = [];
      for (var k = 1; k <= n; k++) nums.push(k);
      if (gutter) gutter.textContent = nums.join("\n");
      if (scroller) scroller.setAttribute("aria-label", tabs[i].textContent + ", " + n + (n === 1 ? " line" : " lines"));
    });

    function placeLine() {
      var t = tabs[current];
      if (!line || !t) return;
      line.style.transform = "translateX(" + t.offsetLeft + "px) scaleX(" + (t.offsetWidth / 100) + ")";
    }
    function markOverflow() {
      if (tablist.scrollWidth > tablist.clientWidth + 1) tablist.setAttribute("data-overflow", "");
      else tablist.removeAttribute("data-overflow");
    }
    function keepTabInView(t) {
      var l = t.offsetLeft, r = l + t.offsetWidth;
      if (l < tablist.scrollLeft) tablist.scrollLeft = l;
      else if (r > tablist.scrollLeft + tablist.clientWidth) tablist.scrollLeft = r - tablist.clientWidth;
    }
    function open(i, byKey) {
      current = i;
      box.classList.toggle("is-keyed", !!byKey);
      tabs.forEach(function (t, j) { t.setAttribute("aria-selected", j === i ? "true" : "false"); t.tabIndex = j === i ? 0 : -1; });
      files.forEach(function (f, j) { f.setAttribute("aria-current", j === i ? "true" : "false"); });
      panels.forEach(function (p, j) { p.hidden = j !== i; });
      keepTabInView(tabs[i]);
      placeLine();
      resetCopy();
      say("", "");
      markScrollers();
    }
    tabs.forEach(function (t, i) { t.addEventListener("click", function (e) { open(i, e.detail === 0); }); });
    files.forEach(function (f, i) {
      var target = +f.getAttribute("data-file");
      f.addEventListener("mousedown", function (e) { e.preventDefault(); });
      f.addEventListener("click", function (e) { open(isNaN(target) ? i : target, e.detail === 0); });
    });
    function markScrollers() {
      panels.forEach(function (p) {
        var sc = p.querySelector(".fw-code__scroll");
        if (!sc || p.hidden) return;
        var scrolls = sc.scrollWidth > sc.clientWidth + 1 || sc.scrollHeight > sc.clientHeight + 1;
        if (scrolls) sc.setAttribute("tabindex", "0"); else sc.removeAttribute("tabindex");
      });
    }
    tablist.addEventListener("keydown", function (e) {
      var n = tabs.length, i = current;
      if (e.key === "ArrowRight") i = (i + 1) % n;
      else if (e.key === "ArrowLeft") i = (i - 1 + n) % n;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = n - 1;
      else return;
      e.preventDefault();
      open(i, true);
      tabs[i].focus();
    });

    var copyTimer = 0, swapTimer = 0, sayTimer = 0;
    function resetCopy() {
      if (!copyBtn) return;
      clearTimeout(copyTimer); clearTimeout(swapTimer);
      copyBtn.classList.remove("is-copied", "is-failed", "is-swapping");
      if (copyLabel) copyLabel.textContent = "Copy";
    }
    function say(text, tone) {
      if (!status) return;
      clearTimeout(sayTimer);
      status.textContent = "";
      if (tone) status.setAttribute("data-tone", tone); else status.removeAttribute("data-tone");
      if (text) sayTimer = setTimeout(function () { status.textContent = text; }, 50);
    }
    function legacyCopy(text) {
      var ta = document.createElement("textarea"), ok = false;
      ta.value = text; ta.setAttribute("readonly", ""); ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () { if (!legacyCopy(text)) throw new Error("copy"); });
      }
      return legacyCopy(text) ? Promise.resolve() : Promise.reject(new Error("copy"));
    }
    if (copyBtn) copyBtn.addEventListener("click", function () {
      var name = tabs[current].textContent, text = panels[current].querySelector(".fw-code__src").textContent;
      copyText(text).then(function () {
        resetCopy();
        copyBtn.classList.add("is-copied", "is-swapping");
        if (copyLabel) copyLabel.textContent = "Copied";
        say(name + " copied.", "");
        swapTimer = setTimeout(function () { copyBtn.classList.remove("is-swapping"); }, secs("--fw-dur-hover") * 1000);
        copyTimer = setTimeout(resetCopy, 2000);
      }, function () {
        resetCopy();
        copyBtn.classList.add("is-failed");
        if (copyLabel) copyLabel.textContent = "Copy failed";
        say("Copy did not work. Select the code instead.", "fail");
        copyTimer = setTimeout(resetCopy, 2000);
      });
    });

    function layout() { markOverflow(); placeLine(); markScrollers(); }
    layout();
    window.addEventListener("resize", layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  });

  function replaceTips(scope) {
    var a = document.activeElement;
    if (a && scope.contains(a) && a.closest(".fw-term, .fw-ev")) a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    var h = scope.querySelector(".fw-term:hover, .fw-ev:hover");
    if (h && window.PointerEvent) h.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  }
  each(".fw-compare", function (c) {
    var box = c.querySelector(".fw-compare__box"), cue = c.querySelector(".fw-compare__cue[id]");
    if (!box) return;
    each(".fw-tip", function (t) { t.classList.add("is-fixed"); }, box);
    function update() {
      var max = box.scrollWidth - box.clientWidth, x = box.scrollLeft;
      var s = max <= 1 ? "none" : x <= 1 ? "start" : x >= max - 1 ? "end" : "middle";
      c.setAttribute("data-scroll", s);
      if (s === "none") { box.removeAttribute("tabindex"); box.removeAttribute("aria-describedby"); }
      else { box.setAttribute("tabindex", "0"); if (cue) box.setAttribute("aria-describedby", cue.id); }
    }
    box.addEventListener("scroll", function () { update(); replaceTips(box); }, { passive: true });
    window.addEventListener("scroll", function () { replaceTips(box); }, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(box); else window.addEventListener("resize", update);
    update();
  });

  var plays = [];   // { finish() } for every motion that has hidden something or is running
  function belowFold(el) { return el.getBoundingClientRect().top > window.innerHeight * .92; }
  function onceSeen(el, cb) {
    if (!("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
  }

  function setupFigures() {
    if (!window.gsap || !window.DrawSVGPlugin) return;
    gsap.registerPlugin(DrawSVGPlugin);
    each(".fw-figure", function (fig) {
      var lines = fig.querySelectorAll("[data-fw-figure-draw]");
      if (!lines.length || !FW.motionOK() || !belowFold(fig)) return;
      var tween = null, done = false;
      var play = { finish: function () { done = true; if (tween) tween.progress(1).kill(); gsap.set(lines, { drawSVG: "100%" }); } };
      plays.push(play);
      gsap.set(lines, { drawSVG: "0%" });
      onceSeen(fig, function () {
        if (done) return;
        if (!FW.motionOK()) { play.finish(); return; }
        tween = gsap.to(lines, { drawSVG: "100%", duration: secs("--fw-dur-draw"), ease: FW.ease.sink, stagger: secs("--fw-stagger") * 2, onComplete: function () { done = true; } });
      });
    });
  }

  function setupQuotes() {
    if (!window.gsap || !window.SplitText) return;
    gsap.registerPlugin(SplitText);
    each("[data-fw-quote-rise]", function (p) {
      if (!FW.motionOK() || !belowFold(p)) return;
      var split = new SplitText(p, { type: "lines", linesClass: "fw-quote__line" });
      var tween = null, done = false, width = window.innerWidth;
      var play = {
        finish: function () {
          if (done) return;
          done = true;
          if (tween) tween.kill();
          split.revert();
        }
      };
      plays.push(play);
      gsap.set(split.lines, { yPercent: 40, opacity: 0 });
      window.addEventListener("resize", function () { if (!tween && window.innerWidth !== width) play.finish(); });
      onceSeen(p, function () {
        if (done) return;
        if (!FW.motionOK()) { play.finish(); return; }
        tween = gsap.to(split.lines, {
          yPercent: 0, opacity: 1, duration: secs("--fw-dur-turn"), ease: FW.ease.out, stagger: secs("--fw-stagger") * 2,
          onComplete: play.finish
        });
      });
    });
  }


  var TITLES = ".fw-prose > h2, .fw-prose > h3, .fw-alert__title, .fw-compare__title, .fw-table__caption:not(.fw-visually-hidden), " +
    ".fw-steps__title, .fw-explain__title, .fw-timeline__title, .fw-tells__title, .fw-code__title, .fw-site-block > .fw-site-blocktitle";
  each(TITLES, function (h) {
    if (h.querySelector(".fw-prose__mark, .fw-redmark")) return;
    var walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, null), last = null, n;
    while ((n = walk.nextNode())) if (/\S/.test(n.nodeValue)) last = n;
    if (!last) return;
    var inside = last.parentNode.closest("a, button, .fw-term, .fw-ev");
    if (inside && h.contains(inside)) return;
    var v = last.nodeValue.replace(/\s+$/, ""), ch = v.slice(-1);
    if ("?.!".indexOf(ch) < 0 || /\.\.\.$/.test(v)) return;
    var mark = document.createElement("span");
    mark.className = "fw-prose__mark";
    mark.textContent = ch;
    last.nodeValue = v.slice(0, -1);
    last.parentNode.insertBefore(mark, last.nextSibling);
  });

  each(".fw-dict__word, .fw-entry__word, .fw-explain__name", function (w) {
    if (!/[.?!:;]$/.test(w.textContent.trim())) w.setAttribute("data-fwc-dot", "");
  });

  each(".fw-stat", function (list) {
    var longest = 0;
    each(".fw-stat__n", function (n) { longest = Math.max(longest, n.textContent.trim().length); }, list);
    if (longest > 16) list.setAttribute("data-fwc-len", "long");
    else if (longest > 6) list.setAttribute("data-fwc-len", "mid");
  });

  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var lit = [];
  if (fine) each(".fw-summary, .fw-stat__item, .fw-explain__item", function (el) {
    lit.push(el);
    el.addEventListener("pointermove", function (e) {
      if (!FW.motionOK()) return;
      var r = el.getBoundingClientRect();
      el.setAttribute("data-fwc-light", "");
      el.style.setProperty("--fwc-mx", Math.round(e.clientX - r.left) + "px");
      el.style.setProperty("--fwc-my", Math.round(e.clientY - r.top) + "px");
    }, { passive: true });
    el.addEventListener("pointerleave", function () { el.removeAttribute("data-fwc-light"); });
  });

  var RISE = ".fw-summary, .fw-site-opening, .fw-prose > *, .fw-note, .fw-alert, .fw-table, .fw-compare, .fw-myth__item, " +
    ".fw-stat__item, .fw-steps__item, .fw-explain__item, .fw-remember, .fw-timeline__step, .fw-code, .fw-sources__k, .fw-sources__text, .fw-legend";
  each(".fw-site-flow", function (flow) {
    each(RISE, function (el) {
      if (el.hasAttribute("data-fw-reveal") || el.closest(".fw-band, .fw-head, .fw-quote, [data-fw-reveal]")) return;
      if (el.querySelector("[data-fw-reveal], [data-fw-quote-rise], [data-fw-descent]")) return;
      el.setAttribute("data-fw-reveal", "");
    }, flow);
  });

  FW.onMotion(function (ok) {
    if (!ok) {
      plays.forEach(function (p) { p.finish(); });
      lit.forEach(function (el) { el.removeAttribute("data-fwc-light"); });
    }
  });
  window.addEventListener("beforeprint", function () { plays.forEach(function (p) { p.finish(); }); });
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  setupFigures();
  fontsReady.then(setupQuotes);
})();
