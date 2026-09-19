document.querySelectorAll('[data-rc-year]').forEach(element => {
  element.textContent = String(new Date().getFullYear());
});
