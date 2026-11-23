/* Session 7T Living Town (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md, decisions 3, 5, 6, 7): the town raid engine,
   resumable. A line-for-line port of js/conquest/plot.js drillGen (Session 5B's whole-town raid, the one raid engine) into a stepped
   machine whose whole state can be saved and restored, so the Worker can run a live defense request by request at the world's
   50 ms step (worker/src/conquest-town.js) and the phone can predict the same steps (js/conquest/towndefense.js).
   With no garrison, no pilot and the drill's lane order it gives exactly drill()'s result (dev/tests/conquest-raid-engine.mjs
   proves it on every site, several towns and seeds). Added for town attacks, all off unless asked for:
    - opt.lane: the attack's main lane (blueprint §5: "composition and direction vary"): half of the spawns use it;
    - opt.units: defenders that fight beside the turrets: the garrison (your reserve pilots, decision 7), the fielded Platoon and
      the pilot's own tank (decision 6). Their stats come from the same tankOf() rules as the player's tank (strength = rating +
      gear, decision 8); raiders that reach a defender fight it; a defender at 0 HP is down for the rest of the raid (never lost);
    - opt.dt: the step (0.1 s like the drill; the live defense uses 0.05 s, the world's step).
   The raid's strength comes only from the raid level (decision 3: THREAT, never Command Center level, gear or purchases).
   Nothing here grants anything: the Worker settles every result. */
