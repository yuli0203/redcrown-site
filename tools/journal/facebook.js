#!/usr/bin/env node
/*
 * Share new articles to the Facebook page.
 *
 * One post per article, once. The record of what was shared lives in the post
 * file itself, so a re-run cannot double-post and a rebuild cannot forget.
 * The page token is read from the environment - never from config.json.
 *
 *   node tools/journal/facebook.js            share anything unshared
 *   node tools/journal/facebook.js --dry-run  print what it would post
 *   node tools/journal/facebook.js --slug x   share one article
 */
'use strict';
const posts = require('./lib/posts.js');

const cfg = posts.config();
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const only = argv[argv.indexOf('--slug') + 1];

async function share(post, settings, pageId, token) {
  const url = `${cfg.site.url}/blog/${post.slug}/`;
  const message = settings.template
    .replace('{title}', post.title)
    .replace('{excerpt}', post.excerpt)
    .replace('{url}', url);

  if (dryRun) {
    console.log(`--- ${post.slug} ---\n${message}\n`);
    return null;
  }
  const endpoint = `https://graph.facebook.com/${settings.graphVersion}/${pageId}/feed`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, link: url, access_token: token }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (body.error && body.error.message) || response.statusText;
    throw new Error(`Facebook rejected ${post.slug}: ${detail}`);
  }
  post.shared = { ...(post.shared || {}), facebook: { postId: body.id, at: new Date().toISOString() } };
  posts.save(post);
  console.log(`[journal] shared ${post.slug} → ${body.id}`);
  return body.id;
}

async function main() {
  const settings = cfg.social.facebook;
  if (!settings.enabled) { console.log('[journal] facebook sharing is disabled in config.json.'); return; }

  const pageId = process.env[settings.pageIdEnv];
  const token = process.env[settings.tokenEnv];
  if (!dryRun && (!pageId || !token)) {
    console.error(`[journal] ${settings.pageIdEnv} and ${settings.tokenEnv} must be set. Locally: export them. In CI: repository secrets.`);
    process.exit(1);
  }

  const pending = posts.all().filter(post => {
    if (only) return post.slug === only;
    // Imported history is not news; only share what this engine published.
    return post.source !== 'soro-import' && !(post.shared && post.shared.facebook);
  });
  if (!pending.length) { console.log('[journal] nothing new to share.'); return; }

  for (const post of pending) await share(post, settings, pageId, token);
}

if (require.main === module) {
  main().catch(error => { console.error('[journal] sharing failed:', error.message); process.exit(1); });
}
