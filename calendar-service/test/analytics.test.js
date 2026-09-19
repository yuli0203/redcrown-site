import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../database.js';
import {recordWorkspaceUsage} from '../src/analytics.js';
test('Usage deduplicates sessions, counts users and excludes identity details',async()=>{
 const DB=database(),env={DB,TOKEN_ENCRYPTION_KEY:'test-only-key'},now=Date.UTC(2026,8,19);
 const user={uid:'private-user',email:'private@example.test',verified:true,authTime:100,provider:'password'};
 try {
  await recordWorkspaceUsage(user,env,now);await recordWorkspaceUsage(user,env,now);
  await recordWorkspaceUsage({...user,authTime:101},env,now);
  await recordWorkspaceUsage({...user,verified:false,authTime:102},env,now);
  const rows=(await DB.prepare('SELECT * FROM usage_sessions').all()).results;
  assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.user_key)).size,1);
  assert.ok(!JSON.stringify(rows).includes('private'));assert.equal(rows[0].provider,'password');
 }finally{DB.close();}
});
