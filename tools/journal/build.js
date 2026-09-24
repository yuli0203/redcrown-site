#!/usr/bin/env node
/*
 * Render the journal from tools/journal/posts/*.json into /blog/.
 *
 * The posts are the source of truth; everything this writes is disposable and
 * can be regenerated. It replaces the Soro embed: the same design, but the
 * articles are real pages Google can crawl without running JavaScript.
 *
 *   node tools/journal/build.js          write /blog/
 *   node tools/journal/build.js --check  fail if anything on disk is out of date
 */
'use strict';
const fs = require('fs');
const path = require('path');
const posts = require('./lib/posts.js');

const ROOT = path.resolve(__dirname, '..', '..');
const BLOG = path.join(ROOT, 'blog');
// Git normalises line endings per platform, so match the checkout rather than
// hard-coding CRLF: otherwise every page looks stale on a Linux runner.
const EOL = fs.readFileSync(path.join(ROOT, 'site.css'), 'utf8').includes('\r\n') ? '\r\n' : '\n';
const CSS_VERSION = '20260924';

const cfg = posts.config();
const SITE = cfg.site.url;
const check = process.argv.includes('--check');

const esc = s => String(s)
  .replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Body copy may carry [label](/path/) links. Nothing else is interpreted, so a
   stray bracket or angle bracket in Hebrew prose cannot inject markup. */
function inline(text) {
  const out = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, match;
  while ((match = pattern.exec(text))) {
    out.push(esc(text.slice(last, match.index)));
    const external = /^https?:\/\//.test(match[2]) && !match[2].startsWith(SITE);
    out.push(`<a href="${esc(match[2])}"${external ? ' rel="noopener"' : ''}>${esc(match[1])}</a>`);
    last = match.index + match[0].length;
  }
  out.push(esc(text.slice(last)));
  return out.join('');
}

const hebrewDate = iso => new Intl.DateTimeFormat('he-IL', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(iso));

const urlOf = post => `${SITE}/blog/${post.slug}/`;
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

/* ---------- shared chrome: identical markup on the index and on an article ---------- */

