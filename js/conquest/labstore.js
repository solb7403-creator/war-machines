/* Science Lab store rows (owner decision 8, Nov 16, 2026; Session 6C adds the Battalion kinds: RECRUIT finish, liveries, the chip pack): instant finish on a running job, the Legendary set mods and the research
   part packs, shown with their proposed prices and a disabled button. Checkout is off in every currency: nothing here can be bought
   (the Worker refuses every Lab kind, worker/src/index.js descOf). Prices come from js/rules.js (rsFinPrice, RS_PACKS, RS_LEG_PRICE);
   labPriceLabel (js/net.js) shows Stars in Telegram and TON + SOL (live rate) on the website. 2D, the town sheet's own style. */
(function(root){
'use strict';
const OFF='Not on sale yet';
const label=p=>typeof labPriceLabel==='function'?labPriceLabel(p):p.stars+' ⭐';
const ownedLsm=id=>typeof save!=='undefined'&&!!(save&&save.lsm&&save.lsm[id]);
// a disabled store button with its price, and the plain line under it
function offer(el,button,parent,text,p,note){const b=button(text+' · '+label(p),()=>{},'cq-lab-buy');b.disabled=true;b.setAttribute('aria-disabled','true');b.title=OFF;parent.append(b);
 el('small','cq-lab-off',OFF+(note?' · '+note:''),parent);return b;}
function row(parent,kind,info,ctx){const {el,button,state}=ctx||{};if(!el||!button||!parent)return null;
 if(kind==='rsfin'){const left=Number(info?.left)||0,p=rsFinPrice(left);if(!p)return null;return offer(el,button,parent,'FINISH NOW',p,'priced by the time left');}
 if(kind==='rsleg'){const id=info?.id,set=rsLegSet(id);if(!set)return null;const sv=typeof save!=='undefined'?save:null,done=!!(state?.rs?.done?.[set]||sv?.rm?.[set]);
  if(ownedLsm(id)||state?.rs?.done?.[id]||sv?.rm?.[id]){el('b','cq-lab-tag','★ OWNED · in your garage',parent);return null;}
  if((state?.rs?.jobs||[]).some(j=>j&&j.mod===id)||sv?.rsj?.[id]){el('small','cq-lab-lock','Being researched: it is yours when the job ends, so it is not for sale',parent);return null;}   // one ownership, two ways in
  return offer(el,button,parent,'BUY · LEGENDARY',RS_LEG_PRICE,done?'yours for good, every mode':'and only after '+rmodOf(set).F.n);}   // the buy way, always shown (checkout off); on sale only after its track's set mod
 if(kind==='rspack'){const f=el('details','cq-map-fold cq-lab-store',null,parent),sm=el('summary','','LAB STORE · RESEARCH PART PACKS',f);sm.dataset.k='lab-store';
  el('small','cq-lab-uses','Each pack adds parts of all four kinds to your Science Lab. One of each pack a week.',f);
  for(const k of RS_PACK_ORDER){const P=RS_PACKS[k],a=el('article','cq-lab-node cq-lab-pack',null,f);el('h3','',P.n.toUpperCase(),a);
   el('p','cq-lab-what','+'+P.each+' of every research part ('+P.each*CQ_PART_ORDER.length+' parts)',a);offer(el,button,a,'BUY',P);}
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
