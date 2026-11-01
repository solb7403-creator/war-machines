// A new visitor's whole first visit in a real browser engine: landing -> create account (call sign + password) ->
// the game, at phone, tablet and desktop sizes, with touch and keyboard-only. No passkey prompt anywhere before playing.
// Real Worker routes; the database, Durable Objects and identity providers are disposable local fixtures.
//   node dev/tests/signup-browser.cjs [chromium|webkit|firefox ...]   (default: every engine that is installed)
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const pw=require('playwright');
const ROOT=path.resolve(__dirname,'../..'),BASE='https://lunar.test',PORT=8000+Math.floor(Math.random()*900),FIX='http://127.0.0.1:'+PORT;
const OUT=process.env.SHOTS||'/tmp/lunar-shots/signup';fs.mkdirSync(OUT,{recursive:true});
const SIZES=[['phone-390',390,844,true],['android-360',360,780,true],['tablet-768',768,1024,true],['desktop-1366',1366,900,false]];
const engines=(process.argv.slice(2).length?process.argv.slice(2):['chromium','webkit','firefox']).filter(n=>{try{return fs.existsSync(pw[n].executablePath());}catch{return false;}});
const assert=(c,m)=>{if(!c)throw Error('FAIL '+m);};
let current=null;
async function explain(){   // on a failure: what the page showed and said
 if(!current)return;const {pg,label,name,errs,logs}=current;
 try{await pg.screenshot({path:path.join(OUT,name+'-'+label+'-FAILED.png')});}catch{}
 try{console.error('URL',pg.url(),'\nLOADING',await pg.evaluate(()=>document.querySelector('#web-loading')?.innerText||'(none)'));}catch{}
 console.error('ERRORS',errs.join('\n'),'\nCONSOLE',logs.slice(-25).join('\n'));
}
(async()=>{
 require('node:child_process').execFileSync('node',['worker/build-web.mjs'],{cwd:ROOT,stdio:'ignore'});
 const srv=spawn('node',['dev/tests/webserver.mjs'],{cwd:ROOT,env:{...process.env,LUNAR_FIXTURE_PORT:String(PORT)},stdio:['ignore','pipe','inherit']});
 await new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(String(d).includes('ready'))res();});setTimeout(()=>rej(Error('fixture did not start')),60000);});
 let pass=0;const results=[];
 try{
  if(!engines.length)throw Error('no browser engine installed');
  for(const name of engines){
   const browser=await pw[name].launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
   for(const [label,width,height,touch] of SIZES){
    const opts={viewport:{width,height}};if(touch&&name!=='firefox'){opts.isMobile=width<700;opts.hasTouch=true;}
    const ctx=await browser.newContext(opts);
    await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith(BASE)){const res=await r.fetch({url:FIX+u.slice(BASE.length)});return r.fulfill({response:res});}return r.abort();});
    // any passkey / WebAuthn prompt before playing is a failure
    await ctx.addInitScript(()=>{window.__credCalls=0;try{const c=navigator.credentials;if(c){const wrap=k=>{const f=c[k]&&c[k].bind(c);if(f)c[k]=(...a)=>{window.__credCalls++;return f(...a);};};wrap('create');wrap('get');}}catch{}});
    const pg=await ctx.newPage(),errs=[],logs=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.type()+': '+m.text());});pg.on('requestfailed',r=>logs.push('failed: '+r.url()+' '+(r.failure()||{}).errorText));
    current={pg,label,name,errs,logs};
    const cs=('N'+name[0]+width+Date.now().toString(36)).slice(0,16);
    // 1. landing
    await pg.goto(BASE+'/web/?i=abcd2345');await pg.waitForSelector('.colony-hero');
    assert(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' landing fits');
    await pg.locator('[data-login]').first().click();
    // 2. create account: one short screen
    await pg.waitForURL('**/web/login.html#play');await pg.waitForSelector('#su-cs');
    assert(await pg.locator('#signup-form').isVisible(),'signup form first for a new visitor');
    assert(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' signup fits (no sideways scroll)');
    assert(!(await pg.locator('#signup-form input:visible').count()>2),'two fields only');
    const go=await pg.locator('#su-go').boundingBox();assert(go&&go.height>=48,'big tap target');
    await pg.screenshot({path:path.join(OUT,name+'-'+label+'-signup.png')});
    if(touch){
     await pg.locator('#su-cs').tap?.().catch(()=>pg.locator('#su-cs').click());
     await pg.locator('#su-cs').fill('jake ');await pg.waitForFunction(()=>/No spaces/.test(document.querySelector('#su-cs-msg').textContent));
     await pg.locator('#su-cs').fill(cs);
    }else{
     // keyboard only: Tab order is call sign -> password -> show/hide -> Start playing
     await pg.locator('#su-cs').focus();await pg.keyboard.type(cs,{delay:5});
    }
    await pg.waitForFunction(()=>/available/.test(document.querySelector('#su-cs-msg').textContent),null,{timeout:10000});
    if(touch){await pg.locator('#su-pw').fill('moon tank 42');}
    else{await pg.keyboard.press('Tab');assert(await pg.evaluate(()=>document.activeElement.id)==='su-pw','Tab goes to password');await pg.keyboard.type('moon tank 42',{delay:5});}
    // the eye shows and hides the password
    await pg.locator('[data-eye="su-pw"]').click();assert(await pg.locator('#su-pw').getAttribute('type')==='text','eye shows');await pg.locator('[data-eye="su-pw"]').click();
    if(!touch){await pg.locator('#su-pw').focus();}
    const vb=await pg.locator('#su-go').boundingBox(),vh=await pg.evaluate(()=>window.visualViewport?visualViewport.height:innerHeight);
    assert(vb.y+vb.height<=vh+vb.height+400,'button reachable');
    if(touch)await pg.locator('#su-go').click();else await pg.keyboard.press('Enter');   // Enter submits on computers
    // 3. straight into the game
    await pg.waitForURL('**/web/play.html#play',{timeout:20000});
    await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save&&!!save.lab,null,{timeout:45000});
    assert(await pg.evaluate(()=>window.__credCalls)===0,'no passkey prompt before playing');
    assert(await pg.evaluate(c=>tgName(TG_USER)===c,cs),'the call sign is the player name');
    const cookies=await ctx.cookies(BASE);assert(cookies.some(c=>c.name==='__Host-lunar-session'&&c.httpOnly&&c.secure&&c.sameSite==='Lax'),'first-party HttpOnly session');
    assert(await pg.evaluate(()=>{try{return JSON.parse(localStorage.getItem('lunar-invite')).c==='abcd2345';}catch{return false;}}),'invite kept through signup');
    await pg.waitForTimeout(600);await pg.screenshot({path:path.join(OUT,name+'-'+label+'-game.png')});
    // 4. log out, log back in with call sign + password
    await pg.evaluate(()=>fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Lunar-CSRF':window.LUNAR_WEB.csrf},body:'{}'}));
    await pg.goto(BASE+'/web/login.html');await pg.waitForSelector('#login-form:not([hidden])');   // returning visitor: Log in tab
    await pg.locator('#li-cs').fill(cs.toLowerCase());await pg.locator('#li-pw').fill('wrong password');await pg.locator('#li-go').click();
    await pg.waitForFunction(()=>document.querySelector('#login-status').textContent.includes('Wrong call sign or password'));
    await pg.locator('#li-pw').fill('moon tank 42');
    if(touch)await pg.locator('#li-go').click();else{await pg.locator('#li-pw').focus();await pg.keyboard.press('Enter');}
    await pg.waitForURL('**/web/play.html#play',{timeout:20000});
    await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save&&!!save.lab,null,{timeout:45000});
    // 5. settings page fits and works
    await pg.goto(BASE+'/web/account.html');await pg.waitForSelector('#settings:not([hidden])');
    assert(await pg.locator('#acct-cs').textContent()===cs,'settings shows the call sign');
    assert(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' settings fits');
    await pg.screenshot({path:path.join(OUT,name+'-'+label+'-settings.png'),fullPage:true});
    if(label==='desktop-1366'||label==='phone-390'){
     // an older account without a call sign is asked for one in the game (prefilled), and it becomes the public name
     const pid=await pg.evaluate(()=>fetch('/auth/session').then(r=>r.json()).then(s=>s.pid));
     await fetch(FIX+'/__nocs',{method:'POST',body:JSON.stringify({pid})});
     await pg.goto(BASE+'/web/play.html#play');await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save&&!!save.lab,null,{timeout:45000});
     assert(await pg.locator('#cs-in').count()===0,'not asked before the first match');await pg.evaluate(()=>{save.welcomed=true;save.mp=1;store();closeAll();});
     await pg.waitForSelector('#cs-in',{timeout:20000});
     await pg.locator('#cs-in').fill(cs.slice(0,12)+'_v2');await pg.waitForFunction(c=>document.querySelector('#cs-note').textContent.includes(c+' is available'),cs.slice(0,12)+'_v2',{timeout:10000});await pg.waitForFunction(()=>/available/.test(document.querySelector('#cs-note').textContent),null,{timeout:10000});
     await pg.screenshot({path:path.join(OUT,name+'-'+label+'-callsign.png')});
     await pg.locator('[data-act="cssave"]').click();await pg.waitForFunction(c=>tgName(TG_USER)===c,cs.slice(0,12)+'_v2',{timeout:10000});
    }
    assert(!errs.length,'page errors: '+errs.join(' | '));
    pass++;results.push(name+' '+label+' ok');console.log('PASS',name,label);
    await ctx.close();
   }
   await browser.close();
  }
 }catch(e){await explain();throw e;}finally{srv.kill();}
 console.log('signup-browser: passed '+pass+' ('+engines.join(', ')+')');
})().catch(e=>{console.error(e);process.exit(1);});
