// Science Lab research (Session 6B, owner decisions Nov 16 2026). Server-authoritative, on the Worker clock, separate from the
// builder. A job costs research parts only (js/rules.js RTREE, rsQuote): never CP, alloy, biomass or helium. One job at a time, a
// second slot once the Science Lab reaches level III, one more while the current season's premium Lunar Pass is owned (and 25%
// shorter jobs). A ruined Science Lab pauses every running job (js/conquest/plot.js VITAL_EFFECT lab: 'research paused'): the
// clock only runs while the lab stands. A finished job adds the mod to the Conquest record (s.rs.done) and rides this request's
// immutable outbox entry to the account (e.rm), where eco.js creditConquest writes S.rm exactly once; the garage, ecoLoadout and
// the PvP loadout check read ownership from there only.
// Parts: the pilot's earned parts (s.inv.pt, capped at 50 each) first, then bonus parts (Lunar Pass premium tiers and part
// packs): a running total on the account (eco S.bpt, it only grows) minus what research here has spent of it (s.rs.bs). A stale
// account read can refuse a job but never overspend (the same rule as the base stores' minerals).
import {CONQUEST,RULES as R} from './sim.gen.js';
import {inventory} from './conquest-loot.js';
import {researchUnlock,researchLegStart} from './conquest-airdrop.js';
export const RESEARCH_ACTIONS=['research-start','research-seen'];
const fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),int=v=>Math.max(0,Math.floor(Number(v)||0));
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const isMod=id=>typeof id==='string'&&R.RS_IDS.includes(id);   // the 16 earned mods and the 4 Legendary set mods (their free research path, Session 6B finish)
// The pilot's research record (additive; Firebase drops empty lists and maps, so every field is rebuilt on each load).
// jobs: [{id, mod, part, paid:{e,b}, ms (whole job), left (ms still to run), at (last tick, server clock), st (start), pass}]
// done: {mod: finished at} · bs: bonus parts spent per part · fx: instant-finish credits used (job ids) · seen: reveal cards shown
// acct: the account's research view at the last session open or research action (bonus parts held, premium pass)
export function research(s){
 const r=record(s.rs)?s.rs:(s.rs={});r.v=1;r.n=int(r.n);
 r.jobs=list(r.jobs).filter(j=>isMod(j.mod)&&typeof j.id==='string'&&R.CQ_PARTS[j.part]).map(j=>({id:j.id,mod:j.mod,part:j.part,paid:{e:int(j.paid?.e),b:int(j.paid?.b)},ms:int(j.ms),left:Math.max(0,Number(j.left)||0),at:int(j.at),st:int(j.st),pass:j.pass?1:0})).slice(0,3);
 const done={};for(const [k,t] of Object.entries(record(r.done)?r.done:{}))if(isMod(k))done[k]=int(t)||1;r.done=done;
 const bs={};for(const k of R.CQ_PART_ORDER)bs[k]=int(record(r.bs)?r.bs[k]:0);r.bs=bs;
 const fx={};for(const k of Object.keys(record(r.fx)?r.fx:{}))if(/^j\d{1,6}$/.test(k))fx[k]=1;r.fx=fx;
 const seen={};for(const k of Object.keys(record(r.seen)?r.seen:{}))if(isMod(k))seen[k]=1;r.seen=seen;
 const a=record(r.acct)?r.acct:{};r.acct={bpt:R.CQ_PART_ORDER.reduce((o,k)=>(o[k]=int(a.bpt?.[k]),o),{}),prem:a.prem?1:0,at:int(a.at),lsm:(Array.isArray(a.lsm)?a.lsm:record(a.lsm)?Object.values(a.lsm):[]).filter(id=>R.RTREE_LEG.includes(id))};
 return r;}
// The Science Lab: its level (the highest lab building's) and whether it stands (a ruined lab pauses research).
export function lab(s){const p=s.plot;let lv=0,ruined=false,any=false;if(!p?.b)return {lv,ruined,any};const PL=CONQUEST.Plot;
 for(const [id,b] of Object.entries(p.b)){if(b?.t!=='lab'||!(b.l>0))continue;any=true;lv=Math.max(lv,b.l|0);if(PL.ruined(p,id))ruined=true;}return {lv,ruined,any};}
