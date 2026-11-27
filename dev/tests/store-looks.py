"""Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md section 2): the store's three town looks, rendered in the town
(not only in the store): the Gilded wall skin, the Neon turret skins and the Aurora town lighting, owned on the account and chosen in the
town's theme (the Worker's own reading of the account: worker/src/conquest-shop.js), on the town of every wall blend and turret type
(fixture plotGallery), HIGH quality, at 390x844 (touch) and 1366x768 (mouse). Captures plain and with the looks; each look must change the
picture (pixels compared). Looks only: the same town, the same stats. Software GL: behaviour and looks, not phone frame rate.
   python dev/tests/store-looks.py"""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session8/captures';OUT.mkdir(parents=True,exist_ok=True)
GATE=[1080,1160]
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 bad=[];shots={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(w,h,fixture,q):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=w<800,is_mobile=w<800,reduced_motion='reduce');page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="'+q+'";window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}}};try{localStorage.setItem("lunar-conquest-onboarding-v1","1");localStorage.setItem("lunar-cq-town-tour-v1","1")}catch(e){}')
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
    await page.request.post(base+'/fixture',data=fixture)
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
    return ctx,page,errors
   for w,h in ((390,844),(1366,768)):
    for looks in (False,True):
     ctx,page,errors=await session(w,h,{'position':GATE,'baseFunds':True,'plotGallery':True,'looks':looks},'high')
     b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=60000);await b.click();await page.wait_for_selector('.cq-plot-tabs',timeout=90000)
     await page.wait_for_function('ConquestPlotView.state?.R&&!ConquestPlotView.state.tour',timeout=90000)
     await page.evaluate('ConquestPlotView.setView&&ConquestPlotView.setView("build")');await page.wait_for_timeout(2500)
     th=await page.evaluate('(()=>{const p=Conquest.view.authority.state.plot;return {theme:p.theme||null,own:p.own||null};})()')
     if looks and not (th['theme'] and th['theme'].get('light')=='aurora' and th['theme'].get('ws')=='gilded' and th['theme'].get('ts')=='neon' and th['own'] and th['own'].get('gild') and th['own'].get('neon') and th['own'].get('aur')):bad.append(f'{w}: the looks are not on the town record {th}')
     if not looks and th['theme'] and (th['theme'].get('ws') or th['theme'].get('ts') or th['theme'].get('light')=='aurora'):bad.append(f'{w}: a plain town shows a paid look {th}')
     shots[(w,looks)]=await page.screenshot()   # kept as WebP beside the store captures (docs/conquest/session8/captures)
     from PIL import Image
     import io
     Image.open(io.BytesIO(shots[(w,looks)])).convert('RGB').save(str(OUT/f'town-{"looks" if looks else "plain"}-{w}x{h}.webp'),'WEBP',quality=80,method=6)
     if errors:bad.append(f'{w} looks={looks}: page errors {errors[:3]}')
     await ctx.close()
    # the looks change the picture where the walls and turrets stand: the share of pixels that change visibly (any channel by more than 40
    # of 255) between the plain and the looked town. A whole-screen mean dilutes a change confined to the walls and turrets (the gallery's
    # wall row and turret row are a few % of the screen), so the measure is the changed area, and at least 0.5% of the screen must change
    from PIL import Image,ImageChops
    import io
    a=Image.open(io.BytesIO(shots[(w,False)])).convert('RGB');c=Image.open(io.BytesIO(shots[(w,True)])).convert('RGB')
    diff=ImageChops.difference(a,c).get_flattened_data() if hasattr(Image.Image,'get_flattened_data') else ImageChops.difference(a,c).getdata();n=sum(1 for px in diff if max(px)>40);share=n/(a.width*a.height)*100
    print(f'{w}x{h}: the looks visibly change {share:.2f}% of the screen ({n} pixels)')
    if share<0.5:bad.append(f'{w}: the looks do not visibly change the town ({share:.2f}%)')
   await browser.close()
 finally:
  server.kill()
 if bad:
  print('FAIL store-looks: '+' | '.join(bad));raise SystemExit(1)
 print('PASS store-looks: Gilded walls, Neon turrets and Aurora lighting render in the town (captures in docs/conquest/session8/captures)')
asyncio.run(main())
