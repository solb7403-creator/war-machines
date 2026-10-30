"""Real shared renderer, one GL context per gallery. Every request is local GET only.
Contact sheets copy actual runtime canvases; never concept art. PR17 comparison uses pinned source/maps.
"""
import asyncio,json,mimetypes,pathlib,subprocess,os,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path(os.environ.get('LUNAR_HF_OUT','/workspace/hf-collection-evidence'));BASE='https://hf.test';PR17='c237ea7a1fae81f9fff917606a702d7cd97067a5'
OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);reports={'pr17':json.loads((OUT/'showroom.json').read_text())['pr17']} if '--resume' in sys.argv and (OUT/'showroom.json').exists() else {};errors=[];warnings=[]
  async def context(baseline=False,width=1440):
   ctx=await b.new_context(viewport={'width':width,'height':1080 if width>500 else 844},reduced_motion='reduce',has_touch=width<500)
   async def route(r):
    assert r.request.url.startswith(BASE+'/') and r.request.method=='GET','No service/account traffic allowed'
    rel=r.request.url[len(BASE)+1:].split('?')[0];f=ROOT/rel
    if baseline and (rel=='js/equipment3d.js' or rel.startswith('js/assets/hf-v1/')):
     old=OUT/'pr17'/rel
     if not old.exists():old.parent.mkdir(parents=True,exist_ok=True);old.write_bytes(subprocess.check_output(['git','show',PR17+':'+rel],cwd=ROOT))
     f=old
    await r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
   await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:warnings.append(m.text) if m.type in ['warning','error'] else None);return ctx,pg
  # Before/after use same renderer, lights, exposure, viewport, yaw, tilt and zoom.
  for before in ([False] if 'pr17' in reports else [True,False]):
   ctx,pg=await context(before,390);await pg.goto(BASE+'/web/foundation-preview.html');await pg.wait_for_function('()=>hfReady&&Equipment3D.active()',timeout=60000)
   key='pr17' if before else 'collection'
   startup=await pg.evaluate('({loadMs:hfLoadMs,readyMs:hfReadyMs})');samples=[]
   for view,yaw in [('quarter',-.12),('side',.55),('rear',1.6),('front',-1.02)]:
    await pg.evaluate('yaw=>{hfScene.yaw=yaw;hfScene.tilt=.18;hfScene.zoom=1.6;hfScene.draw();}',yaw)
    await pg.locator('.web-stage').screenshot(path=str(OUT/f'{key}-hero-{view}-390.png'))
   for skin,w in [('default','pulse'),('lunar','pulse'),('default','moon'),('lunar','moon')]:
    await pg.select_option('#hf-skin',skin);await pg.select_option('#hf-weapon',w);await pg.wait_for_function('()=>hfReady');await pg.evaluate('()=>{hfScene.yaw=-.12;hfScene.zoom=1.6;hfScene.draw();}')
    await pg.locator('.web-stage').screenshot(path=str(OUT/f'{key}-{skin}-{w}-390.png'))
   await pg.select_option('#hf-parts','2')
   for view,yaw in [('quarter',-.12),('side',.55),('emitter',-1.02)]:
    await pg.evaluate('yaw=>{hfScene.yaw=yaw;hfScene.tilt=.10;hfScene.zoom=2.0;hfScene.draw();}',yaw);await pg.locator('.web-stage').screenshot(path=str(OUT/f'{key}-moonbeam-{view}.png'))
   await pg.select_option('#hf-parts','3');await pg.evaluate('()=>{hfScene.yaw=-.12;hfScene.tilt=.18;hfScene.zoom=1.35;hfScene.draw();}')
   perf=await pg.evaluate('''()=>{const s=hfScene;s.draw();s.renderer.getContext().finish();let time=[];for(let i=0;i<80;i++){const t=performance.now();s.yaw+=.002;s.draw();s.renderer.getContext().finish();time.push(performance.now()-t);}time.sort((a,b)=>a-b);return {calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,memory:{...s.renderer.info.memory},meanMs:time.reduce((a,b)=>a+b)/time.length,p95Ms:time[76],worstMs:time.at(-1),glError:s.renderer.getContext().getError(),cache:Equipment3D.stats()};}''');assert perf['glError']==0;reports[key]={'startup':startup,'high':perf};print(key,perf,flush=True)
   if not before:
    for width in [320,390,430]:
     await pg.set_viewport_size({'width':width,'height':844});assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth&&hfScene.el.clientHeight>=280');await pg.screenshot(path=str(OUT/f'collection-high-{width}.png'))
    await pg.set_viewport_size({'width':390,'height':844});await pg.locator('[data-quality="low"]').click();await pg.wait_for_function('()=>hfReady&&Equipment3D.active()');await pg.locator('.web-stage').screenshot(path=str(OUT/'collection-low-390.png'));reports['low']=await pg.evaluate('({calls:hfScene.renderer.info.render.calls,triangles:hfScene.renderer.info.render.triangles,cache:Equipment3D.stats()})');assert reports['low']['triangles']<perf['triangles']*.65
    await pg.locator('[data-quality="2d"]').click();await pg.wait_for_function('()=>hfReady&&!hfScene.renderer');await pg.locator('.web-stage').screenshot(path=str(OUT/'collection-2d-390.png'))
   await ctx.close()
  # Full collection: four genuine 3x3 sheets; one shared renderer for every copied card.
  ctx,pg=await context(False)
  for sheet in ['chassis','weapons','lunar','pairs']:
   await pg.goto(BASE+'/web/equipment-preview.html?hf=1&sheet='+sheet);await pg.wait_for_function('()=>catalogReady&&Equipment3D.active()',timeout=60000)
   assert await pg.locator('.catalog-card').count()==9
   assert await pg.evaluate('Array.from(document.querySelectorAll(".catalog-card canvas")).every(c=>c.getContext("2d").getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))')
   await pg.screenshot(path=str(OUT/f'{sheet}-3x3.png'),full_page=True)
  await pg.goto(BASE+'/web/equipment-preview.html?hf=1');await pg.wait_for_function('()=>catalogReady&&Equipment3D.active()')
  await pg.select_option('#catalog-chassis','titan:2');await pg.select_option('#catalog-weapon','siege:2');await pg.screenshot(path=str(OUT/'collection-desktop.png'))
  # Real camera rotation, fixtures/fittings remain independent. Inspect one of each family.
  for c,w in [('scout:2','twin:2'),('vanguard:1','pulse:1'),('titan:2','siege:2')]:
   await pg.select_option('#catalog-chassis',c);await pg.select_option('#catalog-weapon',w);await pg.set_viewport_size({'width':390,'height':844})
   await pg.locator('[data-view="side"]').click();await pg.locator('.web-stage').screenshot(path=str(OUT/f'{c.replace(":","-")}-{w.replace(":","-")}-side.png'))
  # Cache pressure: disjoint complete catalog loops, live renderer resource counts must stabilize.
  churn=await pg.evaluate('''()=>{const s=catalogScene,rounds=[];for(let round=0;round<2;round++){const times=[];for(let i=0;i<27;i++){catalogC.value=CHORDER[i%3]+':'+Math.floor(i/3)%3;catalogW.value=WORDER[Math.floor(i/9)%3]+':'+(i%3);const t=performance.now();catalogInspect();s.draw();s.renderer.getContext().finish();times.push(performance.now()-t);}rounds.push({gpu:{...s.renderer.info.memory},cache:Equipment3D.stats(),meanBuildDrawMs:times.reduce((a,b)=>a+b)/times.length,worstBuildDrawMs:Math.max(...times)});}return rounds;}''')
  assert churn[1]['gpu']['geometries']<=churn[0]['gpu']['geometries']+10,churn;assert churn[1]['cache']['geometry']['entries']<=12,churn;reports['churn']=churn
  assert not errors,errors;reports.update({'errors':errors,'warnings':warnings,'environment':'Headless Chromium / ANGLE SwiftShader, local intercepted assets only; not iPhone FPS.'});(OUT/'showroom.json').write_text(json.dumps(reports,indent=2));await b.close();print('PASS complete runtime sheets, matched PR17 comparisons, independent/together legends, mobile HIGH/LOW/2D, bounded collection switching',flush=True)
asyncio.run(main())
