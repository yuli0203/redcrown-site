(() => {
  function bounds(width,height,zoom,x,y){
    const size=Math.min(width,height)/zoom;
    return {x:(width-size)*x,y:(height-size)*y,size};
  }
  if(typeof module!=='undefined')module.exports={bounds};
  if(typeof window==='undefined')return;
  window.CrownPhotoCrop={create(onChange){
    const $=id=>document.getElementById(id),canvas=$('profile-crop-canvas'),controls=$('profile-crop-controls');
    const zoom=$('profile-crop-zoom'),x=$('profile-crop-x'),y=$('profile-crop-y');let source=null,drag=null;
    function draw(){
      if(!source)return;
      const b=bounds(source.naturalWidth,source.naturalHeight,Number(zoom.value),Number(x.value)/100,Number(y.value)/100);
      const context=canvas.getContext('2d');context.clearRect(0,0,320,320);context.drawImage(source,b.x,b.y,b.size,b.size,0,0,320,320);
      // Store the square crop; circular display is handled consistently by CSS.
      onChange(canvas.toDataURL('image/webp',.88));
    }
    function reset(){zoom.value='1.2';x.value=y.value='50';draw();}
    for(const input of [zoom,x,y])input.addEventListener('input',draw);
    $('profile-crop-reset').addEventListener('click',reset);
    canvas.addEventListener('pointerdown',event=>{if(!source||event.button!==0)return;event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);drag={left:event.clientX,top:event.clientY,x:Number(x.value),y:Number(y.value)};});
    canvas.addEventListener('pointermove',event=>{
      if(!drag||!source)return;const b=bounds(source.naturalWidth,source.naturalHeight,Number(zoom.value),0,0),scale=b.size/canvas.getBoundingClientRect().width;
      const clamp=n=>Math.max(0,Math.min(100,n));
      if(source.naturalWidth>b.size)x.value=clamp(drag.x-(event.clientX-drag.left)*scale/(source.naturalWidth-b.size)*100);
      if(source.naturalHeight>b.size)y.value=clamp(drag.y-(event.clientY-drag.top)*scale/(source.naturalHeight-b.size)*100);
      draw();
    });
    canvas.addEventListener('keydown',event=>{const moves={ArrowLeft:[2,0],ArrowRight:[-2,0],ArrowUp:[0,2],ArrowDown:[0,-2]};if(!source||!moves[event.key])return;event.preventDefault();const [dx,dy]=moves[event.key],step=event.shiftKey?5:1;x.value=Math.max(0,Math.min(100,Number(x.value)+dx*step));y.value=Math.max(0,Math.min(100,Number(y.value)+dy*step));draw();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
    return {load(image){source=image;controls.hidden=false;reset();},clear(){source=null;drag=null;controls.hidden=true;canvas.getContext('2d').clearRect(0,0,320,320);}};
  }};
})();
