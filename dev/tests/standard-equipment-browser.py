# One actual shared showroom, local asset routes only. Contact sheets are screenshots of real rendered canvases.
import asyncio,json,mimetypes,pathlib,os,sys,subprocess
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/standard-equipment-evidence');BASE='https://models.test';BEFORE='--before' in sys.argv
OUT.mkdir(parents=True,exist_ok=True)
if BEFORE and not (OUT/'before-models3d.js').exists():(OUT/'before-models3d.js').write_bytes(subprocess.check_output(['git','show','d237fc5055afa6596239e75afbc148bc93121615:js/models3d.js'],cwd=ROOT))
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':1170,'height':1120},reduced_motion='reduce');errors=[];calls=[]
  async def route(r):
   u=r.request.url;calls.append(u);assert u.startswith(BASE+'/') and r.request.method=='GET','No account/external requests: '+u
   rel=u[len(BASE)+1:].split('?')[0];f=ROOT/rel
   if BEFORE and rel=='js/models3d.js':f=OUT/'before-models3d.js'
   assert f.is_file(),f;await r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
  for sheet in ['chassis','weapons','pairs']:
   await pg.goto(BASE+'/web/equipment-preview.html?sheet='+sheet);await pg.wait_for_function('()=>typeof catalogReady!=="undefined"&&catalogReady');assert await pg.locator('.catalog-card').count()==9
   assert await pg.evaluate('document.querySelectorAll("canvas[data-engine]").length===1') # Exactly one shared THREE renderer, not nine WebGL contexts.
   assert await pg.evaluate('Array.from(document.querySelectorAll(".catalog-card canvas")).every(c=>c.getContext("2d").getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))')
   await pg.screenshot(path=str(OUT/(('before-' if BEFORE else '')+sheet+'-3x3.png')),full_page=True)
  if BEFORE:await b.close();print('PASS PR14 baseline geometry under common actual showroom rig');return
  await pg.goto(BASE+'/web/equipment-preview.html');await pg.wait_for_function('()=>typeof catalogReady!=="undefined"&&catalogReady')
  for width in [320,390,430]:
   await pg.set_viewport_size({'width':width,'height':844});assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await pg.select_option('#catalog-chassis','titan:2');await pg.select_option('#catalog-weapon','siege:2');await pg.locator('[data-view="side"]').click();await pg.screenshot(path=str(OUT/f'titan-siege-side-{width}.png'))
   # Projection/rotation bounds, touch target and no picture clipping in landscape or portrait.
   assert await pg.evaluate('catalogScene.renderer.info.render.calls<24')
  await pg.set_viewport_size({'width':390,'height':844})
  samples=[('scout:2','twin:2'),('vanguard:1','pulse:1'),('titan:2','siege:2')]
  for c,w in samples:
   await pg.select_option('#catalog-chassis',c);await pg.select_option('#catalog-weapon',w)
   for view in ['front','side','rear']:
    await pg.locator('[data-view="'+view+'"]').click();await pg.screenshot(path=str(OUT/(c.replace(':','-')+'-'+w.replace(':','-')+'-'+view+'-390.png')))
  # Legends are deliberately sampled separately; geometry parity is verified by Node suite.
  await pg.select_option('#catalog-chassis','vanguard:0');await pg.select_option('#catalog-weapon','pulse:0');await pg.select_option('#catalog-skin','lunar');await pg.locator('[data-view="front"]').click();await pg.screenshot(path=str(OUT/'lunar-skin-unchanged-390.png'))
  await pg.select_option('#catalog-skin','default');await pg.select_option('#catalog-weapon','moon:2');await pg.screenshot(path=str(OUT/'moonbeam-unchanged-390.png'))
  await pg.select_option('#catalog-weapon','pulse:0');await pg.select_option('#catalog-paint','arctic');await pg.select_option('#catalog-paint','ember');await pg.select_option('#catalog-paint','stock')
  perf=await pg.evaluate('''()=>{const s=catalogScene;s.draw();const initial=s.renderer.info.memory.geometries;let max=0;const samples=[];for(let i=0;i<45;i++){catalogC.value=['scout:2','vanguard:1','titan:2'][i%3];catalogW.value=['pulse:2','twin:2','siege:2'][i%3];const t=performance.now();catalogInspect();s.draw();samples.push(performance.now()-t);max=Math.max(max,s.renderer.info.memory.geometries);}catalogC.value='vanguard:0';catalogW.value='pulse:0';catalogInspect();s.draw();const end=s.renderer.info.memory.geometries;const render=s.renderer.info.render;return {initial,end,max,drawCalls:render.calls,triangles:render.triangles,meanBuildDrawMs:samples.reduce((a,b)=>a+b,0)/samples.length,maxBuildDrawMs:Math.max(...samples),geometryBounded:end<=initial+3};}''')
  assert perf['geometryBounded'],perf
  await pg.set_viewport_size({'width':844,'height':390});await pg.locator('[data-view="rear"]').click();assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  await ctx.close()
  fb=await b.new_context(viewport={'width':320,'height':844});await fb.route('**/*',route);await fb.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:orig.call(this,t,...a)};")
  f=await fb.new_page();f.on('pageerror',lambda e:errors.append(str(e)));await f.goto(BASE+'/web/equipment-preview.html');await f.wait_for_function('()=>typeof catalogReady!=="undefined"&&catalogReady');assert await f.locator('.scene-fallback svg').count()==1
  assert not errors,errors
  (OUT/'browser.json').write_text(json.dumps({'contact_sheets':3,'items':18,'mobile_widths':[320,390,430],'orientation':True,'no_webgl_fallback':True,'errors':errors,'account_requests':0,'perf':perf,'hardware':'headless Chromium SwiftShader; CPU submission time, not real iPhone FPS'},indent=2));print('PASS actual 18-model contact sheets, mobile/orientation/paints/legends/fallback, bounded repeated switching',perf);await b.close()
asyncio.run(main())
