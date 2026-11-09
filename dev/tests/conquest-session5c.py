"""Session 5C (base UX + your town in the world), shipped client, real Worker reducer on a disposable local DB, Chromium.
 1. the bottom sheet reaches PEEK, HALF and FULL by a real finger drag at 390x700, 390x844 and 320x568, the map resizes with
    it, the page never scrolls; every tab fits or scrolls to its last item at HALF; WEAPONS lists 11 turrets + Gate + Shield
    with model sprites (CC10)
 2. Home Sector: the gate opens the town around the tank (drive view), the tank drives (keys) and walls block it, a tab lifts
    the camera to the build view and DRIVE brings it back, LEAVE returns to the world; a wall order updates the pad diorama
    and the HUD thumbnail; the town name (Worker-validated) shows on the header; the hub hero renders the town
 3. performance: draws / triangles / programs of the Home Sector at CC10 (HIGH and LOW) and the shared world with the diorama
 4. captures for the owner in docs/conquest/session5c/
"""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5c';OUT.mkdir(parents=True,exist_ok=True)
GATE=[1080,1160];PAD_VIEW=[1077,1154]   # a resting spot in the courtyard: the world camera is centred over the tank, so it must not sit on the model's CC
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);R={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(w,h,fixture,q='high',motion='reduce'):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,reduced_motion=motion);page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="'''+q+'''";window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
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
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
    return ctx,page,errors
   async def close(ctx):   # requests still in flight must not raise TargetClosedError into the next session
    for pg in ctx.pages:
     try:await pg.unroute_all(behavior='ignoreErrors')
     except Exception:pass
    await ctx.close()
   async def world(page):
    await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
   async def enter_base(page):
    b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);await b.click();await page.wait_for_selector('.cq-plot-tabs',timeout=60000);await page.wait_for_timeout(1200)
   async def drag(ctx,page,x,y,dy,steps=20):
    cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for k in range(1,steps+1):
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+dy*k/steps}]});await page.wait_for_timeout(30)
    await page.wait_for_timeout(200);await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(500)
   async def snap_to(ctx,page,want):
    for _ in range(3):
     g=await page.evaluate('''(w)=>{const X=ConquestPlotView.state,h=X.grab.getBoundingClientRect(),H=ConquestSheet.heights(X.d.clientHeight-X.top.offsetHeight,(X.grab.offsetHeight||22)+(X.tabs.offsetHeight||48)+6);return {x:h.left+h.width/2,y:h.top+h.height/2,dy:X.sheetPx-H[w],snap:X.d.dataset.snap};}''',want)
     if g['snap']==want:return True
     await drag(ctx,page,g['x'],g['y'],g['dy'])
    return await page.evaluate('ConquestPlotView.state.d.dataset.snap')==want
   geom='''(()=>{const X=ConquestPlotView.state,st=X.stage.getBoundingClientRect(),dr=X.drawer.getBoundingClientRect(),g=X.grab.getBoundingClientRect(),hit=(x,y,sel)=>!!document.elementFromPoint(x,y)?.closest(sel),free=[g.left+6,g.left+g.width/2,g.right-6].every(x=>hit(x,g.top+g.height/2,'.cq-plot-grab'))&&[...X.tabs.children].every(b=>{const r=b.getBoundingClientRect();return hit(r.left+r.width/2,r.top+r.height/2,'.cq-plot-tabs button');});return {free,snap:X.d.dataset.snap,stageH:Math.round(st.height),drawerTop:Math.round(dr.top),drawerBottom:Math.round(dr.bottom),vh:innerHeight,pageScroll:(document.scrollingElement||document.documentElement).scrollTop+window.scrollY,meet:Math.abs(st.bottom-dr.top)<2};})()'''
   # ---------- 1. sheet snaps by touch; every tab fits or scrolls; WEAPONS with sprites ----------
   sheet={}
   for (w,h) in ((390,700),(390,844),(320,568)):
    ctx,page,errors=await session(w,h,{'position':GATE,'baseFunds':True,'plotCC':10,'plotSite':'ridge'});await world(page);await enter_base(page)
    await page.locator('.cq-plot-tabs button',has_text='HOME').click();await page.wait_for_timeout(600)
    snaps={}
    for want in ('full','peek','half'):
     okSnap=await snap_to(ctx,page,want);snaps[want]={**await page.evaluate(geom),'reached':okSnap}
     if w==390 and h==700:await page.screenshot(path=str(OUT/f'home-{want}-390x700.png'))
    assert all(v['reached'] and v['meet'] and v['free'] and v['pageScroll']==0 and v['drawerBottom']<=v['vh']+1 for v in snaps.values()),snaps   # 5C review blocker: map overlays never cover the handle or the tabs
    assert await snap_to(ctx,page,'full') and await snap_to(ctx,page,'peek'),'a real finger brings the sheet back down from FULL'
    assert snaps['peek']['stageH']>snaps['half']['stageH']>snaps['full']['stageH']>=40,snaps
    tabs={}
    for tab in ('HOME','BUILD','WEAPONS','WALLS','DEFEND'):
     await page.locator('.cq-plot-tabs button',has_text=tab).click();await page.wait_for_timeout(700)
     assert await snap_to(ctx,page,'half'),tab
     await page.wait_for_timeout(1200)   # sprites render one per frame
     for k in range(6):
      await drag(ctx,page,w/2,h-40,-420,12)
     t=await page.evaluate('''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),kids=[...s.querySelectorAll('.cq-plot-body>*')].filter(e=>e.getBoundingClientRect().height>0),last=kids.at(-1).getBoundingClientRect();return {scrolls:s.scrollHeight>s.clientHeight+1,scrollTop:Math.round(s.scrollTop),lastReachable:s.scrollTop+s.clientHeight>=s.scrollHeight-2&&last.bottom<=r.bottom+2,fitsWidth:kids.every(e=>e.getBoundingClientRect().right<=innerWidth+1),pageScroll:(document.scrollingElement||document.documentElement).scrollTop};})()''')
     if w==390 and h==700:
      await page.evaluate('document.querySelector(".cq-plot-sheet").scrollTop=0');await page.wait_for_timeout(300);await page.screenshot(path=str(OUT/f'tab-{tab.lower()}-half-390x700.png'))
      if True:
       await snap_to(ctx,page,'peek');await page.wait_for_timeout(400);await page.screenshot(path=str(OUT/f'tab-{tab.lower()}-peek-390x700.png'))
     if tab=='WEAPONS':
      t['weapons']=await page.evaluate('''(()=>{const c=[...document.querySelectorAll('.cq-plot-sheet .cq-plot-card')];return {cards:c.length,turrets:c.filter(x=>/RANGE \\d+ m/.test(x.querySelector('.cq-plot-statline')?.textContent||'')&&!x.classList.contains('cq-plot-locked')).length,gate:c.some(x=>/Gate/.test(x.textContent)),shield:c.some(x=>/Shield Generator/.test(x.textContent)),sprites:c.filter(x=>x.querySelector('img.cq-plot-spr')).length};})()''')
      assert t['weapons']['turrets']==11 and t['weapons']['gate'] and t['weapons']['shield'] and t['weapons']['cards']==13 and t['weapons']['sprites']==13,t
     assert (not t['scrolls'] or t['lastReachable']) and t['fitsWidth'] and t['pageScroll']==0,(tab,t)
     tabs[tab]=t
    sheet[f'{w}x{h}']={'snaps':snaps,'tabs':tabs,'pageErrors':errors};assert not errors,errors
    await close(ctx)
   R['sheet']=sheet
   # ---------- 2. Home Sector, diorama, thumbnail, name, hub ----------
   ctx,page,errors=await session(390,700,{'position':GATE,'baseFunds':True,'plotCC':1,'plotSite':'ridge'},motion='no-preference');await world(page)
   pad0=await page.evaluate('JSON.stringify(Conquest.view.diorama?.userData.counts)');thumb=await page.evaluate('!!document.querySelector("#cq-home-btn .cq-home-thumb")')
   await page.locator('#cq-home-btn').screenshot(path=str(OUT/'hud-thumbnail-cc1.png'))
   await enter_base(page)
   hs=await page.evaluate('({view:ConquestPlotView.state.view,tank:!!ConquestPlotView.state.tank,tour:!!ConquestPlotView.state.tour,pad:ConquestPlotView.state.drive?.pad})')
   await page.wait_for_timeout(1500);await page.screenshot(path=str(OUT/'home-sector-tour-cc1-390.png'))
   await page.wait_for_function('!ConquestPlotView.state.tour',timeout=15000);await page.wait_for_timeout(1200);await page.screenshot(path=str(OUT/'home-sector-drive-cc1-390.png'));cc1=await page.evaluate('ConquestPlotView.state.info')
   hb=await page.locator('.cq-plot-grab').bounding_box();await page.touchscreen.tap(hb['x']+hb['width']/2,hb['y']+hb['height']/2);await page.wait_for_timeout(700)
   handleOpens=await page.evaluate('[ConquestPlotView.state.view,ConquestPlotView.state.d.dataset.snap]');await page.evaluate('ConquestPlotView.setView("drive")');await page.wait_for_timeout(700)
   p0=await page.evaluate('[ConquestPlotView.state.drive.x,ConquestPlotView.state.drive.z]')
   await page.keyboard.down('w');await page.wait_for_timeout(1500);await page.keyboard.up('w');await page.wait_for_timeout(300)
   p1=await page.evaluate('[ConquestPlotView.state.drive.x,ConquestPlotView.state.drive.z]')
   moved=((p1[0]-p0[0])**2+(p1[1]-p0[1])**2)**.5
   await page.screenshot(path=str(OUT/'home-sector-driving-cc1-390.png'))
   # build mode is a camera: a tab lifts it, DRIVE brings it back (same scene, no reload)
   scene0=await page.evaluate('ConquestPlotView.state.R.sc.uuid')
   await page.locator('.cq-plot-tabs button',has_text='WALLS').click();await page.wait_for_timeout(900);v1=await page.evaluate('ConquestPlotView.state.view')
   # a wall order (a RING with a real finger) updates the town, then the pad diorama and the thumbnail
   await page.locator('.cq-plot-tools button',has_text='RING').click();await page.wait_for_timeout(300)
   pts=await page.evaluate('''()=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,p=Conquest.view.authority.state.plot,r=X.stage.getBoundingClientRect(),c=p.b.cc,pr=(i,j)=>{const v=new T.Vector3(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)).project(X.R.cam);return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height];};return [pr(c.i+1,c.j+1),pr(c.i+8,c.j+1)];}''')
   cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':pts[0][0],'y':pts[0][1]}]})
   for k in range(1,11):
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':pts[0][0]+(pts[1][0]-pts[0][0])*k/10,'y':pts[0][1]+(pts[1][1]-pts[0][1])*k/10}]});await page.wait_for_timeout(25)
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(500)
   await page.locator('.cq-plot-fab .cq-plot-primary').click();await page.wait_for_function('Object.keys(Conquest.view.authority.state.plot.w).length>0',timeout=30000);nW=await page.evaluate('Object.keys(Conquest.view.authority.state.plot.w).length')
   await page.locator('.cq-plot-drivebtn').wait_for(state='visible') if await page.locator('.cq-plot-drivebtn').count() and await page.locator('.cq-plot-drivebtn').is_visible() else None
   await page.evaluate('ConquestPlotView.setView("drive")');await page.wait_for_timeout(900);v2=await page.evaluate('[ConquestPlotView.state.view,ConquestPlotView.state.R.sc.uuid]')
   # drive into a wall: it blocks (the tank stops at the ring)
   blocked=await page.evaluate('''(()=>{const D=ConquestPlotView.state.drive,P=ConquestPlot,p=Conquest.view.authority.state.plot,k=Object.keys(p.w)[0].split(',').map(Number);return D.block(k[0],k[1]);})()''')
   # name the town (Worker-validated) from HOME > TOWN LOOK
   await page.locator('.cq-plot-tabs button',has_text='HOME').click();await page.wait_for_timeout(500);await snap_to(ctx,page,'full')
   await page.locator('summary',has_text='TOWN LOOK').click();await page.locator('.cq-plot-input').fill('Iron Hold');await page.locator('button',has_text='SAVE NAME').click()
   await page.wait_for_function('Conquest.view.authority.state.plot.nm==="Iron Hold"',timeout=30000);await page.wait_for_timeout(500);title=await page.locator('.cq-plot-title').inner_text()
   await page.locator('.cq-plot-input').fill('Shit Town');await page.locator('button',has_text='SAVE NAME').click();await page.wait_for_timeout(1500)
   kept=await page.evaluate('Conquest.view.authority.state.plot.nm')
   await page.locator('button',has_text='SHARE MY TOWN').click();await page.wait_for_selector('.cq-plot-share-img');await page.wait_for_timeout(300);await page.locator('.cq-plot-share-img').screenshot(path=str(OUT/'share-card-cc1.png'));shot=await page.evaluate('ConquestPlotView.state.shareShot')
   await page.locator('.cq-plot-leave').click();await page.wait_for_timeout(1200)
   back=await page.evaluate('!document.querySelector(".cq-plot")&&!!document.querySelector("#cq-base-access")')
   pad1=await page.evaluate('Conquest.view.diorama?.userData.counts');thumb1=await page.evaluate('!!document.querySelector("#cq-home-btn .cq-home-thumb")')
   await page.screenshot(path=str(OUT/'pad-diorama-cc1-walls-390.png'))
   R['homeSector']={'handleOpens':handleOpens,'cc1Render':cc1,'open':hs,'moved':round(moved,1),'buildView':v1,'driveBack':v2[0],'sameScene':v2[1]==scene0,'walls':nW,'wallBlocks':blocked,'title':title,'badNameKept':kept,'shareShot':shot,'back':back,'padBefore':pad0,'padAfter':pad1,'thumb':[thumb,thumb1],'pageErrors':errors}
   print(json.dumps(R['homeSector']),flush=True)
   assert handleOpens==['build','half'] and cc1['programs']<=16 and hs['view']=='drive' and hs['tank'] and moved>6 and v1=='build' and v2[0]=='drive' and v2[1]==scene0 and nW>=8 and blocked and 'Iron Hold' in title and kept=='Iron Hold' and shot and back and pad1 and pad1['walls']>=8 and thumb and thumb1 and not errors,R['homeSector']
   # the hub hero shows the town
   await page.locator('.cq-top button').first.click();await page.wait_for_timeout(600)
   if not await page.locator('.cq-hub').count():
    await page.locator('#tabbar [data-act="conquest"]').click()
   await page.wait_for_function('ConquestHub.state?.town',timeout=60000);await page.wait_for_timeout(1500);hub=await page.evaluate('ConquestHub.state.town')
   await page.screenshot(path=str(OUT/'hub-hero-town-390.png'));R['hub']=hub;assert hub['walls']>=8 and hub['builds']>=1,hub
   await close(ctx)
   # ---------- 3. performance + CC10 captures ----------
   perf={}
   for q in ('high','low'):
    ctx,page,errors=await session(390,700,{'position':GATE,'plotFull':'crater','baseFunds':True},q=q);await world(page);await page.wait_for_timeout(1500)
    worldInfo=await page.evaluate('({calls:Conquest.view.renderer.info.render.calls,triangles:Conquest.view.renderer.info.render.triangles,programs:Conquest.view.renderer.info.programs?.length||0,diorama:Conquest.view.diorama?.userData.counts})')
    if q=='high':
     await page.locator('#cq-home-btn').screenshot(path=str(OUT/'hud-thumbnail-cc10.png'))
    await enter_base(page);await page.wait_for_timeout(2500);drive=await page.evaluate('ConquestPlotView.state.info')
    if q=='high':await page.screenshot(path=str(OUT/'home-sector-drive-cc10-390.png'))
    await page.locator('.cq-plot-tabs button',has_text='HOME').click();await page.wait_for_timeout(2500);build=await page.evaluate('ConquestPlotView.state.info')
    if q=='high':await page.screenshot(path=str(OUT/'default-camera-cc10-crater-390.png'))
    perf[q]={'world':worldInfo,'homeSectorDrive':drive,'homeSectorBuild':build,'pageErrors':errors}
    print(q,json.dumps(perf[q]),flush=True)
    assert drive['programs']<=16 and build['programs']<=16 and drive['calls']<=140 and build['calls']<=140 and worldInfo['diorama'] and worldInfo['diorama']['walls']>=2000 and not errors,perf[q]
    await close(ctx)
   R['perf']=perf
   # default camera at CC1 and CC10 on three sites (before/after pairs for the owner)
   for (cc,site) in ((1,'ridge'),(1,'canyon'),(1,'plateau'),(10,'ridge'),(10,'canyon'),(10,'plateau')):
    ctx,page,errors=await session(390,700,{'position':GATE,'baseFunds':True,'plotCC':cc,'plotSite':site});await world(page);await enter_base(page)
    await page.locator('.cq-plot-tabs button',has_text='HOME').click();await snap_to(ctx,page,'peek');await page.wait_for_timeout(1500)
    await page.screenshot(path=str(OUT/f'default-camera-cc{cc}-{site}-390.png'));assert not errors,errors
    await close(ctx)
   # the pad diorama at CC1 and CC10 from a resting spot in the courtyard (CC1 vs CC10 side by side for the owner)
   for (cc,fx) in ((1,{'position':GATE,'at':PAD_VIEW,'baseFunds':True,'plotCC':1,'plotSite':'ridge'}),(10,{'position':GATE,'at':PAD_VIEW,'plotFull':'crater','baseFunds':True})):
    ctx,page,errors=await session(390,700,fx);await world(page);await page.wait_for_timeout(2500)
    await page.screenshot(path=str(OUT/f'pad-diorama-cc{cc}-390.png'));assert not errors,errors
    await close(ctx)
   # the hub hero at CC5 and CC10 (CC1 is captured above): a bigger town must read as a bigger town from the hero camera
   for (cc,fx) in ((5,{'position':GATE,'baseFunds':True,'plotCC':5,'plotSite':'ridge'}),(10,{'position':GATE,'plotFull':'crater','baseFunds':True})):
    ctx,page,errors=await session(390,700,fx);await world(page);await page.wait_for_timeout(800)
    await page.locator('.cq-top button').first.click();await page.wait_for_timeout(600)
    if not await page.locator('.cq-hub').count():await page.locator('#tabbar [data-act="conquest"]').click()
    await page.wait_for_function('ConquestHub.state?.town',timeout=60000);await page.wait_for_timeout(1500)
    await page.screenshot(path=str(OUT/f'hub-hero-town-cc{cc}-390.png'));R['hub'+str(cc)]=await page.evaluate('ConquestHub.state.town');assert not errors,errors
    await close(ctx)
   await browser.close()
  json.dump(R,open(OUT/'session5c.json','w'),indent=1)
  print('PASS Session 5C: sheet PEEK/HALF/FULL by touch at 390x700, 390x844, 320x568 (map resizes, page never scrolls); every tab fits or scrolls; WEAPONS 11 turrets + Gate + Shield with sprites; Home Sector drive (keys move the tank, walls block), tab lifts to the build view in the same scene, DRIVE returns, LEAVE back to the world; wall order updates the pad diorama and HUD thumbnail; Worker-validated town name; diorama share card; hub hero town; Home Sector CC10 within 16 programs at HIGH and LOW')
 finally:
  server.kill()
asyncio.run(main())
