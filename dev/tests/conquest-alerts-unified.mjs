// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decision 9: one budget for every notification the game sends. Session
// 7's limits (at most 3 a day, none in the pilot's local night, at least 2 hours apart, several events in one alert) cover the town
// attacks, the war, the breached town, the Grand Offensive, the Strike Beacon, the Meteor Strike, the yield and the daily reminder, in
// that priority (lower types only fill unused slots); per-type switches; the reminder's own opt-out (the bot's /stop) applies.
// The planner (js/conquest/alerts.js), the request side (worker/src/conquest-war.js alertDoc with the town's forecast), and the cron
// through the real Worker on a fake database with fake Telegram and push senders, plus the old reminder run leaving the pilot to it.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {War:WR,Alerts:AL,Town:TN}=CONQUEST;
const {createState,refreshState}=await import('../../worker/src/conquest-sim.js');
const {alertDoc,alertChange}=await import('../../worker/src/conquest-war.js');
const {townPilot,townAttack}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const H=3600000,D=24*H,M=60000,T=WR.WAR.tickMs;
const day0=Date.UTC(2026,10,24,0);   // a Tuesday, 00:00 UTC
const ids=plan=>plan.flatMap(p=>p.ids);
// ---- 1. the planner: priority, the cap, the night, batching, switches ----
{const town={id:'twt1',type:'town',at:day0+6*H,until:day0+18*H},war={id:'a1',k:'a',t:'oxygen',at:day0+9*H,until:day0+21*H},
  meteors=[10,12,14,16,18].map(h=>({id:'mt'+h,type:'meteor',at:day0+h*H-5*M,until:day0+h*H})),remind={id:'rm1',type:'remind',at:day0+17*H,until:day0+21*H,text:'x'};
 const plan=AL.plan([remind,...meteors,war,town],day0,0),all=ids(plan);
 ok(plan.length===3,'a busy day: 3 alerts, never a 4th ('+plan.map(p=>WR.localHour(p.at,0)+'h '+p.ids.join('+')).join(' · ')+')');
 ok(all.includes('twt1')&&all.includes('a1'),'the town attack (priority 1) and the war assault (2) always get their alert');
 ok(!all.includes('rm1')&&all.some(id=>id.startsWith('mt')),'lower types only fill unused slots: Meteors (6) fill the free ones, the daily reminder (8) is last and gets none today');
 ok(WR.localHour(plan.find(p=>p.ids.includes('twt1')).at,0)===8,'announced in the local night (06:00): sent at 08:00');
 ok(plan.every(p=>!WR.night(p.at,0))&&plan.slice(1).every((p,i)=>p.at-plan[i].at>=2*H),'none in the local night, at least 2 hours apart');
 ok(plan.some(p=>p.ids.length>1),'several events in one alert (the Meteor joins the war alert inside its window)');
 const quiet=AL.plan([remind],day0+12*H,0);ok(quiet.length===1&&WR.localHour(quiet[0].at,0)===17,'a quiet day: the daily reminder goes in its own window (17:00-21:00 local)');
 for(const tz of [-480,-300,0,60,330,540]){const p=AL.plan([town,war,...meteors,remind].map(e=>({...e})),day0,tz),days={};for(const x of p){const d=WR.localDay(x.at,tz);days[d]=(days[d]||0)+1;}
  ok(Object.values(days).every(n=>n<=3)&&p.every(x=>!WR.night(x.at,tz)),'tz '+tz+': at most 3 a local day, none at local night');}
 const off=AL.plan([remind,...meteors,war,town],day0,0,undefined,{meteor:0,town:0}),offIds=ids(off);ok(!offIds.some(id=>id.startsWith('mt'))&&!offIds.includes('twt1')&&offIds.includes('a1')&&offIds.includes('rm1'),'per-type switches: Meteors and town attacks off: neither is sent; the war alert and the reminder are');
 const capped=AL.plan([remind],day0+17*H,0,{day:WR.localDay(day0,0),n:3,last:day0+16*H});ok(!capped.length,'three already sent today: the reminder waits (none tomorrow either in this window)');
 const msg=AL.message([town,{...war},{id:'mt10',type:'meteor',site:'ASH REDOUBT'}],day0+8*H);ok(msg.lead==='town'&&msg.link==='town=defend'&&/RAID INCOMING/.test(msg.body)&&/OXYGEN SPEAR/.test(msg.body)&&/METEOR/.test(msg.body)&&msg.title.includes('3 ALERTS'),'one alert carries all three, the town attack leads (its button opens the defense)');}
