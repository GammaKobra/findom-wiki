/* Findom Wiki kit, module "content": behaviour of the reading and reference families.
   One classic script, after fw-base.js. Nothing is stored or sent.
     fw-code      file list, tabs (arrow keys, Home, End), line numbers and line counts read from each file, Copy
     fw-compare   scroll state (data-scroll), tips kept against their term while the box or the page scrolls
     fw-figure    figure-draw: lines marked data-fw-figure-draw draw once, the first time the figure is seen
     fw-quote     quote-rise: the lines of a pull quote rise once, the first time it is seen
   figure-draw and quote-rise only hide what they are about to play: never under reduced motion or Pause motion,
   never above the fold. Pause motion finishes them at once. */
(function () {
  "use strict";
  if (!window.FW) return;
  var root = FW.root;
  var each = function (sel, fn, scope) { Array.prototype.forEach.call((scope || root).querySelectorAll(sel), fn); };
  function secs(name) { var v = parseFloat(FW.token(name)); return isNaN(v) ? 0 : v / 1000; }

  /* ================================================================ fw-code: the multi-file viewer */
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

    // line numbers and the line count of each file, read from the file itself
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
      // a keyboard change of tab never animates (it can be repeated many times in a row)
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
    // the file list is for the pointer only (aria-hidden, out of the tab order): a click never leaves focus inside it
    files.forEach(function (f, i) {
      var target = +f.getAttribute("data-file");
      f.addEventListener("mousedown", function (e) { e.preventDefault(); });
      f.addEventListener("click", function (e) { open(isNaN(target) ? i : target, e.detail === 0); });
    });
    // a code box is a tab stop (for scrolling it with the keyboard) only while its file does not fit
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

    // Copy: the open file, as text, byte for byte
    var copyTimer = 0, swapTimer = 0, sayTimer = 0;
    function resetCopy() {
      if (!copyBtn) return;
      clearTimeout(copyTimer); clearTimeout(swapTimer);
      copyBtn.classList.remove("is-copied", "is-failed", "is-swapping");
      if (copyLabel) copyLabel.textContent = "Copy";
    }
    // the live region is emptied first, so the same sentence twice in a row is read twice;
    // tone "fail" also shows the sentence under the code, for everyone
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
        // failure in words, on the button for two seconds and in a visible line that stays until the next try
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

  /* ================================================================ fw-compare: scroll state and tips */
  function replaceTips(scope) {
    var a = document.activeElement;
    if (a && scope.contains(a) && a.closest(".fw-term, .fw-ev")) a.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    var h = scope.querySelector(".fw-term:hover, .fw-ev:hover");
    if (h && window.PointerEvent) h.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  }
  each(".fw-compare", function (c) {
    var box = c.querySelector(".fw-compare__box"), cue = c.querySelector(".fw-compare__cue[id]");
    if (!box) return;
    // tips inside the box are placed against the viewport from the start, so they never widen the box
    each(".fw-tip", function (t) { t.classList.add("is-fixed"); }, box);
    function update() {
      var max = box.scrollWidth - box.clientWidth, x = box.scrollLeft;
      var s = max <= 1 ? "none" : x <= 1 ? "start" : x >= max - 1 ? "end" : "middle";
      c.setAttribute("data-scroll", s);
      // a box that cannot scroll is not a tab stop
      // nor is the sideways cue read out for it
      if (s === "none") { box.removeAttribute("tabindex"); box.removeAttribute("aria-describedby"); }
      else { box.setAttribute("tabindex", "0"); if (cue) box.setAttribute("aria-describedby", cue.id); }
    }
    box.addEventListener("scroll", function () { update(); replaceTips(box); }, { passive: true });
    window.addEventListener("scroll", function () { replaceTips(box); }, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(box); else window.addEventListener("resize", update);
    update();
  });

  /* ================================================================ figure-draw and quote-rise: once, when first seen */
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
      // a resize before it plays would leave lines broken in the wrong places: show the quote as it is
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

  /* ================================================================ the "Satin plumage" touches
     Words are never changed: a title keeps its text, only its last mark is wrapped; a dot added after a word is
     drawn by CSS and kept out of its accessible name. */

  // a display title that ends on ? . or ! ends on the red mark
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

  // a word or a rule name without a final stop gets the red dot (CSS, data-fwc-dot)
  each(".fw-dict__word, .fw-entry__word, .fw-explain__name", function (w) {
    if (!/[.?!:;]$/.test(w.textContent.trim())) w.setAttribute("data-fwc-dot", "");
  });

  // honest numbers: every numeral of a list takes the size its longest value allows, so a row stays even
  each(".fw-stat", function (list) {
    var longest = 0;
    each(".fw-stat__n", function (n) { longest = Math.max(longest, n.textContent.trim().length); }, list);
    if (longest > 16) list.setAttribute("data-fwc-len", "long");
    else if (longest > 6) list.setAttribute("data-fwc-len", "mid");
  });

  // glass-light: a soft light follows the pointer over a glass panel (fine pointer and motion allowed only)
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

  // block-rise: in a chapter, the blocks of this module are handed to the site's reveal (build_motion.js reads
  // [data-fw-reveal] after every kit script). Never the head, never a quote (it has quote-rise), never twice.
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
  // a printed page shows every line and every drawing, whatever was seen on screen
  window.addEventListener("beforeprint", function () { plays.forEach(function (p) { p.finish(); }); });
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  setupFigures();
  fontsReady.then(setupQuotes);
})();
