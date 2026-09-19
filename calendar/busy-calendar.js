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
  let intervals=[], rangeStart=0, rangeEnd=0, selected=null, month=null, synced=false;
  const time = stamp => new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const label = date => date.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const monthIndex = date => date.getFullYear()*12+date.getMonth();
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
    $('#busy-day-coverage').textContent=`Checked ${time(from)} - ${to === bounds.end ? '24:00' : time(to)}. Unavailable times below.`;
    const items=dayIntervals(intervals,selected,rangeStart,rangeEnd);
    if (!items.length) {
      const empty=document.createElement('p'); empty.className='sync-small'; empty.textContent='No synced busy periods in this checked time range. This does not yet confirm bookable availability.'; list.append(empty); return;
    }
    for (const item of items) {
      const block=document.createElement('div'); block.className='busy-time-block';
      const times=document.createElement('strong'); times.textContent=item.start === bounds.start && item.end === bounds.end ? 'All day' : `${time(item.start)} - ${item.end === bounds.end ? '24:00' : time(item.end)}`;
      const text=document.createElement('span'); text.textContent='Unavailable'; block.append(times,text); list.append(block);
    }
  }
  function draw() {
    $('#busy-month-label').textContent=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    $('#busy-previous-month').disabled=monthIndex(month)<=monthIndex(new Date(rangeStart));
    $('#busy-next-month').disabled=monthIndex(month)>=monthIndex(new Date(rangeEnd-1));
    const grid=$('#busy-date-grid'); grid.replaceChildren();
    for(let i=0;i<(month.getDay()+6)%7;i++) grid.append(document.createElement('span'));
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let day=1;day<=count;day++) {
      const date=new Date(month.getFullYear(),month.getMonth(),day), bounds=dayBounds(date);
      const checked=bounds.end>rangeStart && bounds.start<rangeEnd;
      const items=checked ? dayIntervals(intervals,date,rangeStart,rangeEnd) : [];
      const button=document.createElement('button'); button.type='button'; button.textContent=day; button.disabled=!checked;
      button.setAttribute('aria-pressed',String(+selected===+date));
      button.setAttribute('aria-label',`${label(date)}: ${!synced ? 'availability not synced' : !checked ? 'outside synced range' : items.length ? `${items.length} busy periods` : 'no synced busy periods'}`);
      if(items.length) button.className='has-busy';
      button.addEventListener('click',()=>{selected=date;draw();grid.children[(month.getDay()+6)%7+day-1].focus({preventScroll:true});});
      grid.append(button);
    }
    drawDay();
  }
  function changeMonth(delta) {
    const next=new Date(month.getFullYear(),month.getMonth()+delta,1);
    if(monthIndex(next)<monthIndex(new Date(rangeStart)) || monthIndex(next)>monthIndex(new Date(rangeEnd-1))) return;
    month=next; selected=new Date(Math.max(+month,dayBounds(new Date(rangeStart)).start));draw();
  }
  $('#busy-previous-month').addEventListener('click',()=>changeMonth(-1));
  $('#busy-next-month').addEventListener('click',()=>changeMonth(1));
  window.CrownBusyPreview={
    clear() {
      intervals=[]; synced=false;
      rangeStart=dayBounds(new Date()).start;
      const end=new Date(rangeStart);end.setDate(end.getDate()+30);rangeEnd=+end;
      selected=new Date(rangeStart);month=new Date(selected.getFullYear(),selected.getMonth(),1);
      $('#synced-calendar-zone').textContent=`${Intl.DateTimeFormat().resolvedOptions().timeZone} - sync calendars to see unavailable times`;
      $('#synced-calendar-preview').hidden=false;draw();
    },
    update(items,start,end) {
      intervals=items.map(item=>({...item}));rangeStart=start;rangeEnd=end;synced=true;
      if(!selected || dayBounds(selected).end<=start || +selected>=end) selected=new Date(dayBounds(new Date(start)).start);
      month=new Date(selected.getFullYear(),selected.getMonth(),1);
      $('#synced-calendar-zone').textContent=`${Intl.DateTimeFormat().resolvedOptions().timeZone} - ${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`;
      $('#synced-calendar-preview').hidden=false;draw();
    }
  };
  window.CrownBusyPreview.clear();
})();
