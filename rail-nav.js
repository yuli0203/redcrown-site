/* ---------------------------------------------------------------------------
   Animated project navigation fallback  ·  Red Crown Interactive

   The case-study pages use native cross-document View Transitions: each rail
   card morphs, the scarlet bar slides, the content glides. That needs Chrome
   126+ or Safari 18.4+. On anything older this file takes over instead:
   intercept the click, animate the old content out, fetch the next page, swap
   the main region and the title, animate the new content in, and keep history
   correct. Same feel, done by hand.

   If native transitions are available this file does nothing at all, so the
   two mechanisms can never fight. ?railjs=1 forces the JS path for testing.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  var FORCE = location.search.indexOf('railjs=1') !== -1;
  if (!FORCE && typeof CSSViewTransitionRule !== 'undefined') return;   // native path owns it
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // plain navigation
  var busy = false;

  function swap(url) {
    var main = document.querySelector('main.pg');
    if (!main || busy) { location.href = url; return; }
    busy = true;
    main.classList.add('pg-leave');
    var gone = new Promise(function (r) { setTimeout(r, 240); });       // matches the CSS

    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      return gone.then(function () { return html; });
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var next = doc.querySelector('main.pg');
      if (!next) { location.href = url; return; }
      document.title = doc.title;
      main.replaceWith(next);
      history.pushState({ rail: 1 }, '', url);
      window.scrollTo(0, 0);
      next.classList.add('pg-enter');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { next.classList.remove('pg-enter'); });
      });
      if (window.RCModels) RCModels.load();                             // build the new page's model
      if (typeof gtag === 'function') gtag('event', 'page_view', { page_path: url });
      busy = false;
    }).catch(function () { location.href = url; });
  }

  document.addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var a = e.target.closest && e.target.closest('.pg-ring-i, .pg-pager a');
    if (!a) return;
    var url = a.getAttribute('href');
    if (!url || url.indexOf('/work/') !== 0) return;                    // only project pages
    e.preventDefault();
    swap(url + (FORCE ? '?railjs=1' : ''));
  }, true);

  // Back and forward reload normally: correct beats clever in history handling.
  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.rail) location.reload();
  });
})();
