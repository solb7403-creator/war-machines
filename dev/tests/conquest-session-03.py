"""Real rendered Session 3 integration/evidence; diagnostic relocation never grants discovery."""
import asyncio,json,pathlib,time
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest-session-03';OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=await b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
  async def route(r):
   from urllib.parse import urlparse
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html?conquestDev=1');await page.wait_for_function('typeof Conquest!=="undefined"')
  await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000)
  # Diagnostic jump itself must never reveal land or mission details.
  await page.evaluate('Conquest.view.jump(1283,1104)');before=await page.evaluate('Conquest.view.discovery.version');await page.wait_for_timeout(300);assert before==await page.evaluate('Conquest.view.discovery.version')
  await page.evaluate('''()=>{const v=Conquest.view;v.resume=false;for(let i=0;i<60;i++){v.p=ConquestWorld.advance(v.p,0,.2);}v.tick(.016);}''');await page.screenshot(path=str(OUT/'01-hillside.png'))
  # Relocate to known bridge approach, then physically drive continuous route into mission area.
  await page.evaluate('''()=>{const v=Conquest.view,W=ConquestWorld;v.jump(898,1024);v.resume=false;for(const [dx,dz,n] of [[.2,0,1310],[0,.2,120]])for(let i=0;i<n;i++){const old=v.p;v.p=W.advance(old,dx,dz);v.discovery.accept(old,v.p,.025,10);}v.tick(.016);}''')
  await page.wait_for_timeout(200);assert await page.evaluate('Conquest.view.discovery.has(1160,1048)')
  await page.get_by_role('button',name='OXYGEN LINE · BRIEFING').click();await page.screenshot(path=str(OUT/'02-briefing.png'));await page.get_by_role('button',name='START MISSION',exact=True).click();assert await page.evaluate('Conquest.view.battle.state==="active"');assert await page.evaluate('Conquest.view.speed===Conquest.view.battle.combatSpeed')
  # Simultaneous real mobile touch contacts drive, aim, fire and orbit independently.
  start=await page.evaluate('[Conquest.view.p.x,Conquest.view.p.z,Conquest.view.yaw]')
  cdp=await page.context.new_cdp_session(page)
  contacts=[{'id':1,'x':86,'y':755},{'id':2,'x':315,'y':675},{'id':3,'x':315,'y':785},{'id':4,'x':200,'y':300}]
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':contacts})
  contacts[0]['x']=110;contacts[0]['y']=725;contacts[1]['x']=300;contacts[3]['x']=220
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':contacts});await page.wait_for_timeout(350)
  finish=await page.evaluate('[Conquest.view.p.x,Conquest.view.p.z,Conquest.view.yaw]')
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[contacts[0]]})
  assert await page.evaluate('Conquest.view.firing'),'releasing DRIVE must preserve held FIRE'
  await page.wait_for_timeout(250)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  assert finish[:2]!=start[:2] and finish[2]!=start[2],'simultaneous drive and camera must work'
  assert await page.evaluate('Conquest.view.battle.shots>0&&!Conquest.view.firing')
  # Real combat loop: aim through actual visible hulls; do not alter enemy HP or battle results.
  await page.evaluate('''window.cqSamples=[];window.cqTick=Conquest.view.tick.bind(Conquest.view);Conquest.view.tick=function(dt){const t=performance.now(),wall=t-(window.cqLastRender||t);window.cqLastRender=t;cqTick(dt);if(this.battle?.state==='active')cqSamples.push({frameMs:wall,cpuMs:performance.now()-t,simMs:this.simMs,calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});};window.cqDeltas=[];window.cqLast=performance.now();window.cqProbe=setInterval(()=>{const now=performance.now();cqDeltas.push(now-cqLast);cqLast=now;const v=Conquest.view,B=v?.battle;if(!B||B.state!=='active')return;const e=B.enemies.find(e=>e.hp>0);if(e){v.aimYaw=Math.atan2(e.x-v.p.x,e.z-v.p.z);v.firing=true;}},50);''')
  await page.wait_for_timeout(2500);await page.screenshot(path=str(OUT/'03-firing.png'));await page.evaluate('window.cqMeasured=cqSamples.slice()');pass # third-wave screenshot captured below
  await page.evaluate('''()=>{clearInterval(cqProbe);const v=Conquest.view;v.firing=false;for(let i=0;i<400&&v.battle.state==='active';i++)v.combatTick(.1);v.tick(.016);}''');await page.screenshot(path=str(OUT/'05-oxygen-defense.png'))
  # Advance production ticks faster than wall clock to exercise the full battle without fake damage.
  await page.evaluate('''()=>{const v=Conquest.view,B=v.battle;for(let i=0;i<1800&&B.state==='active'&&B.wave<3;i++){const e=B.enemies.find(e=>e.hp>0);if(e)v.aimYaw=Math.atan2(e.x-v.p.x,e.z-v.p.z);v.firing=true;v.combatTick(.1);}v.firing=false;v.tick(.016);}''')
  await page.screenshot(path=str(OUT/'04-armored-assault.png'))
  result=await page.evaluate('''()=>{const v=Conquest.view,B=v.battle;for(let i=0;i<1800&&B.state==='active';i++){const e=B.enemies.find(e=>e.hp>0);if(e)v.aimYaw=Math.atan2(e.x-v.p.x,e.z-v.p.z);v.firing=true;v.combatTick(.1);}return {state:B.state,hp:B.playerHp,oxygen:B.objectiveHp,kills:B.kills,wave:B.wave};}''');print('battle',result)
  await page.wait_for_timeout(300);await page.screenshot(path=str(OUT/'06-result.png'));assert result['state']=='victory',result
  perf=await page.evaluate('''({drawCalls:Conquest.view.renderer.info.render.calls,triangles:Conquest.view.renderer.info.render.triangles,fps:Conquest.view.fps,simulationMs:Conquest.view.simMs,activeSamples:cqMeasured,geometries:Conquest.view.renderer.info.memory.geometries})''')
  await page.get_by_role('button',name='RETURN TO EXPLORATION',exact=True).click();await page.get_by_role('button',name='OPEN MAP',exact=True).click();assert await page.locator('.cq-map-mission').inner_text()=='HOLD THE OXYGEN LINE · SECURED · PERSONAL COMPLETION';await page.screenshot(path=str(OUT/'07-secured-map.png'));await page.get_by_role('button',name='CLOSE MAP',exact=True).click();await page.screenshot(path=str(OUT/'08-exploration.png'))
  # Defeat, retry and repeat cleanup leave no combat models or pooled effects.
  await page.get_by_role('button',name='OXYGEN SECURED · REPLAY').click();await page.get_by_role('button',name='START MISSION',exact=True).click();await page.evaluate('Conquest.view.battle.playerHp=0');await page.wait_for_timeout(150);assert await page.get_by_role('heading',name='DEFENSE LOST').is_visible();await page.get_by_role('button',name='RETURN TO EXPLORATION',exact=True).click();assert await page.evaluate('Conquest.view.enemyMeshes.size===0&&Conquest.view.shotMeshes.length===0')
  await page.get_by_role('button',name='← RETURN TO CONQUEST',exact=True).click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000);assert await page.evaluate('Conquest.view.progress.completed("oxygen-line")');assert not errors,errors
  await page.evaluate('Conquest.view.renderer.getContext().getExtension("WEBGL_lose_context").loseContext()');await page.wait_for_timeout(300)
  assert await page.get_by_text('WebGL context lost. Return to Conquest and re-enter.',exact=True).is_visible()
  await page.get_by_role('button',name='RETURN TO CONQUEST',exact=True).click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000)

  await page.reload();await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000);assert await page.evaluate('Conquest.view.progress.completed("oxygen-line")')
  cleanup=await page.evaluate('''()=>{const v=Conquest.view;for(let i=0;i<5;i++){if(!v.startMission())throw Error('replay entry');v.tick(.016);v.clearBattle();v.tick(.016);if(v.enemyMeshes.size||v.shotMeshes.length||v.effectMeshes.length)throw Error('combat leak');}return {cycles:5,sceneChildren:v.scene.children.length,geometries:v.renderer.info.memory.geometries,drawCalls:v.renderer.info.render.calls};}''')
  (OUT/'browser-results.json').write_text(json.dumps({'viewport':'390x844 Chromium SwiftShader; not physical iPhone','battle':result,'cleanup':cleanup,'performance':perf,'errors':errors},indent=2));print(json.dumps(perf));await b.close()
asyncio.run(main())
