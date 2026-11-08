(function () {
  "use strict";
  var page = document.querySelector('.fw-fpage[data-form="glossaire"]');
  if (!page) return;
  var flow = page.querySelector(".fw-rail__flow") || page.querySelector(".fw-fflow");
  if (!flow) return;

  var uid = 0;
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function motionOK() {
    if (window.FW && typeof window.FW.motionOK === "function") return window.FW.motionOK();
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function norm(s) {
    s = String(s || "").toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.replace(/[_\-‐-―]/g, " ").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  }
  function words(q) { return norm(q).split(" ").filter(Boolean); }
  function hits(text, ws) {
    for (var i = 0; i < ws.length; i++) if (text.indexOf(ws[i]) === -1) return false;
    return true;
  }
  var SKIP = ".fw-tip, .fw-ev, .fw-visually-hidden, script, style, svg, button";
  function textOf(node) {
    var out = [];
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out.push(c.nodeValue);
        else if (c.nodeType === 1 && !c.matches(SKIP)) walk(c);
      }
    })(node);
    return out.join(" ");
  }
  function initial(label) {
    var c = norm(label).replace(/^[^a-z0-9]+/, "").charAt(0);
    if (!c) return "";
    return /[0-9]/.test(c) ? "0-9" : c.toUpperCase();
  }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item"; }
  function ensureId(node, base) {
    if (!node.id) {
      var id = "glo-" + slug(base);
      while (document.getElementById(id)) id = "glo-" + slug(base) + "-" + (++uid);
      node.id = id;
    }
    node.classList.add("glo-target");
    return node.id;
  }

  function paint(node, orig, ws) {
    if (!ws.length) { if (node.textContent !== orig) node.textContent = orig; return; }
    var low = orig.toLowerCase().replace(/[_\-]/g, " ");
    var spans = [];
    ws.forEach(function (w) {
      var at = 0, i;
      while (w && (i = low.indexOf(w, at)) !== -1) { spans.push([i, i + w.length]); at = i + w.length; }
    });
    if (!spans.length) { node.textContent = orig; return; }
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [spans[0]];
    spans.slice(1).forEach(function (s) {
      var last = merged[merged.length - 1];
      if (s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push(s);
    });
    var frag = document.createDocumentFragment(), pos = 0;
    merged.forEach(function (s) {
      if (s[0] > pos) frag.appendChild(document.createTextNode(orig.slice(pos, s[0])));
      frag.appendChild(el("mark", "glo-hit", orig.slice(s[0], s[1])));
      pos = s[1];
    });
    if (pos < orig.length) frag.appendChild(document.createTextNode(orig.slice(pos)));
    node.textContent = "";
    node.appendChild(frag);
  }

  function flash(node) {
    if (!node) return;
    node.classList.remove("glo-flash", "glo-flash--off");
    void node.offsetWidth;
    node.classList.add("glo-flash");
    var still = !motionOK();
    window.setTimeout(function () { if (!still) node.classList.add("glo-flash--off"); }, 60);
    window.setTimeout(function () { node.classList.remove("glo-flash", "glo-flash--off"); }, still ? 1600 : 1900);
  }

  function addRecord(term, value) {
    var rec = page.querySelector(".fw-fhero__record");
    if (!rec) return;
    var row = el("div", "fw-fhero__rec");
    row.setAttribute("data-rec", "entries");
    row.appendChild(el("dt", null, term));
    row.appendChild(el("dd", null, String(value)));
    rec.appendChild(row);
  }

  var bar = el("div", "glo-bar");
  bar.setAttribute("role", "search");
  var find = el("div", "glo-bar__find");
  var qid = "glo-q";
  var label = el("label", "glo-bar__label", "Find");
  label.setAttribute("for", qid);
  var input = el("input", "glo-bar__input");
  input.type = "search";
  input.id = qid;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  var tail = el("div", "glo-bar__tail");
  var count = el("output", "glo-bar__count");
  count.setAttribute("for", qid);
  count.setAttribute("aria-live", "polite");
  var clear = el("button", "glo-bar__clear", "Clear");
  clear.type = "button";
  clear.hidden = true;
  tail.appendChild(count);
  tail.appendChild(clear);
  find.appendChild(label);
  find.appendChild(input);
  find.appendChild(tail);
  bar.appendChild(find);
  var none = el("p", "glo-none");
  none.hidden = true;
  none.setAttribute("role", "status");

  function setCount(shown, total, noun, filtered) {
    count.textContent = "";
    if (filtered) {
      count.appendChild(el("b", null, String(shown)));
      count.appendChild(document.createTextNode(" of " + total + " " + noun));
    } else {
      count.appendChild(document.createTextNode(total + " " + noun));
    }
  }
  function sayNone(q, noun) {
    none.textContent = "";
    none.appendChild(document.createTextNode("No " + noun + " matches "));
    none.appendChild(el("q", null, q));
    none.appendChild(document.createTextNode(". Try fewer letters, or clear the search."));
  }

  var stuckTop = 0, lastPiece = null;
  function measure() {
    var nav = page.querySelector(".fw-rail__nav");
    var railh = 0;
    if (nav && flow) {
      var n = nav.getBoundingClientRect(), f = flow.getBoundingClientRect();
      var cs = window.getComputedStyle(nav);
      if (cs.position === "sticky" && n.right > f.left + 8 && n.left < f.right - 8) railh = n.height;
    }
    var top = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--fw-top-offset")) || 0;
    stuckTop = top + railh;
    page.style.setProperty("--glo-railh", railh + "px");
    page.style.setProperty("--glo-barh", bar.offsetHeight + "px");
  }
  var ticking = false;
  function past() {
    ticking = false;
    var last = typeof lastPiece === "function" ? lastPiece() : lastPiece;
    if (!last) { bar.classList.remove("is-past"); return; }
    var b = last.getBoundingClientRect().bottom;
    bar.classList.toggle("is-past", b < stuckTop + bar.offsetHeight + 8);
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(past); } }, { passive: true });
  window.addEventListener("resize", function () { measure(); past(); });

  function scrollToNode(node) {
    if (!node) return;
    var y = node.getBoundingClientRect().top + window.pageYOffset - stuckTop - bar.offsetHeight - 18;
    try { window.scrollTo({ top: Math.max(0, y), behavior: "instant" }); } catch (e) { window.scrollTo(0, Math.max(0, y)); }
  }
  var LETTERS = ["0-9"].concat("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

  var dictBlock = page.querySelector('.fw-site-block[data-kind="entries"]');
  if (dictBlock && dictBlock.querySelector(".fw-site-entry")) {
    var entries = Array.prototype.map.call(dictBlock.querySelectorAll(".fw-site-entry"), function (art) {
      var w = art.querySelector(".fw-site-entry__word");
      return { el: art, word: w, orig: w ? w.textContent : "", text: norm(textOf(art)), group: art.closest(".fw-site-letter") };
    });
    var groups = Array.prototype.slice.call(dictBlock.querySelectorAll(".fw-site-letter"));
    groups.forEach(function (g) {
      var k = g.querySelector(".fw-site-letter__k");
      var n = g.querySelectorAll(".fw-site-entry").length;
      if (k) {
        var tag = el("span", "glo-n");
        tag.setAttribute("aria-hidden", "true");
        tag.appendChild(el("b", null, String(n)));
        tag.appendChild(document.createTextNode(n === 1 ? " word" : " words"));
        k.appendChild(tag);
      }
    });
    addRecord("Words", entries.length);
    input.placeholder = "a word, or part of its meaning";
    bar.setAttribute("aria-label", "Find a word in the dictionary");

    var letters = dictBlock.querySelector("nav.fw-site-letters");
    if (letters) {
      letters.classList.add("glo-az");
      bar.appendChild(letters);
    }
    var list = dictBlock.querySelector(".fw-site-entries");
    dictBlock.insertBefore(bar, dictBlock.firstChild);
    dictBlock.insertBefore(none, list || bar.nextSibling);
    var links = letters ? Array.prototype.slice.call(letters.querySelectorAll("a.fw-site-letters__link")) : [];
    var linkFor = {};
    links.forEach(function (a) { linkFor[(a.getAttribute("href") || "").slice(1)] = a; });

    var applyDict = function () {
      var q = input.value, ws = words(q), shown = 0;
      entries.forEach(function (e) {
        var ok = !ws.length || hits(e.text, ws);
        e.el.classList.toggle("glo-out", !ok);
        if (ok) shown++;
        if (e.word) paint(e.word, e.orig, ok ? ws : []);
      });
      groups.forEach(function (g) {
        var any = !!g.querySelector(".fw-site-entry:not(.glo-out)");
        g.classList.toggle("glo-out", !any);
        var k = g.querySelector(".fw-site-letter__k");
        var a = k && linkFor[k.id];
        if (a) {
          if (any) { a.removeAttribute("aria-disabled"); a.removeAttribute("tabindex"); }
          else { a.setAttribute("aria-disabled", "true"); a.setAttribute("tabindex", "-1"); }
        }
      });
      setCount(shown, entries.length, "words", ws.length > 0);
      clear.hidden = !q;
      if (ws.length && !shown) { sayNone(q.trim(), "word"); none.hidden = false; } else none.hidden = true;
    };
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (a.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
        var t = document.getElementById((a.getAttribute("href") || "").slice(1));
        if (t) { e.preventDefault(); scrollToNode(t); if (history.replaceState) history.replaceState(null, "", "#" + t.id); setCurrent(a); }
      });
    });
    var setCurrent = function (a) {
      links.forEach(function (x) { if (x === a) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
    };
    var spy = function () {
      var line = stuckTop + bar.offsetHeight + 40, cur = null;
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].classList.contains("glo-out")) continue;
        if (groups[i].getBoundingClientRect().top <= line) cur = groups[i]; else break;
      }
      var k = cur && cur.querySelector(".fw-site-letter__k");
      setCurrent(k ? linkFor[k.id] : null);
    };
    var spyTick = false;
    window.addEventListener("scroll", function () { if (!spyTick) { spyTick = true; window.requestAnimationFrame(function () { spyTick = false; spy(); }); } }, { passive: true });
    input.addEventListener("input", applyDict);
    clear.addEventListener("click", function () { input.value = ""; applyDict(); input.focus(); });
    input.addEventListener("keydown", function (e) { if ((e.key === "Escape" || e.key === "Esc") && input.value) { e.preventDefault(); input.value = ""; applyDict(); } });
    lastPiece = list || dictBlock;
    applyDict();
    measure();
    spy();
    past();
    return;
  }

  var tagBlocks = Array.prototype.filter.call(page.querySelectorAll('.fw-site-block[data-kind="compare"]'), function (b) {
    var head = b.querySelector(".fw-compare__grid thead tr");
    return head && head.children.length === 2 && b.querySelector(".fw-compare__grid tbody th[scope=row]");
  });
  if (tagBlocks.length >= 3) {
    var rows = [];
    var tables = tagBlocks.map(function (b) {
      b.classList.add("glo-tags");
      var sec = b.closest(".fw-fsec");
      if (sec) sec.classList.add("glo-target");
      var trs = Array.prototype.map.call(b.querySelectorAll(".fw-compare__grid tbody tr"), function (tr) {
        var th = tr.querySelector("th");
        var r = { el: tr, word: th, orig: th ? th.textContent : "", text: norm(textOf(tr)), first: initial(th ? th.textContent : "") };
        rows.push(r);
        return r;
      });
      var tally = el("p", "glo-tally");
      tally.setAttribute("aria-hidden", "true");
      var cmp = b.querySelector(".fw-compare");
      b.insertBefore(tally, cmp);
      return { block: b, sec: sec, cmp: cmp, rows: trs, tally: tally };
    });
    addRecord("Tags", rows.length);
    input.placeholder = "a tag, or what it shows";
    bar.setAttribute("aria-label", "Find a tag");

    var az = el("nav", "glo-az");
    az.setAttribute("aria-label", "Tags by first letter");
    var ol = el("ol");
    var letterBtns = {};
    var have = {};
    rows.forEach(function (r) { have[r.first] = true; });
    var mk = function (key, text, cls) {
      var li = el("li");
      var b = el("button", cls || null, text);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      if (key !== "*" && !have[key]) { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
      if (key !== "*") b.setAttribute("aria-label", "Tags starting with " + (key === "0-9" ? "a digit" : key));
      else b.setAttribute("aria-label", "All tags");
      li.appendChild(b);
      ol.appendChild(li);
      letterBtns[key] = b;
      return b;
    };
    mk("*", "All", "glo-az__all");
    LETTERS.forEach(function (L) { if (L !== "0-9" || have["0-9"]) mk(L, L); });
    az.appendChild(ol);
    bar.appendChild(az);

    var firstSec = tables[0].sec || tables[0].block;
    firstSec.parentNode.insertBefore(bar, firstSec);
    bar.parentNode.insertBefore(none, firstSec);
    lastPiece = function () {
      for (var i = tables.length - 1; i >= 0; i--) {
        var s = tables[i].sec || tables[i].block;
        if (!s.classList.contains("glo-out")) return s;
      }
      return null;
    };

    var letter = "";
    var applyTags = function (jump) {
      var q = input.value, ws = words(q), shown = 0, filtered = ws.length > 0 || !!letter, firstHit = null;
      tables.forEach(function (t) {
        var n = 0;
        t.rows.forEach(function (r) {
          var ok = (!ws.length || hits(r.text, ws)) && (!letter || r.first === letter);
          r.el.classList.toggle("glo-out", !ok);
          if (r.word) paint(r.word, r.orig, ok ? ws : []);
          if (ok) n++;
        });
        shown += n;
        if (t.cmp) t.cmp.classList.toggle("glo-out", n === 0);
        if (t.sec) {
          var key = t.sec.getAttribute("data-section");
          Array.prototype.forEach.call(flow.querySelectorAll('.fw-fsec[data-section="' + key + '"]'), function (s) {
            s.classList.toggle("glo-out", filtered && n === 0);
          });
        }
        t.tally.textContent = "";
        if (filtered) {
          if (n) { t.tally.appendChild(el("b", null, String(n))); t.tally.appendChild(document.createTextNode(" of " + t.rows.length + " tags")); }
          else t.tally.appendChild(document.createTextNode("No tag here matches"));
        } else {
          t.tally.appendChild(el("b", null, String(t.rows.length)));
          t.tally.appendChild(document.createTextNode(" tags"));
        }
        if (n && !firstHit) firstHit = t.sec || t.block;
      });
      Object.keys(letterBtns).forEach(function (k) {
        letterBtns[k].setAttribute("aria-pressed", (k === "*" ? !letter : k === letter) ? "true" : "false");
      });
      setCount(shown, rows.length, "tags", filtered);
      clear.hidden = !q && !letter;
      if (filtered && !shown) { sayNone(q.trim() || letter, "tag"); none.hidden = false; } else none.hidden = true;
      if (jump) {
        var target = firstHit || bar;
        var r = target.getBoundingClientRect();
        if (firstHit && (r.top < stuckTop + bar.offsetHeight || r.top > window.innerHeight * 0.6)) scrollToNode(firstHit);
      }
      past();
    };
    Object.keys(letterBtns).forEach(function (k) {
      letterBtns[k].addEventListener("click", function () {
        if (letterBtns[k].disabled) return;
        letter = (k === "*" || letter === k) ? "" : k;
        input.value = "";
        applyTags(true);
      });
    });
    input.addEventListener("input", function () { letter = ""; applyTags(true); });
    clear.addEventListener("click", function () { input.value = ""; letter = ""; applyTags(false); input.focus(); });
    input.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && (input.value || letter)) { e.preventDefault(); input.value = ""; letter = ""; applyTags(false); }
    });
    applyTags(false);
    measure();
    past();
    return;
  }

  var sections = Array.prototype.slice.call(flow.querySelectorAll("section.fw-fsec"));
  if (!sections.length) return;
  var items = [], seen = {};
  function partOf(node) {
    var s = node.closest(".fw-fsec");
    var n = s ? parseInt(s.getAttribute("data-section"), 10) : 0;
    return n ? "Part " + (n < 10 ? "0" + n : n) : "Opening";
  }
  function add(labelText, node, kind) {
    var t = String(labelText || "").replace(/\s+/g, " ").trim();
    var key = norm(t);
    if (!t || !key || seen[key] || !initial(t)) return;
    seen[key] = true;
    items.push({ label: t, key: key, id: ensureId(node, t), node: node, part: partOf(node), kind: kind, first: initial(t) });
  }
  sections.forEach(function (s) {
    Array.prototype.forEach.call(s.querySelectorAll(".fw-compare__grid tbody tr, .fw-table tbody tr"), function (tr) {
      var th = tr.querySelector("th");
      if (th) add(textOf(th), tr, "table");
    });
  });
  sections.forEach(function (s) {
    Array.prototype.forEach.call(s.querySelectorAll(".fw-prose h3"), function (h) { add(textOf(h), h, "section"); });
  });
  sections.forEach(function (s) {
    Array.prototype.forEach.call(s.querySelectorAll(".fw-term"), function (t) {
      var a = t.querySelector(".fw-term__btn");
      if (a) add(a.textContent, t, "term");
    });
  });
  if (items.length < 4) return;
  items.sort(function (a, b) { return a.key.localeCompare(b.key); });
  addRecord("Index", items.length);
  input.placeholder = "a kink, a word or a heading";
  bar.setAttribute("aria-label", "Find in the index of this chapter");

  bar.classList.add("glo-bar--index");
  var toggle = el("button", "glo-bar__toggle");
  toggle.type = "button";
  toggle.appendChild(document.createTextNode("Index"));
  toggle.appendChild(el("b", null, String(items.length)));
  toggle.setAttribute("aria-expanded", "false");
  tail.insertBefore(toggle, count);
  count.hidden = true;

  var panel = el("div", "glo-panel");
  panel.id = "glo-index";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Index of this chapter");
  panel.setAttribute("role", "region");
  toggle.setAttribute("aria-controls", panel.id);
  var cols = el("div", "glo-panel__cols");
  var byLetter = {};
  items.forEach(function (it) {
    var g = byLetter[it.first];
    if (!g) {
      g = { box: el("div", "glo-panel__group"), list: el("ul"), items: [] };
      var h = el("p", "glo-panel__k", it.first);
      h.setAttribute("aria-hidden", "true");
      g.box.appendChild(h);
      g.box.appendChild(g.list);
      cols.appendChild(g.box);
      byLetter[it.first] = g;
    }
    var li = el("li");
    var a = el("a", "glo-panel__link", it.label);
    a.href = "#" + it.id;
    var where = el("span", null, it.part);
    li.appendChild(a);
    li.appendChild(where);
    g.list.appendChild(li);
    it.li = li;
    it.a = a;
    g.items.push(it);
    a.addEventListener("click", function (e) {
      e.preventDefault();
      closePanel(false);
      scrollToNode(it.node);
      if (history.replaceState) history.replaceState(null, "", "#" + it.id);
      flash(it.node);
      var spot = it.kind === "term" ? (it.node.closest("p, li, td, th, h3, h4") || it.node.parentNode) : it.node;
      if (!spot.matches("a, button, input, [tabindex]")) { spot.setAttribute("tabindex", "-1"); spot.classList.add("glo-spot"); }
      try { spot.focus({ preventScroll: true }); } catch (err) { spot.focus(); }
    });
  });
  panel.appendChild(cols);

  var azI = el("nav", "glo-az");
  azI.setAttribute("aria-label", "Index by first letter");
  var olI = el("ol");
  var btnI = {};
  LETTERS.forEach(function (L) {
    if (L === "0-9" && !byLetter["0-9"]) return;
    var li = el("li");
    var b = el("button", null, L);
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-controls", panel.id);
    if (!byLetter[L]) { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
    else b.setAttribute("aria-label", "Index entries starting with " + L);
    li.appendChild(b);
    olI.appendChild(li);
    btnI[L] = b;
  });
  azI.appendChild(olI);
  bar.appendChild(azI);
  bar.appendChild(panel);

  var first = flow.querySelector(".fw-fsec--intro") || sections[0];
  first.parentNode.insertBefore(bar, first);
  lastPiece = sections[sections.length - 1];

  var pick = "";
  function applyIndex() {
    var ws = words(input.value), shown = 0;
    Object.keys(byLetter).forEach(function (L) {
      var g = byLetter[L], n = 0;
      g.items.forEach(function (it) {
        var ok = (!ws.length || hits(it.key, ws)) && (!pick || it.first === pick);
        it.li.classList.toggle("glo-out", !ok);
        paint(it.a, it.label, ok ? ws : []);
        if (ok) n++;
      });
      g.box.classList.toggle("glo-out", !n);
      shown += n;
    });
    Object.keys(btnI).forEach(function (L) { btnI[L].setAttribute("aria-pressed", L === pick ? "true" : "false"); });
    count.hidden = !(ws.length || pick);
    setCount(shown, items.length, "entries", true);
    clear.hidden = !input.value && !pick;
    if ((ws.length || pick) && !shown) { sayNone(input.value.trim(), "entry"); none.hidden = false; } else none.hidden = true;
  }
  function openPanel() {
    if (!panel.hidden) return;
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    measure();
  }
  function closePanel(refocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (pick) { pick = ""; applyIndex(); }
    measure();
    if (refocus) toggle.focus();
  }
  panel.appendChild(none);
  toggle.addEventListener("click", function () { if (panel.hidden) openPanel(); else closePanel(false); });
  Object.keys(btnI).forEach(function (L) {
    btnI[L].addEventListener("click", function () {
      if (btnI[L].disabled) return;
      pick = pick === L ? "" : L;
      input.value = "";
      applyIndex();
      openPanel();
      var g = byLetter[L];
      if (g && pick) panel.scrollTop = Math.max(0, g.box.offsetTop - panel.offsetTop - 4);
    });
  });
  input.addEventListener("input", function () { pick = ""; applyIndex(); openPanel(); panel.scrollTop = 0; });
  input.addEventListener("focus", function () { if (input.value) openPanel(); });
  clear.addEventListener("click", function () { input.value = ""; pick = ""; applyIndex(); input.focus(); });
  bar.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" && e.key !== "Esc") return;
    if (input.value || pick) { e.preventDefault(); input.value = ""; pick = ""; applyIndex(); if (document.activeElement !== input) closePanel(true); return; }
    if (!panel.hidden) { e.preventDefault(); closePanel(true); }
  });
  document.addEventListener("click", function (e) { if (!panel.hidden && !bar.contains(e.target)) closePanel(false); });
  applyIndex();
  measure();
  past();
})();
