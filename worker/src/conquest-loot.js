// Conquest loot v1 (Session 6; docs/conquest/audit/CONQUEST_1_0_SPEC.md §4, the tables in js/rules.js LOOT).
// Every roll is the Worker's: a hash of the pilot's server-only seed (s.lseed, never sent to the client), the source and the
// kill id / attempt / strike slot. The same kill or attempt always gives the same roll, so a reload, a retry or a replayed
// request can never re-roll, and the client never sends a roll or an amount.
// What drops: minerals ride the salvage cache (cargo: half at risk on death, banked to the wallet through the outbox, exactly
// like gathered ore). Consumables, research parts, blueprint fragments and trophies are ACCOUNT-BOUND the moment they are
// picked up (Decision 5a): s.inv, capped, never raided, never lost on death. No roll ever pays airdrop points.
import {CONQUEST,RULES as R} from './sim.gen.js';
const CAT=CONQUEST.Catalog,record=v=>v&&typeof v==='object'&&!Array.isArray(v),int=v=>Math.max(0,Math.floor(Number(v)||0));
const fail=m=>{throw Error('conquest: '+m);};
export function lootSeed(){try{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]>>>0;}catch{return (Date.now()*2654435761)>>>0;}}
// FNV-1a over the key, then the murmur3 finaliser so keys that differ in one character still give independent values.
export function u32(t){let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;}
export const unit=t=>u32(t)/4294967296;
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const fill=(o,keys)=>{const m={};for(const k of keys)m[k]=int(record(o)?o[k]:0);return m;};
// The pilot's loot record (additive; Firebase drops empty maps, so every field is rebuilt on each load).
// it: consumables · pt: research parts · fr: fragments toward the next piece of each pool · tr: trophies held (count) ·
// pity: e = elites since a research part, c = commanders since a trophy, cf = commanders fought by doctrine since the last
// trophy · cd: consumable cooldown ends (server clock) · log: the last finds (newest last), for the LOOT screen.
export function inventory(s){
 if(!Number.isSafeInteger(s.lseed)||s.lseed<0)s.lseed=lootSeed();
 const v=record(s.inv)?s.inv:(s.inv={});v.v=1;
 v.it=fill(v.it,R.CQ_ITEM_ORDER);v.pt=fill(v.pt,R.CQ_PART_ORDER);v.fr=fill(v.fr,R.CQ_FRAG.order);v.tr=fill(v.tr,R.CQ_TROPHY_ORDER);
 const p=record(v.pity)?v.pity:{};v.pity={e:int(p.e),c:int(p.c),cf:fill(p.cf,R.CQ_TROPHY_ORDER.filter(k=>k!=='core'))};
 v.cd=Object.fromEntries(Object.entries(record(v.cd)?v.cd:{}).filter(([k,t])=>R.CQ_ITEMS[k]&&Number(t)>0).map(([k,t])=>[k,Number(t)]));
 v.log=list(v.log).slice(-12);
 return v;}
export const pickItem=key=>{const total=R.CQ_ITEM_ORDER.reduce((a,k)=>a+R.CQ_ITEMS[k].w,0);let x=u32(key)%total;for(const k of R.CQ_ITEM_ORDER){x-=R.CQ_ITEMS[k].w;if(x<0)return k;}return R.CQ_ITEM_ORDER[0];};
// A rarity step (the Sortie chain at three links): a fragment of the next pool up.
export const stepPool=(pool,steps=0)=>{const o=R.CQ_FRAG.order;return o[Math.min(o.length-1,o.indexOf(pool)+Math.max(0,steps|0))]||pool;};
export function rows(src,ring=1){const T=R.LOOT[src];if(!T)return [];const out=[...(T.rows||[])];for(const [r,extra] of Object.entries(T.ring||{}))if(ring>=Number(r))out.push(...extra);return out;}
const add=(o,g,k,n=1)=>{const m=o[g]||(o[g]={});m[k]=(m[k]||0)+n;};
// One source's roll. key: the kill's drop id, or 'attempt:<n>' / 'slot:<n>' for completions. ring: ConquestWorld.ringAt of the
// kill (a raid commander's ring is its raid's danger). commander: the doctrine of a raid commander (its trophy). steps: rarity
// steps on fragments (Sortie chain). Pity counters move here, at the roll (the guaranteed find is inside that drop).
export function roll(s,src,key,{ring=1,commander=null,steps=0}={}){
 const v=inventory(s),T=R.LOOT[src];if(!T)return {};const base=s.lseed+':'+src+':'+key,out={};
 for(let i=0;i<(T.always?.item|0);i++)add(out,'it',pickItem(base+':always:'+i));
 rows(src,ring).forEach((row,i)=>{if(unit(base+':'+i)>=row.p)return;
  if(row.mn)add(out,'mn',row.mn);
  for(let j=0;j<(row.item|0);j++)add(out,'it',pickItem(base+':'+i+':it:'+j));
  if(row.part)add(out,'pt',R.CQ_PART_ORDER[u32(base+':'+i+':pt')%R.CQ_PART_ORDER.length]);
  if(row.frag)add(out,'fr',stepPool(row.frag,steps));
  if(row.trophy&&R.CQ_TROPHY[commander])add(out,'tr',commander);});
 if(src==='elite'&&T.pity?.part){if(out.pt)v.pity.e=0;else if(++v.pity.e>=T.pity.part){add(out,'pt',R.CQ_PART_ORDER[u32(base+':pity')%R.CQ_PART_ORDER.length]);out.pity='part';v.pity.e=0;}}
 if(src==='commander'&&T.pity?.trophy&&R.CQ_TROPHY[commander]&&commander!=='core'){v.pity.cf[commander]=(v.pity.cf[commander]|0)+1;
  if(out.tr){v.pity.c=0;v.pity.cf=fill({},Object.keys(v.pity.cf));}
  else if(++v.pity.c>=T.pity.trophy){const most=Object.entries(v.pity.cf).reduce((a,b)=>b[1]>a[1]?b:a,[commander,v.pity.cf[commander]])[0];add(out,'tr',most);out.pity='trophy';v.pity.c=0;v.pity.cf=fill({},Object.keys(v.pity.cf));}}
 return out;}
