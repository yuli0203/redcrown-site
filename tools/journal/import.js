#!/usr/bin/env node
/*
 * Import the articles that were published through Soro.
 *
 * Run it from a machine that can reach app.trysoro.com. It preserves each
 * article's original publication date and slug, so the URLs and the ordering
 * survive the move; it never overwrites a post that already exists unless
 * --reconcile is passed, which only corrects dates.
 *
 *   node tools/journal/import.js               import what is missing
 *   node tools/journal/import.js --reconcile   also fix dates of existing posts
 *   node tools/journal/import.js --dry-run     report, write nothing
 */
'use strict';
const posts = require('./lib/posts.js');

const cfg = posts.config();
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const reconcile = argv.includes('--reconcile');

/* The embed serves a script with the article list inline. */
async function fetchArticles() {
  const response = await fetch(cfg.import.soroEmbed, { headers: { accept: '*/*' } });
  if (!response.ok) throw new Error(`the embed answered ${response.status}`);
  const source = await response.text();
  const match = source.match(/var SORO_ARTICLES = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('the embed no longer exposes SORO_ARTICLES - export the articles manually instead');
  return JSON.parse(match[1]);
}

/* Soro stores article bodies as HTML. Turn the parts we render into records;
   anything we cannot map becomes a paragraph rather than being dropped. */
function toPost(article) {
  const html = article.content || article.html || article.body || '';
  const blocks = [...html.matchAll(/<(h2|h3|p|li)[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => ({
    tag: match[1].toLowerCase(),
    text: match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(),
  })).filter(block => block.text);

  const intro = [];
  const sections = [];
  for (const block of blocks) {
    if (block.tag === 'h2' || block.tag === 'h3') {
      sections.push({ heading: block.text, paragraphs: [] });
    } else if (!sections.length) {
      intro.push(block.text);
    } else if (block.tag === 'li') {
      const section = sections[sections.length - 1];
      section.list = section.list || { type: 'ul', items: [] };
      section.list.items.push(block.text);
    } else {
      sections[sections.length - 1].paragraphs.push(block.text);
    }
  }
  return {
    slug: article.slug,
    title: article.title,
    metaTitle: `${article.title} | ${cfg.site.name}`,
    description: (article.metaDescription || article.excerpt || '').slice(0, cfg.seo.descriptionMaxChars),
    excerpt: article.excerpt || '',
    keyword: article.keyword || article.focusKeyword || '',
    secondaryKeywords: article.secondaryKeywords || [],
    isoDate: article.isoDate || article.publishedAt || article.date,
    source: 'soro-import',
    intro: intro.length ? intro : [article.excerpt || article.title],
    sections: sections.length ? sections : [{ heading: article.title, paragraphs: [article.excerpt || ''] }],
    faq: [],
    internalLinks: [],
  };
}

async function main() {
  const articles = await fetchArticles();
  console.log(`[journal] the embed lists ${articles.length} articles.`);
  const existing = new Map(posts.all().map(post => [post.slug, post]));
  let imported = 0, fixed = 0;

  for (const article of articles) {
    const current = existing.get(article.slug);
    if (current) {
      const date = article.isoDate || article.publishedAt || article.date;
      if (reconcile && date && date !== current.isoDate) {
        console.log(`[journal] date ${current.slug}: ${current.isoDate} → ${date}`);
        if (!dryRun) posts.save({ ...current, isoDate: date });
        fixed++;
      } else {
        console.log(`[journal] already here: ${article.slug}`);
      }
      continue;
    }
    const post = toPost(article);
    try {
      posts.validate(post);
    } catch (error) {
      console.warn(`[journal] skipped ${article.slug}: ${error.message}`);
      continue;
    }
    console.log(`[journal] importing ${post.slug} (${post.isoDate.slice(0, 10)}, ${posts.wordCount(post)} words)`);
    if (!dryRun) posts.save(post);
    imported++;
  }
  console.log(`[journal] ${imported} imported, ${fixed} dates corrected. Next: node tools/journal/build.js`);
}

if (require.main === module) {
  main().catch(error => { console.error('[journal] import failed:', error.message); process.exit(1); });
}
module.exports = { toPost };
