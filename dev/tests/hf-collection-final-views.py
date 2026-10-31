# Final post-review captures / targeted gallery selection and quality feedback regression.
import asyncio,pathlib,mimetypes,json,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/hf-collection-evidence');BASE='https://hf.test'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':1440,'height':1080},reduced_motion='reduce');errors=[]
  async def route(r):
   assert r.request.url.startswith(BASE+'/') and r.request.method=='GET';f=ROOT/r.request.url[len(BASE)+1:].split('?')[0];await r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
  await pg.goto(BASE+'/web/equipment-preview.html?hf=1&quality=low');await pg.wait_for_function('()=>catalogReady&&Equipment3D.active()',timeout=60000)
  assert await pg.input_value('#catalog-quality')=='low';await pg.select_option('#catalog-quality','high');await pg.wait_for_function('()=>catalogReady&&Equipment3D.quality==="high"&&Equipment3D.active()');assert 'HIGH' in await pg.locator('#catalog-status').inner_text(),'quality feedback must follow actual HIGH/LOW/fallback state'
  await pg.select_option('#catalog-quality','low');await pg.wait_for_function('()=>catalogReady&&Equipment3D.quality==="low"&&Equipment3D.active()');assert 'LOW' in await pg.locator('#catalog-status').inner_text()
  if '--status-only' in sys.argv:await b.close();print('PASS live gallery quality feedback');return
  for sheet in ['chassis','weapons','lunar','pairs']:
   await pg.goto(BASE+'/web/equipment-preview.html?hf=1&sheet='+sheet);await pg.wait_for_function('()=>catalogReady&&Equipment3D.active()',timeout=60000);await pg.screenshot(path=str(OUT/f'{sheet}-3x3.png'),full_page=True)
   if sheet=='lunar':await pg.locator('.catalog-card').first.click();assert await pg.evaluate('catalogLoadout.skin==="lunar"'),'Lunar adaptation card must inspect Lunar without equipping anything'
  await pg.goto(BASE+'/web/foundation-preview.html');await pg.wait_for_function('()=>hfReady&&Equipment3D.active()');await pg.set_viewport_size({'width':390,'height':844})
  for view,yaw in [('quarter',-.12),('side',.55),('rear',1.6),('front',-1.02)]:
   await pg.evaluate('yaw=>{hfScene.yaw=yaw;hfScene.tilt=.18;hfScene.zoom=1.6;hfScene.draw();}',yaw);await pg.locator('.web-stage').screenshot(path=str(OUT/f'collection-hero-{view}-390.png'))
  await pg.select_option('#hf-parts','3')
  for skin,w in [('default','pulse'),('lunar','pulse'),('default','moon'),('lunar','moon')]:
   await pg.select_option('#hf-skin',skin);await pg.select_option('#hf-weapon',w);await pg.wait_for_function('()=>hfReady');await pg.evaluate('()=>{hfScene.yaw=-.12;hfScene.zoom=1.6;hfScene.draw();}');await pg.locator('.web-stage').screenshot(path=str(OUT/f'collection-{skin}-{w}-390.png'))
  await pg.locator('[data-quality="low"]').click();await pg.wait_for_function('()=>hfReady&&Equipment3D.active()');await pg.locator('.web-stage').screenshot(path=str(OUT/'collection-low-390.png'));low=await pg.evaluate('({calls:hfScene.renderer.info.render.calls,triangles:hfScene.renderer.info.render.triangles,cache:Equipment3D.stats()})')
  data=json.loads((OUT/'showroom.json').read_text());data['low']=low;data['finalGalleryFeedback']=True;(OUT/'showroom.json').write_text(json.dumps(data,indent=2));assert not errors,errors;await b.close();print('PASS final captures, correct quality feedback and Lunar card selection',low,flush=True)
asyncio.run(main())
