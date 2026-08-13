/* ---------------------------------------------------------------------------
   Holographic wireframe projection in the hero — canvas 2D (no WebGL, renders
   on every browser incl. old Samsung Internet). Crimson VR-projection look.
   Sequence: diamond -> lotus -> snowflake -> Pisces -> earth -> teddy head.
   Random shape each load; solids spin in 3D, flat shapes (snowflake, Pisces)
   spin IN-PLANE so they always fully show. Click morphs to the next with a
   collapse -> flash -> springy reform. Desktop + mobile; reduced-motion static.
--------------------------------------------------------------------------- */
(function () {
  var holo = document.querySelector('.holo');
  if (!holo) return;
  var canvas = holo.querySelector('.holo-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var TAU = 6.28318530718;

  function normalize(vs) {
    var m = 0, i, r;
    for (i = 0; i < vs.length; i++) { r = Math.sqrt(vs[i][0] * vs[i][0] + vs[i][1] * vs[i][1] + vs[i][2] * vs[i][2]); if (r > m) m = r; }
    return vs.map(function (p) { return [p[0] / m, p[1] / m, p[2] / m]; });
  }
  function ball(v, e, cx, cy, cz, r, rows, cols, w) {
    var start = v.length, iy, ix, th, ph;
    var id = function (iy, ix) { return start + iy * cols + (ix % cols); };
    for (iy = 0; iy <= rows; iy++) { th = iy / rows * Math.PI; for (ix = 0; ix < cols; ix++) { ph = ix / cols * TAU; v.push([cx + r * Math.sin(th) * Math.cos(ph), cy + r * Math.cos(th), cz + r * Math.sin(th) * Math.sin(ph)]); } }
    for (iy = 0; iy <= rows; iy++) for (ix = 0; ix < cols; ix++) { e.push([id(iy, ix), id(iy, ix + 1), w]); if (iy < rows) e.push([id(iy, ix), id(iy + 1, ix), w]); }
  }

  function diamond() {
    var v = [], e = [], n = 8, i, a, t0, g0, c, tableY = .60, girdleY = .12, culetY = -1, tableR = .44, girdleR = .92;
    t0 = v.length; for (i = 0; i < n; i++) { a = i / n * TAU; v.push([Math.cos(a) * tableR, tableY, Math.sin(a) * tableR]); }
    g0 = v.length; for (i = 0; i < n; i++) { a = i / n * TAU; v.push([Math.cos(a) * girdleR, girdleY, Math.sin(a) * girdleR]); }
    c = v.length; v.push([0, culetY, 0]);
    for (i = 0; i < n; i++) e.push([t0 + i, t0 + (i + 1) % n]);
    for (i = 0; i < n; i++) e.push([g0 + i, g0 + (i + 1) % n]);
    for (i = 0; i < n; i++) { e.push([t0 + i, g0 + i]); e.push([t0 + i, g0 + (i + 1) % n]); }
    for (i = 0; i < n; i++) e.push([g0 + i, c]);
    return { v: v, e: e };
  }
  function lotus() {
    var v = [], e = [], tiers = [[6, 1.0, .36, .10, -.28, 0], [5, .60, .28, .70, -.08, Math.PI / 6]], segs = 5, ti, k, i, s, u, h, w, phi, cf, sf, loop, j;
    for (ti = 0; ti < tiers.length; ti++) {
      var n = tiers[ti][0], len = tiers[ti][1], wid = tiers[ti][2], lift = tiers[ti][3], y0 = tiers[ti][4], off = tiers[ti][5];
      for (k = 0; k < n; k++) {
        phi = k / n * TAU + off; cf = Math.cos(phi); sf = Math.sin(phi); loop = [];
        for (i = 0; i <= segs; i++) { s = i / segs; u = len * s * (1 - .25 * s); h = y0 + lift * s * s; w = Math.sin(Math.PI * s) * wid; v.push([u * cf - w * sf, h, u * sf + w * cf]); loop.push(v.length - 1); }
        for (i = segs; i >= 0; i--) { s = i / segs; u = len * s * (1 - .25 * s); h = y0 + lift * s * s; w = -Math.sin(Math.PI * s) * wid; v.push([u * cf - w * sf, h, u * sf + w * cf]); loop.push(v.length - 1); }
        for (j = 0; j < loop.length; j++) e.push([loop[j], loop[(j + 1) % loop.length]]);
      }
    }
    return { v: v, e: e };
  }
  function snowflake() {                                   // built in the X-Y plane (faces camera)
    var v = [], e = [], k, a, ca, sa, o, brs, bi, r, L, base, t1, t2, cb;
    var Pf = function (ca, sa, r, t, z) { return [r * ca - t * sa, r * sa + t * ca, z || 0]; };
    for (k = 0; k < 6; k++) {
      a = k / 6 * TAU; ca = Math.cos(a); sa = Math.sin(a);
      o = v.length; v.push(Pf(ca, sa, 0, 0, 0)); v.push(Pf(ca, sa, 1.0, 0, 0)); e.push([o, o + 1]);
      brs = [[.42, .26], [.68, .18]];
      for (bi = 0; bi < brs.length; bi++) { r = brs[bi][0]; L = brs[bi][1]; base = v.length; v.push(Pf(ca, sa, r, 0, 0)); t1 = v.length; v.push(Pf(ca, sa, r + L * .5, L, 0)); t2 = v.length; v.push(Pf(ca, sa, r + L * .5, -L, 0)); e.push([base, t1]); e.push([base, t2]); }
    }
    cb = v.length; for (k = 0; k < 6; k++) { a = k / 6 * TAU; v.push([Math.cos(a) * .14, Math.sin(a) * .14, 0]); } for (k = 0; k < 6; k++) e.push([cb + k, cb + (k + 1) % 6]);
    return { v: v, e: e, flat: true, inplane: true };
  }
  function pisces() {                                      // X-Y plane; the classic V + circlet
    var v = [], e = [], i;
    function star(x, y) { v.push([x, y, (v.length % 3 - 1) * 0.14]); return v.length - 1; }
    var knot = star(-0.45, -0.5);
    var n1 = star(-0.3, -0.1), n2 = star(-0.12, 0.32), n3 = star(0.0, 0.72), n4 = star(0.06, 1.02);
    var w1 = star(-0.1, -0.6), w2 = star(0.3, -0.66), w3 = star(0.62, -0.6);
    var ring = [], cx = 0.86, cy = -0.42, rr = 0.2;
    for (i = 0; i < 5; i++) { var a = i / 5 * TAU - 1.1; ring.push(star(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)); }
    e.push([knot, n1], [n1, n2], [n2, n3], [n3, n4]);
    e.push([knot, w1], [w1, w2], [w2, w3], [w3, ring[0]]);
    for (i = 0; i < 5; i++) e.push([ring[i], ring[(i + 1) % 5]]);
    return { v: v, e: e, flat: true, spinY: true };
  }
  function earth() {                                       // globe + continents FILLED with translucent white
    var v = [], e = [], fills = [];
    function ll(lat, lon) { var t = (90 - lat) * Math.PI / 180, p = lon * Math.PI / 180; return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]; }
    function ring(lat, w) { var s = v.length, n = 24, k, t = (90 - lat) * Math.PI / 180; for (k = 0; k < n; k++) { var p = k / n * TAU; v.push([Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]); } for (k = 0; k < n; k++) e.push([s + k, s + (k + 1) % n, w]); }
    function mer(lon, w) { var s = v.length, n = 24, k, p = lon * Math.PI / 180; for (k = 0; k <= n; k++) { var t = k / n * Math.PI; v.push([Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]); } for (k = 0; k < n; k++) e.push([s + k, s + k + 1, w]); }
    ring(0, 0.55); ring(35, 0.4); ring(-35, 0.4); ring(64, 0.35); ring(-64, 0.35);
    mer(0, 0.5); mer(60, 0.4); mer(120, 0.4); mer(180, 0.4); mer(240, 0.4); mer(300, 0.4);
    var CONTS = [
      [[34,-6],[16,18],[2,10],[-16,12],[-34,20],[-24,44],[8,48],[30,32],[36,10]],
      [[62,-140],[48,-70],[24,-82],[8,-78],[-20,-70],[-52,-70],[-34,-56],[-8,-52],[10,-62],[28,-112],[60,-160]],
      [[64,8],[62,60],[54,110],[40,140],[22,120],[8,78],[26,60],[40,44],[54,24]],
      [[-12,132],[-16,150],[-38,146],[-34,118],[-18,114]]
    ];
    CONTS.forEach(function (C) { var s = v.length, k, idxs = []; for (k = 0; k < C.length; k++) { v.push(ll(C[k][0], C[k][1])); idxs.push(s + k); } for (k = 0; k < C.length; k++) e.push([s + k, s + (k + 1) % C.length, 0.9]); fills.push(idxs); });
    return { v: v, e: e, fills: fills };
  }
  function teddy() {                                       // full bear (spins in 3D with the gaze tilt)
    var v = [], e = [];
    ball(v, e, 0, -0.18, 0, 0.60, 5, 9);      // body
    ball(v, e, 0, 0.66, 0, 0.40, 5, 9);       // head
    ball(v, e, -0.30, 0.98, 0, 0.15, 3, 6);   // ear L
    ball(v, e, 0.30, 0.98, 0, 0.15, 3, 6);    // ear R
    ball(v, e, 0, 0.55, 0.32, 0.16, 3, 6);    // snout
    ball(v, e, -0.54, 0.02, 0.04, 0.19, 3, 6);// arm L
    ball(v, e, 0.54, 0.02, 0.04, 0.19, 3, 6); // arm R
    ball(v, e, -0.28, -0.84, 0.04, 0.21, 3, 6);// leg L
    ball(v, e, 0.28, -0.84, 0.04, 0.21, 3, 6); // leg R
    return { v: v, e: e };
  }

  var DEFS = [[diamond(), 1], [lotus(), 1.18], [snowflake(), 1.06], [pisces(), 1.4], [earth(), 1.02], [teddy(), 1.05]];
  function recenter(vs) {                                  // pivot on the shape's true (bounding-box) center
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], i, j;
    for (i = 0; i < vs.length; i++) for (j = 0; j < 3; j++) { if (vs[i][j] < mn[j]) mn[j] = vs[i][j]; if (vs[i][j] > mx[j]) mx[j] = vs[i][j]; }
    var c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    return vs.map(function (p) { return [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; });
  }
  var SHAPES = DEFS.map(function (d) { return { v: normalize(recenter(d[0].v)), e: d[0].e, scale: d[1], flat: !!d[0].flat, fills: d[0].fills, inplane: !!d[0].inplane }; });

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() { var s = Math.max(1, Math.round(holo.clientWidth)); canvas.width = Math.round(s * dpr); canvas.height = Math.round(s * dpr); }
  resize();

  var idx = Math.floor(Math.random() * SHAPES.length);
  var lean = (document.documentElement.dir === 'rtl') ? 0.14 : -0.14;  // mirror the lean on the RTL (Hebrew) page
  var spin = Math.random() * TAU, running = true, visible = true, raf = 0, last = null, morph = 0, pendingSwap = false;
  function backOut(u) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  function rot(p, ay, ax, az) {                            // yaw (spin) innermost, then a CONSTANT screen-space lean
    var x = p[0], y = p[1], z = p[2];
    var cy = Math.cos(ay), sy = Math.sin(ay), x1 = x * cy - z * sy, z1 = x * sy + z * cy; x = x1; z = z1;   // yaw / spin
    var cz = Math.cos(az), sz = Math.sin(az), x2 = x * cz - y * sz, y2 = x * sz + y * cz; x = x2; y = y2;   // roll (lean left)
    var cx = Math.cos(ax), sx = Math.sin(ax), y3 = y * cx - z * sx, z3 = y * sx + z * cx; y = y3; z = z3;   // pitch (lean inward)
    return [x, y, z];
  }
  function draw(scale, flick, flash, ay, ax, az) {
    var sh = SHAPES[idx], W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.30 * scale * sh.scale, d = 3.4, i, a, b;
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = flick;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.6);
    g.addColorStop(0, 'rgba(200,16,46,' + (0.16 + flash * 0.5).toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(200,16,46,0.05)'); g.addColorStop(1, 'rgba(200,16,46,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var pts = sh.v.map(function (p) { var q = rot(p, ay, ax, az); var s = d / (d - q[2]); return [cx + q[0] * R * s, cy - q[1] * R * s, s]; });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (i = 0; i < sh.e.length; i++) { a = pts[sh.e[i][0]]; b = pts[sh.e[i][1]]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.lineWidth = Math.max(1.4, dpr * 2.0); ctx.strokeStyle = 'rgba(220,40,66,' + (0.20 + flash * 0.4).toFixed(3) + ')';
    ctx.shadowColor = 'rgba(200,16,46,0.9)'; ctx.shadowBlur = dpr * (6 + flash * 10); ctx.stroke();
    ctx.shadowBlur = 0;
    if (sh.fills) {                                        // translucent white landmasses, front hemisphere only
      for (var f = 0; f < sh.fills.length; f++) {
        var loop = sh.fills[f], sSum = 0, kk;
        for (kk = 0; kk < loop.length; kk++) sSum += pts[loop[kk]][2];
        var sAvg = sSum / loop.length;
        if (sAvg <= 1.0) continue;
        ctx.beginPath();
        for (kk = 0; kk < loop.length; kk++) { var pp = pts[loop[kk]]; if (kk === 0) ctx.moveTo(pp[0], pp[1]); else ctx.lineTo(pp[0], pp[1]); }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.10 + (sAvg - 1.0) * 0.45).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.lineWidth = Math.max(1, dpr * 0.8);
    for (i = 0; i < sh.e.length; i++) {
      a = pts[sh.e[i][0]]; b = pts[sh.e[i][1]];
      var al = (0.14 + ((a[2] + b[2]) / 2 - 0.72) / 0.7 * 0.5 + flash * 0.4) * (sh.e[i][2] || 1);
      al = al < 0.07 ? 0.07 : al > 0.98 ? 0.98 : al;
      ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (pts.length <= 30) {
      ctx.shadowColor = 'rgba(255,90,110,0.9)'; ctx.shadowBlur = dpr * (2 + flash * 3);
      for (i = 0; i < pts.length; i++) { ctx.fillStyle = 'rgba(255,240,240,' + (0.42 + flash * 0.3).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], dpr * 1.35, 0, TAU); ctx.fill(); }
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
  function frame(ts) {
    raf = 0; if (!running || !visible || document.hidden) return;
    if (last === null) last = ts; var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    var scale = 1, flash = 0, boost = 0;
    if (morph > 0) {
      morph -= dt / 0.72; if (morph < 0) morph = 0;
      var m = 1 - morph;
      if (pendingSwap && m >= 0.5) { idx = (idx + 1) % SHAPES.length; pendingSwap = false; }
      scale = m < 0.5 ? Math.cos(m * Math.PI) : backOut((m - 0.5) / 0.5);
      flash = Math.exp(-((m - 0.5) * (m - 0.5)) / 0.006);
      boost = 5 * Math.sin(m * Math.PI);
    }
    if (!reduce) spin += dt * (1 + boost);
    var ay, ax, az;
    if (SHAPES[idx].inplane) { ay = 0; ax = -0.28; az = spin * 0.32; }  // snowflake: in-plane spin (the exception)
    else { ay = spin * 0.40; ax = -0.30; az = lean; }                   // everyone else: slight lean + inward (mirrored on RTL)
    var flick = 0.86 + 0.14 * Math.sin(ts * 0.006) - (Math.random() < 0.03 ? 0.16 : 0); // holographic flicker
    draw(scale, flick < 0.55 ? 0.55 : flick, flash, ay, ax, az);
    req();
  }
  function req() { if (!raf && running) raf = requestAnimationFrame(frame); }

  holo.addEventListener('click', function () {
    if (reduce) { idx = (idx + 1) % SHAPES.length; draw(1, 1, 0, SHAPES[idx].flat ? 0 : 0.4, SHAPES[idx].flat ? 0.02 : -0.2, SHAPES[idx].flat ? 0.3 : -0.12); return; }
    if (morph <= 0) { morph = 1; pendingSwap = true; }
  });
  window.addEventListener('resize', function () { resize(); }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) req(); }, { threshold: 0 }).observe(holo);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) req(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) req(); });  // bfcache restore

  if (reduce) draw(1, 1, 0, 0, 0.02, 0.3); else req();
})();
