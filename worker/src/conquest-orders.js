// Session 6 War Orders (docs/conquest/audit/CONQUEST_1_0_SPEC.md §6.1; the pool in js/rules.js CQ_ORDERS). The contracts board,
// stored as War Orders with a source so the living war can post orders later (blueprint §5). Server-only: the draw uses the
// pilot's server seed (s.lseed) and the UTC day / week; progress comes only from verified reducer events; a claim pays CP and
// LOOT.order (consumable, fragments, the weekly's Armalcolite through the outbox), never airdrop points.
// s.wo = {v:1, day, week, list:[{id, src:'board', kind:'daily'|'weekly', n, goal, done, claimed, parts?, secs?}], dc, seen}
import {CONQUEST,RULES as R} from './sim.gen.js';
import {u32,roll,bind} from './conquest-loot.js';
import {bankMinerals} from './conquest-airdrop.js';
const C=CONQUEST.Combat,DAY=86400000,O=R.CQ_ORDERS,fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
export const ORDER_ACTIONS=['claim-order'];
export const weekOf=now=>Math.floor((now-4*DAY)/(7*DAY));   // weeks start Monday 00:00 UTC (worker/src/db.js weekOf)
const DEF=Object.fromEntries([...O.pool,...O.weekly].map(d=>[d.id,d]));
function eligible(s,d){return !d.elig||(d.elig==='raids'?C.raidsUnlocked(s.completed||{}):d.elig==='town'?(s.base?.tier|0)>0:d.elig==='striker'?(s.resonance|0)>0:false);}
function draw(s,pool,n,key){return pool.filter(d=>eligible(s,d)).map(d=>({d,k:u32(s.lseed+':'+key+':'+d.id)})).sort((a,b)=>a.k-b.k).slice(0,n).map(x=>x.d);}
const make=(d,kind)=>({id:d.id,src:'board',kind,n:0,goal:d.goal,done:0,claimed:0,...(d.parts?{parts:Object.fromEntries(Object.keys(d.parts).map(k=>[k,0]))}:{})});
// Refresh (every request): the day's three and the week's one, drawn when the UTC day / week turns.
export function orders(s,now){const day=Math.floor(now/DAY),week=weekOf(now),w=record(s.wo)?s.wo:(s.wo={v:1});w.v=1;w.list=list(w.list).filter(o=>DEF[o.id]);w.seen=w.seen?1:0;
 if(w.day!==day){w.day=day;w.dc=0;w.list=[...w.list.filter(o=>o.kind==='weekly'),...draw(s,O.pool,O.daily,'wo:d:'+day).map(d=>make(d,'daily'))];}
 if(w.week!==week){w.week=week;w.list=[...w.list.filter(o=>o.kind==='daily'),...draw(s,O.weekly,1,'wo:w:'+week).map(d=>make(d,'weekly'))];}
 for(const o of w.list){if(o.parts&&!record(o.parts))o.parts={};if(o.secs&&!Array.isArray(o.secs))o.secs=list(o.secs);}
 w.dc=w.dc|0;return w;}
// A verified event. ev: raid | bankAlloy | mine | drill | strike | kill | fieldSector | op | defense; n: amount; sector for fieldSector.
export function orderEvent(s,ev,n=1,{sector=null}={}){const w=s.wo;if(!record(w)||!Array.isArray(w.list))return;
 for(const o of w.list){if(o.claimed||o.done)continue;const d=DEF[o.id];if(!d)continue;
  if(d.ev==='hold'){if(ev==='drill'||ev==='defense'){o.parts=o.parts||{};o.parts[ev]=Math.min(d.parts[ev],(o.parts[ev]|0)+n);o.n=Object.keys(d.parts).reduce((a,k)=>a+Math.min(d.parts[k],o.parts[k]|0),0);}}
  else if(d.ev==='fieldSector'){if(ev==='fieldSector'&&sector){o.secs=Array.isArray(o.secs)?o.secs:[];if(!o.secs.includes(sector))o.secs.push(sector);o.n=Math.min(d.goal,o.secs.length);}}
  else if(d.ev===ev)o.n=Math.min(d.goal,(o.n|0)+Math.max(0,Math.floor(n)));
  if(o.n>=d.goal){o.done=1;w.seen=1;}}}
// Claim at the Refuge terminal (within CQ_ORDERS.claimR) or the Command Gate (with a town): CP + LOOT.order, account-bound.
export function claimOrder(s,request,now){const id=request.order;if(Object.keys(request).some(k=>!['seq','action','order'].includes(k))||typeof id!=='string')fail('invalid order');
 const w=s.wo,o=record(w)&&Array.isArray(w.list)?w.list.find(x=>x.id===id):null,d=DEF[id];if(!o||!d)fail('no such War Order today');if(o.claimed)fail('already claimed');if(!o.done)fail('War Order not complete: '+(o.n|0)+'/'+d.goal);
 const G=C.baseDefinition,T=C.refuge,p=s.position;if(s.mission||s.hp<=0)fail('finish the operation first');
 if(!(Math.hypot(p.x-T.x,p.z-T.z)<=O.claimR||(s.base?.tier|0)>0&&Math.hypot(p.x-G.x,p.z-G.z)<=G.radius))fail('claim War Orders at the Refuge terminal or your Command Gate');
 o.claimed=1;s.ledger.cp+=d.cp;const L=R.LOOT.order,found={};
 if(o.kind==='weekly'){const r=bind(s,{fr:{[L.weekly.frag]:1}},now,{where:'war order'});Object.assign(found,r);const mn=bankMinerals(s,L.weekly.mn);if(Object.keys(mn).length)found.mn=mn;}   // the weekly's Armalcolite goes straight to the wallet (outbox)
 else{w.dc=(w.dc|0)+1;const it=roll(s,'chest','order:'+w.day+':'+id).it||{};   // one consumable, picked with the chest's published weights
  const third=w.dc===3?{fr:{[L.third.frag]:1}}:{};const k=Object.keys(it)[0];Object.assign(found,bind(s,{it:k?{[k]:1}:{},...third},now,{where:'war order'}));}
 s.notice={kind:'order-claimed',id,cp:d.cp,loot:found,third:o.kind==='daily'&&w.dc===3?1:0};return o;}
