# Actual app, premium card art, owned unsaved drafts and isolated combat. Disposable Worker only.
# LUNAR_STANDARD_VISUAL_FIXTURE=1 LUNAR_LEGEND_VISUAL_FIXTURE=1 LUNAR_FIXTURE_PORT=8796 node dev/tests/webserver.mjs
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/legendary-evidence');BASE='https://lunar.test';FIX='http://127.0.0.1:8796'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);errors=[];mutations=[];results=[]
  async def route(r):
   assert r.request.url.startswith(BASE+'/'),'No external fallback';res=await r.fetch(url=FIX+r.request.url[len(BASE):]);await r.fulfill(response=res)
  async def login(ctx,uid):
   await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
   await pg.goto(BASE+'/web/equipment-preview.html');await pg.evaluate('''async id=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('Fixture auth failed');}''',uid)
   await pg.goto(BASE+'/web/play.html#garage');await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&!!webShowroom&&(!!webShowroom.model||!webShowroom.renderer)',timeout=25000);await pg.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");webShowroom.auto=false;passState();}');return pg
  ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',has_touch=True);pg=await login(ctx,91002941)
  if '--capture-only' in sys.argv:
   await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-weapon','moon:2');await pg.select_option('#lab-chassis','vanguard:0');await pg.locator('[data-act="rangedraft"]').click();await pg.select_option('#range-control','ai');await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim');await pg.wait_for_timeout(100);await pg.screenshot(path=str(OUT/'practice-mounted-390.png'))
   shot=await pg.evaluate("""()=>{const r=rangeRun;let found=false;for(let i=0;i<1000&&r.sim.view().state==='play';i++){r.sim.step(1/60,[0,0]);const es=r.sim.events();if(r.sim.view().bullets.some(q=>q.o===r.sim.view().me)){rangeWithView(()=>{ensureMap();matchObjs();for(const a of es)onSimEv(a);fxTick(1/60);drawBattle();});found=true;break;}}return found;}""");assert shot;await pg.screenshot(path=str(OUT/'practice-first-moonbeam-shot-390.png'));await pg.evaluate('()=>rangeExit()')
   await pg.evaluate('()=>{setTab("shop");paintArt(document.querySelector("#s-shop"));}');await pg.locator('#s-shop .prem').screenshot(path=str(OUT/'shop-premium-cards.png'))
   await b.close();print('CAPTURED actual mounted practice, first Moonbeam shot and premium card canvases');return
  original=await pg.evaluate('JSON.stringify(ecoCopy())');bays=await pg.evaluate('JSON.stringify(save.lab)');assert await pg.evaluate('save.skin==="lunar"&&save.moonbeam')
  await pg.screenshot(path=str(OUT/'garage-lunar-390.png'))
  for width in [320,390,430]:
   await pg.set_viewport_size({'width':width,'height':844});await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-weapon','moon:2');await pg.select_option('#lab-chassis','vanguard:0');await pg.wait_for_timeout(80);assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth');await pg.screenshot(path=str(OUT/f'engineer-lunar-moonbeam-{width}.png'));await pg.evaluate('()=>{closeAll();setTab("garage");}')
  await pg.set_viewport_size({'width':390,'height':844});await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click()
  for arch in ['pulse','twin','siege']:
   await pg.select_option('#lab-weapon',arch+':2');await pg.wait_for_timeout(80);assert await pg.evaluate('webShowroom.L.skin==="lunar"&&webShowroom.L.w.a==="'+arch+'"');await pg.screenshot(path=str(OUT/f'engineer-lunar-{arch}.png'))
  await pg.select_option('#lab-weapon','moon:2');await pg.select_option('#lab-chassis','vanguard:0');await pg.select_option('#lab-fit-hull','plates');await pg.select_option('#lab-fit-mobility','stable');await pg.wait_for_timeout(80)
  assert await pg.evaluate('JSON.stringify(ecoCopy())')==original;assert await pg.evaluate('JSON.stringify(save.lab)')==bays
  def record(req):
   if req.method=='POST' and any(s in req.url for s in ['/api/match','/api/act','/api/pvp','/api/ghost','/api/pay']):mutations.append(req.url)
  pg.on('request',record)
  await pg.locator('[data-act="rangedraft"]').click()
  for mode in ['arena','zone','crystal','bounty','royale','boss']:
   await pg.select_option('#range-mode',mode);await pg.select_option('#range-control','ai');await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim');await pg.wait_for_timeout(150)
   info=await pg.evaluate('''()=>{const r=rangeRun;for(let i=0;i<600&&r.sim.view().state==='play';i++){r.sim.step(1/60,[0,0]);if(i<580)r.sim.events();else rangeWithView(()=>{ensureMap();matchObjs();for(const a of r.sim.events())onSimEv(a);fxTick(1/60);drawBattle();});}const v=r.sim.view(),u=B3.units.get(v.me);return {mode:r.cfg.g,skin:v.me.skin,weapon:v.me.wtype,projectiles:v.bullets.length,damage:v.me.st?.dmg,meta:u?.wmeta,drawCalls:RR.info.render.calls,triangles:RR.info.render.triangles,geometries:RR.info.memory.geometries,glError:RR.getContext().getError()};}''')
   assert info['skin']=='lunar' and info['weapon']=='moon' and info['meta']['legend']=='moonbeam-unified' and info['glError']==0,info
   if mode in ['arena','boss']:await pg.screenshot(path=str(OUT/f'practice-moonbeam-{mode}-390.png'))
   results.append(info);await pg.evaluate('()=>rangeExit()')
   if mode!='boss':await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-weapon','moon:2');await pg.locator('[data-act="rangedraft"]').click()
  assert not mutations,mutations;assert await pg.evaluate('JSON.stringify(ecoCopy())')==original;assert await pg.evaluate('JSON.stringify(save.lab)')==bays
  # Existing premium cards use art3D('tank:lunar') and art3D('gear:w:moon:2:0'), without checkout.
  await pg.evaluate('()=>{setTab("shop");paintArt(document.querySelector("#s-shop"));}');await pg.wait_for_timeout(100);await pg.screenshot(path=str(OUT/'shop-legends-390.png'),full_page=True)
  assert await pg.locator('#s-shop canvas[data-art="tank:lunar"]').count()==1;assert await pg.locator('#s-shop canvas[data-art="gear:w:moon:2:0"]').count()==1
  # Real shared art renderer cache churn, including Lunar decks and single Moonbeam emitter.
  cache=await pg.evaluate('''()=>{const A=artR(),canvas=document.createElement('canvas');canvas.width=120;canvas.height=100;const ctx=canvas.getContext('2d'),samples=[];for(let round=0;round<2;round++){for(let i=0;i<150;i++){const sp=mySpec({cls:CHORDER[i%3],ct:Math.floor(i/3)%3,arch:i%4===3?'moon':WORDER[i%3],wt:Math.floor(i/9)%3,paint:Object.keys(PAINTS)[Math.floor(i/12)%Object.keys(PAINTS).length],lunar:!!(i%2),team:i%3?'#4d9fff':'#ff536d',gems:'dmg,rof,arm',fits:{hull:'plates',mobility:'stable',mount:i%2?'firing':'hardened'}});const T=buildTank(sp,A.mats);T.tur.rotation.y=.6;stepAnims(T.anims,.1,2);artShot(ctx,120,100,T.g,{r:2.1,cy:.6},[]);}samples.push({kits:KC.size,fits:FITCACHE.size,gpu:A.r.info.memory.geometries});}return {samples,error:A.r.getContext().getError()};}''')
  assert cache['samples'][1]['kits']<=64 and cache['samples'][1]['fits']<=96 and cache['error']==0,cache;assert cache['samples'][1]['gpu']<=cache['samples'][0]['gpu']+12,cache
  # Actual 2D fallback, including new black/gold skin and blue-core cannon, and owned bay safety.
  await pg.evaluate('()=>{setGfx("2d");setTab("garage");}');await pg.wait_for_timeout(80);await pg.screenshot(path=str(OUT/'garage-2d-390.png'))
  await pg.evaluate('()=>{const c=document.createElement("canvas");c.id="legend-fallback";c.width=360;c.height=240;c.style.cssText="position:fixed;inset:80px 10px;background:#101923;z-index:99999";document.body.append(c);const L=ecoLoadout(save,save.lab.machines.m_legacy.spec);L.w={a:"moon",t:2,q:1,s:false};drawMachinePreview(c.getContext("2d"),360,240,L);}');await pg.locator('#legend-fallback').screenshot(path=str(OUT/'lunar-moonbeam-2d.png'))
  after=json.loads(await pg.evaluate('JSON.stringify(ecoCopy())'));expected=json.loads(original)
  assert after==expected,{k:[expected.get(k),after.get(k)] for k in expected.keys()|after.keys() if expected.get(k)!=after.get(k)}
  assert json.loads(await pg.evaluate('JSON.stringify(save.lab)'))==json.loads(bays)
  await ctx.close()
  # Independent Moonbeam ownership with default skin, no auto-bundle or save mutation.
  solo=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');sp=await login(solo,91002942);assert await sp.evaluate('save.skin==="default"&&save.moonbeam&&myLoadout().w.a==="moon"');await sp.screenshot(path=str(OUT/'garage-moonbeam-no-skin-390.png'));await solo.close()
  noGL=await b.new_context(viewport={'width':320,'height':844},reduced_motion='reduce');await noGL.add_init_script("const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:orig.call(this,t,...a)};");np=await login(noGL,91002941);assert await np.evaluate('R3.failed&&!webShowroom.renderer');await np.screenshot(path=str(OUT/'garage-no-webgl-320.png'));await noGL.close()
  assert not errors,errors
  (OUT/'app.json').write_text(json.dumps({'battle':results,'cache':cache,'independent_ownership':True,'unsaved_drafts_no_bay_economy_changes':True,'shop':True,'2d':True,'errors':errors,'range_mutations':mutations,'identity':'local signed disposable fixtures, NOT live accounts'},indent=2));print('PASS owned legend drafts, independent/together, Shop cards, 6 real practice modes, firing/effects, narrow Engineer, 2D and bounded actor caches',results,cache);await b.close()
asyncio.run(main())
