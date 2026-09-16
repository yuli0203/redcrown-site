const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../he/vr-development/vr-landing.js'), 'utf8').split('// Keep the hero useful through network, library, and rendering failures.')[1].split('// Load the project demo')[0];
function setup({cached=false, reduced=false, library=true}={}) {
  const timers = new Map(); let timerId=0, reloads=0;
  class Element {
    constructor() { this.hidden=false; this.disabled=false; this.attrs=new Map(); this.events={}; }
    getAttribute(k) { return this.attrs.get(k); }
    setAttribute(k,v) { this.attrs.set(k,v); }
    removeAttribute(k) { this.attrs.delete(k); }
    toggleAttribute(k,v) { v ? this.attrs.set(k,'') : this.attrs.delete(k); }
    addEventListener(k,f) { (this.events[k] ||= []).push(f); }
    emit(k) { for(const f of this.events[k] || []) f(); }
    cloneNode() { const e=new Element(); e.attrs=new Map(this.attrs); return e; }
    replaceWith(e) { stage.model=e; }
    focus() { this.focused=true; }
  }
  const parts=Object.fromEntries(['.headset-fallback','.headset-load-state','.headset-load-message','.headset-retry','.stage-caption'].map(k=>[k,new Element()]));
  const model=new Element(); model.loaded=cached; model.setAttribute('src','/assets/models/meta_quest_3_opt.glb');
  const stage={model,querySelector:k=>parts[k]};
  const ctx={headset:model,document:{querySelector:()=>stage,activeElement:null},motionPreference:{matches:reduced},customElements:{get:()=>library},location:{href:'http://localhost/he/vr-development/',reload:()=>reloads++},URL,setTimeout:f=>{timers.set(++timerId,f);return timerId},clearTimeout:i=>timers.delete(i)};
  vm.runInNewContext(script,ctx);
  return {model,stage,parts,ctx,timers,reloads:()=>reloads};
}
let t=setup();
assert.equal(t.parts['.headset-fallback'].hidden,false);
assert.equal(t.model.attrs.has('inert'),true);
t.model.emit('load');
assert.equal(t.parts['.headset-fallback'].hidden,true);
assert.equal(t.model.attrs.has('auto-rotate'),true);
assert.equal(t.timers.size,0);
t.model.emit('error');
assert.equal(t.parts['.headset-fallback'].hidden,false);
assert.equal(t.parts['.stage-caption'].hidden,true);
assert.equal(t.parts['.headset-retry'].disabled,false);
const old=t.model;t.parts['.headset-retry'].emit('click');
assert.notEqual(t.stage.model,old);
assert.match(t.stage.model.getAttribute('src'),/retry=1/);
old.emit('load');assert.equal(t.parts['.headset-fallback'].hidden,false);
t.stage.model.emit('load');assert.equal(t.parts['.headset-fallback'].hidden,true);
t=setup();[...t.timers.values()][0]();assert.equal(t.parts['.headset-retry'].hidden,false);
t=setup({cached:true,reduced:true});assert.equal(t.parts['.headset-fallback'].hidden,true);assert.equal(t.model.attrs.has('auto-rotate'),false);
t=setup({library:false});[...t.timers.values()][0]();t.parts['.headset-retry'].emit('click');assert.equal(t.reloads(),1);
console.log('PASS: initial fallback, load success, runtime error, retry recovery, stale events, timeout, cached load, reduced motion, missing library');
