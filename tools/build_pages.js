#!/usr/bin/env node
/*
 * Render the standalone service and case-study pages from tools/pages.data.js.
 *
 * These are additive: they reuse site.css and link into the home page, but the
 * home page itself is untouched. They deliberately do NOT load site.js, which
 * expects the language switcher markup and would throw without it, and whose
 * reveal animations would otherwise leave sections invisible.
 *
 *   node tools/build_pages.js          write every page
 *   node tools/build_pages.js --check  fail if anything on disk is out of date
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { SERVICES, WORK } = require('./pages.data.js');
const chrome = require('./chrome.js');   // nav, footer, WhatsApp, language switcher

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://redcrowninteractive.com';
// Match whatever this checkout actually has. Git normalises line endings per
// platform, so hard-coding CRLF makes every page look stale on a Linux runner.
const EOL = fs.readFileSync(path.join(ROOT, 'site.css'), 'utf8').includes('\r\n') ? '\r\n' : '\n';

const bySlug = {};
for (const p of SERVICES) bySlug[p.slug] = { ...p, section: 'services' };
for (const p of WORK) bySlug[p.slug] = { ...p, section: 'work' };

const esc = s => String(s).replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;').replace(/"/g, '&quot;');
// An empty slug means the page IS the section: /services/ rather than
// /services/something/. That changes its URL, its file path, and how far
// it must reach back up for shared assets.
const hrefOf = p => (p.slug ? `/${p.section}/${p.slug}/` : `/${p.section}/`);
const upOf = p => (p.slug ? '../../' : '../');
const urlOf = p => `${SITE}${hrefOf(p)}`;

/* ---------- shared chrome ---------- */

function head(p) {
  const up = upOf(p);
  const isWork = p.section === 'work';
  const crumbName = p.section === 'services' ? 'Services' : 'Work';
  const crumbHash = p.section === 'services' ? '#services' : '#work';

  const schema = isWork ? {
    '@context': 'https://schema.org', '@type': 'CreativeWork',
    name: p.nav, headline: p.title.split(' | ')[0], url: urlOf(p),
    inLanguage: 'en', description: p.desc,
    image: `${SITE}/${p.image.src}`,
    creator: { '@type': 'Organization', name: 'Red Crown Interactive', url: SITE + '/' },
  } : {
    '@context': 'https://schema.org', '@type': 'Service',
    name: p.nav, serviceType: p.serviceType, url: urlOf(p),
    inLanguage: 'en', description: p.desc, areaServed: ['IL', 'Worldwide'],
    provider: {
      '@type': ['Organization', 'ProfessionalService'], name: 'Red Crown Interactive',
      url: SITE + '/', logo: `${SITE}/assets/logo-kit/redcrown-solid.png`,
      email: 'hello@redcrowninteractive.com', telephone: '+972-58-576-0550',
      address: { '@type': 'PostalAddress', addressLocality: 'Haifa', addressCountry: 'IL' },
    },
  };

  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: crumbName, item: SITE + '/' + crumbHash },
      { '@type': 'ListItem', position: 3, name: p.nav },
    ],
  };

  return [
    '<!DOCTYPE html>',
    '<html lang="en" data-page-lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="theme-color" content="#0E080A">',
    // Same Google tag as the home page: without it, Google Ads can neither
    // attribute a visit that lands here nor record the contact-click conversion.
    '<!-- Google tag (gtag.js) -->',
    '<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18313532220"></script>',
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    "  gtag('js', new Date());",
    "  gtag('config', 'AW-18313532220');",
    '</script>',
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.desc)}">`,
    '<meta name="author" content="Julia Pavlov">',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    `<link rel="stylesheet" href="${up}site.css">`,
    `<link rel="canonical" href="${urlOf(p)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Red Crown Interactive">',
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:title" content="${esc(p.title.split(' | ')[0])}">`,
    `<meta property="og:description" content="${esc(p.desc)}">`,
    `<meta property="og:url" content="${urlOf(p)}">`,
    `<meta property="og:image" content="${SITE}/${isWork ? p.image.src : 'og-image.png'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(p.title.split(' | ')[0])}">`,
    `<meta name="twitter:description" content="${esc(p.desc)}">`,
    `<meta name="twitter:image" content="${SITE}/${isWork ? p.image.src : 'og-image.png'}">`,
    '<script type="application/ld+json">',
    JSON.stringify(schema, null, 2),
    '</script>',
    '<script type="application/ld+json">',
    JSON.stringify(crumbs, null, 2),
    '</script>',
    '</head>',
    '<body>',
  ].join(EOL);
}

