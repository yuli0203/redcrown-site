(async()=>{
 'use strict';
 if(!await window.CrownAPI.ready){if(window.CrownAPI.configured)document.addEventListener('crown-auth-change',e=>{document.querySelector('#sync-availability').hidden=!e.detail.uid;document.querySelector('#sync-message').textContent=window.CrownAPI.error;});return;}
 const $=s=>document.querySelector(s),api=window.CrownAPI;
 let uid=null,accounts=[],revision=0,refreshVersion=0,working=false,range=null;
 const reconnectNeeded=new Set();
 const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
 const message=text=>$('#sync-message').textContent=text;
 const button=(label,fn)=>{const b=node('button',label,'auth-button');b.type='button';b.disabled=working;b.addEventListener('click',async()=>{try{await fn();}catch(e){message(e.message);}});return b;};
 function render(){
  $('#calendar-accounts').replaceChildren();$('#sync-empty').hidden=accounts.length>0;
  $('#refresh-availability').disabled=working||!accounts.some(a=>a.calendars.some(c=>c.selected));
  $('#connect-google-calendar').disabled=working||!api.config.google;$('#connect-microsoft-calendar').disabled=working||!api.config.microsoft;
  $('.sync-footnote').textContent='Connections are saved securely for your account. Availability refreshes automatically while this page is open and is checked again when someone books.';
  for(const account of accounts){
   const card=node('article','','calendar-account'),heading=node('div','','calendar-account-heading'),info=node('div');info.append(node('h2',account.email),node('p',`${account.provider==='ical'?'Calendar link (read only)':account.provider==='google'?'Google Calendar':'Microsoft Outlook'}${account.provider==='ical'?' - provider updates may be delayed':' - persistent connection'}`,'sync-small'));
   const actions=node('div','','calendar-account-actions');
   actions.append(button('Edit calendars',()=>edit(card,account)));
   if(reconnectNeeded.has(account.id))actions.append(button('Reconnect',()=>connect(account.provider)));
   const menu=node('details','','calendar-account-menu'),toggle=node('summary','⋯');toggle.setAttribute('aria-label',`More options for ${account.email}`);toggle.title='More options';
   const items=node('div','','calendar-account-menu-items');
   items.append(button('Refresh calendar list',async()=>{menu.open=false;try{await api.request('/connections/'+account.id+'/refresh',{method:'POST',data:{}});await load();await refresh();}catch(e){if(/reconnect|authorization expired/i.test(e.message))reconnectNeeded.add(account.id);render();throw e;}}),button('Disconnect account',async()=>{menu.open=false;await api.request('/connections/'+account.id,{method:'DELETE'});reconnectNeeded.delete(account.id);await load();await refresh();}));
   menu.append(toggle,items);actions.append(menu);
   heading.append(info,actions);card.append(heading,node('p',`${account.calendars.filter(c=>c.selected).length} calendar${account.calendars.filter(c=>c.selected).length===1?'':'s'} selected`,'sync-small'));const selected=node('p',account.calendars.filter(c=>c.selected).map(c=>c.name).join(' / ')||'Choose Edit calendars, then Save selection to start checking availability.','sync-small');card.append(selected);$('#calendar-accounts').append(card);
   if(!working&&!account.calendars.some(c=>c.selected))edit(card,account);
  }
  document.dispatchEvent(new CustomEvent('crown-calendars-change',{detail:{accounts}}));
 }
 function edit(card,account){
  if(card.querySelector('fieldset'))return;
  const field=node('fieldset');field.append(node('legend','Choose calendars to check for conflicts'));
  for(const calendar of account.calendars){const label=node('label','','calendar-choice'),input=node('input');input.type='checkbox';input.value=calendar.id;input.checked=calendar.selected;label.append(input,node('span',calendar.name),node('small',calendar.missing?'Unavailable - deselect or restore access':calendar.writable?'Can add bookings':'Read only'));field.append(label);}
  const controls=node('div','','calendar-edit-actions');controls.append(button('Save selection',async()=>{const selected=[...field.querySelectorAll('input:checked')].map(i=>i.value);await api.request('/connections/'+account.id,{method:'PUT',data:{selected}});await load();await refresh();}),button('Cancel',()=>field.remove()));field.append(controls);card.append(field);
 }
 async function connect(provider){working=true;render();try{await api.connect(provider);}finally{working=false;render();}}
 async function load(){const current=revision,result=await api.request('/connections');if(current!==revision)return;accounts=result.accounts;render();}
 async function refresh(){
  if(!uid||working)return;const current=revision,requestVersion=++refreshVersion;
  working=true;render();message('Checking calendars...');
  try{await load();if(current!==revision||requestVersion!==refreshVersion)return;if(!accounts.some(a=>a.calendars.some(c=>c.selected))){window.CrownBusyPreview.clear();$('#sync-summary-text').textContent='Select calendars to check availability.';message('Add a calendar account, then choose which calendars to sync.');return;}const now=new Date(),start=range?.start??+new Date(now.getFullYear(),now.getMonth(),1),end=range?.end??+new Date(now.getFullYear(),now.getMonth()+1,1);const result=await api.request(`/availability?start=${start}&end=${end}`);if(current!==revision||requestVersion!==refreshVersion)return;reconnectNeeded.clear();window.CrownBusyPreview.update(result.busy,start,end,result.events);$('#sync-summary-text').textContent=`Last synced at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.`;message('');}
  catch(e){if(current===revision&&requestVersion===refreshVersion){if(e.connectionId&&/reconnect|authorization expired/i.test(e.message))reconnectNeeded.add(e.connectionId);window.CrownBusyPreview.clear();$('#sync-summary-text').textContent='Availability could not be checked. Refresh or reconnect the affected calendar.';message(e.message);}}
  finally{if(current===revision&&requestVersion===refreshVersion){working=false;render();}}
 }

 const feedDialog=node('dialog','','calendar-feed-dialog');
 feedDialog.innerHTML='<form><h2>Add calendar by link</h2><p>Use a published ICS link to block busy times. This connection is read only. Keep a connected Google or Outlook calendar as the destination for new bookings.</p><details><summary>Outlook instructions</summary><ol><li>Open Outlook on the web, then Settings → Calendar → Shared calendars.</li><li>Under Publish a calendar, choose the calendar and the least detailed permission available, preferably availability only.</li><li>Select Publish and copy the ICS link, not the HTML link.</li></ol><p>If publishing is unavailable, your organization requires IT approval. We cannot bypass that policy.</p><a href="https://support.microsoft.com/en-us/outlook/sharing/share-an-outlook-calendar-as-view-only-with-others" target="_blank" rel="noopener noreferrer">Microsoft instructions</a></details><details><summary>Google instructions</summary><ol><li>On Google Calendar on the web, open Settings and select your calendar.</li><li>Open Integrate calendar and copy Secret address in iCal format.</li><li>Paste it below. Do not make your calendar public just for this connection.</li></ol><p>If the secret address is missing, ask your organization administrator about permitted sharing.</p><a href="https://support.google.com/calendar/answer/37648?hl=en" target="_blank" rel="noopener noreferrer">Google instructions</a></details><label>Calendar name<input name="calendarName" maxlength="80" required placeholder="Work calendar"></label><label>Private ICS link<input name="feedUrl" type="password" autocomplete="off" maxlength="3000" required placeholder="Paste the ICS link"></label><p>Anyone with this link may be able to read the published calendar. We store it encrypted and display events only as Busy. Updates depend on your provider and may be delayed. Add each calendar separately.</p><p role="status" class="feed-status"></p><div class="calendar-edit-actions"><button type="submit" class="primary">Connect calendar</button><button type="button" class="auth-button feed-close">Cancel</button></div></form>';
 const feedZone=window.CrownTimezone.create(Intl.DateTimeFormat().resolvedOptions().timeZone,'feed-timezone');
 const zoneLabel=node('label','Calendar time zone');zoneLabel.append(feedZone.element,feedZone.list);feedDialog.querySelector('.feed-status').before(zoneLabel);
 document.body.append(feedDialog);
 $('#calendar-providers').append(button('Add calendar by link',()=>feedDialog.showModal()));
 feedDialog.querySelector('.feed-close').addEventListener('click',()=>feedDialog.close());
 feedDialog.addEventListener('close',()=>{feedDialog.querySelector('form').reset();feedZone.value=Intl.DateTimeFormat().resolvedOptions().timeZone;feedDialog.querySelector('.feed-status').textContent='';});
 feedDialog.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,submit=form.querySelector('[type=submit]'),status=form.querySelector('.feed-status');submit.disabled=true;status.textContent='Checking calendar link...';try{await api.request('/connections/feed',{method:'POST',data:{name:form.elements.calendarName.value.trim(),url:form.elements.feedUrl.value.trim(),timezone:feedZone.value}});feedDialog.close();await load();await refresh();}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
 $('#add-calendar').addEventListener('click',()=>{$('#calendar-providers').hidden=!$('#calendar-providers').hidden;$('#add-calendar').setAttribute('aria-expanded',String(!$('#calendar-providers').hidden));});
 $('#connect-google-calendar').addEventListener('click',()=>connect('google').catch(e=>message(e.message)));
 $('#connect-microsoft-calendar').addEventListener('click',()=>connect('microsoft').catch(e=>message(e.message)));
 $('#refresh-availability').addEventListener('click',refresh);
 document.addEventListener('crown-calendar-month',e=>{range=e.detail;refreshVersion++;working=false;refresh();});
 document.addEventListener('crown-auth-change',async e=>{uid=e.detail.uid;revision++;refreshVersion++;accounts=[];reconnectNeeded.clear();working=false;range=null;$('#sync-availability').hidden=!uid;document.body.classList.toggle('is-signed-in',Boolean(uid));window.CrownBusyPreview.clear();render();if(uid)try{await load();await refresh();}catch(e){message(e.message);}});
 document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('.calendar-account-menu[open]'))if(!menu.contains(event.target))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const menu of document.querySelectorAll('.calendar-account-menu[open]')){menu.open=false;menu.querySelector('summary').focus();}});
 setInterval(()=>{if(!document.hidden&&!$('#calendar-accounts fieldset')&&!$('#calendar-accounts details[open]'))refresh();},5*60000);
})();
