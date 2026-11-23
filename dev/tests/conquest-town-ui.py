"""Session 7T Living Town screens in the shipped client against the real Worker on a disposable local DB (owner brief
docs/conquest/audit/SESSION_07T_BRIEF.md): the hub's town card (RAIDED WHILE AWAY · HELD / BREACHED · REPLAY · REPAIR ALL, RAID
INCOMING · DEFEND IN PERSON), the Strike Beacon card, the streak line, the replay in the town, REPAIR, the live defense (the town view
drives the tank, the Worker steps the raid from its inputs; FIRE; LEAVE), the 60-second last chance, the Hangar gear picker and the alert
switches, at 390x844, 390x700, 320x568 (touch: a real swipe reaches the last button) and 1366x768, 1920x1080 (mouse and keyboard). Every
screen fits or scrolls. Pictures: docs/conquest/session7t."""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session7t';OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(390,844,True),(390,700,True),(320,568,True),(1366,768,False),(1920,1080,False)]
if '--quick' in sys.argv:SIZES=[(390,844,True),(1366,768,False)]
if '--size' in sys.argv:SIZES=[x for x in SIZES if f'{x[0]}x{x[1]}'==sys.argv[sys.argv.index('--size')+1]]
async def close_ctx(ctx):
 for pg in ctx.pages:
  try:await pg.unroute_all(behavior='ignoreErrors')
  except Exception:pass
 await ctx.close()
async def swipe(page,sel,up=True):   # a real finger (as conquest-plot-ui.py): touchstart, 12 small moves 16 ms apart, touchend, through the app's touch guard
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
 info=await page.evaluate('(s)=>{const e=document.querySelector(s);return e?{top:e.scrollTop,h:e.scrollHeight,c:e.clientHeight,ov:getComputedStyle(e).overflowY,box:e.getBoundingClientRect().toJSON()}:null}',scroller)
 raise AssertionError('not reachable by scrolling: '+(await loc.inner_text())[:40]+' '+str(await loc.bounding_box())+' scroller '+scroller+' '+json.dumps(info))
