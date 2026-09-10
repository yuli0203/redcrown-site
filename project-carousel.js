/* Shared homepage Coverflow. No autoplay or wheel interception. */
(function(){
  'use strict';
  const work = document.querySelector('#work');
  const grid = work && work.querySelector('.w2-grid');
  if (!grid || typeof Swiper === 'undefined') return;
  const lang = document.documentElement.lang;
  const translations = {
    he:{region:'טעימה מפרויקטים שבנינו',carousel:'קרוסלה',project:'פרויקט',of:'מתוך',prev:'הפרויקט הקודם',next:'הפרויקט הבא'},
    en:{region:'Selected projects',carousel:'carousel',project:'Project',of:'of',prev:'Previous project',next:'Next project'},
    ru:{region:'Избранные проекты',carousel:'карусель',project:'Проект',of:'из',prev:'Предыдущий проект',next:'Следующий проект'}
  };
  const labels = translations[lang] || translations.en;
  const slides = [...grid.children];
  const cards = slides.map(slide => slide.querySelector('.lcard'));
  const panels = cards.map(card => document.getElementById(card.getAttribute('aria-controls')));
  // Four distinct projects need presentation copies for a centered, seamless loop.
  // Detail panels and their IDs are never duplicated; the counter stays out of four.
  slides.forEach(slide => grid.append(slide.cloneNode(true)));
  const displaySlides = [...grid.children];
  const displayCards = displaySlides.map(slide => slide.querySelector('.lcard'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.createElement('div');
  root.className = 'project-carousel';
  root.setAttribute('role','region');
  root.setAttribute('aria-label',labels.region);
  root.setAttribute('aria-roledescription',labels.carousel);
  const heading = work.querySelector('.work-kicker') || work.querySelector('h2');
  if (heading) {
    if (!heading.id) heading.id = 'project-carousel-heading';
    root.setAttribute('aria-labelledby',heading.id);
  }
  const viewport = document.createElement('div');
  viewport.className = 'swiper';
  // Index increases toward the right, as requested; Hebrew slide content stays RTL.
  viewport.dir = 'ltr';
  grid.before(root);
  root.append(viewport);
  viewport.append(grid);
  grid.classList.remove('w2-grid');
  grid.classList.add('swiper-wrapper');
  displaySlides.forEach((slide,index) => {
    slide.classList.remove('rv','in');
    slide.classList.add('swiper-slide');
    slide.setAttribute('role','group');
    slide.setAttribute('aria-roledescription',labels.project);
    slide.dir = lang === 'he' ? 'rtl' : 'ltr';
    displayCards[index].setAttribute('aria-label',slide.querySelector('.l-title').textContent);
    slide.setAttribute('aria-label',`${index % cards.length + 1} ${labels.of} ${cards.length}`);
  });
  const controls = document.createElement('div');
  controls.className = 'carousel-controls';
  controls.dir = 'ltr';
  // Explicit SVG directions avoid font-dependent arrow glyphs and bidi mirroring.
  controls.innerHTML = '<button class="carousel-arrow" data-direction="prev" type="button" aria-label="הפרויקט הקודם"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m15 5-7 7 7 7"/></svg></button><span class="carousel-count" aria-hidden="true"></span><button class="carousel-arrow" data-direction="next" type="button" aria-label="הפרויקט הבא"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg></button>';
  controls.querySelector('[data-direction="prev"]').setAttribute('aria-label',labels.prev);
  controls.querySelector('[data-direction="next"]').setAttribute('aria-label',labels.next);
  const status = document.createElement('div');
  status.className = 'carousel-status';
  status.setAttribute('aria-live','polite');
  status.setAttribute('aria-atomic','true');
  root.append(controls,status);
  let selectedRealIndex = -1, detailsOpen = true, focusCardAfterMove = false;
  function syncDetails(){
    panels.forEach((panel,i) => { panel.hidden = !detailsOpen || i !== selectedRealIndex % cards.length; });
    displayCards.forEach((card,i) => {
      card.setAttribute('aria-expanded',String(detailsOpen && i === selectedRealIndex));
    });
  }
  function select(realIndex,announce){
    const index = realIndex % cards.length;
    const changed = index !== selectedRealIndex % cards.length;
    const moveFocus = focusCardAfterMove || displayCards.includes(document.activeElement);
    selectedRealIndex = realIndex;
    if (changed) detailsOpen = true;
    // Expose/focus the incoming card BEFORE hiding the old one from AT.
    displaySlides[realIndex].removeAttribute('aria-hidden');
    displayCards[realIndex].tabIndex = 0;
    if (moveFocus) displayCards[realIndex].focus({preventScroll:true});
    displayCards.forEach((card,i) => {
      card.tabIndex = i === realIndex ? 0 : -1;
      if (i !== realIndex) displaySlides[i].setAttribute('aria-hidden','true');
      if (i === realIndex) card.setAttribute('aria-current','true');
      else card.removeAttribute('aria-current');
    });
    syncDetails();
    controls.querySelector('.carousel-count').textContent = `${index+1}/${cards.length}`;
    if (announce && changed) {
      status.textContent = `${labels.project} ${index+1} ${labels.of} ${cards.length}: ${cards[index].getAttribute('aria-label')}`;
      if (window.RCModels) window.RCModels.load();
    }
  }
  const carousel = new Swiper(viewport,{
    effect:'coverflow',centeredSlides:true,slidesPerView:1.55,spaceBetween:4,
    initialSlide:0,loop:true,speed:reduce.matches ? 0 : 520,grabCursor:true,
    watchSlidesProgress:true,
    coverflowEffect:{rotate:reduce.matches ? 0 : 22,stretch:0,depth:140,modifier:1,slideShadows:false},
    breakpoints:{600:{slidesPerView:2.5,spaceBetween:12},1000:{slidesPerView:2.8,spaceBetween:16}},
    // Semantics are managed here, including presentation copies and one live
    // region. Swiper's additional live region would repeat announcements.
    a11y:{enabled:false},
    on:{slideChange(){select(this.realIndex,true);}}
  });
  select(carousel.realIndex,false);
  // Swiper ignores loop navigation during a transition. Retain deliberate clicks
  // and perform each move after the previous one (including loopFix) has settled.
  const pendingMoves = [];
  let moveScheduled = false;
  function runNextMove(){
    if (carousel.animating || moveScheduled || !pendingMoves.length) return;
    moveScheduled = true;
    requestAnimationFrame(() => {
      moveScheduled = false;
      if (carousel.animating || !pendingMoves.length) return;
      const move = pendingMoves.shift();
      focusCardAfterMove = !!move.focusCard;
      if (move.direction === 'next') carousel.slideNext();
      else if (move.direction === 'prev') carousel.slidePrev();
      else {
        // Resolve the card's current physical position after loop reordering.
        const target = displaySlides[move.index];
        if (carousel.realIndex === move.index) {
          detailsOpen = !detailsOpen;
          select(move.index,false);
          focusCardAfterMove = false;
        }
        else if (target.classList.contains('swiper-slide-prev')) carousel.slidePrev();
        else if (target.classList.contains('swiper-slide-next')) carousel.slideNext();
        else carousel.slideToLoop(move.index);
      }
      // slideToLoop schedules its own frame; let it start before checking again.
      requestAnimationFrame(runNextMove);
    });
  }
  function queueMove(move){pendingMoves.push(move);runNextMove();}
  carousel.on('transitionEnd',() => {
    select(carousel.realIndex,false);
    focusCardAfterMove = false;
    runNextMove();
  });
  controls.querySelector('[data-direction="prev"]').addEventListener('click',() => queueMove({direction:'prev'}));
  controls.querySelector('[data-direction="next"]').addEventListener('click',() => queueMove({direction:'next'}));
  displayCards.forEach((card,index) => {
    // Side cards remain clickable, but cannot receive native pointer focus
    // while hidden from AT. Selection first brings them into the accessible UI.
    card.addEventListener('pointerdown',event => {
      if (index !== selectedRealIndex) event.preventDefault();
    });
    card.addEventListener('click',() => {
      if (!carousel.allowClick) return;
      queueMove({index,focusCard:true});
    });
  });
  root.addEventListener('keydown',event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    queueMove({direction:event.key === 'ArrowRight' ? 'next' : 'prev',focusCard:displayCards.includes(document.activeElement)});
  });
  function closeDetails(){
    pendingMoves.length = 0;
    detailsOpen = false;
    // Restore focus before hiding the panel that may currently own it.
    displayCards[selectedRealIndex].focus({preventScroll:true});
    syncDetails();
  }
  panels.forEach(panel => panel.querySelector('.wdetail-close').addEventListener('click',closeDetails));
  work.addEventListener('keydown',event => {
    if (event.key === 'Escape' && !event.defaultPrevented && detailsOpen &&
        (root.contains(event.target) || panels.some(panel => !panel.hidden && panel.contains(event.target)))) {
      event.preventDefault();
      closeDetails();
    }
  });
  reduce.addEventListener('change',() => {
    carousel.params.speed = reduce.matches ? 0 : 520;
    carousel.params.coverflowEffect.rotate = reduce.matches ? 0 : 22;
    carousel.update();
  });
})();
