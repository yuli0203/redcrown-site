import test from 'node:test';
import assert from 'node:assert/strict';
import calendar from '../../calendar/meet/calendar-file.js';
test('Calendar download escapes user text, folds Unicode safely and preserves UTC meeting times',()=>{
 const title='פגישת היכרות '.repeat(20),start=Date.parse('2026-10-01T09:30:00Z');
 const output=calendar.create({title,location:'Room 1; Office, HQ',description:'First line\r\nSecond line'},{id:'test',start,end:start+1800000});
 assert.ok(output.endsWith('END:VCALENDAR\r\n'));
 for(const line of output.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const unfolded=output.replaceAll('\r\n ','');
 assert.ok(unfolded.includes('SUMMARY:'+title));
 assert.ok(unfolded.includes('LOCATION:Room 1\\; Office\\, HQ'));
 assert.ok(unfolded.includes('DESCRIPTION:First line\\nSecond line'));
 assert.ok(unfolded.includes('DTSTART:20261001T093000Z'));
 assert.ok(unfolded.includes('DTEND:20261001T100000Z'));
 assert.throws(()=>calendar.create({}, {id:'test',start,end:start}));
});
