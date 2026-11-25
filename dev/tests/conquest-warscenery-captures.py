"""Session 5E-2d2 captures: the Parasite structures and the war scenery in the real Conquest world: the four hives (each on
its own seed) with their masts, the dormant portal and its open and suppressed looks, the nine LDF posts, the raid cover
walls. Shipped client (index.html, local economy); the tank is stood near each place and the camera turned to it.
usage: python3 dev/tests/conquest-warscenery-captures.py [--quality high|low] [--size 390x844] [--mouse] [--out DIR]
       [--only portal,hive,ldf,cover] [--dpr 2] [--root DIR] [--tag after]
Software GL: looks only."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
HERE=pathlib.Path(__file__).resolve().parents[2]
# stand the tank `back` metres from (x, z) on open ground (the side with the flattest clear spot), looking at it
GO='''([x,z,back,pitch,dist,lift])=>{const v=Conquest.view,W=ConquestWorld;let best=null;for(let a=0;a<16;a++){const an=a/16*Math.PI*2,px=x+Math.sin(an)*back,pz=z+Math.cos(an)*back;if(W.solidAt(px,pz)||W.waterAt(px,pz))continue;
  let block=0;for(let k=1;k<8;k++){const qx=px+(x-px)*k/8,qz=pz+(z-pz)*k/8;if(W.solidAt(qx,qz)&&Math.hypot(qx-x,qz-z)>9)block++;}const dy=W.groundAt(px,pz)-W.groundAt(x,z),sc=block*30+Math.abs(dy-2)*2+Math.abs(Math.cos(an)-1)*3;if(!best||sc<best[0])best=[sc,px,pz];}
 if(!best)return null;v.jump(best[1],best[2]);v.heading=Math.atan2(x-best[1],z-best[2]);v.yaw=Math.PI+v.heading;v.aimYaw=v.heading;v.pitch=pitch;v.distance=dist;v.camSnap=true;
 const E=v.encounter;if(E){for(const e of E.enemies||[]){e.hp=0;if(E.cleared)E.cleared[e.key]=true;}E.playerHp=E.playerMax;}return {from:[best[1],best[2]],look:[x,z]};}'''
PORTAL='''st=>{const v=Conquest.view,S=v.style,old=v.styleGroups.find(g=>g.name==='cq-style-portal'),g=S.warScenery({portal:st})[0];if(old){v.props.remove(old);v.styleGroups.splice(v.styleGroups.indexOf(old),1);}v.props.add(g);v.styleGroups.push(g);return g.userData.portal;}'''
async def main(a):
 ROOT=pathlib.Path(a.root).resolve() if a.root else HERE
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True);w,h=[int(v) for v in a.size.split('x')];only=a.only.split(',') if a.only else None
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
  await page.wait_for_function('Conquest.view.pending===0',timeout=900000)
  if a.clean:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,#cq-ui,.cq-ui{visibility:hidden!important}')
  data=await page.evaluate('''()=>{const S=Conquest.view.style,C=ConquestCombat,W=ConquestWorld;return {ws:S.WAR_SCENERY||null,hives:C.installations.map(s=>({id:s.id,x:s.x,z:s.z+8})),cover:Object.values(W.raidObstacles.reduce((m,o)=>{(m[o.layout]=m[o.layout]||[]).push(o);return m;},{})).map(L=>({id:L[0].layout,x:L.reduce((n,o)=>n+o.x,0)/L.length,z:L.reduce((n,o)=>n+o.z,0)/L.length}))};}''')
  shots=[]
  if data['ws']:
   P=data['ws']['portal'];shots+=[('portal-'+st,P['x'],P['z'],34,.3,22,st) for st in ['dormant','open','suppressed']];shots+=[('portal-far',P['x'],P['z'],70,.34,24,'dormant')]
   shots+=[('ldf-'+q['id'],q['x'],q['z'],22,.34,19,None) for q in data['ws']['posts']]
  shots+=[('hive-'+hv['id'],hv['x'],hv['z'],44,.32,24,None) for hv in data['hives']];shots+=[('cover-'+c['id'],c['x'],c['z'],30,.4,22,None) for c in data['cover'][:3]]
  info={}
  for name,x,z,back,pitch,dist,st in shots:
   kind=name.split('-')[0]
   if only and kind not in only:continue
   if st and data['ws']:await page.evaluate(PORTAL,st)
   pos=await page.evaluate(GO,[x,z,back,pitch,dist,0])
   if not pos:print('no standing place for',name,flush=True);continue
   await page.wait_for_timeout(500)
   try:await page.wait_for_function('Conquest.view.pending===0',timeout=600000)
   except Exception:print('WARNING still streaming at',name,flush=True)
   await page.evaluate('([pitch,dist])=>{const v=Conquest.view;v.yaw=Math.PI+v.heading;v.pitch=pitch;v.distance=dist;v.camSnap=true;}',[pitch,dist]);await page.wait_for_timeout(a.settle)
   await page.screenshot(path=str(out/f'{a.tag}-{name}-{a.size}-{a.quality}.png'),timeout=180000)
   info[name]=dict(pos,**await page.evaluate('(()=>{const v=Conquest.view,i=v.renderer.info;return {calls:i.render.calls,tris:i.render.triangles,programs:i.programs?.length};})()'));print(name,info[name],flush=True)
  (out/f'{a.tag}-scenery-{a.size}-{a.quality}.json').write_text(json.dumps({'errors':errors,'shots':info},indent=1))
  assert not errors,errors
  await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='high');ap.add_argument('--size',default='390x844');ap.add_argument('--mouse',action='store_true');ap.add_argument('--out',default=str(HERE/'docs/conquest/session5e2d2/scenery'));ap.add_argument('--tag',default='after');ap.add_argument('--only',default='');ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=900);ap.add_argument('--clean',action='store_true');ap.add_argument('--root',default='')
asyncio.run(main(ap.parse_args()))
