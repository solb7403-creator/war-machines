"""Session 7T-P screens in the shipped client against the real Worker on a disposable local DB (owner brief
docs/conquest/audit/SESSION_07TP_BRIEF.md): decision 3, the town coach's step 4 (CLOSE YOUR WALL RING before CC4: the HOME card's
GO TO WALLS, the map pill, the red marker where the town is open, then the ring confirmed with CONFIRM WALLS and the coach moving on),
and decision 4, the welcome-back kits on the hub (back after 15 days away: WELCOME BACK · DAY 1 · +1 REPAIR KIT, the streak line naming
the day-3 Scanner Charge), at 390x844, 390x700, 320x568 (touch: a real swipe reaches what is below) and 1366x768, 1920x1080 (mouse and
keyboard). Every screen fits or scrolls. Pictures: docs/conquest/session7tp."""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session7tp';OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(390,844,True),(390,700,True),(320,568,True),(1366,768,False),(1920,1080,False)]
if '--quick' in sys.argv:SIZES=[(390,844,True),(1366,768,False)]
if '--size' in sys.argv:SIZES=[x for x in SIZES if f'{x[0]}x{x[1]}'==sys.argv[sys.argv.index('--size')+1]]
async def close_ctx(ctx):
 for pg in ctx.pages:
  try:await pg.unroute_all(behavior='ignoreErrors')
  except Exception:pass
 await ctx.close()
async def swipe(page,sel,up=True):   # a real finger (as conquest-plot-ui.py): touchstart, 12 small moves 16 ms apart, touchend
 box=await page.locator(sel).first.bounding_box();cdp=await page.context.new_cdp_session(page);vw=page.viewport_size;sx=min(max(box['x']+box['width']/2,20),vw['width']-20)
 top=max(box['y'],0)+20;bot=min(box['y']+box['height'],vw['height'])-20;sy=bot-10 if up else top+10;d=-18 if up else 18
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
 for k in range(1,13):
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':max(top,min(bot,sy+k*d))}]});await page.wait_for_timeout(16)
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(250)
async def reach(page,loc,scroller,touch,h):
 """the element is on screen after the pilot scrolls (a real swipe on touch, the wheel with a mouse); returns its box"""
 for _ in range(40):
  bb=await loc.bounding_box()
  if bb and bb['y']>=0 and bb['y']+bb['height']<=h+1:return bb
  down=not bb or bb['y']+bb['height']>h
  if touch:await swipe(page,scroller,down)
  else:
   sb=await page.locator(scroller).first.bounding_box();await page.mouse.move(sb['x']+sb['width']/2,max(sb['y'],0)+min(max(sb['height'],40)-10,200));await page.mouse.wheel(0,260 if down else -260);await page.wait_for_timeout(150)
 raise AssertionError('not reachable by scrolling: '+(await loc.inner_text())[:60]+' '+str(await loc.bounding_box())+' scroller '+scroller)
async def press(page,loc,touch):
 if touch:await loc.tap()
 else:
  await loc.focus();await page.keyboard.press('Enter')   # keyboard first on a computer: the button takes Enter
