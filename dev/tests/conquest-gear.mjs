// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decision 8: customizable battalion gear. In the Hangar the player
// picks which spare owned weapon and chassis each pilot uses (the item's stats and the pilot's resulting stats shown); the same tankOf()
// rules as the player's own tank; one pilot per item, never an item on the player's own tank; AUTO-ARM stays the one-tap option; it
// applies wherever the battalion fights (the world's Wing / Platoon / Battalion and the town's garrison). Server-decided: the gear is
// the account record's (ctx.gear from gearOf(account)), never the phone's.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Battalion:BT,Raid:RD,War:WR}=CONQUEST;
const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');
const {gearOf}=await import('../../worker/src/conquest-battalion.js');
const {garrisonOf}=await import('../../worker/src/conquest-town.js');
const {townPilot}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const t0=Date.UTC(2026,10,23,9);
// an account that owns spare gear: Pulse I/II, Twin II, Siege III, Moonbeam; Scout II, Vanguard I, Titan III; its own tank: Pulse II on Vanguard I
const S={wOwn:{pulse:[0,1],twin:[1],siege:[2]},cOwn:{scout:[1],vanguard:[0],titan:[2]},moonbeam:true,roll:{'siege:2':1.08}};
const L={...structuredClone(R.STOCK_L),w:{a:'pulse',t:1,q:1,s:false},c:{c:'vanguard',t:0,q:1,s:false}};
const ctx=()=>({gear:gearOf(R.ecoNorm?R.ecoNorm(structuredClone(S)):structuredClone(S),L)});
let s=townPilot(CONQUEST,R,createState,t0,{cc:6});s.plot.b.h1={t:'hangar',...CONQUEST.Plot.autoPlace(s.plot,'hangar'),l:3};
s.bat={p:[1,2,3,4,5,6].map(i=>({id:'p'+i,n:'N'+i,cs:'CS'+i,r:i===1?'guardian':i===2?'lancer':'',xp:0,rk:2,k:0,h:1,kit:null,at:t0,src:'recruit'})),ps:[{f:'wedge',ids:[]},{f:'wedge',ids:[]},{f:'wedge',ids:[]}],pa:0};
let now=t0;const act=(a,bat,c=ctx())=>{now+=1000;s=applyAction(s,{seq:s.seq+1,action:a,...(bat?{bat}:{})},now,c);return s;};
const kit=id=>s.bat.p.find(p=>p.id===id).kit,key=k=>k?BT.keyOf({k:k.a??k.c,t:k.t,s:k.s}):'';
// ---- 1. AUTO-ARM, the one-tap option, as before ----
act('hangar-arm');const auto=s.bat.p.map(p=>key(p.kit.w)+'|'+key(p.kit.c));
{const sp=BT.spare(s.bat.g,s.bat.own);ok(!auto.some(x=>x.startsWith('pulse:1|'))&&!sp.c.some(x=>BT.keyOf(x)==='vanguard:0')&&!sp.w.some(x=>BT.keyOf(x)==='pulse:1'),'AUTO-ARM never takes an item off your own tank (Pulse II, Vanguard I: not in the spare list; the Vanguard I a crew may fly is the militia kit)');}
ok(kit('p1').w.a==='moon'||kit('p2').w.a==='moon'||auto.some(x=>x.startsWith('moon')),'AUTO-ARM puts your best spare gun on a pilot first ('+auto.join(', ')+')');
// ---- 2. a pick: the chosen spare weapon and chassis, the same tankOf() rules ----
const before=BT.kitStats(kit('p3'),2);act('hangar-gear',{pilot:'p3',w:'siege:2',c:'scout:1'});const k3=kit('p3');
ok(k3.w.a==='siege'&&k3.w.t===2&&k3.c.c==='scout'&&k3.c.t===1&&s.bat.p.find(p=>p.id==='p3').pin,'a pilot\'s own pick: Siege III on a Scout II, pinned');
const after=BT.kitStats(k3,2);ok(after&&before&&after.dps!==before.dps&&after.power!==before.power,'the pilot\'s resulting stats change with the pick (DPS '+before.dps+' -> '+after.dps+', HULL '+before.hp+' -> '+after.hp+', POWER '+before.power+' -> '+after.power+')');
ok(s.bat.p.filter(p=>key(p.kit.w)==='siege:2').length===1&&s.bat.p.filter(p=>key(p.kit.c)==='scout:1').length===1,'one pilot per item: nobody else carries Siege III or Scout II');
// ---- 3. one pilot per item: picking an item another pilot has pinned moves it ----
act('hangar-gear',{pilot:'p4',w:'siege:2'});ok(key(kit('p4').w)==='siege:2'&&key(kit('p3').w)!=='siege:2'&&s.notice.moved?.includes('CS3'),'the pick moves the item from CS3 to CS4 (one pilot per item)');
// ---- 4. never an item on your own tank; never an item you do not own (the account record decides, not the phone) ----
assert.throws(()=>act('hangar-gear',{pilot:'p5',w:'pulse:1'}),/your own tank/);ok(true,'Pulse II is on your own tank: refused');
assert.throws(()=>act('hangar-gear',{pilot:'p5',c:'titan:1'}),/not one of your spare/);ok(true,'an item the account does not own (Titan II): refused');
assert.throws(()=>act('hangar-gear',{pilot:'p5',w:'moon:2:s'}),/not one of your spare/);ok(true,'a forged key: refused');
// ---- 5. AUTO on a slot, AUTO-ARM clears every pick ----
act('hangar-gear',{pilot:'p3',c:''});ok(!s.bat.p.find(p=>p.id==='p3').pin,'AUTO on its last pinned slot: the pilot is back on AUTO-ARM');
act('hangar-gear',{pilot:'p6',w:'twin:1'});act('hangar-arm');ok(s.bat.p.every(p=>!p.pin),'AUTO-ARM (one tap) clears every pick and arms everyone again');
// ---- 6. an item that leaves the account: its pin drops at the next arm ----
act('hangar-gear',{pilot:'p6',w:'twin:1'});S.wOwn.twin=[];act('hangar-arm',null,ctx());S.wOwn.twin=[1];ok(s.bat.p.every(p=>key(p.kit.w)!=='twin:1'),'an item no longer owned is never fielded (its pin is gone)');
// ---- 7. any chassis (the player's own tank rules): a Guardian on a Scout ----
act('hangar-gear',{pilot:'p1',c:'scout:1'});ok(kit('p1').c.c==='scout','a Guardian can fly a Scout chassis by choice (your build, your call)');
// ---- 8. it applies wherever the battalion fights: the town's garrison reads the same kit ----
s.plot.b.h1.l=3;const g=garrisonOf(s),u=g.map(p=>RD.unitOf({id:p.id,kind:'g',kit:p.kit,rk:p.rk,role:p.r}));
ok(g.length>=1&&g.every(p=>JSON.stringify(p.kit)===JSON.stringify(kit(p.id))),'the garrison fights in the kit the Hangar shows ('+g.map(p=>p.cs+': '+key(p.kit.w)+'/'+key(p.kit.c)).join(', ')+')');
{const a=RD.unitOf({id:'x',kind:'g',kit:{w:{a:'pulse',t:0,q:1},c:{c:'vanguard',t:0,q:1}},rk:1}),b=RD.unitOf({id:'x',kind:'g',kit:{w:{a:'pulse',t:2,q:1},c:{c:'titan',t:2,q:1}},rk:1});ok(b.dmg/b.rof>a.dmg/a.rof&&b.hp>a.hp,'strength = rating + gear: better gear, a stronger defender');}
ok(WR.rating(s.bat.p[0])>0,'the war\'s Station value reads the same rating (gear POWER + rank)');
console.log('PASS customizable battalion gear (decision 8): '+pass+' checks');
