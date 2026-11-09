"""Owner playtests (Nov 8-9 2026, iPhone/Telegram) on the town screen. Shipped client, Chromium (390x700 ~ the iPhone Telegram
visible area, 390x844 and 320x568), real Worker reducer on a disposable local DB.
 1. bottom bar: six tabs with CONQUEST in the middle; CONQUEST opens the hub with the same bar; GARAGE there leaves Conquest
 2. Session 5C sheet: it pulls up and down by a REAL finger drag on its grab bar (CDP touch, through the app's touch guard) to
    FULL, HALF, PEEK and CLOSED (drive), keeps a flick's momentum, never scrolls the page behind it, at 390x700, 390x844, 320x568
 3. tap-to-place: tapping a cell's on-screen position puts the blueprint exactly on that cell (3D HIGH) at PEEK, HALF and FULL,
    at CC1/CC5/CC10 on flat, canyon and plateau ground (the stage resizes with the sheet; viewport, scissor and cellAt follow)
 4. five tabs (HOME, BUILD, WEAPONS, WALLS, DEFEND) fit 320 px; every tab fits or scrolls by touch to its last item at HALF and PEEK
 5. WEAPONS lists the eleven turrets, the Gate and the Shield (sorted by unlock, locked ones dimmed with their CC), each with
    its 3D picture; BUILD lists the economy and support buildings with theirs; every store item has a preview picture ready
 6. wall tools: a touch-drawn LINE, the blend picker (full ore names) and CONFIRM WALLS floating on the map, at 390x700 and 320x568
"""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/base-ui';OUT.mkdir(parents=True,exist_ok=True);C5=ROOT/'docs/conquest/session5c';C5.mkdir(parents=True,exist_ok=True)
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
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();try{localStorage.setItem("lunar-conquest-onboarding-v1","1");localStorage.setItem("lunar-conquest-tour-v1","1")}catch(e){}')
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
    navFit=await page.evaluate('''(()=>{const n=document.querySelector('.cq-pagenav').getBoundingClientRect();const hit=document.elementFromPoint(innerWidth/2,n.top+n.height/2),e=document.querySelector('.cq-hub-deploy').getBoundingClientRect(),eh=document.elementFromPoint(e.left+e.width/2,e.top+e.height/2);return {navBottom:n.bottom<=innerHeight+1,onTop:!!hit?.closest('.cq-pagenav'),enterVisible:e.bottom<=n.top+1&&e.top>=0&&!!eh?.closest('.cq-hub-deploy')};})()''')
    assert navFit['navBottom'] and navFit['onTop'] and navFit['enterVisible'],navFit
    sc=await page.evaluate('(()=>{const p=document.querySelector(".cq.cq-hub");return {scrollable:p.scrollHeight>p.clientHeight+1};})()')
    if sc['scrollable']:
     sx,sy=w/2,min(200,h*.3);cdp=await ctx.new_cdp_session(page)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
     for k in range(1,13):
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':sy-k*18}]});await page.wait_for_timeout(16)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(600)
     sc['scrolledBy']=await page.evaluate('document.querySelector(".cq.cq-hub").scrollTop');assert sc['scrolledBy']>20,sc
    await page.locator('.cq-pagenav .tab[data-arg="garage"]').click();await page.wait_for_timeout(500)
    left=await page.evaluate('({cq:!!document.querySelector(".cq"),tab:uiTab})');assert not left['cq'] and left['tab']=='garage',left
    results[f'page-{w}']={'tabs':bar,'nav':navFit,'scroll':sc,'pageErrors':errors};assert not errors,errors
    await ctx.close()
   gate=[1080,1160]
   async def finger(ctx,page,x,y,dy,steps=12,dt=16):   # a real finger: touchstart, moves, touchend (through the app's touch guard)
    cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for k in range(1,steps+1):
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+dy*k/steps}]});await page.wait_for_timeout(dt)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(700)
   async def swipe_body(ctx,page,dy=-420):
    box=await page.locator('.cq-plot-body').bounding_box();await finger(ctx,page,box['x']+box['width']/2,box['y']+box['height']*.8,dy)
   async def open_base(ctx,page):
    await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
    b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);await b.click()
   async def tab(page,name):
    await page.locator(f'.cq-plot-tab[data-tab="{name}"]').click();await page.wait_for_timeout(500)
   async def snap(page,name):
    await page.evaluate(f'ConquestPlotView.snapTo("{name}")');await page.wait_for_function(f'ConquestPlotView.state.snap==="{name}"&&Math.abs(ConquestPlotView.state.sheetH-ConquestPlotView.state.sheetTarget)<1',timeout=8000);await page.wait_for_timeout(300)
   # ---------- 2. the sheet pulls up and down by a real finger (3 phone sizes) ----------
   sheet={}
   for (w,h) in ((390,700),(390,844),(320,568)):
    ctx,page,errors=await session(w,h,{'position':gate,'baseFunds':True,'plotCC':3,'plotSite':'ridge'});await open_base(ctx,page)
    await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(900)
    got={'start':await page.evaluate('ConquestPlotView.state.snap')}
    grab=await page.locator('.cq-sheet-grab').bounding_box();gx=grab['x']+grab['width']/2;gy=grab['y']+grab['height']/2
    async def drag_to(dy,label,**kw):
     g=await page.locator('.cq-sheet-grab').bounding_box();await finger(ctx,page,g['x']+g['width']/2,g['y']+g['height']/2,dy,**kw)
     got[label]=await page.evaluate('({snap:ConquestPlotView.state.snap,h:Math.round(ConquestPlotView.state.sheetH),H:Math.round(document.querySelector(".cq-plot").getBoundingClientRect().height),stageBottom:Math.round(document.querySelector(".cq-plot-stage").getBoundingClientRect().bottom),sheetTop:Math.round(document.querySelector(".cq-plot-sheet").getBoundingClientRect().top),docScroll:document.scrollingElement.scrollTop,dialogTop:Math.round(document.querySelector(".cq-plot").getBoundingClientRect().top)})')
    await drag_to(-h*.42,'up')            # slow drag up from HALF: FULL
    await drag_to(h*.35,'down1')          # back down to about HALF
    await drag_to(h*.22,'down2')          # down to PEEK
    await drag_to(h*.2,'down3')           # down to CLOSED: drive mode
    await drag_to(-h*.12,'flickUp',steps=4,dt=8)   # a short fast flick up: at least one snap up
    got['driveWasOn']=got['down3']['snap']=='closed'
    sheet[f'{w}x{h}']=got
    assert got['up']['snap']=='full' and got['down2']['snap']=='peek' and got['down3']['snap']=='closed' and got['flickUp']['snap'] in ('peek','half'),got
    for k in ('up','down1','down2','down3','flickUp'):
     g2=got[k];assert abs(g2['stageBottom']-g2['sheetTop'])<=2 and g2['docScroll']==0 and g2['dialogTop']==0,(k,g2)   # the map ends where the sheet begins; no page scroll bleed
    fr=got['up']['h']/(got['up']['H']-54);assert .8<fr<.95,('FULL ~88%',fr)
    await page.screenshot(path=str(C5/f'sheet-{w}x{h}.png'));assert not errors,errors
    await ctx.close()
   results['sheet']=sheet
   # ---------- 3. taps land on the exact cell at every snap, town size and terrace ----------
   async def tap_cell(page,i,j):
    pt=await page.evaluate('''([i,j])=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,p=Conquest.view.authority.state.plot,v=new T.Vector3(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)).project(X.R.cam),r=X.stage.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height,in:v.x>-.8&&v.x<.8&&v.y>-.78&&v.y<.7};}''',[i,j])
    if not pt['in']:return None
    await page.touchscreen.tap(pt['x'],pt['y']);await page.wait_for_timeout(350)
    return await page.evaluate('[ConquestPlotView.state.place.i,ConquestPlotView.state.place.j]')
   placement={}
   for (cc,site) in ((1,'ridge'),(5,'canyon'),(10,'plateau'),(10,'ridge')):
    ctx,page,errors=await session(390,700,{'position':gate,'baseFunds':True,'plotCC':cc,'plotSite':site});await open_base(ctx,page)
    await page.wait_for_selector('.cq-plot-tabs');await tab(page,'weapons')
    await page.locator('.cq-plot-card',has_text='Cannon Turret').click();await page.wait_for_function('ConquestPlotView.state?.place?.type==="cannon"',timeout=10000);await page.wait_for_timeout(700)
    autoPeek=await page.evaluate('ConquestPlotView.state.snap')
    hits=[];misses=[]
    for sn in ('peek','half','full'):
     await snap(page,sn);await page.evaluate('ConquestPlotView.state.cam.x=0;ConquestPlotView.state.cam.z=0;ConquestPlotView.state.cam.dist=150');await page.wait_for_timeout(500)
     for (di,dj) in ((0,-4),(-6,-2),(5,3),(-3,7),(4,-6),(-8,5),(8,8),(-10,-8),(11,-3),(2,12),(-12,10),(13,13)):
      got=await tap_cell(page,39+di,39+dj)
      if got is None:continue
      (hits if got==[39+di,39+dj] else misses).append({'snap':sn,'want':[39+di,39+dj],'got':got})
     if cc==10 and site=='ridge':await page.screenshot(path=str(OUT/f'place-tap-{sn}-390x700.png'))
    await page.screenshot(path=str(OUT/f'place-tap-cc{cc}-{site}-390x700.png'))
    placement[f'cc{cc}-{site}']={'exact':len(hits),'wrong':misses,'autoPeek':autoPeek,'pageErrors':errors}
    assert len(hits)>=14 and not misses and not errors and autoPeek=='peek',placement[f'cc{cc}-{site}']   # placing drops the sheet to PEEK by itself
    await ctx.close()
   results['placement']=placement
   # ---------- 4-6. every tab fits or scrolls; WEAPONS/BUILD pictures; wall tools ----------
   fit={}
   for (w,h) in ((390,700),(320,568)):
    ctx,page,errors=await session(w,h,{'position':gate,'baseFunds':True,'plotCC':10,'plotSite':'ridge'});await open_base(ctx,page)
    await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(600)
    tabs=await page.evaluate('''(()=>{const t=[...document.querySelectorAll('.cq-plot-tab')];return {labels:t.map(b=>b.querySelector('.cq-tab-lab').textContent),fit:t.every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height>=44&&b.scrollWidth<=b.clientWidth+1;})};})()''')
    assert tabs['labels']==['HOME','BUILD','WEAPONS','WALLS','DEFEND'] and tabs['fit'],tabs
    per={}
    for name in ('home','build','weapons','walls','defend'):
     await tab(page,name)
     for sn in ('half','peek'):
      await snap(page,sn)
      body=await page.evaluate('''(()=>{const b=document.querySelector('.cq-plot-body'),r=b.getBoundingClientRect();return {bottom:Math.round(r.bottom),vh:innerHeight,scrolls:b.scrollHeight>b.clientHeight+1,top:b.scrollTop};})()''')
      if body['scrolls']:
       for k in range(6):
        await swipe_body(ctx,page)
        if await page.evaluate('(()=>{const b=document.querySelector(".cq-plot-body");return b.scrollTop+b.clientHeight>=b.scrollHeight-2;})()'):break
      body['lastReachable']=await page.evaluate('''(()=>{const b=document.querySelector('.cq-plot-body'),r=b.getBoundingClientRect(),kids=[...b.children].filter(e=>e.getBoundingClientRect().height>0),last=kids.at(-1).getBoundingClientRect();return last.bottom<=r.bottom+2&&last.top>=r.top-2-Math.max(0,last.height-r.height);})()''')
      body['scrolledTo']=await page.evaluate('document.querySelector(".cq-plot-body").scrollTop')
      if w==390:await page.screenshot(path=str(C5/f'tab-{name}-{sn}-390x700.png'))
      per[name+'-'+sn]=body;assert body['bottom']<=body['vh'] and body['lastReachable'] and (not body['scrolls'] or body['scrolledTo']>10),(name,sn,body)
      await page.evaluate('document.querySelector(".cq-plot-body").scrollTop=0')
    # WEAPONS: 11 turrets + Gate + Shield with their 3D pictures, sorted by unlock; BUILD: economy + support with pictures
    await tab(page,'weapons');await snap(page,'half')
    await page.wait_for_function('document.querySelectorAll(".cq-plot-card .cq-plot-ico.cq-has-spr").length>=13',timeout=60000)
    wl=await page.evaluate('''(()=>{const cards=[...document.querySelectorAll('.cq-plot-card')];return {types:cards.map(c=>c.dataset.type),sprites:cards.filter(c=>c.querySelector('.cq-plot-ico.cq-has-spr img')).length,summary:document.querySelector('.cq-plot-wsum b')?.textContent};})()''')
    await tab(page,'build');await page.wait_for_function('document.querySelectorAll(".cq-plot-card .cq-plot-ico.cq-has-spr").length>=11',timeout=60000)
    bl=await page.evaluate('[...document.querySelectorAll(".cq-plot-card")].map(c=>c.dataset.type)')
    store=await page.evaluate('''(()=>{const X=ConquestPlotView.state;for(const it of ConquestPlot.STORE.items)X.spr.want("s",it.id);return ConquestPlot.STORE.items.length;})()''')
    await page.wait_for_function('ConquestPlot.STORE.items.every(it=>ConquestTownKit.SPRITES.has(ConquestTownKit.spriteKey("s",it.id)))',timeout=60000)
    turrets=[t for t in wl['types'] if t not in ('gate','shield')]
    assert len(turrets)==11 and 'gate' in wl['types'] and 'shield' in wl['types'] and wl['sprites']==13 and 'TURRETS' in (wl['summary'] or ''),wl
    assert set(bl)=={'refinery','storage','reactor','foundry','biodome','hangar','helium','radar','lab','uplink','trophy'},bl
    if w==390:
     await tab(page,'weapons');await page.locator('.cq-plot-body').screenshot(path=str(C5/'weapons-sprites-390.png'))
    # wall tools: blend picker first (full names), LINE/RECT/RING/ERASE in one row, a touch-drawn LINE, CONFIRM WALLS on the map
    await tab(page,'walls');await page.locator('.cq-plot-tools button',has_text='LINE').first.click();await page.evaluate('ConquestPlotView.state.cam.x=0;ConquestPlotView.state.cam.z=0;ConquestPlotView.state.cam.dist=150');await page.wait_for_timeout(500)
    ends=await page.evaluate('''()=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,p=Conquest.view.authority.state.plot,r=X.stage.getBoundingClientRect(),pr=(i,j)=>{const v=new T.Vector3(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)).project(X.R.cam);return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};};return [pr(33,46),pr(45,46)];}''')
    cdp=await ctx.new_cdp_session(page);await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':ends[0]['x'],'y':ends[0]['y']}]})
    for k in range(1,11):
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':ends[0]['x']+(ends[1]['x']-ends[0]['x'])*k/10,'y':ends[0]['y']+(ends[1]['y']-ends[0]['y'])*k/10}]});await page.wait_for_timeout(20)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(600)
    draft=await page.evaluate('ConquestPlotView.state.draft.map(d=>[d.sec.k,d.sec.a,d.sec.b])')
    await page.locator('.cq-plot-ore',has_text='Ferrite').click();await page.locator('.cq-plot-levels button',has_text='HEAVY').click();await page.wait_for_timeout(300)
    walls=await page.evaluate('''(()=>{const b=document.querySelector('.cq-plot-body'),ores=[...b.querySelectorAll('.cq-plot-ore')],tools=[...b.querySelectorAll('.cq-plot-tools')][0];const vis=e=>{const q=e.getBoundingClientRect();return q.width>0&&q.left>=0&&q.right<=innerWidth+1;};
      return {ores:ores.length,oresFit:ores.every(vis),names:ores.map(o=>o.querySelector('.cq-ore-name').textContent.replace(/\\n/g,' ')),tools:[...tools.querySelectorAll('button')].map(x=>x.textContent),count:b.querySelector('.cq-plot-wallcount')?.textContent,snap:ConquestPlotView.state.snap};})()''')
    walls['confirmReachable']=await page.evaluate('''(()=>{const ok=document.querySelector('.cq-plot-fab .cq-plot-primary');if(!ok||ok.disabled||!/CONFIRM WALLS/.test(ok.textContent))return false;const q=ok.getBoundingClientRect(),hit=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return q.top>=0&&q.bottom<=innerHeight&&q.left>=0&&q.right<=innerWidth&&(hit===ok||ok.contains(hit));})()''')
    await page.screenshot(path=str(OUT/f'wall-tools-{w}x{h}.png'))
    assert draft and draft[-1][1]==[33,46] and draft[-1][2]==[45,46],draft
    assert walls['ores']==7 and walls['oresFit'] and 'Ferrite' in walls['names'] and walls['tools']==['LINE','RECT','RING','ERASE'] and walls['confirmReachable'] and walls['snap']=='peek' and 'WALLS' in (walls['count'] or ''),walls
    fit[f'{w}x{h}']={'tabs':tabs,'perTab':per,'weapons':wl,'build':bl,'storeSprites':store,'walls':walls,'draft':draft,'pageErrors':errors};assert not errors,errors
    await ctx.close()
   results['fit']=fit
   await browser.close()
  json.dump(results,open(OUT/'base-ui.json','w'),indent=1);print(json.dumps(results)[:1500])
  print('PASS Conquest page + town screen: six-tab bar (320 fits); the sheet pulls to FULL/HALF/PEEK/CLOSED by real touch with momentum and no page scroll at 390x700, 390x844, 320x568; taps land on the exact cell at PEEK/HALF/FULL at CC1/CC5/CC10 on flat, canyon and plateau ground; five tabs fit 320 and every tab fits or scrolls by touch at HALF and PEEK; WEAPONS = 11 turrets + Gate + Shield with 3D pictures, BUILD = economy and support with pictures, every store item has a preview; wall tools + CONFIRM WALLS on the map at 390x700 and 320x568')
 finally:
  server.kill()
asyncio.run(main())
