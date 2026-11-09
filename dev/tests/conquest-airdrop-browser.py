"""Phase 1 airdrop-points journey (Chromium, 390x844 portrait): the shipped client against the real Worker reducer and a
disposable local database (dev/tests/conquest-server.mjs). A real Moonbeam kill of a world patrol (no fabricated kill or
reward) becomes a pending outbox entry, the Worker credits it to the account, and the HUD shows the account's own number.
Then a base placed at a half-filled Daily Base Yield shows its terminal meter and in-world meter, and is collected.
Automated software-GL evidence, not a physical iPhone. Screenshots: docs/economy/phase1/.
usage: python3 dev/tests/conquest-airdrop-browser.py
"""
import asyncio,json,math,pathlib,shutil,re
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/economy/phase1';OUT.mkdir(parents=True,exist_ok=True)
W,H=390,844
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   context=await browser.new_context(viewport={'width':W,'height':H},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await context.new_page()
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script('''window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
   async def route(r):
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.path.startswith('/api/conquest/') or u.path=='/api/sync':
     resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'))
     if resp.status>=400 and u.path!='/api/sync':print('API',u.path,resp.status,(await resp.text())[:200],flush=True)
     return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
    if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
    await r.abort()
   await page.route('**/*',route)
   async def tap(selector):
    r=await page.locator(selector).first.evaluate('''e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)};}''')
    assert r['x']>=0 and r['y']>=0 and r['x']+r['w']<=W+1 and r['y']+r['h']<=H+1 and r['hit'],(selector,r)
    await page.touchscreen.tap(r['x']+r['w']/2,r['y']+r['h']/2)
   async def fixture(**kw):
    await page.request.post(base+'/fixture',data=kw)
   async def reconnect():
    await page.evaluate('Conquest.view.reset();Conquest.view.authority.state=null;Conquest.view.authority.queue=[];Conquest.view.authority.phase=null;Conquest.view.authority.connect()')
    await page.wait_for_function('Conquest.view.authority.connected&&Conquest.view.authority.state?.seq===0',timeout=30000)
   # ---- enter Conquest next to the Refuge scout patrol, Moonbeam fitted (scenario placement, not a result) ----
   await fixture(position=[972,1084],weapon='moon')
   await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await tap('.cq-story-start')
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
   await page.wait_for_function("(document.querySelector('.cq-net')?.textContent||'').startsWith('AIRDROP TODAY')",timeout=20000)
   line0=await page.locator('.cq-net').text_content();print('HUD',line0,flush=True)
   assert abs((await page.evaluate('Conquest.view.p.x'))-972)<3,'scenario placement applied'
   # ---- a real kill: tap the visible hull to lock, hold FIRE (Space), close in with WASD ----
   held=set();killed=None
   for step in range(500):
    info=await page.evaluate('''()=>{const v=Conquest.view,B=v.encounter,a=v.authority.state?.airdrop;if((a?.out&&Object.keys(a.out).length)||a?.view?.dailyPts)return {done:true};const living=B.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-v.p.x,e.z-v.p.z)<120).sort((x,y)=>Math.hypot(x.x-v.p.x,x.z-v.p.z)-Math.hypot(y.x-v.p.x,y.z-v.p.z)),e=living[0];if(!e)return {none:true};
     let hull=null;v.enemyMeshes.get(e.id)?.traverse(m=>{if(!hull&&m.isMesh&&!m.userData.noPick&&m!==v.enemyMeshes.get(e.id).userData.marker)hull=m;});let pick=null;if(hull){if(!hull.geometry.boundingBox)hull.geometry.computeBoundingBox();const c=hull.geometry.boundingBox.getCenter(new v.T.Vector3()).applyMatrix4(hull.matrixWorld).project(v.camera),r=v.host.getBoundingClientRect();pick={x:r.x+(c.x+1)*r.width/2,y:r.y+(1-c.y)*r.height/2,visible:c.z<1&&Math.abs(c.x)<1&&Math.abs(c.y)<1};}
     return {id:e.id,kind:e.kind,d:Math.hypot(e.x-v.p.x,e.z-v.p.z),ex:e.x,ez:e.z,px:v.p.x,pz:v.p.z,yaw:v.yaw,selected:v.selectedId,pick,hp:B.playerHp};}''')
    if step%25==0:print('fight',step,{k:info.get(k) for k in ('id','kind','d','selected','hp')},'pick',info.get('pick'),flush=True)
    if info.get('done'):killed=step;break
    if info.get('none'):   # the client predicted the kill; the Worker's verified outbox entry follows on the next request
     await page.wait_for_timeout(300);continue
    assert info['hp']>0,('pilot destroyed',info)
    if not (info.get('pick') or {}).get('visible'):await page.evaluate('([dx,dz])=>{Conquest.view.yaw=Math.atan2(-dx,-dz);}',[info['ex']-info['px'],info['ez']-info['pz']]);await page.wait_for_timeout(120);continue   # turn the camera toward the target, as a player dragging the view
    pk=info.get('pick')
    if pk and pk['visible'] and info['selected']!=info['id'] and 150<pk['y']<H-240 and 10<pk['x']<W-10:await page.mouse.click(pk['x'],pk['y'])
    want={'Space'}
    if info['d']>26:
     dx,dz=info['ex']-info['px'],info['ez']-info['pz'];d=math.hypot(dx,dz);x=(math.cos(info['yaw'])*dx-math.sin(info['yaw'])*dz)/d;z=(-math.sin(info['yaw'])*dx-math.cos(info['yaw'])*dz)/d
     if abs(x)>.3:want.add('d' if x>0 else 'a')
     if abs(z)>.3:want.add('w' if z>0 else 's')
    for k in held-want:await page.keyboard.up(k)
    for k in want-held:await page.keyboard.down(k)
    held=want;await page.wait_for_timeout(150)
   for k in held:await page.keyboard.up(k)
   if killed is None:await page.screenshot(path=str(OUT/'debug-fight-failure-390.png'))
   assert killed is not None,'the patrol was not destroyed in time'
   await page.wait_for_function("/\\+\\d[\\d,]* PENDING/.test(document.querySelector('.cq-net').textContent)||/AIRDROP TODAY [1-9]/.test(document.querySelector('.cq-net').textContent)",timeout=15000)
   pending=await page.locator('.cq-net').text_content();print('HUD after the kill',pending,flush=True)
   await page.screenshot(path=str(OUT/'hud-pending-390.png'))
   # the Worker credits a lone kill after 20 s; the HUD then shows the account's own number for today
   await page.wait_for_function("Conquest.view.authority.state?.airdrop?.view?.dailyPts>0&&/AIRDROP TODAY [1-9]/.test(document.querySelector('.cq-net').textContent)",timeout=90000)
   credited=await page.locator('.cq-net').text_content();print('HUD after the credit',credited,flush=True)
   await page.screenshot(path=str(OUT/'hud-credited-390.png'))
   state=json.loads(await (await page.request.post(base+'/inspect',data={})).text())['state']
   assert not (state.get('airdrop',{}).get('out')),'credited entries are dropped from the Conquest record'
   assert re.search(r'AIRDROP TODAY \d',credited) and '50,000' in credited,credited
   # ---- the Daily Base Yield: a base whose clock started 12 h ago (scenario placement) ----
   d=await page.evaluate('ConquestCombat.baseDefinition')
   await fixture(position=[d['x'],d['z']],base={'tier':2,'claimedAgoMs':12*3600000},baseFunds=True);await reconnect()
   await page.wait_for_function("!document.querySelector('#cq-base-access').hidden",timeout=20000)
   await page.wait_for_function("Conquest.view.yieldMeter?.visible&&Conquest.view.yieldMeter.userData.n===5",timeout=20000)
   orbs=await page.evaluate('Conquest.view.yieldMeter.userData.n');goal=await page.locator('.cq-base-goal').text_content();print('in-world meter lit orbs',orbs,'| HUD',goal,flush=True)
   assert 'YIELD 50%' in goal,goal
   await page.screenshot(path=str(OUT/'base-meter-world-390.png'))
   await tap('#cq-base-access');await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_selector('.cq-plot-status .cq-yield')   # Session 5C: the yield is on the HOME status card
   head=await page.locator('.cq-yield h3').text_content();val=await page.locator('.cq-yield-bar').first.evaluate('e=>e.value');print('terminal',head,val,flush=True)
   assert head.startswith('DAILY BASE YIELD · 50%') and abs(val-.5)<.01,(head,val)
   await page.locator('.cq-yield').scroll_into_view_if_needed();await page.screenshot(path=str(OUT/'base-yield-terminal-390.png'))
   cp0=await page.evaluate('Conquest.view.authority.state.ledger.cp')
   await page.get_by_role('button',name=re.compile('^COLLECT DAILY YIELD')).click()
   await page.wait_for_function("Conquest.view.authority.state?.notice?.kind==='base-production'",timeout=20000)
   notice=await page.evaluate('Conquest.view.authority.state.notice');cp1=await page.evaluate('Conquest.view.authority.state.ledger.cp')
   print('collected',notice,flush=True)
   assert cp1-cp0==notice['cp']>0 and notice['pointsHeld'],'50% of the CP banked; the points part is held until an operation today'
   await page.locator('.cq-plot-leave').click()   # the 3D view pauses while the plot (a dialog) is open (existing behaviour)
   await page.wait_for_function("Conquest.view.yieldMeter.userData.n===0&&/YIELD 0%/.test(document.querySelector('.cq-base-goal').textContent)",timeout=10000)
   overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
   assert not overflow,'no horizontal overflow at 390'
   assert not errors,errors
   print('PASS airdrop journey 390: real kill -> pending -> credited ('+credited.strip()+'); Daily Base Yield meter 50% (5/10 orbs) -> collected; no page errors',flush=True)
   await browser.close()
 finally:
  server.terminate();await server.wait()
asyncio.run(main())
