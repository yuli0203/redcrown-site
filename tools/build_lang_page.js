#!/usr/bin/env node
/*
 * Render a static localized page from index.html + the I18N dict in site.js.
 *
 * Each language needs its own crawlable URL: search engines index one language
 * per URL, so a client-side swap on "/" leaves the other languages invisible.
 * This build step pre-renders the same markup with the translated strings
 * already in place, so /ru/ and /he/ are real pages rather than JS states.
 *
 *   node tools/build_lang_page.js ru > ru/index.html
 *   node tools/build_lang_page.js he --check   (structural round-trip test)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://redcrowninteractive.com';

// Per-language head copy. The body text all comes from the I18N dict; only the
// things that live outside a data-i18n slot (meta/OG/Twitter) are listed here.
const LANGS = {
  en: {
    dir: 'ltr', ogLocale: 'en_US', url: '/',
  },
  he: {
    dir: 'rtl', ogLocale: 'he_IL', url: '/he/',
    description: 'סטודיו לפיתוח אפליקציות גרפיות ב-Unity: פיתוח VR ו-XR, מציאות מדומה ומשולבת, אפליקציות מובייל ומחשב. למעלה מעשור ניסיון בפיתוח תלת-ממד בזמן אמת עבור הטכניון וחברות מובילות.',
    ogTitle: 'פיתוח VR, XR ואפליקציות גרפיות ב-Unity | Red Crown Interactive',
    ogDescription: 'סטודיו לפיתוח אפליקציות סוחפות ב-Unity: פיתוח VR, XR, מובייל ומחשב.',
    twitterTitle: 'פיתוח VR ו-XR · אפליקציות גרפיות ב-Unity',
    twitterDescription: 'סטודיו לפיתוח אפליקציות סוחפות ב-Unity: פיתוח VR, XR, מובייל ומחשב.',
    orgDescription: 'סטודיו לפיתוח תוכנה אינטראקטיבית ל-XR, מובייל ומחשב, למדע, הנדסה וחינוך. פיתוח VR, XR ומציאות רבודה ב-Unity, באיכות בינלאומית.',
  },
  ru: {
    dir: 'ltr', ogLocale: 'ru_RU', url: '/ru/',
    description: 'Red Crown Interactive разрабатывает интерактивное ПО для науки, инженерии и VR на Meta Quest, мобильных устройствах и ПК, на Unity, от идеи до внедрения.',
    ogTitle: 'Red Crown Interactive · Интерактивное ПО для науки, инженерии и VR',
    ogDescription: 'Red Crown Interactive разрабатывает интерактивное ПО для науки, инженерии и VR на Meta Quest, мобильных устройствах и ПК, на Unity, от идеи до внедрения.',
    twitterTitle: 'Интерактивное ПО для науки, инженерии и VR',
    twitterDescription: 'Red Crown Interactive разрабатывает интерактивное ПО для науки, инженерии и VR на Meta Quest, мобильных устройствах и ПК, на Unity.',
    orgDescription: 'Студия разработки на Unity, создающая интерактивное ПО для науки, инженерии и VR на Meta Quest, мобильных устройствах и ПК.',
  },
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAWTEXT = new Set(['script', 'style']);

/* ---------- tiny HTML helpers (attribute-quote aware) ---------- */

// Index just past the '>' that closes the tag starting at `start`.
function tagEnd(html, start) {
  let q = null;
  for (let i = start + 1; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '>') return i + 1;
  }
  throw new Error('unterminated tag at ' + start);
}

function tagName(html, start) {
  const m = /^<\/?\s*([a-zA-Z][-a-zA-Z0-9]*)/.exec(html.slice(start, start + 40));
  return m ? m[1].toLowerCase() : null;
}

// Index of the '<' of the close tag matching the element opening at `open`.
function matchingClose(html, open) {
  const name = tagName(html, open);
  if (VOID.has(name)) throw new Error('void element has no close: ' + name);
  let depth = 0;
  let i = open;
  while (i < html.length) {
    if (html[i] !== '<') { i++; continue; }
    if (html.startsWith('<!--', i)) { i = html.indexOf('-->', i) + 3; continue; }
    if (html.startsWith('<!', i)) { i = tagEnd(html, i); continue; }
    const isClose = html[i + 1] === '/';
    const n = tagName(html, i);
    if (!n) { i++; continue; }
    const after = tagEnd(html, i);
    if (!isClose && RAWTEXT.has(n) && n !== name) {
      const close = html.toLowerCase().indexOf('</' + n, after);
      i = close === -1 ? after : close;
      continue;
    }
    if (n === name) {
      if (isClose) { depth--; if (depth === 0) return i; }
      else if (!/\/>\s*$/.test(html.slice(i, after))) depth++;
    }
    i = after;
  }
  throw new Error('no matching close for <' + name + '> at ' + open);
}

