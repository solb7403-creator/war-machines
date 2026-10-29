# Actual website Engineer + actual isolated practice renderer, using only disposable local Worker services.
import asyncio,json,mimetypes,os,pathlib,subprocess,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/defender-evidence');BASE='https://lunar.test';FIX='http://127.0.0.1:8791'
# Recreate a genuine PR #13 baseline from local Git history when evidence is absent.
for file,source in [('before-models3d.js','js/models3d.js'),('before-scene.js','web/scene.js')]:
 if not (OUT/file).exists():(OUT/file).write_bytes(subprocess.check_output(['git','show','385356ea4ffac207900d05be6fbdf1965081fa63:'+source],cwd=ROOT))

async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  reports=[]
  for phase in (['after'] if '--after-only' in sys.argv else ['before','after']):
   ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');errors=[];mutations=[]
   async def route(r):
    u=r.request.url;assert u.startswith(BASE+'/'),'No external fallback: '+u
    path=u[len(BASE):].split('?')[0]
    if phase=='before' and path in ['/js/models3d.js','/web/scene.js']:
     f=OUT/('before-models3d.js' if path.startswith('/js') else 'before-scene.js');return await r.fulfill(body=f.read_bytes(),content_type='application/javascript')
    res=await r.fetch(url=FIX+u[len(BASE):]);return await r.fulfill(response=res)
   await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
   await pg.goto(BASE+'/web/defender-preview.html')
   # Test-only identity signed by the fixture; never a real Telegram account or production request.
   await pg.evaluate('''async id=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('Fixture auth '+r.status);}''',91002930+(phase=='after'))
   await pg.goto(BASE+'/web/play.html#garage');await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&!!webShowroom?.model',timeout=25000)
   await pg.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");webShowroom.auto=false;webShowroom.yaw=-.65;webShowroom.draw();}')
   assert await pg.evaluate('myLoadout().c.c==="vanguard"&&myLoadout().c.t===0&&myLoadout().w.a==="pulse"&&myLoadout().w.t===0&&myLoadout().skin==="default"')
   original=await pg.evaluate('JSON.stringify(ecoCopy())');bays=await pg.evaluate('JSON.stringify(save.lab)')
   await pg.screenshot(path=str(OUT/(phase+'-garage-390.png')))
   await pg.locator('[data-act="labedit"][data-arg="m_legacy"]').click();await pg.wait_for_timeout(200)
   assert await pg.locator('.web-engineer-form #web-machine-scene canvas').count()==1
   await pg.screenshot(path=str(OUT/(phase+'-engineer-390.png')))
   assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
   # The comparison link opens a separate no-account page, without modifying either bay.
   async with pg.expect_popup() as pop:await pg.locator('.web-engineer-form a[href$="defender-preview.html"]').click()
   preview=await pop.value;await preview.wait_for_function('()=>typeof defenderPreview!=="undefined"&&!!defenderPreview.model');calls=[];preview.on('request',lambda req:calls.append(req.url))
   await preview.locator('[data-skin="lunar"]').click();await preview.locator('[data-skin="default"]').click();await preview.close()
   assert not any('/api/' in u or '/auth/' in u for u in calls)
   assert await pg.evaluate('JSON.stringify(ecoCopy())')==original
   assert await pg.evaluate('JSON.stringify(save.lab)')==bays
   if phase=='after':
    def record(req):
     if req.method=='POST' and any(s in req.url for s in ['/api/match','/api/act','/api/pvp','/api/ghost']):mutations.append(req.url)
    pg.on('request',record)
    await pg.locator('[data-act="rangedraft"]').click();await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim');await pg.wait_for_timeout(500)
    assert await pg.evaluate('R3.ready&&!R3.failed')
    await pg.screenshot(path=str(OUT/'after-combat-390.png'))
    await pg.evaluate('()=>rangeExit()');assert not mutations,mutations
    assert await pg.evaluate('JSON.stringify(ecoCopy())')==original
   assert not errors,errors
   reports.append({'phase':phase,'renderer':'actual shared THREE','stock_identity_verified':True,'bay_and_economy_unchanged':True,'errors':errors,'range_mutations':mutations});await ctx.close()
  await b.close();(OUT/'app-browser.json').write_text(json.dumps(reports,indent=2));print('PASS actual mobile Garage, Engineer, no-account stock/skin comparison, unchanged bays/economy, real isolated 3D combat',reports)
asyncio.run(main())
