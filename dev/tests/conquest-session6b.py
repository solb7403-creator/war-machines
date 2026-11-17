# Session 6B browser journey (Tank Lab, logic half) at 390x700, 390x844, 320x568 (touch) and 1366x768, 1920x1080 (a computer:
# real mouse and keyboard, no touch). Drives the real client against the local Worker fixture (dev/tests/conquest-server.mjs) with
# real taps / clicks / keys; evaluate() only READS state (and closes the welcome screen). Per size:
#   1. the hub: the POWER chip and the live RESEARCH button,
#   2. RESEARCH -> the Science Lab screen (tree by track, parts held, plain words),
#   3. Thermal I end to end: RESEARCH on Vent Barrel (1 Thermal Core, 20 min) -> the running job with its timer and the disabled
#      FINISH NOW store row -> the job ends (fixture route) -> the reveal card -> FIT ON MY TANK -> the HUD POWER chip shows its delta,
#   4. Refuge Supply opens on POWER, BANK, REPAIR and the plating cards, the ledger below,
#   5. the zone ambience bed under the tank (colony core at the Command Base),
#   6. Settings: the volume slider (drag on a phone, arrow keys on a computer) and Sound off mutes the bed and disables the slider,
#   7. the Shop's Science Lab section: every entry priced (Stars in Telegram) and disabled ("Not on sale yet").
# Captures: docs/conquest/session6b/<step>-<w>x<h>.png and journey.json. Run: python3 dev/tests/conquest-session6b.py [WxH ...]
import asyncio,json,pathlib,sys,re
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session6b';OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(390,700),(390,844),(320,568),(1366,768),(1920,1080)]
if len(sys.argv)>1:SIZES=[tuple(int(v) for v in a.split('x')) for a in sys.argv[1:]]
FIX={'research':{'cc':5,'lv':3,'parts':{'thermal':3,'coil':2,'servo':2,'cap':1},'done':[],'seen':[]}}
async def journey(browser,base,ready,w,h):
 R={'size':f'{w}x{h}','input':'touch' if w<800 else 'mouse+keyboard'}
 try:return await steps(browser,base,ready,w,h,R)
 except Exception as e:
  R['crash']=str(e)[:600]
  try:
   pg=R.pop('_page',None)
   if pg:
    R['crashState']=await pg.evaluate('({dialogs:[...document.querySelectorAll(".cq-dialog,.cq-radio")].map(n=>n.className),active:typeof Conquest!=="undefined"&&Conquest.active,connected:!!Conquest.view?.authority?.connected})');await pg.screenshot(path=str(OUT/f'crash-{w}x{h}.png'))
  except Exception:pass
  R.pop('_page',None);return R
