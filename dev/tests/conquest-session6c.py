"""Session 6C browser journey (owner prompt Nov 18): the Battalion in the shipped client against the real Worker on a disposable
local DB, at 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (real keyboard and mouse). Phone and computer are the same
elements. Checks:
 A. the first wingman: after the first plate NEXT leads to RESCUE THE DOWNED PILOT; the briefing strip (enemy icons, hint, your
    force: solo); two taps from briefing to deploy; the verified victory's after-action says WINGMAN JOINED; back in the world the
    wingman is drawn in 3D with its insignia (a Wing).
 B. the hub BATTALION card (FORCE chip, COMMAND CHIP 0/1 TODAY), the HANGAR (roster cards, AUTO-ARM, presets; its CLOSE reachable),
    a raid's briefing strip (PLATOON force, presets P1-P3, FORCE), the Platoon fight: allies drawn in 3D (four Meshy tanks and their
    insignia), COMMAND in the context slot (never beside SCAN or GATHER; the HUD keeps its touch targets), tap = the smart order,
    hold = the wheel (slide onto ATTACK); on a computer V, hold V + 3 = HOLD HERE; the after-action YOUR PILOTS lines.
 C. the Science Lab IV Role Cores track and the first Lab grant card (+2 Thermal Cores taken once).
Screenshots in docs/conquest/session6c/. Software GL: looks and layout, never phone FPS."""
import asyncio,json,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session6c';OUT.mkdir(parents=True,exist_ok=True)
SIZES=[(390,844),(390,700),(320,568),(1366,768),(1920,1080)]
if len(sys.argv)>1:SIZES=[tuple(int(v) for v in a.split('x')) for a in sys.argv[1:]]
async def close_ctx(ctx):
 for pg in ctx.pages:
  try:await pg.unroute_all(behavior='ignoreErrors')
  except Exception:pass
 await ctx.close()