(function(root){
'use strict';
const P=()=>root.ConquestPlot;
// defenders in a town raid (lead's numbers, tuned by the fortress tests dev/tests/conquest-fortress.mjs; never a Parasite stat):
// a tank's weapon DPS and hull from tankOf(), scaled to the town's raid units (a raider has 110 HP at level 1), its reach in metres,
// how far a garrison tank leaves its post to meet raiders, and the pilot's own hand (the pilot is sharper than an AI crew)
const UNIT=Object.freeze({dps:.5,hp:.6,range:26,lancer:1.4,air:1.5,leash:18,speed:6.5,r:2.1,pilotDps:1.25,pilotHp:.8,pilotRange:30,pilotSpeed:15,cone:.7,rank:.02,pierce:.25});
const SEC_STEP=.1;
function rng(seed){let s=(seed>>>0)||1;const f=()=>{s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909);s^=s>>>16;return (s>>>0)/4294967296;};f.get=()=>s;f.set=v=>{s=v>>>0;};return f;}
function Heap(){const v=[],c=[];return {get size(){return v.length;},push(x,y){let k=v.length;v.push(x);c.push(y);while(k>0){const q=(k-1)>>1;if(v[q]<=x)break;v[k]=v[q];c[k]=c[q];k=q;}v[k]=x;c[k]=y;},
 pop(){const tv=v[0],tc=c[0],lv=v.pop(),lc=c.pop();if(v.length){let k=0;for(;;){let m=2*k+1;if(m>=v.length)break;if(m+1<v.length&&v[m+1]<v[m])m++;if(v[m]>=lv)break;v[k]=v[m];c[k]=c[m];k=m;}v[k]=lv;c[k]=lc;}return [tv,tc];},clear(){v.length=0;c.length=0;}};}
// A defender from a pilot record and its kit: {id, kind 'g' garrison | 'f' fielded | 'p' the pilot, role, rk rank, L loadout}.
// tankOf / allyLoadout are the game's own (the ally rules: a kit's weapon and chassis, tier and roll, nothing else).
function unitOf(o){const C=root.ConquestCombat,L=o.L||(C?.allyLoadout?C.allyLoadout(o.kit||{}):null);let t=null;try{t=typeof tankOf==='function'&&L?tankOf(L,1):null;}catch(_){t=null;}
 const wdps=t?t.wdps*(t.dmgM||1):70,mhp=t?t.mhp:1700,shot=t?.wshot||.2,pilot=o.kind==='p',rk=1+UNIT.rank*Math.max(0,(o.rk|0||1)-1),lancer=o.role==='lancer';
 const dps=wdps*(pilot?UNIT.pilotDps:UNIT.dps)*rk,hp=Math.round(mhp*(pilot?UNIT.pilotHp:UNIT.hp)*rk),rof=Math.max(.05,shot);
 return {id:String(o.id||''),k:pilot?'p':o.kind==='f'?'f':'g',role:o.role||'',dmg:dps*rof,rof,hp,max:hp,rng:(pilot?UNIT.pilotRange:UNIT.range)*(lancer?UNIT.lancer:1),air:lancer?UNIT.air:1,pierce:t?.wtype==='siege'?.5:UNIT.pierce,light:t?.wtype==='twin'?1.25:1,spd:pilot?UNIT.pilotSpeed:UNIT.speed*(t?.spdM||1)};}
// the town's posts for its garrison: free cells in a ring around the Command Center, spread over the lanes' side first
function posts(p,n,blocked){const Pl=P(),cc=p.b?.cc,sz=Pl.sizeOf('cc',cc?.r|0),ci=(cc?.i??37)+(sz.w-1)/2,cj=(cc?.j??37)+(sz.d-1)/2,out=[];
 for(let r=4;r<14&&out.length<n;r++)for(let k=0;k<16&&out.length<n;k++){const a=(k*7%16)/16*Math.PI*2+r*.37,i=Math.round(ci+Math.cos(a)*r),j=Math.round(cj+Math.sin(a)*r);if(blocked(i,j)||out.some(q=>Math.abs(q.i-i)<3&&Math.abs(q.j-j)<3))continue;out.push({i,j,x:Pl.cellX(i),z:Pl.cellZ(j)});}
 while(out.length<n)out.push({i:Math.round(ci),j:Math.round(cj)+3,x:Pl.cellX(Math.round(ci)),z:Pl.cellZ(Math.round(cj)+3)});return out;}
// make(plot, seed, opt): opt = {threat (the raid level 1-10), waves (tests), maxT, frames, events, damage, dt, lane, units:[unitOf records],
// pilot:{x,z,h} (the pilot's start), pad} -> the machine. machine.step(input) advances one step (input: the pilot's command);
// machine.run() to the end; machine.result(); machine.save() / restore(plot, saved, opt).
function make(plot,seed=1,opt={}){
 const Pl=P(),p=plot,S=Pl.SITES[p?.site]||Pl.SITES.ridge,sid=S.id,cc=Pl.clampCC(p.cc),h=Pl.townH(cc),threat=Pl.clampCC(opt.threat||cc),RAID=Pl.RAID,N=Pl.GRID.n,C=Pl.GRID.cell,MID=Pl.MID,NN=N*N,dt=opt.dt||RAID.dt,frames=[],events=[],keepF=opt.frames!==false,keepE=opt.events!==false;
 const cellX=Pl.cellX,cellZ=Pl.cellZ,KIND_IDS=Object.keys(RAID.kinds),BLOCKED=Pl.BLOCKED,SLOW=Pl.SLOW;
 const rnd=rng(seed),rs=opt.own?rnd:rng((Math.imul((seed>>>0)||1,2654435761)^0x5bd1e995)>>>0);   // town attacks: the waves draw from their own stream, so a turret's fire never reshuffles them (opt.own: the drill's one stream)
 const blk=new Int32Array(NN).fill(-1),structs=[],hpK=Math.pow(RAID.hpGrow,threat-1),dmK=Math.pow(RAID.dmGrow,threat-1);
 const addS=s=>{s.idx=structs.length;let x=0,z=0,x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const [i,j] of s.cells){blk[i*N+j]=s.idx;const cx=cellX(i),cz=cellZ(j);x+=cx;z+=cz;x0=Math.min(x0,cx-2);x1=Math.max(x1,cx+2);z0=Math.min(z0,cz-2);z1=Math.max(z1,cz+2);}
  s.x=x/s.cells.length;s.z=z/s.cells.length;s.x0=x0;s.x1=x1;s.z0=z0;s.z1=z1;s.eff=s.hp/Math.max(.05,(1-(s.dr||0))*(1-(s.refl||0)));structs.push(s);return s;};
 const left=(id,m)=>Math.max(0,m-Math.max(0,Number(p.dmg?.[id])||0));
 for(const [id,b] of Object.entries(p.b||{})){const l=b.t==='cc'?cc:b.l|0;if(!(l>0))continue;const B=Pl.BUILDINGS[b.t],hp=Pl.hpOfBuilding({...b,l});addS({id,t:b.t,kind:b.t==='cc'?'core':B?.turret?'turret':'bld',hp:left(id,hp),max:hp,cells:Pl.cells(b),l,vital:Pl.VITALS[b.t]||''});}
 for(const [k,c] of Object.entries(p.w||{})){const [i,j]=k.split(',').map(Number);if(!Pl.inGrid(i,j)||blk[i*N+j]>=0)continue;const w=Pl.wallStats(c,sid),hp=left('w:'+k,w.hp);if(hp<=0)continue;addS({id:'w:'+k,t:'wall',kind:'wall',hp,max:w.hp,dr:w.dr,refl:w.refl,cells:[[i,j]],code:c|0});}
 for(const hm of Pl.homes(p))addS({id:hm.id,t:'home',kind:'home',hp:RAID.hpHome,max:RAID.hpHome,cells:[[hm.i,hm.j],[hm.i+1,hm.j],[hm.i,hm.j+1],[hm.i+1,hm.j+1]]});
 const core=structs.find(s=>s.kind==='core');
 if(!core){const r={outcome:'no-command-center',frames:[],events:[],kills:0,lost:0,time:0,spawned:0,core:0,fell:[],vitals:[],breaches:[],wallsLost:0,homesLost:0,threat,units:[]};return {step(){},run(){return r;},result(){return r;},save(){return null;},get over(){return true;},get n(){return 0;},structs:[],foes:[],units:[]};}
 const hp0=structs.map(s=>s.hp);
 const use=Pl.powerUse(p),reactors=new Set(structs.filter(s=>s.t==='reactor').map(s=>s.id));let pf=1;
 const byId=new Map(structs.map(s=>[s.id,s]));
 const repower=()=>{const sup=Pl.powerSupply(p,id=>reactors.has(id)&&byId.get(id).hp>0);pf=use>0?Math.max(.35,Math.min(1,sup/use)):1;};
 const shields=structs.filter(s=>s.t==='shield').map(s=>({s,x:s.x,z:s.z,r:12+3*s.l,k:Math.min(.5,.1*s.l)}));
 const shieldK=(x,z)=>{let k=0;for(const q of shields)if(q.s.hp>0&&Math.hypot(q.x-x,q.z-z)<q.r)k=Math.max(k,q.k);return k*pf;};
 const turrets=structs.filter(s=>s.kind==='turret').map(s=>{const B=Pl.BUILDINGS[s.t].turret,l=s.l;return {s,type:s.t,B,range:B.range*S.range*(1+.04*(l-1)),min:B.min||0,dmg:B.dmg*(1+.25*(l-1)),cd:rnd()*B.rof*.5,kills:0,done:0};});
 const pass=new Uint8Array(NN),slow=new Float32Array(NN).fill(1);for(let i=0;i<N;i++)for(let j=0;j<N;j++){const c=i*N+j,t=Pl.terrainAt(sid,i,j);if(Pl.cheb(i,j)<=h+1&&!BLOCKED[t]){pass[c]=1;slow[c]=SLOW[t]||1;}}
 const threatMap=new Float32Array(NN),cover=t=>{const r=Math.ceil(t.r0/C),ti=Math.round(t.s.x/C+MID),tj=Math.round(t.s.z/C+MID),out=[];for(let i=Math.max(0,ti-r);i<=Math.min(N-1,ti+r);i++)for(let j=Math.max(0,tj-r);j<=Math.min(N-1,tj+r);j++)if(Math.hypot(cellX(i)-t.s.x,cellZ(j)-t.s.z)<=t.r0)out.push(i*N+j);return out;};
  // Town attacks (Session 7T, fortress decision 4b: no dead upgrades): raiders read the town's layout, never its levels. Every turret is
 // weighed as fully upgraded (level V range and damage), so an upgrade never moves the raiders' path: it pays off where they already
 // go (measured: weighed at their own level, Laser Cannons III->IV pushed raiders onto a weaker side and the reference town held 78 ->
 // 64 of 250 raids; weighed at the town's average level, raising any type re-scaled every gun against the walls and moved the breach).
 // A maxed town is weighed exactly as before. opt.own: each turret at its own level, the Defense Drill's rule (plot.js, 5B's balance)
 const seen=t=>opt.own?t.s.l:5;
 for(const t of turrets){t.r0=t.B.range*S.range*(1+.04*(seen(t)-1));t.cells=cover(t);t.dps=t.s.hp>0?t.B.dmg*(1+.25*(seen(t)-1))*(t.B.salvo||1)/t.B.rof:0;for(const c of t.cells)threatMap[c]+=t.dps*RAID.threatK;}
 const cost=c=>{const si=blk[c];let w=1/slow[c]+threatMap[c];if(si>=0){const s=structs[si];if(s.hp>0&&s!==core)w+=s.eff/RAID.breakRate;}return w;};
 const field=new Float64Array(NN).fill(Infinity),heap=Heap(),NB4=[[1,0],[-1,0],[0,1],[0,-1]],DX8=[1,-1,0,0,1,1,-1,-1],DZ8=[0,0,1,-1,1,-1,1,-1];let ver=0;
 const relax=()=>{while(heap.size){const [v,c]=heap.pop();if(v>field[c])continue;const i=(c/N)|0,j=c-i*N;for(const [a,b] of NB4){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const n=x*N+z;if(!pass[n])continue;const nv=v+cost(n);if(nv<field[n]){field[n]=nv;heap.push(nv,n);}}}};
 const fresh=()=>{field.fill(Infinity);heap.clear();for(const [i,j] of core.cells){field[i*N+j]=0;heap.push(0,i*N+j);}relax();};
 fresh();
 const lowered=new Set();const lower=()=>{ver++;for(const c of lowered){if(!pass[c]||field[c]===0)continue;const i=(c/N)|0,j=c-i*N;let m=Infinity;for(const [a,b] of NB4){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;m=Math.min(m,field[x*N+z]);}const nv=m+cost(c);if(nv<field[c]){field[c]=nv;heap.push(nv,c);}}lowered.clear();relax();};
 const foes=[],fell=[],vitals=[],breach=[];let id=0,time=0,kills=0,done=false,homesLost=0,wallsLost=0,shots=0,n=0,over=false;
 const reach=(f,s)=>Math.hypot(Math.max(s.x0-f.x,0,f.x-s.x1),Math.max(s.z0-f.z,0,f.z-s.z1));
 const killFoe=f=>{if(f.hp<=0&&!f.dead){f.dead=true;f.hp=0;kills++;}};
 const destroy=s=>{s.hp=0;if(keepE)events.push({t:Math.round(time*10)/10,k:'destroyed',id:s.id});if(s===core){done=true;return;}
  if(s.kind==='wall'){wallsLost++;breach.push(s.cells[0]);}else if(s.kind==='home')homesLost++;else{fell.push({id:s.id,t:s.t});if(s.vital)vitals.push(s.t);}
  if(s.t==='reactor')repower();if(s.kind==='turret'){const t=turrets.find(q=>q.s===s);if(t)for(const c of t.cells){threatMap[c]-=t.dps*RAID.threatK;lowered.add(c);}}
  for(const [i,j] of s.cells)lowered.add(i*N+j);};
 const hurt=(s,dmg,f)=>{if(s.hp<=0)return;const k=shieldK(s.x,s.z);let taken=dmg*(1-k);if(s.kind==='wall'){const h2=Pl.wallHit(s,dmg,k);if(h2.reflected>0&&f){f.hp-=h2.reflected;killFoe(f);}taken=h2.taken;}s.hp-=taken;if(s.hp<=0)destroy(s);};
 const strike=(f,s)=>{if(f.cd>0)return;f.cd=f.K.rof;hurt(s,f.K.dmg*dmK*(s.kind==='wall'&&f.K.wall?f.K.wall:1),f);};
 const spawns=Pl.spawnCells(sid,cc);let laneK=0;
 // the lane order: the drill's round robin, or the attack's main lane on every other spawn (half of them)
 const seq=(()=>{const L=spawns.length,m=Number.isInteger(opt.lane)&&L>1?((opt.lane%L)+L)%L:-1;if(m<0)return Array.from({length:L},(_,i)=>i);const o=[];for(let i=0;i<L;i++)if(i!==m){o.push(m,i);}return o;})();
 const spawn=kind=>{for(let tries=0;tries<seq.length;tries++){const cl=spawns[seq[(laneK++)%seq.length]].filter(([i,j])=>isFinite(field[i*N+j])||RAID.kinds[kind].air);if(!cl.length)continue;const [i,j]=cl[Math.floor(rs()*cl.length)],K=RAID.kinds[kind];
   foes.push({id:++id,kind,K,x:cellX(i)+(rs()-.5)*2,z:cellZ(j)+(rs()-.5)*2,hp:K.hp*hpK,max:K.hp*hpK,cd:rs()*K.rof,burn:0,tgt:-1});return;}};
 const dmgTo=(t,f,base)=>{if(f.dead)return;const B=t.B,arm=f.K.armor||0,d=base*(f.K.light&&B.light?B.light:1)*(1-arm*(1-(B.pierce||0)));f.hp-=d;t.done+=Math.min(d,f.hp+d);killFoe(f);if(f.dead)t.kills++;};
 const shot=(t,x,z,extra)=>{shots++;if(keepE&&shots<=3000)events.push({t:Math.round(time*10)/10,k:'shot',from:t.s.id,ty:t.type,x:Math.round(x*10)/10,z:Math.round(z*10)/10,...(extra||{})});};
 const BK=10,bk=Array.from({length:BK*BK},()=>[]),bOf=v=>Math.max(0,Math.min(BK-1,Math.floor((v+160)/32)));
 const fire=(t,live)=>{const B=t.B;let best=null,bs=Infinity;const bx0=bOf(t.s.x-t.range),bx1=bOf(t.s.x+t.range),bz0=bOf(t.s.z-t.range),bz1=bOf(t.s.z+t.range);
  for(let bx=bx0;bx<=bx1;bx++)for(let bz=bz0;bz<=bz1;bz++)for(const f of bk[bx*BK+bz]){if(f.dead)continue;const d=Math.hypot(f.x-t.s.x,f.z-t.s.z);if(d>t.range||d<t.min)continue;const air=!!f.K.air;if(B.ground&&air)continue;const sc=B.heavyFirst?-f.hp:d-(B.airFirst&&air?100:0);if(sc<bs){bs=sc;best=f;}}
  if(!best)return false;const dx=best.x-t.s.x,dz=best.z-t.s.z,dist=Math.hypot(dx,dz)||1;
  if(B.salvo){for(let k=0;k<B.salvo;k++){const x=best.x+(rnd()-.5)*3.2,z=best.z+(rnd()-.5)*3.2;for(const f of live)if(!f.dead&&!f.K.air&&Math.hypot(f.x-x,f.z-z)<=B.splash)dmgTo(t,f,t.dmg);if(k===0)shot(t,x,z);}}
  else if(B.cone){for(const f of live){if(f.dead||f.K.air)continue;const fx=f.x-t.s.x,fz=f.z-t.s.z,d=Math.hypot(fx,fz);if(d>t.range||d<.1)continue;if(Math.acos(Math.max(-1,Math.min(1,(fx*dx+fz*dz)/(d*dist))))<=B.cone){dmgTo(t,f,t.dmg);f.burn=B.burnT;f.burnD=B.burn*(1+.25*(t.s.l-1));f.burnBy=t;}}shot(t,best.x,best.z);}
  else if(B.chain){let cur=best,dm=t.dmg;const hit=new Set([best]),pts=[[Math.round(best.x),Math.round(best.z)]];dmgTo(t,best,dm);for(let k=0;k<B.chain;k++){dm*=B.decay;let nx=null,nd=B.jump;for(const f of live)if(!f.dead&&!hit.has(f)){const d=Math.hypot(f.x-cur.x,f.z-cur.z);if(d<nd){nd=d;nx=f;}}if(!nx)break;hit.add(nx);dmgTo(t,nx,dm);pts.push([Math.round(nx.x),Math.round(nx.z)]);cur=nx;}shot(t,best.x,best.z,{ch:pts});}
  else if(B.line){const ux=dx/dist,uz=dz/dist;for(const f of live){if(f.dead)continue;const fx=f.x-t.s.x,fz=f.z-t.s.z,a=fx*ux+fz*uz;if(a<0||a>t.range)continue;if(Math.abs(fx*uz-fz*ux)<=B.line)dmgTo(t,f,t.dmg);}shot(t,t.s.x+ux*t.range,t.s.z+uz*t.range);}
  else{if(B.splash){for(const f of live)if(!f.dead&&(f===best||Math.hypot(f.x-best.x,f.z-best.z)<=B.splash)&&!(B.ground&&f.K.air))dmgTo(t,f,t.dmg);}else dmgTo(t,best,t.dmg);shot(t,best.x,best.z);}
  return true;};
 const airTarget=f=>{let best=null,bd=Infinity;for(const t of turrets)if(t.s.hp>0){const d=Math.hypot(t.s.x-f.x,t.s.z-f.z);if(d<bd){bd=d;best=t.s;}}if(best)return best;for(const s of structs)if(s.vital==='secondary'&&s.hp>0){const d=Math.hypot(s.x-f.x,s.z-f.z);if(d<bd){bd=d;best=s;}}return best||core;};
 const step=(f,tx,tz)=>{const d=Math.hypot(tx-f.x,tz-f.z)||1,ci=Math.max(0,Math.min(N-1,Math.round(f.x/C+MID))),cj=Math.max(0,Math.min(N-1,Math.round(f.z/C+MID))),v=f.K.spd*(f.K.air?1:slow[ci*N+cj])*dt;f.x+=(tx-f.x)/d*Math.min(d,v);f.z+=(tz-f.z)/d*Math.min(d,v);};
 const freeCell=c=>pass[c]&&(blk[c]<0||structs[blk[c]].hp<=0||structs[blk[c]]===core);
 const waves=(Array.isArray(opt.waves)?opt.waves:Pl.drillWaves(threat)).map(w=>({...w})),solid=structs.filter(s=>s.kind!=='wall');repower();
 const steps=Math.round((opt.maxT||RAID.maxT+RAID.maxTPer*(threat-1))/dt);
 // ---- defenders (Session 7T): the garrison, the fielded Platoon and the pilot. None: the drill exactly. ----
 const cellOf=v=>Math.round(v/C+MID);
 const tankBlocked=(i,j)=>{if(!Pl.inGrid(i,j)||!pass[i*N+j])return true;const si=blk[i*N+j];if(si<0)return false;const s=structs[si];return s.hp>0&&s.t!=='gate';};
 const hits=(x,z)=>{const r=UNIT.r;for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]])if(tankBlocked(cellOf(x+dx),cellOf(z+dz)))return true;return false;};
 const units=[];
 {const list=Array.isArray(opt.units)?opt.units:[],gar=list.filter(u=>u&&u.k!=='p'),pts=gar.length?posts(p,gar.length,tankBlocked):[];let gi=0;
  for(const u0 of list){if(!u0)continue;const u={...u0,hp:Math.min(u0.max||u0.hp,u0.hp),down:0,cd:0,kills:0,done:0,tgt:-1};
   if(u.k==='p'){const at=opt.pilot||{x:core.x,z:core.z+16};u.x=at.x;u.z=at.z;u.h=Number(at.h)||0;u.v=0;}else{const q=pts[gi++];u.post={x:q.x,z:q.z};u.x=q.x;u.z=q.z;u.h=Math.atan2(q.x-core.x,q.z-core.z);}
   units.push(u);}}
 const pilot=units.find(u=>u.k==='p')||null;
 const unitShot=(u,x,z)=>{shots++;if(keepE&&shots<=3000)events.push({t:Math.round(time*10)/10,k:'shot',from:'u:'+u.id,ty:'tank',x:Math.round(x*10)/10,z:Math.round(z*10)/10});};
 const unitHit=(u,f)=>{const d=u.dmg*(f.K.light?u.light:1)*(f.K.air?u.air:1)*(1-(f.K.armor||0)*(1-u.pierce));f.hp-=d;u.done+=Math.min(d,f.hp+d);killFoe(f);if(f.dead)u.kills++;};
 const nearestFoe=(x,z,r,live,want)=>{let best=null,bd=r;for(const f of live){if(f.dead)continue;const d=Math.hypot(f.x-x,f.z-z);if(d<=bd&&(!want||want(f,d))){bd=d;best=f;}}return best;};
 const moveTank=(u,tx,tz,spd)=>{const dx=tx-u.x,dz=tz-u.z,d=Math.hypot(dx,dz);if(d<.3)return;const st=Math.min(d,spd*dt),nx=u.x+dx/d*st,nz=u.z+dz/d*st;u.h=Math.atan2(dx,dz);if(!hits(nx,nz)){u.x=nx;u.z=nz;}else if(!hits(nx,u.z))u.x=nx;else if(!hits(u.x,nz))u.z=nz;};
 // the pilot's tank: the town drive's own handling (js/conquest/plotview.js driveStep), steered by the pilot's command
 const driveTank=(u,inp)=>{let sx=Number(inp?.x)||0,sz=Number(inp?.z)||0;const L=Math.hypot(sx,sz);if(L>1){sx/=L;sz/=L;}const mag=Math.min(1,Math.hypot(sx,sz)),ti=cellOf(u.x),tj=cellOf(u.z),sl=Pl.inGrid(ti,tj)?(SLOW[Pl.terrainAt(sid,ti,tj)]||1):1;
  u.v+=((mag>.08?u.spd*mag*sl:0)-u.v)*Math.min(1,dt*(mag>.08?3.5:6));if(mag>.08){const want=Math.atan2(sx,sz);let d=want-u.h;d=Math.atan2(Math.sin(d),Math.cos(d));u.h+=d*Math.min(1,dt*7);}
  const stp=u.v*dt,nx=u.x+Math.sin(u.h)*stp,nz=u.z+Math.cos(u.h)*stp;if(!hits(nx,nz)){u.x=nx;u.z=nz;}else if(!hits(nx,u.z))u.x=nx;else if(!hits(u.x,nz))u.z=nz;else u.v*=.3;};
 const unitsStep=(live,inp)=>{for(const u of units){if(u.down)continue;u.cd=Math.max(-u.rof,u.cd-dt);
   if(u.k==='p'){driveTank(u,inp);const fire=!!(inp&&(inp.fire||inp.tapFire));if(!fire){u.cd=Math.max(0,u.cd);continue;}
    while(u.cd<=0){let f=null;if(inp.lockId!=null){const q=live.find(x=>!x.dead&&x.id===inp.lockId);if(q&&Math.hypot(q.x-u.x,q.z-u.z)<=u.rng)f=q;}
     if(!f&&Number.isFinite(inp.aimYaw)){const ay=inp.aimYaw;f=nearestFoe(u.x,u.z,u.rng,live,(q)=>{let d=Math.atan2(q.x-u.x,q.z-u.z)-ay;d=Math.atan2(Math.sin(d),Math.cos(d));return Math.abs(d)<=UNIT.cone;});}
     if(!f)f=nearestFoe(u.x,u.z,u.rng,live);if(!f){u.cd=0;break;}unitHit(u,f);unitShot(u,f.x,f.z);u.cd+=u.rof;}continue;}
   const anchor=u.k==='f'&&pilot&&!pilot.down?{x:pilot.x+Math.sin(pilot.h+2.4+units.indexOf(u)*.6)*7,z:pilot.z+Math.cos(pilot.h+2.4+units.indexOf(u)*.6)*7}:u.post||{x:u.x,z:u.z};
   const want=u.role==='lancer'?(f=>!!f.K.air):null,f=(want&&nearestFoe(u.x,u.z,u.rng,live,want))||nearestFoe(u.x,u.z,u.rng,live);
   if(f){if(u.cd<=0){unitHit(u,f);unitShot(u,f.x,f.z);u.cd+=u.rof;}continue;}
   const g=nearestFoe(anchor.x,anchor.z,UNIT.leash+u.rng,live);if(g)moveTank(u,g.x,g.z,u.spd);else moveTank(u,anchor.x,anchor.z,u.spd);}};
 // a raider beside a defender fights it (raiders, swarmlings and sentinels: the ones that attack what they reach)
 const unitInReach=f=>{if(!units.length||!f.K.opp)return null;let best=null,bd=f.K.range+1;for(const u of units){if(u.down)continue;const d=Math.hypot(u.x-f.x,u.z-f.z)-UNIT.r;if(d<=bd){bd=d;best=u;}}return best;};
 const strikeUnit=(f,u)=>{if(f.cd>0)return;f.cd=f.K.rof;u.hp-=f.K.dmg*dmK*(1-shieldK(u.x,u.z));if(u.hp<=0){u.hp=0;u.down=1;if(keepE)events.push({t:Math.round(time*10)/10,k:'down',id:'u:'+u.id});}};
 // ---- one step of the raid (the body of drillGen's loop, unchanged, plus the defenders) ----
 function stepOnce(inp){if(over)return;if(!(n<steps)||done){over=true;return;}time=n*dt;
  for(const w of waves)if(!w.done&&time>=w.at){w.done=true;for(const kind of KIND_IDS)for(let k=0;k<(w[kind]|0);k++)spawn(kind);}
  if(lowered.size&&n%5===0)lower();
  for(const f of foes){if(f.dead)continue;if(f.burn>0){f.burn-=dt;const bd=Math.min(f.hp,(f.burnD||0)*dt);f.hp-=bd;if(f.burnBy)f.burnBy.done+=bd;killFoe(f);if(f.dead){if(f.burnBy)f.burnBy.kills++;continue;}}f.cd=Math.max(0,f.cd-dt);const K=f.K;
   if(K.air){const s=airTarget(f);if(reach(f,s)<=K.range+1.5)strike(f,s);else step(f,s.x,s.z);if(done)break;continue;}
   if(reach(f,core)<=K.range+.5){strike(f,core);if(done)break;continue;}
   if(units.length){const u=unitInReach(f);if(u){strikeUnit(f,u);continue;}}
   if(f.tgt>=0){const s=structs[f.tgt];if(s.hp>0&&reach(f,s)<=K.range+1){strike(f,s);continue;}f.tgt=-1;}
   const i=Math.max(0,Math.min(N-1,Math.round(f.x/C+MID))),j=Math.max(0,Math.min(N-1,Math.round(f.z/C+MID))),c=i*N+j;let bi=f.bi;
   if(f.cc!==c||f.ver!==ver){f.cc=c;f.ver=ver;bi=-1;let bv=field[c];for(let q=0;q<8;q++){const a=DX8[q],b=DZ8[q],x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const nc=x*N+z;if(!pass[nc])continue;if(a&&b&&!(freeCell(x*N+j)&&freeCell(i*N+z)))continue;if(field[nc]<bv-1e-9){bv=field[nc];bi=nc;}}f.bi=bi;f.scan=0;}
   if(bi<0){step(f,core.x,core.z);continue;}
   const bs=blk[bi]>=0?structs[blk[bi]]:null;
   if(bs&&bs.hp>0&&bs!==core){if(reach(f,bs)<=K.range+.6)strike(f,bs);else step(f,cellX((bi/N)|0),cellZ(bi%N));continue;}
   if(K.opp&&f.scan--<=0){f.scan=4;let pick=-1,pd=Infinity;const r=K.pref?2:1;for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const si=blk[x*N+z];if(si<0)continue;const s=structs[si];if(s.hp<=0||s.kind==='wall'||s===core)continue;if(r===2&&s.kind!=='turret'&&(a<-1||a>1||b<-1||b>1))continue;const d=reach(f,s);if(d<=K.range+1&&d<pd){pd=d;pick=si;}}
    if(pick>=0){f.tgt=pick;strike(f,structs[pick]);continue;}}
   step(f,cellX((bi/N)|0),cellZ(bi%N));}
  if(done){over=true;n++;return;}
  const live=foes.filter(f=>!f.dead);for(const b of bk)b.length=0;for(const f of live)bk[bOf(f.x)*BK+bOf(f.z)].push(f);
  if(units.length)unitsStep(live,inp);
  if(live.length)for(const t of turrets){if(t.s.hp<=0)continue;t.cd-=dt;if(t.cd>0)continue;if(fire(t,live))t.cd=t.B.rof/pf;else t.cd=0;}
  if(keepF&&n%5===0){const fs=[],ss=[];for(const f of live)if(!f.dead)fs.push([f.id,f.K.c,Math.round(f.x*10)/10,Math.round(f.z*10)/10]);for(const s of solid)if(s.hp<s.max&&ss.length<300)ss.push([s.id,Math.round(100*s.hp/s.max)]);
   const fr={t:Math.round(time*10)/10,f:fs,s:ss};if(units.length)fr.u=units.map(u=>[u.id,u.k,Math.round(u.x*10)/10,Math.round(u.z*10)/10,u.down?0:Math.round(100*u.hp/u.max),Math.round(u.h*100)/100]);frames.push(fr);}
  n++;
  if(waves.every(w=>w.done)&&foes.every(f=>f.dead))over=true;
  if(!(n<steps))over=true;}
 function result(){
  const groups=[];for(const [i,j] of breach){const g=groups.find(q=>Math.max(Math.abs(q.i-i),Math.abs(q.j-j))<=3);if(g){g.n++;g.si+=i;g.sj+=j;g.i=Math.round(g.si/g.n);g.j=Math.round(g.sj/g.n);}else groups.push({i,j,n:1,si:i,sj:j});}
  const outcome=core.hp<=0?'breached':foes.some(f=>!f.dead)?'held':'repelled';
  const byTurret=Object.fromEntries(turrets.map(t=>[t.s.id,{t:t.type,kills:t.kills,dmg:Math.round(t.done)}]));
  const lostNow=opt.damage?Object.fromEntries(structs.filter(s=>s.kind!=='home').map(s=>[s.id,Math.round(left(s.id,s.max)-Math.max(0,s.hp))]).filter(([,v])=>v>0)):undefined;
  const out={outcome,seed:seed>>>0,threat,byTurret,...(lostNow?{damage:lostNow}:{}),time:Math.round(time*10)/10,kills,spawned:id,lost:fell.length+homesLost,fell:fell.slice(0,40),vitals:[...new Set(vitals)],homesLost,wallsLost,breaches:groups.sort((a,b)=>b.n-a.n).slice(0,12).map(g=>[g.i,g.j,g.n]),
   core:Math.max(0,Math.round(100*core.hp/core.max)),power:Math.round(pf*100),frames:keepF?frames:[],events:keepE?events:[]};
  if(units.length)out.units=units.map(u=>({id:u.id,k:u.k,down:u.down?1:0,hp:Math.round(u.hp),max:u.max,kills:u.kills,dmg:Math.round(u.done)}));
  return out;}
 // ---- save / restore (the live defense: one request's steps at a time). Everything that changes is saved; the rest is rebuilt from the
 // same plot. The flow field is rebuilt from the structures standing (a fresh Dijkstra: the same shortest paths the drill keeps updating).
 const r2=v=>Math.round(v*1000)/1000;
 function save(){return {v:1,n,t:r2(time),r:rnd.get(),...(rs!==rnd?{rs:rs.get()}:{}),k:kills,d:done?1:0,o:over?1:0,hl:homesLost,wl:wallsLost,sh:shots,id,lk:laneK,pf:r2(pf),
  hp:Object.fromEntries(structs.map((s,i)=>[i,s.hp]).filter(([i,v])=>v!==hp0[i]).map(([i,v])=>[i,r2(v)])),
  tu:turrets.map(t=>[r2(t.cd),t.kills,r2(t.done)]),
  fo:foes.map(f=>[f.id,KIND_IDS.indexOf(f.kind),r2(f.x),r2(f.z),r2(f.hp),r2(f.cd),r2(f.burn||0),r2(f.burnD||0),f.burnBy?turrets.indexOf(f.burnBy):-1,f.tgt,f.dead?1:0,f.scan|0]),
  wv:waves.map(w=>w.done?1:0),fe:fell.slice(),vi:vitals.slice(),br:breach.slice(),
  un:units.map(u=>[r2(u.x),r2(u.z),r2(u.h),r2(u.v||0),r2(u.hp),u.down,r2(u.cd),u.kills,r2(u.done)])};}
 function load(st){n=st.n|0;time=Number(st.t)||0;rnd.set(st.r);if(rs!==rnd&&st.rs!==undefined)rs.set(st.rs);kills=st.k|0;done=!!st.d;over=!!st.o;homesLost=st.hl|0;wallsLost=st.wl|0;shots=st.sh|0;id=st.id|0;laneK=st.lk|0;
  for(const [i,v] of Object.entries(st.hp||{})){const s=structs[Number(i)];if(s)s.hp=Number(v);}
  (st.tu||[]).forEach((x,i)=>{const t=turrets[i];if(t){t.cd=Number(x[0]);t.kills=x[1]|0;t.done=Number(x[2]);}});
  foes.length=0;for(const x of st.fo||[]){const kind=KIND_IDS[x[1]],K=RAID.kinds[kind];if(!K)continue;foes.push({id:x[0],kind,K,x:Number(x[2]),z:Number(x[3]),hp:Number(x[4]),max:K.hp*hpK,cd:Number(x[5]),burn:Number(x[6]),burnD:Number(x[7]),burnBy:x[8]>=0?turrets[x[8]]:null,tgt:x[9],dead:!!x[10],scan:x[11]|0,ver:-1});}
  (st.wv||[]).forEach((d,i)=>{if(waves[i])waves[i].done=!!d;});fell.length=0;fell.push(...(st.fe||[]));vitals.length=0;vitals.push(...(st.vi||[]));breach.length=0;breach.push(...(st.br||[]));
  (st.un||[]).forEach((x,i)=>{const u=units[i];if(!u)return;[u.x,u.z,u.h,u.v,u.hp]=x.slice(0,5).map(Number);u.down=x[5]|0;u.cd=Number(x[6]);u.kills=x[7]|0;u.done=Number(x[8]);});
  // the threat map and the flow field from what still stands (a destroyed turret adds no threat; a destroyed structure no cost)
  threatMap.fill(0);for(const t of turrets)if(t.s.hp>0)for(const c of t.cells)threatMap[c]+=t.dps*RAID.threatK;lowered.clear();ver++;fresh();repower();}
 if(opt.state)load(opt.state);
 return {step:stepOnce,run(inputs){let k=0;while(!over)stepOnce(inputs?inputs[k++]:undefined);return result();},result,save,load,
  get over(){return over;},get n(){return n;},get steps(){return steps;},get time(){return time;},get done(){return done;},dt,threat,structs,foes,units,core,turrets,pilot,events,frames,
  hpOf:id=>{const s=byId.get(id);return s?s.hp:0;}};}
// The drill's result through this engine (the equality test's entry point): the same signature as ConquestPlot.drill.
function drill(plot,seed=1,opt={}){return make(plot,seed,opt).run();}
// the outcome a town attack reports (owner decision 2): FALLEN (the Command Center destroyed), BREACHED (a vital lost: the Reactor,
// the Storage Depot or the Science Lab, or three buildings wrecked, the Command Center standing), HELD (the rest: repairs only)
// (lead's definition, Checkpoint 47: Session 5B made the vitals the raid's objectives; a turret or two, homes and walls lost are a
// repair, not a breach; three buildings wrecked is)
const BREACH=3;   // buildings wrecked (turrets, production, support; never walls, homes or gates) that make a breach without a vital
const outcomeOf=r=>r.outcome==='breached'?'fallen':(r.vitals||[]).length||(r.fell||[]).filter(f=>f.t!=='gate').length>=BREACH?'breached':'held';
root.ConquestRaid=Object.freeze({UNIT,BREACH,make,drill,unitOf,posts,outcomeOf,rng});
})(globalThis);
