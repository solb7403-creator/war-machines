/* Session 7C STEP 3 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; the old brief's D, Decision 14 default a): the Hive Titan.
   Every 6th Meteor Strike slot (slot % 6 === 0: the impacts at 00:00 and 12:00 UTC) the Titan rises at the strike's crater once its
   core is extracted: a per-pilot fight in the pilot's own world, with fixed stats (never scaled to the pilot, the gear or the
   Battalion): 9,000 hull, three phases (CHARGE + SLAM, BURROW + SWARM, PLASMA RAIN with telegraphed rings; each phase change marked on
   its hull bar at 2/3 and 1/3), a 4-minute clock. Shared by the phone and the Worker (the Worker bundle includes it); every result is
   decided on the Worker (worker/src/conquest-titan.js): the kill pays 1,600 base points once per slot and its LOOT.titan roll (pity:
   never more than 5 Titans without a Selenite); the pilot's own damage posts to the weekly Titan board. STAND-IN looks through named
   hooks (HOOKS) for a later Fable session: the Titan is drawn as an enlarged Parasite heavy, its rings and lanes as marked zones. */
(function(root){
'use strict';
const CC=root.ConquestCombat,W=()=>root.ConquestWorld;
// allyMul: the Titan's hide takes a quarter of allied fire (a fixed stat, the same for every pilot; lead's design, measured: with the
// Platoon it fell in about 38 s with the pilot dealing about 2,000 of its 9,000, its phases and clock meaningless). The Wing draws its
// fire and burns the swarm; the pilot does the damage its board ranks.
const TITAN=Object.freeze({hp:9000,clockS:240,every:6,points:1600,allyMul:.25,phases:Object.freeze([2/3,1/3]),radius:160,
 charge:Object.freeze({firstS:5,everyS:9,tellS:1.4,len:28,hitR:4.5,dmg:110,slamR:9,slamTellS:1.2,slamDmg:150}),
 burrow:Object.freeze({everyS:24,durS:7,swarm:6,maxAdds:10,eruptR:8,eruptTellS:1.5,eruptDmg:170,offset:12}),
 rain:Object.freeze({everyS:3.6,enrageAtS:180,enrageEveryS:2.2,n:4,r:6,tellS:1.6,dmg:130,spread:16})});
const PHASES=Object.freeze(['','CHARGE + SLAM','BURROW + SWARM','PLASMA RAIN']);
const HOOKS=Object.freeze({model:'hive-titan',ring:'titan-ring',lane:'titan-charge-lane',burrow:'titan-burrow',erupt:'titan-erupt',rain:'titan-plasma'});   // the names a later Fable session draws (js/conquest/titanview.js holds the stand-ins)
const isTitan=id=>id==='hive-titan',isTitanSlot=slot=>Number.isSafeInteger(Number(slot))&&Number(slot)>0&&Number(slot)%TITAN.every===0;
// the Meteor Strike clock (ConquestCombat.meteorStrike): this slot and the next Titan slot's impact time
function slotNow(now){return CC.meteorStrike(now);}
function nextTitan(now){const M=slotNow(now),every=M.impactAt/M.slot,win=M.closesAt-M.impactAt;let s=M.slot;if(!(isTitanSlot(s)&&now<M.closesAt))s=(Math.floor(s/TITAN.every)+1)*TITAN.every;const impactAt=s*every,n=CC.strikeSites.length;
 return {slot:s,impactAt,closesAt:impactAt+win,site:CC.strikeSites[((s%n)+n)%n],live:s===M.slot&&M.phase==='open'};}
const hhmm=t=>{const d=new Date(t);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');};
// the Titan rises at the strike's crater, 26 m beyond the core
const arenaOf=site=>({x:site.x,z:site.z-26});
function hash(seed,k){let h=(seed>>>0)^2166136261;const s=String(k);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)/4294967296;}
class Hunt extends CC.Operation{
 constructor(loadout,p,id){super(loadout,p,id);this.enemies=[];this.id=30000;this.objectiveDamageable=false;
  this.ttn={slot:0,phase:1,next:{charge:TITAN.charge.firstS,burrow:0,rain:0},rings:[],chg:null,burrowUntil:0,erupt:null,adds:0,n:0,tid:0,clear:0,mark:[0,0],say:{t:'THE HIVE TITAN RISES',at:0}};
  this.spawnTitan(arenaOf({x:p.x,z:p.z}));}
 // the Worker's start: the slot and its crater (the phone gets the same through the saved battle)
 setup({slot=0,site=null}={}){const c=this.ttn;c.slot=Number(slot)|0;if(site){const a=arenaOf(site),T=this.titan();if(T){T.x=a.x;T.z=a.z;T.y=W().groundAt(a.x,a.z);T.home={x:a.x,z:a.z,y:T.y+2.2};}this.objective={x:a.x,y:W().groundAt(a.x,a.z)+2.2,z:a.z};}return this;}
 restore(){const L=v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[],c=this.ttn&&typeof this.ttn==='object'?this.ttn:{};c.rings=L(c.rings);c.mark=L(c.mark);while(c.mark.length<2)c.mark.push(0);c.next=c.next&&typeof c.next==='object'?c.next:{charge:0,burrow:0,rain:0};c.say=c.say&&typeof c.say==='object'?c.say:{t:'',at:0};this.ttn=c;return this;}
 spawnTitan(a){this.deploy('sentinel',a.x,a.z,'titan');const e=this.enemies.at(-1);Object.assign(e,{titan:1,commander:true,hp:TITAN.hp,maxHp:TITAN.hp,noLoot:true,lootCreated:true,wave:'titan',cd:2,tp:0});this.ttn.tid=e.id;this.objective={x:a.x,y:W().groundAt(a.x,a.z)+2.2,z:a.z};}
 titan(){return this.enemies.find(e=>e.id===this.ttn.tid);}
 say(t){this.ttn.say={t,at:Math.round(this.time*10)/10};}
 rnd(k){return hash(this.seed|0,k+':'+(this.ttn.n++));}
 mark(kind,x,z,r,tellS){this.hazards=Array.isArray(this.hazards)?this.hazards:[];if(this.hazards.length>=10)return;this.hazards.push({kind,x,z,y:W().groundAt(x,z),radius:r,remaining:tellS,damage:0,source:0,hook:HOOKS[kind]||kind});}
 ring(kind,x,z,r,tellS,dmg){this.ttn.rings.push({k:kind,x:Math.round(x*10)/10,z:Math.round(z*10)/10,r,at:Math.round((this.time+tellS)*100)/100,dmg});this.mark(kind,x,z,r,tellS);}
 // the burrowed Titan is out of reach: under its own crater, dormant (no unit targets it, no shot reaches it)
 choose(e){if(e.titan){if(this.ttn.burrowUntil||this.ttn.chg){e.vx=e.vz=0;e.cd=Math.max(e.cd||0,.3);e.telegraph=true;return;}e.telegraph=false;}super.choose(e);}
 step(dt,fire){super.step(dt,fire);if(this.state!=='active')return;const T=this.titan();
  if(!T||T.hp<=0){this.state='victory';this.ttn.clear=Math.round(this.time*1000);this.ttn.rings=[];this.projectiles=[];this.say('THE HIVE TITAN FALLS');return;}
  if(this.time>=TITAN.clockS){this.state='defeat';this.reason='The Hive Titan burrowed away';this.projectiles=[];this.say('THE TITAN BURROWS AWAY');return;}
  this.titanStep(T);this.impacts();}
 titanStep(T){const c=this.ttn,t=this.time,P=this.player,f=T.hp/T.maxHp,ph=f>TITAN.phases[0]?1:f>TITAN.phases[1]?2:3;
  if(ph>c.phase){for(let k=c.phase;k<ph;k++)c.mark[k-1]=Math.max(.01,Math.round(t*100)/100);c.phase=ph;c.chg=null;this.say('PHASE '+['','I','II','III'][ph]+' · '+PHASES[ph]);c.next.burrow=t+1;c.next.rain=t+1.5;}
  if(c.burrowUntil){if(t<c.burrowUntil)return;const q=c.erupt||{x:P.x,z:P.z};T.dormant=false;T.x=q.x;T.z=q.z;T.y=W().groundAt(q.x,q.z);c.burrowUntil=0;c.erupt=null;this.say('IT ERUPTS');return;}
  if(c.phase===1){const C=TITAN.charge;
   if(c.chg&&t>=c.chg.at){const g=c.chg,dx=g.to[0]-g.from[0],dz=g.to[1]-g.from[1],L=Math.hypot(dx,dz)||1,k=Math.min(1,C.len/L),q=W().advance({x:T.x,z:T.z,y:T.y,surface:'ground'},dx*k,dz*k);
    for(const u of this.units())if(segDist(u.x,u.z,T.x,T.z,q.x,q.z)<C.hitR)this.hurt(u,C.dmg,T.id);
    T.x=q.x;T.z=q.z;T.y=q.y??W().groundAt(q.x,q.z);c.chg=null;this.ring('ring',T.x,T.z,C.slamR,C.slamTellS,C.slamDmg);this.say('SLAM · GET OUT OF THE RING');}
   else if(!c.chg&&t>=c.next.charge){c.chg={at:Math.round((t+C.tellS)*100)/100,from:[T.x,T.z],to:[P.x,P.z]};c.next.charge=t+C.everyS;this.mark('lane',(T.x+P.x)/2,(T.z+P.z)/2,Math.max(4,Math.hypot(P.x-T.x,P.z-T.z)/2),C.tellS);this.say('IT CHARGES · SIDESTEP');}}
  if(c.phase===2&&t>=c.next.burrow){const B=TITAN.burrow,a=this.rnd('erupt')*6.283,x=P.x+Math.sin(a)*B.offset,z=P.z+Math.cos(a)*B.offset;
   T.dormant=true;T.y=W().groundAt(T.x,T.z)-40;c.burrowUntil=t+B.durS;c.erupt={x,z};c.next.burrow=t+B.everyS;
   const room=Math.max(0,B.maxAdds-this.enemies.filter(e=>e.hp>0&&e.swarm).length);for(let i=0;i<Math.min(B.swarm,room);i++){const b=this.rnd('add')*6.283;try{this.deploy('swarm',P.x+Math.sin(b)*22,P.z+Math.cos(b)*22,'titan:swarm:'+(++c.adds));const e=this.enemies.at(-1);e.swarm=1;e.noLoot=true;e.lootCreated=true;}catch(_){break;}}
   this.ring('erupt',x,z,B.eruptR,B.durS,B.eruptDmg);this.say('IT BURROWS · THE SWARM COMES · WATCH THE GROUND');}
  if(c.phase===3&&t>=c.next.rain){const R=TITAN.rain,mates=this.friends.filter(u=>u.side==='mine'&&!u.down&&u.hp>0);const spots=[[P.x,P.z]];if(mates.length){const m=mates[Math.floor(this.rnd('mate')*mates.length)];spots.push([m.x,m.z]);}
   while(spots.length<R.n){const a=this.rnd('rain')*6.283,d=4+this.rnd('rd')*R.spread;spots.push([P.x+Math.sin(a)*d,P.z+Math.cos(a)*d]);}for(const [x,z] of spots)this.ring('rain',x,z,R.r,R.tellS,R.dmg);
   c.next.rain=t+(t>=R.enrageAtS?R.enrageEveryS:R.everyS);if(t>=R.enrageAtS&&!c.enraged){c.enraged=1;this.say('THE TITAN ENRAGES · THE RAIN QUICKENS');}}}
 units(){return [this.player,...this.friends.filter(u=>u.side==='mine'&&!u.down&&u.hp>0)];}
 hurt(u,dmg,src){if(u===this.player){this.hitBy=src||-1;let d=dmg*(1-armor(this.playerStats));if(this.shieldT>0)d*=SHIELD_MULT;this.playerHp=Math.max(0,this.playerHp-d);return;}u.hp=Math.max(0,u.hp-dmg*(1-armor(CC.friendStats(u))));if(u.hp<=0)this.friendDown?.(u);}
 impacts(){const c=this.ttn,t=this.time;for(const r of c.rings.filter(x=>x.at<=t)){for(const u of this.units())if(Math.hypot(u.x-r.x,u.z-r.z)<r.r)this.hurt(u,r.dmg,this.ttn.tid);this.effects.push({kind:'destroy',weapon:'siege',x:r.x,y:W().groundAt(r.x,r.z)+.8,z:r.z,r:r.r,life:.6});}c.rings=c.rings.filter(x=>x.at>t);}
}
function segDist(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1,k=Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/l2));return Math.hypot(px-(ax+dx*k),pz-(az+dz*k));}
const make=(loadout,p,id)=>new Hunt(loadout,p,id);
// the pilot's Titan record (s.ttn on the Worker): per slot {k: killed, d: the best damage of the slot's attempts, a: attempts}; pity: kills since a Selenite
function norm(v){const o=v&&typeof v==='object'&&!Array.isArray(v)?v:{};const sl={};for(const [k,x] of Object.entries(o.sl||{}))if(isTitanSlot(k)&&x&&typeof x==='object')sl[k]={k:x.k?1:0,d:Math.max(0,Math.round(Number(x.d)||0)),a:Math.max(0,x.a|0)};
 const keep=Object.keys(sl).map(Number).sort((a,b)=>b-a).slice(0,64);   /* 64: a 30-day board period holds 60 Titan slots (review round 1) */return {v:1,sl:Object.fromEntries(keep.map(k=>[k,sl[k]])),kills:Math.max(0,o.kills|0)};}   // the Selenite pity lives with the loot pity (conquest-loot.js inventory pity.t)
// why a Titan hunt cannot start now ('' = it can): this slot is a Titan slot, its core extracted by this pilot, its window open, not yet killed
function startWhy(s,now){const M=slotNow(now),slot=Number(s?.strikeSlot);if(!isTitanSlot(slot))return 'the Hive Titan rises only in a Titan slot (every 6th Meteor Strike)';
 if(!s?.strikes?.[slot]?.claimed)return 'extract this strike\'s core first: the Titan rises after it';
 const open=slot===M.slot&&now<M.closesAt||!!(s?.bcn&&Number(s.bcn.slot)===slot&&Number(s.bcn.until)>now);if(!open)return 'this Titan slot has closed';   /* the beacon on this slot counts in its idle phase too (review round 1) */
 if(norm(s?.ttn).sl[slot]?.k)return 'you already brought down this slot\'s Titan';return '';}
root.ConquestTitan=Object.freeze({TITAN,PHASES,HOOKS,Hunt,make,norm,isTitan,isTitanSlot,nextTitan,startWhy,arenaOf,hhmm,slotNow});
})(globalThis);
