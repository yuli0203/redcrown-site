const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.events={}; this.hidden=false; this.textContent=''; this.disabled=false; this.classList={toggle(){}}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; }
  addEventListener(name, callback) { this.events[name]=callback; }
  setAttribute() {}
}
function harness() {
  const nodes=new Map(), events={}, storage=new Map(), calls=[];
  const find=id => { if(!nodes.has(id)) nodes.set(id,new Element()); return nodes.get(id); };
  let preview, oauth, identity='one', failure=false, detailsFailure=false, pending;
  const document={querySelector:find, querySelectorAll:()=>[], createElement:tag=>new Element(tag), body:new Element(), hidden:false, addEventListener:(name,cb)=>events[name]=cb,head:{append:s=>s.onload()}};
  const google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:config=>{oauth=config;return {requestAccessToken(){}};}}}};
  const response=value=>({ok:true,json:async()=>value});
  const context={document,window:{google,CrownBusyPreview:{clear(){preview=null;},update(...args){preview=args;}}},google,URLSearchParams,AbortSignal,Date,Map,Number,JSON,Array,Error,Boolean,String,setInterval(){},setTimeout(){return 1;},clearTimeout(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('auth-config')) return response({calendar:{googleClientId:'test-client',googleEnabled:true}});
    if(url.includes('userinfo')) return response({sub:identity,email:`${identity}@example.test`});
    if(url.includes('calendarList')) return response({items:[{id:`${identity}-work`,summary:'Work',primary:true},{id:`${identity}-home`,summary:'Home'}]});
    if(url.includes('/events?') && detailsFailure) return {ok:false,status:403};
    if(url.includes('/events?')) return response({items:[{summary:'Team planning',start:{dateTime:'2026-09-20T09:00:00Z'},end:{dateTime:'2026-09-20T10:00:00Z'}},{summary:'Cancelled',status:'cancelled',start:{date:'2026-09-20'},end:{date:'2026-09-21'}}]});
    if(pending) await pending;
    const items=JSON.parse(options.body).items;
    return response({calendars:Object.fromEntries(items.map((item,i)=>[item.id,failure?{errors:[{reason:'notFound'}]}:{busy:[{start:'2026-09-20T09:00:00Z',end:i?'2026-09-20T11:00:00Z':'2026-09-20T10:00:00Z'}]}]))});
  }};
  vm.runInNewContext(fs.readFileSync('calendar/availability.js','utf8'),context);
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  return {find,storage,calls,tick,preview:()=>preview,failDetails(){detailsFailure=true;},signin:id=>events['crown-auth-change']({detail:{uid:id}}), async connect(id='one') {identity=id;find('#connect-google-calendar').events.click();await oauth.callback({access_token:'secret-test-token',expires_in:3600});await tick();}, action(text){const walk=node=>[node,...node.children.flatMap(walk)];const target=walk(find('#calendar-accounts')).find(n=>n.tag==='button' && n.textContent===text);target.events.click();}, select(index,apply=true){const walk=node=>[node,...node.children.flatMap(walk)];let card=find('#calendar-accounts').children[0];if(!walk(card).some(n=>n.tag==='input')) {walk(card).find(n=>n.tag==='button' && n.textContent==='Edit calendars').events.click();card=find('#calendar-accounts').children[0];}const input=walk(card).filter(n=>n.tag==='input')[index];input.checked=true;input.events.change();if(apply) this.action('Save selection');}, fail(){failure=true;},delay(p){pending=p;}};
}
test('Multiple accounts, calendar selections, overlapping busy intervals and token isolation',async()=>{
 const h=harness();await h.tick();h.signin('user-a');await h.connect();
 assert.equal(h.find('#calendar-accounts').children.length,1);
 h.select(0);await h.tick();h.select(1);await h.tick();
 assert.match(h.find('#sync-summary-text').textContent,/2 selected calendars checked. 1 busy periods/);
 await h.connect('two');assert.equal(h.find('#calendar-accounts').children.length,2);
 assert.ok(![...h.storage.values()].join('').includes('secret-test-token'));
 h.signin('user-b');assert.equal(h.find('#calendar-accounts').children.length,0);
 h.signin('user-a');assert.equal(h.find('#calendar-accounts').children.length,2);
 await h.find('#refresh-availability').events.click();assert.match(h.find('#sync-message').textContent,/Reconnect/);
 h.signin(null);assert.equal(h.find('#sync-availability').hidden,true);
});
test('A per-calendar API error cannot be reported as free availability',async()=>{
 const h=harness();await h.tick();h.signin('user-a');await h.connect();h.fail();h.select(0);await h.tick();
 assert.match(h.find('#sync-message').textContent,/incomplete.*Work/);assert.equal(h.find('#busy-preview').hidden,true);
 assert.match(h.find('#sync-summary-text').textContent,/not been checked/);
});
test('A response arriving after sign-out does not restore private calendar data',async()=>{
 const h=harness();await h.tick();h.signin('user-a');await h.connect();
 let resolve;h.delay(new Promise(r=>resolve=r));h.select(0);h.signin(null);resolve();await h.tick();
 assert.equal(h.find('#calendar-accounts').children.length,0);assert.equal(h.find('#busy-periods').children.length,0);
 assert.equal(h.find('#sync-availability').hidden,true);
});


test('Checkbox edits only sync after Save selection and Cancel discards changes',async()=>{
 const h=harness();await h.tick();h.signin('user-a');await h.connect();
 const before=h.calls.length;h.select(0,false);await h.tick();assert.equal(h.calls.length,before);
 h.action('Cancel');assert.equal(JSON.parse([...h.storage.values()][0])[0].calendars[0].selected,false);
 h.select(1,false);h.action('Save selection');await h.tick();
 assert.equal(JSON.parse([...h.storage.values()][0])[0].calendars[1].selected,true);
 assert.match(h.find('#sync-summary-text').textContent,/1 selected calendars/);
});

test('Meeting names are passed to the preview but never persisted with connections',async()=>{
 const h=harness();await h.tick();h.signin('user-a');await h.connect();h.select(0);await h.tick();
 const names=h.preview()[3];assert.equal(names.length,1);assert.equal(names[0].title,'Team planning');
 assert.equal(names[0].calendar,'Work');assert.equal(names[0].busy,true);
 assert.ok(![...h.storage.values()].join('').includes('Team planning'));
 h.signin(null);assert.equal(h.preview(),null);
});

test('Denied event details still render checked busy time without meeting names',async()=>{
 const h=harness();await h.tick();h.signin('user-a');await h.connect();h.failDetails();h.select(0);await h.tick();
 assert.equal(h.preview()[0].length,1);assert.equal(h.preview()[3].length,0);
 assert.match(h.find('#sync-message').textContent,/details are unavailable/);
});
