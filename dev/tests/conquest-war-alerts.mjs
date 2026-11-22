// Session 7 owner decision 12 (7T reuses them): war alerts. The plan (js/conquest/war.js alertPlan): at most 3 a day, none in the
// pilot's local night, several events in one alert, only fights the pilot can still join plus the Grand Offensive announcement.
// The website's push: RFC 8291 encryption checked by an independent receiver (node:crypto, not WebCrypto) and the VAPID JWT by
// node's own ECDSA verifier. The cron (worker/src/conquest-alerts.js) through the real Worker on a fake database, with fake
// Telegram and push senders: caps across runs, gone subscriptions forgotten, nothing sent while alerts are off.
import assert from 'node:assert/strict';import crypto from 'node:crypto';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST}=await import('../../worker/src/sim.gen.js');const WR=CONQUEST.War,H=3600000,D=24*H;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;};
// ---- the plan ----
const day0=Date.UTC(2026,10,23,0),ev=(id,atH,untilH,kind='a')=>({id,kind,t:'oxygen',at:day0+atH*H,until:day0+untilH*H});
{const evs=[ev('a1',0,12),ev('c1',6,18,'c'),ev('a2',12,24),ev('a3',18,30),ev('c2',18,30,'c'),ev('a4',30,42)];
 for(const tz of [0,-300,60,330,540,-480]){const plan=WR.alertPlan(evs,day0,tz),days={};for(const p of plan){const d=Math.floor((p.at+tz*60000)/D);days[d]=(days[d]||0)+1;}
  ok(Object.values(days).every(n=>n<=3),'tz '+tz+': at most 3 alerts a local day');ok(plan.every(p=>!WR.night(p.at,tz)),'tz '+tz+': none in the local night (22:00-08:00)');
  ok(plan.every(p=>p.ids.every(id=>{const e=evs.find(x=>x.id===id);return p.at>=e.at&&p.at<=e.until-H;})),'tz '+tz+': only fights still joinable (an hour left at least), never before their announcement');
  ok(new Set(plan.flatMap(p=>p.ids)).size===plan.flatMap(p=>p.ids).length,'tz '+tz+': each event in one alert at most');
  ok(plan.slice(1).every((p,i)=>p.at-plan[i].at>=2*H),'tz '+tz+': alerts at least 2 h apart');}
 const batched=WR.alertPlan([ev('x1',18,30),ev('x2',18,30,'c')],day0,0);ok(batched.length===1&&batched[0].ids.length===2,'two events announced together: one alert');
 const night=WR.alertPlan([ev('n1',23,35)],day0,0);ok(night.length===1&&WR.localHour(night[0].at,0)===8,'announced at night: sent at 08:00 local');
 const late=WR.alertPlan([ev('l1',0,5)],day0+4.5*H,0);ok(!late.length,'too late to join: never sent');
 const capped=WR.alertPlan([ev('k1',10,22)],day0+10*H,0,{day:Math.floor((day0+10*H)/D),n:3,last:day0+9*H});ok(capped.length===0||WR.localHour(capped[0].at,0)>=8&&Math.floor(capped[0].at/D)>Math.floor((day0+10*H)/D),'three already sent today: the next waits for tomorrow');
 const w=WR.fresh(day0);w.sc={n:9,done:1};for(let k=WR.tickOf(day0)+1;!w.go;k++)WR.advance(w,k*WR.WAR.tickMs,'al',{},k*WR.WAR.tickMs-1000);ok(WR.alertEvents(w).some(e=>e.kind==='g'),'the Grand Offensive announcement is an alert event');
 const T=WR.alertText([{kind:'a',t:'oxygen',until:day0+10*H},{kind:'g',t:'helium',n:3,until:day0+40*H}],day0);ok(T.title.includes('2 WAR ALERTS')&&T.body.includes('OXYGEN SPEAR')&&T.body.includes('GRAND OFFENSIVE'),'several events in one alert: '+JSON.stringify(T));}
