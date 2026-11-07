/* Findom Wiki kit, module "learn": the behaviour of the learning and exercise families. One classic IIFE.
   Every family is found by its data-fw-* hook, so a page can hold any number of each. Every count and total is
   read from the markup. Exercises report their progress with a bubbling "fw:progress" event; the chapter rail and
   "Remember it" listen for it. Nothing is stored or sent: every state lives in memory for this visit.
   Named motions here: log-append, cap-hold, flag-mark, answer-settle, answer-shake (once), thread-fill (CSS),
   card-turn (CSS), bar-fill (CSS), step-done, done-arrive, thread-draw (case timeline), door-light (CSS only),
   explanation-open (CSS), score-fill (CSS), reading-line (the rail's progress line).
   "Satin plumage": the panels a person works in are marked .fw-glass (the socle's pointer light) and rise in once
   ([data-fw-reveal], the socle's motion.js). A quiz answer clicked or tapped is checked at once, as in the
   prototype; from the keyboard "Check answer" checks it, so moving through the answers never answers.
   Pause motion and reduced motion: tweens are skipped, and any running tween jumps to its end. */
(function () {
  "use strict";
  var FW = window.FW;
  if (!FW || !FW.root) return;
  var root = FW.root;
  var hasGsap = typeof window.gsap !== "undefined";
  function $(s, el) { return (el || root).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); }

  /* ------------------------------------------------------------ motion */
  function motionOK() { return hasGsap && FW.motionOK(); }
  function dur(name) {                       // a duration token in seconds (0 under reduced motion)
    var v = FW.token(name), n = parseFloat(v) || 0;
    return /ms$/.test(v) ? n / 1000 : n;
  }
  var tweens = [];
  function track(t) { if (t) tweens.push(t); if (tweens.length > 40) tweens.splice(0, tweens.length - 40); return t; }
  FW.onMotion(function (ok) {
    if (ok) return;
    tweens.forEach(function (t) { try { t.progress(1); } catch (e) { /* already gone */ } });
    tweens = [];
  });
  function shake(el) {          // answer-shake: once, small, never under Pause or reduced motion
    if (!motionOK() || !el) return;
    track(gsap.fromTo(el, { x: 0 }, { keyframes: { x: [0, -7, 6, -3, 0] }, duration: dur("--fw-dur-ui") * 1.3, ease: "none", clearProps: "transform" }));
  }
  function settle(el) {         // answer-settle and step-done: a right answer comes to rest
    if (!motionOK() || !el) return;
    track(gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: dur("--fw-dur-ui"), ease: FW.ease.out, clearProps: "transform" }));
  }
  function arrive(el, y, d) {   // flag-mark, log-append, done-arrive
    if (!motionOK() || !el) return;
    track(gsap.fromTo(el, { opacity: 0, y: y == null ? -4 : y, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: d || dur("--fw-dur-ui"), ease: FW.ease.out, clearProps: "opacity,transform" }));
  }

  /* ------------------------------------------------------------ small helpers */
  var NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function word(n) { return NUMBER_WORDS[n] || String(n); }
  function ico(name, cls) { return FW.icon(name).replace('class="fw-ico"', 'class="fw-ico ' + cls + '"'); }
  // feedback: an icon and the words, written into an aria-live element, so nothing relies on colour
  function say(el, text, tone, cls) {
    if (!el) return;
    var name = { right: "check", wrong: "warn", flag: "flag", none: "dash" }[tone] || "dash";
    el.setAttribute("data-tone", tone || "none");
    el.innerHTML = ico(name, cls) + "<span>" + FW.esc(text) + "</span>";
  }
  function clearSay(el) { el.innerHTML = ""; el.removeAttribute("data-tone"); }
  // an exercise tells the page how far the reader is: the rail and "Remember it" listen
  function report(el, detail) {
    detail.id = el.id || "";
    el.dispatchEvent(new CustomEvent("fw:progress", { bubbles: true, detail: detail }));
  }

  /* ================================================================== fw-doors: the column count comes from the doors */
  function initDoors(box) {
    var n = $$(".fw-doors__door", box).filter(function (d) { return d.getAttribute("data-tone") !== "out"; }).length;
    box.style.setProperty("--fwl-n", String(Math.max(1, n)));
  }

  /* ================================================================== fw-sandbox: the live guard */
  /* guard:start  createGuard is copied from code-sample/guard.js: the same three checks, in the same order, with
     the same reasons. press() is one press of a sandbox button and returns the log line and its kind. */
  function createGuard(opts) {
    var monthlyCap = opts.monthlyCap, cooldownMinutes = opts.cooldownMinutes;
    var state = { spent: 0, lastSend: -Infinity, stopped: false };
    var cooldownMs = cooldownMinutes * 60 * 1000;
    return {
      canSend: function (amount, now) {
        if (now === undefined) now = Date.now();
        if (state.stopped) return { ok: false, reason: "Stopped. Nothing more is sent." };
        if (state.spent + amount > monthlyCap) return { ok: false, reason: "Monthly cap held." };
        if (now - state.lastSend < cooldownMs) return { ok: false, reason: "Cooling down." };
        return { ok: true };
      },
      recordSend: function (amount, now) {
        if (now === undefined) now = Date.now();
        state.spent += amount;
        state.lastSend = now;
      },
      stopEverything: function () {
        state.stopped = true;
      }
    };
  }
  function money(cfg, n) { return cfg.currency + " " + n.toFixed(2); }
  function freshSim(cfg) { return { guard: createGuard(cfg), now: 0, spent: 0, lastSend: -Infinity, stopped: false }; }
  function press(sim, cfg, act, amount) {
    if (act === "send") {
      var check = sim.guard.canSend(amount, sim.now);
      if (check.ok) {
        sim.guard.recordSend(amount, sim.now);
        sim.spent += amount; sim.lastSend = sim.now;
        return { text: "Sent " + money(cfg, amount) + ".", kind: "sent" };
      }
      if (check.reason === "Stopped. Nothing more is sent.") return { text: check.reason, kind: "stopped" };
      return { text: check.reason + " No money moved.", kind: "held", cap: check.reason === "Monthly cap held." };
    }
    if (act === "wait") { sim.now += cfg.cooldownMinutes * 60 * 1000; return { text: cfg.cooldownMinutes + " minutes passed.", kind: "time" }; }
    if (act === "stop") { sim.guard.stopEverything(); sim.stopped = true; return { text: "Stopped. Nothing more is sent.", kind: "stopped" }; }
    return { text: "Started over.", kind: "reset" };
  }
  /* guard:end */

  function initSandbox(box) {
    var cfg = {
      monthlyCap: Number(box.getAttribute("data-cap")) || 200,
      cooldownMinutes: Number(box.getAttribute("data-cooldown")) || 15,
      currency: box.getAttribute("data-currency") || "USD"
    };
    var MIN = 60 * 1000;
    var log = $("[data-fw-log]", box), scroller = $("[data-fw-logscroll]", box), empty = $("[data-fw-empty]", box);
    var meter = $("[data-fw-meter]", box), cap = $("[data-fw-cap]", box), status = $("[data-fw-status]", box);
    var clock = $("[data-fw-clock]", box), cool = $("[data-fw-cool]", box), coolText = $("[data-fw-cooltext]", box);
    var sim = freshSim(cfg);
    function render() {
      meter.style.transform = "scaleX(" + Math.min(1, sim.spent / cfg.monthlyCap) + ")";
      status.textContent = "Spent this month: " + money(cfg, sim.spent) + " of " + money(cfg, cfg.monthlyCap);
      clock.textContent = "+" + Math.round(sim.now / MIN) + " min";
      var left = Math.max(0, cfg.cooldownMinutes - (sim.now - sim.lastSend) / MIN);
      if (sim.stopped) { cool.setAttribute("data-state", "stopped"); coolText.textContent = "Guard: stopped"; }
      else if (left > 0) { cool.setAttribute("data-state", "wait"); coolText.textContent = "Cooldown: " + Math.ceil(left) + " min left"; }
      else { cool.setAttribute("data-state", "ready"); coolText.textContent = "Cooldown: ready"; }
    }
    function write(line) {
      var prev = $(".fw-sandbox__item--new", log);
      if (prev) prev.classList.remove("fw-sandbox__item--new");
      var li = document.createElement("li");
      li.className = "fw-sandbox__item fw-sandbox__item--new";
      li.setAttribute("data-kind", line.kind);
      var icon = { sent: "send", held: "lock", stopped: "stop", time: "clock", reset: "reset" }[line.kind];
      li.innerHTML = '<span class="fw-sandbox__time" aria-hidden="true">+' + Math.round(sim.now / MIN) + " min</span>" +
        ico(icon, "fw-sandbox__logico") + "<span>" + FW.esc(line.text) + "</span>";
      log.appendChild(li);
      empty.hidden = true;
      scroller.scrollTop = scroller.scrollHeight;
      arrive(li, 6);                                   // log-append
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || !box.contains(b)) return;
      var act = b.getAttribute("data-act");
      if (act === "reset") { sim = freshSim(cfg); cap.classList.remove("fw-sandbox__cap--held"); log.innerHTML = ""; }
      var line = press(sim, cfg, act, Number(b.getAttribute("data-amount")));
      write(line);
      if (line.cap) {                                  // cap-hold: the lock fills and settles
        cap.classList.add("fw-sandbox__cap--held");
        if (motionOK()) track(gsap.fromTo(cap, { scale: 1.22 }, { scale: 1, duration: dur("--fw-dur-ui") * 1.6, ease: FW.ease.out, clearProps: "transform" }));
      }
      render();
    });
    render();
  }

  /* ================================================================== fw-rail: the chapter rail and the phone strip
     "Current" follows the reading position; a reading step reads as read once passed; a step with exercises fills
     only with what the reader did (an arc for part, a full pearl node for all). */
  function initRail(rail) {
    var nav = $(".fw-rail__nav", rail);
    var items = $$(".fw-rail__item", nav), total = items.length;
    var links = items.map(function (li) { return $(".fw-rail__link", li); });
    var blocks = $$(".fw-rail__flow [data-fw-step]", rail);
    var trackEl = $(".fw-rail__track", nav), fill = $("[data-fw-rail-fill]", nav);
    var nowEl = $("[data-fw-rail-now]", nav), nameEl = $("[data-fw-rail-name]", nav);
    var current = 0, ticking = false, tops = [], centers = [], trackShown = false, railTop = 0, railBottom = 0;
    // reading-line: a hairline under the list (the strip's bottom edge on a phone) fills with the reading
    var meter = document.createElement("span"), meterFill = document.createElement("span");
    meter.className = "fw-rail__meter"; meter.setAttribute("aria-hidden", "true");
    meterFill.className = "fw-rail__meterfill";
    meter.appendChild(meterFill);
    nav.appendChild(meter);
    function layout() {
      trackShown = getComputedStyle(trackEl).display !== "none";
      var nr0 = nav.getBoundingClientRect();
      centers = items.map(function (li) { var r = $(".fw-rail__node", li).getBoundingClientRect(); return r.top + r.height / 2 - nr0.top; });
      if (trackShown) {
        trackEl.style.top = centers[0] + "px";
        trackEl.style.height = Math.max(0, centers[total - 1] - centers[0]) + "px";
      }
      var sy = window.scrollY, rr = rail.getBoundingClientRect();
      railTop = rr.top + sy; railBottom = rr.bottom + sy;
      tops = blocks.map(function (bl) { return { top: bl.getBoundingClientRect().top + sy, step: Number(bl.getAttribute("data-fw-step")) }; });
    }
    function apply(step) {
      items.forEach(function (li, i) {
        var n = i + 1, ex = li.hasAttribute("data-has-subs");
        li.classList.toggle("fw-rail__item--current", n === step);
        li.classList.toggle("fw-rail__item--read", n < step && !ex);
        li.classList.toggle("fw-rail__item--left", n < step && ex);
        if (n === step) links[i].setAttribute("aria-current", "step"); else links[i].removeAttribute("aria-current");
      });
      nowEl.textContent = "Step " + step + " of " + total;
      nameEl.textContent = $(".fw-rail__name", items[step - 1]).textContent;
      if (trackShown) {
        var a = centers[0], b = centers[total - 1], c = centers[step - 1];
        fill.style.transform = "scaleY(" + (b > a ? (c - a) / (b - a) : 0) + ")";   // thread-fill
      }
    }
    function measure() {
      ticking = false;
      var line = window.scrollY + window.innerHeight * 0.42, step = 1;
      tops.forEach(function (t) { if (t.top < line) step = t.step; });
      // the end of the lesson is on screen: the last step is current
      if (window.scrollY + window.innerHeight >= railBottom - 4 && window.scrollY + window.innerHeight * 0.42 > railTop) step = total;
      if (step !== current) { current = step; apply(step); }
      // the reading line follows the scroll; under Pause or reduced motion it moves only from step to step
      var frac = total > 1 ? (step - 1) / (total - 1) : 1;
      if (FW.motionOK()) {
        var span = Math.max(1, railBottom - railTop - window.innerHeight * 0.5);
        frac = Math.max(0, Math.min(1, (window.scrollY + window.innerHeight * 0.42 - railTop) / span));
      }
      meterFill.style.transform = "scaleX(" + frac.toFixed(4) + ")";
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }
    var queued = false;
    function relayout() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; layout(); current = 0; measure(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", relayout);
    if ("ResizeObserver" in window) { var ro = new ResizeObserver(relayout); ro.observe(rail); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    layout();
    measure();
    FW.onMotion(function () { measure(); });
    // a jump from the rail moves focus to the block's heading, so keyboard reading continues there
    $$(".fw-rail__link, .fw-rail__sublink", nav).forEach(function (a) {
      a.addEventListener("click", function () {
        var target = document.getElementById(a.getAttribute("href").slice(1));
        if (!target) return;
        setTimeout(function () {
          var h = target.querySelector("h2, h3");
          if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
        }, 0);
      });
    });
    // exercises report here; a sub-entry follows the exercise its data-for names
    rail.addEventListener("fw:progress", function (e) {
      var d = e.detail, sub = d.id && $('.fw-rail__sub[data-for="' + d.id + '"]', nav);
      if (!sub) return;
      $("[data-fw-subval]", sub).textContent = d.value;
      sub.setAttribute("data-done", String(!!d.done));
      sub.setAttribute("data-frac", String(Math.max(0, Math.min(1, d.frac || 0))));
      var item = sub.closest(".fw-rail__item"), subs = $$(".fw-rail__sub", item);
      var p = subs.reduce(function (a, s) { return a + Number(s.getAttribute("data-frac") || 0); }, 0) / subs.length;
      var nd = subs.filter(function (s) { return s.getAttribute("data-done") === "true"; }).length;
      $(".fw-rail__node", item).style.setProperty("--fwl-p", p.toFixed(3));
      item.classList.toggle("fw-rail__item--done", nd === subs.length);
      var st = $("[data-fw-railstate]", item);
      if (st) st.textContent = ", " + nd + " of " + subs.length + " exercises done";
    });
  }

  /* ================================================================== fw-remember: "What you did." */
  function initRemember(box) {
    var lesson = box.closest("[data-fw-lesson]") || root;
    var did = $("[data-fw-did]", box), text = $("[data-fw-didtext]", box);
    var parts = {};
    lesson.addEventListener("fw:progress", function (e) {
      var src = e.target;
      if (!src.hasAttribute || !src.hasAttribute("data-fw-exercise") || !e.detail.touched) return;
      parts[e.detail.id] = e.detail.summary;
      var order = $$("[data-fw-exercise]", lesson).map(function (x) { return parts[x.id]; }).filter(Boolean);
      text.textContent = order.join(" · ") + ".";
      did.hidden = !order.length;
    });
  }

  /* ================================================================== fw-chat: spot the red flags */
  function initChat(sec) {
    var msgs = $$(".fw-chat__msg", sec);
    var fb = $("[data-fw-fb]", sec), count = $("[data-fw-count]", sec), pipsWrap = $(".fw-chat__pips", sec);
    var showAll = $("[data-fw-showall]", sec), showLabel = $("[data-fw-showlabel]", sec);
    // flag names come from the numbered explainer of the same lesson (data-name)
    var scope = sec.closest("[data-fw-lesson]") || root, names = {};
    $$(".fw-explain__item[data-flag]", scope).forEach(function (li) { names[li.getAttribute("data-flag")] = li.getAttribute("data-name"); });
    var flags = {};
    msgs.forEach(function (m) { var f = Number(m.getAttribute("data-flag")); if (f > 0) flags[f] = true; });
    var total = Object.keys(flags).length;
    if (pipsWrap && pipsWrap.children.length !== total) pipsWrap.innerHTML = new Array(total + 1).join('<span class="fw-chat__pip"></span>');
    var pips = $$(".fw-chat__pip", sec);
    if (showLabel) showLabel.textContent = total === 1 ? "Show it" : "Show all " + word(total);
    var found = {}, shown = {}, touched = false;
    function nFound() { return Object.keys(found).length; }
    function nShown() { return Object.keys(shown).length; }
    function label(f) { return "Red flag " + f + (names[f] ? ": " + names[f] : "") + "."; }
    // a chat with a single red flag speaks in the singular ("Found it.", not "All one found.")
    function all(done) { return total === 1 ? (done === "found" ? "Found it." : "It is shown.") : "All " + word(total) + " " + done + "."; }
    function update() {
      var k = nFound(), sh = nShown();
      count.textContent = k === total ? all("found") : k + " of " + total + " found";
      pips.forEach(function (p, i) { p.classList.toggle("fw-chat__pip--on", i < k); p.classList.toggle("fw-chat__pip--shown", i >= k && i < k + sh); });
      if (k + sh >= total) showAll.setAttribute("aria-disabled", "true");
      report(sec, { kind: "chat", value: k + " of " + total, done: k === total, frac: total ? k / total : 0, touched: touched,
        summary: k + " of " + total + " red flags found" + (sh ? ", the rest shown" : "") });
    }
    function markFlag(btn, how) {     // how: "found" (the reader tapped it) or "shown" (Show all)
      var f = Number(btn.getAttribute("data-flag")), mark = $("[data-fw-mark]", btn);
      btn.classList.remove("fw-chat__msg--none");
      btn.classList.add(how === "found" ? "fw-chat__msg--flag" : "fw-chat__msg--shown");
      mark.innerHTML = ico("flag", "fw-chat__markico") + "<span>" + FW.esc(label(f)) + "</span>" + (how === "shown" ? '<span class="fw-chat__shown">Shown</span>' : "");
      if (how === "found") found[f] = true; else shown[f] = true;
      arrive(mark);                    // flag-mark
    }
    msgs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = Number(btn.getAttribute("data-flag"));
        touched = true;
        if (f > 0) {
          var fresh = !found[f] && !shown[f];
          if (fresh) markFlag(btn, "found");
          update();
          say(fb, label(f) + (fresh && nFound() === total ? " " + all("found") : ""), "flag", "fw-chat__fbico");
          if (fresh) settle(btn);
        } else {
          var mark = $("[data-fw-mark]", btn);
          if (!btn.classList.contains("fw-chat__msg--none")) {
            btn.classList.add("fw-chat__msg--none");
            mark.innerHTML = ico("dash", "fw-chat__markico") + "<span>No red flag in this one.</span>";
            arrive(mark);
          }
          say(fb, "No red flag in this one.", "none", "fw-chat__fbico");
          update();
        }
      });
    });
    showAll.addEventListener("click", function () {
      if (showAll.getAttribute("aria-disabled") === "true") return;
      touched = true;
      msgs.forEach(function (btn) {
        var f = Number(btn.getAttribute("data-flag"));
        if (f > 0 && !found[f] && !shown[f]) markFlag(btn, "shown");
      });
      update();
      // the counter keeps the real number: showing the answers is not finding them
      say(fb, all("shown") + " You found " + nFound() + " of " + total + ".", "flag", "fw-chat__fbico");
    });
    update();
  }

  /* ================================================================== fw-choice: the scenario */
  function initChoice(sec) {
    var opts = $$(".fw-choice__opt", sec), fb = $("[data-fw-fb]", sec), again = $("[data-fw-again]", sec);
    var locked = false, best = null;
    opts.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    opts.forEach(function (c) {
      c.addEventListener("click", function () {
        if (locked) return;
        locked = true;
        var right = c.getAttribute("data-verdict") === "right";
        opts.forEach(function (o) { if (o !== c) o.setAttribute("aria-disabled", "true"); });
        c.setAttribute("aria-pressed", "true");
        $("[data-fw-tag]", c).innerHTML = ico(right ? "check" : "warn", "fw-choice__tagico") + "<span>Your answer</span>";
        say(fb, c.getAttribute("data-fb"), right ? "right" : "wrong", "fw-choice__fbico");
        again.hidden = false;
        if (right) best = "right"; else if (!best) best = "tried";
        report(sec, { kind: "choice", value: best === "right" ? "Done" : "Tried", done: best === "right", frac: best === "right" ? 1 : 0.5,
          touched: true, summary: best === "right" ? "scenario right" : "scenario tried" });
        if (right) settle(c); else shake(c);   // the feedback opens by itself (CSS, explanation-open)
      });
    });
    again.addEventListener("click", function () {
      locked = false;
      opts.forEach(function (o) { o.removeAttribute("aria-disabled"); o.setAttribute("aria-pressed", "false"); $("[data-fw-tag]", o).innerHTML = ""; });
      clearSay(fb);
      again.hidden = true;
      opts[0].focus();
    });
    report(sec, { kind: "choice", value: "To do", done: false, frac: 0, touched: false, summary: "" });
  }

  /* ================================================================== fw-quiz: per-question check and the score */
  function initQuiz(sec) {
    var qs = $$(".fw-quiz__q", sec), score = $("[data-fw-score]", sec), total = qs.length, touched = false;
    qs.forEach(function (q, i) { var n = $("[data-fw-qn]", q); if (n) n.textContent = "Question " + (i + 1) + " of " + total; });
    // score-fill: a meter beside the score fills with the right answers (CSS transition)
    var meterFill = null;
    if (score && score.parentNode) {
      var meter = document.createElement("span");
      meter.className = "fw-quiz__meter"; meter.setAttribute("aria-hidden", "true");
      meterFill = document.createElement("span"); meterFill.className = "fw-quiz__meterfill";
      meter.appendChild(meterFill);
      score.parentNode.insertBefore(meter, score.nextSibling);
    }
    function update() {
      var r = qs.filter(function (q) { return q.getAttribute("data-state") === "right"; }).length;
      score.innerHTML = '<span class="fw-quiz__scoren">' + r + "</span> of " + total + " right";
      if (meterFill) meterFill.style.transform = "scaleX(" + (total ? r / total : 0) + ")";
      report(sec, { kind: "quiz", value: r + " of " + total, done: r === total, frac: total ? r / total : 0, touched: touched,
        summary: r + " of " + total + " questions right" });
    }
    qs.forEach(function (q) {
      var fb = $("[data-fw-fb]", q), why = q.getAttribute("data-why"), checkBtn = $("[data-fw-check]", q);
      var pointerAt = -1e9;
      function clear() {
        q.removeAttribute("data-state");
        $$(".fw-quiz__opt", q).forEach(function (o) { o.removeAttribute("data-tone"); });
        $$("[data-fw-tag]", q).forEach(function (t) { t.innerHTML = ""; });
      }
      // a pointer (mouse, finger or pen) on an answer: the change that follows is checked at once
      $$(".fw-quiz__opt", q).forEach(function (o) {
        o.addEventListener("pointerdown", function () { pointerAt = Date.now(); });
      });
      $$(".fw-quiz__input", q).forEach(function (inp) {
        inp.addEventListener("change", function () {
          clear(); clearSay(fb); update();
          // a real click on the button, so site.js gives the explanation back its links and badges
          if (Date.now() - pointerAt < 1500) { pointerAt = -1e9; checkBtn.click(); }
        });
      });
      checkBtn.addEventListener("click", function () {
        var chosen = $(".fw-quiz__input:checked", q);
        clear();
        if (!chosen) { say(fb, "Choose an answer first.", "none", "fw-quiz__fbico"); update(); return; }
        touched = true;
        var right = chosen.hasAttribute("data-right");
        var rightOpt = $(".fw-quiz__input[data-right]", q).closest(".fw-quiz__opt");
        rightOpt.setAttribute("data-tone", "right");
        $("[data-fw-tag]", rightOpt).innerHTML = ico("check", "fw-quiz__tagico") + "<span>Correct answer</span>";
        var mine = chosen.closest(".fw-quiz__opt");
        if (!right) {
          mine.setAttribute("data-tone", "wrong");
          $("[data-fw-tag]", mine).innerHTML = ico("warn", "fw-quiz__tagico") + "<span>Your answer</span>";
        }
        q.setAttribute("data-state", right ? "right" : "wrong");
        say(fb, (right ? "Right. " : "Not quite. ") + why, right ? "right" : "wrong", "fw-quiz__fbico");
        if (right) settle(mine); else shake(mine);
        update();
      });
    });
    update();
  }

  /* ================================================================== fw-flash: flashcards (card-turn) */
  function initFlash(box) {
    var words = $$("[data-fw-words] li", box).map(function (li) { return { w: li.getAttribute("data-word"), d: li.getAttribute("data-def") }; });
    var n = words.length;
    if (!n) return;
    var card = $("[data-fw-card]", box), front = $("[data-fw-front]", box), back = $("[data-fw-back]", box);
    var fword = $("[data-fw-fword]", box), bword = $("[data-fw-bword]", box), fdef = $("[data-fw-fdef]", box);
    var count = $("[data-fw-fcount]", box), live = $("[data-fw-flive]", box), knownEl = $("[data-fw-fknown]", box);
    var turnBtn = $("[data-fw-turn]", box), turnLabel = $("[data-fw-turnlabel]", box), judge = $("[data-fw-judge]", box);
    var dotsWrap = $(".fw-flash__dots", box);
    if (dotsWrap && dotsWrap.children.length !== n) dotsWrap.innerHTML = new Array(n + 1).join('<span class="fw-flash__dot"></span>');
    var dots = $$(".fw-flash__dot", box);
    var i = 0, turned = false, marks = {};
    function setTurned(b, cut) {
      turned = b;
      if (cut) card.classList.add("fw-flash__card--cut");
      card.classList.toggle("fw-flash__card--turned", b);
      if (cut) { void card.offsetWidth; card.classList.remove("fw-flash__card--cut"); }
      front.setAttribute("aria-hidden", String(b));
      back.setAttribute("aria-hidden", String(!b));
      turnLabel.textContent = b ? "Show the word" : "Show the meaning";
      judge.hidden = !b;
      live.textContent = b ? words[i].w + ": " + words[i].d : "";
    }
    function knownText() {
      var k = 0, m = 0;
      for (var j = 0; j < n; j++) { if (marks[j]) m++; if (marks[j] === "known") k++; }
      return m === n ? "All " + word(n) + " seen: " + k + " of " + n + " known." : k + " of " + n + " known";
    }
    function render() {
      fword.textContent = words[i].w; bword.textContent = words[i].w; fdef.textContent = words[i].d;
      count.textContent = "Word " + (i + 1) + " of " + n;
      knownEl.textContent = knownText();
      dots.forEach(function (d, k) {
        d.classList.toggle("fw-flash__dot--on", k === i);
        d.classList.toggle("fw-flash__dot--known", marks[k] === "known");
        d.classList.toggle("fw-flash__dot--again", marks[k] === "again");
      });
    }
    var stage = $(".fw-flash__stage", box) || card;
    function go(step) {
      setTurned(false, true);
      i = (i + step + n) % n;
      render();
      // next-card slide: the stage moves, so the tween never meets the card's own turn (a CSS transform)
      if (motionOK()) track(gsap.fromTo(stage, { x: step * 14, opacity: 0.4 }, { x: 0, opacity: 1, duration: dur("--fw-dur-ui"), ease: FW.ease.out, clearProps: "opacity,transform" }));
    }
    function judgeAs(kind) {
      marks[i] = kind;
      var allSeen = Object.keys(marks).length === n;
      go(1);
      if (allSeen) live.textContent = knownText();
      turnBtn.focus();
    }
    turnBtn.addEventListener("click", function () { setTurned(!turned, false); });
    $("[data-fw-known]", box).addEventListener("click", function () { judgeAs("known"); });
    $("[data-fw-again]", box).addEventListener("click", function () { judgeAs("again"); });
    $("[data-fw-next]", box).addEventListener("click", function () { go(1); });
    $("[data-fw-prev]", box).addEventListener("click", function () { go(-1); });
    render();
    setTurned(false, true);
  }

  /* ================================================================== fw-tut: steps, progress (bar-fill, step-done, done-arrive) */
  function initTut(box) {
    var steps = $$(".fw-tut__step", box), boxes = $$("[data-fw-done]", box), n = boxes.length;
    var line = $("[data-fw-line]", box), fill = $("[data-fw-fill]", box), prog = $("[data-fw-progress]", box);
    var done = $("[data-fw-complete]", box), live = $("[data-fw-tutlive]", box), bar = $(".fw-tut__bar", box);
    // one notch in the bar between two steps, as many as the steps ask for
    for (var k = 1; k < n; k++) {
      var seg = document.createElement("span");
      seg.className = "fw-tut__seg";
      seg.style.setProperty("--fwl-at", String(k / n));
      bar.appendChild(seg);
    }
    var wasComplete = false;
    function update(changed) {
      var ticked = boxes.filter(function (b) { return b.checked; }).length;
      var firstOpen = boxes.findIndex(function (b) { return !b.checked; });
      steps.forEach(function (s, idx) {
        s.classList.toggle("fw-tut__step--done", boxes[idx].checked);
        s.classList.toggle("fw-tut__step--current", idx === firstOpen);
      });
      var complete = ticked === n;
      line.textContent = "Step " + (complete ? n : firstOpen + 1) + " of " + n;
      fill.style.transform = "scaleX(" + (n ? ticked / n : 0) + ")";
      prog.classList.toggle("fw-tut__progress--complete", complete);
      done.hidden = !complete;
      if (complete && !wasComplete && changed) {
        live.textContent = $(".fw-tut__donet", done).textContent;
        arrive(done, 14, dur("--fw-dur-turn"));
        if (motionOK()) track(gsap.fromTo($(".fw-tut__seal", done), { scale: 0.86 }, { scale: 1, duration: dur("--fw-dur-turn"), ease: FW.ease.out, clearProps: "transform" }));
      }
      if (!complete) live.textContent = "";
      wasComplete = complete;
    }
    boxes.forEach(function (b) {
      b.addEventListener("change", function () {
        update(true);
        if (b.checked) settle(b.closest(".fw-tut__step").querySelector(".fw-tut__n"));   // step-done
      });
    });
    update(false);
  }

  /* ================================================================== fw-timeline: the thread draws once (thread-draw) */
  function initTimeline(box) {
    var steps = $$(".fw-timeline__step", box);
    box.style.setProperty("--fwl-n", String(Math.max(1, steps.length)));
    // on a phone the thread runs down: it ends at the centre of the last node, however long the last text is
    var wrapEl = $(".fw-timeline__wrap", box), lastNode = steps.length ? $(".fw-timeline__node", steps[steps.length - 1]) : null;
    function fitEnd() {
      if (!lastNode) return;
      var wr = wrapEl.getBoundingClientRect(), nr = lastNode.getBoundingClientRect();
      box.style.setProperty("--fwl-tl-end", Math.max(0, Math.round(wr.bottom - (nr.top + nr.height / 2))) + "px");
    }
    fitEnd();
    if ("ResizeObserver" in window) new ResizeObserver(fitEnd).observe(wrapEl);
    var fill = $("[data-fw-tlfill]", box);
    if (!fill || !motionOK() || !("IntersectionObserver" in window)) return;   // otherwise the thread is drawn already
    var vertical = function () { return fill.parentNode.getBoundingClientRect().width <= 1.5; };
    var drawn = false, io;
    gsap.set(fill, vertical() ? { scaleY: 0 } : { scaleX: 0 });
    function finish() { if (drawn) return; drawn = true; if (io) io.disconnect(); gsap.set(fill, { clearProps: "transform" }); }
    FW.onMotion(function (ok) { if (!ok) finish(); });
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || drawn) return;
        drawn = true; io.disconnect();
        if (!motionOK()) { gsap.set(fill, { clearProps: "transform" }); return; }
        var to = { duration: dur("--fw-dur-draw"), ease: FW.ease.inOut, clearProps: "transform" };
        to[vertical() ? "scaleY" : "scaleX"] = 1;
        track(gsap.fromTo(fill, vertical() ? { scaleY: 0 } : { scaleX: 0 }, to));
      });
    }, { rootMargin: "0px 0px -20% 0px" });
    io.observe(box.querySelector(".fw-timeline__wrap"));
  }

  /* ------------------------------------------------------------ "Satin plumage" hooks for the socle (motion.js)
     The panels a person works in catch the pointer light (.fw-glass) and rise in once when they come into view
     ([data-fw-reveal]); nothing is marked twice, and nothing inside an element that already rises in. Under Pause or
     reduced motion motion.js shows them as they are. */
  $$(".fw-quiz__q, .fw-choice, .fw-chat").forEach(function (el) { el.classList.add("fw-glass"); });
  // the "Try it" eyebrow (CSS) stays off a title that already says it
  $$(".fw-quiz__title, .fw-choice__title, .fw-chat__title").forEach(function (h) {
    if (/^\s*try it\b/i.test(h.textContent)) h.setAttribute("data-fwl-said", "");
  });
  $$(".fw-quiz__q, .fw-choice, .fw-chat, .fw-flash__deck, .fw-tut__step").forEach(function (el) {
    if (!el.closest("[data-fw-reveal]") && !el.querySelector("[data-fw-reveal]") && !el.closest("[data-fwl-specimen], [data-fwl-statelist]")) {
      el.setAttribute("data-fw-reveal", "");
    }
  });

  /* ------------------------------------------------------------ start: listeners first, then the exercises report */
  $$("[data-fw-doors]").forEach(initDoors);
  $$("[data-fw-sandbox]").forEach(initSandbox);
  $$("[data-fw-rail]").forEach(initRail);
  $$("[data-fw-remember]").forEach(initRemember);
  $$("[data-fw-chat]").forEach(initChat);
  $$("[data-fw-choice]").forEach(initChoice);
  $$("[data-fw-quiz]").forEach(initQuiz);
  $$("[data-fw-flash]").forEach(initFlash);
  $$("[data-fw-tut]").forEach(initTut);
  $$("[data-fw-timeline]").forEach(initTimeline);
})();
