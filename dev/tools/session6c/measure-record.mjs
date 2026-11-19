import {createHmac} from 'node:crypto';
import {makeDB} from '../../../dev/tests/wtest/fakedb.mjs';
const db=makeDB({pruneEmptyUnder:['conquest']});let down=0,calls=0;const by={};
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')){calls++;const r=await db.handle(url,init);const t=await r.text();down+=t.length;const u=new URL(url),k=(init?.method||'GET')+' '+decodeURIComponent(u.pathname).split('/').slice(0,2).join('/');by[k]=(by[k]||0)+t.length;return new Response(r.status===204?null:t,{status:r.status,headers:r.headers});}throw Error('ext '+url);};
const {default:worker}=await import('../../../worker/src/index.js');
const env={BOT_TOKEN:'conquest-test',FIREBASE_DB_SECRET:'SECRET'};
let now=Date.now();Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
let replyBytes=0;
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:7,initData:auth(id),...body})}),env);const text=await r.text();replyBytes+=text.length;return {status:r.status,...JSON.parse(text)};}
await call(9001,'/api/sync');let r=await call(9001,'/api/conquest/session');
const rec=db.get('conquest/tg_9001');const size=o=>JSON.stringify(o)?.length||0;
console.log('record',size(rec),'battle',size(rec.battle),'enemies',rec.battle.enemies.length,size(rec.battle.enemies));
const top=Object.entries(rec).map(([k,v])=>[k,size(v)]).sort((a,b)=>b[1]-a[1]);console.log(top.slice(0,20).map(x=>x.join(':')).join(' '));
const e0=rec.battle.enemies[0];console.log('one enemy',size(e0),Object.entries(e0).map(([k,v])=>k+':'+size(v)).join(' '));
// drive for 60 s at 1 Hz with 20 commands each
let seq=r.state.seq;down=0;calls=0;replyBytes=0;for(const k in by)delete by[k];
for(let i=0;i<60;i++){now+=1000;const cmds=Array.from({length:20},()=>({x:i%20<10?0.3:-0.3,z:0}));r=await call(9001,'/api/conquest/input',{seq:++seq,commands:cmds});if(r.status!==200){console.log('err',r.status,r.error);break;}}
console.log('idle 60 s: firebase down',down,'B, per request',Math.round(down/60),'calls',calls,'reply to phone per request',Math.round(replyBytes/60));
console.log('per pilot-hour MB (1 Hz):',(down/60*3600/1e6).toFixed(1),' phone MB/h',(replyBytes/60*3600/1e6).toFixed(1));
console.log(Object.entries(by).map(x=>x.join(':')).join(' '));
