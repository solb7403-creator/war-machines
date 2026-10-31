# Required error-path evidence: all assets and services local; intentional faults are not hidden.
import asyncio,pathlib,mimetypes,json
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/hf-foundation-evidence');BASE='https://hf.test'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);reports=[]
  for fault in ['missing','corrupt','version','no-webgl','context-loss']:
   ctx=await browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');errors=[];maps=[];broken=[True]
   if fault=='no-webgl':await ctx.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:orig.call(this,t,...a)};")
   async def route(r):
    u=r.request.url;assert u.startswith(BASE+'/') and r.request.method=='GET';rel=u[len(BASE)+1:].split('?')[0];f=ROOT/rel;body=f.read_bytes()
    if '/hf-v1/' in rel:maps.append(rel)
    if broken[0] and fault=='missing' and rel.endswith('normal-high.png'):return await r.fulfill(status=404,body='intentional isolated fault')
    if broken[0] and fault=='corrupt' and rel.endswith('orm-high.png'):body=bytes([body[0]^255])+body[1:]
    if broken[0] and fault=='version' and rel.endswith('manifest.json'):
     d=json.loads(body);d['version']='unapproved';body=json.dumps(d).encode()
    await r.fulfill(body=body,content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
   await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));await pg.goto(BASE+'/web/foundation-preview.html');await pg.wait_for_function('()=>typeof hfReady!=="undefined"&&hfReady')
   if fault in ['missing','corrupt','version']:
    assert await pg.evaluate('Equipment3D.status("high")==="error"&&!!hfScene.model&&hfScene.renderer.info.render.calls>0');assert 'retained' in await pg.locator('#hf-status').inner_text();broken[0]=False;await pg.locator('[data-render="upgraded"]').click();await pg.wait_for_function('hfReady&&Equipment3D.active()');assert await pg.evaluate('hfScene.renderer.getContext().getError()===0')
   elif fault=='no-webgl':
    assert await pg.locator('.scene-fallback svg').count()==1;assert not maps,maps;await pg.screenshot(path=str(OUT/'no-webgl-390.png'))
   else:
    await pg.evaluate('hfScene.renderer.getContext().getExtension("WEBGL_lose_context").loseContext()');await pg.wait_for_function('!hfScene.renderer');await pg.screenshot(path=str(OUT/'context-loss-fallback-390.png'));await pg.locator('[data-quality="high"]').click();await pg.wait_for_function('hfReady&&!!hfScene.renderer');assert await pg.evaluate('Equipment3D.stats().users===1&&hfScene.renderer.getContext().getError()===0');await pg.screenshot(path=str(OUT/'context-recovered-390.png'));await pg.evaluate('dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));');await pg.wait_for_function('()=>hfReady&&!!hfScene.renderer');assert await pg.evaluate('Equipment3D.stats().users===1')
   assert not errors,errors;reports.append({'fault':fault,'recovered':fault!='no-webgl','errors':errors,'material_requests':len(maps)});await ctx.close()
  (OUT/'failure.json').write_text(json.dumps(reports,indent=2));await browser.close();print('PASS missing/corrupt/version fallback + retry, no-WebGL (zero map requests), context-loss fallback + fresh-context recovery',reports)
asyncio.run(main())
