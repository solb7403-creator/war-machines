"""Your real tank at login, and in the town view (Session 5E-2d2 section 5; owner, Nov 11 and Nov 20).

The rule: wherever the game draws the pilot's tank at or after login (the home screen, the garage, the Conquest hub, the Conquest
world, the town view), no frame may show a chassis, weapon or stand-in that is not the pilot's current tank. Until the server's
loadout is in and its Meshy model has landed the surface shows its wait state (no tank); a model download that fails gives the
code-built version of the SAME chassis and weapon; if the server cannot be reached, the newest copy on hand.

How it is checked: not by comparing pictures. A script installed before any game script wraps requestAnimationFrame and, after
every frame callback, reads what tank each surface has in its scene (the Meshy model ids of the meshes under the tank's group,
or the label the game puts on a 2D picture) and records every change. The test then asserts that the set of values each surface
ever held is only "wait" and the expected tank. Real Chromium, the real Worker on a disposable database
(dev/tests/login-tank-server.mjs), the website build (web/play.html) AND the Telegram Mini App page (index.html), a phone
(390x844, touch) and a computer (1366x768, mouse). Scenarios:
  fresh    a device that has never held this account (its own copy is the stock tank; the server says A)
  changed  the loadout was changed on another device (the device copy says A, the server says B), the server's answer is held
           (Telegram) and the model files are held: every surface is visited while it waits, then the files are released
  failed   the chassis model cannot be downloaded: the code-built version of the same chassis and weapon, everywhere
  offline  the server cannot be reached (Telegram: the newest copy on hand, device or Telegram cloud; website: no game, no tank)
  low/2d   LOW quality and the 2D fallback
Screenshots of the wait state and the final tank: docs/conquest/session5e2d2/login/.
Run from the repository root: python3 dev/tests/login-tank-browser.py [--only web-phone,tg-desktop] [--quick]
Software GL here: frame counts are low, every frame that is drawn is sampled."""
import asyncio,json,pathlib,shutil,subprocess,sys,socket,os,mimetypes,time
from urllib.parse import urlparse
from playwright.async_api import async_playwright
# LOGIN_TANK_ROOT / LOGIN_TANK_OUT: run the same test against another checkout (the code before the fix) and keep its pictures apart
ROOT=pathlib.Path(os.environ.get('LOGIN_TANK_ROOT') or pathlib.Path(__file__).resolve().parents[2]).resolve();OUT=pathlib.Path(os.environ.get('LOGIN_TANK_OUT') or ROOT/'docs/conquest/session5e2d2/login');OUT.mkdir(parents=True,exist_ok=True)
WEB='https://lunar.test';TG='https://tg.lunar.test';API='https://lunar-api.solb7403.workers.dev'
A={'w':['siege',2],'c':['titan',2]};B={'w':['twin',1],'c':['scout',1]};C={'w':['pulse',2],'c':['vanguard',2]};SPARE={'w':['pulse',1],'c':['vanguard',1]};STOCK={'w':['pulse',0],'c':['vanguard',0]}
ids=lambda g:('chassis-%s-%d'%tuple(g['c']),'weapon-%s-%d'%tuple(g['w']))
tank=lambda g,kind='meshy':'+'.join(ids(g))+'+'+kind
ONLY=None;QUICK='--quick' in sys.argv
for i,a in enumerate(sys.argv):
 if a=='--only':ONLY=set(sys.argv[i+1].split(','))

