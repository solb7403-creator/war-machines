"""Meshy proof v2, town + world (Session 5E-2a). Shipped client against the real Worker reducer on a disposable local DB
(dev/tests/conquest-server.mjs), HIGH graphics, a GPU renderer string (anti-aliasing and full resolution as on a device),
captures only after the Meshy files load. Profiles: phone 390x844 at 3x and desktop 1920x1080.
 1. world: the player's tank in the Conquest world is the Meshy chassis + weapon
 2. town: the turret gallery (all 11 turret types) and the Command Center; every one of the 12 town items is drawn with its
    Meshy model (buildings as Meshy groups, turrets as Meshy instanced base + head)
Writes <out>/town_*.png, world_*.png and town.json.   usage: python dev/assets/meshy/proof/v2_town.py <out-dir>"""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[4];OUT=pathlib.Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
SPOOF="(()=>{for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){if(p===0x9246)return 'ANGLE (Apple, Apple M-series GPU, OpenGL 4.1)';return g.call(this,p);};}})();"
TOWN=['cc','reactor','refinery','lab','shield','storage','tesla','cannon','mg','rocket','laser','railgun']
PROFILES=[('phone3x',{'width':390,'height':844},3,True),('desktop1920',{'width':1920,'height':1080},1,False)]
import os
if os.environ.get('V2_PROFILES'):PROFILES=[p for p in PROFILES if p[0] in os.environ['V2_PROFILES'].split(',')]   # e.g. V2_PROFILES=phone3x
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist']}
   exe=shutil.which('chromium')
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   for name,vp,dpr,mobile in PROFILES:
    for kind,fixture in [('gallery',{'position':[1080,1160],'baseFunds':True,'plotGallery':True}),('full',{'position':[1080,1160],'baseFunds':True,'plotFull':'ridge'})]:
     ctx=await browser.new_context(viewport=vp,device_scale_factor=dpr,has_touch=mobile,is_mobile=mobile);page=await ctx.new_page()
     errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     await page.add_init_script(SPOOF+'window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="high";window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}}};try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
     async def route(r):
      u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
      if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
       body=json.loads(r.request.post_data or '{}')
       for attempt in range(2):
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
     await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"')
     await page.request.post(base+'/fixture',data=fixture)
     await page.evaluate('closeAll();save.welcomed=true;setGfx("high");uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
     await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=900000)
     if kind=='gallery':
      pass
     # ---- world: the player's tank
     await page.wait_for_function('(()=>{let c=0;Conquest.view.vehicle.traverse(o=>{if(o.isMesh&&o.userData.meshy)c++;});return c>=2;})()',timeout=120000)
     await page.evaluate('(()=>{const v=Conquest.view;v.distance=26;v.pitch=.42;})()');await page.wait_for_timeout(2500)
     world=await page.evaluate('''(()=>{const v=Conquest.view,ids=[];v.vehicle.traverse(o=>{if(o.isMesh&&o.userData.meshy)ids.push(o.userData.meshy.asset.id);});const gl=v.renderer.getContext();return {ids,pixelRatio:v.renderer.getPixelRatio(),antialias:gl.getContextAttributes().antialias,programs:v.renderer.info.programs.length};})()''')
     await page.screenshot(path=str(OUT/f'world_{name}_{kind}.png'))
     # ---- town: gallery (11 turrets + buildings)
     await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(1500)
     await page.evaluate('(()=>{ConquestPlotView.setView("build");const X=ConquestPlotView.state;X.snapOf.home="peek";X.camT=1;X.camFrom=null;ConquestPlotView.render();})()')
     want=json.dumps(TOWN)
     for attempt in range(20):
      town=await page.evaluate('''(want=>{const R=ConquestPlotView.state.R,got={},kit=[];for(const e of R.meshes.values()){let my=null;e.o.traverse(o=>{if(o.userData&&typeof o.userData.meshyTown==='string')my=o.userData.meshyTown;});if(my)got[my]=(got[my]||0)+1;else kit.push(e.key||'?');}for(const [k,t] of R.tur)if(t.meshy)got[t.meshy.asset.id]=(got[t.meshy.asset.id]||0)+t.items.length;else kit.push('turret:'+k);
        const R3=ConquestPlotView.state.ctx.view.renderer;return {meshy:got,missing:want.filter(id=>!got['town-'+id]),procedural:kit,programs:R3.info.programs.length,pixelRatio:R3.getPixelRatio()};})'''+'('+want+')')
      if not town['missing']:break
      await page.wait_for_timeout(2000)
     cam=lambda x,z,d,tilt=.95,yaw=0:page.evaluate(f'(()=>{{const c=ConquestPlotView.state.cam;c.x={x};c.z={z};c.dist={d};c.tilt={tilt};c.yaw={yaw};}})()')
     await cam(-4,-30,58,.55,3.14159);await page.wait_for_timeout(2500);await page.screenshot(path=str(OUT/f'town_turrets_{name}_{kind}.png'))
     await cam(0,6,120,.8,0);await page.wait_for_timeout(2500);await page.screenshot(path=str(OUT/f'town_overview_{name}_{kind}.png'))
     if kind=='full' and name=='phone3x':   # close-ups of every Meshy town item in the real town view (colour check against town-refs-v1)
      spots=await page.evaluate('''(()=>{const R=ConquestPlotView.state.R,out={};for(const e of R.meshes.values()){let my=null;e.o.traverse(o=>{if(o.userData&&typeof o.userData.meshyTown==='string')my=o.userData.meshyTown;});if(my&&!out[my]){const p=e.o.position;out[my]=[p.x,p.z];}}for(const t of R.tur.values())if(t.meshy&&!out[t.meshy.asset.id]&&t.items[0])out[t.meshy.asset.id]=[t.items[0].x,t.items[0].z];return out;})()''')
      for tid,(x,z) in spots.items():
       d=46 if tid=='town-cc' else 30 if tid in ('town-reactor','town-refinery','town-storage','town-lab','town-shield') else 13
       await cam(x,z,d,.62,.6);await page.wait_for_timeout(1800);await page.screenshot(path=str(OUT/f'item_{tid}.png'),clip={'x':0,'y':150,'width':390,'height':420})
     results[name+'-'+kind]={'world':world,'town':town,'pageErrors':errors}
     print(name,kind,json.dumps(results[name+'-'+kind])[:900],flush=True)
     await ctx.close()
   await browser.close()
  (OUT/'town.json').write_text(json.dumps(results,indent=1))
  bad=[]
  for name,*_ in PROFILES:
   got=set();[got.update(results[name+'-'+k]['town']['meshy'].keys()) for k in ('gallery','full') if name+'-'+k in results]
   miss=[t for t in TOWN if 'town-'+t not in got];errs=sum(len(results[name+'-'+k]['pageErrors']) for k in ('gallery','full') if name+'-'+k in results)
   world=results.get(name+'-gallery',{}).get('world',{}).get('ids',[])
   results[name+'-summary']={'townItemsMeshy':sorted(got),'missing':miss,'worldTank':world,'pageErrors':errs}
   if miss or len(world)<2 or errs:bad.append((name,miss,world,errs))
  (OUT/'town.json').write_text(json.dumps(results,indent=1))
  print('TOWN/WORLD',('FAIL '+json.dumps(bad)) if bad else 'PASS: world tank and all 12 town items are Meshy on every profile')
 finally:
  server.kill()
asyncio.run(main())
