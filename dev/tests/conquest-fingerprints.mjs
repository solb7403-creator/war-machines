// Session 7C STEP 2 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md): Conquest command fingerprints and their flags, through the
// real Worker reducer (applyCommands) and the real account credit (eco.js creditConquest on a fake Firebase), and the cqalt cluster hint.
//  1. every fingerprint is at most 200 bytes; the record keeps the last 20; the phone never sees them;
//  2. scripted bots: a bot replaying one raid three times in a day raises cqrepeat; a pilot nobody drives whose Battalion wins three
//     operations raises cqnoinput; each is queued once per pilot and rides the outbox like a bounty;
//  3. recorded human-variance fixtures (dev/tests/fixtures/cq-human-variance.json.gz, recorded from dev/tools/human-input-model.mjs:
//     the same raid four times in a day, parked defenders who only aim and fire, field work; two pilots) raise nothing;
//  4. the account raises a delivered flag once (S.fl), writes flags/<pid> through addFlags, ignores any other key;
//  5. cqalt: two signals inside a linked cluster flag the extra accounts (never the main one); one signal, or a cleared cluster, nothing;
//     the admin row's clear clears it.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
import {makeDB} from './wtest/fakedb.mjs';
const db=makeDB({});globalThis.fetch=async(url,init={})=>{if(!String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request');return db.handle(url,init);};
const {harness,decode}=await import('./lib/cq-replay.mjs');const H=await harness();const {applyAction}=await import('../../worker/src/conquest-sim.js');
const {FP,verdicts}=await import('../../worker/src/conquest-fingerprint.js');const {publicState}=await import('../../worker/src/conquest.js');
const {creditConquest}=await import('../../worker/src/eco.js');const {shared,cqAltScan,townHash,ALT}=await import('../../worker/src/conquest-alt.js');const {clearCluster}=await import('../../worker/src/farm.js');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const env={BOT_TOKEN:'fp-test',FIREBASE_DB_SECRET:'SECRET'},t0=Date.UTC(2026,10,25,8),DAY=86400000;
const back=(r)=>{try{const s=applyAction(r.s,{seq:r.s.seq+1,action:'return-exploration'},r.now+1000);H.seal(s,r.now+1000);return s;}catch(e){return r.s;}};
const flagsOut=s=>(s.airdrop?.out||[]).flatMap(e=>(e.fl||[]).map(f=>f.k));
// ---- 1. size, the last 20, never on the phone ----
{let s=H.pilot(t0),n=0,big=[];for(const id of Object.keys(H.C.operations)){s=H.begin(s,id,s.lastWall||t0);const r=H.run(s,H.bot,t0,{maxS:12});s=back(r);const f=s.fp?.at(-1);if(f&&f.o===id){n++;const b=JSON.stringify(f).length;if(b>FP.maxBytes)big.push(id+' '+b);}}
 ok(n>=50&&!big.length,'1. every operation\'s fingerprint is at most '+FP.maxBytes+' bytes ('+n+' operations fingerprinted, the largest '+Math.max(...s.fp.map(f=>JSON.stringify(f).length))+' bytes)'+(big.length?' TOO BIG: '+big.join(', '):''));
 ok(s.fp.length===FP.keep,'the record keeps the last '+FP.keep+' fingerprints');
 const pub=publicState({...s,fpa:{o:'x'}});ok(!('fp' in pub)&&!('fpa' in pub)&&!('fpf' in pub),'the phone never receives fingerprints, the accumulator or the queued flags (publicState)');}
// ---- 2. scripted bots ----
let botRec=null;
{let s=H.pilot(t0,{seed:91});for(let i=0;i<3;i++){s=H.begin(s,'raid-intercept-1',s.lastWall||t0);s=back(H.run(s,H.bot,t0,{maxS:150}));}
 const fl=flagsOut(s);ok(fl.filter(k=>k==='cqrepeat').length===1&&s.fpf?.cqrepeat,'2. a bot replaying one raid three times in a day raises cqrepeat (the fingerprints: '+s.fp.slice(-3).map(f=>f.ph+' '+f.t+' s ic '+f.ic).join(' | ')+')');
 s=H.begin(s,'raid-intercept-1',s.lastWall||t0);s=back(H.run(s,H.bot,t0,{maxS:150}));ok(flagsOut(s).filter(k=>k==='cqrepeat').length<=1&&(s.airdrop.out||[]).filter(e=>(e.fl||[]).some(f=>f.k==='cqrepeat')).length<=1,'... queued once per pilot (a fourth repeat adds nothing)');botRec=s;}
{let s=H.pilot(t0,{seed:92}),won=0;const idle=()=>({x:0,z:0});for(const id of ['sector-defense-refuge','sector-defense-refuge','sector-defense-refuge','sector-defense-refuge','sector-defense-refuge']){s=H.begin(s,id,s.lastWall||t0,{allies:9});const r=H.run(s,idle,t0,{maxS:240});if(r.s.battle.state==='victory')won++;s=back(r);if(s.fpf?.cqnoinput)break;}
 const f=s.fp.filter(x=>x.ic===0&&x.r==='v');ok(won>=3&&s.fpf?.cqnoinput&&flagsOut(s).includes('cqnoinput'),'a pilot nobody drives whose Battalion wins three operations raises cqnoinput ('+won+' won, '+f.length+' with no control change)');}
// ---- 3. recorded human-variance fixtures ----
{const F=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/cq-human-variance.json.gz',import.meta.url))));const rec={},ends={};let runs=0;
 for(const x of F.runs){let s=rec[x.who]||H.pilot(F.t0,{seed:777*x.who});s=H.begin(s,x.op,s.lastWall||F.t0);const cmds=decode(x.rows);let i=0;const r=H.run(s,()=>cmds[Math.min(i++,cmds.length-1)],F.t0,{maxS:Math.ceil(cmds.length/20)});rec[x.who]=back(r);runs++;ends[r.s.battle?.state]=(ends[r.s.battle?.state]||0)+1;}
 const all=Object.values(rec);ok(runs===12&&all.every(s=>!flagsOut(s).length&&!Object.keys(s.fpf||{}).length),'3. '+runs+' recorded human-variance runs (two pilots, one UTC day: the same raid four times, parked defenders who only aim and fire, field work; '+JSON.stringify(ends)+') raise no flag');
 const day=all.flatMap(s=>s.fp);ok(day.every(f=>!verdicts(day,f).length),'... and the rule run on every one of their '+day.length+' fingerprints against all of them (both pilots pooled, stricter than one pilot\'s day) completes no flag');
 const parked=day.filter(f=>f.sv===0);ok(parked.length>=3&&parked.every(f=>f.ic>0),'the parked defenders steer nothing ('+parked.length+' runs, stick variance 0) yet change their aim and trigger: never "no input"');}
// ---- 4. the account side ----
{const pid='tg_77001';db.root.eco=db.root.eco||{};const s=botRec,entries=(s.airdrop.out||[]).filter(e=>e.fl);ok(entries.length===1,'the bot\'s record carries the flag in one immutable outbox entry');
 const c1=await creditConquest(env,pid,entries,t0+DAY/2);ok(c1.flagged&&db.get('flags/'+pid)?.r?.cqrepeat&&db.get('eco/'+pid)?.fl?.cqrepeat,'4. the account raises it through addFlags (flags/'+pid+'/r/cqrepeat) and remembers it (S.fl)');
 const t1=db.get('flags/'+pid).r.cqrepeat.t;await creditConquest(env,pid,[{id:999,raw:0,op:0,ms:0,fl:[{k:'cqrepeat',v:'again'}]}],t0+DAY/2+5000);ok(db.get('flags/'+pid).r.cqrepeat.t===t1,'... once: a later delivery does not raise it again');
 await creditConquest(env,pid,[{id:1000,raw:0,op:0,ms:0,fl:[{k:'admin',v:'x'},{k:'cluster',v:'x'}]}],t0+DAY/2+9000);const r=db.get('flags/'+pid).r;ok(!r.admin&&!r.cluster,'any other flag key in an entry is ignored');}
// ---- 5. cqalt ----
{const now=t0+3*DAY,d=Math.floor(now/DAY),hrs=(...h)=>Object.fromEntries(h.map(x=>[x,1])),days=(m)=>Object.fromEntries([0,1,2].map(k=>[d-k,m]));
 const A={th:'aaaa1111',h:days(hrs(19,20,21)),b:{29000000:1}},Bsame={th:'aaaa1111',h:days(hrs(19,20,21))},Bhours={th:'bbbb2222',h:days(hrs(19,20,21))},Bbeacon={th:'cccc3333',h:days(hrs(8,9)),b:{29000000:1}};
 ok(JSON.stringify(shared(A,Bsame,now))==='["town","hours"]'&&JSON.stringify(shared(A,Bhours,now))==='["hours"]'&&JSON.stringify(shared(A,Bbeacon,now))==='["beacon"]','5. the signals: the same town layout, the same hours on 3 shared days, a beacon in the same minute');
 const P=H.C&&null;const plot={site:'crater',cc:6,b:Object.fromEntries(Array.from({length:16},(_,i)=>['b'+i,{t:'mg',i:10+i,j:12,r:0}])),w:{'5,5':1}};ok(townHash(plot).length===8&&townHash({...plot,cc:4})===''&&townHash({...plot,b:{a:{t:'mg',i:1,j:1}}})==='','the town hash only for a Command Center '+ALT.townCC+'+ town with '+ALT.townN+'+ buildings');
 db.root.cqx={tg_1:A,tg_2:Bsame,tg_3:A,tg_4:Bhours,tg_5:A,tg_6:Bsame};db.root.flags={};db.root.lkok={};
 const sigOf=s=>{let h=s;while(parseInt(h,16)%ALT.every!==Math.floor(now/300000)%ALT.every)h=(parseInt(h,16)+1).toString(16);return h;};
 const clu=[{sig:sigOf('100'),keep:'tg_1',m:[['tg_1','Main',900],['tg_2','Alt',10]]},{sig:sigOf('200'),keep:'tg_3',m:[['tg_3','Main3',900],['tg_4','Friend',10]]},{sig:sigOf('300'),keep:'tg_5',m:[['tg_5','Main5',900],['tg_6','Alt6',10]]}];db.root.lkok[clu[2].sig]=now-1;
 await cqAltScan(env,clu,{},now);const f=db.root.flags;
 ok(f.tg_2?.r?.cqalt&&!f.tg_1?.r?.cqalt&&db.get('cqa/'+clu[0].sig)?.h?.join()==='town,hours','two signals in a linked cluster: the extra account gets cqalt, the main one counts, the admin row gets the hint');
 ok(!f.tg_4?.r?.cqalt&&!db.get('cqa/'+clu[1].sig),'one signal (the same hours alone): nothing');
 ok(!f.tg_6?.r?.cqalt,'a cluster the owner cleared: nothing (the hint is still shown)');
 db.root.clu=[clu[0]];await clearCluster(env,clu[0].sig,now+1000);ok(db.get('flags/tg_2/ok/cqalt')>=f.tg_2.r.cqalt.t,'the row\'s clear clears cqalt too');
 // review round 1 (airdrop integrity, B6): the main account moves to whoever holds the most points; its old cqalt is cleared, and only an
 // account that shares two signals with another one is flagged (a third member who shares nothing stays clear)
 db.root.flags={tg_8:{r:{cqalt:{v:'old',t:now-5000}}}};db.root.lkok={};db.root.cqx={...db.root.cqx,tg_7:A,tg_8:Bsame,tg_9:Bbeacon};const c4={sig:sigOf('400'),keep:'tg_8',m:[['tg_8','NowMain',1500],['tg_7','WasMain',900],['tg_9','Flatmate',40]]};
 await cqAltScan(env,[c4],db.root.flags,now+2000);const g=db.root.flags;
 ok(db.get('flags/tg_8/ok/cqalt')>=g.tg_8.r.cqalt.t&&g.tg_7?.r?.cqalt&&!g.tg_9?.r?.cqalt,'the new main account\'s old cqalt is cleared, the other account of the matching pair is flagged, a member who shares no two signals is not');}
// review round 1 (airdrop integrity, note 3): a flag's text and measurements never reach the phone (the outbox entry, the spill, the queue)
{const {publicState}=await import('../../worker/src/conquest.js');const s={v:1,airdrop:{out:[{id:1,raw:10,fl:[['cqrepeat','3 near-identical raid operations in one day (the same route, 19.2 s)']]}],spill:{raw:5,fl:[['cqnoinput','x']]},pfl:[{k:'cqrepeat',v:'y'}]}};const out=publicState(s);
 ok(!JSON.stringify(out).includes('cqrepeat')&&!JSON.stringify(out).includes('cqnoinput')&&out.airdrop.out[0].raw===10&&out.airdrop.spill.raw===5,'flag texts stay on the Worker: publicState strips them from the outbox, the spill and the queue (the points stay)');}
console.log(JSON.stringify({test:'conquest-fingerprints',pass}));
