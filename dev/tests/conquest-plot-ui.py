"""Owner playtest (Nov 8 2026, iPhone/Telegram): "it should allow you to scroll in the menu screen", "you can not scroll down to
see what they are", "when you try to place an item it doesn't always go to where you click", plus "Conquest should have its
own page". Shipped client, Chromium 390x700 (~iPhone Telegram visible area; 320x568 and 390x844 for the tab bar), real Worker reducer on a disposable local DB.
 1. bottom bar: six tabs with CONQUEST in the middle, no Conquest button on Play; CONQUEST opens the hub with the same bar
    (CONQUEST lit); tapping GARAGE there leaves Conquest for the Garage page
 2. base screen: the menu ends inside the visible screen, scrolls, and its LAST build card can be reached and read
 3. build cards say what each building is for (description + role tag + size/power + cost/time)
 4. tap-to-place: tapping the on-screen position of a cell puts the blueprint exactly on that cell (3D HIGH), for cells
    spread over the whole visible stage, before and after the map/menu split changes
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
   ctx,page,errors=await session(390,700,{'position':gate,'fieldMissions':True,'baseFunds':True})   # ~ the iPhone Telegram visible area (header takes ~140 px)
   await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
   b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);await b.click()
   await page.wait_for_selector('.cq-site-card');await page.locator('.cq-site-card[data-site="ridge"]').click();await page.locator('.cq-plot-primary',has_text='CLAIM PLOT').click()
   await page.wait_for_function('Conquest.view.authority.state?.plot&&document.querySelector(".cq-plot-tabs")',timeout=60000)
   await page.locator('.cq-plot-tabs button',has_text='BUILD').click();await page.wait_for_timeout(900)
   menu=await page.evaluate('''(()=>{const s=document.querySelector('.cq-plot-sheet'),r=s.getBoundingClientRect(),cards=[...s.querySelectorAll('.cq-plot-card')];s.scrollTop=s.scrollHeight;const last=cards.at(-1).getBoundingClientRect();
      return {sheetBottom:Math.round(r.bottom),vh:innerHeight,scrolls:s.scrollHeight>s.clientHeight,lastVisible:last.bottom<=r.bottom+1&&last.top>=r.top-1,cards:cards.length,
      described:cards.every(c=>c.querySelector('.cq-plot-desc')?.textContent.length>8&&c.querySelector('.cq-plot-cost')?.textContent.includes('SIZE')),groups:[...s.querySelectorAll('.cq-plot-group')].map(g=>g.textContent),tags:cards.map(c=>c.querySelector('.cq-plot-tag')?.textContent)};})()''')
   assert menu['sheetBottom']<=menu['vh'] and menu['lastVisible'] and menu['described'] and menu['cards']>=3,menu
   await page.screenshot(path=str(OUT/'build-menu-scrolled-390x700.png'))
   await page.evaluate('document.querySelector(".cq-plot-sheet").scrollTop=0');await page.wait_for_timeout(300);await page.screenshot(path=str(OUT/'build-menu-top-390x700.png'))
   results['menu']=menu
   # 4. tap-to-place accuracy (3D): pick a Cannon (1x1), then tap the screen position of target cells
   await page.locator('.cq-plot-card',has_text='Cannon').click();await page.wait_for_function('ConquestPlotView.state?.place?.type==="cannon"',timeout=10000);await page.wait_for_timeout(900)
   async def tap_cell(i,j):
    pt=await page.evaluate('''([i,j])=>{const X=ConquestPlotView.state,P=ConquestPlot,T=X.R.T,v=new T.Vector3(P.cellX(i),0,P.cellZ(j)).project(X.R.cam),r=X.stage.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height,in:v.x>-.85&&v.x<.85&&v.y>-.8&&v.y<.75};}''',[i,j])
    if not pt['in']:return None
    await page.touchscreen.tap(pt['x'],pt['y']);await page.wait_for_timeout(450)
    return await page.evaluate('[ConquestPlotView.state.place.i,ConquestPlotView.state.place.j]')
   hits=[];misses=[]
   for split in ('auto','menu'):
    if split=='menu':
     await page.locator('.cq-plot-size').click();await page.wait_for_timeout(700)
    for (i,j) in ((20,20),(14,18),(26,22),(18,26),(24,14),(12,24),(28,28)):
     got=await tap_cell(i,j)
     if got is None:continue
     (hits if got==[i,j] else misses).append({'split':split,'want':[i,j],'got':got})
   await page.screenshot(path=str(OUT/'place-tap-390x700.png'))
   results['placement']={'exact':len(hits),'wrong':misses}
   assert len(hits)>=8 and not misses,results['placement']
   assert not errors,errors
   results['pageErrors']=errors
   await ctx.close();await browser.close()
  json.dump(results,open(OUT/'base-ui.json','w'),indent=1);print(json.dumps(results)[:1500])
  print('PASS Conquest page + base screen 390: six-tab bar with CONQUEST (320 fits), hub carries the bar and leaves to Garage; base menu ends on screen, scrolls to its last card, cards describe each building; taps place the blueprint on the exact cell in both splits')
 finally:
  server.kill()
asyncio.run(main())
