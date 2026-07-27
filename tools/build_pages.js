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

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://redcrowninteractive.com';
// Match whatever this checkout actually has. Git normalises line endings per
// platform, so hard-coding CRLF makes every page look stale on a Linux runner.
const EOL = fs.readFileSync(path.join(ROOT, 'site.css'), 'utf8').includes('\r\n') ? '\r\n' : '\n';

const bySlug = {};
for (const p of SERVICES) bySlug[p.slug] = { ...p, section: 'services' };
for (const p of WORK) bySlug[p.slug] = { ...p, section: 'work' };

const esc = s => String(s).replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;').replace(/"/g, '&quot;');
const urlOf = p => `${SITE}/${p.section}/${p.slug}/`;

/* ---------- shared chrome ---------- */

function head(p) {
  const up = '../../';
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

function nav(p) {
  const up = '../../';
  const on = s => (p.section === s ? ' class="on"' : '');
  return [
    '',
    '<nav>',
    '  <div class="nav-in">',
    '    <a class="logo" href="/">',
    `      <img src="${up}assets/logo-kit/redcrown-primary-scarlet.svg" alt="Red Crown Interactive logo" width="40" height="40">`,
    '      <span><b>RED CROWN</b><i>INTERACTIVE</i></span>',
    '    </a>',
    '    <ul class="nav-links">',
    '      <li><a href="/">HOME</a></li>',
    `      <li><a${on('services')} href="/#services">SERVICES</a></li>`,
    `      <li><a${on('work')} href="/#work">WORK</a></li>`,
    '      <li><a href="/#about">ABOUT</a></li>',
    '      <li><a href="/#contact">CONTACT</a></li>',
    '    </ul>',
    '    <a class="btn btn-line nav-cta" href="/#contact">GET A PROPOSAL</a>',
    '  </div>',
    '</nav>',
    '',
  ].join(EOL);
}

function breadcrumb(p) {
  const label = p.section === 'services' ? 'Services' : 'Work';
  const hash = p.section === 'services' ? '#services' : '#work';
  return `  <p class="pg-crumb"><a href="/">Home</a> <span>·</span> <a href="/${hash}">${label}</a> <span>·</span> ${esc(p.nav)}</p>`;
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

function relatedCards(slugs) {
  return slugs.map(s => {
    const t = bySlug[s];
    if (!t) throw new Error('unknown related slug: ' + s);
    return [
      `      <a class="panel pg-rel" href="/${t.section}/${t.slug}/">`,
      `        <b>${esc(t.nav)}</b>`,
      `        <span>${esc(t.lead)}</span>`,
      '        <i class="pg-rel-go">View project →</i>',
      '      </a>',
    ].join(EOL);
  }).join(EOL);
}

function serviceBody(p) {
  const out = [];
  out.push('<main class="wrap pg">');
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
  const up = '../../';
  const out = [];
  out.push('<main class="wrap pg">');
  out.push(breadcrumb(p));
  out.push(`  <h1 class="pg-h1">${esc(p.h1[0])}<em>${esc(p.h1[1])}</em></h1>`);
  out.push(`  <p class="pg-sub">${esc(p.sub)}</p>`);
  out.push(`  <p class="pg-lead">${esc(p.lead)}</p>`);
  out.push(`  <img class="pg-hero" src="${up}${p.image.src}" alt="${esc(p.image.alt)}" width="1200" height="900">`);

  out.push('  <div class="pg-facts">');
  for (const [k, v] of p.facts) out.push(`    <div><i>${esc(k)}</i><b>${esc(v)}</b></div>`);
  out.push('  </div>');

  for (const [headTxt, body] of p.story) {
    out.push(`  <h2 class="sec-k pg-sec">${headTxt.toUpperCase()}</h2>`);
    out.push(`  <div class="panel pg-prose"><p>${body}</p></div>`);
  }

  const svc = bySlug[p.service];
  if (svc) {
    out.push('  <h2 class="sec-k pg-sec">THE SERVICE BEHIND IT</h2>');
    out.push('  <div class="pg-rels">');
    out.push([
      `      <a class="panel pg-rel" href="/services/${svc.slug}/">`,
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

function footer() {
  const up = '../../';
  return [
    '',
    '<footer>',
    '  <div class="foot">',
    '    <a class="logo" href="/">',
    `      <img src="${up}assets/logo-kit/redcrown-primary-scarlet.svg" alt="Red Crown Interactive logo" width="40" height="40">`,
    '      <span><b>RED CROWN</b><i>INTERACTIVE</i></span>',
    '    </a>',
    '    <div class="foot-right">',
    '      <div class="contact">',
    '        <span><svg class="icon" viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><span>Haifa, Israel</span></span>',
    '        <span><svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 7l9 6 9-6"/></svg><a href="mailto:hello@redcrowninteractive.com">hello@redcrowninteractive.com</a></span>',
    '        <span dir="ltr"><svg class="icon" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg><a href="tel:+972585760550">+972-58-576-0550</a></span>',
    '      </div>',
    '      <div class="socials">',
    '        <a href="https://www.linkedin.com/company/red-crown-interactive" aria-label="LinkedIn" rel="noopener">in</a>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="copy">© 2026 Red Crown Interactive. All rights reserved.</div>',
    '</footer>',
    '',
    '</body>',
    '</html>',
    '',
  ].join(EOL);
}

function render(p) {
  return head(p) + nav(p) + (p.section === 'services' ? serviceBody(p) : workBody(p)) + footer();
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
    if (norm(cur) !== norm(html)) { console.error(`[pages] stale: ${p.section}/${p.slug}/index.html`); stale++; }
  } else {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, html);
    console.log(`  wrote ${p.section}/${p.slug}/index.html`);
  }
}

if (check) {
  console.error(stale ? `[pages] FAIL: ${stale} page(s) out of date, run: node tools/build_pages.js`
                      : `[pages] ok: all ${all.length} pages current`);
  process.exit(stale ? 1 : 0);
}
console.log(`[pages] ${all.length} pages written`);
