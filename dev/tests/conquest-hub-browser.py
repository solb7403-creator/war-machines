"""Session 5 Phase 3: the Conquest Command hub in the shipped client (Chromium 390x844 and 1280x800) against the real Worker
on a disposable local DB. Fast first paint (the page, cards and actions are in the DOM in the same task as the tap), then the
live status from the Worker session and the cinematic 3D hero (draws / triangles / programs recorded). The four actions:
ENTER CONQUEST, FAST TRAVEL, MY BASE, RESEARCH (disabled until Session 6). Scenario placement: a pilot with a CC3 base.
Software GL: relative look only, not phone FPS."""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright

# close a context only after its route handlers are detached: an in-flight /api/conquest/* route (the game polls while the page
# closes) otherwise throws "Response has been disposed" into the NEXT browser context (seen in CI under software GL)
async def close_ctx(ctx):
 for pg in ctx.pages:
  try:await pg.unroute_all(behavior='ignoreErrors')
  except Exception:pass
 await ctx.close()
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   for w,h,mobile in [(390,844,True),(1280,800,False)]:
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
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
    await page.request.post(base+'/fixture',data={'position':[1080,1160],'baseFunds':True,'base':{'tier':2}})
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    await page.request.post(base+'/fixture',data={'position':[1080,1160],'baseFunds':True,'base':{'tier':2}})
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();')
    firstPaint=await page.evaluate('''(()=>{const t=performance.now();document.querySelector('[data-act="conquest"]').click();const ok=document.querySelectorAll('.cq-hub-card').length===3&&document.querySelectorAll('.cq-hub-actions button').length===4;return ok?performance.now()-t:-1;})()''')
    await page.wait_for_function('ConquestHub.state?.state',timeout=60000);await page.wait_for_function('ConquestHub.state?.info?.calls>0',timeout=60000);await page.wait_for_timeout(1500)
    info=await page.evaluate('({...ConquestHub.state.info,tankError:ConquestHub.state.tankError||null,tankMeshes:(()=>{let n=0;ConquestHub.state.scene.traverse(o=>{if(o.isMesh)n++;});return n;})()})');text=await page.locator('.cq-hub-status').inner_text();acts=await page.evaluate('[...document.querySelectorAll(".cq-hub-actions button")].map(b=>b.textContent+(b.disabled?" (disabled)":""))')
    await page.screenshot(path=str(OUT/f'hub-{w}.png'));results[f'{w}x{h}']={'firstPaintMs':round(firstPaint,1),'render':info,'status':text[:400],'actions':acts,'pageErrors':errors}
    print(json.dumps(results[f'{w}x{h}']),flush=True)
    assert 0<=firstPaint<300 and 'WARFRONT' in text and 'YOUR BASE' in text and 'CC3' in text and 'LIVE EVENTS' in text and acts==['ENTER CONQUEST','FAST TRAVEL','MY BASE','RESEARCH · COMING SOON (disabled)'] and info['programs']<=12 and not errors,results[f'{w}x{h}']
    if mobile:
     await page.get_by_role('button',name='MY BASE').click()
     if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
     await page.wait_for_selector('.cq-plot-tabs',timeout=90000);results['myBase']='plot opened from the hub';await page.screenshot(path=str(OUT/'hub-my-base-390.png'))
    await close_ctx(ctx)
   await browser.close()
  json.dump(results,open(OUT/'hub-journey.json','w'),indent=1)
  print('PASS Conquest Command hub: first paint in the tap task, live status + 3D hero (own renderer, programs <= 12), four actions; MY BASE opens the plot')
 finally:server.kill()
asyncio.run(main())
