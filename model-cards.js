/* ---------------------------------------------------------------------------
   Interactive 3D model cards  ·  Red Crown Interactive
   ONE implementation, used by the home page and by the case-study pages.

   A page declares a card as an empty element:

       <div class="wd-model-wrap" data-model="robi"
            data-alt="..." data-badge="..."></div>

   and this module builds the <model-viewer>, the badge, the zoom slider and
   the loading spinner, loads the library on demand, and runs the zoom and the
   instructor-eye animation. Model tuning lives in MODELS below and nowhere
   else; the text stays in the markup so each language keeps its own wording.

   Paths are root-absolute so the same file works at any directory depth.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  // The single source of truth for every model on the site.
  var MODELS = {
    enzym:  { src: '/assets/models/enzym_opt.glb',
              autoRotate: '14deg', exposure: '1',    shadow: ['0.5', '0.9'],
              fov: ['26deg', '10deg', '38deg'], orbit: '0deg 75deg auto' },
    robi:   { src: '/assets/models/robi_opt.glb',
              autoplay: true,      exposure: '1',    shadow: ['0.6', '0.9'],
              fov: ['25deg', '10deg', '36deg'], orbit: '15deg 82deg auto' },
    caffeine: { src: '/assets/models/caffeine2_opt.glb',
              autoRotate: '16deg', exposure: '0.45', shadow: ['0.5', '0.9'],
              fov: ['28deg', '12deg', '40deg'], orbit: '0deg 75deg auto' },
    quest3: { src: '/assets/models/meta_quest_3_opt.glb',
              autoRotate: '16deg', exposure: '1',    shadow: ['0.6', '0.9'],
              fov: ['24deg', '9deg', '36deg'], orbit: '25deg 78deg auto' }
  };

  var LIB = '/vendor/model-viewer.min.js';

  /* ---------- build the card markup from the config ---------- */

  function buildCard(wrap) {
    if (wrap.__built) return;
    var cfg = MODELS[wrap.getAttribute('data-model')];
    if (!cfg) return;
    wrap.__built = 1;

    var mv = document.createElement('model-viewer');
    mv.className = 'wd-model';
    mv.setAttribute('dir', 'ltr');            // a 3D viewport is never right-to-left
    mv.setAttribute('src', cfg.src);
    mv.setAttribute('alt', wrap.getAttribute('data-alt') || '');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('disable-pan', '');
    mv.setAttribute('touch-action', 'pan-y');
    if (cfg.autoRotate) { mv.setAttribute('auto-rotate', ''); mv.setAttribute('rotation-per-second', cfg.autoRotate); }
    if (cfg.autoplay) mv.setAttribute('autoplay', '');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('tone-mapping', 'neutral');
    mv.setAttribute('exposure', cfg.exposure);
    mv.setAttribute('shadow-intensity', cfg.shadow[0]);
    mv.setAttribute('shadow-softness', cfg.shadow[1]);
    mv.setAttribute('field-of-view', cfg.fov[0]);
    mv.setAttribute('min-field-of-view', cfg.fov[1]);
    mv.setAttribute('max-field-of-view', cfg.fov[2]);
    mv.setAttribute('camera-orbit', cfg.orbit);
    mv.setAttribute('loading', 'lazy');
    wrap.appendChild(mv);

    var badge = wrap.getAttribute('data-badge');
    if (badge) {
      var b = document.createElement('span');
      b.className = 'wd-model-badge';
      b.textContent = badge;
      wrap.appendChild(b);
    }

    var ctl = document.createElement('div');
    ctl.className = 'wd-zoom-ctl';
    ctl.setAttribute('dir', 'ltr');           // minus on the left, plus on the right, in every language
    ctl.innerHTML = '<span class="wd-zoom-ic">–</span>' +
      '<input class="wd-zoom" type="range" min="0" max="100" value="40" aria-label="' +
      (wrap.getAttribute('data-zoom-label') || 'Zoom the 3D model') + '">' +
      '<span class="wd-zoom-ic">+</span>';
    wrap.appendChild(ctl);

    var load = document.createElement('div');
    load.className = 'wd-model-loading';
    load.innerHTML = '<span class="wd-spinner"></span>';
    wrap.appendChild(load);
  }

  /* ---------- zoom: slider drives field of view, and opens up translucency ---------- */

  function applyModelZoom(wrap) {
    var mv = wrap.querySelector('model-viewer'), sl = wrap.querySelector('.wd-zoom');
    if (!mv || !sl) return;
    var z = +sl.value;
    var mn = parseFloat(mv.getAttribute('min-field-of-view')) || 12,
        mx = parseFloat(mv.getAttribute('max-field-of-view')) || 46;
    mv.fieldOfView = (mx - (z / 100) * (mx - mn)).toFixed(1) + 'deg';
    var t = z / 100, mats = mv.model && mv.model.materials;   // translucent surfaces: opaque when out, authored alpha when in
    if (mats) for (var i = 0; i < mats.length; i++) { try {
      var m = mats[i], bc = m.pbrMetallicRoughness.baseColorFactor;
      if (m.__baseA === undefined) m.__baseA = bc[3];
      if (m.__baseA < 0.999) { var OUT = 0.9; m.pbrMetallicRoughness.setBaseColorFactor([bc[0], bc[1], bc[2], OUT - t * (OUT - m.__baseA)]); }
    } catch (_) {} }
  }

  /* ---------- Robi's eyes: the Unity instructor behaviour, faithfully ---------- */

  function robiEyes(mv) {
    if (!mv.model || !mv.model.materials) return;
    var eyes = mv.model.materials.filter(function (m) { return m.name && m.name.indexOf('EYE_') === 0; });
    if (!eyes.length || mv.__eyes) return; mv.__eyes = 1;
    // faithful to the Unity InstructorViewModel: rest = palette[0]; each speech "beat" advances to the
    // next palette colour, then Color.Lerp back at smoothingSpeed 5.
    var PAL = [[0, 0.5714, 0.8050], [0, 0.8481, 1.0], [0, 1.0, 0.9451]];   // exact prefab colorPalette
    var disp = PAL[0].slice(), idx = 0, last = performance.now();
    var talking = true, phaseEnd = last + 2000, beatT = 0;
    var nextBlink = last + 1800, blinkStart = -1, pendingDouble = false;
    function ease(t) { return t * t * (3 - 2 * t); }
    (function frame(now) {
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (now > phaseEnd) { talking = !talking; phaseEnd = now + (talking ? 1400 + Math.random() * 2000 : 900 + Math.random() * 1800); }
      var target;
      if (talking) {
        beatT -= dt * 1000;
        if (beatT <= 0) { idx = (idx + 1) % PAL.length; beatT = 340 + Math.random() * 320; }
        target = PAL[idx];
      } else { idx = 0; target = PAL[0]; }
      var k = Math.min(dt * 3, 1);
      disp[0] += (target[0] - disp[0]) * k; disp[1] += (target[1] - disp[1]) * k; disp[2] += (target[2] - disp[2]) * k;
      var blinkMul = 1;
      if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
      if (blinkStart >= 0) {
        var bt = (now - blinkStart) / 150;
        if (bt >= 1) {
          blinkStart = -1;
          if (pendingDouble) { pendingDouble = false; nextBlink = now + 2600 + Math.random() * 3600; }
          else if (Math.random() < 0.28) { pendingDouble = true; nextBlink = now + 110; }
          else nextBlink = now + 2600 + Math.random() * 3600;
        } else { blinkMul = 1 - 0.95 * (bt < 0.5 ? ease(bt / 0.5) : ease((1 - bt) / 0.5)); }
      }
      eyes.forEach(function (m) {
        var p = m.pbrMetallicRoughness;
        if (p && p.setBaseColorFactor) p.setBaseColorFactor([disp[0] * blinkMul, disp[1] * blinkMul, disp[2] * blinkMul, 1]);
      });
      requestAnimationFrame(frame);
    })(last);
  }

  /* ---------- load the library once, then wire every card ---------- */

  // Wiring is separate from library loading so cards added AFTER the library is
  // in (a page swap by rail-nav.js, for instance) still get their spinner cleared,
  // their zoom applied and their eyes running. Each wrap wires once.
  function wireCards() {
    document.querySelectorAll('.wd-model-wrap model-viewer').forEach(function (mv) {
      var w = mv.closest('.wd-model-wrap');
      if (w.__wired) return; w.__wired = 1;
      var go = function () { w.classList.add('loaded'); applyModelZoom(w); robiEyes(mv); };
      try { mv.loading = 'eager'; } catch (_) {}
      if (mv.loaded) go(); else mv.addEventListener('load', go);
    });
  }

  function loadModelViewers() {
    document.querySelectorAll('.wd-model-wrap[data-model]').forEach(buildCard);
    if (window.__mvLoaded) {
      if (window.customElements && customElements.get('model-viewer')) wireCards();
      return;
    }
    window.__mvLoaded = 1;
    var s = document.createElement('script');
    s.type = 'module'; s.src = LIB;
    document.head.appendChild(s);
    if (window.customElements) customElements.whenDefined('model-viewer').then(wireCards);
  }

  document.addEventListener('input', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('wd-zoom')) {
      var w = e.target.closest('.wd-model-wrap');
      if (w) applyModelZoom(w);
    }
  }, true);

  // The home page opens a card on click; a case study shows its model inline, so
  // build that one as soon as it is near the viewport.
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.wcard[data-project]');
    if (c) loadModelViewers();
  }, true);

  function watchInline() {
    // A case study shows its model inline, whether it sits beside the screenshot
    // in .pg-media or on its own in .pg-model.
    var inline = document.querySelectorAll('.pg-media .wd-model-wrap[data-model], .pg-model .wd-model-wrap[data-model]');
    if (!inline.length) return;
    if (!('IntersectionObserver' in window)) { loadModelViewers(); return; }
    var io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { io.disconnect(); loadModelViewers(); return; }
    }, { rootMargin: '400px' });
    inline.forEach(function (n) { io.observe(n); });
  }

  if (document.readyState !== 'loading') watchInline();
  else document.addEventListener('DOMContentLoaded', watchInline);

  window.RCModels = { load: loadModelViewers, zoom: applyModelZoom, MODELS: MODELS };
})();