// Nav, footer and the floating WhatsApp button all come from tools/chrome.js so
// they cannot drift from the home page.
const nav = p => chrome.nav({ EOL, up: upOf(p), section: p.section });

function breadcrumb(p) {
  const label = p.section === 'services' ? 'Services' : 'Work';
  const hash = p.section === 'services' ? '#services' : '#work';
  return `  <p class="pg-crumb"><a href="/">Home</a> <span>·</span> <a href="/${hash}">${label}</a> <span>·</span> ${esc(p.nav)}</p>`;
}

/* ---------- the project rail ----------
   Every case study, current one lit. Expands on hover and on keyboard focus,
   purely in CSS: real links, no script, and nothing to break if JS is off. */

function ring(p) {
  const up = '../../';
  const items = WORK.map(w => {
    const on = w.slug === p.slug;
    return [
      `    <a class="pg-ring-i${on ? ' is-on' : ''}" href="/work/${w.slug}/"`,
      `       style="--shot:url('${up}${w.image.src}')"${on ? ' aria-current="page"' : ''}>`,
      `      <span class="pg-ring-cat">${esc(w.sub.split('·')[0].trim())}</span>`,
      `      <span class="pg-ring-t">${esc(w.nav)}</span>`,
      on ? '      <i class="pg-ring-bar" aria-hidden="true"></i>' : null,
      '    </a>',
    ].filter(Boolean).join(EOL);
  }).join(EOL);
  return [
    '  <nav class="pg-ring" aria-label="All case studies">',
    items,
    '  </nav>',
  ].join(EOL);
}

/* ---------- prev / next within a section ---------- */

function pager(p) {
  const list = p.section === 'services' ? SERVICES : WORK;
  const i = list.findIndex(x => x.slug === p.slug);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  if (list.length < 2) return '';
  const href = x => `/${p.section}/${x.slug}/`;
  return [
    '  <nav class="pg-pager" aria-label="More in this section">',
    `    <a class="pg-prev" href="${href(prev)}"><span class="pg-arr" aria-hidden="true">←</span><span><i>Previous</i><b>${esc(prev.nav)}</b></span></a>`,
    `    <a class="pg-next" href="${href(next)}"><span><i>Next</i><b>${esc(next.nav)}</b></span><span class="pg-arr" aria-hidden="true">→</span></a>`,
    '  </nav>',
  ].join(EOL);
}

/* ---------- blocks ---------- */

const CHIP_ICON = {
  bulb:   '<svg class="icon" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  gear:   '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  cube:   '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2zM12 11l8-4.5M12 11L4 6.5M12 11v9"/></svg>',
  gauge:  '<svg class="icon" viewBox="0 0 24 24"><path d="M4 14a8 8 0 1 1 16 0"/><path d="M12 14l4-4"/><path d="M2 20h20"/></svg>',
  wrench: '<svg class="icon" viewBox="0 0 24 24"><path d="M14 7a4 4 0 0 1 5.6-3.7L16.5 6.4l1.1 1.1 3.1-3.1A4 4 0 0 1 15 10L7 18a2 2 0 0 1-3-3l8-8z"/></svg>',
};

function relatedCards(slugs) {
  return slugs.map(s => {
    const t = bySlug[s];
    if (!t) throw new Error('unknown related slug: ' + s);
    return [
      `      <a class="panel pg-rel" href="${hrefOf(t)}">`,
      `        <b>${esc(t.nav)}</b>`,
      `        <span>${esc(t.lead)}</span>`,
      '        <i class="pg-rel-go">View project →</i>',
      '      </a>',
    ].join(EOL);
  }).join(EOL);
}

