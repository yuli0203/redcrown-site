#!/usr/bin/env node
/*
 * Push the full journal state to the API Worker.
 *
 * This is the half of the dashboard that must not be published with the site:
 * the keyword queue, what the competitors rank for, and the audit findings.
 * It goes to the Worker, which hands it out only to a signed-in owner.
 *
 *   JOURNAL_PUBLISH_KEY='…' node tools/journal/publish-state.js
 *   node tools/journal/publish-state.js --dry-run   print the snapshot instead
 */
'use strict';
const fs = require('fs');
const path = require('path');
const posts = require('./lib/posts.js');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const QUEUE = path.join(HERE, 'keywords.json');
const REPORT = path.join(HERE, 'audit-report.md');
const dryRun = process.argv.includes('--dry-run');

const readJson = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

function snapshot() {
  const cfg = posts.config();
  const all = posts.all();
  return {
    generatedAt: new Date().toISOString(),
    siteId: (cfg.dashboard && cfg.dashboard.siteId) || 'redcrowninteractive',
    site: cfg.site,
    brandDna: cfg.brandDna,
    content: cfg.content,
    seo: cfg.seo,
    schedule: cfg.schedule,
    models: cfg.models,
    social: { facebook: { enabled: cfg.social.facebook.enabled, template: cfg.social.facebook.template } },
    posts: all.map(post => ({
      slug: post.slug, title: post.title, excerpt: post.excerpt, isoDate: post.isoDate,
      keyword: post.keyword || '', secondaryKeywords: post.secondaryKeywords || [],
      words: posts.wordCount(post), source: post.source || 'journal',
      faq: (post.faq || []).length, links: (post.internalLinks || []).length,
      headings: post.sections.map(section => section.heading),
      research: post.research || null,
      shared: Boolean(post.shared && post.shared.facebook),
      rendered: fs.existsSync(path.join(ROOT, 'blog', post.slug, 'index.html')),
    })),
    keywords: readJson(QUEUE) || [],
    audit: fs.existsSync(REPORT) ? fs.readFileSync(REPORT, 'utf8') : '',
  };
}

async function main() {
  const data = snapshot();
  if (dryRun) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const cfg = posts.config();
  const origin = cfg.dashboard && cfg.dashboard.apiOrigin;
  const key = process.env.JOURNAL_PUBLISH_KEY;
  if (!origin) {
    console.error('Set dashboard.apiOrigin in tools/journal/config.json to the deployed Worker URL.');
    process.exit(1);
  }
  if (!key) {
    console.error('JOURNAL_PUBLISH_KEY is not set. It is the key you gave the Worker with: npx wrangler secret put PUBLISH_KEY');
    process.exit(1);
  }

  const response = await fetch(new URL('/seo/api/state', origin), {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-journal-key': key },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`[journal] the API refused the snapshot (${response.status}): ${result.error || response.statusText}`);
    process.exit(1);
  }
  console.log(`[journal] pushed ${data.posts.length} articles and ${data.keywords.length} keywords to the dashboard API.`);
}

if (require.main === module) {
  main().catch(error => { console.error('[journal] publish failed:', error.message); process.exit(1); });
}
module.exports = { snapshot };
