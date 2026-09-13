# Red Crown Interactive — Company Website

Studio site for [redcrowninteractive.com](https://redcrowninteractive.com).
Static, zero build step: `index.html` + self-hosted fonts + brand assets.

## Structure
- `index.html` — the entire site (styles inline)
- `assets/` — logo SVGs used by the site
- `fonts/` — self-hosted woff2 (Michroma, Chakra Petch, IBM Plex Sans — all OFL)
- `brand/` — master brand files: logo variants (SVG) and print cards (PDF)

## Deploy (GitHub Pages)
The live site is served by GitHub Pages from `main` at `/` (apex A records →
185.199.108–111.153, `www` CNAME → yuli0203.github.io, `CNAME` file in the repo).
Every push to `main` auto-deploys.

GitHub Pages does not read `_redirects` (that file is Cloudflare Pages syntax and
is kept only in case the site moves there). A moved URL therefore needs a small
redirect page at the old path — see `services/vr-development/index.html` and
`ar-vr/index.html` — which carries a canonical to the new URL and forwards the
query string so Google Ads `gclid`/UTM parameters survive.

## Hebrew campaign pages
`he/<slug>/index.html` is generated: edit `tools/build_he_landing_pages.py`, then
run `python tools/build_he_landing_pages.py`. Each page links to the other
campaign pages, and `/he/` links into them, so none is orphaned.
