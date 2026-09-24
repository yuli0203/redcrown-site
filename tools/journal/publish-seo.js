#!/usr/bin/env node
/*
 * Publish the dashboard page to /seo/ on the live site.
 *
 * Only two files ship: the page itself and the few public settings it needs to
 * find the API and the Firebase project. No journal data is published - the
 * page signs the visitor in and fetches everything from the Worker, which
 * hands it over only to an owner. Nothing here is worth reading anonymously.
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
const check = process.argv.includes('--check');

/* The page needs to know where the API is, which Firebase project signs people
   in, and which Search Console property to query. All three are public facts;
   none of them grants anything on their own. */
function pageSettings() {
  const cfg = posts.config();
  const dashboard = cfg.dashboard || {};
  return {
    siteId: dashboard.siteId || 'redcrowninteractive',
    apiOrigin: dashboard.apiOrigin || '',
    authConfig: dashboard.authConfig || '/calendar/auth-config.json',
    searchConsoleProperty: dashboard.searchConsoleProperty || `sc-domain:${new URL(cfg.site.url).hostname}`,
  };
}

function main() {
  const page = fs.readFileSync(TEMPLATE, 'utf8');
  const settings = JSON.stringify(pageSettings(), null, 2) + '\n';
  const files = [[path.join(OUT, 'index.html'), page], [path.join(OUT, 'config.json'), settings]];

  if (check) {
    const stale = files
      .filter(([file, content]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content)
      .map(([file]) => path.relative(ROOT, file));
    if (stale.length) {
      console.error('The /seo dashboard is out of date. Run: node tools/journal/publish-seo.js');
      for (const file of stale) console.error('  ' + file);
      process.exit(1);
    }
    console.log('The /seo dashboard is current.');
    return;
  }

  fs.mkdirSync(OUT, { recursive: true });
  for (const [file, content] of files) fs.writeFileSync(file, content);
  // An earlier version shipped a public snapshot here. It is gone now, and a
  // stale copy on disk would still be served.
  const legacy = path.join(OUT, 'data.json');
  if (fs.existsSync(legacy)) fs.rmSync(legacy);
  const { apiOrigin } = pageSettings();
  console.log(`[journal] published /seo/${apiOrigin ? '' : ' - set dashboard.apiOrigin in config.json once the Worker is deployed'}`);
}

if (require.main === module) main();
module.exports = { pageSettings };
