// The physical-input raid pilot of dev/tests/conquest-raids.mjs (route planner, priority target, watchdog, hazard dodge, shield
// under 80%, super when full), shared by the Session 6C battalion checks (dev/tests/conquest-allies.mjs section 10). Real commands
// replayed by the Worker reducer (applyCommands); it never teleports or edits battle state. With a roster and a Hangar in the record,
// the Worker fields the pilot's allies itself (worker/src/conquest-battalion.js field) exactly as for a real pilot.
export function raidPilot({C,W,K,R,createState,applyAction,applyCommands,hydrate}){
 function planRoute(p,target,b,enemy){const step=4,origin={x:p.x,z:p.z},key=(x,z)=>x+':'+z,open=[{i:0,j:0,g:0,f:Math.hypot(target.x-p.x,target.z-p.z)}],best=new Map([[key(0,0),0]]),parent=new Map(),point=n=>({x:origin.x+n.i*step,z:origin.z+n.j*step,y:W.groundAt(origin.x+n.i*step,origin.z+n.j*step),surface:'ground'});let end=null;
  for(let n=0;open.length&&n<2500;n++){open.sort((a,b)=>b.f-a.f);const a=open.pop(),ap=point(a);if(Math.hypot(ap.x-target.x,ap.z-target.z)<(enemy?17:6)&&(!enemy||K.visible(b,ap,target))){end=a;break;}for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const i=a.i+di,j=a.j+dj;if(Math.abs(i)>36||Math.abs(j)>36)continue;const g=a.g+Math.hypot(di,dj)*step,k=key(i,j);if(g>=(best.get(k)??Infinity))continue;const q=W.advance(ap,di*step,dj*step);if(Math.hypot(q.x-(origin.x+i*step),q.z-(origin.z+j*step))>.3)continue;best.set(k,g);parent.set(k,a);open.push({i,j,g,f:g+Math.hypot(target.x-q.x,target.z-q.z)});}}
  if(!end)return [];const route=[];while(end.i||end.j){route.push(point(end));end=parent.get(key(end.i,end.j));}return route.reverse();}
 // setup(s): place a roster / Hangar before the start (the Worker fields from it); each(b, s): per-step instrumentation
 return function runRaid(id,L,{setup=null,each=null,now:t0=1800000000000}={}){
  const o=C.operations[id];let now=t0,s=createState(L,now);s.completed=Object.fromEntries(C.fieldMissionIds.map(id=>[id,{at:now,attempt:0}]));if(setup)setup(s,now);const q=o.entry;s.position={x:q[0],z:q[1],y:W.groundAt(q[0],q[1]),surface:'ground'};s=applyAction(s,{seq:1,action:'start-mission',mission:id},now);let steps=0,stuck=0,planned=[],bestGap=Infinity,sinceBest=0,goalKey='';
  while(s.battle.state==='active'&&steps<10000){
   const b=hydrate(s),p=s.position,alive=b.enemies.filter(e=>e.hp>0&&!e.resident),threats=b.enemies.filter(e=>e.hp>0&&(!e.resident||Math.hypot(e.x-p.x,e.z-p.z)<45)),visible=threats.filter(e=>K.visible(b,p,e));
   const priority=visible.find(e=>e.id===b.carrierId)||visible.find(e=>e.immobile)||visible[0]||alive[0];
   let target=priority||b.objective;
   if(!priority&&['battery','extraction'].includes(o.family)&&b.scans<(o.family==='battery'?2:3)&&b.nodes[b.scans])target={x:b.nodes[b.scans][0],z:b.nodes[b.scans][1]};
   const key=(priority?'e'+priority.id:'n'+b.scans)+':'+b.stage,gap=Math.hypot(target.x-p.x,target.z-p.z);if(key!==goalKey){goalKey=key;bestGap=gap;sinceBest=0;}else if(gap<bestGap-.5){bestGap=gap;sinceBest=0;}else sinceBest++;
   if(planned.length&&Math.hypot(planned[0].x-p.x,planned[0].z-p.z)<2)planned.shift();if(stuck>5||sinceBest>60&&!planned.length||!planned.length&&priority&&!K.visible(b,p,priority)){planned=planRoute(p,target,b,!!priority);stuck=0;if(sinceBest>60){sinceBest=0;bestGap=gap;}}const steering=planned[0]||target;
   const dx=steering.x-p.x,dz=steering.z-p.z,d=Math.hypot(dx,dz),move=planned.length?d>1:priority?d>18||!K.visible(b,p,priority):d>4;
   let mx=move?dx/(d||1):0,mz=move?dz/(d||1):0;
   const hazard=b.hazards?.find(h=>Math.hypot(h.x-p.x,h.z-p.z)<h.radius+2);if(hazard){const ax=p.x-hazard.x,az=p.z-hazard.z,n=Math.hypot(ax,az)||1;mx=Math.hypot(ax,az)<.01?1:ax/n;mz=Math.hypot(ax,az)<.01?0:az/n;}
   if(move&&!hazard&&!planned.length){let best=-Infinity;for(const off of [0,.6,-.6,1.2,-1.2,1.8,-1.8,2.4,-2.4]){const a=Math.atan2(mx,mz)+off,vx=Math.sin(a),vz=Math.cos(a),q=W.advance(p,vx*4,vz*4),travel=Math.hypot(q.x-p.x,q.z-p.z),score=travel>2?-Math.hypot(steering.x-q.x,steering.z-q.z)-Math.abs(off)*.7:-Infinity;if(score>best){best=score;mx=vx;mz=vz;}}}
   const input={x:mx,z:mz,fire:!!priority,lockId:priority?.id||null,aimYaw:Math.atan2(priority?priority.x-p.x:dx,priority?priority.z-p.z:dz),shield:b.playerHp<b.playerMax*.8,super:b.charge>=1000||!!(b.superAttack&&b.superAttack.bar&&b.superAttack.oc===undefined&&b.superAttack.el>=b.superAttack.bar.z0+0.06)};
   const before={...p};now+=50;s=applyCommands(s,{seq:s.seq+1,commands:[input]},now);steps++;stuck=move&&Math.hypot(s.position.x-before.x,s.position.z-before.z)<.03?stuck+1:0;if(each)each(s,steps);
  }
  const B=s.battle;return {id,danger:o.danger,family:o.family,outcome:B.state,seconds:steps/20,hullLeft:Math.round(100*Math.max(0,s.hp)/hydrate(s).playerMax),kills:B.kills|0,akills:B.akills|0,pilotDmg:Math.round(B.pilotDmg||0),allyDmg:Math.round(B.allyDmg||0),downs:B.downs|0,state:s};};}