async def main():
 # between two Meteor Strikes (every 2 h on the even UTC hour, telegraphed 5 min before, open 20 min): 25 min after an impact the next
 # telegraph is 90 min away, so the whole run can call the Strike Beacon; the server and the page shift their clocks the same way
 import os,time;now=int(time.time()*1000);E=7200000;want=(now//E+1)*E+25*60000;SHIFT=want-now
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE,env={**os.environ,'CQ_CLOCK_SHIFT':str(SHIFT)})
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def open_page(w,h,mobile,fixture):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('const __dn=Date.now;Date.now=()=>__dn()+'+str(SHIFT)+';');
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
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof ConquestTownUI!=="undefined"&&typeof ConquestRaid!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.evaluate('document.querySelector(\'[data-act="conquest"]\').click()')
    return ctx,page,errors
   async def inspect():
    resp=await (await browser.new_context()).request.post(base+'/inspect',data={});return (await resp.json())['state']
   FIX={'baseFunds':True,'battalion':{'n':4,'hangar':2,'gear':'epic'},'town':True}
   for w,h,mobile in SIZES:
    r={}
    # ---- 1. the hub: the town card (raided while away + raid incoming), the streak line, the Beacon card ----
    ctx,page,errors=await open_page(w,h,mobile,FIX)
    await page.wait_for_selector('.cq-hub .cq-town',timeout=60000);card=page.locator('.cq-hub-card',has=page.locator('.cq-town'))
    txt=await card.inner_text();assert 'RAIDED WHILE AWAY' in txt and 'RAID INCOMING · LANDS IN' in txt and 'RAID LEVEL' in txt,txt[:600]
    for label in ['DEFEND IN PERSON','REPLAY','OK']:await reach(page,card.locator('button',has_text=label).first,'.cq-hub-scroll',mobile,h)
    if 'REPAIR ALL' in txt:await reach(page,card.locator('button',has_text='REPAIR ALL'),'.cq-hub-scroll',mobile,h)
    ev=page.locator('.cq-hub-card',has=page.locator('.cq-hub-streak'));st=await ev.inner_text();assert 'STREAK 3 DAYS · TODAY' in st and 'DAY 3 · +1 SCANNER CHARGE' in st,st[:400]
    phase=await page.evaluate('ConquestCombat.meteorStrike(Date.now()).phase')
    if phase=='idle':
     call=ev.locator('button',has_text='CALL THE STRIKE');await reach(page,call,'.cq-hub-scroll',mobile,h);await page.screenshot(path=str(OUT/f'hub-town-{w}x{h}.png'))
     await call.click();await page.wait_for_selector('.cq-beacon-on',timeout=20000);bt=await page.locator('.cq-beacon-on').inner_text();assert 'STRIKE BEACON ·' in bt and 'LEFT' in bt,bt;r['beacon']=bt.split('\n')[0]
     s=await inspect();assert s['bcn']['until']-s['bcn']['at']==1200000,s.get('bcn')
    else:r['beacon']='strike '+phase+': the Beacon waits (not ready while a real strike is on)';await page.screenshot(path=str(OUT/f'hub-town-{w}x{h}.png'))
    r['hub']=txt.split('\n')[0:3]
    # ---- 2. the Hangar gear picker (decision 8) ----
    hb=page.locator('button',has_text='OPEN HANGAR').first;await reach(page,hb,'.cq-hub-scroll',mobile,h);await hb.click()
    await page.wait_for_selector('.cq-dialog.cq-hangar .cq-bat-card',timeout=30000);g=page.locator('.cq-hangar .cq-bat-gearbtn').first
    await reach(page,g,'.cq-dialog.cq-hangar',mobile,h);await g.click();await page.wait_for_selector('.cq-bat-gear-pick .cq-gear-item',timeout=10000)
    pick=page.locator('.cq-bat-gear-pick .cq-gear-pick:not([disabled])').first;await reach(page,pick,'.cq-dialog.cq-hangar',mobile,h)
    gtxt=await page.locator('.cq-bat-gear-pick').inner_text();assert 'WEAPON' in gtxt and 'CHASSIS' in gtxt and 'THEN ·' in gtxt and 'DMG/S' in gtxt,gtxt[:400]
    await page.screenshot(path=str(OUT/f'gear-picker-{w}x{h}.png'));await pick.click()
    await page.wait_for_function('document.querySelector(".cq-hangar .cq-bat-gearbtn.cq-on")',timeout=20000);s=await inspect()
    assert any(p.get('pin') for p in s['bat']['p']),'the pick is on the account record (server-decided)';r['gear']='picked'
    await close_ctx(ctx)
    # ---- 3. the replay in the town, then REPAIR ALL (from the hub's REPLAY) ----
    ctx,page,errors=await open_page(w,h,mobile,FIX)
    await page.wait_for_selector('.cq-hub .cq-town',timeout=60000);rb=page.locator('.cq-town button',has_text='REPLAY').first;await reach(page,rb,'.cq-hub-scroll',mobile,h);await rb.click()
    await page.wait_for_function('ConquestPlotView.isOpen()&&ConquestPlotView.state&&ConquestPlotView.state.drill&&ConquestPlotView.state.drill.r.frames.length>10',timeout=240000)
    await page.wait_for_timeout(1500);fi=await page.evaluate('ConquestPlotView.state.drill.fi');assert fi>0,'the replay plays'
    await page.screenshot(path=str(OUT/f'replay-{w}x{h}.png'));r['replay']='frames '+str(await page.evaluate('ConquestPlotView.state.drill.r.frames.length'))
    await page.evaluate('ConquestPlotView.state.drill.t=1e9');await page.wait_for_function('!ConquestPlotView.state.drill',timeout=20000)
    rep=await page.locator('.cq-plot-report').inner_text();assert 'RAIDED ·' in rep,rep[:300]
    st0=await inspect()
    if st0['plot'].get('dmg'):
     await page.evaluate("ConquestPlotView.state&&(ConquestPlotView.state.mode='home');ConquestPlotView.render()")
     rp=page.locator('.cq-plot button',has_text='REPAIR ALL').first;await rp.wait_for(timeout=10000);await reach(page,rp,'.cq-plot-sheet',mobile,h);await page.screenshot(path=str(OUT/f'repair-{w}x{h}.png'));await rp.click()
     await page.wait_for_function('(()=>{const s=Conquest&&ConquestPlotView.state.ctx.view.authority.state;return s&&s.plot&&(s.plot.job||!s.plot.dmg||!Object.keys(s.plot.dmg).length);})()',timeout=20000);r['repair']='started'
    await close_ctx(ctx)
    # ---- 4. the live defense (decision 6): DEFEND IN PERSON from the hub, drive and fire, then leave ----
    ctx,page,errors=await open_page(w,h,mobile,FIX)
    await page.wait_for_selector('.cq-hub .cq-town',timeout=60000);db=page.locator('.cq-town button',has_text='DEFEND IN PERSON').first;await reach(page,db,'.cq-hub-scroll',mobile,h);await db.click()
    await page.wait_for_selector('.cq-plot .cq-town-hud',timeout=240000);await page.wait_for_selector('.cq-plot .cq-town-fire',timeout=10000)
    fire=page.locator('.cq-town-fire');fb=await fire.bounding_box();assert fb and fb['y']+fb['height']<=h and fb['x']+fb['width']<=w,('FIRE on screen',fb)
    hud=page.locator('.cq-town-hud');hb2=await hud.bounding_box();assert hb2['y']>=0 and hb2['y']+hb2['height']<=h*0.6,('HUD on top, leaves the view',hb2)
    n0=(await inspect())['td'].get('n',0)
    if mobile:
     await fire.dispatch_event('pointerdown');await page.wait_for_timeout(2500);await fire.dispatch_event('pointerup')
    else:
     await page.keyboard.down('w');await page.keyboard.down(' ');await page.wait_for_timeout(2500);await page.keyboard.up(' ');await page.keyboard.up('w')
    await page.wait_for_function('(()=>{const s=ConquestPlotView.state.ctx.view.authority.state;return s&&s.td&&s.td.st&&s.td.n>0;})()',timeout=20000)
    s=await inspect();assert s['td']['active'] and s['td']['n']>n0,('the Worker stepped the raid from the inputs',s['td'].get('n'))
    await page.screenshot(path=str(OUT/f'live-defense-{w}x{h}.png'));r['live']='steps '+str(s['td']['n'])
    lv=page.locator('.cq-town-hud button',has_text='LEAVE THE FIGHT');await lv.click()
    await page.wait_for_function('!document.querySelector(".cq-town-hud")',timeout=60000);s=await inspect();assert not s['td']['active'] and s['td'].get('o') in ('held','breached','fallen'),s.get('td')
    r['live']+=' · '+s['td']['o']
    await close_ctx(ctx)
    # ---- 5. the 60-second last chance, in the world ----
    ctx,page,errors=await open_page(w,h,mobile,{**FIX,'town':{'lastChance':True,'lcMs':240000}})
    await page.wait_for_selector('.cq-hub .cq-town-lc',timeout=60000);lt=await page.locator('.cq-town-lc').first.inner_text();assert 'RAID INCOMING · DEFEND?' in lt,lt
    en=page.locator('.cq-hub-actions button',has_text='ENTER CONQUEST');await en.click()
    await page.wait_for_selector('.cq-town-lastchance',timeout=240000);d=page.locator('.cq-town-lastchance');bb=await d.bounding_box();assert bb['y']>=0 and bb['y']+bb['height']<=h+1 and bb['x']>=0 and bb['x']+bb['width']<=w+1,('the last chance fits',bb)
    for label in ['DEFEND · ONE ATTEMPT','LET THE TOWN FIGHT']:b2=await d.locator('button',has_text=label).bounding_box();assert b2 and b2['y']+b2['height']<=h,label
    await page.screenshot(path=str(OUT/f'last-chance-{w}x{h}.png'));await d.locator('button',has_text='LET THE TOWN FIGHT').click();await page.wait_for_timeout(500)
    assert not await page.locator('.cq-town-lastchance').count(),'dismissed';r['lastChance']='fits'
    # ---- 6. the alert switches (decision 9), on the War Map's alerts card ----
    await page.evaluate("ConquestWarMap.want('alerts');ConquestWarMap.onPending&&ConquestWarMap.onPending()")
    ok=await page.evaluate("(async()=>{for(let i=0;i<80;i++){if(document.querySelector('.cq-alert-types'))return true;await new Promise(r=>setTimeout(r,250));}return false;})()")
    if not ok:
     await page.evaluate("document.querySelector('.cq-world .cq-war-btn, #cq-war-btn')?.click()");await page.wait_for_timeout(1500)
    if await page.locator('.cq-alert-types').count():
     sw=page.locator('.cq-alert-type',has_text='Meteor Strike').first;await reach(page,sw,'.cq-warmap',mobile,h);await sw.click()
     await page.wait_for_function("document.querySelector('.cq-alert-type[aria-pressed=\"false\"]')",timeout=20000);s=await inspect();assert s['al'].get('sw',{}).get('meteor')==0,s.get('al');r['switches']='meteor off'
     await page.screenshot(path=str(OUT/f'alert-switches-{w}x{h}.png'))
    else:r['switches']='alerts card not reached from the world in this run'
    assert not errors,errors[:3];await close_ctx(ctx)
    results[f'{w}x{h}']=r;print(w,h,json.dumps(r),flush=True)
   await browser.close()
 finally:
  server.terminate();await server.wait()
 (OUT/'town-ui.json').write_text(json.dumps(results,indent=1)+'\n');print('PASS Session 7T town screens at',', '.join(results))
asyncio.run(main())
