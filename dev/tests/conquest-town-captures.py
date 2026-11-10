"""Session 5B visual captures (Chromium 390x844 portrait, HIGH/LOW, software GL: relative look only). Shipped client against the
real Worker reducer on a disposable local DB, scenario placements only:
 1. the eleven turret types side by side (level V) and every wall blend (composite + 18 ore blends), close up
 2. a whole-town raid replay on that layout: each turret's firing effect, raiders of every kind
 3. a fully built CC10 town on every site at HIGH (2,000 walls, 42 turrets, settler homes): draws/triangles/programs
Writes docs/conquest/session5b/*.png and captures.json."""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5b';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(quality,fixture):
    ctx=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='+json.dumps(quality)+';window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}}};try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
      body=json.loads(r.request.post_data or '{}')
      for attempt in range(2):   # the local fixture server can drop a socket under CI load ('socket hang up'): retry once, then answer 503 so the client's own retry/poll takes over instead of the harness dying
       try:resp=await page.request.post(base+u.path,data=body);return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
       except Exception:
        if attempt:return await r.fulfill(status=503,body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
        await asyncio.sleep(0.2)
     if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
     await r.abort()
    await page.route('**/*',route)
    await page.request.post(base+'/fixture',data=fixture)
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
    await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(1500)
    return ctx,page,errors
   cam=lambda page,x,z,d,tilt=.95,yaw=0:page.evaluate(f'(()=>{{const c=ConquestPlotView.state.cam;c.x={x};c.z={z};c.dist={d};c.tilt={tilt};c.yaw={yaw};}})()')
   gate=[1080,1160]
   for q in ['high','low']:
    ctx,page,errors=await session(q,{'position':gate,'baseFunds':True,'plotGallery':True})
    await page.evaluate('(()=>{ConquestPlotView.setView("build");const X=ConquestPlotView.state;X.snapOf.home="peek";X.camT=1;X.camFrom=null;ConquestPlotView.render();})()');await page.wait_for_timeout(700)   # 5C: build view, sheet at PEEK (big map)
    await cam(page,-4,-30,58,.55,3.14159);await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/f'turrets-11-390-{q}.png'))
    await cam(page,0,38,40,.6,0);await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/f'wall-blends-390-{q}.png'))
    if q=='high':
     await page.locator('.cq-plot-tabs button',has_text='DEFEND').click();await page.locator('button',has_text='START DEFENSE DRILL').click();await page.wait_for_function('ConquestPlotView.state?.drill',timeout=60000)
     ms=await page.evaluate('ConquestPlotView.state.drillMs');await cam(page,0,-34,70,.9);await page.evaluate('(()=>{const D=ConquestPlotView.state.drill,e=D.r.events.find(x=>x.k==="shot");if(e){D.t=Math.max(0,e.t-1);}})()')
     shots=[]
     for k in range(24):
      await page.wait_for_timeout(500);shots.append(await page.evaluate('ConquestPlotView.state.drill?ConquestPlotView.state.drill.shots.map(s=>s.ty):[]'))
      if k%4==3:await page.screenshot(path=str(OUT/f'raid-effects-{k//4}-390.png'))
     results['raid']={'drillMs':ms,'effectsSeen':sorted(set(t for s in shots for t in s))}
    results['gallery-'+q]={'render':await page.evaluate('ConquestPlotView.state.info'),'pageErrors':errors};assert not errors,errors
    await ctx.close()
   for site in ['crater','delta','ridge','canyon','plateau','ice','ash']:
    ctx,page,errors=await session('high',{'position':gate,'baseFunds':True,'plotFull':site});await cam(page,0,6,300,.95);await page.wait_for_timeout(2000)
    info=await page.evaluate('ConquestPlotView.state.info');await page.screenshot(path=str(OUT/f'town-cc10-{site}-390-high.png'))
    results['town-'+site]={'render':info,'pageErrors':errors};assert info['programs']<=16 and not errors,results['town-'+site]
    await ctx.close()
   await browser.close()
  json.dump(results,open(OUT/'captures.json','w'),indent=1);print(json.dumps(results)[:1800])
  print('PASS town captures: 11 turrets, 19 wall blends (HIGH/LOW), raid effects, CC10 towns on all seven sites (programs <= 16)')
 finally:
  server.kill()
asyncio.run(main())
