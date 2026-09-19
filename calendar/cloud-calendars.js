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
   const card=node('article','','calendar-account'),heading=node('div','','calendar-account-heading'),info=node('div');info.append(node('h2',account.email),node('p',`${account.provider==='google'?'Google Calendar':'Microsoft Outlook'} - persistent connection`,'sync-small'));
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
