"""Session 3.1 UI checks in a real portrait browser; no physical iPhone claim."""
import asyncio,json,pathlib,shutil
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest-session-031';OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=await b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
  async def route(r):
   from urllib.parse import urlparse
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  async def enter():
   await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await enter()
  await page.get_by_role('heading',name='THE LAST AIR WE BREATHE').wait_for()
  assert await page.locator('.cq-transmission').get_by_text('Earth did not fall to an army from the stars. It fell through our blood.').is_visible()
  await page.screenshot(path=str(OUT/'story.png'))
  await page.get_by_role('button',name='ACKNOWLEDGE · BEGIN EXPLORATION').click()
  await page.wait_for_function('Conquest.view?.pending===0',timeout=60000)
  assert await page.locator('#cq-navigation').is_visible()
  assert await page.locator('#cq-navigation').get_by_text('HOLD THE OXYGEN LINE',exact=True).is_visible()
  await page.screenshot(path=str(OUT/'mission-waypoint.png'))
  first=await page.locator('.cq-nav-arrow').evaluate('(e)=>e.style.transform')
  await page.evaluate('Conquest.view.yaw+=Math.PI/2');await page.wait_for_timeout(100)
  second=await page.locator('.cq-nav-arrow').evaluate('(e)=>e.style.transform');assert first!=second,'direction must follow camera yaw'
  before=await page.evaluate('Conquest.view.discovery.version')
  await page.get_by_role('button',name='OPEN MAP',exact=True).click()
  assert 'ASSIGNED' in await page.locator('.cq-map-mission').inner_text()
  assert 'Parasite installation' in await page.locator('.cq-map').inner_text()
  await page.screenshot(path=str(OUT/'assigned-map.png'))
  await page.get_by_role('button',name='CLOSE MAP',exact=True).click()
  assert before==await page.evaluate('Conquest.view.discovery.version'),'mission intel must not reveal terrain'
  await page.get_by_role('button',name='HELP',exact=True).click();await page.get_by_role('button',name='REPLAY OPENING TRANSMISSION').click()
  await page.get_by_role('heading',name='THE LAST AIR WE BREATHE').wait_for();await page.keyboard.press('Escape')
  assert await page.evaluate('localStorage.getItem("lunar-conquest-onboarding-v1")==="1"')
  await enter();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000)
  assert await page.locator('.cq-transmission').count()==0,'completed onboarding must not repeat'
  await page.evaluate('Conquest.view.jump(1163,1132)');await page.wait_for_timeout(200)
  access=page.get_by_role('button',name='OXYGEN FACILITY UNDER THREAT — START DEFENSE',exact=True)
  await access.wait_for(state='visible',timeout=15000)
  assert await page.evaluate('!Conquest.view.battle'),'entering radius must not start battle'
  await page.screenshot(path=str(OUT/'mission-interaction.png'))
  await access.click();assert await page.get_by_role('button',name='START MISSION',exact=True).is_visible()
  assert await page.evaluate('!Conquest.view.battle'),'briefing must require explicit start'
  await page.get_by_role('button',name='KEEP EXPLORING').click()
  # Portrait control hit targets must not overlap one another or mission guidance.
  for width,height in [(390,844),(360,640)]:
   await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(100)
   rects=await page.evaluate('''()=>Array.from(document.querySelectorAll('.cq-stick,.cq-aim,.cq-fire,.cq-zoom button,.cq-recover,.cq-mission-access,#cq-navigation')).filter(e=>!e.hidden&&e.getBoundingClientRect().width).map(e=>({name:e.className||e.id,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))''')
   for i,a in enumerate(rects):
    for bb in rects[i+1:]:
     assert not (a['x']<bb['x']+bb['w'] and a['x']+a['w']>bb['x'] and a['y']<bb['y']+bb['h'] and a['y']+a['h']>bb['y']),('overlap',width,height,a,bb)
  assert not errors,errors
  print(json.dumps({'status':'PASS','viewports':['390x844','360x640'],'checks':['first entry story','dismiss/replay/persistence','waypoint follows yaw','map preserves fog','reported position briefing','explicit start','control hit zones'],'errors':errors}))
  await b.close()
asyncio.run(main())
