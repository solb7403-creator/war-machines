# Actual vendored THREE + shared showroom. No live services, account login or production fallback.
import asyncio,json,mimetypes,os,pathlib,subprocess,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path(os.environ.get('DEFENDER_EVIDENCE','/workspace/defender-evidence'));OUT.mkdir(exist_ok=True)
BEFORE='--before' in sys.argv;BASE='https://defender.test';tag='before' if BEFORE else 'after'
# Recreate a genuine PR #13 baseline from local Git history when evidence is absent.
for file,source in [('before-models3d.js','js/models3d.js'),('before-scene.js','web/scene.js')]:
 if not (OUT/file).exists():(OUT/file).write_bytes(subprocess.check_output(['git','show','385356ea4ffac207900d05be6fbdf1965081fa63:'+source],cwd=ROOT))

async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');requests=[];errors=[]
  async def route(r):
   u=r.request.url;requests.append({'url':u,'method':r.request.method})
   assert u.startswith(BASE+'/') and r.request.method=='GET','Preview contacted an external or mutating service: '+u
   rel=u[len(BASE)+1:].split('?')[0];file=ROOT/rel
   if BEFORE and rel in ['js/models3d.js','web/scene.js']:file=OUT/('before-models3d.js' if rel.startswith('js/') else 'before-scene.js')
   assert file.is_file(),file
   return await r.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
  await pg.goto(BASE+'/web/defender-preview.html');await pg.wait_for_function('()=>!!defenderPreview.model');await pg.wait_for_timeout(150)
  assert await pg.evaluate('!defenderPreview.auto'), 'reduced motion respected'
  for view in ['front','side','rear']:
   await pg.locator('[data-view="'+view+'"]').click();await pg.screenshot(path=str(OUT/(tag+'-'+view+'-390.png')))
  await pg.locator('[data-skin="lunar"]').click();await pg.locator('[data-view="front"]').click();await pg.screenshot(path=str(OUT/(tag+'-lunar-390.png')))
  assert await pg.evaluate('previewLoadout.skin')=='lunar'
  await pg.locator('[data-skin="default"]').click()
  if not BEFORE:
   for paint in ['arctic','ember','nebula','stock']:await pg.select_option('#preview-paint',paint)
   for w in ['twin','siege','moon','pulse']:await pg.select_option('#preview-weapon',w)
   await pg.locator('[data-view="front"]').click()
   # Actual drag and zoom, no overlay or account equipment changes.
   old=await pg.evaluate('defenderPreview.yaw');box=await pg.locator('#defender-scene').bounding_box();await pg.mouse.move(box['x']+80,box['y']+90);await pg.mouse.down();await pg.mouse.move(box['x']+170,box['y']+90);await pg.mouse.up();assert await pg.evaluate('defenderPreview.yaw')!=old
   await pg.locator('[data-zoom="1"]').click();await pg.set_viewport_size({'width':320,'height':844});assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
  info=await pg.evaluate('''()=>{const s=defenderPreview;s.draw();const before=s.renderer.info.memory.geometries;for(let i=0;i<12;i++){previewLoadout.paint=i%2?'stock':'ember';previewUpdate();s.draw();}const after=s.renderer.info.memory.geometries;const t=performance.now();for(let i=0;i<30;i++)s.draw();return {renderer:s.renderer.getContext().getParameter(s.renderer.getContext().VERSION),drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,geometryBefore:before,geometryAfter:after,meanDrawMs:(performance.now()-t)/30,loadout:previewLoadout};}''')
  assert info['geometryAfter']<=info['geometryBefore']+3,info
  assert not errors,errors
  assert not any('/api/' in r['url'] or '/auth/' in r['url'] for r in requests)
  (OUT/(tag+'-browser.json')).write_text(json.dumps({'info':info,'errors':errors,'account_network_calls':0,'screenshots':'actual shared THREE rendered at 390 CSS px; SwiftShader, not physical iPhone'},indent=2))
  print('PASS',tag,'shared THREE preview, views, skin comparison, no API/storage; geometry',info)
  await b.close()
asyncio.run(main())
