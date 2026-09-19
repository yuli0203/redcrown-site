(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const defaults = {title:'Book a meeting',description:'Choose a time that works for you.',duration:30,before:0,after:15,accent:'#c8102e',background:'#ffffff',text:'#271c22',logo:''};
  let uid = null, logo = '', revision = 0;
  const nav = [...document.querySelectorAll('.product-nav a')].map(link => ({link,href:link.getAttribute('href'),text:link.textContent}));
  const key = () => `crown-calendar-workspace-v1:${uid}`;
  const fields = ['title','description','duration','before','after','accent','background','text'];
  function preview() {
    $('#booking-preview-title').textContent = $('#booking-title').value || defaults.title;
    $('#booking-preview-description').textContent = $('#booking-description').value;
    $('#booking-preview-duration').textContent = `${$('#booking-duration').value || 30} minute meeting`;
    const card = $('#booking-style-preview');
    card.style.setProperty('--booking-accent',$('#booking-accent').value);
    card.style.backgroundColor = $('#booking-background').value;
    card.style.color = $('#booking-text').value;
    const image = $('#booking-logo-preview'); image.hidden = !logo;
    if (logo) image.src = logo; else image.removeAttribute('src');
  }
  function load() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch {}
    for (const field of fields) {
      const input = $(`#booking-${field}`);
      input.value = typeof stored[field] === typeof defaults[field] ? stored[field] : defaults[field];
      if (!input.checkValidity()) input.value = defaults[field];
    }
    logo = typeof stored.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(stored.logo) && stored.logo.length < 1500000 ? stored.logo : '';
    $('#booking-logo').value = '';
    $('#meeting-settings-status').textContent = ''; $('#style-settings-status').textContent = '';
    preview();
  }
  function save(event, status) {
    event.preventDefault(); if (!uid) return;
    if (!$('#meeting-settings-form').reportValidity() || !$('#style-settings-form').reportValidity()) return;
    const data = {logo};
    for (const field of fields) data[field] = typeof defaults[field] === 'number' ? Number($(`#booking-${field}`).value) : $(`#booking-${field}`).value.trim();
    try { localStorage.setItem(key(),JSON.stringify(data)); $(status).textContent = 'Saved on this browser.'; }
    catch { $(status).textContent = 'Could not save. Browser storage may be full. Try a smaller logo.'; }
  }
  $('#meeting-settings-form').addEventListener('submit',event => save(event,'#meeting-settings-status'));
  $('#style-settings-form').addEventListener('submit',event => save(event,'#style-settings-status'));
  for (const field of fields) $(`#booking-${field}`).addEventListener('input',() => { preview(); $('#meeting-settings-status').textContent = ''; $('#style-settings-status').textContent = ''; });
  $('#booking-logo').addEventListener('change', async event => {
    const file = event.target.files[0], version = ++revision;
    if (!file || !uid) return;
    const status = $('#style-settings-status');
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1024*1024) { status.textContent = 'Choose a PNG, JPEG or WebP image under 1 MB.'; event.target.value = ''; return; }
    try {
      const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); });
      const image = new Image(); image.src=data; await image.decode();
      if (version !== revision || !uid) return;
      logo = data; preview(); status.textContent = 'Logo preview updated. Save style to keep it.';
    } catch { if (version === revision) status.textContent = 'This image could not be opened. Choose another file.'; }
  });
  $('#remove-booking-logo').addEventListener('click',() => { revision++; logo=''; $('#booking-logo').value=''; preview(); $('#style-settings-status').textContent='Logo removed from preview. Save style to keep this change.'; });
  document.addEventListener('crown-auth-change',event => {
    if (uid === event.detail.uid) return;
    uid = event.detail.uid; revision++;
    for (const selector of ['#meeting-settings','#style-settings','.workspace-footer','#workspace-auth-status']) $(selector).hidden = !uid;
    nav.forEach(({link,href,text},i) => { link.setAttribute('href',uid ? ['#sync-availability','#meeting-settings','#style-settings'][i] : href); link.textContent=uid ? ['Sync calendars','Meetings page','Your style'][i] : text; });
    $('#workspace-auth-status').textContent='';
    if (uid) load(); else { for (const field of fields) $(`#booking-${field}`).value=defaults[field]; logo=''; $('#booking-logo').value=''; preview(); }
  });
})();
