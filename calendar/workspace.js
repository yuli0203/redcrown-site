(async () => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  await window.CrownAPI.ready;const cloud=window.CrownAPI.online||window.CrownAPI.configured;let serverVersion=0;
  const notificationWarning=document.createElement('p');
  notificationWarning.className='workspace-auth-status';notificationWarning.setAttribute('role','status');
  notificationWarning.textContent=document.documentElement.lang.startsWith('he')?'התראות על פגישות באימייל אינן מחוברות. פגישות נשמרות ביומן, אך לא נשלחת אליכם התראה באימייל. יש לפנות לתמיכה.':'Booking email notifications are not connected. Bookings are saved to your calendar, but no host notification email is sent. Contact support to enable delivery.';
  notificationWarning.hidden=window.CrownAPI.config?.bookingNotifications!==false;
  $('#meeting-settings').prepend(notificationWarning);
  const defaults = {title:'Book a meeting',description:'Choose a time that works for you.',duration:30,before:0,after:15,notice:120,horizon:60,interval:15,dailyLimit:0,location:'',reminderMinutes:30,reminderEmail:'',accent:'#c8102e',background:'#ffffff',text:'#271c22',logo:''};
  let uid = null, logo = '', photo = '', revision = 0, meetings = [], editingId = null, removed = null, savedData = {};
  const dialog = $('#configure-meeting-dialog');
  const meetingFields = ['title','description','duration','before','after','notice','horizon','interval','dailyLimit','location','reminderMinutes','reminderEmail'];
  const nav = [...document.querySelectorAll('.product-nav a')].map(link => ({link,href:link.getAttribute('href'),text:link.textContent}));
  const footerLinks=[...document.querySelectorAll('.full-footer [data-workspace-href]')].map(link=>({link,href:link.getAttribute('href'),text:link.textContent}));
  const key = () => `crown-calendar-workspace-v1:${uid}`;
  const fields = ['title','description','duration','before','after','notice','horizon','interval','dailyLimit','location','accent','background','text'];
  let displayName = '', userEmail = '';
  function reminderRecipients(){
    const select=$('#booking-reminder-recipient'),input=$('#booking-reminderEmail');
    const current=input.value.trim(),signIn=window.CrownAuth?.current?.()?.email || userEmail;
    const emails=[...new Map([signIn,...(window.CrownSettings.getAccountEmails?.()||[])].filter(Boolean).map(email=>[email.toLowerCase(),email])).values()];
    select.replaceChildren();
    for(const email of emails){const option=document.createElement('option');option.value=email;option.textContent=email+(email.toLowerCase()===signIn.toLowerCase()?' (sign-in email)':' (linked calendar)');select.append(option);}
    const other=document.createElement('option');other.value='__other__';other.textContent='Add another email address';select.append(other);
    select.value=emails.find(email=>email.toLowerCase()===current.toLowerCase())||'__other__';
    reminderInputs();
  }
  function reminderInputs(){
    const enabled=Number($('#booking-reminderMinutes').value)>0;
    $('#booking-reminder-recipient').disabled=!enabled;
    $('#booking-reminder-custom').hidden=$('#booking-reminder-recipient').value!=='__other__';
    $('#booking-reminderEmail').disabled=!enabled;$('#booking-reminderEmail').required=enabled;
    $('#meeting-reminder-help').textContent='Choose your sign-in email, a linked calendar account, or another address. Applies to new bookings. '+(window.CrownAPI.config?.emailReminders?'Reminders are sent shortly after the selected time.':'Email delivery is not connected yet. You can save these settings, but reminders will not be sent.');
  }
  $('#booking-reminderMinutes').addEventListener('change',reminderInputs);
  $('#booking-reminder-recipient').addEventListener('change',()=>{
    const value=$('#booking-reminder-recipient').value;
    $('#booking-reminderEmail').value=value==='__other__'?'':value;
    reminderInputs();if(value==='__other__')$('#booking-reminderEmail').focus();
  });
  document.addEventListener('crown-calendars-change',()=>{if(dialog.open)reminderRecipients();});
  const slug = value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'') || 'your-name';
  function shareLink(meeting) {
    if(cloud && savedData.slug && savedData.published && meeting?.enabled!==false) {const url=new URL('/calendar/meet/',location.origin);url.searchParams.set('user',savedData.slug);if(meeting)url.searchParams.set('meeting',meeting.id);return url.href;}
    const name = savedData.pageName || displayName || 'Your name';
    const url = new URL('/calendar/meet/',location.origin);
    url.searchParams.set('user',slug(name)); url.searchParams.set('page',meeting ? slug(meeting.title) : 'meetings');
    const data = {v:1,name,meetings:(meeting ? [meeting] : meetings).map(({title,description,duration})=>({title,description,duration})),accent:savedData.accent || defaults.accent,background:savedData.background || defaults.background,text:savedData.text || defaults.text};
    url.hash = encodeURIComponent(JSON.stringify(data));
    return url.href;
  }
  function bookingPageReady(event,meeting){
    if(cloud&&savedData.published&&savedData.slug&&meeting?.enabled!==false)return;
    event.preventDefault();
    const list=$('#booking-readiness-list');list.replaceChildren();
    const checks=[['Landing page name and link',Boolean(savedData.pageName&&savedData.slug),'#open-page-settings'],['Add at least one active meeting type',meetings.some(m=>m.enabled!==false),'#add-meeting-type'],['Choose a scheduling calendar for new bookings',Boolean(savedData.destination),'#schedule-destination']];
    for(const [text,done,target] of checks){const item=document.createElement('li');item.textContent=(done?'Ready: ':'Needed: ')+text;if(!done){const action=document.createElement('button');action.type='button';action.className='auth-link';action.textContent='Configure';action.addEventListener('click',()=>{$('#booking-readiness-dialog').close();const control=$(target);control.scrollIntoView({block:'center'});control.focus();if(target!=='#schedule-destination')control.click();});item.append(' ',action);}list.append(item);}
    $('#booking-readiness-status').textContent=meeting?.enabled===false?'This meeting is paused. Enable it in your meeting list before accepting bookings.':!cloud?'The booking service is unavailable. Live booking cannot be opened.':'';
    $('#publish-and-open').disabled=!cloud||!checks.every(([,done])=>done)||meeting?.enabled===false;
    $('#publish-and-open').dataset.meeting=meeting?.id||'';
    $('#booking-readiness-dialog').showModal();
  }
  $('#preview-meeting-page').addEventListener('click',event=>bookingPageReady(event));
  $('#close-booking-readiness').addEventListener('click',()=>$('#booking-readiness-dialog').close());
  $('#publish-and-open').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    if(await persist({published:true},'#booking-readiness-status')){const meeting=meetings.find(m=>m.id===button.dataset.meeting);renderMeetings();location.assign(shareLink(meeting));}else button.disabled=false;
  });
  function updateShare() {
    const url=shareLink(); $('#meeting-page-link').value=cloud&&!savedData.published?'Publish your page to get a booking link':url; $('#preview-meeting-page').href=cloud&&!savedData.published?'#meeting-settings':url;$('#preview-meeting-page').textContent='Open booking page';
    $('#copy-meeting-page').disabled=!uid || (cloud && !savedData.published);
    $('#publish-page').disabled=!cloud;$('#publish-page').textContent=savedData.published?'Unpublish booking page':'Publish booking page';
    $('#publish-status').textContent=cloud ? (savedData.published?'Your booking page is live.':'Draft - save your settings, then publish.') : 'Publishing requires the booking service to be connected.';
    if(cloud){$('#share-help').textContent=savedData.published?'A permanent booking link. Saved changes appear here automatically.':'Draft preview only. Publish your page to enable permanent booking links.';$('#meeting-storage-help').textContent='Meetings and scheduling rules are saved to your account.';$('#style-storage-help').textContent='Style is saved to your account and appears on your booking page.';}
    $('#meeting-share-status').textContent=location.hostname==='127.0.0.1' || location.hostname==='localhost' ? 'Local preview: this address only opens on this computer until the site is published.' : '';
  }
  async function copyLink(meeting) {
    const version=revision;
    try { await navigator.clipboard.writeText(shareLink(meeting)); if(version===revision) $('#meeting-share-status').textContent=cloud?'Booking link copied.':'Preview link copied.'; }
    catch { if(version===revision) { $('#meeting-page-link').value=shareLink(meeting); $('#meeting-page-link').focus(); $('#meeting-page-link').select(); $('#meeting-share-status').textContent='Select and copy the link above.'; } }
  }
  $('#copy-meeting-page').addEventListener('click',()=>copyLink());
  const pageDialog=$('#page-settings-dialog');
  function resetPageSettings(){$('#schedule-slug').value=savedData.slug||slug(savedData.pageName||displayName).replace(/[^a-z0-9-]/g,'').slice(0,60);$('#meeting-page-name').value=savedData.pageName||displayName;$('#landing-page-status').textContent='';}
  $('#open-page-settings').addEventListener('click',()=>{if(!uid)return;resetPageSettings();pageDialog.showModal();$('#meeting-page-name').focus();});
  $('#close-page-settings').addEventListener('click',()=>pageDialog.close());
  $('#cancel-page-settings').addEventListener('click',()=>pageDialog.close());
  pageDialog.addEventListener('close',resetPageSettings);
  const availabilityDialog=$('#availability-settings-dialog');
  function resetAvailability(){window.CrownSettings.apply(savedData);$('#schedule-status').textContent='';}
  $('#open-availability-settings').addEventListener('click',()=>{if(!uid)return;resetAvailability();availabilityDialog.showModal();$('#schedule-timezone').focus();});
  $('#close-availability-settings').addEventListener('click',()=>availabilityDialog.close());
  $('#cancel-availability-settings').addEventListener('click',()=>availabilityDialog.close());
  availabilityDialog.addEventListener('close',resetAvailability);
  $('#landing-page-settings-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!uid||!event.target.reportValidity())return;
    const settings={pageName:$('#meeting-page-name').value.trim(),slug:$('#schedule-slug').value.trim()};
    if(await persist(settings,'#landing-page-status')){renderMeetings();pageDialog.close();$('#meeting-list-status').textContent='Landing page saved.';}
  });
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
    const portrait = $('#booking-photo-preview'); portrait.hidden = !savedData.photo;
    if (savedData.photo) portrait.src = savedData.photo; else portrait.removeAttribute('src');
    renderProfile();
  }
  async function load() {
    const version=revision;
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch {}
    if(cloud){const result=await window.CrownAPI.request('/workspace');if(version!==revision)return;serverVersion=result.version;if(result.data)stored=result.data;}
    savedData = typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    if(!savedData.pageName||!savedData.slug){
      const name=(savedData.pageName||displayName||'Your host').trim().slice(0,60);
      const base=slug(name).replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'').slice(0,40)||'meetings';
      const changes={pageName:name,slug:savedData.slug||`${base}-${crypto.randomUUID().slice(0,8)}`,timezone:savedData.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone};
      if(!await persist(changes,'#meeting-settings-status'))return;
      if(version!==revision)return;
    }
    if(!savedData.photo&&signInPhoto()){if(!await persist({photo:signInPhoto()},'#meeting-settings-status'))return;if(version!==revision)return;}
    stored = savedData;window.CrownBusyPreview.setDisplay(stored.calendarDisplay||'global');
    $('#meeting-page-name').value=typeof stored.pageName==='string' ? stored.pageName : displayName;
    const validMeeting = m => m && typeof m.id === 'string' && typeof m.title === 'string' && m.title.trim() && m.title.length <= 80 && typeof m.description === 'string' && m.description.length <= 500 && Number.isInteger(m.duration) && m.duration >= 1 && m.duration <= 480 && ['before','after'].every(k => Number.isInteger(m[k]) && m[k] >= 0 && m[k] <= 240);
    meetings = Array.isArray(stored.meetings) ? stored.meetings.filter(validMeeting) : [];
    if (!Array.isArray(stored.meetings) && typeof stored.title === 'string' && stored.title.trim()) {
      const legacy = {id:crypto.randomUUID()};
      for (const field of meetingFields) legacy[field] = stored[field] ?? (field==='reminderMinutes' ? 0 : defaults[field]);
      if (validMeeting(legacy)) meetings = [legacy];
    }
    for (const field of fields) {
      const input = $(`#booking-${field}`);
      input.value = typeof stored[field] === typeof defaults[field] ? stored[field] : defaults[field];
      if (!input.checkValidity()) input.value = defaults[field];
    }
    logo = typeof stored.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(stored.logo) && stored.logo.length < 1500000 ? stored.logo : '';
    photo = typeof stored.photo === 'string' && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(stored.photo)||googlePhoto(stored.photo)) && stored.photo.length < 1500000 ? stored.photo : '';
    $('#booking-photo').value = '';
    $('#booking-logo').value = '';
    $('#meeting-settings-status').textContent = ''; $('#style-settings-status').textContent = '';
    window.CrownSettings.apply(savedData);renderMeetings(); preview();
  }
  async function persist(changes, status) {
    if (!uid) return false;
    const next = {...savedData, ...changes};
    const version=revision;
    try {
      if(cloud){const result=await window.CrownAPI.request('/workspace',{method:'PUT',data:{data:next,version:serverVersion}});if(version!==revision)return false;savedData=result.data;serverVersion=result.version;}
      else {localStorage.setItem(key(),JSON.stringify(next));savedData=next;}
      return true;
    }catch(error){if(version===revision)$(status).textContent=error.message || 'Could not save. Please retry.';return false;}
  }
  function renderMeetings() {
    updateShare();
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
      const remove=document.createElement('button'); remove.type='button'; remove.className='auth-link'; remove.textContent='Remove'; remove.setAttribute('aria-label',`Remove ${meeting.title}`); remove.addEventListener('click',async()=>{
        const index=meetings.findIndex(m=>m.id===meeting.id), next=meetings.filter(m=>m.id!==meeting.id);
        if (!await persist({meetings:next},'#meeting-list-status')) return;
        removed={meeting,index}; meetings=next; renderMeetings(); preview();
        $('#meeting-list-status').textContent=`${meeting.title} removed.`; $('#undo-remove-meeting').hidden=false;
      });
      const view=document.createElement('a'); view.className='auth-button'; view.textContent='Preview'; view.href=shareLink(meeting); view.target='_blank'; view.rel='noopener'; view.setAttribute('aria-label',`Open booking page for ${meeting.title}`);view.textContent='Open booking page';view.addEventListener('click',event=>bookingPageReady(event,meeting));
      const share=document.createElement('button'); share.type='button'; share.className='auth-link'; share.textContent='Copy link';share.disabled=cloud&&(!savedData.published||meeting.enabled===false); share.setAttribute('aria-label',`Copy link for ${meeting.title}`); share.addEventListener('click',()=>copyLink(meeting));
      const toggle=document.createElement('button');toggle.type='button';toggle.className='auth-link';toggle.textContent=meeting.enabled===false?'Enable':'Pause';toggle.setAttribute('aria-label',`${toggle.textContent} ${meeting.title}`);toggle.addEventListener('click',async()=>{const next=meetings.map(m=>m.id===meeting.id?{...m,enabled:m.enabled===false}:m);if(await persist({meetings:next},'#meeting-list-status')){meetings=next;renderMeetings();}});if(meeting.enabled===false)meta.textContent+=' - Paused';
      actions.append(view,share,edit,toggle,remove); row.append(details,actions); list.append(row);
    }
  }
  function noticeLimits(){
    const value=$('#booking-notice-value');value.max=43200/window.CrownNotice.factors[$('#booking-notice-unit').value];value.setCustomValidity('');
  }
  function setNotice(minutes){const display=window.CrownNotice.display(minutes);$('#booking-notice-value').value=display.value;$('#booking-notice-unit').value=display.unit;noticeLimits();}
  $('#booking-notice-value').addEventListener('input',noticeLimits);
  $('#booking-notice-unit').addEventListener('change',noticeLimits);
  function openMeeting(meeting) {
    if (!uid) return;
    editingId=meeting?.id || null;
    for (const field of meetingFields) $(`#booking-${field}`).value=(meeting || defaults)[field] ?? defaults[field];
    if(meeting) $('#booking-reminderMinutes').value=meeting.reminderMinutes??0;
    setNotice(meeting?.notice??defaults.notice);
    $('#booking-reminderEmail').value=meeting?.reminderEmail || window.CrownAuth?.current?.()?.email || userEmail;reminderRecipients();
    $('#configure-meeting-title').textContent=meeting ? 'Configure meeting' : 'Add meeting';
    $('#meeting-settings-status').textContent=''; $('#booking-title').setCustomValidity(''); dialog.showModal(); $('#booking-title').focus();
  }
  $('#add-meeting-type').addEventListener('click',()=>openMeeting());
  $('#close-meeting-dialog').addEventListener('click',()=>dialog.close());
  $('#cancel-meeting-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{editingId=null; for (const field of meetingFields) $(`#booking-${field}`).value=defaults[field];});
  $('#meeting-settings-form').addEventListener('submit',async event=>{
    event.preventDefault(); if (!uid) return;
    $('#booking-title').setCustomValidity($('#booking-title').value.trim() ? '' : 'Enter a meeting name.');
    try{$('#booking-notice').value=window.CrownNotice.toMinutes(Number($('#booking-notice-value').value),$('#booking-notice-unit').value);}catch(error){$('#booking-notice-value').setCustomValidity(error.message);}
    if (!$('#meeting-settings-form').reportValidity()) return;
    const meeting={id:editingId || crypto.randomUUID(),enabled:editingId?meetings.find(m=>m.id===editingId)?.enabled!==false:true};
    for (const field of meetingFields) meeting[field]=typeof defaults[field]==='number' ? Number($(`#booking-${field}`).value) : $(`#booking-${field}`).value.trim();
    const next=editingId ? meetings.map(m=>m.id===editingId ? meeting : m) : [...meetings,meeting];
    if (!await persist({meetings:next},'#meeting-settings-status')) return;
    meetings=next; renderMeetings(); preview(); dialog.close(); $('#meeting-list-status').textContent=cloud?'Meeting saved to your account.':'Meeting saved on this browser.';
  });
  $('#booking-title').addEventListener('input',()=>$('#booking-title').setCustomValidity(''));
  $('#undo-remove-meeting').addEventListener('click',async()=>{
    if (!uid || !removed) return;
    const next=[...meetings]; next.splice(Math.min(removed.index,next.length),0,removed.meeting);
    if (!await persist({meetings:next},'#meeting-list-status')) return;
    meetings=next;removed=null;$('#undo-remove-meeting').hidden=true;$('#meeting-list-status').textContent='Meeting restored.';renderMeetings();preview();
  });
  $('#style-settings-form').addEventListener('submit',async event=>{
    event.preventDefault(); if (!uid || !$('#style-settings-form').reportValidity()) return;
    const changes={logo,meetings};
    for (const field of ['accent','background','text']) changes[field]=$(`#booking-${field}`).value;
    if (await persist(changes,'#style-settings-status')) { renderMeetings(); $('#style-settings-status').textContent=cloud?'Style saved to your account.':'Style saved on this browser.'; }
  });
  for (const field of fields) $(`#booking-${field}`).addEventListener('input',() => { preview(); $('#meeting-settings-status').textContent = ''; $('#style-settings-status').textContent = ''; });
  $('#scheduling-calendar-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!uid)return;
    const select=$('#schedule-destination'),button=event.submitter;
    if(select.selectedOptions[0]?.disabled){$('#destination-status').textContent='Choose an available calendar, or reconnect the saved account.';return;}
    const destination=select.value?JSON.parse(select.value):null;button.disabled=true;
    try{if(await persist({destination},'#destination-status')){window.CrownSettings.setDestination(savedData.destination);$('#destination-status').textContent=destination?'Scheduling calendar saved. New bookings will be added here.':'Scheduling calendar cleared. Choose a calendar before publishing.';}}
    finally{button.disabled=false;}
  });
  $('#schedule-destination').addEventListener('change',()=>{$('#destination-status').textContent='Unsaved change. Select Save calendar to apply.';});
  $('#availability-settings-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!uid||!event.target.reportValidity())return;
    try{const {slug,...settings}=window.CrownSettings.read();if(await persist(settings,'#schedule-status')){availabilityDialog.close();$('#meeting-list-status').textContent='Booking availability saved.';}}catch(error){$('#schedule-status').textContent=error.message;}
  });
  $('#publish-page').addEventListener('click',async()=>{
    if(!cloud||!uid)return;
    if(await persist({published:!savedData.published},'#publish-status'))renderMeetings();
  });
  async function upcoming(){
    if(!cloud||!uid)return;const version=revision;$('#upcoming-bookings').hidden=false;
    try{const result=await window.CrownAPI.request('/bookings');if(version!==revision)return;const list=$('#upcoming-bookings-list');list.replaceChildren();
      for(const booking of result.bookings){const row=document.createElement('article');row.className='meeting-type-row';const text=document.createElement('div');const title=document.createElement('h3');title.textContent=booking.data.title;const meta=document.createElement('p');meta.className='sync-small';meta.textContent=`${new Date(booking.start).toLocaleString()} - ${booking.data.name} - ${booking.status}`;text.append(title,meta);row.append(text);
       if(booking.status==='confirmed'){
        const he=document.documentElement.lang.startsWith('he'),state=booking.notificationState;
        const labels=he?{accepted:'ההתראה התקבלה לשליחה אצל ספק האימייל',sending:'ההתראה נשלחת',retry:'שליחת ההתראה ממתינה לניסיון נוסף',unknown:'לא ניתן לאמת שההתראה נשלחה. בדקו בתיבת הדואר.',failed:'שליחת ההתראה נכשלה',permission_required:'נדרש חיבור מחדש עם הרשאת שליחת אימייל',not_sent:'ההתראה טרם נשלחה. בדקו שהרשאת שליחת אימייל מופעלת בחשבון היומן.'}:{accepted:'Notification accepted by email provider',sending:'Sending notification',retry:'Notification queued for retry',unknown:'Notification delivery is uncertain. Check your mailbox.',failed:'Notification could not be sent',permission_required:'Reconnect your calendar with email sending permission',not_sent:'Notification not sent yet. Check that booking emails are enabled on your calendar account.'};
        const delivery=document.createElement('p');delivery.className='sync-small';delivery.textContent=labels[state]||labels.not_sent;text.append(delivery);
       }
       if(booking.status==='pending'){const retry=document.createElement('button');retry.className='auth-button';retry.textContent='Retry confirmation';retry.addEventListener('click',async()=>{retry.disabled=true;try{await window.CrownAPI.request(`/bookings/${booking.id}/retry`,{method:'POST',data:{}});await upcoming();}catch(e){$('#upcoming-bookings-status').textContent=e.message;retry.disabled=false;}});row.append(retry);}
       else if(['confirmed','cancelling'].includes(booking.status)){const manage=document.createElement('a');manage.className='auth-button';manage.textContent='Manage booking';manage.href=`/calendar/meet/?booking=${booking.id}#${booking.manageToken}`;manage.target='_blank';manage.rel='noopener';row.append(manage);}
       else if(booking.status==='cancelled'){const remove=document.createElement('button');remove.type='button';remove.className='auth-button';remove.textContent=document.documentElement.lang.startsWith('he')?'הסרה מהרשימה':'Remove from list';remove.setAttribute('aria-label',remove.textContent+': '+booking.data.title);remove.addEventListener('click',async()=>{remove.disabled=true;try{await window.CrownAPI.request(`/bookings/${encodeURIComponent(booking.id)}`,{method:'DELETE'});if(version!==revision)return;await upcoming();$('#refresh-bookings').focus();}catch(e){if(version===revision){$('#upcoming-bookings-status').textContent=e.message;remove.disabled=false;}}});row.append(remove);}list.append(row);
      }$('#upcoming-bookings-status').textContent=result.bookings.length?'':'No upcoming bookings yet.';
    }catch(e){if(version===revision)$('#upcoming-bookings-status').textContent=e.message;}
  }
  $('#refresh-bookings').addEventListener('click',upcoming);
  const displayDialog=$('#calendar-display-dialog');
  $('#open-calendar-display').addEventListener('click',()=>{if(!uid)return;$('#calendar-display-preset').value=savedData.calendarDisplay||'global';$('#calendar-display-status').textContent='';displayDialog.showModal();});
  $('#close-calendar-display').addEventListener('click',()=>displayDialog.close());
  $('#cancel-calendar-display').addEventListener('click',()=>displayDialog.close());
  $('#calendar-display-form').addEventListener('submit',async event=>{event.preventDefault();const preset=$('#calendar-display-preset').value;if(await persist({calendarDisplay:preset},'#calendar-display-status')){window.CrownBusyPreview.setDisplay(preset);displayDialog.close();}});
  const imageVersions = {logo:0,photo:0};
  const profileDialog=$('#profile-dialog');
  const crop=window.CrownPhotoCrop.create(value=>{photo=value;renderProfile();});
  function googlePhoto(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&value.length<=2048&&(u.hostname==='googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com'));}catch{return false;}}
  function signInPhoto(){const user=window.CrownAuth?.current?.();const url=user?.photoURL||user?.providerData?.find(p=>p.photoURL)?.photoURL||'';return googlePhoto(url)?url:'';}
  function renderProfile(){
    const initial=(displayName||userEmail||'You').trim().charAt(0).toUpperCase();
    for(const [imageId,initialId,value] of [['header-profile-photo','header-profile-initial',savedData.photo||signInPhoto()],['profile-photo-preview','profile-photo-initial',photo||signInPhoto()]]){
      const image=$('#'+imageId),fallback=$('#'+initialId);image.hidden=!value;fallback.hidden=!!value;fallback.textContent=initial;
      image.referrerPolicy='no-referrer';image.onerror=()=>{image.hidden=true;fallback.hidden=false;};
      if(value){if(image.getAttribute('src')!==value)image.src=value;}else image.removeAttribute('src');
    }
  }
  $('#open-profile').addEventListener('click',()=>{if(!uid)return;crop.clear();photo=savedData.photo||'';$('#booking-photo').value='';$('#profile-status').textContent='';renderProfile();profileDialog.showModal();});
  $('#adjust-booking-photo').addEventListener('click',async()=>{
    const value=photo||signInPhoto();if(!value){$('#profile-status').textContent='Upload a photo first, then drag it into position.';return;}
    const version=++imageVersions.photo,accountRevision=revision;
    try{const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.src=value;await image.decode();if(version!==imageVersions.photo||accountRevision!==revision||!profileDialog.open)return;crop.load(image);$('#profile-status').textContent='Drag to position your photo, then Save profile.';$('#profile-crop-canvas').focus();}
    catch{crop.clear();$('#profile-status').textContent='Upload the original photo to adjust its position.';}
  });
  $('#close-profile').addEventListener('click',()=>profileDialog.close());
  $('#cancel-profile').addEventListener('click',()=>profileDialog.close());
  profileDialog.addEventListener('close',()=>{imageVersions.photo++;crop.clear();photo=savedData.photo||'';$('#booking-photo').value='';renderProfile();});
  $('#profile-form').addEventListener('submit',async event=>{event.preventDefault();if(!uid)return;const button=event.submitter;button.disabled=true;try{if(await persist({photo:photo||signInPhoto()},'#profile-status')){preview();profileDialog.close();}}finally{button.disabled=false;}});

  for (const kind of ['logo','photo']) {
    const name=kind==='logo' ? 'Logo' : 'Profile photo';
    $(`#booking-${kind}`).addEventListener('change',async event=>{
      const file=event.target.files[0], version=++imageVersions[kind], accountRevision=revision;
      if(!file || !uid) return;
      const status=$(kind==='photo'?'#profile-status':'#style-settings-status');
      if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>1024*1024) { status.textContent='Choose a PNG, JPEG or WebP image under 1 MB.'; event.target.value=''; return; }
      try {
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
        const image=new Image();image.src=data;await image.decode();
        if(version!==imageVersions[kind] || accountRevision!==revision || !uid) return;
        if(kind==='photo'){crop.load(image);status.textContent='Position your photo, then Save profile.';return;}
        const canvas=document.createElement('canvas'),ratio=Math.min(1,640/image.width,640/image.height);canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const optimized=canvas.toDataURL('image/webp',.82);
        if(optimized.length>400000)throw new Error('Image is too large.');
        if(kind==='logo') logo=optimized; else photo=optimized;
        preview();status.textContent=`${name} preview updated. Save ${kind==='photo'?'profile':'style'} to keep it.`;
      } catch {if(version===imageVersions[kind] && accountRevision===revision) status.textContent='This image could not be opened. Choose another file.';}
    });
    $(`#remove-booking-${kind}`).addEventListener('click',()=>{
      imageVersions[kind]++; if(kind==='logo') logo=''; else {crop.clear();photo='';}
      $(`#booking-${kind}`).value='';preview();$(kind==='photo'?'#profile-status':'#style-settings-status').textContent=kind==='photo'?'Sign-in photo selected. Save profile to keep this change.':`${name} removed from preview. Save style to keep this change.`;
    });
  }
  document.addEventListener('crown-auth-change',async event => {
    if (uid === event.detail.uid) return;
    if (dialog.open) dialog.close();if($('#booking-readiness-dialog').open)$('#booking-readiness-dialog').close();if(availabilityDialog.open)availabilityDialog.close();if(pageDialog.open)pageDialog.close();if(profileDialog.open)profileDialog.close();if(displayDialog.open)displayDialog.close();window.CrownBusyPreview.setDisplay('global');
    $('#upcoming-bookings').hidden=true;$('#upcoming-bookings-list').replaceChildren();
    uid = event.detail.uid; displayName=event.detail.displayName || ''; userEmail=event.detail.email || ''; revision++; meetings=[]; savedData={}; removed=null; editingId=null;
    $('#meeting-page-name').value='';
    $('#destination-status').textContent='';window.CrownSettings.setDestination(null);$('#meeting-list-status').textContent=''; $('#undo-remove-meeting').hidden=true; renderMeetings();photo='';renderProfile();
    for (const selector of ['#meeting-settings','#style-settings','#workspace-auth-status']) $(selector).hidden = !uid;
    footerLinks.forEach(({link,href,text})=>{link.href=uid?link.dataset.workspaceHref:href;link.textContent=uid?link.dataset.workspaceLabel:text;});
    nav.forEach(({link,href,text},i) => { link.setAttribute('href',uid ? ['#sync-availability','#meeting-settings','#style-settings'][i] : href); link.textContent=uid ? ['Sync calendars','Meetings page','Your style'][i] : text; });
    $('#workspace-auth-status').textContent='';
    if (uid) {try{await load();await upcoming();}catch(error){$('#meeting-list-status').textContent=error.message;}} else { for (const field of fields) $(`#booking-${field}`).value=defaults[field]; logo=''; photo=''; $('#booking-logo').value=''; $('#booking-photo').value=''; preview(); }
  });
})();
