/* Pointer/wheel controls use logical SVG coordinates, including CSS rotation. */
(() => {
'use strict';
function attachGestures({surface,viewer,onTap=()=>{}}){
 const pointers=new Map(),abort=new AbortController();let gesture=null,moved=false,pinched=false,frame=0,velocity=0,lastFrame=0,suppressUntil=0;
 const listen=(type,fn,options={})=>surface.addEventListener(type,fn,{...options,signal:abort.signal});
 const point=e=>viewer.point(e.clientX,e.clientY);
 function stop(){cancelAnimationFrame(frame);frame=0;velocity=0;}
 function reset(){stop();for(const id of pointers.keys()){try{surface.releasePointerCapture(id)}catch{}}pointers.clear();gesture=null;moved=false;pinched=false;}
 function panBegin(p){const s=viewer.getState();gesture={kind:'pan',x:p.x,y:p.y,start:s.start,span:s.span,width:s.geometry.pw,last:p,lastTime:performance.now(),samples:[{x:p.x,y:p.y,t:performance.now()}]}}
 function pinchBegin(){stop();pinched=true;moved=true;const [a,b]=[...pointers.values()],s=viewer.getState(),mid=(a.x+b.x)/2;gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),span:s.span,anchor:s.start+viewer.fraction(mid)*s.span};}
 function tick(t){const dt=Math.min(40,t-lastFrame);lastFrame=t;const before=viewer.getState();viewer.setRange(before.start+velocity*dt);const after=viewer.getState();velocity*=Math.exp(-dt/500);if(Math.abs(velocity)<.015||Math.abs(after.start-before.start)<.001){stop();return}frame=requestAnimationFrame(tick)}
 listen('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const p=point(e);if(!pointers.size){const wasMoving=frame!==0;stop();moved=wasMoving;pinched=false;panBegin(p)}
  pointers.set(e.pointerId,p);surface.setPointerCapture?.(e.pointerId);if(pointers.size>=2)pinchBegin();
 });
 listen('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;const p=point(e);pointers.set(e.pointerId,p);
  if(pointers.size>=2){if(gesture.kind!=='pinch')pinchBegin();const [a,b]=[...pointers.values()],s=viewer.getState(),distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),span=Math.max(s.minSpan,Math.min(s.max-s.min,gesture.span*gesture.distance/distance));viewer.setRange(gesture.anchor-viewer.fraction((a.x+b.x)/2)*span,span);}
  else{if(gesture.kind!=='pan')panBegin(p);const dx=p.x-gesture.x,dy=p.y-gesture.y;if(Math.hypot(dx,dy)>5)moved=true;if(moved)viewer.setRange(gesture.start-dx*gesture.span/gesture.width,gesture.span);const now=performance.now();gesture.samples.push({x:p.x,y:p.y,t:now});while(gesture.samples.length>2&&gesture.samples[0].t<now-90)gesture.samples.shift();}
 });
 function end(e){
  if(!pointers.has(e.pointerId))return;const p=point(e),g=gesture,normal=e.type==='pointerup';pointers.delete(e.pointerId);
  if(pointers.size){if(pointers.size>1)pinchBegin();else panBegin([...pointers.values()][0]);return}
  gesture=null;if(!normal){stop();return}
  if(moved||pinched){suppressUntil=performance.now()+400;
   if(!pinched&&g?.kind==='pan'&&g.samples.length>1){const a=g.samples[0],b=g.samples.at(-1),dt=b.t-a.t,dx=b.x-a.x,dy=b.y-a.y;if(dt>4&&performance.now()-b.t<90&&Math.abs(dx)>Math.abs(dy)*1.2&&Math.abs(dx/dt)>.25){velocity=Math.max(-2,Math.min(2,-dx/dt))*g.span/g.width;lastFrame=performance.now();frame=requestAnimationFrame(tick)}}
  }else onTap(p);
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(type,end);
 listen('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}},{capture:true});
 listen('wheel',e=>{e.preventDefault();stop();const p=point(e),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?300:1);if(e.ctrlKey||e.metaKey)viewer.zoom(Math.exp(-delta*.003),viewer.fraction(p.x));else{const s=viewer.getState();viewer.setRange(s.start+(Math.abs(e.deltaX)>Math.abs(delta)?e.deltaX:delta)*s.span/s.geometry.pw)}},{passive:false});
 listen('keydown',e=>{if(e.target!==surface&&e.target.tagName.toLowerCase()!=='svg')return;const s=viewer.getState();if(['ArrowLeft','ArrowRight','+','=','-','Home'].includes(e.key)){e.preventDefault();stop();if(e.key==='Home')viewer.fit();else if(e.key==='ArrowLeft'||e.key==='ArrowRight')viewer.setRange(s.start+s.span*.15*(e.key==='ArrowLeft'?-1:1));else viewer.zoom(e.key==='-'?1/1.3:1.3)}});
 return {reset,stop,destroy(){reset();abort.abort()}};
}
window.ChizuDiagram.attachGestures=attachGestures;
})();
