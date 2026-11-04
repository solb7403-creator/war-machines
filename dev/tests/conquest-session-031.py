"""Actual portrait controls and rendered gameplay; diagnostic placement is identified explicitly."""
import asyncio,json,pathlib,time,math,shutil
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-session-031';OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
  async def route(r):
   from urllib.parse import urlparse
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
  await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.get_by_role('button',name='ACKNOWLEDGE · BEGIN EXPLORATION').click();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000)
  await page.evaluate('()=>{window.accountBefore=JSON.stringify({pts:save.pts,buys:save.buys,up:save.up});window.samples=[];const v=Conquest.view,original=v.tick.bind(v);v.tick=function(dt){const t=performance.now();original(dt);samples.push({wallMs:t-(window.lastFrame||t),cpuMs:performance.now()-t,simMs:this.simMs,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries});window.lastFrame=t;};}')
  async def drive(key,condition,timeout=90000):
   await page.keyboard.down(key)
   try:await page.wait_for_function(condition,timeout=timeout)
   except Exception:
    print('DRIVE FAILED',key,condition,await page.evaluate('Conquest.view.p'),flush=True);await page.screenshot(path=str(OUT/'failed-drive.png'));raise
   finally:await page.keyboard.up(key)
  assert await page.evaluate('Conquest.view.p.x===898&&Conquest.view.p.z===1024')
  await drive('w','Conquest.view.p.x>=1142')
  await page.screenshot(path=str(OUT/'bridge-driving.png'))
  await drive('w','Conquest.view.p.x>=1159')
  await drive('d','Conquest.view.p.z>=1047')
  assert await page.locator('#cq-mission-access').is_visible()
  # Explicit reported placements, each followed by actual key input in all cardinal directions.
  movement=[]
  for x,z in [(1351,1063),(1283,1104),(1163,1132)]:
   for key in ['w','s','a','d']:
    await page.evaluate('([x,z])=>{Conquest.view.jump(x,z);Conquest.view.yaw=-Math.PI/2}',[x,z]);await page.wait_for_timeout(150)
    start=await page.evaluate('[Conquest.view.p.x,Conquest.view.p.z]')
    await page.keyboard.down(key);await page.wait_for_timeout(450);await page.keyboard.up(key)
    end=await page.evaluate('[Conquest.view.p.x,Conquest.view.p.z]');distance=math.dist(start,end);assert distance>1,(x,z,key,start,end)
    movement.append({'x':x,'z':z,'input':key,'distance':distance})
   await page.screenshot(path=str(OUT/f'terrain-{x}-{z}.png'))
  # Real mobile DRIVE contact at reported hillside, with orbit camera fixed for measurable direction.
  await page.evaluate('Conquest.view.jump(1283,1104);Conquest.view.yaw=-Math.PI/2')
  cdp=await page.context.new_cdp_session(page);start=await page.evaluate('Conquest.view.p.x')
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':86,'y':755}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':86,'y':715}]});await page.wait_for_timeout(700)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert await page.evaluate('Conquest.view.p.x')>start+1
  # Start from the owner's reported position. No fake mission discovery needed.
  await page.evaluate('Conquest.view.jump(1163,1132)');await page.wait_for_timeout(200)
  await page.get_by_role('button',name='OXYGEN FACILITY UNDER THREAT — START DEFENSE',exact=True).click();await page.get_by_role('button',name='START MISSION',exact=True).click()
  assert await page.evaluate('Conquest.view.battle.approachGrace===60')
  # Physically circle west of the processor tower, then enter the north firing approach.
  await page.evaluate('Conquest.view.yaw=-Math.PI/2')
  await drive('s','Conquest.view.p.x<=1128');await drive('a','Conquest.view.p.z<=1048');await drive('w','Conquest.view.p.x>=1160')
  await page.screenshot(path=str(OUT/'deployment.png'))
  # Aim at real hostile hulls, use actual held FIRE, then accelerate production combat ticks.
  await page.evaluate('window.autoAim=setInterval(()=>{const v=Conquest.view,e=v.battle.enemies.find(e=>e.hp>0);if(e)v.aimYaw=Math.atan2(e.x-v.p.x,e.z-v.p.z);},30)')
  await page.keyboard.down('Space');await page.wait_for_timeout(1800);await page.screenshot(path=str(OUT/'active-combat.png'));await page.keyboard.up('Space');await page.evaluate('clearInterval(autoAim)')
  battle=await page.evaluate('''()=>{const v=Conquest.view,B=v.battle;for(let i=0;i<1800&&B.state==='active';i++){const e=B.enemies.find(e=>e.hp>0);if(e)v.aimYaw=Math.atan2(e.x-v.p.x,e.z-v.p.z);v.firing=true;v.combatTick(.1);}v.firing=false;return {state:B.state,kills:B.kills,wave:B.wave,oxygen:B.objectiveHp,hp:B.playerHp};}''')
  assert battle['state']=='victory',battle
  await page.wait_for_timeout(150);await page.screenshot(path=str(OUT/'victory.png'));await page.get_by_role('button',name='RETURN TO EXPLORATION',exact=True).click()
  # Independently encountered outpost, actual damage using the shared combat path.
  await page.evaluate('Conquest.view.jump(1240,893);Conquest.view.yaw=Math.PI;Conquest.view.distance=65;Conquest.view.pitch=.8');await page.wait_for_timeout(400);await page.screenshot(path=str(OUT/'garrison.png'))
  assert await page.locator('#cq-fire').is_visible()
  guard=await page.evaluate('''()=>{const v=Conquest.view,B=v.encounter,e=B.enemies.find(e=>e.base.kind==='outpost'&&e.hp>0);for(let i=0;i<600&&e.hp>0;i++){v.aimYaw=Math.atan2(e.x-v.p.x,e.z-v.p.z);v.firing=true;v.combatTick(.1);}v.firing=false;return {hp:e.hp,cleared:B.cleared[e.key],player:B.playerHp,x:e.x,z:e.z,px:v.p.x,pz:v.p.z,clear:ConquestCombat.lineClear({x:v.p.x,y:v.p.y+2.2,z:v.p.z},{x:e.x,y:e.y+2.2,z:e.z})};}''')
  assert guard['hp']==0 and guard['cleared'],guard
  assert await page.evaluate('Object.keys(JSON.parse(localStorage.getItem("lunar-conquest-garrisons-v1"))).length>0'),'guard defeat must persist immediately'
  await page.screenshot(path=str(OUT/'outpost-combat.png'));await page.evaluate('Conquest.view.jump(1265,920);Conquest.view.yaw=Math.PI/2;Conquest.view.distance=100;Conquest.view.pitch=.9');await page.wait_for_timeout(200);await page.screenshot(path=str(OUT/'parasite-installation.png'))
  # Verified breadcrumb produced by real driving into a solid tower.
  await page.evaluate('Conquest.view.jump(1130,1080);Conquest.view.yaw=-Math.PI/2;Conquest.view.safeHistory=[];Conquest.view.stuckSeconds=0')
  await drive('w','Conquest.view.stuckSeconds>1.6',15000)
  before=await page.evaluate('({version:Conquest.view.discovery.version,p:{...Conquest.view.p}})')
  await page.get_by_role('button',name='RECOVER VEHICLE',exact=True).click();await page.wait_for_timeout(100)
  recovered=await page.evaluate('({version:Conquest.view.discovery.version,p:Conquest.view.p})');assert recovered['version']==before['version'];assert math.dist([before['p']['x'],before['p']['z']],[recovered['p']['x'],recovered['p']['z']])>=6
  await page.screenshot(path=str(OUT/'recovered.png'))
  assert await page.evaluate('JSON.stringify({pts:save.pts,buys:save.buys,up:save.up})===accountBefore')
  cleanup=await page.evaluate('''()=>{const v=Conquest.view,checks=[];for(let i=0;i<3;i++){v.jump(15000,8000);for(let j=0;j<45;j++)v.tick(.016);if(v.enemyMeshes.size)throw Error('remote enemy mesh leak');v.jump(1240,893);for(let j=0;j<45;j++)v.tick(.016);checks.push({geometries:v.renderer.info.memory.geometries,meshes:v.enemyMeshes.size,cleared:Object.keys(v.encounter.cleared).length});}if(checks[2].geometries>checks[0].geometries+3)throw Error('unbounded geometry growth');return checks;}''')
  perf=await page.evaluate('({samples,heap:performance.memory?.usedJSHeapSize,geometries:Conquest.view.renderer.info.memory.geometries})')
  assert not errors,errors
  result={'environment':'390x844 Chromium SwiftShader, not physical iPhone','movement':movement,'battle':battle,'guard':guard,'cleanup':cleanup,'recovery':{'before':before,'after':recovered},'performance':perf,'errors':errors}
  (OUT/'gameplay-results.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='performance'}));await browser.close()
asyncio.run(main())
