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

test('Calendar links preserve UTC dates and safely encode text without inviting other attendees',()=>{
 const meeting={title:'Meet & plan + שלום',description:'Line 1\nLine 2 & notes',location:'https://meet.google.com/test?a=1&b=2'};
 const booking={id:'test',start:Date.parse('2026-10-25T00:30:00Z'),end:Date.parse('2026-10-25T01:15:00Z'),email:'private@example.test',manageToken:'private-token'};
 const links=calendar.links(meeting,booking),google=new URL(links.google);
 assert.equal(google.searchParams.get('dates'),'20261025T003000Z/20261025T011500Z');assert.equal(google.searchParams.get('text'),meeting.title);assert.equal(google.searchParams.get('location'),meeting.location);
 for(const key of ['outlook','microsoft365']){const u=new URL(links[key]);assert.equal(u.searchParams.get('startdt'),new Date(booking.start).toISOString());assert.equal(u.searchParams.get('enddt'),new Date(booking.end).toISOString());assert.equal(u.searchParams.get('subject'),meeting.title);assert.equal(u.searchParams.get('body'),meeting.description);}
 for(const url of Object.values(links)){assert.ok(!url.includes('private-token'));assert.ok(!url.includes('private%40'));}
 assert.throws(()=>calendar.links(meeting,{...booking,end:booking.start}));
});
