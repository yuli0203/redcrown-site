(async()=>{
 if(/^#(?:%7B|\{)/i.test(location.hash) && !new URLSearchParams(location.search).has('booking') && !new URLSearchParams(location.search).has('reschedule'))return;
 const $=s=>document.querySelector(s),query=new URLSearchParams(location.search),api=window.CrownAPI;let originalGuest=null;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const error=text=>{$('#page-error').textContent=text;};
 const step=value=>document.querySelectorAll('[data-step]').forEach(item=>{if(Number(item.dataset.step)===value)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
 const button=(text,fn)=>{const b=make('button',text,'booking-button');b.type='button';b.addEventListener('click',fn);return b;};
 const call=(path,method='GET',data)=>api.request(path,{method,data,publicRequest:true,bookingToken:query.has('reschedule')?location.hash.slice(1):undefined});
 $('header>span').textContent='Book a meeting';$('.preview-notice').hidden=true;$('#page-description').textContent='Choose a meeting and a time that works for you.';
 try{
  if(!await api.ready)throw Error('Online booking is not connected yet. Please contact the host.');
  if(query.has('booking')){await manage();return;}
  const slug=query.get('user');if(!slug)throw Error('This booking link is incomplete.');
  const host=await call('/public/'+encodeURIComponent(slug));
  document.title=`Meet with ${host.pageName} | Red Crown Calendar`;
  if(!query.get('meeting')){document.body.classList.add('booking-landing');$('#page-description').textContent='Choose a meeting type below. Available times are checked against the host calendar.';}
  if(query.has('reschedule')){originalGuest=await call(`/booking/${encodeURIComponent(query.get('reschedule'))}?token=${encodeURIComponent(location.hash.slice(1))}`);if(originalGuest.status!=='confirmed')throw Error('This booking is no longer available to reschedule. Return to its management link.');$('header>span').textContent='Reschedule a meeting';$('#page-description').textContent='Choose a new time. Your current booking stays reserved until the change is confirmed.';}
  for(const [key,variable] of [['accent','--page-accent'],['background','--page-bg'],['text','--page-text']])document.documentElement.style.setProperty(variable,host[key]);
  for(const kind of ['logo','photo'])if(host[kind]){const image=make('img');image.referrerPolicy='no-referrer';image.src=host[kind];image.alt=kind==='logo'?'Host logo':'Host profile photo';image.className='host-'+kind;$('#host-name').before(image);}
  $('#host-name').textContent=`Meet with ${host.pageName}`;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const meetings=host.meetings.filter(m=>!query.get('meeting')||m.id===query.get('meeting'));
  if(!meetings.length)throw Error('This meeting is no longer available. Please contact the host for an updated booking link.');
  for(const meeting of meetings){
   const card=make('section','','public-meeting'),summary=make('div','','meeting-summary');summary.append(make('h2',meeting.title),make('p',`${meeting.duration} minutes${meeting.location?' - '+meeting.location:''}`,'meeting-meta'),make('p',meeting.description));
   card.append(summary);
   const link=make('a','Choose a time →','booking-button');link.href=`/calendar/meet/?user=${encodeURIComponent(slug)}&meeting=${encodeURIComponent(meeting.id)}`;
   if(!query.get('meeting'))summary.append(link);$('#public-meetings').append(card);
   if(query.get('meeting')){document.body.classList.add('booking-detail');step(2);const back=make('a','← Back to meeting types','booking-button booking-back');back.href=query.has('reschedule')?`/calendar/meet/?booking=${encodeURIComponent(query.get('reschedule'))}#${location.hash.slice(1)}`:`/calendar/meet/?user=${encodeURIComponent(slug)}`;if(query.has('reschedule'))back.textContent='← Back to your booking';const identity=make('div','','booking-host-identity');
    const logo=$('.host-logo')||make('img');if(!logo.src){logo.src='/assets/logo-kit/redcrown-primary-scarlet.svg';logo.alt='Red Crown Interactive';}logo.className='booking-sidebar-logo';
    const logoPanel=make('div','','booking-sidebar-brand');logoPanel.append(logo);
    const portrait=$('.host-photo');if(portrait)identity.append(portrait);else{const initial=make('span',host.pageName.slice(0,1).toUpperCase(),'booking-host-initial');initial.setAttribute('aria-hidden','true');identity.append(initial);}
    const hostName=$('#host-name');hostName.textContent=host.pageName;identity.append(hostName);
    $('#main').prepend(back);summary.prepend(logoPanel,identity);
    const help=make('div','','booking-sidebar-help');for(const [text,path] of [['Privacy','privacy'],['Booking help','support']]){const a=make('a',text);a.href='/calendar/legal/#'+path;help.append(a);}summary.append(help);
    await showScheduler(card,meeting,slug,zone,host.calendarDisplay,host.timezone);}
  }
 }catch(e){error(e.message);const retry=button('Try again',()=>location.reload());$('#page-error').append(document.createElement('br'),retry);}
 async function showScheduler(card,meeting,slug,initialZone,calendarDisplay,hostZone){
  card.querySelector('.booking-scheduler')?.remove();const panel=make('div','','booking-scheduler');card.append(panel);let revision=0;
  const today=new Date(),firstMonth=new Date(today.getFullYear(),today.getMonth(),1);let month=new Date(firstMonth),selectedDate='',currentSlots=[],guestDraft={...originalGuest};
  const dateKey=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  const inZone=stamp=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone.value,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp));return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');};
  const label=make('label','Your time zone'),zone=window.CrownTimezone.create(initialZone);label.append(zone.element,zone.list);
  const controls=make('div','','booking-controls'),status=make('p','','booking-status'),grid=make('div','','booking-slot-grid'),days=make('div','','booking-month-grid'),formArea=make('div'),monthTitle=make('h3'),dayTitle=make('h3','Select an available date'),zoneNote=make('p','','booking-status');status.setAttribute('role','status');
  const previous=button('Previous month',()=>{month.setMonth(month.getMonth()-1);load();}),next=button('Next month',()=>{month.setMonth(month.getMonth()+1);load();}),nav=make('div','','booking-month-nav');previous.textContent='‹';previous.setAttribute('aria-label','Previous month');next.textContent='›';next.setAttribute('aria-label','Next month');nav.append(previous,monthTitle,next);
  const weekStart=calendarDisplay==='saturday'?6:['israel','us'].includes(calendarDisplay)?0:1;
  const formatLabel=make('label','Time format'),timeFormat=make('select');for(const [value,text] of [['24','24-hour'],['12','12-hour']]){const option=make('option',text);option.value=value;timeFormat.append(option);}timeFormat.value=calendarDisplay==='us'?'12':'24';formatLabel.append(timeFormat);
  const weekdays=make('div','','booking-weekdays');for(let i=0;i<7;i++)weekdays.append(make('span',['SUN','MON','TUE','WED','THU','FRI','SAT'][(weekStart+i)%7]));weekdays.setAttribute('aria-hidden','true');
  const calendar=make('section','','booking-month'),times=make('section','','booking-times'),layout=make('div','','booking-calendar-layout');calendar.setAttribute('aria-label','Choose a meeting date');calendar.append(nav,weekdays,days);times.append(dayTitle,zoneNote,grid);layout.append(calendar,times);
  controls.append(label,formatLabel);timeFormat.addEventListener('change',()=>{days.querySelector('[aria-pressed=true]')?.click();});calendar.append(controls);const panelHeading=make('h2','Select a date and time','booking-panel-title');const retryAvailability=button('Retry availability',()=>load());retryAvailability.hidden=true;panel.append(panelHeading,status,retryAvailability,layout,formArea);zone.addEventListener('change',()=>{selectedDate='';load();});await load();
  async function load(){
   step(2);panelHeading.textContent='Select a date and time';layout.hidden=false;retryAvailability.hidden=true;const current=++revision;status.textContent='Checking availability...';panel.setAttribute('aria-busy','true');grid.replaceChildren();days.replaceChildren();formArea.replaceChildren();monthTitle.textContent=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});previous.disabled=month<=firstMonth;
   const maxMonth=new Date(today);maxMonth.setDate(maxMonth.getDate()+(meeting.horizon||365));next.disabled=month.getFullYear()===maxMonth.getFullYear()&&month.getMonth()>=maxMonth.getMonth()||month>maxMonth;
   dayTitle.textContent='Select an available date';zoneNote.textContent=`Times shown in ${zone.value.replaceAll('_',' ')}.${hostZone&&hostZone!==zone.value?' Host schedule: '+hostZone.replaceAll('_',' ')+'.':''}`;
   try{
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const result=await call(`/public/${encodeURIComponent(slug)}/slots?${new URLSearchParams({meeting:meeting.id,from:dateKey(month),days:String(count),timezone:zone.value,...(query.has('reschedule')?{previousId:query.get('reschedule')}:{})})}`);
    if(current!==revision||!panel.isConnected)return;currentSlots=result.slots;
    status.textContent=currentSlots.length?'Highlighted dates have available times. Faded dates are unavailable.':'No available times this month. Try another month or contact the host.';
    const groups=new Map();for(const slot of currentSlots){const key=inZone(slot.start);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(slot);}
    for(let i=0;i<(month.getDay()-weekStart+7)%7;i++)days.append(make('span'));
    function choose(key,b){step(2);selectedDate=key;grid.replaceChildren();formArea.replaceChildren();for(const item of days.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===b));dayTitle.textContent=new Date(key+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});for(const slot of groups.get(key)){const text=new Date(slot.start).toLocaleTimeString(undefined,{timeZone:zone.value,hour:'2-digit',minute:'2-digit',hour12:timeFormat.value==='12'});const time=button(text,()=>{for(const item of grid.children)item.setAttribute('aria-pressed',String(item===time));bookingForm(slot);});grid.append(time);}}
    let first=null,selected=null;
    for(let day=1;day<=count;day++){const value=new Date(month.getFullYear(),month.getMonth(),day),key=dateKey(value),b=button(String(day),()=>choose(key,b));b.disabled=!groups.has(key);b.setAttribute('aria-label',`${value.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}${b.disabled?' - unavailable':' - available'}`);b.setAttribute('aria-pressed','false');if(key===inZone(Date.now()))b.setAttribute('aria-current','date');days.append(b);if(!b.disabled&&!first)first={key,b};if(key===selectedDate&&!b.disabled)selected={key,b};}
    const pick=selected||first;if(pick)choose(pick.key,pick.b);
   }catch(e){if(current===revision){status.textContent=e.message;grid.replaceChildren();retryAvailability.hidden=false;}}finally{if(current===revision)panel.removeAttribute('aria-busy');}
  }
  function bookingForm(slot){
   step(3);layout.hidden=true;panelHeading.textContent='Complete your booking';status.textContent='Enter your details to confirm this time.';formArea.replaceChildren();const form=make('form','','guest-form'),heading=make('h3',new Date(slot.start).toLocaleString(undefined,{timeZone:zone.value,dateStyle:'full',timeStyle:'short'}));form.append(button('← Back to date and time',()=>{formArea.replaceChildren();layout.hidden=false;step(2);panel.querySelector('.booking-panel-title').textContent='Select a date and time';status.textContent='Choose a date, then an available time.';grid.querySelector('[aria-pressed=true]')?.focus();}),make('h2','Your details'),heading,make('p',`${meeting.duration} minutes - ${zone.value.replaceAll('_',' ')}${meeting.location?' - '+meeting.location:''}`,'booking-status'));
   const inputs={};for(const [key,title,type,max] of [['name','Your name','text',100],['email','Email address','email',254],['notes','Anything the host should know? (optional)','text',2000]]){const label=make('label',title),input=make(key==='notes'?'textarea':'input');if(key!=='notes')input.type=type;input.required=key!=='notes';input.maxLength=max;input.autocomplete=key==='notes'?'off':key;label.append(input);form.append(label);inputs[key]=input;if(guestDraft[key])input.value=guestDraft[key];input.addEventListener('input',()=>{guestDraft[key]=input.value;input.setCustomValidity('');});}
   const participantsLabel=make('label','Additional participants (optional)'),participantsInput=make('input');participantsInput.type='email';participantsInput.multiple=true;participantsInput.maxLength=2550;participantsInput.placeholder='alex@example.com, sam@example.com';participantsInput.value=Array.isArray(guestDraft.participants)?guestDraft.participants.join(', '):(guestDraft.participants||'');participantsInput.addEventListener('input',()=>{guestDraft.participants=participantsInput.value;participantsInput.setCustomValidity('');});participantsLabel.append(participantsInput,make('small','Separate addresses with commas. Up to 10 people. Invitees may see each other’s email addresses, meeting details and the management link. Only add people you intend to invite.'));form.append(participantsLabel);inputs.participants=participantsInput;
   const policy=make('p','Your name, email and booking details will be shared with the host and their calendar provider. By confirming, you agree to the ','booking-status');
   const terms=make('a','Red Crown Calendar Terms');terms.href='/calendar/legal/#terms';const privacy=make('a','Privacy Policy');privacy.href='/calendar/legal/#privacy';policy.append(terms,document.createTextNode('. Read our '),privacy,document.createTextNode('.'));form.append(policy);
   const captcha=make('div'),notice=make('p','','booking-status'),submit=make('button',query.has('reschedule')?'Confirm new time':'Confirm booking','booking-button');submit.type='submit';notice.setAttribute('role','status');form.append(captcha,submit,notice);formArea.append(form);let requestId=crypto.randomUUID(),captchaToken='',widget=null,pendingPayload=null;
   if(api.config.turnstileSiteKey){loadTurnstile().then(()=>{if(!form.isConnected)return;widget=window.turnstile.render(captcha,{sitekey:api.config.turnstileSiteKey,callback:token=>captchaToken=token,'expired-callback':()=>captchaToken='','error-callback':()=>{captchaToken='';notice.textContent='Verification failed to load. Check your connection and try again.';}});}).catch(()=>notice.textContent='Booking verification could not load. Please refresh.');}
   form.addEventListener('submit',async event=>{event.preventDefault();inputs.name.setCustomValidity(inputs.name.value.trim()?'':'Enter your name.');const participantEmails=participantsInput.value.split(',').map(email=>email.trim()).filter(Boolean);participantsInput.setCustomValidity(participantEmails.length>10?'Add up to 10 additional participants.':'');if(!form.reportValidity())return;if(api.config.turnstileSiteKey&&!captchaToken){notice.textContent='Complete the security verification before booking.';return;}submit.disabled=true;notice.textContent='Confirming with the calendar...';try{pendingPayload??={inviteeTimezone:zone.value,meetingId:meeting.id,start:slot.start,requestId,name:inputs.name.value.trim(),email:inputs.email.value.trim(),notes:inputs.notes.value,participants:participantEmails,...(query.has('reschedule')?{previousId:query.get('reschedule'),rescheduleToken:location.hash.slice(1)}:{})};for(const input of Object.values(inputs))input.readOnly=true;form.querySelector('button[type=button]').disabled=true;const result=await call(`/public/${encodeURIComponent(slug)}/book`,'POST',{...pendingPayload,turnstileToken:captchaToken});step(4);form.classList.add('booking-confirmed');form.replaceChildren(make('span','✓','confirmation-check'),make('h2',query.has('reschedule')?'Your meeting has been rescheduled':'Your meeting is confirmed'),make('p',new Date(result.start).toLocaleString(undefined,{timeZone:zone.value,dateStyle:'full',timeStyle:'short'})),make('p',meeting.title),make('p',`A calendar invitation has been requested for ${inputs.email.value.trim()}. Check your inbox and spam folder. You can also add the meeting to your calendar below.`),make('p',meeting.location||'Location details are provided by your host.'));const manage=make('a','Manage or cancel booking','booking-button');manage.href=`/calendar/meet/?booking=${encodeURIComponent(result.id)}#${result.manageToken}`;if(pendingPayload.participants.length)form.append(make('p',`Additional invitations requested: ${[...new Set(pendingPayload.participants.map(email=>email.toLowerCase()))].filter(email=>email!==pendingPayload.email.toLowerCase()).join(', ')}`));form.append(manage,calendarDownload(meeting,result));status.textContent='Booking confirmed.';panel.querySelector('.booking-panel-title').textContent='You are booked';layout.hidden=true;controls.hidden=true;}catch(e){notice.textContent=e.message;if(widget!==null){window.turnstile.reset(widget);captchaToken='';}if(e.status&&e.status<500){pendingPayload=null;for(const input of Object.values(inputs))input.readOnly=false;form.querySelector('button[type=button]').disabled=false;if(e.status===409){requestId=crypto.randomUUID();notice.append(button('Choose another available time',()=>{formArea.replaceChildren();panelHeading.textContent='Select a date and time';load();}));}}else{notice.textContent+=' Your details are kept unchanged so retrying cannot create a different booking.';submit.textContent='Retry booking confirmation';}}finally{submit.disabled=false;}});
   inputs.name.focus();
  }
 }
 async function manage(){
  step(4);document.body.classList.add('booking-management');
  const id=query.get('booking'),token=location.hash.slice(1);
  const result=await call(`/booking/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
  $('#host-name').textContent=result.status==='cancelled'?'Meeting cancelled':'Your booking';
  $('#page-description').textContent='Review your meeting details and manage your appointment.';
  const card=make('section','','public-meeting booking-management-card'),zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  card.append(make('h2',result.title),make('p',new Date(result.start).toLocaleString(undefined,{timeZone:zone,dateStyle:'full',timeStyle:'short'})),make('p',`${Math.round((result.end-result.start)/60000)} minutes - ${zone.replaceAll('_',' ')}`),make('p',result.location||'Contact the host for location details.'),make('p',`Booking status: ${result.status}`,'management-state'));
  $('#public-meetings').append(card);if(result.participants?.length)card.append(make('p','Additional participants: '+result.participants.join(', ')));
  if(result.status==='confirmed'){
   card.append(calendarDownload(result,result));
   if(result.slug){const link=make('a','Choose a new time','booking-button');link.href=`/calendar/meet/?user=${encodeURIComponent(result.slug)}&meeting=${encodeURIComponent(result.meetingId)}&reschedule=${encodeURIComponent(id)}#${token}`;card.append(link);}
  }
  if(['confirmed','cancelling'].includes(result.status)){
   const confirmation=make('div','','cancel-confirmation');confirmation.hidden=true;
   confirmation.append(make('p','Cancel this meeting? The host will be notified through their calendar.'));
   const notice=make('p','','booking-status');notice.setAttribute('role','status');
   const opener=button(result.status==='cancelling'?'Retry cancellation':'Cancel booking',()=>{confirmation.hidden=false;confirm.focus();});
   const keep=button('Keep meeting',()=>{confirmation.hidden=true;opener.focus();});
   const confirm=button('Yes, cancel meeting',async()=>{confirm.disabled=true;keep.disabled=true;notice.textContent='Cancelling with the calendar...';try{await call(`/booking/${encodeURIComponent(id)}/cancel`,'POST',{token});$('#host-name').textContent='Meeting cancelled';card.querySelector('.management-state').textContent='This meeting has been cancelled.';for(const action of card.querySelectorAll('.booking-button'))action.remove();confirmation.remove();}catch(e){notice.textContent=e.message;confirm.disabled=false;keep.disabled=false;}});
   confirmation.append(confirm,keep,notice);card.append(opener,confirmation);
  }
 }
 function calendarDownload(meeting,booking){
  const section=make('section','','calendar-add-options');section.setAttribute('aria-label','Add to your calendar');section.append(make('h3','Add to your calendar'));
  const links=window.CrownCalendarFile.links(meeting,booking),choices=make('div','','calendar-add-links');
  for(const [provider,label] of [['google','Google Calendar'],['outlook','Outlook.com'],['microsoft365','Microsoft 365']]){const link=make('a',label,'booking-button');link.href=links[provider];link.target='_blank';link.rel='noopener noreferrer';choices.append(link);}
  const text=window.CrownCalendarFile.create(meeting,booking),url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'})),download=make('a','Download .ics file','booking-button');download.href=url;download.download='red-crown-meeting.ics';choices.append(download);window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
  section.append(choices,make('p','Choose your calendar, then save the prefilled event. For Apple Calendar or a desktop calendar app, download the .ics file and open or import it.','booking-status'),make('p','Already accepted the email invitation? You do not need to add another copy. Manually added copies may not receive later changes or cancellations.','booking-status'));return section;
 }
 let turnstilePromise;function loadTurnstile(){return turnstilePromise??=new Promise((resolve,reject)=>{if(window.turnstile)return resolve();const script=make('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=resolve;script.onerror=reject;document.head.append(script);});}
})();
