// Session 6 loot v1 (docs/conquest/audit/CONQUEST_1_0_SPEC.md §4): the tables as shipped, disjointness from every store and
// catalog, no points, server-keyed rolls (no re-roll), hard pity, account-bound inventory with caps, fragments -> pieces without
// repeats, consumables used through the Worker, receipts for raids / strikes / defenses, Town Score and the Hive emblem.
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Plot:PL,Catalog:CAT},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const {POLICY:P,killLoot,pickups,death,missionReward}=await import('../../worker/src/conquest-economy.js');
const L=await import('../../worker/src/conquest-loot.js');
const {publicState}=await import('../../worker/src/conquest.js');
const {defenseOutcome}=await import('../../worker/src/conquest-campaign.js');
const now=20*P.day+5000,point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),fresh=()=>createState(R.STOCK_L,now);

// ---- 1. the tables exactly as spec §4.1 ----
const T=R.LOOT,row=(src,key,val)=>T[src].rows.find(r=>r[key]===val||key==='item'&&r.item===val||key==='part'&&r.part||key==='trophy'&&r.trophy);
assert.deepEqual(T.mob.rows,[{p:.12,mn:'fe'},{p:.03,mn:'il'},{p:.04,item:1},{p:.005,frag:'c'}]);
assert.deepEqual(T.elite.rows,[{p:.25,mn:'il'},{p:.06,mn:'ar'},{p:.08,item:1},{p:.03,part:1},{p:.01,frag:'u'}]);assert.equal(T.elite.pity.part,20);
assert.deepEqual(T.commander.rows,[{p:.12,part:1},{p:.10,trophy:1},{p:.05,frag:'r'}]);assert.deepEqual(T.commander.ring,{4:[{p:.08,mn:'tq'}]});assert.equal(T.commander.pity.trophy,10);
assert.deepEqual(T.chest,{always:{item:1},rows:[{p:.08,frag:'r'}]});assert.deepEqual(T.strike.rows,[{p:.15,part:1},{p:.10,frag:'r'},{p:.03,ward:1}]);   // Session 7T owner decision 2: the Peace Ward (24 h town shield) as rare loot: these two rows only
assert.deepEqual(T.defense.rows,[{p:.06,item:2},{p:.04,frag:'u'},{p:.05,ward:1}]);assert.deepEqual(T.order,{daily:{item:1},third:{frag:'u'},weekly:{mn:{ar:1},frag:'r'}});
// Session 7C (the old brief's D, spec §4.1's Titan row): the Hive Titan's rows and pity, exactly; its trophy joins the Trophy Hall (no longer reserved)
assert.deepEqual(T.titan,{rows:[{p:1,mn:'tq'},{p:1,mn:'tq'},{p:.25,part:1},{p:.20,mn:'se'},{p:.02,mn:'mh'},{p:.30,trophy:1},{p:.10,frag:'e'}],pity:{se:5}});assert.deepEqual(R.CQ_TROPHY_RESERVED,[]);assert.deepEqual(R.CQ_TROPHY['hive-titan'],{n:'Hive Titan',r:4});
assert.equal(R.CQ_ITEM_MAX,10);assert.equal(R.CQ_PART_MAX,50);assert.equal(R.CQ_FRAG.need,10);assert.equal(R.CQ_TROPHY_SCORE,15);
assert.equal(R.CQ_ITEMS.repair.heal,.4);assert.equal(R.CQ_ITEMS.repair.healS,6);assert.equal(R.CQ_ITEMS.repair.cdMs,60000);assert.equal(R.CQ_ITEMS.decoy.radius,120);assert.equal(R.CQ_ITEMS.decoy.s,8);assert.equal(R.CQ_ITEMS.scanner.extra,100);
assert.equal(L.rows('commander',3).length,3,'HARD commanders: no Tranquillityite');assert.equal(L.rows('commander',4).length,4,'VETERAN commanders: +8% Tranquillityite');assert.equal(L.rows('mob',5).length,4,'mob rows are the same in every ring');
console.log('PASS loot tables exactly as spec §4.1 (mob, elite, commander + VETERAN ring row, chest, strike, defense, War Orders; Titan reserved)');

