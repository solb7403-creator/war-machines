"""Phase 2 evidence: the terraformed south in the shipped client (Chromium, 390x844, forced HIGH, LOW or the 2D fallback) against the real
Worker reducer on a disposable local DB. Scenario placements only (spawn point + camera framing); nothing is fabricated.
Software GL captures: relative look only, never iPhone performance. Output: docs/economy/phase2/.
usage: python3 dev/tests/conquest-terraform-captures.py [--quality high|low|2d]
"""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/economy/phase2';OUT.mkdir(parents=True,exist_ok=True)
Q=sys.argv[sys.argv.index('--quality')+1] if '--quality' in sys.argv else 'high'
SHOTS=[  # name, spawn, camera yaw (rad; the camera sits on this side of the hull, looking across it), pitch, distance
 ('crater-bridge',[952,1188],2.2,.42,42),
 ('forest-creek',[1004,1232],1.6,.38,46),
 ('reservoir-dam',[846,1296],2.5,.5,60),
 ('lush-core-pylon',[1040,1205],-1.2,.42,40),
 ('blight-edge-oxygen',[1186,1052],3.6,.45,52),
]
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts);ctx=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script('''window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;'''+('' if Q=='2d' else 'window.LUNAR_STYLE_QUALITY='+json.dumps(Q)+';')+'''window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
   async def route(r):
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.path.startswith('/api/conquest/') or u.path=='/api/sync':
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
   await page.request.post(base+'/fixture',data={'position':SHOTS[0][1]})
   await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.evaluate('closeAll();save.welcomed=true;'+("save.gfx='2d';" if Q=='2d' else '')+'uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
   async def spawn(pos):  # fresh disposable record at pos; retried because a reply in flight can race the reset
    for attempt in range(3):
     await page.request.post(base+'/fixture',data={'position':pos})
     await page.evaluate('Conquest.view.reset();Conquest.view.authority.state=null;Conquest.view.authority.queue=[];Conquest.view.authority.phase=null;Conquest.view.authority.connect()')
     try:
      await page.wait_for_function(f'Conquest.view.authority.connected&&Math.hypot((Conquest.view.authority.state?.position?.x??1e9)-{pos[0]},(Conquest.view.authority.state?.position?.z??1e9)-{pos[1]})<8&&Math.hypot(Conquest.view.p.x-{pos[0]},Conquest.view.p.z-{pos[1]})<8',timeout=40000);return
     except Exception as e:
      if attempt==2:raise
   stats={}
   for name,pos,yaw,pitch,dist in SHOTS:
    await spawn(pos)
    await page.evaluate(f'Conquest.view.yaw={yaw};Conquest.view.pitch={pitch};Conquest.view.distance={dist}')
    await page.wait_for_function('Conquest.view.pending===0',timeout=60000);await page.wait_for_timeout(1500)
    await page.screenshot(path=str(OUT/f'{name}-390-{Q}.png'))
    stats[name]=await page.evaluate('Conquest.view.renderer.isConquestCanvas?{canvas2d:true}:({draws:Conquest.view.renderer.info.render.calls,tris:Conquest.view.renderer.info.render.triangles,programs:Conquest.view.renderer.info.programs?.length})')
    print(name,stats[name],flush=True)
   gather=None
   if Q=='high':  # a real harvest through the shipped GATHER button: hold 4 s still on a bio-flora node, server-verified
    await spawn([1048,1094])
    await page.evaluate('Conquest.view.yaw=2.4;Conquest.view.pitch=.5;Conquest.view.distance=30')
    btn=page.locator('#cq-gather-access');await btn.wait_for(state='visible',timeout=30000);b0=await page.evaluate('Conquest.view.authority.state.ledger?.cargo?.biomass||0')
    box=await btn.bounding_box();await page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);await page.mouse.down()
    await page.wait_for_function('(Conquest.view.authority.state?.channel?.ms||0)>=1500',timeout=90000);await page.screenshot(path=str(OUT/'gather-channel-390-high.png'))
    await page.wait_for_function('Conquest.view.authority.state?.harvest?.["flora-01"]>Date.now()',timeout=120000);await page.mouse.up()
    await page.wait_for_function('Conquest.view.pending===0',timeout=60000);await page.wait_for_timeout(1200);await page.screenshot(path=str(OUT/'gather-done-390-high.png'))
    gather=await page.evaluate('({biomass:(Conquest.view.authority.state.ledger?.cargo?.biomass||0)-'+str(b0)+',regrowMin:Math.round((Conquest.view.authority.state.harvest["flora-01"]-Date.now())/60000),pendingRaw:(Conquest.view.authority.state.airdrop?.out||[]).reduce((n,e)=>n+e.raw,0),gathers:(Conquest.view.authority.state.airdrop?.out||[]).reduce((n,e)=>n+(e.n?.gather||0),0),buttonHidden:document.querySelector("#cq-gather-access").hidden})')
    print('gather',gather,flush=True)
    assert gather['biomass']==3 and gather['buttonHidden'] and 13<=gather['regrowMin']<=15,gather
   json.dump({'quality':Q,'gather':gather,'viewport':'390x844','renderer':'Chromium SwiftShader (relative only)','shots':stats,'pageErrors':errors},open(OUT/f'stats-{Q}.json','w'),indent=1)
   assert not errors,errors
   await browser.close()
 finally:
  server.terminate();await server.wait()
asyncio.run(main())
