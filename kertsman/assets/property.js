/* ============================================================================
   דף דירה בודדת / single apartment page
   ----------------------------------------------------------------------------
   כתובת ייחודית לכל דירה, למשל dira/?id=ahuza-4, כדי שאפשר יהיה להפנות אליה
   מודעת גוגל, לשתף אותה בוואטסאפ ושגוגל יאנדקס אותה בנפרד.

   A unique URL per apartment, for example dira/?id=ahuza-4, so a Google ad can
   point at one apartment, the link can be shared, and search engines can index
   each apartment on its own.
   ============================================================================ */
(function () {
  'use strict';

  var LANG = (document.documentElement.getAttribute('lang') || 'he').slice(0, 2);
  var BASE = document.documentElement.getAttribute('data-base') || '../';
  var CFG = window.KERTSMAN_CONFIG || {};
  var LISTINGS = window.KERTSMAN_LISTINGS || [];

  var T = {
    he: {
      forSale: 'למכירה', exclusive: 'בלעדי', fresh: 'חדש', underOffer: 'בתהליך', sold: 'נמכר',
      rooms: 'חדרים', sqm: 'מ"ר', floor: 'קומה', outOf: 'מתוך', parking: 'חניות',
      balcony: 'מרפסת', year: 'שנת בנייה', features: 'מה יש בדירה', gallery: 'תמונה',
      prevShot: 'התמונה הקודמת', nextShot: 'התמונה הבאה',
      whatsapp: 'שליחת הודעה בוואטסאפ', call: 'להתקשר', back: 'לכל הדירות',
      missing: 'הדירה הזו כבר לא מפורסמת', missingNote: 'ייתכן שהיא נמכרה או ירדה מהאתר. אפשר לראות את הדירות שמוצגות כרגע.',
      askAbout: 'שלום, אני מתעניין/ת בדירה', crumbHome: 'דף הבית', crumbList: 'דירות למכירה',
      metaTail: ' | קרצמן נדל״ן', priceOnRequest: 'מחיר במשא ומתן',
      shareTitle: 'שיתוף הדירה', copy: 'העתקת הקישור', copied: 'הקישור הועתק'
    },
    ru: {
      forSale: 'Продажа', exclusive: 'Эксклюзив', fresh: 'Новое', underOffer: 'В сделке', sold: 'Продано',
      rooms: 'комн.', sqm: 'м²', floor: 'Этаж', outOf: 'из', parking: 'Парковка',
      balcony: 'Балкон', year: 'Год постройки', features: 'Что есть в квартире', gallery: 'Фото',
      prevShot: 'Предыдущее фото', nextShot: 'Следующее фото',
      whatsapp: 'Написать в WhatsApp', call: 'Позвонить', back: 'Все квартиры',
      missing: 'Эта квартира больше не публикуется', missingNote: 'Возможно, она продана или снята с публикации. Посмотрите квартиры, которые есть сейчас.',
      askAbout: 'Здравствуйте! Интересует квартира', crumbHome: 'Главная', crumbList: 'Квартиры на продажу',
      metaTail: ' | Керцман недвижимость', priceOnRequest: 'Цена по договорённости',
      shareTitle: 'Поделиться', copy: 'Скопировать ссылку', copied: 'Ссылка скопирована'
    }
  }[LANG] || {};

  function t(key) { return T[key] || key; }
  function loc(value) {
    if (value == null) return '';
    return typeof value === 'string' ? value : (value[LANG] || value.he || '');
  }
  function byId(id) { return document.getElementById(id); }
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var money = new Intl.NumberFormat(LANG === 'ru' ? 'ru-RU' : 'he-IL', {
    style: 'currency', currency: 'ILS', maximumFractionDigits: 0
  });

  function waLink(text) {
    return 'https://wa.me/' + (CFG.phoneIntl || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }

  var I = {
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.1a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1Zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.2-.5s0-.4-.1-.5l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.6 2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3Z"/></svg>'
  };

  function param(name) {
    var match = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  }

  function statusTags(item) {
    var tags = ['<span class="tag">' + esc(t('forSale')) + '</span>'];
    if (item.exclusive) tags.push('<span class="tag tag-exclusive">' + esc(t('exclusive')) + '</span>');
    if (item.fresh && item.status === 'available') tags.push('<span class="tag tag-fresh">' + esc(t('fresh')) + '</span>');
    if (item.status === 'under-offer') tags.push('<span class="tag tag-offer">' + esc(t('underOffer')) + '</span>');
    if (item.status === 'sold') tags.push('<span class="tag tag-sold">' + esc(t('sold')) + '</span>');
    return tags.join('');
  }

  function specRow(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  /* כותרות ותגיות שיתוף נכתבות לפי הדירה, כדי שמודעת גוגל ושיתוף בוואטסאפ
     יציגו את הדירה הספציפית ולא את האתר הכללי.
     Title and sharing tags are written per apartment, so a Google ad and a
     WhatsApp share show this apartment rather than the site in general. */
  function setMeta(item) {
    var where = loc(item.area) + ', ' + loc(item.city);
    var title = loc(item.title) + ' | ' + where;
    var description = item.rooms + ' ' + t('rooms') + ', ' + item.size + ' ' + t('sqm') + ', ' +
      where + '. ' + (loc(item.description) || '').slice(0, 130);

    document.title = title + t('metaTail');
    var set = function (selector, attr, value) {
      var node = document.querySelector(selector);
      if (node) node.setAttribute(attr, value);
    };
    set('meta[name="description"]', 'content', description);
    set('meta[property="og:title"]', 'content', title);
    set('meta[property="og:description"]', 'content', description);
    set('meta[property="og:url"]', 'content', window.location.href.split('#')[0]);
    set('link[rel="canonical"]', 'href', window.location.href.split('#')[0]);
    var image = item.images && item.images[0] ? item.images[0] : 'assets/img/hero-haifa.jpg';
    if (/^https?:/.test(image) === false) {
      image = window.location.origin + '/' + image.replace(/^\/+/, '');
    }
    set('meta[property="og:image"]', 'content', image);

    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Apartment',
      name: loc(item.title),
      description: loc(item.description),
      numberOfRoomsTotal: item.rooms,
      floorSize: { '@type': 'QuantitativeValue', value: item.size, unitCode: 'MTK' },
      address: {
        '@type': 'PostalAddress',
        addressLocality: loc(item.city),
        addressRegion: loc(item.area),
        addressCountry: 'IL'
      },
      offers: {
        '@type': 'Offer',
        price: item.price,
        priceCurrency: 'ILS',
        availability: item.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        seller: { '@type': 'RealEstateAgent', name: loc(CFG.agent), telephone: CFG.phone }
      }
    });
    document.head.appendChild(ld);
  }

  function render(item) {
    var images = (item.images || []).map(function (src) { return BASE + src; });
    var where = loc(item.area) + ', ' + loc(item.city);
    var ask = t('askAbout') + ' "' + loc(item.title) + '" (' + item.id + ')';

    byId('crumb-current').textContent = loc(item.title);

    byId('property').innerHTML = '' +
      '<div class="prop-head">' +
        '<div class="sheet-tags">' + statusTags(item) + '</div>' +
        '<h1>' + esc(loc(item.title)) + '</h1>' +
        '<p class="sheet-where">' + I.pin + '<span>' + esc(where) + '</span></p>' +
      '</div>' +
      '<div class="prop-gallery">' +
        '<div class="gallery-main"><img id="gallery-img" src="' + esc(images[0] || '') + '" alt="' + esc(loc(item.title)) + '" width="1600" height="900" fetchpriority="high"></div>' +
        (images.length > 1
          ? '<button class="gal-nav gal-prev" type="button" data-gal="-1" aria-label="' + esc(t('prevShot')) + '">' + I.chev + '</button>' +
            '<button class="gal-nav gal-next" type="button" data-gal="1" aria-label="' + esc(t('nextShot')) + '">' + I.chev + '</button>'
          : '') +
        (images.length > 1 ? '<div class="thumbs">' + images.map(function (src, i) {
          return '<button type="button" data-thumb="' + i + '" aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="' + esc(t('gallery') + ' ' + (i + 1)) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>';
        }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="prop-body">' +
        '<div>' +
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
            ? '<h2 class="sheet-sub">' + esc(t('features')) + '</h2>' +
              '<ul class="feature-list">' + item.features.map(function (f) {
                return '<li>' + I.check + '<span>' + esc(loc(f)) + '</span></li>';
              }).join('') + '</ul>'
            : '') +
        '</div>' +
        '<aside class="agent-card">' +
          '<p class="price">' + esc(item.price ? money.format(item.price) : t('priceOnRequest')) + '</p>' +
          '<hr>' +
          '<div class="stack">' +
            '<a class="btn btn-gold" href="' + esc(waLink(ask)) + '" target="_blank" rel="noopener">' + I.wa + esc(t('whatsapp')) + '</a>' +
            '<a class="btn btn-ghost" href="tel:+' + esc((CFG.phoneIntl || '').replace(/\D/g, '')) + '">' + esc(t('call')) + ' ' + esc(CFG.phone || '') + '</a>' +
          '</div>' +
          '<hr>' +
          '<p class="share-title">' + esc(t('shareTitle')) + '</p>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="copy-link">' + esc(t('copy')) + '</button>' +
        '</aside>' +
      '</div>';

    setMeta(item);

    var gallery = byId('property');
    var shown = 0;

    var showImage = function (index) {
      if (!images[index]) return;
      shown = index;
      var img = byId('gallery-img');
      if (img) img.src = images[index];
      Array.prototype.forEach.call(gallery.querySelectorAll('[data-thumb]'), function (btn) {
        btn.setAttribute('aria-current', String(Number(btn.getAttribute('data-thumb')) === index));
      });
    };

    if (images.length > 1) {
      /* חצים במקלדת: ימין תמיד מתקדם קדימה בכיוון הקריאה של העמוד
         arrow keys: right always moves forward in the page's reading order */
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        var forward = (event.key === 'ArrowRight') === (document.documentElement.dir !== 'rtl');
        showImage((shown + (forward ? 1 : -1) + images.length) % images.length);
      });
    }

    gallery.addEventListener('click', function (event) {
      var thumb = event.target.closest('[data-thumb]');
      if (thumb) { showImage(Number(thumb.getAttribute('data-thumb'))); return; }

      var step = event.target.closest('[data-gal]');
      if (step && images.length > 1) {
        var delta = Number(step.getAttribute('data-gal'));
        showImage((shown + delta + images.length) % images.length);
        return;
      }
      var copy = event.target.closest('#copy-link');
      if (copy) {
        var url = window.location.href.split('#')[0];
        var done = function () { copy.textContent = t('copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
        else done();
      }
    });
  }

  function missing() {
    byId('crumb-current').textContent = t('missing');
    byId('property').innerHTML =
      '<div class="empty"><strong>' + esc(t('missing')) + '</strong>' +
      '<p>' + esc(t('missingNote')) + '</p>' +
      '<p style="margin-block-start:18px"><a class="btn btn-primary" href="' + BASE + '#properties">' + esc(t('back')) + '</a></p></div>';
  }

  /* מעבר שפה בעמוד דירה חייב לשמור על הדירה עצמה: אותו מזהה עובר לכתובת
     בשפה השנייה, כך שמי שמחליף שפה נשאר על אותה דירה ולא נזרק לדף הבית.
     גם תגיות hreflang מצביעות על אותה דירה בשתי השפות, לטובת גוגל.
     Switching language on an apartment page has to keep the apartment: the id
     travels to the other language's address, so the reader stays on the same
     flat instead of being dropped on the home page. The hreflang tags point
     at the same apartment in both languages too. */
  function linkLanguages(id) {
    var query = id ? '?id=' + encodeURIComponent(id) : '';
    var alt = byId('lang-alt');
    if (alt) alt.href = alt.getAttribute('href').split('?')[0] + query;

    var origin = window.location.origin;
    var pairs = { 'alt-he': '/dira/', 'alt-ru': '/ru/dira/' };
    Object.keys(pairs).forEach(function (nodeId) {
      var node = byId(nodeId);
      if (!node) return;
      var base = /^https?:/.test(node.getAttribute('href') || '')
        ? node.getAttribute('href').split('?')[0]
        : origin + pairs[nodeId];
      node.href = base + query;
    });
  }

  /* רשת ביטחון להחלפת שפה: אם הגענו בלי מזהה אבל הגענו מעמוד דירה אחר,
     לוקחים את המזהה מכתובת המקור. זה מציל מקרה שבו הדפדפן עדיין מריץ גרסה
     ישנה של הקובץ הזה בעמוד שממנו באנו, והקישור נבנה בלי המזהה.
     A safety net for the language switch: arriving without an id but from
     another apartment page, the id is taken from the referring address. That
     rescues the case where the page we came from still runs an older cached
     copy of this file and built the link without the id. */
  function idFromReferrer() {
    try {
      var ref = document.referrer || '';
      if (!/\/dira\//.test(ref)) return '';
      var found = /[?&]id=([^&#]+)/.exec(ref);
      return found ? decodeURIComponent(found[1]) : '';
    } catch (err) { return ''; }
  }

  function init() {
    var id = param('id');
    if (!id) {
      var rescued = idFromReferrer();
      if (rescued) {
        id = rescued;
        if (window.history && history.replaceState) {
          history.replaceState(null, '', '?id=' + encodeURIComponent(id));
        }
      }
    }
    var item = LISTINGS.filter(function (x) { return x.id === id; })[0];
    if (item) render(item); else missing();
    linkLanguages(item ? item.id : '');

    var year = byId('year');
    if (year) year.textContent = new Date().getFullYear();
    var credit = byId('year-credit');
    if (credit) credit.textContent = new Date().getFullYear();

    Array.prototype.forEach.call(document.querySelectorAll('[data-link]'), function (node) {
      var kind = node.getAttribute('data-link');
      if (kind === 'tel') node.href = 'tel:+' + (CFG.phoneIntl || '').replace(/\D/g, '');
      else if (kind === 'wa') node.href = waLink(node.getAttribute('data-wa-text') || '');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-cfg="phone"]'), function (node) {
      node.textContent = CFG.phone || '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
