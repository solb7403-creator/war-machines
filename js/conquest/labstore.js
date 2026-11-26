/* Science Lab store rows (owner decision 8, Nov 16, 2026; OPEN since Session 8, owner Nov 26: LAB_STORE_OPEN): instant finish on a
   running job, the Legendary set mods (1,500 Stars / 23 GRAM, one a UTC week) and the research part packs (one of each a week), each a
   server quote (js/checkout.js: the Worker checks every rule and prices the finish from the job's real time left). The Battalion kinds
   (Session 6C: RECRUIT finish, liveries, the chip pack) stay off (BAT_STORE_OPEN false: not in the Nov 26 sale list). Prices from js/rules.js
   (rsFinPrice, RS_PACKS, RS_LEG_PRICE) in the surface's currency (labPriceLabel: Telegram Stars or GRAM, the website GRAM or SOL). */
(function(root){
'use strict';
const OFF='Not on sale',labOpen=()=>typeof LAB_STORE_OPEN!=='undefined'&&LAB_STORE_OPEN===true&&typeof checkout==='function';
const label=p=>typeof labPriceLabel==='function'?labPriceLabel(p):p.stars+' ⭐';
const dur=ms=>{const m=Math.max(1,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+' h '+(m%60)+' min':m+' min';};
const ownedLsm=id=>typeof save!=='undefined'&&!!(save&&save.lsm&&save.lsm[id]);
// a live buy button (a server quote) with its price and the plain line under it
function buy(el,button,parent,text,p,desc,note){const b=button(text+' · '+label(p),()=>checkout(desc),'cq-lab-buy cq-lab-live');parent.append(b);if(note)el('small','cq-lab-note',note,parent);return b;}
// a disabled store button with its price, and the plain line under it (the store closed, or the Battalion kinds)
function offer(el,button,parent,text,p,note){const b=button(text+' · '+label(p),()=>{},'cq-lab-buy');b.disabled=true;b.setAttribute('aria-disabled','true');b.title=OFF;parent.append(b);
 el('small','cq-lab-off',OFF+(note?' · '+note:''),parent);return b;}
function row(parent,kind,info,ctx){const {el,button,state}=ctx||{};if(!el||!button||!parent)return null;
 if(kind==='rsfin'){const left=Number(info?.left)||0,p=rsFinPrice(left),id=info?.job?.id;if(!p)return null;return labOpen()&&id?buy(el,button,parent,'FINISH NOW',p,{kind:'rsfin',job:id},'priced by the time left · free in '+dur(left)):offer(el,button,parent,'FINISH NOW',p,'priced by the time left');}
 if(kind==='rsleg'){const id=info?.id,set=rsLegSet(id);if(!set)return null;const sv=typeof save!=='undefined'?save:null,done=!!(state?.rs?.done?.[set]||sv?.rm?.[set]);
  if(ownedLsm(id)||state?.rs?.done?.[id]||sv?.rm?.[id]){el('b','cq-lab-tag','★ OWNED · in your garage',parent);return null;}
  if((state?.rs?.jobs||[]).some(j=>j&&j.mod===id)||sv?.rsj?.[id]){el('small','cq-lab-lock','Being researched: it is yours when the job ends, so it is not for sale',parent);return null;}   // one ownership, two ways in
  const wk=typeof ecoX==='function'&&((sv?.buys||{})[rsLegWeekKey(ecoX())]|0)>=RS_LEG_WEEK;
  if(labOpen()&&done&&!wk)return buy(el,button,parent,'BUY · LEGENDARY',RS_LEG_PRICE,{kind:'rsleg',tk:id},'yours for good, every mode · one Legendary a week · or research it free');
  if(labOpen()&&done&&wk){el('small','cq-lab-lock','One Legendary set mod a week: the next one opens Monday 00:00 UTC (or research it free)',parent);return null;}
  return offer(el,button,parent,'BUY · LEGENDARY',RS_LEG_PRICE,done?'yours for good, every mode':'and only after '+rmodOf(set).F.n);}   // on sale only after its track's set mod
 if(kind==='rspack'){const f=el('details','cq-map-fold cq-lab-store',null,parent),sm=el('summary','','LAB STORE · RESEARCH PART PACKS',f);sm.dataset.k='lab-store';
  el('small','cq-lab-uses','Each pack adds parts of all four kinds to your Science Lab. One of each pack a week.',f);
  for(const k of RS_PACK_ORDER){const P=RS_PACKS[k],a=el('article','cq-lab-node cq-lab-pack',null,f);el('h3','',P.n.toUpperCase(),a);
   el('p','cq-lab-what','+'+P.each+' of every research part ('+P.each*CQ_PART_ORDER.length+' parts)',a);const got=typeof ecoX==='function'&&((typeof save!=='undefined'&&save.buys||{})[rsPackKey(k,ecoX())]|0)>=1;
   if(labOpen()&&got)el('small','cq-lab-lock','Bought this week: the next one opens Monday 00:00 UTC',a);else if(labOpen())buy(el,button,a,'BUY',P,{kind:'rspack',tk:k});else offer(el,button,a,'BUY',P);}
  el('small','cq-lab-uses','Instant finish shows on a running job; Legendary set mods on their track. Purchases never give points.',f);return f;}
 // Session 6C Battalion store (checkout off: the Worker refuses every kind, BAT_STORE_OPEN false): the RECRUIT job's instant finish,
 // a livery, the command chip pack (one a UTC week, its own chip total outside the one-a-day limit). Never points.
 if(kind==='rcfin'){const left=Number(info?.left)||0,p=rsFinPrice(left);if(!p)return null;return offer(el,button,parent,'FINISH NOW',p,'priced by the time left');}
 if(kind==='livery'){const L=typeof LIVERIES==='object'&&LIVERIES[info?.tk];if(!L)return null;return offer(el,button,parent,'BUY',{stars:L.stars,ton:L.ton},'looks only');}
 if(kind==='chippack'){if(typeof CHIP_PACK!=='object')return null;const a=el('article','cq-lab-node cq-lab-pack cq-bat-chippack',null,parent);el('h3','',CHIP_PACK.n.toUpperCase(),a);
  el('p','cq-lab-what','+'+CHIP_PACK.chips+' command chips for your Role Cores (one pack a week; they do not count toward the one-a-day chip)',a);offer(el,button,a,'BUY',{stars:CHIP_PACK.stars,ton:CHIP_PACK.ton});return a;}
 return null;}
root.ConquestLabStore=Object.freeze({row,OFF});
})(globalThis);
