(() => {
  'use strict';
  const displayPresets={global:{firstDay:1,hourCycle:'h23'},israel:{firstDay:0,hourCycle:'h23'},us:{firstDay:0,hourCycle:'h12'},saturday:{firstDay:6,hourCycle:'h23'}};
  const weekOffset=(day,firstDay)=>(day-firstDay+7)%7;
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
  function calendarEntries(intervals,meetings,date,rangeStart,rangeEnd) {
    const bounds=dayBounds(date),from=Math.max(bounds.start,rangeStart),to=Math.min(bounds.end,rangeEnd);
    const entries=meetings.filter(item=>item.end>from && item.start<to && from<to).map(item=>({...item,start:Math.max(item.start,from),end:Math.min(item.end,to)}));
    for(const period of dayIntervals(intervals,date,rangeStart,rangeEnd)) {
      let gaps=[period];
      for(const event of entries.filter(item=>item.busy)) gaps=gaps.flatMap(gap=>event.end<=gap.start || event.start>=gap.end ? [gap] : [{start:gap.start,end:Math.min(gap.end,event.start)},{start:Math.max(gap.start,event.end),end:gap.end}].filter(item=>item.start<item.end));
      entries.push(...gaps.map(item=>({...item,title:'Busy',busy:true})));
    }
    return entries.sort((a,b)=>a.start-b.start || a.end-b.end);
  }
  if (typeof module !== 'undefined') module.exports={dayBounds,dayIntervals,calendarEntries,displayPresets,weekOffset};
  if (typeof document === 'undefined') return;
  const $ = selector => document.querySelector(selector);
  let intervals=[], meetings=[], rangeStart=0, rangeEnd=0, selected=null, month=null, synced=false;
  let display=displayPresets.global;
  const time = stamp => new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hourCycle:display.hourCycle});
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
      $('#busy-day-coverage').textContent='Connect your calendar to see your availability.';
      const empty=document.createElement('p'); empty.className='sync-small';
      empty.textContent='Use Add calendar account above, choose the calendars to include, then Save selection. If your account is already listed, use Reconnect. Signing in alone does not sync your calendars.';
      list.append(empty); return;
    }
    const bounds=dayBounds(selected);
    const from=Math.max(bounds.start,rangeStart), to=Math.min(bounds.end,rangeEnd);
    if(from>=to) {
      $('#busy-day-coverage').textContent='Availability has not been checked for this date.';
      const note=document.createElement('p');note.className='sync-small';note.textContent='This date is outside the checked month. Refresh availability to check it.';list.append(note);return;
    }
    $('#busy-day-coverage').textContent=`Checked ${time(from)} - ${to === bounds.end ? (display.hourCycle==='h12'?'12:00 AM':'24:00') : time(to)}. Free and busy times below.`;
    const entries=calendarEntries(intervals,meetings,selected,rangeStart,rangeEnd);
    const items=[...entries,...daySegments(selected).filter(item=>!item.busy).map(item=>({...item,title:'Free'}))].sort((a,b)=>a.start-b.start);
    if (!items.length) {
      const empty=document.createElement('p'); empty.className='sync-small'; empty.textContent='No synced busy periods in this checked time range. This does not yet confirm bookable availability.'; list.append(empty); return;
    }
    for (const item of items) {
      const block=document.createElement('div'); block.className='busy-time-block'+(item.busy?'':' free-time-block');
      const times=document.createElement('strong'); times.textContent=item.allDay || (item.start === bounds.start && item.end === bounds.end) ? 'All day' : `${time(item.start)} - ${item.end === bounds.end ? (display.hourCycle==='h12'?'12:00 AM':'24:00') : time(item.end)}`;
      const text=document.createElement('span'); text.className='calendar-event-info';
      const name=document.createElement('strong');name.textContent=item.title || 'Busy';text.append(name);
      if(item.calendar) {const source=document.createElement('small');source.textContent=item.calendar+(item.busy?'':' - does not block availability');text.append(source);}
      block.append(times,text); list.append(block);
    }
  }
  function draw() {
    const first=new Date(month.getFullYear(),month.getMonth(),1);
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    $('#busy-month-label').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const weekdays=$('#busy-weekdays');weekdays.replaceChildren();
    const names=['SUN','MON','TUE','WED','THU','FRI','SAT'];for(let i=0;i<7;i++){const name=document.createElement('span');name.textContent=names[(display.firstDay+i)%7];weekdays.append(name);}
    const grid=$('#busy-date-grid'); grid.replaceChildren();
    for(let i=0;i<weekOffset(first.getDay(),display.firstDay);i++) {const spacer=document.createElement('span');spacer.className='calendar-spacer';grid.append(spacer);}
    for(let day=0;day<count;day++) {
      const date=new Date(first);date.setDate(date.getDate()+day);
      const bounds=dayBounds(date), checked=synced && bounds.end>rangeStart && bounds.start<rangeEnd, parts=checked?daySegments(date):[];
      const busy=parts.filter(item=>item.busy), free=parts.filter(item=>!item.busy);
      const button=document.createElement('button');button.type='button';
      const title=document.createElement('strong');title.textContent=date.getDate();
      const status=document.createElement('span');status.className='day-availability';
      status.textContent=!synced?'Not synced':!checked?'Not checked':!free.length?'Fully busy':!busy.length?'Free':`${busy.length} busy`;
      const track=document.createElement('span');track.className='day-timeline'+(!synced?' is-unknown':'');
      for(const part of parts) {
        const segment=document.createElement('span');segment.className=part.busy?'timeline-busy':'timeline-free';
        segment.style.left=`${(part.start-bounds.start)/(bounds.end-bounds.start)*100}%`;
        segment.style.width=`${(part.end-part.start)/(bounds.end-bounds.start)*100}%`;track.append(segment);
      }
      button.append(title,status);if(checked) button.append(track);
      const entries=checked?calendarEntries(intervals,meetings,date,rangeStart,rangeEnd):[];
      for(const event of entries.slice(0,2)) {
        const chip=document.createElement('span');chip.className='calendar-event-chip'+(event.busy?'':' event-free');
        chip.textContent=event.title;chip.title=`${event.allDay?'All day':time(event.start)} - ${event.title}`;button.append(chip);
      }
      if(entries.length>2) {const more=document.createElement('span');more.className='calendar-event-more';more.textContent=`+${entries.length-2} more`;button.append(more);}
      if(!checked) button.classList.add('day-unchecked');
      button.setAttribute('aria-pressed',String(+selected===+date));
      button.setAttribute('aria-label',`${label(date)}: ${status.textContent}${entries.length ? '. '+entries.map(item=>item.title).join(', ') : ''}. Show times`);
      button.addEventListener('click',()=>{selected=date;draw();grid.children[weekOffset(first.getDay(),display.firstDay)+day].focus({preventScroll:true});});
      grid.append(button);
    }
    drawDay();
  }
  function changeMonth(delta) {
    month=new Date(month.getFullYear(),month.getMonth()+delta,1);selected=new Date(month);draw();
    document.dispatchEvent(new CustomEvent('crown-calendar-month',{detail:{start:+month,end:+new Date(month.getFullYear(),month.getMonth()+1,1)}}));
  }
  $('#busy-previous-month').addEventListener('click',()=>changeMonth(-1));
  $('#busy-next-month').addEventListener('click',()=>changeMonth(1));
  window.CrownBusyPreview={
    setDisplay(preset){display=displayPresets[preset]||displayPresets.global;if(month)draw();},
    clear() {
      intervals=[]; meetings=[]; synced=false;
      rangeStart=dayBounds(new Date()).start;
      const end=new Date(rangeStart);end.setDate(end.getDate()+30);rangeEnd=+end;
      selected=new Date(rangeStart);month=new Date(selected.getFullYear(),selected.getMonth(),1);
      $('#synced-calendar-zone').textContent=`${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
      $('#synced-calendar-preview').hidden=false;draw();
    },
    update(items,start,end,events=[]) {
      intervals=items.map(item=>({...item}));meetings=events.map(item=>({...item}));rangeStart=start;rangeEnd=end;synced=true;
      if(!selected || dayBounds(selected).end<=start || +selected>=end) selected=new Date(dayBounds(new Date(start)).start);
      month=new Date(selected.getFullYear(),selected.getMonth(),1);
      $('#synced-calendar-zone').textContent=`${Intl.DateTimeFormat().resolvedOptions().timeZone} - ${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`;
      $('#synced-calendar-preview').hidden=false;draw();
    }
  };
  window.CrownBusyPreview.clear();
})();
