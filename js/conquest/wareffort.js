/* Session 7C STEP 4 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; blueprint §7 "The shared war"; owner, Nov 24): the weekly War
   Effort bar. Every verified operation adds its campaign score (the shared warfront document's own count, worker/src/conquest-warfront.js).
   The goal is population-normalized: the week's active pilots x a fixed personal quota x 0.6 (always winnable if 60% of pilots play an
   ordinary week); every verified campaign point counts (the brief: a per-pilot cap of two quotas is a PROPOSAL); with zero pilots it idles
   and nothing breaks. A win: High Morale for everyone next week (+1 DEFENSE on every territory in every personal world: the war rules'
   "Shared-war morale" part), the cosmetic reward tiers (100% / 150% / 200% of the goal; earn-only; no CP or salvage bonus), and a War
   Effort crate (2 Repair Kits + 1 Scanner Charge) for every pilot who contributed. A loss takes nothing. Squads (the referral squads: a
   recruiter and the pilots it recruited) compete on their summed contribution: the top squad's banner flies at the warfront monument and
   in every hub next week, and each of its contributing members gets an uncommon fragment (the banner-standard pool). The monument's and
   the frontier's growth on a win is a visual hook for the Fable 7-V session (HOOKS). Shared by the phone and the Worker. */
(function(root){
'use strict';
const WEEK=7*86400000,MONDAY0=4*86400000;
const WE=Object.freeze({quota:150,share:.6,cap:0,tiers:Object.freeze([1,1.5,2]),crate:Object.freeze({repair:2,scanner:1}),squadMin:2,squadFrag:'u',maxPilots:10000,keepWeeks:8});   // keepWeeks: finished weeks a pilot can still settle (review round 1)
const HOOKS=Object.freeze({monument:'we-monument-growth',frontier:'we-frontier-growth',banner:'we-squad-banner'});
const weekOf=now=>Math.floor((Number(now)-MONDAY0)/WEEK),weekEnd=w=>(w+1)*WEEK+MONDAY0;
const goalOf=n=>n>0?Math.round(n*WE.quota*WE.share):0;
// what one pilot's week counts (two quotas at most)
const counted=c=>Math.max(0,Math.floor(Number(c)||0));   // every verified campaign point counts (the brief); a per-pilot cap (WE.cap quotas) is a PROPOSAL, not applied
// a finished or running week: its numbers (n active pilots, score counted), the goal, the share, the tier reached, won
function weekOfDoc(x){const n=Math.max(0,x?.n|0),score=Math.max(0,Math.floor(Number(x?.score)||0)),goal=goalOf(n),pct=goal?score/goal:0,tier=goal?WE.tiers.filter(t=>pct>=t).length:0;return {w:x?.w??null,n,score,goal,pct:Math.round(pct*1000)/1000,tier,won:n>0&&score>=goal};}
// the public view of the shared document at a moment: this week, last week (its result), High Morale this week, the top squad's banner
function view(doc,now){const cur=weekOf(now),we=doc?.we,prev=doc?.prev,mk=(x,w)=>({...weekOfDoc(x),w});
 const thisWeek=we&&we.w===cur?mk(we,cur):mk(null,cur),last=we&&we.w===cur-1?{...mk(we,cur-1),top:topSquad(we)}:prev&&prev.w===cur-1?{...mk(prev,cur-1),top:prev.top||null}:null;
 return {w:cur,ends:weekEnd(cur),now:thisWeek,last,hm:last?.won?1:0,banner:last?.top?.bn||null};}
// the top squad of a week (its leader's id stays on the Worker: the public view carries the name and the banner only)
function topSquad(we){const sq=we?.sq||{},sn=we?.sqn||{};let best=null;for(const [id,v] of Object.entries(sq)){if((sn[id]|0)<WE.squadMin)continue;if(!best||v>best.s||v===best.s&&id<best.id)best={id,s:v,k:sn[id]|0,n:we?.sqnm?.[id]||'',bn:we?.sqbn?.[id]||null};}return best;}
// the hub's lines (js/conquest/hub.js's WARFRONT card): the bar, the goal, the week's end, last week's result, the banner
function lines(card,s,{el,now=Date.now()}={}){const v=s?.warfront?.we;if(!el||!card)return null;if(!v){el('small','cq-we-line','WAR EFFORT · every verified operation pushes the weekly bar',card);return null;}
 const N=v.now,pct=N.goal?Math.min(999,Math.round(N.score/N.goal*100)):0,left=Math.max(0,v.ends-now),h=Math.floor(left/3600000);
 el('p','cq-we-head',N.n?'WAR EFFORT · '+N.score.toLocaleString('en-US')+' / '+N.goal.toLocaleString('en-US')+' · '+pct+'% · '+N.n+' PILOT'+(N.n>1?'S':''):'WAR EFFORT · WAITING FOR THE WEEK\'S FIRST OPERATION',card);
 if(N.goal){const bar=el('progress','cq-hub-bar cq-we-bar',null,card);bar.max=N.goal*WE.tiers[WE.tiers.length-1];bar.value=Math.min(bar.max,N.score);bar.setAttribute('aria-label','War Effort this week');}
 el('small','cq-we-tiers','TIERS: I 100% · II 150% · III 200% · ENDS IN '+(h>=48?Math.floor(h/24)+'D '+(h%24)+'H':h+'H')+' (MONDAY 00:00 UTC)',card);
 const L=v.last;if(L)el('small','cq-we-last',L.won?'LAST WEEK WON (TIER '+['','I','II','III'][L.tier]+') · HIGH MORALE: +1 DEFENSE ON EVERY TERRITORY THIS WEEK':'LAST WEEK '+Math.round(L.pct*100)+'% · NOTHING LOST · PUSH AGAIN',card);
 if(L?.top?.n)el('small','cq-we-squad','THE BANNER OF '+String(L.top.n).toUpperCase()+'\'S SQUAD FLIES AT THE MONUMENT THIS WEEK'+(v.mine?' · YOUR SQUAD':''),card);return card;}
// the ticker line when last week's rewards arrive (js/conquest/app.js)
function noticeText(n){const g=n?.got||{},bits=[];if(g.repair||g.scanner)bits.push('WAR EFFORT CRATE: '+(g.repair|0)+' REPAIR KIT'+((g.repair|0)===1?'':'S')+' + '+(g.scanner|0)+' SCANNER CHARGE');if(g.tier)bits.push('TIER '+['','I','II','III'][g.tier]+' PIECE UNLOCKED');if(g.fr){const n=Object.values(g.fr).reduce((a,b)=>a+(Number(b)||0),0)||1;bits.push('YOUR SQUAD TOPPED THE WAR EFFORT: +'+n+' UNCOMMON FRAGMENT'+(n>1?'S':''));}
 return (n?.won?'WAR EFFORT WON · ':'WAR EFFORT · ')+(bits.join(' · ')||'THANK YOU, PILOT');}
root.ConquestWarEffort=Object.freeze({WE,HOOKS,weekOf,weekEnd,goalOf,counted,weekOfDoc,view,topSquad,lines,noticeText});
})(globalThis);
