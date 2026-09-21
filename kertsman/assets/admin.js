/* ============================================================================
   מסך ניהול הדירות / Kertsman admin screen
   ----------------------------------------------------------------------------
   עורך את רשימת הדירות ומייצר מחדש את data/listings.js. יש שתי דרכים לפרסם:
   "פרסום לאתר" כותב את הקובץ ואת התמונות ישר למחסן של האתר (דרך מפתח גישה
   שנשמר בדפדפן), ו"הורדת העדכון" מייצר קובץ ZIP להעלאה ידנית, כגיבוי.

   Edits the listing catalogue and regenerates data/listings.js. There are two
   ways to publish: "publish" writes the file and the photos straight to the
   site's own repository (through a token kept in the browser), while the
   download produces a ZIP for manual upload as a fallback.
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
    renderShots();

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


  /* ==========================================================================
     תמונות / images
     --------------------------------------------------------------------------
     הדפדפן מקטין כל תמונה שנבחרת, שומר אותה בזיכרון, ומציג תצוגה מקדימה.
     בלחיצה על הפרסום נוצר קובץ ZIP אחד עם listings.js ועם התמונות החדשות.

     The browser downsizes each chosen image, keeps it in memory and previews
     it. Publishing produces one ZIP holding listings.js and the new images.
     ========================================================================== */

  var MAX_EDGE = 1600;
  var pending = {};          // path -> { blob, url }

  function readableSize(bytes) {
    return bytes > 900000 ? (bytes / 1048576).toFixed(1) + 'MB' : Math.round(bytes / 1024) + 'KB';
  }

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            if (blob) resolve({ blob: blob, width: w, height: h });
            else reject(new Error('encode'));
          }, 'image/jpeg', 0.82);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function imageName(index) {
    var base = slug(byId('f-id').value || byId('f-area-he').value || 'dira');
    var stamp = Date.now().toString(36).slice(-4);
    return 'assets/img/' + base + '-' + stamp + '-' + index + '.jpg';
  }

  function currentPaths() {
    return lines(byId('f-images').value);
  }

  function setPaths(list) {
    byId('f-images').value = list.join('\n');
    renderShots();
  }

  function previewSrc(path) {
    return pending[path] ? pending[path].url : '../' + path;
  }

  function renderShots() {
    var host = byId('shots');
    if (!host) return;
    var paths = currentPaths();
    host.innerHTML = paths.map(function (path, i) {
      return '<li class="shot' + (i === 0 ? ' is-cover' : '') + '">' +
        '<img src="' + previewSrc(path) + '" alt="">' +
        (i === 0 ? '<span class="shot-badge">תמונה ראשית</span>' : '') +
        '<span class="shot-tools">' +
          '<button class="icon-btn" type="button" data-shot-up="' + i + '" aria-label="הזזה אחורה"' + (i === 0 ? ' disabled' : '') + '>&#8594;</button>' +
          '<button class="icon-btn" type="button" data-shot-down="' + i + '" aria-label="הזזה קדימה"' + (i === paths.length - 1 ? ' disabled' : '') + '>&#8592;</button>' +
          '<button class="icon-btn danger" type="button" data-shot-del="' + i + '" aria-label="הסרת התמונה">&times;</button>' +
        '</span>' +
      '</li>';
    }).join('');

    var note = byId('shots-note');
    if (note) {
      var fresh = paths.filter(function (path) { return pending[path]; });
      if (fresh.length) {
        var total = fresh.reduce(function (sum, path) { return sum + pending[path].blob.size; }, 0);
        note.textContent = fresh.length + ' תמונות חדשות ממתינות לפרסום (' + readableSize(total) + '). הן ייכללו בקובץ ה-ZIP.';
        note.hidden = false;
      } else {
        note.hidden = true;
      }
    }
  }

  function addFiles(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    if (!list.length) return;
    var status = byId('editor-status');
    status.textContent = 'מכין ' + list.length + ' תמונות...';
    status.removeAttribute('data-state');

    var start = currentPaths().length;
    var jobs = list.map(function (file, i) {
      return shrink(file).then(function (out) {
        var path = imageName(start + i + 1);
        pending[path] = { blob: out.blob, url: URL.createObjectURL(out.blob) };
        return path;
      }).catch(function () { return null; });
    });

    Promise.all(jobs).then(function (paths) {
      var good = paths.filter(Boolean);
      setPaths(currentPaths().concat(good));
      status.textContent = good.length === list.length
        ? 'התמונות נוספו. אל תשכחו לשמור את הדירה.'
        : 'נוספו ' + good.length + ' מתוך ' + list.length + ' תמונות.';
      status.setAttribute('data-state', good.length ? 'ok' : 'err');
    });
  }

  function wireImages() {
    var input = byId('f-files');
    var drop = byId('drop');
    if (!input || !drop) return;

    input.addEventListener('change', function () {
      addFiles(input.files);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (event) {
        event.preventDefault();
        drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (event) {
        event.preventDefault();
        drop.classList.remove('is-over');
        if (name === 'drop' && event.dataTransfer) addFiles(event.dataTransfer.files);
      });
    });

    byId('shots').addEventListener('click', function (event) {
      var paths = currentPaths();
      var move = function (from, to) {
        if (to < 0 || to >= paths.length) return;
        var moved = paths.splice(from, 1)[0];
        paths.splice(to, 0, moved);
        setPaths(paths);
      };
      var up = event.target.closest('[data-shot-up]');
      if (up) { var i = Number(up.getAttribute('data-shot-up')); move(i, i - 1); return; }
      var down = event.target.closest('[data-shot-down]');
      if (down) { var j = Number(down.getAttribute('data-shot-down')); move(j, j + 1); return; }
      var del = event.target.closest('[data-shot-del]');
      if (del) {
        var k = Number(del.getAttribute('data-shot-del'));
        paths.splice(k, 1);
        setPaths(paths);
      }
    });

    byId('f-images').addEventListener('input', renderShots);
  }

  /* ---------- a minimal store-only ZIP writer ---------- */

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(entries) {
    // entries: [{ name, bytes }] — stored without compression, which suits
    // JPEGs and keeps this to a few dozen lines with no library.
    var chunks = [];
    var central = [];
    var offset = 0;
    var encoder = new TextEncoder();

    entries.forEach(function (entry) {
      var nameBytes = encoder.encode(entry.name);
      var crc = crc32(entry.bytes);
      var size = entry.bytes.length;

      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);      // UTF-8 names
      local.setUint16(8, 0, true);           // stored
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, nameBytes.length, true);
      chunks.push(new Uint8Array(local.buffer), nameBytes, entry.bytes);

      var dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014b50, true);
      dir.setUint16(4, 20, true);
      dir.setUint16(6, 20, true);
      dir.setUint16(8, 0x0800, true);
      dir.setUint16(10, 0, true);
      dir.setUint32(16, crc, true);
      dir.setUint32(20, size, true);
      dir.setUint32(24, size, true);
      dir.setUint16(28, nameBytes.length, true);
      dir.setUint32(42, offset, true);
      central.push(new Uint8Array(dir.buffer), nameBytes);

      offset += 30 + nameBytes.length + size;
    });

    var centralSize = central.reduce(function (sum, part) { return sum + part.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }

  function blobBytes(blob) {
    return blob.arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
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

  function saveAs(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function usedPending() {
    // only images that some apartment still points at
    var wanted = {};
    listings.forEach(function (item) {
      (item.images || []).forEach(function (path) { if (pending[path]) wanted[path] = pending[path]; });
    });
    return wanted;
  }

  function wireDownload() {
    byId('download').addEventListener('click', function () {
      var button = byId('download');
      var fresh = usedPending();
      var paths = Object.keys(fresh);
      var encoder = new TextEncoder();

      if (!paths.length) {
        saveAs(new Blob([serialise()], { type: 'text/javascript;charset=utf-8' }), 'listings.js');
        return;
      }

      button.disabled = true;
      var label = button.textContent;
      button.textContent = 'אורז ' + paths.length + ' תמונות...';

      Promise.all(paths.map(function (path) {
        return blobBytes(fresh[path].blob).then(function (bytes) {
          return { name: path, bytes: bytes };
        });
      })).then(function (imageEntries) {
        var entries = [{ name: 'data/listings.js', bytes: encoder.encode(serialise()) }].concat(imageEntries);
        saveAs(zip(entries), 'kertsman-update.zip');
        button.textContent = label;
        button.disabled = false;
      }).catch(function () {
        button.textContent = label;
        button.disabled = false;
        window.alert('לא הצלחנו לארוז את הקובץ. נסו שוב, או הורידו את listings.js בלבד.');
      });
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

  /* ==========================================================================
     פרסום ישר מהאתר / publishing straight from the site
     --------------------------------------------------------------------------
     האתר סטטי ואין בו שרת שישמור נתונים, אבל יש לו מחסן קבצים משלו, ואפשר
     לכתוב אליו ישר מהדפדפן. פעם אחת מדביקים כאן מפתח גישה (Token) שמוגבל
     למחסן של האתר בלבד, ומאז כל לחיצה על "פרסום לאתר" כותבת את
     data/listings.js ואת התמונות החדשות ישר לאתר. תוך דקה בערך הן באוויר,
     בלי להוריד ולהעלות שום קובץ.

     The site is static, with no server to save to, but it does have its own
     file store and the browser can write to it. A fine-grained token, scoped
     to that single repository, is pasted here once; from then on every
     "publish" writes data/listings.js and the new photos straight to the live
     site, and they are up within a minute — no file to download and re-upload.
     ========================================================================== */

  var GH_KEY = 'kertsman:admin:github';
  var GH_API = 'https://api.github.com';
  var uploaded = {};        // תמונות שכבר נכתבו למחסן / images already written

  function ghRead() {
    var raw = null;
    try { raw = localStorage.getItem(GH_KEY) || sessionStorage.getItem(GH_KEY); } catch (err) { /* ignore */ }
    var saved = {};
    if (raw) { try { saved = JSON.parse(raw) || {}; } catch (err) { saved = {}; } }
    return {
      repo: saved.repo || 'yuli0203/kertsman-site',
      branch: saved.branch || 'main',
      prefix: saved.prefix || '',
      token: saved.token || '',
      remember: saved.remember !== false
    };
  }

  function ghWrite(settings) {
    var body = JSON.stringify(settings);
    try {
      if (settings.remember) {
        localStorage.setItem(GH_KEY, body);
        sessionStorage.removeItem(GH_KEY);
      } else {
        sessionStorage.setItem(GH_KEY, body);
        localStorage.removeItem(GH_KEY);
      }
    } catch (err) { /* private mode */ }
  }

  function ghFields() {
    var repo = (byId('c-repo').value || '')
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/^\/+|\/+$/g, '');
    var prefix = (byId('c-prefix').value || '').trim().replace(/^\/+/, '');
    if (prefix && prefix.slice(-1) !== '/') prefix += '/';
    return {
      repo: repo,
      branch: (byId('c-branch').value || '').trim() || 'main',
      prefix: prefix,
      token: (byId('c-token').value || '').trim(),
      remember: byId('c-remember').checked
    };
  }

  function ghCall(settings, path, options) {
    var init = options || {};
    init.headers = {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + settings.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (init.json) {
      init.body = JSON.stringify(init.json);
      init.headers['Content-Type'] = 'application/json';
      delete init.json;
    }
    return fetch(GH_API + path, init).then(function (response) {
      if (response.status === 204) return {};
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (response.ok) return body;
        var error = new Error((body && body.message) || ('HTTP ' + response.status));
        error.status = response.status;
        throw error;
      });
    });
  }

  function ghProblem(error) {
    var status = error && error.status;
    if (status === 401) return 'מפתח הגישה אינו תקף או שפג תוקפו. צרו מפתח חדש והדביקו אותו כאן.';
    if (status === 403) return 'למפתח אין הרשאת כתיבה. בדקו שההרשאה Contents מוגדרת ל-Read and write.';
    if (status === 404) return 'לא נמצא מחסן בשם הזה, או שהמפתח לא מורשה עליו. בדקו את השם ואת שם הענף.';
    if (status === 409) return 'הענף ריק או חסום. בדקו את שם הענף.';
    if (error && error.message) return 'GitHub החזיר שגיאה: ' + error.message;
    return 'לא הצלחנו להתחבר. בדקו את חיבור האינטרנט ונסו שוב.';
  }

  function base64(blob) {
    return blob.arrayBuffer().then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var text = '';
      for (var i = 0; i < bytes.length; i += 0x8000) {
        text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      return btoa(text);
    });
  }

  function ghSay(id, text, state) {
    var box = byId(id);
    if (!box) return;
    box.textContent = text;
    if (state) box.setAttribute('data-state', state);
    else box.removeAttribute('data-state');
  }

  function needsToken(settings) {
    if (settings.token && settings.repo) return false;
    ghSay('publish-status', 'כדי לפרסם ישר לאתר צריך להדביק פעם אחת מפתח גישה, בקטע "חיבור לאתר" שבתחתית המסך.', 'err');
    var field = byId('c-token');
    if (field) {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus({ preventScroll: true });
    }
    return true;
  }

  function wireConnect() {
    var saved = ghRead();
    byId('c-repo').value = saved.repo;
    byId('c-branch').value = saved.branch;
    byId('c-prefix').value = saved.prefix;
    byId('c-token').value = saved.token;
    byId('c-remember').checked = saved.remember;
    if (saved.token) ghSay('connect-status', 'מפתח גישה שמור בדפדפן הזה. אפשר לפרסם.', 'ok');

    byId('c-save').addEventListener('click', function () {
      var settings = ghFields();
      if (!/^[\w.-]+\/[\w.-]+$/.test(settings.repo)) {
        ghSay('connect-status', 'שם המחסן צריך להיות בצורה user/repo, למשל yuli0203/kertsman-site.', 'err');
        return;
      }
      ghWrite(settings);
      ghSay('connect-status', settings.token ? 'החיבור נשמר בדפדפן הזה.' : 'הפרטים נשמרו, אבל בלי מפתח גישה אי אפשר לפרסם.', settings.token ? 'ok' : 'err');
    });

    byId('c-test').addEventListener('click', function () {
      var settings = ghFields();
      if (!settings.token) { ghSay('connect-status', 'הדביקו קודם מפתח גישה.', 'err'); return; }
      ghSay('connect-status', 'בודק את החיבור...');
      ghCall(settings, '/repos/' + settings.repo).then(function (repo) {
        if (repo.permissions && repo.permissions.push === false) {
          ghSay('connect-status', 'המפתח קורא את ' + repo.full_name + ' אבל אינו יכול לכתוב אליו. הגדירו Contents: Read and write.', 'err');
          return;
        }
        return ghCall(settings, '/repos/' + settings.repo + '/git/ref/heads/' + encodeURIComponent(settings.branch)).then(function () {
          ghWrite(settings);
          ghSay('connect-status', 'החיבור עובד. ' + repo.full_name + ', ענף ' + settings.branch + '. אפשר לפרסם.', 'ok');
        });
      }).catch(function (error) {
        ghSay('connect-status', ghProblem(error), 'err');
      });
    });

    byId('c-forget').addEventListener('click', function () {
      if (!window.confirm('למחוק את מפתח הגישה מהדפדפן הזה? אחר כך יהיה צריך להדביק אותו שוב כדי לפרסם.')) return;
      try { localStorage.removeItem(GH_KEY); sessionStorage.removeItem(GH_KEY); } catch (err) { /* ignore */ }
      byId('c-token').value = '';
      ghSay('connect-status', 'המפתח נמחק מהדפדפן הזה.', 'ok');
    });
  }

  function wirePublish() {
    var button = byId('publish');
    if (!button) return;

    button.addEventListener('click', function () {
      var settings = ghFields();
      if (needsToken(settings)) return;
      ghWrite(settings);

      var fresh = usedPending();
      var paths = Object.keys(fresh).filter(function (path) { return !uploaded[path]; });
      var label = button.textContent;
      var ref, baseTree;

      button.disabled = true;
      ghSay('publish-status', 'מתחבר לאתר...');

      ghCall(settings, '/repos/' + settings.repo + '/git/ref/heads/' + encodeURIComponent(settings.branch))
        .then(function (data) {
          ref = data.object.sha;
          return ghCall(settings, '/repos/' + settings.repo + '/git/commits/' + ref);
        })
        .then(function (commit) {
          baseTree = commit.tree.sha;
          var entries = [];
          var chain = Promise.resolve();
          paths.forEach(function (path, index) {
            chain = chain.then(function () {
              var step = 'מעלה תמונה ' + (index + 1) + ' מתוך ' + paths.length + '...';
              button.textContent = step;
              ghSay('publish-status', step);
              return base64(fresh[path].blob).then(function (content) {
                return ghCall(settings, '/repos/' + settings.repo + '/git/blobs', {
                  method: 'POST', json: { content: content, encoding: 'base64' }
                });
              }).then(function (blob) {
                entries.push({ path: settings.prefix + path, mode: '100644', type: 'blob', sha: blob.sha });
              });
            });
          });
          return chain.then(function () { return entries; });
        })
        .then(function (entries) {
          button.textContent = 'מפרסם...';
          ghSay('publish-status', 'כותב את רשימת הדירות...');
          entries.push({
            path: settings.prefix + 'data/listings.js',
            mode: '100644', type: 'blob', content: serialise()
          });
          return ghCall(settings, '/repos/' + settings.repo + '/git/trees', {
            method: 'POST', json: { base_tree: baseTree, tree: entries }
          });
        })
        .then(function (tree) {
          return ghCall(settings, '/repos/' + settings.repo + '/git/commits', {
            method: 'POST',
            json: {
              message: 'עדכון הדירות ממסך הניהול (' + listings.length + ' דירות)',
              tree: tree.sha,
              parents: [ref]
            }
          });
        })
        .then(function (commit) {
          return ghCall(settings, '/repos/' + settings.repo + '/git/refs/heads/' + encodeURIComponent(settings.branch), {
            method: 'PATCH', json: { sha: commit.sha }
          });
        })
        .then(function () {
          paths.forEach(function (path) { uploaded[path] = true; });
          PUBLISHED = JSON.parse(JSON.stringify(listings));
          markDirty();
          button.textContent = label;
          button.disabled = false;
          var shots = paths.length === 0 ? '' : (paths.length === 1 ? ', כולל תמונה אחת' : ', כולל ' + paths.length + ' תמונות');
          ghSay('publish-status', 'פורסם לאתר' + shots + '. השינויים יופיעו באתר בתוך דקה בערך, אחרי רענון הדף.', 'ok');
        })
        .catch(function (error) {
          button.textContent = label;
          button.disabled = false;
          ghSay('publish-status', ghProblem(error) + ' אם זה נמשך, אפשר להוריד את העדכון ולהעלות אותו ידנית.', 'err');
        });
    });
  }

  function wireSignOut() {
    var button = byId('signout');
    if (!button) return;
    button.addEventListener('click', function () {
      var dirty = JSON.stringify(listings) !== JSON.stringify(PUBLISHED);
      if (dirty && !window.confirm('יש שינויים שעוד לא פורסמו. לצאת בכל זאת? השינויים יישמרו בדפדפן הזה.')) return;
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch (err) { /* ignore */ }
      byId('shell').hidden = true;
      byId('gate').hidden = false;
      byId('gate-form').hidden = false;
      byId('recover').hidden = true;
      byId('gate-pass').value = '';
      byId('gate-status').textContent = '';
      byId('gate-pass').focus();
    });
  }

  wireSignOut();
  wireConnect();
  wirePublish();
  wireRecovery();
  wirePasswordTool();
  wireGate();
  wireEditor();
  wireImages();
  wireDownload();
})();
