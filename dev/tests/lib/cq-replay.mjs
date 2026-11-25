// Session 7C: a running operation's record and a replay through the real Worker reducer (worker/src/conquest-sim.js applyCommands, 20
// commands a request), for the fingerprint, board and Titan tests. The record is what start-mission leaves after its checks (the checks
// themselves are tested elsewhere), with a Battalion of six beside the pilot.
export async function harness(){
 const {CONQUEST,RULES:R}=await import('../../../worker/src/sim.gen.js');const {Combat:C,World:W,Citadel:CI}=CONQUEST;
 const {createState,applyCommands}=await import('../../../worker/src/conquest-sim.js');const {citadelBegin}=await import('../../../worker/src/conquest-citadel.js');const {seal}=await import('../../../worker/src/conquest-airdrop.js');
 const {GEAR}=await import('../combat-sim.mjs');const DAY=86400000,ROLES=['guardian','lancer','breacher','frostline','mender','corroder'];
 const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),copy=o=>JSON.parse(JSON.stringify(o));
 // start a mission in an existing record s (keeps its history: fingerprints, flags, outbox)
 function begin(s,id,t0,{allies=6,L=null,pos=null}={}){const op=C.operations[id],cit=CI.isCitadel(id),p=pos||(cit?CI.stageAt():at(op.x-18,op.z+10));
  s.position=p;s.battle=copy(new C.Encounter(s.loadout,p));s.battle.enemies=[];s.explorationBattle=copy(s.battle);s.attempt=(s.attempt|0)+1;s.mission=id;s.featuredMission=false;s.settlement=null;delete s.anEnd;
  if(op.strike){const M=C.meteorStrike(t0);s.strikes={[M.slot]:{roll:{tq:.5,se:.5,mh:.5}}};s.strikeSlot=M.slot;}
  if(op.raid)s.raidRoll={attempt:s.attempt,v:.5};
  if(id==='base-defense')s.base={tier:5,modules:{hangar:3},builtAt:t0-30*DAY,claimedAt:t0-DAY,pointsAt:t0-DAY,defense:{config:'turret',damage:0,wins:0,alertAt:t0,nextAt:t0,active:true}};
  if(op.defense&&op.war)s.sectorDefense={active:true,id,at:t0,go:false};
  const B=id==='oxygen-line'?new C.Battle(s.loadout,p):cit?CI.make(s.loadout,p,id):new C.Operation(s.loadout,p,id);
  if(cit){s.cit=CI.norm({...(s.cit||{}),v:1,t:Math.max(s.cit?.t|0,Number(id.split('-')[1])-1)});citadelBegin(s,B,op,t0);}
  B.squad={orders:1,f:'wedge',o:'follow',t:0};for(let i=0;i<allies;i++){const sl=C.FORMS.wedge[i%C.FORMS.wedge.length];B.friends.push(C.friendUnit({id:800000001+i,side:'mine',pid:'p'+i,role:ROLES[i%6],kit:{w:{a:'pulse',t:1,q:1},c:{c:C.ROLES[ROLES[i%6]].cls[0],t:1,q:1}},m:1,x:p.x+sl[0]*.5,z:p.z+sl[1]*.5-4}));}
  B.playerHp=Math.min(B.playerMax,s.hp>0?s.hp:B.playerMax);s.hp=B.playerHp;s.battle=copy(B);return s;}
 function pilot(t0,{L=GEAR.rare,seed=4242}={}){const s=createState(structuredClone(L),t0);s.lseed=seed;s.war.sc={n:9,done:1};s.lastWall=t0;s.creditMs=0;return s;}
 // run commands from policy(s, step) until the operation ends or maxS game seconds pass; returns the record and every command sent
 function run(s,policy,t0,{maxS=240,record=false}={}){let now=Math.max(t0,(s.lastWall||t0))+1000;s.lastWall=now-1000;s.creditMs=0;const sent=[];let step=0;
  for(let k=0;k<maxS;k++){const cmds=[];for(let i=0;i<20;i++){const c=policy(s,step++);cmds.push(c);if(record)sent.push(c);}now+=1000;s=applyCommands(s,{seq:s.seq+1,commands:cmds},now);seal(s,now);if(s.battle?.state!=='active')break;}   // seal: what the route does after every request (conquest.js submit)
  return {s,sent,now};}
 // the bot pilot of the identity test: the nearest live hostile, closes to 30 m, fires locked
 function bot(s){const B=s.battle,p=s.position,live=(B.enemies||[]).filter(e=>e&&e.hp>0&&!e.dormant);let t=null,td=Infinity;for(const e of live){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<td){td=d;t=e;}}
  const goal=t||B.objective||{x:p.x+10,z:p.z},dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz)||1,go=!t||d>30;
  return {x:go?dx/d:0,z:go?dz/d:0,fire:!!t,lockId:t?t.id:null,aimYaw:Math.atan2(dx,dz),shield:B.playerHp<B.playerMax*.8,super:(B.charge||0)>=1000};}
 return {CONQUEST,R,C,W,CI,createState,applyCommands,GEAR,DAY,begin,pilot,run,bot,copy,at,seal};}
// a recorded command stream: compact rows [x, z, aimYaw (x100), lockId (-1 none), bits] run-length encoded
export const BITS=['fire','tapFire','super','dash','shield','scan','strike'];
export function encode(cmds){const rows=[];let last=null,n=0;const row=c=>[Math.round((c.x||0)*100),Math.round((c.z||0)*100),Math.round((c.aimYaw||0)*100),c.lockId===null||c.lockId===undefined?-1:c.lockId,BITS.reduce((a,k,i)=>a|(c[k]?1<<i:0),0)];
 for(const c of cmds){const r=row(c),k=r.join(',');if(k===last)n++;else{if(last!==null)rows.push([n,...last.split(',').map(Number)]);last=k;n=1;}}if(last!==null)rows.push([n,...last.split(',').map(Number)]);return rows;}
export function decode(rows){const out=[];for(const [n,x,z,a,l,b] of rows)for(let i=0;i<n;i++){const c={x:x/100,z:z/100,aimYaw:a/100,lockId:l<0?null:l};BITS.forEach((k,j)=>{if(b&1<<j)c[k]=true;});out.push(c);}return out;}
