// Session 6C Battalion through the real Worker HTTP routes (fake Firebase with ETags; no network: Telegram, TON and price lookups are
// recorded fakes). Command chips (the day's first win with a pilot of yours fielded gives 1, a later win none, a later find a cosmetic
// fragment, a new chip at 00:00 UTC; pack chips ignore the day), Role Cores (Science Lab IV, Hangar II, chips; an 8 h job in the
// research slots on the Worker clock; the level reaches every pilot of that role), the Hangar's RECRUIT job (one at a time, 8 h, never
// past a roster of 16), the fielded cap by Hangar level, kills by allies alone paying nothing, the first Science Lab grant, no airdrop
// points from chips, recruits or liveries, the Battalion store kinds refused while checkout is off, and the generation-safe cold-blob
// sweep at session open. Fights are real inputs replayed by the Worker; scenarios are staged by poking the stored record between calls.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {cqLive} from './cqlive.mjs';   // Session 6C: the Conquest record is split (hot + cold blob)
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
const tgCalls=[];
globalThis.fetch=async(url,init={})=>{const u=String(url);
 if(u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);
 // the payment routes (check 10): recorded fakes, never the network
 if(u.startsWith('https://api.telegram.org/')){tgCalls.push([u.split('/').pop(),JSON.parse(init.body||'{}')]);return new Response(JSON.stringify({ok:true,result:u.endsWith('/createInvoiceLink')?'https://t.me/$inv':true}));}
 if(u.startsWith('https://toncenter.com/'))return new Response(JSON.stringify({ok:true,result:[]}));
 if(u.startsWith('https://api.coingecko.com/'))return new Response(JSON.stringify({'the-open-network':{usd:3},solana:{usd:150}}));
 throw Error('Unexpected external request '+u);};
const mod=await import('../../../worker/src/index.js'),worker=mod.default;
const {RULES:R,CONQUEST:{Combat:C,Battalion:BT,World:W}}=await import('../../../worker/src/sim.gen.js');
const BAT=await import('../../../worker/src/conquest-battalion.js');
const {readState,stats:store}=await import('../../../worker/src/conquest-store.js');
const env={BOT_TOKEN:'conquest-battalion-test',FIREBASE_DB_SECRET:'SECRET'};
let now=Date.UTC(2026,10,17,10,0,0);Date.now=()=>now;   // the Worker clock
const MIN=60000,HOUR=3600000,DAY=86400000,dayOf=t=>Math.floor(t/DAY),J=JSON.stringify;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={},E=env){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:R.PVP_V,initData:auth(id),...body})}),E);const text=await r.text();return {status:r.status,...(text.startsWith('{')?JSON.parse(text):{text})};}
const pid=id=>'tg_'+id,eco=id=>db.get('eco/'+pid(id)),cq=id=>cqLive(db,pid(id)),putCq=(id,v)=>{db.root.conquest[pid(id)]=JSON.parse(J(v));},putEco=(id,v)=>{db.root.eco[pid(id)]=JSON.parse(J(v));};
const seqOf=id=>db.get('conquest/'+pid(id)).seq;   // the hot part carries seq
let passed=0;const ok=(cond,msg)=>{assert(cond,msg);passed++;console.log('PASS '+msg);};
const said=(r,m)=>r.status===200?m:m+' [refused '+r.status+': '+r.error+']';   // a message that names the Worker's refusal when there is one
const session=(id,E=env)=>call(id,'/api/conquest/session',{},E);
const action=(id,a,extra={})=>call(id,'/api/conquest/action',{seq:seqOf(id)+1,action:a,...extra});
const hangar=(id,a,q)=>action(id,a,q===undefined?{}:{bat:q});
// one input request (the phone's driving and firing route): frames of 50 ms of simulated play after that much Worker time
async function input(id,cmd,frames=40){now+=frames*50;return call(id,'/api/conquest/input',{seq:seqOf(id)+1,commands:Array.from({length:frames},()=>cmd)});}
const mine=s=>(s.battle.friends||[]).filter(f=>f.side==='mine');
const ground=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
// a roster pilot as the Worker keeps it (conquest-battalion.js bat()); rk is its rank (xp to match)
const pilotRec=(n,r='',rk=1)=>({id:'p'+n,n:'Test Pilot '+n,cs:'T'+n,r,xp:BT.RANK_XP[rk-1],rk,k:0,h:1,kit:null,at:now,src:'recruit'});
const roster=(s,n)=>{s.bat=s.bat||{};s.bat.p=Array.from({length:n},(_,i)=>pilotRec(i+1));s.bat.n=n;s.bat.w=1;return s;};
// the account's airdrop points fields, and the Conquest outbox (an entry is what would carry points to the account)
const ptsOf=id=>{const e=eco(id)||{};return J({pts:e.pts||0,earned:e.earned||0,dailyPts:e.dailyPts||0,weeklyPts:e.weeklyPts||0,cq:e.cqd?.b||0});};
const outbox=id=>{const a=cq(id).airdrop||{};return J({seq:a.seq||0,out:(Array.isArray(a.out)?a.out:Object.values(a.out||{})).length,pend:a.pend||null});};
async function join(id){await call(id,'/api/sync',{lab:1});const r=await session(id);assert.equal(r.status,200,J(r.error));return r;}
// a pilot with a town (CC cc), a Science Lab at level lab and a Hangar at level hg (0: none), standing at the Command Gate
async function town(id,{cc=7,lab=0,hg=0}={}){await join(id);
 const s=cq(id),D=C.baseDefinition;s.ledger.cp=5e6;s.ledger.banked={alloy:1e5,biomass:1e5,helium:1e5};s.position={x:D.x,z:D.z,y:0,surface:'ground'};s.battle.enemies=[];putCq(id,s);now+=1000;
 const r=await action(id,'build-base');assert.equal(r.status,200,J(r.error));
 const q=cq(id);q.plot.cc=cc;if(lab)q.plot.b.lab1={t:'lab',i:31,j:43,r:0,l:lab};if(hg)q.plot.b.hg1={t:'hangar',i:31,j:33,r:0,l:hg};putCq(id,q);now+=1000;return cq(id);}
