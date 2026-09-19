import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { invitationLimits } from '../src/security.js';

test('Recipient limits span hosts, normalize addresses and do not store email addresses',async()=>{
 const DB=database(),env={DB};
 try {
  for(let i=0;i<5;i++)await invitationLimits(env,'host-'+i,['Victim@example.test','victim@example.test']);
  await assert.rejects(invitationLimits(env,'another-host',['VICTIM@example.test']),e=>e.status===429);
  const rows=(await DB.prepare('SELECT key FROM rate_limits').all()).results;
  assert.ok(rows.every(r=>!r.key.includes('@')));
 } finally {DB.close();}
});

test('Host invitation limit applies even when every recipient is different',async()=>{
 const DB=database(),env={DB};
 try {
  for(let i=0;i<30;i++)await invitationLimits(env,'host',[`guest${i}@example.test`]);
  await assert.rejects(invitationLimits(env,'host',['new@example.test']),e=>e.status===429);
 } finally {DB.close();}
});