// Replace the value of `attr` on the tag starting at `open`, or add it.
function setAttr(html, open, attr, value) {
  const end = tagEnd(html, open);
  const tag = html.slice(open, end);
  const re = new RegExp('(\\s' + attr + '=")([^"]*)(")');
  const next = re.test(tag)
    ? tag.replace(re, (_, a, __, c) => a + value + c)
    : tag.replace(/(\/?>)$/, ' ' + attr + '="' + value + '"$1');
  return html.slice(0, open) + next + html.slice(end);
}

/* ---------- load the translation dictionaries out of site.js ---------- */

function loadDicts() {
  const js = fs.readFileSync(path.join(ROOT, 'site.js'), 'utf8');
  const start = js.indexOf('const I18N = {');
  if (start === -1) throw new Error('I18N not found in site.js');
  const open = js.indexOf('{', start);
  let depth = 0, q = null, i = open;
  for (; i < js.length; i++) {
    const c = js[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  // Our own source file, and only the object literal is evaluated.
  return new Function('return (' + js.slice(open, i) + ')')();
}

/* ---------- the transform ---------- */

// Swap every data-i18n / -aria / -placeholder slot for its translated value,
// mirroring exactly what applyLang() does at runtime in site.js.
function applyI18n(html, dict) {
  for (const [attr, mode] of [['data-i18n', 'inner'],
                              ['data-i18n-aria', 'aria-label'],
                              ['data-i18n-placeholder', 'placeholder']]) {
    let cursor = 0;
    for (;;) {
      const at = html.indexOf(attr + '="', cursor);
      if (at === -1) break;
      // Skip the longer attributes when scanning for the short one.
      if (attr === 'data-i18n' && /^data-i18n-/.test(html.slice(at, at + 11))) {
        cursor = at + 1; continue;
      }
      const open = html.lastIndexOf('<', at);
      const key = /="([^"]*)"/.exec(html.slice(at + attr.length))[1];
      const value = dict[key];
      if (value == null) { cursor = at + 1; continue; }
      if (mode === 'inner') {
        const inner = tagEnd(html, open);
        const close = matchingClose(html, open);
        html = html.slice(0, inner) + value + html.slice(close);
        cursor = inner + value.length;
      } else {
        html = setAttr(html, open, mode, value);
        cursor = tagEnd(html, open);
      }
    }
  }
  return html;
}

// The page lives one directory down, so document-relative refs need a hop up.
// srcset carries a comma-separated list, each entry with an optional descriptor.
function reparent(html) {
  const up = p => /^(https?:|\/|#|mailto:|tel:|data:|\.\.\/)/.test(p) ? p : '../' + p;
  return html.replace(/\b(href|src|poster)="([^"]+)"/g, (_, a, p) => `${a}="${up(p)}"`)
             .replace(/\bsrcset="([^"]+)"/g, (_, list) => 'srcset="' + list.split(',')
               .map(s => s.trim().replace(/^(\S+)/, (__, u) => up(u))).join(', ') + '"')
             // paths built as strings inside the page's own inline scripts
             // (model preloads, the lazy model-viewer <script src>)
             .replace(/(['"])(assets|vendor|fonts|brand)\//g, '$1../$2/');
}

function faqJsonLd(dict, lang) {
  const strip = s => String(s).replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  const qa = [];
  for (let n = 1; dict['faq.q' + n]; n++) {
    qa.push({
      '@type': 'Question',
      name: strip(dict['faq.q' + n]),
      acceptedAnswer: { '@type': 'Answer', text: strip(dict['faq.a' + n]) },
    });
  }
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    inLanguage: lang, mainEntity: qa,
  }, null, 2);
}

