// Session 7 war alerts (owner decision 12), unified by Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md, decision 9):
// ONE budget for every notification the game sends a Conquest pilot: at most 3 a day, none in the pilot's local night, at least 2 hours
// apart, several events in one alert, the most urgent first (js/conquest/alerts.js: 1 a town attack you can still defend, 2 territory
// assaults and counterattacks you can still join, 3 your town was breached, 4 the Grand Offensive announcement, 5 Strike Beacon ready,
// 6 a Meteor in 5 minutes if you played in the last 48 hours, 7 the Daily Base Yield at 90% (once a day), 8 the daily reminder; lower
// types only fill unused slots). Per-type switches in settings; the bot's /stop (the reminder's own opt-out) silences Telegram.
// Website first (browser notifications), Telegram through the existing bot.
// The Conquest request writes the pilot's schedule doc wal/<pid> after its commit (worker/src/conquest-war.js alertDoc: the fights and
// town attacks the pilot can still join, what the war and the town clock will announce before the front holds, the raids forecast to
// breach the town, and the fields the recurring events need); this cron (every 5 minutes, its own run) adds the recurring events (the
// reminder, the Beacon, the yield, the Meteor), sends what is due, re-planning with the true count already sent today, so the caps hold
// whatever the request side wrote. The pilot it handles is marked ntf/<pid>/u = 1: the old reminder run (worker/src/index.js
// sendReminders) leaves them to this one.
import {CONQUEST} from './sim.gen.js';
import {dbGet,dbPatch} from './db.js';
import {sendPush} from './webpush.js';
const WR=CONQUEST.War,AL=CONQUEST.Alerts,HOUR=3600000;
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const ids=v=>(Array.isArray(v)?v:record(v)?Object.values(v):[]).filter(x=>typeof x==='string');
const badPid=pid=>typeof pid!=='string'||/[.#$\[\]/]/.test(pid);
// The daily reminder's words (one source: the old reminder run uses it too). v: the reminder record (pl the UTC day last played, sk the
// streak, gf the welcome-back gift taken), d: the UTC day it is sent for.
export function reminderText(v,d){const streak=Number(v?.pl)===d-1?Number(v?.sk)||0:0;
 return v?.gf===0&&streak<2?"☾ Your welcome-back gift is ready, pilot: a free Rare gem cache. Claim it with today's daily reward in Quests."
  :streak>=2?`☾ Your ${streak}-day streak ends at midnight UTC. Keep it going: every streak day adds +5% to your quest points, up to +30%.`
  :"☾ Your daily reward and 4 new quests are ready, pilot. The top 1,000 on the leaderboard are tracked for the planned $LUNAR airdrop.";}
// write the pilot's schedule (best effort, after the Conquest commit). The cron's own fields (sd/sn/ls: the local day, the count sent that
// day and the last send; sent: what was already sent) are kept: a PATCH of the request's fields only. rm: this cron sends the pilot's daily
// reminder from now on (ntf/<pid>/u = 1, read by sendReminders).
export async function writeAlertDoc(env,pid,doc){if(!doc||badPid(pid))return;const w='wal/'+pid+'/';
 const up={[w+'v']:1,[w+'on']:doc.on,[w+'tz']:doc.tz,[w+'ev']:doc.ev.length?doc.ev:null,[w+'nx']:doc.on&&doc.nx?doc.nx:null,[w+'ps']:doc.ps.length?doc.ps:null,[w+'upd']:Date.now()};
 if(doc.rm){up[w+'rm']=1;up[w+'ga']=doc.ga?1:0;up[w+'sw']=doc.sw&&Object.keys(doc.sw).length?doc.sw:null;up[w+'pl']=doc.pl||null;up[w+'bd']=doc.bd||null;up[w+'y90']=doc.y90||null;up['ntf/'+pid+'/u']=1;}
 await dbPatch(env,'',up).catch(()=>{});}
// the event as the planner reads it: a Session 7 war event carries k (a|c|g), a Session 7T event its type in ty
const evOf=e=>({...e,...(e.ty?{type:e.ty}:{})});
// opts.tg(method, body): the bot (index.js tg); opts.push(sub, payload): a browser push (webpush.js sendPush); opts.gameUrl / webUrl
export async function sendWarAlerts(env,now=Date.now(),opts={}){const n=Math.max(1,Math.min(400,Number(opts.batch)||Number(env.WAL_BATCH)||100));
 const due=(await dbGet(env,'wal',{orderBy:'"nx"',startAt:1,endAt:now,limitToFirst:n}).catch(()=>null))||{};let sent=0,stop=false;
 const one=async(pid,d)=>{if(stop||!record(d)||badPid(pid))return;const done=new Set(ids(d.sent)),tz=Number.isSafeInteger(d.tz)?d.tz:0,sw=record(d.sw)?d.sw:{};
  if(!d.on){await dbPatch(env,'',{[`wal/${pid}/nx`]:null}).catch(()=>{});return;}
  // the reminder record: the Telegram chat (the bot's /start, off by /stop) and, for the reminder, the day last played in any mode
  const ntf=d.rm||opts.tg?await dbGet(env,'ntf/'+pid).catch(()=>null):null;
  const ev=[...list(d.ev).filter(e=>typeof e.id==='string'&&!done.has(e.id)).map(evOf),...AL.synth(d,now-5*60000,tz,done,record(ntf)?ntf:null,reminderText)];
  if(!ev.length){await dbPatch(env,'',{[`wal/${pid}/nx`]:null}).catch(()=>{});return;}
  const today=WR.localDay(now,tz),count={day:Number(d.sd)===today?today:null,n:Number(d.sd)===today?Number(d.sn)|0:0,last:Number(d.ls)||0};
  const plan=AL.plan(ev,now-5*60000,tz,count,sw),first=plan[0];   // 5 minutes of slack: the cron runs every 5
  if(!first||first.at>now){await dbPatch(env,'',{[`wal/${pid}/nx`]:first?first.at:null}).catch(()=>{});return;}
  if(WR.night(now,tz)){const p2=AL.plan(ev,now,tz,count,sw);await dbPatch(env,'',{[`wal/${pid}/nx`]:p2[0]?.at||null}).catch(()=>{});return;}   // review: never sent in the local night (the 5-minute slack once let one go at 22:01)
  const batch=ev.filter(e=>first.ids.includes(e.id)),msg=AL.message(batch,now);
  // the count first: written before anything is sent, so a failed write or a cut-short run can lose an alert, never send a fourth today
  const rest=AL.plan([...ev.filter(e=>!first.ids.includes(e.id)),...AL.synth(d,now,tz,new Set([...done,...first.ids]),record(ntf)?ntf:null,reminderText)].filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i),now,tz,{day:today,n:count.n+1,last:now},sw);
  const wrote=await dbPatch(env,'',{[`wal/${pid}/sent`]:[...done,...first.ids].slice(-24),[`wal/${pid}/sd`]:today,[`wal/${pid}/sn`]:count.n+1,[`wal/${pid}/ls`]:now,[`wal/${pid}/nx`]:rest[0]?.at||null}).catch(()=>false);if(!wrote){stop=true;return;}   // dbPatch answers false on a refused write (it throws only on a network error)
  let delivered=false;const q=msg.link?'?'+msg.link:'',alone=batch.length===1&&msg.lead==='remind'?batch[0].text:'';   // the reminder alone keeps its own words
  if(opts.tg&&ntf&&ntf.on&&ntf.chat){const r=await opts.tg('sendMessage',{chat_id:ntf.chat,text:alone||'☾ '+msg.title+'\n'+msg.body.replace(/^☾ /gm,''),reply_markup:{inline_keyboard:[[{text:msg.button||'⚔ PLAY',web_app:{url:(opts.gameUrl||'')+q}}]]}}).catch(()=>null);
   if(r&&r.ok)delivered=true;else if(r&&r.error_code===429)stop=true;else if(r&&(r.error_code===403||r.error_code===400))await dbPatch(env,'',{[`ntf/${pid}/on`]:0}).catch(()=>{});}   // a blocked or deleted chat switches Telegram off, as the reminders do
  // the website: every browser this pilot turned alerts on in (gone subscriptions are forgotten)
  const subs=list(d.ps).filter(p=>typeof p.e==='string'),keep=[];for(const p of subs){const r=await (opts.push||((sub,pl)=>sendPush(env,sub,pl,{now})))(p,{title:msg.title,body:(alone||msg.body).replace(/^☾ /gm,''),tag:'lunar-'+(msg.lead||'war'),url:(opts.webUrl||'/web/play.html')+q});if(r==='ok')delivered=true;if(r!=='gone')keep.push(p);}
  if(keep.length!==subs.length)await dbPatch(env,'',{[`wal/${pid}/ps`]:keep.length?keep:null}).catch(()=>{});if(delivered)sent++;};
 const all=Object.entries(due);for(let i=0;i<all.length&&!stop;i+=4)await Promise.all(all.slice(i,i+4).map(([pid,d])=>one(pid,d)));   // four at a time, as the daily reminders
 return sent;}
