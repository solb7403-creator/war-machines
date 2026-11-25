"""Your real tank at login, and in the town view (Session 5E-2d2 section 5; owner, Nov 11 and Nov 20).

The rule: wherever the game draws the pilot's tank at or after login (the home screen, the garage, the Conquest hub, the Conquest
world, the town view), no frame may show a chassis, weapon or stand-in that is not the pilot's current tank. Until the server's
loadout is in and its Meshy model has landed the surface shows its wait state (no tank at all: never the code-built tank first
and the real one a moment later); a model download that FAILS gives the code-built version of the SAME chassis and weapon; if
the server cannot be reached, the newest copy on hand.

How it is checked: not by comparing pictures. A script installed before any game script wraps requestAnimationFrame and, after
every frame callback, reads what tank each surface has in its scene (the Meshy model ids of the meshes under the tank's group,
or the label the game puts on a 2D picture) and records every change. The test then asserts that the set of values each surface
ever held is only "wait" and the expected tank. Real Chromium, the real Worker on a disposable database
(dev/tests/login-tank-server.mjs), the website build (web/play.html) AND the Telegram Mini App page (index.html), a phone
(390x844, touch) and a computer (1366x768, mouse). Scenarios (each prepares its own starting point, so any subset runs alone):
  fresh    a device that has never held this account (its own copy is the stock tank; the server says A). On the website the
           pilot's two model files must be asked for before the game's own scripts have finished loading
  changed  the loadout was changed on another device (the device copy says A, the server says B), the server's answer is held
           (Telegram) and the model files are held (a slow download): home, garage, hub, world and town are each visited
           while they wait, then the files are released while the pilot stands in the town. In Telegram the server must have
           been asked before the Telegram cloud copy came back
  failed   the chassis model cannot be downloaded: the code-built version of the same chassis and weapon, everywhere
  offline  the server cannot be reached (Telegram: the newest copy on hand, device or Telegram cloud; website: no game, no tank)
  late     Telegram: the server stays silent past the wait limit: the newest copy on hand shows, never before the limit, and
           the server's tank replaces it when the answer finally lands
  low, 2d  the 'changed' journey again on LOW quality and on the 2D setting (LOW draws the owner's models; 2D draws the 2D
           picture of the same tank in the menus, and Conquest draws no tank model at all there)
Screenshots of the wait state and the final tank, per surface: docs/conquest/session5e2d2/login/.
Run from the repository root: python3 dev/tests/login-tank-browser.py [--only web-phone,tg-desktop] [--scenario changed,low] [--quick]
(--quick: no world / town in 'failed', LOW and 2D on two targets only.) Software GL here: frame counts are low, every frame
that is drawn is sampled."""
import asyncio,json,pathlib,shutil,subprocess,sys,socket,os,mimetypes,time
from urllib.parse import urlparse
from playwright.async_api import async_playwright
# LOGIN_TANK_ROOT / LOGIN_TANK_OUT: run the same test against another checkout (the code before the fix) and keep its pictures apart
ROOT=pathlib.Path(os.environ.get('LOGIN_TANK_ROOT') or pathlib.Path(__file__).resolve().parents[2]).resolve();OUT=pathlib.Path(os.environ.get('LOGIN_TANK_OUT') or ROOT/'docs/conquest/session5e2d2/login');OUT.mkdir(parents=True,exist_ok=True)
WEB='https://lunar.test';TG='https://tg.lunar.test';API='https://lunar-api.solb7403.workers.dev'
A={'w':['siege',2],'c':['titan',2]};B={'w':['twin',1],'c':['scout',1]};C={'w':['pulse',2],'c':['vanguard',2]};SPARE={'w':['pulse',1],'c':['vanguard',1]};STOCK={'w':['pulse',0],'c':['vanguard',0]}
ids=lambda g:('chassis-%s-%d'%tuple(g['c']),'weapon-%s-%d'%tuple(g['w']))
tank=lambda g,kind='meshy':'+'.join(ids(g))+'+'+kind
ONLY=None;SCEN=None;QUICK='--quick' in sys.argv
for i,a in enumerate(sys.argv):
 if a=='--only':ONLY=set(sys.argv[i+1].split(','))
 if a=='--scenario':SCEN=set(sys.argv[i+1].split(','))
