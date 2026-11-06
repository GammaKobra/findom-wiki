/* Findom Wiki: the site script, for what the kit does not have. Copied by tools/build.py to site/assets/site.js and
   loaded before the vendor scripts and the kit, so the gate holds the focus from the start. One classic script,
   no module, no network, no fetch. It does these things:
     the 18+ gate      a veil over the page on the first visit (html.fw-gate-open, set by the head script); the rest of
                       the page is inert while it is open, so the focus stays inside; "I am 18 or older" is remembered
                       in localStorage (inside try/catch: if storage fails, the gate shows again on the next page)
     the header search sends the words to search.html, after the # so they never leave the browser
     print             no local address inside a PDF; every fold open on paper
     rich feedback     a scenario's feedback and a quiz explanation get back their terms, links and badges
     folds             a dictionary word or a folded claim reached by its anchor opens
     the strip         the height of a chapter's stepper strip, for what sticks or stops under it
     the search page   searches the generated index (window.FW_SEARCH_INDEX), as you type */
(function () {
  "use strict";
  var docEl = document.documentElement;
  var KEY = "fw-adult";

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ms(name) {
    var v = getComputedStyle(docEl).getPropertyValue(name).trim(), n = parseFloat(v) || 0;
    return /ms$/.test(v) ? n : n * 1000;
  }

  /* ============================================================ the 18+ gate */
  var gate = document.getElementById("fw-gate");
  if (gate && docEl.classList.contains("fw-gate-open")) {
    var dialog = gate.querySelector(".fw-gate__dialog");
    var yes = gate.querySelector("[data-fw-gate-yes]");
    var held = [document.querySelector(".fw-skip"), document.querySelector(".fw-top"),
      document.getElementById("fw-main"), document.querySelector(".fw-foot")].filter(Boolean);
    held.forEach(function (el) { el.setAttribute("inert", ""); });
    try { dialog.focus({ preventScroll: true }); } catch (e) { dialog.focus(); }
    // without inert support the focus is brought back from anywhere else
    document.addEventListener("focusin", function (e) {
      if (docEl.classList.contains("fw-gate-open") && !gate.contains(e.target)) dialog.focus();
    });
    yes.addEventListener("click", function () {
      try { window.localStorage.setItem(KEY, "yes"); } catch (e) { /* not stored: the gate comes back on the next page */ }
      held.forEach(function (el) { el.removeAttribute("inert"); });
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        docEl.classList.remove("fw-gate-open");
        gate.classList.remove("is-leaving");
        if (document.activeElement && gate.contains(document.activeElement)) document.activeElement.blur();
      }
      gate.classList.add("is-leaving");
      gate.addEventListener("transitionend", function (e) { if (e.target === gate) finish(); });
      setTimeout(finish, ms("--fw-dur-tip") + 60);
    });
  }

  /* ============================================================ the header search: open the search page */
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

  /* ============================================================ print: no local address inside a PDF */
  // A printed link keeps its address inside the PDF, and a link inside the wiki would carry the local folder of the
  // file. Before printing, every link that does not lead to the web gives up its address (its words stay); after
  // printing it gets it back. Outside links print their address as text (site.css).
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

  /* ============================================================ rich feedback in the exercises
     The kit's scripts write a scenario's feedback (data-fb) and a quiz explanation (data-why) as plain words. Right
     after, the same words come back with their dictionary terms, chapter links and evidence badges, from the template
     the build put beside each answer. The kit listens on the button and this script on the document, so this runs
     after the kit, in the same event: the live region announces the final words once. Anything else the kit wrote
     (an empty check, another wording) is left as it is. */
  function richen(fb, tpl, plainWords) {
    var span = fb && fb.lastElementChild;
    if (!tpl || !span || span.tagName !== "SPAN" || span.hasAttribute("data-fw-site-rich") || !plainWords) return;
    var said = span.textContent;
    if (said.slice(-plainWords.length) !== plainWords) return;
    span.textContent = said.slice(0, said.length - plainWords.length);   // "Right. ", "Not quite. " or nothing
    span.appendChild(tpl.content.cloneNode(true));
    span.setAttribute("data-fw-site-rich", "");
  }

  /* ============================================================ folds: what an anchor targets opens
     A dictionary word (the target is the word's entry: its "More about" opens) or anything inside a fold (a claim
     of a long Check it). Returns true when a fold had to open. */
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
    // on paper every fold is open (site.css does it in Chrome; this does it everywhere), then closes back
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
    // a link on the same page to a word or a folded claim opens it first, then the browser goes there (also when
    // the address already ends with that anchor)
    var a = t.closest('a[href^="#"]');
    if (a) openFor(a.getAttribute("href").slice(1));
  });

  /* ============================================================ the chapter's stepper strip (phone, tablet)
     Its height, so that an anchor and a tutorial's progress line stop below it (site.css, --fw-site-strip). */
  var strip = document.querySelector(".fw-site-chapter .fw-rail__nav");
  if (strip && "ResizeObserver" in window) {
    new ResizeObserver(function () {
      docEl.style.setProperty("--fw-site-strip", Math.round(strip.getBoundingClientRect().height) + "px");
    }).observe(strip);
  }
  // when more stations than fit scroll inside the strip, the current one stays in view (at once: it follows reading)
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

  /* ============================================================ the search page */
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
  // the words found, marked in the text (the text is escaped first)
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
