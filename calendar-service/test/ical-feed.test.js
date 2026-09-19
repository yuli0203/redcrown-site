import test from 'node:test';
import assert from 'node:assert/strict';
import {feedUrl,parseFeed,fetchFeed} from '../src/ical-feed.js';
const wrap=body=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+body+'\r\nEND:VCALENDAR';
const event=body=>'BEGIN:VEVENT\r\n'+body+'\r\nEND:VEVENT';
const start=Date.parse('2026-09-01T00:00:00Z'),end=Date.parse('2026-10-01T00:00:00Z');
test('Feed URL allows only expected HTTPS provider paths, without redirects or credentials',async()=>{
 assert.equal(feedUrl('webcal://outlook.office365.com/owa/calendar/a/calendar.ics'),'https://outlook.office365.com/owa/calendar/a/calendar.ics');
 for(const url of ['http://calendar.google.com/calendar/ical/a/basic.ics','https://127.0.0.1/a.ics','https://calendar.google.com.evil.test/calendar/ical/a.ics','https://user:pass@calendar.google.com/calendar/ical/a.ics','https://outlook.office.com/calendar/a/calendar.html'])assert.throws(()=>feedUrl(url));
 const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual');return new Response('',{status:302});};
 try{await assert.rejects(fetchFeed('https://calendar.google.com/calendar/ical/a/basic.ics'));}finally{globalThis.fetch=original;}
});
test('ICS handles all-day, recurrence, exclusions, moved exceptions, transparent and cancelled events',()=>{
 const text=wrap([
 event('UID:all\r\nDTSTART;VALUE=DATE:20260928\r\nDTEND;VALUE=DATE:20260929'),
 event('UID:repeat\r\nDTSTART:20260901T090000Z\r\nDTEND:20260901T100000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE:20260902T090000Z'),
 event('UID:repeat\r\nRECURRENCE-ID:20260903T090000Z\r\nDTSTART:20260903T110000Z\r\nDTEND:20260903T120000Z'),
 event('UID:free\r\nDTSTART:20260905T090000Z\r\nDTEND:20260905T100000Z\r\nTRANSP:TRANSPARENT'),
 event('UID:cancelled\r\nDTSTART:20260906T090000Z\r\nDTEND:20260906T100000Z\r\nSTATUS:CANCELLED')].join('\r\n'));
 const busy=parseFeed(text,start,end,'Asia/Jerusalem');assert.equal(busy.length,3);
 assert.ok(busy.some(b=>b.start===Date.parse('2026-09-27T21:00:00Z')&&b.end===Date.parse('2026-09-28T21:00:00Z')));
 assert.ok(busy.some(b=>b.start===Date.parse('2026-09-03T11:00:00Z')));
});
test('Malformed feeds and unknown timezones fail closed',()=>{
 assert.throws(()=>parseFeed('<html>Login</html>',start,end));
 assert.throws(()=>parseFeed(wrap(event('UID:x\r\nDTSTART;TZID=Unknown:20260901T090000\r\nDTEND;TZID=Unknown:20260901T100000')),start,end));
 assert.deepEqual(parseFeed(wrap(''),start,end),[]);
});