function head(parts) {
  const lines = [
    '<!DOCTYPE html>',
    `<html lang="${cfg.site.language}" dir="${cfg.site.direction}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="theme-color" content="#0E080A">',
    `<title>${esc(parts.title)}</title>`,
    `<meta name="description" content="${esc(parts.description)}">`,
    `<link rel="canonical" href="${esc(parts.url)}">`,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    `<meta property="og:type" content="${parts.ogType}">`,
    `<meta property="og:locale" content="${cfg.site.locale}">`,
    `<meta property="og:site_name" content="${esc(cfg.site.name)}">`,
    `<meta property="og:title" content="${esc(parts.ogTitle || parts.title)}">`,
    `<meta property="og:description" content="${esc(parts.description)}">`,
    `<meta property="og:url" content="${esc(parts.url)}">`,
    `<meta property="og:image" content="${SITE}/og-image.png">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  if (parts.published) lines.push(`<meta property="article:published_time" content="${esc(parts.published)}">`);
  if (parts.modified) lines.push(`<meta property="article:modified_time" content="${esc(parts.modified)}">`);
  lines.push(`<link rel="stylesheet" href="/blog/style.css?v=${CSS_VERSION}">`);
  for (const schema of parts.schemas) {
    lines.push('<script type="application/ld+json">', json(schema), '</script>');
  }
  lines.push('</head>', '<body>',
    '<a class="skip" href="#content">דילוג לתוכן</a>',
    '<header class="header">',
    `<a class="brand" href="/he/" aria-label="${esc(cfg.site.name)} - דף הבית" dir="ltr">`,
    `<img src="${cfg.site.logo}" width="46" height="46" alt="">`,
    '<span><strong>RED CROWN</strong><small>INTERACTIVE</small></span>',
    '</a>',
    '<nav aria-label="ניווט ראשי">',
    '<a href="/he/">דף הבית</a>',
    '<a class="contact" href="/he/#contact">נדבר על הפרויקט שלך</a>',
    '</nav>',
    '</header>');
  return lines;
}

function tail() {
  return [
    '<aside class="project">',
    '<h2>יש לך רעיון למוצר?</h2>',
    `<p>${esc(cfg.cta.text)}</p>`,
    `<a class="contact" href="${esc(cfg.cta.href)}">${esc(cfg.cta.label)}</a>`,
    '</aside>',
    '</main>',
    '<footer>',
    '<span dir="ltr">© 2026 Red Crown Interactive</span>',
    '<nav aria-label="מידע נוסף">',
    '<a href="/he/legal/#privacy">מדיניות פרטיות</a>',
    '<a href="/he/legal/#accessibility">נגישות</a>',
    '<a href="mailto:hello@redcrowninteractive.com">צרו קשר</a>',
    '</nav>',
    '</footer>',
    '</body>',
    '</html>',
  ];
}

const publisher = {
  '@type': 'Organization', name: cfg.site.name, url: SITE + '/',
  logo: `${SITE}/assets/logo-kit/redcrown-solid.png`,
};

/* ---------- the blog index ---------- */

function renderIndex(list) {
  const schemas = [{
    '@context': 'https://schema.org', '@type': 'Blog',
    name: `מאמרים | ${cfg.site.name}`, url: `${SITE}/blog/`,
    inLanguage: cfg.site.language, publisher,
    blogPost: list.map(post => ({
      '@type': 'BlogPosting', headline: post.title, url: urlOf(post),
      datePublished: post.isoDate, description: post.excerpt,
    })),
  }];
  const lines = head({
    title: 'מאמרים על פיתוח אפליקציות, תלת-ממד ו-XR | Red Crown Interactive',
    ogTitle: 'מאמרים ומדריכים | Red Crown Interactive',
    description: 'מאמרים ומדריכים על פיתוח אפליקציות, Unity, מציאות מדומה, מציאות רבודה ותלת-ממד אינטראקטיבי מבית Red Crown Interactive.',
    url: `${SITE}/blog/`, ogType: 'website', schemas,
  });
  lines.push('<main id="content">',
    '<section class="intro" aria-labelledby="heading">',
    `<p class="eyebrow" dir="ltr">${esc(cfg.site.eyebrow)}</p>`,
    '<h1 id="heading">מרעיון למוצר.<br><span>הידע שבדרך.</span></h1>',
    '<p class="lead">מאמרים ומדריכים על פיתוח אפליקציות, תלת-ממד ו-XR.</p>',
    '</section>',
    '<section class="articles" aria-label="מאמרים">',
    '<div class="journal-list">');
  for (const post of list) {
    lines.push(
      `<a class="journal-post" href="/blog/${post.slug}/">`,
      `<time datetime="${esc(post.isoDate)}">${esc(hebrewDate(post.isoDate))}</time>`,
      `<h2>${esc(post.title)}</h2>`,
      `<p>${esc(post.excerpt)}</p>`,
      '<span class="journal-read">לקריאת המאמר <span aria-hidden="true">←</span></span>',
      '</a>');
  }
  lines.push('</div>');
  if (!list.length) lines.push('<p class="journal-empty">בקרוב יעלו כאן מאמרים חדשים.</p>');
  lines.push('</section>');
  lines.push(...tail());
  // Soro published every article under /blog/?post=<slug>. Those links are out
  // in the world, so keep them working rather than letting them land on a list.
  lines.splice(lines.length - 2, 0, '<script src="/blog/redirect.js" defer></script>');
  return lines.join(EOL) + EOL;
}

/* ---------- one article ---------- */

function renderArticle(post, neighbours) {
  const url = urlOf(post);
  const schemas = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.description,
      inLanguage: cfg.site.language, url, mainEntityOfPage: url,
      datePublished: post.isoDate, dateModified: post.updated || post.isoDate,
      author: publisher, publisher,
      image: `${SITE}/og-image.png`,
      wordCount: posts.wordCount(post),
      keywords: [post.keyword, ...(post.secondaryKeywords || [])].filter(Boolean).join(', '),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'דף הבית', item: `${SITE}/he/` },
        { '@type': 'ListItem', position: 2, name: 'מאמרים', item: `${SITE}/blog/` },
        { '@type': 'ListItem', position: 3, name: post.title },
      ],
    },
  ];
  if ((post.faq || []).length) {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: post.faq.map(entry => ({
        '@type': 'Question', name: entry.q,
        acceptedAnswer: { '@type': 'Answer', text: entry.a },
      })),
    });
  }

  const lines = head({
    title: post.metaTitle || `${post.title} | ${cfg.site.name}`,
    ogTitle: post.title,
    description: post.description,
    url, ogType: 'article', published: post.isoDate,
    modified: post.updated || null, schemas,
  });
  lines.push('<main id="content">',
    '<nav class="crumbs" aria-label="מיקום בעמוד">',
    '<a href="/he/">דף הבית</a><span aria-hidden="true">/</span><a href="/blog/">מאמרים</a>',
    '</nav>',
    '<article class="post">',
    '<header class="post-head">',
    `<p class="eyebrow" dir="ltr">${esc(cfg.site.eyebrow)}</p>`,
    `<h1>${esc(post.title)}</h1>`,
    '<p class="post-meta">',
    `<time datetime="${esc(post.isoDate)}">${esc(hebrewDate(post.isoDate))}</time>`,
    `<span aria-hidden="true">·</span><span>${posts.readingMinutes(post)} דקות קריאה</span>`,
    '</p>',
    '</header>');
  for (const paragraph of post.intro) lines.push(`<p class="post-lead">${inline(paragraph)}</p>`);
  for (const section of post.sections) {
    lines.push(`<h2>${esc(section.heading)}</h2>`);
    for (const paragraph of section.paragraphs || []) lines.push(`<p>${inline(paragraph)}</p>`);
    if (section.list && (section.list.items || []).length) {
      const tag = section.list.type === 'ol' ? 'ol' : 'ul';
      lines.push(`<${tag}>`);
      for (const item of section.list.items) lines.push(`<li>${inline(item)}</li>`);
      lines.push(`</${tag}>`);
    }
    for (const paragraph of section.after || []) lines.push(`<p>${inline(paragraph)}</p>`);
  }
  if ((post.faq || []).length) {
    lines.push('<section class="post-faq" aria-labelledby="faq-heading">',
      '<h2 id="faq-heading">שאלות נפוצות</h2>');
    for (const entry of post.faq) {
      lines.push('<details>', `<summary>${esc(entry.q)}</summary>`, `<p>${inline(entry.a)}</p>`, '</details>');
    }
    lines.push('</section>');
  }
  if ((post.internalLinks || []).length) {
    lines.push('<nav class="post-links" aria-label="קישורים נוספים">',
      '<h2>להמשך קריאה</h2>', '<ul>');
    for (const link of post.internalLinks) {
      lines.push(`<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`);
    }
    lines.push('</ul>', '</nav>');
  }
  lines.push('</article>');
  const { previous, next } = neighbours;
  if (previous || next) {
    lines.push('<nav class="post-nav" aria-label="מאמרים נוספים">');
    // Newest first in the list, so "next" in reading order is the older article.
    if (next) lines.push(`<a class="post-nav-link" href="/blog/${next.slug}/"><span>המאמר הקודם</span>${esc(next.title)}</a>`);
    if (previous) lines.push(`<a class="post-nav-link" href="/blog/${previous.slug}/"><span>המאמר הבא</span>${esc(previous.title)}</a>`);
    lines.push('</nav>');
  }
  lines.push(...tail());
  return lines.join(EOL) + EOL;
}

