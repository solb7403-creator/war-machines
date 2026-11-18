/* Session 6 loot v1, the phone's side: words, colours and the LOOT screen (Trophy Hall, research parts, fragments, pity).
   Presentation only. Every roll, count, cap and cooldown is the Worker's (worker/src/conquest-loot.js); this file only reads the
   state the Worker sent and the published tables in js/rules.js (LOOT, CQ_ITEMS, CQ_PARTS, CQ_FRAG, CQ_TROPHY). */
(function(root){
'use strict';
const COLORS=Object.freeze(['#c9d2dc','#5fe08a','#46d9ff','#c18cff','#ffc94a']);   // common .. legendary (ConquestFeel.RARITY_COLORS)
// rules.js top-level consts live in the shared global scope (not on window): read them with typeof
const G={get LOOT(){return typeof LOOT!=='undefined'?LOOT:null;},get ITEMS(){return typeof CQ_ITEMS!=='undefined'?CQ_ITEMS:{};},get PARTS(){return typeof CQ_PARTS!=='undefined'?CQ_PARTS:{};},get FRAG(){return typeof CQ_FRAG!=='undefined'?CQ_FRAG:{pools:{},order:[],need:10};},get TROPHY(){return typeof CQ_TROPHY!=='undefined'?CQ_TROPHY:{};},get MN(){return typeof MINERALS!=='undefined'?MINERALS:{};},get MNR(){return typeof CQ_MN_RARITY!=='undefined'?CQ_MN_RARITY:{};},get ORDER(){return typeof CQ_ITEM_ORDER!=='undefined'?CQ_ITEM_ORDER:[];},get PART_R(){return typeof CQ_PART_R!=='undefined'?CQ_PART_R:2;}};
const pct=p=>(Math.round(p*1000)/10)+'%';
// One line per find, rarest first: [{t:'REPAIR KIT ×2',r:1}, ...]
function lines(loot){if(!loot)return [];const out=[],I=G.ITEMS,P=G.PARTS,F=G.FRAG.pools,T=G.TROPHY,M=G.MN,MR=G.MNR;
 const x=n=>(n|0)>1?' ×'+(n|0):'';
 for(const [k,n] of Object.entries(loot.tr||{}))out.push({t:'TROPHY · '+String(T[k]?.n||k).toUpperCase()+x(n),r:T[k]?.r??3});
 for(const id of loot.pieces||[]){const C=root.ConquestCatalog?.byId?.[id];out.push({t:'NEW COSMETIC · '+String(C?.name||id).toUpperCase(),r:(F[C?.pool]?.r??2)+1>4?4:(F[C?.pool]?.r??2)+1});}
 for(const [k,n] of Object.entries(loot.pt||{}))out.push({t:'RARE · '+String(P[k]?.n||k).toUpperCase()+x(n),r:G.PART_R});
 for(const [k,n] of Object.entries(loot.fr||{}))out.push({t:(F[k]?.n||k)+' FRAGMENT'+x(n),r:F[k]?.r??0});
 for(const [k,n] of Object.entries(loot.mn||{}))out.push({t:'+'+(n|0)+' '+String(M[k]?.s||k).toUpperCase()+' (CARRIED)',r:MR[k]|0});
 for(const [k,n] of Object.entries(loot.it||{}))out.push({t:String(I[k]?.n||k).toUpperCase()+x(n),r:I[k]?.r??1});
 for(const k of loot.full||[])out.push({t:String(I[k]?.n||P[k]?.n||k).toUpperCase()+' · FULL',r:0});
 return out.sort((a,b)=>b.r-a.r);}
const best=loot=>lines(loot)[0]||null;
const text=loot=>lines(loot).map(l=>l.t).join(' · ');
// Which consumable the HUD slot holds: the pilot's pick while any is left, else the first owned (CQ_ITEM_ORDER).
function slotItem(s,pick){const it=s?.inv?.it||{},order=G.ORDER;if(pick&&(it[pick]|0)>0)return pick;return order.find(k=>(it[k]|0)>0)||null;}
const owns=s=>Object.values(s?.inv?.it||{}).some(n=>(n|0)>0);
const cooldown=(s,k,now=Date.now())=>Math.max(0,Math.ceil(((s?.inv?.cd?.[k]||0)-now)/1000));
// Pity, in plain words (the collection screen shows them, spec §4.1).
function pity(s){const p=s?.inv?.pity||{},L=G.LOOT||{};const e=L.elite?.pity?.part||20,c=L.commander?.pity?.trophy||10;
 return [{t:'RESEARCH PART · guaranteed within '+Math.max(1,e-(p.e|0))+' more elite kills (sentinel or fire coordinator)',n:p.e|0,of:e},
  {t:'COMMANDER TROPHY · guaranteed within '+Math.max(1,c-(p.c|0))+' more raid commanders (the type you fought most)',n:p.c|0,of:c}];}
// The published table as text rows (the LOOT screen and the wiki say the same thing).
function table(){const LT=G.LOOT;if(!LT)return [];const I=G.ITEMS,M=G.MN,F=G.FRAG.pools,name=r=>r.mn?'1 '+M[r.mn].s:r.item?(r.item>1?r.item+' consumables':'1 consumable'):r.part?'1 research part':r.frag?'1 '+F[r.frag].n.toLowerCase()+' fragment':r.trophy?"that commander's trophy":'';
 const row=(src,label)=>{const t=LT[src];if(!t)return null;const bits=[];if(t.always?.item)bits.push('always 1 consumable');for(const r of t.rows||[])bits.push(pct(r.p)+' '+name(r));for(const [ring,ex] of Object.entries(t.ring||{}))for(const r of ex)bits.push(pct(r.p)+' '+name(r)+' (VETERAN)');if(t.pity?.part)bits.push(t.pity.part+' elites without a part → a part');if(t.pity?.trophy)bits.push(t.pity.trophy+' commanders without a trophy → a trophy');return {label,t:bits.join(' · ')};};
 return [row('mob','Interceptors, saboteurs'),row('elite','Sentinels, fire coordinators'),row('commander','Raid commanders'),row('chest','Raid completion chest'),row('strike','Meteor Strike secured'),row('defense','Town or sector defense held'),
  {label:'Consumable odds',t:G.ORDER.map(k=>I[k].n+' '+I[k].w+'%').join(' · ')}].filter(Boolean);}
// The LOOT screen: consumables, research parts, fragments, the Trophy Hall and the pity counters. el/button are app.js helpers.
function screen(d,s,{el,button,use,pick,picked}){
 const v=s?.inv;el('p','cq-kicker','ACCOUNT-BOUND · NEVER LOST ON DEATH · NEVER SOLD',d);el('h2','','LOOT & TROPHY HALL',d);
 if(!v){el('p','','Online verification required: loot is rolled and kept by Command.',d);return;}
 const sec=t=>{const x=el('section','cq-loot-sec',null,d);el('h3','',t,x);return x;};
 const c=sec('CONSUMABLES · CONQUEST ONLY · MAX '+(typeof CQ_ITEM_MAX!=='undefined'?CQ_ITEM_MAX:10)+' EACH');
 for(const k of CQ_ITEM_ORDER){const I=CQ_ITEMS[k],n=v.it?.[k]|0,cd=cooldown(s,k),row=el('div','cq-loot-row',null,c);el('b','',I.n.toUpperCase()+' ×'+n,row);el('small','',I.d+(cd?' · RECHARGING '+cd+'s':''),row);
  if(use){const u=button('USE',()=>use(k),'cq-loot-use');u.disabled=!n||cd>0;row.append(u);}if(pick){const p=button(picked===k?'IN SLOT':'SET SLOT',()=>pick(k),'cq-loot-pick');p.disabled=!n||picked===k;row.append(p);}}
 el('small','cq-loot-note','Use them in the field or in an operation (never inside your town, Arcade or PvP). SHIELD long-press or Q opens / uses the slot; keys 1-4 use each one.',c);
 const p=sec('RESEARCH PARTS · FOR THE SCIENCE LAB');el('p','',CQ_PART_ORDER.map(k=>CQ_PARTS[k].n+' '+(v.pt?.[k]|0)+'/'+CQ_PART_MAX).join(' · '),p);
 const f=sec('BLUEPRINT FRAGMENTS · '+CQ_FRAG.need+' OF A POOL = ONE NEW COSMETIC');const C=root.ConquestCatalog;
 for(const k of CQ_FRAG.order){const pool=C?.pools?.[k]||[],own=pool.filter(id=>s?.cosmetics?.owned?.[id]).length,row=el('div','cq-loot-row',null,f);const b=el('b','',CQ_FRAG.pools[k].n+' '+(v.fr?.[k]|0)+'/'+CQ_FRAG.need,row);b.style.color=COLORS[CQ_FRAG.pools[k].r];el('small','',own+'/'+pool.length+' '+({armor:'plate finishes',commander:'banner standards',trail:'muzzle trails',base:'town ornaments'}[CQ_FRAG.pools[k].slot]||'pieces')+(own===pool.length&&pool.length?' · POOL COMPLETE':''),row);}
 const t=sec('TROPHY HALL · +'+CQ_TROPHY_SCORE+' TOWN SCORE PER TROPHY TYPE');let held=0;
 for(const k of CQ_TROPHY_ORDER){const n=v.tr?.[k]|0;if(n)held++;const row=el('div','cq-loot-row'+(n?'':' cq-loot-missing'),null,t);const b=el('b','',(n?'♛ ':'○ ')+CQ_TROPHY[k].n.toUpperCase()+(n>1?' ×'+n:''),row);if(n)b.style.color=COLORS[CQ_TROPHY[k].r];el('small','',n?'IN YOUR TROPHY HALL':k==='core'?'Every 12th secured Meteor Strike':'10% from its raid commander',row);}
 el('small','cq-loot-note',held===CQ_TROPHY_ORDER.length?'FULL SET · the Hive banner emblem is yours (town banner designer).':'Full set ('+held+'/'+CQ_TROPHY_ORDER.length+') unlocks the earn-only Hive banner emblem.',t);
 const q=sec('PITY · NEVER MORE THAN THIS WITHOUT');for(const x of pity(s)){const row=el('div','cq-loot-row',null,q);el('small','',x.t+' ('+x.n+'/'+x.of+')',row);}
 const o=sec('PUBLISHED ODDS');for(const r of table())el('p','',r.label.toUpperCase()+' · '+r.t,o);
 if(v.log?.length){const g=sec('RECENT FINDS');for(const e of v.log.slice().reverse().slice(0,6))el('p','',text(e)||'—',g);}
}
root.ConquestLoot=Object.freeze({COLORS,lines,best,text,slotItem,owns,cooldown,pity,table,screen});
})(globalThis);