const setLv=(id,t,l)=>{const s=cq(id),k=t==='lab'?'lab1':'hg1';if(l)s.plot.b[k]={t,i:31,j:t==='lab'?43:33,r:0,l};else delete s.plot.b[k];};
async function leave(id){now+=1000;const r=await action(id,'return-exploration');assert.equal(r.status,200,J(r.error));return r;}
// RESCUE THE DOWNED PILOT (STANDARD 'wingman-rescue'), fought over /api/conquest/input: lock and fire on each living interceptor, then
// hold beside the downed pilot's wreck (within 8 m) for 4 s. Returns the state at the Worker's victory and how many of yours went in.
const WR=C.operations['wingman-rescue'];
async function rescue(id){const s0=cq(id);s0.position=ground(WR.x+3,WR.z);s0.hp=s0.battle.playerMax;if(s0.bat)s0.bat.w=0;putCq(id,s0);now+=1000;   // w=0: the operation opens again (staged)
 let r=await action(id,'start-mission',{mission:WR.id});assert.equal(r.status,200,J(r.error));const fielded=mine(r.state).length;
 for(let k=0;k<80;k++){const s=cq(id);if(s.battle.state!=='active')break;const p=s.position,live=s.battle.enemies.filter(e=>e.hp>0&&!e.resident).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)),e=live[0];
  r=await input(id,e?{x:0,z:0,aimYaw:Math.atan2(e.x-p.x,e.z-p.z),fire:true,lockId:e.id,shield:true}:{x:0,z:0},e?20:40);assert.equal(r.status,200,J(r.error));}
 const s=cq(id);assert.equal(s.battle.state,'victory','the rescue is won by real inputs');return {s,fielded};}
// BEACON EXTRACTION (HARD 'rescue'), staged one step short of extraction: the crawler 79.95 m up its route, the pilot beside it; a real
// input request lets the Worker move it the last 0.1 m and settle the victory.
const BE=C.operations.rescue;
async function beacon(id){const s0=cq(id);s0.position=ground(BE.x+3,BE.z);s0.hp=s0.battle.playerMax;putCq(id,s0);now+=1000;
 let r=await action(id,'start-mission',{mission:BE.id});assert.equal(r.status,200,J(r.error));
 const s=cq(id),z=BE.z+79.95;s.battle.objective={x:BE.x,y:W.groundAt(BE.x,z)+2.2,z};s.position=ground(BE.x+4,z-6);
 for(let k=0;k<5&&cq(id).battle.state==='active';k++){r=await input(id,{x:0,z:0},4);assert.equal(r.status,200,J(r.error));}
 const out=cq(id);assert.equal(out.battle.state,'victory','BEACON EXTRACTION settles');return out;}
// a raid (Platoon scale): raids open after the six field missions (staged as cleared); the pilot at the raid's marker
const RAID=C.operations[C.raidIds[0]];
async function raid(id){const s=cq(id);s.completed={...(s.completed||{}),...Object.fromEntries(C.fieldMissionIds.map(m=>[m,{at:now,attempt:1}]))};s.position=ground(RAID.x,RAID.z);s.hp=s.battle.playerMax;putCq(id,s);now+=1000;
 const r=await action(id,'start-mission',{mission:RAID.id});assert.equal(r.status,200,J(r.error));return r;}
const DAY1=dayOf(now);

// ======== 8. the first Science Lab grant pays once (refused before a Science Lab; 2 parts outside the one-a-day limit) ========
{const P=9508;await town(P,{lab:0});
 let r=await action(P,'research-grant',{mod:'thermal'});ok(r.status===409&&/first Science Lab first/.test(r.error),'research-grant is refused before any Science Lab ('+r.error+')');
 setLv(P,'lab',1);{const s=cq(P);s.inv.pt.thermal=0;s.inv.pd={d:dayOf(now),n:R.CQ_PART_DAY};}   // today's one earned part is already taken
 r=await action(P,'research-grant',{mod:'servo'});ok(r.status===409&&/Thermal or Ballistics/.test(r.error),'an invalid part is refused ('+r.error+')');
 r=await action(P,'research-grant',{mod:'__proto__'});ok(r.status===409&&/Thermal or Ballistics/.test(r.error),'a forged part id is refused ('+r.error+')');
 const cp0=cq(P).ledger.cp,pts0=ptsOf(P);
 r=await action(P,'research-grant',{mod:'thermal'});
 ok(r.status===200&&r.state.inv.pt.thermal===2&&r.state.rs.g==='thermal'&&r.state.notice?.kind==='research-grant'&&r.state.notice.n===2,said(r,'the first grant with Thermal: +2 Thermal Cores ('+J(r.state?.notice)+')'));
 ok(J(r.state.inv.pd)===J({d:dayOf(now),n:R.CQ_PART_DAY}),'... outside the one-a-day earned part limit (today\'s count unchanged: '+J(r.state.inv.pd)+')');
 ok(r.state.ledger.cp===cp0&&ptsOf(P)===pts0,'... and it costs no CP and pays no points');
 for(const m of ['coil','thermal']){r=await action(P,'research-grant',{mod:m});ok(r.status===409&&/already taken/.test(r.error)&&cq(P).inv.pt.thermal===2&&cq(P).inv.pt.coil===0,'a second grant ('+m+') is refused: '+r.error);}
 r=await action(P,'research-start',{mod:'vent'});ok(r.status===200&&r.state.rs.jobs[0]?.mod==='vent'&&r.state.inv.pt.thermal===0,said(r,'the 2 granted parts start the first mod (Vent Barrel) the same day'));}

