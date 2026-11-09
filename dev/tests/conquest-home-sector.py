"""Session 5C (docs/conquest/SESSION_05C_BASE_UX_FULL_PROMPT.md §A, §E, §G): your town in the world. Shipped client, Chromium
390x844 portrait (and 390x700 for the drive HUD), real Worker reducer on a disposable local DB.
 1. the world pad shows YOUR town as a diorama (it changes with the town) and the MY BASE button carries its thumbnail
 2. driving into the Command Gate's ring loads the Home Sector: your town as the world around your tank (drive mode, the
    sheet CLOSED); the first entry plays a short skippable town tour (not with reduced motion)
 3. you drive inside it (touch stick and keyboard); walls block the tank; a gate opens for you
 4. BUILD is a camera: opening a tab lifts the camera to the overhead build view over the same scene, closing returns to drive
 5. leaving through the town's gate returns you to the shared world at the pad (no re-entry loop); after a wall order the pad
    diorama shows the new walls
 6. the hub hero draws your actual town; render budgets (Home Sector CC1/CC10 HIGH and LOW, the world pad with the diorama)
Captures: docs/conquest/session5c/.
"""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5c';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);R={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(fixture,w=390,h=844,quality='high',motion='reduce',tour=False):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,reduced_motion=motion);page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="'''+quality+'''";window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
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
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();try{localStorage.setItem("lunar-conquest-onboarding-v1","1");'+('' if tour else 'localStorage.setItem("lunar-conquest-tour-v1","1");')+'}catch(e){}')
    return ctx,page,errors
   async def world(page):
    await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000);await page.wait_for_timeout(1500)
   async def drive_world(page,yaw,ms):
    await page.evaluate(f'Conquest.view.yaw={yaw}');await page.keyboard.down('KeyW');await page.wait_for_timeout(ms);await page.keyboard.up('KeyW');await page.wait_for_timeout(300)
   info=lambda page:page.evaluate('({calls:Conquest.view.renderer.info.render.calls,tris:Conquest.view.renderer.info.render.triangles,programs:Conquest.view.renderer.info.programs.length})')
   # ---------- 1-5: the journey at CC3 (gates unlock at CC3) on RIDGE ----------
   apron=[1080,1124]
   ctx,page,errors=await session({'position':apron,'baseFunds':True,'plotCC':3,'plotSite':'ridge'},motion='no-preference',tour=True)
   await world(page)
   pad=await page.evaluate('''(()=>{const g=Conquest.view.baseGroup?.getObjectByName("cq-town-diorama"),b=document.querySelector("#cq-home-btn");return {diorama:!!g,counts:g?.userData.counts,thumb:!b.querySelector(".cq-home-thumb").hidden&&b.classList.contains("cq-has-thumb"),mission:document.querySelector("#cq-mission-access").hidden};})()''')
   await page.locator('#cq-home-btn').screenshot(path=str(OUT/'hud-thumbnail.png'));await page.screenshot(path=str(OUT/'world-pad-cc3-390.png'))
   assert pad['diorama'] and pad['thumb'],pad
   # drive north (+z) under the Command Gate's arch into its ring
   await page.evaluate('Conquest.view.yaw=Math.PI');await page.keyboard.down('KeyW')   # software GL frames are slow: hold until the town opens
   await page.wait_for_function('ConquestPlotView.isOpen()&&ConquestPlotView.state.drive?.on',timeout=60000);await page.keyboard.up('KeyW')
   hs=await page.evaluate('''(()=>{const X=ConquestPlotView.state;return {snap:X.snap,tankInTown:Conquest.view.vehicle.parent===X.R.sc,tour:!!X.tour,stick:getComputedStyle(document.querySelector(".cq-hs-stick")).display!=="none",world:{x:Conquest.view.p.x,z:Conquest.view.p.z}};})()''')
   await page.wait_for_timeout(1800);await page.screenshot(path=str(OUT/'home-sector-tour-cc3-390.png'))
   await page.locator('.cq-hs-skip').click();await page.wait_for_timeout(1200)
   assert hs['snap']=='closed' and hs['tankInTown'] and hs['tour'] and hs['stick'],hs
   assert await page.evaluate('!ConquestPlotView.state.tour'),'the tour is skippable'
   # drive with the touch stick
   p0=await page.evaluate('[ConquestPlotView.state.drive.x,ConquestPlotView.state.drive.z]')
   st=await page.locator('.cq-hs-stick').bounding_box();cx,cy=st['x']+st['width']/2,st['y']+st['height']/2;cdp=await ctx.new_cdp_session(page)
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy}]})
   for k in range(1,6):
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx,'y':cy-k*9}]});await page.wait_for_timeout(30)
   await page.wait_for_timeout(1600);await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(400)
   p1=await page.evaluate('[ConquestPlotView.state.drive.x,ConquestPlotView.state.drive.z]')
   moved=((p1[0]-p0[0])**2+(p1[1]-p0[1])**2)**.5;assert moved>8,('the stick drives the tank',p0,p1)
   await page.screenshot(path=str(OUT/'home-sector-drive-cc3-390.png'))
   # walls block the tank; a gate opens for you: a wall line across j=62 with a gate cell at i=39
   ok=await page.evaluate('''Conquest.view.requestAction("plot-wall",{plot:{s:[{k:"line",a:[30,62],b:[38,62],o:0,l:0},{k:"line",a:[40,62],b:[48,62],o:0,l:0}]}})''');assert ok,'wall order'
   ok=await page.evaluate('Conquest.view.requestAction("plot-build",{plot:{type:"gate",i:39,j:62,r:0}})');assert ok,'gate order'
   await page.wait_for_function('Object.values(Conquest.view.authority.state.plot.b).some(b=>b.t==="gate"&&b.l===1)',timeout=40000);await page.wait_for_timeout(1200)
   # a clear lane south of the wall line for each column (settler homes and terrain also block; the probe is the tank's own test)
   lanes=await page.evaluate('''(()=>{const P=ConquestPlot,V=ConquestPlotView,out={};for(const i of [32,33,34,35,36,37,39]){const x=P.cellX(i);let start=null;for(let j=64;j<=72;j++){const z=P.cellZ(j);if(V.probe(x,z))break;start=z;}out[i]=start;}return out;})()''')
   z64=await page.evaluate('ConquestPlot.cellZ(64)');wallCol=next((int(i) for i,z in lanes.items() if z is not None and int(i)!=39 and z>=z64),None)
   assert wallCol is not None and lanes.get('39') is not None,('no clear lane south of the wall',lanes)
   async def push(i,z0,ms):
    await page.evaluate(f'(()=>{{const X=ConquestPlotView.state,P=ConquestPlot;X.solid=null;X.drive.x=P.cellX({i});X.drive.z={z0};X.drive.yaw=0;X.drive.heading=Math.PI;}})()')
    await page.keyboard.down('KeyW');await page.wait_for_timeout(ms);await page.keyboard.up('KeyW');await page.wait_for_timeout(200)
    return await page.evaluate('ConquestPlotView.state.drive.z')
   wallZ=await page.evaluate('ConquestPlot.cellZ(62)')
   probe=await page.evaluate('({wall:ConquestPlotView.probe(ConquestPlot.cellX(34),ConquestPlot.cellZ(62)),gate:ConquestPlotView.probe(ConquestPlot.cellX(39),ConquestPlot.cellZ(62))})')
   zBlocked=await push(wallCol,lanes[str(wallCol)],2400);zGate=await push(39,lanes['39'],3600)
   R['collision']={'wallZ':wallZ,'stoppedAt':zBlocked,'throughGate':zGate,'probe':probe,'lanes':lanes,'wallCol':wallCol}
   assert probe['wall'] and not probe['gate'],('a wall cell is solid for the tank, your gate is open',probe)
   assert zBlocked>wallZ+3.5,('a wall blocks the tank',R['collision'])
   assert zGate<wallZ-2,('your gate opens for you',R['collision'])
   # BUILD is a camera: a tab lifts the camera over the same scene; dragging the sheet down drives again
   yDrive=await page.evaluate('ConquestPlotView.state.R.cam.position.y')
   await page.locator('.cq-plot-tab[data-tab="build"]').click();await page.wait_for_timeout(1500)
   lifted=await page.evaluate('({snap:ConquestPlotView.state.snap,drive:!!ConquestPlotView.state.drive.on,y:ConquestPlotView.state.R.cam.position.y,sameScene:Conquest.view.vehicle.parent===ConquestPlotView.state.R.sc})')
   await page.screenshot(path=str(OUT/'home-sector-build-camera-cc3-390.png'))
   assert lifted['snap']=='half' and not lifted['drive'] and lifted['y']>yDrive+20 and lifted['sameScene'],(yDrive,lifted)
   await page.locator('.cq-plot-tab[data-tab="build"]').click();await page.wait_for_timeout(900)   # the open tab again: back to driving
   assert await page.evaluate('ConquestPlotView.state.snap==="closed"&&ConquestPlotView.state.drive.on'),'tapping the open tab closes the sheet: drive mode'
   # leave through the town's own gate
   await page.evaluate('(()=>{const X=ConquestPlotView.state,p=X.portal,L=Math.hypot(p.x,p.z);X.drive.x=p.x-p.x/L*14;X.drive.z=p.z-p.z/L*14;X.drive.armed=true;X.drive.yaw=Math.atan2(-p.x/L,-p.z/L)+Math.PI;X.solid=null;})()')
   await page.keyboard.down('KeyW');await page.wait_for_function('!ConquestPlotView.isOpen()',timeout=15000);await page.keyboard.up('KeyW');await page.wait_for_timeout(2500)
   back=await page.evaluate('({open:ConquestPlotView.isOpen(),tankInWorld:Conquest.view.vehicle.parent===Conquest.view.scene,x:Conquest.view.p.x,z:Conquest.view.p.z})')
   assert not back['open'] and back['tankInWorld'],back
   # the pad diorama now shows the new walls (rebuilt from the plot), no re-entry loop while still in the ring
   await page.wait_for_function('(Conquest.view.baseGroup?.getObjectByName("cq-town-diorama")?.userData.counts.wallCells||0)>=18',timeout=15000)
   dio=await page.evaluate('Conquest.view.baseGroup.getObjectByName("cq-town-diorama").userData.counts');await page.wait_for_timeout(1500)
   assert not await page.evaluate('ConquestPlotView.isOpen()'),'leaving does not re-enter at once'
   await page.screenshot(path=str(OUT/'world-pad-after-walls-cc3-390.png'))
   R['journey']={'pad':pad,'homeSector':hs,'stickMoved':round(moved,1),'buildCamera':lifted,'back':back,'diorama':dio,'pageErrors':errors};assert not errors,errors
   await ctx.close()
   # ---------- 6. render budgets + captures: Home Sector CC1 / CC10 (HIGH, LOW), the pad, the default build camera ----------
   perf={}
   for (name,fx) in (('cc1',{'plotCC':1,'plotSite':'ridge'}),('cc10',{'plotFull':'ridge'})):
    for q in ('high','low'):
     ctx,page,errors=await session({'position':[1080,1124],'baseFunds':True,**fx},quality=q);await world(page)
     await page.wait_for_timeout(1500);padInfo=await info(page)
     if q=='high':await page.screenshot(path=str(OUT/f'pad-diorama-{name}-390.png'))
     await page.locator('#cq-home-btn').click();await page.wait_for_function('ConquestPlotView.isOpen()&&ConquestPlotView.state.drive?.on',timeout=20000);await page.wait_for_timeout(2500)
     drive=await page.evaluate('ConquestPlotView.state.info')
     if q=='high':await page.screenshot(path=str(OUT/f'home-sector-drive-{name}-390.png'))
     await page.locator('.cq-plot-tab[data-tab="home"]').click();await page.wait_for_timeout(2500);build=await page.evaluate('ConquestPlotView.state.info')
     if q=='high':await page.screenshot(path=str(OUT/f'default-camera-{name}-ridge-390.png'))
     perf[name+'-'+q]={'worldPad':padInfo,'homeSectorDrive':drive,'buildView':build,'pageErrors':errors}
     assert drive['programs']<=16 and build['programs']<=16 and padInfo['programs']<=16 and not errors,perf[name+'-'+q]
     assert drive['calls']<=80 and build['calls']<=80,perf[name+'-'+q]
     await ctx.close()
   R['perf']=perf
   # the default build camera on canyon and plateau (CC1 and CC10)
   for site in ('canyon','plateau'):
    for (name,fx) in (('cc1',{'plotCC':1,'plotSite':site}),('cc10',{'plotFull':site})):
     ctx,page,errors=await session({'position':[1080,1124],'baseFunds':True,**fx});await world(page)
     await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(2500)
     await page.screenshot(path=str(OUT/f'default-camera-{name}-{site}-390.png'));assert not errors,errors;await ctx.close()
   # the hub hero draws your actual town
   ctx,page,errors=await session({'position':[1080,1124],'baseFunds':True,'plotFull':'ridge'})
   await page.locator('#tabbar [data-act="conquest"]').click();await page.wait_for_function('ConquestHub.state?.townDrawn',timeout=60000);await page.wait_for_timeout(1500)
   hero=await page.evaluate('({drawn:ConquestHub.state.townDrawn,info:ConquestHub.state.info})');await page.locator('.cq-hub-hero').screenshot(path=str(OUT/'hub-hero-cc10-390.png'))
   assert hero['drawn']['wallCells']>=2000 and hero['drawn']['turrets']>=40 and hero['info']['programs']<=12 and not errors,hero
   R['hubHero']=hero;await ctx.close()
   await browser.close()
  json.dump(R,open(OUT/'home-sector.json','w'),indent=1);print(json.dumps(R)[:1800])
  print('PASS Home Sector: the pad shows your town (diorama + HUD thumbnail); driving into the gate ring loads your town around your tank (tour, skippable); touch stick drives; walls block, your gate opens; a tab lifts the build camera over the same scene; leaving through the town gate returns to the pad with the diorama updated; budgets HIGH/LOW CC1/CC10 within 5B; the hub hero draws your town')
 finally:
  server.kill()
asyncio.run(main())
