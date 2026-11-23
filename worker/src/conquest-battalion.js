// Session 6C Battalion on the Worker (owner prompt Nov 18; blueprint §4). Server-authoritative, in the pilot's own Conquest record
// (s.bat): the roster of named recruits, the first wingman, recruits (the daily BEACON EXTRACTION win, the Hangar's RECRUIT job on
// the Worker clock), ranks, AUTO-ARM from the account's spare owned gear (read from the account record, never from the phone),
// presets and formations, repairs, command chips, liveries. The rules are js/conquest/battalion.js (ConquestBattalion), shared
// with the phone. Never sold: pilots, ranks, Role Core levels. Nothing here ever pays airdrop points.
import {CONQUEST,RULES as R} from './sim.gen.js';
import {bind} from './conquest-loot.js';
const {Combat:C,World:W,Battalion:BT}=CONQUEST,DAY=86400000;
const fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),int=v=>Math.max(0,Math.floor(Number(v)||0));
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const ids=v=>(Array.isArray(v)?v:record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[]).filter(x=>typeof x==='string');
export const BAT_ACTIONS=['hangar-role','hangar-preset','hangar-arm','hangar-repair','hangar-recruit','hangar-livery','hangar-gear'];
const ROLES=['',...C.ROLE_ORDER];
const kitOk=k=>record(k)&&record(k.w)&&record(k.c);
const cleanKit=k=>{if(!kitOk(k))return null;const L=C.allyLoadout(k);return {w:{a:L.w.a,t:L.w.t,q:L.w.q,s:!!k.w.s&&L.w.t>=1},c:{c:L.c.c,t:L.c.t,q:L.c.q,s:!!k.c.s&&L.c.t>=1},...(k.mil?{mil:1}:{})};};
// The pilot's battalion record (additive; Firebase drops empty lists and maps, so every field is rebuilt on each load).
// n: pilots made · p: the roster [{id, n name, cs call sign, r role, xp, rk rank, k kills, h hull 1 | 0.5, kit, at, src}] ·
// ps: three presets [{f formation, ids: the picked force in order}] · pa: the active preset · rj: the RECRUIT job {id, at, ms, left}
// · rn: RECRUIT jobs made · rd: the UTC day of the last daily rescue recruit · w: the first wingman rescued · ch: command chips
// {e earned held, d the UTC day of the last earned chip, bs pack chips spent} · lv: the equipped livery · g: the account's owned
// gear (AUTO-ARM's input, cached from the last account read) · own: the pilot's own weapon and chassis then (not spare)
export function bat(s){const T=record(s.bat)?s.bat:(s.bat={});T.v=1;T.n=int(T.n);T.rn=int(T.rn);T.rd=int(T.rd);T.w=T.w?1:0;
 T.p=list(T.p).filter(p=>typeof p.id==='string'&&/^p\d{1,4}$/.test(p.id)).slice(0,BT.ROSTER_MAX).map(p=>({id:p.id,n:String(p.n||'').slice(0,32),cs:String(p.cs||'').slice(0,16),r:ROLES.includes(p.r)?p.r:'',xp:int(p.xp),rk:Math.max(1,Math.min(10,int(p.rk)||1)),k:int(p.k),h:p.h===.5?.5:1,kit:cleanKit(p.kit),at:int(p.at),src:String(p.src||'recruit').slice(0,12),...(record(p.pin)&&(typeof p.pin.w==='string'&&p.pin.w||typeof p.pin.c==='string'&&p.pin.c)?{pin:{w:typeof p.pin.w==='string'?p.pin.w.slice(0,24):'',c:typeof p.pin.c==='string'?p.pin.c.slice(0,24):''}}:{})}));   // Session 7T: pin, the pilot's own gear picks (decision 8)
 const have=new Set(T.p.map(p=>p.id));T.ps=Array.from({length:BT.PRESETS},(_,i)=>{const x=list(T.ps)[i]||{};return {f:BT.FORMATIONS.includes(x.f)?x.f:'wedge',ids:[...new Set(ids(x.ids).filter(id=>have.has(id)))].slice(0,9)};});
 T.pa=Math.max(0,Math.min(BT.PRESETS-1,int(T.pa)));
 T.rj=record(T.rj)&&typeof T.rj.id==='string'?{id:T.rj.id,at:int(T.rj.at),ms:int(T.rj.ms)||BT.RECRUIT.ms,left:Math.max(0,Number(T.rj.left)||0)}:null;
 const ch=record(T.ch)?T.ch:{};T.ch={e:Math.min(BT.CHIP.max,int(ch.e)),d:int(ch.d),bs:int(ch.bs)};T.lv=typeof T.lv==='string'&&R.LIVERIES?.[T.lv]?T.lv:'';
 const g=record(T.g)?T.g:{};T.g={w:list(g.w).map(gearItem).filter(Boolean),c:list(g.c).map(gearItem).filter(Boolean)};T.own=record(T.own)?{w:record(T.own.w)?{a:String(T.own.w.a||''),t:int(T.own.w.t),s:!!T.own.w.s}:null,c:record(T.own.c)?{c:String(T.own.c.c||''),t:int(T.own.c.t),s:!!T.own.c.s}:null}:{w:null,c:null};
 return T;}
