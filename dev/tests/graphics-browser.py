# Actual shared app + combat; all services intercepted to disposable fixture. No production fallback.
import asyncio,pathlib,json,base64,subprocess,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/graphics-session4-evidence');BASE='https://lunar.test';FIX='http://127.0.0.1:8797';OLD='--baseline' in sys.argv;BUSY='--busy-only' in sys.argv
OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='no-preference');errors=[];mutations=[]
  if OLD:await ctx.add_init_script('window.LUNAR_HF_SAMPLE=true')
  async def route(r):
   assert r.request.url.startswith(BASE+'/'),'Blocked production request: '+r.request.url
   path=r.request.url[len(BASE)+1:].split('?')[0]
   if OLD and path in ['web/boot.js','web/scene.js','web/game.js','js/equipment3d.js','js/render3d.js','js/render.js']:
    return await r.fulfill(body=subprocess.check_output(['git','show','a81acf69:'+path],cwd=ROOT),content_type='application/javascript')
   if path=='js/graphics.js':return await r.fulfill(body=(ROOT/path).read_text().replace('enabled:false','enabled:true'),content_type='application/javascript')
   res=await r.fetch(url=FIX+r.request.url[len(BASE):]);await r.fulfill(response=res)
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  await pg.goto(BASE+'/web/equipment-preview.html');await pg.evaluate('''async()=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id:91002941})}).then(r=>r.json());if(!(await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)})).ok)throw Error('Local fixture auth failed');}''')
  await pg.goto(BASE+'/web/play.html#garage');await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&!!webShowroom?.model&&Equipment3D.active()',timeout=60000)
  await pg.evaluate('()=>{save.welcomed=true;closeAll();passState();setGfx("high");setTab("garage");webShowroom.auto=false;const original=frame;frame=function(t){if(!window.__testPause)original(t);else requestAnimationFrame(frame);};}')
  original=await pg.evaluate('JSON.stringify(ecoCopy())');bays=await pg.evaluate('JSON.stringify(save.lab)')
  pg.on('request',lambda r:mutations.append(r.url) if r.method=='POST' and any(x in r.url for x in ['/api/act','/api/match','/api/pvp','/api/pay','/api/ghost']) else None)
  await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-chassis','vanguard:0');await pg.select_option('#lab-weapon','moon:2')
  suffix='before' if OLD else 'busy-after' if BUSY else 'after';layout=[];coverage=[];await pg.screenshot(path=str(OUT/f'{suffix}-engineer-390.png'))
  if not OLD and not BUSY:
   assert await pg.evaluate('GraphicsRelease.enabled&&!window.LUNAR_HF_SAMPLE'),'test actual release gate, no sample flag'
   if '--lifecycle-only' in sys.argv:
    await pg.select_option('#lab-weapon','pulse:0');await pg.evaluate('()=>{webShowroom.auto=false;webShowroom.view("side");}')
    frames=[]
    for phase in [0,.12]:
     png=await pg.evaluate('''(phase)=>{const s=webShowroom;if(phase)s.motion.step(.05,{dx:phase,dz:0,heading:0,aim:0},false);s.draw();return s.renderer.domElement.toDataURL().split(',')[1];}''',phase);frames.append(png);(OUT/f'motion-drive-{phase}.png').write_bytes(base64.b64decode(png))
    assert frames[0]!=frames[1],'real drive shader must change rendered pixels'
    await pg.evaluate('()=>{webShowroom.auto=true;webShowroom.visible=true;webShowroom.run();}')
    await pg.emulate_media(reduced_motion='reduce');yaw=await pg.evaluate('webShowroom.yaw');await pg.wait_for_timeout(200);assert abs(await pg.evaluate('webShowroom.yaw')-yaw)<1e-8,'live reduced-motion change must stop auto rotation'
    await pg.evaluate('()=>{Object.defineProperty(navigator,"deviceMemory",{value:undefined,configurable:true});Object.defineProperty(navigator,"hardwareConcurrency",{value:6,configurable:true});setGfx("auto");}')
    await pg.wait_for_function('()=>R3.q==="low"&&Equipment3D.active()&&Equipment3D.quality==="low"');assert await pg.evaluate('webShowroom.renderer.getPixelRatio()===1')
    assert not errors,errors;assert not mutations,mutations
    (OUT/'lifecycle-final.json').write_text(json.dumps({'liveReducedMotion':True,'unknownMobileAutoLow':True,'errors':errors,'mutations':mutations}));await b.close();print('PASS live reduced-motion preference and conservative mobile Auto profile',flush=True);return

   layout=[]
   for width,height in [(320,844),(390,844),(430,844),(1280,720)]:
    await pg.set_viewport_size({'width':width,'height':height});await pg.evaluate('()=>{webUpdateMachine();webShowroom.draw();}');assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth');await pg.screenshot(path=str(OUT/f'engineer-{width}.png'));layout.append([width,height])
   await pg.set_viewport_size({'width':390,'height':844})
   for q in ['low','2d','high','auto','low','high']:
    await pg.evaluate('(q)=>setGfx(q)',q);await pg.wait_for_timeout(120)
    if q=='2d':assert await pg.evaluate('!webShowroom.renderer&&!use3D()')
    else:
     await pg.wait_for_function('(q)=>!!webShowroom.renderer&&Equipment3D.active()&&Equipment3D.quality===R3.q',arg=q,timeout=30000)
     assert await pg.evaluate('(q)=>q==="auto"||R3.q===q',q)
   # All actual hulls render their drive shader; standard weapons, independent and combined legends.
   coverage=[]
   for q in ['high','low']:
    await pg.evaluate('(q)=>setGfx(q)',q);await pg.wait_for_function('()=>Equipment3D.active()')
    for cls in ['scout','vanguard','titan']:
     for t in range(3):
      row=await pg.evaluate('''({cls,t,q})=>{const s=webShowroom,L=JSON.parse(JSON.stringify(s.L));L.c={...L.c,c:cls,t};L.w={...L.w,a:cls==='scout'?'twin':cls==='titan'?'siege':'pulse',t};L.skin=t===2?'lunar':'default';s.setLoadout(L);s.motion.step(.03,{dx:.07,dz:0,heading:.02,aim:0},false);s.draw();s.renderer.getContext().finish();return {cls,t,q,calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,error:s.renderer.getContext().getError()};}''',{'cls':cls,'t':t,'q':q});assert row['error']==0;coverage.append(row)
   await pg.evaluate('()=>{setGfx("high");webUpdateMachine();}')
  rows=[]
  modes=[('arena','classic'),('zone','overpass'),('crystal','longshot'),('bounty','craters'),('royale','classic'),('boss','craters')]
  if OLD or BUSY:modes=[('royale','classic')]
  for mode,mapid in modes:
   await pg.locator('[data-act="rangedraft"]').click();await pg.select_option('#range-mode',mode);await pg.select_option('#range-control','ai');await pg.locator('#range-map').evaluate('e=>e.closest("details").open=true');await pg.select_option('#range-map',mapid);await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim');await pg.evaluate('()=>{window.__testPause=true;rangeRun.paused=true;rangeRun.sim.setup(rangeRun.cfg);}')
   row=await pg.evaluate('''()=>{const r=rangeRun;for(let i=0;i<600&&r.sim.view().state==='play';i++){r.sim.step(1/60,[0,0]);r.sim.events();}const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');let cold=performance.now();rangeWithView(()=>{ensureMap();matchObjs();drawBattle();});RR.getContext().finish();cold=performance.now()-cold;const times=[];for(let i=0;i<40;i++){const t=performance.now();rangeWithView(()=>drawBattle());RR.getContext().finish();times.push(performance.now()-t);}rangeWithView(()=>{drawBattle();x.drawImage(CV3,0,0,c.width,c.height);x.drawImage(cv,0,0);});return {mode:r.cfg.g,map:r.cfg.map,result:r.sim.result(),coldMs:cold,meanMs:times.reduce((a,b)=>a+b)/40,worstMs:Math.max(...times),triangles:RR.info.render.triangles,calls:RR.info.render.calls,memory:{...RR.info.memory},programs:RR.info.programs.length,glError:RR.getContext().getError(),png:c.toDataURL().split(',')[1]};}''');(OUT/f'{suffix}-{mode}-390.png').write_bytes(base64.b64decode(row.pop('png')));assert row['glError']==0
   if not OLD:
    # Real shot/hit/super presentation on existing hardware, no simulated damage injections.
    if mode=='royale':
     qrows=[]
     for q in ['high','low']:
      await pg.evaluate('(q)=>setGfx(q)',q);await pg.wait_for_function('()=>Equipment3D.active()');z=await pg.evaluate('''()=>{rangeWithView(()=>{ensureMap();matchObjs();drawBattle();});RR.getContext().finish();const a=[];for(let i=0;i<40;i++){let t=performance.now();rangeWithView(()=>drawBattle());RR.getContext().finish();a.push(performance.now()-t);}return {q:R3.q,calls:RR.info.render.calls,triangles:RR.info.render.triangles,meanMs:a.reduce((a,b)=>a+b)/40,worstMs:Math.max(...a),memory:{...RR.info.memory},programs:RR.info.programs.length};}''');qrows.append(z)
     row['profiles']=qrows
     await pg.evaluate('()=>setGfx("high")');await pg.wait_for_function('()=>Equipment3D.active()')
     stress=await pg.evaluate('''()=>{let data;rangeWithView(()=>{ensureMap();matchObjs();drawBattle();for(let j=0;j<500;j++){impact3(10,20,'moon');boom3(11,19,2,'#ff9933');}drawBattle();data={live:PSA.live.length+PSN.live.length,max:particleCap(PSA)+particleCap(PSN),calls:RR.info.render.calls,triangles:RR.info.render.triangles};});return data;}''');assert 1500<stress['live']<=stress['max'];row['stress']=stress
     await pg.evaluate('()=>{const r=rangeRun;rangeWithView(()=>{for(const u of units)if(u.hp>0){const o=unitObj(u);for(const a of ["pulse","twin","siege","moon"])muzzle(u,a);}impact3(8,21,"moon");drawBattle();});}')
     png=await pg.evaluate('''()=>{const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');rangeWithView(()=>{drawBattle();x.drawImage(CV3,0,0,c.width,c.height);x.drawImage(cv,0,0);});return c.toDataURL().split(',')[1];}''');(OUT/'effects-stress-390.png').write_bytes(base64.b64decode(png))
    if not BUSY:
     end=await pg.evaluate('''()=>{const r=rangeRun;let n=0;for(;n<72000&&r.sim.view().state==='play';n++){r.sim.step(1/60,[0,0]);r.sim.events();}return {steps:n,state:r.sim.view().state,result:r.sim.result()};}''');assert end['state']=='over',end;row['completed']=end
     await pg.evaluate('()=>rangeFinish()');assert await pg.locator('[data-act="rangerepeat"]').count()>0
     await pg.evaluate('()=>rangeExit()')
    else:await pg.evaluate('()=>rangeExit()')
   else:await pg.evaluate('()=>rangeExit()')
   await pg.evaluate('()=>{window.__testPause=false;closeAll();setTab("garage");ACT.labedit("m_spare");}');await pg.select_option('#lab-chassis','vanguard:0');await pg.select_option('#lab-weapon','moon:2');rows.append(row);print(suffix,mode,row['calls'],row['triangles'],flush=True)
  if not OLD and not BUSY:
   # Repeated swaps retain stable owned resources; BFCache, reduced motion, context fallback/retry.
   cache=await pg.evaluate('''()=>{const rows=[];for(let j=0;j<2;j++){for(let i=0;i<8;i++){webShowroom.setContext(i%2?'garage':'engineer');webShowroom.draw();}rows.push({...webShowroom.renderer.info.memory,programs:webShowroom.renderer.info.programs.length});}return rows;}''');assert cache[1]['geometries']<=cache[0]['geometries']+2 and cache[1]['textures']==cache[0]['textures'],cache
   await pg.emulate_media(reduced_motion='reduce');quiet=await pg.evaluate('()=>{const s=webShowroom;s.motion.state.kick=1;s.draw();return {kick:s.motion.state.kick,charge:s.motion.uniforms.uCharge.value}}');assert quiet=={'kick':0,'charge':0}
   await pg.evaluate('()=>{window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));}');assert await pg.evaluate('!!webShowroom.renderer&&!webShowroom.disposed')
   await pg.evaluate('()=>{CV3.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));}');assert await pg.evaluate('!use3D()');await pg.evaluate('()=>setGfx("high")');await pg.wait_for_function('()=>use3D()&&!!webShowroom.renderer')
   await pg.evaluate('()=>setGfx("2d")');await pg.screenshot(path=str(OUT/'fallback-2d-390.png'));await pg.evaluate('()=>setGfx("high")');await pg.wait_for_function('()=>use3D()')
   final={'layout':layout,'coverage':coverage,'cache':cache,'quiet':quiet}
  else:final={}
  assert json.loads(await pg.evaluate('JSON.stringify(ecoCopy())'))==json.loads(original);assert await pg.evaluate('JSON.stringify(save.lab)')==bays
  assert not mutations,mutations;assert not errors,errors
  (OUT/f'{suffix}.json').write_text(json.dumps({**final,'battle':rows,'errors':errors,'mutations':mutations,'platform':'Chromium/SwiftShader; simulated viewports, local signed fixtures; not physical iPhone'},indent=2));await b.close();print('PASS',suffix,'real app, shader compilation, quality/lifecycle, unchanged bays/economy, no production mutations',flush=True)
asyncio.run(main())
