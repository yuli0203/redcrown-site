# Red Crown Interactive — Company Website

Studio site for [redcrowninteractive.com](https://redcrowninteractive.com).
Static, zero build step: `index.html` + self-hosted fonts + brand assets.

## Structure
- `index.html` — the entire site (styles inline)
- `assets/` — logo SVGs used by the site
- `fonts/` — self-hosted woff2 (Michroma, Chakra Petch, IBM Plex Sans — all OFL)
- `brand/` — master brand files: logo variants (SVG) and print cards (PDF)

## Deploy (Cloudflare Pages)
1. Cloudflare → Workers & Pages → Create → connect this repo
2. Build command: none · Output directory: `/`
3. Custom domain: redcrowninteractive.com → add the CNAME it gives you in Porkbun DNS

Every push to `main` auto-deploys.
