# Real shared Three.js showroom, local GET assets only. No account, storage or gear grants.
import asyncio,json,mimetypes,pathlib,os,sys,subprocess
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/legendary-evidence');BASE='https://models.test';BEFORE='--before' in sys.argv
OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',has_touch=True);errors=[];calls=[]
  async def route(r):
   u=r.request.url;calls.append(u);assert u.startswith(BASE+'/') and r.request.method=='GET','No network/account mutation: '+u
   rel=u[len(BASE)+1:].split('?')[0];f=ROOT/rel
   if BEFORE and rel in ['js/models3d.js','web/scene.js']:
    f=OUT/('before-'+pathlib.Path(rel).name)
    if not f.exists():f.write_bytes(subprocess.check_output(['git','show','aa558bc8b3fce35186d9f6bf2a2774ad80a517fd:'+rel],cwd=ROOT))
   assert f.is_file(),f;await r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));await pg.goto(BASE+'/web/equipment-preview.html');await pg.wait_for_function('()=>typeof catalogReady!=="undefined"&&catalogReady')
  async def model(skin='lunar',arch='pulse',tier=0,cls='vanguard',ct=0,parts=3,yaw=-.65,tilt=.25):
   await pg.evaluate('''o=>{catalogC.value=o.cls+':'+o.ct;catalogW.value=o.arch+':'+o.tier;document.querySelector('#catalog-skin').value=o.skin;catalogParts=o.parts;catalogInspect();catalogScene.auto=false;catalogScene.yaw=o.yaw;catalogScene.tilt=o.tilt;catalogScene.zoom=o.parts===2?1.8:1.5;catalogScene.draw();}''',dict(skin=skin,arch=arch,tier=tier,cls=cls,ct=ct,parts=parts,yaw=yaw,tilt=tilt))
  async def capture(name,full=False):
   path=str(OUT/(('before-' if BEFORE else '')+name+'.png'))
   if full:await pg.screenshot(path=path,full_page=name in ['lunar-9-chassis','moonbeam-9-mounts'])
   else:await pg.locator('.web-stage').screenshot(path=path)
  for name,yaw,tilt in [('lunar-front',-1.1,.12),('lunar-side',.46,.10),('lunar-rear',2.03,.18),('lunar-three-quarter',-.65,.25)]:
   await model(parts=1,yaw=yaw,tilt=tilt);await capture(name)
  for name,yaw in [('moonbeam-side',.46),('moonbeam-three-quarter',-.65),('moonbeam-emitter',-1.1)]:
   await model(skin='default',arch='moon',tier=2,parts=2,yaw=yaw,tilt=.10);await capture(name)
  for name,skin,arch in [('lunar-with-standard-weapon','lunar','pulse'),('moonbeam-on-standard-chassis','default','moon'),('lunar-plus-moonbeam','lunar','moon')]:
   await model(skin=skin,arch=arch,tier=2 if arch=='moon' else 0);await capture(name)
  if BEFORE:
   perf=await pg.evaluate("""()=>{const s=catalogScene;s.draw();const times=[];let max=0;for(let i=0;i<30;i++){catalogC.value=CHORDER[i%3]+':'+(Math.floor(i/3)%3);catalogW.value=i%2?'moon:2':'pulse:2';document.querySelector('#catalog-skin').value=i%2?'lunar':'default';const t=performance.now();catalogInspect();s.draw();times.push(performance.now()-t);max=Math.max(max,s.renderer.info.memory.geometries);}catalogC.value='vanguard:0';catalogW.value='moon:2';document.querySelector('#catalog-skin').value='lunar';catalogInspect();s.draw();return {max,end:s.renderer.info.memory.geometries,calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,meanBuildDrawMs:times.reduce((a,b)=>a+b)/times.length,glError:s.renderer.getContext().getError()};}""")
   (OUT/'before-browser.json').write_text(json.dumps(perf,indent=2));await b.close();print('PASS actual PR15 legendary baseline captures and perf',perf);return
  widths=[]
  for width in [320,390,430]:
   await pg.set_viewport_size({'width':width,'height':844});await model(arch='moon',tier=2,cls='titan',ct=2);assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth');await capture('lunar-moonbeam-'+str(width),True);widths.append(width)
   assert await pg.evaluate('''()=>{const s=catalogScene;s.draw();s.camera.updateMatrixWorld(true);const co=Math.cos(s.yaw),si=Math.sin(s.yaw);return s.bounds.every(b=>{const v=new THREE.Vector3(b[0]*co+b[2]*si,b[1],-b[0]*si+b[2]*co).project(s.camera);return Math.abs(v.x)<1&&Math.abs(v.y)<1;});}'''),'camera clips actual model bounds'
  await pg.set_viewport_size({'width':1440,'height':1000});await model(arch='moon',tier=2);await capture('lunar-moonbeam-desktop',True)
  for skin,arch,name in [('lunar','pulse','lunar-9-chassis'),('default','moon','moonbeam-9-mounts')]:
   cards=await pg.evaluate('''o=>{const metrics=[];document.body.classList.add('sheet-mode');const grid=document.querySelector('#catalog-grid');grid.replaceChildren();document.querySelector('#sheet-heading').textContent=o.name;for(const cls of CHORDER)for(let ct=0;ct<3;ct++){const L=structuredClone(STOCK_L);L.skin=o.skin;L.c.c=cls;L.c.t=ct;L.w.a=o.arch;L.w.t=o.arch==='moon'?2:0;catalogScene.setLoadout(L,o.skin==='lunar'?1:3);catalogScene.yaw=-.65;catalogScene.zoom=1.5;catalogScene.tilt=.25;catalogScene.renderer.setSize(660,480,false);catalogScene.camera.aspect=660/480;catalogScene.camera.updateProjectionMatrix();catalogScene.draw();const c=document.createElement('canvas');c.width=660;c.height=480;c.getContext('2d').drawImage(catalogScene.renderer.domElement,0,0,660,480);const a=document.createElement('article');a.className='catalog-card';const h=document.createElement('h3');h.textContent=CH[cls].n+' T'+ct+(o.arch==='moon'?' / Moonbeam':' / Lunar Skin');a.append(h,c);grid.append(a);let n=0;catalogScene.model.traverse(m=>{n+=m.geometry?.attributes.position.count||0});const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=0;for(let i=0;i<pixels.length;i+=19)hash=(hash*31+pixels[i])|0;metrics.push({cls,ct,n,hash});}return metrics;}''',dict(skin=skin,arch=arch,name=name));assert len({m['hash'] for m in cards})==9,cards;(OUT/(name+'.json')).write_text(json.dumps(cards,indent=2));await capture(name,True)
  await pg.evaluate("document.body.classList.remove('sheet-mode')");await pg.set_viewport_size({'width':390,'height':844});await model(arch='moon',tier=2)
  perf=await pg.evaluate('''()=>{const s=catalogScene;s.draw();const initial=s.renderer.info.memory.geometries;let max=0;const times=[];for(let i=0;i<45;i++){catalogC.value=CHORDER[i%3]+':'+(Math.floor(i/3)%3);catalogW.value=(i%4===3?'moon:2':WORDER[i%3]+':2');document.querySelector('#catalog-skin').value=i%2?'lunar':'default';const t=performance.now();catalogInspect();s.draw();times.push(performance.now()-t);max=Math.max(max,s.renderer.info.memory.geometries);}catalogC.value='vanguard:0';catalogW.value='moon:2';document.querySelector('#catalog-skin').value='lunar';catalogInspect();s.draw();return {initial,end:s.renderer.info.memory.geometries,max,calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,meanBuildDrawMs:times.reduce((a,b)=>a+b)/times.length,maxBuildDrawMs:Math.max(...times),glError:s.renderer.getContext().getError()};}''')
  assert perf['end']<=perf['initial']+3 and perf['glError']==0,perf
  scene=pg.locator('#catalog-scene');bb=await scene.bounding_box();old=await pg.evaluate('catalogScene.yaw');await pg.mouse.move(bb['x']+100,bb['y']+100);await pg.mouse.down();await pg.mouse.move(bb['x']+190,bb['y']+120);await pg.mouse.up();assert await pg.evaluate('catalogScene.yaw')!=old
  assert not errors,errors
  fb=await b.new_context(viewport={'width':320,'height':844});await fb.route('**/*',route);await fb.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:orig.call(this,t,...a)};")
  f=await fb.new_page();f.on('pageerror',lambda e:errors.append(str(e)));await f.goto(BASE+'/web/equipment-preview.html');await f.wait_for_function('()=>typeof catalogReady!=="undefined"&&catalogReady');assert await f.locator('.scene-fallback svg').count()==1
  assert not errors,errors
  (OUT/'browser.json').write_text(json.dumps({'widths':widths,'desktop':1440,'noWebGL':True,'drag':True,'mutations':0,'errors':errors,'perf':perf,'environment':'Chromium / SwiftShader, simulated mobile, NOT physical iPhone FPS'},indent=2));print('PASS actual legendary angles, 18 mount captures, independent/together, framing, mobile, desktop, no-WebGL fallback and bounded switching',perf);await b.close()
asyncio.run(main())