// ---- web push ----
const {encrypt,b64u,vapidAuth}=await import('../../worker/src/webpush.js');
function decrypt(body,ua,auth){const b=Buffer.from(body),salt=b.subarray(0,16),idlen=b[20],asPub=b.subarray(21,21+idlen),ct=b.subarray(21+idlen),ecdh=ua.computeSecret(asPub);
 const ikm=Buffer.from(crypto.hkdfSync('sha256',ecdh,auth,Buffer.concat([Buffer.from('WebPush: info\0'),ua.getPublicKey(),asPub]),32)),cek=Buffer.from(crypto.hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16)),nonce=Buffer.from(crypto.hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const d=crypto.createDecipheriv('aes-128-gcm',cek,nonce);d.setAuthTag(ct.subarray(ct.length-16));const p=Buffer.concat([d.update(ct.subarray(0,ct.length-16)),d.final()]);let e=p.length-1;while(p[e]===0)e--;assert.equal(p[e],2,'last-record delimiter');return {text:p.subarray(0,e).toString(),rs:b.readUInt32BE(16),idlen};}
{const ua=crypto.createECDH('prime256v1');ua.generateKeys();const auth=crypto.randomBytes(16),msg=JSON.stringify({title:'LUNAR · WAR ALERT',body:'Assault on OXYGEN SPEAR lands in 10 h'});
 const out=decrypt(await encrypt(msg,b64u(ua.getPublicKey()),b64u(auth)),ua,auth);ok(out.text===msg&&out.rs===4096&&out.idlen===65,'aes128gcm push decrypts with an independent receiver');
 const kp=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'}),jwk=kp.privateKey.export({format:'jwk'}),pub=kp.publicKey.export({format:'der',type:'spki'}).subarray(-65),hdr=await vapidAuth({pub:b64u(pub),jwk},'https://fcm.googleapis.com/fcm/send/x',Date.now()),t=hdr.match(/t=([^,]+)/)[1].split('.');
 ok(crypto.verify('sha256',Buffer.from(t[0]+'.'+t[1]),{key:kp.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(t[2],'base64url'))&&JSON.parse(Buffer.from(t[1],'base64url')).aud==='https://fcm.googleapis.com'&&hdr.endsWith('k='+b64u(pub)),'VAPID JWT signed ES256 for the push service origin');}
// ---- the cron through the Worker, on a fake database ----
{const {makeDB}=await import('./wtest/fakedb.mjs'),db=makeDB({});globalThis.fetch=async(u,i)=>{if(String(u).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(u,i);throw Error('unexpected fetch '+u);};
 const env={BOT_TOKEN:'t',FIREBASE_DB_SECRET:'SECRET'},{sendWarAlerts,writeAlertDoc}=await import('../../worker/src/conquest-alerts.js'),{vapidKeys}=await import('../../worker/src/webpush.js');
 const k1=await vapidKeys(env),k2=await vapidKeys({...env});ok(k1.pub===k2.pub&&db.get('meta/vapid').pub===k1.pub&&db.get('meta/vapid').jwk.d,'the push key pair is made once by the Worker and kept server-side');
 const now=Date.UTC(2026,10,23,14),evs=[{id:'a1',k:'a',t:'oxygen',at:now-H,until:now+9*H},{id:'a2',k:'a',t:'helium',at:now-H,until:now+9*H},{id:'c1',k:'c',t:'crossroads',at:now+3*H,until:now+15*H}];
 await writeAlertDoc(env,'tg_1',{on:1,tz:0,ev:evs,nx:now-60000,ps:[{e:'https://fcm.googleapis.com/fcm/send/live',k:'k',a:'a'},{e:'https://fcm.googleapis.com/fcm/send/gone',k:'k',a:'a'}]});
 db.set?.('ntf/tg_1',{on:1,chat:77});if(!db.get('ntf/tg_1'))db.handle('https://warmachines-a6034-default-rtdb.firebaseio.com/ntf/tg_1.json?auth=SECRET',{method:'PUT',body:JSON.stringify({on:1,chat:77})});
 const sent=[],pushes=[],opts={tg:async(m,b)=>{sent.push(b);return {ok:true};},push:async(sub,p)=>{pushes.push([sub.e,p]);return sub.e.endsWith('gone')?'gone':'ok';},gameUrl:'https://g/',webUrl:'/web/play.html'};
 await sendWarAlerts(env,now,opts);const d1=db.get('wal/tg_1');ok(sent.length===1&&sent[0].chat_id===77&&sent[0].text.includes('OXYGEN SPEAR')&&sent[0].text.includes('HELIUM BASIN'),'one Telegram alert carries both inbound assaults');
 ok(pushes.length===2&&pushes[0][1].url.includes('war=1'),'the website alert goes to each browser');ok(Object.values(d1.ps||{}).length===1,'a gone subscription is forgotten');ok(d1.sn===1&&Object.values(d1.sent).includes('a1'),'the cron counts what it sent');
 await sendWarAlerts(env,now+10*60000,opts);ok(sent.length===1,'nothing new: nothing sent');
 db.handle('https://warmachines-a6034-default-rtdb.firebaseio.com/wal/tg_1.json?auth=SECRET',{method:'PATCH',body:JSON.stringify({nx:now+3*H})});await sendWarAlerts(env,now+3*H+60000,opts);ok(sent.length===2&&sent[1].text.includes('DUST CROSSROADS'),'the counterattack, announced later, is its own alert');
 db.handle('https://warmachines-a6034-default-rtdb.firebaseio.com/wal/tg_1.json?auth=SECRET',{method:'PATCH',body:JSON.stringify({on:0,nx:now+4*H,ev:[{id:'z9',k:'a',t:'ridge',at:now+4*H,until:now+20*H}]})});await sendWarAlerts(env,now+4*H+60000,opts);ok(sent.length===2,'alerts off: nothing sent');}
console.log('PASS war alerts (decision 12): '+pass+' checks');
