import { Temporal } from '@js-temporal/polyfill';
import { validHolidaySettings, holidayCountry, holidayDates } from './holidays.js';
export class Problem extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const assert=(ok,message,status=400)=>{if(!ok)throw new Problem(message,status);};
export const overlap=(a,b)=>a.start<b.end && a.end>b.start;
export function validZone(zone){try{Temporal.Now.zonedDateTimeISO(zone);return true;}catch{return false;}}
const text=(value,max,required=false)=>{assert(typeof value==='string' && value.length<=max && (!required || value.trim()),'Invalid text value.');return value.trim();};
const integer=(value,min,max)=>{assert(Number.isInteger(value)&&value>=min&&value<=max,'Invalid numeric setting.');return value;};
function windows(values){assert(Array.isArray(values)&&values.length<=8,'Use up to eight time windows per day.');let last=-1;return values.map(pair=>{assert(Array.isArray(pair)&&pair.length===2,'Invalid hours.');const [start,end]=pair.map(v=>{assert(typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v),'Invalid time.');return Number(v.slice(0,2))*60+Number(v.slice(3));});assert(start<end&&start>=last,'Hours must be ordered and cannot overlap.');last=end;return pair;});}
export function validProfilePhoto(value){
 if(typeof value!=='string'||value.length>2048)return false;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='googleusercontent.com'||url.hostname.endsWith('.googleusercontent.com'));}catch{return false;}
}
export function validateWorkspace(input){
 assert(input&&typeof input==='object','Invalid workspace.');
 const zone=text(input.timezone||'UTC',80);assert(validZone(zone),'Choose a valid time zone.');
 const holidays=input.holidays??{enabled:false,country:'auto'};
 assert(validHolidaySettings(holidays),'Choose a supported holiday country.');
 const weekly=input.weekly||{1:[['09:00','17:00']],2:[['09:00','17:00']],3:[['09:00','17:00']],4:[['09:00','17:00']],5:[['09:00','17:00']],6:[],7:[]};
 const normalized={};for(let day=1;day<=7;day++)normalized[day]=windows(weekly[day]||[]);
 const exceptions={};assert(Object.keys(input.exceptions||{}).length<=366,'Too many date overrides.');
 for(const [date,value] of Object.entries(input.exceptions||{})){assert(/^\d{4}-\d{2}-\d{2}$/.test(date),'Invalid override date.');try{Temporal.PlainDate.from(date);}catch{throw new Problem('Invalid override date.');}exceptions[date]=windows(value);}
 const meetings=(input.meetings||[]).map(m=>({id:text(m.id,80,true),title:text(m.title,80,true),description:text(m.description||'',500),duration:integer(m.duration,1,480),before:integer(m.before??0,0,240),after:integer(m.after??0,0,240),notice:integer(m.notice??120,0,43200),horizon:integer(m.horizon??60,1,365),interval:integer(m.interval??15,1,240),dailyLimit:integer(m.dailyLimit??0,0,100),location:text(m.location||'',200),reminderMinutes:integer(m.reminderMinutes??0,0,10080),reminderEmail:text(m.reminderEmail||'',254),enabled:m.enabled!==false}));
 for(const m of meetings)assert((!m.reminderEmail&&!m.reminderMinutes)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.reminderEmail),'Enter a valid reminder email.');
 assert(meetings.length<=100&&new Set(meetings.map(m=>m.id)).size===meetings.length,'Invalid meeting list.');
 const slug=text(input.slug||'',60);assert(!slug || (/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)&&!['api','admin','login','meet','calendar','support'].includes(slug)),'Use a unique page address with 3-60 lowercase letters, numbers or hyphens.');
 const calendarDisplay=input.calendarDisplay||'global';assert(['global','israel','us','saturday'].includes(calendarDisplay),'Choose a valid calendar display.');
 const result={hostName:text(input.hostName||'',100),calendarDisplay,pageName:text(input.pageName||'',60),slug,timezone:zone,holidays:{enabled:holidays.enabled,country:holidays.country},weekly:normalized,exceptions,meetings,published:input.published===true,destination:input.destination||null};
 if(result.published&&holidays.enabled)assert(holidayCountry(result),'Choose a country for public holidays before publishing.');
 for(const [key,fallback] of Object.entries({accent:'#c8102e',background:'#ffffff',text:'#271c22'})){assert(!input[key] || /^#[a-f\d]{6}$/i.test(input[key]),'Invalid color.');result[key]=input[key]||fallback;}
 for(const key of ['logo','photo']){const value=input[key]||'';assert(typeof value==='string' && value.length<=400000 && (!value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || (key==='photo'&&validProfilePhoto(value))),'Use a smaller PNG, JPEG or WebP image.');result[key]=value;}
 if(result.destination) {assert(typeof result.destination==='object','Invalid booking calendar.');result.destination={connectionId:text(result.destination.connectionId,80,true),calendarId:text(result.destination.calendarId,1024,true)};}
 if(result.published)assert(result.slug&&result.pageName&&result.destination&&meetings.some(m=>m.enabled),'Choose a page name, address, booking calendar and active meeting before publishing.');
 return result;
}
export const localDate=(stamp,zone)=>Temporal.Instant.fromEpochMilliseconds(stamp).toZonedDateTimeISO(zone).toPlainDate().toString();
export function dateRange(date,days,timezone){assert(validZone(timezone),'Invalid time zone.');let first;try{first=Temporal.PlainDate.from(date);}catch{throw new Problem('Invalid date.');}integer(days,1,31);return {start:Number(first.toZonedDateTime({timeZone:timezone,plainTime:'00:00'}).epochMilliseconds),end:Number(first.add({days}).toZonedDateTime({timeZone:timezone,plainTime:'00:00'}).epochMilliseconds)};}
export function slots(workspace,meeting,busy,range,now=Date.now(),bookings=[]){
 const zone=workspace.timezone,result=[],minimum=now+meeting.notice*60000;
 const horizon=Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone).add({days:meeting.horizon});
 let date=Temporal.Instant.fromEpochMilliseconds(range.start).toZonedDateTimeISO(zone).toPlainDate();
 const endDate=Temporal.Instant.fromEpochMilliseconds(range.end).toZonedDateTimeISO(zone).toPlainDate();
 assert(!workspace.holidays?.enabled||holidayCountry(workspace),'The host needs to choose a holiday country.',503);
 const holidays=holidayDates(workspace,date.toString(),endDate.toString());
 for(let day=0;day<33&&Temporal.PlainDate.compare(date,endDate)<=0;day++,date=date.add({days:1})){
  const key=date.toString(),windows=workspace.exceptions[key]??(holidays.has(key)?[]:workspace.weekly[date.dayOfWeek])??[];
  if(meeting.dailyLimit && bookings.filter(b=>localDate(b.start,zone)===key).length>=meeting.dailyLimit)continue;
  const midnight=date.toZonedDateTime({timeZone:zone,plainTime:'00:00'}),nextMidnight=date.add({days:1}).toZonedDateTime({timeZone:zone,plainTime:'00:00'}),stable=midnight.offsetNanoseconds===nextMidnight.offsetNanoseconds;
  for(const [from,to] of windows){
   // Reject nonexistent/ambiguous local start times rather than silently moving a booking at DST.
   let minute=Number(from.slice(0,2))*60+Number(from.slice(3)),endMinute=Number(to.slice(0,2))*60+Number(to.slice(3));
   for(;minute<endMinute;minute+=meeting.interval){
    let start,close;if(stable){start=Number(midnight.epochMilliseconds)+minute*60000;close=Number(midnight.epochMilliseconds)+endMinute*60000;}else try{start=Number(date.toPlainDateTime({hour:Math.floor(minute/60),minute:minute%60}).toZonedDateTime(zone,{disambiguation:'reject'}).epochMilliseconds);close=Number(date.toPlainDateTime(to).toZonedDateTime(zone,{disambiguation:'later'}).epochMilliseconds);}catch{continue;}
    const end=start+meeting.duration*60000;
    if(start<minimum||start<range.start||start>=range.end||end>close||start>Number(horizon.epochMilliseconds))continue;
    const padded={start:start-meeting.before*60000,end:end+meeting.after*60000};
    if(busy.some(b=>overlap(padded,b)))continue;
    result.push({start,end});
   }
  }
 }
 return result;
}
