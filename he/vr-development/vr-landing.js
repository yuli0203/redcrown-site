const ADS_CONVERSIONS = {
  formSubmit: 'AW-18313532220/H3CjCKq279QcELymyZxE',
  contactClick: 'AW-18313532220/zWKzCPjS89QcELymyZxE'
};
function conversionContext(extra){
  const landingField = document.querySelector('[name="landing_page"]');
  return Object.assign({
    landing_page: landingField?.value || location.pathname,
    page_path: location.pathname
  }, extra || {});
}
function trackConversion(key, params){
  const id = ADS_CONVERSIONS[key];
  if (typeof gtag !== 'function' || !id || id.includes('XXXX')) return;
  // beacon transport so the hit survives tel:/wa.me navigation away from the page
  // Analytics failure must never make a delivered message look unsuccessful.
  try {
    gtag('event', 'conversion', Object.assign({ send_to: id, transport_type: 'beacon' }, params));
  } catch (_) {
    console.warn('Google Ads conversion could not be queued.');
  }
}

// contact form (AJAX submit to Web3Forms)
const cform = document.querySelector('.contact-form');
if (cform) {
  cform.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = cform.querySelector('.form-ok'), err = cform.querySelector('.form-err');
    const btn = cform.querySelector('button[type=submit]');
    if (btn.disabled) return;
    ok.hidden = true; err.hidden = true; btn.disabled = true;
    try {
      const body = new FormData(cform);
      // The HTML redirect is a no-JS fallback. AJAX needs the API JSON response
      // to confirm delivery before showing success and recording a conversion.
      body.delete('redirect');
      const r = await fetch(cform.action, { method:'POST', body, headers:{'Accept':'application/json'} });
      const result = await r.json();
      if (r.ok && result.success === true) {
        const context = conversionContext({ project_type: cform.elements.project?.value || '' });
        cform.reset(); ok.hidden = false;
        trackConversion('formSubmit', context);
      } else { err.hidden = false; }
    } catch (_) { err.hidden = false; }
    finally { btn.disabled = false; }
  });
}

// phone + WhatsApp clicks count as a conversion (contact started from the site)
document.querySelectorAll('a[href^="tel:"], a[href*="wa.me/"]').forEach(a => {
  a.addEventListener('click', () => trackConversion('contactClick', conversionContext({
    contact_method: a.href.includes('wa.me/') ? 'whatsapp' : 'phone'
  })));
});


const params = new URLSearchParams(location.search);
for (const name of ['utm_source','utm_campaign','utm_content','gclid']) {
 const field = document.querySelector(`[name="${name}"]`); if(field) field.value = params.get(name) || '';
}

// One-time section entrances, plus an accessible, slow headset rotation.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let headset = document.querySelector('model-viewer');
let arrivalObserver;
function configureMotion() {
  arrivalObserver?.disconnect();
  if (headset) headset.toggleAttribute('auto-rotate', !motionPreference.matches);
  if (motionPreference.matches) {
    document.querySelectorAll('.motion-arrive').forEach(el => el.classList.remove('motion-arrive'));
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  arrivalObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('motion-arrive');
      arrivalObserver.unobserve(entry.target);
    }
  }, {threshold: 0.12});
  document.querySelectorAll('.section-heading, .project, .solutions-grid article, .process-grid article, .faq > div, .contact-intro, .contact-form').forEach(el => {
    // Avoid replaying entrances when preferences change or when scrolling back.
    if (el.classList.contains('motion-arrive')) return;
    if (el.matches('.project, .solutions-grid article, .process-grid article')) {
      const index = Array.from(el.parentElement.children).indexOf(el);
      el.style.setProperty('--arrival-delay', `${index * 90}ms`);
    }
    arrivalObserver.observe(el);
  });
}
configureMotion();
motionPreference.addEventListener('change', configureMotion);

