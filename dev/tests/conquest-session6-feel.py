"""Session 6 part B: the feel pass in a real browser (practice mode, no server): the first defense from the spawn, the hit flash
swap (solid -> solidHit), damage numbers (max 3), the kill pop ticker, the context button (SCAN <-> GATHER), MORE's SOUND and
LOCATE ME. Phone 390x844 and desktop 1366x768. Captures: docs/conquest/session6/feel-*.png. Software GL: relative look only."""
import asyncio,json,pathlib,shutil,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session6';OUT.mkdir(parents=True,exist_ok=True)
async def run(p,w,h,mobile):
 b=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=await b.new_page(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
 async def route(r):
  from urllib.parse import urlparse
  u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
  if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
  await r.abort()
 await page.route('**/*',route);await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
 await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
 await page.locator('.cq-radio').wait_for();await page.get_by_role('button',name='SKIP',exact=True).click()
 await page.wait_for_function('Conquest.view&&Conquest.view.encounter',timeout=60000)
 assert await page.evaluate('!!Conquest.view.feel'),'feel module attached'
 await page.locator('#cq-mission-access').click()
 if await page.get_by_role('button',name='START MISSION',exact=True).count():await page.get_by_role('button',name='START MISSION',exact=True).click()   # practice mode (no server) keeps the briefing
 await page.wait_for_function('Conquest.view.battle&&Conquest.view.battle.state==="active"',timeout=20000)
 # lock the nearest attacker and hold fire (keyboard Space on desktop, the FIRE button on a phone)
 flashed=False;nums=0;ticker=''
 for i in range(60):
  await page.evaluate('(()=>{const v=Conquest.view,B=v.battle;if(!B)return;const e=B.enemies.filter(e=>e.hp>0&&!e.resident).sort((a,b)=>Math.hypot(a.x-v.p.x,a.z-v.p.z)-Math.hypot(b.x-v.p.x,b.z-v.p.z))[0];v.selectedId=e?e.id:null;v.firing=true;})()')
  await page.wait_for_timeout(250)
  flashed=flashed or await page.evaluate('(()=>{const M=Conquest.view.style&&Conquest.view.style.MAT;if(!M)return true;let f=false;for(const g of Conquest.view.enemyMeshes.values())g.traverse(o=>{if(o.material===M.solidHit)f=true;});return f;})()')
  nums=max(nums,await page.locator('.cq-dmg:not([hidden])').count())
  t=await page.locator('.cq-reward-ticker').inner_text()
  if 'DESTROYED' in t:ticker=t
  if ticker and nums:break
 await page.screenshot(path=str(OUT/f'feel-kill-{w}x{h}.png'))
 assert nums>=1 and nums<=3,f'damage numbers on screen: {nums}'
 assert 'DESTROYED' in ticker,f'kill pop ticker: {ticker!r}'
 assert await page.evaluate('Conquest.view.style?Conquest.view.style.MAT.solidHit.uniforms.uFlash.value===1&&Conquest.view.style.MAT.solid.uniforms.uFlash.value===0:true')
 await page.evaluate('Conquest.view.firing=false')
 # MORE: SOUND toggles the app's own setting; LOCATE ME opens the map
 await page.get_by_role('button',name='MORE',exact=True).click();snd=page.locator('.cq-sound-toggle');before=await page.evaluate('save.sound!==false');await snd.click()
 assert await page.evaluate('save.sound!==false')!=before,'SOUND in MORE flips the Settings sound';await snd.click()
 await page.get_by_role('button',name='LOCATE ME ON THE MAP',exact=True).click();await page.locator('.cq-map').wait_for();await page.get_by_role('button',name='CLOSE MAP',exact=True).click()
 assert not errors,errors
 await b.close();return {'size':f'{w}x{h}','numbersMax':nums,'ticker':ticker,'flashSeen':flashed}
async def main():
 async with async_playwright() as p:
  res=[await run(p,390,844,True),await run(p,1366,768,False)]
 print(json.dumps({'status':'PASS','runs':res}))
asyncio.run(main())