function build(lang) {
  const cfg = LANGS[lang];
  if (!cfg) throw new Error('unknown language: ' + lang);
  const dicts = loadDicts();
  const dict = dicts[lang];
  if (!dict) throw new Error('no I18N dict for: ' + lang);

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const EOL = html.includes('\r\n') ? '\r\n' : '\n';

  // The pre-paint redirect belongs to the English entry page only; a language
  // page that redirected would trap the visitor who deliberately chose it.
  html = html.replace(/<script>\r?\n\/\* Send [\s\S]*?<\/script>\r?\n/, '');

  const htmlTag = html.indexOf('<html');
  html = setAttr(html, htmlTag, 'lang', lang);
  html = setAttr(html, htmlTag, 'dir', cfg.dir);
  html = setAttr(html, htmlTag, 'data-page-lang', lang);

  html = applyI18n(html, dict);
  html = reparent(html);

  const abs = SITE + cfg.url;
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + dict['doc.title'] + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + esc(cfg.description) + '$2');
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + abs + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + abs + '$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + esc(cfg.ogTitle) + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + esc(cfg.ogDescription) + '$2');
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, '$1' + esc(cfg.twitterTitle) + '$2');
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, '$1' + esc(cfg.twitterDescription) + '$2');
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, '$1' + cfg.ogLocale + '$2');

  // Every version points at every version, itself included.
  const alts = Object.keys(LANGS).filter(l => l !== lang)
    .map(l => `<meta property="og:locale:alternate" content="${LANGS[l].ogLocale}">`).join(EOL);
  // Replace the whole consecutive run: leaving one behind would list this page's
  // own locale as an alternate of itself.
  html = html.replace(/(?:<meta property="og:locale:alternate"[^>]*>\r?\n?)+/, () => alts + EOL);

  html = html.replace(/(<link rel="alternate" hreflang="[^"]*"[^>]*>\r?\n)+/, () => hreflangBlock(EOL));

  // Organization description + a language-matched FAQ block.
  if (cfg.orgDescription) {
    html = html.replace(/("description": ")[^"]*(")/, '$1' + cfg.orgDescription + '$2');
  }
  html = html.replace(/\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "FAQPage"[\s\S]*?\r?\n\}/,
                      () => faqJsonLd(dict, lang));

  return html.replace(/\r?\n/g, EOL);
}

function hreflangBlock(EOL) {
  const order = ['en', 'he', 'ru'];
  return order.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE + LANGS[l].url}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${SITE}/">`)
    .join(EOL) + EOL;
}

/* ---------- structural self-check ---------- */

function check(lang) {
  const out = build(lang);
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const count = (s, re) => (s.match(re) || []).length;
  const problems = [];

  for (const tag of ['section', 'div', 'a', 'img', 'button', 'model-viewer']) {
    const a = count(src, new RegExp('<' + tag + '[\\s>]', 'g'));
    const b = count(out, new RegExp('<' + tag + '[\\s>]', 'g'));
    if (a !== b) problems.push(`<${tag}> count changed: ${a} -> ${b}`);
  }
  const slots = count(src, /data-i18n="/g);
  if (count(out, /data-i18n="/g) !== slots) problems.push('data-i18n slots lost');

  // Counting slots proves nothing about translation: a key missing from the dict
  // leaves the English text in place and the counts still match.
  const dict = loadDicts()[lang] || {};
  const keys = [...new Set([...src.matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g)]
    .map(m => m[1]))];
  for (const k of keys.filter(k => dict[k] == null)) {
    problems.push(`missing ${lang} translation, English would ship: ${k}`);
  }

  // A generated page that drifts from index.html/site.js is worse than none.
  const onDisk = path.join(ROOT, lang, 'index.html');
  if (fs.existsSync(onDisk) && fs.readFileSync(onDisk, 'utf8') !== out) {
    problems.push(`${lang}/index.html is stale: regenerate with "node tools/build_lang_page.js ${lang} > ${lang}/index.html"`);
  }
  // Anything still document-relative would resolve under /<lang>/ and 404.
  const rel = [...out.matchAll(/\b(href|src|srcset|poster)="([^"]+)"/g)]
    .flatMap(([, a, v]) => v.split(',').map(s => s.trim().split(/\s/)[0]).map(u => [a, u]))
    .filter(([, u]) => !/^(https?:|\/|#|mailto:|tel:|data:|\.\.\/)/.test(u));
  for (const [a, u] of rel) problems.push(`un-reparented ${a}="${u}" would 404 under the language directory`);
  // Paths assembled as strings in inline scripts resolve against the page URL too.
  for (const m of out.matchAll(/(['"])((?:assets|vendor|fonts|brand)\/[^'"]*)\1/g)) {
    problems.push(`un-reparented script path '${m[2]}' would 404 under the language directory`);
  }
  if (!out.includes(`hreflang="${lang}"`)) problems.push('missing self hreflang');

  console.error(problems.length
    ? '[build] FAIL ' + lang + '\n  - ' + problems.join('\n  - ')
    : `[build] ok ${lang}: structure matches source, ${slots} i18n slots rendered`);
  return problems.length ? 1 : 0;
}

const [, , lang, flag] = process.argv;
if (!lang) { console.error('usage: build_lang_page.js <lang> [--check]'); process.exit(2); }
if (flag === '--check') process.exit(check(lang));
process.stdout.write(build(lang));