// Keep the hero useful through network, library, and rendering failures.
const headsetStage = document.querySelector('.headset-stage');
if (headset && headsetStage) {
  const fallback = headsetStage.querySelector('.headset-fallback');
  const loadState = headsetStage.querySelector('.headset-load-state');
  const message = headsetStage.querySelector('.headset-load-message');
  const retry = headsetStage.querySelector('.headset-retry');
  const caption = headsetStage.querySelector('.stage-caption');
  const source = headset.getAttribute('src');
  let attempt = 0;
  let deadline;
  function watchModel(model) {
    const token = ++attempt;
    clearTimeout(deadline);
    model.removeAttribute('data-ready');
    model.setAttribute('inert', '');
    model.setAttribute('aria-hidden', 'true');
    fallback.hidden = false;
    caption.hidden = true;
    loadState.hidden = false;
    message.textContent = 'טוענים את התצוגה התלת-ממדית...';
    retry.hidden = true;
    retry.disabled = true;
    function loaded() {
      if (token !== attempt) return;
      clearTimeout(deadline);
      const restoreFocus = document.activeElement === retry;
      model.setAttribute('data-ready', '');
      model.removeAttribute('inert');
      model.removeAttribute('aria-hidden');
      model.toggleAttribute('auto-rotate', !motionPreference.matches);
      fallback.hidden = true;
      caption.hidden = false;
      loadState.hidden = true;
      if (restoreFocus) model.focus();
    }
    function failed() {
      if (token !== attempt) return;
      clearTimeout(deadline);
      model.removeAttribute('data-ready');
      model.setAttribute('inert', '');
      model.setAttribute('aria-hidden', 'true');
      model.removeAttribute('auto-rotate');
      fallback.hidden = false;
      caption.hidden = true;
      loadState.hidden = false;
      message.textContent = 'התלת-ממד אינו זמין כרגע. בינתיים, הצצה לפרויקט שלנו.';
      retry.hidden = false;
      retry.disabled = false;
    }
    model.addEventListener('load', loaded);
    model.addEventListener('error', failed);
    deadline = setTimeout(failed, 20000);
    // A cached model may have finished before this deferred script runs.
    if (model.loaded) loaded();
  }
  retry.addEventListener('click', () => {
    if (retry.disabled) return;
    if (!customElements.get('model-viewer')) {
      // Reloading also retries the module when its original request failed.
      location.reload();
      return;
    }
    const replacement = headset.cloneNode(true);
    const url = new URL(source, location.href);
    url.searchParams.set('retry', String(attempt));
    replacement.setAttribute('src', url.href);
    // Listen before attaching: cached resources may finish immediately.
    watchModel(replacement);
    headset.replaceWith(replacement);
    headset = replacement;
  });
  watchModel(headset);
}

// Load the project demo only after an explicit play action.
const demo = document.querySelector('#enzyme-demo');
const demoButton = document.querySelector('.demo-play');
if (demo && demoButton) {
  const notice = document.querySelector('.demo-error');
  function showDemoPoster(failed = false) {
    demo.hidden = true;
    demoButton.hidden = false;
    demoButton.disabled = false;
    notice.hidden = !failed;
  }
  demoButton.addEventListener('click', async () => {
    demoButton.disabled = true;
    notice.hidden = true;
    if (!demo.getAttribute('src')) demo.src = demo.dataset.src;
    if (demo.error) demo.load();
    demo.hidden = false;
    try {
      await demo.play();
      demoButton.hidden = true;
      demo.focus({preventScroll:true});
    } catch (_) {
      showDemoPoster(true);
    } finally {
      demoButton.disabled = false;
    }
  });
  demo.addEventListener('error', () => showDemoPoster(true));
  demo.addEventListener('ended', () => {
    const hadFocus = document.activeElement === demo;
    showDemoPoster();
    if (hadFocus) demoButton.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) demo.pause();
  });
}

// Pause decorative background motion when the hero or the tab is out of view.
const heroAtmosphere = document.querySelector('.hero-atmosphere');
if (heroAtmosphere) {
  let heroInView = !('IntersectionObserver' in window);
  const updateAtmosphere = () => {
    heroAtmosphere.toggleAttribute('data-active', heroInView && !document.hidden);
  };
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(entries => {
      heroInView = entries[0].isIntersecting;
      updateAtmosphere();
    }, {threshold:0});
    heroObserver.observe(heroAtmosphere.parentElement);
  }
  document.addEventListener('visibilitychange', updateAtmosphere);
  updateAtmosphere();
}
