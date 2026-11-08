(function () {
  "use strict";
  var page = document.querySelector('.fw-fpage[data-form="guide"]');
  if (!page) return;
  var FWo = window.FW || { motionOK: function () { return true; }, onMotion: function () {} };

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function plain(el) {
    var c = el.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll(".fw-tip, .fw-ev, .fw-visually-hidden"), function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, " ").trim();
  }

  var hero = page.querySelector(".fw-fhero");
  var total = hero ? parseInt(hero.getAttribute("data-sections"), 10) : 0;
  if (total > 1) page.style.setProperty("--gd-total", '" of ' + pad(total) + '"');
  var secDt = page.querySelector('.fw-fhero__rec[data-rec="sections"] dt');
  if (secDt && /section/i.test(secDt.textContent)) secDt.textContent = "Steps";

  var noted = false;
  Array.prototype.forEach.call(page.querySelectorAll(".fw-steps"), function (block) {
    var list = block.querySelector(".fw-steps__list");
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll(":scope > .fw-steps__item"));
    if (!items.length) return;
    block.classList.add("gd-list");
    var head = block.querySelector(".fw-steps__head");
    var count = document.createElement("p");
    count.className = "gd-count";
    count.setAttribute("aria-live", "polite");
    if (head) head.appendChild(count);
    else block.insertBefore(count, list);

    function update() {
      var done = items.filter(function (li) { return li.getAttribute("data-ticked") === "yes"; }).length;
      count.textContent = done === items.length ? "All " + items.length + " done" : done + " of " + items.length + " done";
      count.setAttribute("data-all", done === items.length ? "yes" : "no");
    }

    items.forEach(function (li, i) {
      var text = li.querySelector(".fw-steps__text");
      var label = text ? plain(text) : "";
      if (label.length > 90) label = label.slice(0, 88).replace(/\s+\S*$/, "") + "...";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gd-tick";
      b.setAttribute("role", "checkbox");
      b.setAttribute("aria-checked", "false");
      b.setAttribute("aria-label", "Done: " + (label || "step " + (i + 1)));
      b.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 7.4l3 3 6-6.4"/></svg>';
      li.insertBefore(b, li.firstChild);
      li.setAttribute("data-ticked", "no");
      function toggle() {
        var on = b.getAttribute("aria-checked") !== "true";
        b.setAttribute("aria-checked", String(on));
        li.setAttribute("data-ticked", on ? "yes" : "no");
        update();
      }
      b.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
      li.addEventListener("click", function (e) {
        if (e.target.closest("a, button, input, label, .fw-term, .fw-ev, .fw-tip")) return;
        var sel = window.getSelection && window.getSelection();
        if (sel && String(sel).length) return;
        toggle();
      });
    });
    update();

    if (!noted) {
      noted = true;
      var note = document.createElement("p");
      note.className = "gd-note";
      note.textContent = "Tick the lines as you go. Your ticks stay on this page only and clear when you leave it.";
      list.parentNode.insertBefore(note, list.nextSibling);
    }
  });

  if (page.getAttribute("data-layout") === "solo") {
    var bodies = page.querySelectorAll(".fw-fbody");
    var first = bodies[0], last = bodies[bodies.length - 1];
    var secs = Array.prototype.slice.call(page.querySelectorAll("section.fw-fsec[data-section]"));
    if (!first || !secs.length) return;
    var line = document.createElement("div"), ink = document.createElement("i");
    line.className = "gd-line";
    line.setAttribute("aria-hidden", "true");
    line.appendChild(ink);
    document.body.appendChild(line);
    var ticking = false;
    function measure() {
      ticking = false;
      var sy = window.scrollY, vh = window.innerHeight;
      var top = first.getBoundingClientRect().top + sy, bottom = last.getBoundingClientRect().bottom + sy;
      var span = Math.max(1, bottom - top - vh * 0.5), frac;
      if (FWo.motionOK()) {
        frac = (sy + vh * 0.42 - top) / span;
      } else {
        var step = 0;
        secs.forEach(function (s, i) { if (s.getBoundingClientRect().top < vh * 0.42) step = i + 1; });
        frac = step / secs.length;
      }
      frac = Math.max(0, Math.min(1, frac));
      ink.style.transform = "scaleX(" + frac.toFixed(4) + ")";
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    FWo.onMotion(onScroll);
    measure();
  }
})();
