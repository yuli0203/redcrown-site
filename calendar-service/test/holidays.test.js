import test from 'node:test';
import assert from 'node:assert/strict';
import { holidayOptions, holidayCountry, holidayDates, holidayEvents } from '../src/holidays.js';
import { validateWorkspace, slots, dateRange } from '../src/scheduling.js';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';

const meeting={id:'intro',title:'Intro',duration:30,before:0,after:0,notice:0,horizon:365,interval:30,dailyLimit:0};
function workspace(timezone='Asia/Jerusalem',country='auto'){
 return validateWorkspace({timezone,holidays:{enabled:true,country},weekly:Object.fromEntries([1,2,3,4,5,6,7].map(d=>[d,[['09:00','17:00']]])),meetings:[meeting]});
}
test('Time zones resolve only when one country is known, including legacy aliases',()=>{
 assert.equal(holidayOptions('Asia/Jerusalem').detected,'IL');
 assert.equal(holidayOptions('Asia/Tel_Aviv').detected,'IL');
 assert.equal(holidayOptions('America/New_York').detected,'US');
 for(const zone of ['UTC','Etc/GMT-2','Europe/Berlin'])assert.equal(holidayOptions(zone).detected,null);
 assert.ok(holidayOptions('Europe/Berlin').candidates.includes('DE'));
 assert.equal(holidayCountry(workspace('Europe/Berlin','DE')),'DE');
 assert.equal(holidayCountry(workspace('Asia/Jerusalem','US')),'US');
 assert.throws(()=>workspace('UTC','ZZ'));
});
test('National holidays block slots, include observed days and roll over into future years',()=>{
 const w=workspace('America/New_York');
 for(const date of ['2026-07-03','2026-07-04','2027-01-01']){
  const range=dateRange(date,1,w.timezone);
  assert.equal(slots(w,meeting,[],range,range.start).length,0,date);
 }
 const dates=holidayDates(w,'2026-12-30','2027-01-03');assert.ok(dates.has('2027-01-01'));
 const il=workspace(),range=dateRange('2026-09-21',1,il.timezone);
 assert.equal(slots(il,meeting,[],range,range.start).length,0);
 assert.ok(holidayDates(il,'2026-04-22','2026-04-22').size); // Independence Day, not just religious holidays.
});
test('Manual date overrides take priority; switching country and disabling never leave stale closures',()=>{
 const w=workspace(),range=dateRange('2026-09-21',1,w.timezone);
 w.exceptions['2026-09-21']=[['10:00','11:00']];
 assert.equal(slots(w,meeting,[],range,range.start).length,2);
 assert.equal(holidayEvents(w,range.start,range.end)[0].busy,false);
 delete w.exceptions['2026-09-21'];w.holidays.country='US';
 assert.ok(slots(w,meeting,[],range,range.start).length);
 w.holidays.country='auto';w.holidays.enabled=false;
 assert.ok(slots(w,meeting,[],range,range.start).length);
 assert.deepEqual(holidayEvents(w,range.start,range.end),[]);
});
test('Holiday events use host local midnight, not UTC or the religious eve',()=>{
 const w=workspace(),range=dateRange('2026-09-21',1,w.timezone);
 const [event]=holidayEvents(w,range.start,range.end);
 assert.equal(event.start,Date.parse('2026-09-20T21:00:00Z'));
 assert.equal(event.end,Date.parse('2026-09-21T21:00:00Z'));
 assert.equal(event.allDay,true);assert.equal(event.busy,true);
});
test('Ambiguous enabled policies cannot publish or return bookable slots; old workspaces retain their settings',()=>{
 const w=workspace('UTC'),range=dateRange('2026-10-01',1,'UTC');
 assert.throws(()=>slots(w,meeting,[],range,range.start),/choose a holiday country/);
 assert.throws(()=>validateWorkspace({...w,published:true}),/Choose a country/);
 assert.deepEqual(validateWorkspace({timezone:'Asia/Jerusalem'}).holidays,{enabled:false,country:'auto'});
});
test('Every new account gets automatic holidays, persisted independently from existing accounts',async()=>{
 const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost'};
 const handle=createHandler({authenticate:async r=>({uid:r.headers.get('x-user'),verified:true})});
 const request=async(user,path,method='GET',data)=>{
  const response=await handle(new Request('http://localhost/calendar/api'+path,{method,headers:{'x-user':user,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
  return {status:response.status,data:await response.json()};
 };
 try{
  for(const user of ['new-one','new-two']){
   const result=await request(user,'/workspace','PUT',{version:0,data:{timezone:'Asia/Jerusalem'}});
   assert.equal(result.status,200);assert.deepEqual(result.data.data.holidays,{enabled:true,country:'auto'});
   assert.equal(result.data.data.calendarDisplay,'israel');
   const reload=await request(user,'/workspace');assert.deepEqual(reload.data.data.holidays,result.data.data.holidays);
   assert.equal(reload.data.data.calendarDisplay,'israel');
  }
  const range=dateRange('2026-09-21',1,'Asia/Jerusalem');
  const preview=await request('new-one',`/availability?start=${range.start}&end=${range.end}`);
  assert.equal(preview.status,200);assert.equal(preview.data.events[0].allDay,true);assert.equal(preview.data.busy.length,1);
  const options=await request('new-two','/holiday-options?timezone=UTC');assert.equal(options.data.detected,null);assert.ok(options.data.countries.some(c=>c.code==='IL'));
  const optedOut=await request('new-one','/workspace','PUT',{version:1,data:{timezone:'Asia/Jerusalem',holidays:{enabled:false,country:'auto'}}});assert.equal(optedOut.status,200);
  assert.equal((await request('new-two','/workspace')).data.data.holidays.enabled,true);
 }finally{DB.close();}
});
test('Public slot listing and booking both enforce the saved holiday policy',async()=>{
 const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost'};let writes=0;
 const provider={async readAvailability(){return {busy:[],events:[]};},async writeBooking(){writes++;}};
 const handle=createHandler({provider});
 const w={...workspace('America/New_York'),pageName:'Holiday host',slug:'holiday-host',published:true,destination:{connectionId:'one',calendarId:'primary'}};
 const year=new Date().getUTCFullYear()+1,range=dateRange(`${year}-01-01`,1,w.timezone);
 await DB.prepare('INSERT INTO profiles(uid,slug,data,version,updated_at) VALUES(?,?,?,?,?)').bind('host',w.slug,JSON.stringify(w),1,Date.now()).run();
 await DB.prepare('INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?)').bind('one','host','google','account','host@example.test','unused',JSON.stringify([{id:'primary',selected:true,writable:true}])).run();
 try{
  const listed=await handle(new Request(`http://localhost/calendar/api/public/holiday-host/slots?meeting=intro&from=${year}-01-01&days=1`),env);
  assert.equal(listed.status,200);assert.deepEqual((await listed.json()).slots,[]);
  const booked=await handle(new Request('http://localhost/calendar/api/public/holiday-host/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),meetingId:'intro',start:range.start+10*3600000,name:'Guest',email:'guest@example.test'})}),env);
  assert.equal(booked.status,409);assert.equal(writes,0);
 }finally{DB.close();}
});
