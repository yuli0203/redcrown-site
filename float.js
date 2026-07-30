/* The proposal pill earns its place on screen instead of squatting on it:
   hidden until the visitor has scrolled into actually reading, gone again the
   moment the contact form it points at is in view. */
(function () {
  'use strict';
  var f = document.querySelector('.proposal-float');
  if (!f) return;
  var past = false, atForm = false;
  function upd() { f.classList.toggle('is-in', past && !atForm); }
  function onScroll() { past = window.scrollY > window.innerHeight * 0.55; upd(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  var contact = document.querySelector('#contact');
  if (contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { atForm = e[0].isIntersecting; upd(); },
      { rootMargin: '0px 0px -15% 0px' }).observe(contact);
  }
})();
