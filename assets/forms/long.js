(function () {
  "use strict";
  var page = document.querySelector('.fw-fpage[data-form="long"]');
  if (!page) return;

  var flow = page.querySelector(".fw-fflow");
  if (flow) {
    var paras = flow.querySelectorAll(".fw-fsec .fw-site-run > p");
    for (var i = 0; i < paras.length && i < 5; i++) {
      var first = paras[i].firstChild;
      while (first && first.nodeType === 3 && !first.nodeValue.trim()) first = first.nextSibling;
      if (first && first.nodeType === 3 && /^\s*[A-Za-z0-9]/.test(first.nodeValue)) { paras[i].classList.add("ff-lede"); break; }
    }
  }

  var fig = page.querySelector(".fw-fhero__fig");
  if (!fig) return;
  var id = page.getAttribute("data-chapter");
  if (id) fig.setAttribute("data-plate", id);

  var ok = window.FW && typeof FW.motionOK === "function" ? FW.motionOK()
    : !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!ok || !("IntersectionObserver" in window)) return;

  fig.classList.add("ff-shut");
  var done = false, io;
  function open() {
    if (done) return;
    done = true;
    if (io) io.disconnect();
    requestAnimationFrame(function () {
      fig.classList.add("ff-opening");
      requestAnimationFrame(function () { fig.classList.remove("ff-shut"); });
    });
    setTimeout(function () { fig.classList.remove("ff-opening"); }, 1400);
  }
  function settle() { done = true; if (io) io.disconnect(); fig.classList.remove("ff-shut", "ff-opening"); }
  if (window.FW && FW.onMotion) FW.onMotion(function (on) { if (!on) settle(); });
  io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) setTimeout(open, 180); });
  }, { threshold: 0, rootMargin: "0px 0px -12% 0px" });
  io.observe(fig);
})();
