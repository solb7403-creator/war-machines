"""Owner art direction (terraformed zones as an Earth-like colony): core town, farm ring, frontier wall, river/bridge, wild meadow and the boundary crossing in the shipped client (Chromium, 390x844, forced HIGH, LOW or the 2D fallback) against the real
Worker reducer on a disposable local DB. Scenario placements only (spawn point + camera framing); nothing is fabricated.
Software GL captures: relative look only, never iPhone performance. Output: docs/economy/phase2/.
usage: python3 dev/tests/conquest-terraform-captures.py [--quality high|low|2d]
"""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/economy/colony';OUT.mkdir(parents=True,exist_ok=True)
Q=sys.argv[sys.argv.index('--quality')+1] if '--quality' in sys.argv else 'high'
import os
def look(fx,fz):  # camera behind the hull looking along (fx,fz)
 import math;return math.atan2(-fx,-fz)
SHOTS=[  # name, spawn, camera yaw (camera behind the hull looking along a direction), pitch, distance
 ('core-town',[1096,1128],look(.92,-.38),.36,58),
 ('farm-ring',[942,1096],look(-1,.35),.4,62),
 ('frontier-wall',[1004,1076],look(.15,-1),.3,42),
 ('river-bridge',[953,1186],look(-.85,.5),.38,40),
 ('wild-meadow',[990,1300],look(-.6,-.8),.26,40),
 ('boundary-crossing',[806,1100],look(1,.12),.2,30),
]
ONLY=os.environ.get('ONLY');SHOTS=[s for s in SHOTS if not ONLY or s[0] in ONLY.split(',')]
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
     resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
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
   json.dump({'quality':Q,'gather':gather,'viewport':'390x844','renderer':'Chromium SwiftShader (relative only)','shots':stats,'pageErrors':errors},open(OUT/f'stats-{Q}.json','w'),indent=1)
   assert not errors,errors
   await browser.close()
 finally:
  server.terminate();await server.wait()
asyncio.run(main())
