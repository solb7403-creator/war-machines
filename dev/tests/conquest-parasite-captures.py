"""Session 5E-2d2 captures: the Parasite units, generals, drone and battery in the real Conquest renderer, framed the same way
before and after. Shipped client (index.html, local economy), scenario placements only (models stood on open ground in front of
the pilot's tank, a jump and a camera framing). Software GL: relative look only, never a phone frame rate.
usage: python3 dev/tests/conquest-parasite-captures.py [--quality high|low] [--size 390x844] [--mouse] [--out DIR]
       [--tag before|after] [--only lineup,generals,...] [--dpr 2] [--ratio 2] [--root DIR] [--mask]
Shots: lineup (the six units at chase distance), lineup-a, lineup-b (three each, the chase camera's own framing),
lineup-close, pack (seven Grabbers), generals (the five doctrines on the Warlord), generals-raider, generals-sentinel,
air (the drone and the plasma battery), dead (each unit's wreck pose, after only).
Critic round 1 (Nov 25) asked for more than head-on views: lineup-34 and lineup-side (the six turned three-quarter / side
on), turn-raider, turn-breacher, turn-sentinel, turn-command, turn-swarm, turn-brute (one unit: front three-quarter, side,
rear three-quarter), drones (the drone near the camera: front, three-quarter, side).
On a phone (a portrait size) the six units and the five generals stand in TWO ROWS so every one is inside the frame (a single
row of six is wider than a 390 px screen at chase distance); the back row holds the tall ones, far enough back to clear
the front row. A landscape size keeps the single row.
--mask also saves, for every shot, one picture per unit with only that unit's hull and gun hidden (DIR/hide/<shot>.<i>.png):
the difference from the shot is that unit's exact pixels (brightness / hue / silhouette measurements, never a guess by colour).
Sizes used by the session: 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (--mouse: keyboard + mouse)."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
HERE=pathlib.Path(__file__).resolve().parents[2]
# Stand a row of models in front of the tank on the flattest open ground near the Refuge approach. spec = list of enemy-like
# records for Conquest.view.enemyModel; gap = metres between them; ahead = metres in front of the tank; opt.dead = seconds dead.
PLACE='''([spec,gap,ahead,pitch,dist,dead])=>{const v=Conquest.view,W=ConquestWorld,T=THREE;
 if(v.__cap){for(const g of v.__cap)v.scene.remove(g);}v.__cap=[];
 // the flattest spot of a coarse search over the barren plain north of the Refuge (kept for every later shot)
 if(!v.__capAt){let best=1e9,at=null;for(let x=1240;x<=1560;x+=8)for(let z=820;z<=1100;z+=8){let lo=1e9,hi=-1e9,n=0;/* every 2 m of the stage (the rows stand up to 22 m either side and 48 m ahead) and of the strip the camera looks along behind the tank: a boulder between the old grid's 8 m points stood in the middle of the line-up. The spot with the fewest solid points wins, then the flattest. */
   for(let i=-11;i<=11;i++)for(let k=-13;k<=24;k++){if(k<2&&Math.abs(i)>3)continue;const px=x+i*2,pz=z+k*2;if(W.solidAt(px,pz)||W.waterAt(px,pz))n++;const g=W.groundAt(px,pz);lo=Math.min(lo,g);hi=Math.max(hi,g);}
   const sc=n*100+(hi-lo);if(sc<best){best=sc;at=[x,z];}}v.__capAt=at;}
 const [cx,cz]=v.__capAt;v.jump(cx,cz);v.heading=0;v.yaw=Math.PI;v.pitch=pitch;v.distance=dist;v.camSnap=true;
 const E=v.encounter;if(E){for(const e of E.enemies||[]){e.hp=0;if(E.cleared)E.cleared[e.key]=true;}E.playerHp=E.playerMax;}
 const A=ConquestCombat.archetypes,n=spec.length,out=[];
 spec.forEach((s,i)=>{const a=A[s.kind]||{},e=Object.assign({id:90000+i,cls:a.cls,arch:a.arch,hp:1,maxHp:1,heading:Math.PI,turret:Math.PI,x:cx+(typeof s.dx==='number'?s.dx:(i-(n-1)/2)*gap),z:cz+ahead+(s.dz||0)},s);e.y=(s.drone?W.groundAt(e.x,e.z)+(s.alt||6):W.groundAt(e.x,e.z));
  let g;try{g=v.enemyModel(e);}catch(err){out.push(s.kind+': '+err.message);return;}
  g.position.set(e.x-v.origin.x,e.y,e.z-v.origin.z);g.rotation.set(0,Math.PI+(s.rot||0),0);if(g.userData.gun)g.userData.gun.rotation.y=0;
  if(dead&&v.style&&v.style.unitPose)v.style.unitPose(g,dead);g.visible=true;v.__cap.push(g);out.push(s.kind+(s.pattern?':'+s.pattern:''));});
 return {at:v.__capAt,placed:out,style:!!v.style};}'''
U=lambda k,**o:dict(kind=k,**o)
CMD=['shield','ambush','artillery','carrier','plasma']
SIX=['raider','breacher','sentinel','command','swarm','brute']
SHOTS={
 'lineup':([U(k) for k in SIX],6.4,34,.4,25,0),
 'lineup-a':([U('raider'),U('breacher'),U('sentinel')],7,24,.42,23,0),
 'lineup-b':([U('command'),U('swarm'),U('brute')],7,24,.42,23,0),
 'lineup-close':([U(k) for k in SIX],5.4,13,.36,17,0),
 'pack':([U('swarm',id=90000+i,dz=(i%2)*2.6) for i in range(7)],2.4,16,.42,20,0),
 'generals':([U('command',commander=True,pattern=p) for p in CMD],5.6,24,.42,23,0),
 'generals-raider':([U('raider',commander=True,pattern=p) for p in CMD],4.4,20,.42,21,0),
 'generals-sentinel':([U('sentinel',commander=True,pattern=p) for p in CMD],5.8,24,.42,23,0),
 'air':([U('raider',drone=True,alt=5),U('command',immobile=True),U('raider',drone=True,alt=9)],8,24,.34,24,0),
 'dead':([U(k) for k in SIX],5.2,22,.46,22,3),
 'lineup-34':([U(k,rot=.75) for k in SIX],7.4,36,.4,25,0),
 'lineup-side':([U(k,rot=1.5708) for k in SIX],8.6,40,.4,25,0),
 'drones':([U('raider',drone=True,alt=3.2,rot=r) for r in (0,.75,1.5708)],5.5,9,.3,18,0)}
for _k in SIX:SHOTS['turn-'+_k]=([U(_k,rot=r) for r in (.75,1.5708,2.4)],{'raider':6.5,'swarm':3.4}.get(_k,9.5),{'swarm':13}.get(_k,24),.42,{'swarm':17}.get(_k,23),0)
# The phone framings (portrait): two rows. rows(front, back, gap, dz) -> the back row dz metres behind, both rows centred.
def rows(front,back,gap,dz,gapB=None):
 out=[]
 for r,(L,z,g) in enumerate(((front,0,gap),(back,dz,gapB or gap))):
  for i,u in enumerate(L):out.append(dict(u,dx=(i-(len(L)-1)/2)*g,dz=z+u.get('dz',0)))
 return out
G=lambda k,ps,**o:[U(k,commander=True,pattern=p,**o) for p in ps]
PHONE={
 'lineup':(rows([U('raider'),U('swarm'),U('breacher')],[U('sentinel'),U('command'),U('brute')],6.2,17,7.6),0,14,.36,23,0),
 'lineup-34':(rows([U('raider',rot=.75),U('swarm',rot=.75),U('breacher',rot=.75)],[U('sentinel',rot=.75),U('command',rot=.75),U('brute',rot=.75)],6.6,18,8.6),0,14,.36,23,0),
 'lineup-side':(rows([U('raider',rot=1.5708),U('swarm',rot=1.5708),U('breacher',rot=1.5708)],[U('sentinel',rot=1.5708),U('command',rot=1.5708),U('brute',rot=1.5708)],7,18,9.4),0,14,.36,23,0),
 'dead':(rows([U('raider'),U('swarm'),U('breacher')],[U('sentinel'),U('command'),U('brute')],6.2,17,7.6),0,14,.36,23,3),
 'generals':(rows(G('command',CMD[:2]),G('command',CMD[2:]),7,17,7.4),0,14,.36,23,0),
 'generals-raider':(rows(G('raider',CMD[:2]),G('raider',CMD[2:]),5,12,5.4),0,13,.36,21,0),
 'generals-sentinel':(rows(G('sentinel',CMD[:2]),G('sentinel',CMD[2:]),7,17,7.4),0,14,.36,23,0),
 # 5E-2d2 critic round 2: three drones in a row were wider than a phone (the outer two were cut in half): one in front, two behind
 'drones':(rows([U('raider',drone=True,alt=3.2,rot=.75)],[U('raider',drone=True,alt=3.6,rot=0),U('raider',drone=True,alt=3.6,rot=1.5708)],0,8,6.2),0,9,.3,18,0)}
SHARP='''for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){const v=g.call(this,p);return typeof v==='string'&&/swiftshader|llvmpipe|softpipe|software/i.test(v)?'Capture GPU':v;};}'''   # --sharp: the game holds a CPU rasterizer at .75x of the screen (js/graphics.js); a capture for LOOKS is drawn at the resolution a real device gets (HIGH on a phone: the device's own ratio, here the context's; LOW: 1x), by not telling the game the renderer is SwiftShader. Never used by a test that measures a budget.
async def main(a):
 ROOT=pathlib.Path(a.root).resolve() if a.root else HERE
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True);w,h=[int(v) for v in a.size.split('x')];shots=[s for s in SHOTS if not a.only or s in a.only.split(',')];TABLE=dict(SHOTS,**PHONE) if h>w else SHOTS
 if a.mask:(out/'hide').mkdir(exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1 if a.mouse else a.dpr,has_touch=not a.mouse,is_mobile=not a.mouse,reduced_motion='reduce')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script(SHARP) if a.sharp else None;await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='+json.dumps(a.quality)+';try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"')
  await page.evaluate('closeAll();save.welcomed=true;save.gfx='+json.dumps(a.quality)+';uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.wait_for_function('typeof Conquest!=="undefined"&&!!Conquest.view',timeout=120000)
  if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
  ratio=lambda r:page.evaluate('r=>{const v=Conquest.view;v.res=null;v.renderer.setPixelRatio(r);}',r)
  if a.ratio:await ratio(.3)
  await page.wait_for_function('Conquest.view.pending===0',timeout=900000)
  info={}
  for name in shots:
   spec,gap,ahead,pitch,dist,dead=TABLE[name]
   if h>w and h<=700 and name in PHONE:ahead-=6;dist-=2;spec=[dict(u,dz=u.get('dz',0)*.72) for u in spec]   # a short phone: the HUD takes more of the screen, so the rows stand nearer, and the back row nearer the front one (5E-2d2 critic round 2: at 320x568 the back row stood behind the HULL and HEAT panels)
   if a.ratio:await ratio(.3)
   placed=await page.evaluate(PLACE,[spec,gap,ahead,pitch,dist,dead]);await page.wait_for_timeout(400)
   if not info:await page.wait_for_timeout(1500);placed=await page.evaluate(PLACE,[spec,gap,ahead,pitch,dist,dead]);await page.wait_for_timeout(400)   # the first shot: the jump to the capture ground settles first
   try:await page.wait_for_function('Conquest.view.pending===0',timeout=600000)
   except Exception:print('WARNING still streaming at the shot:',name,flush=True)
   if a.ratio:await ratio(a.ratio)
   await page.evaluate('([pitch,dist])=>{const v=Conquest.view;v.yaw=Math.PI;v.pitch=pitch;v.distance=dist;v.camSnap=true;if(v.style&&v.style.atmo)v.style.atmo(v.p,10);for(const g of v.__cap||[])g.visible=true;}',[pitch,dist])
   await page.wait_for_timeout(a.settle);await page.evaluate('()=>new Promise(r=>{let n=0;const f=()=>{for(const g of Conquest.view.__cap||[])g.visible=true;++n<3?requestAnimationFrame(f):r();};requestAnimationFrame(f);})')
   if a.clean and not info:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,#cq-ui,.cq-ui{visibility:hidden!important}')
   await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}.png'),timeout=180000)
   if a.mask:   # one picture per unit with its hull and gun hidden (its glow, marker and every other unit stay)
    HIDE='''i=>new Promise(r=>{const C=Conquest.view.__cap||[];C.forEach((g,k)=>{const b=g.userData.body||g;g.traverse(o=>{if(o.isMesh&&o.material&&(o.material===Conquest.view.style.MAT.par||o.material===Conquest.view.style.MAT.parHit))o.layers.mask=k===i?0:1;});});let n=0;const f=()=>{++n<3?requestAnimationFrame(f):r();};requestAnimationFrame(f);})'''
    for i in range(len(spec)):
     await page.evaluate(HIDE,i);await page.screenshot(path=str(out/'hide'/f'{a.tag}-{name}-{a.size}-{a.quality}.{i}.png'),timeout=180000)
    await page.evaluate(HIDE,-1)
   # boxes: each unit's rectangle in the picture (picture pixels: left, top, right, bottom), for crops and measurements
   info[name]=dict(placed,**await page.evaluate('''(()=>{const v=Conquest.view,i=v.renderer.info,T=THREE,r=v.renderer.domElement.getBoundingClientRect(),k=window.devicePixelRatio||1,p=new T.Vector3(),B3=(()=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(9),3));g.computeBoundingBox();return g.boundingBox.constructor;})();   /* the game's three.js build does not export Box3: take the class from a geometry's own box */
    const boxes=(v.__cap||[]).map(g=>{const b=new B3();g.updateMatrixWorld(true);g.traverse(o=>{if(o.isMesh&&o.geometry&&(o.material===v.style?.MAT.par||o.material===v.style?.MAT.parHit||o.material===v.style?.MAT.parDead)){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});if(b.isEmpty())return null;
     let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let c=0;c<8;c++){p.set(c&1?b.max.x:b.min.x,c&2?b.max.y:b.min.y,c&4?b.max.z:b.min.z).project(v.camera);const x=(r.left+(p.x+1)/2*r.width)*k,y=(r.top+(1-p.y)/2*r.height)*k;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return [x0,y0,x1,y1].map(Math.round);});
    return {calls:i.render.calls,tris:i.render.triangles,programs:i.programs?.length,boxes};})()'''))
   print(name,info[name],flush=True)
  (out/f'{a.tag}-units-{a.size}-{a.quality}.json').write_text(json.dumps({'errors':errors,'shots':info},indent=1))
  assert not errors,errors
  await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='high');ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default=str(HERE/'docs/conquest/session5e2d2/units'));ap.add_argument('--tag',default='after');ap.add_argument('--only',default='');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=900);ap.add_argument('--clean',action='store_true');ap.add_argument('--ratio',type=float,default=0);ap.add_argument('--root',default='');ap.add_argument('--mask',action='store_true')
ap.add_argument('--sharp',action='store_true')
asyncio.run(main(ap.parse_args()))
