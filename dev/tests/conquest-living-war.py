"""Mobile Session3.2: actual shipped client + real authenticated Worker reducer, test-owned DB only.
Raw visible-coordinate input; fixtures are explicit scenario placements, never fabricated kills/rewards.
Automated Chromium/WebKit evidence is not physical iPhone Telegram verification.
"""
import asyncio,argparse,json,pathlib,shutil,math,statistics,os
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-living-war';OUT.mkdir(exist_ok=True)
async def main(engine,journey_only=False,fallback=False):
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   opts={'headless':True}
   if engine=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
   browser=await getattr(pw,engine).launch(**opts);results=[]
   for width,height in ([(390,844)] if journey_only or fallback else [(320,568),(390,844)]):
    context=await browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.request.post(base+'/fixture',data={})
    await page.add_init_script('''window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.path.startswith('/api/conquest/'):
      response=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));
      if response.status>=400:print('API ERROR',u.path,response.status,(await response.text())[:250],flush=True)
      return await r.fulfill(status=response.status,body=await response.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.path.startswith('/api/'):
      if u.path=='/api/sync':
       response=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=response.status,body=await response.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
      return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
     await r.abort()
    await page.route('**/*',route)
    async def enter():
     await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();'+('save.gfx=\"2d\";' if fallback else '')+'');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
     if await page.locator('.cq-transmission').count():await tap('.cq-story-start')
     await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
    async def rect(selector):
     return await page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)};}''')
    async def tap(selector):
     r=await rect(selector);assert r['x']>=0 and r['y']>=0 and r['x']+r['w']<=width+1 and r['y']+r['h']<=page.viewport_size['height']+1 and r['hit'],(engine,width,selector,r);await page.touchscreen.tap(r['x']+r['w']/2,r['y']+r['h']/2)
    async def fixture(position=None,**kw):
     await page.evaluate('Conquest.view.reset();Conquest.view.authority.actionBusy=true');await page.wait_for_function('!Conquest.view.authority.busy');await page.request.post(base+'/fixture',data={**kw,**({'position':position} if position else {})});await page.evaluate('Conquest.view.authority.state=null;Conquest.view.authority.queue=[];Conquest.view.authority.phase=null;Conquest.view.authority.connect()');await page.wait_for_function('Conquest.view.authority.state?.seq===0&&Conquest.view.authority.connected');await page.evaluate('Conquest.view.authority.actionBusy=false');await page.wait_for_timeout(250)
    await enter()
    if fallback:assert await page.evaluate('Conquest.view.renderer.isConquestCanvas')
    await fixture([1500,1500])
    drive=await rect('.cq-stick');dash=await rect('#cq-dash');fire=await rect('#cq-fire');shield=await rect('#cq-shield')
    if engine=='chromium':
     cdp=await context.new_cdp_session(page)
     def contact(i,r,dy=0):return {'id':i,'x':r['x']+r['w']/2,'y':r['y']+r['h']/2+dy}
     left=contact(1,drive,-32);right=contact(2,fire);third=contact(3,dash)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left]})
     await page.wait_for_timeout(100)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right]})
     await page.wait_for_timeout(80)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right,third]})
     await page.wait_for_timeout(70)
     await page.wait_for_function('Conquest.view.encounter.dashCd>0&&Conquest.view.firing&&Math.hypot(Conquest.view.stick.x,Conquest.view.stick.z)>.5',timeout=10000)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[third]})
     third=contact(3,shield)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right,third]})
     await page.wait_for_timeout(80)
     await page.wait_for_function('Conquest.view.encounter.shieldT>0&&Conquest.view.firing&&Math.hypot(Conquest.view.stick.x,Conquest.view.stick.z)>.5',timeout=10000)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[third]})
     await page.wait_for_timeout(1600)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
     # Independent mouse DRIVE pointer plus native touch action, WebKit automation limitation.
     await page.mouse.move(drive['x']+drive['w']/2,drive['y']+drive['h']/2-32);await page.mouse.down()
     await tap('#cq-dash');await page.wait_for_timeout(80)
     assert await page.evaluate('Conquest.view.encounter.dashCd>3&&Math.hypot(Conquest.view.stick.x,Conquest.view.stick.z)>.5')
     await tap('#cq-shield');await page.wait_for_timeout(80)
     assert await page.evaluate('Conquest.view.encounter.shieldT>0')
     await page.wait_for_timeout(1200);await page.mouse.up()
    await page.wait_for_timeout(1500)
    canonical=await page.evaluate('Conquest.view.authority.state.battle');assert canonical['dashCd']>0 and canonical['shieldCd']>0
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-moving-controls.png'))
    await fixture([1080,1160],baseFunds=True)
    await tap('#cq-base-access')
    await page.get_by_role('button',name='CONSTRUCT BASE I',exact=False).click()
    await page.wait_for_function('Conquest.view.authority.state.base.tier===1')
    await page.get_by_role('button',name='BUILD TIER 2',exact=False).click()
    await page.wait_for_function('Conquest.view.authority.state.base.tier===2')
    await page.get_by_role('button',name='BUILD REACTOR',exact=False).click()
    await page.wait_for_function('Conquest.view.authority.state.base.pending?.module==="reactor"')
    await page.get_by_role('button',name='CLOSE BASE',exact=True).click()
    await page.wait_for_timeout(250)
    await page.screenshot(path=str(OUT/f'{engine}-{width}-base-II.png'))
    before=await page.evaluate('Conquest.view.authority.state.base')
    await page.evaluate('Conquest.view.authority.connect()')
    assert await page.evaluate('Conquest.view.authority.state.base.tier===2')
    await fixture([994,944],weapon='moon')
    await tap('#cq-mission-access')
    assert await page.get_by_role('heading',name='SABOTAGE THE RELAY',exact=True).count()
    await page.get_by_role('button',name='START MISSION',exact=True).click()
    await page.wait_for_function('Conquest.view.authority.state.mission==="relay"')
    await page.wait_for_function('Conquest.view.battle?.projectiles.some(q=>q.team==="enemy")',timeout=20000)
    await page.screenshot(path=str(OUT/f'{engine}-{width}-relay-active.png'))
    await page.wait_for_function('Conquest.view.pending===0');await page.wait_for_timeout(1000)
    await page.evaluate('Conquest.view.frameSamples=[];Conquest.view.worstFrame=0;Conquest.view.hitches=0;Conquest.view.profileLast=performance.now()')
    await page.wait_for_timeout(10000)
    perf=await page.evaluate('Conquest.view.performanceReport()')
    print('PERFORMANCE software-rendered',json.dumps(perf),flush=True)
    results.append({'scenario':'relay mission with resident garrisons','performance':perf})
    await fixture([1174,1168],engineering=True)
    await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='INVENTORY / SUPPLY',exact=True).click()
    await page.get_by_text('Thermal Systems',exact=True).click()
    await page.get_by_role('button',name='UPGRADE HEAT CAPACITY',exact=True).click()
    await page.wait_for_function('Conquest.view.authority.state.engineering.ranks.heatCapacity===1')
    await page.get_by_text('Thermal Systems',exact=True).click()
    await page.get_by_label('Thermal Systems specialization').fill('3')
    await page.get_by_role('button',name='SAVE SPECIALIZATION',exact=True).first.click()
    await page.wait_for_function('Conquest.view.authority.state.engineering.tuning.thermal===3')
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-engineering.png'))
    await page.get_by_role('button',name='CLOSE SUPPLY').click()
    await fixture([1500,1500],weapon='moon',superReady=True)
    await page.evaluate('Conquest.view.aimYaw=Conquest.view.yaw+Math.PI;Conquest.view.aimPitch=.3')
    await page.mouse.move(fire['x']+fire['w']/2,fire['y']+fire['h']/2);await page.mouse.down()
    await page.wait_for_function("Conquest.view.encounter.projectiles.some(p=>p.kind==='moon')")
    await page.evaluate('Conquest.view.authority.actionBusy=true')
    await page.wait_for_timeout(100)
    if not fallback:assert await page.evaluate("Conquest.view.shotMeshes.some(g=>g.visible&&g.children[0].geometry===Conquest.view.cylinder&&g.children[0].scale.y/g.children[0].scale.x>50)")
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-moonbeam.png'))
    await page.evaluate('Conquest.view.authority.actionBusy=false');await page.wait_for_timeout(4500);await page.mouse.up()
    assert await page.evaluate('Conquest.view.encounter.heat>0')
    await tap('#cq-super')
    await page.wait_for_function("Conquest.view.encounter.effects.some(e=>e.kind==='beam'&&e.weapon==='moon')")
    await page.evaluate('Conquest.view.authority.actionBusy=true');await page.wait_for_timeout(100)
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-moonfall.png'))
    await page.evaluate('Conquest.view.authority.actionBusy=false')
    if width==390 and not fallback:
     await page.evaluate('window.preLoss=Conquest.view.authority.state.hp;Conquest.view.renderer.forceContextLoss()')
     await page.wait_for_function('Conquest.view.renderer.isConquestCanvas')
     assert await page.evaluate('Conquest.view.authority.state.hp===preLoss&&Conquest.view.authority.connected')
     await page.set_viewport_size({'width':width,'height':height-100});await page.wait_for_timeout(100)
     assert await page.locator('.cq-world').evaluate('(e)=>e.getBoundingClientRect().height<=innerHeight')
     await page.set_viewport_size({'width':width,'height':height})
    assert not errors,errors
    results.append({'viewport':[width,height],'multiPointer':'native three-touch' if engine=='chromium' else 'mouse DRIVE plus native touch abilities','errors':errors})
    await page.evaluate('Conquest.view?.authority?.dispose()');await page.unroute_all(behavior='ignoreErrors');await context.close();print('PASS',engine,width,height,flush=True)
   await browser.close();(OUT/f'{engine}{"-fallback" if fallback else ""}-results.json').write_text(json.dumps({'engine':engine,'physicalTelegramVerified':False,'cases':results},indent=2))
 finally:server.terminate();await server.wait()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--engine',choices=['chromium','webkit'],default='chromium');a.add_argument('--fallback',action='store_true');args=a.parse_args();asyncio.run(main(args.engine,fallback=args.fallback))