// ---- 2. the recurring events (the cron adds them; the request uses them to plan the next visit) ----
{const now=day0+7*H,d={on:1,rm:1,ga:1,pl:day0-H,bd:0,y90:day0+15*H},ev=AL.synth(d,now,0,new Set(),{pl:Math.floor(day0/D)-1,sk:0,gf:1},(v,dd)=>'remind '+dd),ty=t=>ev.filter(e=>e.type===t);
 ok(ty('remind').length===2&&ty('remind')[0].text==='remind '+Math.floor(day0/D),'the daily reminder: today\'s and tomorrow\'s window, in its own words');
 ok(ty('beacon').length===2&&ty('yield').length===1&&ty('yield')[0].at===d.y90,'Strike Beacon once a UTC day; the yield once, at 90%');
 const mt=ty('meteor');ok(mt.length>=10&&mt.every(e=>e.until-e.at===5*M&&e.at>=now-5*M&&e.until<=d.pl+48*H+5*M),'a Meteor alert 5 minutes before each strike while the pilot played in the last 48 hours ('+mt.length+')');
 ok(!AL.synth({...d,pl:now-49*H},now,0).some(e=>e.type==='meteor'),'no Meteor alerts after 48 hours without play');
 ok(!AL.synth({...d,pl:now},now,0).some(e=>e.type==='remind'&&e.id==='rm'+WR.localDay(now,0)),'played today: no reminder today');
 ok(!AL.synth({...d,bd:Math.floor(now/D)},now,0).some(e=>e.id==='bc'+Math.floor(now/D)),'the Beacon used today: no "ready" alert today');
 ok(!AL.synth({...d,ga:0},now,0).some(e=>e.type!=='remind'),'before the game\'s alerts are live (the first war battle or town attack): only the reminder');
 ok(!AL.synth({...d,on:0},now,0).length,'alerts off: nothing at all');}
// ---- 3. the request side: the town's attacks and the forecast breach join the war's schedule ----
const now=Date.UTC(2026,10,24,9,10);
{const s=townPilot(CONQUEST,R,createState,now,{cc:3});s.al={on:1,ask:1,tz:0,ps:[]};const e=townAttack(CONQUEST,s,now,{g:'kethra'});
 const doc=alertDoc(s,now),tw=doc.ev.find(x=>x.id==='tw'+e.id),br=doc.ev.find(x=>x.id==='tb'+e.id);
 ok(tw&&tw.ty==='town'&&tw.until===e.l*T&&tw.g==='kethra','an announced town attack is an alert event until it lands (with the general)');
 ok(br&&br.ty==='breach'&&br.at===e.l*T,'an undefended town: the real clock run forward on a copy forecasts the breach at the landing ('+br?.o+')');
 ok(doc.rm===1&&doc.ga===1&&doc.pl===now&&doc.y90===s.base.claimedAt+.9*R.CQ_YIELD.day&&doc.nx>0&&doc.nx<=now+H,'the doc carries the reminder, the switches, the last play, the yield and the next visit ('+new Date(doc.nx).toISOString()+')');
 const s1=structuredClone(s);s1.al.ask=0;const d1=alertDoc(s1,now);ok(d1.ga===0&&!d1.ev.length&&d1.rm===1&&d1.nx>now,'alerts not yet live: no game alerts, but the reminder is still planned');
 const s2=structuredClone(s);ok(alertChange(s2,now)&&alertChange(s2,now+M)===null,'the doc is rewritten only when something it depends on changed');
 s2.plot.b.cc.l=s2.plot.cc;s2.plot.b.zz={t:'cannon',i:30,j:30,r:0,l:1};ok(alertChange(s2,now+2*M),'a new turret changes the town: the doc (and its forecast) is rewritten');
 const st=structuredClone(s);for(const b of Object.values(st.plot.b))b.l=b.l||1;}
// the first town attack announced makes the game's alerts live (Session 7 did this at the first war battle)
{const t=Date.UTC(2026,10,23,1),s=townPilot(CONQUEST,R,createState,t,{cc:3,claimed:t-4*D});s.al={on:1,ask:0,tz:0,ps:[]};let k=0;
 for(let x=t;x<t+4*D&&!s.tw?.ev?.length&&!s.tw?.log?.length;x+=6*H){s.lastWall=x-5*H;refreshState(s,x);k++;}ok(s.al.ask===1,'the first town attack announced makes the alerts live ('+k+' visits)');}
