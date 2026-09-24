/*
 * The journal renderer has to be trustworthy without a browser: escaping,
 * canonical URLs, schema, ordering, and the checks the audit performs.
 *
 *   node --test tools/test_journal.js
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const build = require('./journal/build.js');
const posts = require('./journal/lib/posts.js');
const { checkPost } = require('./journal/audit.js');

const sample = () => ({
  slug: 'test-article', title: 'כותרת בדיקה', metaTitle: 'כותרת בדיקה | Red Crown',
  description: 'תיאור', excerpt: 'תקציר', keyword: 'כותרת בדיקה',
  isoDate: '2026-01-02T10:00:00.000+00:00',
  intro: ['פסקה ראשונה'], sections: [{ heading: 'כותרת', paragraphs: ['גוף'] }],
  faq: [{ q: 'שאלה', a: 'תשובה' }], internalLinks: [{ href: '/services/', label: 'שירותים' }],
});

test('inline text is escaped, links are not', () => {
  assert.strictEqual(build.inline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.strictEqual(build.inline('ראו [שירותים](/services/) שלנו'), 'ראו <a href="/services/">שירותים</a> שלנו');
  assert.match(build.inline('"ציטוט" & עוד'), /&quot;ציטוט&quot; &amp; עוד/);
});

test('an article page carries canonical, RTL and the three schemas', () => {
  const html = build.renderArticle(sample(), { previous: null, next: null });
  assert.match(html, /<html lang="he" dir="rtl">/);
  assert.match(html, /rel="canonical" href="https:\/\/redcrowninteractive\.com\/blog\/test-article\/"/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /article:published_time" content="2026-01-02/);
});

test('an article without FAQ omits the FAQPage schema', () => {
  const post = { ...sample(), faq: [] };
  assert.doesNotMatch(build.renderArticle(post, { previous: null, next: null }), /FAQPage/);
});

test('post records are validated before they can be rendered', () => {
  assert.throws(() => posts.validate({ ...sample(), slug: 'כותרת' }), /slug/);
  assert.throws(() => posts.validate({ ...sample(), isoDate: 'yesterday' }), /isoDate/);
  assert.throws(() => posts.validate({ ...sample(), sections: [] }), /sections/);
  assert.throws(() => posts.validate({ ...sample(), internalLinks: [{ href: 'https://x.com', label: 'x' }] }), /internalLinks/);
});

test('the feed lists the newest article first', () => {
  const all = posts.all();
  const dates = all.map(post => Date.parse(post.isoDate));
  assert.deepStrictEqual(dates, [...dates].sort((a, b) => b - a));
  const feed = JSON.parse(build.articlesJson(all));
  assert.strictEqual(feed[0].url, `/blog/${all[0].slug}/`);
});

test('every published article is rendered and reachable', () => {
  for (const post of posts.all()) {
    const file = path.join(ROOT, 'blog', post.slug, 'index.html');
    assert.ok(fs.existsSync(file), `${post.slug} is not rendered`);
    for (const link of post.internalLinks || []) {
      if (link.href.includes('?')) continue;
      assert.ok(fs.existsSync(path.join(ROOT, link.href, 'index.html')), `${post.slug} links to a missing page: ${link.href}`);
    }
  }
});

test('the audit catches cannibalisation and broken links', () => {
  const a = sample();
  const b = { ...sample(), slug: 'other', title: 'אחר' };
  const findings = checkPost(a, [a, b]);
  assert.ok(findings.some(f => f.level === 'error' && /מילת מפתח/.test(f.message)));
  const broken = checkPost({ ...sample(), internalLinks: [{ href: '/nope/', label: 'x' }] }, []);
  assert.ok(broken.some(f => f.level === 'error' && /שבור/.test(f.message)));
});

test('the rendered blog on disk matches the posts', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/journal/build.js'), '--check'], { stdio: 'pipe' });
});
