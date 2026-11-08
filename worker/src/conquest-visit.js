// Session 5 Phase 2: visit other pilots' bases (read-only), the top 20 by Command Power, squadmates, and Base of the Week
// (the largest verified weekly Command Power gain; no votes). The Worker publishes a public snapshot of a plot after every
// verified plot change: buildings, walls, site, banner, theme, Command Center level and Command Power only. Never ledgers,
// materials, minerals, positions, timers or anything spendable. Visiting reads snapshots and writes nothing.
import {dbGet,dbPut,weekOf} from './db.js';
import {readTag,writeIf,squadRows} from './eco.js';
const TOP=20;
export function snapshot(name,p,now){const b={};for(const [id,x] of Object.entries(p.b||{}))b[id]=[x.t,x.i|0,x.j|0,x.r|0,x.t==='cc'?p.cc|0:x.l|0];
 return {n:String(name||'Pilot').slice(0,24),site:p.site,cc:p.cc|0,pw:p.power|0,b,w:{...(p.w||{})},...(p.banner?{bn:p.banner}:{}),...(p.theme?{th:p.theme}:{}),at:now};}
async function cas(env,path,fn){for(let i=0;i<5;i++){const {v,tag}=await readTag(env,path);const next=fn(v);if(next===undefined)return v;if(await writeIf(env,path,next,tag))return next;}return null;}
// Publish after a verified plot change. Best effort: a failed publish never fails the pilot's action.
export async function publishBase(env,pid,name,s,now){const p=s?.plot;if(!p)return null;const path='cqbase/'+pid,old=await dbGet(env,path).catch(()=>null),wk=weekOf(now);
 const snap=snapshot(name,p,now);snap.wk=wk;snap.w0=old?.wk===wk?old.w0|0:old?.pw|0;   // week start power: the last published power before this week
 if(old&&old.pw===snap.pw&&old.cc===snap.cc&&JSON.stringify(old.b)===JSON.stringify(snap.b)&&JSON.stringify(old.w||{})===JSON.stringify(snap.w)&&JSON.stringify(old.bn||null)===JSON.stringify(snap.bn||null)&&JSON.stringify(old.th||null)===JSON.stringify(snap.th||null)&&old.wk===wk)return old;
 await dbPut(env,path,snap);
 await cas(env,'cqtop',v=>{const list=(Array.isArray(v?.list)?v.list:Object.values(v?.list||{})).filter(x=>x&&x.p!==pid);list.push({p:pid,n:snap.n,pw:snap.pw,cc:snap.cc,site:snap.site});list.sort((a,b)=>b.pw-a.pw||(a.p<b.p?-1:1));const top=list.slice(0,TOP);
  if(!top.some(x=>x.p===pid)&&!(v?.list||[]).some?.(x=>x?.p===pid))return undefined;return {at:now,list:top};}).catch(()=>{});
 const gain=Math.max(0,snap.pw-snap.w0);if(gain>0)await cas(env,'cqweek/'+wk,v=>v&&v.g>=gain&&v.p!==pid?undefined:{p:pid,n:snap.n,g:gain,pw:snap.pw,at:now}).catch(()=>{});
 return snap;}
async function squadOf(env,pid){const [rows,ref]=await Promise.all([squadRows(env,pid).catch(()=>[]),dbGet(env,'players/'+pid+'/ref').catch(()=>null)]);const ids=[...new Set([...(typeof ref==='string'&&ref?[ref]:[]),...rows.map(r=>r.id)])].filter(x=>x&&x!==pid).slice(0,12);
 const snaps=await Promise.all(ids.map(id=>dbGet(env,'cqbase/'+id).catch(()=>null)));return ids.map((id,i)=>snaps[i]?{p:id,n:snaps[i].n,pw:snaps[i].pw|0,cc:snaps[i].cc|0,site:snaps[i].site}:null).filter(Boolean);}
// POST /api/conquest/visit {gv, initData} -> lists; {.., pid} -> that pilot's public snapshot, if they are in the top 20, your
// squad, or this week's Base of the Week. Read-only.
export async function conquestVisit(env,a,now=Date.now()){const b=a.b||{};if(Object.keys(b).some(k=>!['gv','initData','pid'].includes(k)))return {status:400,body:{error:'invalid visit'}};
 const wk=weekOf(now),[top,week,squad]=await Promise.all([dbGet(env,'cqtop').catch(()=>null),dbGet(env,'cqweek/'+wk).catch(()=>null),squadOf(env,a.pid)]);
 const topList=(Array.isArray(top?.list)?top.list:Object.values(top?.list||{})).filter(Boolean).slice(0,TOP),bow=week?.p?{p:week.p,n:week.n,g:week.g|0,pw:week.pw|0}:null;
 if(b.pid===undefined)return {status:200,body:{ok:true,top:topList,squad,week:bow,wk}};
 if(typeof b.pid!=='string'||!/^[A-Za-z0-9_:-]{1,64}$/.test(b.pid))return {status:400,body:{error:'invalid visit'}};
 const allowed=b.pid===a.pid||topList.some(x=>x.p===b.pid)||squad.some(x=>x.p===b.pid)||bow?.p===b.pid;if(!allowed)return {status:403,body:{error:'visits are open to the top 20, your squad and the Base of the Week'}};
 const s=await dbGet(env,'cqbase/'+b.pid).catch(()=>null);if(!s)return {status:404,body:{error:'no base yet'}};
 const {n,site,cc,pw,b:bl,w,bn,th,at}=s;return {status:200,body:{ok:true,base:{p:b.pid,n,site,cc,pw,b:bl,w:w||{},bn:bn||null,th:th||null,at}}};}
