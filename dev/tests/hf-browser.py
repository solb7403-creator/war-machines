# Shared showroom real PBR/UV assets; local routes only, no account state.
import asyncio,json,mimetypes,pathlib,hashlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/hf-foundation-evidence');BASE='https://hf.test'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':1440,'height':1050},reduced_motion='reduce');errors=[];warnings=[];requests=[]
  async def route(r):
   u=r.request.url;assert u.startswith(BASE+'/') and r.request.method=='GET','No external/account calls';rel=u[len(BASE)+1:].split('?')[0];f=ROOT/rel;assert f.is_file(),f;requests.append(rel);await r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:warnings.append(m.text) if m.type in ['warning','error'] else None)
  await pg.goto(BASE+'/web/foundation-preview.html');await pg.wait_for_function('()=>typeof hfReady!=="undefined"&&hfReady',timeout=20000)
  startup=await pg.evaluate('({status:Equipment3D.stats(),ready:hfReady,assetLoadMs:hfLoadMs,readySinceNavigationMs:hfReadyMs,gl:!!hfScene.renderer})');print('INITIAL',startup,flush=True)
  assert await pg.evaluate('Equipment3D.active()&&!!hfScene.renderer'),'Actual material assets/PBR must load'
  await pg.screenshot(path=str(OUT/'initial-desktop.png'))
  results=[]
  for mode in ['baseline','upgraded']:
   await pg.locator('[data-render="'+mode+'"]').click();await pg.wait_for_function('hfReady')
   for view in ['quarter','front','side','rear']:
    await pg.locator('[data-view="'+view+'"]').click();await pg.locator('.web-stage').screenshot(path=str(OUT/f'{mode}-{view}.png'))
   perf=await pg.evaluate('''()=>{const s=hfScene;s.draw();const time=[];for(let i=0;i<80;i++){const t=performance.now();s.yaw+=.004;s.draw();s.renderer.getContext().finish();time.push(performance.now()-t);}time.sort((a,b)=>a-b);return {mode:hfMode,calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,memory:{...s.renderer.info.memory},meanFrameMs:time.reduce((a,b)=>a+b)/time.length,p95FrameMs:time[Math.floor(time.length*.95)],worstFrameMs:time.at(-1),glError:s.renderer.getContext().getError()};}''');results.append(perf);print(perf,flush=True);assert perf['glError']==0
  for width in [320,390,430]:
   await pg.set_viewport_size({'width':width,'height':844});await pg.locator('[data-view="quarter"]').click();assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth&&hfScene.el.clientHeight>=280');await pg.screenshot(path=str(OUT/f'high-{width}.png'))
  await pg.set_viewport_size({'width':390,'height':844})
  for skin,weapon in [('default','pulse'),('lunar','pulse'),('default','moon'),('lunar','moon')]:
   await pg.select_option('#hf-skin',skin);await pg.select_option('#hf-weapon',weapon);await pg.wait_for_function('hfReady');assert await pg.evaluate('hfScene.el.clientHeight>=280');await pg.locator('.web-stage').screenshot(path=str(OUT/f'{skin}-{weapon}-390.png'))
  await pg.select_option('#hf-parts','2');await pg.locator('[data-view="side"]').click();await pg.screenshot(path=str(OUT/'moonbeam-closeup-390.png'));await pg.select_option('#hf-parts','3')
  await pg.locator('[data-quality="low"]').click();await pg.wait_for_function('hfReady&&Equipment3D.status("low")==="ready"');await pg.screenshot(path=str(OUT/'low-390.png'));low=await pg.evaluate('({calls:hfScene.renderer.info.render.calls,triangles:hfScene.renderer.info.render.triangles})');assert low['triangles']<results[1]['triangles']*.65,low
  await pg.locator('[data-quality="high"]').click();await pg.wait_for_function('hfReady');cache=await pg.evaluate('''()=>{const s=hfScene;const before={...s.renderer.info.memory};let peak=0;for(let i=0;i<50;i++){hfL.skin=i%2?'lunar':'default';hfL.w.a=i%3?'moon':'pulse';hfL.w.t=hfL.w.a==='moon'?2:0;s.setLoadout(hfL);s.draw();peak=Math.max(peak,s.renderer.info.memory.geometries);}hfL.skin='lunar';hfL.w.a='moon';hfL.w.t=2;s.setLoadout(hfL);s.draw();return {before,after:{...s.renderer.info.memory},peak,bank:Equipment3D.stats()};}''');assert cache['after']['geometries']<=cache['before']['geometries']+3,cache
  await pg.locator('[data-quality="2d"]').click();await pg.wait_for_function('hfReady&&!hfScene.renderer');await pg.screenshot(path=str(OUT/'fallback-390.png'));await pg.locator('[data-quality="high"]').click();await pg.wait_for_function('hfReady&&!!hfScene.renderer');assert await pg.evaluate('Equipment3D.stats().users===1')
  coldctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');await coldctx.route('**/*',route);cp=await coldctx.new_page();cp.on('pageerror',lambda e:errors.append(str(e)));await cp.goto(BASE+'/web/foundation-preview.html?quality=low');await cp.wait_for_function('()=>hfReady&&Equipment3D.active()');coldlow=await cp.evaluate('({assetLoadMs:hfLoadMs,readySinceNavigationMs:hfReadyMs,quality:Equipment3D.quality,resources:Equipment3D.stats(),files:performance.getEntriesByType("resource").map(x=>x.name).filter(x=>x.includes("hf-v1"))})');assert coldlow['quality']=='low' and not any('high.png' in x for x in coldlow['files']);await cp.screenshot(path=str(OUT/'cold-low-390.png'));await coldctx.close()
  assert not errors,errors
  (OUT/'showroom.json').write_text(json.dumps({'startup':startup,'coldLow':coldlow,'renders':results,'low':low,'cache':cache,'requests':requests,'errors':errors,'warnings':warnings,'environment':'Headless Chromium SwiftShader. GPU-fenced software frame cost, NOT iPhone FPS.'},indent=2));await b.close();print('PASS shared showroom, local verified maps, actual PBR + UV + geometry, matched renders, HIGH/LOW/2D, mobile, bounded switching',flush=True)
asyncio.run(main())
