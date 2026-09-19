document.querySelectorAll('[data-rc-year]').forEach(element => {
  element.textContent = String(new Date().getFullYear());
});

// Reuse the studio's existing translations instead of maintaining copied policies.
(() => {
  const localized = () => {
    let lang = document.documentElement.lang;
    try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('rc_lang') || lang; } catch {}
    const base = ['he','ru'].includes(lang) ? '/' + lang + '/legal/' : '/legal/';
    const labels = {he:{privacy:'מדיניות פרטיות',accessibility:'הצהרת נגישות',calendar:'פרטיות נתוני היומן'},ru:{privacy:'Политика конфиденциальности',accessibility:'Заявление о доступности',calendar:'Данные календаря'}}[lang];
    document.querySelectorAll('.rc-legal-footer a').forEach(link => {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (/^\/(?:he\/|ru\/)?legal\/$/.test(url.pathname) && ['#privacy','#accessibility'].includes(url.hash)) {
        link.href = base + url.hash;
        if (labels) link.textContent = labels[url.hash.slice(1)];
      }
      if (labels && url.pathname === '/calendar/legal/' && url.hash === '#privacy') link.textContent = labels.calendar;
    });
  };
  localized();
  document.addEventListener('click', localized, true);
})();
