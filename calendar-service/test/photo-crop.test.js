import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('Photo drag moves the crop with the pointer, clamps edges and exports the adjusted image',()=>{
 const nodes={};let drawn,output;
 for(const id of ['profile-crop-canvas','profile-crop-controls','profile-crop-zoom','profile-crop-x','profile-crop-y','profile-crop-reset'])nodes[id]={value:'0',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
 const canvas=nodes['profile-crop-canvas'];Object.assign(canvas,{getContext:()=>({clearRect(){},drawImage(...args){drawn=args;}}),getBoundingClientRect:()=>({width:240}),setPointerCapture(){},focus(){},toDataURL:()=>JSON.stringify(drawn.slice(1,5))});
 const context={window:{},document:{getElementById:id=>nodes[id]}};
 runInNewContext(readFileSync(new URL('../../calendar/photo-crop.js',import.meta.url),'utf8'),context);
 const crop=context.window.CrownPhotoCrop.create(value=>output=value);crop.load({naturalWidth:600,naturalHeight:600});
 const initial=drawn[1];assert.ok(initial>0);assert.equal(nodes['profile-crop-zoom'].value,'1.2');
 canvas.handlers.pointerdown({button:0,clientX:100,clientY:100,pointerId:1,preventDefault(){}});
 canvas.handlers.pointermove({clientX:112,clientY:100});assert.ok(drawn[1]<initial);assert.equal(output,JSON.stringify(drawn.slice(1,5)));
 canvas.handlers.pointermove({clientX:9999,clientY:100});assert.equal(drawn[1],0);
 canvas.handlers.pointerup();const stopped=output;canvas.handlers.pointermove({clientX:0,clientY:0});assert.equal(output,stopped);
 canvas.handlers.keydown({key:'ArrowLeft',preventDefault(){}});assert.ok(drawn[1]>0);
 crop.clear();assert.equal(nodes['profile-crop-controls'].hidden,true);
});
