/* Session 7T Living Town (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md, decision 9): one budget for every notification the
   game sends. Session 7's limits (at most 3 a day, none in the pilot's local night, at least 2 hours apart, several events in one
   alert) now cover the town attacks, the war, the breached town, the Grand Offensive, the Strike Beacon, the Meteor Strike, the
   Daily Base Yield and the daily reminder. Priority (lower types only fill unused slots): 1 an incoming town attack you can still
   defend, 2 territory assaults and counterattacks you can still join, 3 your town was breached (REPAIR and the replay; held raids
   appear only in the War Report), 4 the Grand Offensive announcement, 5 Strike Beacon ready, 6 a Meteor in 5 minutes (only if you
   played in the last 48 hours), 7 yield at 90% (at most once a day), 8 the daily reminder. Per-type switches; the reminder's own
   opt-out (the bot's /stop) applies. A pure plan: the Worker's cron (worker/src/conquest-alerts.js) sends it. */
(function(root){
'use strict';
const HOUR=3600000,DAY=24*HOUR;
const W=()=>root.ConquestWar;
const TYPES=Object.freeze(['town','war','breach','go','beacon','meteor','yield','remind']);   // index + 1 = priority
const PRI=Object.freeze(Object.fromEntries(TYPES.map((t,i)=>[t,i+1])));
const NAMES=Object.freeze({town:'Raids on your town',war:'War assaults and counterattacks',breach:'Your town breached',go:'Grand Offensive',beacon:'Strike Beacon ready',meteor:'Meteor Strike in 5 minutes',yield:'Daily Base Yield at 90%',remind:'Daily reminder'});
const LIMIT=Object.freeze({perDay:3,minGap:2*HOUR,lead:HOUR,step:15*60000,remindFrom:17,remindTo:21,meteorPlayedMs:48*HOUR});
const typeOf=e=>e.type||(e.kind==='a'||e.kind==='c'?'war':e.kind==='g'?'go':e.kind);
// the lead an event needs (a fight must still be joinable an hour before it lands; the others until their window ends)
const leadOf=e=>['town','war','go'].includes(typeOf(e))?LIMIT.lead:0;
// events: [{id, type (or Session 7 kind a|c|g), at (from), until (no use after)}]; from: now; tz: minutes east; sent: {day, n, last}
// (what was already sent this local day); on: {type: 0|1} the switches. Returns [{at, ids}] in time order.
function plan(events,from,tz=0,sent={day:null,n:0,last:0},on={}){const Wr=W(),night=t=>Wr.night(t,tz),lday=t=>Wr.localDay(t,tz);
 const ev=(events||[]).filter(e=>e&&on[typeOf(e)]!==0&&PRI[typeOf(e)]).map(e=>({...e,p:PRI[typeOf(e)],t0:Math.max(from,Number(e.at)||from),t1:Number(e.until)-leadOf(e)})).filter(e=>e.t1>e.t0).sort((a,b)=>a.p-b.p||a.t0-b.t0||String(a.id).localeCompare(String(b.id)));
 const sends=[],lastSent=Number(sent.last)||-Infinity,sentDay=sent.day??null,sentN=sent.n|0;
 const used=d=>sends.filter(s=>lday(s.at)===d).length+(d===sentDay?sentN:0);
 const free=t=>!night(t)&&used(lday(t))<LIMIT.perDay&&t-lastSent>=LIMIT.minGap&&sends.every(s=>Math.abs(s.at-t)>=LIMIT.minGap);
 for(const e of ev){const join=sends.filter(s=>s.at>=e.t0&&s.at<=e.t1).sort((a,b)=>a.at-b.at)[0];if(join){join.ids.push(e.id);continue;}
  for(let t=e.t0,guard=0;t<=e.t1&&guard<2000;t+=LIMIT.step,guard++){if(free(t)){sends.push({at:t,ids:[e.id]});break;}}}
 return sends.sort((a,b)=>a.at-b.at);}
// the daily reminder's window on a local day (17:00-21:00 local): the event the cron adds for each upcoming day
function remindWindow(now,tz){const loc=now+tz*60000,d=Math.floor(loc/DAY),mk=(dd)=>({at:dd*DAY+LIMIT.remindFrom*HOUR-tz*60000,until:dd*DAY+LIMIT.remindTo*HOUR-tz*60000,day:dd});const a=mk(d);return a.until>now?a:mk(d+1);}
// one alert's words and where its button goes (the most urgent event leads)
function message(evs,at){const by=t=>evs.filter(e=>typeOf(e)===t),lines=[],Wr=W();let link='',title='';
 const town=by('town');for(const e of town){const h=Math.max(1,Math.round((e.until-at)/HOUR));lines.push('RAID INCOMING on your town in '+h+' h'+(e.g&&Wr.GEN[e.g]?' · '+Wr.GEN[e.g].name+' '+'★'.repeat(Wr.GEN[e.g].stars):'')+' · DEFEND it in person');}
 const war=[...by('war'),...by('go')];if(war.length)lines.push(...Wr.alertText(war.map(e=>({...e,kind:e.kind||(typeOf(e)==='go'?'g':'a')})),at).body.split('\n'));
 for(const e of by('breach'))lines.push('Your town was '+(e.o==='fallen'?'overrun: the Command Center fell':'breached')+' · REPAIR ALL · watch the replay');
 for(const e of by('beacon'))lines.push('STRIKE BEACON READY · call a Meteor Strike at '+(e.site||'the strike site')+' when it suits you (once a day)');
 for(const e of by('meteor'))lines.push('METEOR STRIKE in 5 minutes'+(e.site?' at '+e.site:'')+' · rare ore in the crater');
 for(const e of by('yield'))lines.push('Your Daily Base Yield is at 90% · collect it at your town');
 for(const e of by('remind'))lines.push(e.text||'Your daily reward and new quests are ready, pilot.');
 const lead=evs.slice().sort((a,b)=>PRI[typeOf(a)]-PRI[typeOf(b)])[0],lt=lead?typeOf(lead):'';
 link=lt==='town'?'town=defend':lt==='breach'?'town=repair':lt==='war'||lt==='go'?'war=1':lt==='beacon'?'beacon=1':'';
 title=evs.length>1?'LUNAR · '+evs.length+' ALERTS':lt==='town'?'LUNAR · RAID INCOMING':lt==='breach'?'LUNAR · TOWN BREACHED':lt==='go'?'LUNAR · GRAND OFFENSIVE':lt==='war'?'LUNAR · WAR ALERT':lt==='beacon'?'LUNAR · STRIKE BEACON':lt==='meteor'?'LUNAR · METEOR STRIKE':'LUNAR';
 return {title,body:lines.join('\n'),link,lead:lt};}
root.ConquestAlerts=Object.freeze({TYPES,PRI,NAMES,LIMIT,typeOf,plan,remindWindow,message});
})(globalThis);