function gearItem(x){if(!record(x)||typeof x.k!=='string')return null;return {k:x.k,t:Math.max(0,Math.min(2,int(x.t))),s:!!x.s,q:Number(x.q)>0&&Number(x.q)<2?Number(x.q):1,m:Number(x.m)>0&&Number(x.m)<3?Number(x.m):1};}
// The Hangar: its level (the highest Hangar's; one per town) and whether roles, orders and formations are open
export function hangarLevel(s){let lv=0;for(const b of Object.values(s.plot?.b||{}))if(b?.t==='hangar')lv=Math.max(lv,b.l|0);return lv;}
export const rolesOpen=s=>hangarLevel(s)>=BT.ROLES_AT;
// A role's Role Core level (Science Lab IV research, s.rs.rc): level 1 comes free with the role
export function rcLevel(s,role){if(!role||!rolesOpen(s))return 1;return Math.max(1,Math.min(BT.RC.max,int(s.rs?.rc?.[role])||1));}
const pnum=id=>Number(String(id).slice(1))|0;
export const unitId=p=>800000000+pnum(p.id);
// a new pilot: identity from the server seed (never repeating a call sign on the roster), a role once roles are open (the least
// represented one, changeable in the HANGAR), armed at once from the last known spare gear
export function newPilot(s,src,now){const T=bat(s);if(T.p.length>=BT.ROSTER_MAX)return null;const n=++T.n,who=BT.identity(String(s.lseed|0),n,T.p.map(p=>p.cs));
 let role='';if(rolesOpen(s)){const c=Object.fromEntries(C.ROLE_ORDER.map(r=>[r,T.p.filter(p=>p.r===r).length]));role=C.ROLE_ORDER.slice().sort((a,b)=>c[a]-c[b]||C.ROLE_ORDER.indexOf(a)-C.ROLE_ORDER.indexOf(b))[0];}
 const p={id:'p'+n,n:who.n,cs:who.cs,r:role,xp:0,rk:1,k:0,h:1,kit:null,at:now,src};T.p.push(p);arm(s);return p;}
// AUTO-ARM over the whole roster with the cached account gear: the active preset's pilots first, then the rest (one item per tank)
export function arm(s){const T=bat(s),pre=T.ps[T.pa]?.ids||[],order=[...pre.map(id=>T.p.find(p=>p.id===id)).filter(Boolean),...T.p.filter(p=>!pre.includes(p.id))];
 const kits=BT.autoArm(T.g,{w:T.own.w,c:T.own.c},order,pins(T));for(const p of T.p)p.kit=cleanKit(kits[p.id]);return kits;}
