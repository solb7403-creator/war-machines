# Real game/Engineer and match renderer with an explicitly synthetic, pre-owned standard catalog.
# Requires LUNAR_STANDARD_VISUAL_FIXTURE=1 LUNAR_FIXTURE_PORT=8793 node dev/tests/webserver.mjs.
import asyncio,json,pathlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/standard-equipment-evidence');BASE='https://lunar.test';FIX='http://127.0.0.1:8793'
OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');errors=[];mutations=[]
  async def route(r):
   assert r.request.url.startswith(BASE+'/'),'No external fallback';res=await r.fetch(url=FIX+r.request.url[len(BASE):]);await r.fulfill(response=res)
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
  await pg.goto(BASE+'/web/equipment-preview.html');await pg.wait_for_function('()=>typeof catalogReady!=="undefined"&&catalogReady')
  await pg.evaluate('''async()=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id:91002941})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('Fixture identity failure');}''')
  await pg.goto(BASE+'/web/play.html#garage');await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&!!webShowroom?.model',timeout=25000)
  await pg.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");webShowroom.auto=false;}');original=await pg.evaluate('JSON.stringify(ecoCopy())');bays=await pg.evaluate('JSON.stringify(save.lab)')
  for width in [320,390,430]:
   await pg.set_viewport_size({'width':width,'height':844});assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth');await pg.screenshot(path=str(OUT/f'garage-{width}.png'))
  await pg.set_viewport_size({'width':390,'height':844});await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.wait_for_timeout(150)
  assert await pg.locator('#lab-chassis option').count()==9;assert await pg.locator('#lab-weapon option').count()==9
  for c,w in [('scout:2','twin:2'),('vanguard:1','pulse:1'),('titan:2','siege:2')]:
   await pg.select_option('#lab-chassis',c);await pg.select_option('#lab-weapon',w);await pg.wait_for_timeout(100);assert await pg.locator('.web-engineer-form #web-machine-scene canvas').count()==1
   await pg.screenshot(path=str(OUT/f'engineer-{c.split(":")[0]}-390.png'))
  await pg.select_option('#lab-fit-hull','plates');await pg.select_option('#lab-fit-mobility','stable');await pg.screenshot(path=str(OUT/'engineer-fitted-titan-390.png'))
  assert await pg.evaluate('JSON.stringify(ecoCopy())')==original;assert await pg.evaluate('JSON.stringify(save.lab)')==bays
  # Renderer cache churn uses exact buildTank/artShot code. Retain an evicted model to verify safe GPU reupload.
  cache=await pg.evaluate('''()=>{const A=artR(),canvas=document.createElement('canvas');canvas.width=120;canvas.height=100;const ctx=canvas.getContext('2d');let retained;const sample=[];const paints=Object.keys(PAINTS);for(let round=0;round<2;round++){for(let i=0;i<180;i++){const sp=mySpec({cls:CHORDER[i%3],ct:Math.floor(i/3)%3,arch:WORDER[Math.floor(i/9)%3],wt:Math.floor(i/27)%3,paint:paints[Math.floor(i/15)%paints.length],lunar:false,team:i%2?'#4d9fff':'#ff536d',gems:'dmg,rof,arm',fits:{hull:i%2?'plates':'stock',mobility:i%3?'stable':'stock',mount:i%2?'firing':'stock'}});const T=buildTank(sp,A.mats);if(!retained)retained=T;artShot(ctx,120,100,T.g,{r:2,cy:.6},[]);}sample.push({kit:KC.size,fitting:FITCACHE.size,gpu:A.r.info.memory.geometries});}artShot(ctx,120,100,retained.g,{r:2,cy:.6},[]);return {samples:sample,retainedDrawCalls:A.r.info.render.calls,error:A.r.getContext().getError()};}''')
  assert cache['samples'][1]['kit']<=64 and cache['samples'][1]['fitting']<=96,cache
  assert cache['samples'][1]['gpu']<=cache['samples'][0]['gpu']+12,cache
  assert cache['retainedDrawCalls']>0 and cache['error']==0,cache
  def record(req):
   if req.method=='POST' and any(s in req.url for s in ['/api/match','/api/act','/api/pvp','/api/ghost']):mutations.append(req.url)
  pg.on('request',record);await pg.locator('[data-act="rangedraft"]').click()
  battle=[]
  for mode in ['arena','boss']:
   await pg.select_option('#range-mode',mode);await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim');await pg.wait_for_timeout(350);assert await pg.evaluate('R3.ready&&!R3.failed')
   await pg.screenshot(path=str(OUT/f'battle-{mode}-390.png'))
   info=await pg.evaluate('()=>({drawCalls:RR.info.render.calls,triangles:RR.info.render.triangles,geometries:RR.info.memory.geometries,quality:R3.q})');battle.append({'mode':mode,**info});await pg.evaluate('()=>{rangeExit();}')
   if mode=='arena':await pg.locator('[data-act="rangecard"][data-arg="m_spare"]').click()
  assert not mutations,mutations;assert await pg.evaluate('JSON.stringify(save.lab)')==bays;assert await pg.evaluate('JSON.stringify(ecoCopy())')==original;assert not errors,errors
  (OUT/'app-browser.json').write_text(json.dumps({'ownedSelectors':[9,9],'bay_and_economy_unchanged':True,'widths':[320,390,430],'cache':cache,'battle':battle,'ranked_mutations':mutations,'errors':errors,'identity':'local disposable synthetic catalog, no real accounts'},indent=2));print('PASS real mobile owned selectors/Garage/Engineer, fits, immutable bays, bounded actor caches, retained-model reupload and actual 3D Arena/Survival',cache,battle);await b.close()
asyncio.run(main())
