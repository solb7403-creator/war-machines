import asyncio,json,pathlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=await b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
  async def route(r):
   from urllib.parse import urlparse
   u=urlparse(r.request.url)
   if u.netloc!='lunar.test':return await r.abort()
   f=ROOT/u.path.lstrip('/')
   if f.is_file():return await r.fulfill(path=str(f))
   await r.fulfill(status=404,body='')
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html?conquestDev=1')
  await page.wait_for_function('typeof Conquest!=="undefined"')
  await page.evaluate('closeAll();save.welcomed=true;uiDirty();')
  await page.locator('[data-act="conquest"]').click()
  assert await page.get_by_role('button',name='Foundation diagnostics',exact=True).is_visible()
  await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.wait_for_function('Conquest.view&&Conquest.view.chunks.size>=49',timeout=60000)
  await page.screenshot(path='/tmp/conquest-world.png')
  # Exercise the rendered proxy on both levels using the production navigation provider.
  await page.evaluate('''()=>{const v=Conquest.view,W=ConquestWorld;v.jump(898,1024);for(let i=0;i<620;i++)v.p=W.move(v.p,.2,0);v.tick(.016);}''')
  assert await page.evaluate('Conquest.view.p.surface==="bridge"&&Conquest.view.vehicle.position.y===24')
  await page.screenshot(path='/tmp/conquest-bridge.png')
  await page.evaluate('''()=>{const v=Conquest.view,W=ConquestWorld;v.jump(1024,995);for(let i=0;i<300;i++)v.p=W.move(v.p,0,.2);v.tick(.016);}''')
  assert await page.evaluate('Conquest.view.p.surface==="ground"&&Conquest.view.p.z>1054')
  # Touch thumbstick must actually move the world proxy.
  start=await page.evaluate('[Conquest.view.p.x,Conquest.view.p.z]')
  cdp=await page.context.new_cdp_session(page)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':86,'y':755}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':100,'y':720}]})
  await page.wait_for_timeout(300)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  finish=await page.evaluate('[Conquest.view.p.x,Conquest.view.p.z]')
  assert start!=finish,'touch must move the actual proxy'
  assert await page.evaluate('Conquest.view.stick.x===0&&Conquest.view.stick.z===0')

  assert await page.evaluate('Conquest.view.camera.isPerspectiveCamera')
  await page.keyboard.down('KeyW');await page.wait_for_timeout(500);await page.keyboard.up('KeyW')
  await page.get_by_role('button',name='OPEN MAP',exact=True).click();await page.screenshot(path='/tmp/conquest-map.png');await page.get_by_role('button',name='CLOSE MAP',exact=True).click()
  await page.get_by_role('button',name='DEV DIAGNOSTICS',exact=True).click()
  await page.get_by_role('button',name='Far NE',exact=True).click();await page.wait_for_function('Conquest.view.p.x===31679&&Conquest.view.pending===0',timeout=60000)
  assert await page.evaluate('Conquest.view.chunks.size<=81')
  await page.evaluate('''()=>{const v=Conquest.view;for(let i=0;i<200;i++){v.jump(200+i*151,200+i*231);v.tick(.016);if(v.chunks.size>81)throw Error('unbounded chunks');}v.jump(31679,47519);}''')
  await page.wait_for_function('Conquest.view.pending===0',timeout=60000)
  print('After 200 rendered streaming moves:',await page.evaluate('({chunks:Conquest.view.chunks.size,geometries:Conquest.view.renderer.info.memory.geometries})'))

  await page.evaluate('window.__oldCQ=Conquest.view;window.__oldBuilds=Conquest.view.builds')
  await page.get_by_role('button',name='← RETURN TO CONQUEST',exact=True).click();await page.wait_for_timeout(200)
  print(await page.evaluate('({disposed:__oldCQ.disposed,chunks:__oldCQ.chunks.size,builds:__oldCQ.builds,before:__oldBuilds,errors:'+json.dumps(errors)+'})'));assert await page.evaluate('__oldCQ.disposed&&__oldCQ.chunks.size===0');await page.evaluate('window.__exitBuilds=__oldCQ.builds');await page.wait_for_timeout(200);assert await page.evaluate('__oldCQ.builds===__exitBuilds')
  await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();await page.wait_for_function('Conquest.view&&Conquest.view.chunks.size>0')
  await page.get_by_role('button',name='← RETURN TO CONQUEST',exact=True).click();await page.screenshot(path='/tmp/conquest-hub.png');await page.get_by_role('button',name='← RETURN TO ARCADE',exact=True).click()
  assert await page.evaluate('!Conquest.active&&!document.querySelector("#app").inert')
  await page.locator('[data-act="fight"]').click();await page.wait_for_timeout(500)
  assert await page.evaluate('inBattle()')
  await page.evaluate('exitBattle();setTab("garage");')
  assert await page.locator('#s-garage').is_visible()
  await page.evaluate('setTab("shop");')
  assert await page.locator('#s-shop').is_visible()
  assert await page.evaluate('GT_ORDER.length===6')
  assert not errors,errors
  print(json.dumps({'mobileViewport':'390x844 Chromium software WebGL (not real iPhone)','entryMapFarJumpExitReentryArcade':'PASS','errors':errors}))
  await b.close()
asyncio.run(main())
