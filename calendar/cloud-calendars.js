(async()=>{
 'use strict';
 if(!await window.CrownAPI.ready)return;
 const $=s=>document.querySelector(s),api=window.CrownAPI;
 let uid=null,accounts=[],revision=0,refreshVersion=0,working=false,range=null;
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
   actions.append(button('Edit calendars',()=>edit(card,account)),button('Reconnect',()=>connect(account.provider)),button('Remove',async()=>{await api.request('/connections/'+account.id,{method:'DELETE'});await load();await refresh();}));heading.append(info,actions);card.append(heading,node('p',`${account.calendars.filter(c=>c.selected).length} calendars selected`,'sync-small'));$('#calendar-accounts').append(card);
  }
  document.dispatchEvent(new CustomEvent('crown-calendars-change',{detail:{accounts}}));
 }
 function edit(card,account){
  if(card.querySelector('fieldset'))return;
  const field=node('fieldset');field.append(node('legend','Choose calendars to check for conflicts'));
  for(const calendar of account.calendars){const label=node('label','','calendar-choice'),input=node('input');input.type='checkbox';input.value=calendar.id;input.checked=calendar.selected;label.append(input,node('span',calendar.name),node('small',calendar.writable?'Can add bookings':'Read only'));field.append(label);}
  const controls=node('div','','calendar-edit-actions');controls.append(button('Save selection',async()=>{const selected=[...field.querySelectorAll('input:checked')].map(i=>i.value);await api.request('/connections/'+account.id,{method:'PUT',data:{selected}});await load();await refresh();}),button('Cancel',()=>field.remove()));field.append(controls);card.append(field);
 }
 async function connect(provider){working=true;render();try{const result=await api.request('/connect/'+provider,{method:'POST',data:{}});location.assign(result.url);}finally{working=false;render();}}
 async function load(){const current=revision,result=await api.request('/connections');if(current!==revision)return;accounts=result.accounts;render();}
 async function refresh(){
  if(!uid||working)return;const current=revision,requestVersion=++refreshVersion;
  if(!accounts.some(a=>a.calendars.some(c=>c.selected))){window.CrownBusyPreview.clear();message('Add a calendar account, then choose which calendars to sync.');return;}
  working=true;render();message('Checking calendars...');
  try{const now=new Date(),start=range?.start??+new Date(now.getFullYear(),now.getMonth(),1),end=range?.end??+new Date(now.getFullYear(),now.getMonth()+1,1);const result=await api.request(`/availability?start=${start}&end=${end}`);if(current!==revision||requestVersion!==refreshVersion)return;window.CrownBusyPreview.update(result.busy,start,end,result.events);$('#sync-summary-text').textContent=`Calendars checked at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.`;message('');}
  catch(e){if(current===revision&&requestVersion===refreshVersion){window.CrownBusyPreview.clear();message(e.message);}}
  finally{if(current===revision&&requestVersion===refreshVersion){working=false;render();}}
 }
 $('#add-calendar').addEventListener('click',()=>{$('#calendar-providers').hidden=!$('#calendar-providers').hidden;$('#add-calendar').setAttribute('aria-expanded',String(!$('#calendar-providers').hidden));});
 $('#connect-google-calendar').addEventListener('click',()=>connect('google').catch(e=>message(e.message)));
 $('#connect-microsoft-calendar').addEventListener('click',()=>connect('microsoft').catch(e=>message(e.message)));
 $('#refresh-availability').addEventListener('click',refresh);
 document.addEventListener('crown-calendar-month',e=>{range=e.detail;refreshVersion++;working=false;refresh();});
 document.addEventListener('crown-auth-change',async e=>{uid=e.detail.uid;revision++;refreshVersion++;accounts=[];working=false;range=null;$('#sync-availability').hidden=!uid;document.body.classList.toggle('is-signed-in',Boolean(uid));window.CrownBusyPreview.clear();render();if(uid)try{await load();await refresh();}catch(e){message(e.message);}});
 setInterval(()=>{if(!document.hidden&&!$('#calendar-accounts fieldset'))refresh();},5*60000);
})();
