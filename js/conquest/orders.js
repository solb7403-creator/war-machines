/* Session 6 War Orders on the phone (spec §6.1; the pool in js/rules.js CQ_ORDERS). Presentation only: the Worker draws the orders,
   counts progress from verified events and pays the claim (worker/src/conquest-orders.js). This file reads s.wo and draws:
   the NEXT chip's last fallback (js/conquest/guide.js boardOrder), the hub card, the HUD line and the claim rows. */
(function(root){
'use strict';
const fmt=n=>Math.round(Number(n)||0).toLocaleString('en-US');
const pool=()=>typeof CQ_ORDERS!=='undefined'?CQ_ORDERS:{pool:[],weekly:[],claimR:30};
const def=id=>{const O=pool();return [...O.pool,...O.weekly].find(d=>d.id===id)||null;};
const list=s=>Array.isArray(s?.wo?.list)?s.wo.list:s?.wo?.list&&typeof s.wo.list==='object'?Object.values(s.wo.list):[];
const daily=s=>list(s).filter(o=>o.kind==='daily'),weekly=s=>list(s).find(o=>o.kind==='weekly')||null;
const claimable=s=>list(s).filter(o=>o.done&&!o.claimed);
const line=o=>{const d=def(o.id);return d?d.t+' · '+(o.claimed?'CLAIMED':o.done?'READY TO CLAIM':Math.min(o.n|0,d.goal)+'/'+d.goal):o.id;};
const reward=o=>{const d=def(o.id);return d?'+'+fmt(d.cp)+' CP'+(o.kind==='weekly'?' + ARMALCOLITE + RARE FRAGMENT':' + CONSUMABLE'):'';};
// the HUD line (progressive: after the first order is complete, s.wo.seen): "WAR ORDERS 1/3 · 1 TO CLAIM"
function hud(s){const d=daily(s);if(!d.length)return '';const done=d.filter(o=>o.done).length,c=claimable(s).length,next=d.find(o=>!o.done);
 return 'WAR ORDERS '+done+'/'+d.length+(c?' · '+c+' TO CLAIM AT THE REFUGE':next?' · '+line(next).toUpperCase():' · ALL DONE TODAY');}
const nearest=(items,p)=>items.filter(Boolean).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;
// The NEXT chip once the first hour's board is done: a ready order sends the pilot to the Refuge to claim it; otherwise the
// first unfinished order points at the activity that advances it.
function next(s,p,opts={}){const C=root.ConquestCombat;if(!s||!C||!p)return null;const R=C.refuge,G=C.baseDefinition,ready=claimable(s)[0];
 if(ready){const d=def(ready.id);return {kind:'order',x:R.x,z:R.z,radius:pool().claimR,name:'CLAIM WAR ORDER',reward:reward(ready),line:(d?.t||ready.id)+' · REFUGE TERMINAL'};}
 const o=daily(s).find(x=>!x.done)||(weekly(s)&&!weekly(s).done?weekly(s):null);if(!o)return null;const d=def(o.id);if(!d)return null;
 const ops=Object.values(C.operations),done=s.completed||{};let at=null;
 if(d.ev==='raid')at=nearest(ops.filter(x=>x.raid&&(!C.raidsUnlocked||C.raidsUnlocked(done))),p);
 else if(d.ev==='strike'){const M=C.meteorStrike?.(Date.now());at=M&&M.phase!=='idle'?M.site:null;}
 else if(d.ev==='drill'||d.ev==='hold')at=(s.base?.tier|0)>0?{x:G.x,z:G.z}:null;
 else if(d.ev==='bankAlloy')at={x:R.x,z:R.z};
 else if(d.ev==='mine'){const W=root.ConquestWorld,v=s.veins||{};at=nearest(Object.entries(v).filter(([,x])=>x.left>0).map(([id])=>W?.deposits?.find(q=>q.id===id)).filter(Boolean),p);}
 else if(d.ev==='kill'){const B=opts.battle;at=B?nearest(B.enemies.filter(e=>e.hp>0&&!e.resident),p):null;}
 if(!at)at=nearest(C.fieldMissionIds.map(id=>C.operations[id]).filter(x=>d.ev!=='fieldSector'||!(o.secs||[]).includes(x.sector||root.ConquestWorld.frontierSectorAt(x.x,x.z).id)),p);
 if(!at)return null;return {kind:'order',x:at.x,z:at.z,radius:at.activationRadius||(at.radius|0)||40,name:'WAR ORDER · '+d.t.toUpperCase(),reward:reward(o),line:Math.min(o.n|0,d.goal)+'/'+d.goal+(o.kind==='weekly'?' · WEEKLY':'')};}
// Claim rows for a dialog at the Refuge terminal or the Command Gate. el/button are app.js helpers; claim(id) -> Promise<bool>.
function claimRows(d,s,{el,button,claim}){const ready=claimable(s);if(!ready.length)return 0;const box=el('section','cq-orders-claim',null,d);el('h3','','WAR ORDERS READY',box);
 for(const o of ready){const row=el('div','cq-loot-row',null,box);el('b','',def(o.id)?.t||o.id,row);el('small','',reward(o)+(o.kind==='daily'&&(s.wo.dc|0)===2?' · THIRD TODAY: + UNCOMMON FRAGMENT':''),row);const b=button('CLAIM',()=>{b.disabled=true;claim(o.id);},'cq-loot-use');row.append(b);}
 return ready.length;}
// The hub card: today's three, this week's one, the claim place.
function card(c,s,{el}){const d=daily(s),w=weekly(s);if(!d.length&&!w){el('small','','Your War Orders arrive with your first Conquest session today.',c);return;}
 for(const o of d){const x=el('p','cq-hub-order'+(o.claimed?' cq-hub-order-done':o.done?' cq-hub-order-ready':''),(o.claimed?'✓ ':o.done?'★ ':'○ ')+line(o),c);x.title=reward(o);}
 if(w)el('p','cq-hub-order cq-hub-order-week'+(w.claimed?' cq-hub-order-done':w.done?' cq-hub-order-ready':''),'WEEKLY · '+line(w),c);
 el('small','','Claim at the Refuge terminal or your Command Gate · '+(d.filter(o=>o.claimed).length)+'/'+d.length+' claimed today · new orders at 00:00 UTC',c);}
root.ConquestOrders=Object.freeze({next,hud,card,claimRows,claimable,daily,weekly,def,line,reward});
})(globalThis);
