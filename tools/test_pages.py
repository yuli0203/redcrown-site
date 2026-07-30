"""Design / functionality / responsivity suite for the service and case-study pages."""
import functools, threading, os, sys, json, re, collections
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=os.getcwd()))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}"

PAGES = ["/services/",
         "/work/enzymatic-lab-ar/", "/work/fugacity-vr-lab/",
         "/work/livemol-research-tool/", "/work/meta-quest-classroom/"]

# Derived, never hard-coded: adding a page must not silently reshuffle the
# section split and make the pager loop check assert the wrong thing.
SECTIONS = {s: [p for p in PAGES if p.startswith("/%s/" % s)] for s in ("services", "work")}

VIEWPORTS = [(320, "320 iPhone SE"), (390, "390 iPhone 12"), (412, "412 Pixel"),
             (768, "768 iPad"), (1024, "1024 small laptop"), (1440, "1440 desktop"),
             (1920, "1920 wide")]

PALETTE = {"rgb(240, 234, 228)", "rgb(168, 157, 160)", "rgb(200, 16, 46)",
           "rgb(26, 16, 19)", "rgb(14, 8, 10)", "rgb(34, 21, 25)"}

fails = collections.defaultdict(list)
def fail(cat, msg): fails[cat].append(msg)

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---------- A. structure, design tokens, a11y, schema (desktop) ----------
    meta = {}
    for path in PAGES:
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + path, wait_until="load"); pg.wait_for_timeout(900)
        d = pg.evaluate("""() => {
            const cs = n => getComputedStyle(n);
            const heads = [...document.querySelectorAll('h1,h2,h3')].map(h=>+h.tagName[1]);
            const links = [...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
            const body = cs(document.body);
            const h1 = document.querySelector('h1');
            return {
              title: document.title,
              desc: document.querySelector('meta[name=description]')?.content || '',
              canonical: document.querySelector('link[rel=canonical]')?.href || '',
              h1text: h1 ? h1.innerText.replace(/\\s+/g,' ').trim() : '',
              h1count: document.querySelectorAll('h1').length,
              heads, links,
              bodyFont: body.fontFamily.split(',')[0].replace(/["']/g,''),
              h1Font: h1 ? cs(h1).fontFamily.split(',')[0].replace(/["']/g,'') : '',
              h1Color: h1 ? cs(h1).color : '',
              accentColor: document.querySelector('h1 em') ? cs(document.querySelector('h1 em')).color : '',
              bg: body.backgroundColor,
              imgsNoAlt: [...document.images].filter(i=>!i.alt||!i.alt.trim()).length,
              imgCount: document.images.length,
              schema: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent),
              panels: document.querySelectorAll('.panel').length,
              pagerLinks: [...document.querySelectorAll('.pg-pager a')].map(a=>a.getAttribute('href')),
              crumbLinks: [...document.querySelectorAll('.pg-crumb a')].map(a=>a.getAttribute('href')),
            };
        }""")
        meta[path] = d
        if errs: fail("console", f"{path}: {errs[0][:90]}")
        if d["h1count"] != 1: fail("structure", f"{path}: {d['h1count']} h1 elements")
        if d["imgsNoAlt"]: fail("a11y", f"{path}: {d['imgsNoAlt']} image(s) without alt")
        # heading order must not skip a level
        prev = 0
        for lv in d["heads"]:
            if prev and lv > prev + 1: fail("a11y", f"{path}: heading jumps h{prev}->h{lv}")
            prev = lv
        if d["h1Font"] != "Chakra Petch": fail("design", f"{path}: h1 font is {d['h1Font']}")
        if d["bodyFont"] != "IBM Plex Sans": fail("design", f"{path}: body font is {d['bodyFont']}")
        if d["accentColor"] and d["accentColor"] not in PALETTE:
            fail("design", f"{path}: accent {d['accentColor']} off-palette")
        if d["bg"] not in PALETTE and d["bg"] != "rgba(0, 0, 0, 0)":
            fail("design", f"{path}: body bg {d['bg']} off-palette")
        for raw in d["schema"]:
            try:
                j = json.loads(raw)
            except Exception as e:
                fail("schema", f"{path}: invalid JSON-LD ({e})"); continue
            if "@type" not in j: fail("schema", f"{path}: schema without @type")
        if d["canonical"] != "https://redcrowninteractive.com" + path:
            fail("seo", f"{path}: canonical is {d['canonical']}")
        pg.close()

    # uniqueness of title / description / h1
    for field in ("title", "desc", "h1text"):
        seen = collections.Counter(meta[p][field] for p in PAGES)
        for val, n in seen.items():
            if n > 1: fail("seo", f"duplicate {field} on {n} pages: {val[:52]}")
        for p in PAGES:
            if not meta[p][field].strip(): fail("seo", f"{p}: empty {field}")

    # ---------- B. link integrity ----------
    targets = set()
    for p in PAGES:
        for h in meta[p]["links"]:
            if h.startswith("/") and not h.startswith("//"):
                targets.add(h.split("#")[0] or "/")
    pg = b.new_page()
    for t in sorted(targets):
        r = pg.request.get(BASE + t)
        if r.status >= 400: fail("links", f"{t} -> {r.status}")
    pg.close()

    # ---------- C. pager forms a closed loop per section ----------
    for section, group in SECTIONS.items():
        # A section with one page has nothing to page between, and the
        # generator correctly omits the arrows there.
        if len(group) < 2:
            continue
        nxt = {}
        for p in group:
            pl = meta[p]["pagerLinks"]
            if len(pl) != 2: fail("nav", f"{p}: {len(pl)} pager links"); continue
            nxt[p] = pl[1]
        cur, seen = group[0], []
        for _ in range(len(group)):
            seen.append(cur); cur = nxt.get(cur)
            if cur is None: break
        if cur != group[0] or len(set(seen)) != len(group):
            fail("nav", f"{section}: next-links do not form a single loop over {len(group)} pages")

    # ---------- D. responsivity ----------
    for path in PAGES:
        for w, label in VIEWPORTS:
            pg = b.new_page(viewport={"width": w, "height": 900})
            pg.goto(BASE + path, wait_until="load"); pg.wait_for_timeout(500)
            r = pg.evaluate("""(vw) => {
                const de = document.documentElement;
                const small = [...document.querySelectorAll('main p, main li')]
                    .map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(s=>s<13).length;
                const tap = vw<=520 ? [...document.querySelectorAll('main a, nav a')].filter(a=>{
                    const b=a.getBoundingClientRect();
                    return b.width>0 && b.height>0 && b.height<32; }).length : 0;
                const wide = [...document.querySelectorAll('main *')].filter(e=>{
                    const b=e.getBoundingClientRect(); return b.width>vw+2; }).length;
                const cards = document.querySelector('.cards3');
                const facts = document.querySelector('.pg-facts');
                const cols = n => n ? getComputedStyle(n).gridTemplateColumns.split(' ').length : 0;
                // text cut off by its own box. overflow-x:clip on html hides this
                // from the page-level number above, which is how a chopped heading
                // shipped to production unnoticed.
                let clipped = '';
                for (const e of document.querySelectorAll('body *')) {
                    const c = getComputedStyle(e);
                    if (c.display==='none'||c.visibility==='hidden') continue;
                    if (c.textOverflow==='ellipsis') continue;
                    if (['auto','scroll'].includes(c.overflowX)) continue;
                    const own=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
                    if (!own) continue;
                    if (e.clientWidth>0 && e.scrollWidth > e.clientWidth+1) {
                        clipped = `<${e.tagName.toLowerCase()} class="${e.className}"> +${e.scrollWidth-e.clientWidth}px "${(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,38)}"`;
                        break;
                    }
                }
                return {overflow: de.scrollWidth - vw, small, tap, wide, clipped,
                        cardCols: cols(cards), factCols: cols(facts),
                        pagerDir: document.querySelector('.pg-pager')
                            ? getComputedStyle(document.querySelector('.pg-pager')).flexDirection : ''};
            }""", w)
            if r["clipped"]: fail("clipping", f"{path} @{label}: {r['clipped']}")
            if r["overflow"] > 2: fail("responsive", f"{path} @{label}: {r['overflow']}px horizontal overflow")
            if r["wide"]: fail("responsive", f"{path} @{label}: {r['wide']} element(s) wider than viewport")
            if r["small"]: fail("responsive", f"{path} @{label}: {r['small']} text run(s) under 13px")
            if r["tap"]: fail("responsive", f"{path} @{label}: {r['tap']} tap target(s) under 32px tall")
            if w <= 520 and r["cardCols"] > 1: fail("responsive", f"{path} @{label}: cards still {r['cardCols']} columns")
            if w <= 520 and r["factCols"] > 2: fail("responsive", f"{path} @{label}: fact tiles {r['factCols']} columns")
            if w <= 760 and r["pagerDir"] and r["pagerDir"] != "column":
                fail("responsive", f"{path} @{label}: pager not stacked ({r['pagerDir']})")
            pg.close()
    b.close()
srv.shutdown()

CATS = ["structure", "design", "responsive", "clipping", "nav", "links", "seo", "a11y", "schema", "console"]
total = sum(len(fails[c]) for c in CATS)
print(f"pages: {len(PAGES)}   viewports: {len(VIEWPORTS)}   renders: {len(PAGES)*(len(VIEWPORTS)+1)}")
for c in CATS:
    n = len(fails[c])
    print(f"  {c:11} {'PASS' if n==0 else 'FAIL ('+str(n)+')'}")
    for m in fails[c][:6]: print(f"      - {m}")
print()
print("ALL PASS" if total == 0 else f"{total} PROBLEM(S)")
sys.exit(1 if total else 0)
