(() => {
  'use strict';
  if(!/^#(?:%7B|\{)/i.test(location.hash) || (new URLSearchParams(location.search).has('booking') || new URLSearchParams(location.search).has('reschedule')))return;
  const $=selector=>document.querySelector(selector);
  try {
    if(location.hash.length>100000) throw new Error();
    const data=JSON.parse(decodeURIComponent(location.hash.slice(1)));
    if(data.v!==1 || typeof data.name!=='string' || data.name.length>60 || !Array.isArray(data.meetings)) throw new Error();
    const valid=m=>m && typeof m.title==='string' && m.title.length<=80 && typeof m.description==='string' && m.description.length<=500 && Number.isInteger(m.duration) && m.duration>=1 && m.duration<=480;
    if(!data.meetings.every(valid)) throw new Error();
    window.CrownBookingStyle.apply(data);
    $('.preview-notice').textContent='This is an old static preview link, not a live booking page. Ask the host for their published booking link.';
    const setup=document.createElement('a');setup.href='/calendar/#meeting-settings';setup.className='booking-button';setup.textContent='Host: open booking setup';$('.preview-notice').append(document.createElement('br'),setup);
    $('.booking-progress').hidden=true;
    $('#host-name').textContent=`Meet with ${data.name}`;
    if(!data.meetings.length) $('#page-description').textContent='No meetings have been added to this preview yet.';
    const current=new URL(location.href),selected=current.searchParams.get('previewMeeting');
    const entries=data.meetings.map((meeting,index)=>({meeting,index})).filter(item=>selected===null||String(item.index)===selected);
    if(selected!==null&&!entries.length)throw Error();
    $('#page-description').textContent=data.meetings.length?'Choose a meeting type.':'No meetings have been added to this preview yet.';
    for(const {meeting,index} of entries){
      const card=document.createElement('section');card.className='public-meeting';
      const title=document.createElement('h2');title.textContent=meeting.title;
      const duration=document.createElement('p');duration.textContent=`${meeting.duration} minutes`;
      const description=document.createElement('p');description.textContent=meeting.description;
      card.append(title,duration,description);
      const link=document.createElement('a');link.className='booking-button';const url=new URL(current);
      if(selected===null){url.searchParams.set('previewMeeting',String(index));link.textContent='View meeting';}
      else{url.searchParams.delete('previewMeeting');link.textContent='All meeting types';const note=document.createElement('p');note.className='booking-status';note.textContent='This snapshot cannot accept bookings. The host must publish the page and share its live link.';card.append(note);}
      link.href=url.href;card.append(link);$('#public-meetings').append(card);
    }
  } catch { $('#page-error').textContent='This preview link is incomplete or invalid. Ask the host for a new link.';$('#page-description').textContent=''; }
})();
