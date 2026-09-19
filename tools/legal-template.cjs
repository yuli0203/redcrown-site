const sections = [['privacy','Privacy Policy'],['terms','Terms of Use'],['accessibility','Accessibility Statement'],['support','Support']];
function footer(product = 'studio') {
  const base = product === 'calendar' ? '/calendar/legal/' : '/legal/';
  return `<!-- shared-legal-footer:start -->
<link rel="stylesheet" href="/shared/legal.css">
<div class="rc-legal-footer"><p>© <span data-rc-year>${new Date().getFullYear()}</span> Red Crown Interactive. All rights reserved.</p><div role="navigation" aria-label="${product === 'calendar' ? 'Red Crown Calendar' : 'Red Crown Interactive'} policies and support">${sections.map(([id,label]) => `<a href="${base}#${id}">${label}</a>`).join('')}</div></div>
<script defer src="/shared/legal.js"></script>
<!-- shared-legal-footer:end -->`;
}
function page(data) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${data.name} | Policies and support</title><meta name="description" content="${data.name} privacy policy, terms of use, accessibility statement and support."><link rel="canonical" href="https://redcrowninteractive.com/${data.path.replace('index.html','')}"><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/shared/legal.css"></head>
<body class="rc-policy-page"><a class="rc-skip" href="#main">Skip to content</a><header class="rc-policy-header"><a href="${data.home}">${data.name}</a><a href="${data.other}">${data.otherName} statements</a></header>
<main id="main" class="rc-policy-main"><p class="rc-eyebrow">POLICIES AND SUPPORT</p><h1>${data.name}</h1><p>${data.scope}</p><p class="rc-updated">Last updated: 19 September 2026</p><div class="rc-policy-toc" role="navigation" aria-label="Sections">${sections.map(([id,label])=>`<a href="#${id}">${label}</a>`).join('')}</div>${sections.map(([id,label])=>`<section id="${id}"><h2>${label}</h2>${data[id]}</section>`).join('')}</main>
<footer class="rc-policy-footer"><a href="/">Red Crown Interactive</a><p>We build apps, websites and interactive experiences.</p>${footer(data.home === '/' ? 'studio' : 'calendar')}</footer></body></html>\n`;
}
module.exports = { footer, page };
