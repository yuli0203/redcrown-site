/* ---------------------------------------------------------------------------
   Jeweled crown in the contact CTA. The Red Crown mark is sampled into ~600
   crisp "jewel" particles that hold their shape (regal, solid). The crown rests
   in deep ruby; as the cursor moves near it, a warm pool of light follows the
   pointer and the jewels it passes glow up to white-hot — like light gliding
   over a real jeweled crown. A whisper of parallax adds depth. No sparkles, no
   scatter. Canvas 2D. Reduced-motion => static jeweled crown.
--------------------------------------------------------------------------- */
(function () {
  var section = document.querySelector('.contact');
  if (!section) return;
  var canvas = section.querySelector('.crown-particles');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var canHover = !window.matchMedia || matchMedia('(hover:hover) and (pointer:fine)').matches;  // desktop = cursor gleam; touch = auto gleam
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var TAU = 6.28318530718;

  var homes = [], parts = [], W = 0, H = 0, cxp = 0, cyp = 0, raf = 0, visible = true;
  var mx = -9999, my = -9999, pointer = false, clock = 0, lastTs = null;

  var img = new Image();
  img.src = '/assets/logo-kit/redcrown-knockout-white.png';
  img.onload = function () { size(); if (!reduce) req(); else paint(); };

  function sampleHomes() {
    var S = Math.max(120, Math.min(W, H));
    var off = document.createElement('canvas'); off.width = S; off.height = S;
    var o = off.getContext('2d');
    var iw = img.width, ih = img.height, s = Math.min(S * 0.9 / iw, S * 0.9 / ih);
    o.drawImage(img, (S - iw * s) / 2, (S - ih * s) / 2, iw * s, ih * s);
    var data; try { data = o.getImageData(0, 0, S, S).data; } catch (e) { return; }
    var cx = (W - S) / 2, cy = (H - S) / 2, x, y, cells = [];
    for (y = 0; y < S; y += 3) for (x = 0; x < S; x += 3) {
      if (data[(y * S + x) * 4 + 3] > 70) cells.push([x + cx, y + cy]);
    }
    for (var i = cells.length - 1; i > 0; i--) { var j = (i * 9301 + 49297) % (i + 1); var t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    homes = cells.slice(0, Math.max(320, Math.min(680, Math.round(cells.length * 0.5))));
  }
  function build() {
    var sx = 0, sy = 0;
    parts = homes.map(function (h) {
      sx += h[0]; sy += h[1];
      var hero = Math.random() < 0.16, t = Math.random();
      var tint = t < 0.6 ? [214, 32, 54] : (t < 0.84 ? [255, 96, 122] : [255, 232, 236]);  // ruby / rose / diamond
      return { hx: h[0], hy: h[1],
        r: hero ? 1.6 + Math.random() * 1.0 : 0.85 + Math.random() * 0.8,
        base: 0.5 + Math.random() * 0.35, tint: tint,
        tw: Math.random() * TAU, tws: 0.5 + Math.random() * 1.2,          // gentle living shimmer
        bp: Math.random() * TAU, bx: 0.3 + Math.random() * 0.5,
        ox: 0, oy: 0, vx: 0, vy: 0,                                       // local stir displacement
        k: 0.006 + Math.random() * 0.008, dmp: 0.93 + Math.random() * 0.03 };  // slow, floaty return
    });
    cxp = homes.length ? sx / homes.length : W / 2; cyp = homes.length ? sy / homes.length : H / 2;
  }
  function size() {
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight || W);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (img.complete && img.width) { sampleHomes(); build(); }
  }

  function paint(t) {
    t = t || 0;
    var i, p, x, y, a, g, gd, dx, dy;
    if (!canHover && !reduce) {                                     // touch devices: gleam roams on its own
      mx = cxp + Math.cos(t * 0.00045) * Math.min(W, H) * 0.30;
      my = cyp + Math.sin(t * 0.00062) * Math.min(W, H) * 0.22; pointer = true;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';                        // additive -> rich, glowing, colorful jewels
    var GR = Math.min(W, H) * 0.34, GR2 = GR * GR;
    var SR = Math.min(W, H) * 0.18, SR2 = SR * SR;                   // local stir field around the cursor
    var ALx = cxp + Math.cos(t * 0.00028) * Math.min(W, H) * 0.32;   // faint ambient light that roams on its own
    var ALy = cyp + Math.sin(t * 0.00040) * Math.min(W, H) * 0.22;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      var bob = reduce ? 0 : Math.sin(t * 0.0011 + p.bp) * p.bx;
      if (pointer && !reduce) {                                      // the cursor stirs nearby jewels (soft swirl)
        var sx = p.hx + p.ox - mx, sy = p.hy + p.oy - my, sr2 = sx * sx + sy * sy;
        if (sr2 < SR2) { var sr = Math.sqrt(sr2) || 1, sf = (1 - sr / SR); sf = sf * sf * 0.28;   // soft radial warp away, no swirl
          p.vx += (sx / sr) * sf; p.vy += (sy / sr) * sf; }
      }
      p.vx += -p.ox * p.k; p.vy += -p.oy * p.k; p.vx *= p.dmp; p.vy *= p.dmp; p.ox += p.vx; p.oy += p.vy;  // settle home independently
      x = p.hx + p.ox + bob * 0.5; y = p.hy + p.oy + bob;
      g = 0;
      if (pointer) { dx = x - mx; dy = y - my; gd = dx * dx + dy * dy; if (gd < GR2) { g = 1 - Math.sqrt(gd) / GR; g *= g; } }
      var ga = 0;
      if (!reduce) { var ax = x - ALx, ay = y - ALy, a2 = ax * ax + ay * ay; if (a2 < GR2) { ga = 1 - Math.sqrt(a2) / GR; ga *= ga; } }
      var shimmer = reduce ? 0.9 : 0.66 + 0.34 * Math.sin(t * 0.0018 * p.tws + p.tw);   // livelier shimmer
      a = Math.min(1, p.base * shimmer + 0.9 * g + 0.5 * ga);         // ambient adds a gentle living glow
      var mix = Math.min(1, g * 1.4 + ga * 0.22);                     // tint -> warm white inside the light
      var cr = p.tint[0] + (255 - p.tint[0]) * mix, cg = p.tint[1] + (255 - p.tint[1]) * mix, cb = p.tint[2] + (255 - p.tint[2]) * mix;
      var col = (cr | 0) + ',' + (cg | 0) + ',' + (cb | 0);
      var X = x * dpr, Y = y * dpr, R = p.r * dpr * (1 + 0.4 * g);
      ctx.beginPath(); ctx.arc(X, Y, R * 2.3, 0, TAU); ctx.fillStyle = 'rgba(' + col + ',' + (a * 0.16).toFixed(3) + ')'; ctx.fill();  // colourful glow
      ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')'; ctx.fill();               // jewel core
      if (g > 0.5) { ctx.beginPath(); ctx.arc(X, Y, R * 0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,' + (a * (g - 0.5) * 1.5).toFixed(3) + ')'; ctx.fill(); }
      // diamond sparkle ONLY on jewels inside the light pool (facets catching the light)
      if (g > 0.3 && !reduce) {
        var sp = (g - 0.3) * Math.pow(Math.max(0, Math.sin(t * 0.006 * p.tws + p.tw * 1.7)), 6);
        if (sp > 0.04) {
          var L = R * (2 + 5 * sp);
          ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(1, a * sp * 1.4).toFixed(3) + ')'; ctx.lineWidth = Math.max(0.7, dpr * 0.6);
          ctx.beginPath(); ctx.moveTo(X - L, Y); ctx.lineTo(X + L, Y); ctx.moveTo(X, Y - L); ctx.lineTo(X, Y + L); ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(ts) {
    raf = 0; if (!visible || document.hidden) { lastTs = null; return; }   // freeze the clock while hidden -> no jump on scroll back
    if (lastTs === null) lastTs = ts;
    var dt = ts - lastTs; if (dt > 50) dt = 50; lastTs = ts;
    clock += dt; paint(clock); if (!reduce) req();
  }
  function req() { if (!raf) raf = requestAnimationFrame(frame); }

  section.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; pointer = true; if (reduce) paint();
  }, { passive: true });
  section.addEventListener('pointerleave', function () { pointer = false; });
  window.addEventListener('resize', function () { size(); }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) req(); }, { threshold: 0 }).observe(section);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) req(); });
})();
