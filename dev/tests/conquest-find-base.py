"""Find My Base (owner playtest, Nov 8 2026: "I have no idea how and where to find my base"). Shipped client, Chromium
390x844, against the real Worker reducer on a disposable local DB. A brand-new pilot at the Refuge, no base yet:
 1. the gold "⌂ MY BASE" HUD button shows the live distance and pulses on first visits (the mission guidance is not taken
    over); one tap sets the route home (nav: MY BASE) and stops the pulse
 2. the route's first aim point is WEST of the Refuge (toward the base; the old towers detour pointed east)
 3. driving by the HUD arrow only (the DRIVE stick pushed toward the arrow's aim point) reaches the gate, and the claim screen
    (site picker) opens by itself on arrival - no ENTER BASE tap
 4. the region map legend says "My base"; tapping the gold marker does the one-tap MY BASE action (here, at the gate: opens it)
Runs in the 2D fallback renderer (software GL cannot hold 250 ms frames in the colony in 3D; routing, HUD and arrival logic are
identical).
"""
import asyncio,json,math,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/find-my-base';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   ctx=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="high";window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
   async def route(r):
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
     resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
    if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
    await r.abort()
   await page.route('**/*',route)
   refuge=[1174,1168];fixture={'position':refuge,'fieldMissions':True}
   await page.request.post(base+'/fixture',data=fixture)
   await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.request.post(base+'/fixture',data=fixture)
   await page.evaluate('localStorage.removeItem("lunar-cq-my-base-found-v1");closeAll();save.welcomed=true;save.gfx="2d";uiDirty();')   # 2D fallback: same Conquest logic, usable frame times in software GL (the colony is the heaviest 3D scene)
   await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
   # 1. HUD button: pulses on the first visit; one tap routes home
   btn=page.locator('#cq-home-btn');await btn.wait_for(state='visible',timeout=20000)
   await page.wait_for_function('document.querySelector("#cq-home-btn.cq-home-new")&&document.querySelector("#cq-home-btn .cq-home-d")?.textContent.endsWith(" m")',timeout=10000)
   untouched=await page.evaluate('Conquest.view.routeTarget?.kind||null');assert untouched!='base',untouched   # the first-visit pulse never hijacks the mission arrow
   await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/'hud-first-visit-390.png'))
   b=await btn.bounding_box();await page.touchscreen.tap(b['x']+b['width']/2,b['y']+b['height']/2)
   await page.wait_for_function('Conquest.view.routeTarget?.kind==="base"&&!document.querySelector("#cq-home-btn.cq-home-new")&&/MY BASE$/.test(document.querySelector(".cq-nav-title")?.textContent||"")',timeout=10000)
   label=await btn.inner_text();title=await page.locator('.cq-nav-title').inner_text()
   assert 'MY BASE' in label and ' m' in label,label
   assert title.strip().endswith('MY BASE'),title
   # 2. the route heads west, toward the base
   await page.wait_for_function('Conquest.view.homeRoute?.aim?.point',timeout=10000)
   aim=await page.evaluate('({x:Conquest.view.homeRoute.aim.point.x,z:Conquest.view.homeRoute.aim.point.z,n:Conquest.view.homeRoute.path.length})')
   assert aim['x']<refuge[0],aim
   await page.wait_for_timeout(600);await page.screenshot(path=str(OUT/'hud-my-base-390.png'))
   results['hud']={'button':label,'nav':title,'firstAim':aim}
   # the map from the Refuge: the gold MY BASE marker and its label, one zoom step at a time
   await page.get_by_role('button',name='OPEN MAP').click();await page.wait_for_selector('.cq-map canvas')
   for _ in range(5):await page.get_by_role('button',name='−',exact=True).last.click()
   await page.wait_for_timeout(400);await page.locator('.cq-map canvas').screenshot(path=str(OUT/'map-from-refuge-390.png'))
   await page.get_by_role('button',name='CLOSE MAP').click();await page.evaluate('Conquest.view.routeTarget=Conquest.view.routeTarget||null')
   await page.wait_for_function('Conquest.view.routeTarget?.kind==="base"',timeout=5000)
   # 3. drive by the arrow only: the on-screen DRIVE stick pushed toward the arrow's aim point (what a thumb does)
   t0=asyncio.get_event_loop().time();arrived=False
   while asyncio.get_event_loop().time()-t0<150:
    st=await page.evaluate("""(()=>{const v=Conquest.view,a=v.homeRoute?.aim?.point,D=ConquestCombat.baseDefinition,site=!!document.querySelector('.cq-site-card');
     if(site||!a){v.stick.x=0;v.stick.z=0;}else{const dx=a.x-v.p.x,dz=a.z-v.p.z,L=Math.hypot(dx,dz)||1;v.stick.x=(Math.cos(v.yaw)*dx-Math.sin(v.yaw)*dz)/L;v.stick.z=(-Math.sin(v.yaw)*dx-Math.cos(v.yaw)*dz)/L;}
     return {x:v.p.x,z:v.p.z,a:a?{x:a.x,z:a.z}:null,d:Math.hypot(v.p.x-D.x,v.p.z-D.z),site};})()""")
    if st['site']:arrived=True;break
    await page.wait_for_timeout(100)
   await page.evaluate('Conquest.view.stick.x=0;Conquest.view.stick.z=0')
   drive_s=round(asyncio.get_event_loop().time()-t0,1)
   assert arrived,('did not reach the gate by arrow',st)
   await page.wait_for_timeout(700);await page.screenshot(path=str(OUT/'arrived-claim-opens-390.png'))
   seen=await page.evaluate('localStorage.getItem("lunar-cq-my-base-found-v1")')
   results['drive']={'seconds':drive_s,'claimScreenOpenedItself':arrived,'remembered':seen}
   assert seen=='1'
   # 4. map: label, legend, tap the marker to route
   await page.get_by_role('button',name='LEAVE BASE').click()
   await page.wait_for_timeout(400);await page.evaluate('Conquest.view.routeTarget=null')
   await page.get_by_role('button',name='OPEN MAP').click();await page.wait_for_selector('.cq-map canvas')
   legend=await page.locator('.cq-map-legend').inner_text();assert 'My base' in legend,legend
   await page.get_by_role('button',name='WHOLE WORLD').click();await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/'map-my-base-390.png'))
   r=await page.evaluate('(()=>{const c=document.querySelector(".cq-map canvas").getBoundingClientRect(),B=ConquestCombat.baseDefinition,q=ConquestWorld.mapPoint(B.x,B.z);return {x:c.x+(40+q.u*280)*c.width/360,y:c.y+(q.v*420)*c.height/420};})()')
   await page.touchscreen.tap(r['x'],r['y']);await page.wait_for_timeout(500)
   routed=await page.evaluate('({kind:Conquest.view.routeTarget?.kind||null,mapOpen:!!document.querySelector(".cq-map"),opened:!!document.querySelector(".cq-site-card")})')   # at the gate, the same one tap opens the base
   results['map']={'legend':legend,'tapRoutes':routed}
   assert not routed['mapOpen'] and (routed['opened'] or routed['kind']=='base'),routed
   assert not errors,errors
   results['pageErrors']=errors
   await ctx.close();await browser.close()
  json.dump(results,open(OUT/'find-my-base.json','w'),indent=1);print(json.dumps(results))
  print('PASS find my base 390: gold MY BASE button (first-visit pulse, one tap routes home), west-bound route from the Refuge, arrow-only drive reaches the gate and the claim screen opens itself, map MY BASE marker routes home')
 finally:
  server.kill()
asyncio.run(main())
