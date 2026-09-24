#!/usr/bin/env node
/*
 * Publish the read-only dashboard to /seo/ on the live site.
 *
 * GitHub Pages serves static files, so whatever lands here is readable by
 * anyone who finds the URL - there is no login to put in front of it. That
 * decides what may go in: the article inventory and the operating rules, which
 * the published articles already reveal, and nothing else. The keyword queue,
 * the audit findings and every credential stay out of the payload and stay on
 * your machine, where tools/journal/dashboard.js shows them.
 *
 *   node tools/journal/publish-seo.js          write /seo/
 *   node tools/journal/publish-seo.js --check  fail if /seo/ is out of date
 */
'use strict';
const fs = require('fs');
const path = require('path');
const posts = require('./lib/posts.js');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'seo');
const TEMPLATE = path.join(__dirname, 'dashboard', 'public.html');
const QUEUE = path.join(__dirname, 'keywords.json');

const check = process.argv.includes('--check');
const readJson = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

/* Everything in here is already public: it is on the articles themselves, in
   the sitemap, or in this repository. Nothing is added that a competitor could
   not read off /blog/ in ten minutes. */
function snapshot() {
  const cfg = posts.config();
  const all = posts.all();
  const queue = readJson(QUEUE) || [];
  return {
    generatedAt: new Date().toISOString(),
    site: { url: cfg.site.url, name: cfg.site.name, language: cfg.site.language },
    schedule: {
      cron: cfg.schedule.cron,
      note: cfg.schedule.cronNote,
      articlesPerRun: cfg.schedule.articlesPerRun,
    },
    rules: {
      wordsMin: cfg.content.wordsMin,
      wordsMax: cfg.content.wordsMax,
      faqMin: cfg.content.faqMin,
      internalLinksMin: cfg.content.internalLinksMin,
      titleMaxChars: cfg.seo.titleMaxChars,
      descriptionMaxChars: cfg.seo.descriptionMaxChars,
      market: cfg.seo.market,
    },
    social: { facebook: cfg.social.facebook.enabled },
    // Counts only. What the engine plans to write next is competitive
    // information, so the queue itself never leaves the repository.
    pipeline: {
      queued: queue.filter(entry => entry.status === 'queued').length,
      used: queue.filter(entry => entry.status === 'used').length,
    },
    posts: all.map(post => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      isoDate: post.isoDate,
      keyword: post.keyword || '',
      words: posts.wordCount(post),
      source: post.source || 'journal',
      faq: (post.faq || []).length,
      links: (post.internalLinks || []).length,
      shared: Boolean(post.shared && post.shared.facebook),
      rendered: fs.existsSync(path.join(ROOT, 'blog', post.slug, 'index.html')),
    })),
  };
}

function main() {
  const page = fs.readFileSync(TEMPLATE, 'utf8');
  const data = JSON.stringify(snapshot(), null, 2) + '\n';

  if (check) {
    const stale = [];
    const current = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
    if (current(path.join(OUT, 'index.html')) !== page) stale.push('seo/index.html');
    // The timestamp changes on every run, so compare everything except that.
    const onDisk = current(path.join(OUT, 'data.json'));
    const strip = text => (text ? text.replace(/"generatedAt": "[^"]*",\n/, '') : text);
    if (strip(onDisk) !== strip(data)) stale.push('seo/data.json');
    if (stale.length) {
      console.error('The /seo dashboard is out of date. Run: node tools/journal/publish-seo.js');
      for (const file of stale) console.error('  ' + file);
      process.exit(1);
    }
    console.log('The /seo dashboard is current.');
    return;
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), page);
  fs.writeFileSync(path.join(OUT, 'data.json'), data);
  const snap = JSON.parse(data);
  console.log(`[journal] published /seo/ - ${snap.posts.length} articles, ${snap.pipeline.queued} queued`);
}

if (require.main === module) main();
module.exports = { snapshot };
