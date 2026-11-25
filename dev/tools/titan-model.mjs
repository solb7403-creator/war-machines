// Session 7C STEP 3: the Hive Titan measured with the real hunt (js/conquest/titan.js through the Worker bundle, real commands) and a
// careful bot pilot (keeps 30-60 m from the Titan, sidesteps a telegraphed charge lane, leaves a marked ring, burns the adds that bite,
// raises SHIELD under fire), on each profile's kit by day (dev/tools/citadel-model.mjs kitAt: the tank, the Battalion) with the Wing
// that follows a pilot everywhere (at most 2 allies: a solo hunt, the blueprint's first Titan). Deterministic and read-only. usage: node dev/tools/titan-model.mjs [--json out.json]
import {writeFileSync,mkdirSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Control:K,Titan:TT,Battalion:BT}=CONQUEST;
const CM=await import('./citadel-model.mjs');
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function hunt({L,allies=[],seed=1,slot=6*4000,maxSteps=6000,ally=2}={}){const site=C.strikeSites[slot%C.strikeSites.length],p0={x:site.x,z:site.z+8,y:W.groundAt(site.x,site.z+8),surface:'ground'};
 const B=TT.make(L,p0,'hive-titan').setup({slot,site});B.seed=(0x71743a4e^Math.imul(seed|0,2654435761))>>>0;B.squad.orders=1;B.squad.f='wedge';
 allies.slice(0,ally).forEach((a,i)=>{const sl=C.FORMS.wedge[i%C.FORMS.wedge.length];B.friends.push(C.friendUnit({id:800000001+i,side:'mine',pid:'p'+i,role:a.role,kit:a.kit,m:BT.strength(a.rk,a.lv||1),x:p0.x+sl[0]*.5,z:p0.z+sl[1]*.5-4}));});
 const p={...p0};let steps=0;const range=C.engineeringValues(B.playerStats,B.engineering).range;
 while(B.state==='active'&&steps<maxSteps){const T=B.titan(),c=B.ttn,live=B.enemies.filter(e=>e.hp>0&&!e.dormant);const near=live.filter(e=>!e.titan&&dist(e,p)<14).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  const tgt=near||(T&&!T.dormant?T:null)||live[0]||null;let mx=0,mz=0;
  if(tgt){const d=dist(tgt,p)||1,ux=(tgt.x-p.x)/d,uz=(tgt.z-p.z)/d,lo=tgt.titan?30:6,hi=tgt.titan?Math.min(60,range*.8):range*.6;if(d<lo){mx=-ux;mz=-uz;}else if(d>hi){mx=ux;mz=uz;}else{mx=-uz*.6;mz=ux*.6;}}
  {let rx=0,rz=0;for(const r of c.rings){const d=Math.hypot(r.x-p.x,r.z-p.z);if(d<r.r+3){const ax=p.x-r.x,az=p.z-r.z,n=d||1,w=(r.r+3-d)/(r.r+3);rx+=ax/n*w;rz+=az/n*w;}}if(rx||rz){const n=Math.hypot(rx,rz)||1;mx=rx/n;mz=rz/n;}}   // every marked ring pushes: leave them all
  if(c.chg&&T){const ax=c.chg.to[0]-c.chg.from[0],az=c.chg.to[1]-c.chg.from[1],n=Math.hypot(ax,az)||1;mx=-az/n;mz=ax/n;}   // sidestep the lane
  const m=Math.hypot(mx,mz);if(m>1){mx/=m;mz/=m;}
  const cmd=K.validated(K.command({x:mx,z:mz,fire:!!tgt,lockId:tgt?.id||null,aimYaw:tgt?Math.atan2(tgt.x-p.x,tgt.z-p.z):0,shield:B.playerHp<B.playerMax*.7,super:B.charge>=1000}));
  Object.assign(p,K.advance(B,p,cmd,.05,false));steps++;}
 const T=B.titan();return {outcome:B.state,seconds:Math.round(B.time),phase:B.ttn.phase,titanHp:Math.round(T?.hp||0),pilotDmg:Math.round(T?.tp||0),hull:Math.round(100*Math.max(0,B.playerHp)/B.playerMax),reason:B.reason||'',allies:Math.min(ally,allies.length)};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){const out={};
 for(const prof of ['regular','heavy','grinder'])for(const d of (process.argv.includes('--quick')?[1,15,30,60]:[1,5,10,15,20,30,45,60,90])){const k=CM.kitAt(prof,d),runs=[1,2,3,4].map(sd=>hunt({L:k.L,allies:k.allies,seed:sd}));const won=runs.filter(r=>r.outcome==='victory');
  out[prof+'@'+d]={won:won.length+'/4',secs:won.map(r=>r.seconds),dmg:runs.map(r=>r.pilotDmg),hull:runs.map(r=>r.hull),phase:runs.map(r=>r.phase),allies:runs[0].allies};console.log(prof,d,JSON.stringify(out[prof+'@'+d]));}
 const o=process.argv.indexOf('--json');if(o>0){mkdirSync('docs/conquest/session7c',{recursive:true});writeFileSync(process.argv[o+1],JSON.stringify(out,null,1)+'\n');}}
