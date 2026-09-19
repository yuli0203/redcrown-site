# Hebrew public home page

The source layout is ../index.html. Edit strings.json for Hebrew public-page copy, then run from the website root:

    node tools/build-calendar-he.cjs
    node tools/build-calendar-he.cjs --check

Regenerate after changes to the English home page or shared legal footer. Do not edit generated index.html directly. The authenticated workspace, booking flow and legal documents are not fully localized yet; the public page discloses this. home-language.js translates dynamic home-page messages only and does not translate user calendar contents.

Both public language URLs have self-canonical and reciprocal hreflang links and sitemap entries. These files are prepared locally; public HTTP availability and Search Console submission must be checked after an authorized deployment. Never put private booking-management URLs in the sitemap.
