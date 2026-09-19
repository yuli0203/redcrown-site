import ICAL from 'ical.js';
import { Temporal } from '@js-temporal/polyfill';
import { assert, Problem } from './scheduling.js';
import { decrypt } from './security.js';

export function feedUrl(value) {
 assert(typeof value==='string' && value.length<=3000,'Paste a Google or Outlook ICS calendar link.');
 let url;try {url=new URL(value.trim().replace(/^webcal:/i,'https:'));}catch{throw new Problem('Paste a valid ICS calendar link.');}
 const allowed=url.hostname==='calendar.google.com' && url.pathname.startsWith('/calendar/ical/')
  || ['outlook.office365.com','outlook.office.com','outlook.live.com'].includes(url.hostname) && /^\/(?:owa|calendar)\//.test(url.pathname);
 assert(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&allowed&&/\.ics$/i.test(url.pathname),'Use the ICS link from Google Calendar or Outlook publishing settings, not an HTML page.');
 url.hash='';return url.href;
}
export async function fetchFeed(url) {
 const response=await fetch(feedUrl(url),{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/calendar'}});
 assert(response.ok,'Calendar link could not be read. Check publishing access or replace the link.',503);
 const reader=response.body.getReader();let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();throw new Problem('Calendar feed is too large. Use a smaller published calendar.',503);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder().decode(bytes);
}
export function parseFeed(text,start,end,timezone='UTC') {
 try {
  assert(text.length<=2_000_000&&text.includes('BEGIN:VCALENDAR'),'Invalid calendar feed.',503);
  const root=new ICAL.Component(ICAL.parse(text));assert(root.name==='vcalendar','Invalid calendar feed.',503);
  timezone=root.getFirstPropertyValue('x-wr-timezone')||timezone;
  const components=root.getAllSubcomponents('vevent');assert(components.length<=5000,'Calendar feed has too many events.',503);
  const events=components.map(c=>new ICAL.Event(c));
  const masters=events.filter(e=>!e.isRecurrenceException());
  for(const e of events.filter(e=>e.isRecurrenceException())){
   const master=masters.find(m=>m.uid===e.uid);assert(master,'Calendar contains an unsupported recurrence exception.',503);master.relateException(e);
  }
  const stamp=time=>{
   assert(time,'Calendar event is missing its time.',503);
   if(time.isDate || time.zone.tzid==='floating')return Number(Temporal.PlainDateTime.from({year:time.year,month:time.month,day:time.day,hour:time.hour||0,minute:time.minute||0,second:time.second||0}).toZonedDateTime(timezone).epochMilliseconds);
   return time.toUnixTime()*1000;
  };
  // Unknown TZIDs must never silently become UTC/floating availability.
  for(const c of components)for(const name of ['dtstart','dtend','recurrence-id','exdate','rdate'])for(const property of c.getAllProperties(name)){
   const tzid=property.getParameter('tzid');if(tzid)assert(root.getTimeZoneByID(tzid),'Calendar timezone definition is missing. Use a feed containing timezone definitions.',503);
  }
  const busy=[];let iterations=0;
  const add=(item,from,to)=>{
   if(item.component.getFirstPropertyValue('status')==='CANCELLED'||item.component.getFirstPropertyValue('transp')==='TRANSPARENT'||item.component.getFirstPropertyValue('x-microsoft-cdo-busystatus')==='FREE')return;
   const a=stamp(from),b=stamp(to);assert(b>a,'Calendar contains an invalid event duration.',503);if(a<end&&b>start)busy.push({start:a,end:b});
  };
  for(const event of masters){
   if(!event.isRecurring()){add(event,event.startDate,event.endDate);continue;}
   const iterator=event.iterator();let next;
   while((next=iterator.next())){assert(++iterations<=20000,'Calendar recurrence is too complex to check safely.',503);const occurrence=event.getOccurrenceDetails(next);add(occurrence.item,occurrence.startDate,occurrence.endDate);if(stamp(next)>end+370*86400000)break;}
  }
  assert(!root.getAllSubcomponents('vfreebusy').length,'This feed uses an unsupported free/busy format. Choose the published calendar ICS link.',503);
  return busy;
 }catch(error){if(error instanceof Problem)throw error;throw new Problem('Calendar feed could not be interpreted safely. Check or replace the link.',503);}
}
export async function readFeed(connection,start,end,env,timezone) {
 const url=await decrypt(connection.refresh_token,env);
 return parseFeed(await fetchFeed(url),start,end,JSON.parse(connection.calendars)[0]?.timezone||timezone);
}
