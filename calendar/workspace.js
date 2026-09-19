(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const defaults = {title:'Book a meeting',description:'Choose a time that works for you.',duration:30,before:0,after:15,accent:'#c8102e',background:'#ffffff',text:'#271c22',logo:''};
  let uid = null, logo = '', revision = 0, meetings = [], editingId = null, removed = null, savedData = {};
  const dialog = $('#configure-meeting-dialog');
  const meetingFields = ['title','description','duration','before','after'];
  const nav = [...document.querySelectorAll('.product-nav a')].map(link => ({link,href:link.getAttribute('href'),text:link.textContent}));
  const key = () => `crown-calendar-workspace-v1:${uid}`;
  const fields = ['title','description','duration','before','after','accent','background','text'];
  function preview() {
    const sample = meetings[0] || defaults;
    $('#booking-preview-title').textContent = sample.title;
    $('#booking-preview-description').textContent = sample.description;
    $('#booking-preview-duration').textContent = `${sample.duration} minute meeting`;
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
    savedData = typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    stored = savedData;
    const validMeeting = m => m && typeof m.id === 'string' && typeof m.title === 'string' && m.title.trim() && m.title.length <= 80 && typeof m.description === 'string' && m.description.length <= 500 && Number.isInteger(m.duration) && m.duration >= 1 && m.duration <= 480 && ['before','after'].every(k => Number.isInteger(m[k]) && m[k] >= 0 && m[k] <= 240);
    meetings = Array.isArray(stored.meetings) ? stored.meetings.filter(validMeeting) : [];
    if (!Array.isArray(stored.meetings) && typeof stored.title === 'string' && stored.title.trim()) {
      const legacy = {id:crypto.randomUUID()};
      for (const field of meetingFields) legacy[field] = stored[field] ?? defaults[field];
      if (validMeeting(legacy)) meetings = [legacy];
    }
    for (const field of fields) {
      const input = $(`#booking-${field}`);
      input.value = typeof stored[field] === typeof defaults[field] ? stored[field] : defaults[field];
      if (!input.checkValidity()) input.value = defaults[field];
    }
    logo = typeof stored.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(stored.logo) && stored.logo.length < 1500000 ? stored.logo : '';
    $('#booking-logo').value = '';
    $('#meeting-settings-status').textContent = ''; $('#style-settings-status').textContent = '';
    renderMeetings(); preview();
  }
  function persist(changes, status) {
    if (!uid) return false;
    const next = {...savedData, ...changes};
    try { localStorage.setItem(key(),JSON.stringify(next)); savedData = next; return true; }
    catch { $(status).textContent = 'Could not save. Browser storage may be full.'; return false; }
  }
  function renderMeetings() {
    const list = $('#meeting-types-list'); list.replaceChildren();
    if (!meetings.length) {
      const empty = document.createElement('p'); empty.className='meeting-list-empty'; empty.textContent='No meetings yet. Add your first meeting to get started.'; list.append(empty);
    }
    for (const meeting of meetings) {
      const row=document.createElement('article'); row.className='meeting-type-row';
      const details=document.createElement('div');
      const title=document.createElement('h3'); title.textContent=meeting.title;
      const meta=document.createElement('p'); meta.className='sync-small'; meta.textContent=`${meeting.duration} minutes - Buffer: ${meeting.before} min before / ${meeting.after} min after`;
      details.append(title,meta);
      const actions=document.createElement('div'); actions.className='meeting-type-actions';
      const edit=document.createElement('button'); edit.type='button'; edit.className='auth-button'; edit.textContent='Edit'; edit.setAttribute('aria-label',`Edit ${meeting.title}`); edit.addEventListener('click',()=>openMeeting(meeting));
      const remove=document.createElement('button'); remove.type='button'; remove.className='auth-link'; remove.textContent='Remove'; remove.setAttribute('aria-label',`Remove ${meeting.title}`); remove.addEventListener('click',()=>{
        const index=meetings.findIndex(m=>m.id===meeting.id), next=meetings.filter(m=>m.id!==meeting.id);
        if (!persist({meetings:next},'#meeting-list-status')) return;
        removed={meeting,index}; meetings=next; renderMeetings(); preview();
        $('#meeting-list-status').textContent=`${meeting.title} removed.`; $('#undo-remove-meeting').hidden=false;
      });
      actions.append(edit,remove); row.append(details,actions); list.append(row);
    }
  }
  function openMeeting(meeting) {
    if (!uid) return;
    editingId=meeting?.id || null;
    for (const field of meetingFields) $(`#booking-${field}`).value=(meeting || defaults)[field];
    $('#configure-meeting-title').textContent=meeting ? 'Configure meeting' : 'Add meeting';
    $('#meeting-settings-status').textContent=''; $('#booking-title').setCustomValidity(''); dialog.showModal(); $('#booking-title').focus();
  }
  $('#add-meeting-type').addEventListener('click',()=>openMeeting());
  $('#close-meeting-dialog').addEventListener('click',()=>dialog.close());
  $('#cancel-meeting-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{editingId=null; for (const field of meetingFields) $(`#booking-${field}`).value=defaults[field];});
  $('#meeting-settings-form').addEventListener('submit',event=>{
    event.preventDefault(); if (!uid) return;
    $('#booking-title').setCustomValidity($('#booking-title').value.trim() ? '' : 'Enter a meeting name.');
    if (!$('#meeting-settings-form').reportValidity()) return;
    const meeting={id:editingId || crypto.randomUUID()};
    for (const field of meetingFields) meeting[field]=typeof defaults[field]==='number' ? Number($(`#booking-${field}`).value) : $(`#booking-${field}`).value.trim();
    const next=editingId ? meetings.map(m=>m.id===editingId ? meeting : m) : [...meetings,meeting];
    if (!persist({meetings:next},'#meeting-settings-status')) return;
    meetings=next; renderMeetings(); preview(); dialog.close(); $('#meeting-list-status').textContent='Meeting saved on this browser.';
  });
  $('#booking-title').addEventListener('input',()=>$('#booking-title').setCustomValidity(''));
  $('#undo-remove-meeting').addEventListener('click',()=>{
    if (!uid || !removed) return;
    const next=[...meetings]; next.splice(Math.min(removed.index,next.length),0,removed.meeting);
    if (!persist({meetings:next},'#meeting-list-status')) return;
    meetings=next;removed=null;$('#undo-remove-meeting').hidden=true;$('#meeting-list-status').textContent='Meeting restored.';renderMeetings();preview();
  });
  $('#style-settings-form').addEventListener('submit',event=>{
    event.preventDefault(); if (!uid || !$('#style-settings-form').reportValidity()) return;
    const changes={logo,meetings};
    for (const field of ['accent','background','text']) changes[field]=$(`#booking-${field}`).value;
    if (persist(changes,'#style-settings-status')) $('#style-settings-status').textContent='Style saved on this browser.';
  });
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
    if (dialog.open) dialog.close();
    uid = event.detail.uid; revision++; meetings=[]; savedData={}; removed=null; editingId=null;
    $('#meeting-list-status').textContent=''; $('#undo-remove-meeting').hidden=true; renderMeetings();
    for (const selector of ['#meeting-settings','#style-settings','.workspace-footer','#workspace-auth-status']) $(selector).hidden = !uid;
    nav.forEach(({link,href,text},i) => { link.setAttribute('href',uid ? ['#sync-availability','#meeting-settings','#style-settings'][i] : href); link.textContent=uid ? ['Sync calendars','Meetings page','Your style'][i] : text; });
    $('#workspace-auth-status').textContent='';
    if (uid) load(); else { for (const field of fields) $(`#booking-${field}`).value=defaults[field]; logo=''; $('#booking-logo').value=''; preview(); }
  });
})();