// bonus parts still unspent: the account's total (fresh in an action's ctx, else the last view) minus what research spent here
export function bonusLeft(s,bpt){const r=research(s),src=record(bpt)?bpt:r.acct.bpt,o={};for(const k of R.CQ_PART_ORDER)o[k]=Math.max(0,int(src?.[k])-r.bs[k]);return o;}
export function partsHeld(s,bpt){const v=inventory(s),b=bonusLeft(s,bpt),o={};for(const k of R.CQ_PART_ORDER)o[k]={earned:v.pt[k],bonus:b[k],total:v.pt[k]+b[k]};return o;}
function finish(s,j,at){const r=research(s);r.jobs=r.jobs.filter(x=>x.id!==j.id);if(r.done[j.mod])return;r.done[j.mod]=at;researchUnlock(s,j.mod);
 s.notice={kind:'research-done',mod:j.mod,at};}
// Advance every running job to upTo (server clock). Paused while the lab is ruined or gone: the clock moves, the job does not.
export function tick(s,upTo){const r=research(s);if(!r.jobs.length)return;const L=lab(s),run=L.any&&!L.ruined;
 for(const j of [...r.jobs]){const dt=Math.max(0,upTo-(j.at||upTo));j.at=Math.max(j.at||0,upTo);if(run)j.left=Math.max(0,j.left-dt);if(j.left<=0)finish(s,j,upTo);}}
// The account side of research at a session open or a research action: bonus parts and the premium pass for the lab screen, and
// instant-finish credits (eco S.rsx, written only by a verified purchase: Session 8 certifies payments; checkout is off).
export function account(s,acct,now){const r=research(s);if(!record(acct))return r;
 r.acct={bpt:R.CQ_PART_ORDER.reduce((o,k)=>(o[k]=int(acct.bpt?.[k]),o),{}),prem:acct.prem?1:0,at:now,lsm:R.RTREE_LEG.filter(id=>record(acct.lsm)&&acct.lsm[id])};   // lsm: the Legendary set mods bought (the lab screen shows them owned; research refuses them)
 const rsx=record(acct.rsx)?acct.rsx:{};for(const j of [...r.jobs])if(rsx[j.id]&&!r.fx[j.id]){r.fx[j.id]=1;finish(s,j,now);}
 return r;}
export function researchAction(s,req,now,ctx={}){
 const r=research(s);if(r.acct&&ctx&&(ctx.bpt||ctx.premium!==undefined))account(s,{bpt:ctx.bpt||r.acct.bpt,prem:!!ctx.premium,rsx:ctx.rsx,lsm:ctx.lsm},now);
 if(req.action==='research-seen'){if(!isMod(req.mod))fail('invalid mod');if(!r.done[req.mod])fail('not researched yet');r.seen[req.mod]=1;s.notice={kind:'research-seen',mod:req.mod};return;}
 if(req.action!=='research-start')fail('invalid research action');
 if(!s.plot)fail('claim your town first: the Science Lab is built in it');const L=lab(s);
 if(!L.any||L.lv<1)fail('build a Science Lab first (Command Center 3)');if(L.ruined)fail('the Science Lab is ruined: repair it to research');
 if(!isMod(req.mod))fail('invalid mod');const premium=!!ctx.premium,q=R.rsQuote(r,req.mod,L.lv,premium,record(ctx.lsm)?ctx.lsm:{});if(q.err)fail(q.err);   // a Legendary set mod: Science Lab III, its track's set mod researched, never one already bought (the account's record, read fresh)
 const slots=R.rsSlots(L.lv,premium);if(r.jobs.length>=slots)fail('every research slot is busy ('+slots+')');
 const v=inventory(s),b=bonusLeft(s,ctx.bpt),have=v.pt[q.part]+b[q.part];if(have<q.n)fail('needs '+q.n+' '+R.CQ_PARTS[q.part].n+(q.n>1?'s':'')+' (you have '+have+')');
 const e=Math.min(v.pt[q.part],q.n),bb=q.n-e;v.pt[q.part]-=e;r.bs[q.part]+=bb;
 r.n++;const j={id:'j'+r.n,mod:req.mod,part:q.part,paid:{e,b:bb},ms:q.ms,left:q.ms,at:now,st:now,pass:premium?1:0};r.jobs.push(j);
 if(q.leg)researchLegStart(s,req.mod);   // the account learns at once that this Legendary is being researched: from now on it cannot be bought (eco S.rsj)
 s.notice={kind:'research-started',mod:req.mod,ms:q.ms,part:q.part,n:q.n};}
