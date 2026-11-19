"""See-through rule (owner, Nov 17 + Nov 19; Session 5E-2d1 replaced 5E-2a's always-on ghost fade): buildings are never
see-through unless the tank is pressed directly against one. In the Conquest world: a building or prop between the camera and
the player's tank STAYS SOLID and the tank shows through it as a clean outline (allies too, enemies never); only the building
the hull is pressed against is thinned to a see-through screen, and only while it is; the camera does not move for a building.
Real app (index.html, local economy), real renderer. Also checks the rule adds no shader program (the outline and the pressed
screen are the solid program; Conquest keeps a 16-program budget). Software GL in CI: this proves behaviour, not phone frame
rate. The town's drive view is covered by dev/tests/conquest-seethrough-town.py."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest/occluder';OUT.mkdir(parents=True,exist_ok=True)
# the outline's pixels around the tank (its exact colour, written without tone mapping), read straight after a render
COUNT="""()=>{const v=Conquest.view,T=v.T,cv=v.renderer.domElement;v.renderer.render(v.scene,v.camera);const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.drawImage(cv,0,0);
 const p=new T.Vector3(v.vehicle.position.x,v.vehicle.position.y+1.5,v.vehicle.position.z).project(v.camera),px=Math.round((p.x+1)/2*cv.width),py=Math.round((1-p.y)/2*cv.height),R=Math.round(cv.height*.11),d=x.getImageData(Math.max(0,px-R),Math.max(0,py-R),2*R,2*R).data;let n=0;
 for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-143)<12&&Math.abs(d[i+1]-246)<12&&Math.abs(d[i+2]-255)<10)n++;return n;}"""
async def main(engine):
 async with async_playwright() as p:
  opts={'headless':True}
  if engine=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  browser=await getattr(p,engine).launch(**opts)
  context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce')
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"')
  await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.wait_for_function('typeof Conquest!=="undefined"&&!!Conquest.view',timeout=120000)
  if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
  await page.wait_for_function('Conquest.view.pending===0',timeout=240000);await page.wait_for_timeout(1500)
  # open ground south of the Refuge's solar field, the camera further south: nothing between the camera and the tank
  await page.evaluate('()=>{const v=Conquest.view;v.jump(1132,1252);}');await page.wait_for_timeout(600)
  await page.wait_for_function('Conquest.view.pending===0',timeout=240000)
  await page.evaluate('()=>{const v=Conquest.view;v.yaw=0;v.pitch=.42;v.distance=44;v.camSnap=true;}');await page.wait_for_timeout(900)
  base=await page.evaluate('''()=>{const v=Conquest.view;return {programs:v.renderer.info.programs.length,cam:v.camera.position.distanceTo(v.vehicle.position),twins:v.outline?.group.children.length||0,roots:v.outline?[...v.outline.sets.keys()].every(r=>r===v.vehicle||[...(v.friendViews?.values()||[])].some(F=>F.g===r)):false};}''')
  open0=await page.evaluate(COUNT)
  # a tall solid slab right between the camera and the tank, in the props group (where the refuge, viaduct and cover live)
  await page.evaluate('''()=>{const v=Conquest.view,T=v.T,cam=v.camera.position,t=v.vehicle.position,mid=cam.clone().lerp(t,.5);
   const mat=new T.MeshLambertMaterial({color:0x8090a0});const m=new T.Mesh(new T.BoxGeometry(14,40,14),mat);
   m.position.set(mid.x-v.props.position.x,mid.y-v.props.position.y,mid.z-v.props.position.z);m.name='occluder-test';v.props.add(m);window.__occ={m,mat};}''')
  await page.wait_for_timeout(1200)
  hid=await page.evaluate('''()=>{const v=Conquest.view,m=window.__occ.m;return {same:m.material===window.__occ.mat,transparent:m.material.transparent,opacity:m.material.opacity,depthWrite:m.material.depthWrite,cam:v.camera.position.distanceTo(v.vehicle.position),k:v.style.U.uPressK.value,twins:v.outline.group.children.length};}''')
  behind=await page.evaluate(COUNT);await page.screenshot(path=str(OUT/f'{engine}-outline.png'))
  # the blocker stays solid: its own material, opaque, untouched; nothing is pressed
  assert hid['same'] and not hid['transparent'] and hid['opacity']==1 and hid['depthWrite'] and hid['k']==0,('a building in the way stays solid',hid)
  # the tank is tracked for the outline (the player's tank and allied tanks only: enemies never)
  assert base['twins']>=2 and hid['twins']>=2 and base['roots'],('the player tank is tracked for the outline; enemies never are',base,hid)
  # ...and shows through the blocker as an outline (none of it when nothing is in the way)
  assert behind>=open0+100 and open0<40,('the hidden tank shows as an outline through the blocker',open0,behind)
  # the camera does not move to avoid the building
  assert abs(hid['cam']-base['cam'])<.6,('the camera stays where it was',base['cam'],hid['cam'])
  src=(ROOT/'js/conquest/view.js').read_text();st=src[src.index(' seeThrough(dt){'):src.index(' pressFootprint(){')]
  assert 'enemyMeshes' not in st and 'this.vehicle' in st and 'friendViews' in st,'only the player tank and allied tanks are outlined'
  assert 'W.blockedAt(x,y,z)){reach' not in src,'the camera pull-in for buildings is gone'
  await page.evaluate('''()=>{const m=window.__occ.m;m.parent.remove(m);m.geometry.dispose();window.__occ.mat.dispose();}''')
  # pressed against a Refuge pod: only that pod is thinned, and only while the hull is against it
  await page.evaluate('()=>{const v=Conquest.view;v.jump(1110,1157.2);v.yaw=Math.PI;v.pitch=.3;v.distance=40;v.camSnap=true;}')
  await page.wait_for_function('Conquest.view.style.U.uPressK.value>.6',timeout=20000)
  press=await page.evaluate('''()=>{const v=Conquest.view,U=v.style.U;return {fp:U.uPress.value.toArray(),k:U.uPressK.value,cam:v.camera.position.distanceTo(v.vehicle.position)};}''')
  await page.wait_for_timeout(500);await page.screenshot(path=str(OUT/f'{engine}-pressed.png'))
  assert press['fp'][0]==1110 and press['fp'][1]==1148 and 8<press['fp'][2]<10,('the pressed pod is the one footprint',press)
  await page.evaluate('()=>{const v=Conquest.view;v.jump(1121,1162);v.camSnap=true;}')
  await page.wait_for_function('Conquest.view.style.U.uPressK.value===0&&Conquest.view.style.U.uPress.value.z<0',timeout=20000)
  await page.screenshot(path=str(OUT/f'{engine}-restored.png'))
  # no shader program was added: the outline and its mask are the solid program
  prog=await page.evaluate('''()=>{const v=Conquest.view,r=v.renderer,M=v.style.MAT,p=m=>r.properties.get(m).currentProgram,own=[...r.properties.get(M.solid).programs.values()];return {programs:r.info.programs.length,same:!!p(M.outline)&&own.includes(p(M.outline))&&own.includes(p(M.outlineMask)),stencil:r.getContext().getContextAttributes().stencil};}''')
  assert prog['same'] and prog['stencil'] and prog['programs']<=16 and prog['programs']<=base['programs']+1,('no new shader program',base,prog)
  assert not errors,errors
  result={'engine':engine,'status':'PASS','programs':prog['programs'],'outlinePixelsOpen':open0,'outlinePixelsBehind':behind,'cameraOpen':base['cam'],'cameraBehind':hid['cam'],'pressed':press,'physicalDeviceVerified':False}
  (OUT/f'{engine}-results.json').write_text(json.dumps(result,indent=1));print(json.dumps(result))
  await browser.close()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--engine',choices=['chromium','webkit'],default='chromium');asyncio.run(main(a.parse_args().engine))
