# Real browser security context, actual Worker routes/simulation, disposable IDP/database. No live accounts.
import asyncio,json,pathlib,urllib.request,time
from playwright.async_api import async_playwright
OUT=pathlib.Path('/workspace/lunar-website-evidence');OUT.mkdir(exist_ok=True)
BASE='https://lunar.test';FIX='http://127.0.0.1:8791'
USER_ID=int(time.time()*1000)%1000000000
SDK="""window.Telegram={Login:{auth(opts,cb){fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:opts.nonce,id:TEST_USER_ID})}).then(r=>r.json()).then(cb);}}};"""
async def route(r):
 if r.request.url.startswith('https://oauth.telegram.org/js/telegram-login.js'):return await r.fulfill(body=SDK.replace('TEST_USER_ID',str(USER_ID)),content_type='application/javascript')
 if r.request.url.startswith(BASE):
  res=await r.fetch(url=FIX+r.request.url[len(BASE):]);return await r.fulfill(response=res)
 return await r.abort()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  await ctx.route('**/*',route);pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:print('BROWSER',m.type,m.text) if m.type=='error' else None)
  await pg.goto(BASE+'/web/');await pg.wait_for_timeout(1200)
  await pg.screenshot(path=str(OUT/'landing-debug.png'))
  assert await pg.locator('#landing-machine canvas').count()==1,errs
  await pg.screenshot(path=str(OUT/'landing-desktop.png'),full_page=True)
  for width in [390,320]:
   await pg.set_viewport_size({'width':width,'height':844});await pg.wait_for_timeout(150)
   assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'landing horizontal clipping'
   await pg.screenshot(path=str(OUT/f'landing-{width}.png'),full_page=True)
  await pg.set_viewport_size({'width':1440,'height':1000});await pg.wait_for_function('()=>!!loginContext?.nonce');await pg.locator('[data-login]').first.click()
  await pg.wait_for_url('**/web/play.html#play');await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&typeof webShowroom!=="undefined"&&!!webShowroom',timeout=20000)
  await pg.evaluate('()=>{save.welcomed=true;closeAll();}')
  assert await pg.evaluate('SRV_ECO&&IN_WEB&&!IN_TG&&!IS_DEV')
  assert await pg.evaluate('playerKey()')=='tg_'+str(USER_ID)
  cookies=await ctx.cookies();assert any(c['name']=='__Host-lunar-session' and c['httpOnly'] and c['secure'] and c['sameSite']=='Lax' for c in cookies)
  await pg.wait_for_timeout(400);await pg.screenshot(path=str(OUT/'battle-navigation-desktop.png'))
  await pg.locator('[data-web-tab="garage"]').click();await pg.wait_for_timeout(250)
  await pg.screenshot(path=str(OUT/'garage-desktop.png'))
  assert await pg.locator('[data-act="labedit"]').count()==2
  await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.wait_for_timeout(200)
  await pg.locator('#lab-name').fill('Website MK-II');await pg.locator('#lab-fit-hull').select_option('plates');await pg.locator('#lab-fit-mobility').select_option('stable')
  await pg.screenshot(path=str(OUT/'engineer-desktop.png'))
  assert await pg.locator('.web-engineer-form #web-machine-scene canvas').count()==1
  await pg.locator('[data-act="labsave"]').click();await pg.wait_for_function('()=>save.lab.machines.m_spare.name==="Website MK-II"')
  assert await pg.evaluate('save.lab.machines.m_legacy.spec.mods.hull')=='stock'
  await pg.locator('[data-act="labequip"][data-arg="m_spare"]').click();await pg.wait_for_function('()=>save.lab.active==="m_spare"')
  await pg.reload();await pg.wait_for_function('()=>typeof save!=="undefined"&&save?.lab?.active==="m_spare"');await pg.wait_for_timeout(300)
  await pg.locator('[data-web-tab="garage"]').click();await pg.set_viewport_size({'width':390,'height':844});await pg.wait_for_timeout(200)
  await pg.screenshot(path=str(OUT/'garage-mobile.png'))
  await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.wait_for_timeout(200);await pg.screenshot(path=str(OUT/'engineer-mobile.png'))
  # Free range from an owned draft uses real mechanics, with unchanged account and no match/proof traffic.
  before=await pg.evaluate('JSON.stringify(ecoCopy())');mutations=[]
  def record(req):
   if req.method=='POST' and '/api/' in req.url:mutations.append(req.url)
  pg.on('request',record)
  await pg.locator('[data-act="rangedraft"]').click();await pg.locator('#range-control').select_option('ai')
  results=[]
  for g in ['arena','zone','crystal','bounty','royale','boss']:
   await pg.locator('#range-mode').select_option(g);await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim')
   result=await pg.evaluate('''()=>{const r=rangeRun;r.paused=true;r.sim.setup(r.cfg);let n=0;while(r.sim.view().state==='play'&&n++<11000){r.sim.step(1/60,[0,0]);r.sim.events();}if(r.sim.view().state!=='over')throw Error('Trial not complete');rangeFrame(0);return rangeSource.result;}''');results.append({'mode':g,'outcome':result['outcome']})
   if g=='arena':await pg.screenshot(path=str(OUT/'practice-results-mobile.png'))
   await pg.locator('[data-act="rangeoptions"]').click()
  assert await pg.evaluate('JSON.stringify(ecoCopy())')==before
  assert not mutations,mutations
  await pg.locator('[data-act="rangeclose"]').last.click();pg.remove_listener('request',record)
  # Reload discards forged local economy but preserves server machine choice.
  earned=await pg.evaluate('save.earned');await pg.evaluate('()=>{save.earned=999999;save.pts=999999;store();}')
  await pg.reload();await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab');assert await pg.evaluate('save.earned')==earned
  assert not errs,errs
  await pg.locator('#web-logout').click();await pg.wait_for_url('**/web/');assert not any(c['name']=='__Host-lunar-session' for c in await ctx.cookies())
  (OUT/'browser.json').write_text(json.dumps({'login':'mock official IDP, actual RS256 server verification','first_party_secure_cookie':True,'independent_saved_bays':True,'six_actual_mode_trials':results,'practice_mutations':mutations,'errors':errs},indent=2));print('PASS website login/cookie/identity, two machine saves/reload, six-mode isolated range, forged local progress rejected, logout, desktop/mobile')
  # A second HTTPS browser with WebGL unavailable still loads the same owned machine and mobile controls.
  fbctx=await b.new_context(viewport={'width':320,'height':844});await fbctx.route('**/*',route)
  await fbctx.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return String(t).includes('webgl')?null:original.call(this,t,...args);};")
  fp=await fbctx.new_page();fallback_errors=[];fp.on('pageerror',lambda e:fallback_errors.append(str(e)))
  await fp.goto(BASE+'/web/');await fp.wait_for_function('()=>!!loginContext?.nonce');await fp.locator('[data-login]').first.click();await fp.wait_for_url('**/web/play.html#play')
  await fp.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&typeof webShowroom!=="undefined"&&!!webShowroom')
  await fp.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");}')
  await fp.wait_for_timeout(200);assert await fp.evaluate('R3.failed')
  await fp.screenshot(path=str(OUT/'garage-fallback-320.png'))
  await fp.evaluate('()=>setTab("play")');await fp.screenshot(path=str(OUT/'battle-navigation-mobile.png'))
  assert not fallback_errors,fallback_errors
  print('PASS same owned account at 320px with real 2D fallback and mobile battle navigation')
  await b.close()
if __name__=='__main__':asyncio.run(main())
