// Additive per-pilot campaign ledger. Called inside the existing ETag/CAS transaction.
import {CONQUEST} from './sim.gen.js';
const D=CONQUEST.Combat.baseDefinition,DAY=86400000;
export const BASE_ACTIONS=['build-base','upgrade-base','base-module','base-claim'];
export function campaign(s,now){
 s.campaignVersion=1;s.territory=s.territory||{};s.reputation=Math.max(0,Number.isSafeInteger(s.reputation)?s.reputation:0);s.achievements=s.achievements||{};
 s.base=s.base||{tier:0,modules:{},builtAt:0,claimedAt:0};
 if(s.base.pending&&now>=s.base.pending.readyAt){const p=s.base.pending;s.base.modules[p.module]=p.tier;delete s.base.pending;}
}
export function production(s){const b=s.base;return b.tier?Math.min(800,40*b.tier+35*(b.modules.reactor||0)+Math.floor(Math.sqrt(s.reputation||0))*3)*(1+.1*(b.modules.uplink||0)):0;}
function debit(s,price){for(const [k,n] of Object.entries(price)){if(!Number.isSafeInteger(n)||n<0)throw Error('conquest: invalid recipe');if((k==='cp'?s.ledger.cp:s.ledger.banked[k])<n)throw Error('conquest: insufficient banked '+k+': need '+n);}for(const [k,n] of Object.entries(price))if(k==='cp')s.ledger.cp-=n;else s.ledger.banked[k]-=n;}
export function baseAction(s,r,now){
 campaign(s,now);if(s.mission||s.hp<=0||Math.hypot(s.position.x-D.x,s.position.z-D.z)>D.radius)throw Error('conquest: approach physical Command Base terminal');
 if(s.battle.enemies.some(e=>e.hp>0&&Math.hypot(e.x-s.position.x,e.z-s.position.z)<65))throw Error('conquest: secure base perimeter');
 const b=s.base;
 if(r.action==='build-base'){if(b.tier)throw Error('conquest: base already built');debit(s,D.recipe);b.tier=1;b.builtAt=now;b.claimedAt=now;s.achievements['first-command']=now;}
 else if(!b.tier)throw Error('conquest: build base first');
 else if(r.action==='upgrade-base'){if(b.tier>=D.maxTier)throw Error('conquest: maximum base tier');debit(s,D.tiers[b.tier]);b.tier++;}
 else if(r.action==='base-module'){if(!Object.prototype.hasOwnProperty.call(D.modules,r.module))throw Error('conquest: invalid module');const tier=b.modules[r.module]||0;if(b.pending||tier>=Math.min(3,b.tier))throw Error('conquest: module busy or tier locked');debit(s,D.moduleCosts[tier]);b.pending={module:r.module,tier:tier+1,readyAt:now+D.buildSeconds[tier]*1000};}
 else if(r.action==='base-claim'){if(now-b.claimedAt<DAY)throw Error('conquest: production available once per 24 hours');const cp=Math.floor(production(s));s.ledger.cp+=cp;b.claimedAt=now;s.notice={kind:'base-production',cp};return;}
 s.notice={kind:'base-updated'};
}
export function capture(s,site,now){campaign(s,now);s.territory[site]={owner:'humanity',capturedAt:s.territory[site]?.capturedAt||now};s.achievements['secured-'+site]=s.achievements['secured-'+site]||now;}
