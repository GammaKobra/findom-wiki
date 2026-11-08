(function () {
  "use strict";
  var root = document.documentElement;
  if (root.getAttribute("data-form") !== "dossier") return;
  var page = document.querySelector(".fw-fpage");
  if (!page) return;

  function motionOK() {
    if (window.FW && typeof window.FW.motionOK === "function") return window.FW.motionOK();
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function each(sel, fn) { Array.prototype.forEach.call(page.querySelectorAll(sel), fn); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var hero = page.querySelector(".fw-fhero");
  var rec = hero && hero.querySelector(".fw-fhero__record");
  var exhibits = page.querySelectorAll(".fw-table--tactic tbody .fw-table__row").length;
  if (rec) {
    var idDt = rec.querySelector('[data-rec="id"] > dt');
    if (idDt) idDt.textContent = "File";
    var addRec = function (key, dt, dd) {
      var row = el("div", "fw-fhero__rec");
      row.setAttribute("data-rec", key);
      row.appendChild(el("dt", null, dt));
      row.appendChild(el("dd", null, dd));
      rec.appendChild(row);
    };
    if (exhibits) addRec("exhibits", "Exhibits", String(exhibits));
    addRec("status", "Status", "Open");
  }
  var fig = hero && hero.querySelector(".fw-fhero__fig");
  if (fig) fig.setAttribute("data-ds-cap", "Exhibit 0 · " + (page.getAttribute("data-chapter") || ""));

  function stampWord(counter) {
    var t = (counter || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (/^(never|refuse|don’t|don't|do not|no\b|block|leave|walk away|stop|say no)/.test(t)) return "REFUSE";
    if (/^(ask|check|search|read|compare|look|verify|test|find|keep|write|save|note)/.test(t)) return "CHECK";
    return "RED FLAG";
  }
  var stamped = [];
  each(".fw-table--tactic tbody .fw-table__row", function (row) {
    var counter = row.querySelector(".fw-table__counter");
    var s = el("span", "ds-stamp", stampWord(counter ? counter.textContent : ""));
    s.setAttribute("aria-hidden", "true");
    row.appendChild(s);
    stamped.push(row);
  });

  var claims = Array.prototype.slice.call(page.querySelectorAll(".fw-myth .fw-myth__item"));

  var moving = stamped.concat(claims);
  if (!moving.length || !motionOK() || !("IntersectionObserver" in window)) return;
  moving.forEach(function (m) { m.classList.add("ds-arm"); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-seen");
      io.unobserve(e.target);
    });
  }, { threshold: 0.5, rootMargin: "0px 0px -8% 0px" });
  moving.forEach(function (m) { io.observe(m); });
  if (window.FW && typeof window.FW.onMotion === "function") {
    window.FW.onMotion(function (ok) {
      if (ok) return;
      io.disconnect();
      moving.forEach(function (m) { m.classList.add("is-seen"); });
    });
  }
})();
