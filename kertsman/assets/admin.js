/* ============================================================================
   מסך ניהול הדירות / Kertsman admin screen
   ----------------------------------------------------------------------------
   עורך עותק מקומי של רשימת הדירות ומייצר מחדש את data/listings.js להעלאה.
   האתר סטטי ואין בו שרת, ולכן אין כאן שמירה מרחוק: ההעלאה של הקובץ היא הפרסום.

   Edits a local copy of the listing catalogue and regenerates data/listings.js
   for upload. The site is static with no server, so uploading the produced file
   is what publishes the change.
   ============================================================================ */
(function () {
  'use strict';

  /* סיסמת הניהול נשמרת כ-hash, לא כטקסט גלוי. לשינוי הסיסמה ראו README.
     The admin password is stored as a hash rather than in the clear. */
  var PASS_HASH = '3b5b6a0a618d8fc8873cb12ab00a745c5f0b9ae91df975db717139665d8dc16c';
  var STORE_KEY = 'kertsman:admin:listings';
  var UNLOCK_KEY = 'kertsman:admin:unlocked';

  var PUBLISHED = JSON.parse(JSON.stringify(window.KERTSMAN_LISTINGS || []));
  var listings = load();
  var editingIndex = -1;

  function byId(id) { return document.getElementById(id); }

  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY) || localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) { /* private mode or cleared storage */ }
    return JSON.parse(JSON.stringify(PUBLISHED));
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(listings)); } catch (err) { /* ignore */ }
    markDirty();
  }

  function markDirty() {
    var dirty = JSON.stringify(listings) !== JSON.stringify(PUBLISHED);
    var banner = byId('dirty');
    if (banner) banner.hidden = !dirty;
  }

  /* ---------- the gate ---------- */

  function sha256(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', bytes).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function unlock() {
    byId('gate').hidden = true;
    byId('shell').hidden = false;
    render();
    markDirty();
  }

  function wireGate() {
    var form = byId('gate-form');
    var status = byId('gate-status');
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === '1') { unlock(); return; }
    } catch (err) { /* ignore */ }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = byId('gate-pass').value;
      if (!window.crypto || !crypto.subtle) {
        status.textContent = 'הדפדפן הזה לא תומך בבדיקת הסיסמה. נסו בדפדפן מעודכן.';
        return;
      }
      sha256(value).then(function (hash) {
        if (hash === PASS_HASH) {
          try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (err) { /* ignore */ }
          unlock();
        } else {
          status.textContent = 'סיסמה שגויה. נסו שוב.';
          byId('gate-pass').select();
        }
      });
    });
  }

  /* ---------- helpers ---------- */

  var money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

  function loc(value, lang) {
    if (value == null) return '';
    return typeof value === 'string' ? value : (value[lang] || value.he || '');
  }

  var STATUS_LABEL = { available: 'למכירה', 'under-offer': 'בתהליך', sold: 'נמכרה' };

  function blank() {
    return {
      id: '', status: 'available', exclusive: false, fresh: true,
      price: 0, rooms: 3, size: 80, balcony: 0, floor: 1, floors: 1, parking: 0, year: '',
      city: { he: 'חיפה', ru: 'Хайфа' }, area: { he: '', ru: '' },
      title: { he: '', ru: '' }, description: { he: '', ru: '' },
      features: [], images: []
    };
  }

  /* ---------- the list ---------- */

  function render() {
    var rows = byId('rows');
    rows.innerHTML = '';
    listings.forEach(function (item, index) {
      var li = document.createElement('li');
      li.className = 'row' + (item.status === 'sold' ? ' is-sold' : '');
      li.innerHTML =
        '<span class="row-thumb"><img src="' + ('../' + (item.images && item.images[0] ? item.images[0] : 'assets/img/skyline.svg')) + '" alt=""></span>' +
        '<span class="row-main">' +
          '<b>' + (loc(item.title, 'he') || 'דירה בלי כותרת') + '</b>' +
          '<span class="row-meta">' +
            (loc(item.area, 'he') || '') + ', ' + (loc(item.city, 'he') || '') + ' · ' +
            (item.rooms || '?') + ' חדרים · ' + (item.size || '?') + ' מ״ר · ' +
            (item.price ? money.format(item.price) : 'בלי מחיר') +
          '</span>' +
        '</span>' +
        '<span class="row-tags">' +
          '<span class="tag' + (item.status === 'sold' ? ' tag-sold' : (item.status === 'under-offer' ? ' tag-offer' : '')) + '">' + (STATUS_LABEL[item.status] || item.status) + '</span>' +
          (item.exclusive ? '<span class="tag tag-exclusive">בלעדי</span>' : '') +
        '</span>' +
        '<span class="row-buttons">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-edit="' + index + '">עריכה</button>' +
          '<button class="icon-btn" type="button" data-up="' + index + '" aria-label="העלאה למעלה"' + (index === 0 ? ' disabled' : '') + '>&#8593;</button>' +
          '<button class="icon-btn" type="button" data-down="' + index + '" aria-label="הורדה למטה"' + (index === listings.length - 1 ? ' disabled' : '') + '>&#8595;</button>' +
        '</span>';
      rows.appendChild(li);
    });

    if (!listings.length) {
      rows.innerHTML = '<li class="row row-empty">אין דירות ברשימה. לחצו על "הוספת דירה" כדי להתחיל.</li>';
    }
    byId('count').textContent = listings.length + ' דירות';
  }

  /* ---------- the editor ---------- */

  function openEditor(index) {
    editingIndex = index;
    var item = index === -1 ? blank() : listings[index];
    byId('editor-title').textContent = index === -1 ? 'דירה חדשה' : 'עריכת דירה';
    byId('delete').hidden = index === -1;
    byId('editor-status').textContent = '';

    byId('f-id').value = item.id || '';
    byId('f-price').value = item.price || '';
    byId('f-rooms').value = item.rooms || '';
    byId('f-size').value = item.size || '';
    byId('f-balcony').value = item.balcony || '';
    byId('f-floor').value = item.floor || '';
    byId('f-floors').value = item.floors || '';
    byId('f-parking').value = item.parking || '';
    byId('f-year').value = item.year || '';
    byId('f-status').value = item.status || 'available';
    byId('f-exclusive').checked = !!item.exclusive;
    byId('f-fresh').checked = !!item.fresh;

    byId('f-city-he').value = loc(item.city, 'he');
    byId('f-city-ru').value = (item.city && item.city.ru) || '';
    byId('f-area-he').value = loc(item.area, 'he');
    byId('f-area-ru').value = (item.area && item.area.ru) || '';
    byId('f-title-he').value = loc(item.title, 'he');
    byId('f-title-ru').value = (item.title && item.title.ru) || '';
    byId('f-desc-he').value = loc(item.description, 'he');
    byId('f-desc-ru').value = (item.description && item.description.ru) || '';
    byId('f-features-he').value = (item.features || []).map(function (f) { return loc(f, 'he'); }).join('\n');
    byId('f-features-ru').value = (item.features || []).map(function (f) { return (f && f.ru) || ''; }).join('\n');
    byId('f-images').value = (item.images || []).join('\n');

    byId('editor').hidden = false;
    byId('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    byId('f-title-he').focus();
  }

  function lines(value) {
    return value.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
  }

  function collect() {
    var featuresHe = lines(byId('f-features-he').value);
    var featuresRu = lines(byId('f-features-ru').value);
    var num = function (id) {
      var raw = byId(id).value;
      return raw === '' ? 0 : Number(raw);
    };
    return {
      id: byId('f-id').value.trim(),
      status: byId('f-status').value,
      exclusive: byId('f-exclusive').checked,
      fresh: byId('f-fresh').checked,
      price: num('f-price'),
      rooms: num('f-rooms'),
      size: num('f-size'),
      balcony: num('f-balcony'),
      floor: num('f-floor'),
      floors: num('f-floors'),
      parking: num('f-parking'),
      year: byId('f-year').value ? Number(byId('f-year').value) : '',
      city: { he: byId('f-city-he').value.trim(), ru: byId('f-city-ru').value.trim() || byId('f-city-he').value.trim() },
      area: { he: byId('f-area-he').value.trim(), ru: byId('f-area-ru').value.trim() || byId('f-area-he').value.trim() },
      title: { he: byId('f-title-he').value.trim(), ru: byId('f-title-ru').value.trim() || byId('f-title-he').value.trim() },
      description: { he: byId('f-desc-he').value.trim(), ru: byId('f-desc-ru').value.trim() || byId('f-desc-he').value.trim() },
      features: featuresHe.map(function (he, i) { return { he: he, ru: featuresRu[i] || he }; }),
      images: lines(byId('f-images').value)
    };
  }

  function slug(text) {
    return (text || 'dira').toString().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'dira';
  }

  function wireEditor() {
    byId('add').addEventListener('click', function () { openEditor(-1); });
    byId('close-editor').addEventListener('click', function () { byId('editor').hidden = true; });

    byId('editor').addEventListener('submit', function (event) {
      event.preventDefault();
      var item = collect();
      var status = byId('editor-status');

      var problem = '';
      if (!item.title.he) problem = 'צריך למלא כותרת בעברית.';
      else if (!item.area.he) problem = 'צריך למלא שכונה בעברית.';
      else if (!item.city.he) problem = 'צריך למלא עיר בעברית.';
      else if (!item.price) problem = 'צריך למלא מחיר.';
      else if (!item.rooms) problem = 'צריך למלא מספר חדרים.';
      else if (!item.size) problem = 'צריך למלא שטח במ״ר.';
      if (problem) {
        status.textContent = problem;
        status.setAttribute('data-state', 'err');
        return;
      }
      if (!item.id) item.id = slug(item.area.he) + '-' + (item.rooms || 'x') + '-' + Date.now().toString().slice(-4);

      var clash = listings.some(function (other, i) { return other.id === item.id && i !== editingIndex; });
      if (clash) { status.textContent = 'המזהה הזה כבר קיים בדירה אחרת. בחרו מזהה אחר.'; status.setAttribute('data-state', 'err'); return; }

      if (!item.images.length) item.images = ['assets/img/skyline.svg'];

      if (editingIndex === -1) listings.unshift(item);
      else listings[editingIndex] = item;

      save();
      render();
      byId('editor').hidden = true;
    });

    byId('delete').addEventListener('click', function () {
      if (editingIndex === -1) return;
      var name = loc(listings[editingIndex].title, 'he') || 'הדירה';
      if (!window.confirm('למחוק את ' + name + ' מהאתר?')) return;
      listings.splice(editingIndex, 1);
      save();
      render();
      byId('editor').hidden = true;
    });

    byId('rows').addEventListener('click', function (event) {
      var edit = event.target.closest('[data-edit]');
      if (edit) { openEditor(Number(edit.getAttribute('data-edit'))); return; }

      var up = event.target.closest('[data-up]');
      if (up) { move(Number(up.getAttribute('data-up')), -1); return; }

      var down = event.target.closest('[data-down]');
      if (down) { move(Number(down.getAttribute('data-down')), 1); }
    });
  }

  function move(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= listings.length) return;
    var item = listings.splice(index, 1)[0];
    listings.splice(target, 0, item);
    save();
    render();
  }

  /* ---------- producing data/listings.js ---------- */

  // U+2028/U+2029 are legal in JSON strings but illegal in JS source, so they
  // are stripped from the generated file.
  var JS_UNSAFE = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  function js(value) {
    return JSON.stringify(value).replace(JS_UNSAFE, '');
  }

  function pair(value) {
    return '{ he: ' + js(value.he || '') + ', ru: ' + js(value.ru || value.he || '') + ' }';
  }

  function serialise() {
    var config = window.KERTSMAN_CONFIG || {};
    var out = [];
    out.push('/* ============================================================================');
    out.push('   קרצמן נדל"ן — קובץ הנכסים / Kertsman Real Estate — property data');
    out.push('   הקובץ הזה נוצר במסך הניהול של האתר. אפשר גם לערוך אותו ידנית.');
    out.push('   Generated by the site admin screen. It can also be edited by hand.');
    out.push('   נוצר בתאריך ' + new Date().toLocaleDateString('he-IL'));
    out.push('   ============================================================================ */');
    out.push('');
    out.push('window.KERTSMAN_CONFIG = ' + JSON.stringify(config, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:') + ';');
    out.push('');
    out.push('window.KERTSMAN_LISTINGS = [');
    listings.forEach(function (item, index) {
      out.push('  {');
      out.push('    id: ' + js(item.id) + ',');
      out.push('    status: ' + js(item.status) + ',');
      out.push('    exclusive: ' + (item.exclusive ? 'true' : 'false') + ',');
      out.push('    fresh: ' + (item.fresh ? 'true' : 'false') + ',');
      out.push('    price: ' + (item.price || 0) + ',');
      out.push('    rooms: ' + (item.rooms || 0) + ',');
      out.push('    size: ' + (item.size || 0) + ',');
      if (item.balcony) out.push('    balcony: ' + item.balcony + ',');
      out.push('    floor: ' + (item.floor || 0) + ',');
      out.push('    floors: ' + (item.floors || 0) + ',');
      out.push('    parking: ' + (item.parking || 0) + ',');
      if (item.year) out.push('    year: ' + item.year + ',');
      out.push('    city: ' + pair(item.city) + ',');
      out.push('    area: ' + pair(item.area) + ',');
      out.push('    title: ' + pair(item.title) + ',');
      out.push('    description: ' + pair(item.description) + ',');
      out.push('    features: [');
      (item.features || []).forEach(function (f, i, all) {
        out.push('      ' + pair(f) + (i === all.length - 1 ? '' : ','));
      });
      out.push('    ],');
      out.push('    images: [' + (item.images || []).map(js).join(', ') + ']');
      out.push('  }' + (index === listings.length - 1 ? '' : ','));
    });
    out.push('];');
    out.push('');
    return out.join('\n');
  }

  function wireDownload() {
    byId('download').addEventListener('click', function () {
      var blob = new Blob([serialise()], { type: 'text/javascript;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'listings.js';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    byId('reset').addEventListener('click', function () {
      if (!window.confirm('לבטל את כל השינויים ולחזור לרשימה שמפורסמת באתר?')) return;
      listings = JSON.parse(JSON.stringify(PUBLISHED));
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      render();
      markDirty();
      byId('editor').hidden = true;
    });
  }

  /* כלי קטן ליצירת שורת הסיסמה החדשה / a small helper that produces the new
     password line to paste into this file. */
  function wirePasswordTool() {
    var button = byId('pw-make');
    if (!button) return;
    button.addEventListener('click', function () {
      var value = byId('pw-new').value;
      var out = byId('pw-out');
      if (!value) { out.textContent = 'הקלידו סיסמה קודם.'; return; }
      sha256(value).then(function (hash) {
        out.textContent = "var PASS_HASH = '" + hash + "';";
      });
    });
  }

  /* שחזור גישה בלי שרת: אי אפשר "לשלוח את הסיסמה הישנה", כי נשמרת רק טביעה
     שלה ולא הסיסמה עצמה, ואין שרת שיאפס משהו. מה שכן אפשר, וזה מה שקורה כאן:
     לבחור סיסמה חדשה, לייצר את השורה שמחליפה את הקיימת בקובץ, ולשלוח אותה
     במייל דרך אותו שירות טפסים שהאתר כבר משתמש בו.

     Recovery without a server: the old password cannot be sent, because only
     its hash is stored and there is nothing to reset. What is possible, and
     what happens here, is choosing a new password, producing the line that
     replaces the current one in the file, and mailing it through the same form
     service the site already uses. */
  function wireRecovery() {
    var open = byId('forgot');
    var back = byId('back-to-login');
    var form = byId('recover');
    if (!open || !form) return;

    var show = function (recovering) {
      byId('gate-form').hidden = recovering;
      form.hidden = !recovering;
      if (recovering) byId('rec-pass').focus();
    };
    open.addEventListener('click', function () { show(true); });
    if (back) back.addEventListener('click', function () { show(false); });

    var config = window.KERTSMAN_CONFIG || {};
    var emailField = byId('rec-email');
    if (emailField && config.recoveryEmail) emailField.value = config.recoveryEmail;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = byId('rec-status');
      var out = byId('rec-out');
      var steps = byId('rec-steps');
      var value = byId('rec-pass').value.trim();

      if (value.length < 6) {
        status.textContent = 'בחרו סיסמה באורך 6 תווים לפחות.';
        status.setAttribute('data-state', 'err');
        return;
      }

      sha256(value).then(function (hash) {
        var line = "var PASS_HASH = '" + hash + "';";
        out.textContent = line;
        steps.hidden = false;

        if (!config.formKey) {
          status.textContent = 'השורה מוכנה למטה. העתיקו אותה לפי ההוראות.';
          status.setAttribute('data-state', 'ok');
          return;
        }

        status.textContent = 'שולח את ההוראות למייל...';
        status.removeAttribute('data-state');
        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: config.formKey,
            subject: 'שחזור סיסמה למסך הניהול של האתר',
            from_name: 'מסך הניהול',
            message: 'התקבלה בקשה לסיסמת ניהול חדשה.\n\n' +
              'השורה להחלפה בקובץ assets/admin.js:\n' + line + '\n\n' +
              'שלבים:\n1. פתחו את assets/admin.js בניהול האחסון.\n' +
              '2. החליפו את השורה שמתחילה ב-var PASS_HASH בשורה שלמעלה.\n' +
              '3. שמרו והיכנסו עם הסיסמה החדשה.\n\n' +
              'אם לא אתם ביקשתם זאת, אפשר להתעלם: בלי גישה לקבצי האתר השורה הזו לא משנה דבר.'
          })
        }).then(function (response) { return response.json(); }).then(function (result) {
          if (result && result.success) {
            status.textContent = 'ההוראות נשלחו למייל. השורה מופיעה גם כאן למטה.';
            status.setAttribute('data-state', 'ok');
          } else {
            status.textContent = 'המייל לא נשלח, אבל השורה מוכנה למטה להעתקה.';
            status.setAttribute('data-state', 'err');
          }
        }).catch(function () {
          status.textContent = 'המייל לא נשלח, אבל השורה מוכנה למטה להעתקה.';
          status.setAttribute('data-state', 'err');
        });
      });
    });
  }

  wireRecovery();
  wirePasswordTool();
  wireGate();
  wireEditor();
  wireDownload();
})();
