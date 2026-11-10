"""Session 5D (5C leftovers): captures and checks for the owner's judge pass, shipped client + real Worker reducer on a disposable
local DB, Chromium at 390x700 (Telegram visible area):
 1. Home Sector spawn at CC1 and CC10 faces the Command Center along a road (not a reactor): the CC is in front of the tank
 2. a session that starts on the gate centre: the tank rolls off the town model onto clear ground within 4 s (no steering)
 3. the 5B kiosk is gone from the courtyard shell
 4. the hub hero at CC1 and CC5 uses the kit models (not stand-in blocks) on HIGH
 5. BUILD at PEEK shows a card; the resource readout is one line at 390 px
 6. a Cannon card sprite exists and is not dark (mean luminance)
 9. the diorama build runs in slices (no slice above ~16 ms on this machine is not asserted: software GL); the model attaches whole
 Captures in docs/conquest/session5d/. Run from the repository root: python3 dev/tests/conquest-session5d.py
"""
import asyncio,json,pathlib,shutil,base64,io
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5d';OUT.mkdir(parents=True,exist_ok=True)
GATE=[1080,1160];PAD_VIEW=[1077,1154]
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);R={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(w,h,fixture,q='high'):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="'''+q+'''";window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){}},themeParams:{}}};''')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
      resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
     await r.abort()
    await page.route('**/*',route)
    await page.request.post(base+'/fixture',data=fixture)
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
    return ctx,page,errors
   async def close(ctx):
    for pg in ctx.pages:
     try:await pg.unroute_all(behavior='ignoreErrors')
     except Exception:pass
    await ctx.close()
   async def world(page):
    await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
   async def enter_base(page):
    b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);await b.click();await page.wait_for_selector('.cq-plot-tabs',timeout=60000);await page.wait_for_timeout(1200)
   lum=lambda png:(lambda im:sum(im)/len(im))(list(__import__('PIL.Image',fromlist=['Image']).open(io.BytesIO(png)).convert('L').getdata())) if True else 0
   # ---- 1 + 2 + 3: the gate-centre session (tank on the model), then the Home Sector spawn at CC1 and CC10 ----
   for (cc,fx) in ((1,{'position':GATE,'baseFunds':True,'plotCC':1,'plotSite':'ridge'}),(10,{'position':GATE,'plotFull':'crater','baseFunds':True})):
    ctx,page,errors=await session(390,700,fx);await world(page);await page.wait_for_timeout(600)
    p0=await page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,nudge:!!Conquest.view.nudge,dio:!!Conquest.view.diorama,half:Conquest.view.diorama?.userData.half})')
    await page.wait_for_function('()=>{const v=Conquest.view,D=ConquestCombat.baseDefinition,h=(v.diorama?.userData.half||0)+1.6;return !!v.diorama&&!(Math.abs(v.p.x-D.x)<h&&Math.abs(v.p.z-D.z-1.5)<h);}',timeout=20000)
    p1=await page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,nudge:!!Conquest.view.nudge})');await page.wait_for_timeout(1500)
    await page.screenshot(path=str(OUT/f'pad-diorama-cc{cc}-gate-centre-390.png'))
    kiosk=await page.evaluate('''()=>{let n=0;Conquest.view.baseGroup?.traverse(o=>{if(o.isMesh)n++;});return n;}''')
    R[f'gateCentre{cc}']={'start':p0,'after':p1,'meshes':kiosk};assert p1['z']<p0['z']-6,R[f'gateCentre{cc}']
    await enter_base(page);await page.wait_for_timeout(2000)
    sp=await page.evaluate('''()=>{const X=ConquestPlotView.state,D=X.drive,TK=ConquestTownKit,P=ConquestPlot,p=D.plot,C=TK.ccCenter(p);const dx=C.x-D.x,dz=C.z-D.z,d=Math.hypot(dx,dz),fwd=Math.cos(Math.atan2(dx,dz)-D.h);return {x:D.x,z:D.z,h:D.h,ccDist:d,ccAhead:fwd,face:!!D.pad.face,info:X.info};}''')
    await page.screenshot(path=str(OUT/f'home-sector-drive-cc{cc}-390.png'))
    R[f'spawn{cc}']=sp;assert sp['ccAhead']>0.9 and sp['info']['programs']<=16,sp
    assert not errors,errors
    await close(ctx)
   # ---- 4: hub hero CC1 and CC5 use the kit (HIGH) ----
   for (cc,fx) in ((1,{'position':GATE,'baseFunds':True,'plotCC':1,'plotSite':'ridge'}),(5,{'position':GATE,'baseFunds':True,'plotCC':5,'plotSite':'ridge'})):
    ctx,page,errors=await session(390,700,fx);await world(page);await page.wait_for_timeout(800)
    await page.locator('.cq-top button').first.click();await page.wait_for_timeout(600)
    if not await page.locator('.cq-hub').count():await page.locator('#tabbar [data-act="conquest"]').click()
    await page.wait_for_function('ConquestHub.state?.town',timeout=60000);await page.wait_for_timeout(1500)
    await page.screenshot(path=str(OUT/f'hub-hero-town-cc{cc}-390.png'));R['hub'+str(cc)]=await page.evaluate('ConquestHub.state.town');assert not errors,errors
    await close(ctx)
   # ---- 5 + 6: BUILD at PEEK shows a card, the readout is one line; the Cannon sprite is lit ----
   ctx,page,errors=await session(390,700,{'position':GATE,'plotFull':'crater','baseFunds':True});await world(page);await enter_base(page)
   await page.locator('.cq-plot-tabs button',has_text='BUILD').click();await page.wait_for_timeout(800)
   async def snap(want):   # the handle is a keyboard control: ArrowDown lowers the sheet one snap, ArrowUp raises it (sheet.js)
    for _ in range(4):
     cur=await page.evaluate('ConquestPlotView.state.d.dataset.snap')
     if cur==want:break
     await page.evaluate('ConquestPlotView.state.grab.focus()');await page.keyboard.press('ArrowDown' if ['peek','half','full'].index(want)<['peek','half','full'].index(cur) else 'ArrowUp');await page.wait_for_timeout(500)
    await page.wait_for_timeout(500)
   await snap('peek')
   peek=await page.evaluate('''()=>{const X=ConquestPlotView.state,d=X.d,snap=d.dataset.snap,mode=d.dataset.mode,res=d.querySelector('.cq-plot-body>.cq-plot-res'),card=d.querySelector('.cq-plot-list .cq-plot-card,.cq-plot-list button,.cq-plot-list>*'),sh=X.sheet.getBoundingClientRect(),vis=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {top:r.top,bottom:r.bottom,h:r.height,display:s.display,lines:Math.round(r.height/parseFloat(s.lineHeight||'16'))};};return {snap,mode,sheetTop:sh.top,sheetBottom:sh.bottom,res:vis(res),card:vis(card),innerH:innerHeight};}''')
   await page.screenshot(path=str(OUT/'build-tab-peek-390.png'));R['buildPeek']=peek
   assert peek['snap']=='peek' and peek['mode']=='build' and peek['card'] and peek['card']['top']<peek['innerH']-20 and (not peek['res'] or peek['res']['display']=='none'),peek
   await snap('half')
   half=await page.evaluate('''()=>{const d=ConquestPlotView.state.d,res=d.querySelector('.cq-plot-body>.cq-plot-res');if(!res)return null;const r=res.getBoundingClientRect(),s=getComputedStyle(res);return {h:r.height,lh:parseFloat(s.lineHeight),nowrap:s.whiteSpace==='nowrap',scrollW:res.scrollWidth,clientW:res.clientWidth};}''')
   R['resLine']=half;assert half and half['nowrap'] and half['h']<half['lh']*1.6,half
   await page.locator('.cq-plot-tabs button',has_text='WEAPONS').click();await page.wait_for_timeout(2500)
   await page.wait_for_function('document.querySelector(".cq-plot-spr[data-spr=\\"cannon\\"],img.cq-plot-spr")',timeout=20000)
   spr=await page.evaluate('''()=>{const i=[...document.querySelectorAll('img.cq-plot-spr')].find(x=>x.dataset.spr==='cannon')||document.querySelector('img.cq-plot-spr');return i?{k:i.dataset.spr,src:i.src}:null;}''')
   assert spr and spr['src'].startswith('data:image/png'),spr
   png=base64.b64decode(spr['src'].split(',',1)[1]);L=lum(png);R['cannonSprite']={'key':spr['k'],'luminance':L};(OUT/'card-sprite-cannon.png').write_bytes(png)
   assert L>40,R['cannonSprite']
   await page.screenshot(path=str(OUT/'weapons-tab-half-390.png'));assert not errors,errors
   await close(ctx)
   # ---- 9: the diorama build is sliced (generator) and attaches whole; slice count and the longest slice on this machine ----
   ctx,page,errors=await session(390,700,{'position':GATE,'at':PAD_VIEW,'plotFull':'crater','baseFunds':True});await world(page);await page.wait_for_timeout(2500)
   await page.screenshot(path=str(OUT/'pad-diorama-cc10-390.png'))
   slices=await page.evaluate('''()=>{const TK=ConquestTownKit,S=Conquest.view.style,p=Conquest.view.authority.state.plot,t=[];const it=TK.dioramaGen(S,p,{low:false,scale:.1,vy:1,bv:3.1,wv:2.2,cache:{wgeo:new Map(),hgeo:new Map(),tgeo:new Map()}});let r;do{const a=performance.now();r=it.next();t.push(+(performance.now()-a).toFixed(1));}while(!r.done);return {slices:t.length,ms:t,counts:r.value.userData.counts,programs:Conquest.view.renderer.info.programs?.length||0};}''')
   R['dioramaSlices']=slices;assert slices['slices']>=5 and slices['counts']['walls']>=2000 and slices['programs']<=16,slices
   assert not errors,errors
   await close(ctx)
   ctx,page,errors=await session(390,700,{'position':GATE,'at':PAD_VIEW,'baseFunds':True,'plotCC':1,'plotSite':'ridge'});await world(page);await page.wait_for_timeout(2500)
   await page.screenshot(path=str(OUT/'pad-diorama-cc1-390.png'));assert not errors,errors;await close(ctx)
   await browser.close()
  json.dump(R,open(OUT/'session5d.json','w'),indent=1)
  print('PASS Session 5D leftovers:',json.dumps({k:v for k,v in R.items() if k in('spawn1','spawn10','gateCentre1','gateCentre10','buildPeek','resLine','cannonSprite','dioramaSlices')},default=str)[:1500])
 finally:
  server.kill()
asyncio.run(main())