async def main():
 import os
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE,env={**os.environ})
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def open_page(w,h,mobile,fixture):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_HUB_STATIC=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},showAlert(m,c){c&&c();},showConfirm(m,c){c&&c(true);},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},platform:'tdesktop',colorScheme:'dark',themeParams:{},viewportHeight:'''+str(h)+''',viewportStableHeight:'''+str(h)+''',safeAreaInset:{top:0,bottom:0,left:0,right:0},contentSafeAreaInset:{top:0,bottom:0,left:0,right:0}}};''')
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
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof ConquestTownUI!=="undefined"&&typeof ConquestTown!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.evaluate('document.querySelector(\'[data-act="conquest"]\').click()')
    return ctx,page,errors
   async def inspect():
    c=await browser.new_context();resp=await c.request.post(base+'/inspect',data={});st=(await resp.json())['state'];await c.close();return st
   for w,h,mobile in SIZES:
    r={}
    # ---- 1. decision 4: the welcome-back kits on the hub ----
    ctx,page,errors=await open_page(w,h,mobile,{'welcome':True,'baseFunds':True})
    await page.wait_for_selector('.cq-hub .cq-hub-streak',timeout=60000)
    st=await inspect();assert st['stk'].get('nw',{}).get('wb')==1 and st['stk']['n']==1 and st['inv']['it']['repair']==3,('the Worker granted the welcome-back kit',st.get('stk'),st.get('inv'))
    card=page.locator('.cq-hub-card',has=page.locator('.cq-hub-streak'));new=card.locator('.cq-hub-streak-new.cq-welcome')
    await reach(page,new,'.cq-hub-scroll',mobile,h);nt=await new.inner_text();lt=await card.locator('.cq-hub-streak').inner_text()
    assert 'WELCOME BACK · DAY 1 · +1 REPAIR KIT' in nt,nt;assert 'STREAK 1 DAY · TODAY ✓ · WELCOME BACK · DAY 3: SCANNER CHARGE' in lt,lt
    bb=await new.bounding_box();assert bb['x']>=0 and bb['x']+bb['width']<=w+1,('the line fits the width',bb)
    await page.screenshot(path=str(OUT/f'welcome-back-{w}x{h}.png'));r['welcome']=nt;assert not errors,errors[:3];await close_ctx(ctx)
    # ---- 2. decision 3: the coach's step 4, close the first wall ring before CC4 ----
    ctx,page,errors=await open_page(w,h,mobile,{'coachRing':True,'baseFunds':True})
    await page.wait_for_selector('.cq-hub .cq-hub-act',timeout=60000);mb=page.locator('.cq-hub-act',has_text='MY BASE').first;await reach(page,mb,'.cq-hub-scroll',mobile,h);await press(page,mb,mobile)
    await page.wait_for_function('typeof ConquestPlotView!=="undefined"&&ConquestPlotView.isOpen()&&ConquestPlotView.state&&ConquestPlotView.state.coachStep',timeout=240000)
    g=await page.evaluate('(()=>{const g=ConquestPlotView.state.coachStep;return {id:g.id,k:g.k,n:g.n,tab:g.tab,gap:g.gap,text:g.text};})()')
    assert g['id']=='ring' and g['k']==4 and g['tab']=='walls' and g['gap'],g
    # the map pill (every tab): STEP 4 OF n · CLOSE YOUR WALL RING · open WALLS; tapping it opens WALLS
    pill=page.locator('.cq-plot-coach');await page.wait_for_function("(()=>{const c=document.querySelector('.cq-plot-coach');return c&&!c.hidden&&/STEP 4 OF/.test(c.textContent);})()",timeout=30000)
    pt=await pill.inner_text();pb=await pill.bounding_box();assert 'CLOSE YOUR WALL RING' in pt and pb and pb['x']>=0 and pb['x']+pb['width']<=w+1 and pb['y']>=0 and pb['y']+pb['height']<=h+1,(pt,pb)
    await page.screenshot(path=str(OUT/f'coach-ring-pill-{w}x{h}.png'));await press(page,pill,mobile)
    await page.wait_for_function("ConquestPlotView.state.mode==='walls'",timeout=20000)
    await page.wait_for_function("(()=>{const c=document.querySelector('.cq-plot-coach');return c&&!c.hidden&&/CLOSE THE RING/.test(c.textContent);})()",timeout=20000)
    pt=await pill.inner_text();pb=await pill.bounding_box();assert pb and pb['x']>=0 and pb['x']+pb['width']<=w+1 and pb['y']>=0 and pb['y']+pb['height']<=h+1,(pt,pb)
    mk=await page.evaluate('(()=>{const X=ConquestPlotView.state;return X.R?X.R.g.holo.children.length:-1;})()');assert mk!=0,('the red marker is drawn',mk)
    await page.screenshot(path=str(OUT/f'coach-ring-{w}x{h}.png'));r['pill']=pt.replace('\n',' ')
    # the HOME tab's card: STEP 4 OF n, the step in full, GO TO WALLS (reached by scrolling the sheet)
    hm=page.locator('.cq-plot-tabs button',has_text='HOME').first;await press(page,hm,mobile);cc=page.locator('.cq-plot-coachcard');await cc.wait_for(timeout=20000)
    ct=await cc.inner_text();assert 'STEP 4 OF' in ct and 'CLOSE YOUR WALL RING before CC4' in ct,ct
    go=cc.locator('button',has_text='GO TO WALLS');await reach(page,go,'.cq-plot-sheet',mobile,h);await page.screenshot(path=str(OUT/f'coach-ring-card-{w}x{h}.png'));await press(page,go,mobile)
    await page.wait_for_function("ConquestPlotView.state.mode==='walls'",timeout=20000)
    # SUGGEST A RING drafts the closing order (an inner and an outer ring), the pilot sees it and confirms it
    sg=page.locator('.cq-plot-suggest-btn');await reach(page,sg,'.cq-plot-sheet',mobile,h);await press(page,sg,mobile)
    await page.wait_for_function('ConquestPlotView.state.draft.length>=1',timeout=20000);nd=await page.evaluate('ConquestPlotView.state.draft.length');r['suggest']=str(nd)+' rings drafted'
    cf=page.locator('button',has_text='CONFIRM WALLS').first;await reach(page,cf,'.cq-plot-sheet',mobile,h);await page.screenshot(path=str(OUT/f'coach-ring-suggest-{w}x{h}.png'));await press(page,cf,mobile)
    await page.wait_for_function("(()=>{const p=Conquest.view.authority.state.plot;return p&&ConquestTown.ringOf(p).closed;})()",timeout=30000)
    await page.wait_for_function("(()=>{const g=ConquestPlotView.state.coachStep;return g&&g.id!=='ring';})()",timeout=20000)
    nx=await page.evaluate('ConquestPlotView.state.coachStep.id');st=await inspect()
    from_worker=await page.evaluate('(p)=>ConquestTown.ringOf(p).closed',st['plot']);assert from_worker and nx=='reactor',('the Worker\'s town is closed and the coach moves on',nx)
    r['ring']='closed · next '+nx;assert not errors,errors[:3];await close_ctx(ctx)
    results[f'{w}x{h}']=r;print(w,h,json.dumps(r),flush=True)
   await browser.close()
 finally:
  server.terminate();await server.wait()
 (OUT/'town-proposals-ui.json').write_text(json.dumps(results,indent=1)+'\n');print('PASS Session 7T-P screens (the coach ring step, the welcome-back kits) at',', '.join(results))
asyncio.run(main())