# ---- the frame sampler (runs in the page before any game script) ----
SAMPLER=r'''(()=>{
 const T={log:[],seen:{},cur:{},frames:0,bad:[]};window.__tank=T;
 const vis=o=>{for(let p=o;p;p=p.parent)if(p.visible===false)return false;return true;};
 // what is under a tank's group: the Meshy chassis / weapon models by id, and how much else (code-built parts)
 const scan=root=>{const my=[];let other=0,tris=0;if(root&&vis(root))root.traverse(o=>{if(!o.isMesh||!vis(o)||!o.geometry)return;const d=o.userData&&o.userData.meshy,k=d&&d.asset&&d.asset.info&&d.asset.info.kind;
   if(k==='chassis'||k==='weapon'||k==='moon'){if(!my.includes(d.asset.id))my.push(d.asset.id);return;}other++;const g=o.geometry;tris+=(g.index?g.index.count:g.attributes.position?g.attributes.position.count:0)/3;});return {my:my.sort(),other,tris};};
 const idOf=L=>{const t=x=>Math.max(0,Math.min(2,x|0));return L&&L.c&&L.w?['chassis-'+L.c.c+'-'+t(L.c.t),L.w.a==='moon'?'weapon-moon':'weapon-'+L.w.a+'-'+t(L.w.t)]:['?','?'];};
 const shown=el=>!!el&&el.isConnected&&(el.checkVisibility?el.checkVisibility():el.offsetParent!==null)&&el.getClientRects().length>0;
 // a 3D tank group -> 'chassis-id+weapon-id+kind' (kind: meshy = both of the owner's models, kit = code-built, mixed = one of each)
 const look=(root,L,name)=>{const s=scan(root);if(!root||!s.my.length&&!s.other)return 'wait';
  const lab=root.userData&&root.userData.tankId,[c,w]=lab?[lab.c,lab.w]:idOf(L),mc=s.my.find(x=>x.startsWith('chassis-')),mw=s.my.find(x=>x.startsWith('weapon-'));
  const kind=mc&&mw?'meshy':mc||mw?'mixed':s.tris<200?'standin':'kit',v=(mc||c)+'+'+(mw||w)+'+'+kind;
  if(!lab)T.unlabelled=(T.unlabelled||{}),T.unlabelled[name]=1;
  else if(lab.kind!==kind||(mc&&mc!==lab.c)||(mw&&mw!==lab.w)){const m=name+': the label '+JSON.stringify(lab)+' does not match the scene '+JSON.stringify(s);if(!T.bad.includes(m))T.bad.push(m);}
  return v;};
 const g=n=>{try{return (0,eval)('typeof '+n+'==="undefined"?undefined:'+n);}catch(e){return undefined;}};   // top-level let/const of the game's classic scripts
 function sample(){
  const out={};
  try{
   const cq=!!document.querySelector('section.cq'),tab=g('uiTab'),inB=typeof g('inBattle')==='function'&&g('inBattle')();
   if(!cq&&!inB){
    for(const [n,sr] of [['web',g('webShowroom')],['tg',g('gShowroom')]]){
     if(!sr||sr.disposed||sr.visible===false||!shown(sr.el))continue;const name='showroom:'+(tab==='garage'?'garage':'home');
     if(sr.renderer)out[name]=sr.model&&sr.model.parent?look(sr.model,sr.L,name):'wait';
     else{const c=sr.el.querySelector('canvas');out[name]=sr.el.querySelector('.scene-fallback svg')?'?+?+standin':c?(c.dataset.tank||(sr.L?idOf(sr.L).join('+')+'+2d':'wait')):'wait';if(c&&!c.dataset.tank)(T.unlabelled=T.unlabelled||{})[name]=1;}
    }
    const save=g('save'),use3D=g('use3D'),lab=save&&save.lab;
    const hero=document.querySelector('canvas[data-art="hero"]');
    if(hero&&shown(hero)&&tab==='play'){const name='hero';
     if(hero.dataset.tank)out[name]=hero.dataset.tank;
     else{(T.unlabelled=T.unlabelled||{})[name]=1;const L=g('myLoadout')();const AR=g('AR');out[name]=typeof use3D==='function'&&use3D()?(AR&&AR.hero?look(AR.hero.T.g,L,name):'wait'):idOf(L).join('+')+'+2d';}}
    for(const c of document.querySelectorAll('canvas[data-art^="lab:"]')){if(!shown(c))continue;const bay=c.dataset.art.slice(4),name='card:'+bay;
     if(c.dataset.tank)out[name]=c.dataset.tank;
     else if(lab&&lab.machines[bay]){(T.unlabelled=T.unlabelled||{})[name]=1;const L=g('ecoLoadout')(save,lab.machines[bay].spec),M=g('Meshy3D');
      out[name]=idOf(L).join('+')+'+'+(typeof use3D==='function'&&use3D()?(M&&M.stamp(L.c.c,L.c.t,L.w.a,L.w.t)==='my11'?'meshy':'kit'):'2d');}}
    const gs=document.querySelector('.g-stage.static .g-scene canvas');
    if(gs&&shown(gs)){const name='garage-picture';if(gs.dataset.tank)out[name]=gs.dataset.tank;else{(T.unlabelled=T.unlabelled||{})[name]=1;const L=g('gL')&&g('gL')(),M=g('Meshy3D');out[name]=L?idOf(L).join('+')+'+'+(typeof use3D==='function'&&use3D()?(M&&M.stamp(L.c.c,L.c.t,L.w.a,L.w.t)==='my11'?'meshy':'kit'):'2d'):'wait';}}
   }
   const Hub=g('ConquestHub'),H=Hub&&Hub.state;
   if(H&&H.scene&&!H.disposed){const root=H.tank||H.scene.children.find(o=>o.isGroup&&Math.abs(o.scale.x-2.3)<1e-6);out.hub=root?look(root,g('myLoadout')(),'hub'):'wait';}
   const Cq=g('Conquest'),v=Cq&&Cq.view,PV=g('ConquestPlotView'),X=PV&&PV.state;
   if(v&&!v.disposed&&v.vehicle&&!(v.renderer&&v.renderer.isConquestCanvas)){
    if(X){if(X.view==='drive'&&X.R)out.town=X.tank&&X.tank.parent?look(X.tank,v.loadout,'town'):'wait';}
    else out.world=look(v.vehicle,v.loadout,'world');}
  }catch(e){const m='sampler: '+(e&&e.message||e);if(!T.bad.includes(m))T.bad.push(m);}
  for(const k in out){const val=out[k];if(T.cur[k]!==val){T.cur[k]=val;T.log.push({s:k,v:val,t:Math.round(performance.now()),f:T.frames});}(T.seen[k]=T.seen[k]||{})[val]=(T.seen[k][val]||0)+1;}
  for(const k in T.cur)if(!(k in out))delete T.cur[k];
 }
 T.sample=sample;
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{try{cb(t);}finally{sample();}});
 const own=()=>{T.frames++;sample();raf(own);};raf(own);
})();'''

