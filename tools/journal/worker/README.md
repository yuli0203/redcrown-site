# The journal API

A Cloudflare Worker with one job: hold the journal's private data and hand it
only to a signed-in owner. It exists because GitHub Pages cannot check who is
asking, so anything published with the site is public by definition.

It reuses the Firebase project the calendar already signs into
(`crown-calendar-89e18`), so there is no second account to create and no second
password to remember.

## Deploy

```
cd tools/journal/worker
npx wrangler login
npx wrangler kv namespace create JOURNAL     # put the printed id in wrangler.toml
npx wrangler secret put PUBLISH_KEY          # invent a long random string
npx wrangler deploy
```

`wrangler deploy` prints the Worker's URL. Put it in `tools/journal/config.json`
under `dashboard.apiOrigin`, then run `node tools/journal/publish-seo.js` so the
page knows where to ask.

## Feed it

```
JOURNAL_PUBLISH_KEY='…the same string…' node tools/journal/publish-state.js
```

That pushes the full snapshot - articles, keyword queue, competitor findings,
audit report - into the Worker's KV store. `.github/workflows/journal.yml` runs
it after every publish, using the `JOURNAL_PUBLISH_KEY` repository secret.

## What each credential does

| Credential | Held by | Grants |
|---|---|---|
| Firebase sign-in | you, in the browser | reading the dashboard |
| `OWNER_EMAILS` | `wrangler.toml` | which verified addresses count as you |
| `PUBLISH_KEY` | Worker secret + repository secret | writing a new snapshot |

A visitor to `/seo` with no session sees a sign-in box and nothing else. A
signed-in address that is not on the owners list gets a refusal, not data. The
publish key cannot read anything, and the sign-in cannot write anything.

## Selling this later

The Worker is already keyed by site (`state:<siteId>`), so a second customer is
a second `SITE_ID`, a second owners list and a second KV key - not a fork. What
a product would still need: a tenants table instead of `wrangler.toml` vars,
each tenant's own Anthropic key or a metered pool, and a publishing target per
tenant (their CMS or a hosted blog) in place of this repository's `build.js`.
