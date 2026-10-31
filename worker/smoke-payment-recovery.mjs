// Isolated real workerd/SQLite; all outbound requests terminate in local fakedb.
import assert from 'node:assert/strict';
import {existsSync,realpathSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,delimiter,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {makeDB} from '../dev/tests/wtest/fakedb.mjs';
import {buildSim} from './build-sim.mjs';buildSim();
const here=dirname(fileURLToPath(import.meta.url));
const binary=process.env.PATH.split(delimiter).map(p=>join(p,'wrangler')).find(existsSync);
assert.ok(binary,'Run with npm exec --package=wrangler@4');
const require=createRequire(realpathSync(binary)),{Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
const entry=`import {PaymentJob as Base} from './src/payment-jobs.js';
import {tx} from './src/eco.js';import {paymentPending} from './src/payment-ledger.js';
export class Fixture extends Base {
 async fetch(req){
  const path=new URL(req.url).pathname;
  if(path==='/seed'){
   await super.fetch(new Request('https://fixture/wake',{method:'POST',body:JSON.stringify({pid:'tg_887001'})}));
   await tx(this.env,'tg_887001',S=>{S.starReceipts={runtime:{k:'vault',t:'chest',g:16,stars:1000,n:'runtime',o:[],ts:Date.now(),journal:1}};paymentPending(S,'stars','runtime','Fixture');return {};});
   return Response.json({ok:true});
  }
  if(path==='/state')return Response.json({pid:await this.state.storage.get('pid'),alarm:await this.state.storage.getAlarm(),error:await this.state.storage.get('lastError')});
  if(path==='/rearm'){await this.state.storage.setAlarm(Date.now()+30);return Response.json({ok:true});}
  return super.fetch(req);
 }
}
export default {fetch(req,env){return env.PAYMENTS.get(env.PAYMENTS.idFromName('tg_887001')).fetch(req);}};`;
const bundle=await build({stdin:{contents:entry,resolveDir:here,sourcefile:'payment-runtime-fixture.js'},bundle:true,format:'esm',platform:'node',target:'es2022',external:['node:*'],banner:{js:'import {createRequire} from "node:module";const require=createRequire("/");'},write:false,logLevel:'silent'});
const dir=mkdtempSync(join(tmpdir(),'lunar-payment-recovery-')),db=makeDB();let unavailable=true,mf;
const options={host:'127.0.0.1',port:0,name:'lunar-payment-recovery',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2024-09-23',compatibilityFlags:['nodejs_compat'],durableObjects:{PAYMENTS:{className:'Fixture',useSQLite:true}},resourcePersistencePath:dir,bindings:{BOT_TOKEN:'fixture',FIREBASE_DB_SECRET:'SECRET'},outboundService:async req=>{
 if(new URL(req.url).origin!=='https://warmachines-a6034-default-rtdb.firebaseio.com')throw Error('external blocked');
 if(unavailable&&new URL(req.url).pathname==='/meta.json'&&req.method==='PUT')return new Response('{}',{status:503});
 return db.handle(req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:await req.text()});
}};
const call=path=>mf.dispatchFetch('https://fixture'+path).then(r=>r.json());
try{
 mf=new Miniflare(convertV4MiniflareOptions(options));await mf.ready;
 assert.equal((await call('/seed')).ok,true);await call('/rearm');
 let v;for(let i=0;i<100;i++){v=await call('/state');if(v.error)break;await new Promise(r=>setTimeout(r,30));}
 assert.ok(v.error,'alarm ran and retained its outage');assert.ok(v.alarm>Date.now());
 assert.ok(db.get('/eco/tg_887001/paymentPending/stars_runtime'));
 await mf.dispose();mf=null;unavailable=false;
 mf=new Miniflare(convertV4MiniflareOptions(options));await mf.ready;
 assert.equal((await call('/state')).pid,'tg_887001','SQLite identity survived runtime restart');
 await call('/rearm');for(let i=0;i<100;i++){if(db.get('/meta/revc')===1300)break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(db.get('/meta/revc'),1300);
 for(let i=0;i<100;i++){if(!db.get('/eco/tg_887001/paymentPending/stars_runtime'))break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(db.get('/eco/tg_887001/paymentPending/stars_runtime'),null);
 await call('/rearm');await new Promise(r=>setTimeout(r,150));assert.equal(db.get('/meta/revc'),1300);
 console.log('PASS real workerd/SQLite payment alarm, outage, runtime restart, no-return recovery and exactly-once accounting');
}finally{if(mf)await mf.dispose();rmSync(dir,{recursive:true,force:true});}
