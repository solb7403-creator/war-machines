"""Session 5E-2d2 captures: the Parasite structures and the war scenery in the real Conquest world: the four hives (each on
its own seed) with their masts, the dormant portal and its open and suppressed looks, the nine LDF posts, the raid cover
walls, the raid spire (spire-<layout>: the style's raid-spire stood where the view stands a live raid's centrepiece: the clear
ground nearest to 45 m east and 15 m south of the raid's site, style.js S.raidSpireSpot) and the plasma battery (battery: the style's own, on the
flat south of the portal). Shipped client (index.html, local economy); the tank is stood near each place and the camera
turned to it. A subject is framed from a side with a clear line of sight (5E-2d2 critic round 2: three LDF posts were tiny or
hidden behind a lattice): after the world around it has streamed in, rays from each candidate camera spot to the subject
are tested against everything drawn, and the clearest spot is taken.
usage: python3 dev/tests/conquest-warscenery-captures.py [--quality high|low] [--size 390x844] [--mouse] [--out DIR]
       [--only portal,hive,ldf,cover,spire,battery or whole shot names: ldf-dam,portal-open] [--dpr 2] [--root DIR] [--tag after]
       [--shake N: N extra pictures of every shot 0.7 s apart, named ...-tN.png (the searchlight's sweep, the portal's turn)]
Software GL: looks only."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
HERE=pathlib.Path(__file__).resolve().parents[2]
# stand the tank `back` metres from (x, z) on open ground (the side with the flattest clear spot), looking at it
GO='''([x,z,back,pitch,dist,pick])=>{const v=Conquest.view,W=ConquestWorld,C=[];for(let a=0;a<16;a++){const an=a/16*Math.PI*2,px=x+Math.sin(an)*back,pz=z+Math.cos(an)*back;if(W.solidAt(px,pz)||W.waterAt(px,pz))continue;
  let block=0;for(let k=1;k<8;k++){const qx=px+(x-px)*k/8,qz=pz+(z-pz)*k/8;if(W.solidAt(qx,qz)&&Math.hypot(qx-x,qz-z)>9)block++;}/* the camera stands behind the tank: nothing solid there either (a house wall filled the picture), and no ground rising over it */for(let k=1;k<=5;k++){const d=dist*k/5,cx=px+(px-x)/back*d,cz=pz+(pz-z)/back*d;if(W.solidAt(cx,cz))block+=2;if(W.groundAt(cx,cz)-W.groundAt(px,pz)>d*Math.tan(pitch)*.8+1)block+=2;}const dy=W.groundAt(px,pz)-W.groundAt(x,z),sc=block*30+Math.abs(dy-2)*2+Math.abs(Math.cos(an)-1)*3;C.push([sc,px,pz]);}
 if(!C.length)return null;C.sort((a,b)=>a[0]-b[0]);const best=C[Math.min(pick||0,C.length-1)];v.jump(best[1],best[2]);v.heading=Math.atan2(x-best[1],z-best[2]);v.yaw=Math.PI+v.heading;v.aimYaw=v.heading;v.pitch=pitch;v.distance=dist;v.camSnap=true;
 const E=v.encounter;if(E){for(const e of E.enemies||[]){e.hp=0;if(E.cleared)E.cleared[e.key]=true;}E.playerHp=E.playerMax;}return {from:[best[1],best[2]],look:[x,z],cands:C};}'''
# the clearest of the candidate spots (5E-2d2 critic round 2): rays from where the camera would stand to the subject (its foot, its
# middle, its top) against every solid thing drawn, the subject itself, the tank and the glow quads left out. Returns the index.
SIGHT='''([x,z,back,pitch,dist,cands,own,top])=>{const v=Conquest.view,W=ConquestWorld,T=v.T,S=v.style,ox=v.origin.x,oz=v.origin.z,list=[];
 v.scene.traverse(o=>{if(!o.isMesh||!o.visible||o.material===S.MAT.fx||o.material===S.MAT.sky||o.isInstancedMesh)return;for(let q=o;q;q=q.parent){if(q===v.vehicle||!q.visible||(own&&q.name&&q.name.startsWith(own))||q.userData.captureSubject)return;}list.push(o);});
 const R=new T.Raycaster(),A=new T.Vector3(),D=new T.Vector3(),gy=W.groundAt(x,z);let best=0,bestN=1e9;const out=[];
 for(let i=0;i<Math.min(cands.length,10);i++){const [sc,px,pz]=cands[i],cx=px+(px-x)/back*dist*Math.cos(pitch),cz=pz+(pz-z)/back*dist*Math.cos(pitch),cy=W.groundAt(px,pz)+2+dist*Math.sin(pitch);let n=0;
  for(const h of [1.2,top*.5,top*.9])for(const sx of [-2.5,0,2.5]){const tx=x+sx*(pz-z)/back,tz=z-sx*(px-x)/back;A.set(cx-ox,cy,cz-oz);D.set(tx-ox,gy+h,tz-oz).sub(A);const L=D.length();D.multiplyScalar(1/L);R.set(A,D);R.near=.5;R.far=L-4;try{if(R.intersectObjects(list,false).length)n++;}catch(e){}}
  out.push(n);if(n+sc/30<bestN-.01){bestN=n+sc/30;best=i;}if(n===0&&sc<30)break;}
 return {best,blocked:out};}'''
PORTAL='''st=>{const v=Conquest.view,S=v.style,old=v.styleGroups.find(g=>g.name==='cq-style-portal'),g=S.warScenery({portal:st})[0];if(old){v.props.remove(old);v.styleGroups.splice(v.styleGroups.indexOf(old),1);}v.props.add(g);v.styleGroups.push(g);return g.userData.portal;}'''
SHARP='''for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){const v=g.call(this,p);return typeof v==='string'&&/swiftshader|llvmpipe|softpipe|software/i.test(v)?'Capture GPU':v;};}'''   # --sharp: the game holds a CPU rasterizer at .75x of the screen (js/graphics.js); a capture for LOOKS is drawn at the resolution a real device gets (HIGH on a phone: the device's own ratio, here the context's; LOW: 1x), by not telling the game the renderer is SwiftShader. Never used by a test that measures a budget.
async def main(a):
 ROOT=pathlib.Path(a.root).resolve() if a.root else HERE
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True);w,h=[int(v) for v in a.size.split('x')];only=a.only.split(',') if a.only else None
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
  await page.wait_for_function('Conquest.view.pending===0',timeout=900000)
  if a.clean:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,#cq-ui,.cq-ui{visibility:hidden!important}')
  data=await page.evaluate('''()=>{const v=Conquest.view,S=v.style,C=ConquestCombat,W=ConquestWorld,L={};for(const id of C.raidIds){const o=C.operations[id];if(!L[o.layout]){const sp=S.raidSpireSpot?S.raidSpireSpot(o.x+45,o.z+15):[o.x+45,o.z+15];L[o.layout]={id:o.layout,x:sp[0],z:sp[1]};}}
   return {ws:S.WAR_SCENERY||null,hives:C.installations.map(s=>({id:s.id,x:s.x,z:s.z+8})),spires:Object.values(L),cover:Object.values(W.raidObstacles.reduce((m,o)=>{(m[o.layout]=m[o.layout]||[]).push(o);return m;},{})).map(L=>{const b=L.reduce((m,o)=>Math.max(o.width,o.depth)>Math.max(m.width,m.depth)?o:m);return {id:L[0].layout,x:b.x,z:b.z,top:b.height};})};}''')   # a layout's cover shot looks at its longest wall (5E-2d2 critic round 2: the middle of a layout's walls was open ground with a boulder on it)
  # a subject the world does not hold by itself: the raid spire (the view stands it only during a live raid, at the raid's site + (45, 15):
  # view.js raidArchitecture) and the plasma battery (a raid objective), stood by the style's own builders at a real spot
  STAND='''([kind,x,z])=>{const v=Conquest.view,S=v.style,W=ConquestWorld;for(const o of v.props.children.filter(o=>o.userData.captureSubject))v.props.remove(o);const g=kind==='spire'?S.raidSpire():S.battery();g.userData.captureSubject=true;g.position.set(x,W.groundAt(x,z),z);if(kind==='battery'&&g.userData.gun)g.userData.gun.rotation.y=.6;v.props.add(g);let n=0;g.traverse(m=>{if(m.isMesh&&m.geometry.index)n+=m.geometry.index.count/3;});return n;}'''
  shots=[]   # (name, x, z, tank's distance, pitch, camera distance, portal state, the subject's own group (left out of the sight test), its height)
  if data['ws']:
   P=data['ws']['portal'];shots+=[('portal-'+st,P['x'],P['z'],38 if h>w else 34,.3,23,st,'cq-style-portal',15) for st in ['dormant','open','suppressed']];shots+=[('portal-far',P['x'],P['z'],70,.34,24,'dormant','cq-style-portal',15)]
   shots+=[('ldf-'+q['id'],q['x'],q['z'],17 if h>w else 15,.3,15 if h>w else 13,None,'cq-style-ldf-'+q['id'],11) for q in data['ws']['posts']]
   shots+=[('battery',P['x']-4,P['z']+34,27,.34,19,None,None,18)]
  shots+=[('hive-'+hv['id'],hv['x'],hv['z'],44,.32,24,None,None,0) for hv in data['hives']];shots+=[('cover-'+c['id'],c['x'],c['z'],30,.4,22,None,None,0) for c in data['cover'][:3]]
  shots+=[('cover-near-'+c['id'],c['x'],c['z'],19,.3,13,None,None,c['top']) for c in data['cover']]   # close enough to judge the plates, the veins and the trophies
  shots+=[('spire-'+c['id'],c['x'],c['z'],15,.3,12,None,None,8) for c in data['spires']]
  info={}
  for name,x,z,back,pitch,dist,st,own,top in shots:
   kind=name.split('-')[0]
   if only and kind not in only and name not in only:continue
   if st and data['ws']:await page.evaluate(PORTAL,st)
   if kind in ('spire','battery'):print(name,'stood by the style:',await page.evaluate(STAND,[kind,x,z]),'triangles',flush=True)
   pos=await page.evaluate(GO,[x,z,back,pitch,dist,0])
   if not pos:print('no standing place for',name,flush=True);continue
   async def settle():
    await page.wait_for_timeout(500)
    try:await page.wait_for_function('Conquest.view.pending===0',timeout=600000)
    except Exception:print('WARNING still streaming at',name,flush=True)
   await settle()
   if top:   # the world is in: take the candidate spot with the clearest line of sight
    sight=await page.evaluate(SIGHT,[x,z,back,pitch,dist,pos['cands'],own,top])
    if sight['best']:pos=await page.evaluate(GO,[x,z,back,pitch,dist,sight['best']]);await settle()
    pos['sight']=sight
   pos.pop('cands',None)
   await page.evaluate('([pitch,dist])=>{const v=Conquest.view;v.yaw=Math.PI+v.heading;v.pitch=pitch;v.distance=dist;v.camSnap=true;}',[pitch,dist]);await page.wait_for_timeout(a.settle)
   await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}.png'),timeout=180000)
   for k in range(a.shake):await page.wait_for_timeout(700);await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}-t{k+1}.png'),timeout=180000)
   info[name]=dict(pos,**await page.evaluate('(()=>{const v=Conquest.view,i=v.renderer.info;return {calls:i.render.calls,tris:i.render.triangles,programs:i.programs?.length};})()'));print(name,info[name],flush=True)
  (out/f'{a.tag}-scenery-{a.size}-{a.quality}.json').write_text(json.dumps({'errors':errors,'shots':info},indent=1))
  assert not errors,errors
  await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='high');ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default=str(HERE/'docs/conquest/session5e2d2/scenery'));ap.add_argument('--tag',default='after');ap.add_argument('--only',default='');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=900);ap.add_argument('--clean',action='store_true');ap.add_argument('--root',default='')
ap.add_argument('--sharp',action='store_true');ap.add_argument('--shake',type=int,default=0)
asyncio.run(main(ap.parse_args()))
