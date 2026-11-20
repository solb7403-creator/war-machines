"""Session 5E-2d1, the town's drive view (owner, Nov 11 + Nov 17 + Nov 19). Shipped client against the real Worker reducer on a
disposable local DB (fixture: a built town), HIGH and LOW:
 1. controls: the town drives with the SAME fixed DRIVE joystick as the world (.cq-stick: same size, same corner), not a floating
    stick; a drag on the map orbits the camera and never drives; W A S D still drive; the build view hides the stick
 2. see-through rule: the tank is tracked for the outline; a building between the camera and the tank stays solid (its own
    material) and the camera keeps its distance; only the wall cell / building the hull is pressed against goes see-through,
    and only while it is; the build view presses nothing
 3. budgets: 16 shader programs and 140 draw calls in the drive view
Software GL: behaviour, not phone frame rate."""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5e2d1/town';OUT.mkdir(parents=True,exist_ok=True)
GATE=[1080,1160]
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);R={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   async def session(w,h,fixture,q):
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await ctx.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="'+q+'";window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}}};try{localStorage.setItem("lunar-conquest-onboarding-v1","1");localStorage.setItem("lunar-cq-town-tour-v1","1")}catch(e){}')
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
    await page.request.post(base+'/fixture',data=fixture)
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    await page.request.post(base+'/fixture',data=fixture)
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('#tabbar [data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=90000)
    return ctx,page,errors
   for q in ('high','low'):
    ctx,page,errors=await session(390,700,{'position':GATE,'baseFunds':True,'plotGallery':True},q)
    world=await page.evaluate('(()=>{const r=document.querySelector(".cq-world .cq-stick").getBoundingClientRect();return {w:r.width,h:r.height,left:r.left};})()')
    b=page.locator('#cq-base-access');await b.wait_for(state='visible',timeout=30000);await b.click();await page.wait_for_selector('.cq-plot-tabs',timeout=60000)
    await page.wait_for_function('ConquestPlotView.state?.R&&ConquestPlotView.state.drive&&!ConquestPlotView.state.tour',timeout=60000)
    await page.evaluate('ConquestPlotView.setView("drive")');await page.wait_for_timeout(1500)
    PV='ConquestPlotView.state'
    # ---- 1. controls ----
    st=await page.evaluate('(()=>{const X='+PV+',e=X.d.querySelector(".cq-stick.cq-plot-drivestick"),r=e&&e.getBoundingClientRect(),s=X.stage.getBoundingClientRect();return e?{w:r.width,h:r.height,left:r.left,cx:r.left+r.width/2,cy:r.top+r.height/2,hidden:e.hidden,inStage:r.top>=s.top-1&&r.bottom<=s.bottom+1,floating:!!X.d.querySelector(".cq-plot-stick"),text:e.textContent}:null;})()')
    assert st and not st['hidden'] and not st['floating'] and st['inStage'] and 'DRIVE' in st['text'],('the fixed DRIVE joystick is on screen in the drive view',st)
    assert abs(st['w']-world['w'])<1 and abs(st['h']-world['h'])<1 and abs(st['left']-world['left'])<2,('same joystick as the world: size and corner',world,st)
    pos=lambda:page.evaluate('(()=>{const D='+PV+'.drive;return [D.x,D.z,'+PV+'.chase.yaw,D.stick.x,D.stick.z];})()')
    p0=await pos();cdp=await ctx.new_cdp_session(page)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':st['cx'],'y':st['cy']}]})
    for k in range(1,9):await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':st['cx'],'y':st['cy']-5*k}]})
    await page.wait_for_timeout(1300);held=await pos()
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(500);p1=await pos()
    drove=((p1[0]-p0[0])**2+(p1[1]-p0[1])**2)**.5
    assert drove>3 and abs(held[4]+1)<.05 and p1[3]==0 and p1[4]==0 and abs(p1[2]-p0[2])<1e-6,('the joystick drives; releasing it stops; the camera does not swing by itself',p0,held,p1)
    # a drag on the map orbits the camera and never drives
    sb=await page.evaluate('(()=>{const s='+PV+'.stage.getBoundingClientRect();return [s.left+s.width*.62,s.top+s.height*.45];})()')
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sb[0],'y':sb[1]}]})
    for k in range(1,11):await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sb[0]-9*k,'y':sb[1]}]})
    await page.wait_for_timeout(400);await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(300);p2=await pos()
    assert abs(p2[2]-p1[2])>.3 and ((p2[0]-p1[0])**2+(p2[1]-p1[1])**2)**.5<.8,('a drag on the map orbits the camera, it does not drive',p1,p2)
    # the keyboard still drives
    await page.keyboard.down('w');await page.wait_for_timeout(900);await page.keyboard.up('w');await page.wait_for_timeout(300);p3=await pos()
    assert ((p3[0]-p2[0])**2+(p3[1]-p2[1])**2)**.5>2,('W drives',p2,p3)
    await page.screenshot(path=str(OUT/f'town-drive-stick-390-{q}.png'))
    # ---- 2. see-through rule ----
    see=await page.evaluate('(()=>{const X='+PV+',R=X.R;return {twins:R.outline?.group.children.length||0,roots:R.outline?[...R.outline.sets.keys()].every(r=>r===X.tank):false,k:R.S.U.uPressK.value};})()')
    assert see['twins']>=2 and see['roots'],('the town tank is tracked for the outline',see)
    # the Command Center between the camera and the tank: it stays solid and the camera keeps its distance
    behind=await page.evaluate('''(()=>{const X=ConquestPlotView.state,P=ConquestPlot,p=Conquest.view.authority.state.plot,c=p.b.cc,s=P.sizeOf('cc',c.r|0),cx=P.cellX(c.i)+(s.w-1)*2,cz=P.cellZ(c.j)+(s.d-1)*2,D=X.drive;
      D.x=cx;D.z=cz-(s.d*2+7);D.v=0;D.h=0;X.chase.yaw=0;X.chase.lift=0;return {cx,cz,dist:X.chase.dist};})()''')
    await page.wait_for_timeout(900)
    solid=await page.evaluate('''(()=>{const X=ConquestPlotView.state,R=X.R,e=R.meshes.get('cc');let ghost=0,n=0;e.o.traverse(m=>{if(m.isMesh){n++;if(m.userData.fadeOrig||m.material.transparent&&m.material.isMeshBasicMaterial)ghost++;}});
      return {n,ghost,k:R.S.U.uPressK.value,cur:X.chase.cur,dist:X.chase.dist,camD:Math.hypot(R.cam.position.x-X.drive.x,R.cam.position.z-X.drive.z)};})()''')
    await page.screenshot(path=str(OUT/f'town-behind-cc-390-{q}.png'))
    assert solid['n']>=1 and solid['ghost']==0 and solid['k']==0,('a building between the camera and the tank stays solid',solid)
    assert solid['cur']==solid['dist'] and abs(solid['camD']-solid['dist'])<.8,('the chase camera does not come in for a building',solid)
    # pressed against the Command Center: only it goes see-through, and only while the hull is against it
    await page.evaluate('''(()=>{const X=ConquestPlotView.state,P=ConquestPlot,p=Conquest.view.authority.state.plot,c=p.b.cc,s=P.sizeOf('cc',c.r|0),cx=P.cellX(c.i)+(s.w-1)*2,cz=P.cellZ(c.j)+(s.d-1)*2,D=X.drive;D.x=cx;D.z=cz-(s.d*2+2.6);D.v=0;D.h=0;})()''')
    await page.wait_for_function(PV+'.R.S.U.uPressK.value>.6',timeout=15000);await page.wait_for_timeout(400)
    pressed=await page.evaluate('''(()=>{const X=ConquestPlotView.state,R=X.R,U=R.S.U,e=R.meshes.get('cc');let ghost=0,solidMat=0,other=0;e.o.traverse(m=>{if(!m.isMesh)return;if(m.userData.fadeOrig)ghost++;else if(m.material===R.S.MAT.solid)solidMat++;});
      for(const [id,q] of R.meshes)if(id!=='cc')q.o.traverse(m=>{if(m.isMesh&&m.userData.fadeOrig)other++;});
      const c=Conquest.view.authority.state.plot.b.cc,s=ConquestPlot.sizeOf('cc',c.r|0);return {ghost,solidMat,other,fp:[U.uPress.value.x-U.uOrigin.value.x,U.uPress.value.y-U.uOrigin.value.y,U.uPress.value.z],want:[ConquestPlot.cellX(c.i)+(s.w-1)*2,ConquestPlot.cellZ(c.j)+(s.d-1)*2,s.w*2+.3],k:U.uPressK.value};})()''')
    await page.screenshot(path=str(OUT/f'town-pressed-cc-390-{q}.png'))
    assert pressed['ghost']+pressed['solidMat']>=1 and pressed['other']==0,('only the pressed building is thinned',pressed)
    assert all(abs(a-b)<.01 for a,b in zip(pressed['fp'],pressed['want'])),('the pressed footprint is the Command Center',pressed)
    await page.evaluate('(()=>{const X='+PV+',D=X.drive;D.z-=7;D.v=0;})()')   # clear ground again (never the gate pad: resting on it leaves the town)
    await page.wait_for_function(PV+'.R.S.U.uPressK.value===0',timeout=15000)
    back=await page.evaluate('''(()=>{const R=ConquestPlotView.state.R;let ghost=0;for(const [id,q] of R.meshes)q.o.traverse(m=>{if(m.isMesh&&m.userData.fadeOrig)ghost++;});return ghost;})()''')
    assert back==0,('away from it the building is solid again',back)
    info=await page.evaluate(PV+'.info');await page.wait_for_timeout(300)
    info=await page.evaluate('(()=>{const X='+PV+',r=Conquest.view.renderer;return {calls:r.info.render.calls,programs:r.info.programs.length};})()')
    assert info['programs']<=16 and info['calls']<=140,('drive view budgets: 16 programs, 140 draw calls',info)
    # the build view: no stick, nothing pressed, no outline
    await page.evaluate('ConquestPlotView.setView("build")');await page.wait_for_timeout(900)
    build=await page.evaluate('(()=>{const X='+PV+',R=X.R;return {stickHidden:X.d.querySelector(".cq-plot-drivestick").hidden,k:R.S.U.uPressK.value,twins:R.outline.group.children.length,view:X.view};})()')
    assert build['view']=='build' and build['stickHidden'] and build['k']==0 and build['twins']==0,('the build view has no joystick, no outline and nothing pressed',build)
    assert not errors,errors
    R[q]={'stick':st,'world':world,'drove':round(drove,1),'behind':solid,'pressed':pressed,'drive':info}
    for pg in ctx.pages:
     try:await pg.unroute_all(behavior='ignoreErrors')
     except Exception:pass
    await ctx.close()
   await browser.close()
  (OUT/'results.json').write_text(json.dumps(R,indent=1,default=str));print('PASS conquest-seethrough-town',json.dumps({q:{'drove':R[q]['drove'],'drive':R[q]['drive'],'ghost':R[q]['pressed']['ghost'],'solidMat':R[q]['pressed']['solidMat']} for q in R}))
 finally:server.terminate();await server.wait()
asyncio.run(main())
