// Session 7 war alerts (owner decision 12; 7T reuses them for town attacks): website first (browser notifications, opted in from a
// tap after the pilot's first war battle), Telegram through the existing bot. At most 3 a day, none in the pilot's local night,
// several events in one alert, only fights the pilot can still join plus the Grand Offensive announcement, on/off in settings.
// The Conquest request writes the pilot's schedule doc wal/<pid> after its commit (worker/src/conquest-war.js alertDoc: the
// joinable fights and what the war will announce before the front holds); this cron (every 5 minutes, its own run) sends what is
// due, re-planning with the true count already sent today, so the caps hold whatever the request side wrote.
import {CONQUEST} from './sim.gen.js';
import {dbGet,dbPatch} from './db.js';
import {sendPush} from './webpush.js';
const WR=CONQUEST.War,HOUR=3600000;
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const ids=v=>(Array.isArray(v)?v:record(v)?Object.values(v):[]).filter(x=>typeof x==='string');
// write the pilot's schedule (best effort, after the Conquest commit). The cron's own fields (sd/sn/ls: the local day, the count
// sent that day and the last send; sent: what was already sent) are kept: a PATCH of the request's fields only.
export async function writeAlertDoc(env,pid,doc){if(!doc||typeof pid!=='string'||/[.#$\[\]/]/.test(pid))return;
 await dbPatch(env,'wal/'+pid,{v:1,on:doc.on,tz:doc.tz,ev:doc.ev.length?doc.ev:null,nx:doc.on&&doc.nx?doc.nx:null,ps:doc.ps.length?doc.ps:null,upd:Date.now()}).catch(()=>{});}
// one alert's words and where its button goes
function message(evs,at){const T=WR.alertText(evs.map(e=>({...e,kind:e.k})),at);return T;}
// opts.tg(method, body): the bot (index.js tg); opts.push(sub, payload): a browser push (webpush.js sendPush); opts.gameUrl / webUrl
export async function sendWarAlerts(env,now=Date.now(),opts={}){const n=Math.max(1,Math.min(400,Number(opts.batch)||Number(env.WAL_BATCH)||100));
 const due=(await dbGet(env,'wal',{orderBy:'"nx"',startAt:1,endAt:now,limitToFirst:n}).catch(()=>null))||{};let sent=0,stop=false;
 const one=async(pid,d)=>{if(stop||!record(d)||/[.#$\[\]/]/.test(pid))return;const done=new Set(ids(d.sent)),tz=Number.isSafeInteger(d.tz)?d.tz:0;
  const ev=list(d.ev).filter(e=>typeof e.id==='string'&&!done.has(e.id)&&Number(e.until)-HOUR>now);if(!d.on||!ev.length){await dbPatch(env,'',{[`wal/${pid}/nx`]:null}).catch(()=>{});return;}
  const today=WR.localDay(now,tz),count={day:Number(d.sd)===today?today:null,n:Number(d.sd)===today?Number(d.sn)|0:0,last:Number(d.ls)||0};
  const plan=WR.alertPlan(ev.map(e=>({...e,kind:e.k})),now-5*60000,tz,count),first=plan[0];   // 5 minutes of slack: the cron runs every 5
  if(!first||first.at>now){await dbPatch(env,'',{[`wal/${pid}/nx`]:first?first.at:null}).catch(()=>{});return;}
  const batch=ev.filter(e=>first.ids.includes(e.id)),msg=message(batch,now);
  // the count first: written before anything is sent, so a failed write or a cut-short run can lose an alert, never send a fourth today
  const rest=WR.alertPlan(ev.filter(e=>!first.ids.includes(e.id)).map(e=>({...e,kind:e.k})),now,tz,{day:today,n:count.n+1,last:now});
  const wrote=await dbPatch(env,'',{[`wal/${pid}/sent`]:[...done,...first.ids].slice(-24),[`wal/${pid}/sd`]:today,[`wal/${pid}/sn`]:count.n+1,[`wal/${pid}/ls`]:now,[`wal/${pid}/nx`]:rest[0]?.at||null}).catch(()=>false);if(!wrote){stop=true;return;}   // dbPatch answers false on a refused write (it throws only on a network error)
  let delivered=false;
  // Telegram: the pilot's bot chat (ntf/<pid>: the daily-reminder opt-in, set by /start, off by /stop)
  if(opts.tg){const ntf=await dbGet(env,'ntf/'+pid).catch(()=>null);if(ntf&&ntf.on&&ntf.chat){const r=await opts.tg('sendMessage',{chat_id:ntf.chat,text:'☾ '+msg.title+'\n'+msg.body,reply_markup:{inline_keyboard:[[{text:'⚔ OPEN THE WAR MAP',web_app:{url:(opts.gameUrl||'')+'?war=1'}}]]}}).catch(()=>null);
   if(r&&r.ok)delivered=true;else if(r&&r.error_code===429)stop=true;}}
  // the website: every browser this pilot turned alerts on in (gone subscriptions are forgotten)
  const subs=list(d.ps).filter(p=>typeof p.e==='string'),keep=[];for(const p of subs){const r=await (opts.push||((sub,pl)=>sendPush(env,sub,pl,{now})))(p,{title:msg.title,body:msg.body,tag:'lunar-war',url:(opts.webUrl||'/web/play.html')+'?war=1'});if(r==='ok')delivered=true;if(r!=='gone')keep.push(p);}
  if(keep.length!==subs.length)await dbPatch(env,'',{[`wal/${pid}/ps`]:keep.length?keep:null}).catch(()=>{});if(delivered)sent++;};
 const all=Object.entries(due);for(let i=0;i<all.length&&!stop;i+=4)await Promise.all(all.slice(i,i+4).map(([pid,d])=>one(pid,d)));   // four at a time, as the daily reminders
 return sent;}
