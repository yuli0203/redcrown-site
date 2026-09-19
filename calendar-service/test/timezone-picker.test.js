import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('Timezone search applies city names immediately and cannot leave a misleading invalid selection', () => {
 const context = {window:{}, Intl, Event, document:{documentElement:{lang:'en'}, createElement(){return {
  handlers:{}, children:[], value:'', addEventListener(type,fn){this.handlers[type]=fn;},
  setAttribute(){}, append(child){this.children.push(child);}, setCustomValidity(value){this.error=value;},
  dispatchEvent(event){this.handlers[event.type]?.(event);}, blur(){this.handlers.blur();}, reportValidity(){}
 };}}};
 runInNewContext(readFileSync(new URL('../../calendar/timezone-picker.js',import.meta.url),'utf8'), context);
 const picker=context.window.CrownTimezone.create('Asia/Jerusalem');
 const input=picker.element;let changes=0;picker.addEventListener('change',()=>changes++);
 input.handlers.focus();assert.equal(input.value,'');
 input.value='London';input.handlers.input();assert.equal(picker.value,'Europe/London');assert.equal(changes,1);
 input.handlers.change();input.handlers.blur();assert.equal(changes,1);assert.match(input.value,/London \(UTC/);
 input.handlers.focus();input.value='not a timezone';input.handlers.input();input.handlers.blur();
 assert.equal(picker.value,'Europe/London');assert.match(input.value,/London \(UTC/);assert.equal(changes,1);
 input.handlers.focus();input.value='America/New_York';input.handlers.input();assert.equal(picker.value,'America/New_York');
 picker.value='Asia/Jerusalem';assert.match(input.value,/Jerusalem, Israel/);
 input.handlers.focus();input.value='Lon';input.handlers.keydown({key:'Escape'});assert.match(input.value,/Jerusalem, Israel/);
});
