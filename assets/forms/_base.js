(function () {
  "use strict";
  var page = document.querySelector(".fw-fpage");
  if (!page) return;
  Array.prototype.forEach.call(page.querySelectorAll("[data-fw-reveal]"), function (el) {
    el.removeAttribute("data-fw-reveal");
  });
})();
