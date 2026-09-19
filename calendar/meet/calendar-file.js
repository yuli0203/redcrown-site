(function(root){
  'use strict';
  const escape=value=>String(value||'').replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;');
  const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  function fold(line){
    const encoder=new TextEncoder();let result='',bytes=0;
    for(const char of line){const size=encoder.encode(char).length;if(bytes+size>75){result+='\r\n ';bytes=1;}result+=char;bytes+=size;}
    return result;
  }
  function create(meeting,booking){
    if(!booking.id||!Number.isFinite(booking.start)||!Number.isFinite(booking.end)||booking.end<=booking.start)throw Error('Invalid calendar dates.');
    return ['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','PRODID:-//Red Crown Interactive//Calendar//EN','BEGIN:VEVENT',`UID:${escape(booking.id)}@redcrowninteractive.com`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(booking.start)}`,`DTEND:${stamp(booking.end)}`,`SUMMARY:${escape(meeting.title)}`,`LOCATION:${escape(meeting.location)}`,`DESCRIPTION:${escape(meeting.description)}`,'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
  }
  function links(meeting,booking){
    create(meeting,booking); // Apply the same date validation as the downloadable event.
    const google=new URL('https://calendar.google.com/calendar/render');
    google.search=new URLSearchParams({action:'TEMPLATE',text:meeting.title||'',dates:stamp(booking.start)+'/'+stamp(booking.end),details:meeting.description||'',location:meeting.location||''}).toString();
    const outlookParams=new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',subject:meeting.title||'',startdt:new Date(booking.start).toISOString(),enddt:new Date(booking.end).toISOString(),body:meeting.description||'',location:meeting.location||''});
    return {google:google.href,outlook:'https://outlook.live.com/calendar/0/deeplink/compose?'+outlookParams,microsoft365:'https://outlook.office.com/calendar/0/deeplink/compose?'+outlookParams};
  }
  root.CrownCalendarFile={create,links};
  if(typeof module==='object')module.exports={create,links};
})(globalThis);
