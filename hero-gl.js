/* ---------------------------------------------------------------------------
   Hero WebGL backdrop  ·  Red Crown Interactive  ·  experiment
   A self-contained raw-WebGL fragment shader that layers a slow, brand-coloured
   ember/nebula field over the hero. No libraries. Progressive enhancement:
     - skips entirely if reduced-motion is requested, WebGL is unavailable,
       or the device reports low CPU concurrency (battery/thermal friendly)
     - clamps device-pixel-ratio, and pauses when the hero scrolls off-screen
       or the tab is hidden, so it costs nothing when not visible.
   If anything fails, the existing static hero image is untouched.
--------------------------------------------------------------------------- */
(function () {
  var host = document.querySelector('.hero');
  if (!host) return;

  var mq = window.matchMedia;
  if (mq && mq('(prefers-reduced-motion: reduce)').matches) return;      // respect motion prefs
  if (mq && !mq('(min-width: 901px)').matches) return;                    // desktop hero layout only; mobile stays static
  // very low-core devices: keep the static hero to save battery/heat
  if ((navigator.hardwareConcurrency || 8) <= 3) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;                                                        // no WebGL -> static hero stays

  var scrim = host.querySelector('.hero-scrim');                         // place after .hero-bg, before the scrim
  if (scrim) host.insertBefore(canvas, scrim); else host.appendChild(canvas);
  host.classList.add('hero-gl-on');

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

  // Domain-warped fBm -> molten ember gradient in the Red Crown palette.
  var FRAG = [
    'precision highp float;',
    'uniform vec2 u_res; uniform float u_time;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/u_res.xy;',
    '  vec2 p=uv*vec2(u_res.x/u_res.y,1.0)*2.2;',
    '  float t=u_time*0.11;',
    '  vec2 q=vec2(fbm(p+t),fbm(p-t+7.3));',
    '  vec2 r=vec2(fbm(p+1.9*q+vec2(1.7,9.2)+0.35*t),fbm(p+1.9*q+vec2(8.3,2.8)-0.28*t));',
    '  float f=fbm(p+2.3*r);',
    '  vec3 black=vec3(0.055,0.031,0.039);',
    '  vec3 maroon=vec3(0.463,0.137,0.184);',
    '  vec3 red=vec3(0.784,0.063,0.180);',
    '  vec3 col=mix(black,maroon,smoothstep(0.18,0.70,f));',
    '  col=mix(col,red,pow(smoothstep(0.45,0.90,f+0.20*r.x),2.0)*1.0);',
    '  float emb=pow(smoothstep(0.60,1.0,f),2.0);',           // embers
    '  col+=red*emb*1.5;',
    '  float side=smoothstep(0.80,0.40,uv.x);',               // fade OUT over the girl (right side) so she never lights up',
    '  float vig=smoothstep(1.40,0.08,length(uv-0.5))*side;', // edge fade * side mask
    '  col*=vig;',
    '  float alpha=(0.42+0.78*f)*vig;',
    '  gl_FragColor=vec4(col,alpha);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }
  var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); host.classList.remove('hero-gl-on'); return; }
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); host.classList.remove('hero-gl-on'); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // fullscreen triangle
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'u_res'), uTime = gl.getUniformLocation(prog, 'u_time');

  var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  function resize() {
    var w = Math.max(1, Math.floor(host.clientWidth * dpr));
    var h = Math.max(1, Math.floor(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  window.addEventListener('resize', resize, { passive: true });

  var visible = true, running = true, t0 = null;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) req(); }, { threshold: 0 }).observe(host);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) req(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { t0 = null; req(); } });  // bfcache restore
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); running = false; }, false);

  var raf = 0;
  function frame(ts) {
    raf = 0;
    if (!running || !visible || document.hidden) return;                 // pause when not shown
    if (t0 === null) t0 = ts;
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (ts - t0) / 1000);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    req();
  }
  function req() { if (!raf && running) raf = requestAnimationFrame(frame); }
  resize(); req();
})();
