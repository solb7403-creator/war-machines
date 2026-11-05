import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {cosmetics,cosmeticAction}=await import('../../worker/src/conquest-cosmetics.js');
const now=1800000000000,s={base:{tier:0,defense:{wins:0}},raidProgress:{clears:0,shards:0},reputation:0,campaignScore:0};
cosmetics(s,now);assert.equal(Object.keys(s.cosmetics.owned).length,0);
assert.throws(()=>cosmeticAction(s,{action:'equip-cosmetic',item:'base-bastion'},now),/earned|owned/);
assert.throws(()=>cosmeticAction(s,{action:'equip-cosmetic',item:'base-bastion',paid:true},now),/fields/);
assert.throws(()=>cosmeticAction(s,{action:'purchase-cosmetic',item:'base-bastion'},now),/disabled|action/);
s.base.tier=1;cosmetics(s,now);assert(s.cosmetics.owned['base-bastion']);
cosmeticAction(s,{action:'equip-cosmetic',item:'base-bastion'},now);assert.equal(s.cosmetics.equipped.base,'base-bastion');
const claimAt=s.cosmetics.owned['base-bastion'].at;cosmetics(s,now+1);assert.equal(s.cosmetics.owned['base-bastion'].at,claimAt);
const reconnected=JSON.parse(JSON.stringify(s));cosmetics(reconnected,now+2);assert.equal(reconnected.cosmetics.equipped.base,'base-bastion');
cosmeticAction(reconnected,{action:'unequip-cosmetic',slot:'base'},now+3);assert.equal(reconnected.cosmetics.equipped.base,undefined);assert(reconnected.cosmetics.owned['base-bastion']);
assert.throws(()=>cosmeticAction(s,{action:'equip-cosmetic',item:'__proto__'},now),/unknown/);
assert.throws(()=>cosmeticAction(s,{action:'unequip-cosmetic',slot:'toString'},now),/slot/);
const rich={base:{tier:5,defense:{wins:3}},raidProgress:{clears:25,shards:25,blueprint:true,eliteBlueprint:true},reputation:8000,campaignScore:1000,cosmetics:{v:1}};cosmetics(rich,now);assert.equal(Object.keys(rich.cosmetics.owned).length,20);
for(const [slot,id] of Object.entries({base:'base-monolith',trail:'fire-twin',armor:'armor-obsidian',commander:'command-parasite'})){cosmeticAction(rich,{action:'equip-cosmetic',item:id},now);assert.equal(rich.cosmetics.equipped[slot],id);}
// Entitlement maps omitted by Firebase rehydrate; existing canonical gear/currency remains byte-identical.
const legacy={base:{tier:3},ledger:{cp:123,banked:{alloy:77}},loadout:{skin:'lunar',weapon:'moonbeam'},cosmetics:{v:1}},before=JSON.stringify({ledger:legacy.ledger,loadout:legacy.loadout});cosmetics(legacy,now);assert(legacy.cosmetics.owned['base-cathedral']);assert.equal(JSON.stringify({ledger:legacy.ledger,loadout:legacy.loadout}),before);
console.log('PASS server-earned permanent entitlement, strict equip/unequip, blocked paid assertions, reconnect, Firebase omissions, preserved gear/currency and all twenty earned paths');
