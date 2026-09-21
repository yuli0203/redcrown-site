/* ============================================================================
   קרצמן נדל"ן — לוגיקת האתר / Kertsman Real Estate — site behaviour
   Renders the listings from data/listings.js in Hebrew or Russian, handles
   search, filtering, favourites, the property sheet and the lead forms.
   No build step, no framework, no external requests.
   ============================================================================ */
(function () {
  'use strict';

  var LANG = (document.documentElement.getAttribute('lang') || 'he').slice(0, 2);
  var BASE = document.documentElement.getAttribute('data-base') || '';
  var CFG = window.KERTSMAN_CONFIG || {};
  var LISTINGS = (window.KERTSMAN_LISTINGS || []).slice();

  /* ---------- copy ---------- */

  var T = {
    he: {
      sale: 'למכירה', rent: 'להשכרה', perMonth: 'לחודש',
      exclusive: 'בלעדי', fresh: 'חדש', underOffer: 'בתהליך', sold: 'נמכר',
      rooms: 'חדרים', sqm: 'מ"ר', floor: 'קומה', outOf: 'מתוך', parking: 'חניות',
      balcony: 'מרפסת', year: 'שנת בנייה', details: 'לפרטי הנכס', whatsapp: 'וואטסאפ',
      call: 'להתקשר', empty: 'לא נמצאו נכסים בסינון הזה',
      emptyNote: 'נסו להרחיב את החיפוש — או השאירו פרטים ונאתר עבורכם נכס שעוד לא פורסם.',
      save: 'שמירה למועדפים', results: 'נכסים', priceOnRequest: 'מחיר במשא ומתן',
      close: 'סגירה', about: 'על הנכס', features: 'מה יש בדירה',
      gallery: 'תמונה', sending: 'שולח…',
      formOk: 'תודה! נפתח עבורכם חלון וואטסאפ עם הפרטים. אם הוא לא נפתח — התקשרו אלינו ישירות.',
      formErr: 'נא למלא שם וטלפון כדי שנוכל לחזור אליכם.',
      askAbout: 'שלום סבטלנה, אני מתעניין/ת בנכס',
      leadSell: 'שלום סבטלנה, אשמח להערכת שווי לנכס שלי.',
      leadContact: 'שלום סבטלנה, אשמח לחזרה בנושא',
      name: 'שם', phone: 'טלפון', note: 'הערות'
    },
    ru: {
      sale: 'Продажа', rent: 'Аренда', perMonth: 'в месяц',
      exclusive: 'Эксклюзив', fresh: 'Новое', underOffer: 'В сделке', sold: 'Продано',
      rooms: 'комн.', sqm: 'м²', floor: 'Этаж', outOf: 'из', parking: 'Парковка',
      balcony: 'Балкон', year: 'Год постройки', details: 'Подробнее', whatsapp: 'WhatsApp',
      call: 'Позвонить', empty: 'По этому фильтру объектов не найдено',
      emptyNote: 'Расширьте поиск — или оставьте контакты, и мы подберём объект, который ещё не опубликован.',
      save: 'В избранное', results: 'объектов', priceOnRequest: 'Цена по договорённости',
      close: 'Закрыть', about: 'Об объекте', features: 'Что есть в квартире',
      gallery: 'Фото', sending: 'Отправляем…',
      formOk: 'Спасибо! Мы открыли WhatsApp с вашими данными. Если окно не открылось — позвоните нам напрямую.',
      formErr: 'Укажите имя и телефон, чтобы мы могли перезвонить.',
      askAbout: 'Здравствуйте, Светлана! Интересует объект',
      leadSell: 'Здравствуйте, Светлана! Хочу получить оценку стоимости моей квартиры.',
      leadContact: 'Здравствуйте, Светлана! Прошу связаться со мной по вопросу',
      name: 'Имя', phone: 'Телефон', note: 'Комментарий'
    }
  }[LANG] || {};

  function t(key) { return T[key] || key; }
  function loc(value) {
    if (value == null) return '';
    return typeof value === 'string' ? value : (value[LANG] || value.he || '');
  }

  /* ---------- icons ---------- */

  var I = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18M6 10V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3"/></svg>',
    area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v6H3M21 15h-6v6"/></svg>',
    stairs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h5v-4h5v-4h5V8h3"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14M6 17v2M18 17v2"/><path d="M4 13l1.6-4.5A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.9 1.5L20 13v4H4v-4Z"/><circle cx="7.5" cy="14.5" r=".8" fill="currentColor"/><circle cx="16.5" cy="14.5" r=".8" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20Z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.1a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1Zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.2-.5s0-.4-.1-.5l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.6 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z"/></svg>'
  };

  /* ---------- helpers ---------- */

  var money = new Intl.NumberFormat(LANG === 'ru' ? 'ru-RU' : 'he-IL', {
    style: 'currency', currency: 'ILS', maximumFractionDigits: 0
  });

  function price(item) {
    if (!item.price) return t('priceOnRequest');
    return money.format(item.price);
  }

  function waLink(text) {
    var num = (CFG.phoneIntl || '').replace(/\D/g, '');
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  }

  function telLink() { return 'tel:+' + (CFG.phoneIntl || '').replace(/\D/g, ''); }

  function el(html) {
    var box = document.createElement('div');
    box.innerHTML = html.trim();
    return box.firstElementChild;
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function byId(id) { return document.getElementById(id); }

  /* ---------- favourites (per browser, optional) ---------- */

  var FAV_KEY = 'kertsman:favourites';
  var favourites = [];
  try {
    favourites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    if (!Array.isArray(favourites)) favourites = [];
  } catch (err) { favourites = []; }

  function isFav(id) { return favourites.indexOf(id) > -1; }
  function toggleFav(id) {
    var at = favourites.indexOf(id);
    if (at > -1) favourites.splice(at, 1); else favourites.push(id);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favourites)); } catch (err) { /* private mode */ }
  }

  /* ---------- config binding ---------- */

  function bindConfig() {
    var agent = loc(CFG.agent);
    var map = {
      agent: agent,
      role: loc(CFG.role),
      phone: CFG.phone || '',
      email: CFG.email || '',
      address: loc(CFG.address),
      hours: loc(CFG.hours),
      licence: CFG.licence || '',
      officeCity: loc(CFG.officeCity),
      initials: agent.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2)
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-cfg]'), function (node) {
      var key = node.getAttribute('data-cfg');
      if (map[key] != null) node.textContent = map[key];
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-link]'), function (node) {
      var kind = node.getAttribute('data-link');
      if (kind === 'tel') node.href = telLink();
      else if (kind === 'mail') node.href = 'mailto:' + (CFG.email || '');
      else if (kind === 'wa') node.href = waLink(node.getAttribute('data-wa-text') || t('leadContact'));
    });
    var year = byId('year');
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------- cards ---------- */

  function statusTags(item) {
    var tags = [];
    if (item.exclusive) tags.push('<span class="tag tag-exclusive">' + esc(t('exclusive')) + '</span>');
    if (item.fresh && item.status === 'available') tags.push('<span class="tag tag-fresh">' + esc(t('fresh')) + '</span>');
    if (item.status === 'under-offer') tags.push('<span class="tag tag-offer">' + esc(t('underOffer')) + '</span>');
    if (item.status === 'sold') tags.push('<span class="tag tag-sold">' + esc(t('sold')) + '</span>');
    return tags.join('');
  }

  function cardHtml(item) {
    var img = BASE + (item.images && item.images[0] ? item.images[0] : 'assets/img/skyline.svg');
    var per = item.deal === 'rent' ? ' <span class="per">' + esc(t('perMonth')) + '</span>' : '';
    return '' +
      '<article class="card reveal' + (item.status === 'sold' ? ' is-sold' : '') + '" data-id="' + esc(item.id) + '">' +
        '<div class="card-media">' +
          '<img src="' + esc(img) + '" alt="' + esc(loc(item.title)) + '" loading="lazy" width="1600" height="1067">' +
          '<div class="card-tags">' + statusTags(item) + '</div>' +
          '<button class="fav" type="button" data-fav="' + esc(item.id) + '" aria-pressed="' + (isFav(item.id) ? 'true' : 'false') + '" aria-label="' + esc(t('save')) + '">' + I.heart + '</button>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-price">' +
            '<strong>' + esc(price(item)) + '</strong>' + per +
            '<span class="card-deal">' + esc(t(item.deal === 'rent' ? 'rent' : 'sale')) + '</span>' +
          '</div>' +
          '<h3>' + esc(loc(item.title)) + '</h3>' +
          '<p class="card-where">' + I.pin + '<span>' + esc(loc(item.area)) + ', ' + esc(loc(item.city)) + '</span></p>' +
          '<div class="specs">' +
            '<span>' + I.bed + item.rooms + ' ' + esc(t('rooms')) + '</span>' +
            '<span>' + I.area + item.size + ' ' + esc(t('sqm')) + '</span>' +
            '<span>' + I.stairs + esc(t('floor')) + ' ' + item.floor + '</span>' +
            (item.parking ? '<span>' + I.car + item.parking + '</span>' : '') +
          '</div>' +
          '<div class="card-actions">' +
            '<button class="btn btn-primary btn-sm" type="button" data-open="' + esc(item.id) + '">' + esc(t('details')) + '</button>' +
            '<a class="btn btn-wa btn-sm" href="' + esc(waLink(t('askAbout') + ' "' + loc(item.title) + '" (' + item.id + ')')) + '" target="_blank" rel="noopener">' + I.wa + esc(t('whatsapp')) + '</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* ---------- filtering ---------- */

  var state = { deal: 'all', city: '', rooms: '', budget: '', sort: 'featured' };

  function matches(item) {
    if (state.deal === 'sale' && item.deal !== 'sale') return false;
    if (state.deal === 'rent' && item.deal !== 'rent') return false;
    if (state.deal === 'exclusive' && !item.exclusive) return false;
    if (state.deal === 'fav' && !isFav(item.id)) return false;
    if (state.city && loc(item.city) !== state.city) return false;
    if (state.rooms && item.rooms < parseFloat(state.rooms)) return false;
    if (state.budget && item.price > parseFloat(state.budget)) return false;
    return true;
  }

  function sorted(list) {
    var out = list.slice();
    if (state.sort === 'price-asc') out.sort(function (a, b) { return a.price - b.price; });
    else if (state.sort === 'price-desc') out.sort(function (a, b) { return b.price - a.price; });
    else if (state.sort === 'size-desc') out.sort(function (a, b) { return b.size - a.size; });
    else out.sort(function (a, b) {
      var rank = function (x) { return (x.status === 'sold' ? 2 : 0) + (x.exclusive ? -1 : 0); };
      return rank(a) - rank(b);
    });
    return out;
  }

  function render() {
    var grid = byId('grid');
    if (!grid) return;
    var list = sorted(LISTINGS.filter(matches));
    grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="empty"><strong>' + esc(t('empty')) + '</strong><p>' + esc(t('emptyNote')) + '</p></div>';

    var count = byId('result-count');
    if (count) count.textContent = list.length + ' ' + t('results');

    Array.prototype.forEach.call(grid.querySelectorAll('.reveal'), function (node, i) {
      node.style.transitionDelay = Math.min(i, 5) * 60 + 'ms';
      watch(node);
    });
    updateChipCounts();
  }

  function updateChipCounts() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-deal]'), function (chip) {
      var kind = chip.getAttribute('data-deal');
      var n = LISTINGS.filter(function (item) {
        if (kind === 'all') return true;
        if (kind === 'exclusive') return item.exclusive;
        if (kind === 'fav') return isFav(item.id);
        return item.deal === kind;
      }).length;
      var badge = chip.querySelector('.chip-count');
      if (badge) badge.textContent = n;
      chip.setAttribute('aria-pressed', String(kind === state.deal));
    });
  }

  /* ---------- property sheet ---------- */

  var sheet = byId('sheet');
  var galleryIndex = 0;
  var current = null;

  function specRow(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function openSheet(id) {
    current = LISTINGS.filter(function (x) { return x.id === id; })[0];
    if (!current || !sheet) return;
    galleryIndex = 0;
    var item = current;
    var images = (item.images || []).map(function (src) { return BASE + src; });
    var per = item.deal === 'rent' ? '<p class="price-note">' + esc(t('perMonth')) + '</p>' : '';
    var agent = loc(CFG.agent);
    var initials = agent.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2);

    sheet.innerHTML = '' +
      '<button class="sheet-close" type="button" data-close aria-label="' + esc(t('close')) + '">&times;</button>' +
      '<div class="sheet-scroll">' +
        '<div class="gallery">' +
          '<div class="gallery-main"><img id="gallery-img" src="' + esc(images[0] || '') + '" alt="' + esc(loc(item.title)) + '" width="1600" height="900"></div>' +
          (images.length > 1 ? '<div class="thumbs">' + images.map(function (src, i) {
            return '<button type="button" data-thumb="' + i + '" aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="' + esc(t('gallery') + ' ' + (i + 1)) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>';
          }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="sheet-body">' +
          '<div>' +
            '<div class="sheet-tags">' + statusTags(item) + '<span class="tag">' + esc(t(item.deal === 'rent' ? 'rent' : 'sale')) + '</span></div>' +
            '<h2>' + esc(loc(item.title)) + '</h2>' +
            '<p class="sheet-where">' + I.pin + '<span>' + esc(loc(item.area)) + ', ' + esc(loc(item.city)) + '</span></p>' +
            '<p class="sheet-desc">' + esc(loc(item.description)) + '</p>' +
            '<dl class="spec-grid">' +
              specRow(t('rooms'), item.rooms) +
              specRow(t('sqm'), item.size) +
              specRow(t('floor'), item.floor + ' ' + t('outOf') + ' ' + item.floors) +
              (item.balcony ? specRow(t('balcony'), item.balcony + ' ' + t('sqm')) : '') +
              (item.parking ? specRow(t('parking'), item.parking) : '') +
              (item.year ? specRow(t('year'), item.year) : '') +
            '</dl>' +
            ((item.features || []).length
              ? '<h3 style="margin-block-start:30px;font-size:21px">' + esc(t('features')) + '</h3>' +
                '<ul class="feature-list">' + item.features.map(function (f) {
                  return '<li>' + I.check + '<span>' + esc(loc(f)) + '</span></li>';
                }).join('') + '</ul>'
              : '') +
          '</div>' +
          '<aside class="agent-card">' +
            '<p class="price">' + esc(price(item)) + '</p>' + per +
            '<hr>' +
            '<div class="who"><span class="who-mark">' + esc(initials) + '</span>' +
              '<span><b>' + esc(agent) + '</b><span>' + esc(loc(CFG.role)) + '</span></span></div>' +
            '<div class="stack">' +
              '<a class="btn btn-brass" href="' + esc(waLink(t('askAbout') + ' "' + loc(item.title) + '" (' + item.id + ')')) + '" target="_blank" rel="noopener">' + I.wa + esc(t('whatsapp')) + '</a>' +
              '<a class="btn btn-ghost" href="' + esc(telLink()) + '">' + esc(t('call')) + ' ' + esc(CFG.phone || '') + '</a>' +
            '</div>' +
          '</aside>' +
        '</div>' +
      '</div>';

    if (typeof sheet.showModal === 'function') sheet.showModal();
    else sheet.setAttribute('open', '');
    document.body.classList.add('is-locked');
  }

  function closeSheet() {
    if (!sheet) return;
    if (typeof sheet.close === 'function' && sheet.open) sheet.close();
    else sheet.removeAttribute('open');
    document.body.classList.remove('is-locked');
  }

  function showImage(index) {
    if (!current) return;
    var images = (current.images || []).map(function (src) { return BASE + src; });
    if (!images[index]) return;
    galleryIndex = index;
    var img = byId('gallery-img');
    if (img) img.src = images[index];
    Array.prototype.forEach.call(sheet.querySelectorAll('[data-thumb]'), function (btn) {
      btn.setAttribute('aria-current', String(Number(btn.getAttribute('data-thumb')) === index));
    });
  }

  /* ---------- lead forms ---------- */

  function handleForm(form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = form.querySelector('.form-status');
      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var phone = (data.get('phone') || '').toString().trim();

      if (!name || !phone) {
        if (status) { status.textContent = t('formErr'); status.setAttribute('data-state', 'err'); }
        var firstEmpty = !name ? form.querySelector('[name="name"]') : form.querySelector('[name="phone"]');
        if (firstEmpty) firstEmpty.focus();
        return;
      }

      var intro = form.getAttribute('data-intro') === 'sell' ? t('leadSell') : t('leadContact');
      var lines = [intro, '', t('name') + ': ' + name, t('phone') + ': ' + phone];
      ['address', 'deal', 'rooms', 'message'].forEach(function (key) {
        var value = (data.get(key) || '').toString().trim();
        if (!value) return;
        var label = form.querySelector('[name="' + key + '"]');
        var text = label && label.labels && label.labels[0] ? label.labels[0].textContent : key;
        lines.push(text + ': ' + value);
      });

      if (status) { status.textContent = t('sending'); status.removeAttribute('data-state'); }
      window.open(waLink(lines.join('\n')), '_blank', 'noopener');
      if (status) { status.textContent = t('formOk'); status.setAttribute('data-state', 'ok'); }
      form.reset();
    });
  }

  /* ---------- reveal on scroll ---------- */

  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  }
  function watch(node) {
    if (observer) observer.observe(node);
    else node.classList.add('is-in');
  }

  /* ---------- wiring ---------- */

  function init() {
    bindConfig();

    // city options come from the data, so a new city needs no markup change
    var citySelect = byId('f-city');
    if (citySelect) {
      var cities = [];
      LISTINGS.forEach(function (item) {
        var name = loc(item.city);
        if (name && cities.indexOf(name) === -1) cities.push(name);
      });
      cities.sort().forEach(function (name) {
        var option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        citySelect.appendChild(option);
      });
    }

    render();

    document.addEventListener('click', function (event) {
      var open = event.target.closest('[data-open]');
      if (open) { openSheet(open.getAttribute('data-open')); return; }

      var fav = event.target.closest('[data-fav]');
      if (fav) {
        var id = fav.getAttribute('data-fav');
        toggleFav(id);
        fav.setAttribute('aria-pressed', String(isFav(id)));
        if (state.deal === 'fav') render(); else updateChipCounts();
        return;
      }

      var chip = event.target.closest('[data-deal]');
      if (chip) { state.deal = chip.getAttribute('data-deal'); render(); return; }

      var thumb = event.target.closest('[data-thumb]');
      if (thumb) { showImage(Number(thumb.getAttribute('data-thumb'))); return; }

      if (event.target.closest('[data-close]')) { closeSheet(); return; }

      var navLink = event.target.closest('.nav a');
      if (navLink) document.body.classList.remove('nav-open');
    });

    if (sheet) {
      sheet.addEventListener('click', function (event) {
        if (event.target === sheet) closeSheet();      // click on the backdrop
      });
      sheet.addEventListener('close', function () { document.body.classList.remove('is-locked'); });
      sheet.addEventListener('keydown', function (event) {
        if (!current || (current.images || []).length < 2) return;
        var total = current.images.length;
        if (event.key === 'ArrowRight') showImage((galleryIndex + 1) % total);
        if (event.key === 'ArrowLeft') showImage((galleryIndex - 1 + total) % total);
      });
    }

    var search = byId('search');
    if (search) {
      search.addEventListener('submit', function (event) {
        event.preventDefault();
        state.deal = (byId('f-deal') || {}).value || 'all';
        state.city = (byId('f-city') || {}).value || '';
        state.rooms = (byId('f-rooms') || {}).value || '';
        state.budget = (byId('f-budget') || {}).value || '';
        render();
        var target = byId('properties');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    var sort = byId('f-sort');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; render(); });

    var burger = byId('burger');
    if (burger) burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') document.body.classList.remove('nav-open');
    });

    var topbar = document.querySelector('.topbar');
    if (topbar) {
      var onScroll = function () { topbar.classList.toggle('is-stuck', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    Array.prototype.forEach.call(document.querySelectorAll('form[data-lead]'), handleForm);
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), watch);

    // Listings as structured data, so search engines can read the catalogue.
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: LISTINGS.filter(function (x) { return x.status !== 'sold'; }).map(function (item, i) {
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Apartment',
            name: loc(item.title),
            numberOfRoomsTotal: item.rooms,
            floorSize: { '@type': 'QuantitativeValue', value: item.size, unitCode: 'MTK' },
            address: { '@type': 'PostalAddress', addressLocality: loc(item.city), addressRegion: loc(item.area), addressCountry: 'IL' },
            offers: { '@type': 'Offer', price: item.price, priceCurrency: 'ILS', availability: 'https://schema.org/InStock' }
          }
        };
      })
    });
    document.head.appendChild(ld);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
