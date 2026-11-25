// Session 7C STEP 2 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; old brief A): the cqalt cluster hint. Farm defense (farm.js)
// already links accounts that share a device, a paying wallet, the same controls, a network they start on together or live wins traded,
// and groups them into clusters. Inside such a cluster, two accounts that also share TWO of these Conquest signals are one person's alts
// (research lesson 13: two independent links before acting):
//   town    the same town layout (a Command Center 5+ town with 15+ buildings: every building's type and cell, every wall cell);
//   hours   the same UTC hours of Conquest play on 3+ shared days (each with 2+ hours);
//   beacon  a Strike Beacon called in the same minute.
// Each pilot's summary lives at cqx/<pid> (th: the town hash; h/<day>/<hour>: 1; b/<minute>: 1), written by the Worker after a Conquest
// request only when something new appears. The leaderboard cron (every 5 minutes) checks each cluster once an hour (cqAltScan): a hint
// is kept at cqa/<sig> for the admin sheet's cluster row, and every account but the cluster's main one gets the cqalt flag through
// addFlags (flag only: they play on and sit out boards and the airdrop snapshot until the owner clears the cluster; nothing bans).
import {dbGet,dbPatch} from './db.js';import {addFlags} from './eco.js';
const DAY=86400000,KEEP_DAYS=7,MEMO=new Map(),fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
export const ALT=Object.freeze({townCC:5,townN:15,days:3,hours:2,need:2,members:6,every:12});
// the town layout hash: only for a real, grown town (a new town's auto-placed start is the same for everyone on a site)
export function townHash(p){if(!p||(p.cc|0)<ALT.townCC)return '';const b=Object.values(p.b||{}).filter(Boolean);if(b.length<ALT.townN)return '';
 return fnv(p.site+'|'+b.map(x=>x.t+':'+x.i+':'+x.j+':'+(x.r|0)).sort().join(',')+'|'+Object.keys(p.w||{}).sort().join(','));}
// after a committed Conquest request: write what is new (best effort; at most a few small writes a pilot an hour)
export async function altNote(env,pid,s,now){if(!s||s.v!==1||typeof pid!=='string'||/[.#$\[\]/]/.test(pid))return;const d=Math.floor(now/DAY),h=new Date(now).getUTCHours(),th=townHash(s.plot),bm=s.bcn?.at?Math.floor(Number(s.bcn.at)/60000):0;
 const m=MEMO.get(pid)||{},up={};if(m.hk!==d*24+h){up[`cqx/${pid}/h/${d}/${h}`]=1;if(m.d!==d)up[`cqx/${pid}/h/${d-KEEP_DAYS}`]=null;}if(th&&m.th!==th)up[`cqx/${pid}/th`]=th;if(bm&&m.bm!==bm)up[`cqx/${pid}/b/${bm}`]=1;
 if(!Object.keys(up).length)return;await dbPatch(env,'',up);MEMO.delete(pid);MEMO.set(pid,{hk:d*24+h,d,th:th||m.th,bm:bm||m.bm});if(MEMO.size>20000)MEMO.delete(MEMO.keys().next().value);}
// two summaries: which signals they share (pure: the test reads it)
export function shared(a,b,now){const out=[];if(!a||!b)return out;if(a.th&&a.th===b.th)out.push('town');
 const today=Math.floor(now/DAY),days=[];for(let d=today-KEEP_DAYS+1;d<=today;d++){const x=Object.keys(a.h?.[d]||{}).sort(),y=Object.keys(b.h?.[d]||{}).sort();if(x.length>=ALT.hours&&y.length>=ALT.hours)days.push(x.join(',')===y.join(','));}
 if(days.length>=ALT.days&&days.every(Boolean))out.push('hours');
 if(Object.keys(a.b||{}).some(k=>b.b?.[k]))out.push('beacon');return out;}
const TEXT={town:'the same town layout',hours:'the same hours of play',beacon:'a Strike Beacon in the same minute'};
// the cron: clusters (farm.js buildClusters' rows) checked once an hour each (12 slices of 5 minutes)
export async function cqAltScan(env,clu,fl,now){const slice=Math.floor(now/300000)%ALT.every,lkok=(await dbGet(env,'lkok').catch(()=>null))||{};let n=0;
 for(const c of (clu||[]).filter(c=>c&&c.sig&&parseInt(c.sig,16)%ALT.every===slice)){const ids=c.m.map(x=>x[0]).slice(0,ALT.members),xs=await Promise.all(ids.map(id=>dbGet(env,'cqx/'+id).catch(()=>null)));
  let hint=[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const s=shared(xs[i],xs[j],now);if(s.length>=ALT.need&&s.length>hint.length)hint=s;}
  await dbPatch(env,'',{['cqa/'+c.sig]:hint.length?{h:hint,t:now}:null});if(!hint.length||lkok[c.sig])continue;
  const text='Conquest: '+hint.map(k=>TEXT[k]).join(', ')+' as a linked account; only '+(c.m.find(x=>x[0]===c.keep)?.[1]||c.keep)+' counts';
  for(const [id,name] of c.m){if(id===c.keep)continue;const cur=fl?.[id]?.r?.cqalt;if(cur&&cur.v===text)continue;await addFlags(env,id,name,[['cqalt',text]],now).catch(()=>{});n++;}}
 return n;}
