#!/usr/bin/env python3
"""
Pre-push element-integrity guard for redcrowninteractive.com.

Renders the site across a small mobile/tablet device matrix (real WebKit +
Chromium engines) and FAILS (exit 1) if any element breaks, e.g.:
  - horizontal page overflow
  - the hero <h1> clipping/overflowing its box
  - any <img> that failed to load or renders with broken geometry
    (absurd aspect ratio -- this is the "founder portrait went huge" class of bug)
  - contact-form inputs under 16px (iOS focus-zoom)
  - scroll-reveal sections left permanently invisible
  - JavaScript console/page errors

Run manually:  py tools/verify_no_break.py
Runs automatically from .githooks/pre-push before every push.

Exit codes: 0 = all clear (or tooling unavailable -> warn & allow), 1 = breakage.
"""
import os, sys, threading, functools, contextlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Missing tooling must not block a push on a machine that simply can't verify.
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print("[verify] Playwright not installed; skipping element check (push allowed).")
    print("[verify]   to enable: pip install playwright && playwright install chromium webkit")
    sys.exit(0)

# device, engine, playwright-device-name, path
MATRIX = [
    ("iPhone SE",   "webkit",   "iPhone SE",  "/"),      # 320px - tightest
    ("iPhone 12",   "webkit",   "iPhone 12",  "/"),      # 390px
    ("Galaxy S9+",  "chromium", "Galaxy S9+", "/"),      # 320px Android
    ("Pixel 7",     "chromium", "Pixel 7",    "/"),      # 412px
    ("iPad Mini",   "webkit",   "iPad Mini",  "/"),      # 768px
    ("iPhone SE HE","webkit",   "iPhone SE",  "/he/"),   # Hebrew RTL
]

AUTOSCROLL = """async () => {
  await new Promise(res => { let y=0; const s=()=>{ window.scrollTo(0,y);
    y+=Math.round(window.innerHeight*0.75);
    if (y<document.body.scrollHeight) setTimeout(s,110);
    else { window.scrollTo(0,document.body.scrollHeight); setTimeout(res,350);} }; s(); });
}"""

# Runs in-page; returns a list of human-readable problem strings.
INTEGRITY = r"""
() => {
  const problems = [];
  const vw = document.documentElement.clientWidth;

  // 1. horizontal page overflow
  if (document.documentElement.scrollWidth > vw + 2)
    problems.push(`horizontal overflow: page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`);

  // 2. hero headline clipping
  const h1 = document.querySelector('.hero h1');
  if (!h1) problems.push('hero <h1> missing');
  else if (h1.scrollWidth > h1.clientWidth + 1)
    problems.push(`hero headline overflows its box (${h1.scrollWidth} > ${h1.clientWidth}) -- text is clipped`);

  // 3. images: loaded + sane geometry (catches the "went huge / squished" class)
  for (const im of document.querySelectorAll('img')) {
    const r = im.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;               // hidden / decorative
    if (im.complete && im.naturalWidth === 0)
      problems.push(`image failed to load: ${im.currentSrc || im.src}`);
    const ratio = r.width / r.height;
    if (ratio > 3.2 || ratio < 0.31)
      problems.push(`image geometry broken: ${(im.getAttribute('class')||im.src)} renders ${Math.round(r.width)}x${Math.round(r.height)} (ratio ${ratio.toFixed(2)})`);
    if (r.width > vw + 2)
      problems.push(`image wider than viewport: ${(im.getAttribute('class')||im.src)} = ${Math.round(r.width)}px`);
  }

  // 4. form inputs must be >=16px on mobile (iOS focus-zoom)
  if (vw <= 900) {
    for (const f of document.querySelectorAll('.field input, .field select, .field textarea')) {
      const fs = parseFloat(getComputedStyle(f).fontSize);
      if (fs < 16) { problems.push(`form control font-size ${fs}px < 16px (causes iOS zoom)`); break; }
    }
  }

  // 5. scroll-reveal content must not be stuck invisible
  const stuck = document.querySelectorAll('.rv:not(.in)').length;
  if (stuck > 0) problems.push(`${stuck} scroll-reveal section(s) stuck invisible (opacity:0)`);

  // 6. structural sanity
  if (!document.querySelector('nav')) problems.push('nav missing');
  if (!document.querySelector('footer')) problems.push('footer missing');

  return problems;
}
"""

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *a):  # keep the hook output readable
        pass

def start_server():
    handler = functools.partial(QuietHandler, directory=REPO)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]

def main():
    httpd, port = start_server()
    base = f"http://127.0.0.1:{port}"
    failures = []
    try:
        with sync_playwright() as p:
            for label, engine, device, path in MATRIX:
                cerr, perr = [], []
                try:
                    b = getattr(p, engine).launch()
                    ctx = b.new_context(**p.devices[device],
                                        locale=("he-IL" if path == "/he/" else "en-US"))
                    pg = ctx.new_page()
                    pg.on("console", lambda m: cerr.append(m.text) if m.type == "error" else None)
                    pg.on("pageerror", lambda e: perr.append(str(e)))
                    pg.goto(base + path, wait_until="load", timeout=45000)
                    with contextlib.suppress(Exception):
                        pg.wait_for_load_state("networkidle", timeout=8000)
                    pg.evaluate(AUTOSCROLL)
                    pg.evaluate("window.scrollTo(0,0)")
                    pg.wait_for_timeout(300)
                    problems = pg.evaluate(INTEGRITY)
                    if perr: problems.append(f"JS page error: {perr[0]}")
                    if cerr: problems.append(f"JS console error: {cerr[0]}")
                    status = "OK  " if not problems else "FAIL"
                    print(f"  [{status}] {label} ({engine})")
                    for pr in problems:
                        print(f"          - {pr}")
                        failures.append(f"{label}: {pr}")
                    b.close()
                except Exception as ex:
                    print(f"  [ERR ] {label} ({engine}) -> {ex}")
                    failures.append(f"{label}: harness error {ex}")
    finally:
        httpd.shutdown()

    print()
    if failures:
        print(f"[verify] BLOCKED: {len(failures)} problem(s) found across the device matrix.")
        return 1
    print("[verify] PASS: no elements broke across the device matrix.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
