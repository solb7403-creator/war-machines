"""Session 5E-2d2 captures: the Parasite units, generals, drone and battery in the real Conquest renderer, framed the same way
before and after. Shipped client (index.html, local economy), scenario placements only (models stood on open ground in front of
the pilot's tank, a jump and a camera framing). Software GL: relative look only, never a phone frame rate.
usage: python3 dev/tests/conquest-parasite-captures.py [--quality high|low] [--size 390x844] [--mouse] [--out DIR]
       [--tag before|after] [--only lineup,generals,...] [--dpr 2] [--ratio 2] [--root DIR]
Shots: lineup (the units side by side at chase distance), lineup-close, generals (the five doctrines on the Warlord),
generals-raider, generals-sentinel, air (the drone and the plasma battery), dead (each unit's wreck pose, after only).
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
 if(!v.__capAt){let best=1e9,at=null;for(let x=1240;x<=1560;x+=16)for(let z=820;z<=1010;z+=16){let lo=1e9,hi=-1e9,bad=false;for(let i=-3;i<=3&&!bad;i++)for(let j=-1;j<=4;j++){const px=x+i*8,pz=z+j*8;if(W.solidAt(px,pz)||W.waterAt(px,pz)){bad=true;break;}const g=W.groundAt(px,pz);lo=Math.min(lo,g);hi=Math.max(hi,g);}
   if(!bad&&hi-lo<best){best=hi-lo;at=[x,z];}}v.__capAt=at;}
 const [cx,cz]=v.__capAt;v.jump(cx,cz);v.heading=0;v.yaw=Math.PI;v.pitch=pitch;v.distance=dist;v.camSnap=true;
 const E=v.encounter;if(E){for(const e of E.enemies||[]){e.hp=0;if(E.cleared)E.cleared[e.key]=true;}E.playerHp=E.playerMax;}
 const A=ConquestCombat.archetypes,n=spec.length,out=[];
 spec.forEach((s,i)=>{const a=A[s.kind]||{},e=Object.assign({id:90000+i,cls:a.cls,arch:a.arch,hp:1,maxHp:1,heading:Math.PI,turret:Math.PI,x:cx+(i-(n-1)/2)*gap,z:cz+ahead+(s.dz||0)},s);e.y=(s.drone?W.groundAt(e.x,e.z)+(s.alt||6):W.groundAt(e.x,e.z));
  let g;try{g=v.enemyModel(e);}catch(err){out.push(s.kind+': '+err.message);return;}
  g.position.set(e.x-v.origin.x,e.y,e.z-v.origin.z);g.rotation.set(0,Math.PI,0);if(g.userData.gun)g.userData.gun.rotation.y=0;
  if(dead&&v.style&&v.style.unitPose)v.style.unitPose(g,dead);g.visible=true;v.__cap.push(g);out.push(s.kind+(s.pattern?':'+s.pattern:''));});
 return {at:v.__capAt,placed:out,style:!!v.style};}'''
U=lambda k,**o:dict(kind=k,**o)
CMD=['shield','ambush','artillery','carrier','plasma']
SHOTS={
 'lineup':([U('raider'),U('breacher'),U('sentinel'),U('command'),U('swarm'),U('brute')],5.2,26,.42,23,0),
 'lineup-close':([U('raider'),U('breacher'),U('sentinel'),U('command'),U('swarm'),U('brute')],5.4,13,.36,17,0),
 'pack':([U('swarm',dz=(i%2)*2.6) for i in range(7)],2.4,16,.42,20,0),
 'generals':([U('command',commander=True,pattern=p) for p in CMD],5.6,24,.42,23,0),
 'generals-raider':([U('raider',commander=True,pattern=p) for p in CMD],4.4,20,.42,21,0),
 'generals-sentinel':([U('sentinel',commander=True,pattern=p) for p in CMD],5.8,24,.42,23,0),
 'air':([U('raider',drone=True,alt=5),U('command',immobile=True),U('raider',drone=True,alt=9)],8,24,.34,24,0),
 'dead':([U('raider'),U('breacher'),U('sentinel'),U('command'),U('swarm'),U('brute')],5.2,22,.46,22,3)}
async def main(a):
 ROOT=pathlib.Path(a.root).resolve() if a.root else HERE
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True);w,h=[int(v) for v in a.size.split('x')];shots=[s for s in SHOTS if not a.only or s in a.only.split(',')]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1 if a.mouse else a.dpr,has_touch=not a.mouse,is_mobile=not a.mouse,reduced_motion='reduce')
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
  ratio=lambda r:page.evaluate('r=>{const v=Conquest.view;v.res=null;v.renderer.setPixelRatio(r);}',r)
  if a.ratio:await ratio(.3)
  await page.wait_for_function('Conquest.view.pending===0',timeout=900000)
  info={}
  for name in shots:
   spec,gap,ahead,pitch,dist,dead=SHOTS[name]
   if a.ratio:await ratio(.3)
   placed=await page.evaluate(PLACE,[spec,gap,ahead,pitch,dist,dead]);await page.wait_for_timeout(400)
   try:await page.wait_for_function('Conquest.view.pending===0',timeout=600000)
   except Exception:print('WARNING still streaming at the shot:',name,flush=True)
   if a.ratio:await ratio(a.ratio)
   await page.evaluate('([pitch,dist])=>{const v=Conquest.view;v.yaw=Math.PI;v.pitch=pitch;v.distance=dist;v.camSnap=true;if(v.style&&v.style.atmo)v.style.atmo(v.p,10);for(const g of v.__cap||[])g.visible=true;}',[pitch,dist])
   await page.wait_for_timeout(a.settle);await page.evaluate('()=>new Promise(r=>{let n=0;const f=()=>{for(const g of Conquest.view.__cap||[])g.visible=true;++n<3?requestAnimationFrame(f):r();};requestAnimationFrame(f);})')
   if a.clean and not info:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,#cq-ui,.cq-ui{visibility:hidden!important}')
   await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}.png'),timeout=180000)
   info[name]=dict(placed,**await page.evaluate('(()=>{const v=Conquest.view,i=v.renderer.info;return {calls:i.render.calls,tris:i.render.triangles,programs:i.programs?.length};})()'))
   print(name,info[name],flush=True)
  (out/f'{a.tag}-units-{a.size}-{a.quality}.json').write_text(json.dumps({'errors':errors,'shots':info},indent=1))
  assert not errors,errors
  await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='high');ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default=str(HERE/'docs/conquest/session5e2d2/units'));ap.add_argument('--tag',default='after');ap.add_argument('--only',default='');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=900);ap.add_argument('--clean',action='store_true');ap.add_argument('--ratio',type=float,default=0);ap.add_argument('--root',default='')
asyncio.run(main(ap.parse_args()))
