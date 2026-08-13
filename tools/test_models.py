#!/usr/bin/env python3
"""
Functional test for the shared 3D model cards (model-cards.js).

The model cards are the one part of the site that headless CSS checks cannot
judge: whether the library loads, whether the card is actually built from the
config, whether the model finishes loading, and whether the zoom slider really
moves the camera. This drives all of that for real, in a browser, with software
WebGL.

Run:  py tools/test_models.py
"""
import os, sys, threading, functools, contextlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    from playwright.sync_api import sync_playwright
except Exception:
    print("[models] Playwright not installed; skipping (exit 0).")
    sys.exit(0)

GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

# page, how to reveal the cards, how many cards that page should have
CASES = [
    ("/",     "cards", 4),
    ("/he/",  "cards", 4),
    ("/ru/",  "cards", 4),
    ("/work/enzymatic-lab-ar/",      "inline", 1),
    ("/work/fugacity-vr-lab/",       "inline", 1),
    ("/work/livemol-research-tool/", "inline", 1),
    ("/work/meta-quest-classroom/",  "inline", 1),
]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=REPO))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    fails = []

    with sync_playwright() as p:
        b = p.chromium.launch(args=GL)
        for path, how, expect in CASES:
            errs = []
            pg = b.new_page(viewport={"width": 1280, "height": 900})
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            try:
                pg.goto(base + path, wait_until="load", timeout=45000)
                pg.wait_for_timeout(1200)

                if how == "cards":
                    # the home page builds its cards when a work card is opened
                    pg.evaluate("""() => {
                        const b = document.querySelector('.wcard[data-project]');
                        if (b) b.click();
                    }""")
                else:
                    pg.evaluate("document.querySelector('.pg-media, .pg-model').scrollIntoView()")

                # the custom element must get defined, i.e. the library really loaded
                pg.wait_for_function("!!(window.customElements && customElements.get('model-viewer'))",
                                     timeout=30000)
                # every declared card must have been built from the config
                pg.wait_for_function(
                    "document.querySelectorAll('.wd-model-wrap[data-model] model-viewer').length >= %d" % expect,
                    timeout=20000)
                # and at least one model must finish loading its geometry
                pg.wait_for_function(
                    "[...document.querySelectorAll('model-viewer')].some(m => m.loaded)",
                    timeout=60000)

                info = pg.evaluate("""() => {
                    const wraps = [...document.querySelectorAll('.wd-model-wrap[data-model]')];
                    const mv = wraps.map(w => w.querySelector('model-viewer')).filter(Boolean);
                    return {
                      wraps: wraps.length,
                      built: mv.length,
                      loaded: mv.filter(m => m.loaded).length,
                      srcs: mv.map(m => m.getAttribute('src')),
                      alts: mv.map(m => (m.getAttribute('alt') || '').slice(0, 18)),
                      sliders: wraps.filter(w => w.querySelector('.wd-zoom')).length,
                      badges: wraps.filter(w => w.querySelector('.wd-model-badge')).length,
                      ltr: mv.every(m => m.getAttribute('dir') === 'ltr'),
                    };
                }""")

                # the zoom slider must actually move the camera
                zoom = pg.evaluate("""async () => {
                    const w = document.querySelector('.wd-model-wrap[data-model]');
                    const mv = w.querySelector('model-viewer'), sl = w.querySelector('.wd-zoom');
                    if (!mv || !sl) return {ok:false, why:'no slider'};
                    const before = mv.fieldOfView;
                    sl.value = 95; sl.dispatchEvent(new Event('input', {bubbles:true}));
                    await new Promise(r => setTimeout(r, 250));
                    const after = mv.fieldOfView;
                    return {ok: before !== after, before, after};
                }""")

                bad = []
                if info["built"] != info["wraps"]:
                    bad.append("only %d of %d cards built from config" % (info["built"], info["wraps"]))
                if info["wraps"] != expect:
                    bad.append("expected %d card(s), found %d" % (expect, info["wraps"]))
                if not info["loaded"]:
                    bad.append("no model finished loading")
                if info["sliders"] != info["wraps"]:
                    bad.append("missing zoom slider on %d card(s)" % (info["wraps"] - info["sliders"]))
                if info["badges"] != info["wraps"]:
                    bad.append("missing badge on %d card(s)" % (info["wraps"] - info["badges"]))
                if not info["ltr"]:
                    bad.append("a viewer is not forced to dir=ltr")
                if any(not s or not s.startswith("/assets/models/") for s in info["srcs"]):
                    bad.append("model src not root-absolute: %s" % info["srcs"])
                if any(not a for a in info["alts"]):
                    bad.append("a viewer has no alt text")
                if not zoom.get("ok"):
                    bad.append("zoom slider did not change field of view (%s -> %s)"
                               % (zoom.get("before"), zoom.get("after")))
                if errs:
                    bad.append("JS error: %s" % errs[0][:90])

                status = "OK  " if not bad else "FAIL"
                print("  [%s] %-32s %d built, %d loaded, zoom %s->%s"
                      % (status, path, info["built"], info["loaded"],
                         zoom.get("before"), zoom.get("after")))
                for x in bad:
                    print("          - %s" % x)
                    fails.append("%s: %s" % (path, x))
            except Exception as ex:
                print("  [ERR ] %-32s %s" % (path, str(ex).splitlines()[0][:90]))
                fails.append("%s: %s" % (path, str(ex).splitlines()[0][:90]))
            finally:
                pg.close()
        b.close()
    httpd.shutdown()

    print()
    if fails:
        print("[models] BLOCKED: %d problem(s)." % len(fails))
        return 1
    print("[models] PASS: every card builds from the shared config, loads, and zooms.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
