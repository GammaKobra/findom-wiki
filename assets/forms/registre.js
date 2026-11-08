(function () {
  "use strict";
  var page = document.querySelector('.fw-fpage[data-form="registre"]');
  if (!page) return;
  var FWo = window.FW || { motionOK: function () { return true; } };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var uid = 0;

  function plain(el) {
    var c = el.cloneNode(true);
    each(c.querySelectorAll(".fw-tip, .fw-ev, .rg-ink, .rg-pickcell"), function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, " ").trim();
  }
  var NUM = /^(?:USD|EUR|GBP|US\$|\$|€|£)?\s*(\d[\d,]*(?:\.\d+)?)/i;
  function numOf(s) { var m = NUM.exec(s); return m ? parseFloat(m[1].replace(/,/g, "")) : null; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  each(page.querySelectorAll(".fw-compare"), function (block) {
    var table = block.querySelector("table.fw-compare__grid");
    if (!table || !table.tBodies[0] || !table.tHead) return;
    var tbody = table.tBodies[0], headRow = table.tHead.rows[0];
    var rows = Array.prototype.slice.call(tbody.rows);
    if (rows.length < 2) return;
    var heads = Array.prototype.slice.call(headRow.cells);
    var ncol = heads.length, n = ++uid;
    block.classList.add("rg-ledger");

    var names = heads.map(function (h, i) { return plain(h) || (i === 0 ? "Name" : "Column " + (i + 1)); });
    var data = rows.map(function (r) { return Array.prototype.slice.call(r.cells).map(function (c) { var t = plain(c); return { t: t, n: numOf(t) }; }); });
    var kind = names.map(function (_, i) {
      if (i === 0) return "name";
      var vals = data.map(function (d) { return d[i] ? d[i].t : ""; });
      var nums = data.filter(function (d) { return d[i] && d[i].n !== null; }).length;
      if (nums >= 2 && nums * 2 >= rows.length) return "num";
      var distinct = vals.filter(function (v, k) { return vals.indexOf(v) === k; });
      var short = vals.every(function (v) { return v.length <= 28; });
      if (rows.length >= 4 && short && distinct.length >= 2 && distinct.length <= 5 && distinct.length < rows.length) return "cat";
      return "text";
    });

    kind.forEach(function (k, i) {
      if (k !== "num") return;
      var max = 0;
      data.forEach(function (d) { if (d[i] && d[i].n !== null && d[i].n > max) max = d[i].n; });
      rows.forEach(function (r, ri) {
        var c = r.cells[i], v = data[ri][i];
        if (!c || !v || v.n === null) return;
        c.classList.add("rg-num");
        var ink = el("span", "rg-ink"), bar = el("i");
        ink.setAttribute("aria-hidden", "true");
        bar.style.setProperty("--w", (max > 0 ? Math.max(1.5, v.n / max * 100) : 0).toFixed(1) + "%");
        ink.appendChild(bar);
        c.appendChild(ink);
      });
    });
    if (block.querySelector(".rg-ink")) {
      if (FWo.motionOK() && "IntersectionObserver" in window) {
        block.classList.add("rg-wait");
        var io = new IntersectionObserver(function (es) {
          if (es[0].isIntersecting) { block.classList.add("rg-seen"); io.disconnect(); }
        }, { threshold: 0.2 });
        io.observe(table);
      }
    }

    var sorters = [];
    var sortable = kind.map(function (k) { return k !== "text"; });
    function sortBy(i) {
      var cur = sorters.filter(function (s) { return s.i === i; })[0];
      var dir = cur && cur.dir === "asc" ? "desc" : "asc";
      sorters.forEach(function (s) {
        s.dir = s.i === i ? dir : null;
        s.btns.forEach(function (b) { if (s.dir) b.setAttribute("data-dir", s.dir); else b.removeAttribute("data-dir"); });
        if (s.th) { if (s.dir) s.th.setAttribute("aria-sort", s.dir === "asc" ? "ascending" : "descending"); else s.th.removeAttribute("aria-sort"); }
      });
      var order = rows.map(function (r, k) { return k; });
      order.sort(function (a, b) {
        var x = data[a][i], y = data[b][i], r;
        if (kind[i] === "num") {
          var xn = x ? x.n : null, yn = y ? y.n : null;
          if (xn === null && yn === null) r = 0;
          else if (xn === null) return 1;
          else if (yn === null) return -1;
          else r = xn - yn;
        } else r = (x ? x.t : "").localeCompare(y ? y.t : "", "en", { numeric: true });
        if (r === 0) r = a - b;
        return dir === "asc" ? r : -r;
      });
      order.forEach(function (k) { tbody.appendChild(rows[k]); });
    }
    heads.forEach(function (th, i) {
      if (!sortable[i]) return;
      var b = el("button", "rg-sort");
      b.type = "button";
      while (th.firstChild) b.appendChild(th.firstChild);
      th.appendChild(b);
      b.setAttribute("aria-label", "Sort by " + names[i]);
      b.addEventListener("click", function () { sortBy(i); });
      sorters.push({ i: i, th: th, btns: [b], dir: null });
    });

    var controls = el("div", "rg-controls");
    var cat = kind.indexOf("cat");
    var hidden = {};
    if (cat > 0) {
      var fg = el("div", "rg-filter");
      fg.setAttribute("role", "group");
      fg.setAttribute("aria-label", "Show rows by " + names[cat]);
      fg.appendChild(el("span", "rg-label", names[cat]));
      var vals = [];
      data.forEach(function (d) { var v = d[cat] ? d[cat].t : ""; if (v && vals.indexOf(v) < 0) vals.push(v); });
      var fbtns = [];
      ["all"].concat(vals).forEach(function (v) {
        var b = el("button", "rg-word", v === "all" ? "All" : v);
        b.type = "button";
        b.setAttribute("aria-pressed", v === "all" ? "true" : "false");
        b.addEventListener("click", function () {
          fbtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          rows.forEach(function (r, k) {
            var off = v !== "all" && (data[k][cat] ? data[k][cat].t : "") !== v;
            r.hidden = off;
            hidden[k] = off;
          });
          count.textContent = v === "all" ? "" : rows.filter(function (r) { return !r.hidden; }).length + " of " + rows.length + " rows";
        });
        fbtns.push(b);
        fg.appendChild(b);
      });
      var count = el("span", "rg-count");
      count.setAttribute("aria-live", "polite");
      fg.appendChild(count);
      controls.appendChild(fg);
    }
    var sg = el("div", "rg-sortwords");
    sg.setAttribute("aria-hidden", "true");
    sg.appendChild(el("span", "rg-label", "Sort"));
    sorters.forEach(function (s) {
      var b = el("button", "rg-word", names[s.i]);
      b.type = "button";
      b.tabIndex = -1;
      b.addEventListener("click", function () { sortBy(s.i); });
      s.btns.push(b);
      sg.appendChild(b);
    });
    if (sorters.length) controls.appendChild(sg);
    var first = block.querySelector(".fw-compare__cue") || block.querySelector(".fw-compare__box");
    block.insertBefore(controls, first);

    var boxes = rows.map(function (r, k) {
      var cell = r.cells[0], wrap = el("span", "rg-pickcell"), lab = el("label", "rg-pick"), cb = el("input");
      cb.type = "checkbox";
      cb.setAttribute("aria-label", "Compare " + (data[k][0] ? data[k][0].t : "row " + (k + 1)));
      lab.appendChild(cb);
      lab.appendChild(el("span", null, "compare"));
      wrap.appendChild(lab);
      cell.appendChild(wrap);
      return cb;
    });
    var side = el("section", "rg-side"), sideHead = el("div", "rg-side__head"), sideT = el("p", "rg-side__t");
    var clear = el("button", "rg-word rg-clear", "Clear");
    clear.type = "button";
    var cols = el("div", "rg-side__cols");
    side.setAttribute("aria-live", "polite");
    side.setAttribute("aria-label", "Picked rows side by side");
    side.hidden = true;
    sideHead.appendChild(sideT);
    sideHead.appendChild(clear);
    side.appendChild(sideHead);
    side.appendChild(cols);
    block.appendChild(side);
    var note = "";
    function draw() {
      var picked = [];
      boxes.forEach(function (cb, k) { rows[k].classList.toggle("rg-picked", cb.checked); if (cb.checked) picked.push(k); });
      side.hidden = picked.length === 0;
      sideT.textContent = (picked.length === 1 ? "1 row picked. Pick another to compare." : picked.length + " rows side by side") + note;
      cols.style.setProperty("--n", String(Math.max(picked.length, 1)));
      cols.textContent = "";
      picked.forEach(function (k) {
        var col = el("div", "rg-side__col"), dl = el("dl");
        col.appendChild(el("h4", "rg-side__name", data[k][0] ? data[k][0].t : ""));
        for (var i = 1; i < ncol; i++) {
          dl.appendChild(el("dt", null, names[i]));
          dl.appendChild(el("dd", kind[i] === "num" ? "rg-side__num" : null, data[k][i] ? data[k][i].t : ""));
        }
        col.appendChild(dl);
        cols.appendChild(col);
      });
      note = "";
    }
    boxes.forEach(function (cb) {
      cb.addEventListener("change", function () {
        if (cb.checked && boxes.filter(function (b) { return b.checked; }).length > 3) {
          cb.checked = false;
          note = " Three at most.";
        }
        draw();
      });
    });
    clear.addEventListener("click", function () { boxes.forEach(function (cb) { cb.checked = false; }); draw(); });
  });

  each(page.querySelectorAll(".fw-stat__n"), function (p) {
    if (p.children.length) return;
    var m = /^\s*(USD|EUR|GBP|US\$)\s+(.+)$/i.exec(p.textContent);
    if (!m) return;
    p.textContent = "";
    p.appendChild(el("span", "rg-unit", m[1] + " "));
    p.appendChild(document.createTextNode(m[2]));
  });
})();
