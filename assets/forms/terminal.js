(function () {
  "use strict";
  var root = document.documentElement;
  if (root.getAttribute("data-form") !== "terminal") return;
  var page = document.querySelector(".fw-fpage");
  if (!page) return;

  function motionOK() { return false; }
  function each(sel, fn, scope) { Array.prototype.forEach.call((scope || page).querySelectorAll(sel), fn); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function slug(text, max) {
    var s = String(text || "").toLowerCase().replace(/[‘’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (max && s.length > max) {
      var cut = s.slice(0, max), at = cut.lastIndexOf("-");
      s = at > 8 ? cut.slice(0, at) : cut;
    }
    return s;
  }
  function once(node, fn, threshold) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: threshold || 0.35 });
    io.observe(node);
  }
  var stoppers = [];
  if (window.FW && typeof window.FW.onMotion === "function") {
    window.FW.onMotion(function (ok) { if (!ok) stoppers.slice().forEach(function (f) { f(); }); });
  }

  var file = (location.pathname.split("/").pop() || "").replace(/\.html?$/i, "") || slug(page.getAttribute("data-chapter"));

  var hero = page.querySelector(".fw-fhero");
  var title = hero && hero.querySelector(".fw-fhero__title");
  if (title) {
    var cmd = el("p", "tm-cmd");
    cmd.setAttribute("aria-hidden", "true");
    var typed = el("span", "tm-cmd__typed");
    cmd.appendChild(el("span", "tm-cmd__p", "~$"));
    cmd.appendChild(document.createTextNode(" "));
    cmd.appendChild(typed);
    cmd.appendChild(el("span", "tm-cmd__cur"));
    title.parentNode.insertBefore(cmd, title);
    var line = "open " + file;
    if (!motionOK()) {
      typed.textContent = line;
      cmd.classList.add("is-done");
    } else {
      var k = 0, timer = 0;
      var finish = function () { clearTimeout(timer); typed.textContent = line; cmd.classList.add("is-done"); };
      stoppers.push(finish);
      (function step() {
        typed.textContent = line.slice(0, ++k);
        if (k < line.length) timer = setTimeout(step, 46); else cmd.classList.add("is-done");
      })();
    }
  }

  var fig = hero && hero.querySelector(".fw-fhero__fig");
  if (fig) {
    var img = fig.querySelector("img");
    var src = img ? (img.getAttribute("src") || "").split("?")[0].split("/").pop() : "";
    fig.setAttribute("data-tm-ls", "ls cover/  " + (src || "cover.webp"));
  }

  var nav = page.querySelector(".fw-rail__nav");
  if (nav) nav.setAttribute("data-tm-path", "~/" + file);

  each("section.fw-fsec", function (sec) {
    var h2 = sec.querySelector(".fw-prose > h2.fw-fsec__title");
    if (!h2) return;
    var n = sec.getAttribute("data-section") || "";
    if (n.length === 1) n = "0" + n;
    h2.setAttribute("data-tm-path", "~/" + n + "-" + slug(sec.id, 34));
  });

  var live = el("span", "fw-visually-hidden");
  live.setAttribute("aria-live", "polite");
  page.appendChild(live);
  function say(text) { live.textContent = ""; setTimeout(function () { live.textContent = text; }, 30); }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = el("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error("copy"));
    });
  }
  each(".fw-steps", function (box) {
    var head = box.querySelector(".fw-steps__head");
    var items = box.querySelectorAll(".fw-steps__item");
    if (!head || !items.length) return;
    var h = head.querySelector(".fw-steps__title");
    var name = slug(h ? h.textContent : "steps", 30) + ".md";
    box.classList.add("tm-file");
    var meta = el("span", "tm-file__meta", name + "  ·  " + items.length + (items.length === 1 ? " line" : " lines"));
    meta.setAttribute("aria-hidden", "true");
    var btn = el("button", "tm-copy", "copy");
    btn.type = "button";
    btn.setAttribute("aria-label", "Copy these steps" + (h ? ": " + h.textContent : ""));
    var reset = 0;
    btn.addEventListener("click", function () {
      var lines = [];
      Array.prototype.forEach.call(items, function (li, i) {
        var t = li.querySelector(".fw-steps__text");
        var c = t ? t.cloneNode(true) : null;
        if (c) Array.prototype.forEach.call(c.querySelectorAll(".fw-ev, .fw-tip, .fw-visually-hidden"), function (x) { x.parentNode.removeChild(x); });
        lines.push((i + 1) + ". " + (c ? c.textContent : "").replace(/\s+/g, " ").trim());
      });
      copyText(lines.join("\n")).then(function () {
        btn.textContent = "copied"; btn.classList.add("is-done"); say("Copied");
      }, function () {
        btn.textContent = "copy failed"; say("Copy failed");
      }).then(function () {
        clearTimeout(reset);
        reset = setTimeout(function () { btn.textContent = "copy"; btn.classList.remove("is-done"); }, 1600);
      });
    });
    var bar = el("div", "tm-file__bar");
    bar.appendChild(meta);
    bar.appendChild(btn);
    head.appendChild(bar);
  });

  each(".fw-media", function (box) {
    var items = box.querySelectorAll(".fw-media__item");
    var h = box.querySelector(".fw-media__title");
    if (!items.length) return;
    var p = el("p", "tm-ls");
    p.setAttribute("aria-hidden", "true");
    p.appendChild(el("b", null, "~$"));
    p.appendChild(document.createTextNode(" ls " + slug(h ? h.textContent : "pictures", 24) + "/  "));
    p.appendChild(el("i", null, items.length + (items.length === 1 ? " item" : " items")));
    var grid = box.querySelector(".fw-media__grid") || items[0].parentNode;
    grid.parentNode.insertBefore(p, grid);
  });

  each(".fw-explain", function (box) {
    var items = box.querySelectorAll(".fw-explain__item");
    if (!items.length) return;
    var names = Array.prototype.map.call(items, function (it) {
      var n = it.querySelector(".fw-explain__name");
      return n ? n.textContent.replace(/\s+/g, " ").trim() : "";
    });
    var short = items.length <= 6 && names.every(function (n) { return n && n.length <= 26; });
    var targets = [];
    if (short) {
      box.classList.add("tm-explain--loop");
      var loop = el("p", "tm-loop");
      loop.setAttribute("aria-hidden", "true");
      var sec = box.closest("section.fw-fsec");
      var h2 = sec && sec.querySelector("h2");
      var cyclic = /step at a time|loop|cycle|again|routine/i.test((h2 ? h2.textContent : "") + " " + names.join(" "));
      names.forEach(function (n, i) {
        if (i) loop.appendChild(el("i", null, " → "));
        var words = slug(n).split("-").filter(function (x) { return x && !/^(a|an|the)$/.test(x); });
        var w = el("span", "tm-loop__w", words[0] || slug(n, 12));
        loop.appendChild(w);
        targets.push(w);
      });
      if (cyclic) loop.appendChild(el("i", null, " ↺"));
      var list = box.querySelector(".fw-explain__list");
      list.parentNode.insertBefore(loop, list);
    } else {
      box.classList.add("tm-explain--rows");
      Array.prototype.forEach.call(items, function (it) { targets.push(it); });
    }
    function lightAll() { targets.forEach(function (t) { t.classList.add("is-lit"); }); }
    if (!motionOK()) { lightAll(); return; }
    box.classList.add("tm-arm");
    var timers = [];
    stoppers.push(function () { timers.forEach(clearTimeout); lightAll(); });
    once(box, function () {
      if (!motionOK()) { lightAll(); return; }
      targets.forEach(function (t, i) {
        timers.push(setTimeout(function () { t.classList.add("is-lit"); }, i * 380));
      });
    }, 0.4);
  });

  each(".fw-chat.fw-site-chatmodel", function (box) {
    if (box.hasAttribute("data-fw-chat")) return;
    var rows = Array.prototype.slice.call(box.querySelectorAll(".fw-chat__row"));
    if (!rows.length) return;
    box.classList.add("tm-log");
    if (!motionOK()) return;
    rows.forEach(function (r) { r.classList.add("tm-wait"); });
    var timer = 0, done = false, current = null;
    function showAll() {
      done = true;
      clearTimeout(timer);
      if (current) current();
      rows.forEach(function (r) { r.classList.remove("tm-wait"); });
    }
    stoppers.push(showAll);
    once(box, function () {
      if (!motionOK()) { showAll(); return; }
      var n = 0;
      (function next() {
        if (done || n >= rows.length) { current = null; return; }
        var r = rows[n++];
        var text = r.querySelector(".fw-chat__text");
        r.classList.remove("tm-wait");
        if (!text) { timer = setTimeout(next, 120); return; }
        var full = text.textContent.replace(/\s+/g, " ").trim();
        var ghost = el("span", "tm-ghost");
        ghost.setAttribute("aria-hidden", "true");
        text.parentNode.insertBefore(ghost, text);
        text.classList.add("tm-hold");
        var k = 0, stepBy = Math.max(2, Math.ceil(full.length / 80));
        current = function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); text.classList.remove("tm-hold"); };
        (function type() {
          if (done) return;
          k += stepBy;
          ghost.textContent = full.slice(0, k);
          if (k < full.length) { timer = setTimeout(type, 14); return; }
          current();
          current = null;
          timer = setTimeout(next, 260);
        })();
      })();
    }, 0.3);
  });
})();
