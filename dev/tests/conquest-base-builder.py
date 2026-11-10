"""Session 5 Phase 1 journey (Session 5B: town, RING wall tool + Ferrite blend, CC10 town with 2,000 walls and 42 turrets) in the shipped client (Chromium 390x844, HIGH) against the real Worker reducer and account on a
disposable local DB: at the Command Gate tap ENTER BASE -> pick CRATER RIM -> CLAIM TOWN -> guided first build (Refinery,
real 15 s Worker timer, scaffolding + drones) -> a Cannon turret with its range ring -> move minerals to the base stores and
drag a regolith wall -> Defense Drill replay (no rewards) -> leave. Then a fully built CC10 plot fixture for the render budget
(draws / triangles / programs at 390 portrait, HIGH and LOW) and the 2D canvas fallback.
Scenario placements only: base funds (CP/materials), a wallet with Ferrite, and the CC10 fixture. Software GL: relative look only.
"""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(quality,fixture,gfx=None):
    ctx=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='''+json.dumps(quality)+''';window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
      resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
     await r.abort()
    await page.route('**/*',route)
    await page.request.post(base+'/fixture',data=fixture)
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    if gfx=='2d':await page.evaluate('save.gfx="2d"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
    return ctx,page,errors
   st=lambda page,js:page.evaluate('(()=>{const s=Conquest.view.authority.state;return '+js+';})()')
   gate=[1080,1160]
   # ---------- 1. claim + guided first build (HIGH) ----------
   ctx,page,errors=await session('high',{'position':gate,'fieldMissions':True,'baseFunds':True,'wallet':{'mn':{'fe':90},'pts':5000}})
   b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);label=await b.inner_text();await b.click()
   await page.wait_for_selector('.cq-site-card');sites=await page.locator('.cq-site-card').count();await page.screenshot(path=str(OUT/'site-picker-390.png'))
   await page.locator('.cq-site-card[data-site="crater"]').click();await page.locator('.cq-plot-primary',has_text='CLAIM TOWN').click()
   await page.wait_for_function('Conquest.view.authority.state?.plot?.site==="crater"&&document.querySelector(".cq-plot-tabs")',timeout=60000)
   await page.wait_for_timeout(900);coach1=await page.locator('.cq-plot-coach').inner_text();await page.screenshot(path=str(OUT/'plot-claimed-390.png'))
   await page.locator('.cq-plot-tabs button',has_text='BUILD').click();await page.locator('.cq-plot-card',has_text='Refinery').click()
   await page.wait_for_selector('text=CONFIRM BUILD');await page.wait_for_timeout(600);await page.screenshot(path=str(OUT/'blueprint-refinery-390.png'))
   await page.locator('button',has_text='CONFIRM BUILD').click();await page.wait_for_function('Conquest.view.authority.state.plot.job?.t==="refinery"',timeout=30000)
   await page.wait_for_timeout(1500);await page.screenshot(path=str(OUT/'construction-drones-390.png'));job=await st(page,'s.plot.job.ready-s.plot.job.at')
   # the plot view re-opens the session once the builder's time is up; the Worker settles the job on its own clock
   await page.wait_for_function('Object.values(Conquest.view.authority.state.plot.b).some(b=>b.t==="refinery"&&b.l===1)',timeout=40000)
   coach2=await page.locator('.cq-plot-coach').inner_text()
   await page.locator('.cq-plot-tabs button',has_text='WEAPONS').click();await page.locator('.cq-plot-card',has_text='Cannon Turret').click();await page.wait_for_timeout(700);await page.screenshot(path=str(OUT/'turret-range-ring-390.png'))
   await page.locator('button',has_text='CONFIRM BUILD').click();await page.wait_for_function('Conquest.view.authority.state.plot.job?.t==="cannon"',timeout=30000)
   # ---------- walls: RING tool drag, a Ferrite blend from the base stores, CONFIRM WALLS ----------
   await page.locator('.cq-plot-tabs button',has_text='WALLS').click();await page.wait_for_timeout(300)
   await page.locator('.cq-plot-tools button',has_text='RING').click();await page.locator('.cq-plot-ore',has_text='FERR').click();await page.wait_for_timeout(300)
   pts=await page.evaluate('''()=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,p=Conquest.view.authority.state.plot,r=X.stage.getBoundingClientRect(),c=p.b.cc,pr=(i,j)=>{const v=new T.Vector3(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)).project(X.R.cam);return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height];};return [pr(c.i+2,c.j+2),pr(c.i+9,c.j+2)];}''')
   await page.mouse.move(*pts[0]);await page.mouse.down();await page.mouse.move((pts[0][0]+pts[1][0])/2,pts[0][1],steps=5);await page.mouse.move(*pts[1],steps=5);await page.mouse.up();await page.wait_for_timeout(500)
   wallPlan=await page.locator('.cq-plot-draft b').inner_text()
   mv=page.locator('button',has_text='TO BASE STORES')
   if await mv.count():await mv.first.click();await page.wait_for_function('(save.bmn?.fe||0)>0',timeout=30000)
   await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/'wall-ring-draft-390.png'));await page.locator('.cq-plot-fab .cq-plot-primary').click();await page.wait_for_function('Object.keys(Conquest.view.authority.state.plot.w).length>0',timeout=30000)
   walls=await st(page,'Object.keys(s.plot.w).length');blended=await st(page,'Object.values(s.plot.w).filter(c=>c>1).length');await page.wait_for_timeout(600);await page.screenshot(path=str(OUT/'ferrite-ring-390.png'))
   # ---------- Defense Drill ----------
   await page.wait_for_function('Object.values(Conquest.view.authority.state.plot.b).some(b=>b.t==="cannon"&&b.l===1)',timeout=40000)
   before=await st(page,'JSON.stringify([s.ledger,s.reputation,s.campaignScore])')
   await page.locator('.cq-plot-tabs button',has_text='DEFEND').click();await page.locator('button',has_text='START DEFENSE DRILL').click()
   await page.wait_for_function('ConquestPlotView.state?.drill',timeout=30000);await page.wait_for_timeout(5000);await page.screenshot(path=str(OUT/'defense-drill-390.png'))
   await page.wait_for_function('ConquestPlotView.state?.drillResult',timeout=120000);result=await page.locator('.cq-plot-result').inner_text()
   after=await st(page,'JSON.stringify([s.ledger,s.reputation,s.campaignScore])');info=await page.evaluate('ConquestPlotView.state.info');await page.screenshot(path=str(OUT/'drill-result-390.png'))
   # ---------- Phase 2: banner + theme, visit (read-only), share card, store ----------
   await page.locator('.cq-plot-tabs button',has_text='HOME').click();await page.locator('summary',has_text='TOWN LOOK').click()
   await page.locator('.cq-plot-row button',has_text='PENNANT').click();await page.locator('button',has_text='SAVE BANNER').click()
   await page.wait_for_function('Conquest.view.authority.state.plot.banner?.shape==="pennant"',timeout=30000)
   await page.locator('summary',has_text='TOWN LOOK').click() if not await page.locator('button',has_text='SAVE THEME').is_visible() else None
   await page.locator('.cq-plot-row button',has_text='AMBER').click();await page.locator('.cq-plot-row button',has_text='LAMPS').click();await page.locator('button',has_text='SAVE THEME').click()
   await page.wait_for_function('Conquest.view.authority.state.plot.theme?.light==="amber"',timeout=30000);await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/'banner-theme-390.png'))
   await page.locator('summary',has_text='VISIT TOWNS').click();await page.wait_for_selector('.cq-map-fold[open] button:has-text("CC")',timeout=30000);visitText=await page.locator('.cq-map-fold[open]').last.inner_text()
   await page.locator('.cq-map-fold[open] button:has-text("CC")').first.click();await page.wait_for_function('ConquestPlotView.state?.visit',timeout=30000);await page.wait_for_timeout(900)
   visiting=await page.locator('.cq-plot-title').inner_text();await page.screenshot(path=str(OUT/'visit-read-only-390.png'));readOnly=await page.evaluate('document.querySelector(".cq-plot-tabs").hidden&&ConquestPlotView.state.view==="drive"&&ConquestPlotView.state.drive.owner===false')
   await page.locator('button',has_text='RETURN TO MY BASE').click();await page.wait_for_selector('.cq-plot-tabs:not([hidden])')
   await page.locator('.cq-plot-tabs button',has_text='HOME').click();await page.wait_for_timeout(300)
   if not await page.locator('button',has_text='SHARE MY TOWN').is_visible():await page.locator('summary',has_text='TOWN LOOK').click()
   await page.locator('button',has_text='SHARE MY TOWN').click();await page.wait_for_selector('.cq-plot-share-img');await page.wait_for_timeout(300);await page.locator('.cq-plot-share-img').screenshot(path=str(OUT/'share-card.png'))
   storeDisabled=await page.evaluate('ConquestPlot.STORE.checkout===false&&[...document.querySelectorAll(".cq-plot-store")].every(b=>b.disabled)&&(document.querySelectorAll(".cq-plot-store").length===0||document.querySelectorAll(".cq-plot-store").length===ConquestPlot.STORE.items.length)')   # 5C: the store is hidden from players until checkout opens; every tile disabled
   results['phase2']={'visitList':visitText[:200],'visiting':visiting,'readOnly':readOnly,'storeDisabled':storeDisabled}
   assert 'TOP 20' in visitText and 'VISITING' in visiting and readOnly and storeDisabled,results['phase2']
   await page.locator('.cq-plot-leave').click();await page.wait_for_timeout(500);left=await page.evaluate('!document.querySelector(".cq-plot")&&!!document.querySelector("#cq-base-access")')
   tankBanner=await page.evaluate('!!Conquest.view.vehicle.getObjectByName("cq-tank-banner")');results['phase2']['tankBanner']=tankBanner;assert tankBanner
   results['journey']={'gateLabel':label,'sites':sites,'coach1':coach1,'coach2':coach2,'refineryMs':job,'wallPlan':wallPlan,'walls':walls,'blended':blended,'drill':result,'noRewards':before==after,'left':left,'render':info,'pageErrors':errors}
   print(json.dumps(results['journey']),flush=True)
   assert label=='ENTER BASE' and sites==7 and 'REFINERY' in coach1 and job==15000 and 'CANNON' in coach2 and walls>=30 and blended==walls and before==after and left and not errors,results['journey']
   await ctx.close()
   # ---------- 2. fully built CC10 town: render budget (HIGH, LOW) + a whole-town raid replay ----------
   for q in ['high','low']:
    ctx,page,errors=await session(q,{'position':gate,'plotFull':'crater','baseFunds':True})
    await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(2500)
    info=await page.evaluate('ConquestPlotView.state.info');n=await st(page,'[Object.keys(s.plot.b).length,Object.keys(s.plot.w).length,s.plot.cc,s.plot.power,ConquestPlot.turretCount(s.plot),ConquestPlot.homes(s.plot).length]')
    await page.screenshot(path=str(OUT/f'cc10-town-390-{q}.png'))
    await page.locator('.cq-plot-tabs button',has_text='DEFEND').click();await page.locator('button',has_text='START DEFENSE DRILL').click()
    await page.wait_for_function('ConquestPlotView.state?.drill',timeout=60000);drillMs=await page.evaluate('ConquestPlotView.state.drillMs');await page.wait_for_timeout(6000)
    raid=await page.evaluate('ConquestPlotView.state.info');await page.screenshot(path=str(OUT/f'cc10-raid-390-{q}.png'))
    results['cc10-'+q]={'render':info,'raidRender':raid,'drillMs':drillMs,'buildings':n[0],'walls':n[1],'cc':n[2],'power':n[3],'turrets':n[4],'homes':n[5],'pageErrors':errors}
    print(json.dumps(results['cc10-'+q]),flush=True)
    assert n[1]>=2000 and n[4]>=40 and info['programs']<=16 and raid['programs']<=16 and info['calls']<=140 and raid['calls']<=150 and not errors,results['cc10-'+q]
    await ctx.close()
   # ---------- 3. 2D fallback ----------
   ctx,page,errors=await session('low',{'position':gate,'plotFull':'canyon','baseFunds':True},gfx='2d')
   await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(1200)
   canvas=await page.evaluate('Conquest.view.renderer.isConquestCanvas&&!!document.querySelector(".cq-plot-canvas")');await page.screenshot(path=str(OUT/'cc10-full-390-2d.png'));results['2d']={'plotDrawn':canvas,'pageErrors':errors}
   assert canvas and not errors,results['2d']
   await ctx.close();await browser.close()
  json.dump(results,open(OUT/'base-builder-journey.json','w'),indent=1)
  print('PASS town builder 390: claim CRATER RIM (7 sites) -> guided Refinery (15 s Worker timer) -> Cannon + range ring -> RING tool + Ferrite blend from the base stores -> Defense Drill replay, no rewards; CC10 town (2,000 walls, 42 turrets, homes) render budget + raid replay HIGH/LOW; 2D fallback')
 finally:
  server.kill()
asyncio.run(main())
