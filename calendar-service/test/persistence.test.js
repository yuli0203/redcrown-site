import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';
import { decrypt } from '../src/security.js';

test('Google and Microsoft connections and selections survive database reopen and reconnect', async()=>{
 const dir=mkdtempSync(join(tmpdir(),'crown-persistence-')),file=join(dir,'test.sqlite');
 const env={DB:database(file),PUBLIC_ORIGIN:'http://localhost',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
 let missing=false,refresh=true;
 const provider={
  providerConfig(){return {authorize:'https://example.test/authorize',clientId:'test',redirect:'http://localhost/callback',scope:'openid'};},
  async exchange(name){return {access_token:'access',...(refresh?{refresh_token:'secret-'+name}:{}),scope:name==='google'?'https://www.googleapis.com/auth/calendar':'Calendars.ReadWrite'};},
  async accountInfo(name){return {sub:name,email:name+'@example.test'};},
  async listCalendars(){return missing?[]:[{id:'work',name:'Work',writable:true},{id:'personal',name:'Personal',writable:true}];}
 };
 let handle=createHandler({authenticate:async()=>({uid:'owner',verified:true}),provider});
 const api=(path,method='GET',data,headers={})=>handle(new Request('http://localhost/calendar/api'+path,{method,headers,...(data?{body:JSON.stringify(data)}:{})}),env);
 async function connect(name){const start=await api('/connect/'+name,'POST',{}),cookie=start.headers.get('Set-Cookie').split(';')[0],state=new URL((await start.json()).url).searchParams.get('state');assert.equal((await api('/oauth/'+name+'/callback?code=test&state='+state,'GET',null,{Cookie:cookie})).status,303);}
 try {
  for(const name of ['google','microsoft'])await connect(name);
  const accounts=(await (await api('/connections')).json()).accounts;
  for(const c of accounts)assert.equal((await api('/connections/'+c.id,'PUT',{selected:['work']})).status,200);
  env.DB.close();env.DB=database(file);handle=createHandler({authenticate:async()=>({uid:'owner',verified:true}),provider});
  const reloaded=(await (await api('/connections')).json()).accounts;
  assert.equal(reloaded.length,2);
  for(const c of reloaded){assert.equal(c.id,accounts.find(a=>a.provider===c.provider).id);assert.equal(c.calendars.find(v=>v.id==='work').selected,true);assert.equal(c.calendars.find(v=>v.id==='personal').selected,false);}
  missing=true;refresh=false;
  for(const name of ['google','microsoft'])await connect(name);
  for(const c of (await (await api('/connections')).json()).accounts){assert.equal(c.id,accounts.find(a=>a.provider===c.provider).id);assert.equal(c.calendars[0].selected,true);assert.equal(c.calendars[0].missing,true);assert.equal(c.calendars[0].writable,false);const saved=await env.DB.prepare('SELECT refresh_token FROM connections WHERE id=?').bind(c.id).first();assert.equal(await decrypt(saved.refresh_token,env),'secret-'+c.provider);}
 } finally {env.DB.close();rmSync(dir,{recursive:true,force:true});}
});
