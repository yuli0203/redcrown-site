/*
 * Post records for the Red Crown journal engine.
 *
 * One article is one JSON file in tools/journal/posts/. Those files are the
 * source of truth: the HTML under /blog/ is rendered from them and can always
 * be thrown away and rebuilt. Anything the renderer needs must survive here,
 * which is why an imported article keeps its original publication date.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'posts');
const CONFIG = path.join(__dirname, '..', 'config.json');

const config = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

// A Hebrew title cannot become a URL, so slugs are Latin and set at creation
// time. They are permanent: changing one breaks every link already published.
const isSlug = s => typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 80;

function validate(post, file) {
  const where = file ? ` (${file})` : '';
  const fail = why => { throw new Error(`Invalid post${where}: ${why}`); };
  if (!post || typeof post !== 'object') fail('not an object');
  if (!isSlug(post.slug)) fail(`slug must be lowercase latin words joined by hyphens, got ${JSON.stringify(post.slug)}`);
  for (const key of ['title', 'excerpt', 'description']) {
    if (typeof post[key] !== 'string' || !post[key].trim()) fail(`${key} is required`);
  }
  if (!Number.isFinite(Date.parse(post.isoDate))) fail('isoDate must be a parsable date');
  if (post.updated && !Number.isFinite(Date.parse(post.updated))) fail('updated must be a parsable date');
  if (!Array.isArray(post.intro) || !post.intro.length) fail('intro needs at least one paragraph');
  if (!Array.isArray(post.sections) || !post.sections.length) fail('sections needs at least one entry');
  post.sections.forEach((section, i) => {
    if (!section || typeof section.heading !== 'string' || !section.heading.trim()) fail(`section ${i} needs a heading`);
    const paragraphs = section.paragraphs || [];
    const items = (section.list && section.list.items) || [];
    if (!paragraphs.length && !items.length) fail(`section ${i} has no body`);
  });
  (post.faq || []).forEach((entry, i) => {
    if (!entry || !entry.q || !entry.a) fail(`faq ${i} needs a question and an answer`);
  });
  (post.internalLinks || []).forEach((link, i) => {
    if (!link || typeof link.href !== 'string' || !link.href.startsWith('/')) fail(`internalLinks ${i} must point at a path on this site`);
    if (typeof link.label !== 'string' || !link.label.trim()) fail(`internalLinks ${i} needs a label`);
  });
  return post;
}

function fileFor(slug) {
  return path.join(DIR, `${slug}.json`);
}

/* Newest first, the order the blog index and the feed both publish in. */
function all() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => validate(JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')), name))
    .sort((a, b) => Date.parse(b.isoDate) - Date.parse(a.isoDate));
}

function save(post) {
  validate(post);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(fileFor(post.slug), JSON.stringify(post, null, 2) + '\n');
  return fileFor(post.slug);
}

/* Words of body copy, used for the reading time and by the audit. */
function wordCount(post) {
  const parts = [
    ...post.intro,
    ...post.sections.flatMap(s => [s.heading, ...(s.paragraphs || []), ...((s.list && s.list.items) || [])]),
    ...(post.faq || []).flatMap(f => [f.q, f.a]),
  ];
  return parts.join(' ').trim().split(/\s+/).filter(Boolean).length;
}

// Hebrew reads at roughly 200 words a minute; the number is a hint, not a promise.
const readingMinutes = post => Math.max(1, Math.round(wordCount(post) / 200));

module.exports = { DIR, config, isSlug, validate, all, save, fileFor, wordCount, readingMinutes };