// What a roll shows on the ground: the rarest find's rarity and its one-word label.
export function face(loot){let r=-1,label='SALVAGE';const see=(rar,w)=>{if(rar>r){r=rar;label=w;}};
 for(const k of Object.keys(loot?.mn||{}))see(R.CQ_MN_RARITY[k]|0,String(R.MINERALS[k]?.s||k).toUpperCase());
 for(const k of Object.keys(loot?.it||{}))see(R.CQ_ITEMS[k].r,R.CQ_ITEMS[k].w1);
 for(const k of Object.keys(loot?.pt||{}))see(R.CQ_PART_R,R.CQ_PARTS[k].w1);
 for(const k of Object.keys(loot?.fr||{}))see(R.CQ_FRAG.pools[k].r,'FRAGMENT');
 for(const k of Object.keys(loot?.tr||{}))see(R.CQ_TROPHY[k].r,'TROPHY');
 return {r:Math.max(0,r),label};}
export const empty=loot=>!loot||!['mn','it','pt','fr','tr'].some(g=>Object.keys(loot[g]||{}).length);
// The next piece of a fragment pool: one this pilot does not own yet, picked from the seed (no repeats until complete).
function piece(s,pool,now){const ids=CAT.pools[pool]||[],c=s.cosmetics=record(s.cosmetics)?s.cosmetics:{v:1};c.owned=record(c.owned)?c.owned:{};c.equipped=record(c.equipped)?c.equipped:{};
 const left=ids.filter(id=>!c.owned[id]);if(!left.length)return null;const id=left[u32(s.lseed+':piece:'+pool+':'+(ids.length-left.length))%left.length];c.owned[id]={at:now,source:'fragments',pool};return id;}
// Account-bound grant (pickup or a completion receipt). Minerals are NOT handled here (they are cargo). Returns what was
// really added: {it,pt,fr,tr,pieces:[cosmetic ids], full:[ids capped out]}.
export function bind(s,loot,now,{where=null}={}){const v=inventory(s),got={},full=[];
 for(const [k,n] of Object.entries(loot?.it||{})){if(!R.CQ_ITEMS[k])continue;const a=Math.max(0,Math.min(int(n),R.CQ_ITEM_MAX-v.it[k]));if(a)add(got,'it',k,a);if(a<int(n))full.push(k);v.it[k]+=a;}
 for(const [k,n] of Object.entries(loot?.pt||{})){if(!R.CQ_PARTS[k])continue;const a=Math.max(0,Math.min(int(n),R.CQ_PART_MAX-v.pt[k]));if(a)add(got,'pt',k,a);if(a<int(n))full.push(k);v.pt[k]+=a;}
 for(const [k,n] of Object.entries(loot?.fr||{})){if(!R.CQ_FRAG.pools[k])continue;add(got,'fr',k,int(n));v.fr[k]+=int(n);
  while(v.fr[k]>=R.CQ_FRAG.need){const id=piece(s,k,now);if(!id){v.fr[k]=R.CQ_FRAG.need;break;}v.fr[k]-=R.CQ_FRAG.need;(got.pieces||(got.pieces=[])).push(id);}}
 for(const [k,n] of Object.entries(loot?.tr||{})){if(!R.CQ_TROPHY[k])continue;add(got,'tr',k,int(n));v.tr[k]+=int(n);}
 if(full.length)got.full=full;
 if(!empty(got)||got.pieces)v.log=[...v.log,{at:now,...(where?{w:String(where).slice(0,24)}:{}),...got}].slice(-12);
 return got;}
// Town Score: each trophy type held adds CQ_TROPHY_SCORE once (duplicates are kept for pride, they add no score).
export function trophyScore(s){const t=s?.inv?.tr||{};return R.CQ_TROPHY_ORDER.filter(k=>(t[k]|0)>0).length*R.CQ_TROPHY_SCORE;}
export const trophySet=s=>R.CQ_TROPHY_ORDER.every(k=>(s?.inv?.tr?.[k]|0)>0);
// Consumables: server-validated use. itemReady throws (nothing spent); spend takes one and starts its cooldown.
export function itemReady(s,k,now){const v=inventory(s),I=R.CQ_ITEMS[k];if(!I)fail('invalid item');if(v.it[k]<1)fail('no '+I.n+' left');if(now<(v.cd[k]||0))fail(I.n+' recharging: '+Math.ceil((v.cd[k]-now)/1000)+'s');return I;}
export function spend(s,k,now){const v=inventory(s),I=R.CQ_ITEMS[k];v.it[k]=Math.max(0,v.it[k]-1);v.cd[k]=now+I.cdMs;return v.it[k];}
// The loot found during the current operation attempt (the after-action lists it under the tiles).
export function runLoot(s,got){if(!s.mission||empty(got))return;const r=record(s.lootRun)&&s.lootRun.attempt===s.attempt?s.lootRun:(s.lootRun={attempt:s.attempt|0});for(const g of ['mn','it','pt','fr','tr'])for(const [k,n] of Object.entries(got[g]||{}))add(r,g,k,n);}