// ---- 2. never sold, never points, never crate-sized (spec §4.4) ----
const lootIds=new Set([...Object.keys(R.CQ_ITEMS),...Object.keys(R.CQ_PARTS),...Object.keys(R.CQ_TROPHY),...R.CQ_TROPHY_RESERVED,...Object.values(CAT.pools).flat()]);
const storeIds=new Set([...PL.STORE.items.map(i=>i.id),...CAT.items.filter(i=>!i.pool).map(i=>i.id),...Object.keys(R.PAINTS),...Object.keys(R.WEAPONS),...Object.keys(R.CH),...Object.keys(R.PREMIUM),...Object.keys(R.VAULT),...R.VAULT_REW.map(v=>v.k),...Object.keys(R.GEM),...Object.keys(R.BUFF),...R.SUP_KEYS]);
for(const id of lootIds)assert(!storeIds.has(id),'loot id '+id+' is also a store / catalog / Arcade id');
assert(PL.STORE.checkout===false,'base store checkout stays disabled');
for(const id of Object.values(CAT.pools).flat()){const i=CAT.byId[id];assert(i.earnOnly&&i.proposedUsd===null&&i.pool,'fragment piece '+id+' is earn-only, never priced');}
const ALLOWED=new Set(['p','mn','item','part','frag','trophy','ward']);   // Session 7T owner decision 2: 'ward', the Peace Ward (a 24-hour town shield consumable, never points or currency)
for(const [src,t] of Object.entries(T)){if(!t)continue;for(const r of [...(t.rows||[]),...Object.values(t.ring||{}).flat()]){for(const k of Object.keys(r))assert(ALLOWED.has(k),src+' row pays '+k+' (no points, no currency)');assert(!r.mn||R.MINERALS[r.mn],src);assert((r.item|0)<=2,src+' pays at most 2 consumables');}
 assert(!JSON.stringify(t).match(/pts|points|cp"|stars|ton|usd/i),src+' never pays points or currency');}
assert(Object.values(T.order.weekly.mn).every(n=>n<=1),'never crate-sized minerals (store crates are 150 Ferrite / 60 Ilmenite)');
console.log('PASS loot never overlaps the base store, the Conquest catalog, Arcade gear/paints/premium/vault/gems; never pays points or crate-sized minerals');

// ---- 3. server-keyed rolls: same key = same roll, the seed never reaches the client ----
let s=fresh();assert(Number.isSafeInteger(s.lseed));const pub=publicState(s);assert(!('lseed' in pub),'loot seed never leaves the Worker');
const a=structuredClone(s),b=structuredClone(s);assert.deepEqual(L.roll(a,'elite','e:x:1'),L.roll(b,'elite','e:x:1'),'same seed + key = same roll');
const other=structuredClone(s);other.lseed=(s.lseed+1)>>>0;let diff=0;for(let i=0;i<400;i++)if(JSON.stringify(L.roll(structuredClone(s),'mob','k'+i))!==JSON.stringify(L.roll(structuredClone(other),'mob','k'+i)))diff++;assert(diff>20,'a different pilot seed rolls differently');
// a kill makes exactly one roll: the same spawn generation cannot mint a second cache (or move pity twice)
s=fresh();let e=s.battle.enemies.find(x=>x.kind==='sentinel'||x.kind==='command');e.hp=0;killLoot(s,e,now);const d0=s.drops[0];assert(d0&&Number.isInteger(d0.r)&&d0.label,'a cache shows rarity + label');const pity0=s.inv.pity.e;killLoot(s,{...e,lootCreated:false},now);assert.equal(s.drops.length,1);assert.equal(s.inv.pity.e,pity0,'a repeated kill never moves pity');
console.log('PASS rolls keyed by the server seed + kill id / attempt; a repeat kill re-rolls nothing; the seed is never public');

// ---- 4. measured rates (200,000 rolls each) ----
const N=200000,rate=(src,opt,f)=>{const t=fresh();let n=0;for(let i=0;i<N;i++){t.inv.pity={e:0,c:0,cf:{}};const o=L.roll(t,src,'r'+i,opt);n+=f(o)?1:0;}return n/N;},near=(x,p,tol)=>assert(Math.abs(x-p)<=tol,x+' vs '+p);
near(rate('mob',{},o=>o.mn?.fe),.12,.004);near(rate('mob',{},o=>o.mn?.il),.03,.002);near(rate('mob',{},o=>o.it),.04,.002);near(rate('mob',{},o=>o.fr?.c),.005,.0008);
near(rate('elite',{},o=>o.mn?.il),.25,.005);near(rate('elite',{},o=>o.mn?.ar),.06,.003);near(rate('elite',{},o=>o.fr?.u),.01,.001);
near(rate('commander',{ring:3,commander:'ambush'},o=>o.mn?.tq),0,0);near(rate('commander',{ring:4,commander:'ambush'},o=>o.mn?.tq),.08,.003);near(rate('commander',{ring:4,commander:'plasma'},o=>o.fr?.r),.05,.003);
near(rate('chest',{},o=>Object.values(o.it||{}).reduce((a,b)=>a+b,0)>=1),1,0);near(rate('chest',{},o=>o.fr?.r),.08,.003);near(rate('chest',{steps:1},o=>o.fr?.e),.08,.003);
near(rate('strike',{},o=>o.pt),.15,.004);near(rate('strike',{},o=>o.fr?.r),.10,.003);near(rate('defense',{},o=>(o.it&&Object.values(o.it).reduce((a,b)=>a+b,0))===2),.06,.003);
const w={};{const t=fresh();for(let i=0;i<N;i++){const o=L.roll(t,'chest','w'+i);for(const k of Object.keys(o.it))w[k]=(w[k]||0)+1;}}const tw=R.CQ_ITEM_ORDER.reduce((x,k)=>x+R.CQ_ITEMS[k].w,0);for(const k of R.CQ_ITEM_ORDER)near(w[k]/N,R.CQ_ITEMS[k].w/tw,.006);
console.log('PASS measured rates match the published table (200k rolls per check), consumable weights '+R.CQ_ITEM_ORDER.map(k=>k+' '+R.CQ_ITEMS[k].w+'%').join(', '));

// ---- 5. hard pity ----
{const t=fresh();let since=0,worst=0;for(let i=0;i<20000;i++){const o=L.roll(t,'elite','p'+i);if(o.pt){worst=Math.max(worst,since+1);since=0;}else since++;}assert(worst<=20,'never more than 20 elites per research part: '+worst);
 let cs=0,cw=0;const types=['ambush','shield','artillery','carrier','plasma'];for(let i=0;i<20000;i++){const o=L.roll(t,'commander','c'+i,{ring:3,commander:types[i%5]});if(o.tr){cw=Math.max(cw,cs+1);cs=0;}else cs++;}assert(cw<=10,'never more than 10 commanders per trophy: '+cw);
 const u=fresh();u.lseed=1;let forced=null;for(let i=0;i<5000&&!forced;i++){const o=L.roll(u,'commander','q'+i,{ring:3,commander:i%3?'carrier':'shield'});if(o.pity==='trophy')forced=o;else if(o.tr)u.inv.pity.cf={ambush:0,shield:0,artillery:0,carrier:0,plasma:0};}
 assert(forced&&forced.tr.carrier===1,'a pity trophy is the doctrine fought most');}
console.log('PASS hard pity: at most 20 elites per research part, 10 commanders per trophy (of the type fought most)');

// ---- 6. account-bound on pickup, caps, minerals as cargo, fragments -> pieces without repeats ----
s=fresh();const drop=(loot,x=1160,z=1100)=>{const f=L.face(loot);s.drops.push({id:'t:'+Math.random(),x,z,y:W.groundAt(x,z),amount:{cp:7,alloy:2,biomass:1,helium:0},expires:now+P.dropLife,loot,r:f.r,label:f.label});s.position=point(x,z);pickups(s,now);};
drop({mn:{il:1},it:{repair:2},pt:{coil:1},fr:{u:1},tr:{ambush:1}});
assert.equal(s.inv.it.repair,2);assert.equal(s.inv.pt.coil,1);assert.equal(s.inv.fr.u,1);assert.equal(s.inv.tr.ambush,1);assert.equal(s.ledger.mn.il,1,'minerals ride the cargo');assert.equal(s.notice.loot.it.repair,2);assert(s.inv.log.length===1);
s.ledger.mn.il=3;s.hp=0;death(s,now);assert.equal(s.ledger.mn.il,2,'carried minerals: half lost on death');assert.equal(s.inv.it.repair,2,'consumables are never lost on death');assert.equal(s.inv.tr.ambush,1,'trophies are never lost');
// parts: one EARNED part a day (owner, Nov 17), so the 50 cap is reached over days; the cap test sits at 49 (Session 6B finish: this
// line used to drop 60 parts at one moment, which the daily limit now turns into fragments)
const dropAt=(loot,t)=>{const x=1160,z=1100,f=L.face(loot);s.drops.push({id:'t:'+Math.random(),x,z,y:W.groundAt(x,z),amount:{cp:7,alloy:2,biomass:1,helium:0},expires:t+P.dropLife,loot,r:f.r,label:f.label});s.position=point(x,z);pickups(s,t);};
s=fresh();for(let i=0;i<15;i++)drop({it:{decoy:1}});assert.equal(s.inv.it.decoy,10,'consumables cap at 10');assert(s.notice.loot.full?.includes('decoy'));
s.inv.pt.servo=49;dropAt({pt:{servo:1}},now);assert.equal(s.inv.pt.servo,50);dropAt({pt:{servo:1}},now+864e5);assert.equal(s.inv.pt.servo,50,'parts cap at 50');assert(s.notice.loot.full?.includes('servo')&&s.inv.pd.n===0,'a part the cap turns away does not use up the day');
// ---- 6b. one earned research part a day per account; after it a found part is 1 fragment of its source's own pool (pity part too) ----
{s=fresh();const d0=Math.floor(now/864e5)*864e5,t0=d0+3600e3,fr=()=>({...s.inv.fr});
 dropAt({pt:{coil:1},src:'elite'},t0);assert(s.inv.pt.coil===1&&s.inv.pd.n===1&&s.inv.pd.d===d0/864e5,'the first part of the UTC day is taken');
 let f0=fr();dropAt({pt:{coil:1},src:'elite'},t0+60e3);assert(s.inv.pt.coil===1&&s.inv.fr.u===f0.u+1&&s.notice.loot.swap?.coil===1,'a second elite part the same day: 1 uncommon fragment instead');
 f0=fr();dropAt({pt:{thermal:1},src:'commander'},t0+120e3);assert(s.inv.pt.thermal===0&&s.inv.fr.r===f0.r+1,'a raid commander part past the limit: 1 rare fragment');
 f0=fr();dropAt({pt:{cap:1},src:'strike'},t0+180e3);assert(s.inv.pt.cap===0&&s.inv.fr.r===f0.r+1,'a Meteor Strike part past the limit: 1 rare fragment');
 s.inv.pity.e=19;let po=null;for(let i=0;i<400&&!po;i++){const o=L.roll(s,'elite','pity:'+i);if(o.pity==='part')po=o;else s.inv.pity.e=19;}
 f0=fr();assert(po&&po.src==='elite','the pity part still comes (20 elites) and knows its source');dropAt(po,t0+240e3);assert(s.inv.fr.u>=f0.u+1&&Object.values(s.inv.pt).reduce((a,b)=>a+b,0)===1,'a pity part past the limit is a fragment too');
 f0=fr();dropAt({pt:{servo:1},src:'elite'},d0+864e5-1);assert(s.inv.pt.servo===0&&s.inv.fr.u===f0.u+1,'23:59:59.999 UTC: still the same day');
 dropAt({pt:{servo:1},src:'elite'},d0+864e5);assert(s.inv.pt.servo===1&&s.inv.pd.n===1&&s.inv.pd.d===d0/864e5+1,'00:00 UTC: the count starts again');
 assert(!JSON.stringify(s.inv.log).match(/pts|points|"cp"/),'a swapped part pays no points');}
console.log('PASS one earned research part a day (UTC), the fragment swap by source (elite uncommon, commander and strike rare), pity kept, the cap');
s=fresh();const got=[];for(let i=0;i<5;i++){drop({fr:{c:10}});got.push(...(s.notice.loot.pieces||[]));}
assert.equal(new Set(got).size,5,'five pieces, no repeats');assert.deepEqual([...got].sort(),[...CAT.pools.c].sort(),'the common pool, complete');assert(got.every(id=>s.cosmetics.owned[id]?.source==='fragments'));
drop({fr:{c:25}});assert.equal(s.inv.fr.c,10,'a complete pool keeps its fragments at 10/10');assert(!s.notice.loot.pieces);
const eq=applyAction(s,{seq:s.seq+1,action:'equip-cosmetic',item:got[0]},now);assert.equal(eq.cosmetics.equipped.armor,got[0],'a fragment piece equips through the cosmetic system');
console.log('PASS account-bound on pickup (never lost on death), minerals stay cargo, caps 10 / 50, ten fragments = one piece without repeats, pieces equip');

// ---- 7. consumables through the Worker ----
const tick=(t,n,cmd={x:0,z:0})=>{for(let i=0;i<n;i++){t=applyCommands(t,{seq:t.seq+1,commands:Array(20).fill(cmd)},t.lastWall+1000);}return t;};
s=fresh();s.inv.it={repair:2,shield:1,scanner:1,decoy:1};s.position=point(1100,1060);s.hp=s.battle.playerHp=Math.round(s.battle.playerMax*.3);let t=refreshed(s);
function refreshed(x){x.seq=x.seq||0;return x;}
assert.throws(()=>applyAction(t,{seq:t.seq+1,action:'use-item',item:'medkit'},now),/invalid item/);
assert.throws(()=>applyAction(t,{seq:t.seq+1,action:'use-item',item:'repair',x:1},now),/invalid/);
t=applyAction(t,{seq:t.seq+1,action:'use-item',item:'repair'},now);assert.equal(t.inv.it.repair,1);assert.equal(t.notice.kind,'item-used');const hp0=t.hp;
assert.throws(()=>applyAction(t,{seq:t.seq+1,action:'use-item',item:'repair'},now+1000),/recharging/,'60 s cooldown');
t.lastWall=now;t=tick(t,7);assert(t.hp>=Math.min(t.battle.playerMax,hp0+t.battle.playerMax*.4)-2,'the kit mends 40% of the hull over 6 s ('+hp0+' -> '+t.hp+')');assert(!t.battle.mend,'the mend ends');
t.battle.shieldCd=12;t=applyAction(t,{seq:t.seq+1,action:'use-item',item:'shield'},t.lastWall+10);assert.equal(t.battle.shieldCd,0,'Shield Cell: SHIELD ready at once');assert.equal(t.inv.it.shield,0);
assert.throws(()=>applyAction(t,{seq:t.seq+1,action:'use-item',item:'shield'},t.lastWall+10),/no Shield Cell left/);
// the scanner charge finds every live vein of this sector
{const u=structuredClone(t);const sector=W.frontierSectorAt(u.position.x,u.position.z).id;for(const v of Object.values(u.lodes.slots))v.seen=0;u.scanAt=u.lastWall;
 const r=applyAction(u,{seq:u.seq+1,action:'use-item',item:'scanner'},u.lastWall+10);assert.equal(r.notice.kind,'scan');assert.equal(r.notice.charge,1);assert.equal(r.notice.radius,R.MN_SCAN.radius+100);
 const want=Object.entries(r.lodes.slots).filter(([id])=>id.split(':')[1]===sector);assert(want.length>0&&want.every(([,v])=>v.seen||v.left<=0),'every vein of '+sector+' revealed');}
// the decoy pulls Parasites within 120 m to the beacon (position only, no gear)
{let u=structuredClone(t);const foe=u.battle.enemies.find(e=>e.hp>0);Object.assign(foe,{x:u.position.x+60,z:u.position.z,y:W.groundAt(u.position.x+60,u.position.z),decision:0});
 u=applyAction(u,{seq:u.seq+1,action:'use-item',item:'decoy'},u.lastWall+10);assert(u.battle.decoy&&u.battle.decoy.t===8);u=tick(u,1,{x:0,z:1});const f=u.battle.enemies.find(e=>e.id===foe.id);
 assert(f.target&&Math.abs(f.target.x-u.battle.decoy.x)<1e-6&&Math.abs(f.target.z-u.battle.decoy.z)<1e-6,'a Parasite inside 120 m targets the beacon');u=tick(u,9);assert(!u.battle.decoy,'the beacon expires after 8 s');}
// never inside your town (the Home Sector)
{const u=structuredClone(t);u.base.tier=1;u.position=point(C.baseDefinition.x+4,C.baseDefinition.z+4);u.inv.it.decoy=1;u.inv.cd={};assert.throws(()=>applyAction(u,{seq:u.seq+1,action:'use-item',item:'decoy'},u.lastWall+10),/not inside your town/);}
console.log('PASS consumables via use-item: Repair Kit +40% over 6 s with a 60 s cooldown, Shield Cell, Scanner Charge (sector veins), Decoy Beacon (120 m, 8 s), never in town, counted and capped');

// ---- 8. completion receipts: raid chest, Meteor Strike, town defense ----
s=fresh();const raid=Object.values(C.operations).find(o=>o.raid&&o.danger==='HARD');s.mission=raid.id;s.attempt=7;let rc=missionReward(s,now);assert(rc.loot&&Object.values(rc.loot.it||{}).reduce((a,b)=>a+b,0)>=1,'the raid chest always holds a consumable');
assert.deepEqual(missionReward(s,now+1),rc,'the receipt of an attempt is stored: no second chest');
s=fresh();const M=C.meteorStrike(now);s.mission=M.site.id;s.strikeSlot=M.slot;s.strikes={[M.slot]:{roll:{tq:.9,se:.9,mh:.9}}};s.resonance=11;const sr=missionReward(s,now);assert.equal(sr.kind,'strike');assert.equal(s.inv.tr.core,1,'the 12th secured strike gives the Strike Core trophy');
s=fresh();s.base.tier=1;s.base.defense.active=true;s.attempt=3;let hits=0;for(let i=0;i<400;i++){const u=structuredClone(s);u.attempt=i;defenseOutcome(u,'victory',now);if(u.base.defense.report.loot)hits++;}assert(hits>10&&hits<80,'defense rolls ~10% for something: '+hits+'/400');
console.log('PASS receipts: raid chest (stored per attempt), Strike Core at every 12th strike, town defense rolls');

// ---- 9. Town Score and the Hive emblem ----
s=fresh();s.base.tier=1;s.plot=PL.newPlot('ridge',now);refreshState(s,now);const p0=s.plot.power;s.inv.tr.ambush=3;s.inv.tr.core=1;refreshState(s,now);assert.equal(s.plot.power,p0+30,'+15 Town Score per trophy TYPE (duplicates add none)');
s.position=point(C.baseDefinition.x,C.baseDefinition.z);
assert.throws(()=>applyAction(s,{seq:s.seq+1,action:'plot-banner',plot:{shape:'shield',colors:['#112233','#445566'],emblem:'hive'}},now),/Trophy Hall set/);
for(const k of R.CQ_TROPHY_ORDER)s.inv.tr[k]=1;const hb=applyAction(s,{seq:s.seq+1,action:'plot-banner',plot:{shape:'shield',colors:['#112233','#445566'],emblem:'hive'}},now);assert.equal(hb.plot.banner.emblem,'hive');
console.log('PASS trophies: +15 Town Score per type held, the Hive banner emblem only with the full set');

// ---- 10. the wiki publishes the same table ----
{const wiki=fs.readFileSync(new URL('../../wiki.html',import.meta.url),'utf8'),sec=wiki.slice(wiki.indexOf('<section id="loot">'),wiki.indexOf('<section id="garage">'));assert(sec.length>500,'wiki Loot section');
 const want=['12% 1 Ferrite','3% 1 Ilmenite','4% a consumable','0.5% a common fragment','25% 1 Ilmenite','6% 1 Armalcolite','8% a consumable','3% a research part','1% an uncommon fragment','20 of them without a research part','12% a research part',"10% that commander's trophy",'5% a rare fragment','8% 1 Tranquillityite','10 commanders without a trophy','always 1 consumable','8% a rare fragment','15% a research part','10% a rare fragment','every 12th strike','6% two consumables','4% an uncommon fragment','1 Armalcolite + 1 rare fragment',
  ...R.CQ_ITEM_ORDER.map(k=>R.CQ_ITEMS[k].n+' '+R.CQ_ITEMS[k].w+'%'),'+40% hull over 6 seconds','120 m','8 seconds','up to 50 of each','+15 Town Score'];
 want.push('always 2 Tranquillityite','20% 1 Selenite','2% 1 Moonheart','30% the Hive Titan trophy','10% 1 epic fragment','5 Titans without a Selenite');   // Session 7C: the Hive Titan's row
 for(const w of want)assert(sec.includes(w),'wiki Loot section says: '+w);
 // the in-game table reads the same rules
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../../js/rules.js',import.meta.url),'utf8'),ctx);vm.runInContext(fs.readFileSync(new URL('../../js/conquest/loot.js',import.meta.url),'utf8'),ctx);
 const rows=vm.runInContext('ConquestLoot.table()',ctx);assert(rows.some(r=>r.label.startsWith('Hive Titan')&&r.t.includes('always 2 Tranquillityite')&&r.t.includes('20% 1 Selenite')&&r.t.includes('5 Titans without a Selenite')),'the LOOT screen publishes the Titan row');assert(rows.length>=7&&rows.some(r=>r.t.includes('0.5% 1 common fragment'))&&rows.some(r=>r.t.includes('8% 1 Tranquillityite (VETERAN)')),JSON.stringify(rows));
 // Session 6B finish (owner, Nov 17): one earned research part a day, the fragment swap: the LOOT screen and the wiki say the same words, built from the rules
 const lim=vm.runInContext('ConquestLoot.limitText()',ctx);assert(R.CQ_PART_DAY===1&&JSON.stringify(R.CQ_PART_SWAP)===JSON.stringify({elite:'u',commander:'r',strike:'r'}),'one part a day; elite -> uncommon, commander and strike -> rare');
 assert(lim.startsWith('One research part found by play a day per account')&&lim.includes('uncommon from sentinels')&&lim.includes('rare from raid commanders')&&lim.includes('rare from Meteor Strikes')&&lim.includes('never pay points')&&lim.includes('Lunar Pass are not limited'),lim);
 assert(rows.some(r=>r.label==='Research parts'&&r.t===lim),'the LOOT screen publishes the daily limit');assert(sec.includes(lim),'the wiki Loot section publishes the same daily limit: '+lim);
 assert.equal(vm.runInContext("JSON.stringify(ConquestLoot.lines({mn:{fe:1},it:{repair:2},tr:{ambush:1}}).map(l=>l.t))",ctx),JSON.stringify(['TROPHY · AMBUSH COMMANDER','REPAIR KIT ×2','+1 FERRITE (CARRIED)']),'rarest first');}
console.log('PASS the wiki Loot section and the in-game LOOT screen publish the same rates and pity counters as js/rules.js');
