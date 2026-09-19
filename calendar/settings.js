(() => {
 const $=s=>document.querySelector(s),days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const timezone=window.CrownTimezone.create(null,'schedule-timezone');
 const oldZone=$('#schedule-timezone');oldZone.replaceWith(timezone.element);timezone.element.after(timezone.list);

 function time(value,label){const i=make('input');i.type='time';i.value=value;i.required=true;i.setAttribute('aria-label',label);return i;}
 function windowRow(parent,values=['09:00','17:00']){const row=make('div');row.className='hours-window';const remove=make('button','Remove');remove.type='button';remove.className='auth-link';remove.addEventListener('click',()=>row.remove());row.append(time(values[0],'Start time'),make('span','to'),time(values[1],'End time'),remove);parent.append(row);}
 function override(date='',values=[]){const row=make('div');row.className='date-override';const input=make('input');input.type='date';input.value=date;input.required=true;input.setAttribute('aria-label','Override date');const windows=make('div');windows.className='hours-windows';values.forEach(v=>windowRow(windows,v));const add=make('button','Add hours');add.type='button';add.className='auth-link';add.addEventListener('click',()=>windowRow(windows));const remove=make('button','Remove date');remove.type='button';remove.className='auth-link';remove.addEventListener('click',()=>row.remove());row.append(input,make('small','No hours = unavailable all day'),windows,add,remove);$('#date-overrides').append(row);}
 $('#add-date-override').addEventListener('click',()=>override());
 function apply(data){timezone.value=data.timezone;$('#schedule-slug').value=data.slug||'';$('#weekly-hours').replaceChildren();$('#date-overrides').replaceChildren();days.forEach((day,index)=>{const row=make('div');row.className='weekly-day';row.dataset.day=index+1;const windows=make('div');windows.className='hours-windows';(data.weekly?.[index+1]??(index<5?[['09:00','17:00']]:[])).forEach(v=>windowRow(windows,v));const add=make('button','+ Hours');add.type='button';add.className='auth-link';add.addEventListener('click',()=>windowRow(windows));row.append(make('strong',day),windows,add);$('#weekly-hours').append(row);});for(const [date,values] of Object.entries(data.exceptions||{}))override(date,values);destination=data.destination||null;renderDestinations();}
 function readWindows(parent){const values=[...parent.querySelectorAll('.hours-window')].map(row=>[...row.querySelectorAll('input')].map(i=>i.value));values.sort((a,b)=>a[0].localeCompare(b[0]));let end='';for(const pair of values){if(!pair[0]||!pair[1]||pair[0]>=pair[1]||pair[0]<end)throw Error('Hours must have an end after the start and cannot overlap.');end=pair[1];}return values;}
 function read(){const weekly={},exceptions={};for(const row of $('#weekly-hours').children)weekly[row.dataset.day]=readWindows(row);for(const row of $('#date-overrides').children){const date=row.querySelector('input[type=date]').value;if(!date||exceptions[date])throw Error('Choose a unique date for each override.');exceptions[date]=readWindows(row);}return {timezone:timezone.value,slug:$('#schedule-slug').value.trim(),weekly,exceptions};}
 $('#holiday-year').value=new Date().getFullYear();
 $('#import-holidays').addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;$('#schedule-status').textContent='Loading holiday dates...';
  try{const year=Number($('#holiday-year').value);if(!Number.isInteger(year)||year<2020||year>2100)throw Error('Choose a year from 2020 to 2100.');
   const response=await fetch('https://www.hebcal.com/hebcal?'+new URLSearchParams({v:'1',cfg:'json',year:String(year),maj:'on',yto:'on',i:$('#holiday-region').value}),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Holiday dates could not be loaded. Your saved overrides are unchanged.');const data=await response.json();
   const dates=new Set([...document.querySelectorAll('#date-overrides input[type=date]')].map(i=>i.value));let count=0;
   for(const item of data.items||[])if(/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&item.category==='holiday'&&item.yomtov&&!dates.has(item.date)){override(item.date,[]);dates.add(item.date);count++;}
   $('#schedule-status').textContent=`${count} holiday closures added. Review and Save availability.`;
  }catch(error){$('#schedule-status').textContent=error.message;}finally{button.disabled=false;}
 });
 let accounts=[],destination=null;
 function renderDestinations(){const select=$('#schedule-destination');select.replaceChildren();const empty=make('option','Choose a calendar for new bookings');empty.value='';select.append(empty);for(const account of accounts)for(const calendar of account.calendars.filter(c=>c.selected&&c.writable)){const option=make('option',`${account.email} / ${calendar.name}`);option.value=JSON.stringify({connectionId:account.id,calendarId:calendar.id});select.append(option);}const saved=destination?JSON.stringify(destination):'';if(saved&&![...select.options].some(o=>o.value===saved)){const missing=make('option','Saved calendar unavailable - reconnect or select another');missing.value=saved;missing.disabled=true;select.append(missing);}select.value=saved;renderMail();}
 const mailStatus=make('p'),mailButton=make('button');mailStatus.className='sync-small';mailStatus.setAttribute('role','status');mailButton.type='button';mailButton.className='auth-button';
 $('#destination-status').after(mailStatus,mailButton);mailStatus.hidden=true;mailButton.hidden=true;
 function renderMail(){
  const account=accounts.find(a=>a.id===destination?.connectionId),he=document.documentElement.lang.startsWith('he');
  mailStatus.hidden=!account;mailButton.hidden=!account||account.mailEnabled||account.provider==='ical';
  mailStatus.textContent=!account?'':account.mailEnabled?(he?'התראות על הזמנות יישלחו מחשבון יומן ההזמנות אל עצמו.':'Booking notifications are enabled for this destination account.'):(he?'רק חשבון יומן ההזמנות זקוק להרשאת שליחת אימייל. יומנים לבדיקת זמינות אינם זקוקים לה.':'Only the booking destination account needs email sending permission. Availability calendars do not.');
  mailButton.textContent=he?'הפעלת התראות באימייל':'Enable booking emails';
 }
 mailButton.addEventListener('click',async()=>{const account=accounts.find(a=>a.id===destination?.connectionId);if(!account)return;mailButton.disabled=true;try{await window.CrownAPI.connect(account.provider,account.id);}catch(e){mailStatus.textContent=e.message;}finally{mailButton.disabled=false;}});
 document.addEventListener('crown-calendars-change',e=>{accounts=e.detail.accounts;renderDestinations();});
 window.CrownSettings={apply,read,getAccountEmails(){return accounts.filter(account=>account.provider!=='ical').map(account=>account.email);},setDestination(value){destination=value;renderDestinations();}};
})();

