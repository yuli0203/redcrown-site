// One editable field shared by working hours and guest booking pages.
window.CrownTimezone = {
 create(initial, id = 'booking-timezone') {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const input = document.createElement('input'), list = document.createElement('datalist');
  input.type = 'text'; input.id = id; input.autocomplete = 'off'; input.required = true;
  input.placeholder = 'Type a city or region'; input.setAttribute('list', id + '-options');
  list.id = id + '-options';
  const aliases = {'Asia/Jerusalem':'Israel Tel Aviv ישראל ירושלים', 'Europe/London':'UK Britain', 'America/New_York':'US Eastern', 'America/Los_Angeles':'US Pacific'};
  const zones = [...new Set([device, initial, 'UTC', 'Asia/Jerusalem', ...Intl.supportedValuesOf('timeZone')].filter(Boolean))];
  for (const zone of zones) {
   const option = document.createElement('option'); option.value = zone;
   option.label = (aliases[zone] || zone.replaceAll('_', ' ')); list.append(option);
  }
  let selected = initial || device;
  input.value = selected;
  input.addEventListener('focus', () => input.select());
  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('change', () => {
   const match = zones.find(z => z.toLowerCase() === input.value.trim().toLowerCase());
   if (!match) { input.setCustomValidity('Choose a time zone from the suggestions.'); return; }
   input.setCustomValidity(''); input.value = match; selected = match;
   input.dispatchEvent(new Event('timezonechange'));
  });
  return {element:input, list, get value(){return selected;}, set value(zone){
   selected = zone || device; input.value = selected; input.setCustomValidity('');
  }, addEventListener(type, callback){input.addEventListener(type === 'change' ? 'timezonechange' : type, callback);}};
 }
};