def tg_mock(uid,init_data,cloud_ms=0):
 # the Telegram bridge: CloudStorage kept in this browser profile (a second launch finds what the first one saved), answers after cloud_ms
 return '''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;
(()=>{const K='__tgcloud',rd=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}');}catch(e){return {};}},later=f=>setTimeout(f,%d);
window.Telegram={WebApp:{initData:%s,initDataUnsafe:{user:{id:%d,first_name:'Pilot',username:'pilot%d'}},platform:'ios',version:'8.0',ready(){},expand(){},isVersionAtLeast(){return true},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},
 openLink(){},openTelegramLink(){},openInvoice(){},onEvent(){},offEvent(){},requestWriteAccess(cb){cb&&cb(true)},shareToStory(){},BackButton:{show(){},hide(){},onClick(){}},
 HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},
 CloudStorage:{setItem(k,v,cb){const o=rd();o[k]=v;localStorage.setItem(K,JSON.stringify(o));cb&&cb(null,true)},getItem(k,cb){later(()=>cb(null,rd()[k]||''))},getItems(ks,cb){later(()=>{const o=rd(),r={};ks.forEach(k=>r[k]=o[k]||'');cb(null,r)})}}}};})();'''%(cloud_ms,json.dumps(init_data),uid,uid)

class Gate:
 """What the test does to the pilot's model files and to the server's answers."""
 def __init__(s):s.glb=asyncio.Event();s.glb.set();s.sync=asyncio.Event();s.sync.set();s.fail=();s.offline=False;s.glb_seen=[];s.sync_seen=0

