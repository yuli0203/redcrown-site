const test=require('node:test');
const assert=require('node:assert/strict');
const {toMinutes,display}=require('../calendar/notice.js');
test('Minimum notice units preserve exact stored minutes on edit and save',()=>{
 for(const minutes of [0,1,45,90,120,1440,2880,43200]){const shown=display(minutes);assert.equal(toMinutes(shown.value,shown.unit),minutes);}
 assert.deepEqual(display(120),{value:2,unit:'hours'});assert.deepEqual(display(2880),{value:2,unit:'days'});
 assert.equal(toMinutes(24,'hours'),1440);assert.equal(toMinutes(2,'days'),2880);
});
test('Invalid or excessive notice cannot bypass the booking cutoff',()=>{
 for(const [value,unit] of [[-1,'hours'],[31,'days'],[721,'hours'],[43201,'minutes'],[1,'invalid'],[Infinity,'days'],[1.5,'minutes']])assert.throws(()=>toMinutes(value,unit));
});
