"""Render/reopen the continuously earned save, then physically exit and re-enter its base.
The preceding reducer journey uses accelerated test time, canonical inputs and zero resources.
This continuation proves actual client/Worker retention, not a native-input 80-minute playthrough.
"""
import asyncio,json,math,os,pathlib,shutil,time
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-living-war'
async def main():
 save=pathlib.Path('/tmp/lunar-earned-journey.json');assert save.is_file(),'run conquest-earned-journey.mjs first'
 earned=json.loads(save.read_text());assert earned['baseMinute']>=45 and earned['baseMinute']<=75
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,env={**os.environ,'CQ_EARNED_SAVE':str(save)},stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   browser=await pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
   context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script('const realDateNow=Date.now;Date.now=()=>realDateNow()+('+str(ready['serverTime']-time.time()*1000)+');window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};')
   async def route(r):
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.path.startswith('/api/'):
     if u.path.startswith('/api/conquest/') or u.path=='/api/sync':
      response=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));assert response.status==200,(u.path,response.status,await response.text());return await r.fulfill(status=response.status,body=await response.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     return await r.fulfill(body='{}',content_type='application/json')
    if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
    if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
    await r.abort()
   await page.route('**/*',route)
   async def enter():
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty()');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').tap()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
   await enter()
   assert await page.evaluate('Conquest.view.authority.state.base.tier===1&&Conquest.view.authority.state.base.modules.reactor===1&&Object.keys(Conquest.view.authority.state.completed).length===3')
   assert await page.evaluate('Conquest.view.authority.state.ledger.cp')==earned['final']['ledger']['cp']
   await page.screenshot(path=str(OUT/'chromium-earned-base-retained.png'))
   # Ordinary camera-relative keyboard steering through the real open gate; verified proximity.
   async def go(x,z):
    held=set()
    for i in range(250):
     p=await page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,yaw:Conquest.view.yaw,verified:Conquest.view.authority.state.position})');dx=x-p['x'];dz=z-p['z'];d=math.hypot(dx,dz)
     if d<5 and math.hypot(x-p['verified']['x'],z-p['verified']['z'])<7:break
     sx=(math.cos(p['yaw'])*dx-math.sin(p['yaw'])*dz)/max(d,.001);sz=(-math.sin(p['yaw'])*dx-math.cos(p['yaw'])*dz)/max(d,.001);want=set()
     if d>4:
      if abs(sx)>.3:want.add('d' if sx>0 else 'a')
      if abs(sz)>.3:want.add('w' if sz>0 else 's')
     for k in held-want:await page.keyboard.up(k)
     for k in want-held:await page.keyboard.down(k)
     held=want;await page.wait_for_timeout(100)
    else:raise AssertionError(('physical base gate route',x,z,p))
    for k in held:await page.keyboard.up(k)
    await page.wait_for_timeout(1200)
   await go(1080,1140);await page.screenshot(path=str(OUT/'chromium-earned-base-exited.png'));await go(1080,1160)
   await page.locator('#cq-base-access').tap();await page.wait_for_selector('.cq-plot-tabs')   # Session 5: the plot shows the earned Reactor as a building
   assert await page.evaluate('Object.values(Conquest.view.authority.state.plot.b).some(b=>b.t==="reactor"&&b.l===1)&&Conquest.view.authority.state.base.modules.reactor===1')
   await page.screenshot(path=str(OUT/'chromium-earned-reactor-retained.png'));await page.locator('.cq-plot-leave').click()
   await enter();assert await page.evaluate('Conquest.view.authority.state.base.modules.reactor===1&&Conquest.view.authority.state.base.tier===1');await page.get_by_role('button',name='OPEN MAP',exact=True).click();await page.wait_for_function('document.querySelector(".cq-map canvas")');await page.screenshot(path=str(OUT/'chromium-earned-frontline.png'));await page.locator('.cq-map canvas').scroll_into_view_if_needed();await page.screenshot(path=str(OUT/'chromium-earned-frontline-terrain.png'));assert not errors,errors
   report={k:v for k,v in earned.items() if k!='final'};report['retainedClient']={'engine':'chromium','viewport':'390x844','realWorkerAndAuth':True,'resourceFixture':False,'nativeKeyboardBaseExitAndEntry':True,'browserReload':True,'physicalDeviceVerified':False,'errors':errors}
   (OUT/'earned-journey.json').write_text(json.dumps(report,indent=2));await browser.close();print('PASS earned starter save: real Worker/auth, physical base exit/entry, Reactor and browser reload retained')
 finally:
  server.terminate();await server.wait()
asyncio.run(main())
