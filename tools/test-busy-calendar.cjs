const test=require('node:test');
const assert=require('node:assert/strict');
process.env.TZ='America/New_York';
const {dayBounds,dayIntervals}=require('../calendar/busy-calendar.js');
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
