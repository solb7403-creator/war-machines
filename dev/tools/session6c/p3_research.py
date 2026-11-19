R='./'
f='worker/src/conquest-research.js'
s=open(R+f).read()
def rep(old,new):
    global s
    n=s.count(old);assert n==1,(n,old[:150]);s=s.replace(old,new)
rep("""import {researchUnlock,researchLegStart} from './conquest-airdrop.js';
export const RESEARCH_ACTIONS=['research-start','research-seen'];""","""import {researchUnlock,researchLegStart} from './conquest-airdrop.js';
import {chipsHeld,spendChips,rolesOpen} from './conquest-battalion.js';
export const RESEARCH_ACTIONS=['research-start','research-seen','research-grant'];
// Session 6C (owner, Nov 18): the Role Cores track opens at Science Lab IV: a role's level 2-5 is a job here (RTREE.role; costs in
// command chips, ConquestBattalion.RC: chips and time only, never CP, 8 h, in the same research slots as the mods). Level 1 comes
// free with the role. A role's level reaches every pilot fitted with that Role Core (s.rs.rc, read by conquest-battalion.js).
const BT=CONQUEST.Battalion,RC_IDS=CONQUEST.Combat.ROLE_ORDER.map(r=>'rc:'+r),isRc=id=>RC_IDS.includes(id);""")
rep("""r.jobs=list(r.jobs).filter(j=>isMod(j.mod)&&typeof j.id==='string'&&R.CQ_PARTS[j.part]).map(j=>({id:j.id,mod:j.mod,part:j.part,paid:{e:int(j.paid?.e),b:int(j.paid?.b)},ms:int(j.ms),left:Math.max(0,Number(j.left)||0),at:int(j.at),st:int(j.st),pass:j.pass?1:0})).slice(0,3);""","""r.jobs=list(r.jobs).filter(j=>typeof j.id==='string'&&(isMod(j.mod)&&R.CQ_PARTS[j.part]||isRc(j.mod)&&j.part==='chip')).map(j=>({id:j.id,mod:j.mod,part:j.part,paid:{e:int(j.paid?.e),b:int(j.paid?.b)},ms:int(j.ms),left:Math.max(0,Number(j.left)||0),at:int(j.at),st:int(j.st),pass:j.pass?1:0,...(isRc(j.mod)?{lv:Math.max(2,Math.min(BT.RC.max,int(j.lv)))}:{})})).slice(0,3);
 const rc={};for(const k of CONQUEST.Combat.ROLE_ORDER)rc[k]=Math.max(1,Math.min(BT.RC.max,int(record(r.rc)?r.rc[k]:1)||1));r.rc=rc;   // Role Core levels (1 = free with the role)
 r.g=r.g==='thermal'||r.g==='coil'?r.g:'';   // the first Science Lab grant, once per account: the part picked""")
rep("""const a=record(r.acct)?r.acct:{};r.acct={bpt:R.CQ_PART_ORDER.reduce((o,k)=>(o[k]=int(a.bpt?.[k]),o),{}),prem:a.prem?1:0,at:int(a.at),lsm:""","""const a=record(r.acct)?r.acct:{};r.acct={bpt:R.CQ_PART_ORDER.reduce((o,k)=>(o[k]=int(a.bpt?.[k]),o),{}),bch:int(a.bch),prem:a.prem?1:0,at:int(a.at),lsm:""")
rep("""function finish(s,j,at){const r=research(s);r.jobs=r.jobs.filter(x=>x.id!==j.id);if(r.done[j.mod])return;r.done[j.mod]=at;researchUnlock(s,j.mod);""","""function finish(s,j,at){const r=research(s);r.jobs=r.jobs.filter(x=>x.id!==j.id);
 if(isRc(j.mod)){const role=j.mod.slice(3);r.rc[role]=Math.max(r.rc[role]|0,j.lv|0);s.notice={kind:'research-done',mod:j.mod,lv:r.rc[role],at};return;}   // a Role Core level: the Conquest record only (allies exist only in Conquest), never points
 if(r.done[j.mod])return;r.done[j.mod]=at;researchUnlock(s,j.mod);""")
rep("""r.acct={bpt:R.CQ_PART_ORDER.reduce((o,k)=>(o[k]=int(acct.bpt?.[k]),o),{}),prem:acct.prem?1:0,at:now,lsm:""","""r.acct={bpt:R.CQ_PART_ORDER.reduce((o,k)=>(o[k]=int(acct.bpt?.[k]),o),{}),bch:int(acct.bch),prem:acct.prem?1:0,at:now,lsm:""")
rep(""" const r=research(s);if(r.acct&&ctx&&(ctx.bpt||ctx.premium!==undefined))account(s,{bpt:ctx.bpt||r.acct.bpt,prem:!!ctx.premium,rsx:ctx.rsx,lsm:ctx.lsm},now);""",""" const r=research(s);if(r.acct&&ctx&&(ctx.bpt||ctx.premium!==undefined))account(s,{bpt:ctx.bpt||r.acct.bpt,bch:ctx.bch??r.acct.bch,prem:!!ctx.premium,rsx:ctx.rsx,lsm:ctx.lsm},now);
 // the first Science Lab grant (owner, Nov 18; planning pick for the mechanism): once your first Science Lab stands, pick Thermal
 // or Ballistics and take 2 of that research part, once per account, outside the one-a-day limit, so the first mod (2 parts) can
 // start that day (Checkpoint 41 open item 1)
 if(req.action==='research-grant'){if(r.g)fail('your first Science Lab grant is already taken');const L0=lab(s);if(!s.plot||!L0.any||L0.lv<1)fail('build your first Science Lab first');
  if(req.mod!=='thermal'&&req.mod!=='coil')fail('pick Thermal or Ballistics');const v=inventory(s),n=Math.max(0,Math.min(2,R.CQ_PART_MAX-v.pt[req.mod]));v.pt[req.mod]+=n;r.g=req.mod;s.notice={kind:'research-grant',part:req.mod,n};return;}""")
rep(""" if(!isMod(req.mod))fail('invalid mod');const premium=!!ctx.premium,q=R.rsQuote""",""" if(isRc(req.mod)){const role=req.mod.slice(3),premium=!!ctx.premium;if(L.lv<R.RTREE.role.lab)fail('Role Cores open with Science Lab level IV (Command Center 7)');if(!rolesOpen(s))fail('roles open with Hangar level II');
  if(r.jobs.some(j=>j.mod===req.mod))fail('already researching');const cur=r.rc[role]|0||1;if(cur>=BT.RC.max)fail('already at level '+BT.RC.max);const lv=cur+1,n=BT.RC.cost[lv],ms=Math.round(BT.RC.ms*(premium?R.RTREE.passTime:1));
  const slots=R.rsSlots(L.lv,premium);if(r.jobs.length>=slots)fail('every research slot is busy ('+slots+')');const paid=spendChips(s,n,ctx.bch??r.acct.bch);if(!paid)fail('needs '+n+' command chips (you have '+chipsHeld(s,ctx.bch??r.acct.bch).total+')');
  r.n++;r.jobs.push({id:'j'+r.n,mod:req.mod,part:'chip',paid,ms,left:ms,at:now,st:now,pass:premium?1:0,lv});s.notice={kind:'research-started',mod:req.mod,ms,part:'chip',n,lv};return;}
 if(!isMod(req.mod))fail('invalid mod');const premium=!!ctx.premium,q=R.rsQuote""")
open(R+f,'w').write(s)
print('research ok')