/* ---------- machine-readable outputs ---------- */

const articlesJson = list => JSON.stringify(list.map(post => ({
  title: post.title, slug: post.slug, excerpt: post.excerpt,
  isoDate: post.isoDate, url: `/blog/${post.slug}/`,
})), null, 2) + '\n';

function feedXml(list) {
  const rfc822 = iso => new Date(iso).toUTCString();
  const items = list.slice(0, 20).map(post => [
    '  <item>',
    `    <title>${esc(post.title)}</title>`,
    `    <link>${urlOf(post)}</link>`,
    `    <guid isPermaLink="true">${urlOf(post)}</guid>`,
    `    <description>${esc(post.excerpt)}</description>`,
    `    <pubDate>${rfc822(post.isoDate)}</pubDate>`,
    '  </item>',
  ].join(EOL)).join(EOL);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `  <title>מאמרים | ${esc(cfg.site.name)}</title>`,
    `  <link>${SITE}/blog/</link>`,
    '  <description>מאמרים ומדריכים על פיתוח אפליקציות, תלת-ממד ו-XR.</description>',
    `  <language>${cfg.site.language}</language>`,
    list.length ? `  <lastBuildDate>${rfc822(list[0].isoDate)}</lastBuildDate>` : '',
    items,
    '</channel>',
    '</rss>',
  ].filter(Boolean).join(EOL) + EOL;
}

