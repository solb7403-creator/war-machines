"""Session 5E-2d1 world-rebuild captures: every rebuilt Conquest world kind, framed the same way before and after.
Shipped client (index.html, local economy), real renderer, scenario placements only (a jump + a camera framing).
Software GL: relative look only, never a phone frame rate.
usage: python3 dev/tests/conquest-world-kinds-captures.py [--quality high|low] [--size 390x844] [--mouse] [--out DIR]
       [--tag before|after] [--only name,name] [--dpr 2]
Sizes used by the session: 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (--mouse: keyboard + mouse)."""
import argparse,asyncio,json,math,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
def look(fx,fz):return math.atan2(-fx,-fz)   # camera behind the hull looking along (fx, fz)
# name, jump [x, z], camera yaw, pitch, distance
SHOTS=[
 ('refuge-habitats',[1132,1140],look(0,1),.42,44),
 ('refuge-habitat-close',[1121,1160],look(-.6,-.8),.34,24),
 ('refuge-processors',[1180,1118],look(0,-1),.3,70),
 ('refuge-processor-base',[1165,1098],look(.3,-1),.3,34),
 ('refuge-terminal',[1174,1180],look(0,-1),.36,26),
 ('refuge-solar',[1142,1214],look(0,1),.4,36),
 ('viaduct',[1020,1044],look(0,-1),.3,56),
 ('viaduct-deck',[1000,1024],look(1,0),.3,30),
 ('command-base-site',[1080,1126],look(0,1),.5,52),
 ('hive',[1240,950],look(0,-1),.36,48),
 ('raid-cover',[915,960],look(0,-1),.45,40),
 ('colony-core',[1096,1128],look(.92,-.38),.3,46),
 ('colony-homes',[1000,1072],look(-.2,-1),.36,32),
 ('colony-shop',[1006,1072],look(-.3,-1),.3,22),
 ('colony-hall',[1118,1096],look(-.5,-1),.34,34),
 ('colony-block',[1222,1066],look(1,0),.34,32),
 ('colony-water-tower',[1056,1072],look(-.4,-1),.3,40),
 ('colony-hangar',[1110,1068],look(-1,-.4),.34,34),
 ('colony-plaza',[1012,1112],look(0,-1),.5,40),
 ('farm-silos',[913,1094],look(0,-1),.32,34),
 ('farm-greenhouse',[918,1178],look(0,-1),.36,30),
 ('farm-fields',[946,1102],look(-1,.1),.34,44),
 ('frontier-wall',[1006,1074],look(-.2,-1),.34,40),
 ('frontier-gate',[1062,1082],look(0,-1),.34,34),
 ('frontier-watch',[1300,1104],look(.6,-.6),.34,34),
 ('atmo-pylon',[1004,1136],look(0,-1),.3,34),
 ('dam',[800,1380],look(0,-1),.36,60),
 ('creek-bridge',[953,1186],look(-.85,.5),.3,36),
 ('ice-crater',[946,1196],look(-.7,-.7),.4,40),
 ('forest',[990,1222],look(-1,-.2),.3,36),
 ('wild-meadow',[990,1300],look(-.6,-.8),.24,34),
 ('wreck-band',[1250,1040],look(.4,-1),.34,40),
 ('barren-rocks',[1300,900],look(0,-1),.34,36),
]
async def main(a):
 w,h=[int(v) for v in a.size.split('x')];out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
 shots=[s for s in SHOTS if not a.only or s[0] in a.only.split(',')]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=a.dpr,has_touch=not a.mouse,is_mobile=not a.mouse,reduced_motion='reduce')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='+json.dumps(a.quality)+';try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"')
  await page.evaluate('closeAll();save.welcomed=true;save.gfx='+json.dumps(a.quality)+';uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.wait_for_function('typeof Conquest!=="undefined"&&!!Conquest.view',timeout=120000)
  if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
  await page.wait_for_function('Conquest.view.pending===0',timeout=240000)
  info={}
  for name,pos,yaw,pitch,dist in shots:
   await page.evaluate('([x,z,yaw,pitch,dist])=>{const v=Conquest.view;v.jump(x,z);v.yaw=yaw;v.pitch=pitch;v.distance=dist;v.camSnap=true;}',[pos[0],pos[1],yaw,pitch,dist])
   await page.wait_for_timeout(400)
   try:await page.wait_for_function('Conquest.view.pending===0',timeout=180000)
   except Exception:pass
   await page.evaluate('([yaw,pitch,dist])=>{const v=Conquest.view;v.yaw=yaw;v.pitch=pitch;v.distance=dist;v.camSnap=true;}',[yaw,pitch,dist])
   await page.wait_for_timeout(a.settle)
   if a.clean:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,#cq-ui,.cq-ui{visibility:hidden!important}') if not info else None
   await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}.png'))
   info[name]=await page.evaluate('(()=>{const v=Conquest.view,i=v.renderer.info;return {calls:i.render.calls,tris:i.render.triangles,programs:i.programs?.length};})()')
   print(name,info[name],flush=True)
  (out/f'{a.tag}-{a.size}-{a.quality}.json').write_text(json.dumps({'errors':errors,'shots':info},indent=1))
  assert not errors,errors
  await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='high');ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default=str(ROOT/'docs/conquest/session5e2d1/kinds'));ap.add_argument('--tag',default='after');ap.add_argument('--only',default='');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=900);ap.add_argument('--clean',action='store_true')
asyncio.run(main(ap.parse_args()))