function serviceBody(p) {
  const out = [];
  out.push('<main class="wrap pg" id="main" tabindex="-1">');
  out.push(breadcrumb(p));
  out.push(`  <h1 class="pg-h1">${esc(p.h1[0])}<em>${esc(p.h1[1])}</em></h1>`);
  out.push(`  <p class="pg-lead">${esc(p.lead)}</p>`);
  out.push('  <p class="pg-cta-row"><a class="btn btn-red" href="/#contact">GET A PROJECT PROPOSAL</a>');
  out.push('    <a class="arrow-link" href="/#work">SEE OUR WORK &nbsp;→</a></p>');

  for (const b of p.blocks) {
    if (b.kind === 'cards') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="cards3">');
      for (const it of b.items) {
        out.push(`    <div class="panel pcard"><h3>${esc(it.h)}</h3><p>${it.p}</p></div>`);
      }
      out.push('  </div>');
    } else if (b.kind === 'prose') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="panel pg-prose">');
      for (const t of b.paras) out.push(`    <p>${t}</p>`);
      out.push('  </div>');
    } else if (b.kind === 'chips') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="pg-chips">');
      for (const it of b.items) {
        out.push(`    <div class="pg-chip">${CHIP_ICON[it.icon] || ''}<b>${esc(it.t)}</b></div>`);
      }
      out.push('  </div>');
      if (b.note) out.push(`  <p class="pg-chips-note">${esc(b.note)}</p>`);
    } else if (b.kind === 'icons') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="pg-tech">');
      for (const [file, label] of b.icons) {
        out.push(`    <img class="tech-ico" src="${upOf(p)}assets/Tech/${file}.svg" alt="${esc(label)}" title="${esc(label)}" loading="lazy">`);
      }
      out.push('  </div>');
    } else if (b.kind === 'tiles') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="pg-facts">');
      for (const [k, v] of b.items) out.push(`    <div><i>${esc(k)}</i><b>${esc(v)}</b></div>`);
      out.push('  </div>');
    } else if (b.kind === 'process') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="pr-tracks">');
      for (const tr of b.tracks) {
        out.push('    <div class="pr-track">');
        out.push(`      <h3 class="pr-name">${esc(tr.name)}</h3>`);
        out.push(`      <p class="pr-note">${esc(tr.note)}</p>`);
        out.push('      <ol class="pr-steps">');
        for (const st of tr.steps) {
          out.push('        <li class="pr-step">');
          out.push(`          <span class="pr-when">${esc(st.d)}</span>`);
          out.push(`          <b class="pr-what">${esc(st.t)}</b>`);
          out.push(`          <span class="pr-why">${esc(st.p)}</span>`);
          out.push('        </li>');
        }
        out.push('      </ol>');
        out.push('    </div>');
      }
      out.push('  </div>');
    } else if (b.kind === 'related') {
      out.push(`  <h2 class="sec-k pg-sec">${b.head}</h2>`);
      out.push('  <div class="pg-rels">');
      out.push(relatedCards(b.items));
      out.push('  </div>');
    }
  }

  out.push('  <div class="panel pg-end">');
  out.push(`    <h2>${esc(p.cta.h)}</h2>`);
  out.push(`    <p>${esc(p.cta.p)}</p>`);
  out.push('    <p><a class="btn btn-red" href="/#contact">GET A PROJECT PROPOSAL</a></p>');
  out.push('  </div>');
  out.push(pager(p));
  out.push('</main>');
  return out.join(EOL);
}

