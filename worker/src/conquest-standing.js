// Session 7C STEP 2 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; old brief A): the pilot's live airdrop standing and the trust
// line, for the hub card (js/conquest/standing.js). Read only; a research ranking, never a promise of tokens (RULES.AIRDROP.dist false).
//  - Standing: the points pool is the top RULES.AIRDROP.ptsTop by play score (ads/<pid>, the same index the pool reads), pilots under
//    review left off. The leaderboard cron (index.js airdropBoards) writes the pool's scores as it ranked them (adp: descending, every 5
//    minutes); the pilot's own score is read live, so the rank is the live score against that board. The next mark (#800, #100 ...)
//    and the points to it; outside the pool, the points to its last place.
//  - Today: the points the pilot banked today that count against the 50,000 shared daily cap (the Citadel bounties are outside it).
//  - Trust: "verified play N%" = the share of the pilot's last 30 UTC days (fewer for a newer account) without a flag; a pilot under
//    review sees "under review" and the rule (plays on, sits out the boards and the airdrop snapshot until the review clears them).
import {dbGet} from './db.js';import {flagReasons} from './eco.js';import {RULES as R} from './sim.gen.js';
const DAY=86400000,WINDOW=30,MARKS=[1000,900,800,700,600,500,400,300,250,200,150,100,75,50,25,10,5,3,2,1];
// the pool's scores, cached per isolate for a minute (the cron rewrites them every 5)
const POOL=new WeakMap();
async function poolOf(env,now){const c=POOL.get(env);if(c&&now-c.at<60000)return c.v;let v=null;try{v=await dbGet(env,'adp');}catch(e){if(c)return c.v;}POOL.set(env,{at:now,v});return v;}
export const scoresOf=adp=>Array.isArray(adp?.s)?adp.s.map(Number).filter(Number.isFinite):[];
// 1 + the scores above (the list is descending)
export function rankOf(S,score){let lo=0,hi=S.length;while(lo<hi){const m=(lo+hi)>>1;if(S[m]>score)lo=m+1;else hi=m;}return lo+1;}
export function standingOf(S,score,top=R.AIRDROP.ptsTop){score=Math.max(0,Math.round(Number(score)||0));const rank=score>0?rankOf(S,score):null,full=S.length>=top,inPool=!!rank&&(rank<=top)&&(!full||score>=S[top-1]);
 const out={score,rank:inPool?rank:null,inPool,top,n:Math.min(S.length,top)};
 if(!inPool){out.toPool=full?Math.max(1,S[top-1]-score+1):score>0?0:1;return out;}
 const mark=MARKS.find(m=>m<rank);if(mark){out.next={rank:mark,pts:Math.max(1,S[mark-1]-score+1)};}return out;}
// the days of the window on which a flag was active (raised, and not yet cleared then)
export function trustOf(f,fd,now){const today=Math.floor(now/DAY),age=Number.isFinite(Number(fd))?today-Number(fd)+1:WINDOW,win=Math.max(1,Math.min(WINDOW,age)),from=today-win+1,bad=new Set();
 for(const [k,r] of Object.entries(f?.r||{})){const t=Number(r?.t)||0;if(!t)continue;const ok=Number(f?.ok?.[k])||0,end=ok>=t?ok:now;for(let d=Math.max(from,Math.floor(t/DAY));d<=Math.min(today,Math.floor(end/DAY));d++)bad.add(d);}
 const held=flagReasons(f).length>0;return {p:Math.round(100*(win-bad.size)/win),days:win,flagged:bad.size,held};}
// POST /api/conquest/standing
export async function conquestStanding(env,a,now=Date.now()){const pid=a.pid;
 const [score,P,f,adp]=await Promise.all([dbGet(env,'ads/'+pid).catch(()=>0),dbGet(env,'players/'+pid).catch(()=>null),dbGet(env,'flags/'+pid).catch(()=>null),poolOf(env,now)]);
 const day=Math.floor(now/DAY),today=P&&P.d===day?Math.max(0,(Number(P.dailyPts)||0)-(Number(P.fxn)||0)):0,tr=trustOf(f,P?.fd,now);
 const st=tr.held?{score:Math.max(0,Math.round(Number(score)||0)),rank:null,inPool:false,top:R.AIRDROP.ptsTop,n:0,held:true}:standingOf(scoresOf(adp),score);
 return {status:200,body:{ok:true,st:{...st,today,cap:R.DAILY_CAP,trust:{p:tr.p,days:tr.days,held:tr.held},t:Number(adp?.t)||0,dist:R.AIRDROP.dist===true}}};}
