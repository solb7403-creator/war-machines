"""Mobile Session3.2: actual shipped client + real authenticated Worker reducer, test-owned DB only.
Raw visible-coordinate input; fixtures are explicit scenario placements, never fabricated kills/rewards.
Automated Chromium/WebKit evidence is not physical iPhone Telegram verification.
"""
import asyncio,argparse,json,pathlib,shutil,math,statistics,os
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-living-war';OUT.mkdir(exist_ok=True)
async def main(engine,journey_only=False,fallback=False):
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 try:
  async with async_playwright() as pw:
   opts={'headless':True}
   if engine=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
   browser=await getattr(pw,engine).launch(**opts);results=[]
   for width,height in ([(390,844)] if journey_only or fallback else [(320,568),(390,844)]):
    context=await browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.request.post(base+'/fixture',data={})
    await page.add_init_script('''window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.path.startswith('/api/conquest/'):
      response=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));
      if response.status>=400:print('API ERROR',u.path,response.status,(await response.text())[:250],flush=True)
      return await r.fulfill(status=response.status,body=await response.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.path.startswith('/api/'):
      if u.path=='/api/sync':
       response=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=response.status,body=await response.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
      return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
     await r.abort()
    await page.route('**/*',route)
    async def enter():
     await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();'+('save.gfx=\"2d\";' if fallback else '')+'');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
     if await page.locator('.cq-transmission').count():await tap('.cq-story-start')
     await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
    async def rect(selector):
     return await page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)};}''')
    async def tap(selector):
     r=await rect(selector);assert r['x']>=0 and r['y']>=0 and r['x']+r['w']<=width+1 and r['y']+r['h']<=page.viewport_size['height']+1 and r['hit'],(engine,width,selector,r);await page.touchscreen.tap(r['x']+r['w']/2,r['y']+r['h']/2)
    async def fixture(position=None,**kw):
     await page.evaluate('Conquest.view.reset();Conquest.view.authority.actionBusy=true');await page.wait_for_function('!Conquest.view.authority.busy');await page.request.post(base+'/fixture',data={**kw,**({'position':position} if position else {})});await page.evaluate('Conquest.view.authority.state=null;Conquest.view.authority.queue=[];Conquest.view.authority.phase=null;Conquest.view.authority.connect()');await page.wait_for_function('Conquest.view.authority.state?.seq===0&&Conquest.view.authority.connected');await page.evaluate('Conquest.view.authority.actionBusy=false');await page.wait_for_timeout(250)
    held=set()
    async def steer(target,fire=False):
     nonlocal held
     p=await page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,yaw:Conquest.view.yaw})')
     dx,dz=target['x']-p['x'],target['z']-p['z'];d=math.hypot(dx,dz);want=set()
     if d>6:
      x=(math.cos(p['yaw'])*dx-math.sin(p['yaw'])*dz)/d;z=(-math.sin(p['yaw'])*dx-math.cos(p['yaw'])*dz)/d
      if abs(x)>.3:want.add('d' if x>0 else 'a')
      if abs(z)>.3:want.add('w' if z>0 else 's')
     if fire:want.add('Space')
     for key in held-want:await page.keyboard.up(key)
     for key in want:await page.keyboard.down(key)
     held=want
    async def release_keys():
     nonlocal held
     for key in held:await page.keyboard.up(key)
     held=set()
    async def win_operation(id):
     for step in range(700):
      info=await page.evaluate('''()=>{const v=Conquest.view,B=v.battle||v.encounter,s=v.authority.state;if(!B)return {missing:true};const living=B.enemies.filter(e=>e.hp>0&&(!e.resident||!v.battle)&&(v.battle||Math.hypot(e.x-v.p.x,e.z-v.p.z)<75)),e=living.find(e=>e.id===B.carrierId)||living.sort((a,b)=>Math.hypot(a.x-v.p.x,a.z-v.p.z)-Math.hypot(b.x-v.p.x,b.z-v.p.z))[0];let pick=null;if(e&&ConquestControl.visible(B,v.p,e)){let hull=null;v.enemyMeshes.get(e.id)?.traverse(m=>{if(!hull&&m.isMesh&&m!==v.enemyMeshes.get(e.id).userData.marker)hull=m;});if(hull&&!hull.geometry.boundingBox)hull.geometry.computeBoundingBox();const center=hull?hull.geometry.boundingBox.getCenter(new v.T.Vector3()).applyMatrix4(hull.matrixWorld):new v.T.Vector3(e.x-v.origin.x,e.y+1,e.z-v.origin.z);const q=center.project(v.camera),r=v.host.getBoundingClientRect();const meshes=[];v.enemyMeshes.get(e.id)?.traverse(m=>{if(m.isMesh&&m!==v.enemyMeshes.get(e.id).userData.marker)meshes.push(m);});for(const [dx,dy] of [[0,0],[0,3],[0,-3],[3,0],[-3,0],[0,6]]){const x=(q.x+1)*r.width/2+dx,y=(1-q.y)*r.height/2+dy;if(document.elementFromPoint(x,y)!==v.renderer.domElement)continue;const ray=new v.T.Raycaster();ray.setFromCamera(new v.T.Vector2(x/r.width*2-1,1-y/r.height*2),v.camera);const hit=ray.intersectObjects(meshes,false)[0];if(hit&&ConquestCombat.lineClear({x:ray.ray.origin.x+v.origin.x,y:ray.ray.origin.y,z:ray.ray.origin.z+v.origin.z},{x:hit.point.x+v.origin.x,y:hit.point.y,z:hit.point.z+v.origin.z})){pick={id:e.id,x,y,visible:q.z<1};break;}}}return {state:s.battle.state,hp:s.hp,target:e?{x:e.x,z:e.z}:B.objective,selected:v.selectedId,pick,live:living.length};}''')
      if info.get('missing') or info['hp']<=0:
       await page.screenshot(path=str(OUT/f'{engine}-{width}-{id}-failure.png'));raise AssertionError((id,info))
      if (id!='perimeter' and info['state']=='victory') or (id=='perimeter' and not info['live']):break
      assert info['state']=='active',(id,info)
      pick=info.get('pick')
      if pick and pick['visible'] and pick['id']!=info['selected'] and 130<pick['y']<height-230 and 10<pick['x']<width-10:await page.mouse.click(pick['x'],pick['y'])
      target=info['target'];p=await page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z})');distance=math.hypot(target['x']-p['x'],target['z']-p['z'])
      await steer(target if not info['live'] or distance>28 or not info['selected'] else p,fire=bool(info['live']))
      if step%20==0:await page.keyboard.press('f')
      await page.wait_for_timeout(150)
     else:raise AssertionError(('mission did not finish',id,info))
     await release_keys()
     if id=='perimeter':return
     await page.wait_for_function('document.querySelector(".cq-result")');await page.screenshot(path=str(OUT/f'{engine}-{width}-{id}-victory.png'))
     assert await page.evaluate('Conquest.view.authority.state.settlement.cp>0')
     await page.get_by_role('button',name='RETURN TO EXPLORATION',exact=True).click()
     await page.wait_for_function('!Conquest.view.battle&&!Conquest.view.authority.actionBusy&&!Conquest.view.authority.state.mission')
     await page.evaluate('Conquest.view.distance=100;Conquest.view.pitch=.95;Conquest.view.yaw=-.8')
     await win_operation('perimeter')
    async def travel(x,z):
     for step in range(700):
      p=await page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,hp:Conquest.view.authority.state.hp,verified:Conquest.view.authority.state.position})');assert p['hp']>0,p
      if math.hypot(p['x']-x,p['z']-z)<=6 and math.hypot(p['verified']['x']-x,p['verified']['z']-z)<8:break
      await steer({'x':x,'z':z})
      if step%40==0:await page.keyboard.press('f')
      await page.wait_for_timeout(100)
     else:raise AssertionError(('travel blocked',x,z,p))
     await release_keys();await page.wait_for_timeout(1100)
    await enter()
    if fallback:assert await page.evaluate('Conquest.view.renderer.isConquestCanvas')
    await fixture([1500,1500])
    drive=await rect('.cq-stick');dash=await rect('#cq-dash');fire=await rect('#cq-fire');shield=await rect('#cq-shield')
    if engine=='chromium':
     cdp=await context.new_cdp_session(page)
     def contact(i,r,dy=0):return {'id':i,'x':r['x']+r['w']/2,'y':r['y']+r['h']/2+dy}
     left=contact(1,drive,-32);right=contact(2,fire);third=contact(3,dash)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left]})
     await page.wait_for_timeout(100)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right]})
     await page.wait_for_timeout(80)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right,third]})
     await page.wait_for_timeout(70)
     await page.wait_for_function('Conquest.view.encounter.dashCd>0&&Conquest.view.firing&&Math.hypot(Conquest.view.stick.x,Conquest.view.stick.z)>.5',timeout=10000)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[third]})
     third=contact(3,shield)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[left,right,third]})
     await page.wait_for_timeout(80)
     await page.wait_for_function('Conquest.view.encounter.shieldT>0&&Conquest.view.firing&&Math.hypot(Conquest.view.stick.x,Conquest.view.stick.z)>.5',timeout=10000)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[third]})
     await page.wait_for_timeout(1600)
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
     # Independent mouse DRIVE pointer plus native touch action, WebKit automation limitation.
     await page.mouse.move(drive['x']+drive['w']/2,drive['y']+drive['h']/2-32);await page.mouse.down()
     await tap('#cq-dash');await page.wait_for_timeout(80)
     assert await page.evaluate('Conquest.view.encounter.dashCd>3&&Math.hypot(Conquest.view.stick.x,Conquest.view.stick.z)>.5')
     await tap('#cq-shield');await page.wait_for_timeout(80)
     assert await page.evaluate('Conquest.view.encounter.shieldT>0')
     await page.wait_for_timeout(1200);await page.mouse.up()
    await page.wait_for_timeout(1500)
    canonical=await page.evaluate('Conquest.view.authority.state.battle');assert canonical['dashCd']>0 and canonical['shieldCd']>0
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-moving-controls.png'))
    await fixture([1080,1160],baseFunds=True)
    await tap('#cq-base-access')
    await page.get_by_role('button',name='CONSTRUCT BASE I',exact=False).click()
    await page.wait_for_function('Conquest.view.authority.state.base.tier===1')
    await page.get_by_role('button',name='CLOSE BASE',exact=True).click();await page.wait_for_timeout(150)
    await page.screenshot(path=str(OUT/f'{engine}-{width}-base-I.png'));await tap('#cq-base-access')
    await page.get_by_role('button',name='BUILD TIER 2',exact=False).click()
    await page.wait_for_function('Conquest.view.authority.state.base.tier===2')
    await page.get_by_role('button',name='BUILD REACTOR',exact=False).click()
    await page.wait_for_function('Conquest.view.authority.state.base.pending?.module==="reactor"')
    await page.get_by_role('button',name='CLOSE BASE',exact=True).click()
    await page.wait_for_timeout(250)
    await page.screenshot(path=str(OUT/f'{engine}-{width}-base-II.png'))
    before=await page.evaluate('Conquest.view.authority.state.base')
    await page.evaluate('Conquest.view.authority.connect()')
    assert await page.evaluate('Conquest.view.authority.state.base.tier===2')
    if width==390 and not fallback:
     for tier in [3,4,5]:
      await tap('#cq-base-access');await page.get_by_role('button',name='BUILD TIER '+str(tier),exact=False).click()
      await page.wait_for_function('(tier)=>Conquest.view.authority.state.base.tier===tier',arg=tier)
      await page.get_by_role('button',name='CLOSE BASE',exact=True).click();await page.wait_for_timeout(200)
      await page.screenshot(path=str(OUT/f'{engine}-{width}-base-{tier}.png'))
     await page.wait_for_function('Conquest.view.authority.state.base.modules.reactor===1',timeout=65000)
     await page.screenshot(path=str(OUT/f'{engine}-{width}-reactor-complete.png'))
    await fixture([994,944],weapon='moon',veteranLoadout=True)
    await tap('#cq-mission-access')
    assert await page.get_by_role('heading',name='SABOTAGE THE RELAY',exact=True).count()
    await page.get_by_role('button',name='START MISSION',exact=True).click()
    await page.wait_for_function('Conquest.view.authority.state.mission==="relay"')
    await page.wait_for_function('Conquest.view.battle?.projectiles.some(q=>q.team==="enemy")',timeout=20000)
    await page.screenshot(path=str(OUT/f'{engine}-{width}-relay-active.png'))
    await page.wait_for_function('Conquest.view.pending===0');await page.wait_for_timeout(1000)
    await page.evaluate('Conquest.view.frameSamples=[];Conquest.view.worstFrame=0;Conquest.view.hitches=0;Conquest.view.profileLast=performance.now()')
    await page.wait_for_timeout(10000)
    perf=await page.evaluate('Conquest.view.performanceReport()')
    print('PERFORMANCE software-rendered',json.dumps(perf),flush=True)
    results.append({'scenario':'relay mission with resident garrisons','performance':perf})
    if width==390 and not fallback:
     # Begin the outcome journey fresh; the preceding idle stress profile is a separate scenario.
     await fixture([994,944],weapon='moon',veteranLoadout=True)
     await tap('#cq-mission-access');await page.get_by_role('button',name='START MISSION',exact=True).click()
     await page.wait_for_function('Conquest.view.authority.state.mission==="relay"')
     await win_operation('relay')
     await travel(1090,944)
     await tap('#cq-mission-access');await page.get_by_role('button',name='START MISSION',exact=True).click()
     await page.wait_for_function('Conquest.view.authority.state.mission==="convoy"')
     await win_operation('convoy')
     assert await page.evaluate('Conquest.view.authority.state.completed.relay&&Conquest.view.authority.state.completed.convoy')
     for x,z in [(1145,934),(1145,995),(1240,1048),(1240,1128),(1174,1128),(1174,1168)]:await travel(x,z)
     await page.wait_for_function('!document.querySelector("#cq-supply-access").hidden');await tap('#cq-supply-access');await page.get_by_role('button',name='BANK SALVAGE',exact=True).click()
     await page.wait_for_function('Conquest.view.authority.state.ledger.cargo.alloy===0')
     assert await page.evaluate('Conquest.view.authority.state.ledger.banked.alloy>0')
     await page.screenshot(path=str(OUT/f'{engine}-{width}-verified-two-missions-banked.png'))
     await page.get_by_role('button',name='CLOSE SUPPLY',exact=True).click()
     results.append({'scenario':'two complete missions + physical travel + bank','automatedInput':'real keyboard DRIVE/FIRE + projected visible-hull clicks; initial epic test loadout/site fixture; no outcome/position/loot claims'})
    await fixture([1174,1168],engineering=True)
    await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='INVENTORY / SUPPLY',exact=True).click()
    await page.get_by_text('Thermal Systems',exact=True).click()
    await page.get_by_role('button',name='UPGRADE HEAT CAPACITY',exact=True).click()
    await page.wait_for_function('Conquest.view.authority.state.engineering.ranks.heatCapacity===1')
    await page.get_by_text('Thermal Systems',exact=True).click()
    await page.get_by_label('Thermal Systems specialization').fill('3')
    await page.get_by_role('button',name='SAVE SPECIALIZATION',exact=True).first.click()
    await page.wait_for_function('Conquest.view.authority.state.engineering.tuning.thermal===3')
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-engineering.png'))
    await page.get_by_role('button',name='CLOSE SUPPLY').click()
    await fixture([1500,1500],weapon='moon',superReady=True)
    await page.evaluate('Conquest.view.aimYaw=Conquest.view.yaw+Math.PI;Conquest.view.aimPitch=.3')
    await page.mouse.move(fire['x']+fire['w']/2,fire['y']+fire['h']/2);await page.mouse.down()
    await page.wait_for_function("Conquest.view.encounter.projectiles.some(p=>p.kind==='moon')")
    await page.evaluate('Conquest.view.authority.actionBusy=true')
    await page.wait_for_timeout(100)
    if not fallback:assert await page.evaluate("Conquest.view.shotMeshes.some(g=>g.visible&&g.children[0].geometry===Conquest.view.cylinder&&g.children[0].scale.y/g.children[0].scale.x>50)")
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-moonbeam.png'))
    await page.evaluate('Conquest.view.authority.actionBusy=false');await page.wait_for_timeout(4500);await page.mouse.up()
    assert await page.evaluate('Conquest.view.encounter.heat>0')
    await tap('#cq-super')
    await page.wait_for_function("Conquest.view.encounter.effects.some(e=>e.kind==='beam'&&e.weapon==='moon')")
    await page.evaluate('Conquest.view.authority.actionBusy=true');await page.wait_for_timeout(100)
    await page.screenshot(path=str(OUT/f'{engine}{'-fallback' if fallback else ''}-{width}-moonfall.png'))
    await page.evaluate('Conquest.view.authority.actionBusy=false')
    if width==390 and not fallback:
     await page.evaluate('window.preLoss=Conquest.view.authority.state.hp;Conquest.view.renderer.forceContextLoss()')
     await page.wait_for_function('Conquest.view.renderer.isConquestCanvas')
     assert await page.evaluate('Conquest.view.authority.state.hp===preLoss&&Conquest.view.authority.connected')
     await page.set_viewport_size({'width':width,'height':height-100});await page.wait_for_timeout(100)
     assert await page.locator('.cq-world').evaluate('(e)=>e.getBoundingClientRect().height<=innerHeight')
     await page.set_viewport_size({'width':width,'height':height})
    assert not errors,errors
    results.append({'viewport':[width,height],'multiPointer':'native three-touch' if engine=='chromium' else 'mouse DRIVE plus native touch abilities','errors':errors})
    await page.evaluate('Conquest.view?.authority?.dispose()');await page.unroute_all(behavior='ignoreErrors');await context.close();print('PASS',engine,width,height,flush=True)
   await browser.close();(OUT/f'{engine}{"-fallback" if fallback else ""}-results.json').write_text(json.dumps({'engine':engine,'physicalTelegramVerified':False,'cases':results},indent=2))
 finally:server.terminate();await server.wait()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--engine',choices=['chromium','webkit'],default='chromium');a.add_argument('--fallback',action='store_true');a.add_argument('--journey-only',action='store_true');args=a.parse_args();asyncio.run(main(args.engine,journey_only=args.journey_only,fallback=args.fallback))
