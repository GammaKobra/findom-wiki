(function () {
  "use strict";
  var page = document.querySelector('.fw-fpage[data-form="galerie"]');
  if (!page) return;

  function motionOK() {
    if (window.FW && typeof window.FW.motionOK === "function") return window.FW.motionOK();
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var plates = [];
  var titleEl = page.querySelector(".fw-fhero__title");
  var chapterTitle = titleEl ? titleEl.textContent.replace(/\s+/g, " ").trim() : "";
  var chapterId = page.getAttribute("data-chapter") || "";

  function addOpener(holder, index, label) {
    var b = el("button", "gal-open");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-haspopup", "dialog");
    var k = el("span", "gal-open__k", "View");
    k.setAttribute("aria-hidden", "true");
    b.appendChild(k);
    b.addEventListener("click", function () { open(index, b); });
    holder.appendChild(b);
  }

  var heroFig = page.querySelector(".fw-fhero__fig");
  var heroImg = heroFig && heroFig.querySelector("img");
  if (heroFig && heroImg) {
    heroFig.removeAttribute("aria-hidden");
    heroImg.setAttribute("aria-hidden", "true");
    plates.push({ src: heroImg.currentSrc || heroImg.getAttribute("src"), alt: "", cap: "The picture of this chapter.", set: chapterTitle });
    addOpener(heroFig, 0, "Open the chapter picture full screen");
    var plate = el("p", "gal-plate");
    plate.setAttribute("aria-hidden", "true");
    plate.appendChild(el("b", null, "Plate 01"));
    plate.appendChild(document.createTextNode(chapterId ? "Chapter " + chapterId : "Chapter picture"));
    heroFig.appendChild(plate);
  }

  Array.prototype.forEach.call(page.querySelectorAll(".fw-media"), function (fig) {
    var head = fig.querySelector(".fw-media__title");
    var setName = head ? head.textContent.replace(/\s+/g, " ").trim() : "";
    var items = fig.querySelectorAll(".fw-media__item");
    var video = fig.querySelector("video.fw-media__video");
    if (head && items.length) {
      var count = el("span", "gal-count", items.length + (items.length === 1 ? " plate" : " plates") + (video ? " and a film" : ""));
      head.appendChild(count);
    }
    Array.prototype.forEach.call(items, function (li) {
      var img = li.querySelector("img");
      if (!img) return;
      var alt = img.getAttribute("alt") || "";
      var index = plates.length;
      plates.push({ src: img.getAttribute("src"), alt: alt, cap: alt, set: setName });
      li.setAttribute("data-plate", pad(index + 1));
      addOpener(li, index, "Open picture " + (index + 1) + " full screen" + (alt ? ": " + alt : ""));
    });
    if (video) {
      fig.classList.add("gal-film");
      setUpSound(fig, video);
    }
  });

  function setUpSound(fig, video) {
    video.muted = true;
    video.defaultMuted = true;
    video.removeAttribute("autoplay");
    var row = el("p", "gal-sound");
    var btn = el("button", "gal-sound__btn");
    btn.type = "button";
    var state = el("span", null, "");
    row.appendChild(btn);
    row.appendChild(state);
    function sync() {
      var on = !video.muted && video.volume > 0;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "Turn sound off" : "Turn sound on";
      state.textContent = on ? "Sound on" : "Sound off";
    }
    btn.addEventListener("click", function () {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) video.volume = 1;
      sync();
    });
    video.addEventListener("volumechange", sync);
    sync();
    var note = fig.querySelector(".fw-media__note");
    if (note) fig.insertBefore(row, note); else fig.appendChild(row);
  }

  if (!plates.length) return;

  var viewer = el("div", "gal-viewer");
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", "Picture viewer");
  viewer.hidden = true;
  var stage = el("div", "gal-viewer__stage");
  var big = el("img", "gal-viewer__img");
  big.alt = "";
  big.decoding = "async";
  stage.appendChild(big);
  var side = el("div", "gal-viewer__side");
  var closeBtn = el("button", "gal-viewer__close", "Close");
  closeBtn.type = "button";
  var countEl = el("p", "gal-viewer__count");
  countEl.setAttribute("aria-live", "polite");
  var setEl = el("p", "gal-viewer__set");
  var capEl = el("p", "gal-viewer__cap");
  capEl.setAttribute("aria-hidden", "true");
  var nav = el("div", "gal-viewer__nav");
  var prevBtn = el("button", null, "← Previous");
  prevBtn.type = "button";
  var nextBtn = el("button", null, "Next →");
  nextBtn.type = "button";
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  var keys = el("p", "gal-viewer__keys", "Esc closes · ← → turn the plates");
  side.appendChild(closeBtn);
  side.appendChild(countEl);
  side.appendChild(setEl);
  side.appendChild(capEl);
  side.appendChild(nav);
  side.appendChild(keys);
  viewer.appendChild(stage);
  viewer.appendChild(side);
  page.appendChild(viewer);

  var current = 0, opener = null, lastOverflow = "";

  function animate(cls) {
    viewer.classList.remove("is-in", "is-next", "is-prev");
    if (!cls || !motionOK()) return;
    void viewer.offsetWidth;
    viewer.classList.add(cls);
  }
  function show(i, dir) {
    current = (i + plates.length) % plates.length;
    var p = plates[current];
    big.src = p.src;
    big.alt = p.alt || (p.set ? "The picture of the chapter " + p.set : "");
    countEl.textContent = "Plate " + pad(current + 1) + " / " + pad(plates.length);
    setEl.textContent = p.set || "";
    setEl.hidden = !p.set;
    capEl.textContent = p.cap || "";
    capEl.hidden = !p.cap;
    var one = plates.length < 2;
    prevBtn.disabled = one;
    nextBtn.disabled = one;
    nav.hidden = one;
    if (dir) animate(dir > 0 ? "is-next" : "is-prev");
    var ahead = plates[(current + 1) % plates.length];
    if (ahead && ahead.src) { var pre = new Image(); pre.src = ahead.src; }
  }
  function open(i, from) {
    opener = from || document.activeElement;
    show(i, 0);
    viewer.hidden = false;
    lastOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    animate("is-in");
    closeBtn.focus();
    document.addEventListener("keydown", onKey, true);
  }
  function close() {
    if (viewer.hidden) return;
    viewer.hidden = true;
    viewer.classList.remove("is-in", "is-next", "is-prev");
    document.documentElement.style.overflow = lastOverflow;
    document.removeEventListener("keydown", onKey, true);
    if (opener && typeof opener.focus === "function") opener.focus();
  }
  function step(d) { if (plates.length > 1) show(current + d, d); }
  function focusables() {
    return [closeBtn, prevBtn, nextBtn].filter(function (b) { return !b.disabled && !b.hidden && b.offsetParent !== null; });
  }
  function onKey(e) {
    if (viewer.hidden) return;
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
    if (e.key === "Tab") {
      var f = focusables();
      if (!f.length) { e.preventDefault(); return; }
      var at = f.indexOf(document.activeElement);
      e.preventDefault();
      var next = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at === -1 || at === f.length - 1 ? 0 : at + 1);
      f[next].focus();
    }
  }
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", function () { step(-1); });
  nextBtn.addEventListener("click", function () { step(1); });
  stage.addEventListener("click", function (e) { if (e.target === stage) close(); });

  var sx = null, sy = 0;
  stage.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") { sx = e.clientX; sy = e.clientY; } });
  stage.addEventListener("pointerup", function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", function () { sx = null; });

  document.addEventListener("focusin", function (e) {
    if (!viewer.hidden && !viewer.contains(e.target)) closeBtn.focus();
  });
})();
