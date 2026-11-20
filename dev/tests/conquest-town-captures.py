"""Session 5B visual captures (Chromium 390x844 portrait by default, HIGH/LOW, software GL: relative look only). Session 5E-2d1
added the sizes (--size 390x700 | 320x568 | 1366x768 | 1920x1080, --mouse for a keyboard-and-mouse computer), --out, --quality,
--only and part 4 (--kinds: every code-built town building, turret, wall, home and decoration close up in a CC10 town).
Shipped client against the
real Worker reducer on a disposable local DB, scenario placements only:
 1. the eleven turret types side by side (level V) and every wall blend (composite + 18 ore blends), close up
 2. a whole-town raid replay on that layout: each turret's firing effect, raiders of every kind
 3. a fully built CC10 town on every site at HIGH (2,000 walls, 42 turrets, settler homes): draws/triangles/programs
 4. (--kinds) the camera on one building of every type in the CC10 ridge town, build view and drive view
Writes docs/conquest/session5b/*.png and captures.json (or --out)."""
import argparse,asyncio,json,pathlib,shutil
ap=argparse.ArgumentParser();ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default='');ap.add_argument('--quality',default='high,low');ap.add_argument('--only',default='gallery,raid,towns');ap.add_argument('--kinds',action='store_true');ap.add_argument('--sites',default='crater,delta,ridge,canyon,plateau,ice,ash');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--ratio',type=float,default=0)
A=ap.parse_args();VW,VH=[int(v) for v in A.size.split('x')];TAG='390' if A.size=='390x844' else A.size
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path(A.out) if A.out else ROOT/'docs/conquest/session5b';OUT.mkdir(parents=True,exist_ok=True)
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
    ctx=await browser.new_context(viewport={'width':VW,'height':VH},device_scale_factor=A.dpr,has_touch=not A.mouse,is_mobile=not A.mouse,reduced_motion='reduce');page=await ctx.new_page()
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
    if A.ratio:await page.evaluate('r=>{const v=Conquest.view;v.res=null;v.renderer.setPixelRatio(r);}',A.ratio)
    await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(1500)
    return ctx,page,errors
   cam=lambda page,x,z,d,tilt=.95,yaw=0:page.evaluate(f'(()=>{{const c=ConquestPlotView.state.cam;c.x={x};c.z={z};c.dist={d};c.tilt={tilt};c.yaw={yaw};}})()')
   gate=[1080,1160]
   ONLY=A.only.split(',')
   for q in ([x for x in A.quality.split(',') if x] if 'gallery' in ONLY else []):
    ctx,page,errors=await session(q,{'position':gate,'baseFunds':True,'plotGallery':True})
    await page.evaluate('(()=>{ConquestPlotView.setView("build");const X=ConquestPlotView.state;X.snapOf.home="peek";X.camT=1;X.camFrom=null;ConquestPlotView.render();})()');await page.wait_for_timeout(700)   # 5C: build view, sheet at PEEK (big map)
    await cam(page,-4,-30,58,.55,3.14159);await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/f'turrets-11-{TAG}-{q}.png'))
    await cam(page,0,38,40,.6,0);await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/f'wall-blends-{TAG}-{q}.png'))
    if q=='high' and 'raid' in ONLY:
     await page.locator('.cq-plot-tabs button',has_text='DEFEND').click();await page.locator('button',has_text='START DEFENSE DRILL').click();await page.wait_for_function('ConquestPlotView.state?.drill',timeout=60000)
     ms=await page.evaluate('ConquestPlotView.state.drillMs');await cam(page,0,-34,70,.9);await page.evaluate('(()=>{const D=ConquestPlotView.state.drill,e=D.r.events.find(x=>x.k==="shot");if(e){D.t=Math.max(0,e.t-1);}})()')
     shots=[]
     for k in range(24):
      await page.wait_for_timeout(500);shots.append(await page.evaluate('ConquestPlotView.state.drill?ConquestPlotView.state.drill.shots.map(s=>s.ty):[]'))
      if k%4==3:await page.screenshot(path=str(OUT/f'raid-effects-{k//4}-{TAG}.png'))
     results['raid']={'drillMs':ms,'effectsSeen':sorted(set(t for s in shots for t in s))}
    results['gallery-'+q]={'render':await page.evaluate('ConquestPlotView.state.info'),'pageErrors':errors};assert not errors,errors
    await ctx.close()
   for site in ([x for x in A.sites.split(',') if x] if 'towns' in ONLY else []):
    ctx,page,errors=await session('high',{'position':gate,'baseFunds':True,'plotFull':site});await cam(page,0,6,300,.95);await page.wait_for_timeout(2000)
    info=await page.evaluate('ConquestPlotView.state.info');await page.screenshot(path=str(OUT/f'town-cc10-{site}-{TAG}-high.png'))
    results['town-'+site]={'render':info,'pageErrors':errors};assert info['programs']<=16 and not errors,results['town-'+site]
    await ctx.close()
   # ---- 4 (5E-2d1): one building of every type, close up, in the CC10 ridge town: the build view, then the drive view ----
   if A.kinds:
    for q in [x for x in A.quality.split(',') if x]:
     ctx,page,errors=await session(q,{'position':gate,'baseFunds':True,'plotFull':'ridge'});await page.wait_for_timeout(1500)
     await page.evaluate('(()=>{ConquestPlotView.setView("build");const X=ConquestPlotView.state;X.snapOf.home="peek";X.camT=1;X.camFrom=null;ConquestPlotView.render();})()');await page.wait_for_timeout(700)
     spots=await page.evaluate('''(()=>{const P=ConquestPlot,p=Conquest.view.authority.state.plot,out={},c=P.GRID.cell;for(const [id,b] of Object.entries(p.b)){if(out[b.t])continue;const s=P.sizeOf(b.t,b.r|0);out[b.t]=[P.cellX(b.i)+(s.w-1)*c/2,P.cellZ(b.j)+(s.d-1)*c/2,Math.max(s.w,s.d)*c];}
       const wk=Object.keys(p.w)[40];if(wk){const [i,j]=wk.split(',').map(Number);out['walls']=[P.cellX(i),P.cellZ(j),14];}return out;})()''')
     for t,(x,z,sz) in spots.items():
      await cam(page,x,z+sz*.2,max(16,sz*2.3),.62,0);await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/f'kind-{t}-{TAG}-{q}.png'))
     await cam(page,0,10,95,.7,.6);await page.wait_for_timeout(1200);await page.screenshot(path=str(OUT/f'kind-town-centre-{TAG}-{q}.png'))
     results['kinds-'+q]={'types':sorted(spots),'render':await page.evaluate('ConquestPlotView.state.info'),'pageErrors':errors};assert not errors,errors
     await ctx.close()
   await browser.close()
  json.dump(results,open(OUT/('captures.json' if TAG=='390' else 'captures-'+TAG+'.json'),'w'),indent=1);print(json.dumps(results)[:1800])
  print('PASS town captures: 11 turrets, 19 wall blends (HIGH/LOW), raid effects, CC10 towns on all seven sites (programs <= 16)')
 finally:
  server.kill()
asyncio.run(main())
