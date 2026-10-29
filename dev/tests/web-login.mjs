// Redirect login contract: browser navigation only; no Telegram popup or real identity provider.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../web/website.js',import.meta.url),'utf8');
function trial({host='lunar-api.solb7403.workers.dev',origin='https://lunar-api.solb7403.workers.dev',search='',target='garage'}={}){
 const calls=[],notices=[],notice={hidden:true,textContent:'',append(){}},listeners={};
 const location={hostname:host,origin,search,hash:'',assign:u=>calls.push(['navigate',u])};
 const window={history:{replaceState:(...args)=>calls.push(['history',...args])}};
 const document={querySelector:s=>s==='#login-status'?notice:null,createElement:()=>({setAttribute(){}}),addEventListener:(k,fn)=>listeners[k]=fn};
 const context={location,URLSearchParams,document,window,sessionStorage:{setItem:(k,v)=>calls.push(['ref',k,v])}};
 vm.createContext(context);vm.runInContext(source,context);
 window.lunarLogin(target);
 return {calls,notice,listeners};
}
assert.equal(trial().calls[0][1],'/web/login.html#garage');
assert.equal(trial({target:'mode:arena'}).calls[0][1],'/web/login.html#mode:arena');
assert.equal(trial({target:'https://evil.test'}).calls[0][1],'/web/login.html#play');
const gh=trial({host:'solb7403-creator.github.io',origin:'https://solb7403-creator.github.io',search:'?ref=tg_123456'});
assert.equal(gh.calls.find(c=>c[0]==='navigate')[1],'https://lunar-api.solb7403.workers.dev/web/?ref=tg_123456#garage');
const failed=trial({search:'?login=exchange'});
assert.match(failed.notice.textContent,/could not complete/i);
assert.equal(failed.calls.find(c=>c[0]==='history')[3],'/web/');
assert.equal(source.includes('Telegram.Login.auth'),false,'must not depend on popup communication');
assert.equal(source.includes('telegram-login.js'),false,'no popup login SDK loaded');
const loginPage=fs.readFileSync(new URL('../../web/login.html',import.meta.url),'utf8');
const loginScript=fs.readFileSync(new URL('../../web/login.js',import.meta.url),'utf8');
for(const id of ['login-status','open-bot','manual','login-command','copy-code','retry-login'])assert.match(loginPage,new RegExp('id="'+id+'"'));
assert.match(loginScript,/auth\/bot\/start/);
assert.match(loginScript,/auth\/bot\/finish/);
assert.match(loginScript,/\/web\/play\.html#/);
assert.match(loginScript,/visibilitychange/);
assert.equal(loginScript.includes('Telegram.Login.auth'),false);
assert.equal(loginPage.includes('telegram-login.js'),false);
console.log('PASS website bot sign-in navigation, account verification UI, safe targets, and no popup dependencies');
