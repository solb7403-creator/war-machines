"""Session 7C (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md) in the shipped client against the real Worker on a disposable local
DB: the hub's AIRDROP STANDING card (the live rank in the points pool, the points to the next mark, today's points against the 50,000
cap, the trust line, no token promise), the WAR EFFORT lines on the WARFRONT card (this week's bar, last week won with High Morale, the
top squad's banner), the Hive Titan's slot line; the WEEKLY BOARDS screen from the standing card (six boards, the bands, the field, the
top list, the pilot's place; tabs by tap, click or keyboard) and the share card of a finish inside a band; then in the world, a Titan
slot: the Meteor Strike won, the strike result's THE HIVE TITAN RISES, the hunt's HUD (the phase, the hull bar with its marks, the
4-minute clock), the kill's result card (the Worker's own settlement: 1,600 base points and the loot, once this slot: a second hunt in
the slot is refused) and the War Effort rewards the record paid at the session open. At 390x844, 390x700, 320x568 (touch: a real swipe
reaches what is below) and 1366x768, 1920x1080 (the mouse and the keyboard by turns). Every screen fits or scrolls.
Each size runs its own local server with its clock shifted into the next Titan slot's open window (the page shifts its clock the same
way). Scenario placements only (dev/tests/conquest-server.mjs `s7c`): the pool, 40 pilots a board, last week's War Effort, the tank at
the crater; the strike and the Titan are won by `/fixture-op-clear` and `/fixture-titan-win` (the fight itself: conquest-titan.mjs).
Software GL: relative look only. Pictures: docs/conquest/session7c."""
import asyncio,base64,json,os,pathlib,shutil,sys,time
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session7c';OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(390,844,True),(390,700,True),(320,568,True),(1366,768,False),(1920,1080,False)]
if '--quick' in sys.argv:SIZES=[(390,844,True),(1366,768,False)]
if '--size' in sys.argv:SIZES=[x for x in SIZES if f'{x[0]}x{x[1]}'==sys.argv[sys.argv.index('--size')+1]]
TITAN_EVERY=6*7200000   # every 6th Meteor Strike slot (2 h apart): 00:00 and 12:00 UTC
STALL_S,CAP_S=45,600   # the world-load wait follows the stream (as conquest-session6-loot.py): it fails when loading stops progressing
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
async def world_loaded(page,size):
 sig='(()=>{const v=globalThis.Conquest?.view;if(!v)return null;return {c:!!v.authority?.connected,p:v.pending,b:v.builds|0,n:v.chunks?.size|0,f:v.floraJobs?.length|0,h:v.horizonKey??null,j:!!(v.chunkJob||v.horizonJob)};})()'
 loop=asyncio.get_running_loop();t0=loop.time();last=None;moved=t0;seen=[]
 while True:
  r=await page.evaluate(sig);now=loop.time()
  if r and r['c'] and r['p']==0:return round(now-t0,1)
  key=json.dumps(r,sort_keys=True)
  if key!=last:last=key;moved=now;seen.append((round(now-t0,1),r));seen=seen[-6:]
  assert now-moved<STALL_S,f'{size}: the world stopped loading: no progress for {STALL_S} s after {round(now-t0)} s (last readings {seen})'
  assert now-t0<CAP_S,f'{size}: the world still loading after {CAP_S} s, still progressing (last readings {seen})'
  await asyncio.sleep(1)
