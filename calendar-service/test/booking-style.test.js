import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={window:{}};runInNewContext(readFileSync(new URL('../../calendar/meet/style.js',import.meta.url),'utf8'),context);
const {palette,contrast}=context.window.CrownBookingStyle;
test('Booking branding preserves readable text and selected control contrast',()=>{
 for(const background of ['#ffffff','#000000','#c8102e','#777777','#ffff00','#143c80'])for(const foreground of ['#ffffff','#000000','#777777','#c8102e','#ffff00']){
  const p=palette({background,text:foreground,accent:foreground});
  assert.ok(contrast(p.text,p.background)>=4.5);
  assert.ok(contrast(p.accent,p.background)>=4.5);
  assert.ok(contrast(p.accentInk,p.accent)>=4.5);
 }
 const standard=palette({background:'#ffffff',text:'#271c22',accent:'#c8102e'});
 assert.equal(standard.text,'#271c22');assert.equal(standard.accent,'#c8102e');
 assert.equal(palette({background:'invalid'}).background,'#ffffff');
});
