import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';
import { providerConfig } from '../src/providers.js';

for (const name of ['google', 'microsoft']) {
 test(`${name}: real calendar-only scopes complete form OAuth and preserve reconnect selections`, async () => {
  const DB = database();
  const env = {DB, PUBLIC_ORIGIN:'https://site.example', API_ORIGIN:'https://api.example', GOOGLE_CLIENT_ID:'google-client', GOOGLE_CLIENT_SECRET:'test-secret', MICROSOFT_CLIENT_ID:'microsoft-client', MICROSOFT_CLIENT_SECRET:'test-secret', TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64')};
  const scopes = providerConfig(name, env).scope;
  let reconnect = false;
  const provider = {providerConfig, async exchange() {return {access_token:'test', scope:scopes, ...(reconnect ? {} : {refresh_token:'test-refresh'})};}, async accountInfo() {return {sub:'account',email:'host@example.test'};}, async listCalendars() {return [{id:'work',name:'Work',writable:true}];}};
  const handle = createHandler({authenticate:async () => ({uid:'owner',verified:true}),provider});
  const api = (path, options={}) => handle(new Request(env.API_ORIGIN+'/calendar/api'+path,options),env);
  async function connect() {
   const response = await api(`/connect/${name}/navigate`, {method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({idToken:'test-id-token',mailConnectionId:'legacy-mail-request'})});
   assert.equal(response.status,303);
   const url = new URL(response.headers.get('Location'));
   assert.equal(url.searchParams.get('scope'),scopes);
   assert.ok(!/gmail|mail\.send/i.test(scopes));
   assert.equal(url.searchParams.get('code_challenge_method'),'S256');
   assert.equal(url.searchParams.get('redirect_uri'),env.API_ORIGIN+`/calendar/api/oauth/${name}/callback`);
   const cookie=response.headers.get('Set-Cookie').split(';')[0];
   const callback=await api(`/oauth/${name}/callback?code=test&state=${url.searchParams.get('state')}`,{headers:{Cookie:cookie}});
   assert.equal(callback.status,303,await callback.text());
  }
  try {
   await connect();
   const first=await DB.prepare('SELECT * FROM connections').first();
   assert.notEqual(first.refresh_token,'test-refresh');
   const selection=await api('/connections/'+first.id,{method:'PUT',body:JSON.stringify({selected:['work']})});
   assert.equal(selection.status,200);
   reconnect=true;
   await connect();
   const accounts=(await (await api('/connections')).json()).accounts;
   assert.equal(accounts.length,1);
   assert.equal(accounts[0].id,first.id);
   assert.equal(accounts[0].calendars[0].selected,true);
   assert.equal((await DB.prepare('SELECT refresh_token FROM connections').first()).refresh_token,first.refresh_token);
  } finally {DB.close();}
 });
}