function workBody(p) {
  const up = upOf(p);
  const out = [];
  out.push('<main class="wrap pg" id="main" tabindex="-1">');
  out.push(breadcrumb(p));
  out.push(`  <h1 class="pg-h1">${esc(p.h1[0])}<em>${esc(p.h1[1])}</em></h1>`);
  out.push(`  <p class="pg-sub">${esc(p.sub)}</p>`);
  out.push(ring(p));
  out.push(`  <p class="pg-lead">${esc(p.lead)}</p>`);
  // Screenshot and live model side by side, the same pairing the home page uses,
  // so neither dominates and the still can be compared against the real thing.
  out.push('  <div class="pg-media">');
  out.push(`    <img class="pg-hero" src="${up}${p.image.src}" alt="${esc(p.image.alt)}" width="1200" height="900">`);
  if (p.model) {
    out.push(`    <div class="wd-model-wrap" data-model="${p.model.key}"` +
             `${EOL}         data-alt="${esc(p.model.alt)}"` +
             `${EOL}         data-badge="${esc(p.model.badge)}"></div>`);
  }
  out.push('  </div>');
  if (p.model) out.push(`  <p class="wd-model-hint">${esc(p.model.hint)}</p>`);

  out.push('  <div class="pg-facts">');
  for (const [k, v] of p.facts) out.push(`    <div><i>${esc(k)}</i><b>${esc(v)}</b></div>`);
  out.push('  </div>');

  p.story.forEach(([headTxt, body], i) => {
    out.push(`  <h2 class="sec-k pg-sec">${headTxt.toUpperCase()}</h2>`);
    const last = i === p.story.length - 1;
    // the credit sits inside the result panel, directly below its paragraph
    // and sharing its left edge. "Developed at", not "client": this work was
    // led from inside the group, so a client label would misstate it
    const cred = last && p.client
      ? `<p class="pg-client">Developed at <a href="${p.client.url}" target="_blank" rel="noopener">${esc(p.client.name)}</a></p>`
      : '';
    out.push(`  <div class="panel pg-prose"><p>${body}</p>${cred}</div>`);
  });

  const svc = bySlug[p.service];
  if (svc) {
    out.push('  <h2 class="sec-k pg-sec">THE SERVICE BEHIND IT</h2>');
    out.push('  <div class="pg-rels">');
    out.push([
      `      <a class="panel pg-rel" href="${hrefOf(svc)}">`,
      `        <b>${esc(svc.nav)}</b>`,
      `        <span>${esc(svc.lead)}</span>`,
      '        <i class="pg-rel-go">Read more →</i>',
      '      </a>',
    ].join(EOL));
    out.push('  </div>');
  }

  out.push('  <div class="panel pg-end">');
  out.push('    <h2>Want something like this for your course or team?</h2>');
  out.push('    <p>Tell us what you want to build, even if it is still a rough idea.</p>');
  out.push('    <p><a class="btn btn-red" href="/#contact">GET A PROJECT PROPOSAL</a></p>');
  out.push('  </div>');
  out.push(pager(p));
  out.push('</main>');
  return out.join(EOL);
}

const footer = p => chrome.footer({ EOL, up: upOf(p) }) + chrome.waFloat(EOL);

// The old inline footer also carried the model-cards script and the closing tags.
// When the chrome moved to chrome.js those went with it, and every generated page
// silently lost its 3D models. The page tail now lives here, explicitly.
const tail = p => [
  // These pages do not load site.js, so the contact-click conversion lives here.
  // Keep the send_to label in sync with ADS_CONVERSIONS.phoneClick in site.js.
  '<script>',
  "document.addEventListener('click', function (e) {",
  "  var a = e.target.closest && e.target.closest('a[href^=\"tel:\"], a[href*=\"wa.me/\"]');",
  "  if (a && typeof gtag === 'function') gtag('event', 'conversion', { send_to: 'AW-18313532220/zWKzCPjS89QcELymyZxE', transport_type: 'beacon' });",
  '});',
  '</script>',
  `<script src="${upOf(p)}model-cards.js" defer></script>`,
  `<script src="${upOf(p)}rail-nav.js" defer></script>`,
  `<script src="${upOf(p)}float.js" defer></script>`,
  '</body>',
  '</html>',
  '',
].join(EOL);

function render(p) {
  return head(p) + nav(p) + (p.section === 'services' ? serviceBody(p) : workBody(p)) + footer(p) + tail(p);
}

/* ---------- run ---------- */

const all = [...SERVICES.map(p => ({ ...p, section: 'services' })),
             ...WORK.map(p => ({ ...p, section: 'work' }))];
const check = process.argv.includes('--check');
let stale = 0;

for (const p of all) {
  const dir = path.join(ROOT, p.section, p.slug);
  const file = path.join(dir, 'index.html');
  const html = render(p);
  if (check) {
    const norm = s => (s === null ? null : s.replace(/\r\n/g, '\n'));
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (norm(cur) !== norm(html)) { console.error(`[pages] stale: ${hrefOf(p)}index.html`); stale++; }
  } else {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, html);
    console.log(`  wrote ${hrefOf(p)}index.html`);
  }
}

if (check) {
  console.error(stale ? `[pages] FAIL: ${stale} page(s) out of date, run: node tools/build_pages.js`
                      : `[pages] ok: all ${all.length} pages current`);
  process.exit(stale ? 1 : 0);
}
console.log(`[pages] ${all.length} pages written`);