same=lambda g:'myLoadout().c.c===%s&&myLoadout().c.t===%d&&myLoadout().w.a===%s&&myLoadout().w.t===%d'%(json.dumps(g['c'][0]),g['c'][1],json.dumps(g['w'][0]),g['w'][1])

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
     if(hero.dataset.tank){out[name]=hero.dataset.tank;const AR=g('AR'),k=hero.dataset.tank.split('+')[2];
      if((k==='meshy'||k==='kit')&&AR&&AR.hero){const real=look(AR.hero.T.g,g('myLoadout')(),'hero-scene');delete (T.unlabelled||{})['hero-scene'];if(real!==hero.dataset.tank){const m='hero: the label '+hero.dataset.tank+' does not match the picture\'s scene '+real;if(!T.bad.includes(m))T.bad.push(m);}}}
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
 // when the launch sync was asked for (page clock): the Telegram cloud mock notes when it answered
 const F=window.fetch;window.fetch=function(u,o){try{if(String(u&&u.url||u).includes('/api/sync')&&T.syncAt===undefined)T.syncAt=performance.now();}catch(e){}return F.apply(this,arguments);};
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
 CloudStorage:{setItem(k,v,cb){const o=rd();o[k]=v;localStorage.setItem(K,JSON.stringify(o));cb&&cb(null,true)},getItem(k,cb){later(()=>{if(window.__tank&&__tank.cloudAt===undefined)__tank.cloudAt=performance.now();cb(null,rd()[k]||'')})},getItems(ks,cb){later(()=>{const o=rd(),r={};ks.forEach(k=>r[k]=o[k]||'');cb(null,r)})}}}};})();'''%(cloud_ms,json.dumps(init_data),uid,uid)

class Gate:
 """What the test does to the pilot's model files and to the server's answers."""
 def __init__(s):s.glb=asyncio.Event();s.glb.set();s.sync=asyncio.Event();s.sync.set();s.fail=();s.offline=False;s.glb_seen=[];s.sync_seen=0;s.order=[]

class Run:
 def __init__(s,browser,fix,platform,size):
  s.b=browser;s.fix=fix;s.platform=platform;s.size=size;s.label=platform+'-'+size;s.phone=size=='phone';s.uid=91100000+int(time.time()*1000)%800000*10+{'web-phone':1,'web-desktop':2,'tg-phone':3,'tg-desktop':4}[s.label]
  s.gate=Gate();s.errors=[];s.report={};s.fails=[];s.srv=A;s.loads=0
 async def post(s,path,data):
  r=await s.ctx.request.post(s.fix+path,data=data);return await r.json()
 async def start(s):
  vp={'width':390,'height':844} if s.phone else {'width':1366,'height':768}
  s.ctx=await s.b.new_context(viewport=vp,has_touch=s.phone,is_mobile=s.phone,device_scale_factor=1,bypass_csp=True)
  await s.ctx.add_init_script(SAMPLER)
  await s.ctx.add_init_script('window.LUNAR_NO_CS=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_MESHY_WAIT_MS=600000;try{window.LUNAR_LOADOUT_WAIT_MS=Number(localStorage.getItem("__waitms"))||600000;}catch(e){}try{localStorage.setItem("lunar-conquest-onboarding-v1","1");localStorage.setItem("lunar-cq-town-tour-v1","1");}catch(e){}')
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
    G.glb_seen.append(name);G.order.append(name)
    if any(name.startswith(f) for f in G.fail):return await r.abort()
    await G.glb.wait()
   if name=='main.js':G.order.append(name)
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
  s.loads+=1;s.gate.order.clear()
  await s.pg.goto(WEB+'/web/play.html' if s.platform=='web' else TG+'/index.html')
  if ready:
   await s.pg.wait_for_function('typeof save!=="undefined"&&!!save&&typeof Conquest!=="undefined"&&typeof uiTab!=="undefined"',timeout=90000)
 async def server(s,g):
  """the same pilot saves tank g into the active bay on another device"""
  if s.srv==g:return
  r=await s.post('/__other-device',{'id':s.uid,'to':g});assert r['ok'],r;s.srv=g
 async def prime(s,g,mode='high'):
  """the starting point of a scenario: server and device agree on tank g, the graphics setting is `mode`, nothing is held"""
  G=s.gate;G.glb.set();G.sync.set();G.fail=();G.offline=False;await s.server(g)
  if s.loads:await s.pg.evaluate('localStorage.removeItem("__waitms")')
  await s.load();await s.pg.wait_for_function(same(g),timeout=60000)
  want={'high':'auto'}.get(mode,mode)
  if await s.pg.evaluate('gfxMode()')!=want:await s.pg.evaluate('m=>setGfx(m)',want)
  await s.pg.wait_for_timeout(2200 if s.platform=='tg' else 500)   # Telegram: the cloud copy is written 1.5 s after a change
 async def until(s,surface,value,timeout=None,what=''):
  # a wait state is there at once or never; a tank may need the world to load first. A miss is recorded and the journey goes on
  timeout=timeout or (8000 if value=='wait' else 90000)
  try:await s.pg.wait_for_function('([k,v])=>__tank.cur[k]===v',arg=[surface,value],timeout=timeout);return True
  except Exception:
   cur=await s.pg.evaluate('k=>({now:__tank.cur[k]===undefined?null:__tank.cur[k],seen:__tank.seen[k]||null})',surface)
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
 def garage_surface(s,mode='high'):
  # Telegram's garage is live 3D on HIGH only; on LOW and 2D it is the picture. The website's showroom draws its own 2D picture
  return 'showroom:garage' if s.platform=='web' or mode=='high' else 'garage-picture'
 async def open_hub(s):
  await s.pg.locator('[data-act="conquest"]:visible').first.click();await s.pg.wait_for_function('!!ConquestHub.state',timeout=30000)
 async def enter_world(s):
  await s.pg.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await s.pg.wait_for_function('!!Conquest.view',timeout=120000)
  try:await s.pg.wait_for_selector('.cq-radio-skip',timeout=1500);await s.pg.locator('.cq-radio-skip').click()
  except Exception:pass
 async def world_ready(s):
  await s.pg.wait_for_function('Conquest.view?.authority?.connected',timeout=120000)
  try:await s.pg.wait_for_function('Conquest.view.pending<=2',timeout=150000)
  except Exception:pass
 async def enter_town(s,drive=True):
  b=s.pg.locator('#cq-base-access');await b.wait_for(state='visible',timeout=60000);await b.click()
  await s.pg.wait_for_selector('.cq-plot-tabs',timeout=90000)
  if drive:
   await s.pg.evaluate('ConquestPlotView.state.view==="drive"||ConquestPlotView.setView("drive")')
   await s.pg.wait_for_function('ConquestPlotView.state?.view==="drive"&&!!ConquestPlotView.state.drive',timeout=60000)
 async def budget(s,name):
  """shader programs of the Conquest renderers right now (the hub: 12, the world and the town: 16)"""
  d=await s.pg.evaluate('''(()=>{const v=Conquest.view,X=ConquestPlotView.state,T=__tank.cur,off=[];
   if(v&&v.vehicleWait&&v.vehicleWait.visible!==(v.vehicleShow==='wait'))off.push('world');if(X&&X.tankWait&&'town' in T&&X.tankWait.visible!==(T.town==='wait'))off.push('town');
   return {hub:ConquestHub.state?.info?.programs??null,world:v&&!v.renderer.isConquestCanvas?(v.renderer.info.programs||[]).length:null,off};})()''')
  if d.pop('off'):s.fails.append(f'{s.label} [{name}] a wait marker is on screen beside a tank, or missing while the surface waits')
  s.report.setdefault('programs',{})[name]=d
  if d['hub'] is not None and d['hub']>12:s.fails.append(f'{s.label} [{name}] the hub draws {d["hub"]} shader programs (budget 12)')
  if d['world'] is not None and d['world']>16:s.fails.append(f'{s.label} [{name}] the Conquest renderer holds {d["world"]} shader programs (budget 16)')
 async def collect(s,name,expect):
  """close a scenario: everything each surface ever showed must be 'wait' or its expected tank (expect: one value, or a list of allowed ones)"""
  d=await s.pg.evaluate('({seen:__tank.seen,log:__tank.log.slice(0,400),bad:__tank.bad,unlabelled:__tank.unlabelled||{},frames:__tank.frames,syncAt:__tank.syncAt??null,cloudAt:__tank.cloudAt??null})')
  s.report[name]={'seen':d['seen'],'frames':d['frames'],'log':d['log'][:80]}
  for surf,vals in d['seen'].items():
   want=expect(surf) if callable(expect) else expect;want=want if isinstance(want,list) else [want]
   wrong={v:n for v,n in vals.items() if v!='wait' and v not in want}
   if wrong:
    first=next((e for e in d['log'] if e['s']==surf and e['v'] in wrong),None)
    s.fails.append(f'{s.label} [{name}] {surf}: showed {json.dumps(wrong)} (frames sampled per value); allowed only "wait" and {" / ".join(want)}'+(f'; first at {first["t"]} ms' if first else ''))
  for m in d['bad']:s.fails.append(f'{s.label} [{name}] {m}')
  if d['unlabelled']:s.fails.append(f'{s.label} [{name}] a tank was drawn with no tank label (a stand-in, or a surface the rule does not cover yet): {sorted(d["unlabelled"])}')
  return d
 def need(s,name,d,surface,*values):
  for v in values:
   if not d['seen'].get(surface,{}).get(v):s.fails.append(f'{s.label} [{name}] {surface} never showed {v} (saw {json.dumps(d["seen"].get(surface,{}))})')
 def early(s,name,g):
  """the website: the pilot's own model files are asked for before the game's last script (js/main.js) is"""
  o=s.gate.order;mine=[n for n in o if any(n.startswith(x+'-light') for x in ids(g))]
  if 'main.js' not in o or len(mine)<2 or max(o.index(n) for n in set(mine))>o.index('main.js'):s.fails.append(f'{s.label} [{name}] the pilot\'s model files were not asked for before the game started (request order: {o[:8]})')

 # ---- scenarios ----
 async def fresh(s):
  """a device that never held this account: its own copy is the stock tank, the server says A"""
  if s.loads:return print(f'  {s.label} fresh: skipped (this browser profile already holds the account)',flush=True)
  G=s.gate;G.sync.clear();G.glb.clear()   # hold both first, so the device's own (stock) copy has every chance to be drawn
  if s.platform=='web':G.sync.set()   # the website asks the server before the game starts: holding it only holds the page
  await s.load();await s.pg.wait_for_timeout(2500)
  for k in s.home_surfaces():
   if s.platform=='web' or not k.startswith('card:'):await s.until_any(k,what='fresh')   # Telegram: a device with no copy has no bays to list until the server answers
  if s.platform=='web':s.early('fresh',A)
  await s.shot('fresh-home-wait');G.sync.set();await s.pg.wait_for_timeout(1200);G.glb.set()
  for k in s.home_surfaces():await s.until(k,tank(A),what='fresh')
  await s.pg.wait_for_timeout(600);await s.shot('fresh-home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(A),what='fresh garage');await s.pg.wait_for_timeout(600);await s.shot('fresh-garage')
  d=await s.collect('fresh',lambda k:tank(SPARE) if k=='card:m_spare' else tank(A))
  for k in s.home_surfaces():s.need('fresh',d,k,'wait',tank(A))
  s.need('fresh',d,s.garage_surface(),tank(A))
 async def journey(s,name,mode,frm,to):
  """the device copy says `frm`, the server says `to`; the server's answer (Telegram) and the model files are held while every surface is visited"""
  await s.prime(frm,mode);await s.server(to)
  G=s.gate;G.glb.clear();G.glb_seen.clear();flat=mode=='2d';kind='2d' if flat else 'meshy';home=s.home_surfaces();gk=s.garage_surface(mode)
  if s.platform=='tg':G.sync.clear()
  await s.load();await s.pg.wait_for_timeout(3000)
  assert await s.pg.evaluate('gfxMode()')=={'high':'auto'}.get(mode,mode)
  if s.platform=='tg' or not flat:   # the website on the 2D setting has nothing to wait for: the server's loadout came with the page
   for k in home:await s.until(k,'wait',what=f'{name}: home holds its wait state')
  await s.shot(f'{name}-wait-home')
  if s.platform=='web' and not flat:s.early(name,to)
  if s.platform=='tg':
   assert await s.pg.evaluate(same(frm)),'the device copy should still be the old tank while the server is silent'
   said=await s.pg.evaluate('([c,ct,a,at])=>{const txt=[...document.querySelectorAll(".hero .loadline,.battle-roster-card")].map(e=>e.textContent).join(" | ");return [CNAMES[c][ct],WNAMES[a][at]].filter(n=>txt.includes(n)).map(n=>n+" in: "+txt.slice(0,200));}',[frm['c'][0],frm['c'][1],frm['w'][0],frm['w'][1]])
   if said:s.fails.append(f'{s.label} [{name}] the home screen names the device copy\'s chassis or weapon before the server has answered: {said}')
   G.sync.set();await s.pg.wait_for_function(same(to),timeout=30000);await s.pg.wait_for_timeout(800)
   t=await s.pg.evaluate('({s:__tank.syncAt??null,c:__tank.cloudAt??null})')
   if t['s'] is None or t['c'] is None or t['s']>t['c']:s.fails.append(f'{s.label} [{name}] the server was not asked for the loadout before the Telegram cloud copy came back (sync asked at {t["s"]} ms, cloud answered at {t["c"]} ms)')
  await s.tab('garage')
  if not flat:await s.until(gk,'wait',what=f'{name}: garage waits for the model')
  await s.pg.wait_for_timeout(700);await s.shot(f'{name}-wait-garage')
  await s.tab('play');await s.open_hub()
  if not flat:await s.until('hub','wait',timeout=60000,what=f'{name}: hub waits')
  await s.pg.wait_for_timeout(1500);await s.shot(f'{name}-wait-hub');await s.budget(name+' hub, waiting')
  await s.post('/__conquest',{'id':s.uid,'cc':3})
  await s.enter_world();await s.world_ready()
  if not flat:await s.until('world','wait',what=f'{name}: world waits')
  await s.pg.wait_for_timeout(1500);await s.shot(f'{name}-wait-world')
  await s.enter_town(drive=not flat)
  if not flat:await s.until('town','wait',what=f'{name}: town waits')
  await s.pg.wait_for_timeout(1500);await s.shot(f'{name}-wait-town');await s.budget(name+' town, waiting')
  G.glb.set()   # the files land while the pilot is standing in the town
  if not flat:await s.until('town',tank(to),what=f'{name}: the real tank arrives in the town')
  await s.pg.wait_for_timeout(1500);await s.shot(f'{name}-town');await s.budget(name+' town')
  await s.pg.locator('.cq-plot-leave').click()
  if not flat:await s.until('world',tank(to),what=f'{name}: world')
  await s.pg.wait_for_timeout(1500);await s.shot(f'{name}-world');await s.budget(name+' world')
  await s.pg.locator('.cq-top button').first.click()
  if not flat:await s.until('hub',tank(to),timeout=60000,what=f'{name}: hub')
  await s.pg.wait_for_function('!!ConquestHub.state',timeout=30000);await s.pg.wait_for_timeout(1500);await s.shot(f'{name}-hub');await s.budget(name+' hub')
  await s.pg.get_by_role('button',name='← RETURN TO ARCADE').click();await s.pg.wait_for_function('!Conquest.active')
  for k in home:await s.until(k,tank(to,kind),what=f'{name}: home')
  await s.pg.wait_for_timeout(500);await s.shot(f'{name}-home')
  await s.tab('garage');await s.until(gk,tank(to,kind),what=f'{name}: garage');await s.pg.wait_for_timeout(700);await s.shot(f'{name}-garage')
  d=await s.collect(name,lambda k:tank(SPARE,kind) if k=='card:m_spare' else tank(to,kind))
  for k in home+[gk]:s.need(name,d,k,tank(to,kind),*(['wait'] if s.platform=='tg' or not flat else []))
  if flat:
   drawn=[k for k in ('hub','world','town') if d['seen'].get(k)]
   if drawn:s.fails.append(f'{s.label} [{name}] on the 2D setting Conquest draws no tank model, yet these surfaces held one: {drawn}')
  else:
   for k in ('hub','world','town'):s.need(name,d,k,'wait',tank(to))
 async def failed(s):
  """the chassis file of B cannot be downloaded: the code-built version of the same chassis and weapon, on every surface"""
  await s.prime(B);G=s.gate;G.fail=(ids(B)[0],)
  await s.load()
  for k in s.home_surfaces():await s.until(k,tank(B,'kit'),what='failed: home')
  await s.pg.wait_for_timeout(500);await s.shot('failed-home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(B,'kit'),what='failed: garage');await s.shot('failed-garage')
  await s.tab('play');await s.open_hub();await s.until('hub',tank(B,'kit'),timeout=60000,what='failed: hub');await s.pg.wait_for_timeout(800);await s.shot('failed-hub');await s.budget('failed hub')
  if not QUICK:
   await s.post('/__conquest',{'id':s.uid,'cc':3})
   await s.enter_world();await s.world_ready();await s.until('world',tank(B,'kit'),what='failed: world');await s.pg.wait_for_timeout(1200);await s.shot('failed-world');await s.budget('failed world')
   await s.enter_town();await s.until('town',tank(B,'kit'),what='failed: town');await s.pg.wait_for_timeout(1200);await s.shot('failed-town');await s.budget('failed town')
  d=await s.collect('failed',lambda k:tank(SPARE) if k=='card:m_spare' else tank(B,'kit'))
  for k in s.home_surfaces()+[s.garage_surface(),'hub']+([] if QUICK else ['world','town']):s.need('failed',d,k,tank(B,'kit'))
  G.fail=()
 async def offline(s):
  """the server cannot be reached"""
  await s.prime(B);G=s.gate;await s.server(C)   # the server now says C, and nobody can ask it
  want=B
  if s.platform=='tg' and not s.phone:
   # the Telegram cloud holds a newer copy than this device (saved by another phone): the newest copy on hand is the cloud's
   await s.pg.evaluate('''spec=>{const c=JSON.parse(localStorage.getItem(SAVE_KEY));c.lab.machines[c.lab.active].spec=spec;c._ts=Date.now()+60000;const str=JSON.stringify(c),n=Math.ceil(str.length/3800),o={wm_n:String(n)};for(let i=0;i<n;i++)o['wm_s'+i]=str.slice(i*3800,(i+1)*3800);localStorage.setItem('__tgcloud',JSON.stringify(o));}''',{'w':{'a':A['w'][0],'t':A['w'][1],'s':False},'c':{'c':A['c'][0],'t':A['c'][1],'s':False},'cores':['dmg','rof','arm'],'paint':'stock','mods':{'hull':'stock','mobility':'stock','mount':'stock'},'looks':{},'catalog':2})
   want=A
  G.offline=True
  if s.platform=='web':
   # the website cannot start without the server: its page says so and draws no tank at all
   await s.load(ready=False);await s.pg.wait_for_function('document.querySelector("#web-loading h1")?.textContent==="CONNECTION PAUSED"',timeout=30000);await s.pg.wait_for_timeout(800)
   d=await s.collect('offline',tank(B));assert not d['seen'],f'{s.label}: the website drew a tank with no server: {d["seen"]}';await s.shot('offline');G.offline=False;return
  await s.load()
  for k in s.home_surfaces():await s.until(k,tank(want),what='offline: home shows the newest copy on hand')
  await s.pg.wait_for_timeout(500);await s.shot('offline-home')
  await s.tab('garage');await s.until(s.garage_surface(),tank(want),what='offline: garage')
  await s.tab('play');await s.open_hub();await s.until('hub',tank(want),timeout=60000,what='offline: hub');await s.pg.wait_for_timeout(600);await s.shot('offline-hub')
  d=await s.collect('offline',lambda k:tank(SPARE) if k=='card:m_spare' else tank(want))
  for k in s.home_surfaces()+[s.garage_surface(),'hub']:s.need('offline',d,k,tank(want))
  G.offline=False
 async def late(s):
  """Telegram: the server stays silent past the wait limit (4 s here): the newest copy on hand shows then, not before, and the server's tank replaces it when the answer lands"""
  if s.platform!='tg':return
  await s.prime(C);await s.server(A);G=s.gate;G.sync.clear();LIMIT=4000
  await s.pg.evaluate('ms=>localStorage.setItem("__waitms",String(ms))',LIMIT)
  await s.load()
  for k in s.home_surfaces():await s.until(k,'wait',what='late: home waits for the server')
  for k in s.home_surfaces():await s.until(k,tank(C),timeout=30000,what='late: the newest copy on hand after the limit')
  await s.pg.wait_for_timeout(400);await s.shot('late-on-hand')
  G.sync.set()
  for k in s.home_surfaces():await s.until(k,tank(A),what='late: the server\'s tank when it answers')
  await s.pg.wait_for_timeout(400);await s.shot('late-home')
  d=await s.collect('late',lambda k:tank(SPARE) if k=='card:m_spare' else [tank(C),tank(A)])
  for k in s.home_surfaces():
   s.need('late',d,k,'wait',tank(C),tank(A))
   seq=[e['v'] for e in d['log'] if e['s']==k];first=next((e for e in d['log'] if e['s']==k and e['v']==tank(C)),None)
   if seq!=['wait',tank(C),'wait',tank(A)] and seq!=['wait',tank(C),tank(A)]:s.fails.append(f'{s.label} [late] {k} went {seq}; expected wait, the copy on hand, (wait for the new models,) the server\'s tank')
   if first and d['syncAt'] is not None and first['t']-d['syncAt']<LIMIT-250:s.fails.append(f'{s.label} [late] {k} showed the copy on hand {first["t"]-d["syncAt"]:.0f} ms after the server was asked, before the {LIMIT} ms limit')
  await s.pg.evaluate('localStorage.removeItem("__waitms")')
 async def go(s):
  await s.start()
  steps=[('fresh',s.fresh),('changed',lambda:s.journey('changed','high',A,B)),('failed',s.failed),('offline',s.offline),('late',s.late)]
  if not QUICK or s.label in ('tg-phone','web-desktop'):steps+=[('low',lambda:s.journey('low','low',A,B)),('2d',lambda:s.journey('2d','2d',B,C))]
  for name,fn in steps:
   if SCEN and name not in SCEN:continue
   t0=time.time()
   try:await fn()
   except AssertionError as e:s.fails.append(f'{s.label} [{name}] '+str(e)[:1500])
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
  full=not ONLY and not SCEN and not QUICK
  json.dump({r.label:r.report for r in runs},open(OUT/('login-tank.json' if full else 'login-tank-partial.json'),'w'),indent=1)
  for r in runs:
   for name,rep in r.report.items():
    if name=='programs':print(f'{r.label} shader programs: '+'; '.join(f'{k}: hub {v["hub"]}, world/town {v["world"]}' for k,v in rep.items()));continue
    print(f'{r.label} [{name}] frames {rep["frames"]}: '+'; '.join(f'{k}: {sorted(v)}' for k,v in sorted(rep['seen'].items())))
  if fails:
   print('\nFAIL login tank: '+str(len(fails))+' finding(s)')
   for f in fails:print(' - '+f)
   sys.exit(1)
  print('PASS login tank'+('' if full else ' (PARTIAL RUN: '+' '.join(sys.argv[1:])+')')+': on the website and in the Telegram Mini App, phone and computer, every frame of the home screen, the garage, the Conquest hub, the world and the town showed only the wait state or the pilot\'s current tank (fresh device, loadout changed on another device with held server and held model files, failed model download, server unreachable, server silent past the limit, LOW and 2D)')
 finally:srv.kill()
asyncio.run(main())