async def open_page(browser,base,ready,w,h,R):
 phone=w<800
 ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=phone,is_mobile=phone,device_scale_factor=1,reduced_motion='reduce')
 page=await ctx.new_page();errors=R.setdefault('errors',[]);page.on('pageerror',lambda e:errors.append(str(e)[:300]))
 page.on('console',lambda m:errors.append('console:'+m.text[:300]) if m.type=='error' and 'ERR_FAILED' not in m.text and '409' not in m.text and '429' not in m.text else None)
 await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'Browser'}},ready(){},expand(){},onEvent(){},offEvent(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},MainButton:{hide(){}},BackButton:{hide(){},show(){},onClick(){},offClick(){}},platform:'''+json.dumps('ios' if phone else 'tdesktop')+''',version:'7.0',colorScheme:'dark',themeParams:{},isExpanded:true,viewportHeight:'''+str(h)+''',viewportStableHeight:'''+str(h)+''',isVersionAtLeast:()=>true}};''')
 async def route(r):
  u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
  if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
   for attempt in range(2):
    try:
     resp=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    except Exception:
     if attempt:return await r.fulfill(status=503,body='{}',content_type='application/json')
     await asyncio.sleep(.2)
  if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
  if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
  if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
  await r.abort()
 await page.route('**/*',route)
 return ctx,page
async def boot(page,base,fix,w,h):
 await page.request.post(base+'/fixture',data=fix)
 await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof save!=="undefined"')
 await page.request.post(base+'/fixture',data=fix)
 await page.evaluate('closeAll();save.welcomed=true;try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){};uiDirty();')
 if w<800:await page.touchscreen.tap(5,h-5)
 else:await page.mouse.click(5,h-5)
async def into_world(page,press):
 await press(page.locator('.cq-hub-deploy').first)
 await page.wait_for_function('Conquest.view?.authority?.connected',timeout=120000)
 for _ in range(6):
  sk=page.locator('.cq-radio button')
  if await sk.count():
   await press(sk.first);await page.wait_for_timeout(300)
  else:break
 await page.wait_for_timeout(1200)
# every visible touch target of the field HUD (dialogs excluded): the context slot is one of them, whichever button fills it
HUD_TARGETS='''(()=>{const p=document.querySelector('.cq-world');if(!p)return -1;let n=0;for(const b of p.querySelectorAll('button,.cq-stick')){if(b.closest('.cq-dialog,.cq-cmd-wheel,.cq-radio,.cq-menu,[hidden]'))continue;const r=b.getBoundingClientRect(),s=getComputedStyle(b);if(r.width<8||r.height<8||s.visibility==='hidden'||s.display==='none'||+s.opacity===0)continue;n++;}return n;})()'''
SLOT='''(()=>['#cq-scan-access','#cq-gather-access','#cq-command-access'].filter(q=>{const b=document.querySelector(q);return b&&!b.hidden&&b.getBoundingClientRect().width>0;}))()'''
async def wait_victory_aar(page,base,timeout=60000):
 c=await page.request.post(base+'/fixture-op-clear',data={});n=(await c.json()).get('cleared')
 await page.wait_for_selector('.cq-result .cq-aar-bat',timeout=timeout)
 await page.wait_for_timeout(400);return n
async def journey(browser,base,ready,w,h):
 R={'size':f'{w}x{h}','input':'touch' if w<800 else 'mouse+keyboard'}
 try:return await steps(browser,base,ready,w,h,R)
 except Exception as e:
  R['crash']=str(e)[:700];return R
async def steps(browser,base,ready,w,h,R):
 phone=w<800;tag=f'{w}x{h}'
 # ---------------- A. the first wingman ----------------
 ctx,page=await open_page(browser,base,ready,w,h,R)
 press=(lambda loc:loc.tap()) if phone else (lambda loc:loc.click())
 shot=lambda name:page.screenshot(path=str(OUT/f'{name}-{tag}.png'))
 await boot(page,base,{'position':[1100,1226],'completed':{'oxygen-line':{'at':1,'attempt':0}},'firsts':{'bank':1},'wallet':{'ap':[1,0,0,0]}},w,h)
 await press(page.locator('[data-act="conquest"]:visible').first);await page.wait_for_selector('.cq-hub-deploy',timeout=30000);await page.wait_for_timeout(600)
 R['hubFresh']=await page.evaluate('(document.querySelector(".cq-hub-battalion, .cq-hub")?.textContent||"").match(/NO PILOTS YET|downed pilot[^.]*/i)?.[0]||null')
 await into_world(page,press)
 R['nextChip']=await page.evaluate('document.querySelector(".cq-nav-title")?.textContent||null')
 acc=page.locator('#cq-mission-access')
 await page.wait_for_function('(()=>{const b=document.querySelector("#cq-mission-access");return b&&!b.hidden;})()',timeout=30000)
 R['rescueAccess']=await acc.inner_text()
 await press(acc);await page.wait_for_selector('.cq-dialog .cq-bat-strip',timeout=20000);await page.wait_for_timeout(300)
 R['rescueStrip']=await page.evaluate('(()=>{const s=document.querySelector(".cq-dialog .cq-bat-strip");return {enemies:[...s.querySelectorAll(".cq-bat-foe")].map(x=>x.textContent),hint:s.querySelector(".cq-bat-hint")?.textContent,force:s.querySelector(".cq-bat-force")?.textContent};})()')
 await shot('briefing-rescue')
 start=page.get_by_role('button',name='START MISSION');await start.scroll_into_view_if_needed();await press(start)   # two taps: the site button, then START MISSION
 await page.wait_for_function('!!Conquest.view?.battle',timeout=30000);await page.wait_for_timeout(1500)
 R['rescueCleared']=await wait_victory_aar(page,base)
 R['rescueAar']=await page.evaluate('document.querySelector(".cq-result .cq-aar-bat")?.textContent||null')
 await shot('aar-wingman')
 ret=page.get_by_role('button',name='RETURN TO EXPLORATION');await ret.scroll_into_view_if_needed();await press(ret)
 await page.wait_for_function('!Conquest.view?.battle&&(Conquest.view?.encounter?.friends||[]).length>0',timeout=30000);await page.wait_for_timeout(2500)
 try:await page.wait_for_selector('.cq-ally-tag:not([hidden])',timeout=8000)   # the wingman takes its formation slot (it may stand just off-screen first)
 except Exception:pass
 R['wing']=await page.evaluate('({friends:(Conquest.view.encounter.friends||[]).map(f=>({cs:f.name,role:f.role||"wingman",mil:!!f.mil})),views:Conquest.view.friendViews?Conquest.view.friendViews.size:0,state:{w:Conquest.view.authority.state?.bat?.w||0,done:!!Conquest.view.authority.state?.completed?.["wingman-rescue"],roster:(Conquest.view.authority.state?.bat?.p||[]).length},next:document.querySelector(".cq-nav-title")?.textContent||null,access:(()=>{const b=document.querySelector("#cq-mission-access");return b&&!b.hidden?b.textContent:null;})(),tags:[...document.querySelectorAll(".cq-ally-tag:not([hidden])")].map(t=>t.textContent)})')
 await shot('wing-world')
 await close_ctx(ctx)
 # ---------------- B. the Platoon (Hangar II, four pilots) ----------------
 ctx,page=await open_page(browser,base,ready,w,h,R)
 press=(lambda loc:loc.tap()) if phone else (lambda loc:loc.click())
 shot=lambda name:page.screenshot(path=str(OUT/f'{name}-{tag}.png'))
 await boot(page,base,{'position':[905,925],'fieldMissions':True,'firsts':{'bank':1,'plate':1},'wallet':{'ap':[1,0,0,0]},'battalion':{'n':4,'hangar':2}},w,h)
 await press(page.locator('[data-act="conquest"]:visible').first);await page.wait_for_selector('.cq-hub-deploy',timeout=30000)
 try:await page.wait_for_selector('.cq-hub-chip-day',timeout=30000)
 except Exception:pass
 R['hubCard']=await page.evaluate('(()=>{const c=document.querySelector(".cq-hub-chip-day");const card=c?.closest(".cq-hub-card");return {chipDay:c?.textContent||null,card:card?.textContent?.slice(0,200)||null,force:!!document.querySelector(".cq-rating-force")};})()')
 await shot('hub-battalion')
 await press(page.locator('.cq-hub-hangar').first);await page.wait_for_selector('.cq-dialog.cq-hangar .cq-bat-card',timeout=30000);await page.wait_for_timeout(400)
 R['hangar']=await page.evaluate('({cards:document.querySelectorAll(".cq-hangar .cq-bat-card").length,toggles:[...document.querySelectorAll(".cq-hangar .cq-bat-card .cq-bat-toggle")].map(b=>b.textContent),arm:!!document.querySelector(".cq-bat-arm"),presets:document.querySelectorAll(".cq-hangar .cq-bat-presets button").length,forms:[...document.querySelectorAll(".cq-hangar .cq-bat-forms button")].map(b=>b.textContent+(b.disabled?"(off)":""))})')
 await shot('hangar')
 last=page.locator('.cq-dialog.cq-hangar > button',has_text='CLOSE').last;await last.scroll_into_view_if_needed();R['hangarCloseVisible']=await last.is_visible();await press(last)
 await page.wait_for_function('!document.querySelector(".cq-dialog.cq-hangar")',timeout=10000)
 await into_world(page,press)
 R['openWorld']={'targets':await page.evaluate(HUD_TARGETS),'slot':await page.evaluate(SLOT)}
 acc=page.locator('#cq-mission-access');await page.wait_for_function('(()=>{const b=document.querySelector("#cq-mission-access");return b&&!b.hidden&&!b.disabled;})()',timeout=30000)
 await press(acc)
 if await page.locator('.cq-site-operations').count():
  first=page.locator('.cq-site-operations button',has_text='BRIEF').first;await press(first)
 await page.wait_for_selector('.cq-dialog .cq-bat-strip',timeout=20000);await page.wait_for_timeout(300)
 R['raidStrip']=await page.evaluate('(()=>{const s=document.querySelector(".cq-dialog .cq-bat-strip");return {enemies:s.querySelectorAll(".cq-bat-foe").length,hint:s.querySelector(".cq-bat-hint")?.textContent,force:[...s.querySelectorAll(".cq-bat-mine")].map(x=>x.textContent),label:s.querySelector(".cq-bat-force .cq-bat-strip-k")?.textContent,presets:s.querySelectorAll(".cq-bat-strip-presets button").length,force_chip:!!s.querySelector(".cq-rating-force"),warn:s.querySelector(".cq-bat-warn")?.textContent||null};})()')
 await shot('briefing-raid')
 start=page.get_by_role('button',name='START MISSION');await start.scroll_into_view_if_needed();await press(start)
 await page.wait_for_function('!!Conquest.view?.battle',timeout=30000)
 await page.wait_for_function('(()=>{const b=document.querySelector("#cq-command-access");return b&&!b.hidden;})()',timeout=30000);await page.wait_for_timeout(3000)
 R['fight']=await page.evaluate('({friends:Conquest.view.battle.friends.length,views:Conquest.view.friendViews?Conquest.view.friendViews.size:0,meshes:[...(Conquest.view.friendViews?.values()||[])].map(F=>{let n=0;F.g.traverse(o=>{if(o.isMesh)n++;});return n;}),tags:document.querySelectorAll(".cq-ally-tag:not([hidden])").length,command:document.querySelector("#cq-command-access")?.textContent,calls:Conquest.view.renderer.info?.render?.calls,programs:Conquest.view.renderer.info?.programs?.length})')
 R['fight']['targets']=await page.evaluate(HUD_TARGETS);R['fight']['slot']=await page.evaluate(SLOT)
 b=page.locator('#cq-command-access');bb=await b.bounding_box();R['fight']['commandBox']=[round(bb['x']),round(bb['y']),round(bb['width']),round(bb['height'])]
 x=bb['x']+bb['width']/2;y=bb['y']+bb['height']/2
 await shot('fight-platoon')
 if phone:
  await page.touchscreen.tap(x,y);await page.wait_for_timeout(500)
  R['tap']=await page.evaluate('ConquestCommand.state?.last?.k??null')
  cdp=await ctx.new_cdp_session(page)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});await page.wait_for_timeout(520)
  R['wheelOpen']=await page.evaluate('ConquestCommand.isOpen()');await shot('wheel')
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+70,'y':y}]});await page.wait_for_timeout(120)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(700)
  R['wheelOrder']=await page.evaluate('({k:ConquestCommand.state?.last?.k??null,o:Conquest.view.battle?.squad?.o})')
 else:
  await page.keyboard.down('KeyV');await page.wait_for_timeout(80);await page.keyboard.up('KeyV');await page.wait_for_timeout(500)
  R['tap']=await page.evaluate('ConquestCommand.state?.last?.k??null')
  await page.keyboard.down('KeyV');await page.wait_for_timeout(450);R['wheelOpen']=await page.evaluate('ConquestCommand.isOpen()');await shot('wheel')
  await page.keyboard.press('Digit3');await page.keyboard.up('KeyV');await page.wait_for_timeout(700)
  R['wheelOrder']=await page.evaluate('({k:ConquestCommand.state?.last?.k??null,o:Conquest.view.battle?.squad?.o,items:JSON.stringify(Conquest.view.authority?.state?.inv?.it||{})})')
  # a real mouse on the wheel: hold V, point at ATTACK, let go of V
  await page.keyboard.down('KeyV');await page.wait_for_timeout(450);r=await page.locator('.cq-cmd-right').bounding_box()
  await page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);await page.wait_for_timeout(150);await page.keyboard.up('KeyV');await page.wait_for_timeout(700)
  R['mouseOrder']=await page.evaluate('({k:ConquestCommand.state?.last?.k??null,o:Conquest.view.battle?.squad?.o})')
 await page.wait_for_timeout(1500);await shot('fight-platoon-2')
 R['raidCleared']=await wait_victory_aar(page,base)
 R['raidAar']=await page.evaluate('document.querySelector(".cq-result .cq-aar-bat")?.textContent||null')
 await shot('aar-platoon')
 await close_ctx(ctx)
 # ---------------- C. Science Lab IV: Role Cores and the first Lab grant ----------------
 ctx,page=await open_page(browser,base,ready,w,h,R)
 press=(lambda loc:loc.tap()) if phone else (lambda loc:loc.click())
 shot=lambda name:page.screenshot(path=str(OUT/f'{name}-{tag}.png'))
 await boot(page,base,{'research':{'cc':7,'lv':4},'battalion':{'n':6,'hangar':2,'chips':3}},w,h)
 await press(page.locator('[data-act="conquest"]:visible').first);await page.wait_for_selector('.cq-hub-research',timeout=30000);await page.wait_for_timeout(500)
 await press(page.locator('.cq-hub-research').first);await page.wait_for_selector('.cq-lab-hub.cq-lab',timeout=30000);await page.wait_for_timeout(500)
 R['grantCard']=await page.evaluate('document.querySelector(".cq-lab-grant")?.textContent||null')
 await shot('lab-grant')
 g=page.locator('.cq-lab-grant-go').first;await g.scroll_into_view_if_needed();await press(g)
 await page.wait_for_function('!document.querySelector(".cq-lab-grant")',timeout=20000);await page.wait_for_timeout(300)
 R['afterGrant']=await page.evaluate('[...document.querySelectorAll(".cq-lab-part")].map(x=>x.textContent)')
 fold=page.locator('.cq-lab-roles > summary');await fold.scroll_into_view_if_needed()
 if not await page.evaluate('document.querySelector(".cq-lab-roles")?.open'):await press(fold)
 await page.wait_for_timeout(300)
 R['roleCores']=await page.evaluate('[...document.querySelectorAll(".cq-lab-rc")].map(r=>(r.querySelector("h3")?.textContent||"")+" | "+(r.querySelector("button")?.textContent||r.querySelector(".cq-lab-tag")?.textContent||"")+(r.querySelector("button")?.disabled?" (off)":""))')
 await page.locator('.cq-lab-rc').first.scroll_into_view_if_needed();await shot('lab-rolecores')
 await close_ctx(ctx)
 # ---------------- D. a full Battalion (Hangar V, 9 fielded) on LOW graphics: frame times relative to the Platoon in the same raid ----------------
 ctx,page=await open_page(browser,base,ready,w,h,R)
 press=(lambda loc:loc.tap()) if phone else (lambda loc:loc.click())
 shot=lambda name:page.screenshot(path=str(OUT/f'{name}-{tag}.png'))
 await boot(page,base,{'position':[905,925],'fieldMissions':True,'firsts':{'bank':1,'plate':1},'wallet':{'ap':[1,0,0,0]},'battalion':{'n':9,'hangar':5}},w,h)
 await page.evaluate('save.gfx="low";uiDirty();')
 await press(page.locator('[data-act="conquest"]:visible').first);await page.wait_for_selector('.cq-hub-deploy',timeout=30000)
 await into_world(page,press)
 acc=page.locator('#cq-mission-access');await page.wait_for_function('(()=>{const b=document.querySelector("#cq-mission-access");return b&&!b.hidden&&!b.disabled;})()',timeout=30000);await press(acc)
 if await page.locator('.cq-site-operations').count():await press(page.locator('.cq-site-operations button',has_text='BRIEF').first)
 start=page.get_by_role('button',name='START MISSION');await start.scroll_into_view_if_needed();await press(start)
 await page.wait_for_function('!!Conquest.view?.battle',timeout=30000);await page.wait_for_timeout(2500)
 FRAMES='''()=>new Promise(done=>{const iv=[];let last=performance.now(),n=0;const f=t=>{iv.push(t-last);last=t;if(++n<240)requestAnimationFrame(f);else{const x=iv.slice(20).sort((a,b)=>a-b),q=p=>+x[Math.min(x.length-1,Math.floor(x.length*p))].toFixed(1),v=Conquest.view;done({median:q(.5),p95:q(.95),worst:+x.at(-1).toFixed(1),calls:v.renderer.info?.render?.calls,tris:v.renderer.info?.render?.triangles,programs:v.renderer.info?.programs?.length,friends:(v.battle?.friends||[]).length,views:v.friendViews?v.friendViews.size:0,hostiles:(v.battle?.enemies||[]).filter(e=>e.hp>0&&Math.hypot(e.x-v.p.x,e.z-v.p.z)<120).length,low:gfxMode()});}};requestAnimationFrame(f);})'''
 R['perfPlatoon']=await page.evaluate(FRAMES)
 fl=await page.request.post(base+'/fixture-field',data={'scale':'battalion'});R['fielded']=(await fl.json()).get('fielded')
 await page.wait_for_function('(Conquest.view?.battle?.friends||[]).length>=9',timeout=90000);await page.wait_for_timeout(3000)
 R['perfBattalion']=await page.evaluate(FRAMES)
 await shot('battalion-low')
 await close_ctx(ctx)
 R.pop('_page',None);return R
def verdict(R):
 bad=[];e=lambda c,m:None if c else bad.append(m)
 if R.get('crash'):return ['crash: '+R['crash']]
 e('RESCUE THE DOWNED PILOT' in (R.get('nextChip') or '') or 'RESCUE' in (R.get('rescueAccess') or ''),'NEXT leads to the rescue: '+str(R.get('nextChip')))
 rs=R.get('rescueStrip') or {};e(len(rs.get('enemies') or [])>=1 and (rs.get('hint') or '').startswith('2 interceptors') and 'Solo' in (rs.get('force') or ''),'rescue strip '+json.dumps(rs))
 e('WINGMAN JOINED' in (R.get('rescueAar') or ''),'after-action names the wingman: '+str(R.get('rescueAar')))
 wg=R.get('wing') or {};e(len(wg.get('friends') or [])==1 and wg.get('views')==1 and len(wg.get('tags') or [])==1 and wg['friends'][0]['mil'],'the wingman in 3D with its insignia: '+json.dumps(wg))
 hc=R.get('hubCard') or {};e((hc.get('chipDay') or '').startswith('COMMAND CHIP 0/1 TODAY') and hc.get('force'),'hub BATTALION card '+json.dumps(hc))
 hg=R.get('hangar') or {};e(len(hg.get('toggles') or [])==4 and all('IN FORCE' in t for t in hg.get('toggles') or []),'every card has its force button (an empty preset fields all four: IN FORCE · AUTO): '+json.dumps(hg.get('toggles')));e(hg.get('cards')==4 and hg.get('arm') and hg.get('presets')==3 and len(hg.get('forms') or [])==3 and R.get('hangarCloseVisible'),'HANGAR '+json.dumps(hg))
 st=R.get('raidStrip') or {};e(st.get('enemies',0)>=3 and st.get('label')=='PLATOON' and len(st.get('force') or [])==4 and st.get('presets')==3 and st.get('force_chip'),'raid strip '+json.dumps(st))
 f=R.get('fight') or {};e(f.get('friends')==4 and f.get('views')==4 and all(m>=1 for m in f.get('meshes') or [0]) and f.get('tags')==4,'allies in 3D '+json.dumps(f))
 e((f.get('programs') or 99)<=16,'the Platoon fight stays inside the 16-program budget: '+str(f.get('programs')))
 e(f.get('slot')==['#cq-command-access'] and R.get('openWorld',{}).get('slot') in (['#cq-scan-access'],['#cq-gather-access'],['#cq-command-access']),'one context slot: '+str(f.get('slot'))+' / '+str(R.get('openWorld')))
 e(0<f.get('targets',99)<=max(8,R.get('openWorld',{}).get('targets',0)),'the fight HUD keeps its touch targets: '+str(f.get('targets'))+' (open world '+str(R.get('openWorld',{}).get('targets'))+')')
 bx=f.get('commandBox') or [0,0,0,0];w,h=[int(v) for v in R['size'].split('x')];e(bx[3]>=44 and bx[0]>=0 and bx[1]+bx[3]<=h and bx[0]+bx[2]<=w,'COMMAND on screen and a 44 px target '+str(bx))
 e(R.get('tap')==5,'tap / V = the smart order: '+str(R.get('tap')))
 e(R.get('wheelOpen'),'hold opens the wheel')
 wo=R.get('wheelOrder') or {}
 if R['input']=='touch':e(wo.get('k')==2 and wo.get('o')=='attack','slide onto ATTACK: '+json.dumps(wo))
 else:
  e(wo.get('k')==3 and wo.get('o')=='hold' and wo.get('items')==json.dumps({'repair':0,'shield':0,'scanner':0,'decoy':0}).replace(' ',''),'hold V + 3 = HOLD HERE (no consumable used): '+json.dumps(wo))
  mo=R.get('mouseOrder') or {};e(mo.get('k')==2 and mo.get('o')=='attack','hold V, point at ATTACK with the mouse, let go: '+json.dumps(mo))
 e('XP' in (R.get('raidAar') or '') and 'COMMAND CHIP' in (R.get('raidAar') or ''),'after-action YOUR PILOTS: '+str(R.get('raidAar')))
 e('FIRST LAB GRANT' in (R.get('grantCard') or '') and any(p.startswith('2') and 'THERMAL' in p for p in R.get('afterGrant') or []),'first Lab grant taken once: '+str(R.get('afterGrant')))
 rc=R.get('roleCores') or [];e(len(rc)==6 and any('RESEARCH CORE II · 2 CHIPS' in x and '(off)' not in x for x in rc),'Role Cores track: '+json.dumps(rc))
 pp,pb=R.get('perfPlatoon') or {},R.get('perfBattalion') or {}
 e(R.get('fielded')==9 and pb.get('friends')==9 and pb.get('views')==9 and pb.get('low')=='low' and (pb.get('programs') or 99)<=16,'a full Battalion of 9 drawn on LOW within the 16-program budget: '+json.dumps(pb))
 e((pb.get('median') or 1e9)<=max(1.75*(pp.get('median') or 0),40),'Battalion frame median within 1.75x the Platoon in the same raid (software GL, relative only): '+json.dumps([pp.get('median'),pb.get('median')]))
 e(not R.get('errors'),'no page errors: '+json.dumps((R.get('errors') or [])[:3]))
 return bad
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);out=[];fails=[]
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   for w,h in SIZES:
    R=await journey(browser,base,ready,w,h);bad=verdict(R);R['verdict']='PASS' if not bad else bad;out.append(R);print(json.dumps(R)[:2400],flush=True)
    if bad:fails.append(f'{w}x{h}: '+' | '.join(bad))
   await browser.close()
 finally:
  server.terminate()
 json.dump(out,open(OUT/'journey.json','w'),indent=1)
 print(('FAIL conquest-session6c: '+' || '.join(fails)) if fails else 'PASS conquest-session6c ('+str(len(out))+' sizes)')
 sys.exit(1 if fails else 0)
asyncio.run(main())
