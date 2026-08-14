(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll(
    '#solutions .section-title,#solutions .section-lead,.card,.case>img,.case>div,' +
    '.decision-head,.decision-grid article,.decision-cta,.journey-head,.journey-step,.journey-outcome'
  );
  targets.forEach(function (el, index) {
    el.classList.add('motion-reveal');
    el.style.setProperty('--motion-delay', ((index % 3) * 90) + 'ms');
  });

  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('motion-in'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('motion-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  targets.forEach(function (el) { observer.observe(el); });

  var progress = document.createElement('i');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  var caseImage = document.querySelector('.case>img');
  var journey = document.querySelector('.journey-track');
  var journeySteps = journey ? journey.querySelectorAll('.journey-step') : [];
  var ticking = false;
  function update() {
    ticking = false;
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    progress.style.transform = 'scaleX(' + Math.min(1, scrollY / max) + ')';
    if (caseImage && innerWidth > 900) {
      var rect = caseImage.getBoundingClientRect();
      var offset = Math.max(-18, Math.min(18, (innerHeight / 2 - (rect.top + rect.height / 2)) * 0.045));
      caseImage.style.setProperty('--case-shift', offset + 'px');
    }
    if (journey) {
      var jr = journey.getBoundingClientRect();
      var start = innerHeight * 0.76;
      var distance = Math.max(1, jr.height + innerHeight * 0.18);
      var jp = Math.max(0, Math.min(1, (start - jr.top) / distance));
      journey.style.setProperty('--journey-progress', jp.toFixed(3));
      journeySteps.forEach(function (step, index) {
        var threshold = index / Math.max(1, journeySteps.length - 1);
        step.classList.toggle('is-active', jp + 0.04 >= threshold);
      });
    }
  }
  function requestUpdate() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate, { passive: true });
  update();
})();
