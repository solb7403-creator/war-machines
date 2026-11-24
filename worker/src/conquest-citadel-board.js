// Session 7B Throne Run clear-time board (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md): one shared document per Citadel
// tier per UTC week, the 20 fastest pilots, each with their best time. Written only by the Worker after a request it committed that
// recorded a Throne Run clear (s.cit.lb: the Worker's own assault clock, from the pilot's verified commands; never a time the phone
// sends), through the same compare-and-swap as the warfront document, so retries and parallel tabs cannot double-write or lose a
// time. Read by the phone through /api/conquest/citadel-board (names and times only; the pilot ids stay on the server).
import {readTag,writeIf} from './eco.js';
import {dbGet} from './db.js';
import {CONQUEST} from './sim.gen.js';
const CI=CONQUEST.Citadel,TOP=20,path=(w,t)=>'conquestCitadel/board/'+w+'/'+t;
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const rows=doc=>(Array.isArray(doc?.top)?doc.top:record(doc?.top)?Object.values(doc.top):[]).filter(r=>record(r)&&typeof r.p==='string'&&Number.isSafeInteger(r.ms)&&r.ms>0);
// after a committed request: post the pilot's new weekly best (idempotent: a time that is not better changes nothing)
export async function citadelBoardPost(env,pid,name,state,now){const lb=state?.cit?.lb;if(!lb||lb.at!==now||typeof pid!=='string'||/[.#$\[\]/]/.test(pid))return null;
 const w=Math.floor(Number(lb.w)),t=Math.max(1,Math.min(9,lb.t|0)),ms=Math.max(1,lb.ms|0);if(w!==CI.weekOf(now))return null;
 for(let n=0;n<8;n++){const {v,tag}=await readTag(env,path(w,t)),list=rows(v),old=list.find(r=>r.p===pid);if(old&&old.ms<=ms)return v;
  const next=[...list.filter(r=>r.p!==pid),{p:pid,n:String(name||'PILOT').slice(0,16),ms,at:now}].sort((a,b)=>a.ms-b.ms||a.at-b.at).slice(0,TOP);
  if(!next.some(r=>r.p===pid))return v;const doc={v:1,w,t,top:next,at:now};if(await writeIf(env,path(w,t),doc,tag))return doc;}
 return null;}
// the board for the phone: this week's tier t, names and times, the caller's own row marked
export async function citadelBoardRead(env,pid,tier,now){const t=Math.max(1,Math.min(9,tier|0)),w=CI.weekOf(now);const [v,fh]=await Promise.all([dbGet(env,path(w,t)).catch(()=>null),dbGet(env,'fh').catch(()=>null)]);
 const held=id=>!!(fh&&fh[id]);   // pilots under review sit out the public lists, as on the leaderboard
 return {tier:t,w,top:rows(v).filter(r=>!held(r.p)).sort((a,b)=>a.ms-b.ms).slice(0,TOP).map(r=>({n:r.n,ms:r.ms,...(r.p===pid?{me:1}:{})})),par:CI.CIT.par*60000};}
// POST /api/conquest/citadel-board {t}: read only
export async function conquestCitadelBoard(env,a,now=Date.now()){const b=a.b||{};if(Object.keys(b).some(k=>!['gv','initData','t'].includes(k))||!Number.isSafeInteger(b.t)||b.t<1||b.t>CI.CIT.live)return {status:400,body:{error:'invalid board'}};
 return {status:200,body:{ok:true,board:await citadelBoardRead(env,a.pid,b.t,now)}};}
