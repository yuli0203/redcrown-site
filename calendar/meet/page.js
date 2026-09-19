(() => {
  'use strict';
  if(!location.hash || (new URLSearchParams(location.search).has('booking') || new URLSearchParams(location.search).has('reschedule')))return;
  const $=selector=>document.querySelector(selector);
  try {
    if(location.hash.length>100000) throw new Error();
    const data=JSON.parse(decodeURIComponent(location.hash.slice(1)));
    if(data.v!==1 || typeof data.name!=='string' || data.name.length>60 || !Array.isArray(data.meetings)) throw new Error();
    const valid=m=>m && typeof m.title==='string' && m.title.length<=80 && typeof m.description==='string' && m.description.length<=500 && Number.isInteger(m.duration) && m.duration>=1 && m.duration<=480;
    if(!data.meetings.every(valid)) throw new Error();
    for(const [key,variable] of [['accent','--page-accent'],['background','--page-bg'],['text','--page-text']]) if(/^#[0-9a-f]{6}$/i.test(data[key])) document.documentElement.style.setProperty(variable,data[key]);
    $('#host-name').textContent=`Meet with ${data.name}`;
    if(!data.meetings.length) $('#page-description').textContent='No meetings have been added to this preview yet.';
    for(const meeting of data.meetings) {
      const card=document.createElement('details');card.className='public-meeting';
      const summary=document.createElement('summary');const title=document.createElement('strong');title.textContent=meeting.title;const duration=document.createElement('span');duration.textContent=`${meeting.duration} minutes`;summary.append(title,duration);
      const description=document.createElement('p');description.textContent=meeting.description;
      const note=document.createElement('p');note.className='booking-status';note.textContent='Online booking is not available yet. This is a preview of the meeting details.';
      card.append(summary,description,note);if(data.meetings.length===1)card.open=true;$('#public-meetings').append(card);
    }
  } catch { $('#page-error').textContent='This preview link is incomplete or invalid. Ask the host for a new link.';$('#page-description').textContent=''; }
})();
