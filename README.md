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

## Soro blog

`/blog/` embeds the Soro blog for redcrowninteractive.com in Hebrew and dark mode.
The footer on each homepage links to it. Content is managed in the existing Soro
account under Articles; only published articles appear in the widget. Soro notes
that published content can take up to 60 minutes to appear. The public embed ID
is intentionally present in the page; it is not an account credential.

The Soro connection is managed under Settings > Connect Your Website. Existing
drafts are not published by this integration. The widget depends on Soro and
JavaScript; embedding alone does not guarantee indexing or search rankings.
The canonical tag is marked `data-soro` so article navigation can update it
without adding a second canonical URL. To roll back the website integration,
revert the Soro blog commit and disable the embed connection in Soro.

GitHub Pages does not read `_redirects` (that file is Cloudflare Pages syntax and
is kept only in case the site moves there). A moved URL therefore needs a small
redirect page at the old path — see `services/vr-development/index.html` and
`ar-vr/index.html` — which carries a canonical to the new URL and forwards the
query string so Google Ads `gclid`/UTM parameters survive.

## Hebrew campaign pages
All six landing pages, including VR, are generated from one HTML template:
`tools/templates/landing-page.html`. The template contains the shared page and
named components for the hero, projects, form, footer, icons and other sections.
An edit to this template is applied to every page by the same renderer.

Page-specific copy, SEO metadata, project images, models and FAQ answers live in
`tools/landing-pages.json`. To add a landing page, add a catalog entry with its
own slug and content. The generator discovers it automatically. The `style`,
`stage`, `projects`, `related` and `next_step` settings preserve the approved
layout variations without separate page templates.

Run `python tools/build_he_landing_pages.py` after changing content or markup.
Do not hand-edit generated `he/<slug>/index.html` files. Shared styles and
interactions remain in `he/vr-development/vr-landing.css` and `vr-landing.js`;
service layout adjustments live in `landing-services.css`.

Run `python tools/build_he_landing_pages.py --check` and
`python tools/test_campaign_pages.py` to check generated output, metadata,
links, form fields, structured data and shared-template propagation. Tests do
not send contact requests. `tools/landing_pages.py` contains only rendering
logic; `tools/build_he_landing_pages.py` is the command-line entry point.
