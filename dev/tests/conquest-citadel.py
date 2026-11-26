"""Session 7B Citadel Act I screens in the shipped client against the real Worker on a disposable local DB (owner brief
docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md): the War Map's campaign card (CITADEL I · BREACH POINT, FRONT held, FORCE / DEFENSE
beside their bands, the siege prep rows, LAUNCH), the launch from the hub (into the world, the tank moved to the siege camp by the
Worker), the reveal (full on the first attempt; SKIP by a tap, or on a computer by Escape and by a mouse click; the fight waits while it plays), the
assault HUD (the phase, the objective, the clock, the LDF airstrike button from the anti-air prep: a tap or the X key), the result card
of the first clear (the Worker's own settlement: the 25,000 bounty line, production, trophy, Retaliation, the next tier) and the Throne
Run section afterwards (this week's Gambits, the full chest, RUN, BOARD). At 390x844, 390x700, 320x568 (touch: a real swipe reaches
what is below) and 1366x768, 1920x1080 (the mouse and the keyboard by turns: each button by a real click or by focus + Enter, the airstrike by a click
or the X key). Every screen fits or scrolls. Pictures: docs/conquest/session7b."""
import asyncio,json,os,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session7b';OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(390,844,True),(390,700,True),(320,568,True),(1366,768,False),(1920,1080,False)]
if '--quick' in sys.argv:SIZES=[(390,844,True),(1366,768,False)]
if '--size' in sys.argv:SIZES=[x for x in SIZES if f'{x[0]}x{x[1]}'==sys.argv[sys.argv.index('--size')+1]]
async def close_ctx(ctx):
 for pg in ctx.pages:
  try:await pg.unroute_all(behavior='ignoreErrors')
  except Exception:pass
 await ctx.close()
async def swipe(page,sel,up=True):   # a real finger: touchstart, 12 small moves 16 ms apart, touchend
 box=await page.locator(sel).first.bounding_box();cdp=await page.context.new_cdp_session(page);vw=page.viewport_size;sx=min(max(box['x']+box['width']/2,20),vw['width']-20)
 top=max(box['y'],0)+20;bot=min(box['y']+box['height'],vw['height'])-20;sy=bot-10 if up else top+10;d=-18 if up else 18
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
 for k in range(1,13):
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':max(top,min(bot,sy+k*d))}]});await page.wait_for_timeout(16)
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(250)
async def reach(page,loc,scroller,touch,h):
 """the element on screen inside its scroller after the pilot scrolls (a real swipe on touch, the wheel with a mouse)"""
 for _ in range(50):
  bb=await loc.bounding_box();sb=await page.locator(scroller).first.bounding_box()
  top=max(0,sb['y']) if sb else 0;bot=min(h,sb['y']+sb['height']) if sb else h
  if bb and bb['y']>=top-1 and bb['y']+bb['height']<=bot+1:return bb
  down=not bb or bb['y']+bb['height']>bot
  if touch:await swipe(page,scroller,down)
  else:
   await page.mouse.move(sb['x']+sb['width']/2,max(sb['y'],0)+min(max(sb['height'],40)-10,200));await page.mouse.wheel(0,260 if down else -260);await page.wait_for_timeout(150)
 raise AssertionError('not reachable by scrolling: '+(await loc.inner_text())[:60]+' '+str(await loc.bounding_box()))
INPUT={'mouse':0,'keys':0}
async def press(page,loc,touch):
 if touch:await loc.tap();return
 # a computer: the mouse and the keyboard by turns (each desktop size uses both): a real click (Playwright moves the pointer onto the
 # button and refuses if anything covers it), then focus + Enter
 if INPUT['mouse']<=INPUT['keys']:await loc.click();INPUT['mouse']+=1
 else:await loc.focus();await page.keyboard.press('Enter');INPUT['keys']+=1
