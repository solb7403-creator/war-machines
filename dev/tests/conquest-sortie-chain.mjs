// Owner fix (Nov 16, 2026): the Sortie chain pays a bonus consumable, not CP. A win with k earlier wins in the chain (max 3)
// has a k x 10% chance of ONE consumable from the four CQ_ITEMS, rolled on the Worker from the seeded loot roll (a retry cannot
// re-roll it), bound within the item cap, pity counters untouched, on every win that adds a chain link (field missions, raids,
// Meteor Strikes, base and sector defenses). Nothing else: no CP, salvage, minerals, research parts, trophies, fragments or points.
import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const WARH=await import('./lib/war-helpers.mjs'),{CONQUEST:CQ}=await import('../../worker/src/sim.gen.js');
const {CONQUEST:{Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState}=await import('../../worker/src/conquest-sim.js');
const {POLICY:P,missionReward}=await import('../../worker/src/conquest-economy.js');
const {defenseOutcome,sectorDefenseOutcome}=await import('../../worker/src/conquest-campaign.js');
const Lv=await import('../../worker/src/conquest-living.js');
const L=C.LIVING.chain,now=40*P.day+9*3600000,fresh=()=>createState(R.STOCK_L,now);
const clone=x=>structuredClone(x),sum=o=>Object.values(o||{}).reduce((a,b)=>a+(b|0),0);

// ---- 1. the numbers ----
assert.equal(L.per,0,'the chain adds 0% CP and salvage a link');
assert.equal(L.item,.10,'10% a link bonus consumable');assert.equal(L.max,3,'three links');assert.equal(L.windowMs,600000,'10-minute window');
assert.deepEqual([0,1,2,3,4].map(k=>+Lv.chainChance(k).toFixed(10)),[0,.1,.2,.3,.3],'chance 0 / 10 / 20 / 30% (held at three links)');
assert.deepEqual([0,1,2,3].map(Lv.chainBonus),[0,0,0,0],'chainBonus pays nothing');
console.log('PASS numbers: 0% CP and salvage a link, bonus item 10/20/30%, three links, 10-minute window');

// ---- 2. the five win types: a 3-link win against the same win with no chain ----
const wins={
 field:s=>{s.mission=C.fieldMissionIds[0];s.attempt=7;return missionReward(s,now);},
 raid:s=>{s.mission=C.raidIds[0];s.attempt=7;return missionReward(s,now);},
 strike:s=>{const M=C.meteorStrike(now);s.mission=M.site.id;s.strikeSlot=M.slot;s.strikes={[M.slot]:{roll:{tq:.9,se:.9,mh:.9}}};s.resonance=3;return missionReward(s,now);},
 base:s=>{s.base.tier=1;s.base.defense.active=true;s.attempt=7;defenseOutcome(s,'victory',now);return s.base.defense.report;},
 sector:s=>{const sector=C.sectors[0].id;s.territory[sector]={owner:'humanity',status:'contested'};const e=WARH.warEvent(CQ,s,sector,now);s.attempt=7;e.tr=7;s.sectorDefense={active:true,sector,territory:sector,ev:e.id,kind:'a',attempt:7};return sectorDefenseOutcome(s,'victory',now);}};   // Session 7: a sector defense is fought against a pending war assault (the war clock)
const items={};let granted=0;
for(const [kind,win] of Object.entries(wins)){let hits=0;
 for(let seed=1;seed<=300;seed++){const s0=fresh();s0.lseed=seed*104729;s0.inv.pity={e:7,c:4,cf:{...s0.inv.pity.cf,[R.CQ_TROPHY_ORDER[0]]:2}};
  const a=clone(s0),b=clone(s0);delete a.chain;b.chain={n:3,at:now-60000};const ra=win(a),rb=win(b);
  assert(!ra.chain,kind+': no chain, no chain record');assert.equal(rb.chain.links,3,kind+': three links found');assert.equal(+rb.chain.chance.toFixed(10),.3,kind+': 30% at three links');assert.equal(rb.chain.bonus,0,kind+': bonus 0');
  for(const k of ['cp','alloy','biomass','helium','ptsRaw'])assert.equal(rb[k],ra[k],kind+': receipt '+k+' identical');
  assert.deepEqual(rb.mn,ra.mn,kind+': receipt minerals identical');
  assert.deepEqual(b.ledger,a.ledger,kind+': CP, cargo, banked materials and minerals identical');
  assert.deepEqual(b.airdrop,a.airdrop,kind+': airdrop points identical');assert.deepEqual(b.daily,a.daily,kind+': daily counters identical');
  assert.deepEqual(b.inv.pt,a.inv.pt,kind+': research parts identical');assert.deepEqual(b.inv.tr,a.inv.tr,kind+': trophies identical');
  assert.deepEqual(b.inv.pity,a.inv.pity,kind+': pity counters identical');assert.deepEqual(b.inv.pity,s0.inv.pity,kind+': pity counters untouched');
  // the raid chest keeps its rarity step at three links (a rare fragment becomes epic): the fragment COUNT is identical
  if(kind==='raid')assert.equal(sum(b.inv.fr),sum(a.inv.fr),'raid: same number of fragments (the chest steps rarity, not count)');else assert.deepEqual(b.inv.fr,a.inv.fr,kind+': fragments identical');
  if(kind!=='raid')assert.deepEqual(b.cosmetics,a.cosmetics,kind+': cosmetics identical');
  const extra=R.CQ_ITEM_ORDER.map(k=>(b.inv.it[k]|0)-(a.inv.it[k]|0));
  if(rb.chain.item){hits++;granted++;items[rb.chain.item]=(items[rb.chain.item]||0)+1;assert.deepEqual(extra,R.CQ_ITEM_ORDER.map(k=>k===rb.chain.item?1:0),kind+': exactly one bonus consumable');}
  else assert.deepEqual(extra,[0,0,0,0],kind+': no item, nothing else');}
 assert(hits>=60&&hits<=120,kind+': ~30% of 300 three-link wins give an item: '+hits);}
assert.deepEqual(Object.keys(items).sort(),[...R.CQ_ITEM_ORDER].sort(),'all four consumables can come from the chain');
console.log('PASS 3-link chain on field / raid / strike / base defense / sector defense: no extra CP, materials, minerals, parts, trophies, fragments or points; pity untouched; one consumable or nothing ('+granted+'/1500)');

// ---- 3. the chance is 10 / 20 / 30% (direct roll over many pilot seeds) ----
for(const k of [1,2,3]){const N=6000;let n=0;for(let i=0;i<N;i++){const s={lseed:i*2654435761>>>0};if(Lv.chainItem(s,'op:test:'+i,k,now).item)n++;}
 const f=n/N;assert(Math.abs(f-k*.1)<.02,k+' links: '+(f*100).toFixed(1)+'% (expected '+k*10+'%)');console.log('PASS '+k+' link'+(k>1?'s':'')+': '+(f*100).toFixed(1)+'% bonus item ('+k*10+'% expected)');}
{const s={lseed:5};assert(!Lv.chainItem(s,'op:x:1',0,now).item&&!s.inv?.it?.repair,'no links, no roll');}

// ---- 4. a retry cannot re-roll it ----
{let s=null,seed=0;for(;seed<500;seed++){const t=fresh();t.lseed=seed;t.chain={n:2,at:now-1000};const u=clone(t);const r=wins.field(u);if(r.chain.item){s=t;break;}}
 assert(s,'a seed with a bonus item');const first=wins.field(clone(s)).chain.item;
 for(let i=0;i<5;i++)assert.equal(wins.field(clone(s)).chain.item,first,'the same win replayed gives the same item');
 const later=clone(s);later.mission=C.fieldMissionIds[0];later.attempt=7;assert.equal(missionReward(later,now+5000).chain.item,first,'a later clock gives the same answer (keyed by the win, not the time)');
 const once=clone(s),r1=wins.field(once),it1={...once.inv.it};once.chain={n:3,at:now};const r2=missionReward(once,now+1000);
 assert.equal(r2.kind,'cooldown','a re-sent completion is refused');assert.deepEqual(once.inv.it,it1,'and pays no second item');assert(r1.chain.item);
 const rs=fresh();rs.lseed=seed;rs.chain={n:3,at:now-1000};const rr=wins.raid(rs),itr={...rs.inv.it};const again=missionReward(rs,now+2000);
 assert.equal(again,rr,'a raid retry returns the stored receipt');assert.deepEqual(rs.inv.it,itr,'and pays nothing again');}
console.log('PASS retry: the same win always gives the same answer; a re-sent completion pays no second item');

// ---- 5. the cap: a full slot is reported, nothing else is paid ----
{for(let seed=0;seed<500;seed++){const s=fresh();s.lseed=seed;const r=Lv.chainItem(clone(s),'op:cap:1',3,now);if(!r.item)continue;s.inv.it[r.item]=R.CQ_ITEM_MAX;const pt={...s.inv.pt},fr={...s.inv.fr},tr={...s.inv.tr},cp=s.ledger.cp;
  const q=Lv.chainItem(s,'op:cap:1',3,now);assert.equal(q.item,r.item);assert.equal(q.full,true,'full slot reported');assert.equal(s.inv.it[r.item],R.CQ_ITEM_MAX,'never above the cap');
  assert.deepEqual([s.inv.pt,s.inv.fr,s.inv.tr,s.ledger.cp],[pt,fr,tr,cp],'nothing paid in its place');break;}}
console.log('PASS cap: a full consumable slot stays at '+R.CQ_ITEM_MAX+' and nothing is paid in its place');
console.log('conquest sortie chain: PASS');
