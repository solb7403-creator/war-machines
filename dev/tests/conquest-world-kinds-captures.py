"""Session 5E-2d1 world-rebuild captures: every rebuilt Conquest world kind, framed the same way before and after.
Shipped client (index.html, local economy), real renderer, scenario placements only (a jump + a camera framing).
Software GL: relative look only, never a phone frame rate.
usage: python3 dev/tests/conquest-world-kinds-captures.py [--quality high|low] [--size 390x844] [--mouse] [--out DIR]
       [--tag before|after] [--only name,name] [--dpr 2] [--ratio 2]
Sizes used by the session: 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (--mouse: keyboard + mouse)."""
import argparse,asyncio,json,math,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
# name, subject (a JS expression for [x, z] in the page, F = the style's footprints, W = ConquestWorld), the side the tank
# stands on (degrees from +x toward +z, seen from the subject), stand-off (m), camera pitch, camera distance.
# The tank is placed on open ground at the stand-off and the camera looks over it at the subject.
SHOTS=[
 ('refuge-habitats','[F.habitats[0].x,F.habitats[0].z]',90,22,.32,26),
 ('refuge-habitat-close','[F.habitats[1].x,F.habitats[1].z]',60,14,.26,15),
 ('refuge-processors','[F.processors[1].x,F.processors[1].z]',270,48,.16,60),
 ('refuge-processor-base','[F.processors[1].x,F.processors[1].z]',255,23,.24,22),
 ('refuge-terminal','[F.terminal.x,F.terminal.z]',90,9,.8,24),   # steep ground all round: the game lifts the camera, so this one is framed from above
 ('refuge-solar','[F.solar[2].x,F.solar[2].z]',270,17,.6,30),
 ('viaduct','[1020,1024]',90,34,.2,42),
 ('viaduct-deck','[1040,1024]',180,30,.3,20),
 ('command-base-site','[ConquestCombat.baseDefinition.x,ConquestCombat.baseDefinition.z]',270,34,.4,38),
 ('hive','[F.installations[0].solid.x,F.installations[0].solid.z]',180,26,.3,32),
 ('raid-cover','[915,942]',90,14,.4,24),
 ('colony-core','[1062,1090]',135,24,.32,38),
 ('colony-homes','[1146,1108]',90,13,.3,17),
 ('colony-shop','[1194,1060]',80,12,.28,15),
 ('colony-hall','[1014,1144]',90,15,.28,21),
 ('colony-block','[1194,1096]',90,14,.24,20),
 ('colony-water-tower','[1218,1096]',90,20,.1,30),
 ('colony-hangar','[1098,1060]',90,18,.28,23),
 ('colony-plaza','[1012,1096]',90,16,.5,28),
 ('colony-monorail','[1100,1100]',90,18,.08,30),
 ('farm-silos','[919,1080]',90,15,.18,23),
 ('farm-greenhouse','[918,1164]',180,14,.3,20),   # not from +z: the ice rig stands there
 ('farm-fields','[906,1119]',0,26,.4,32),
 ('frontier-wall','[1255,1166]',200,14,.5,26),   # the wall climbs a steep rim: framed along it from the colony side
 ('frontier-defences','[1272,1146]',170,16,.45,28),
 ('frontier-gate','[1062,1066]',270,18,.26,25),
 ('frontier-watch','[1311,1094]',200,18,.4,30),
 ('atmo-pylon','[1004,1122]',90,14,.18,22),
 ('dam','[801,1364]',90,30,.3,42),
 ('creek-bridge','[936.5,1197.4]',60,20,.3,24),
 ('ice-crater','[922,1179]',315,18,.34,25),
 ('pipeline','[975,1171]',90,8,.3,15),
 ('forest','[972,1216]',0,26,.24,28),
 ('wild-meadow','[990,1300]',45,8,.6,22),
 ('wreck-band','(Conquest.view.frontier&&Conquest.view.frontier.userData.wrecks&&Conquest.view.frontier.userData.wrecks[0])||[1250,1040]',90,9,.3,14),
 ('barren-rocks','[1300,900]',90,8,.3,18),
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
  # while a place streams in, the view is drawn small (the software renderer is slow and streaming advances a step a frame); the shot itself is drawn at --ratio
  ratio=lambda r:page.evaluate('r=>{const v=Conquest.view;v.res=null;v.renderer.setPixelRatio(r);}',r)
  if a.ratio:await ratio(.3)
  await page.wait_for_function('Conquest.view.pending===0',timeout=900000)
  # --ratio: draw at a phone's real resolution (the software renderer otherwise holds the view at .75x, which reads as pixelated)
  info={}
  for name,subj,deg,stand,pitch,dist in shots:
   # the tank stands on open ground beside the subject (never inside a solid: it would be pressed against it and thin it);
   # local raiders are stood down so the frame shows the place, not a fight
   if a.ratio:await ratio(.3)
   yaw=await page.evaluate('''([deg,stand,pitch,dist,deck])=>{const v=Conquest.view,W=ConquestWorld,F=v.style.footprints,S=('''+subj+'''),a=deg*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a);
    const free=(x,z)=>{for(let k=0;k<8;k++)if(W.solidAt(x+Math.cos(k*.785)*5,z+Math.sin(k*.785)*5))return false;return !W.solidAt(x,z)&&!W.waterAt(x,z);};
    // the side to stand on: the asked one, or the nearest side where the ground does not rise behind the tank (the game lifts
    // the camera over terrain between it and the hull, which would turn the shot into a top-down one)
    const rise=(x,z)=>{const fx=S[0]-x,fz=S[1]-z,l=Math.hypot(fx,fz)||1,g0=W.groundAt(x,z),h=Math.cos(pitch)*dist;let worst=0;for(let i=1;i<=16;i++){const t=i/16,g=W.groundAt(x-fx/l*h*t,z-fz/l*h*t);worst=Math.max(worst,(g-g0)/t-Math.sin(pitch)*dist);}return worst;};
    let x=0,z=0,best=1e9;for(const off of [0,25,-25,50,-50,80,-80,115,-115,150,-150,180]){const b=a+off*Math.PI/180,p=S[0]+Math.cos(b)*stand,q=S[1]+Math.sin(b)*stand;if(!free(p,q))continue;const sc=Math.max(0,rise(p,q))+Math.abs(off)*.004;if(sc<best){best=sc;x=p;z=q;}if(sc<.5)break;}
    if(best>1e8){x=S[0]+dx*stand;z=S[1]+dz*stand;search:for(let r=2;r<=22;r+=2)for(let k=0;k<16;k++){const p=x+Math.cos(k*.3927)*r,q=z+Math.sin(k*.3927)*r;if(free(p,q)){x=p;z=q;break search;}}}
    if(deck){x=S[0]+dx*stand;z=S[1]+dz*stand;}
    const fx=S[0]-x,fz=S[1]-z,yaw=Math.atan2(-fx,-fz);v.jump(x,z);if(deck&&W.deckAt(x,z)!==null){v.p.surface='bridge';v.p.y=W.deckAt(x,z);}v.heading=Math.atan2(fx,fz);v.yaw=yaw;v.pitch=pitch;v.distance=dist;v.camSnap=true;
    const E=v.encounter;if(E){for(const e of E.enemies||[]){e.hp=0;if(E.cleared)E.cleared[e.key]=true;}E.playerHp=E.playerMax;}return yaw;}''',[deg,stand,pitch,dist,name=='viaduct-deck'])
   await page.wait_for_timeout(400)
   try:await page.wait_for_function('Conquest.view.pending===0',timeout=600000)
   except Exception:print('WARNING still streaming at the shot:',name,flush=True)
   if a.ratio:await ratio(a.ratio)
   await page.evaluate('([yaw,pitch,dist])=>{const v=Conquest.view;v.yaw=yaw;v.pitch=pitch;v.distance=dist;v.camSnap=true;if(v.style&&v.style.atmo)v.style.atmo(v.p,10);}',[yaw,pitch,dist])   # the sky eases toward the place the tank stands in: a capture jumps, so it is settled at once
   await page.wait_for_timeout(a.settle);await page.evaluate('()=>new Promise(r=>{let n=0;const f=()=>++n<3?requestAnimationFrame(f):r();requestAnimationFrame(f);})')   # three frames at the shot's resolution
   if a.clean:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,#cq-ui,.cq-ui{visibility:hidden!important}') if not info else None
   await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}.png'),timeout=180000)
   info[name]=await page.evaluate('(()=>{const v=Conquest.view,i=v.renderer.info;return {calls:i.render.calls,tris:i.render.triangles,programs:i.programs?.length};})()')
   print(name,info[name],flush=True)
  (out/f'{a.tag}-{a.size}-{a.quality}.json').write_text(json.dumps({'errors':errors,'shots':info},indent=1))
  assert not errors,errors
  await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='high');ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default=str(ROOT/'docs/conquest/session5e2d1/kinds'));ap.add_argument('--tag',default='after');ap.add_argument('--only',default='');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=900);ap.add_argument('--clean',action='store_true');ap.add_argument('--ratio',type=float,default=0)
asyncio.run(main(ap.parse_args()))