async def steps(browser,base,ready,w,h,R):
 phone=w<800;tag=f'{w}x{h}'
 ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=phone,is_mobile=phone,device_scale_factor=1,reduced_motion='reduce')
 page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));R['_page']=page
 page.on('console',lambda m:errors.append('console:'+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and '409' not in m.text else None)
 await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'Browser'}},ready(){},expand(){},onEvent(){},offEvent(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},MainButton:{hide(){}},BackButton:{hide(){},show(){},onClick(){},offClick(){}},platform:'''+json.dumps('ios' if phone else 'tdesktop')+''',version:'7.0',colorScheme:'dark',themeParams:{},isExpanded:true,viewportHeight:'''+str(h)+''',viewportStableHeight:'''+str(h)+'''}};''')
 async def route(r):
  u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
  if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
   try:
    resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   except Exception:return await r.fulfill(status=503,body='{}',content_type='application/json')
  if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
  if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
  if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
  await r.abort()
 await page.route('**/*',route)
 press=(lambda loc:loc.tap()) if phone else (lambda loc:loc.click())
 shot=lambda name:page.screenshot(path=str(OUT/f'{name}-{tag}.png'))
 await page.request.post(base+'/fixture',data=FIX)
 await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof save!=="undefined"')
 await page.request.post(base+'/fixture',data=FIX)
 await page.evaluate('closeAll();save.welcomed=true;try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){};uiDirty();')
 # first input anywhere starts the one AudioContext (iOS rule)
 await page.mouse.click(5,h-5) if not phone else await page.touchscreen.tap(5,h-5)
 # ---- 1. the hub ----
 await press(page.locator('[data-act="conquest"]:visible').first);await page.wait_for_selector('.cq-hub-research',timeout=30000);await page.wait_for_timeout(800)
 R['hub']=await page.evaluate('({chip:document.querySelector(".cq-hub .cq-rating, .cq-rating")?.textContent||null,research:document.querySelector(".cq-hub-research")?.textContent||null,disabled:!!document.querySelector(".cq-hub-research")?.disabled})')
 await shot('hub')
 # ---- 2. RESEARCH -> the Science Lab screen ----
 await press(page.locator('.cq-hub-research').first)
 await page.wait_for_function('Conquest.view?.authority?.connected',timeout=120000)
 for _ in range(6):
  sk=page.locator('.cq-radio button')
  if await sk.count():
   await press(sk.first);await page.wait_for_timeout(300)
  if await page.locator('.cq-lab').count():break
  await page.wait_for_timeout(700)
 await page.wait_for_selector('.cq-lab',timeout=30000);await page.wait_for_timeout(500)
 R['lab']=await page.evaluate('(()=>{const d=document.querySelector(".cq-lab");return {title:d.querySelector("h2")?.textContent,tracks:d.querySelectorAll(".cq-lab-track").length,nodes:d.querySelectorAll(".cq-lab-node").length,ready:[...d.querySelectorAll(".cq-lab-go:not([disabled])")].map(b=>b.textContent),parts:[...d.querySelectorAll(".cq-lab-part")].map(p=>p.textContent),scroll:[d.scrollHeight,d.clientHeight],wide:d.scrollWidth>d.clientWidth+1};})()')
 await shot('lab')
 # ---- 3. Thermal I end to end ----
 vent=page.locator('.cq-lab-node',has=page.locator('h3',has_text='VENT BARREL')).locator('.cq-lab-go')
 await vent.scroll_into_view_if_needed();await press(vent)
 await page.wait_for_function('document.querySelector(".cq-lab-job")',timeout=30000);await page.wait_for_timeout(400)
 R['running']=await page.evaluate('(()=>{const j=document.querySelector(".cq-lab-job");const b=j?.querySelector(".cq-lab-buy");return {job:j?.querySelector("b")?.textContent,finish:b?.textContent||null,finishDisabled:b?b.disabled:null,off:j?.querySelector(".cq-lab-off")?.textContent||null,parts:[...document.querySelectorAll(".cq-lab-part")].map(p=>p.textContent)};})()')
 await page.locator('.cq-lab-job').first.scroll_into_view_if_needed();await shot('lab-running')
 R['powerBefore']=await page.evaluate('powerOf(myLoadout())')
 close=page.get_by_role('button',name='CLOSE',exact=True)
 if phone:await press(close.last)
 else:await page.keyboard.press('Escape')
 await page.wait_for_timeout(300)
 if await page.locator('.cq-lab').count():await press(close.last)   # Escape closes dialogs where the game supports it; the button always does
 fin=await page.request.post(base+'/fixture-research-finish',data={});R['finishedJobs']=(await fin.json()).get('jobs')
 await page.evaluate('Conquest.view.authority.connect()')   # the next sync (a real client would get it within seconds): read-only for the UI
 await page.wait_for_selector('.cq-lab-reveal',timeout=60000);await page.wait_for_timeout(500)
 R['reveal']=await page.evaluate('(()=>{const d=document.querySelector(".cq-lab-reveal");return {kicker:d.querySelector(".cq-kicker")?.textContent,name:d.querySelector("h2")?.textContent,what:d.querySelector(".cq-lab-what")?.textContent,cost:d.querySelector(".cq-lab-cost")?.textContent,power:d.querySelector(".cq-lab-power")?.textContent,buttons:[...d.querySelectorAll("button")].map(b=>b.textContent)};})()')
 await shot('reveal')
 await press(page.get_by_role('button',name='FIT ON MY TANK'))
 # fitted away from the Refuge: the HUD chip keeps the tank in the field and shows the pending line until the terminal refits it
 try:await page.wait_for_selector('.cq-rating-power-field .cq-rating-next',timeout=15000)
 except Exception:pass
 R['powerPending']=await page.evaluate('({garage:powerOf(myLoadout()),mods:JSON.stringify(myLoadout().mods),chip:document.querySelector(".cq-rating-power-field")?.textContent||null,toast:document.querySelector(".toast,#toast")?.textContent||null})')
 await shot('power-pending')
 # fast travel to the Refuge (MORE -> FAST TRAVEL · BASE COMMAND -> the map's REFUGE SUPPLY): the terminal refits the tank, the chip rises
 await press(page.locator('.cq-more').first);await page.wait_for_timeout(200);await press(page.get_by_role('button',name='FAST TRAVEL · BASE COMMAND'))
 await page.wait_for_selector('.cq-map',timeout=20000);fold=page.locator('.cq-map summary',has_text='FAST TRAVEL').first
 await fold.scroll_into_view_if_needed();await press(fold);await page.wait_for_timeout(300);go=page.get_by_role('button',name='FAST TRAVEL · REFUGE SUPPLY')
 await go.scroll_into_view_if_needed();await press(go)
 try:await page.wait_for_function('(()=>{const v=document.querySelector(".cq-rating-power-field .cq-rating-v");return v&&v.textContent.includes("→");})()',timeout=45000)
 except Exception:pass
 try:await page.wait_for_function('!document.querySelector(".cq-travel-fade")',timeout=5000)   # the travel fade (0.9 s) covers the HUD
 except Exception:pass
 R['powerAfter']=await page.evaluate('({field:Conquest.view.authority?.state?.loadout?powerOf(Conquest.view.authority.state.loadout):null,chip:document.querySelector(".cq-rating-power-field")?.textContent||null,pending:!!document.querySelector(".cq-rating-power-field .cq-rating-next"),at:[Math.round(Conquest.view.p.x),Math.round(Conquest.view.p.z)]})')
 await shot('power-delta')
 # ---- 4. Refuge Supply ----
 await press(page.locator('.cq-more').first);await page.wait_for_timeout(200);await press(page.get_by_role('button',name='INVENTORY / SUPPLY'));await page.wait_for_selector('.cq-supply',timeout=20000);await page.wait_for_timeout(400)
 R['supply']=await page.evaluate('(()=>{const d=document.querySelector(".cq-supply");return [...d.querySelectorAll("h2,h3,button,.cq-rating,.cq-supply-eng,.cq-supply-cp")].slice(0,9).map(n=>n.textContent.slice(0,40));})()')
 await shot('supply')
 await press(page.get_by_role('button',name='CLOSE SUPPLY'));await page.wait_for_timeout(300)
 # ---- 5. the ambience bed ----
 await page.wait_for_timeout(2800)
 R['ambience']=await page.evaluate('({bed:AMB&&AMB.id,zone:Conquest.ambience(),ac:AC&&AC.state,vol:typeof volLevel==="function"?volLevel():null})')
 # ---- 6. Settings: volume and mute ----
 back=page.get_by_role('button',name='‹',exact=True)
 if await back.count():await press(back.first)
 await page.wait_for_timeout(600)
 R['leftConquest']=not await page.evaluate('Conquest.active')
 if not R['leftConquest']:await page.evaluate('Conquest.close()')   # a confirm dialog (enemies near): the journey's next steps are outside Conquest
 await page.wait_for_timeout(400)
 await press(page.locator('[data-act="settings"]:visible').first);await page.wait_for_selector('#vol-r',timeout=15000)
 slider=page.locator('#vol-r')
 if phone:
  bb=await slider.bounding_box();await page.touchscreen.tap(bb['x']+bb['width']*0.4,bb['y']+bb['height']/2)
  await page.wait_for_timeout(200)
  if abs((await page.evaluate('save.vol??1'))-1)<1e-9:await slider.fill('40')   # some engines do not move a range input on a tap: set it as a drag would
 else:
  await slider.focus()
  for _ in range(12):await page.keyboard.press('ArrowLeft')
 await page.wait_for_timeout(300)
 R['volume']=await page.evaluate('({vol:save.vol,label:document.getElementById("vol-p")?.textContent,gain:master?Math.round(master.gain.value*1000)/1000:null,stored:JSON.parse(localStorage.getItem(SAVE_KEY)||"{}").vol})')
 await shot('settings')
 await press(page.locator('[data-act="sound"]').first);await page.wait_for_timeout(500)
 R['muted']=await page.evaluate('({sound:save.sound,slider:document.getElementById("vol-r")?.disabled,label:document.getElementById("vol-p")?.textContent,bed:AMB&&AMB.id})')
 await press(page.locator('[data-act="sound"]').first);await page.wait_for_timeout(300)
 await page.evaluate('closeAll()')
 # ---- 7. the Shop's Science Lab section ----
 await press(page.locator('[data-act="tab"][data-arg="shop"]:visible,[data-tab="shop"]:visible').first)
 await page.wait_for_selector('.labshop',timeout=15000);await page.locator('.labshop').scroll_into_view_if_needed();await page.wait_for_timeout(300)
 R['shop']=await page.evaluate('(()=>{const d=document.querySelector(".labshop");const b=[...d.querySelectorAll("button")];return {items:[...d.querySelectorAll(".labshop-item b")].map(n=>n.textContent),prices:b.map(x=>x.textContent),allDisabled:b.every(x=>x.disabled),off:d.querySelectorAll(".labshop-off").length,note:d.querySelector(".labshop-note")?.textContent,fits:document.documentElement.scrollWidth<=innerWidth+1};})()')
 await shot('shop-lab')
 R['errors']=errors[:8];R.pop('_page',None);await ctx.close();return R
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 out=[]
 try:
  async with async_playwright() as pw:
   b=await pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required'],executable_path='/opt/pw-browsers/chromium')
   for w,h in SIZES:
    try:r=await journey(b,base,ready,w,h)
    except Exception as e:r={'size':f'{w}x{h}','crash':str(e)[:600]}
    out.append(r);print(json.dumps(r),flush=True)
   await b.close()
 finally:server.terminate()
 (OUT/'journey.json').write_text(json.dumps(out,indent=1)+'\n')
 bad=[]
 for r in out:
  if 'crash' in r:bad.append(r['size']+' crashed: '+r['crash'][:200]);continue
  t=r['size']
  if not (r['hub']['chip'] and 'POWER' in r['hub']['chip'] and r['hub']['research'] and not r['hub']['disabled']):bad.append(t+' hub')
  if not (r['lab']['tracks']>=5 and not r['lab']['wide'] and any('VENT' in x or '1 THERMAL' in x for x in r['lab']['ready']+['']) or r['lab']['ready']):bad.append(t+' lab')
  if not (r['running']['job'] and 'VENT BARREL' in r['running']['job'] and r['running']['finishDisabled']):bad.append(t+' running job / finish row')
  if not (r['reveal']['name']=='VENT BARREL' and 'FIT ON MY TANK' in r['reveal']['buttons']):bad.append(t+' reveal')
  if not ('vent' in r['powerPending']['mods'] and r['powerPending']['chip'] and 'at the Refuge' in r['powerPending']['chip']):bad.append(t+' POWER pending '+json.dumps(r['powerPending']))
  if not (r['powerAfter']['chip'] and '→' in r['powerAfter']['chip'] and not r['powerAfter']['pending'] and r['powerAfter']['field']==r['powerPending']['garage']):bad.append(t+' POWER delta '+json.dumps(r['powerAfter']))
  if not (r['supply'][0]=='REFUGE SUPPLY' and 'POWER' in r['supply'][1] and 'BANK SALVAGE' in r['supply'][2] and 'REPAIR HULL' in r['supply'][3]):bad.append(t+' supply order '+json.dumps(r['supply']))
  if r['ambience']['bed']!='cq-core':bad.append(t+' ambience '+json.dumps(r['ambience']))
  if not (r['volume']['vol'] is not None and r['volume']['vol']<1 and r['volume']['stored']==r['volume']['vol']):bad.append(t+' volume '+json.dumps(r['volume']))
  if not (r['muted']['sound'] is False and r['muted']['slider'] is True and not r['muted']['bed']):bad.append(t+' mute '+json.dumps(r['muted']))
  if not (r['shop']['allDisabled'] and len(r['shop']['items'])>=7 and r['shop']['fits'] and all('⭐' in p for p in r['shop']['prices'])):bad.append(t+' shop '+json.dumps(r['shop']))
  if r['errors']:bad.append(t+' page errors '+json.dumps(r['errors'][:3]))
 print(('FAIL conquest-session6b: '+' | '.join(bad)) if bad else 'PASS conquest-session6b ('+str(len(out))+' sizes)')
 sys.exit(1 if bad else 0)
asyncio.run(main())
