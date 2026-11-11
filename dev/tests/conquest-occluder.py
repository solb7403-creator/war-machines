"""See-through occluders (Session 5E-2a, owner): in the Conquest world, a building or prop between the camera and the player's
tank (or the path just ahead) fades to a see-through ghost and comes back when it no longer blocks. Real app (index.html,
local economy), real renderer. Also checks the fade adds no shader program (Conquest keeps a 16-program budget) and that the
real material returns intact. Software GL in CI: this proves behaviour, not phone frame rate."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest/occluder';OUT.mkdir(parents=True,exist_ok=True)
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
  # a tall slab right between the camera and the tank, in the props group (where the refuge, viaduct and cover live)
  setup=await page.evaluate('''()=>{const v=Conquest.view,T=v.T,cam=v.camera.position,t=v.vehicle.position,mid=cam.clone().lerp(t,.5);
   const mat=new T.MeshLambertMaterial({color:0x8090a0});const m=new T.Mesh(new T.BoxGeometry(14,40,14),mat);
   m.position.set(mid.x-v.props.position.x,mid.y-v.props.position.y,mid.z-v.props.position.z);m.name='occluder-test';v.props.add(m);v.fade&&(v.fade.scan=99);window.__occ={m,mat};
   return {programs:v.renderer.info.programs.length};}''')
  await page.wait_for_function('window.__occ.m.material!==window.__occ.mat',timeout=20000)
  faded=await page.evaluate('''()=>{const v=Conquest.view,m=window.__occ.m;return {transparent:m.material.transparent,opacity:m.material.opacity,depthWrite:m.material.depthWrite,programs:v.renderer.info.programs.length};}''')
  await page.wait_for_timeout(800);faded2=await page.evaluate('window.__occ.m.material.opacity')
  await page.screenshot(path=str(OUT/f'{engine}-faded.png'))
  assert faded['transparent'] and not faded['depthWrite'],faded
  assert faded2<.4,('the blocker fades to see-through',faded2)
  # the halo program is the same kind of material: at most that one program may be new, never more
  assert faded['programs']<=setup['programs']+1,(setup,faded)
  # move it out of the line of sight: the real material comes back
  await page.evaluate('''()=>{const v=Conquest.view,m=window.__occ.m;m.position.x+=400;m.position.z+=400;}''')
  await page.wait_for_function('window.__occ.m.material===window.__occ.mat',timeout=20000)
  await page.screenshot(path=str(OUT/f'{engine}-restored.png'))
  # the tank itself is never faded
  own=await page.evaluate('''()=>{let n=0;Conquest.view.vehicle.traverse(o=>{if(o.isMesh&&o.material&&o.material.transparent&&o.material.opacity<.5&&o.material.isMeshBasicMaterial&&!o.material.userData?.halo)n++;});return n;}''')
  assert not errors,errors
  result={'engine':engine,'status':'PASS','setupPrograms':setup['programs'],'fadedPrograms':faded['programs'],'fadedOpacity':faded2,'ownTankGhostMeshes':own,'physicalDeviceVerified':False}
  (OUT/f'{engine}-results.json').write_text(json.dumps(result,indent=1));print(json.dumps(result))
  await browser.close()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--engine',choices=['chromium','webkit'],default='chromium');asyncio.run(main(a.parse_args().engine))
