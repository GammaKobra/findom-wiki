(function () {
  "use strict";
  var docEl = document.documentElement;
  var KEY = "fw-adult";

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ms(name) {
    var v = getComputedStyle(docEl).getPropertyValue(name).trim(), n = parseFloat(v) || 0;
    return /ms$/.test(v) ? n : n * 1000;
  }

  var gate = document.getElementById("fw-gate");
  if (gate && docEl.classList.contains("fw-gate-open")) {
    var dialog = gate.querySelector(".fw-gate__dialog");
    var yes = gate.querySelector("[data-fw-gate-yes]");
    var held = [document.querySelector(".fw-skip"), document.querySelector(".fw-top"),
      document.getElementById("fw-main"), document.querySelector(".fw-foot")].filter(Boolean);
    held.forEach(function (el) { el.setAttribute("inert", ""); });
    try { dialog.focus({ preventScroll: true }); } catch (e) { dialog.focus(); }
    document.addEventListener("focusin", function (e) {
      if (docEl.classList.contains("fw-gate-open") && !gate.contains(e.target)) dialog.focus();
    });
    yes.addEventListener("click", function () {
      try { window.localStorage.setItem(KEY, "y:" + Date.now());   /* asked again after 30 days */ } catch (e) { /* not stored: the gate comes back on the next page */ }
      held.forEach(function (el) { el.removeAttribute("inert"); });
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        docEl.classList.remove("fw-gate-open");
        gate.classList.remove("is-leaving");
        var body = document.body;
        if (document.activeElement && gate.contains(document.activeElement)) {
          body.setAttribute("tabindex", "-1");
          try { body.focus({ preventScroll: true }); } catch (e) { body.focus(); }
          body.addEventListener("blur", function () { body.removeAttribute("tabindex"); }, { once: true });
        }
      }
      gate.classList.add("is-leaving");
      gate.addEventListener("transitionend", function (e) { if (e.target === gate) finish(); });
      setTimeout(finish, ms("--fw-dur-tip") + 60);
    });
  }

  function goSearch(form, words) {
    var url = (form.getAttribute("action") || "search.html").split("#")[0];
    var target = url + (words ? "#q=" + encodeURIComponent(words) : "");
    if (document.querySelector("[data-fw-search-page]") && /search\.html$/.test(url)) {
      if (window.location.hash !== (words ? "#q=" + encodeURIComponent(words) : "")) window.location.hash = words ? "q=" + encodeURIComponent(words) : "";
      return;
    }
    window.location.href = target;
  }
  var headForm = document.querySelector("[data-fw-search]");
  if (headForm) headForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = headForm.querySelector("input");
    goSearch(headForm, input ? input.value.trim() : "");
  });

  var printHeld = [];
  window.addEventListener("beforeprint", function () {
    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      var h = a.getAttribute("href");
      if (/^https?:/i.test(h)) return;
      a.setAttribute("data-fw-href", h);
      a.removeAttribute("href");
      printHeld.push(a);
    });
  });
  window.addEventListener("afterprint", function () {
    printHeld.forEach(function (a) { a.setAttribute("href", a.getAttribute("data-fw-href")); a.removeAttribute("data-fw-href"); });
    printHeld = [];
  });

  function richen(fb, tpl, plainWords) {
    var span = fb && fb.lastElementChild;
    if (!tpl || !span || span.tagName !== "SPAN" || span.hasAttribute("data-fw-site-rich") || !plainWords) return;
    var said = span.textContent;
    if (said.slice(-plainWords.length) !== plainWords) return;
    span.textContent = said.slice(0, said.length - plainWords.length);   // "Right. ", "Not quite. " or nothing
    span.appendChild(tpl.content.cloneNode(true));
    span.setAttribute("data-fw-site-rich", "");
  }

  function openFor(id) {
    var el = id && document.getElementById(id);
    if (!el) return false;
    var fold = el.closest("details.fw-site-fold"), entry = el.closest(".fw-site-entry");
    if (!fold && entry) fold = entry.querySelector("details.fw-site-fold");
    if (!fold || fold.open) return false;
    fold.open = true;
    return true;
  }
  function hashId() {
    var h = (window.location.hash || "").slice(1);
    try { return decodeURIComponent(h); } catch (e) { return h; }
  }
  if (document.querySelector("details.fw-site-fold")) {
    openFor(hashId());   // before the browser scrolls to the target, so it lands on an open fold
    window.addEventListener("hashchange", function () {
      var id = hashId();
      if (openFor(id)) document.getElementById(id).scrollIntoView();
    });
    var printOpened = [];
    window.addEventListener("beforeprint", function () {
      Array.prototype.forEach.call(document.querySelectorAll("details.fw-site-fold:not([open])"), function (d) {
        d.open = true;
        printOpened.push(d);
      });
    });
    window.addEventListener("afterprint", function () {
      printOpened.forEach(function (d) { d.open = false; });
      printOpened = [];
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var choice = t.closest(".fw-choice__opt") && t.closest("[data-fw-choice]");
    if (choice) {
      var pressed = choice.querySelector('.fw-choice__opt[aria-pressed="true"]');
      if (pressed) richen(choice.querySelector("[data-fw-fb]"), pressed.parentNode.querySelector("template[data-fw-site-rich]"),
        pressed.getAttribute("data-fb"));
      return;
    }
    var q = t.closest("[data-fw-check]") && t.closest(".fw-quiz__q");
    if (q) {
      if (/^(right|wrong)$/.test(q.getAttribute("data-state") || "")) {
        richen(q.querySelector("[data-fw-fb]"), q.querySelector("template[data-fw-site-rich]"), q.getAttribute("data-why"));
      }
      return;
    }
    var a = t.closest('a[href^="#"]');
    if (a) openFor(a.getAttribute("href").slice(1));
  });

  var strip = document.querySelector(".fw-site-chapter .fw-rail__nav");
  if (strip && "ResizeObserver" in window) {
    new ResizeObserver(function () {
      docEl.style.setProperty("--fw-site-strip", Math.round(strip.getBoundingClientRect().height) + "px");
    }).observe(strip);
  }
  var stations = strip && strip.querySelector(".fw-rail__list");
  if (stations && "MutationObserver" in window) {
    var keepInView = function () {
      var cur = stations.querySelector(".fw-rail__item--current");
      if (!cur || stations.scrollWidth <= stations.clientWidth + 1) return;
      var left = cur.offsetLeft - (stations.clientWidth - cur.offsetWidth) / 2;
      stations.scrollLeft = Math.max(0, Math.min(left, stations.scrollWidth - stations.clientWidth));
    };
    new MutationObserver(keepInView).observe(stations, { subtree: true, attributes: true, attributeFilter: ["class"] });
    keepInView();
  }

  function usd(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    if (!isFinite(v) || Math.abs(v) >= 1e12) return "USD " + (v < 0 ? "-" : "") + "999,999,999,999+";
    return "USD " + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function num(input) {
    var v = parseFloat(String(input && input.value || "").replace(",", "."));
    return isFinite(v) ? v : NaN;
  }

  var sims = [];
  Array.prototype.forEach.call(document.querySelectorAll("[data-fw-drainsim]"), function (root) {
    var q = function (s) { return root.querySelector(s); };
    var WALLET = parseFloat(root.getAttribute("data-wallet")) || 200;
    var EVERY = Math.max(1, parseFloat(root.getAttribute("data-every")) || 2) * 1000;
    var limitIn = q("[data-fw-sim-limit]"), gifts = q("[data-fw-sim-gifts]");
    var totalOut = q("[data-fw-sim-total]"), limitOut = q("[data-fw-sim-limitv]"), walletOut = q("[data-fw-sim-wallet]");
    var fill = q("[data-fw-sim-fill]"), nextOut = q("[data-fw-sim-next]"), status = q("[data-fw-sim-status]");
    var log = q("[data-fw-sim-log]"), pauseBtn = q("[data-fw-sim-pause]"), pauseLabel = q("[data-fw-sim-pauselabel]");
    var s = { state: "idle", total: 0, wallet: WALLET, limit: num(limitIn) || 0, price: 0, name: "", count: 0,
      left: EVERY, timer: 0, last: 0 };

    function gift() {
      var r = gifts.querySelector("input:checked") || gifts.querySelector("input");
      return { price: parseFloat(r.value) || 0, name: r.getAttribute("data-name") || "Gift" };
    }
    function say(words) { status.textContent = words; }
    function draw() {
      totalOut.textContent = usd(s.total);
      limitOut.textContent = s.limit > 0 ? usd(s.limit) : "Not set";
      walletOut.textContent = usd(s.wallet);
      fill.style.transform = "scaleX(" + (s.limit > 0 ? Math.min(1, s.total / s.limit) : 0) + ")";
      root.setAttribute("data-state", s.state);
      pauseBtn.setAttribute("aria-pressed", s.state === "paused" ? "true" : "false");
      pauseLabel.textContent = s.state === "paused" ? "Resume" : "Pause";
      gifts.disabled = s.state === "running" || s.state === "paused";
      if (s.state === "running") nextOut.textContent = "Next fake gift in " + Math.max(1, Math.ceil(s.left / 1000)) + " s.";
      else if (s.state === "paused") nextOut.textContent = "Paused. Nothing is sent while it's paused.";
      else nextOut.textContent = s.state === "stopped" ? "Stopped. Nothing is being sent." : "Not running.";
    }
    function halt() { clearInterval(s.timer); s.timer = 0; }
    function end(reason) {
      halt();
      s.state = "stopped";
      var did = s.count + (s.count === 1 ? " fake gift, " : " fake gifts, ") + usd(s.total) + " in all.";
      if (reason === "limit") say("Stopped at your limit. The next gift would have passed " + usd(s.limit) + ", so it wasn't sent. " + did);
      else if (reason === "below") say("Stopped. Your new limit, " + usd(s.limit) + ", is already below what was sent, so nothing more goes out. " + did);
      else if (reason === "wallet") say("Stopped. The fake wallet can't pay the next gift. " + did);
      else if (reason === "esc") say("Stopped with Esc. " + did + " Nothing else will be sent.");
      else say("Stopped. " + did + " Nothing else will be sent.");
      draw();
    }
    function tick() {
      var now = Date.now();
      s.left -= now - s.last;
      s.last = now;
      if (s.left <= 0) send();
      if (s.state === "running") draw();
    }
    function send() {
      if (s.total + s.price > s.limit + 1e-9) { end("limit"); return; }
      if (s.wallet + 1e-9 < s.price) { end("wallet"); return; }
      s.total += s.price;
      s.wallet -= s.price;
      s.count += 1;
      s.left = EVERY;
      var li = document.createElement("li");
      li.className = "fw-sim__logitem";
      li.textContent = "Gift " + s.count + ": " + s.name + ", " + usd(s.price) + ". Total " + usd(s.total) + ".";
      log.insertBefore(li, log.firstChild);
      while (log.children.length > 6) log.removeChild(log.lastChild);
      if (s.total + s.price > s.limit + 1e-9) end("limit");
      else if (s.wallet + 1e-9 < s.price) end("wallet");
      else draw();
    }
    function run() {
      s.state = "running";
      s.last = Date.now();
      halt();
      s.timer = setInterval(tick, 200);
      draw();
    }
    function pause(why) {
      halt();
      s.state = "paused";
      say(why || "Paused. Press Resume to go on, or Stop to end it.");
      draw();
    }

    q("[data-fw-sim-start]").addEventListener("click", function () {
      if (s.state === "running") { say("It's already running. Pause and Stop are right here."); return; }
      if (s.state === "paused") { say("It's paused. Press Resume to go on, or Stop to end it."); return; }
      var g = gift(), lim = num(limitIn);
      if (!(lim > 0)) { say("Set a limit first. Nothing starts without one."); limitIn.focus(); return; }
      if (lim < g.price) { say("Your limit is lower than one gift, so nothing would be sent. Pick a smaller gift or a higher limit."); return; }
      if (s.wallet + 1e-9 < g.price) { say("The fake wallet can't pay this gift. Refill it first."); return; }
      s.limit = lim;
      s.price = g.price;
      s.name = g.name;
      s.total = 0;
      s.count = 0;
      s.left = EVERY;
      log.innerHTML = "";
      say("Running. One fake gift every " + EVERY / 1000 + " seconds, until " + usd(s.limit) + ".");
      run();
    });
    pauseBtn.addEventListener("click", function () {
      if (s.state === "running") pause();
      else if (s.state === "paused") { say("Running again."); run(); }
      else say("Nothing is running, so there's nothing to pause.");
    });
    q("[data-fw-sim-stop]").addEventListener("click", function () {
      if (s.state === "running" || s.state === "paused") end("user");
      else if (s.state === "stopped") say("It's already stopped. Nothing is being sent.");
      else say("Nothing is running. Stop works at any time, before, during and after.");
    });
    q("[data-fw-sim-reset]").addEventListener("click", function () {
      if (s.state === "running" || s.state === "paused") { say("Stop it first. The wallet refills only when nothing runs."); return; }
      s.wallet = WALLET;
      s.total = 0;
      s.count = 0;
      log.innerHTML = "";
      s.state = "idle";
      say("The fake wallet is full again: " + usd(WALLET) + ".");
      draw();
    });
    limitIn.addEventListener("change", function () {
      var v = num(limitIn);
      if (s.state === "running" || s.state === "paused") {
        if (!(v > 0) || v >= s.limit) {
          limitIn.value = String(s.limit);
          if (v > s.limit) say("While it runs, a limit only goes down. Stop it first if you want a higher one.");
          return;
        }
        s.limit = v;
        if (s.total >= s.limit - 1e-9) { end("below"); return; }
        if (s.total + s.price > s.limit + 1e-9) { end("limit"); return; }
        say("Limit lowered to " + usd(s.limit) + ". It applies now.");
        draw();
        return;
      }
      if (v > 0) { s.limit = v; draw(); }
    });
    var api = {
      busy: function () { return s.state === "running" || s.state === "paused"; },
      stop: function () { end("esc"); },
      hide: function () { if (s.state === "running") pause("Paused because you left the page. Press Resume to go on."); }
    };
    sims.push(api);
    draw();
  });
  if (sims.length) {
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      sims.forEach(function (x) { if (x.busy()) x.stop(); });
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) sims.forEach(function (x) { x.hide(); });
    });
  }

  var LEVEL_WORDS = ["", "basic", "good", "strong"];
  Array.prototype.forEach.call(document.querySelectorAll("[data-fw-planner]"), function (root) {
    var out = root.querySelector("[data-fw-plan-out]"), live = root.querySelector("[data-fw-plan-live]");
    var budgetIn = root.querySelector("[data-fw-plan-budget]");
    var needBoxes = Array.prototype.slice.call(root.querySelectorAll("[data-fw-plan-need]"));
    var labels = {};
    needBoxes.forEach(function (b) { labels[b.value] = b.parentNode.textContent.trim(); });
    var usageIn = {}, units = {};
    Array.prototype.forEach.call(root.querySelectorAll("[data-fw-plan-usage]"), function (i) {
      usageIn[i.getAttribute("data-fw-plan-usage")] = i;
      units[i.getAttribute("data-fw-plan-usage")] = i.getAttribute("data-unit") || "unit";
    });
    var onceIn = Array.prototype.slice.call(root.querySelectorAll("[data-fw-plan-once]"));
    var items = Array.prototype.map.call(root.querySelectorAll("[data-fw-plan-item]"), function (li) {
      var covers = {};
      (li.getAttribute("data-covers") || "").split(/\s+/).forEach(function (p) {
        var kv = p.split(":");
        if (kv.length === 2) covers[kv[0]] = parseInt(kv[1], 10) || 0;
      });
      var tpl = li.querySelector("template[data-fw-plan-flat]");
      return { id: li.getAttribute("data-id"), name: li.getAttribute("data-name"), price: parseFloat(li.getAttribute("data-price")) || 0,
        per: li.getAttribute("data-per") || "", covers: covers, note: tpl ? tpl.innerHTML : "" };
    });
    var liveTimer = 0;

    function monthly(it) {
      if (!it.per) return it.price;
      var n = num(usageIn[it.per]);
      return it.price * (n > 0 ? n : 0);
    }
    function pick(ticked, budget) {
      var rel = items.filter(function (it) { return ticked.some(function (k) { return it.covers[k]; }); });
      var best = null, cheap = null, m = rel.length;
      for (var mask = 1; mask < (1 << m); mask++) {
        var cost = 0, score = 0, n = 0, ok = true, set = [];
        for (var i = 0; i < m; i++) if (mask & (1 << i)) { cost += monthly(rel[i]); n++; set.push(rel[i]); }
        for (var k = 0; k < ticked.length && ok; k++) {
          var top = 0;
          set.forEach(function (it) { top = Math.max(top, it.covers[ticked[k]] || 0); });
          if (!top) ok = false;
          score += top;
        }
        if (!ok) continue;
        var c = { set: set, cost: cost, score: score, n: n };
        if (!cheap || cost < cheap.cost - 1e-9 || (Math.abs(cost - cheap.cost) < 1e-9 && (score > cheap.score || (score === cheap.score && n < cheap.n)))) cheap = c;
        if (cost <= budget + 1e-9 && (!best || score > best.score || (score === best.score && (cost < best.cost - 1e-9 ||
            (Math.abs(cost - best.cost) < 1e-9 && n < best.n))))) best = c;
      }
      return { best: best, cheap: cheap };
    }
    function row(it, ticked) {
      var cost = monthly(it), how;
      if (it.per) {
        var n = num(usageIn[it.per]);
        how = usd(it.price) + " per " + units[it.per] + ", times " + (n > 0 ? n : 0) + ": " + usd(cost) + " a month";
      } else how = cost === 0 ? "Free" : usd(cost) + " a month";
      var does = ticked.filter(function (k) { return it.covers[k]; }).map(function (k) {
        return esc(labels[k]) + " (" + LEVEL_WORDS[it.covers[k]] + ")";
      }).join(", ");
      return '<li class="fw-plan__pick"><p class="fw-plan__pname"><strong>' + esc(it.name) + '</strong><span class="fw-plan__pcost">' +
        esc(how) + '</span></p><p class="fw-plan__pfor">Covers: ' + does + '</p><p class="fw-plan__pnote">' + it.note + "</p></li>";
    }
    function compute() {
      var ticked = needBoxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-fw-plan-for]"), function (f) {
        f.hidden = ticked.indexOf(f.getAttribute("data-fw-plan-for")) < 0;
      });
      var budget = num(budgetIn);
      if (!(budget >= 0)) budget = 0;
      var said;
      if (!ticked.length) {
        out.innerHTML = '<p class="fw-plan__empty">Tick what you need to see a set of tools.</p>';
        said = "Nothing ticked yet.";
      } else {
        var r = pick(ticked, budget), html = "", c = r.best || r.cheap;
        if (!c) {
          html = '<p class="fw-plan__empty">No option in this list covers what you ticked.</p>';
          said = html.replace(/<[^>]+>/g, "");
        } else {
          if (r.best) {
            html += '<p class="fw-plan__k">Your set</p>';
            html += '<p class="fw-plan__total"><span class="fw-plan__totalv">' + usd(c.cost) + '</span> <span class="fw-plan__totalk">a month</span></p>';
            html += '<p class="fw-plan__fits">' + (budget - c.cost < 0.005 ? "That uses your whole amount." : usd(budget - c.cost) + " of your amount is left.") + "</p>";
            if (r.cheap && r.cheap.cost < c.cost - 0.005) {
              html += '<p class="fw-plan__fits">The cheapest set that covers the same needs costs ' + usd(r.cheap.cost) +
                " a month: " + r.cheap.set.map(function (it) { return esc(it.name); }).join(", ") + ".</p>";
            }
            said = "Your set: " + c.n + (c.n === 1 ? " option, " : " options, ") + usd(c.cost) + " a month, within your amount.";
          } else {
            html += '<p class="fw-plan__k">Over your amount</p>';
            html += '<p class="fw-plan__total fw-plan__total--over"><span class="fw-plan__totalv">' + usd(c.cost) + '</span> <span class="fw-plan__totalk">a month</span></p>';
            html += '<p class="fw-plan__fits">The cheapest set that covers what you ticked costs ' + usd(c.cost - budget) +
              " more than your " + usd(budget) + ". Untick something, or lower the images or seconds of video.</p>";
            said = "Over your amount by " + usd(c.cost - budget) + ". The cheapest set costs " + usd(c.cost) + " a month.";
          }
          html += '<ul class="fw-plan__picks">' + c.set.map(function (it) { return row(it, ticked); }).join("") + "</ul>";
        }
        var once = onceIn.filter(function (i) { return ticked.indexOf(i.getAttribute("data-fw-plan-once")) >= 0; });
        if (once.length) {
          html += '<div class="fw-plan__once"><p class="fw-plan__k">One time, not in the monthly total</p><ul>' + once.map(function (i) {
            var v = num(i);
            return "<li>" + esc(i.getAttribute("data-label")) + ": " + (v >= 0 ? usd(v) : "type the price you were quoted") + "</li>";
          }).join("") + "</ul></div>";
        }
        out.innerHTML = html;
      }
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () { live.textContent = said; }, 600);
    }
    root.addEventListener("input", compute);
    root.addEventListener("change", compute);
    compute();
  });

  var page = document.querySelector("[data-fw-search-page]");
  if (!page) return;
  var form = page.querySelector("[data-fw-search-form]");
  var input = page.querySelector("#fw-search-page-input");
  var status = page.querySelector("[data-fw-search-status]");
  var list = page.querySelector("[data-fw-search-results]");
  var headInput = document.getElementById("fw-search-input");
  var START = status.textContent;
  function norm(s) { return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  var INDEX = (window.FW_SEARCH_INDEX || []).map(function (e) {
    return { e: e, t: norm(e.t), s: norm(e.s), c: norm(e.c) };
  });
  var KIND_RANK = { Chapter: 3, Word: 2, Category: 2, Section: 1 };
  function words(q) { return norm(q).split(/[^a-z0-9]+/).filter(Boolean); }
  function find(q) {
    var w = words(q);
    if (!w.length) return [];
    var out = [];
    INDEX.forEach(function (x) {
      var hay = x.t + " " + x.s + " " + x.c;
      for (var i = 0; i < w.length; i++) if (hay.indexOf(w[i]) < 0) return;
      var score = KIND_RANK[x.e.k] || 0;
      w.forEach(function (wd) {
        if (x.t.indexOf(wd) === 0) score += 6; else if (x.t.indexOf(wd) >= 0) score += 4;
        if (x.s.indexOf(wd) >= 0) score += 1;
      });
      out.push({ x: x, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score || a.x.e.t.localeCompare(b.x.e.t); });
    return out.slice(0, 60);
  }
  function mark(textRaw, w) {
    var s = String(textRaw || ""), low = norm(s), hits = [];
    w.forEach(function (wd) {
      var i = low.indexOf(wd);
      while (i >= 0 && wd) { hits.push([i, i + wd.length]); i = low.indexOf(wd, i + wd.length); }
    });
    if (!hits.length || low.length !== s.length) return esc(s);
    hits.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", at = 0;
    hits.forEach(function (h) {
      if (h[0] < at) return;
      out += esc(s.slice(at, h[0])) + "<mark>" + esc(s.slice(h[0], h[1])) + "</mark>";
      at = h[1];
    });
    return out + esc(s.slice(at));
  }
  var timer = 0;
  function show(q, fromInput) {
    q = q.trim();
    if (input.value.trim() !== q && !fromInput) input.value = q;
    if (headInput && headInput.value.trim() !== q) headInput.value = q;
    if (!q) { status.textContent = START; list.innerHTML = ""; return; }
    var res = find(q), w = words(q);
    var shown = "“" + q + "”";
    status.textContent = res.length ? res.length + (res.length === 1 ? " result for " : " results for ") + shown + "."
      : "No result for " + shown + ". Try a shorter word.";
    list.innerHTML = res.map(function (r) {
      var e = r.x.e, ctx = e.k + (e.c ? " · " + e.c : "");
      return '<li class="fw-search-page__item"><p class="fw-search-page__kind">' + esc(ctx) + "</p>" +
        '<h2 class="fw-search-page__name"><a class="fw-search-page__link" href="' + esc(e.u) + '">' + mark(e.t, w) + "</a></h2>" +
        (e.s ? '<p class="fw-search-page__snip">' + mark(e.s, w) + "</p>" : "") + "</li>";
    }).join("");
  }
  function fromLocation() {
    var m = window.location.hash.match(/[#&]q=([^&]*)/) || window.location.search.match(/[?&]q=([^&]*)/);
    var q = "";
    if (m) { try { q = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { q = m[1]; } }
    return q;
  }
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = input.value.trim();
      show(q, true);
      try { history.replaceState(null, "", q ? "#q=" + encodeURIComponent(q) : window.location.pathname + window.location.search); } catch (e) { /* a file:// page may refuse */ }
    }, 120);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    show(q, true);
    try { history.replaceState(null, "", q ? "#q=" + encodeURIComponent(q) : window.location.pathname + window.location.search); } catch (err) { /* ignore */ }
  });
  window.addEventListener("hashchange", function () { show(fromLocation(), false); });
  show(fromLocation(), false);
})();
