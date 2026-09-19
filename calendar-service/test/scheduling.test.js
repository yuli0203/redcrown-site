import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkspace,slots,dateRange } from '../src/scheduling.js';
const meeting={id:'intro',title:'Intro',duration:30,before:15,after:15,notice:0,horizon:365,interval:15,dailyLimit:0,description:'',location:'',enabled:true};
const workspace=()=>validateWorkspace({pageName:'Host',timezone:'America/New_York',meetings:[meeting]});
test('Hours, buffers, exact boundaries and duration constrain slots',()=>{
 const w=workspace(),range=dateRange('2026-10-05',1,w.timezone),now=Date.parse('2026-10-01T00:00:00Z'),busy=[{start:Date.parse('2026-10-05T14:00:00Z'),end:Date.parse('2026-10-05T15:00:00Z')}];
 const result=slots(w,meeting,busy,range,now).map(s=>new Date(s.start).toISOString());
 assert.ok(result.includes('2026-10-05T13:15:00.000Z'));assert.ok(!result.includes('2026-10-05T13:30:00.000Z'));assert.ok(!result.includes('2026-10-05T15:00:00.000Z'));assert.ok(result.includes('2026-10-05T15:15:00.000Z'));assert.ok(!result.includes('2026-10-05T20:45:00.000Z'));
});
test('Holiday/date override blocks whole day and notice excludes early slots',()=>{
 const w=workspace(),range=dateRange('2026-10-05',1,w.timezone);w.exceptions['2026-10-05']=[];assert.equal(slots(w,meeting,[],range,range.start).length,0);
 delete w.exceptions['2026-10-05'];assert.equal(slots(w,{...meeting,notice:1440},[],range,range.start).length,0);
});
test('DST gaps and repeated wall times are not silently shifted',()=>{
 const w=workspace();w.weekly[7]=[['01:00','04:00']];
 const spring=dateRange('2026-03-08',1,w.timezone),fall=dateRange('2026-11-01',1,w.timezone);
 assert.equal(spring.end-spring.start,23*3600000);assert.equal(fall.end-fall.start,25*3600000);
 const result=slots(w,{...meeting,before:0,after:0},[],spring,spring.start);
 assert.equal(new Set(result.map(s=>s.start)).size,result.length);
 const repeated=slots(w,{...meeting,before:0,after:0},[],fall,fall.start);
 assert.ok(repeated.every(s=>!['05','06'].includes(new Date(s.start).toISOString().slice(11,13))));
});
test('Reject overlapping hours and unsafe page addresses',()=>{
 assert.throws(()=>validateWorkspace({weekly:{1:[['09:00','12:00'],['11:00','13:00']]}}));assert.throws(()=>validateWorkspace({slug:'../admin'}));assert.throws(()=>validateWorkspace({timezone:'Fake/Zone'}));
});

test('Display preference persists without changing bookable slots',()=>{
 const base=workspace(),range=dateRange('2026-10-05',1,base.timezone),now=Date.parse('2026-10-01T00:00:00Z');
 for(const calendarDisplay of ['global','israel','us','saturday']){const value=validateWorkspace({...base,calendarDisplay});assert.equal(value.calendarDisplay,calendarDisplay);assert.deepEqual(slots(value,meeting,[],range,now),slots(base,meeting,[],range,now));}
 assert.throws(()=>validateWorkspace({...base,calendarDisplay:'invalid'}));
});


test('Profile photo accepts Google account image or uploaded image, rejects unrelated URLs',()=>{
 const url='https://lh3.googleusercontent.com/a/example=s96-c';
 assert.equal(validateWorkspace({photo:url}).photo,url);
 assert.equal(validateWorkspace({photo:'data:image/png;base64,aGVsbG8='}).photo,'data:image/png;base64,aGVsbG8=');
 for(const photo of ['https://googleusercontent.com.evil.test/a','http://lh3.googleusercontent.com/a','https://evil.test/a','https://user:pass@lh3.googleusercontent.com/a','javascript:alert(1)'])assert.throws(()=>validateWorkspace({photo}));
 assert.throws(()=>validateWorkspace({logo:url}));
});
test('Israel month availability excludes weekly closures, overrides and all-day busy dates',()=>{
 const w=validateWorkspace({timezone:'Asia/Jerusalem',calendarDisplay:'israel',exceptions:{'2026-09-22':[]},meetings:[meeting]});
 const range=dateRange('2026-09-01',30,w.timezone),closed=dateRange('2026-09-23',1,w.timezone);
 const result=slots(w,meeting,[closed],range,Date.parse('2026-09-01T00:00:00Z'));
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:w.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'long'});
 assert.ok(result.length>0);
 for(const s of result){const parts=Object.fromEntries(local.formatToParts(s.start).map(p=>[p.type,p.value]));assert.ok(!['Saturday','Sunday'].includes(parts.weekday));assert.ok(!['22','23'].includes(parts.day));}
});