// Session 7T (owner decision 8): the pilots' own picks. Each pin names one of your spare owned items (the account record's gear, never
// the phone's); one pilot per item, never an item on your own tank; a pin whose item is gone (sold, refunded, now on your tank) drops
// and that slot goes back to AUTO-ARM.
function pins(T){const free=BT.spare(T.g,{w:T.own.w,c:T.own.c}),taken=new Set(),out={};
 for(const p of T.p){if(!p.pin)continue;const f={};for(const slot of ['w','c']){const k=p.pin[slot];if(!k)continue;const it=free[slot].find(x=>BT.keyOf(x)===k&&!taken.has(slot+k));if(it){f[slot]=it;taken.add(slot+k);}else p.pin[slot]='';}
  if(!p.pin.w&&!p.pin.c)delete p.pin;if(f.w||f.c)out[p.id]=f;}
 return out;}
// The account's owned weapons and chassis (crate rolls and salvage multipliers), from the account record only. own: the loadout
// the pilot fights with (its two items are not spare).
export function gearOf(S,L){const g={w:[],c:[]};const add=(isW,k,t,s,q)=>(isW?g.w:g.c).push({k,t,s,q:Math.round(q*1000)/1000,m:Math.round((s?q:R.TIER_MULT[t]*q)*1000)/1000});
 for(const k of R.WORDER){for(const t of (S.wOwn?.[k]||[]))if([0,1,2].includes(t))add(true,k,t,false,(S.roll?.[k+':'+t])||1);for(const t of [1,2]){const v=R.salvIn(S,k,t);if(v)add(true,k,t,true,v);}}
 for(const k of R.CHORDER){for(const t of (S.cOwn?.[k]||[]))if([0,1,2].includes(t))add(false,k,t,false,(S.roll?.[k+':'+t])||1);for(const t of [1,2]){const v=R.salvIn(S,k,t);if(v)add(false,k,t,true,v);}}
 if(S.moonbeam)g.w.push({k:'moon',t:2,s:false,q:1,m:R.LEGENDARY_MULT});
 return {g,own:{w:L?.w?{a:L.w.a,t:L.w.t|0,s:!!L.w.s}:null,c:L?.c?{c:L.c.c,t:L.c.t|0,s:!!L.c.s}:null}};}
// at a session open or an AUTO-ARM: the account's gear view, then arm everyone (and the account's livery and instant-finish credits)
export function account(s,acct,now){const T=bat(s);if(!record(acct))return T;if(acct.gear){T.g=acct.gear.g;T.own=acct.gear.own;bat(s);arm(s);}
 if(T.lv&&!(record(acct.liv)&&acct.liv[T.lv]))T.lv='';   // a livery no longer owned (a refund) comes off
 if(T.rj&&record(acct.rcx)&&acct.rcx[T.rj.id])recruitDone(s,now,'finish');   // a RECRUIT job finished in the Lab store (checkout is off until Session 8)
 return T;}
