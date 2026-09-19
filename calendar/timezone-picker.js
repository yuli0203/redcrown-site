// One editable field shared by working hours and guest booking pages.
window.CrownTimezone = {
 format(zone) {
  const he = document.documentElement.lang.startsWith('he');
  const city = zone === 'Asia/Jerusalem' ? (he ? 'ירושלים, ישראל' : 'Jerusalem, Israel') : zone.split('/').slice(1).join(' / ').replaceAll('_', ' ') || 'UTC';
  const offset = new Intl.DateTimeFormat('en', {timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(new Date()).find(part => part.type === 'timeZoneName').value.replace('GMT','UTC');
  return `${city} (${offset})`;
 },
 create(initial, id = 'booking-timezone') {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const input = document.createElement('input'), list = document.createElement('datalist');
  input.type = 'text'; input.id = id; input.autocomplete = 'off'; input.required = true;
  const he = document.documentElement.lang.startsWith('he');
  input.placeholder = he ? 'הקלידו עיר או אזור' : 'Type a city or region'; input.setAttribute('list', id + '-options');
  list.id = id + '-options';
  const aliases = {'Asia/Jerusalem':'Israel Tel Aviv ישראל ירושלים', 'Europe/London':'UK Britain', 'America/New_York':'US Eastern', 'America/Los_Angeles':'US Pacific'};
  const zones = [...new Set([device, initial, 'UTC', 'Asia/Jerusalem', ...Intl.supportedValuesOf('timeZone')].filter(Boolean))];
  const labels = new Map(zones.map(zone => [zone, this.format(zone)]));
  for (const zone of zones) {
   const option = document.createElement('option'); option.value = labels.get(zone);
   option.label = `${zone.replaceAll('_', ' ')} ${aliases[zone] || ''}`; list.append(option);
  }
  let selected = initial || device;
  input.value = labels.get(selected);
  const matchInput = () => {
   const value = input.value.trim().toLowerCase();
   if (!value) return;
   const exact = zones.find(z => z.toLowerCase() === value || labels.get(z).toLowerCase() === value);
   if (exact) return exact;
   const cities = zones.filter(z => z.split('/').pop().replaceAll('_',' ').toLowerCase() === value);
   if (cities.length === 1) return cities[0];
   if (['israel','tel aviv','ישראל','ירושלים'].includes(value)) return 'Asia/Jerusalem';
  };
  const commit = (match, format = true) => {
   input.setCustomValidity('');
   if (format) input.value = labels.get(match);
   if (selected === match) return;
   selected = match;
   input.dispatchEvent(new Event('timezonechange'));
  };
  input.addEventListener('focus', () => { input.value = ''; });
  input.addEventListener('input', () => {
   input.setCustomValidity('');
   const match = matchInput();
   if (match) commit(match, false);
  });
  input.addEventListener('change', () => {
   const match = matchInput();
   if (match) commit(match);
  });
  input.addEventListener('blur', () => {
   const match = matchInput();
   if (match) commit(match);
   // An unfinished search must never masquerade as the active time zone.
   input.value = labels.get(selected); input.setCustomValidity('');
  });
  input.addEventListener('keydown', event => {
   if (event.key === 'Escape') { input.value = labels.get(selected); input.blur(); }
   if (event.key === 'Enter') {
    event.preventDefault();
    const match = matchInput();
    if (match) { commit(match); input.blur(); }
    else { input.setCustomValidity(he ? 'בחרו אזור זמן מתוך ההצעות.' : 'Choose a time zone from the suggestions.'); input.reportValidity(); }
   }
  });
  return {element:input, list, get value(){return selected;}, set value(zone){
   selected = zone || device; input.value = labels.get(selected) || window.CrownTimezone.format(selected); input.setCustomValidity('');
  }, addEventListener(type, callback){input.addEventListener(type === 'change' ? 'timezonechange' : type, callback);}};
 }
};
