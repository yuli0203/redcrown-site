(() => {
  'use strict';
  const key = 'crown-calendar-theme';
  function apply(theme) {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#faf7f8' : '#100c0e');
    const button = document.querySelector('#theme-toggle');
    if (button) {
      button.textContent = light ? 'Dark mode' : 'Light mode';
      button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
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
