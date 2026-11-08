// The terraformed south (Phase 2): authored zones, the creek / reservoir / dam / fords / bridge, forest cover, reachability
// of every authored site, and server-authoritative bio-flora harvesting. Shared ConquestWorld rules (phone == Worker).
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,harvestStep}=await import('../../worker/src/conquest-sim.js');
const A=await import('../../worker/src/conquest-airdrop.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const at=(x,z,surface='ground')=>({x,z,y:surface==='bridge'?W.deckAt(x,z):W.groundAt(x,z),surface});

// ---- zones: authored, 30-40% of the war region, green core, barren Parasite land and far frontier ----
{let n=0,green=0;const c={lush:0,grass:0,lichen:0,barren:0};for(let x=800;x<=1400;x+=8)for(let z=715;z<=1305;z+=8){n++;const k=W.terraZone(x,z);c[k]++;if(k!=='barren')green++;}
 const share=green/n;ok(share>=.3&&share<=.4,'terraformed share of the war region '+(share*100).toFixed(1)+'% (owner: 30-40%)');
 ok(c.lush>0&&c.grass>0&&c.lichen>0,'gradient lush '+c.lush+' / grass '+c.grass+' / lichen '+c.lichen+' cells');
 for(const [n2,x,z] of [['Refuge terminal',1174,1168],['Command Base',1080,1160],['ice-mining crater',930,1180],['reservoir',800,1326]])assert.equal(W.terraZone(x,z),'lush',n2);
 ok(W.terraZone(1180,1080)!=='barren','the oxygen complex is terraformed (blight-pressed edge)');
 ok(W.installations.every(b=>W.terraZone(b.x,b.z)==='barren')&&W.blightAt(1240,920)>.9,'every Parasite installation stays barren under heavy blight');
 let far=0;for(let i=0;i<500;i++){const x=(i*7919)%W.WIDTH,z=(i*104729)%W.LENGTH;if(W.terraZone(x,z)!=='barren'&&(x<640||x>1500||z<900||z>1520))far++;}ok(far===0,'the far frontier stays barren (no noise patches)');
 ok(W.biomeAt(1080,1160)==='terraformed'&&W.biomeAt(1240,920)!=='terraformed','biomeAt follows the authored zones');}

// ---- water: crater pool, creek, fords, reservoir, dam ----
{const k=W.water.crater;ok(W.waterAt(k.x,k.z)?.deep,'the ice-mining crater pool is deep');
 const c=W.water.creek,mid=c[3];ok(W.waterAt(mid[0],mid[1])?.deep&&W.waterAt(mid[0],mid[1]).kind==='creek','the creek core is deep');
 ok(W.water.fords.every(f=>{const w=W.waterAt(f.x,f.z);return w&&!w.deep&&w.depth<=.55&&w.kind==='ford';}),'both fords are shallow (passable, slow)');
 const L=W.water.lake;ok(W.waterAt(L.x,L.z)?.deep&&W.waterAt(L.x,L.z).kind==='lake','the reservoir is deep');
 const d=W.water.dam;ok(W.solidAt((d.x0+d.x1)/2,d.z)&&!W.waterAt((d.x0+d.x1)/2,d.z+4),'the dam is solid and holds the reservoir (dry downstream)');
 ok(W.waterAt(1024,1150)===null&&W.waterAt(1174,1168)===null,'no water in the trench or at the Refuge');}

// ---- movement: deep water blocks, fords and the bridge cross, shallow water slows ----
{const c=W.water.creek,[ax,az]=c[2],[bx,bz]=c[3],tx=bx-ax,tz=bz-az,l=Math.hypot(tx,tz),nx=-tz/l,nz=tx/l,mx=(ax+bx)/2,mz=(az+bz)/2;
 let p=at(mx+nx*9,mz+nz*9);for(let i=0;i<120;i++)p=W.advance(p,-nx*.2,-nz*.2);const w=W.waterAt(p.x,p.z);
 ok(!w?.deep&&Math.hypot(p.x-(mx-nx*9),p.z-(mz-nz*9))>10,'a hull driving at the deep creek stops at the bank');
 const f=W.water.fords[0];for(const fd of W.water.fords){let best=null;for(let i=1;i<c.length;i++){const [px,pz]=c[i-1],[qx,qz]=c[i],L2=Math.hypot(qx-px,qz-pz),u=Math.max(0,Math.min(1,((fd.x-px)*(qx-px)+(fd.z-pz)*(qz-pz))/(L2*L2))),d=Math.hypot(fd.x-px-(qx-px)*u,fd.z-pz-(qz-pz)*u);if(!best||d<best.d)best={d,ux:-(qz-pz)/L2,uz:(qx-px)/L2};}const {ux,uz}=best;
  let q=at(fd.x+ux*8,fd.z+uz*8);const start={...q};for(let k=0;k<260;k++)q=W.advance(q,-ux*.2,-uz*.2);
  ok(Math.hypot(q.x-start.x,q.z-start.z)>14&&W.creekNearest(q.x,q.z).d>W.water.core,'a hull crosses the creek at '+fd.id+' ('+Math.hypot(q.x-start.x,q.z-start.z).toFixed(1)+' m, other bank)');}
 const dry=W.advance(at(1100,1240),.4,0),wet=W.advance(at(f.x,f.z),.4,0);ok(Math.hypot(wet.x-f.x,wet.z-f.z)<Math.hypot(dry.x-1100,dry.z-1240)*.6,'shallow water slows the same input (x'+(Math.hypot(wet.x-f.x,wet.z-f.z)/Math.hypot(dry.x-1100,dry.z-1240)).toFixed(2)+')');
 const b=W.creekBridge;let r=at(b.x-b.ax*(b.half+3),b.z-b.az*(b.half+3));const r0={...r};let onDeck=false;for(let i=0;i<240;i++){r=W.advance(r,b.ax*.2,b.az*.2);if(r.surface==='bridge')onDeck=true;}
 ok(onDeck&&r.surface==='ground'&&Math.hypot(r.x-r0.x,r.z-r0.z)>(2*b.half+4),'the creek bridge carries a hull bank to bank');
 let s=at(b.x,b.z,'bridge');for(let i=0;i<120;i++)s=W.advance(s,b.az*.2,-b.ax*.2);ok(s.surface==='bridge','its railings keep a hull on the deck mid-span');}

// ---- forests: the dense core blocks line of sight and shots (cover); the edge stays open ----
{const f=W.forests[0],y=W.groundAt(f.x,f.z)+2.2,out={x:f.x-f.r-30,y:W.groundAt(f.x-f.r-30,f.z)+2.2,z:f.z},inner={x:f.x,y,z:f.z};
 ok(!C.lineClear(out,inner)&&!C.lineClear({x:f.x-f.r-12,y:W.groundAt(f.x-f.r-12,f.z)+2.2,z:f.z},{x:f.x+f.r+12,y:W.groundAt(f.x+f.r+12,f.z)+2.2,z:f.z}),'a forest core hides a hull and blocks shots through it');
 const P=(x)=>({x,y:W.groundAt(x,f.z)+2.2,z:f.z}),east=P(f.x+f.r+30),edge=P(f.x+f.r-1),outside=P(f.x+f.r+2);assert(C.lineClear(east,outside),'control: open ground east of the stand');
 ok(C.lineClear(east,edge)&&!C.lineClear(east,P(f.x)),'a hull at the forest edge can see and be seen; one in the core cannot');
 ok(W.blockedAt(f.x,W.groundAt(f.x,f.z)+3,f.z)&&!W.blockedAt(f.x,W.groundAt(f.x,f.z)+W.FOREST_CANOPY+1,f.z),'the canopy blocks below 7.5 m, not above');}

// ---- reachability: every authored site and every bio-flora node stays reachable from the spawn ----
{const G=6,x0=640,x1=1460,z0=760,z1=1440,key=(x,z)=>Math.round((x-x0)/G)+':'+Math.round((z-z0)/G),seen=new Map(),queue=[at(898,1024)];seen.set(key(898,1024),queue[0]);
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz] of [[G,0],[-G,0],[0,G],[0,-G]]){const q=W.advance(p,dx,dz);if(Math.hypot(q.x-p.x-dx,q.z-p.z-dz)>1.2||q.x<x0||q.x>x1||q.z<z0||q.z>z1)continue;const k=key(q.x,q.z);if(!seen.has(k)){seen.set(k,q);queue.push(q);}}}
 const reached=(x,z,r)=>{for(const q of seen.values())if(Math.hypot(q.x-x,q.z-z)<=r)return true;return false;};
 const sites=[...Object.values(C.operations).map(o=>['operation '+o.id,o.x,o.z,o.activationRadius||45]),...C.travelNodes(Object.fromEntries(W.sectors.map(s=>[s.id,{owner:'humanity',status:'secured'}])),5).map(n=>['travel '+n.id,n.x,n.z,24]),['Command Base',C.baseDefinition.x,C.baseDefinition.z,C.baseDefinition.radius],['Refuge terminal',1174,1168,12]];
 const missing=sites.filter(([n,x,z,r])=>!reached(x,z,r)).map(s=>s[0]);ok(!missing.length,'all '+sites.length+' authored operations, travel nodes and bases reachable from the spawn ('+seen.size+' cells)'+(missing.length?' missing '+missing:''));
 const lost=W.floraNodes.filter(n=>!reached(n.x,n.z,W.HARVEST.radius));ok(!lost.length,'all '+W.floraNodes.length+' bio-flora nodes reachable within harvest range'+(lost.length?' missing '+lost.map(n=>n.id):''));}