function recruitDone(s,now,how){const T=bat(s);if(!T.rj)return;T.rj=null;const p=newPilot(s,'recruit',now);s.notice={kind:'recruit-joined',pilot:p?.id||null,cs:p?.cs||'',how};}
// The RECRUIT job runs on the Worker clock while a Hangar stands
export function tick(s,now){const T=bat(s);if(!T.rj)return;const dt=Math.max(0,now-(T.rj.at||now));T.rj.at=Math.max(T.rj.at||0,now);if(hangarLevel(s)>0)T.rj.left=Math.max(0,T.rj.left-dt);if(T.rj.left<=0)recruitDone(s,now,'job');}
// ---- fielding: the friendly units in a battle follow the roster (the active preset, the fight size, the Hangar's field cap) ----
const hd=b=>Number.isFinite(b?.squad?.hd)?b.squad.hd:Number.isFinite(b?.heading)?b.heading:0;
function slotAt(b,pos,i){const F=C.FORMS[b.squad?.f]||C.FORMS.wedge,o=F[Math.max(0,i)%F.length],h=hd(b);return {x:pos.x+Math.cos(h)*o[0]+Math.sin(h)*o[1],z:pos.z-Math.sin(h)*o[0]+Math.cos(h)*o[1]};}
function openAt(x,z){if(x<4||z<4||x>W.WIDTH-4||z>W.LENGTH-4||W.solidAt(x,z)||W.waterAt?.(x,z)?.deep)return false;const p={x,z,y:W.groundAt(x,z),surface:'ground'},q=W.advance(p,1.2,0);return Math.hypot(q.x-x,q.z-z)>.6;}
function placeNear(b,pos,i){const s0=slotAt(b,pos,i);if(openAt(s0.x,s0.z))return s0;for(const r of [4,7,10,14,18])for(let k=0;k<12;k++){const a=k*Math.PI/6+i,x=pos.x+Math.cos(a)*r,z=pos.z+Math.sin(a)*r;if(openAt(x,z))return {x,z};}return {x:pos.x,z:pos.z};}
// b: the battle (a hydrated Battle or the saved plain record); pos: the pilot's position; scale: wing | platoon | battalion
export function field(s,b,pos,scale){const T=bat(s),lv=hangarLevel(s),want=BT.picked(T,lv,scale||'wing').filter(p=>p.kit||true);b.friends=Array.isArray(b.friends)?b.friends:[];b.squad=record(b.squad)?b.squad:{o:'follow',t:0,x:0,z:0,at:0,f:'wedge',orders:0};
 b.squad.orders=rolesOpen(s)?1:0;b.squad.f=rolesOpen(s)?(T.ps[T.pa]?.f||'wedge'):'wedge';if(!b.squad.orders&&b.squad.o!=='follow'){b.squad.o='follow';b.squad.t=0;}
 const keep=[];want.forEach((p,i)=>{const kit=p.kit||BT.militia(p.r),m=BT.strength(p.rk,rcLevel(s,p.r)),sg=JSON.stringify([kit,p.r,m,p.h]);let f=b.friends.find(u=>u.side==='mine'&&u.pid===p.id);
  if(f&&f.sg!==sg){const frac=f.down?0:f.hp/f.maxHp,n=C.friendUnit({id:unitId(p),side:'mine',pid:p.id,role:p.r,kit,m,x:f.x,z:f.z,hull:p.h,name:p.cs,heading:f.heading});n.hp=f.down?0:Math.max(1,Math.min(n.maxHp*p.h,Math.round(n.maxHp*frac)));n.down=f.down;n.hurt=f.hurt||0;n.hc=p.h;n.kills=f.kills|0;f=n;}
  if(!f){const at=placeNear(b,pos,i);f=C.friendUnit({id:unitId(p),side:'mine',pid:p.id,role:p.r,kit,m,x:at.x,z:at.z,hull:p.h,name:p.cs,heading:hd(b)});f.hc=p.h;}
  f.sg=sg;keep.push(f);});
 b.friends=[...keep,...b.friends.filter(u=>u.side!=='mine')].slice(0,C.CAPS.friends);return b.friends;}
