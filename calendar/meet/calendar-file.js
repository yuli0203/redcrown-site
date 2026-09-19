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
  root.CrownCalendarFile={create};
  if(typeof module==='object')module.exports={create};
})(globalThis);
