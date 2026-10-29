// Browser handoff contract, no live Telegram account or production requests.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../web/website.js',import.meta.url),'utf8');
async function trial(accepted){
 const calls=[],events={},notice={hidden:true,append(){}},location={hostname:'lunar.test',origin:'https://lunar.test',search:'',hash:'',assign:u=>calls.push(['navigate',u])};
 let callback,closed=false;
 const Login={auth:(opts,cb)=>{calls.push(['auth',opts]);callback=cb;},close:()=>{closed=true;calls.push(['close']);}};
 const context={location,URLSearchParams,Date,console,Promise,setTimeout,clearTimeout,sessionStorage:{setItem(){}},window:{Telegram:{Login},focus:()=>calls.push(['focus']),addEventListener:(k,fn)=>events[k]=fn},Telegram:{Login},addEventListener:(k,fn)=>events[k]=fn,
 document:{hidden:false,querySelector:s=>s==='#login-status'?notice:null,querySelectorAll:()=>[],createElement:()=>({setAttribute(){}}),addEventListener:(k,fn)=>events[k]=fn},fetch:async(path)=>{calls.push(['fetch',path]);if(path==='/auth/session')return {ok:false};if(path==='/auth/config')return {json:async()=>({enabled:true})};if(path==='/auth/challenge')return {ok:true,json:async()=>({client_id:'123',nonce:'test-nonce',expires:Date.now()+300000})};if(path==='/auth/login')return {ok:accepted,json:async()=>({error:'identity'})};throw Error('Unexpected request '+path);}};
 vm.createContext(context);vm.runInContext(source,context);await vm.runInContext('prepareLogin()',context);
 context.window.lunarLogin('garage');assert.equal(calls.filter(c=>c[0]==='auth').length,1);
 assert.equal(calls.find(c=>c[0]==='auth')[1].nonce,'test-nonce');
 await callback({id_token:'signed-token-fixture'});
 assert.equal(closed,true,'official SDK popup must close so Safari returns to the game tab');
 const navigation=calls.find(c=>c[0]==='navigate');
 if(accepted){assert.equal(navigation?.[1],'/web/play.html#garage');assert.ok(calls.findIndex(c=>c[0]==='close')<calls.findIndex(c=>c[0]==='navigate'));}
 else{assert.equal(navigation,undefined);assert.equal(notice.hidden,false,'verification failure is visible in the original tab');}
 return calls;
}
await trial(true);await trial(false);
console.log('PASS login success/failure return control from popup; only verified exchange enters game');