// ======== 10. the Battalion store kinds are refused while checkout is off ========
{const P=9510,u={id:P,first_name:'Pilot',username:'batstore'};await join(P);
 const E=()=>eco(P),snap=()=>J({bch:E().bch||0,liv:E().liv||{},rcx:E().rcx||{},pts:E().pts||0,earned:E().earned||0,buys:E().buys||{}}),before=snap();
 ok(R.BAT_STORE_OPEN===false&&J(R.BAT_KINDS)===J(['chippack','livery','rcfin']),'BAT_STORE_OPEN is false; the Battalion store kinds are '+R.BAT_KINDS.join(', '));
 {tgCalls.length=0;const r=await call(P,'/api/stars-invoice',{kind:'box',tk:'weapon',ri:0});ok(r.status===200&&r.link&&tgCalls.some(c=>c[0]==='createInvoiceLink'),said(r,'control: the same route makes a Stars invoice for an item on sale (a weapon crate)'));}
 for(const body of [{kind:'chippack'},{kind:'livery',tk:'liv-arctic'},{kind:'livery',tk:'liv-colors'},{kind:'rcfin',tk:'r1'}]){tgCalls.length=0;const r=await call(P,'/api/stars-invoice',body);
  ok(r.status===400&&r.error==='item'&&!tgCalls.some(c=>c[0]==='createInvoiceLink')&&snap()===before,'no Stars invoice for '+body.kind+(body.tk?':'+body.tk:'')+' (descOf refuses it: '+r.status+' '+r.error+')');}
 const sec=await mod.webhookSecret(env),hook=b=>worker.fetch(new Request('https://test/api/tg-webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':sec},body:J(b)}),env);let n=0;
 for(const pl of [{u:P,k:'chippack',g:R.CHIP_PACK.ton},{u:P,k:'livery',t:'liv-arctic',g:R.LIVERIES['liv-arctic'].ton},{u:P,k:'rcfin',t:'r1',g:1}]){
  const r=await hook({message:{from:u,chat:{id:P,type:'private'},successful_payment:{total_amount:299,telegram_payment_charge_id:'ch-bat-'+(++n),invoice_payload:J(pl)}}});
  const held=db.get('held/st_ch-bat-'+n);   // Session 8: a payment with no server quote of ours is logged for the owner (held/), never granted
  ok(r.status===200&&snap()===before&&held&&held.err==='no quote','a Telegram-confirmed Stars payment naming '+pl.k+' grants nothing (logged with no grant; bch, liveries, finish credits unchanged)');}
 const logged=memo=>db.get('payments/LWM_'+memo.replace(/[.#$\[\]\/|]/g,'_'));
 {const r=await call(P,'/api/order',{a:'quote',cur:'TON',desc:{kind:'chippack'}});ok(r.status===400&&r.error==='item'&&snap()===before,'no GRAM quote for the chip pack (the Battalion store stays off: '+r.status+' '+r.error+')');}   // Session 8: every GRAM / SOL purchase is a server quote first (the old orderless pay-log is retired)
 {const r=await call(P,'/api/order',{a:'quote',cur:'TON',desc:{kind:'livery',tk:'liv-arctic'}});ok(r.status===400&&r.error==='item'&&snap()===before,'no GRAM quote for a livery (Battalion store off)');}
 {const r=await call(P,'/api/order',{a:'quote',cur:'TON',desc:{kind:'rcfin',tk:'r1'}});ok(r.status===400&&r.error==='item'&&snap()===before,'no GRAM quote for a RECRUIT instant finish (Battalion store off)');}
 {const r=await call(P,'/api/pay-log',{cur:'SOL',amt:0.1,gram:3.2,memo:'LWM|'+pid(P)+'|bat2',proof:'x',item:'Arctic livery',desc:{kind:'livery',tk:'liv-arctic'}});ok(r.status===410&&snap()===before,'the retired orderless pay-log grants nothing (410)');}
 // ecoGrant itself, with a payment record that looks confirmed (the shape the webhook hands it: the item plus its paid price)
 {const S=R.ecoNorm(JSON.parse(J(E()))),X={day:dayOf(now),week:Math.floor(dayOf(now)/7)},b0=J(S);
  for(const d of [{kind:'chippack',price:R.CHIP_PACK.ton},{kind:'livery',tk:'liv-arctic',price:R.LIVERIES['liv-arctic'].ton},{kind:'rcfin',job:'r1',price:1}])
   ok(J(R.ecoGrant(S,d,X))==='[]','ecoGrant with a confirmed-looking '+d.kind+' payment grants nothing while BAT_STORE_OPEN is false');
  ok(J(S)===b0&&!(S.bch>0)&&!S.liv?.['liv-arctic']&&!S.rcx?.r1,'... the account record is unchanged (bch '+(S.bch|0)+', no livery owned, no finish credit)');}
 {const r=await call(P,'/api/sync',{s:{bch:99,liv:{'liv-arctic':1,'liv-colors':1},rcx:{r1:1},pts:E().pts}});ok(r.status===200&&snap()===before,'a synced save from the phone cannot write pack chips, liveries or RECRUIT finish credits');}}

// ======== 2. pack chips (the account's eco bch) are never limited by the daily rule ========
{const P=9502;await town(P,{lab:4,hg:2});{const s=cq(P);s.bat={ch:{e:0,d:dayOf(now),bs:0}};}   // the day's earned chip already taken (and spent)
 putEco(P,{...eco(P),bch:7});
 let r=await action(P,'research-start',{mod:'rc:guardian'});const j1=r.state?.rs?.jobs?.find(j=>j.mod==='rc:guardian');
 ok(r.status===200&&j1&&j1.lv===2&&J(j1.paid)===J({e:0,b:2})&&r.state.bat.ch.bs===2&&r.state.bat.ch.e===0,said(r,'earned 0, pack chips 7: Guardian Role Core II (2 chips) starts on pack chips ('+J(j1?.paid)+', bat.ch.bs '+r.state?.bat?.ch?.bs+')'));
 ok(r.state.bat.ch.d===dayOf(now)&&r.state.rs.acct.bch===7,'the pack chips ignore the one-a-day rule (the day\'s earned chip was already taken) and are read from the account (rs.acct.bch 7)');
 r=await action(P,'research-start',{mod:'rc:lancer'});const j2=r.state?.rs?.jobs?.find(j=>j.mod==='rc:lancer');
 ok(r.status===200&&j2&&J(j2.paid)===J({e:0,b:2})&&r.state.bat.ch.bs===4&&r.state.rs.jobs.length===2,said(r,'a second Role Core job the same day is fine (pack chips spent tracked: bat.ch.bs 4)'));
 const h=BAT.chipsHeld(cq(P),eco(P).bch);ok(h.earned===0&&h.bonus===3&&h.total===3,'pack chips left: 7 - 4 = '+h.bonus);}

// ======== 1 (day 1). command chips: the day's first win with a pilot of yours fielded gives 1 earned chip ========
const P1=9501;let pts1;
{await join(P1);pts1=ptsOf(P1);
 let {s,fielded}=await rescue(P1);
 ok(fielded===0&&s.settlement.kind==='wingman'&&s.settlement.bat?.joined&&!s.settlement.bat.chip&&s.bat.ch.e===0&&s.bat.ch.d===0,'a win with none of your pilots fielded (the first rescue; the wingman joins at its end) gives no command chip: '+J(s.settlement.bat));
 await leave(P1);
 ({s,fielded}=await rescue(P1));
 ok(fielded===1&&s.settlement.bat.chip?.chip===1&&s.settlement.bat.chip.held===1&&s.bat.ch.e===1&&s.bat.ch.d===DAY1,'the day\'s first win with one of your pilots fielded gives 1 earned command chip: '+J(s.settlement.bat.chip)+' (bat.ch.d = UTC day '+s.bat.ch.d+')');
 await leave(P1);
 // a chip from any other source after the day's chip: 1 cosmetic fragment of pool CHIP.swap (no other chip source exists yet:
 // the Worker's own grantChip, on a copy of the stored record)
 {const c=structuredClone(cq(P1)),fr0=c.inv.fr[BT.CHIP.swap]|0,g=BAT.grantChip(c,'find',now);
  ok(BT.CHIP.swap==='u'&&g?.swap===1&&g.pool==='u'&&g.got?.fr?.u===1&&(c.inv.fr.u|0)===fr0+1&&c.bat.ch.e===1&&c.bat.ch.d===DAY1,'a chip from another source after the day\'s chip becomes 1 fragment of pool u ('+J(g)+'); earned chips stay 1');
  const c2=structuredClone(cq(P1));c2.bat.ch={e:BT.CHIP.max,d:0,bs:0};const g2=BAT.grantChip(c2,'win',now);
  ok(g2?.full===1&&c2.bat.ch.e===BT.CHIP.max&&c2.bat.ch.d===0,'a chip the '+BT.CHIP.max+' cap turns away is not taken and does not use up the day');}}

// ======== 6. the fielded cap per Hangar level ========
{const P=9506;await join(P);roster(cq(P),16);let r=await session(P);
 ok(mine(r.state).length===1,'no Hangar: 1 ally fielded (a roster of 16)');
 await town(P,{hg:1});r=await session(P);ok(mine(r.state).length===2,'Hangar I: 2 fielded in the open world (a Wing)');
 setLv(P,'hangar',2);r=await session(P);ok(mine(r.state).length===2,'Hangar II: the open world still fields a Wing of 2');
 r=await raid(P);ok(mine(r.state).length===4&&BT.scaleOf(RAID)==='platoon','Hangar II: a raid fields a Platoon of 4');await leave(P);
 setLv(P,'hangar',1);r=await raid(P);ok(mine(r.state).length===2,'Hangar I: a raid fields 2 (the Hangar\'s cap)');await leave(P);
 setLv(P,'hangar',5);r=await session(P);ok(mine(r.state).length===2,'Hangar V: the open world fields a Wing of 2');
 r=await raid(P);ok(mine(r.state).length===4,'Hangar V: a raid fields a Platoon of up to 4');await leave(P);
 // the Battalion scale (Citadel assaults, Grand Offensives and co-op; no operation uses it yet): the Worker's field() itself
 const got=[0,1,2,3,4,5].map(lv=>{const s=structuredClone(cq(P));if(lv)s.plot.b.hg1.l=lv;else delete s.plot.b.hg1;const b=structuredClone(s.battle);b.friends=[];return BAT.field(s,b,s.position,'battalion').filter(f=>f.side==='mine').length;});
 ok(J(got)===J([1,2,4,5,7,9])&&J(BT.FIELD)===J(got),'field() at the Battalion scale fields '+got.join(' / ')+' at no Hangar and Hangar I-V');}

// ======== 7. a kill by allies alone pays no points, CP or loot; the same kill with the pilot's own damage on it pays ========
// (conquest-economy.js killLoot: a kill pays only when your own tank dealt part of its damage, the Parasite's pd flag; one only
// allies touched, ad without pd, pays nothing). Staged on the flat open ground west of the Refuge (the town site: this pilot has
// none), your wingman in the Wing; the two kills are real fire replayed by the Worker.
{const P=9507;await join(P);{const s=cq(P);roster(s,1);s.battle.friends=[];s.position=ground(1080,1150);}let r=await session(P);
 assert.equal(mine(r.state).length,1);
 const eye=q=>({x:q.x,y:W.groundAt(q.x,q.z)+2.2,z:q.z}),spot=(from,d,a0)=>{for(let k=0;k<16;k++){const a=a0+k*Math.PI/8,x=from.x+Math.sin(a)*d,z=from.z+Math.cos(a)*d;if(!W.solidAt(x,z)&&!W.waterAt?.(x,z)?.deep&&C.lineClear(eye(from),eye({x,z})))return ground(x,z);}return null;};
 const lin=s=>J({cp:s.ledger.cp,cargo:s.ledger.cargo,drops:(s.drops||[]).map(d=>d.id),inv:[s.inv.it,s.inv.pt,s.inv.fr,s.inv.tr],wo:s.wo||null});
 // E1: a patrol interceptor in front of your wingman, one hit from dead; you hold fire
 const pts0=ptsOf(P),ob0=outbox(P);let s=cq(P);const f=mine(s)[0],p=s.position;
 const E1=s.battle.enemies.find(e=>e.key==='road-intercept'),at1=spot(f,22,Math.atan2(f.x-p.x,f.z-p.z));assert(E1&&E1.base?.kind==='patrol'&&E1.kind==='raider'&&at1,'an open spot in front of the wingman');
 Object.assign(E1,at1,{home:{x:at1.x,z:at1.z,y:at1.y+2.2},hp:1});const l0=lin(s);
 for(let k=0;k<20;k++){r=await input(P,{x:0,z:0});assert.equal(r.status,200,J(r.error));if(!(cq(P).battle.enemies.find(e=>e.id===E1.id).hp>0))break;}
 s=cq(P);const e1=s.battle.enemies.find(e=>e.id===E1.id);
 ok(e1.hp<=0&&e1.ad===1&&!e1.pd&&e1.lootCreated&&s.bat.p[0].k===1,'your wingman killed a patrol interceptor alone (ad '+e1.ad+', pd '+(e1.pd|0)+'; the kill is on its card: '+s.bat.p[0].k+')');
 ok(lin(s)===l0&&!(s.drops||[]).some(d=>String(d.id).startsWith('e:'+E1.key+':'))&&outbox(P)===ob0,'... it left no salvage cache (no CP, materials or loot roll), no War Order count and no points in the outbox');
 r=await session(P);ok(ptsOf(P)===pts0&&r.state.ledger.cp===JSON.parse(l0).cp,'... and the account\'s points and the pilot\'s CP are unchanged after the session settles');
 // E2: the same kind (a patrol interceptor) that an ally already touched (ad), with your own fire on it (pd)
 s=cq(P);const p2=s.position,f2=mine(s)[0],E2=s.battle.enemies.find(e=>e.key==='refuge-scout'),at2=spot(p2,12,Math.atan2(p2.x-f2.x,p2.z-f2.z));
 assert(E2&&E2.base?.kind==='patrol'&&E2.kind==='raider'&&at2,'an open spot in front of the pilot');Object.assign(E2,at2,{home:{x:at2.x,z:at2.z,y:at2.y+2.2},hp:60,ad:1});const cp1=s.ledger.cp;
 for(let k=0;k<20;k++){const q=cq(P),e=q.battle.enemies.find(x=>x.id===E2.id);if(!(e.hp>0))break;r=await input(P,{x:0,z:0,aimYaw:Math.atan2(e.x-q.position.x,e.z-q.position.z),fire:true,lockId:e.id},20);assert.equal(r.status,200,J(r.error));}
 s=cq(P);const e2=s.battle.enemies.find(e=>e.id===E2.id),gen=s.spawns[E2.key]?.generation,drop=(s.drops||[]).find(d=>d.id==='e:'+E2.key+':'+gen);
 ok(e2.hp<=0&&e2.pd===1&&e2.ad===1&&drop&&drop.amount.cp>0,'a patrol interceptor allies touched, killed with your own damage on it (pd): a salvage cache with '+J(drop?.amount));
 const a2=s.airdrop,kills=(Array.isArray(a2.out)?a2.out:Object.values(a2.out||{})).reduce((n,x)=>n+(x.n?.kill|0),0)+(a2.pend?.n?.kill|0);ok(kills===1,'... and its points ride the outbox (1 kill)');
 for(let k=0;k<8&&(cq(P).drops||[]).some(d=>d.id===drop.id);k++){const q=cq(P),d=Math.hypot(drop.x-q.position.x,drop.z-q.position.z),y=Math.atan2(drop.x-q.position.x,drop.z-q.position.z);r=await input(P,{x:Math.sin(y),z:Math.cos(y)},Math.max(1,Math.min(20,Math.floor(d/(q.battle.combatSpeed*2*.05)))));assert.equal(r.status,200,J(r.error));}
 s=cq(P);ok(!(s.drops||[]).some(d=>d.id===drop.id)&&s.ledger.cp===cp1+drop.amount.cp,'picking up its cache pays '+drop.amount.cp+' CP ('+cp1+' -> '+s.ledger.cp+')');
 r=await session(P);ok(JSON.parse(ptsOf(P)).pts>JSON.parse(pts0).pts,'the account\'s points rise once the session settles ('+JSON.parse(pts0).pts+' -> '+JSON.parse(ptsOf(P)).pts+')');}

// ======== 3 + 4. Role Cores: Science Lab IV, Hangar II, chips; an 8 h job in the research slots; the level reaches the role ========
const P3=9503,P4=9504;let rcAt,rjAt;
{const P=P3;await town(P,{lab:3,hg:2});{const s=cq(P);s.bat={p:[pilotRec(1,'guardian'),pilotRec(2,'guardian',3),pilotRec(3,'guardian'),pilotRec(4,'lancer')],n:4,w:1,ch:{e:9,d:0,bs:0}};s.inv.pt.thermal=5;}
 const chips=()=>J(cq(P).bat.ch);
 let r=await action(P,'research-start',{mod:'rc:guardian'});ok(r.status===409&&/Science Lab level IV/.test(r.error)&&chips()===J({e:9,d:0,bs:0})&&!cq(P).rs.jobs?.length,'a Role Core level is refused at Science Lab III ('+r.error+'); nothing spent');
 setLv(P,'lab',4);setLv(P,'hangar',1);r=await action(P,'research-start',{mod:'rc:guardian'});ok(r.status===409&&/Hangar level II/.test(r.error)&&chips()===J({e:9,d:0,bs:0})&&!cq(P).rs.jobs?.length,'... refused before Hangar II ('+r.error+'); nothing spent');
 setLv(P,'hangar',2);cq(P).bat.ch.e=1;r=await action(P,'research-start',{mod:'rc:guardian'});ok(r.status===409&&/needs 2 command chips/.test(r.error)&&chips()===J({e:1,d:0,bs:0})&&!cq(P).rs.jobs?.length,'... refused without enough chips ('+r.error+'); nothing spent');
 cq(P).bat.ch.e=9;const cp0=cq(P).ledger.cp;r=await action(P,'research-start',{mod:'rc:guardian'});const j=r.state?.rs?.jobs?.find(x=>x.mod==='rc:guardian');rcAt=now;
 ok(r.status===200&&j&&j.part==='chip'&&j.lv===2&&j.ms===BT.RC.ms&&j.ms===8*HOUR&&J(j.paid)===J({e:2,b:0})&&r.state.bat.ch.e===7&&r.state.ledger.cp===cp0,said(r,'Science Lab IV + Hangar II + chips: Guardian Role Core II starts, an 8 h job paid with 2 earned chips (CP unchanged)'));
 r=await action(P,'research-start',{mod:'vent'});ok(r.status===200&&r.state.rs.jobs.length===2,said(r,'it holds one of the research slots: an ordinary mod takes the second'));
 r=await action(P,'research-start',{mod:'rc:breacher'});ok(r.status===409&&/research slot is busy \(2\)/.test(r.error)&&cq(P).bat.ch.e===7,'... and a third job finds every slot busy ('+r.error+')');
 r=await hangar(P,'hangar-preset',{i:1,ids:['p1','p2','p3','p4'],f:'wedge'});assert.equal(r.status,200,J(r.error));
 r=await hangar(P,'hangar-preset',{i:0,ids:['p1','p4'],f:'wedge'});assert.equal(r.status,200,J(r.error));
 const m=s=>Object.fromEntries(mine(s).map(f=>[f.pid,f.m]));ok(J(m(r.state))===J({p1:1,p4:1}),'before: the Wing (Guardian p1, Lancer p4) fights at strength 1 '+J(m(r.state)));}
// ======== 5. the RECRUIT job ('hangar-recruit'): a Hangar, one at a time, 8 h on the Worker clock ========
{const P=P4;await join(P);let r=await hangar(P,'hangar-recruit');ok(r.status===409&&/build a Hangar first/.test(r.error),'hangar-recruit is refused without a Hangar ('+r.error+')');
 await town(P,{hg:1});roster(cq(P),13);now+=2*MIN;const pts0=ptsOf(P),ob0=outbox(P);
 r=await hangar(P,'hangar-recruit');rjAt=now;ok(r.status===200&&r.state.bat.rj?.id==='r1'&&r.state.bat.rj.ms===8*HOUR&&r.state.bat.rj.left===8*HOUR&&r.state.notice?.kind==='recruit-started',said(r,'Hangar I: a RECRUIT job starts, 8 h on the Worker clock'));
 r=await hangar(P,'hangar-recruit');ok(r.status===409&&/already on the way/.test(r.error)&&cq(P).bat.rj.id==='r1','one at a time: a second is refused ('+r.error+')');
 ok(ptsOf(P)===pts0&&outbox(P)===ob0,'starting it pays no points');}

// ---- the Worker clock: 8 h ----
{now=rcAt+8*HOUR-MIN;let r=await session(P3);const j=r.state.rs.jobs.find(x=>x.mod==='rc:guardian');
 ok(r.state.rs.rc.guardian===1&&j&&j.left===MIN&&mine(r.state).find(f=>f.pid==='p1').m===1,'8 h minus a minute: the Guardian Role Core job is still running (1 min left), Guardians at level 1');
 const pts0=ptsOf(P3);now=rcAt+8*HOUR;r=await session(P3);const st=r.state;
 ok(st.rs.rc.guardian===2&&!st.rs.jobs.some(x=>x.mod==='rc:guardian')&&BAT.rcLevel(cq(P3),'guardian')===2,'at 8 h the session open finishes it: rs.rc.guardian 1 -> 2');
 ok(JSON.parse(ptsOf(P3)).pts===JSON.parse(pts0).pts,'a Role Core level pays no points');
 const m=s=>Object.fromEntries(mine(s).map(f=>[f.pid,f.m]));
 ok(m(st).p1===BT.strength(1,2)&&m(st).p1===1.1&&m(st).p4===BT.strength(1,1)&&m(st).p4===1,'after the refresh the fielded Guardian fights at strength(rank 1, level 2) = '+m(st).p1+'; the Lancer stays at '+m(st).p4);
 let r2=await hangar(P3,'hangar-preset',{i:1});ok(r2.status===200&&J(m(r2.state))===J({p1:BT.strength(1,2),p2:BT.strength(3,2)}),'preset 2 (two Guardians in the Wing): '+J(m(r2.state))+' (rank 3: '+BT.strength(3,2)+')');
 r2=await raid(P3);const R4=m(r2.state),cast=cq(P3).bat.p;
 ok(mine(r2.state).length===4&&cast.every(p=>R4[p.id]===BT.strength(p.rk,p.r==='guardian'?2:1))&&J(R4)===J({p1:1.1,p2:1.2,p3:1.1,p4:1}),'start-mission (a raid, Platoon): every fielded Guardian carries m = strength(rank, 2), the Lancer strength(rank, 1): '+J(R4));
 await leave(P3);}
{const P=P4;now=rjAt+8*HOUR-MIN;const pts0=ptsOf(P),ob0=outbox(P);let r=await session(P);
 ok(r.state.bat.p.length===13&&r.state.bat.rj?.left===MIN,'8 h minus a minute: no new pilot yet (1 min left)');
 now=rjAt+8*HOUR;r=await session(P);const nw=r.state.bat.p.find(p=>!/^Test/.test(p.n));
 ok(r.state.bat.p.length===14&&nw&&nw.src==='recruit'&&nw.at===now&&!r.state.bat.rj&&r.state.notice?.kind==='recruit-joined'&&r.state.notice.pilot===nw.id,'at 8 h a new pilot joins: '+nw?.n+' "'+nw?.cs+'" ('+nw?.id+')');
 ok(ptsOf(P)===pts0&&outbox(P)===ob0,'a recruit joining pays no airdrop points (account points fields and outbox unchanged)');
 // ======== 9. liveries: looks only, never points ========
 putEco(P,{...eco(P),liv:{'liv-arctic':1}});const pl=ptsOf(P),ol=outbox(P);
 r=await hangar(P,'hangar-livery',{id:'liv-ember'});ok(r.status===409&&/not yours yet/.test(r.error),'a livery the account does not own is refused ('+r.error+')');
 r=await hangar(P,'hangar-livery',{id:'liv-bogus'});ok(r.status===409&&/invalid livery/.test(r.error),'an unknown livery is refused ('+r.error+')');
 r=await hangar(P,'hangar-livery',{id:'liv-arctic'});ok(r.status===200&&r.state.bat.lv==='liv-arctic','an owned livery is worn ('+r.state.bat?.lv+')');
 r=await hangar(P,'hangar-livery',{id:''});ok(r.status===200&&r.state.bat.lv==='','... and taken off (stock paint)');
 r=await hangar(P,'hangar-livery',{id:'liv-arctic'});ok(r.status===200&&ptsOf(P)===pl&&outbox(P)===ol,'a livery action pays no airdrop points (account points fields and outbox unchanged)');
 putEco(P,{...eco(P),liv:{}});r=await session(P);ok(r.state.bat.lv==='','a livery the account no longer owns (a refund) comes off at the session open');
 // the daily BEACON EXTRACTION recruit: one a UTC day
 let s=await beacon(P);ok(s.settlement.bat?.recruit&&s.bat.p.length===15&&s.bat.rd===dayOf(now),'the day\'s first BEACON EXTRACTION win brings a recruit: '+J(s.settlement.bat.recruit));await leave(P);
 now+=4*MIN;s=await beacon(P);ok(!s.settlement.bat?.recruit&&s.bat.p.length===15,'a second win the same UTC day brings nobody');await leave(P);
 r=await hangar(P,'hangar-recruit');rjAt=now;ok(r.status===200&&r.state.bat.rj?.id==='r2',said(r,'a second RECRUIT job starts with 15 on the roster'));}

// ======== 1 (the day boundary). no second chip before 00:00 UTC, one again right after ========
{now=Date.UTC(2026,10,17,23,58,30);let {s,fielded}=await rescue(P1);
 ok(fielded>=1&&s.settlement.kind==='wingman'&&!s.settlement.bat.chip&&s.bat.ch.e===1&&s.bat.ch.d===DAY1&&dayOf(now)===DAY1,'a second win with your pilots fielded the same UTC day (at '+new Date(now).toISOString().slice(11,19)+') gives no chip ('+J(s.settlement.bat)+')');
 await leave(P1);now=Date.UTC(2026,10,18,0,0,5);const r=await session(P1);
 ok(r.state.bat.ch.d===DAY1&&BAT.chipsToday(cq(P1),now)===0,'00:00 UTC: the hub\'s day field still names yesterday (0/1 chips today)');
 ({s,fielded}=await rescue(P1));
 ok(fielded>=1&&s.settlement.bat.chip?.chip===1&&s.settlement.bat.chip.held===2&&s.bat.ch.e===2&&s.bat.ch.d===DAY1+1&&BAT.chipsToday(s,now)===1,'the next UTC day\'s first win gives 1 again ('+J(s.settlement.bat.chip)+'); the hub\'s day field moves '+DAY1+' -> '+s.bat.ch.d);
 await leave(P1);await session(P1);
 ok(ptsOf(P1)===pts1&&J(cq(P1).airdrop?.out||[])==='[]'&&!(cq(P1).airdrop?.seq>0),'across 2 command chips and 4 wingmen joining, the account\'s airdrop points never moved and no outbox entry was ever written ('+ptsOf(P1)+')');}

// ======== 5 (the roster cap). 16 is the most: a RECRUIT job or the daily rescue recruit never passes it ========
{const P=P4;now=Math.max(now,Date.UTC(2026,10,18,0,1,0));let s=await beacon(P);
 ok(s.settlement.bat?.recruit&&s.bat.p.length===BT.ROSTER_MAX&&s.bat.rj?.id==='r2','the next day\'s rescue recruit fills the roster to '+s.bat.p.length+' while the RECRUIT job runs');await leave(P);
 now=rjAt+8*HOUR;let r=await session(P);ok(r.state.bat.p.length===BT.ROSTER_MAX&&!r.state.bat.rj&&r.state.notice?.kind==='recruit-joined'&&r.state.notice.pilot===null,'the RECRUIT job ends with the roster full: nobody joins, still '+r.state.bat.p.length);
 r=await hangar(P,'hangar-recruit');ok(r.status===409&&/roster is full \(16\)/.test(r.error),'hangar-recruit is refused while the roster is full ('+r.error+')');
 now=Date.UTC(2026,10,19,0,0,30);s=await beacon(P);ok(s.bat.p.length===BT.ROSTER_MAX&&!s.settlement.bat?.recruit&&s.bat.rd===dayOf(now)-1,'a new UTC day\'s BEACON EXTRACTION win with a full roster adds nobody ('+s.bat.p.length+')');await leave(P);}

// ======== 11. the cold-blob sweep at session open is race-safe ========
{const P=9511,key=pid(P),blobs=()=>Object.keys(db.get('cqc/'+key)||{}).sort(),hot=()=>db.get('conquest/'+key),plant=id=>{db.root.cqc[key][id]={orphan:1};};
 const envA={...env};await call(P,'/api/sync',{lab:1},envA);let r=await session(P,envA);assert.equal(r.status,200);
 for(let i=0;i<3;i++){now+=MIN;r=await session(P,envA);assert.equal(r.status,200);}   // new generations (the cold part changes with the clock)
 const {cv,cvn}=hot();ok(cvn>=3&&cv.startsWith(cvn+'x')&&J(blobs())===J([cv]),'the record sits at generation '+cvn+' (cold blob '+cv+'), the only blob');
 r=await session(P,envA);ok(r.status===200&&hot().cv===cv,'a session open at the same clock commits no new cold blob (the generation stays '+cvn+')');
 const old=(cvn-1)+'xorphan',same=cvn+'xorphan',next=(cvn+1)+'xinflight';plant(old);plant(same);plant(next);
 const envB={...env},d0=store.coldDeletes;r=await session(P,envB);   // a fresh isolate: its hourly throttle has not run for this pilot
 ok(r.status===200&&hot().cv===cv&&hot().cvn===cvn,'a session open (generation still '+cvn+') ...');
 ok(J(blobs())===J([cv,next].sort())&&store.coldDeletes-d0===2,'... deletes the orphans of generations '+(cvn-1)+' and '+cvn+' (2 deletes), keeps the current blob and the in-flight generation '+(cvn+1)+' one: '+J(blobs()));
 const late=(cvn-1)+'xlate';plant(late);const b1=J(blobs()),d1=store.coldDeletes;r=await session(P,envB);
 ok(r.status===200&&hot().cv===cv&&J(blobs())===b1&&store.coldDeletes===d1,'a second session open within the hour deletes nothing (throttled per pilot per isolate: '+late+' is still there)');
 now+=61*MIN;r=await session(P,envB);const h2=hot();
 ok(r.status===200&&h2.cvn===cvn+1&&J(blobs())===J([h2.cv]),'an hour later the sweep runs again: with generation '+h2.cvn+' committed (the clock changed the cold part), the late orphan and the generation '+(cvn+1)+' blob that lost its race are gone too: '+J(blobs()));
 const whole=await readState({...env},key);ok(whole?.v===1&&whole.bat&&whole.rs&&Number.isSafeInteger(whole.lseed)&&r.state.v===1,'the record still reads fine afterwards (hot part + its cold blob)');
 now+=1000;r=await hangar(P,'hangar-preset',{i:0,f:'wedge'});ok(r.status===200&&r.state.seq===hot().seq,said(r,'... and still takes actions'));}

console.log('PASS conquest-battalion ('+passed+' checks)');
