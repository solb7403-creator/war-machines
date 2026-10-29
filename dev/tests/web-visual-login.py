# Focused visual/login QA: actual SDK + Worker, disposable signed identity, no live accounts.
import asyncio,json,os,pathlib,time,urllib.parse,urllib.request
from playwright.async_api import async_playwright
BASE='https://lunar.test';FIX='http://127.0.0.1:8791'
OUT=pathlib.Path('/workspace/lunar-approved-website-evidence');OUT.mkdir(exist_ok=True)
SDK=pathlib.Path(os.environ['LUNAR_TEST_SDK']).read_text()
UID=int(time.time())%1000000000
async def route(r):
 u=r.request.url
 if u.startswith('https://oauth.telegram.org/js/telegram-login.js'):return await r.fulfill(body=SDK,content_type='application/javascript')
 if u.startswith('https://oauth.telegram.org/auth?'):
  q=urllib.parse.parse_qs(urllib.parse.urlsplit(u).query);assert q['response_type']==['post_message'];assert q['redirect_uri']==[BASE+'/web/'];assert q['scope']==['openid profile']
  token=await r.fetch(url=FIX+'/__token',method='POST',headers={'Content-Type':'application/json'},post_data=json.dumps({'nonce':q['nonce'][0],'id':UID}))
  jwt=(await token.json())['id_token']
  html='<button id="approve">Authorize disposable test identity</button><script>document.querySelector("#approve").onclick=()=>opener.postMessage('+json.dumps({'event':'auth_result','result':jwt})+','+json.dumps(BASE)+');</script>'
  return await r.fulfill(body=html,content_type='text/html')
 if u.startswith(BASE):
  res=await r.fetch(url=FIX+u[len(BASE):]);return await r.fulfill(response=res)
 return await r.abort()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(viewport={'width':1440,'height':1000});await ctx.route('**/*',route)
  pg=await ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  await pg.goto(BASE+'/web/');await pg.wait_for_function('()=>!!loginContext?.nonce');await pg.evaluate('document.fonts.ready');await pg.wait_for_timeout(200)
  assert await pg.locator('canvas').count()==0,'rejected homepage renderer must be removed'
  assert await pg.locator('.mode-card').count()==6
  for w in [1440,390,320]:
   await pg.set_viewport_size({'width':w,'height':1000 if w==1440 else 844});await pg.wait_for_timeout(150)
   assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'landing overflow {w}'
   assert await pg.evaluate('getComputedStyle(document.querySelector(".colony-hero")).backgroundImage.includes("lunar-colony")')
   assert await pg.evaluate('Array.from(document.querySelectorAll(".mode-image")).every(x=>getComputedStyle(x).backgroundImage.includes("lunar-modes"))')
   await pg.screenshot(path=str(OUT/f'homepage-{w}.png'),full_page=True)
  await pg.set_viewport_size({'width':390,'height':844})
  async with pg.expect_popup() as popup_info:await pg.locator('.mode-card.crystal').click()
  popup=await popup_info.value;await popup.locator('#approve').click()
  await pg.wait_for_url('**/web/play.html#mode:crystal');await pg.wait_for_timeout(100)
  assert popup.is_closed(),'Safari must not be left on authorization tab after callback'
  await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&!!webShowroom');assert await pg.evaluate('playerKey()')=='tg_'+str(UID)
  assert await pg.evaluate('save.gtype')=='crystal'
  await pg.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");}')
  for width in [1440,390]:
   await pg.set_viewport_size({'width':width,'height':1000 if width==1440 else 844});await pg.wait_for_timeout(250)
   assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'garage overflow {width}'
   await pg.screenshot(path=str(OUT/f'garage-{width}.png'))
   await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.wait_for_timeout(200)
   assert await pg.locator('.web-engineer-form #web-machine-scene canvas').count()==1
   await pg.screenshot(path=str(OUT/f'engineer-{width}.png'))
   assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'engineer overflow {width}'
   await pg.evaluate('()=>{closeAll();setTab("garage");}')
  # Real destination controls: no auto-started ranked match; practice stays its own path.
  await pg.goto(BASE+'/web/');await pg.wait_for_function('()=>!!loginContext?.signedIn');await pg.locator('.feature-grid [data-enter="range"]').first.click();await pg.wait_for_function('()=>typeof rangeSource!=="undefined"&&!!rangeSource');assert await pg.locator('#range-mode').count()==1
  await pg.evaluate('()=>{closeAll();setTab("play");}');await pg.screenshot(path=str(OUT/'navigation-mobile.png'))
  assert not errors,errors
  await pg.locator('#web-logout').click();await pg.wait_for_url('**/web/')
  assert not any(c['name']=='__Host-lunar-session' for c in await ctx.cookies())
  (OUT/'checks.json').write_text(json.dumps({'auth':'actual official SDK; locally signed disposable fixture, not human/live approval','popup_closed':True,'same_canonical_account':True,'selected_mode':'crystal','desktop_mobile_no_overflow':True,'garage_engineer_3d':True,'practice_deep_link':True,'logout':True,'page_errors':errors},indent=2))
  print('PASS actual SDK popup callback/close + verified session, selected mode, responsive artwork, Garage/Engineer, practice deep link, logout; no live identity')
  await b.close()
if __name__=='__main__':asyncio.run(main())
