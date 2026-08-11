/*
 * Shared page chrome: the nav, the footer, the floating WhatsApp button, and the
 * language switcher.
 *
 * WHY THIS EXISTS
 * The standalone pages had their own hand-copied nav and footer, and they had
 * already drifted from the home page: two nav links missing, no language
 * switcher, no WhatsApp anywhere. Chrome copied by hand always drifts, and the
 * drift is invisible until someone notices on a phone.
 *
 * Everything the chrome contains is DATA below, so a redesign or a new nav item
 * is one edit. tools/test_pages.py asserts the generated nav matches the home
 * page's nav, so if index.html gains a link and this does not, CI fails.
 *
 * The home page and /he/ are still hand-maintained HTML: they are not generated
 * from these functions. The drift CHECK is what keeps them honest until they
 * are migrated too.
 */
'use strict';

// The canonical nav. Hashes resolve against the home page from any depth.
const NAV = [
  { hash: '#top',      label: 'HOME' },
  { hash: '#services', label: 'SERVICES', section: 'services' },
  { hash: '#work',     label: 'WORK', section: 'work' },
  { hash: '#tech',     label: 'TECHNOLOGIES' },
  { hash: '#about',    label: 'ABOUT' },
  { hash: '#faq',      label: 'FAQ' },
  { hash: '#contact',  label: 'CONTACT' },
];

const CONTACT = {
  place: 'Haifa, Israel',
  email: 'hello@redcrowninteractive.com',
  phone: '+972-58-576-0550',
  phoneHref: 'tel:+972585760550',
  whatsapp: 'https://wa.me/972585760550?text=Hi%21%20I%27m%20interested%20in%20app%20development%20services',
  linkedin: 'https://www.linkedin.com/company/red-crown-interactive',
};

// Languages that have their own home page. A standalone English page cannot
// offer a translation of itself, so the switcher goes to that language's home.
const LANGS = [
  { code: 'en', label: 'EN', href: '/' },
  { code: 'he', label: 'עב', href: '/he/' },
  { code: 'ru', label: 'RU', href: '/ru/' },
];

const ICON = {
  pin: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  mail: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 7l9 6 9-6"/></svg>',
  phone: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  wa: '<svg class="icon icon-wa" viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z"/><path d="M9.2 8.8c-.3 3.1 2.9 6.3 6 6l.6-1.6-2-1.2-.9.7c-.7-.4-1.2-.9-1.6-1.6l.7-.9-1.2-2z"/></svg>',
  waBig: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z"/><path d="M9.2 8.8c-.3 3.1 2.9 6.3 6 6l.6-1.6-2-1.2-.9.7c-.7-.4-1.2-.9-1.6-1.6l.7-.9-1.2-2z"/></svg>',
};

function logo(up, EOL) {
  return [
    '    <a class="logo" href="/">',
    `      <img src="${up}assets/logo-kit/redcrown-primary-scarlet.svg" alt="Red Crown Interactive logo" width="40" height="40">`,
    '      <span><b>RED CROWN</b><i>INTERACTIVE</i></span>',
    '    </a>',
  ].join(EOL);
}

/* A JS-free language switcher. The dropdown on the home page needs site.js,
   which these pages deliberately do not load, so this is three plain links. */
function langSwitcher(EOL) {
  const items = LANGS.map(l => (l.code === 'en'
    ? `      <span class="lang-on" aria-current="true">${l.label}</span>`
    : `      <a href="${l.href}" lang="${l.code}">${l.label}</a>`));
  return ['    <div class="lang-static" role="group" aria-label="Language / שפה / Язык">']
    .concat(items).concat(['    </div>']).join(EOL);
}

function nav(opts) {
  const EOL = opts.EOL, up = opts.up;
  const items = NAV.map(l => {
    const on = opts.section && l.section === opts.section ? ' class="on"' : '';
    const href = l.hash === '#top' ? '/' : '/' + l.hash;
    return `      <li><a${on} href="${href}">${l.label}</a></li>`;
  });
  return ['',
    // WCAG 2.4.1: same skip link the home pages carry, so every page can bypass the nav
    '<a class="skip-link" href="#main">Skip to content</a>',
    '<nav>', '  <div class="nav-in">', logo(up, EOL),
    '    <ul class="nav-links">']
    .concat(items)
    .concat([
      '    </ul>',
      '    <a class="btn btn-line nav-cta" href="/#contact">GET A PROPOSAL</a>',
      langSwitcher(EOL),
      '  </div>',
      '</nav>',
      '',
    ]).join(EOL);
}

const PROPOSAL_SVG = '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';

function waFloat(EOL) {
  return ['', `<a class="wa-float" href="${CONTACT.whatsapp}" target="_blank" rel="noopener"` +
    ` aria-label="Chat on WhatsApp">${ICON.waBig}</a>`,
    `<a class="proposal-float" href="/#contact" aria-label="Get a project proposal">${PROPOSAL_SVG}<span>GET A PROPOSAL</span></a>`, ''].join(EOL);
}

function footer(opts) {
  const EOL = opts.EOL, up = opts.up;
  return ['', '<footer>', '  <div class="foot">', logo(up, EOL),
    '    <div class="foot-right">',
    '      <div class="contact">',
    `        <span>${ICON.pin}<span>${CONTACT.place}</span></span>`,
    `        <span>${ICON.mail}<a href="mailto:${CONTACT.email}">${CONTACT.email}</a></span>`,
    `        <span dir="ltr">${ICON.phone}<a href="${CONTACT.phoneHref}">${CONTACT.phone}</a></span>`,
    `        <span dir="ltr">${ICON.wa}<a href="${CONTACT.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></span>`,
    '      </div>',
    '      <div class="socials">',
    `        <a href="${CONTACT.linkedin}" aria-label="LinkedIn" rel="noopener">in</a>`,
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="copy">© 2026 Red Crown Interactive. All rights reserved.</div>',
    '  <nav class="foot-legal" aria-label="Legal">',
    '    <a href="/legal/#privacy">Privacy Policy</a>',
    '    <a href="/legal/#terms">Terms of Use</a>',
    '    <a href="/legal/#accessibility">Accessibility Statement</a>',
    '  </nav>',
    '</footer>',
    '',
  ].join(EOL);
}

module.exports = { NAV, CONTACT, LANGS, nav, footer, waFloat, langSwitcher };