// ---- harvesting: server-authoritative, stationary channel, damage/movement reset, per-pilot regrowth ----
{const node=W.floraNodes[2],t0=Date.UTC(2026,10,9,12),s0=createState(R.STOCK_L,t0);s0.position=at(node.x+2,node.z);s0.battle.enemies=[];s0.lastWall=t0;s0.creditMs=0;
 const step=(s,cmd,now)=>applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0,...cmd}]},now);
 let s=s0,now=t0;for(let i=0;i<79;i++){now+=50;s=step(s,{gather:true},now);}ok(s.channel?.ms===3950&&!s.harvest,'79 steps (3.95 s) of GATHER: channel 3,950 ms, nothing paid yet');
 now+=50;s=step(s,{gather:true},now);ok(s.ledger.cargo.biomass===W.HARVEST.biomass&&s.harvest[node.id]===now+W.HARVEST.respawnMs&&s.notice.kind==='harvest','4 s: +'+W.HARVEST.biomass+' Biomass into cargo; the node regrows for 15 min for this pilot');
 A.seal(s,now);ok(A.airdrop(s).out.at(-1).n.gather===1&&A.airdrop(s).out.at(-1).raw===R.CQ_PTS.gather.flora&&A.activeToday(s,now),'a harvest pays '+R.CQ_PTS.gather.flora+' airdrop points and counts as the day\'s verified activity');
 for(let i=0;i<100;i++){now+=50;s=step(s,{gather:true},now);}ok(s.ledger.cargo.biomass===W.HARVEST.biomass,'a regrowing node cannot be harvested again');
 let m=s0;now=t0;for(let i=0;i<40;i++){now+=50;m=step(m,{gather:true},now);}now+=50;m=step(m,{gather:true,x:1,z:0},now);ok(!m.channel,'driving off resets the channel');
 let r=s0;now=t0;for(let i=0;i<40;i++){now+=50;r=step(r,{gather:true},now);}now+=50;r=step(r,{gather:false},now);ok(!r.channel,'releasing GATHER resets the channel');
 const far=createState(R.STOCK_L,t0);far.position=at(node.x+20,node.z);far.battle.enemies=[];let fs=far;now=t0;for(let i=0;i<100;i++){now+=50;fs=step(fs,{gather:true},now);}ok(!fs.harvest&&fs.ledger.cargo.biomass===0,'out of reach (20 m): no harvest');
 const ms=createState(R.STOCK_L,t0);ms.position=at(node.x+2,node.z);ms.mission='convoy';const fakeB={state:'active',playerHp:100,enemies:[]};for(let i=0;i<120;i++)harvestStep(ms,fakeB,{gather:true},0,false,t0+i*50);ok(!ms.channel&&!ms.harvest,'operations never harvest (mission guard)');
 const hit=createState(R.STOCK_L,t0);hit.position=at(node.x+2,node.z);for(let i=0;i<60;i++)harvestStep(hit,fakeB,{gather:true},0,i===59,t0+i*50);ok(!hit.channel,'taking damage resets the channel');}

console.log(`conquest terraform: passed ${passed}`);
