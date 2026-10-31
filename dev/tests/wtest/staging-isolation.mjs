// Staging isolation: a staging Worker can never read/write the production database, use the production origin,
// reach mainnet, or run Stars test mode outside staging. Production behavior is unchanged. No live network.
import assert from 'node:assert/strict';
import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();
const {DB_URL,PROD_WEB_ORIGIN,dbBase,dbUrl,stageProblem}=await import('../../../worker/src/db.js');
const worker=(await import('../../../worker/src/index.js')).default;
let pass=0;const check=(name,fn)=>{fn();pass++;console.log('PASS',name);};
const STAGE_DB='https://lunar-stage-default-rtdb.firebaseio.com';
const good={LUNAR_STAGE:'staging',FIREBASE_DB_URL:STAGE_DB,WEB_ORIGIN:'https://lunar-api-staging.example.workers.dev',PAYMENT_NETWORK:'testnet',CRYPTO_CHECKOUT_ENABLED:'test',FIREBASE_DB_SECRET:'S'};

check('production keeps the production database even if an override is present',()=>{
 assert.equal(dbBase({}),DB_URL);assert.equal(dbBase({FIREBASE_DB_URL:STAGE_DB}),DB_URL);
 assert.ok(dbUrl({FIREBASE_DB_SECRET:'S'},'eco/x').startsWith(DB_URL+'/eco/x.json'));
 assert.equal(stageProblem({}),null);
});
check('valid staging uses only its own database',()=>{
 assert.equal(stageProblem(good),null);
 assert.ok(dbUrl(good,'eco/x').startsWith(STAGE_DB+'/eco/x.json'));
});
check('staging without a database never falls back to production',()=>{
 const e={...good};delete e.FIREBASE_DB_URL;
 assert.match(stageProblem(e),/FIREBASE_DB_URL/);assert.ok(!dbUrl(e,'x').startsWith(DB_URL));
});
check('staging refuses the production database',()=>assert.match(stageProblem({...good,FIREBASE_DB_URL:DB_URL+'/'}),/production database/));
check('staging refuses a non-Firebase database host',()=>assert.match(stageProblem({...good,FIREBASE_DB_URL:'https://evil.example.com'}),/FIREBASE_DB_URL/));
check('staging refuses missing or production origin',()=>{
 assert.match(stageProblem({...good,WEB_ORIGIN:''}),/WEB_ORIGIN/);
 assert.match(stageProblem({...good,WEB_ORIGIN:PROD_WEB_ORIGIN}),/WEB_ORIGIN/);
});
check('staging refuses mainnet configuration',()=>{
 assert.match(stageProblem({...good,PAYMENT_NETWORK:'mainnet'}),/testnet/);
 assert.match(stageProblem({...good,CRYPTO_CHECKOUT_ENABLED:'approved-mainnet'}),/testnet/);
});

const realFetch=globalThis.fetch;const calls=[];
globalThis.fetch=async u=>{calls.push(String(u));throw Error('no live network in this test');};
const bad={...good,FIREBASE_DB_URL:DB_URL};
const r=await worker.fetch(new Request('https://lunar-api-staging.example.workers.dev/lb.json'),bad);
check('misconfigured staging answers 503 before any database or provider call',()=>{assert.equal(r.status,503);assert.equal(calls.length,0);});
let ran=false;await worker.scheduled({cron:'*/5 * * * *'},bad,{waitUntil:()=>{ran=true;}});
check('misconfigured staging runs no scheduled jobs',()=>{assert.equal(ran,false);assert.equal(calls.length,0);});

const assets={fetch:async()=>new Response('ok')};
const csp=async env=>(await worker.fetch(new Request(env.WEB_ORIGIN?env.WEB_ORIGIN+'/web/play.html':'https://x/web/play.html'),{...env,ASSETS:assets})).headers.get('Content-Security-Policy');
const stageCsp=await csp(good),prodCsp=await csp({});
check('staging pages connect only to staging hosts',()=>{
 assert.ok(stageCsp.includes('wss://lunar-api-staging.example.workers.dev'));assert.ok(stageCsp.includes(STAGE_DB));
 assert.ok(!stageCsp.includes('lunar-api.solb7403.workers.dev'));assert.ok(!stageCsp.includes(DB_URL));
});
check('production page policy is unchanged',()=>{
 assert.ok(prodCsp.includes("connect-src 'self' https://oauth.telegram.org wss://lunar-api.solb7403.workers.dev https://warmachines-a6034-default-rtdb.firebaseio.com;"));
});
globalThis.fetch=realFetch;
console.log(`staging-isolation: ${pass} PASS / 0 FAIL`);
