"""Phase 3 journey in the shipped client (Chromium 390x844, HIGH) against the real Worker reducer and account (server economy, /api/act) on a disposable local DB:
scanner pulse at the Refuge reveals the Starter Vein -> hold GATHER (server channel, 35 Ferrite carried) -> REFUGE SUPPLY ->
BANK (minerals to the account wallet through the outbox) -> fabricate the first FRONT Ferrite plate (the same server action as
the garage) -> the session refits and the plate is on the hull (more hull HP) -> garage Hull Plating section. Then the Meteor
Strike telegraph on the HUD and MAP (page clock moved to 17:57 UTC; presentation only).
Scenario placements only: the spawn beside the Refuge and the wallet before this journey (5 Ferrite + points, standing in for
the first mission cache and a roadside deposit, as in RESOURCE_ECONOMY.md §7.3). Software GL: relative look only.
"""
import asyncio,json,pathlib,shutil,datetime
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/economy/phase3';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts);ctx=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='high';window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
   async def route(r):
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
     resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
    if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
    await r.abort()
   await page.route('**/*',route)
   await page.request.post(base+'/fixture',data={'position':[1185,1170],'fieldMissions':True})
   await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.request.post(base+'/fixture',data={'position':[1185,1170],'fieldMissions':True,'wallet':{'mn':{'fe':5},'pts':5000}})
   await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
   await page.evaluate('Conquest.view.yaw=-1.9;Conquest.view.pitch=.5;Conquest.view.distance=26')
   st=lambda js:page.evaluate('(()=>{const s=Conquest.view.authority.state;return '+js+';})()')
   # 1. scanner pulse
   await page.wait_for_function('!document.querySelector("#cq-scan-access").hidden',timeout=30000)
   hint=await page.locator('.cq-mn').inner_text()
   scanHint=await page.evaluate('(()=>{const b=document.querySelector("#cq-scan-access");return b.textContent+"|"+b.classList.contains("cq-scan-pulse");})()')
   await page.locator('#cq-scan-access').click();await page.wait_for_function('Conquest.view.authority.state?.found?.["starter-01"]',timeout=60000)
   await page.wait_for_timeout(600);await page.screenshot(path=str(OUT/'scan-starter-vein-390.png'))
   found=await st('Object.keys(s.found).length')
   await page.wait_for_function('Conquest.view.routeTarget?.kind==="resource"',timeout=15000)
   oreRoute=await page.evaluate('(()=>{const t=Conquest.view.routeTarget;return t.id+"|"+t.name+"|"+document.querySelector(".cq-nav-distance").textContent+"|"+document.querySelector("#cq-scan-access").textContent;})()')
   # 2. gather the Starter Vein through the shipped GATHER button
   g=page.locator('#cq-gather-access');await g.wait_for(state='visible',timeout=30000);label=await g.inner_text()
   box=await g.bounding_box();await page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);await page.mouse.down()
   await page.wait_for_function('(Conquest.view.authority.state?.channel?.ms||0)>=2000',timeout=90000);await page.screenshot(path=str(OUT/'gather-starter-vein-390.png'))
   await page.wait_for_function('(Conquest.view.authority.state?.ledger?.mn?.fe||0)>=35',timeout=120000);await page.mouse.up()
   await page.wait_for_function('Conquest.view.routeTarget?.id!=="starter-01"',timeout=15000)
   await page.wait_for_function('Conquest.view.pending===0',timeout=60000);await page.wait_for_timeout(800)
   carried=await page.locator('.cq-mn').inner_text();await page.screenshot(path=str(OUT/'carried-minerals-390.png'))
   # 3. bank at REFUGE SUPPLY -> wallet
   await page.locator('#cq-supply-access').click();await page.get_by_role('button',name='BANK SALVAGE').click()
   await page.wait_for_function('(Conquest.view.authority.state?.airdrop?.view?.mn?.fe||0)>=40',timeout=60000)
   wallet=await st('s.airdrop.view.mn.fe');await page.wait_for_selector('.cq-plating');await page.screenshot(path=str(OUT/'refuge-supply-plating-390.png'))
   hp0=await page.evaluate('(Conquest.view.battle||Conquest.view.encounter).playerMax')
   VERTS='(()=>{let n=0;Conquest.view.vehicle.traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position)n+=o.geometry.attributes.position.count;});return n;})()'
   v0=await page.evaluate(VERTS)
   # 4. fabricate the FRONT Ferrite plate (same server action as the garage) -> session refit -> on the hull
   await page.locator('.cq-plating button').first.click()
   await page.wait_for_function('Conquest.view.authority.state?.loadout?.ap?.[0]===1',timeout=60000)
   await page.wait_for_function('Conquest.view.pending===0',timeout=60000);await page.wait_for_timeout(800)
   hp1=await page.evaluate('(Conquest.view.battle||Conquest.view.encounter).playerMax');ap=await page.evaluate('save.ap');v1=await page.evaluate(VERTS)
   if await page.locator('.cq-dialog').count():await page.get_by_role('button',name='CLOSE SUPPLY').click()
   await page.evaluate('(()=>{const b=Conquest.view.vehicle.userData.body||Conquest.view.vehicle,T=Conquest.view.T,q=new T.Quaternion();b.getWorldQuaternion(q);const f=new T.Vector3(1,0,0).applyQuaternion(q);Conquest.view.yaw=Math.atan2(f.x,f.z)+.75;Conquest.view.pitch=.42;Conquest.view.distance=12;})()');await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/'first-plate-on-hull-390.png'))
   # 5. owner playtest (Nov 8): a simulated hit shows the UNDER FIRE arrow and the red edge flash; under 25% hull the tap-to-route
   #    banner appears and its tap sets the Refuge repair route. Presentation only (the local frame's hull and a hostile placed
   #    40 m away are re-applied each poll because the Worker snapshot reconciles them).
   HIT='''(()=>{const v=Conquest.view,B=v.encounter||v.battle,p=v.p;let e=B.enemies.find(x=>x.__probe);if(!e){const src=B.enemies.find(x=>x.hp>0)||B.enemies[0];e=Object.assign(JSON.parse(JSON.stringify(src)),{id:987654,__probe:1});B.enemies.push(e);}
     e.hp=e.maxHp||100;e.x=p.x+40;e.z=p.z;e.y=p.y;B.playerHp=Math.max(1,B.playerHp-60);
     const th=document.querySelector('.cq-threat'),hurt=document.querySelector('.cq-hurt');return !!th&&!th.hidden&&!!hurt&&hurt.classList.contains('on')&&/UNDER FIRE/.test(th.textContent)&&/40 m/.test(th.textContent);})()'''
   await page.wait_for_function(HIT,timeout=20000,polling=120);threat=await page.locator('.cq-threat').inner_text();await page.screenshot(path=str(OUT/'under-fire-390.png'))
   LOW='''(()=>{const v=Conquest.view,B=v.encounter||v.battle;B.playerHp=Math.round(B.playerMax*.2);const b=document.querySelector('.cq-low-hull');return !!b&&!b.hidden&&/ROUTE TO REFUGE/.test(b.textContent);})()'''
   await page.wait_for_function(LOW,timeout=20000,polling=120);lowText=await page.locator('.cq-low-hull').inner_text();await page.screenshot(path=str(OUT/'low-hull-390.png'))
   await page.evaluate('document.querySelector(".cq-low-hull").click()');route=await page.evaluate('Conquest.view.routeTarget?.kind||""')
   assert 'UNDER FIRE' in threat and 'TAP: ROUTE TO REFUGE REPAIR' in lowText and route=='refuge',(threat,lowText,route)
   print('PASS under fire: arrow + distance + red edge flash; low hull (<25%) banner tap sets the Refuge repair route')
   await page.evaluate('(()=>{const B=Conquest.view.encounter||Conquest.view.battle;B.enemies=B.enemies.filter(e=>!e.__probe);B.playerHp=B.playerMax;Conquest.view.routeTarget=null;})()')
   # 6. the Meteor Strike telegraph on the HUD and MAP (presentation; the page clock is moved to 17:57 UTC)
   await page.clock.set_system_time(datetime.datetime(2026,11,9,17,57,tzinfo=datetime.timezone.utc));await page.wait_for_timeout(1500)
   strike=await page.locator('.cq-strike').inner_text();await page.screenshot(path=str(OUT/'meteor-telegraph-hud-390.png'),timeout=90000)   # a WebGL page under software GL can take >30 s to present a frame for the capture (CI flake)
   r={'hint':hint,'scanFound':found,'gatherLabel':label,'carried':carried,'walletFe':wallet,'hullBefore':hp0,'hullAfter':hp1,'vehicleVertsBefore':v0,'vehicleVertsAfter':v1,'plates':ap,'strike':strike,'threat':threat,'lowHull':lowText,'lowHullRoute':route,'pageErrors':errors,'scanHint':scanHint,'oreRoute':oreRoute}
   print(json.dumps(r),flush=True);json.dump(r,open(OUT/'journey.json','w'),indent=1)
   assert 'STARTER VEIN' in hint and found>=1 and 'STARTER VEIN' in label and '35 FERRITE' in carried and wallet>=40 and ap[0]==1 and hp1>hp0 and v1>v0 and 'METEOR STRIKE' in strike and not errors and scanHint=='SCAN · FIND ORE|true' and oreRoute.split('|')[1].endswith(' ORE') and ('ORE' in oreRoute.split('|')[2] or 'HOLD GATHER' in oreRoute.split('|')[2]) and 'FIND ORE' not in oreRoute.split('|')[3],r
   print('PASS minerals journey 390: scan -> Starter Vein -> gather -> bank to wallet -> first plate on the hull -> strike telegraph')
   await browser.close()
 finally:
  server.terminate();await server.wait()
asyncio.run(main())
