const test=require('node:test');
const assert=require('node:assert/strict');
const {bounds}=require('../calendar/photo-crop.js');
test('Portrait and landscape crop fills the circle without stretching',()=>{
 assert.deepEqual(bounds(800,400,1,.5,.5),{x:200,y:0,size:400});
 assert.deepEqual(bounds(400,800,1,.5,.5),{x:0,y:200,size:400});
 assert.deepEqual(bounds(800,400,2,.5,.5),{x:300,y:100,size:200});
});
test('Zoom and edge positions keep the entire crop inside the image',()=>{
 for(const [w,h] of [[800,400],[400,800],[600,600]])for(const z of [1,2,4])for(const x of [0,.5,1])for(const y of [0,.5,1]){const b=bounds(w,h,z,x,y);assert.ok(b.x>=0&&b.y>=0&&b.x+b.size<=w&&b.y+b.size<=h);}
});