// ---- 4. the cron through the Worker, and the old reminder run leaving the pilot to it ----
{const {makeDB}=await import('./wtest/fakedb.mjs'),db=makeDB({});const tgSent=[];
 globalThis.fetch=async(u,i)=>{u=String(u);if(u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(u,i);if(u.startsWith('https://api.telegram.org/')){tgSent.push(JSON.parse(i.body));return new Response(JSON.stringify({ok:true,result:{}}));}throw Error('unexpected fetch '+u);};
 const env={BOT_TOKEN:'t',FIREBASE_DB_SECRET:'SECRET'},put=(p,v)=>db.handle('https://warmachines-a6034-default-rtdb.firebaseio.com/'+p+'.json?auth=SECRET',{method:'PUT',body:JSON.stringify(v)});
 const {sendWarAlerts,writeAlertDoc,reminderText}=await import('../../worker/src/conquest-alerts.js');const {sendReminders}=await import('../../worker/src/index.js');
 const t=Date.UTC(2026,10,25,17,3),dU=Math.floor(t/D);
 await put('ntf/tg_9',{on:1,chat:99,pl:dU-1,sk:0,gf:1});await put('ntf/tg_8',{on:1,chat:88,pl:dU-1,sk:0,gf:1,nx:dU});await put('meta/ntf2',1);
 await writeAlertDoc(env,'tg_9',{on:1,ga:0,rm:1,tz:0,ev:[],sw:{},pl:t-30*H,bd:0,y90:0,ps:[],nx:t-60000});
 ok(db.get('ntf/tg_9').u===1&&db.get('wal/tg_9').rm===1,'a Conquest pilot is marked: the alert cron sends their reminder (ntf u = 1)');
 const sent=[],opts={tg:async(m,b)=>{sent.push(b);return {ok:true};},push:async()=>'ok',gameUrl:'https://g/',webUrl:'/web/play.html'};
 await sendWarAlerts(env,t,opts);ok(sent.length===1&&sent[0].chat_id===99&&sent[0].text===reminderText({pl:dU-1,sk:0,gf:1},dU),'the reminder goes inside the one budget, in its own words: '+JSON.stringify(sent[0]?.text||'').slice(0,60));
 const w=db.get('wal/tg_9');ok(w.sn===1&&Object.values(w.sent).includes('rm'+WR.localDay(t,0))&&w.nx>t+12*H,'counted, and the next visit is tomorrow\'s window');
 await sendWarAlerts(env,t+10*M,opts);ok(sent.length===1,'never twice in a day');
 await sendReminders(env,Date.UTC(2026,10,25,16,0));ok(!tgSent.some(b=>b.chat_id===99)&&tgSent.some(b=>b.chat_id===88)&&db.get('ntf/tg_9').nx==null,'the old reminder run leaves the unified pilot to the alert cron and still reminds the others');
 // the cap holds across both: three already sent today, a breach alert waits for tomorrow morning
 await put('wal/tg_10',{v:1,on:1,ga:1,rm:1,tz:0,ev:[{id:'tbt1',ty:'breach',at:t-H,until:t+15*H,o:'breached'}],sd:WR.localDay(t,0),sn:3,ls:t-2*H,nx:t-M});await put('ntf/tg_10',{on:1,chat:100,pl:dU});
 await sendWarAlerts(env,t,opts);const w10=db.get('wal/tg_10');ok(!sent.some(b=>b.chat_id===100)&&WR.localHour(w10.nx,0)===8,'three already sent today: the breach alert waits for 08:00 tomorrow');
 await sendWarAlerts(env,w10.nx+M,opts);const b=sent.find(x=>x.chat_id===100);ok(b&&/breached/.test(b.text)&&b.reply_markup.inline_keyboard[0][0].text.includes('REPAIR')&&b.reply_markup.inline_keyboard[0][0].web_app.url.endsWith('?town=repair'),'then it goes: "Your town was breached · REPAIR ALL", the button opens the repair');
 // switched off, or alerts off: nothing
 await put('wal/tg_11',{v:1,on:1,ga:1,rm:1,tz:0,sw:{breach:0,remind:0,beacon:0},ev:[{id:'tbt2',ty:'breach',at:t-H,until:t+15*H,o:'fallen'}],nx:t-M});await put('ntf/tg_11',{on:1,chat:111,pl:dU-1});
 await put('wal/tg_12',{v:1,on:0,ga:1,rm:1,tz:0,ev:[{id:'tbt3',ty:'breach',at:t-H,until:t+15*H,o:'fallen'}],nx:t-M});await put('ntf/tg_12',{on:1,chat:112,pl:dU-1});
 await sendWarAlerts(env,t+20*M,opts);ok(!sent.some(x=>x.chat_id===111||x.chat_id===112),'a type switched off is never sent; alerts off sends nothing, not even the reminder');
 // the bot's /stop (the reminder's opt-out): no Telegram; the website still gets its alert
 const pushes=[];await put('wal/tg_13',{v:1,on:1,ga:1,rm:1,tz:0,ev:[{id:'twt9',ty:'town',at:t-H,until:t+10*H,g:'kethra'}],ps:[{e:'https://fcm.googleapis.com/fcm/send/x',k:'k',a:'a'}],nx:t-M});await put('ntf/tg_13',{on:0,chat:113});
 await sendWarAlerts(env,t+25*M,{...opts,push:async(sub,p)=>{pushes.push(p);return 'ok';}});ok(!sent.some(x=>x.chat_id===113)&&pushes.length===1&&/RAID INCOMING/.test(pushes[0].body)&&pushes[0].url.endsWith('?town=defend'),'/stop silences Telegram; the website alert still goes ("RAID INCOMING", the button opens the defense)');}
console.log('PASS unified alerts (decision 9): '+pass+' checks');
