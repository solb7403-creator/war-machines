"""Session 5E-2d2 (owner, Nov 14 + Nov 21): the Parasite dropships in the town's Defense Drill, in the real game.
Shipped client (index.html), the real Worker on the fixture server, a fully built CC10 town, HIGH and LOW:
 1. a drill is planned into ships (one per lane in use and wave, waves two and later); the stage draws them with the style's
    own materials (no new shader program)
 2. the sequence, frozen at chosen moments of the 24 s wave (X.drillRate = 0, the replay clock set forward): the approach,
    the flare, landed with the ramp down and the wave's units riding it (more raiders drawn than the simulation has alive),
    the wave's moment (every unit on its recorded spot: only the simulation's own units are drawn), the lift-away
 3. the whole raid view stays inside its budget with every ship of a wave on screen: 16 programs and 150 draw calls
 4. a ship shot down (X.dropshipHit: nothing shoots one in the drill today): the hit flash, the fall, the wreck; its units
    are never shown riding it, and the simulation's result is untouched
Captures (docs/conquest/session5e2d2/dropships/): each moment at the chosen sizes.
usage: python3 dev/tests/conquest-dropship-browser.py [--sizes 390x844,1366x768] [--quality high,low] [--out DIR]
Software GL here: looks and counts only, never a phone frame rate."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
# what the stage shows right now, and a camera on a ship
STATE='''()=>{const X=ConquestPlotView.state,D=X.drill,R=X.R,S=R&&R.ships&&R.ships.stage;if(!D||!S)return null;const n={};for(const [k,im] of Object.entries(S.meshes))n[k]=im.visible?im.count:0;
 const alive={r:0,s:0,d:0,w:0,b:0};for(const q of D.now||[])alive[q[1]]++;const drawn={};for(const [k,im] of Object.entries(R.foes))drawn[k]=im.visible?im.count:0;
 return {t:D.t,ships:D.ships?D.ships.ships.map(s=>({key:s.key,kind:s.kind,at:s.at,lane:s.lane,units:s.units.length,pad:s.flight.pad,hit:s.flight.hitAt})):[],now:(D.shipNow||[]).map(i=>({key:i.key,x:i.pose.x,z:i.pose.z,phase:i.pose.phase,ramp:i.pose.ramp,bay:i.pose.bay,y:i.pose.y,wreck:i.pose.wreck,flash:i.pose.flash})),n,alive,drawn,info:X.info,mats:Object.values(S.meshes).every(m=>m.material===R.S.MAT.par||m.material===R.S.MAT.parHit)};}'''
SHARP='''for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){const v=g.call(this,p);return typeof v==='string'&&/swiftshader|llvmpipe|softpipe|software/i.test(v)?'Capture GPU':v;};}'''   # --sharp: the game holds a CPU rasterizer at .75x of the screen (js/graphics.js); a capture for LOOKS is drawn at the resolution a real device gets (HIGH on a phone: the device's own ratio, here the context's; LOW: 1x), by not telling the game the renderer is SwiftShader. Never used by a test that measures a budget.
async def main(a):
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   browser=await pw.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
   for q in a.quality.split(','):
    for size in a.sizes.split(','):
     w,h=[int(v) for v in size.split('x')];touch=w<700
     ctx=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=a.dpr if touch else 1,has_touch=touch,is_mobile=touch,reduced_motion='reduce');page=await ctx.new_page()
     errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     await page.add_init_script(SHARP) if a.sharp else None;await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY='''+json.dumps(q)+''';window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
     async def route(r):
      u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
      if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
       body=json.loads(r.request.post_data or '{}')
       for attempt in range(2):
        try:resp=await page.request.post(base+u.path,data=body);return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
        except Exception:
         if attempt:return await r.fulfill(status=503,body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
         await asyncio.sleep(0.2)
      if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
      if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
      if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
      await r.abort()
     await page.route('**/*',route)
     async def enter(fixture):
      await page.request.post(base+'/fixture',data=fixture)
      await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
      await page.request.post(base+'/fixture',data=fixture)
      await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
      if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
      await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=180000)
      await page.locator('#cq-base-access').click();await page.wait_for_selector('.cq-plot-tabs');await page.wait_for_timeout(2500)
      if a.clean:await page.add_style_tag(content='.cq-sheet,.cq-plot-sheet,.cq-plot-panel{opacity:0!important;pointer-events:none!important}')
     await enter({'position':[1080,1160],'plotFull':'crater','baseFunds':True})
     tag=f'{size}-{q}';res={}
     async def drill(hit=None):
      await page.evaluate('h=>{const X=ConquestPlotView.state;X.dropshipHit=h;X.drillRate=1.6;}',hit)
      await page.locator('.cq-plot-tabs button',has_text='DEFEND').click();go=page.locator('button',has_text='START DEFENSE DRILL')
      if a.clean:await go.evaluate('b=>b.click()')   # --clean hides the sheet the button sits in (pictures without the interface): a real press cannot reach it
      else:await go.click()
      await page.wait_for_function('ConquestPlotView.state?.drill&&ConquestPlotView.state.drill.ships!==undefined',timeout=120000)
      await page.evaluate('ConquestPlotView.state.drillRate=0');return await page.evaluate(STATE)
     async def at(t,ship,name,dist=None,shot=True):
      # the replay clock forward to t (never back), the camera on the ship, a few frames, then the picture and the counts
      await page.evaluate('([t,pad,dist])=>{const X=ConquestPlotView.state;X.drill.t=Math.max(X.drill.t,t);if(pad){X.cam.x=pad.x*.82;X.cam.z=pad.z*.82;X.cam.yaw=Math.atan2(pad.x,pad.z)+.5;}if(dist)X.cam.dist=dist;X.cam.tilt=.5;}',[t,ship and ship['pad'],dist])
      await page.evaluate('()=>new Promise(r=>{let n=0;const f=()=>{++n<6?requestAnimationFrame(f):r();};requestAnimationFrame(f);})');await page.wait_for_timeout(a.settle)
      s=await page.evaluate(STATE)
      # the camera follows the ship itself (its approach and its wreck are far from its pad)
      me=next((i for i in s['now'] if ship and i['key']==ship['key']),None)
      if me and shot:
       await page.evaluate('([x,z])=>{const X=ConquestPlotView.state;X.cam.x=x*.9;X.cam.z=z*.9;X.cam.yaw=Math.atan2(x,z)+.5;}',[me['x'],me['z']])
       await page.evaluate('()=>new Promise(r=>{let n=0;const f=()=>{++n<4?requestAnimationFrame(f):r();};requestAnimationFrame(f);})');await page.wait_for_timeout(a.settle)
      if shot:await page.screenshot(path=str(out/f'{name}-{tag}.png'),timeout=180000)
      return s
     s0=await drill();assert s0 and s0['ships'],'the drill was planned into ships: '+json.dumps(s0)
     ships=s0['ships'];w2=[s for s in ships if s['at']==24];assert w2,'wave two (24 s) has ships: '+json.dumps(ships)
     haul=next((s for s in w2 if s['kind']=='hauler'),None);assert haul,'a hauler lands in wave two'
     assert s0['mats'],'the ships are drawn with the style\'s own solid material'
     seq={}
     for name,t in [('approach',24-9.5),('flare',24-5.2),('landed',24-3.0),('unload',24-.9),('moment',24.05),('lift',24+5.0)]:
      seq[name]=await at(t,haul,'hauler-'+name,dist=95 if touch else 80)
     ph=lambda s:{i['key']:i for i in s['now']}
     assert ph(seq['approach'])[haul['key']]['phase']=='approach' and ph(seq['flare'])[haul['key']]['phase']=='flare',seq['approach']['now']
     L=ph(seq['landed'])[haul['key']];assert L['phase'] in ('landed','unload') and L['ramp']>.3,L
     U=ph(seq['unload'])[haul['key']];assert U['ramp']>.99,'the ramp is down for the unload: '+json.dumps(U)
     extra=sum(seq['unload']['drawn'].values())-sum(seq['unload']['alive'].values());assert extra>=haul['units'],f'the wave is shown riding its ships before its moment ({extra} riders drawn, {haul["units"]} in this hauler)'
     assert sum(seq['moment']['drawn'].values())==sum(seq['moment']['alive'].values()),'at the wave\'s moment only the simulation\'s own units are drawn: '+json.dumps([seq['moment']['drawn'],seq['moment']['alive']])
     assert ph(seq['lift'])[haul['key']]['phase']=='leave',seq['lift']['now']
     worst=max(seq.values(),key=lambda s:s['info']['calls']);res['budget']={'calls':worst['info']['calls'],'programs':worst['info']['programs'],'ships':worst['n']}
     assert worst['info']['programs']<=16 and worst['info']['calls']<=150,'the raid view budget with the ships on screen (16 programs, 150 draw calls): '+json.dumps(worst['info'])
     res['sequence']={k:{'t':v['t'],'ship':ph(v).get(haul['key']),'n':v['n'],'info':v['info']} for k,v in seq.items()}
     # ---- a ship shot down: finish this replay, then a second drill with the hauler of wave two hit in its approach ----
     await page.evaluate('()=>{const X=ConquestPlotView.state;X.drillRate=400;}');await page.wait_for_function('ConquestPlotView.state?.drillResult',timeout=180000)
     r1=await page.evaluate('(()=>{const r=ConquestPlotView.state.drillResult;let h=0;for(const c of JSON.stringify([r.frames,r.events]))h=(Math.imul(h,31)+c.charCodeAt(0))|0;return JSON.stringify([r.outcome,r.time,r.frames.length,h]);})()')
     # the same recording again (the crews' reset time keeps a second drill away): ConquestPlotView.playResult, the 7T replay entry
     await page.evaluate('h=>{const X=ConquestPlotView.state,r=X.drillResult;X.dropshipHit=h;X.drillRate=1.6;ConquestPlotView.playResult(r,r.log);}',{haul['key']:24-8.0})
     await page.wait_for_function('ConquestPlotView.state?.drill&&ConquestPlotView.state.drill.ships!==undefined',timeout=120000);await page.evaluate('ConquestPlotView.state.drillRate=0');s1=await page.evaluate(STATE)
     hk=next(s for s in s1['ships'] if s['key']==haul['key']);assert hk['hit'] is not None,'the plan marks the ship shot down'
     down={}
     for name,t in [('hit',hk['hit']+.06),('falling',hk['hit']+.9),('wreck',24-1.0)]:down[name]=await at(t,hk,'shotdown-'+name,dist=110 if touch else 90)
     H=ph(down['hit'])[hk['key']];assert H['flash']==1 and down['hit']['n']['hitH']>=1,'the hit flash: '+json.dumps([H,down['hit']['n']])
     Wk=ph(down['wreck'])[hk['key']];assert Wk['wreck']==1 and down['wreck']['n']['wreckH']>=1,'the wreck lies where it fell: '+json.dumps([Wk,down['wreck']['n']])
     others=sum(s['units'] for s in s1['ships'] if s['at']==24 and s['key']!=hk['key']);riders=sum(down['wreck']['drawn'].values())-sum(down['wreck']['alive'].values())
     assert riders<=others,f'a shot-down ship never shows its units ({riders} riders drawn, {others} in the other ships of the wave)'
     await page.evaluate('()=>{const X=ConquestPlotView.state;X.drillRate=400;}');await page.wait_for_function('ConquestPlotView.state?.drillResult',timeout=180000)
     r2=await page.evaluate('(()=>{const r=ConquestPlotView.state.drillResult;let h=0;for(const c of JSON.stringify([r.frames,r.events]))h=(Math.imul(h,31)+c.charCodeAt(0))|0;return JSON.stringify([r.outcome,r.time,r.frames.length,h]);})()')
     assert r1==r2,'the simulation\'s result is the same with a ship shot down (the drill does not remove its wave today): '+r1+' / '+r2
     res['shotDown']={k:ph(v).get(hk['key']) for k,v in down.items()}
     # ---- the light shuttle (owner, Nov 21: "a light scavenger shuttle for small waves (raiders, swarm) that drops the swarm from a
     # hover"): a small town. At Command Center 1-3 a lane of wave two is raiders and swarm only, so a shuttle always flies; from
     # CC 4 every lane carries a sentinel or drones and gets a hauler (60 seeds each, measured Nov 25) ----
     await enter({'position':[1080,1160],'plotPlain':{'site':'crater','cc':2},'baseFunds':True})
     s2=await drill();assert s2 and s2['ships'],'the small town\'s drill was planned into ships: '+json.dumps(s2)
     shut=next((s for s in s2['ships'] if s['kind']=='shuttle' and s['at']==24),None);assert shut,'a shuttle flies in wave two of a CC 2 town: '+json.dumps(s2['ships'])
     sh={}
     for name,t in [('approach',24-9.5),('flare',24-4.2),('hover',24-2.85),('bay',24-1.6),('drop',24-.55),('moment',24.05),('lift',24+3.2)]:
      sh[name]=await at(t,shut,'shuttle-'+name,dist=70 if touch else 60)
     P2=lambda n:ph(sh[n])[shut['key']]
     assert P2('approach')['phase']=='approach' and P2('flare')['phase']=='flare',[P2('approach'),P2('flare')]
     gy=P2('moment')['y'];assert P2('hover')['phase']=='hover' and P2('hover')['ramp']==0 and P2('hover')['bay']<.05,'the shuttle hovers with its bay shut: '+json.dumps(P2('hover'))
     assert P2('bay')['bay']>.99 and P2('bay')['phase']=='hover','the bay is open before the drop: '+json.dumps(P2('bay'))
     assert P2('drop')['phase']=='unload' and P2('drop')['bay']>.99,'the drop: '+json.dumps(P2('drop'))
     extra=sum(sh['drop']['drawn'].values())-sum(sh['drop']['alive'].values());assert extra>=shut['units'],f'the shuttle\'s units are shown dropping before their moment ({extra} drawn in the air, {shut["units"]} in this shuttle)'
     assert sum(sh['moment']['drawn'].values())==sum(sh['moment']['alive'].values()),'at the wave\'s moment only the simulation\'s own units are drawn: '+json.dumps([sh['moment']['drawn'],sh['moment']['alive']])
     assert P2('lift')['phase']=='leave' and sh['drop']['n']['shuttle']>=1,[P2('lift'),sh['drop']['n']]
     worst=max(sh.values(),key=lambda s:s['info']['calls']);assert worst['info']['programs']<=16 and worst['info']['calls']<=150,'the raid view budget with the shuttles on screen: '+json.dumps(worst['info'])
     res['shuttle']={k:ph(v).get(shut['key']) for k,v in sh.items()};res['shuttleBudget']={'calls':worst['info']['calls'],'programs':worst['info']['programs'],'ships':worst['n']}
     # the shuttle shot down in its approach
     await page.evaluate('()=>{const X=ConquestPlotView.state;X.drillRate=400;}');await page.wait_for_function('ConquestPlotView.state?.drillResult',timeout=180000)
     await page.evaluate('h=>{const X=ConquestPlotView.state,r=X.drillResult;X.dropshipHit=h;X.drillRate=1.6;ConquestPlotView.playResult(r,r.log);}',{shut['key']:24-8.0})
     await page.wait_for_function('ConquestPlotView.state?.drill&&ConquestPlotView.state.drill.ships!==undefined',timeout=120000);await page.evaluate('ConquestPlotView.state.drillRate=0');s3=await page.evaluate(STATE)
     sk=next(s for s in s3['ships'] if s['key']==shut['key']);assert sk['hit'] is not None,'the plan marks the shuttle shot down'
     sd={}
     for name,t in [('hit',sk['hit']+.06),('falling',sk['hit']+.9),('wreck',24-1.0)]:sd[name]=await at(t,sk,'shuttle-shotdown-'+name,dist=90 if touch else 75)
     assert ph(sd['hit'])[sk['key']]['flash']==1 and sd['hit']['n']['hitS']>=1,'the shuttle\'s hit flash: '+json.dumps(sd['hit']['n'])
     assert ph(sd['wreck'])[sk['key']]['wreck']==1 and sd['wreck']['n']['wreckS']>=1,'the shuttle\'s wreck: '+json.dumps(sd['wreck']['n'])
     res['shuttleDown']={k:ph(v).get(sk['key']) for k,v in sd.items()};res['errors']=errors;assert not errors,errors
     results[tag]=res;print('ok',tag,json.dumps(res['budget']),flush=True);await ctx.close()
   await browser.close()
  (out/'dropships.json').write_text(json.dumps(results,indent=1))
  print('PASS conquest-dropship-browser: '+', '.join(results)+': the drill planned into ships, the hauler flies in, flares, lands, lowers its ramp and unloads (riders drawn before the moment, none after), lifts away; the raid view inside 16 programs / 150 draw calls; a ship shot down flashes, falls and lies as a wreck, its units never shown, the result unchanged; in a small town (CC 2) the light shuttle flies in, hovers, opens its bay and drops its units (drawn in the air before the moment, none after), lifts away; shot down it flashes, falls and lies as a wreck')
 finally:
  server.terminate()
ap=argparse.ArgumentParser();ap.add_argument('--sizes',default='390x844');ap.add_argument('--quality',default='high,low');ap.add_argument('--out',default=str(ROOT/'docs/conquest/session5e2d2/dropships'));ap.add_argument('--dpr',type=float,default=2);ap.add_argument('--settle',type=int,default=700);ap.add_argument('--clean',action='store_true')
ap.add_argument('--sharp',action='store_true')
asyncio.run(main(ap.parse_args()))
