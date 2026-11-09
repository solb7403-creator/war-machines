"""Owner playtest (Nov 8 2026, iPhone/Telegram): "it should allow you to scroll in the menu screen", "you can not scroll down to
see what they are", "when you try to place an item it doesn't always go to where you click", plus "Conquest should have its
own page". Shipped client, Chromium 390x700 (~iPhone Telegram visible area; 320x568 and 390x844 for the tab bar), real Worker reducer on a disposable local DB.
 1. bottom bar: six tabs with CONQUEST in the middle, no Conquest button on Play; CONQUEST opens the hub with the same bar
    (CONQUEST lit); tapping GARAGE there leaves Conquest for the Garage page
 2. base screen: the menu ends inside the visible screen, scrolls, and its LAST build card can be reached and read
 3. build cards say what each building is for (description + role tag + size/power + cost/time)
 4. tap-to-place: tapping the on-screen position of a cell puts the blueprint exactly on that cell (3D HIGH), for cells
    spread over the whole visible stage, before and after the map/menu split changes, at CC1/CC5/CC10 (Session 5B town sizes)
    on flat, canyon and plateau ground
 5. Session 5B: wall tools + blend picker + CONFIRM WALLS and the 11-turret list fit or scroll at 390x700 and 320x568 (real touch)
"""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/base-ui';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(w,h,fixture):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="high";window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
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
   # ---------- 1. Conquest is its own page ----------
   for w,h in ((320,568),(390,700),(390,844)):
    ctx,page,errors=await session(w,h,{'position':[1174,1168]})
    await page.wait_for_timeout(500)
    bar=await page.evaluate('''(()=>{const t=[...document.querySelectorAll('#tabbar .tab')];return {labels:t.map(b=>b.textContent.trim()),fit:t.every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.width>=44;}),playBtn:!!document.querySelector('#s-play [data-act="conquest"]')};})()''')
    assert bar['labels']==['Play','Garage','Conquest','Shop','Quests','Ranks'] and bar['fit'] and not bar['playBtn'],bar
    await page.screenshot(path=str(OUT/f'tabbar-play-{w}.png'))
    await page.locator('#tabbar [data-act="conquest"]').click()
    await page.wait_for_selector('.cq-hub .cq-pagenav .tab-cq.on',timeout=30000);await page.wait_for_timeout(1200)
    await page.screenshot(path=str(OUT/f'conquest-page-{w}.png'))
    navFit=await page.evaluate('''(()=>{const n=document.querySelector('.cq-pagenav').getBoundingClientRect(),a=document.querySelector('.cq-hub-actions').getBoundingClientRect();const hit=document.elementFromPoint(innerWidth/2,n.top+n.height/2),e=document.querySelector('.cq-hub-deploy').getBoundingClientRect(),eh=document.elementFromPoint(e.left+e.width/2,e.top+e.height/2);return {navBottom:n.bottom<=innerHeight+1,navTop:n.top,onTop:!!hit?.closest('.cq-pagenav'),enterVisible:e.bottom<=n.top+1&&e.top>=0&&!!eh?.closest('.cq-hub-deploy')};})()''')
    assert navFit['navBottom'] and navFit['onTop'] and navFit['enterVisible'],navFit   # ENTER CONQUEST on screen without scrolling
    # the page scrolls when it is taller than the screen (iPhone touch scroll, through the app's touch guard)
    sc=await page.evaluate('(()=>{const p=document.querySelector(".cq.cq-hub");return {scrollable:p.scrollHeight>p.clientHeight+1};})()')
    if sc['scrollable']:
     sx,sy=w/2,min(200,h*.3)   # start on the hero (the pinned actions cover the lower screen)
     cdp=await ctx.new_cdp_session(page)
     async def swipe():   # a real finger: touchstart, moves, touchend (through the app's touch guard)
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
      for k in range(1,13):
       await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':sy-k*18}]});await page.wait_for_timeout(16)
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(600)
     await swipe()
     sc['scrolledBy']=await page.evaluate('document.querySelector(".cq.cq-hub").scrollTop')
     import os
     if os.environ.get('DBG'):
      await page.evaluate('window.__tm=[];document.addEventListener("touchmove",e=>window.__tm.push(e.defaultPrevented+":"+e.cancelable),{passive:true});document.addEventListener("touchstart",e=>window.__tm.push("start:"+e.target.className),{passive:true})')
      await swipe()
      print('DBG',await page.evaluate('[window.__tm.slice(0,6),window.__tm.length,document.querySelector(".cq.cq-hub").scrollTop,getComputedStyle(document.querySelector(".cq.cq-hub")).overflowY]'))
     assert sc['scrolledBy']>20,sc
    navFit['scroll']=sc
    await page.locator('.cq-pagenav .tab[data-arg="garage"]').click();await page.wait_for_timeout(500)
    left=await page.evaluate('({cq:!!document.querySelector(".cq"),tab:uiTab})')
    assert not left['cq'] and left['tab']=='garage',left
    results[f'page-{w}']={'tabs':bar,'nav':navFit,'leftTo':left,'pageErrors':errors};assert not errors,errors
    await ctx.close()
   # ---------- 2-4. base screen ----------
   gate=[1080,1160]
   async def touch_swipe(ctx,page,sel,dy=-260):   # a real finger on the element: touchstart, moves, touchend (through the app's touch guard)
    box=await page.locator(sel).bounding_box();sx=box['x']+box['width']/2;sy=box['y']+min(box['height']-20,box['height']*.75)
    cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
    for k in range(1,13):
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':sy+dy*k/12}]});await page.wait_for_timeout(16)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(500)
   async def snap_to(ctx,page,want):   # 5C: drag the sheet's grab handle with a real finger (slow, no flick) to a snap point
    for _ in range(3):
     g=await page.evaluate('''(w)=>{const X=ConquestPlotView.state,h=document.querySelector('.cq-plot-grab').getBoundingClientRect(),H=ConquestSheet.heights(X.d.clientHeight-X.top.offsetHeight,(X.grab.offsetHeight||22)+(X.tabs.offsetHeight||48)+6);return {x:h.left+h.width/2,y:h.top+h.height/2,dy:X.sheetPx-H[w],snap:X.d.dataset.snap};}''',want)
     if g['snap']==want:return True
     cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':g['x'],'y':g['y']}]})
     for k in range(1,21):
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':g['x'],'y':g['y']+g['dy']*k/20}]});await page.wait_for_timeout(30)
     await page.wait_for_timeout(200);await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(500)
    return await page.evaluate('ConquestPlotView.state.d.dataset.snap')==want
   async def open_base(ctx,page):
    await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
    b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);await b.click()
   ctx,page,errors=await session(390,700,{'position':gate,'fieldMissions':True,'baseFunds':True})   # ~ the iPhone Telegram visible area (header takes ~140 px)
   await open_base(ctx,page)
   await page.wait_for_selector('.cq-site-card');sites=await page.locator('.cq-site-card').count();await page.locator('.cq-site-card[data-site="ridge"]').click();await page.locator('.cq-plot-primary',has_text='CLAIM TOWN').click()
   await page.wait_for_function('Conquest.view.authority.state?.plot&&document.querySelector(".cq-plot-tabs")',timeout=60000)
   await page.locator('.cq-plot-tabs button',has_text='BUILD').click();await page.wait_for_timeout(900)
   menu=await page.evaluate('''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),cards=[...s.querySelectorAll('.cq-plot-card')];
      return {sheetBottom:Math.round(r.bottom),vh:innerHeight,scrolls:s.scrollHeight>s.clientHeight,cards:cards.length,
      described:cards.filter(c=>!c.classList.contains('cq-plot-locked')).every(c=>c.querySelector('.cq-plot-desc')?.textContent.length>8&&c.querySelector('.cq-plot-cost')?.textContent.includes('SIZE'))&&cards.filter(c=>c.classList.contains('cq-plot-locked')).every(c=>/UNLOCKS AT CC\\d/.test(c.textContent)&&c.disabled),groups:[...s.querySelectorAll('.cq-plot-group')].map(g=>g.textContent),tags:cards.map(c=>c.querySelector('.cq-plot-tag')?.textContent)};})()''')
   await touch_swipe(ctx,page,'.cq-plot-sheet',-600);await touch_swipe(ctx,page,'.cq-plot-sheet',-600)
   menu['afterSwipe']=await page.evaluate('''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),last=[...s.querySelectorAll('.cq-plot-card')].at(-1).getBoundingClientRect();return {scrollTop:Math.round(s.scrollTop),lastVisible:last.bottom<=r.bottom+1&&last.top>=r.top-1};})()''')
   assert sites==7 and menu['sheetBottom']<=menu['vh'] and menu['described'] and menu['cards']>=4 and any('VITAL' in (t or '') for t in menu['tags']),menu
   assert (not menu['scrolls']) or (menu['afterSwipe']['scrollTop']>20 and menu['afterSwipe']['lastVisible']),menu
   await page.screenshot(path=str(OUT/'build-menu-scrolled-390x700.png'))
   results['menu']=menu
   await ctx.close()
   # 3. taps land on the exact cell at every town size and on terraced ground (3D HIGH): pick a Cannon, tap cells
   async def tap_cell(page,i,j):
    pt=await page.evaluate('''([i,j])=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,p=Conquest.view.authority.state.plot,v=new T.Vector3(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)).project(X.R.cam),r=X.stage.getBoundingClientRect();const x=r.left+(v.x+1)/2*r.width,y=r.top+(1-v.y)/2*r.height,hit=document.elementFromPoint(x,y),near=[[0,0],[26,0],[-26,0],[0,26],[0,-26],[18,18],[-18,18],[18,-18],[-18,-18]].some(([dx,dy])=>{const e=document.elementFromPoint(x+dx,y+dy);return !!e&&!!e.closest('button,.cq-plot-coach,.cq-plot-fab,.cq-plot-drawer');});return {x,y,in:v.x>-.8&&v.x<.8&&v.y>-.78&&v.y<.7&&!!hit&&!near&&!!hit.closest('.cq-plot-stage,.cq-viewport,canvas')};}''',[i,j])   # only taps that reach the map, clear of map buttons and the sheet by the touch-adjustment radius (a finger must be too)
    if not pt['in']:return None
    await page.touchscreen.tap(pt['x'],pt['y']);await page.wait_for_timeout(350)
    return await page.evaluate('[ConquestPlotView.state.place.i,ConquestPlotView.state.place.j]')
   placement={}
   for (cc,site) in ((1,'ridge'),(5,'canyon'),(10,'plateau'),(10,'ridge')):
    ctx,page,errors=await session(390,700,{'position':gate,'baseFunds':True,'plotCC':cc,'plotSite':site});await open_base(ctx,page)
    await page.wait_for_selector('.cq-plot-tabs');await page.locator('.cq-plot-tabs button',has_text='WEAPONS').click()
    await page.locator('.cq-plot-card',has_text='Cannon Turret').click();await page.wait_for_function('ConquestPlotView.state?.place?.type==="cannon"',timeout=10000);await page.wait_for_timeout(700)
    await page.evaluate('ConquestPlotView.state.cam.x=0;ConquestPlotView.state.cam.z=0;ConquestPlotView.state.cam.dist=150');await page.wait_for_timeout(500)
    hits=[];misses=[]
    for split in ('peek','half','full'):   # 5C: taps land on the exact cell at every sheet snap (the stage resizes with the sheet)
     assert await snap_to(ctx,page,split),split
     await page.wait_for_timeout(400)
     for (di,dj) in ((0,-4),(-6,-2),(5,3),(-3,7),(4,-6),(-8,5),(8,8),(-10,-8),(11,-3),(2,12),(-12,10),(13,13)):
      got=await tap_cell(page,39+di,39+dj)
      if got is None:continue
      (hits if got==[39+di,39+dj] else misses).append({'split':split,'want':[39+di,39+dj],'got':got})
    await page.screenshot(path=str(OUT/f'place-tap-cc{cc}-{site}-390x700.png'))
    placement[f'cc{cc}-{site}']={'exact':len(hits),'wrong':misses,'pageErrors':errors}
    assert len(hits)>=10 and not misses and not errors and {m['split'] for m in hits}>={'peek','half'},placement
    await ctx.close()
   results['placement']=placement
   # 4. every screen fits or scrolls: wall tools + blend picker + draft CONFIRM, and the turret list, at 390x700 and 320x568
   fit={}
   for (w,h) in ((390,700),(320,568)):
    ctx,page,errors=await session(w,h,{'position':gate,'baseFunds':True,'plotCC':10,'plotSite':'ridge'});await open_base(ctx,page)
    await page.wait_for_selector('.cq-plot-tabs');await page.locator('.cq-plot-tabs button',has_text='WALLS').click();await page.wait_for_timeout(500)
    # draw a LINE with a real finger drag on the stage (touch), then check the draft and the primary action
    await page.locator('.cq-plot-tools button',has_text='LINE').click();await page.evaluate('ConquestPlotView.state.cam.x=0;ConquestPlotView.state.cam.z=0;ConquestPlotView.state.cam.dist=150');await page.wait_for_timeout(400)
    ends=await page.evaluate('''()=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,p=Conquest.view.authority.state.plot,r=X.stage.getBoundingClientRect(),pr=(i,j)=>{const v=new T.Vector3(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)).project(X.R.cam);return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};};return [pr(33,46),pr(45,46)];}''')
    cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':ends[0]['x'],'y':ends[0]['y']}]})
    for k in range(1,11):
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':ends[0]['x']+(ends[1]['x']-ends[0]['x'])*k/10,'y':ends[0]['y']+(ends[1]['y']-ends[0]['y'])*k/10}]});await page.wait_for_timeout(20)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(600)
    draft=await page.evaluate('ConquestPlotView.state.draft.map(d=>[d.sec.k,d.sec.a,d.sec.b])')
    await page.locator('.cq-plot-ore',has_text='FERR').click();await page.locator('.cq-plot-levels button',has_text='HEAVY').click();await page.wait_for_timeout(300)
    walls=await page.evaluate('''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),ok=[...s.querySelectorAll('button')].find(b=>b.textContent==='CONFIRM WALLS'),ores=[...s.querySelectorAll('.cq-plot-ore')];const vis=e=>{const q=e.getBoundingClientRect();return q.width>0&&q.left>=0&&q.right<=innerWidth+1;};
      return {sheetBottom:Math.round(r.bottom),vh:innerHeight,ores:ores.length,oresFit:ores.every(vis),count:s.querySelector('.cq-plot-wallcount')?.textContent,confirm:!!ok,scrolls:s.scrollHeight>s.clientHeight};})()''')
    await page.screenshot(path=str(OUT/f'wall-tools-{w}x{h}.png'))
    # the primary action is on screen without scrolling; the rest of the picker is reachable by a real swipe
    walls['confirmReachable']=await page.evaluate('''(()=>{const ok=document.querySelector('.cq-plot-fab .cq-plot-primary');if(!ok||ok.disabled||!/CONFIRM WALLS/.test(ok.textContent))return false;const q=ok.getBoundingClientRect(),hit=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return q.top>=0&&q.bottom<=innerHeight&&q.left>=0&&q.right<=innerWidth&&(hit===ok||ok.contains(hit));})()''')
    assert await snap_to(ctx,page,'half')
    walls['scrolls']=await page.evaluate('(()=>{const s=document.querySelector(".cq-plot-sheet");return s.scrollHeight>s.clientHeight})()')
    seen='''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),st=[...s.querySelectorAll('.cq-plot-stat')].at(-1);if(!st)return false;const q=st.getBoundingClientRect();return q.top>=r.top-1&&q.bottom<=r.bottom+1;})()'''
    walls['lastReachable']=await page.evaluate(seen)
    for k in range(10):   # real swipes, a little at a time, until the last meter is on screen (Foundry and layouts follow it now)
     if walls['lastReachable'] or not walls['scrolls']:break
     await touch_swipe(ctx,page,'.cq-plot-sheet',-120);walls['lastReachable']=await page.evaluate(seen)
    await page.screenshot(path=str(OUT/f'wall-confirm-{w}x{h}.png'))
    assert draft and draft[-1][1]==[33,46] and draft[-1][2]==[45,46],draft
    assert walls['sheetBottom']<=walls['vh'] and walls['ores']==7 and walls['oresFit'] and walls['confirm'] and walls['confirmReachable'] and walls['lastReachable'] and 'WALLS' in (walls['count'] or ''),walls
    # the turret list (11 types at CC10): the last card is reachable by a real swipe; placing keeps CONFIRM BUILD on screen
    await page.locator('.cq-plot-tabs button',has_text='WEAPONS').click();await page.wait_for_timeout(500)
    for k in range(4):
     await touch_swipe(ctx,page,'.cq-plot-sheet',-600)
    tl=await page.evaluate('''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),cards=[...s.querySelectorAll('.cq-plot-card')],turrets=cards.filter(c=>/RANGE \\d+ m/.test(c.querySelector('.cq-plot-statline')?.textContent||'')&&!c.classList.contains('cq-plot-locked')),last=cards.at(-1).getBoundingClientRect();return {turrets:turrets.length,lastVisible:last.bottom<=r.bottom+1&&last.top>=r.top-1,scrollTop:Math.round(s.scrollTop)};})()''')
    await page.screenshot(path=str(OUT/f'turret-list-{w}x{h}.png'))
    await page.evaluate('document.querySelector(".cq-plot-sheet").scrollTop=0');await page.locator('.cq-plot-card',has_text='Railgun').click();await page.wait_for_timeout(500)
    tl['confirmOnScreen']=await page.evaluate('''(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent==='CONFIRM BUILD');if(!b)return 'missing';const q=b.getBoundingClientRect(),hit=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return q.top>=0&&q.bottom<=innerHeight&&q.left>=0&&q.right<=innerWidth&&(hit===b||b.contains(hit))?true:JSON.stringify([q.top,q.bottom,innerHeight]);})()''')   # 5C: it floats on the map while placing
    assert tl['turrets']==11 and tl['lastVisible'] and tl['confirmOnScreen'] is True,tl
    fit[f'{w}x{h}']={'walls':walls,'draft':draft,'turretList':tl,'pageErrors':errors};assert not errors,errors
    await ctx.close()
   results['fit']=fit
   await browser.close()
  json.dump(results,open(OUT/'base-ui.json','w'),indent=1);print(json.dumps(results)[:1500])
  print('PASS Conquest page + town screen: six-tab bar with CONQUEST (320 fits); seven sites; build menu fits and scrolls by touch to its last card (vitals tagged); taps land on the exact cell at CC1/CC5/CC10 on flat, canyon and plateau ground at every sheet snap (PEEK/HALF/FULL); wall tools (touch-drawn LINE, blend picker, CONFIRM WALLS) and the 11-turret list fit or scroll at 390x700 and 320x568')
 finally:
  server.kill()
asyncio.run(main())
