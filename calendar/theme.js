(() => {
  'use strict';
  const key = 'crown-calendar-theme';
  function apply(theme) {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#faf7f8' : '#100c0e');
    const button = document.querySelector('#theme-toggle');
    if (button) {
      button.innerHTML = light
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
      const label = light ? 'Switch to dark mode' : 'Switch to light mode';
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  let saved = 'dark';
  try { saved = localStorage.getItem(key) || 'dark'; } catch { /* Theme still works without storage. */ }
  apply(saved);
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.querySelector('#theme-toggle')?.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      apply(theme);
      try { localStorage.setItem(key, theme); } catch { /* Keep the current choice for this page. */ }
    });
  });
  window.addEventListener('storage', event => { if (event.key === key) apply(event.newValue); });
})();
