const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TZ='America/New_York';
const {dayBounds,dayIntervals,calendarEntries}=require('../calendar/busy-calendar.js');
const stamp=value=>+new Date(value);
test('Overnight busy intervals clip to each local day and exclude midnight end',()=>{
 const intervals=[{start:stamp('2026-09-20T23:00:00-04:00'),end:stamp('2026-09-21T01:00:00-04:00')}];
 const start=stamp('2026-09-01T00:00:00-04:00'),end=stamp('2026-10-01T00:00:00-04:00');
 assert.deepEqual(dayIntervals(intervals,new Date(2026,8,20),start,end),[{start:intervals[0].start,end:stamp('2026-09-21T00:00:00-04:00')}]);
 assert.deepEqual(dayIntervals(intervals,new Date(2026,8,21),start,end),[{start:stamp('2026-09-21T00:00:00-04:00'),end:intervals[0].end}]);
 assert.equal(dayIntervals([{start,end:stamp('2026-09-21T00:00:00-04:00')}],new Date(2026,8,21),start,end).length,0);
});
test('Preview respects partial sync coverage and empty days',()=>{
 const day=new Date(2026,8,20),bounds=dayBounds(day),start=bounds.start+12*3600000,end=bounds.end-3600000;
 assert.deepEqual(dayIntervals([bounds],day,start,end),[{start,end}]);
 assert.deepEqual(dayIntervals([],day,start,end),[]);
 assert.deepEqual(dayIntervals([bounds],new Date(2026,8,21),start,end),[]);
});
test('Local day boundaries account for daylight saving changes',()=>{
 const spring=dayBounds(new Date(2026,2,8)),fall=dayBounds(new Date(2026,10,1));
 assert.equal(spring.end-spring.start,23*3600000);
 assert.equal(fall.end-fall.start,25*3600000);
});

test('Calendar blocks show names and preserve uncovered busy time',()=>{
 const date=new Date(2026,8,20),{start,end}=dayBounds(date),hour=3600000;
 const entries=calendarEntries([{start:start+9*hour,end:start+12*hour}], [{start:start+10*hour,end:start+11*hour,title:'Planning',busy:true}],date,start,end);
 assert.deepEqual(entries.map(e=>e.title),['Busy','Planning','Busy']);
 assert.deepEqual(entries.map(e=>[e.start,e.end]),[[start+9*hour,start+10*hour],[start+10*hour,start+11*hour],[start+11*hour,start+12*hour]]);
});
test('Nonblocking and all-day events keep metadata without hiding busy periods',()=>{
 const date=new Date(2026,8,20),{start,end}=dayBounds(date);
 const entries=calendarEntries([{start,end}], [{start,end,title:'Reminder',busy:false,allDay:true}],date,start,end);
 assert.equal(entries.length,2);assert.ok(entries.some(e=>e.title==='Busy'));
 assert.ok(entries.some(e=>e.allDay && e.title==='Reminder'));
 assert.deepEqual(calendarEntries([], [{start:end,end:end+1000,title:'Tomorrow'}],date,start,end),[]);
});
