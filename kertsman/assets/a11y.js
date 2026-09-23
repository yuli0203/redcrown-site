/* ============================================================================
   תפריט נגישות / accessibility menu
   ----------------------------------------------------------------------------
   נטען בכל עמודי האתר. מוסיף כפתור צף ותפריט התאמות: גודל טקסט, ניגודיות,
   הדגשת קישורים, עצירת אנימציות, גופן קריא וכיבוי הסמן המעוצב.
   ההעדפות נשמרות בדפדפן של המבקר בלבד.

   Loaded on every page. Adds a floating button and a panel of adjustments:
   text size, contrast, link highlighting, stopping animation, a plain reading
   font and turning off the decorative cursor. Preferences are stored only in
   the visitor's own browser.
   ============================================================================ */
(function () {
  'use strict';

  var LANG = (document.documentElement.getAttribute('lang') || 'he').slice(0, 2);
  var KEY = 'kertsman:a11y';
  var root = document.documentElement;

  var T = {
    he: {
      open: 'תפריט נגישות',
      title: 'התאמות נגישות',
      bigger: 'הגדלת טקסט',
      smaller: 'הקטנת טקסט',
      contrast: 'ניגודיות גבוהה',
      links: 'הדגשת קישורים',
      motion: 'עצירת אנימציות',
      readable: 'גופן קריא',
      cursor: 'סמן רגיל',
      reset: 'איפוס ההתאמות',
      statement: 'הצהרת נגישות',
      close: 'סגירה',
      size: 'גודל הטקסט'
    },
    ru: {
      open: 'Меню доступности',
      title: 'Настройки доступности',
      bigger: 'Увеличить текст',
      smaller: 'Уменьшить текст',
      contrast: 'Высокая контрастность',
      links: 'Выделить ссылки',
      motion: 'Остановить анимации',
      readable: 'Читаемый шрифт',
      cursor: 'Обычный курсор',
      reset: 'Сбросить настройки',
      statement: 'Заявление о доступности',
      close: 'Закрыть',
      size: 'Размер текста'
    }
  }[LANG] || {};

  function t(key) { return T[key] || key; }

  var state = { size: 0, contrast: false, links: false, motion: false, readable: false, plainCursor: false };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      Object.keys(state).forEach(function (k) { if (k in saved) state[k] = saved[k]; });
    }
  } catch (err) { /* private mode */ }

  function apply() {
    root.style.setProperty('--a11y-scale', String(1 + state.size * 0.1));
    root.classList.toggle('a11y-contrast', state.contrast);
    root.classList.toggle('a11y-links', state.links);
    root.classList.toggle('a11y-motion', state.motion);
    root.classList.toggle('a11y-readable', state.readable);
    root.classList.toggle('no-fancy-cursor', state.plainCursor);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }

    var panel = document.getElementById('a11y-panel');
    if (!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll('[data-toggle]'), function (btn) {
      btn.setAttribute('aria-pressed', String(!!state[btn.getAttribute('data-toggle')]));
    });
    var label = document.getElementById('a11y-size');
    if (label) label.textContent = Math.round((1 + state.size * 0.1) * 100) + '%';
  }

  function build() {
    var statementHref = (root.getAttribute('data-base') || '') + (LANG === 'ru' ? 'ru/legal/accessibility/' : 'legal/accessibility/');

    var wrap = document.createElement('div');
    wrap.className = 'a11y';
    wrap.innerHTML =
      '<button class="a11y-open" id="a11y-open" type="button" aria-expanded="false" aria-controls="a11y-panel" aria-label="' + t('open') + '" title="' + t('open') + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<circle cx="12" cy="4.2" r="2.1" fill="currentColor"/>' +
          '<path d="M3.6 8.2c2.8.9 5.6 1.4 8.4 1.4s5.6-.5 8.4-1.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"/>' +
          '<path d="M12 9.6v4.2m0 0-3 7.2m3-7.2 3 7.2" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"/>' +
        '</svg>' +
      '</button>' +
      '<div class="a11y-panel" id="a11y-panel" role="dialog" aria-modal="false" aria-label="' + t('title') + '" hidden>' +
        '<div class="a11y-head"><h2>' + t('title') + '</h2>' +
          '<button class="a11y-close" id="a11y-close" type="button" aria-label="' + t('close') + '">&times;</button></div>' +
        '<div class="a11y-size-row">' +
          '<button class="a11y-btn" type="button" data-size="-1" aria-label="' + t('smaller') + '">A-</button>' +
          '<span id="a11y-size" role="status" aria-live="polite">100%</span>' +
          '<button class="a11y-btn" type="button" data-size="1" aria-label="' + t('bigger') + '">A+</button>' +
        '</div>' +
        '<button class="a11y-item" type="button" data-toggle="contrast" aria-pressed="false">' + t('contrast') + '</button>' +
        '<button class="a11y-item" type="button" data-toggle="links" aria-pressed="false">' + t('links') + '</button>' +
        '<button class="a11y-item" type="button" data-toggle="motion" aria-pressed="false">' + t('motion') + '</button>' +
        '<button class="a11y-item" type="button" data-toggle="readable" aria-pressed="false">' + t('readable') + '</button>' +
        '<button class="a11y-item" type="button" data-toggle="plainCursor" aria-pressed="false">' + t('cursor') + '</button>' +
        '<button class="a11y-item a11y-reset" type="button" id="a11y-reset">' + t('reset') + '</button>' +
        '<a class="a11y-statement" href="' + statementHref + '">' + t('statement') + '</a>' +
      '</div>';
    document.body.appendChild(wrap);

    var button = document.getElementById('a11y-open');
    var panel = document.getElementById('a11y-panel');

    var setOpen = function (open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('button, a').focus();
    };

    button.addEventListener('click', function () { setOpen(panel.hidden); });
    document.getElementById('a11y-close').addEventListener('click', function () { setOpen(false); button.focus(); });

    panel.addEventListener('click', function (event) {
      var size = event.target.closest('[data-size]');
      if (size) {
        state.size = Math.max(-1, Math.min(4, state.size + Number(size.getAttribute('data-size'))));
        apply();
        return;
      }
      var toggle = event.target.closest('[data-toggle]');
      if (toggle) {
        var key = toggle.getAttribute('data-toggle');
        state[key] = !state[key];
        apply();
        return;
      }
      if (event.target.closest('#a11y-reset')) {
        state = { size: 0, contrast: false, links: false, motion: false, readable: false, plainCursor: false };
        apply();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) { setOpen(false); button.focus(); }
    });

    document.addEventListener('click', function (event) {
      if (panel.hidden) return;
      if (!event.target.closest('.a11y')) setOpen(false);
    });
  }

  function init() { build(); apply(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
