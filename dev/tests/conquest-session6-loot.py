"""Session 6 part C (loot v1) in the shipped client against the real Worker reducer on a disposable local DB:
a loot cache on the ground shows its rarity colour and one-word label, driving over it picks it up (account-bound, flyout + rare card),
the consumable slot appears above HEAT, tapping it (phone) or pressing 1 / T (desktop keyboard) uses a Repair Kit through the
server's use-item action (count down, cooldown on the slot, hull mends), a long press on SHIELD opens the quick picker, MORE -> LOOT &
TROPHY HALL opens and its last line is reachable (fits or scrolls) at 390x700, 320x568 and 1366x768.
Scenario placements only: two Repair Kits and a Decoy Beacon already owned, a cache with a Thermal Core and an Ilmenite beside the
tank, the hull at 45%. Software GL: relative look only. Captures: docs/conquest/session6/loot-*.png."""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session6';OUT.mkdir(parents=True,exist_ok=True)
POS=[1162,1130]   # the Refuge spawn: open road, widest view (Checkpoint 40 Decision 2)
async def run(pw,base,ready,w,h,mobile):
 opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
 exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
 if exe:opts['executable_path']=exe
 browser=await pw.chromium.launch(**opts);ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile,reduced_motion='reduce');page=await ctx.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};try{localStorage.setItem('lunar-conquest-onboarding-v1','1')}catch(e){}''')
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
 fixture={'position':POS,'noEnemies':True,'hp':700,'inv':{'it':{'repair':2,'decoy':1}},'drops':[{'x':POS[0],'z':POS[1]-16,'loot':{'pt':{'thermal':1},'mn':{'il':1}},'r':2,'label':'THERMAL'}]}
 await page.request.post(base+'/fixture',data=fixture)
 await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
 await page.request.post(base+'/fixture',data=fixture)
 await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
 await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
 st=lambda js:page.evaluate('(()=>{const s=Conquest.view.authority.state;return '+js+';})()')
 # the default chase camera: behind the tank, looking north (the spawn heading)
 # 1. the cache: rarity glow + label (3D tag over it), then drive over it
 await page.wait_for_function('[...document.querySelectorAll(".cq-drop-tag")].some(n=>!n.hidden&&n.textContent==="THERMAL")',timeout=30000)
 tag=await page.evaluate('(()=>{const n=[...document.querySelectorAll(".cq-drop-tag")].find(n=>!n.hidden);return n.textContent+"|"+getComputedStyle(n).color;})()')
 await page.screenshot(path=str(OUT/f'loot-cache-{w}x{h}.png'))
 for _ in range(60):
  if await st('!(s.drops||[]).some(d=>d.id==="fixture:0")'):break
  dz=await page.evaluate(f'{POS[1]-16}-Conquest.view.p.z')
  k='KeyW' if dz<0 else 'KeyS';await page.keyboard.down(k);await page.wait_for_timeout(200);await page.keyboard.up(k)
 await page.wait_for_function('Conquest.view.authority.state.inv?.pt?.thermal===1',timeout=30000)
 card=await page.evaluate('(()=>{const c=document.querySelector(".cq-loot-card");return c?c.textContent:"";})()')
 ticker=await page.locator('.cq-reward-ticker').inner_text()
 await page.screenshot(path=str(OUT/f'loot-card-{w}x{h}.png'))
 assert await st('(s.ledger.mn.il|0)>=1'),'the Ilmenite rides the cargo'
 # 2. the consumable slot: visible, then use a Repair Kit (tap on a phone, key 1 on a computer)
 slot=page.locator('#cq-item');await slot.wait_for(state='visible',timeout=15000);label=await slot.inner_text()
 hp0=await st('s.hp')
 if mobile:await slot.tap()
 else:await page.keyboard.press('Digit1')
 await page.wait_for_function('Conquest.view.authority.state.inv.it.repair===1',timeout=30000)
 await page.wait_for_function(f'Conquest.view.authority.state.hp>{hp0}+50',timeout=30000)
 cd=await slot.inner_text()
 assert 's' in cd,f'the slot shows the cooldown: {cd!r}'
 # a second use inside the cooldown is refused by the server (nothing spent)
 if mobile:await slot.tap()
 else:await page.keyboard.press('KeyT')
 await page.wait_for_timeout(1500)
 assert await st('s.inv.it.repair')==1,'cooldown: the server refuses and spends nothing'
 # 3. long press on SHIELD: the quick picker
 sb=await page.locator('#cq-shield').bounding_box();await page.mouse.move(sb['x']+sb['width']/2,sb['y']+sb['height']/2);await page.mouse.down();await page.wait_for_timeout(700);await page.mouse.up()
 picker=await page.locator('.cq-item-picker').count()
 assert picker==1,'a long press on SHIELD opens the item picker'
 await page.screenshot(path=str(OUT/f'loot-picker-{w}x{h}.png'))
 await page.locator('.cq-item-picker').evaluate('n=>n.remove()')
 # 4. MORE -> LOOT & TROPHY HALL: fits or scrolls, last line reachable
 await page.get_by_role('button',name='MORE',exact=True).click();await page.locator('.cq-loot-open').click();d=page.locator('.cq-dialog.cq-loot');await d.wait_for()
 await page.screenshot(path=str(OUT/f'loot-screen-{w}x{h}.png'))
 reach=await page.evaluate('''(()=>{const d=document.querySelector('.cq-dialog.cq-loot');d.scrollTop=d.scrollHeight;const last=[...d.querySelectorAll('button')].at(-1).getBoundingClientRect();return {scrolls:d.scrollHeight>d.clientHeight,lastVisible:last.bottom<=innerHeight+1&&last.top>=0,overflowX:document.documentElement.scrollWidth>innerWidth+1};})()''')
 assert reach['lastVisible'] and not reach['overflowX'],reach
 text=await d.inner_text()
 for want in ['REPAIR KIT ×1','THERMAL CORE 1/50','TROPHY HALL','PITY','PUBLISHED ODDS']:assert want in text.replace('\n',' ').upper() or want in text,want
 await page.screenshot(path=str(OUT/f'loot-screen-end-{w}x{h}.png'))
 assert not errors,errors
 await browser.close()
 return {'size':f'{w}x{h}','tag':tag,'card':card,'ticker':ticker,'slot':label,'slotCooldown':cd,'screen':reach}
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   res=[await run(pw,base,ready,390,700,True),await run(pw,base,ready,320,568,True),await run(pw,base,ready,1366,768,False)]
  print(json.dumps({'status':'PASS','runs':res}))
 finally:
  server.terminate()
asyncio.run(main())
