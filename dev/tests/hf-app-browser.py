# Actual website, shared battle renderer and real range engine, isolated signed Worker fixtures only.
# Start existing webserver.mjs with LUNAR_STANDARD_VISUAL_FIXTURE=1 LUNAR_LEGEND_VISUAL_FIXTURE=1 LUNAR_FIXTURE_PORT=8797.
import asyncio,json,pathlib,sys,base64
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/hf-foundation-evidence');BASE='https://lunar.test';FIX='http://127.0.0.1:8797'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);allreports=[];errors=[];warnings=[]
  # Preserve a completed baseline when continuing an interrupted browser validation.
  resume='--resume' in sys.argv and (OUT/'baseline-app.json').exists()
  if resume:allreports.append(json.loads((OUT/'baseline-app.json').read_text()))
  for phase in (['upgraded'] if resume else ['baseline','upgraded']):
   ctx=await b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');mutations=[];calls=[]
   await ctx.add_init_script('window.LUNAR_HF_SAMPLE='+str(phase=='upgraded').lower()+';')
   async def route(r):
    u=r.request.url;assert u.startswith(BASE+'/'),'No external/production fallback';calls.append(u);res=await r.fetch(url=FIX+u[len(BASE):]);await r.fulfill(response=res)
   await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:warnings.append(m.text) if m.type in ['error','warning'] else None)
   await pg.goto(BASE+'/web/equipment-preview.html');await pg.evaluate('''async()=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id:91002941})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('Fixture identity failed');}''')
   await pg.goto(BASE+'/web/play.html#garage');await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&!!webShowroom?.model',timeout=25000);await pg.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");webShowroom.auto=false;passState();setGfx("high");}')
   await pg.evaluate('()=>{const tick=frame;frame=function captureFrame(now){if(window.__capturePause){requestAnimationFrame(frame);return;}tick(now);};}')
   if phase=='upgraded':await pg.wait_for_function('()=>Equipment3D.status("high")==="ready"')
   expected_hf=await pg.evaluate('Equipment3D.VERSION')
   original=await pg.evaluate('JSON.stringify(ecoCopy())');bays=await pg.evaluate('JSON.stringify(save.lab)')
   await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-weapon','moon:2');await pg.select_option('#lab-chassis','vanguard:0');await pg.wait_for_timeout(80)
   if phase=='upgraded':assert await pg.evaluate('webShowroom.model.children[0].children.some(g=>g.children.some(m=>m.material?.isMeshStandardMaterial))'),'Engineer must use real PBR materials'
   for width in [320,390,430]:
    await pg.set_viewport_size({'width':width,'height':844});assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth');await pg.screenshot(path=str(OUT/f'{phase}-engineer-{width}.png'))
   await pg.set_viewport_size({'width':390,'height':844});await pg.locator('[data-act="rangedraft"]').click()
   def record(req):
    if req.method=='POST' and any(s in req.url for s in ['/api/match','/api/act','/api/pvp','/api/ghost','/api/pay']):mutations.append(req.url)
   pg.on('request',record);reports=[]
   for mode in ['arena','zone','crystal','bounty','royale','boss']:
    await pg.select_option('#range-mode',mode);await pg.select_option('#range-control','ai');await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('()=>!!rangeRun?.sim');await pg.wait_for_timeout(100)
    report=await pg.evaluate('''()=>{const r=rangeRun;r.sim.setup(r.cfg);for(let i=0;i<600&&r.sim.view().state==='play';i++){r.sim.step(1/60,[0,0]);if(i<580)r.sim.events();else rangeWithView(()=>{ensureMap();matchObjs();for(const a of r.sim.events())onSimEv(a);fxTick(1/60);drawBattle();});}let user,ct;rangeWithView(()=>{user=B3.units.get(me);ct=unitSpec(me).ct;});const times=[];for(let i=0;i<60;i++){const t=performance.now();rangeWithView(()=>drawBattle());RR.getContext().finish();times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {mode:r.cfg.g,ct,hf:user?.meta.hf,weaponHF:user?.wmeta.hf,result:r.sim.result(),calls:RR.info.render.calls,triangles:RR.info.render.triangles,memory:{...RR.info.memory},meanFrameMs:times.reduce((a,b)=>a+b)/times.length,p95FrameMs:times[57],worstFrameMs:times.at(-1),glError:RR.getContext().getError(),quality:R3.q};}''')
    assert report['glError']==0 and report['quality']=='high',report
    if phase=='upgraded':assert report.get('hf')==expected_hf and report.get('weaponHF')==expected_hf and report['ct']==0,report
    print(phase,mode,report['calls'],report['triangles'],flush=True)
    reports.append(report);(OUT/(phase+'-battle-checkpoint.json')).write_text(json.dumps(reports,indent=2))
    # Extract the actual live 3D + HUD canvases synchronously. Chromium's full-page
    # compositor capture can stall on the busy closing-storm frame under SwiftShader.
    # This preserves engine pixels; HTML controls are evidenced separately in UI captures.
    png=await pg.evaluate('''()=>{window.__capturePause=true;return rangeWithView(()=>{drawBattle();const out=document.createElement('canvas');out.width=cv.width;out.height=cv.height;const c=out.getContext('2d');if(use3D())c.drawImage(CV3,0,0,out.width,out.height);c.drawImage(cv,0,0);return out.toDataURL('image/png').split(',')[1];});}''')
    (OUT/f'{phase}-battle-{mode}-390.png').write_bytes(base64.b64decode(png));await pg.evaluate('window.__capturePause=false');await pg.evaluate('()=>rangeExit()')
    if mode!='boss':await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-weapon','moon:2');await pg.select_option('#lab-chassis','vanguard:0');await pg.locator('[data-act="rangedraft"]').click()
   assert not mutations,mutations;assert json.loads(await pg.evaluate('JSON.stringify(ecoCopy())'))==json.loads(original);assert await pg.evaluate('JSON.stringify(save.lab)')==bays
   if phase=='upgraded':
    cache=await pg.evaluate('''()=>{const A=artR(),canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const c=canvas.getContext('2d'),rounds=[];for(let round=0;round<2;round++){for(let i=0;i<80;i++){const T=buildTank(mySpec({cls:'vanguard',ct:0,arch:i%2?'moon':'pulse',wt:0,paint:Object.keys(PAINTS)[i%Object.keys(PAINTS).length],team:i%3?'#4d9fff':'#ff536d',lunar:!!(i%2)}),A.mats);artShot(c,160,120,T.g,{r:2,cy:.6},[]);Equipment3D.releaseTree(T.g);}rounds.push({assets:Equipment3D.stats(),gpu:{...A.r.info.memory},KC:KC.size});}return rounds;}''')
    assert cache[1]['gpu']['geometries']<=cache[0]['gpu']['geometries']+10,cache
    await pg.evaluate('()=>{setGfx("low");setTab("garage");}');await pg.wait_for_function('()=>Equipment3D.status("low")==="ready"');await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-chassis','vanguard:0');await pg.select_option('#lab-weapon','moon:2');await pg.wait_for_timeout(100);await pg.screenshot(path=str(OUT/'app-low-390.png'))
    await pg.evaluate('()=>{closeAll();setGfx("2d");setTab("garage");}');await pg.screenshot(path=str(OUT/'app-2d-390.png'))
   else:cache=None;assert not any('/assets/hf-' in u for u in calls),'default must not fetch optional textures'
   allreports.append({'phase':phase,'battle':reports,'cache':cache,'ranked_mutations':mutations});(OUT/(phase+'-app.json')).write_text(json.dumps(allreports[-1],indent=2));await ctx.close()
  assert not errors,errors
  assert [r['result'] for r in allreports[0]['battle']]==[r['result'] for r in allreports[1]['battle']],'render pipeline cannot affect seeded combat'
  (OUT/'app.json').write_text(json.dumps({'runs':allreports,'errors':errors,'warnings':warnings,'environment':'Chromium SwiftShader emulation / local fake Worker; real sim/render code, no production accounts'},indent=2));print('PASS shared app PBR Engineer, all six real practice modes, baseline seeded parity, UI, cache/disposal, HIGH/LOW/2D, no account mutations');await b.close()
asyncio.run(main())
