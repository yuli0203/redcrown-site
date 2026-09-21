const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../calendar/auth.js'),'utf8')
 .replace("import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js')", 'Promise.resolve(globalThis.appSDK)')
 .replace("import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')", 'Promise.resolve(globalThis.authSDK)');
async function fixture({verified=true,linked=false,enabled=true,failLink=false,signedOut=false}={}) {
 const nodes=new Map();
 const element=()=>({hidden:false,disabled:false,value:'',textContent:'',events:{},append(){},querySelectorAll(){return [];},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;},reportValidity(){return true;},scrollIntoView(){},focus(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const user={uid:'existing-owner',email:'owner@example.test',emailVerified:verified,providerData:[{providerId:'google.com'},...(linked?[{providerId:'microsoft.com'}]:[])],async getIdToken(){return 'test-token';}};
 const auth={currentUser:signedOut?null:user,async authStateReady(){}};
 let linkCalls=0,signInCalls=0,lastProvider=null,createdButton;
 class OAuthProvider {constructor(id){this.providerId=id;} setCustomParameters(p){this.parameters=p;}}
 const sdk={OAuthProvider,getAuth:()=>auth,setPersistence:async()=>{},onAuthStateChanged:(a,fn)=>fn(a.currentUser),
  async linkWithPopup(target,provider){linkCalls++;assert.equal(target,user);assert.equal(provider.providerId,'microsoft.com');if(failLink)throw {code:'auth/popup-closed-by-user'};target.providerData.push({providerId:'microsoft.com'});return {user:target};},
  async signInWithPopup(target,provider){signInCalls++;lastProvider=provider;return {user};},
  async signOut(a){a.currentUser=null;}};
 const document={querySelector:id=>id==='#auth-dialog'?null:get(id),createElement:tag=>{const el=element();if(tag==='button')createdButton=el;return el;},dispatchEvent(){}};
 vm.runInNewContext(source,{document,window:{},location:{origin:'https://test.example'},fetch:async()=>({ok:true,json:async()=>({firebase:{apiKey:'a',authDomain:'b',projectId:'c',appId:'d'},providers:{microsoft:enabled}})}),appSDK:{initializeApp:()=>({})},authSDK:sdk,CustomEvent:class{},Date});
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 return {button:createdButton,user,auth,nodes,get,calls:()=>linkCalls,signIns:()=>signInCalls,provider:()=>lastProvider};
}
test('Linking Microsoft keeps the existing owner UID and hides the option afterwards',async()=>{
 const f=await fixture();assert.equal(f.button.hidden,false);
 await f.button.events.click();assert.equal(f.calls(),1);assert.equal(f.user.uid,'existing-owner');assert.equal(f.button.hidden,true);
 assert.match(f.get('#auth-message').textContent,/Microsoft sign-in is enabled/);
});
test('Unverified or disabled-provider sessions cannot link Microsoft',async()=>{
 for(const opts of [{verified:false},{enabled:false}]){const f=await fixture(opts);assert.equal(f.button.hidden,true);await f.button.events.click();assert.equal(f.calls(),0);}
});
test('Already-linked users do not see an extra linking action',async()=>{
 const f=await fixture({linked:true});assert.equal(f.button.hidden,true);assert.equal(f.calls(),0);
});
test('Cancelled Microsoft linking retains the existing session and allows retry',async()=>{
 const f=await fixture({failLink:true});await f.button.events.click();assert.equal(f.auth.currentUser,f.user);assert.equal(f.button.disabled,false);assert.equal(f.button.hidden,false);assert.match(f.get('#auth-message').textContent,/cancelled/);
});
test('Enabling the provider lets the sign-in button open a Microsoft popup',async()=>{
 const f=await fixture({signedOut:true});const button=f.get('#auth-microsoft');
 assert.equal(button.disabled,false);
 await button.events.click();
 assert.equal(f.signIns(),1);assert.equal(f.provider().providerId,'microsoft.com');assert.equal(f.provider().parameters.tenant,'common');
});
test('A disabled provider neither enables the sign-in button nor opens a popup',async()=>{
 const f=await fixture({signedOut:true,enabled:false});const button=f.get('#auth-microsoft');
 assert.equal(button.disabled,true);
 await button.events.click();
 assert.equal(f.signIns(),0);assert.match(f.get('#auth-message').textContent,/not connected yet/);
});
test('Signed-out copy offers Microsoft only while the provider is enabled',async()=>{
 assert.match((await fixture({signedOut:true})).get('#signin-availability').textContent,/Google, Microsoft or email/);
 assert.match((await fixture({signedOut:true,enabled:false})).get('#signin-availability').textContent,/Microsoft sign-in is coming soon/);
});
test('The shipped configuration turns the Microsoft provider on',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../calendar/auth-config.json'),'utf8'));
 assert.equal(config.providers.microsoft,true);
});
test('Every English string the Microsoft flow shows has a Hebrew translation',()=>{
 const dict=JSON.parse(fs.readFileSync(path.join(__dirname,'../calendar/he/strings.json'),'utf8'));
 for(const key of ['Enable Microsoft sign-in',
  'Use Microsoft to sign in to this same account. Calendar access is separate.',
  'Microsoft sign-in is enabled. You can now use Microsoft to sign in to this same account.',
  'Google, Microsoft or email. No credit card required.',
  'Use Google, Microsoft or your email to access your own calendar space.'])
  assert.ok(dict[key],'missing Hebrew translation: '+key);
 assert.match(fs.readFileSync(path.join(__dirname,'../calendar/he/home-language.js'),'utf8'),/#auth-link-microsoft/);
});
test('The account row wraps, so the linking button cannot overflow a narrow header',()=>{
 // Measured: without wrapping the button pushed the 320px and 360px header
 // off-screen in both languages. CI cannot render a signed-in header, so the
 // rule is asserted here instead.
 assert.match(fs.readFileSync(path.join(__dirname,'../calendar/calendar.css'),'utf8'),/#auth-account\{[^}]*flex-wrap:wrap/);
});
test('Every message the sign-in flow can show has a Hebrew translation',()=>{
 const dict=JSON.parse(fs.readFileSync(path.join(__dirname,'../calendar/he/strings.json'),'utf8'));
 const src=fs.readFileSync(path.join(__dirname,'../calendar/auth.js'),'utf8');
 const literals=new Set();
 for(const line of src.split('\n')) for(const m of line.matchAll(/'([^'\\\n]*)'/g)) literals.add(m[1]);
 // The verification panel ships as markup, so take its copy from the tags.
 for(const m of src.matchAll(/<(?:h3|p|button[^>]*)>([^<]+)</g)) literals.add(m[1]);
 const shown=[...literals].filter(s=>s.length>8&&s.includes(' ')&&/^[A-Z]/.test(s)
   &&!/^(auth\/|#|\.|http|\[)/.test(s)&&!s.includes('<')&&!s.includes('=>'));
 const missing=shown.filter(s=>!dict[s]);
 assert.deepEqual(missing,[],'untranslated sign-in copy: '+JSON.stringify(missing,null,1));
 assert.ok(shown.length>40,'expected the sign-in copy to be discovered, found '+shown.length);
});
