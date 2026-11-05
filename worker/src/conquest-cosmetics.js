// Runs only inside authenticated per-pilot CAS. No purchase/receipt assertion is accepted here.
import {CONQUEST} from './sim.gen.js';
const C=CONQUEST.Catalog,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),map=o=>o&&typeof o==='object'&&!Array.isArray(o);
export const COSMETIC_ACTIONS=['equip-cosmetic','unequip-cosmetic'];
export function cosmetics(s,now){
 const c=s.cosmetics=map(s.cosmetics)?s.cosmetics:{v:1};c.v=1;c.owned=map(c.owned)?c.owned:{};c.equipped=map(c.equipped)?c.equipped:{};
 for(const i of C.items)if(!own(c.owned,i.id)&&C.eligible(i,s))c.owned[i.id]={at:now,source:'earned',milestone:i.earnText};
 for(const [slot,id] of Object.entries(c.equipped))if(!C.slots.includes(slot)||!own(C.byId,id)||C.byId[id].slot!==slot||!own(c.owned,id))delete c.equipped[slot];
 return c;
}
export function cosmeticAction(s,r,now){
 if(!r||!COSMETIC_ACTIONS.includes(r.action))throw Error('conquest: cosmetic checkout disabled or invalid action');
 const keys=r.action==='equip-cosmetic'?['seq','action','item']:['seq','action','slot'];if(Object.keys(r).some(k=>!keys.includes(k)))throw Error('conquest: invalid cosmetic fields');
 const c=cosmetics(s,now);
 if(r.action==='equip-cosmetic'){
  if(typeof r.item!=='string'||!own(C.byId,r.item))throw Error('conquest: unknown cosmetic');
  if(!own(c.owned,r.item))throw Error('conquest: cosmetic must be earned or owned');
  c.equipped[C.byId[r.item].slot]=r.item;s.notice={kind:'cosmetic-equipped',item:r.item};
 }else{
  if(!C.slots.includes(r.slot))throw Error('conquest: invalid cosmetic slot');delete c.equipped[r.slot];s.notice={kind:'cosmetic-unequipped',slot:r.slot};
 }
 return c;
}
