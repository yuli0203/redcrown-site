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
