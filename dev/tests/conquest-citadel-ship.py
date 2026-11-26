"""Session 5E-2d2: the Citadel's tier III dropship is the real hauler, flown by ConquestDropship.flight(spec) with
ConquestCitadel.dropshipSpec(e) (Checkpoint 49's contract), in the real world renderer.
Shipped client (index.html, local economy: the fight's own rules run in the page, no Worker), a tier III assault built by
ConquestCitadel.make, its clock held and stepped by this script (the fight's own shipPose decides where the ship is and when
its wave lands; nothing in the fight is changed):
 1. the ship's model is the kit's par-hauler (hull + bow ramp + wreck), not the box stand-in, on HIGH and LOW
 2. flying in: the hull is drawn at the fight's ship (the lock and the hit box stay true) with the flight's attitude
 3. it sets down with its ramp's foot on the pad, the ramp is fully down before the wave's moment
 4. at the wave's moment the fight spawns the wave; for their first second the units are drawn rolling off the ramp, then
    each is drawn exactly where the fight has it
 5. when the fight sends the ship away the ramp shuts and it lifts away (it stays on show although the fight moved it off)
 6. shot down before it lands (the fight's rule: its wave never lands): the fall and the wreck
Captures: docs/conquest/session5e2d2/citadel/.  usage: python3 dev/tests/conquest-citadel-ship.py [--sizes 390x844,1366x768]
[--quality high,low] [--out DIR].  Software GL: looks only."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
SETUP='''()=>{const v=Conquest.view,C=ConquestCitadel,W=ConquestWorld;v.clearBattle?.();
 const B=C.make(myLoadout(),v.p,'citadel-3');B.tick=function(){};B.cit.stage=1;   // the courtyard is open: ships may launch; the fight's clock is ours
 for(const e of B.enemies)e.dormant=true;v.battle=B;window.__B=B;
 B.time=40;B.launchShip();const e=B.enemies.find(x=>x.ship),S=e.ship,sp=C.dropshipSpec(e),ox=sp.out[0],oz=sp.out[1],px=-oz,pz=ox;
 // the pilot stands beside the pad, looking across the landing
 const tx=S.pad[0]+ox*10,tz=S.pad[1]+oz*10;let side=1;if(W.solidAt(tx+px*46,tz+pz*46))side=-1;const x=tx+px*46*side,z=tz+pz*46*side;v.jump(x,z);B.player.x=x;B.player.z=z;
 v.heading=Math.atan2(tx-x,tz-z);v.yaw=Math.PI+v.heading;v.pitch=.3;v.distance=24;v.camSnap=true;v.aimYaw=v.heading;
 window.__ship=e;return {id:e.id,at:sp.at,t0:S.t0,pad:S.pad,out:sp.out,fly:C.CIT.ship.flyS,unload:C.CIT.ship.unloadS};}'''
STEP='''([t,kill])=>{const v=Conquest.view,B=window.__B,e=window.__ship;B.time=t;if(kill&&e.hp>0){e.hp=0;B.citStep?.(.05);}
 if(e.hp>0||e.landed){const P=B.shipPose(e);Object.assign(e,{x:P.x,y:P.y,z:P.z});}
 {const q=ConquestCitadelView.shipLook(v,e,B);if(q&&q.vis!==false&&Math.hypot(q.x-v.p.x,q.z-v.p.z)<230){v.heading=Math.atan2(q.x-v.p.x,q.z-v.p.z);v.yaw=Math.PI+v.heading;v.aimYaw=v.heading;v.camSnap=true;}}   // the camera looks at the hull
 return new Promise(r=>{let n=0;const f=()=>{if(++n<5)return requestAnimationFrame(f);const g=v.enemyMeshes.get(e.id),U=g?.userData.ship,q=ConquestCitadelView.shipLook(v,e,B);
  const wave=B.enemies.filter(x=>x.wave==='ship').map(x=>{const m=v.enemyMeshes.get(x.id);return {id:x.id,kind:x.kind,x:x.x,z:x.z,step:!!m?.userData.pose?.step,dx:m?m.position.x+v.origin.x-x.x:null,dz:m?m.position.z+v.origin.z-x.z:null,unit:m?.userData.unit};});
  r({t,hauler:!!U,slot:g?.userData.slot,look:q&&{phase:q.phase,ramp:q.ramp,wreck:q.wreck,x:q.x,y:q.y,z:q.z,pitch:q.pitch,roll:q.roll,vis:q.vis},sim:{x:e.x,y:e.y,z:e.z,landed:!!e.landed,left:!!e.left,hp:e.hp},mesh:g&&{x:g.position.x+v.origin.x,y:g.position.y,z:g.position.z+v.origin.z,vis:g.visible},
   parts:U&&{hull:U.hull.visible,ramp:U.ramp.visible,wreck:U.wreck.visible,rampAngle:U.ramp.rotation.x,mats:[U.hull,U.ramp,U.wreck].every(m=>m.material===v.style.MAT.par||m.material===v.style.MAT.parHit)},wave,down:B.cit.down,landed:B.cit.landed,calls:v.renderer.info.render.calls,programs:v.renderer.info.programs?.length});};requestAnimationFrame(f);});}'''
SHARP='''for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){const v=g.call(this,p);return typeof v==='string'&&/swiftshader|llvmpipe|softpipe|software/i.test(v)?'Capture GPU':v;};}'''   # --sharp: the game holds a CPU rasterizer at .75x of the screen (js/graphics.js); a capture for LOOKS is drawn at the resolution a real device gets (HIGH on a phone: the device's own ratio, here the context's; LOW: 1x), by not telling the game the renderer is SwiftShader. Never used by a test that measures a budget.
async def main(a):
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True);results={}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  for q in a.quality.split(','):
   for size in a.sizes.split(','):
    w,h=[int(v) for v in size.split('x')];touch=w<700;tag=f'{size}-{q}'
    ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=a.dpr if touch else 1,has_touch=touch,is_mobile=touch,reduced_motion='reduce')
    page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script(SHARP) if a.sharp else None;await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='+json.dumps(q)+';try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     await r.abort()
    await page.route('**/*',route)
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"')
    await page.evaluate('closeAll();save.welcomed=true;save.gfx='+json.dumps(q)+';uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('typeof Conquest!=="undefined"&&!!Conquest.view',timeout=120000)
    if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
    await page.wait_for_function('Conquest.view.pending===0',timeout=900000)
    assert await page.evaluate('typeof ConquestDropship!=="undefined"&&typeof ConquestCitadel!=="undefined"&&!!ConquestWarModels'),'dropship.js, the Citadel and the war models are loaded by the page'
    async def run(name,kill_at=None):
     S=await page.evaluate(SETUP);await page.wait_for_timeout(600)
     try:await page.wait_for_function('Conquest.view.pending===0',timeout=600000)
     except Exception:print('WARNING still streaming',flush=True)
     at=S['at'];seq={}
     moments=[('approach',at-9),('flare',at-5),('touchdown',at-2.5),('ramp',at-.6),('wave',at+.35),('unloaded',at+2.5),('lift',at+S['unload']+2.2),('away',at+S['unload']+6)] if kill_at is None else [('approach',at-9),('hit',at+kill_at),('falling',at+kill_at+.7),('wreck',at+kill_at+5)]
     for n,t in moments:
      s=await page.evaluate(STEP,[t,kill_at is not None and t>=at+kill_at]);await page.wait_for_timeout(a.settle)
      if a.clean and not seq:await page.add_style_tag(content='.cq-hud,.cq-top,.cq-toast,.cq-guide,.cq-ticker,.cq-dialog{visibility:hidden!important}')
      await page.screenshot(path=str(out/f'{name}-{n}-{tag}.png'),timeout=180000);seq[n]=s
     return S,seq
    S,seq=await run('ship')
    A=seq['approach'];assert A['hauler'] and A['slot']=='par-hauler' and A['parts']['mats'],'the Citadel ship is the kit\'s hauler on the style\'s solid material: '+json.dumps(A)
    assert A['look']['phase']=='approach' and abs(A['mesh']['x']-A['sim']['x'])<.6 and abs(A['mesh']['z']-A['sim']['z'])<.6,'flying in, the hull is drawn at the fight\'s ship: '+json.dumps([A['mesh'],A['sim']])
    assert abs(seq['flare']['look']['pitch'])>.02,'the flight\'s flare tilts the hull: '+json.dumps(seq['flare']['look'])
    R=seq['ramp'];assert R['look']['ramp']>.99 and not R['sim']['landed'] and not R['wave'],'the ramp is down before the wave\'s moment: '+json.dumps(R['look'])
    Wv=seq['wave'];assert Wv['sim']['landed'] and len(Wv['wave'])>=2 and all(u['step'] for u in Wv['wave']),'the wave is shown stepping off the ramp for its first second: '+json.dumps(Wv['wave'])
    U=seq['unloaded'];assert U['wave'] and all((not u['step']) and abs(u['dx'])<.01 and abs(u['dz'])<.01 for u in U['wave']),'then every unit is drawn exactly where the fight has it: '+json.dumps(U['wave'])
    L=seq['lift'];assert L['sim']['left'] and L['look']['phase']=='leave' and L['mesh']['vis'] and L['look']['y']>U['look']['y']+1,'sent away by the fight, the ship lifts away on show: '+json.dumps([L['look'],L['mesh']])
    results[tag]={'landing':{k:{'t':v['t'],'look':v['look'],'parts':v['parts'],'wave':len(v['wave']),'calls':v['calls'],'programs':v['programs']} for k,v in seq.items()}}
    S2,down=await run('shotdown',kill_at=-6.5)
    F=down['falling'];assert F['down']>=1 and F['look']['phase'] in ('falling','wreck') and F['look']['y']<down['hit']['look']['y']+.01,'shot down, it falls: '+json.dumps([down['hit']['look'],F['look']])
    K=down['wreck'];assert K['look']['wreck']==1 and K['parts']['wreck'] and not K['parts']['hull'] and not K['wave'] and K['landed']==0,'the wreck lies where it fell and its wave never lands: '+json.dumps(K)
    results[tag]['shotDown']={k:{'t':v['t'],'look':v['look'],'parts':v['parts']} for k,v in down.items()};results[tag]['errors']=errors;assert not errors,errors
    print('ok',tag,flush=True);await ctx.close()
  await browser.close()
 (out/'citadel-ship.json').write_text(json.dumps(results,indent=1))
 print('PASS conquest-citadel-ship: '+', '.join(results)+': the tier III ship is the real hauler flown by ConquestDropship.flight(dropshipSpec): it flies in at the fight\'s ship, flares, sets its ramp\'s foot on the pad, lowers the ramp before the wave\'s moment, the wave steps off and stands where the fight has it, it lifts away; shot down it falls and lies as a wreck, its wave never lands')
ap=argparse.ArgumentParser();ap.add_argument('--sizes',default='390x844');ap.add_argument('--quality',default='high,low');ap.add_argument('--out',default=str(ROOT/'docs/conquest/session5e2d2/citadel'));ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=700);ap.add_argument('--clean',action='store_true')
ap.add_argument('--sharp',action='store_true')
asyncio.run(main(ap.parse_args()))
