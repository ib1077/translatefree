/* Plan against a fixed full-day diagram, never against the current viewport. */
(() => {
'use strict';
function poseLabel(plan,coords){
 const a=coords[plan.segment],b=coords[plan.segment+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
 const ux=dx/len,uy=dy/len,side=dy<0?-1:1;
 return {x:a[0]+dx*plan.fraction-uy*side*plan.offset,y:a[1]+dy*plan.fraction+ux*side*plan.offset,
  angle:Math.atan2(dy,dx)*180/Math.PI,ux,uy,width:plan.width,height:plan.fontSize+2};
}
function local(p,box){const dx=p[0]-box.x,dy=p[1]-box.y;return [dx*box.ux+dy*box.uy,-dx*box.uy+dy*box.ux]}
function crosses(a,b,box,pad=2){
 a=local(a,box);b=local(b,box);let lo=0,hi=1;
 for(let i=0;i<2;i++){const extent=(i?box.height:box.width)/2+pad,d=b[i]-a[i];if(Math.abs(d)<1e-9){if(Math.abs(a[i])>extent)return false;continue}
  const t1=(-extent-a[i])/d,t2=(extent-a[i])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;
 }return true;
}
function corners(b){return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>[b.x+sx*b.width/2*b.ux-sy*b.height/2*b.uy,b.y+sx*b.width/2*b.uy+sy*b.height/2*b.ux])}
function overlaps(a,b){const ca=corners(a),cb=corners(b);return [a,b].every(r=>[[r.ux,r.uy],[-r.uy,r.ux]].every(([x,y])=>{const pa=ca.map(p=>p[0]*x+p[1]*y),pb=cb.map(p=>p[0]*x+p[1]*y);return Math.min(...pa)<=Math.max(...pb)+3&&Math.min(...pb)<=Math.max(...pa)+3}))}
function planLabels(data,{printMode=false,overrides={}}={}){
 const km=new Map(data.stations.map(s=>[s.id,s.km])),lo=Math.min(...km.values()),hi=Math.max(...km.values());
 const width=printMode?1106:692,height=printMode?316:323;
 const project=p=>[(p.seconds-data.view.startSeconds)/(data.view.endSeconds-data.view.startSeconds)*width,(km.get(p.station)-lo)/(hi-lo)*height];
 const routes=new Map(data.trains.map(t=>[t.id,t.points.map(project)]));
 const segments=[...routes.values()].flatMap(points=>points.slice(1).map((b,i)=>[points[i],b]));
 const priority=t=>['hakuto','inaba'].includes(t.service)?0:1;
 const ordered=[...data.trains].sort((a,b)=>priority(a)-priority(b)||a.points[0].seconds-b.points[0].seconds||a.id.localeCompare(b.id));
 const plans=new Map(),placed=[];
 for(const t of ordered){
  const coords=routes.get(t.id),override=overrides[t.id];let best=null,bestBox=null,bestScore=Infinity;
  const candidates=[];
  for(let i=0;i<coords.length-1;i++){
   if(coords[i][1]===coords[i+1][1])continue;
   for(const fraction of [.3,.55,.8])for(const fontSize of [priority(t)?9:10,priority(t)?8:9]){
    const plan={segment:i,fraction,fontSize,offset:fontSize/2+3,width:t.id.length*fontSize*.64+2};candidates.push(plan);
   }
  }
  if(!candidates.length)candidates.push({segment:0,fraction:.5,fontSize:9,offset:8,width:t.id.length*6+2});
  if(override){const p={...candidates[0],...override};p.width=t.id.length*p.fontSize*.64+2;if(Number.isInteger(p.segment)&&p.segment>=0&&p.segment<coords.length-1&&p.fraction>=0&&p.fraction<=1&&p.fontSize>0&&p.fontSize<=30&&Number.isFinite(p.offset))candidates.splice(0,candidates.length,p);}
  for(const plan of candidates){
   const box=poseLabel(plan,coords),lineHits=segments.reduce((sum,[a,b])=>sum+Number(crosses(a,b,box)),0),labelHits=placed.reduce((sum,b)=>sum+Number(overlaps(box,b)),0);
   const outside=corners(box).some(([x,y])=>x<0||x>width||y<0||y>height);
   const progress=(t.points[plan.segment].seconds-t.points[0].seconds)/Math.max(1,t.points.at(-1).seconds-t.points[0].seconds);
   const score=outside*100000+lineHits*10000+labelHits*2000+progress*100+plan.fraction+(10-plan.fontSize)*2;
   if(score<bestScore){bestScore=score;best=plan;bestBox=box;}
  }
  plans.set(t.id,Object.freeze({...best}));placed.push(bestBox);
 }
 return plans;
}
Object.assign(window.ChizuDiagram,{planLabels,poseLabel});
})();