// after a request: what the battle did to the roster (a downed pilot needs a repair; kills to its card)
export function sync(s,b){const T=bat(s);for(const f of b?.friends||[]){if(f.side!=='mine')continue;const p=T.p.find(x=>x.id===f.pid);if(!p)continue;if(f.hurt&&p.h!==.5){p.h=.5;f.sg='';}if(f.kills>0){p.k+=f.kills|0;f.kills=0;}}}
// a fight that ended: downed units come back at half hull (never lost; repaired with alloy at the Refuge or your town)
export function recover(s,b){for(const f of b?.friends||[])if(f.side==='mine'&&f.down){f.down=0;f.dt=0;f.hurt=1;f.hc=C.ALLY.downHull;f.hp=Math.max(1,Math.round(f.maxHp*C.ALLY.downHull));}sync(s,b);}
// after a fast travel, a RECALL or a respawn: your units come along, around the pilot's new position
export function regroup(s,b,pos){(b.friends||[]).filter(f=>f.side==='mine').forEach((f,i)=>{const at=placeNear(b,pos,i);f.x=at.x;f.z=at.z;f.y=W.groundAt(at.x,at.z);f.surface='ground';f.vx=f.vz=0;f.tgt=0;f.dash=null;});}
// ---- the end of an operation: XP and ranks, the day's command chip, the daily rescue recruit, the first wingman ----
export function outcome(s,B,op,result,now){const T=bat(s),mine=(B.friends||[]).filter(f=>f.side==='mine'),out={};if(!op)return out;
 if(result==='victory'&&op.id===BT.WINGMAN.id&&!T.w){T.w=1;const p=newPilot(s,'wingman',now);if(p)out.joined={id:p.id,n:p.n,cs:p.cs};}
 const xp=result==='victory'?BT.XP[op.danger]||1:result==='defeat'&&B.time>=BT.FOUGHT_S?1:0;
 if(xp>0&&mine.length){out.xp=xp;out.up=[];for(const f of mine){const p=T.p.find(x=>x.id===f.pid);if(!p)continue;const r0=p.rk;p.xp+=xp;p.rk=Math.min(r0+1,BT.rankOf(p.xp));if(p.rk>r0)out.up.push({id:p.id,cs:p.cs,rk:p.rk,sig:BT.sigTier(p.rk)>BT.sigTier(r0)});}if(!out.up.length)delete out.up;}   // at most one rank an operation
 if(result==='victory'&&mine.length){const c=grantChip(s,'win',now);if(c)out.chip=c;}
 if(result==='victory'&&op.id==='rescue'){const d=Math.floor(now/DAY);if(T.rd!==d&&T.p.length<BT.ROSTER_MAX){T.rd=d;const p=newPilot(s,'rescue',now);if(p)out.recruit={id:p.id,n:p.n,cs:p.cs};}}
 recover(s,B);return out;}
// Command chips: one earned a UTC day (the Worker's clock). src 'win': the day's first win (a later win gives nothing); any other
// source (none this session; built for later ones) gives 1 cosmetic fragment of pool CHIP.swap once the day's chip is taken. A chip
// the 50 cap turns away is not taken and does not use up the day.
export function grantChip(s,src,now){const T=bat(s),day=Math.floor(now/DAY);
 if(T.ch.d===day){if(src==='win')return null;const got=bind(s,{fr:{[BT.CHIP.swap]:1}},now,{where:'command chip'});return {swap:1,pool:BT.CHIP.swap,got};}   // the day's chip is taken
 if(T.ch.e>=BT.CHIP.max)return {full:1,held:T.ch.e};T.ch.e++;T.ch.d=day;return {chip:1,held:T.ch.e};}
