(() => {
  'use strict';
  // Local day boundaries preserve 23/25-hour days across daylight saving changes.
  function dayBounds(date) {
    const start = new Date(date.getFullYear(),date.getMonth(),date.getDate());
    const end = new Date(date.getFullYear(),date.getMonth(),date.getDate()+1);
    return {start:+start,end:+end};
  }
  function dayIntervals(intervals,date,rangeStart,rangeEnd) {
    const bounds = dayBounds(date);
    const start = Math.max(bounds.start,rangeStart), end = Math.min(bounds.end,rangeEnd);
    return intervals.map(item => ({start:Math.max(item.start,start),end:Math.min(item.end,end)})).filter(item => item.start < item.end);
  }
  if (typeof module !== 'undefined') module.exports={dayBounds,dayIntervals};
  if (typeof document === 'undefined') return;
  const $ = selector => document.querySelector(selector);
  let intervals=[], rangeStart=0, rangeEnd=0, selected=null, synced=false;
  const time = stamp => new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const label = date => date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  function daySegments(date) {
    const bounds=dayBounds(date), start=Math.max(bounds.start,rangeStart), end=Math.min(bounds.end,rangeEnd);
    const result=[]; let cursor=start;
    for(const item of dayIntervals(intervals,date,rangeStart,rangeEnd).sort((a,b)=>a.start-b.start)) {
      if(item.start>cursor) result.push({start:cursor,end:item.start,busy:false});
      if(item.end>cursor) result.push({start:Math.max(cursor,item.start),end:item.end,busy:true});
      cursor=Math.max(cursor,item.end);
    }
    if(cursor<end) result.push({start:cursor,end,busy:false});
    return result;
  }
  function drawDay() {
    $('#busy-day-title').textContent=label(selected);
    const list=$('#busy-day-intervals'); list.replaceChildren();
    if (!synced) {
      $('#busy-day-coverage').textContent='Availability not synced yet.';
      const empty=document.createElement('p'); empty.className='sync-small';
      empty.textContent='Connect a calendar account, choose sub-calendars and save your selection. If already connected, refresh availability. Unavailable times will appear here after a successful sync.';
      list.append(empty); return;
    }
    const bounds=dayBounds(selected);
    const from=Math.max(bounds.start,rangeStart), to=Math.min(bounds.end,rangeEnd);
    $('#busy-day-coverage').textContent=`Checked ${time(from)} - ${to === bounds.end ? '24:00' : time(to)}. Free and busy times below.`;
    const items=daySegments(selected);
    if (!items.length) {
      const empty=document.createElement('p'); empty.className='sync-small'; empty.textContent='No synced busy periods in this checked time range. This does not yet confirm bookable availability.'; list.append(empty); return;
    }
    for (const item of items) {
      const block=document.createElement('div'); block.className='busy-time-block'+(item.busy?'':' free-time-block');
      const times=document.createElement('strong'); times.textContent=item.start === bounds.start && item.end === bounds.end ? 'All day' : `${time(item.start)} - ${item.end === bounds.end ? '24:00' : time(item.end)}`;
      const text=document.createElement('span'); text.textContent=item.busy?'Unavailable':'Free'; block.append(times,text); list.append(block);
    }
  }
  function draw() {
    const first=new Date(dayBounds(new Date(rangeStart)).start);
    const last=new Date(first);last.setDate(last.getDate()+29);
    $('#busy-month-label').textContent=`${first.toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${last.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
    const grid=$('#busy-date-grid'); grid.replaceChildren();
    for(let i=0;i<(first.getDay()+6)%7;i++) {const spacer=document.createElement('span');spacer.className='calendar-spacer';grid.append(spacer);}
    for(let day=0;day<30;day++) {
      const date=new Date(first);date.setDate(date.getDate()+day);
      const bounds=dayBounds(date), parts=synced?daySegments(date):[];
      const busy=parts.filter(item=>item.busy), free=parts.filter(item=>!item.busy);
      const button=document.createElement('button');button.type='button';
      const title=document.createElement('strong');title.textContent=date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
      const status=document.createElement('span');status.className='day-availability';
      status.textContent=!synced?'Not synced':!free.length?'Fully busy':!busy.length?'Free':`${busy.length} busy`;
      const track=document.createElement('span');track.className='day-timeline'+(!synced?' is-unknown':'');
      for(const part of parts) {
        const segment=document.createElement('span');segment.className=part.busy?'timeline-busy':'timeline-free';
        segment.style.left=`${(part.start-bounds.start)/(bounds.end-bounds.start)*100}%`;
        segment.style.width=`${(part.end-part.start)/(bounds.end-bounds.start)*100}%`;track.append(segment);
      }
      button.append(title,status,track);
      button.setAttribute('aria-pressed',String(+selected===+date));
      button.setAttribute('aria-label',`${label(date)}: ${status.textContent}. Show times`);
      button.addEventListener('click',()=>{selected=date;draw();grid.children[(first.getDay()+6)%7+day].focus({preventScroll:true});});
      grid.append(button);
    }
    drawDay();
  }
  window.CrownBusyPreview={
    clear() {
      intervals=[]; synced=false;
      rangeStart=dayBounds(new Date()).start;
      const end=new Date(rangeStart);end.setDate(end.getDate()+30);rangeEnd=+end;
      selected=new Date(rangeStart);
      $('#synced-calendar-zone').textContent=`${Intl.DateTimeFormat().resolvedOptions().timeZone} - sync calendars to see unavailable times`;
      $('#synced-calendar-preview').hidden=false;draw();
    },
    update(items,start,end) {
      intervals=items.map(item=>({...item}));rangeStart=start;rangeEnd=end;synced=true;
      if(!selected || dayBounds(selected).end<=start || +selected>=end) selected=new Date(dayBounds(new Date(start)).start);
      $('#synced-calendar-zone').textContent=`${Intl.DateTimeFormat().resolvedOptions().timeZone} - ${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`;
      $('#synced-calendar-preview').hidden=false;draw();
    }
  };
  window.CrownBusyPreview.clear();
})();