class Run:
 def __init__(s,browser,fix,platform,size):
  s.b=browser;s.fix=fix;s.platform=platform;s.size=size;s.label=platform+'-'+size;s.phone=size=='phone';s.uid=91100000+int(time.time()*1000)%800000*10+{'web-phone':1,'web-desktop':2,'tg-phone':3,'tg-desktop':4}[s.label]
  s.gate=Gate();s.errors=[];s.report={};s.fails=[]
 async def post(s,path,data):
  r=await s.ctx.request.post(s.fix+path,data=data);return await r.json()
 async def start(s):
  vp={'width':390,'height':844} if s.phone else {'width':1366,'height':768}
  s.ctx=await s.b.new_context(viewport=vp,has_touch=s.phone,is_mobile=s.phone,device_scale_factor=1,bypass_csp=True)
  await s.ctx.add_init_script(SAMPLER)
  await s.ctx.add_init_script('window.LUNAR_NO_CS=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_MESHY_WAIT_MS=600000;try{localStorage.setItem("lunar-conquest-onboarding-v1","1");}catch(e){}')
  await s.post('/__seed',{'id':s.uid,'a':A,'spare':SPARE})
  if s.platform=='tg':
   idata=(await s.post('/__initdata',{'id':s.uid}))['initData'];await s.ctx.add_init_script(tg_mock(s.uid,idata,120))
  await s.ctx.route('**/*',s.route);s.pg=await s.ctx.new_page();s.pg.on('pageerror',lambda e:s.errors.append(str(e)))
  if s.platform=='web':
   await s.pg.goto(WEB+'/web/login.html')
   await s.pg.evaluate('''async id=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('fixture sign-in '+r.status);}''',s.uid)
 async def route(s,r):
  u=r.request.url;p=urlparse(u);G=s.gate
  try:
   name=p.path.rsplit('/',1)[-1]
   if name.endswith('.glb') and (name.startswith('chassis-') or name.startswith('weapon-')):
    G.glb_seen.append(name)
    if any(name.startswith(f) for f in G.fail):return await r.abort()
    await G.glb.wait()
   if s.platform=='web':
    if not u.startswith(WEB):return await r.abort()
    if p.path=='/api/sync':
     G.sync_seen+=1
     if G.offline:return await r.abort()
     await G.sync.wait()
    elif G.offline and p.path.startswith('/api/'):return await r.abort()
    res=await r.fetch(url=s.fix+p.path+('?'+p.query if p.query else ''));return await r.fulfill(response=res)
   # the Telegram Mini App page: the repository's own index.html and files; the game server through the fixture
   if u.startswith(API):
    cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}
    if r.request.method=='OPTIONS':return await r.fulfill(status=204,headers=cors)
    if G.offline:return await r.abort()
    if p.path=='/api/sync':
     G.sync_seen+=1;await G.sync.wait()
    res=await s.ctx.request.post(s.fix+p.path,data=r.request.post_data,headers={'Content-Type':'application/json'}) if r.request.method=='POST' else await s.ctx.request.get(s.fix+p.path)
    return await r.fulfill(status=res.status,body=await res.body(),content_type='application/json',headers=cors)
   if u.startswith(TG):
    f=(ROOT/p.path.lstrip('/')).resolve()
    if ROOT in f.parents and f.is_file():return await r.fulfill(body=f.read_bytes(),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
    return await r.fulfill(status=404,body='')
   if 'telegram.org' in u:return await r.fulfill(body='',content_type='application/javascript')
   return await r.abort()
  except Exception:
   try:await r.abort()
   except Exception:pass
 # ---- steps ----
 async def load(s,ready=True):
  await s.pg.goto(WEB+'/web/play.html' if s.platform=='web' else TG+'/index.html')
  if ready:
   await s.pg.wait_for_function('typeof save!=="undefined"&&!!save&&typeof Conquest!=="undefined"&&typeof uiTab!=="undefined"',timeout=60000)
 async def state(s):return await s.pg.evaluate('({cur:__tank.cur,frames:__tank.frames})')
 async def until(s,surface,value,timeout=None,what=''):
  # a wait state is there at once or never; a tank may need the world to load first. A miss is recorded and the journey goes on
  timeout=timeout or (8000 if value=='wait' else 90000)
  try:await s.pg.wait_for_function('([k,v])=>__tank.cur[k]===v',arg=[surface,value],timeout=timeout);return True
  except Exception:
   cur=await s.pg.evaluate('({cur:__tank.cur,seen:__tank.seen[arguments[0]]||null})',surface) if False else await s.pg.evaluate('k=>({now:__tank.cur[k]===undefined?null:__tank.cur[k],seen:__tank.seen[k]||null})',surface)
   s.fails.append(f'{s.label} {what}: {surface} never became {value} within {timeout//1000}s (now {json.dumps(cur["now"])}, seen {json.dumps(cur["seen"])})');return False
 async def until_any(s,surface,timeout=60000,what=''):
  try:await s.pg.wait_for_function('k=>k in __tank.cur',arg=surface,timeout=timeout);return True
  except Exception:
   cur=await s.pg.evaluate('({cur:__tank.cur,tab:typeof uiTab!=="undefined"?uiTab:null})');s.fails.append(f'{s.label} {what}: surface {surface} never drew ({json.dumps(cur)})');return False
 async def shot(s,name):
  try:await s.pg.screenshot(path=str(OUT/f'{s.label}-{name}.png'))
  except Exception:pass
 async def tab(s,t):
  await s.pg.evaluate('t=>{closeAll();setTab(t);if(typeof webUpdateMachine==="function")webUpdateMachine();}',t);await s.pg.wait_for_timeout(250)
 def home_surfaces(s):
  # the website on a computer shows the showroom beside every screen; on a phone it sits in the garage. Telegram: the hero picture
  return (['showroom:home'] if s.platform=='web' and not s.phone else ['hero'] if s.platform=='tg' else [])+['card:m_legacy']
 def garage_surface(s):return 'showroom:garage'
 async def open_hub(s):
  await s.pg.locator('[data-act="conquest"]:visible').first.click();await s.pg.wait_for_function('!!ConquestHub.state',timeout=30000)
 async def enter_world(s):
  await s.pg.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await s.pg.wait_for_function('!!Conquest.view',timeout=90000)
  try:await s.pg.wait_for_selector('.cq-radio-skip',timeout=1500);await s.pg.locator('.cq-radio-skip').click()
  except Exception:pass
 async def world_ready(s):
  await s.pg.wait_for_function('Conquest.view?.authority?.connected',timeout=120000)
  try:await s.pg.wait_for_function('Conquest.view.pending<=2',timeout=150000)
  except Exception:pass
 async def enter_town(s):
  b=s.pg.locator('#cq-base-access');await b.wait_for(state='visible',timeout=60000);await b.click()
  await s.pg.wait_for_selector('.cq-plot-tabs',timeout=90000);await s.pg.evaluate('ConquestPlotView.state.view==="drive"||ConquestPlotView.setView("drive")')
  await s.pg.wait_for_function('ConquestPlotView.state?.view==="drive"&&!!ConquestPlotView.state.drive',timeout=60000)
 async def collect(s,name,expect):
  """close a scenario: everything each surface ever showed must be 'wait' or its expected tank"""
  d=await s.pg.evaluate('({seen:__tank.seen,log:__tank.log.slice(0,400),bad:__tank.bad,unlabelled:__tank.unlabelled||{},frames:__tank.frames})')
  s.report[name]={'seen':d['seen'],'frames':d['frames'],'log':d['log'][:60]}
  for surf,vals in d['seen'].items():
   want=expect(surf) if callable(expect) else expect
   wrong={v:n for v,n in vals.items() if v!='wait' and v!=want}
   if wrong:
    first=next((e for e in d['log'] if e['s']==surf and e['v'] in wrong),None)
    s.fails.append(f'{s.label} [{name}] {surf}: showed {json.dumps(wrong)} (frames sampled per value); allowed only "wait" and {want}'+(f'; first at {first["t"]} ms' if first else ''))
  for m in d['bad']:s.fails.append(f'{s.label} [{name}] {m}')
  if d['unlabelled']:s.fails.append(f'{s.label} [{name}] a tank was drawn with no tank label (a stand-in, or a surface the rule does not cover yet): {sorted(d["unlabelled"])}')
  return d
 def need(s,name,d,surface,*values):
  for v in values:
   if not d['seen'].get(surface,{}).get(v):s.fails.append(f'{s.label} [{name}] {surface} never showed {v} (saw {json.dumps(d["seen"].get(surface,{}))})')

 # ---- scenarios ----
 async def fresh(s):
  """a device that never held this account: its own copy is the stock tank, the server says A"""
  G=s.gate;G.sync.clear();G.glb.clear()   # hold both first, so the device's own (stock) copy has every chance to be drawn
  if s.platform=='web':G.sync.set()   # the website asks the server before the game starts: holding it only holds the page
  await s.load();await s.pg.wait_for_timeout(2500)
  for k in s.home_surfaces():await s.until_any(k,what='fresh')
  await s.shot('fresh-home-wait');G.sync.set();await s.pg.wait_for_timeout(1200);G.glb.set()
  for k in s.home_surfaces():await s.until(k,tank(A),what='fresh')
  await s.pg.wait_for_timeout(600);await s.shot('fresh-home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(A),what='fresh garage');await s.pg.wait_for_timeout(600);await s.shot('fresh-garage')
  d=await s.collect('fresh',lambda k:tank(SPARE) if k=='card:m_spare' else tank(A))
  for k in s.home_surfaces():s.need('fresh',d,k,'wait',tank(A))
  s.need('fresh',d,s.garage_surface(),tank(A))
 async def changed(s):
  """the device copy says A, the server says B; the server's answer and the model files are held while every surface is visited"""
  r=await s.post('/__other-device',{'id':s.uid,'to':B});assert r['ok'],r
  G=s.gate;G.glb.clear();G.glb_seen.clear()
  if s.platform=='tg':G.sync.clear()
  await s.load();await s.pg.wait_for_timeout(3000)
  for k in s.home_surfaces():await s.until(k,'wait',what='changed: home holds its wait state')
  await s.shot('wait-home')
  if s.platform=='tg':
   assert await s.pg.evaluate('myLoadout().c.c')=='titan','the device copy should still be A while the server is silent'
   G.sync.set();await s.pg.wait_for_function('myLoadout().c.c==="scout"',timeout=30000);await s.pg.wait_for_timeout(800)
  await s.tab('garage');await s.until(s.garage_surface(),'wait',what='changed: garage waits for the model');await s.pg.wait_for_timeout(700);await s.shot('wait-garage')
  await s.tab('play');await s.open_hub();await s.until('hub','wait',timeout=60000,what='changed: hub waits');await s.pg.wait_for_timeout(1500);await s.shot('wait-hub')
  await s.post('/__conquest',{'id':s.uid,'cc':3})
  await s.enter_world();await s.world_ready();await s.until('world','wait',what='changed: world waits');await s.pg.wait_for_timeout(1500);await s.shot('wait-world')
  await s.enter_town();await s.until('town','wait',what='changed: town waits');await s.pg.wait_for_timeout(1500);await s.shot('wait-town')
  G.glb.set()   # the files land while the pilot is standing in the town
  await s.until('town',tank(B),what='changed: the real tank arrives in the town');await s.pg.wait_for_timeout(1500);await s.shot('town')
  await s.pg.locator('.cq-plot-leave').click();await s.until('world',tank(B),what='changed: world');await s.pg.wait_for_timeout(1500);await s.shot('world')
  await s.pg.locator('.cq-top button').first.click();await s.until('hub',tank(B),timeout=60000,what='changed: hub');await s.pg.wait_for_timeout(1500);await s.shot('hub')
  await s.pg.get_by_role('button',name='← RETURN TO ARCADE').click();await s.pg.wait_for_function('!Conquest.active')
  for k in s.home_surfaces():await s.until(k,tank(B),what='changed: home')
  await s.pg.wait_for_timeout(500);await s.shot('home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(B),what='changed: garage');await s.pg.wait_for_timeout(700);await s.shot('garage')
  d=await s.collect('changed',lambda k:tank(SPARE) if k=='card:m_spare' else tank(B))
  for k in s.home_surfaces()+[s.garage_surface(),'hub','world','town']:s.need('changed',d,k,'wait',tank(B))
 async def failed(s):
  """the chassis file of B cannot be downloaded: the code-built version of the same chassis and weapon, on every surface"""
  G=s.gate;G.fail=(ids(B)[0],);G.glb.set();G.sync.set()
  await s.load()
  for k in s.home_surfaces():await s.until(k,tank(B,'kit'),what='failed: home')
  await s.pg.wait_for_timeout(500);await s.shot('failed-home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(B,'kit'),what='failed: garage');await s.shot('failed-garage')
  await s.tab('play');await s.open_hub();await s.until('hub',tank(B,'kit'),timeout=60000,what='failed: hub');await s.pg.wait_for_timeout(800);await s.shot('failed-hub')
  if not QUICK:
   await s.enter_world();await s.world_ready();await s.until('world',tank(B,'kit'),what='failed: world');await s.pg.wait_for_timeout(1200);await s.shot('failed-world')
   await s.enter_town();await s.until('town',tank(B,'kit'),what='failed: town');await s.pg.wait_for_timeout(1200);await s.shot('failed-town')
  d=await s.collect('failed',lambda k:tank(SPARE) if k=='card:m_spare' else tank(B,'kit'))
  for k in s.home_surfaces()+[s.garage_surface(),'hub']+([] if QUICK else ['world','town']):s.need('failed',d,k,tank(B,'kit'))
  G.fail=()
 async def offline(s):
  """the server cannot be reached"""
  G=s.gate;r=await s.post('/__other-device',{'id':s.uid,'to':C});assert r['ok'],r   # the server now says C, and nobody can ask it
  G.offline=True
  if s.platform=='web':
   # the website cannot start without the server: its page says so and draws no tank at all
   await s.load(ready=False);await s.pg.wait_for_function('document.querySelector("#web-loading h1")?.textContent==="CONNECTION PAUSED"',timeout=30000);await s.pg.wait_for_timeout(800)
   d=await s.collect('offline',tank(B));assert not d['seen'],f'{s.label}: the website drew a tank with no server: {d["seen"]}';await s.shot('offline');G.offline=False;return
  want=B
  if not s.phone:
   # the Telegram cloud holds a newer copy than this device (saved by another phone): the newest copy on hand is the cloud's
   await s.pg.evaluate('''spec=>{const c=JSON.parse(localStorage.getItem(SAVE_KEY));c.lab.machines[c.lab.active].spec=spec;c._ts=Date.now()+60000;const str=JSON.stringify(c),n=Math.ceil(str.length/3800),o={wm_n:String(n)};for(let i=0;i<n;i++)o['wm_s'+i]=str.slice(i*3800,(i+1)*3800);localStorage.setItem('__tgcloud',JSON.stringify(o));}''',{'w':{'a':A['w'][0],'t':A['w'][1],'s':False},'c':{'c':A['c'][0],'t':A['c'][1],'s':False},'cores':['dmg','rof','arm'],'paint':'stock','mods':{'hull':'stock','mobility':'stock','mount':'stock'},'looks':{},'catalog':2})
   await s.ctx.add_init_script('window.__cloudNewer=1;');want=A
  await s.load()
  for k in s.home_surfaces():await s.until(k,tank(want),what='offline: home shows the newest copy on hand')
  await s.pg.wait_for_timeout(500);await s.shot('offline-home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(want),what='offline: garage')
  await s.tab('play');await s.open_hub();await s.until('hub',tank(want),timeout=60000,what='offline: hub');await s.pg.wait_for_timeout(600);await s.shot('offline-hub')
  d=await s.collect('offline',lambda k:tank(SPARE) if k=='card:m_spare' else tank(want))
  for k in s.home_surfaces()+[s.garage_surface(),'hub']:s.need('offline',d,k,tank(want))
  G.offline=False
 async def quality(s,mode):
  """LOW quality / the 2D fallback: the same rule (LOW still draws the owner's models; 2D draws the 2D picture of the same tank)"""
  # the server is back and says C; the device still holds what it showed offline
  G=s.gate;G.glb.set();G.sync.set()
  await s.load();await s.pg.wait_for_function('myLoadout().c.c==="vanguard"',timeout=30000)
  await s.pg.evaluate('m=>setGfx(m)',mode);await s.pg.wait_for_timeout(600)
  r=await s.post('/__other-device',{'id':s.uid,'to':B});assert r['ok'],r   # ... and changes once more behind this device's back
  if s.platform=='tg':G.sync.clear()
  G.glb.clear()
  await s.load();await s.pg.wait_for_timeout(2500)
  assert await s.pg.evaluate('gfxMode()')==mode
  kind='2d' if mode=='2d' else 'meshy';home=[k for k in s.home_surfaces() if not (mode=='2d' and k.startswith('showroom'))]+(['showroom:home'] if s.platform=='web' and not s.phone and mode=='2d' else [])
  home=list(dict.fromkeys(home))
  if s.platform=='tg' or mode!='2d':
   for k in home:await s.until(k,'wait',what=f'{mode}: home waits')
   await s.shot(f'{mode}-wait-home')
  G.sync.set();await s.pg.wait_for_timeout(800);G.glb.set()
  for k in home:await s.until(k,tank(B,kind),what=f'{mode}: home')
  await s.pg.wait_for_timeout(500);await s.shot(f'{mode}-home')
  gk='showroom:garage' if s.platform=='web' else 'garage-picture'
  await s.tab('garage');await s.until(gk,tank(B,kind),what=f'{mode}: garage');await s.pg.wait_for_timeout(500);await s.shot(f'{mode}-garage')
  if mode!='2d':
   await s.tab('play');await s.open_hub();await s.until('hub',tank(B,kind),timeout=60000,what=f'{mode}: hub');await s.pg.wait_for_timeout(600);await s.shot(f'{mode}-hub')
  d=await s.collect(mode,lambda k:tank(SPARE,kind) if k=='card:m_spare' else tank(B,kind))
  for k in home+[gk]:s.need(mode,d,k,tank(B,kind))
  await s.pg.evaluate('setGfx("auto")');await s.pg.wait_for_timeout(400)
 async def go(s):
  await s.start()
  steps=[('fresh',s.fresh),('changed',s.changed),('failed',s.failed),('offline',s.offline)]
  if s.label in ('tg-phone','web-desktop'):steps+=[('low',lambda:s.quality('low')),('2d',lambda:s.quality('2d'))]
  for name,fn in steps:
   t0=time.time()
   try:await fn()
   except AssertionError as e:s.fails.append(str(e)[:1500])
   except Exception as e:s.fails.append(f'{s.label} [{name}] {type(e).__name__}: {str(e)[:900]}')
   print(f'  {s.label} {name}: {time.time()-t0:.0f}s, {len(s.fails)} failure(s) so far',flush=True)
  if s.errors:s.fails.append(f'{s.label} page errors: {s.errors[:4]}')
  for pg in s.ctx.pages:
   try:await pg.unroute_all(behavior='ignoreErrors')
   except Exception:pass
  await s.ctx.close()

async def main():
 subprocess.run(['node','worker/build-web.mjs'],check=True,cwd=ROOT,stdout=subprocess.DEVNULL)
 sk=socket.socket();sk.bind(('127.0.0.1',0));port=sk.getsockname()[1];sk.close()
 srv=subprocess.Popen(['node','dev/tests/login-tank-server.mjs'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,env={**os.environ,'LUNAR_FIXTURE_PORT':str(port)})
 try:
  for _ in range(400):
   line=srv.stdout.readline()
   if 'fixture ready' in line:break
   if not line and srv.poll() is not None:raise RuntimeError('the fixture server did not start')
  fix='http://127.0.0.1:'+str(port);runs=[]
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   combos=[(p,z) for p in ('web','tg') for z in ('phone','desktop') if not ONLY or p+'-'+z in ONLY]
   for p,z in combos:
    run=Run(browser,fix,p,z);runs.append(run);print(run.label,flush=True);await run.go()
   await browser.close()
  fails=[f for r in runs for f in r.fails]
  json.dump({r.label:r.report for r in runs},open(OUT/'login-tank.json','w'),indent=1)
  for r in runs:
   for name,rep in r.report.items():print(f'{r.label} [{name}] frames {rep["frames"]}: '+'; '.join(f'{k}: {sorted(v)}' for k,v in sorted(rep['seen'].items())))
  if fails:
   print('\nFAIL login tank: '+str(len(fails))+' finding(s)')
   for f in fails:print(' - '+f)
   sys.exit(1)
  print('PASS login tank: on the website and in the Telegram Mini App, phone and computer, every frame of the home screen, the garage, the Conquest hub, the world and the town showed only the wait state or the pilot\'s current tank (fresh device, loadout changed on another device with held server and held model files, failed model download, server unreachable, LOW and 2D)')
 finally:srv.kill()
asyncio.run(main())