export const chipsToday=(s,now)=>bat(s).ch.d===Math.floor(now/DAY)?1:0;
// chips a Role Core job can use: earned ones first, then pack chips (the account's eco S.bch total, minus what was spent here)
export function chipsHeld(s,bch){const T=bat(s),b=Math.max(0,int(bch)-T.ch.bs);return {earned:T.ch.e,bonus:b,total:T.ch.e+b};}
export function spendChips(s,n,bch){const T=bat(s),h=chipsHeld(s,bch);if(h.total<n)return null;const e=Math.min(T.ch.e,n),b=n-e;T.ch.e-=e;T.ch.bs+=b;return {e,b};}
// ---- HANGAR actions (from anywhere outside a fight: the Hangar is commanded by radio; repairs only at the Refuge or your town) ----
export function batAction(s,req,now,ctx={}){const T=bat(s),q=record(req.bat)?req.bat:{};if(s.mission)fail('finish or leave the operation first');
 if(req.action==='hangar-role'){if(!rolesOpen(s))fail('roles open with Hangar level II');const p=T.p.find(x=>x.id===q.pilot);if(!p)fail('no such pilot');if(!C.ROLE_ORDER.includes(q.role))fail('invalid role');p.r=q.role;arm(s);s.notice={kind:'hangar-role',pilot:p.id,role:p.r};return;}
 if(req.action==='hangar-preset'){const i=int(q.i);if(i>=BT.PRESETS)fail('invalid preset');const have=new Set(T.p.map(p=>p.id)),list=Array.isArray(q.ids)?q.ids.filter(id=>typeof id==='string'&&have.has(id)):T.ps[i].ids;
  if(new Set(list).size!==list.length||list.length>9)fail('invalid force');const f=q.f===undefined?T.ps[i].f:q.f;if(!BT.FORMATIONS.includes(f))fail('invalid formation');if(f!==T.ps[i].f&&!rolesOpen(s))fail('formations open with Hangar level II');
  T.ps[i]={f,ids:list};T.pa=i;arm(s);s.notice={kind:'hangar-preset',i};return;}
 if(req.action==='hangar-arm'){if(ctx.gear){T.g=ctx.gear.g;T.own=ctx.gear.own;bat(s);}for(const p of T.p)delete p.pin;arm(s);s.notice={kind:'hangar-armed',n:T.p.length};return;}   // AUTO-ARM, the one-tap option: every pilot on your best spare gear (your picks cleared)
 // Session 7T (owner decision 8): pick a pilot's weapon and chassis from your spare owned items. bat: {pilot, w: item key | '' (AUTO),
 // c: item key | '' (AUTO)} (a slot left out stays as it is). The gear is the account record's (ctx.gear, read on this action).
 if(req.action==='hangar-gear'){if(ctx.gear){T.g=ctx.gear.g;T.own=ctx.gear.own;bat(s);}const p=T.p.find(x=>x.id===q.pilot);if(!p)fail('no such pilot');const free=BT.spare(T.g,{w:T.own.w,c:T.own.c}),want={};
  for(const slot of ['w','c']){if(q[slot]===undefined)continue;if(typeof q[slot]!=='string'||q[slot].length>24)fail('invalid gear');if(q[slot]&&!free[slot].some(x=>BT.keyOf(x)===q[slot]))fail(slot==='w'?'that weapon is not one of your spare weapons (your own tank keeps its gun)':'that chassis is not one of your spare chassis (your own tank keeps its hull)');want[slot]=q[slot];}
  if(!Object.keys(want).length)fail('pick a weapon or a chassis');const moved=[];
  for(const [slot,k] of Object.entries(want)){if(k)for(const o of T.p)if(o!==p&&o.pin?.[slot]===k){o.pin[slot]='';moved.push(o.cs);if(!o.pin.w&&!o.pin.c)delete o.pin;}   // one pilot per item: it moves to this pilot
   p.pin=p.pin||{w:'',c:''};p.pin[slot]=k;}
  if(p.pin&&!p.pin.w&&!p.pin.c)delete p.pin;arm(s);s.notice={kind:'hangar-gear',pilot:p.id,kit:p.kit,...(moved.length?{moved}:{})};return;}
 if(req.action==='hangar-recruit'){if(hangarLevel(s)<1)fail('build a Hangar first (Command Center 2)');if(T.rj)fail('a recruit is already on the way');if(T.p.length>=BT.ROSTER_MAX)fail('the roster is full ('+BT.ROSTER_MAX+')');
  T.rn++;T.rj={id:'r'+T.rn,at:now,ms:BT.RECRUIT.ms,left:BT.RECRUIT.ms};s.notice={kind:'recruit-started',ms:BT.RECRUIT.ms};return;}
 if(req.action==='hangar-repair'){const hurt=T.p.filter(p=>p.h<1);if(!hurt.length)fail('every pilot is at full hull');if(!ctx.atRepair)fail('repair your pilots at the Refuge or your town');
  const cost=BT.REPAIR.alloy*hurt.length;if((s.ledger?.banked?.alloy|0)<cost)fail('needs '+cost+' banked alloy');s.ledger.banked.alloy-=cost;for(const p of hurt)p.h=1;
  for(const f of s.battle?.friends||[])if(f.side==='mine'&&hurt.some(p=>p.id===f.pid)){f.hurt=0;f.hc=1;f.down=0;f.hp=f.maxHp;f.sg='';}s.notice={kind:'hangar-repaired',n:hurt.length,alloy:cost};return;}
 if(req.action==='hangar-livery'){const id=typeof q.id==='string'?q.id:'';if(id&&!R.LIVERIES?.[id])fail('invalid livery');if(id&&!(record(ctx.liv)&&ctx.liv[id]))fail('not yours yet');T.lv=id;s.notice={kind:'hangar-livery',id};return;}
 fail('invalid hangar action');}
