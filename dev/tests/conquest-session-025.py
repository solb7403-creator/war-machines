"""Mobile software WebGL evidence. Runs local source only; no accounts or production writes."""
import asyncio,json,pathlib,subprocess
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest-session-025'
async def main():
 OUT.mkdir(exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  results={}
  for baseline in [True,False]:
   page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
   errors=[];page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' and ('Shader' in msg.text or 'VALIDATE_STATUS' in msg.text) else None);page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR:',str(e),flush=True)))
   await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
   async def route(r):
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.netloc!='lunar.test':return await r.abort()
    rel=u.path.lstrip('/')
    if baseline and rel in ['js/conquest/world.js','js/conquest/view.js','js/conquest/app.js','js/main.js','css/conquest.css']:
     body=subprocess.check_output(['git','show','3815dfd:'+rel],cwd=ROOT)
     return await r.fulfill(body=body,content_type='text/css' if rel.endswith('.css') else 'text/javascript')
    if f.is_file():return await r.fulfill(path=str(f))
    await r.fulfill(status=404,body='')
   await page.route('**/*',route)
   await page.goto('https://lunar.test/index.html?conquestDev=1')
   await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.evaluate('closeAll();save.welcomed=true;uiDirty();Conquest.open();')
   if not baseline:
    await page.screenshot(path=str(OUT/'hub.png'))
    assert await page.evaluate('document.querySelector(".cq").scrollWidth<=innerWidth')
   await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   await page.wait_for_function('Conquest.view&&Conquest.view.pending===0&&Conquest.view.chunks.has(Math.floor(Conquest.view.p.x/128)+":"+Math.floor(Conquest.view.p.z/128))',timeout=90000)
   await page.evaluate('Conquest.view.jump(1210,1130)')
   await page.wait_for_function('Conquest.view.pending===0&&Conquest.view.chunks.has(Math.floor(Conquest.view.p.x/128)+":"+Math.floor(Conquest.view.p.z/128))',timeout=90000)
   metrics=await page.evaluate('''async()=>{const v=Conquest.view;v.reset();const tick=v.tick;let cpu=[],frames=[];v.tick=function(dt){const start=performance.now();tick.call(this,dt);cpu.push(performance.now()-start);};try{for(let i=0;i<80;i++)frames.push(await new Promise(requestAnimationFrame));}finally{v.tick=tick;}return {viewport:'390x844',frameP95Ms:frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b)[Math.floor((frames.length-1)*.95)],cpuP95Ms:[...cpu].sort((a,b)=>a-b)[Math.floor(cpu.length*.95)],fogNear:v.scene.fog.near,fogFar:v.scene.fog.far,cameraFar:v.camera.far,chunks:v.chunks.size,geometries:v.renderer.info.memory.geometries,textures:v.renderer.info.memory.textures,calls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,horizonVertices:v.horizon.geometry.attributes.position.count,horizonTriangles:v.horizon.geometry.index.count/3,horizonBytes:Object.values(v.horizon.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+v.horizon.geometry.index.array.byteLength,pending:v.pending,builds:v.builds,buildBudget:2,fineTerrainRadius:v.detailRadius||2,cpuTickMs:cpu.reduce((a,b)=>a+b,0)/cpu.length,observedRafFPS:1000*(frames.length-1)/(frames.at(-1)-frames[0])};}''')
   results['before' if baseline else 'after']=metrics
   if not baseline:
    # Actual rendered world and map UI must never award exploration. Physical ticks do.
    proof=await page.evaluate("""()=>{const v=Conquest.view,d=v.discovery;const initial=d.version;v.stream();v.jump(28000,42000);v.tick(0);if(d.version!==initial)throw Error('jump/stream discovery');v.jump(980,1024);v.p.surface='bridge';v.p.y=24;v.resume=false;v.keys={KeyW:true};for(let i=0;i<100;i++)v.tick(.1);v.keys={};if(d.version<=initial)throw Error('physical driving failed to reveal');d.flush();return {version:d.version,regions:d.regions.size,discovered:d.has(v.p.x,v.p.z),unknown:!d.has(28000,42000),saved:JSON.stringify(save.conquestDiscovery)};}""")
    assert proof['discovered'] and proof['unknown']
    await page.get_by_role('button',name='OPEN MAP',exact=True).click()
    await page.screenshot(path=str(OUT/'discovered-map.png'))
    await page.get_by_role('button',name='WHOLE WORLD',exact=True).click()
    await page.screenshot(path=str(OUT/'undiscovered-map.png'))
    await page.get_by_role('button',name='＋',exact=True).last.click()
    await page.get_by_role('button',name='LOCATE SELF',exact=True).click()
    assert await page.evaluate('Conquest.view.discovery.version')==proof['version']
    await page.keyboard.press('Escape')
    results['discovery']=proof
    await page.evaluate("""()=>{const v=Conquest.view;v.jump(980,1024);v.p.surface='bridge';v.p.y=24;v.resume=false;v.distance=16;v.pitch=.25;v.keys={KeyW:true};for(let i=0;i<10;i++)v.tick(.1);}""")
    await page.screenshot(path=str(OUT/'tracks-driving.png'))
    await page.evaluate('Conquest.view.keys={}')
    # Real legal active builds; change bay and permanent upgrades and re-enter.
    parity=await page.evaluate('''()=>{const v=Conquest.view,ids=Object.keys(save.lab.machines),a=save.lab.active;v.syncLoadout();const before=v.speed;save.up.engine=4;v.syncLoadout();if(!(v.speed>before))throw Error('stale Engine');save.cOwn.scout=[0];const spare=ids.find(x=>x!==a);save.lab.machines[spare].spec.c={c:'scout',t:0,s:false};save.lab.active=spare;v.syncLoadout();if(v.loadout.c.c!=='scout')throw Error('wrong model identity');if(v.speed!==ConquestWorld.travelSpeed(myLoadout()))throw Error('stale bay');return {active:save.lab.active,speed:v.speed,expected:machineMetrics(myLoadout()).spd};}''')
    results['activeBay']=parity
    for name,x,z,yaw,pitch,distance in [('high-ground',13920,8048,3.8,.08,23),('vista',13900,8020,.76,.3,55),('forestry',16000,10000,.8,.28,28),('oxygen',900,920,-2.1,.08,40),('outpost',1140,1125,3.14159,.45,35),('barren',15840,23760,-.4,.3,55),('bridge-top',1024,1024,-.7,.6,40),('underpass',1024,1010,0,.25,23)]:
     await page.evaluate('''([x,z,yaw,pitch,d,name])=>{const v=Conquest.view;v.jump(x,z);if(name==='bridge-top'){v.p.surface='bridge';v.p.y=24;}v.yaw=yaw;v.pitch=pitch;v.distance=d;}''',[x,z,yaw,pitch,distance,name])
     await page.wait_for_function('Conquest.view.pending===0&&Conquest.view.chunks.has(Math.floor(Conquest.view.p.x/128)+":"+Math.floor(Conquest.view.p.z/128))',timeout=90000)
     await page.evaluate('document.querySelector(".cq-hint")?.remove()')
     await page.screenshot(path=str(OUT/(name+'.png')))
    await page.get_by_role('button',name='OPEN MAP',exact=True).click()
    await page.screenshot(path=str(OUT/'map.png'))
    canvas=page.locator('.cq-map canvas');box=await canvas.bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
    original=await canvas.evaluate('(c)=>c.toDataURL()');cdp=await page.context.new_cdp_session(page)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-25,'y':cy},{'x':cx+25,'y':cy}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-60,'y':cy},{'x':cx+60,'y':cy}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert original!=await canvas.evaluate('(c)=>c.toDataURL()'),'map pinch must change rendered scale'
    await page.get_by_role('button',name='＋',exact=True).last.click()
    await page.get_by_role('button',name='LOCATE SELF',exact=True).click()
    await page.keyboard.press('Escape')
    assert await page.evaluate('!document.querySelector(".cq-dialog")')
    # True touch orbit/zoom, and visibility/input reset.
    await page.evaluate('''()=>{const c=Conquest.view.renderer.domElement;for(const [type,id,x,y] of [['pointerdown',1,200,400],['pointermove',1,250,430],['pointerup',1,250,430]])c.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y}));Conquest.view.zoom(-8);Conquest.view.reset();}''')
    await page.get_by_role('button',name='← RETURN TO CONQUEST',exact=True).click()
    await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view&&Conquest.view.pending===0&&Conquest.view.chunks.has(Math.floor(Conquest.view.p.x/128)+":"+Math.floor(Conquest.view.p.z/128))',timeout=90000)
    assert await page.evaluate('Conquest.view.speed===ConquestWorld.travelSpeed(myLoadout())')
    assert await page.evaluate('Conquest.view.discovery.has(1060,1024)'),'visited bridge survives re-entry'
    # Repeated streaming/disposal remains bounded over an extended simulated crossing.
    stress=await page.evaluate('''()=>{const v=Conquest.view,render=v.renderer.render;v.renderer.render=()=>{};let maxChunks=0;try{for(let k=0;k<8;k++){v.jump(14000+k*128,8000);for(let i=0;i<45;i++)v.tick(.016);maxChunks=Math.max(maxChunks,v.chunks.size);}}finally{v.renderer.render=render;}v.tick(0);const pos={...v.p};v.keys={KeyW:true};window.dispatchEvent(new Event('blur'));v.tick(.25);if(v.p.x!==pos.x||v.p.z!==pos.z)throw Error('stale resume movement');return {maxChunks,finalChunks:v.chunks.size,geometries:v.renderer.info.memory.geometries,pending:v.pending};}''')
    assert stress['maxChunks']<=81 and stress['pending']==0
    results['streamingStress']=stress
    # Native context-loss recovery path.
    await page.evaluate("Conquest.view.renderer.getContext().getExtension('WEBGL_lose_context').loseContext()")
    await page.get_by_role('button',name='RETURN TO CONQUEST',exact=True).click()
    await page.get_by_role('button',name='← RETURN TO ARCADE',exact=True).click()
    assert await page.evaluate('!Conquest.active&&!document.querySelector("#app").inert')
    for width in [320,430]:
     await page.set_viewport_size({'width':width,'height':740})
     await page.evaluate('Conquest.open()')
     assert await page.evaluate('document.querySelector(".cq").scrollWidth<=innerWidth')
     await page.get_by_role('button',name='← RETURN TO ARCADE',exact=True).click()
   assert not errors,errors
   results['beforeErrors' if baseline else 'afterErrors']=errors
   await page.close()
  await browser.close()
  (OUT/'performance.json').write_text(json.dumps(results,indent=2))
  print(json.dumps(results,indent=2))
asyncio.run(main())