/* The sitemap is hand-maintained for the rest of the site, so only the block
   between the markers belongs to the journal. */
function sitemapWith(list) {
  const file = path.join(ROOT, 'sitemap.xml');
  const current = fs.readFileSync(file, 'utf8');
  const open = '<!-- journal:start -->';
  const close = '<!-- journal:end -->';
  const block = [open,
    ...list.map(post => `<url><loc>${urlOf(post)}</loc><lastmod>${(post.updated || post.isoDate).slice(0, 10)}</lastmod></url>`),
    close].join(EOL);
  if (current.includes(open) && current.includes(close)) {
    return { file, next: current.replace(new RegExp(`${open}[\\s\\S]*?${close}`), block) };
  }
  return { file, next: current.replace('</urlset>', block + EOL + '</urlset>') };
}

const REDIRECT = `/* Soro published articles at /blog/?post=<slug>; those links now point at
   /blog/<slug>/. Keep them working instead of dropping visitors on the list. */
(()=>{
  'use strict';
  const slug=new URLSearchParams(location.search).get('post');
  if(!slug||!/^[a-z0-9-]{1,80}$/.test(slug))return;
  fetch('/blog/articles.json',{credentials:'omit'})
    .then(r=>r.ok?r.json():[])
    .then(list=>{
      const match=list.find(a=>a.slug===slug||(a.aliases||[]).includes(slug));
      if(match)location.replace(match.url);
    })
    .catch(()=>{});
})();
`;

/* ---------- write or check ---------- */

const planned = new Map();
const plan = (file, content) => planned.set(path.resolve(file), content);

function run() {
  const list = posts.all();
  plan(path.join(BLOG, 'index.html'), renderIndex(list));
  plan(path.join(BLOG, 'articles.json'), articlesJson(list));
  plan(path.join(BLOG, 'feed.xml'), feedXml(list));
  plan(path.join(BLOG, 'redirect.js'), REDIRECT.split('\n').join(EOL));
  list.forEach((post, index) => {
    plan(path.join(BLOG, post.slug, 'index.html'), renderArticle(post, {
      previous: list[index - 1] || null,
      next: list[index + 1] || null,
    }));
  });
  const sitemap = sitemapWith(list);
  plan(sitemap.file, sitemap.next);

  const stale = [];
  for (const [file, content] of planned) {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (existing === content) continue;
    stale.push(path.relative(ROOT, file));
    if (!check) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }

  // An article deleted from posts/ must not keep serving from /blog/.
  const slugs = new Set(list.map(post => post.slug));
  for (const entry of fs.readdirSync(BLOG, { withFileTypes: true })) {
    if (!entry.isDirectory() || slugs.has(entry.name)) continue;
    stale.push(path.relative(ROOT, path.join(BLOG, entry.name)) + ' (orphan)');
    if (!check) fs.rmSync(path.join(BLOG, entry.name), { recursive: true, force: true });
  }

  if (check && stale.length) {
    console.error('Journal output is out of date. Run: node tools/journal/build.js');
    for (const file of stale) console.error('  ' + file);
    process.exit(1);
  }
  console.log(check
    ? `Journal is current (${list.length} articles).`
    : `Rendered ${list.length} articles${stale.length ? `, ${stale.length} files changed` : ' (no changes)'}.`);
}

if (require.main === module) run();
module.exports = { renderArticle, renderIndex, articlesJson, feedXml, inline, esc, hebrewDate };
