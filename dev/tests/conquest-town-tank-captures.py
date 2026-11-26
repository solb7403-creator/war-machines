"""Session 5E-2d2 captures (section 5; owner, Nov 11): the pilot's REAL tank in the town view, at any size, HIGH and LOW.
Shipped client (index.html), the real Worker on the fixture server, a fully built CC10 town; the server says the pilot drives a
Titan (tier 2) with the Moonbeam (the fixture's veteran loadout: nothing like the stock Vanguard and Pulse a stand-in would be).
For each size and quality: the drive view (the chase camera behind the tank; the view the town opens in) and the build view. Before each
picture the tool waits until the town's tank holder is shown and its wait marker is not, then records what is drawn there:
the loadout the view holds and the Meshy model ids of the meshes under the tank (the same reading login-tank-browser.py asserts
on every frame; this tool only takes the pictures at the sizes that test does not visit).
usage: python3 dev/tests/conquest-town-tank-captures.py [--sizes 390x844,1366x768] [--quality high,low] [--out DIR] [--dpr 2]
Software GL here: looks only, never a phone frame rate."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
TANK='''()=>{const X=ConquestPlotView.state,v=Conquest.view,t=X&&X.tank;if(!t)return null;const ids=new Set();t.traverse(o=>{if(o.isMesh){const u=o.userData||{};const id=u.meshyId||u.meshy||(o.geometry&&o.geometry.userData&&o.geometry.userData.meshyId)||o.name;if(id)ids.add(typeof id==='object'?String(id.id||id.key||id.kind||JSON.stringify(id).slice(0,80)):String(id));}});
 let n=0;t.traverse(o=>{if(o.isMesh)n++;});return {view:X.view,shown:!!(t.parent&&t.visible),wait:!!(X.tankWait&&X.tankWait.visible),meshes:n,ids:[...ids].slice(0,12),loadout:v.loadout&&{w:v.loadout.w,c:v.loadout.c,paint:v.loadout.paint},stamp:typeof Meshy3D!=='undefined'&&v.loadout?Meshy3D.stamp(v.loadout.c.c,v.loadout.c.t,v.loadout.w.a,v.loadout.w.t):null,calls:X.info&&X.info.calls,programs:X.info&&X.info.programs};}'''
SHARP='''for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){const v=g.call(this,p);return typeof v==='string'&&/swiftshader|llvmpipe|softpipe|software/i.test(v)?'Capture GPU':v;};}'''   # --sharp: the game holds a CPU rasterizer at .75x of the screen (js/graphics.js); a capture for LOOKS is drawn at the resolution a real device gets (HIGH on a phone: the device's own ratio, here the context's; LOW: 1x), by not telling the game the renderer is SwiftShader. Never used by a test that measures a budget.
async def main(a):
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   browser=await pw.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
   for q in a.quality.split(','):
    for size in a.sizes.split(','):
     w,h=[int(v) for v in size.split('x')];touch=w<700
     ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=a.dpr if touch else 1,has_touch=touch,is_mobile=touch,reduced_motion='reduce');page=await ctx.new_page()
     errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     await page.add_init_script(SHARP) if a.sharp else None;await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='''+json.dumps(q)+''';window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
     async def route(r):
      u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
      if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
       body=json.loads(r.request.post_data or '{}')
       for attempt in range(2):
        try:resp=await page.request.post(base+u.path,data=body);return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
        except Exception:
         if attempt:return await r.fulfill(status=503,body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
         await asyncio.sleep(0.2)
      if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
      if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
      if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
      await r.abort()
     await page.route('**/*',route)
     fixture={'position':[1080,1160],'plotFull':'crater','baseFunds':True,'veteranLoadout':True}
     await page.request.post(base+'/fixture',data=fixture)
     await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
     await page.request.post(base+'/fixture',data=fixture)
     await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
     if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
     await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=240000)
     await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs')
     SHOWN='()=>{const X=ConquestPlotView.state,t=X&&X.tank;return !!(t&&t.parent&&t.visible&&!(X.tankWait&&X.tankWait.visible));}'
     tag=f'{size}-{q}';res={}
     # the town opens in the drive view (the chase camera behind the pilot's tank); a tab lifts the camera to the build view
     await page.evaluate('ConquestPlotView.state.view==="drive"||ConquestPlotView.setView("drive")');await page.wait_for_function('ConquestPlotView.state.view==="drive"&&!ConquestPlotView.state.tour',timeout=120000)
     await page.wait_for_function(SHOWN,timeout=240000);await page.wait_for_timeout(a.settle+900)
     res['drive']=await page.evaluate(TANK);await page.screenshot(path=str(out/f'town-tank-drive-{tag}.png'),timeout=180000)
     await page.evaluate('ConquestPlotView.setView("build")');await page.wait_for_function('ConquestPlotView.state.view==="build"',timeout=60000)
     await page.wait_for_function(SHOWN,timeout=240000);await page.wait_for_timeout(a.settle+900)
     res['build']=await page.evaluate(TANK);await page.screenshot(path=str(out/f'town-tank-build-{tag}.png'),timeout=180000)
     for k in ('build','drive'):
      t=res[k];assert t and t['shown'] and not t['wait'],f'{tag} {k}: the tank is drawn, not its wait marker: {t}'
      assert t['loadout']['c']['c']=='titan' and t['loadout']['w']['a']=='moon',f'{tag} {k}: the view holds the server\'s loadout (Titan + Moonbeam): {t["loadout"]}'
      assert t['meshes']>=2,f'{tag} {k}: a hull and a weapon under the town\'s tank: {t}'
     assert not errors,errors
     results[tag]=res;print('ok',tag,json.dumps(res['drive']),flush=True);await ctx.close()
   await browser.close()
  (out/'town-tank.json').write_text(json.dumps(results,indent=1))
  print('PASS conquest-town-tank-captures: '+', '.join(results)+': the town\'s build and drive views draw the pilot\'s server loadout (Titan + Moonbeam), never a stand-in')
 finally:
  server.terminate();await server.wait()
ap=argparse.ArgumentParser();ap.add_argument('--sizes',default='390x844');ap.add_argument('--quality',default='high,low');ap.add_argument('--out',default=str(ROOT/'docs/conquest/session5e2d2/town'));ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=1500)
ap.add_argument('--sharp',action='store_true')
asyncio.run(main(ap.parse_args()))