def fits(bb,w,h):return bb and bb['x']>=-1 and bb['x']+bb['width']<=w+1 and bb['y']>=-1
async def run(browser,w,h,mobile,shot_saved):
 real=int(time.time()*1000);want=(real//TITAN_EVERY+1)*TITAN_EVERY+45000;SHIFT=want-real   # 45 s into the next Titan slot's strike window
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE,env={**os.environ,'CQ_CLOCK_SHIFT':str(SHIFT)})
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);r={};INPUT.update(mouse=0,keys=0)
 try:
  async def post(path,data={}):
   c=await browser.new_context();resp=await c.request.post(base+path,data=data);assert resp.ok,(path,resp.status,(await resp.text())[:300]);j=await resp.json();await c.close();return j
  async def inspect():return (await post('/inspect'))['state']
  await post('/fixture',{'s7c':True,'noEnemies':True,'baseFunds':True})
  ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('const __dn=Date.now;Date.now=()=>__dn()+'+str(SHIFT)+';try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}'+'''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_HUB_STATIC=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
  async def route(rq):
   u=urlparse(rq.request.url);f=ROOT/u.path.lstrip('/')
   if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
    body=json.loads(rq.request.post_data or '{}')
    for attempt in range(2):
     try:resp=await page.request.post(base+u.path,data=body);return await rq.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     except Exception:
      if attempt:return await rq.fulfill(status=503,body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
      await asyncio.sleep(0.2)
   if u.path.startswith('/api/'):return await rq.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   if u.netloc=='lunar.test' and f.is_file():return await rq.fulfill(path=str(f))
   if u.netloc=='telegram.org':return await rq.fulfill(body='',content_type='application/javascript')
   await rq.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof ConquestStanding!=="undefined"&&typeof ConquestBoardsUI!=="undefined"&&typeof ConquestTitanUI!=="undefined"&&typeof ConquestWarEffort!=="undefined"')
  await post('/fixture',{'s7c':True,'noEnemies':True,'baseFunds':True})   # again, after the page's own first sync
  await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.evaluate('document.querySelector(\'[data-act="conquest"]\').click()')
  # ---- 1. the hub: the standing card, the War Effort lines, the Titan's slot line (live from the Worker) ----
  await page.wait_for_function('(document.querySelector(".cq-hub-standing")?.innerText||"").includes("#842 IN THE POINTS POOL")',timeout=60000)
  await page.wait_for_function('(document.querySelector(".cq-we-last")?.innerText||"").includes("LAST WEEK WON")',timeout=60000)
  sc=page.locator('.cq-hub-standing');st_text=await sc.inner_text()
  for want_ in ['AIRDROP STANDING','#842 IN THE POINTS POOL','pts to #800','TODAY 12,840 / 50,000','VERIFIED PLAY 100% · LAST 30 DAYS','No token amount is promised','WEEKLY BOARDS']:assert want_ in st_text,(want_,st_text)
  assert 'TOKEN' not in st_text.replace('No token amount is promised','').upper(),('the card promises no tokens',st_text)
  bar=await page.evaluate('(()=>{const b=document.querySelector(".cq-hub-standing .cq-standing-day");return b?[b.value,b.max]:null;})()');assert bar==[12840,50000],('today against the cap',bar)
  assert fits(await sc.bounding_box(),w,h),'the standing card fits the width'
  await page.screenshot(path=str(OUT/f'hub-standing-{w}x{h}.png'));r['standing']=' · '.join(l for l in st_text.split('\n') if l.strip())[:150]
  we=page.locator('.cq-we-head');await reach(page,we,'.cq-hub-scroll',mobile,h);wtext=await page.locator('.cq-hub-card',has=page.locator('.cq-we-head')).inner_text()
  assert 'WAR EFFORT ·' in wtext and '31 PILOTS' in wtext and 'TIERS: I 100% · II 150% · III 200%' in wtext,wtext
  assert 'LAST WEEK WON (TIER II) · HIGH MORALE: +1 DEFENSE ON EVERY TERRITORY THIS WEEK' in wtext,wtext
  assert "THE BANNER OF BROWSERPILOT'S SQUAD FLIES AT THE MONUMENT THIS WEEK · YOUR SQUAD" in wtext,wtext
  await page.screenshot(path=str(OUT/f'hub-wareffort-{w}x{h}.png'));r['warEffort']=' · '.join(l for l in wtext.split('\n') if 'WAR EFFORT' in l or 'LAST WEEK' in l)[:150]
  tl=page.locator('.cq-hub-titan');await reach(page,tl,'.cq-hub-scroll',mobile,h);tt=await tl.inner_text()
  assert tt.startswith('☄ THE HIVE TITAN · ') and 'EXTRACT THE CORE, THEN FIGHT IT' in tt and 'LEFT' in tt,tt
  await page.screenshot(path=str(OUT/f'hub-titan-{w}x{h}.png'));r['titanLine']=tt
  st=await inspect();assert st['wep'].get('paid')==1 and st['wep'].get('sq')==1 and st.get('wet')==2 and (st['inv']['it'].get('scanner') or 0)>=1 and (st['inv'].get('fr',{}).get('u') or 0)>=1,('the record paid last week\'s War Effort at the session open (crate, tier II piece, squad fragment)',st.get('wep'),st.get('wet'),st['inv'])
  # ---- 2. WEEKLY BOARDS from the standing card; the share card ----
  bb=page.locator('.cq-standing-boards');await reach(page,bb,'.cq-hub-scroll',mobile,h);await press(page,bb,mobile)
  d=page.locator('.cq-boards');await d.wait_for(timeout=20000);await page.wait_for_function('!!document.querySelector(".cq-boards .cq-boards-row.me")',timeout=30000)
  tabs=await page.locator('.cq-boards-tab').all_inner_texts();assert len(tabs)==6,tabs
  bt=await d.inner_text()
  for want_ in ['TOP 10% (UP TO 100) · 1 SELENITE','TOP 1% (UP TO 10) · 1 MOONHEART','FIELD 40 PILOTS','BrowserPilot (YOU)','YOUR PLACE #3','TOP 10% · 1 SELENITE IF IT HOLDS AT THE RESET','Pilots under review sit out']:assert want_ in bt,(want_,bt[:600])
  ov=await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert ov,'no sideways scroll'
  await page.screenshot(path=str(OUT/f'boards-titan-{w}x{h}.png'));r['boards']=[t.strip() for t in tabs]
  names=await page.evaluate('(()=>{const o={};for(const b of document.querySelectorAll(".cq-boards-tab"))o[b.textContent]=1;return Object.keys(o);})()')
  async def tab(i):
   t=page.locator('.cq-boards-tab').nth(i);await reach(page,t,'.cq-boards',mobile,h);await press(page,t,mobile);await page.wait_for_function(f'document.querySelectorAll(".cq-boards-tab")[{i}].getAttribute("aria-selected")==="true"',timeout=10000)
   return await page.locator('.cq-boards-card').inner_text()
  ct=await tab(4)   # CAMPAIGN
  assert 'TOP 10% (UP TO 100) · 1,500 CP + 1 RARE FRAGMENT' in ct and 'YOUR PLACE #2' in ct and '1,500 CP + 1 RARE FRAGMENT IF IT HOLDS AT THE RESET' in ct,ct[:500]
  await page.screenshot(path=str(OUT/f'boards-campaign-{w}x{h}.png'))
  rt=await tab(2)   # RAID TIME-ATTACK: this week's course, the fastest first
  assert "THIS WEEK'S COURSE ·" in rt and 'YOUR PLACE #4' in rt and ':' in rt.split('YOUR PLACE #4 · ')[1][:8],rt[:500]
  t30=await tab(5)   # the Titan's 30-day board: #7 of 40 is outside its band (the top 1%, at most 3)
  assert 'TOP 1% (UP TO 3) · 2 MOONHEART' in t30 and 'YOUR PLACE #7' in t30 and 'IF IT HOLDS' not in t30.split('YOUR PLACE #7')[1],t30[:500]
  await page.screenshot(path=str(OUT/f'boards-titan30-{w}x{h}.png'))
  await tab(4)
  sh=page.locator('.cq-boards-share').first;await reach(page,sh,'.cq-boards',mobile,h);await press(page,sh,mobile)
  img=page.locator('.cq-boards-sharebox img');await img.wait_for(timeout=10000)
  dims=await img.evaluate('i=>new Promise(ok=>{const f=()=>ok([i.naturalWidth,i.naturalHeight]);if(i.complete&&i.naturalWidth)f();else i.onload=f;})');assert dims==[720,900],('the share card is 720x900',dims)
  alt=await img.get_attribute('alt');assert alt.startswith('Top 10% on '),alt
  if not shot_saved.get('card'):
   src=await img.get_attribute('src');(OUT/'share-card-campaign.png').write_bytes(base64.b64decode(src.split(',',1)[1]));shot_saved['card']=1
  sbtn=page.locator('.cq-boards-sharebox button');await reach(page,sbtn,'.cq-boards',mobile,h)
  await page.screenshot(path=str(OUT/f'boards-share-{w}x{h}.png'));r['share']=alt
  if mobile:
   cl=page.locator('.cq-boards-foot button');await reach(page,cl,'.cq-boards',mobile,h);await cl.tap()
  elif w==1366:await page.keyboard.press('Escape');INPUT['keys']+=1   # a computer: Escape closes the screen (1366), CLOSE by the mouse (1920)
  else:
   cl=page.locator('.cq-boards-foot button');await reach(page,cl,'.cq-boards',mobile,h);await cl.click();INPUT['mouse']+=1
  await page.wait_for_function('!document.querySelector(".cq-boards")',timeout=10000)
  # ---- 3. into the world at the Titan slot's crater: the strike won, THE HIVE TITAN RISES ----
  go=page.get_by_role('button',name='ENTER CONQUEST',exact=True);await press(page,go,mobile)
  load=await world_loaded(page,f'{w}x{h}');r['worldLoadS']=load
  site=await page.evaluate('ConquestCombat.meteorStrike(Date.now())');assert site['phase']=='open' and site['slot']%6==0,('a Titan slot, its strike open',site.get('phase'),site.get('slot'))
  ok=await page.evaluate('Conquest.view.requestAction("start-mission",{mission:ConquestCombat.meteorStrike(Date.now()).site.id})');assert ok,('the strike starts at the crater',await page.evaluate('Conquest.view.authority?.error'))
  await page.wait_for_function('Conquest.view.battle&&Conquest.view.battle.time>0.3',timeout=30000)
  j=await post('/fixture-op-clear');assert j.get('ok'),j
  rise=page.locator('.cq-result .cq-titan-rise');await rise.wait_for(timeout=60000);rtext=await rise.inner_text()
  assert 'A TITAN SLOT' in rtext and 'THE HIVE TITAN RISES' in rtext and '9,000 hull' in rtext,rtext
  fight=rise.locator('.cq-titan-go');assert (await fight.inner_text())=='FIGHT THE HIVE TITAN' and await fight.is_enabled(),await fight.inner_text()
  st=await inspect();slot=st['strikeSlot'];assert slot%6==0 and st['strikes'][str(slot)]['claimed']==1 and st['settlement']['kind']=='strike' and st['settlement'].get('titan')==1,('the Worker settled the strike of a Titan slot',slot,st.get('settlement'))
  fb=await reach(page,fight,'.cq-result',mobile,h);assert fits(fb,w,h),('FIGHT fits',fb)
  await page.screenshot(path=str(OUT/f'strike-titan-{w}x{h}.png'))
  # ---- 4. the hunt: its HUD ----
  await press(page,fight,mobile)
  hud=page.locator('.cq-titan-hud');await hud.wait_for(timeout=60000);await page.wait_for_function('Conquest.view.battle&&Conquest.view.battle.ttn&&Conquest.view.battle.time>1.2',timeout=30000)
  ht=await hud.inner_text();assert 'THE HIVE TITAN · PHASE I · CHARGE + SLAM · 3:5' in ht and 'YOUR DAMAGE' in ht,ht
  marks=await page.evaluate('[...document.querySelectorAll(".cq-titan-hud .cq-titan-mark")].length');assert marks==2,('the phase marks on the hull bar',marks)
  hb=await hud.bounding_box();assert fits(hb,w,h) and hb['y']+hb['height']<=h,('the Titan HUD fits',hb)
  st=await inspect();assert st['mission']=='hive-titan' and st['ttnRun']['slot']==slot,('the Worker runs the hunt in this slot',st.get('mission'),st.get('ttnRun'))
  nd=await page.locator('.cq-nav-distance').inner_text();assert int(nd.split(' m')[0])<90,('the arrow and the distance lead to the Titan at this crater',nd)
  hidden=await page.evaluate('[".cq-mn",".cq-strike"].every(s=>{const n=document.querySelector(s);return !n||getComputedStyle(n).display==="none";})');assert hidden,'the hunt HUD takes the place of the minerals and strike lines'
  await page.screenshot(path=str(OUT/f'titan-hud-{w}x{h}.png'));r['hud']=ht.replace('\n',' · ')
  # ---- 5. the kill: the result card (the Worker's settlement), once this slot ----
  j=await post('/fixture-titan-win',{'dmg':6800});assert j.get('ok'),j
  res=page.locator('.cq-titan-result');await res.wait_for(timeout=60000);await page.wait_for_function('!document.querySelector(".cq-titan-aar[data-pending]")',timeout=30000);rs=await res.inner_text()
  for want_ in ['THE KILL OF THIS SLOT','THE HIVE TITAN FALLS','+1,600 base airdrop points (once this slot, inside the daily cap)','Your damage: 6,800 · YOUR BEST THIS SLOT · it counts on the weekly Titan board']:assert want_ in rs,(want_,rs)
  st=await inspect();S=st['settlement'];assert S['kind']=='titan' and S['first']==1 and S['ptsRaw']==1600 and S['dmg']==6800 and st['ttn']['sl'][str(slot)]['k']==1,('the Worker paid the kill once',S,st.get('ttn'))
  dropped=await page.evaluate('(l=>!!ConquestLoot.text(l))',S.get('loot') or {});assert ('Loot: ' in rs)==dropped and ('No loot drop this time' in rs)==(not dropped),('the card shows the loot the Worker rolled, or says none dropped',S.get('loot'),rs)
  assert 'Tranquillityite' not in rs,('the guaranteed Tranquillityite stays out (Checkpoint 50)',rs)
  back=page.locator('.cq-result button',has_text='RETURN TO EXPLORATION');await reach(page,back,'.cq-result',mobile,h)
  await page.screenshot(path=str(OUT/f'titan-result-{w}x{h}.png'));r['result']=' · '.join(l for l in rs.split('\n') if l.strip())[:180]
  await press(page,back,mobile);await page.wait_for_function('!Conquest.view.battle&&!Conquest.view.authority.state.mission',timeout=30000)
  again=await page.evaluate('Conquest.view.requestAction("start-mission",{mission:"hive-titan"}).then(ok=>[ok,String(Conquest.view.authority?.error||"")])')
  assert again[0] is False and "already brought down this slot's Titan" in again[1],('a second hunt in the slot is refused',again)
  st=await inspect();assert st['ttn']['sl'][str(slot)]['k']==1 and st['ttn']['kills']==1,('one kill, one payout',st.get('ttn'))
  if not mobile:assert INPUT['mouse']>=3 and INPUT['keys']>=3,('a computer used both the mouse and the keyboard',INPUT)
  r['inputs']='touch' if mobile else f"mouse {INPUT['mouse']}, keyboard {INPUT['keys']}"
  assert not errors,errors[:3];await close_ctx(ctx);return r
 finally:
  server.terminate();await server.wait()
async def main():
 results={};shot_saved={}
 async with async_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
  exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
  if exe:opts['executable_path']=exe
  browser=await pw.chromium.launch(**opts)
  for w,h,mobile in SIZES:
   results[f'{w}x{h}']=await run(browser,w,h,mobile,shot_saved);print('PASS',w,h,json.dumps(results[f'{w}x{h}'])[:300],flush=True)
  await browser.close()
 try:prev=json.loads((OUT/'7c-ui.json').read_text()).get('sizes',{})   # one size at a time (--size) keeps the others' readings
 except Exception:prev={}
 (OUT/'7c-ui.json').write_text(json.dumps({'scope':'shipped client + local Worker, headless Chromium (SwiftShader): not a phone','sizes':{**prev,**results}},indent=1))
 print('PASS Session 7C screens: standing card, War Effort lines, Titan slot line, WEEKLY BOARDS + share card, the strike of a Titan slot, the hunt HUD, the kill once')
asyncio.run(main())
