// Real local SQLite DO restart and scheduled alarm; external DB is an in-memory fixture.
// From worker/: npm exec --cache /tmp/lunar-commercial-npm-cache --package=wrangler@4 --call='node smoke-pvp-recovery.mjs'
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
assert.ok(binary,'Run through npm exec --package=wrangler@4');
const require=createRequire(realpathSync(binary)),{Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
// Fixture-only DO interface: no diagnostic route is added to production code.
const entry=`import {PvpRoom as Base,rules} from './src/pvp.js';
export class RecoveryFixture extends Base {
 async fetch(req){
  const p=new URL(req.url).pathname;
  if(p==='/fixture/finish'){
   const core=this.room();core.io.setTimeout=()=>0;core.io.setInterval=()=>0;core.io.ghosts=null;
   core.seatPlayer({pid:'tg_774001',name:'Fixture',q:{g:'arena',m:'1v1'},L:rules().STOCK_L,power:100,league:0});
   core.startVs();core.startFight();await core.finishSeat(core.seats[0],{won:true,drawn:false,score:[1,0]},false);
   return Response.json(core.seats[0].res);
  }
  if(p==='/fixture/state')return Response.json({hasCore:!!this.core,entries:[...(await this.ctx.storage.list({prefix:'settlement:'})).values()],alarm:await this.ctx.storage.getAlarm()});
  if(p==='/fixture/rearm'){await this.ctx.storage.setAlarm(Date.now()+50);return Response.json({ok:true});}
  return super.fetch(req);
 }
}
export default {fetch(req,env){return env.ROOM.get(env.ROOM.idFromName('fixture-room')).fetch(req);}};`;
const bundle=await build({stdin:{contents:entry,resolveDir:here,sourcefile:'pvp-recovery-fixture.js'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const dir=mkdtempSync(join(tmpdir(),'lunar-pvp-recovery-')),db=makeDB();let unavailable=true,mf;
const options={host:'127.0.0.1',port:0,name:'lunar-pvp-recovery',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2024-09-23',
 durableObjects:{ROOM:{className:'RecoveryFixture',useSQLite:true}},resourcePersistencePath:dir,
 bindings:{BOT_TOKEN:'fixture',FIREBASE_DB_SECRET:'SECRET'},outboundService:async req=>{
  if(new URL(req.url).origin!=='https://warmachines-a6034-default-rtdb.firebaseio.com')throw Error('No external transport');
  if(unavailable)return new Response('fixture outage',{status:503});
  return db.handle(req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:await req.text()});
 }};
const call=path=>mf.dispatchFetch('https://fixture'+path).then(r=>r.json());
try{
 mf=new Miniflare(convertV4MiniflareOptions(options));await mf.ready;
 const failed=await call('/fixture/finish');assert.equal(failed.err,true);assert.equal(db.get('/eco/tg_774001'),null);
 const before=await call('/fixture/state');assert.equal(before.entries.length,1);assert.equal(before.entries[0].status,'pending');assert.ok(before.alarm>Date.now());
 await mf.dispose();mf=null;
 unavailable=false;mf=new Miniflare(convertV4MiniflareOptions(options));await mf.ready;
 const restored=await call('/fixture/state');assert.equal(restored.hasCore,false);assert.equal(restored.entries[0].status,'pending');assert.ok(restored.alarm);
 await call('/fixture/rearm');
 let complete;
 for(let i=0;i<100;i++){complete=await call('/fixture/state');if(complete.entries[0].status==='done')break;await new Promise(r=>setTimeout(r,30));}
 assert.equal(complete.entries[0].status,'done','Real scheduled alarm recovers durable settlement');
 assert.equal(db.get('/eco/tg_774001/pvm'),1);const amount=db.get('/eco/tg_774001/earned');assert.ok(amount>0);
 await call('/fixture/rearm');await new Promise(r=>setTimeout(r,100));assert.equal(db.get('/eco/tg_774001/pvm'),1);assert.equal(db.get('/eco/tg_774001/earned'),amount);
 console.log('PASS real workerd/SQLite DO outage, runtime restart, persisted intent+alarm and scheduled replay without duplicate credit');
}finally{if(mf)await mf.dispose();rmSync(dir,{recursive:true,force:true});}
