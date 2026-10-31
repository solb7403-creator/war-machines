// Live nonpayment gear release: real flag (no route intercepts of js/graphics.js), Play roster, quality, layouts.
// Run against the disposable fixture: LUNAR_STANDARD_VISUAL_FIXTURE=1 LUNAR_LEGEND_VISUAL_FIXTURE=1 LUNAR_FIXTURE_PORT=8797 node dev/tests/webserver.mjs
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE='https://lunar.test',FIX=process.argv[2]||'http://127.0.0.1:8797';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),errors=[],mutations=[];
  await ctx.route('**/*',async r=>{const u=r.request().url();assert.ok(u.startsWith(BASE+'/'),'Blocked non-fixture request: '+u);await r.fulfill({response:await r.fetch({url:FIX+u.slice(BASE.length)})});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(String(e)));pg.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await pg.goto(BASE+'/web/equipment-preview.html');
  await pg.evaluate(async()=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id:91002941})}).then(r=>r.json());if(!(await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)})).ok)throw Error('fixture auth failed');});
  await pg.goto(BASE+'/web/play.html#play');
  await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save?.lab&&typeof Equipment3D!=='undefined',null,{timeout:60000});
  const gate=await pg.evaluate(()=>({enabled:GraphicsRelease.enabled,version:GraphicsRelease.version,sample:!!window.LUNAR_HF_SAMPLE,build:window.BUILD}));
  assert.deepEqual([gate.enabled,gate.sample],[true,false],'actual shipped release gate, no sample flag');
  await pg.evaluate(()=>{save.welcomed=true;closeAll();passState();setGfx('high');setTab('play');});
  await pg.waitForFunction(()=>Equipment3D.active(),null,{timeout:60000});
  const ecoBefore=await pg.evaluate(()=>JSON.stringify(ecoCopy()));
  pg.on('request',r=>{if(r.method()==='POST'&&['/api/match','/api/pvp','/api/pay','/api/ghost','/api/stars','/api/ton','/api/sol','/api/buy'].some(x=>r.url().includes(x)))mutations.push(r.url());});
  // Play-screen roster lists exactly the two owned bays; the active one is selected.
  const roster=await pg.evaluate(()=>[...document.querySelectorAll('#s-play .battle-roster-card')].map(c=>({sel:c.classList.contains('selected'),name:c.querySelector('.battle-roster-name').textContent,items:c.querySelector('.battle-roster-items').textContent,id:c.querySelector('[data-act="labequip"]').dataset.arg})));
  assert.equal(roster.length,2,'two bays on Play');assert.equal(roster.filter(r=>r.sel).length,1,'one deploying bay');
  for(const [w,h] of [[320,700],[390,844],[430,932],[1280,800]]){await pg.setViewportSize({width:w,height:h});await pg.evaluate(()=>{setTab('play');});await pg.waitForTimeout(150);assert.ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at '+w);}
  await pg.setViewportSize({width:390,height:844});
  // Switching the deploying bay goes through the existing authoritative lab_activate request.
  const other=roster.find(r=>!r.sel);await pg.evaluate(()=>setTab('play'));await pg.locator('#s-play [data-act="labequip"][data-arg="'+other.id+'"]').click();
  await pg.waitForFunction(id=>save.lab.active===id,other.id,{timeout:15000});
  await pg.waitForFunction(id=>!!document.querySelector('#s-play .battle-roster-card.selected [data-arg="'+id+'"]'),other.id,{timeout:15000});
  const after=JSON.parse(await pg.evaluate(()=>JSON.stringify(ecoCopy())));const before=JSON.parse(ecoBefore);
  for(const k of ['pts','cOwn','wOwn','skin','moonbeam'])assert.deepEqual(after[k],before[k],'bay switch must not change '+k);
  // Quality cycling on the real live gate.
  for(const q of ['low','2d','high','auto']){await pg.evaluate(q=>setGfx(q),q);await pg.waitForTimeout(150);if(q==='2d')assert.ok(await pg.evaluate(()=>!use3D()));else await pg.waitForFunction(()=>Equipment3D.active()&&Equipment3D.quality===R3.q,null,{timeout:30000});}
  assert.deepEqual(mutations,[],'no match/payment requests');assert.deepEqual(errors,[],'no page errors');
  console.log('PASS live gate',JSON.stringify(gate),'roster',JSON.stringify(roster.map(r=>r.items)),'bay switch via lab_activate, quality cycle, 320/390/430/1280 layouts');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