async def main():
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
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_HUB_STATIC=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
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
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof ConquestCitadel!=="undefined"&&typeof ConquestCitadelUI!=="undefined"&&typeof ConquestCutscene!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.evaluate('document.querySelector(\'[data-act="conquest"]\').click()')
    return ctx,page,errors
   async def inspect():
    c=await browser.new_context();resp=await c.request.post(base+'/inspect',data={});st=(await resp.json())['state'];await c.close();return st
   async def post(path,data={}):
    c=await browser.new_context();resp=await c.request.post(base+path,data=data);j=await resp.json();await c.close();return j
   paid=False   # Session 7C STEP 1: every size flies the same account (tg 8301) on a fresh Conquest record (a server reset of the record):
   # only the first clear pays the 25,000 bounty; on the later sizes the account already holds it and the card must say so, with no number
   for w,h,mobile in SIZES:
    r={};INPUT.update(mouse=0,keys=0)
    ctx,page,errors=await open_page(w,h,mobile,{'citadel':{'prep':['aa']},'battalion':{'hangar':5,'n':10,'rank':5},'baseFunds':True})
    # ---- 1. the campaign card on the War Map (from the hub) ----
    await page.wait_for_selector('.cq-hub .cq-hub-war',timeout=60000);wb=page.locator('.cq-hub-war').first;await reach(page,wb,'.cq-hub-scroll',mobile,h);await press(page,wb,mobile)
    card=page.locator('.cq-warmap .cq-cit-card');await card.wait_for(timeout=30000)
    ct=await card.inner_text();assert 'NEXT: CITADEL I · BREACH POINT' in ct and 'FRONT · 2 / 2' in ct and 'FORCE ·' in ct and 'DEFENSE ·' in ct,ct
    assert 'AIRSTRIKE READY' in ct and 'CUT THE SUPPLY CONVOY' in ct and 'SUPPRESS THE PORTAL' in ct,('the three siege prep rows',ct)
    assert '+25,000 airdrop points (once per account, outside the daily cap)' in ct,ct
    go=card.locator('.cq-cit-launch');bb=await reach(page,go,'.cq-dialog.cq-warmap',mobile,h);assert bb['x']>=0 and bb['x']+bb['width']<=w+1,('LAUNCH fits the width',bb)
    assert await go.is_enabled(),'LAUNCH enabled with FRONT held';await page.screenshot(path=str(OUT/f'campaign-card-{w}x{h}.png'));r['card']=ct.split('\n')[0]
    # ---- 2. launch: into the world, the Worker moves the tank to the siege camp; the reveal plays (full, the first attempt) ----
    await press(page,go,mobile)
    # the reveal starts once the world has streamed in (js/conquest/app.js afterEnterStep waits for view.pending 0): software GL at
    # 1920x1080 on a busy machine takes minutes to stream it, so the reveal's own wait starts there
    await page.wait_for_function('Conquest.view&&Conquest.view.authority&&Conquest.view.authority.connected&&!Conquest.view.pending',timeout=420000)
    cut=page.locator('.cq-cutscene');await cut.wait_for(timeout=60000)
    st=await inspect();assert st['mission']=='citadel-1' and st['citRun']['tier']==1 and st['citRun']['prep']['aa']==1,('the Worker started the assault with the prep',st.get('mission'),st.get('citRun'))
    cam=st['position'];stage=await page.evaluate('ConquestCitadel.stageAt()');assert abs(cam['x']-stage['x'])<14 and abs(cam['z']-stage['z'])<14,('at the siege camp',cam,stage)
    ctext=await cut.inner_text();assert 'CITADEL I · BREACH POINT' in ctext and 'SKIP' in ctext,ctext
    shots=await page.evaluate('ConquestCutscene.SCRIPTS[1]().length');played=await cut.get_attribute('data-shots');assert shots==4 and played=='4',('the full reveal plays on the first attempt',shots,played)
    assert await page.evaluate('!!Conquest.view.battle?.cit&&Conquest.view.battle.cit.tier===1'),'the Citadel assault exists while the reveal plays'
    await page.wait_for_timeout(600);t0=await page.evaluate('Conquest.view.battle?.time||0');await page.wait_for_timeout(900);t1=await page.evaluate('Conquest.view.battle?.time||0')
    assert t1==t0 and await page.evaluate('Conquest.view.cinematic===true'),('the fight waits while the reveal plays',t0,t1)
    sk=page.locator('.cq-cut-skip');sb=await sk.bounding_box();assert sb and sb['y']>=0 and sb['x']+sb['width']<=w+1,('SKIP on screen',sb)
    await page.screenshot(path=str(OUT/f'reveal-{w}x{h}.png'))
    if mobile:await sk.tap()
    else:await page.keyboard.press('Escape');INPUT['keys']+=1   # a computer: Escape (the Throne Run's reveal below: a mouse click on SKIP)
    await page.wait_for_function('!document.querySelector(".cq-cutscene")&&Conquest.view.cinematic===false',timeout=10000)
    # ---- 3. the assault HUD; the LDF airstrike (anti-air prep) ----
    hud=page.locator('.cq-cit-hud');await hud.wait_for(timeout=20000);await page.wait_for_function('Conquest.view.battle&&Conquest.view.battle.time>0.5',timeout=30000)
    ht=await hud.inner_text();assert 'CITADEL I · BREACH' in ht and 'GATE GENERATORS 3 / 3' in ht,ht
    hb=await hud.bounding_box();assert hb['x']>=0 and hb['x']+hb['width']<=w+1 and hb['y']>=0,('the HUD fits',hb)
    air=page.locator('#cq-strike');await air.wait_for(state='visible',timeout=10000);ab=await air.bounding_box();assert ab and ab['y']+ab['height']<=h+1,('the airstrike button on screen',ab)
    await page.screenshot(path=str(OUT/f'assault-hud-{w}x{h}.png'))
    if mobile:await air.tap()
    elif w==1920:await air.click();INPUT['mouse']+=1   # the mouse at 1920x1080, the X key at 1366x768
    else:await page.keyboard.press('x');INPUT['keys']+=1
    await page.wait_for_function('Conquest.view.authority.state.battle.cit.air===0&&Conquest.view.authority.state.battle.cit.strikes.length+0>=0',timeout=20000)
    st=await inspect();assert st['battle']['cit']['air']==0,('the Worker spent the airstrike',st['battle']['cit'].get('air'))
    r['hud']=ht.replace('\n',' · ')
    # ---- 4. the first clear's result card (the Worker's own settlement) ----
    j=await post('/fixture-citadel-win');assert j['ok'],j
    res=page.locator('.cq-cit-result');await res.wait_for(timeout=60000);rt=await res.inner_text()
    assert 'FIRST CLEAR' in rt and 'CITADEL I · BREACH POINT BROKEN' in rt and 'Production +5%' in rt and 'Trophy: GATEWARDEN SKORVA' in rt and 'Retaliation I' in rt and 'CITADEL II · IRON RAIN' in rt,rt
    if not paid:assert '+25,000 airdrop bounty' in rt and 'already paid' not in rt,('the account is paid the bounty once: the card shows it',rt)
    else:assert 'already paid to this account' in rt and '25,000' not in rt,('the account already holds the bounty (a reset record): the card shows no number',rt)
    r['bounty']='paid +25,000' if not paid else 'already paid (reset record)';paid=True
    st=await inspect();assert st['cit']['t']==1 and st['cit']['fc'].get('1'),('the Worker settled the first clear',st.get('cit'))
    dlg=page.locator('.cq-result');back=dlg.locator('button',has_text='RETURN TO EXPLORATION');await reach(page,back,'.cq-result',mobile,h)
    await page.screenshot(path=str(OUT/f'first-clear-{w}x{h}.png'));r['result']=' · '.join(l for l in rt.split('\n') if l.strip())[:160]
    await press(page,back,mobile);await page.wait_for_function('!Conquest.view.battle&&!Conquest.view.authority.state.mission',timeout=30000)
    # ---- 5. Throne Run on the War Map (this week's Gambits, the full chest, RUN, BOARD) ----
    # in the world: the HUD's MAP, then WAR MAP · THE LIVING FRONT (the pilot's own way)
    mp=page.locator('.cq-world button',has_text='MAP').first;await mp.wait_for(timeout=20000);await press(page,mp,mobile)
    wo=page.locator('.cq-warmap-open');await wo.wait_for(timeout=20000);await reach(page,wo,'.cq-dialog.cq-map',mobile,h);await press(page,wo,mobile)
    th=page.locator('.cq-warmap .cq-cit-throne');await th.wait_for(timeout=30000);tt=await th.inner_text()
    assert 'THRONE RUN' in tt and 'FULL CHEST READY' in tt and 'RUN CITADEL I' in tt,tt
    gam=await page.evaluate('ConquestCitadel.gambitsOf(ConquestCitadel.weekOf(Date.now())).map(k=>ConquestCitadel.GAMBITS[k].name)');assert all(g in tt for g in gam),(gam,tt)
    nx=await page.locator('.cq-warmap .cq-cit-card').inner_text();assert 'NEXT: CITADEL II · IRON RAIN' in nx,nx
    # no wait between Citadel attacks (owner rule, Nov 25, 2026; Session 7R: no cooldown): right after the first clear the next tier's
    # LAUNCH is open (the old 7-day re-fortify lock is gone) and the Throne Run stays open beside it
    lk=page.locator('.cq-warmap .cq-cit-card .cq-cit-launch');lt=await lk.inner_text();assert 'RE-FORTIFIES' not in lt and 'LAUNCH THE ASSAULT · CITADEL II' in lt and await lk.is_enabled(),lt
    await reach(page,lk,'.cq-dialog.cq-warmap',mobile,h);await page.screenshot(path=str(OUT/f'next-tier-open-{w}x{h}.png'));r['next']=lt.strip()[:80]
    run=th.locator('.cq-cit-run').first;await reach(page,run,'.cq-dialog.cq-warmap',mobile,h);await page.screenshot(path=str(OUT/f'throne-run-{w}x{h}.png'))
    bd=th.locator('.cq-cit-board-btn').first;await press(page,bd,mobile);await page.locator('.cq-cit-board').wait_for(timeout=20000);bt=await page.locator('.cq-cit-board').inner_text();assert 'CLEAR TIMES' in bt,bt
    await page.screenshot(path=str(OUT/f'board-{w}x{h}.png'));r['throne']=' · '.join(l for l in tt.split('\n') if l.strip())[:160]
    # a loss: a Throne Run of tier I runs out of its 8-minute siege window: THE ASSAULT FAILED, nothing taken (a Throne Run carries no prep)
    await press(page,page.locator('.cq-cit-board button',has_text='CLOSE').first,mobile)
    rn=page.locator('.cq-warmap .cq-cit-throne .cq-cit-run').first;await reach(page,rn,'.cq-dialog.cq-warmap',mobile,h);await press(page,rn,mobile)
    await page.locator('.cq-cutscene').wait_for(timeout=120000)
    short=await page.locator('.cq-cutscene').get_attribute('data-shots');assert short==str(await page.evaluate('ConquestCutscene.shortOf(1).length')) and int(short)<4,('the short reveal after the first attempt',short)
    if mobile:await page.locator('.cq-cut-skip').tap()
    else:await page.locator('.cq-cut-skip').click();INPUT['mouse']+=1
    await page.wait_for_function('!document.querySelector(".cq-cutscene")&&Conquest.view.battle&&Conquest.view.battle.time>0.3',timeout=30000)
    j=await post('/fixture-citadel-lose');assert j['ok'],j   # the siege window runs out: the Worker's own defeat
    ls=page.locator('.cq-cit-result');await ls.wait_for(timeout=60000);lt2=await ls.inner_text()
    assert 'THE ASSAULT FAILED' in (await page.locator('.cq-result').inner_text()) and 'CITADEL I' in lt2,lt2
    assert 'the siege window closed' in lt2.lower(),('the loss card says why',lt2)
    st=await inspect();assert (st.get('settlement') or {}).get('kind')=='citadel-loss' and st['settlement'].get('why')=='The siege window closed',('the Worker settled the loss with its cause',st.get('settlement'))
    assert st['cit']['lost']>=1 and st['cit']['t']==1 and st['hp']>0,('a loss takes nothing else: the tier stays cleared, the tank comes back',st.get('cit'),st.get('hp'))
    await page.screenshot(path=str(OUT/f'loss-{w}x{h}.png'));r['loss']=' · '.join(l for l in lt2.split('\n') if l.strip())[:120]
    if not mobile:assert INPUT['mouse']>=4 and INPUT['keys']>=4,('a computer used both the mouse and the keyboard',INPUT)
    r['inputs']='touch' if mobile else f"mouse {INPUT['mouse']}, keyboard {INPUT['keys']}"
    assert not errors,errors[:3];await close_ctx(ctx);results[f'{w}x{h}']=r;print('PASS',w,h,json.dumps(r)[:300],flush=True)
   await browser.close()
  try:prev=json.loads((OUT/'citadel-ui.json').read_text()).get('sizes',{})   # one size at a time (--size) keeps the others' readings
  except Exception:prev={}
  (OUT/'citadel-ui.json').write_text(json.dumps({'scope':'shipped client + local Worker, headless Chromium (SwiftShader): not a phone','sizes':{**prev,**results}},indent=1))
 finally:server.terminate();await server.wait()
asyncio.run(main())
