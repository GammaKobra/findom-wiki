(function () {
  "use strict";
  var page = document.querySelector('.fw-fpage[data-form="frise"]');
  if (!page) return;
  var each = function (sel, fn, root) { Array.prototype.forEach.call((root || page).querySelectorAll(sel), fn); };
  var motionOK = function () {
    return window.FW && typeof FW.motionOK === "function" ? FW.motionOK()
      : !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };
  var EN_DASH = String.fromCharCode(0x2013), FIGURE_SPACE = String.fromCharCode(0x2007);

  var years = [];
  each(".fw-timeline", function (box) {
    var wrap = box.querySelector(".fw-timeline__wrap");
    var title = box.querySelector(".fw-timeline__title");
    each(".fw-timeline__name", function (n) {
      var m = n.textContent.match(/\b(1[89]\d\d|20\d\d)\b/);
      if (m) years.push(+m[1]);
    }, box);
    if (!wrap) return;
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", (title ? title.textContent.trim() : "Timeline") + ", scrolls sideways");
    var flag = function () {
      if (wrap.scrollWidth > wrap.clientWidth + 4) box.setAttribute("data-ff-scroll", "");
      else box.removeAttribute("data-ff-scroll");
    };
    flag();
    if ("ResizeObserver" in window) new ResizeObserver(flag).observe(wrap);
  });

  if (years.length > 1) {
    var lo = Math.min.apply(null, years), hi = Math.max.apply(null, years);
    var rec = page.querySelector(".fw-fhero__record");
    if (rec && lo !== hi && !rec.querySelector('[data-rec="span"]')) {
      var row = document.createElement("div");
      row.className = "fw-fhero__rec";
      row.setAttribute("data-rec", "span");
      row.innerHTML = "<dt>Span</dt><dd>" + lo + EN_DASH + hi + "</dd>";
      rec.appendChild(row);
    }
  }

  var money = String.fromCharCode(0x20ac, 0xa3, 0x2212);
  var FIG = new RegExp("^[\\s$~<>+\\-" + money + "]*(USD|EUR|GBP)?\\s*[\\d.,]+\\s*(%|k|m|bn)?", "i");
  each(".fw-table td, .fw-compare__grid td", function (td) {
    var t = td.textContent.trim();
    if (t.length <= 28 && FIG.test(t) && /\d/.test(t)) td.classList.add("ff-fig");
  });

  var NUM = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
  var counters = [];
  each(".fw-stat__n", function (el) {
    if (el.children.length) return;
    var text = el.textContent;
    var parts = [], last = 0, m, any = false;
    NUM.lastIndex = 0;
    while ((m = NUM.exec(text))) {
      var raw = m[0], val = parseFloat(raw.replace(/,/g, ""));
      var dec = raw.indexOf(".") >= 0 ? raw.split(".")[1].length : 0;
      var year = !dec && raw.indexOf(",") < 0 && val >= 1800 && val <= 2100;
      parts.push(text.slice(last, m.index));
      parts.push({ to: val, from: year ? val - 30 : 0, dec: dec, comma: raw.indexOf(",") >= 0, len: raw.length });
      last = m.index + raw.length;
      if (val > 0) any = true;
    }
    parts.push(text.slice(last));
    if (any) counters.push({ el: el, text: text, parts: parts });
  });
  if (!counters.length || !motionOK() || !("IntersectionObserver" in window)) return;

  var fmt = function (p, v) {
    var s = v.toFixed(p.dec);
    if (p.comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    while (s.length < p.len) s = FIGURE_SPACE + s;
    return s;
  };
  var paint = function (c, k) {
    c.out.textContent = c.parts.map(function (p) {
      return typeof p === "string" ? p : fmt(p, p.from + (p.to - p.from) * k);
    }).join("");
  };
  counters.forEach(function (c) {
    c.el.textContent = "";
    c.out = document.createElement("span");
    c.out.className = "ff-count";
    c.out.setAttribute("aria-hidden", "true");
    var said = document.createElement("span");
    said.className = "fw-visually-hidden";
    said.textContent = c.text;
    c.el.appendChild(c.out);
    c.el.appendChild(said);
    c.out.textContent = c.text;
    if (c.text.length <= 14) c.out.style.minWidth = Math.ceil(c.out.getBoundingClientRect().width) + "px";
  });

  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var finish = function (c) { c.done = true; paint(c, 1); };
  var run = function (c) {
    if (c.done) return;
    c.done = true;
    var t0 = null, dur = 1300;
    var step = function (now) {
      if (t0 === null) t0 = now;
      var t = Math.min(1, (now - t0) / dur);
      if (!motionOK()) t = 1;
      paint(c, ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  var byEl = function (el, fn) { counters.forEach(function (c) { if (c.el === el) fn(c); }); };
  if (window.FW && FW.onMotion) FW.onMotion(function (on) { if (!on) counters.forEach(finish); });
  window.addEventListener("beforeprint", function () { counters.forEach(finish); });
  var near = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      near.unobserve(en.target);
      byEl(en.target, function (c) { if (!c.done) paint(c, 0); });
    });
  }, { rootMargin: "0px 0px 40% 0px" });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      byEl(en.target, run);
    });
  }, { threshold: 0.6 });
  counters.forEach(function (c) { near.observe(c.el); io.observe(c.el); });
})();
