"""Session 6 first hour, end to end in the shipped client (Chromium) against the real Worker reducer on a disposable local DB
(dev/tests/conquest-server.mjs: the real Worker, auth, CAS and reducer over a fake Firebase; files served from this repo).

1. JOURNEY 390x844 phone (touch), brand-new account (no fixture at all): the radio over gameplay at minute 0 with only the
   NEXT chip, HULL and HEAT on the HUD -> one tap on DEFEND starts the first defense (no briefing) -> won by following the red
   arrow (keyboard movement, the nearest attacker locked, FIRE held by a real CDP touch) -> the DESTROYED kill pop -> loot (a
   cache flyout / the after-action DROPS row) -> every later order is the one the NEXT chip's own rules give (js/conquest/
   guide.js coachStep / boardOrder): BANK at REFUGE SUPPLY -> SCAN -> GATHER the Starter Vein (35 Ferrite) -> BANK -> FABRICATE
   the FRONT plate -> field missions -> CLAIM YOUR TOWN at the Command Gate. Simulated minutes (the Worker's s.an.p: simulated
   play ms, 50 ms a command) at each first-hour moment; owner target: the town by 22 simulated minutes.
1b. ROUTE 390x844 (touch), deterministic repro: bank on the west side of the REFUGE terminal, tap SCAN as the coach says; the
   NEXT chip must lead to the Starter Vein, then name BANK THE FERRITE (placements: position, completed field missions, cargo,
   a fresh placement until the Worker's vein seed puts the Ridge Ferrite vein at fe-14).
2. SMOKE 390x700 / 320x568 (touch, real CDP swipes) and 1366x768 / 1920x1080 (no touch: keyboard, mouse, wheel), scenario
   placements: the HUD fits (nothing outside the viewport, no horizontal scroll), MORE opens and its last button is reachable,
   LOOT & TROPHY HALL's last button is reachable, REFUGE SUPPLY's primary action is reachable, a War Order (Bank 60 alloy, drawn
   by the Worker) completes by banking and is claimed from REFUGE SUPPLY's claim row, and the hub (back ‹) shows the WAR ORDERS card.
3. KEYS 1366x768 real keyboard: WASD for 2 s moves the tank (client and server); 1 uses a Repair Kit (server count drops).
Scenario placements in 2-3 only (position, cargo, consumables, hull, completed field missions, a claimed town). Software GL:
relative look and speed only, not a physical iPhone. Captures: docs/conquest/session6/journey-*.png; results: journey.json.
Usage: python3 dev/tests/conquest-session6-journey.py [--only journey,route,smoke,keys] [--sizes 390x700,...] [--out DIR] [--merge]
"""
import argparse,asyncio,json,math,pathlib,shutil,sys,time,traceback
from urllib.parse import urlparse
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2]
ARGS=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']
TERMINAL={'x':1174,'z':1168};GATE={'x':1080,'z':1160};SPAWN=[1162,1130]
TOWN_TARGET_MIN=22
def log(*a):print(time.strftime('%H:%M:%S'),*a,flush=True)
def listify(v):return v if isinstance(v,list) else [v[k] for k in sorted(v,key=lambda k:int(k))] if isinstance(v,dict) else []

# In-page helpers: read the shipped client's own state and rules (presentation reads + the lock a hull tap sets); every
# movement, ability and button press goes through real keyboard / touch / mouse input from Python.
HELPERS=r'''(()=>{if(window.__J)return 'ok';const J=window.__J={};
const V=()=>Conquest.view,D=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),q=s=>document.querySelector(s);
const shown=e=>!!e&&!e.hidden&&!!(e.offsetWidth||e.offsetHeight)&&getComputedStyle(e).visibility!=='hidden';J.shown=shown;
J.log={ticker:[],flyouts:[],cards:[]};
new MutationObserver(ms=>{const t=q('.cq-reward-ticker'),x=t&&t.textContent;if(x&&(J.log.ticker.at(-1)||{}).t!==x)J.log.ticker.push({t:x,at:Date.now()});
 for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1){if(n.classList.contains('cq-flyout'))J.log.flyouts.push({t:n.textContent,c:n.style.color,at:Date.now()});if(n.classList.contains('cq-loot-card'))J.log.cards.push({t:n.textContent,at:Date.now()});}
 if(J.log.ticker.length>600)J.log.ticker.splice(0,200);}).observe(document.body,{subtree:true,childList:true,characterData:true});
// camera-relative WASD (view.js controlInput): forward = -sin(yaw)dx - cos(yaw)dz, right = cos(yaw)dx - sin(yaw)dz
J.angleKeys=a=>[['KeyW'],['KeyW','KeyD'],['KeyD'],['KeyS','KeyD'],['KeyS'],['KeyS','KeyA'],['KeyA'],['KeyW','KeyA']][((Math.round(a/(Math.PI/4))%8)+8)%8];
J.dirKeys=(dx,dz)=>{const y=V().yaw,r=Math.cos(y)*dx-Math.sin(y)*dz,f=-Math.sin(y)*dx-Math.cos(y)*dz;return J.angleKeys(Math.atan2(r,f));};
J.arrow=()=>{const m=/rotate\(([-\d.e]+)rad\)/.exec(q('.cq-nav-arrow')?.style.transform||'');return m?Number(m[1]):null;};
// the game's own drivable route (ConquestWorld.route / routeAim, what the HUD arrow follows) toward a target the chip is not showing
J.R={key:'',path:null,from:0,at:0};
J.aim=(t,goal)=>{const v=V(),p=v.p,R=J.R,key=Math.round(t.x)+':'+Math.round(t.z);
 if(R.key===key&&R.path){const a=ConquestWorld.routeAim(p,R.path,R.from);R.from=a.index;if(a.off<=10)return {x:a.point.x,z:a.point.z,mode:'route'};}
 if(R.key!==key||performance.now()-R.at>1500){R.key=key;R.at=performance.now();R.path=ConquestWorld.route({x:p.x,z:p.z,y:p.y,surface:'ground'},{x:t.x,z:t.z},{goal:Math.max(2.5,Math.min(goal,8))});R.from=0;
  if(R.path){const a=ConquestWorld.routeAim(p,R.path,0);R.from=a.index;return {x:a.point.x,z:a.point.z,mode:'route*'};}}
 return {x:t.x,z:t.z,mode:'direct'};};
J.hostile=()=>{const v=V(),B=v.battle||v.encounter,p=v.p;if(!B)return null;return B.enemies.filter(e=>e.hp>0&&ConquestControl.visible(B,p,e)).sort((a,b)=>D(p,a)-D(p,b))[0]||null;};
J.chip=()=>(q('.cq-nav-title')?.textContent||'').replace(/^✓ /,'');
J.drive=(t,stop,title,fight)=>{const v=V(),p=v.p,B=v.battle||v.encounter,s=v.authority?.state,d=D(p,t),chip=J.chip(),titles=title?[].concat(title):[];
 const out={p:{x:p.x,z:p.z},sp:s?.position?{x:s.position.x,z:s.position.z}:null,d,keys:[],chip,hp:s?.hp??B?.playerHp,max:B?.playerMax,mode:null,lock:null,dialog:q('.cq-dialog')?(q('.cq-dialog h2')?.textContent||q('.cq-dialog')?.className):null,shieldReady:B?!(B.shieldCd>0)&&!(B.shieldT>0):false,mission:s?.mission||null,recover:shown(q('#cq-recover'))};
 if(fight){const e=J.hostile();if(e){if(v.selectedId!==e.id)v.selectedId=e.id;out.lock=e.id;out.lockD=D(p,e);}}
 if(d<=stop)return out;
 const rt=v.routeTarget;if(titles.includes(chip)&&(!rt||D(rt,t)<12)){const a=J.arrow();out.follow=1;if(a!==null){out.keys=J.angleKeys(a);out.mode='arrow';return out;}}
 const a=J.aim(t,stop);out.keys=J.dirKeys(a.x-p.x,a.z-p.z);out.mode=a.mode;return out;};
// an operation's target, as dev/tests/conquest-earned-journey.mjs fight() picks it (the carrier, the nearest required hostile,
// the recon scan site, the relay approach); the nearest visible hostile is locked (what a tap on its hull does)
J.fight=()=>{const v=V(),B=v.battle||v.encounter,s=v.authority?.state,p=v.p;if(!B||!s)return null;const op=B.operation||null,id=op?op.id:(v.battle?'oxygen-line':null);
 const vis=e=>ConquestControl.visible(B,p,e),req=B.enemies.filter(e=>e.hp>0&&(!e.resident||(['relay','redoubt'].includes(id)&&e.base?.id===op?.site)));
 const near=l=>l.filter(vis).sort((a,b)=>D(p,a)-D(p,b))[0];
 const enemy=req.find(e=>e.id===B.carrierId)||near(req)||req.slice().sort((a,b)=>D(p,a)-D(p,b))[0]||null;
 let target=enemy?{x:enemy.x,z:enemy.z}:(B.objective?{x:B.objective.x,z:B.objective.z}:{x:p.x,z:p.z}),stop=enemy&&vis(enemy)?26:8;
 if(id==='oxygen-line'&&!enemy){target={x:p.x,z:p.z};stop=1;}
 if(id==='recon'&&B.nodes?.[B.scans]){target={x:B.nodes[B.scans][0],z:B.nodes[B.scans][1]};stop=5;}
 if(op&&['battery','extraction'].includes(op.family)&&B.nodes?.[B.scans]){target={x:B.nodes[B.scans][0],z:B.nodes[B.scans][1]};stop=5;}
 if(id==='relay'&&enemy?.immobile&&!vis(enemy)&&p.z>op.z-14){target={x:op.x-25,z:op.z-20};stop=5;}
 const any=near(B.enemies.filter(e=>e.hp>0)),lockE=enemy&&vis(enemy)?enemy:any||null;if(lockE&&v.selectedId!==lockE.id)v.selectedId=lockE.id;
 const hz=(B.hazards||[]).filter(h=>D(h,p)<(h.radius||8)+3).sort((a,b)=>a.remaining-b.remaining)[0];
 return {id,state:s.battle?.state,mission:s.mission||null,hp:s.hp,max:B.playerMax,target,stop,d:D(p,target),enemy:enemy?{id:enemy.id,vis:vis(enemy),d:D(p,enemy),kind:enemy.kind}:null,
  lock:lockE?lockE.id:null,hazard:hz?{x:hz.x,z:hz.z,r:hz.radius||8}:null,kills:s.battle?.kills|0,localKills:B.kills|0,foe:!!q('#cq-navigation')?.classList.contains('cq-nav-foe'),
  arrow:J.arrow(),chip:J.chip(),route:q('.cq-nav-route')?.textContent||'',shieldReady:!(B.shieldCd>0)&&!(B.shieldT>0),p:{x:p.x,z:p.z},alive:req.length,result:!!q('.cq-result'),wave:q('.cq-wave')?.textContent||''};};
J.snap=()=>{const v=V();if(!v)return null;const a=v.authority,s=a?.state,B=v.battle||v.encounter,p=v.p,G=ConquestGuide;
 const wallet=typeof mnOf==='function'?mnOf(s?.airdrop?.view?.mn||save.mn):{},plates=typeof apOf==='function'?apOf(s?.airdrop?.view?.ap||save.ap):[0,0,0,0];
 const kb=matchMedia('(hover:hover) and (pointer:fine)').matches,pick=o=>o&&{name:o.name,coach:o.coach||null,kind:o.kind||null,id:o.id||null,x:o.x,z:o.z,radius:o.radius||o.activationRadius||null,act:o.activationRadius||null};
 const btn=sel=>{const e=q(sel);return shown(e)?e.textContent:null;};
 return {p:{x:p.x,z:p.z,y:p.y,surface:p.surface},yaw:v.yaw,connected:!!a?.connected,pending:v.pending,
  chip:{title:J.chip(),route:q('.cq-nav-route')?.textContent||'',dist:q('.cq-nav-distance')?.textContent||'',reward:q('.cq-nav-reward')?.textContent||'',foe:!!q('#cq-navigation')?.classList.contains('cq-nav-foe')},
  mission:s?.mission||null,bstate:s?.battle?.state||null,hp:s?.hp,max:B?.playerMax,cp:s?.ledger?.cp|0,banked:s?.ledger?.banked||{},cargo:s?.ledger?.cargo||{},mn:s?.ledger?.mn||{},
  completed:Object.keys(s?.completed||{}),firsts:s?.firsts||{},found:Object.keys(s?.found||{}),deposits:s?.deposits||{},wallet,plates,pts:typeof save!=='undefined'?save.pts|0:0,
  base:s?.base?.tier|0,scanAt:s?.scanAt||0,ap:s?.loadout?.ap||null,
  coach:s?pick(G.coachStep(s,p,{kb,wallet,plates})):null,board:s?pick(G.boardOrder(s,p,{pay:1})):null,route:pick(v.routeTarget),near:v.nearOperation?.id||null,
  btn:{access:btn('#cq-mission-access'),supply:btn('#cq-supply-access'),scan:btn('#cq-scan-access'),gather:btn('#cq-gather-access'),base:btn('#cq-base-access'),recover:btn('#cq-recover'),item:btn('#cq-item')},
  dialog:q('.cq-dialog')?(q('.cq-dialog h2')?.textContent||q('.cq-dialog').className):null,result:!!q('.cq-result'),
  drops:(s?.drops||[]).filter(d=>d.expires>Date.now()).map(d=>({id:d.id,x:d.x,z:d.z,y:d.y,label:d.label,r:d.r|0,loot:!!d.loot,d:D(p,d)})).sort((a,b)=>a.d-b.d).slice(0,12),
  hostile:(()=>{const e=J.hostile();return e?{id:e.id,d:D(p,e),kind:e.kind}:null;})(),
  wo:(s?.wo?.list?Object.values(s.wo.list):[]).map(o=>({id:o.id,kind:o.kind,n:o.n,goal:o.goal,done:!!o.done,claimed:!!o.claimed})),
  inv:s?.inv?.it||{},anp:s?.an?.p||0};};
// the progressive HUD at a glance: which status lines are on, and what the NEXT chip / vitals show
J.hud=()=>{const t=s=>{const e=q(s);return e&&shown(e)?(e.textContent||'').trim():'';};
 return {radio:t('.cq-radio'),nav:t('#cq-navigation'),title:J.chip(),hull:t('#cq-hull-row'),heat:t('#cq-heat'),o2:t('#cq-oxygen-row'),airdrop:t('.cq-net'),base:t('.cq-base-goal'),meteor:t('.cq-strike'),contracts:t('.cq-orders'),chain:t('.cq-chain'),wave:t('.cq-wave'),minerals:t('.cq-mn'),item:t('#cq-item'),ticker:t('.cq-reward-ticker'),homeButton:t('#cq-home-btn'),homePulse:!!q('#cq-home-btn')?.classList.contains('cq-home-new')};};
// nothing of the world HUD outside the viewport, no horizontal page scroll (world-anchored damage numbers / cache tags excluded)
J.hudFit=()=>{const panel=q('.cq');if(!panel)return {error:'no panel'};const out=[];
 for(const e of panel.querySelectorAll('*')){if(e.closest('.cq-dialog,.cq-more-panel,.cq-feel,.cq-item-picker')||!shown(e))continue;const r=e.getBoundingClientRect();if(r.width<1||r.height<1)continue;
  if(r.left<-1||r.top<-1||r.right>innerWidth+1||r.bottom>innerHeight+1)out.push({el:(e.id?'#'+e.id:'')+'.'+String(e.className||e.tagName).split(' ').join('.'),text:(e.textContent||'').trim().slice(0,40),rect:[r.left,r.top,r.right,r.bottom].map(Math.round)});}
 const de=document.documentElement;return {outside:out.slice(0,12),count:out.length,scrollW:Math.max(de.scrollWidth,document.body.scrollWidth),vw:innerWidth,vh:innerHeight,overflowX:Math.max(de.scrollWidth,document.body.scrollWidth)>innerWidth+1};};
// the NEXT chip (the HUD's single guidance channel) must not sit under another control: the drawn text of its title,
// distance and route lines (a Range box, clipped to the line's own box) against the top bar's buttons
J.navCover=()=>{const nav=q('#cq-navigation');if(!shown(nav))return {error:'no chip'};const out={hits:[],truncated:false,lines:{}};
 const tops=[...document.querySelectorAll('.cq-top button,#cq-home-btn')].filter(shown).map(e=>({e,r:e.getBoundingClientRect()}));
 for(const sel of ['.cq-nav-title','.cq-nav-distance','.cq-nav-route']){const e=nav.querySelector(sel);if(!e||!shown(e)||!(e.textContent||'').trim())continue;
  const rg=document.createRange();rg.selectNodeContents(e);const a=rg.getBoundingClientRect(),c=e.getBoundingClientRect(),t={left:Math.max(a.left,c.left),right:Math.min(a.right,c.right),top:Math.max(a.top,c.top),bottom:Math.min(a.bottom,c.bottom)};
  if(e.scrollWidth>e.clientWidth+1)out.truncated=true;out.lines[sel]=[t.left,t.top,t.right,t.bottom].map(Math.round);
  for(const b of tops){const w=Math.min(t.right,b.r.right)-Math.max(t.left,b.r.left),h=Math.min(t.bottom,b.r.bottom)-Math.max(t.top,b.r.top);
   if(w>2&&h>2)out.hits.push({line:sel,text:e.textContent.trim().slice(0,32),under:(b.e.id?'#'+b.e.id:b.e.getAttribute('aria-label')||b.e.textContent||'').trim().slice(0,24),overlapPx:[Math.round(w),Math.round(h)]});}}
 const r=nav.getBoundingClientRect();out.rect=[r.left,r.top,r.right,r.bottom].map(Math.round);out.text=J.chip();return out;};
// reachable = inside the viewport and the topmost element at its centre (not covered)
J.reach=e=>{if(typeof e==='string')e=q(e);if(!e)return {ok:false,why:'missing'};const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,inView=r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;
 const top=inView?document.elementFromPoint(x,y):null,hit=!!top&&(top===e||e.contains(top));return {ok:inView&&hit,inView,covered:inView&&!hit?(top?.className||top?.tagName||null):null,rect:[r.left,r.top,r.right,r.bottom].map(Math.round),text:(e.textContent||'').trim().slice(0,48)};};
J.last=sel=>{const l=[...document.querySelectorAll(sel)].filter(shown);return l.at(-1)||null;};
return 'ok';})()'''

class Server:
    """One disposable conquest-server.mjs per run (brand-new account, fresh wallet)."""
    async def start(self,pw):
        self.proc=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
        self.ready=json.loads(await self.proc.stdout.readline());self.base='http://127.0.0.1:'+str(self.ready['port'])
        self.api=await pw.request.new_context();return self
    async def inspect(self):
        r=await self.api.post(self.base+'/inspect',data={});return (await r.json()).get('state')
    async def fixture(self,body):
        r=await self.api.post(self.base+'/fixture',data=body);assert r.ok,await r.text()
    async def session(self,gv):
        r=await self.api.post(self.base+'/api/conquest/session',data={'gv':gv,'initData':self.ready['initData']});return r.status
    async def stop(self):
        try:await self.api.dispose()
        except Exception:pass
        try:self.proc.terminate();await asyncio.wait_for(self.proc.wait(),10)
        except Exception:pass

class Run:
    """Checks for one viewport: every failure is recorded with its symptom, the run continues where it safely can."""
    def __init__(self,name):self.name=name;self.checks={};self.failures=[];self.notes=[]
    def check(self,key,ok,detail=None):
        self.checks[key]={'pass':bool(ok),'detail':detail}
        log(self.name,'PASS' if ok else 'FAIL',key,'' if ok else json.dumps(detail,default=str)[:900])
        if not ok:self.failures.append({'check':key,'detail':detail})
        return ok

class Pilot:
    def __init__(self,pw,srv,w,h,mobile,name,onboarded=True,out=None):
        self.pw,self.srv,self.w,self.h,self.mobile,self.name,self.onboarded,self.out=pw,srv,w,h,mobile,name,onboarded,out
        self.held=set();self.touch=None;self.errors=[];self.moments={};self.t_enter=time.monotonic();self.skip=set();self.chip={'match':0,'other':0,'samples':[]}
        self.missions=[];self.loot={'flyouts':[],'cards':[],'aarDrops':[]};self.trace=[];self.deaths=[]
    async def open(self):
        opts={'headless':True,'args':ARGS};exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
        if exe:opts['executable_path']=exe
        self.browser=await self.pw.chromium.launch(**opts)
        self.ctx=await self.browser.new_context(viewport={'width':self.w,'height':self.h},has_touch=self.mobile,is_mobile=self.mobile,reduced_motion='reduce')
        self.page=page=await self.ctx.new_page();page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.cdp=await self.ctx.new_cdp_session(page)
        init='''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'''+json.dumps(self.srv.ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};'''
        if self.onboarded:init+="try{localStorage.setItem('lunar-conquest-onboarding-v1','1')}catch(e){}"
        await page.add_init_script(init);base=self.srv.base
        async def route(r):
            u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
            try:
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
            except Exception:pass
        await page.route('**/*',route)
        await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"',timeout=180000)
    async def close(self):
        try:await self.page.unroute_all(behavior='ignoreErrors')
        except Exception:pass
        try:await self.browser.close()
        except Exception:pass
    async def press(self,loc,timeout=30000):
        await self.release()
        if self.mobile:await loc.tap(timeout=timeout)
        else:await loc.click(timeout=timeout)
    async def enter(self):
        await self.page.evaluate('closeAll();save.welcomed=true;uiDirty();')
        await self.press(self.page.locator('[data-act="conquest"]'))
        await self.press(self.page.get_by_role('button',name='ENTER CONQUEST',exact=True))
        self.t_enter=time.monotonic()
    async def ready(self,timeout=240000):
        await self.page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=timeout)
        await self.page.evaluate(HELPERS)
    async def js(self,expr,arg=None):return await self.page.evaluate(expr,arg)
    async def snap(self):return await self.page.evaluate('__J.snap()')
    async def shot(self,label):
        p=self.out/f'journey-{label}-{self.w}x{self.h}.png'
        try:await self.page.screenshot(path=str(p),timeout=120000)
        except Exception as e:log(self.name,'capture failed',label,e)
        return p.name
    async def moment(self,k,**extra):
        if k in self.moments:return
        s=await self.srv.inspect();self.moments[k]={'sim':round(((s.get('an') or {}).get('p') or 0)/60000,2),'real':round(time.monotonic()-self.t_enter,1),**extra}
        log(self.name,'MOMENT',k,json.dumps(self.moments[k]))
    async def keys(self,want):
        want=set(want)
        for k in self.held-want:await self.page.keyboard.up(k)
        for k in want-self.held:await self.page.keyboard.down(k)
        self.held=want
    async def hold(self,sel):
        """A held press on a HUD button: a real touch on a phone (CDP Input.dispatchTouchEvent), the mouse on a computer."""
        if self.touch==sel:return True
        await self.release()
        box=await self.page.locator(sel).bounding_box()
        if not box:return False
        x,y=box['x']+box['width']/2,box['y']+box['height']/2
        if self.mobile:await self.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
        else:await self.page.mouse.move(x,y);await self.page.mouse.down()
        self.touch=sel;return True
    async def release(self):
        if not self.touch:return
        try:
            if self.mobile:await self.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            else:await self.page.mouse.up()
        except Exception:pass
        self.touch=None
    async def fire(self,on):
        if on and self.touch!='#cq-fire':await self.hold('#cq-fire')
        elif not on and self.touch=='#cq-fire':await self.release()
    async def shield(self):
        if self.mobile:
            again=self.touch=='#cq-fire';await self.release();await self.page.locator('#cq-shield').tap(timeout=5000)
            if again:await self.hold('#cq-fire')
        else:await self.page.keyboard.press('KeyF')
    async def stop_all(self):
        await self.keys(set());await self.release()
    async def swipe(self,sel,dy):
        """Scroll a container by real input: a CDP touch swipe on a phone, the mouse wheel on a computer."""
        box=await self.page.locator(sel).last.bounding_box()
        if not box:return False
        x=box['x']+box['width']/2;y=min(box['y']+box['height']*.72,self.h-30)
        if self.mobile:
            await self.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for k in range(1,11):await self.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':max(4,y-dy*k/10)}]});await self.page.wait_for_timeout(16)
            await self.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:await self.page.mouse.move(x,box['y']+box['height']/2);await self.page.mouse.wheel(0,dy)
        await self.page.wait_for_timeout(700);return True
    async def reveal(self,container,target_js,tries=10):
        """Scroll container (real input) until the element target_js names is reachable; returns the reach record."""
        n=0
        for n in range(tries+1):
            r=await self.js('(()=>{const e='+target_js+';return __J.reach(e);})()')
            if r.get('ok'):r['swipes']=n;return r
            if n<tries:
                st=await self.js(f'(()=>{{const c=[...document.querySelectorAll("{container}")].at(-1);return c?c.scrollTop:-1;}})()')
                await self.swipe(container,min(360,self.h*.45))
                st2=await self.js(f'(()=>{{const c=[...document.querySelectorAll("{container}")].at(-1);return c?c.scrollTop:-1;}})()')
                if st2==st and n>0:r['swipes']=n+1;r['stuck']=True;return r
        r['swipes']=n;return r
    # ---------------------------------------------------------------- driving and fighting
    async def unstick(self,tries,r):
        log(self.name,'stuck',tries,json.dumps(r.get('p')),r.get('mode'),r.get('chip'))
        await self.js("__J.R.key=''")
        if r.get('recover') and tries>=3:
            try:await self.press(self.page.locator('#cq-recover'),timeout=5000);await asyncio.sleep(1.5);return
            except Exception:pass
        back={'KeyW':'KeyS','KeyS':'KeyW','KeyA':'KeyD','KeyD':'KeyA'}
        rev={back[k] for k in r.get('keys',[]) if k in back} or {'KeyS'}
        side=[{'KeyA'},{'KeyD'}][tries%2]
        await self.keys(rev);await asyncio.sleep(.7);await self.keys(side);await asyncio.sleep(.9)
        if tries>=2:await self.page.keyboard.press('ShiftLeft')
        await self.keys(set())
    async def drive(self,t,stop,title=None,budget=180,fight=True,label=''):
        t0=time.monotonic();last=None;lastAt=t0;tries=0;r={};beat=t0
        while time.monotonic()-t0<budget:
            r=await self.js('([t,s,n,f])=>__J.drive(t,s,n,f)',[t,stop,title,fight])
            if time.monotonic()-beat>20:beat=time.monotonic();log(self.name,'driving',label,'d',round(r['d']),'at',[round(r['p']['x']),round(r['p']['z'])],r.get('mode'),r.get('chip'))
            if r['d']<=stop:break
            if r.get('dialog') and 'DISABLED' in str(r['dialog']):await self.respawn(label);continue
            if r.get('dialog') and 'cq-plot' not in str(r['dialog']):
                log(self.name,'dialog while driving',r['dialog']);await self.stop_all();await self.page.keyboard.press('Escape');await asyncio.sleep(.5);continue
            if r.get('hp') is not None and r['hp']<=0:await asyncio.sleep(.5);continue
            if title:
                want=title if isinstance(title,list) else [title]
                if r['chip'] in want:self.chip['match']+=1
                else:
                    self.chip['other']+=1
                    if len(self.chip['samples'])<14 and (not self.chip['samples'] or self.chip['samples'][-1]['chip']!=r['chip']):self.chip['samples'].append({'want':want[0],'chip':r['chip'],'at':[round(r['p']['x']),round(r['p']['z'])],'label':label})
            now=time.monotonic()
            if last is None or math.hypot(r['p']['x']-last['x'],r['p']['z']-last['z'])>1.2:last=r['p'];lastAt=now
            elif now-lastAt>3.2:tries+=1;await self.unstick(tries,r);last=None;continue
            await self.keys(r['keys'])
            await self.fire(bool(r.get('lock')))
            if r.get('hp') and r.get('max') and r['hp']<.55*r['max'] and r.get('lock') and r.get('shieldReady'):await self.shield()
            await asyncio.sleep(.08)
        await self.stop_all()
        return r
    async def respawn(self,where=''):
        await self.stop_all();self.deaths.append({'where':where,'real':round(time.monotonic()-self.t_enter,1)});log(self.name,'DISABLED while',where,'-> RESPAWN AT REFUGE')
        b=self.page.get_by_role('button',name='RESPAWN AT REFUGE',exact=True)
        try:
            await b.wait_for(timeout=20000);await self.press(b)
            await self.page.wait_for_function('Conquest.view.authority.state.hp>0&&!document.querySelector(".cq-result")',timeout=60000)
        except Exception as e:log(self.name,'respawn failed',repr(e))
    async def fight(self,op_id,budget=600):
        t0=time.monotonic();res='timeout';last=None;lastAt=t0;tries=0;f={}
        while time.monotonic()-t0<budget:
            f=await self.js('__J.fight()')
            if not f:await asyncio.sleep(.3);continue
            if f['kills']>0 or f['localKills']>0:await self.moment('first-kill',op=op_id)
            if f['state']=='victory':res='victory';break
            if f['state']=='defeat':res='defeat';break
            if f['hp'] is not None and f['hp']<=0:res='disabled';break
            if not f['mission']:res='left';break
            keys=[]
            if f['hazard']:
                keys=await self.js('([x,z])=>__J.dirKeys(x,z)',[f['p']['x']-f['hazard']['x'],f['p']['z']-f['hazard']['z']])
                if f['hazard'] and time.monotonic()-getattr(self,'_dash',0)>4:self._dash=time.monotonic();await self.page.keyboard.press('ShiftLeft')
            elif op_id=='oxygen-line':
                e=f['enemy']   # the defense: follow the red arrow (it points at the nearest living attacker) until one is in sight and close
                if e and (not e['vis'] or e['d']>30) and f['arrow'] is not None and f['foe']:keys=await self.js('a=>__J.angleKeys(a)',f['arrow'])
            elif f['d']>f['stop']:
                keys=(await self.js('([t,s])=>{const v=Conquest.view,a=__J.aim(t,s);return __J.dirKeys(a.x-v.p.x,a.z-v.p.z);}',[f['target'],f['stop']]))
            now=time.monotonic()
            if not keys or last is None or math.hypot(f['p']['x']-last['x'],f['p']['z']-last['z'])>1.2:last=f['p'];lastAt=now
            elif now-lastAt>3.5:tries+=1;await self.unstick(tries,{'p':f['p'],'keys':keys,'recover':False});last=None;continue
            await self.keys(keys)
            await self.fire(bool(f['lock']))
            if f['hp']<.6*f['max'] and f['shieldReady'] and f['lock']:await self.shield()
            if len(self.trace)<4000 and int((now-t0)*2)%6==0:self.trace.append({'op':op_id,'t':round(now-t0,1),'hp':f['hp'],'alive':f['alive'],'kills':f['kills'],'p':[round(f['p']['x']),round(f['p']['z'])],'chip':f['chip'],'wave':f['wave'][:60]})
            await asyncio.sleep(.06)
        await self.stop_all()
        f['result']=res;f['seconds']=round(time.monotonic()-t0,1);return f
    async def after_action(self,label=None):
        page=self.page
        await page.wait_for_selector('.cq-result',timeout=90000)
        try:await page.wait_for_function('!document.querySelector(".cq-aar[data-pending]")',timeout=60000)
        except Exception:pass
        await page.wait_for_timeout(600)
        aar=await self.js('''(()=>{const d=document.querySelector(".cq-result");return {title:d.querySelector("h2")?.textContent,stats:d.querySelector(".cq-aar-stats")?.textContent||'',kicker:d.querySelector(".cq-aar-kicker")?.textContent||'',drops:[...d.querySelectorAll(".cq-aar-drop")].map(x=>x.textContent),dropsRow:!!d.querySelector(".cq-aar-drops"),tiles:[...d.querySelectorAll(".cq-aar-tile")].map(x=>x.textContent),buttons:[...d.querySelectorAll("button")].map(b=>b.textContent)}})()''')
        if label:aar['capture']=await self.shot(label)
        btn='RETURN TO EXPLORATION' if 'RETURN TO EXPLORATION' in aar['buttons'] else 'RESPAWN AT REFUGE'
        await self.press(page.get_by_role('button',name=btn,exact=True))
        await page.wait_for_function('!document.querySelector(".cq-result")',timeout=60000)
        await page.wait_for_timeout(800)
        return aar
    async def sweep(self,radius=90,per=40):
        """Drive over the caches the fight left (as a pilot would: the 3D tags show them); a wedged one is left."""
        picked=0
        for _ in range(14):
            s=await self.snap()
            drops=[d for d in s['drops'] if d['d']<=radius and abs((d.get('y') or 0)-(s['p'].get('y') or 0))<6 and d['id'] not in self.skip]
            if not drops:break
            d=drops[0];cp=s['cp']
            await self.drive({'x':d['x'],'z':d['z']},stop=2.0,budget=per,label='cache')
            gone=False
            for _ in range(10):
                await asyncio.sleep(.5);s2=await self.snap()
                if not any(x['id']==d['id'] for x in s2['drops']):gone=True;break
            if gone:
                picked+=1;await self.moment('first-loot',label=d['label'],rarity=d['r'],loot=d['loot'],cp=s2['cp']-cp)
                if d['loot']:await self.moment('first-loot-item',label=d['label'],rarity=d['r'])
            else:self.skip.add(d['id'])
        return picked
    async def supply_open(self,title=None):
        await self.drive(TERMINAL,stop=6,title=title,budget=200,label='refuge')
        loc=self.page.locator('#cq-supply-access')
        for attempt in range(3):
            try:await loc.wait_for(state='visible',timeout=6000);break
            except Exception:await self.drive(TERMINAL,stop=3,budget=40,label='refuge-close')
        await self.press(loc)
        await self.page.locator('.cq-dialog h2',has_text='REFUGE SUPPLY').wait_for(timeout=30000)
    async def close_supply(self):
        if await self.page.get_by_role('button',name='CLOSE SUPPLY',exact=True).count():
            await self.press(self.page.get_by_role('button',name='CLOSE SUPPLY',exact=True))
        await self.page.wait_for_function('!document.querySelector(".cq-dialog")',timeout=20000);await self.keys(set())
    async def bank(self,title=None,repair=True):
        await self.supply_open(title)
        s=await self.snap();info={'cargo':s['cargo'],'mn':s['mn'],'cp':s['cp']}
        await self.press(self.page.get_by_role('button',name='BANK SALVAGE',exact=True))
        await self.page.wait_for_function('(()=>{const L=Conquest.view.authority.state.ledger;return ["alloy","biomass","helium"].every(k=>!(L.cargo[k]>0))&&!Object.values(L.mn||{}).some(v=>v>0)})()',timeout=40000)
        await self.page.locator('.cq-dialog h2',has_text='REFUGE SUPPLY').wait_for(timeout=20000)
        s=await self.snap()
        if repair and s['hp'] is not None and s['max'] and s['hp']<s['max']-1:
            await self.press(self.page.get_by_role('button',name='REPAIR HULL',exact=True))
            try:await self.page.wait_for_function('Conquest.view.authority.state.hp>=(Conquest.view.battle||Conquest.view.encounter).playerMax-1',timeout=30000)
            except Exception:pass
            await self.page.locator('.cq-dialog h2',has_text='REFUGE SUPPLY').wait_for(timeout=20000)
        info['claimRows']=await self.page.locator('.cq-orders-claim').count()
        info['wallet']=(await self.snap())['wallet']
        await self.close_supply();return info
    # ---------------------------------------------------------------- operations
    async def op(self,op_id):return await self.js('id=>{const o=ConquestCombat.operations[id];return {id,x:o.x,z:o.z,r:o.activationRadius,name:o.name}}',op_id)
    async def start_mission(self,op_id,title=None):
        o=await self.op(op_id);page=self.page
        await self.drive({'x':o['x'],'z':o['z']},stop=max(8,min(o['r']-8,30)),title=[t for t in [title,o['name']] if t],budget=260,label=op_id)
        loc=page.locator('#cq-mission-access')
        for attempt in range(3):
            try:await loc.wait_for(state='visible',timeout=8000);break
            except Exception:await self.drive({'x':o['x'],'z':o['z']},stop=10,budget=60,label=op_id+'-close')
        text=await loc.inner_text()
        await self.press(loc)
        for _ in range(30):
            if await self.js(f'Conquest.view.authority.state?.mission==="{op_id}"'):break
            sm=page.get_by_role('button',name='START MISSION',exact=True);br=page.get_by_role('button',name='BRIEF · '+o['name'],exact=True)
            if await sm.count():await self.press(sm)
            elif await br.count():await self.press(br)
            await page.wait_for_timeout(500)
        await page.wait_for_function(f'Conquest.view.authority.state?.mission==="{op_id}"',timeout=30000)
        return text

async def journey(pw,R,out):
    """1. The first hour on a phone, brand-new account."""
    srv=await Server().start(pw);P=Pilot(pw,srv,390,844,True,'journey',onboarded=False,out=out);page=None;res={'size':'390x844','touch':True}
    try:
        await P.open();page=P.page
        assert not (await srv.inspect()),'brand-new account: no Conquest record before the first entry'
        await P.enter()
        # ---- minute 0: the radio over gameplay, the HUD shows only the NEXT chip, HULL and HEAT
        await page.locator('.cq-radio').wait_for(timeout=90000)
        await page.wait_for_function('Conquest.view?.authority?.connected&&document.querySelector(".cq-nav-title")?.textContent',timeout=90000)
        await page.evaluate(HELPERS)
        hud0=await P.js('__J.hud()');res['minute0']=hud0
        lines=['airdrop','base','meteor','contracts','chain','minerals','o2']
        R.check('minute0-radio','Parasite armor is on the oxygen line' in hud0['radio'] or 'Tap DEFEND' in hud0['radio'],hud0['radio'])
        R.check('minute0-hud-only-next-hull-heat',bool(hud0['nav']) and bool(hud0['hull']) and bool(hud0['heat']) and hud0['title']=='HOLD THE OXYGEN LINE' and not any(hud0[k] for k in lines),{k:hud0[k] for k in ['title','hull','heat',*lines]})
        tickers=await P.js('__J.log.ticker.map(x=>x.t)')
        R.check('minute0-no-base-ticker',not any('BASE' in t for t in tickers+[hud0['ticker']]),{'ticker':hud0['ticker'] or tickers[:3],'homeButton':hud0['homeButton'],'pulse':hud0['homePulse'],'source':'js/conquest/app.js:442 homeHud first-visit hint'})
        for _ in range(40):   # the capture once the terrain is in, while the radio still plays (15 s)
            if await P.js('Conquest.view.pending===0'):break
            await page.wait_for_timeout(500)
        radio_up=await page.locator('.cq-radio').count()>0
        res['minute0']['capture']=await P.shot('minute0');res['minute0']['radioInCapture']=radio_up
        if not radio_up:R.notes.append('minute-0 capture taken after the 15 s radio ended (terrain still loading under software GL)')
        await P.moment('radio')
        # ---- the first fight: one tap on DEFEND (no briefing the first time)
        acc=page.locator('#cq-mission-access');await acc.wait_for(state='visible',timeout=60000)
        R.check('defend-in-range-at-spawn',(await acc.inner_text()).strip()=='DEFEND THE OXYGEN LINE',await acc.inner_text())
        await P.press(acc)
        await page.wait_for_function('Conquest.view.authority.state?.mission==="oxygen-line"',timeout=30000)
        briefing=await page.get_by_role('button',name='START MISSION',exact=True).count()
        R.check('first-defense-one-tap-no-briefing',briefing==0,{'briefingOpen':briefing})
        await P.moment('first-fight',op='oxygen-line')
        fight=await P.fight('oxygen-line')
        P.missions.append({'op':'oxygen-line','result':fight['result'],'seconds':fight['seconds']})
        R.check('first-fight-won',fight['result']=='victory',{k:fight.get(k) for k in ['result','seconds','hp','alive','kills','chip','route']})
        tick=await P.js('__J.log.ticker.map(x=>x.t)')
        R.check('kill-pop-destroyed',any(t.startswith('DESTROYED') for t in tick),tick[-12:])
        res['killPop']=next((t for t in tick if t.startswith('DESTROYED')),None)
        aar=await P.after_action('aar');res['firstAAR']=aar;P.loot['aarDrops']+=aar['drops']
        if aar['drops']:await P.moment('first-loot-drop-row',drops=aar['drops'])
        await P.sweep()
        # ---- the coach chain, read from the NEXT chip's own rules (BANK -> SCAN -> GATHER -> BANK -> more Ferrite -> PLATE)
        plate_blocked=None;steps=[];res['steps']=steps
        for guard in range(24):
            await page.wait_for_timeout(700);s=await P.snap();c=s['coach']
            if not c:break
            log('journey','COACH',c['coach'],c['name'],'chip:',s['chip']['title'],'route:',(s['route'] or {}).get('id'))
            steps.append({'step':'coach-'+c['coach'],'want':c['name'],'wantId':c.get('id'),'chip':s['chip']['title'],'routeTarget':(s['route'] or {}).get('id'),'sim':round(s['anp']/60000,2)})
            if c['coach'] in ('bank','bank2'):
                b=await P.bank(title=c['name']);await P.moment('first-bank' if c['coach']=='bank' else 'ferrite-banked',wallet=b['wallet'],claimRows=b['claimRows'])
            elif c['coach']=='scan' or (c['coach']=='more' and c['kind']=='coach'):
                await P.drive({'x':c['x'],'z':c['z']},stop=min(c['radius'] or 40,40),title=c['name'],budget=200,label='scan')
                await P.stop_all();sc=page.locator('#cq-scan-access');await sc.wait_for(state='visible',timeout=40000)
                before=(await P.snap())['scanAt'];await P.press(sc)
                await page.wait_for_function(f'(Conquest.view.authority.state?.scanAt||0)>{before}',timeout=40000);await page.wait_for_timeout(1500)
                s2=await P.snap();await P.moment('first-scan',found=s2['found'],route=(s2['route'] or {}).get('name'),chip=s2['chip']['title'])
            elif c['coach'] in ('gather','more') and c['kind']=='resource':
                mineral='fe';before=(await P.snap())['mn'].get(mineral,0);got=await gather(P,R,c)
                after=(await P.snap())['mn'].get(mineral,0)
                if c['coach']=='gather':
                    R.check('starter-vein-35-ferrite',after-before>=35,{'before':before,'after':after,'gather':got})
                    await P.moment('starter-vein',carried=after)
                else:await P.moment('second-ferrite',carried=after)
            elif c['coach']=='more' and c.get('act'):
                await mission(P,R,c['id'],c['name']);await P.bank(repair=True);await P.moment('second-mission')
            elif c['coach']=='plate':
                ok,info=await fabricate(P,R)
                if ok:await P.moment('first-plate',**info)
                else:plate_blocked=info;R.notes.append('FRONT plate blocked: '+json.dumps(info));break
            else:R.notes.append('unknown coach step '+json.dumps(c));break
        s=await P.snap()
        res['plate']={'fitted':bool(s['plates'] and s['plates'][0]>=1),'blocked':plate_blocked,'wallet':s['wallet'],'pts':s['pts']}
        R.check('first-plate-fitted',res['plate']['fitted'],res['plate'])
        # ---- the board: field missions until the town is affordable, then CLAIM YOUR TOWN at the Command Gate
        claimed=False;t_board=time.monotonic()
        for guard in range(10):
            await page.wait_for_timeout(700);s=await P.snap();o=s['board']
            if not o:R.notes.append('the board has no order before the town');break
            log('journey','BOARD',o['name'],'chip:',s['chip']['title'],'route:',(s['route'] or {}).get('id'),'cp',s['cp'],'banked',json.dumps(s['banked']))
            steps.append({'step':'board','want':o['name'],'chip':s['chip']['title'],'routeTarget':(s['route'] or {}).get('id'),'sim':round(s['anp']/60000,2)})
            if o['name']=='CLAIM YOUR TOWN':
                if s['hp'] is not None and s['max'] and s['hp']<.5*s['max']:await P.bank(repair=True)
                await claim_town(P,R);claimed=True;break
            if o['id'] and o.get('act'):
                await mission(P,R,o['id'],o['name']);b=await P.bank(repair=True);await P.moment('field-'+str(len(P.missions)),wallet=b['wallet'])
            else:R.notes.append('board order is not a field mission: '+json.dumps(o));break
            if time.monotonic()-P.t_enter>40*60:R.notes.append('real-time budget (40 min) spent before the town');break
        # the NEXT chip must name each order of the chain (a route to the same ore is the same order)
        bad=[x for x in steps if x['chip']!=x['want'] and not (x['step']=='coach-gather' and x['chip']=='STARTER VEIN ORE') and not (x['routeTarget'] and x['routeTarget']==x.get('wantId'))]
        R.check('next-chip-names-each-order',not bad,{'mismatches':bad,'chipPolls':{'match':P.chip['match'],'other':P.chip['other']},'source':'js/conquest/app.js:266 nextOrder puts view.routeTarget before coachStep/boardOrder; app.js:323-330 resourceGuide sets it to the nearest known vein after a SCAN and clears it only when that vein is dry'})
        R.check('town-claimed',claimed,{'cp':s.get('cp'),'banked':s.get('banked'),'missions':P.missions})
        if claimed:
            town=P.moments.get('first-town',{}).get('sim')
            R.check('town-by-22-simulated-minutes',town is not None and town<=TOWN_TARGET_MIN,{'townSim':town,'target':TOWN_TARGET_MIN})
        s=await P.snap();res['final']={k:s[k] for k in ['cp','banked','completed','wallet','plates','pts','base','wo','inv']}
        res['chipAgreement']=P.chip;res['missions']=P.missions;res['deaths']=P.deaths
        res['loot']={'flyouts':await P.js('__J.log.flyouts'),'cards':await P.js('__J.log.cards'),'aarDrops':P.loot['aarDrops']}
        res['lootSeen']=bool(res['loot']['flyouts'] or res['loot']['cards'] or res['loot']['aarDrops'])
        if not res['lootSeen']:R.notes.append('no loot drop flyout or after-action DROPS row appeared in this journey')
        res['tickerSample']=(await P.js('__J.log.ticker.map(x=>x.t)'))[-40:]
        R.check('no-page-errors',not P.errors,P.errors[:5])
    except Exception as e:
        R.check('journey-exception',False,{'error':repr(e),'trace':traceback.format_exc()[-1800:]})
        try:
            res['atFailure']=await P.snap();res['atFailure']['captured']=await P.shot('failure')
        except Exception:pass
    finally:
        res['moments']=P.moments;res['trace']=P.trace[-60:];res['pageErrors']=P.errors[:10]
        await P.close();await srv.stop()
    return res

async def gather(P,R,c):
    """Stop on the ore and HOLD GATHER (a real touch) until the Worker's channel pays; enemies first if they interrupt."""
    page=P.page;node={'x':c['x'],'z':c['z']};mineral='fe';t0=time.monotonic();tries=[]
    while time.monotonic()-t0<180:
        await P.drive(node,stop=1.6,title=[c['name'],'STARTER VEIN ORE','FERRITE ORE'],budget=90,label='ore')
        await P.stop_all();await page.wait_for_timeout(900)
        g=page.locator('#cq-gather-access')
        if not await g.is_visible():
            tries.append('no gather button');await P.drive(node,stop=0.8,budget=20,label='ore-close');continue
        txt=(await g.inner_text()).strip();tries.append(txt)
        if 'DRIVE' in txt:await P.drive(node,stop=0.8,budget=20,label='ore-close');continue
        before=(await P.snap())['mn'].get(mineral,0)
        await P.hold('#cq-gather-access')
        gained=False;hp0=(await P.snap())['hp']
        for _ in range(60):
            await page.wait_for_timeout(500);s=await P.snap()
            if s['mn'].get(mineral,0)>before:gained=True;break
            gt=await g.inner_text() if await g.is_visible() else ''
            if 'UNDER FIRE' in gt or (s['hp'] or 0)<(hp0 or 0)-1:tries.append('interrupted: '+gt);break
        await P.release()
        if gained:return {'tries':tries,'label':txt}
        s=await P.snap()
        if s['hostile'] and s['hostile']['d']<70:   # an attacker interrupts the channel: fight it off, then gather again
            log('journey','gather interrupted by',json.dumps(s['hostile']))
            t1=time.monotonic()
            while time.monotonic()-t1<60:
                s=await P.snap()
                if not s['hostile']:break
                await P.js('__J.drive({x:Conquest.view.p.x,z:Conquest.view.p.z},1,null,true)');await P.fire(True);await asyncio.sleep(.3)
            await P.fire(False)
    R.notes.append('gather did not pay within 180 s: '+json.dumps(tries[-6:]));return {'tries':tries,'failed':True}

async def fabricate(P,R):
    """REFUGE SUPPLY -> the FRONT Ferrite plate card. A muted card is still a button (the server decides, /api/act plate):
    the pilot taps it when the wallet holds the Ferrite, and the muted look is reported separately."""
    page=P.page;await P.supply_open('FABRICATE YOUR FIRST PLATE')
    b=page.locator('.cq-plating button').first;await b.wait_for(timeout=20000)
    cls=await b.get_attribute('class') or '';label=(await b.inner_text()).strip();s=await P.snap();need=await P.js('PLATE.cost[1]')
    info={'button':label,'muted':'cq-muted' in cls,'wallet':s['wallet'],'clientPts':s['pts'],'need':need,'hint':await page.locator('.cq-first-plate').inner_text() if await page.locator('.cq-first-plate').count() else ''}
    if info['muted']:info['mutedWhy']=('Ferrite '+str(s['wallet'].get('fe',0))+'/'+str(need['fe']) if s['wallet'].get('fe',0)<need['fe'] else '')+(' client save.pts '+str(s['pts'])+'/'+str(need['pts']) if s['pts']<need['pts'] else '')
    if s['wallet'].get('fe',0)<need['fe']:info['why']='not enough Ferrite in the wallet';await P.close_supply();return False,info
    hp0=await P.js('(Conquest.view.battle||Conquest.view.encounter).playerMax')
    await P.press(b)
    try:await page.wait_for_function('Conquest.view.authority.state?.loadout?.ap?.[0]===1',timeout=45000)
    except Exception as e:
        info['error']=repr(e)[:200];info['toast']=await P.js('document.querySelector("#toast")?.textContent||""');info['ticker']=(await P.js('__J.log.ticker.map(x=>x.t)'))[-4:]
        if await page.locator('.cq-dialog').count():await P.close_supply()
        return False,info
    await page.wait_for_function('Conquest.view.pending===0',timeout=60000);await page.wait_for_timeout(800)
    info['toast']=await P.js('document.querySelector("#toast")?.textContent||""');info['clientPtsAfter']=await P.js('save.pts|0')
    info['hullBefore']=hp0;info['hullAfter']=await P.js('(Conquest.view.battle||Conquest.view.encounter).playerMax')
    if await page.locator('.cq-dialog').count():await P.close_supply()
    R.check('first-plate-raises-hull',info['hullAfter']>hp0,info)
    R.check('plate-card-not-muted-when-affordable',not info['muted'],{'muted':info['muted'],'why':info.get('mutedWhy'),'hint':info['hint'],'serverAccepted':True,'clientPtsBefore':info['clientPts'],'clientPtsAfter':info['clientPtsAfter'],
        'source':'js/conquest/app.js:144 platingCards compares save.pts (never refreshed in Conquest: the airdrop view carries mn/ap, not pts)'})
    return True,info

async def mission(P,R,op_id,title):
    s=await P.snap()
    if s['hp'] is not None and s['max'] and s['hp']<.7*s['max']:await P.bank(repair=True)
    for attempt in range(3):
        btn=await P.start_mission(op_id,title)
        await P.moment('first-fight',op=op_id)
        f=await P.fight(op_id)
        P.missions.append({'op':op_id,'result':f['result'],'seconds':f['seconds'],'button':btn,'attempt':attempt+1,'sim':(await P.srv.inspect()).get('an',{}).get('p',0)/60000})
        aar=await P.after_action('aar-'+op_id if attempt==0 else None);P.loot['aarDrops']+=aar['drops']
        if aar['drops']:await P.moment('first-loot-drop-row',drops=aar['drops'])
        if f['result']=='victory':
            await P.sweep();return True
        R.notes.append(op_id+' attempt '+str(attempt+1)+': '+f['result']+' '+json.dumps({k:f.get(k) for k in ['hp','alive','kills','chip','route','wave']}))
        await P.bank(repair=True)
    R.check('mission-'+op_id,False,'lost three times');return False

async def claim_town(P,R):
    page=P.page
    await P.drive(GATE,stop=24,title='CLAIM YOUR TOWN',budget=240,label='gate')   # ENTER BASE shows inside the gate's 30 m ring
    loc=page.locator('#cq-base-access')
    for attempt in range(3):
        try:await loc.wait_for(state='visible',timeout=8000);break
        except Exception:await P.drive(GATE,stop=10,budget=60,label='gate-close')
    await P.press(loc)
    claim=page.locator('button.cq-plot-primary',has_text='CLAIM TOWN');await claim.wait_for(timeout=90000);await page.wait_for_timeout(1200)
    need=await page.locator('.cq-plot-need').inner_text() if await page.locator('.cq-plot-need').count() else ''
    await P.shot('town-claim')
    # the claim button must be on screen, or reachable by a real swipe of its sheet (Playwright's own tap would scroll any box)
    target='[...document.querySelectorAll("button.cq-plot-primary")].find(b=>b.textContent.startsWith("CLAIM TOWN"))'
    reach=await P.js('(()=>{const e='+target+';return __J.reach(e);})()')
    if not reach.get('ok'):reach=await P.reveal('.cq-plot-sheet',target,tries=6)
    reach['layout']=await P.js('(()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom].map(Math.round);},sh=document.querySelector(".cq-plot-sheet"),dr=document.querySelector(".cq-plot-drawer");return {sheet:r(sh),sheetScroll:sh?[sh.scrollTop,sh.scrollHeight,sh.clientHeight]:null,drawer:r(dr),stage:r(document.querySelector(".cq-plot-stage")),button:r('+target+'),vh:innerHeight};})()')
    P.claim_reach=reach
    R.check('claim-town-button-reachable',reach.get('ok'),reach)
    await P.shot('town-claim-button')
    await P.press(claim)
    await page.wait_for_function('(Conquest.view.authority.state?.base?.tier|0)>=1',timeout=60000)
    s=await P.snap();await P.moment('first-town',need=need,cp=s['cp'],banked=s['banked'])
    await page.wait_for_timeout(1500);await P.shot('town')

async def scan_route(pw,R,out):
    """1b. Deterministic repro of the scan route on the NEXT chip (390x844, touch): the pilot banks on the west side of the REFUGE
    terminal and taps SCAN there as the coach says. The chip must then lead to the coach's Starter Vein, and once it is gathered,
    name BANK THE FERRITE. Scenario placements: position, completed field missions (the coach chain is on), 6 alloy of cargo,
    and a fresh placement until the Worker's own vein seed has put this pilot's Ridge Ferrite vein at fe-14 (1153,1159)."""
    srv=await Server().start(pw);P=Pilot(pw,srv,390,844,True,'route-390x844',onboarded=True,out=out);res={'size':'390x844','touch':True}
    try:
        await P.open();page=P.page;gv=await P.js('PVP_V')
        fx={'position':[1166,1163],'noEnemies':True,'fieldMissions':True,'cargo':{'alloy':6,'biomass':0,'helium':0}};spot=None
        for i in range(30):
            await srv.fixture(fx);await srv.session(gv);st=await srv.inspect();spot=(((st.get('lodes') or {}).get('slots') or {}).get('fe:ridge:0') or {}).get('spot')
            if spot=='fe-14':break
        res['ridgeVein']=spot;res['placements']=i+1
        if spot!='fe-14':R.notes.append('the Ridge Ferrite vein never landed on fe-14 in 30 placements: repro skipped');return res
        await P.enter();await P.ready();await page.wait_for_timeout(1200)
        s=await P.snap();res['start']={'coach':(s['coach'] or {}).get('name'),'chip':s['chip']['title'],'p':s['p']}
        await P.press(page.locator('#cq-supply-access'));await page.locator('.cq-dialog h2',has_text='REFUGE SUPPLY').wait_for(timeout=30000)
        await P.press(page.get_by_role('button',name='BANK SALVAGE',exact=True));await page.wait_for_function('!!Conquest.view.authority.state.firsts?.bank',timeout=30000);await P.close_supply()
        await page.wait_for_timeout(900);s=await P.snap();res['afterBank']={'coach':(s['coach'] or {}).get('name'),'chip':s['chip']['title']}
        sc=page.locator('#cq-scan-access');await sc.wait_for(state='visible',timeout=30000);before=s['scanAt'];await P.press(sc)
        await page.wait_for_function(f'(Conquest.view.authority.state?.scanAt||0)>{before}',timeout=30000);await page.wait_for_timeout(1500)
        s=await P.snap();p=s['p']
        res['afterScan']={'coach':(s['coach'] or {}).get('name'),'chip':s['chip']['title'],'route':s['route'],'at':[round(p['x'],1),round(p['z'],1)],'dStarter':round(math.hypot(p['x']-1180,p['z']-1150),1),'dFe14':round(math.hypot(p['x']-1153,p['z']-1159),1)}
        res['afterScan']['capture']=await P.shot('scan-route')
        R.check('scan-route-leads-to-starter-vein',s['chip']['title'] in ('STARTER VEIN ORE','GATHER THE STARTER VEIN'),{**res['afterScan'],'source':'js/conquest/app.js:323-330 resourceGuide routes to the nearest known vein, not the coach order'})
        c=s['coach'];g=await gather(P,R,c);await page.wait_for_timeout(1500);s=await P.snap()
        res['afterGather']={'coach':(s['coach'] or {}).get('name'),'chip':s['chip']['title'],'route':(s['route'] or {}).get('id'),'carried':s['mn'],'gather':g}
        res['afterGather']['capture']=await P.shot('scan-route-after-gather')
        R.check('chip-names-bank-the-ferrite-after-starter-vein',s['chip']['title']==(s['coach'] or {}).get('name'),{**{k:res['afterGather'][k] for k in ['coach','chip','route','carried']},'source':'js/conquest/app.js:266 nextOrder: view.routeTarget outranks coachStep; app.js:325 clears a resource route only when the vein is dry'})
        R.check('no-page-errors',not P.errors,P.errors[:5])
    except Exception as e:
        R.check('route-exception',False,{'error':repr(e),'trace':traceback.format_exc()[-1500:]})
    finally:
        res['pageErrors']=P.errors[:10];await P.close();await srv.stop()
    return res

async def smoke(pw,w,h,mobile,R,out):
    """2. The UI reachability smoke at one size, with scenario placements: a War Order completed and claimed."""
    srv=await Server().start(pw);P=Pilot(pw,srv,w,h,mobile,f'smoke-{w}x{h}',onboarded=True,out=out);res={'size':f'{w}x{h}','touch':mobile};page=None
    try:
        await P.open();page=P.page;gv=await P.js('PVP_V')
        # the Worker draws today's three War Orders from the pilot's server seed: a fresh placement until Bank 60 alloy is among them
        fx={'position':[1174,1161],'noEnemies':True,'hp':700,'inv':{'it':{'repair':2,'decoy':1}},'cargo':{'alloy':60,'biomass':0,'helium':0},'fieldMissions':True,'base':{'tier':1}}
        drawn=[]
        for i in range(20):
            await srv.fixture(fx);await srv.session(gv);st=await srv.inspect();drawn=[o['id'] for o in listify((st.get('wo') or {}).get('list'))]
            if 'bank60' in drawn:break
        res['orders']=drawn;res['placements']=i+1
        R.check('war-order-bank60-drawn','bank60' in drawn,drawn)
        await P.enter();await P.ready()
        await page.wait_for_timeout(1500)
        fit0=await P.js('__J.hudFit()');res['hudFitStart']=fit0
        R.check('hud-fits-start',not fit0['count'] and not fit0['overflowX'],fit0)
        # REFUGE SUPPLY: primary action reachable; BANK SALVAGE completes the War Order; the claim row claims it
        await P.press(page.locator('#cq-supply-access'))
        await page.locator('.cq-dialog h2',has_text='REFUGE SUPPLY').wait_for(timeout=30000)
        prim=await P.reveal('.cq-dialog','[...document.querySelectorAll(".cq-dialog button")].find(b=>b.textContent==="BANK SALVAGE")')
        R.check('supply-primary-reachable',prim.get('ok'),prim);res['supplyPrimary']=prim
        await P.press(page.get_by_role('button',name='BANK SALVAGE',exact=True))
        await page.wait_for_function('(()=>{const s=Conquest.view.authority.state,l=s.wo?.list?Object.values(s.wo.list):[];return l.some(o=>o.id==="bank60"&&o.done);})()',timeout=40000)
        await page.locator('.cq-orders-claim').wait_for(timeout=30000)
        row=await P.reveal('.cq-dialog','document.querySelector(".cq-orders-claim button")')
        R.check('war-order-claim-row-reachable',row.get('ok'),row);res['claimRow']=row
        res['claimRowText']=await page.locator('.cq-orders-claim').inner_text()
        await P.shot('supply-claim')
        await P.press(page.locator('.cq-orders-claim button').first)
        await page.wait_for_function('(()=>{const s=Conquest.view.authority.state,l=s.wo?.list?Object.values(s.wo.list):[];return l.some(o=>o.id==="bank60"&&o.claimed);})()',timeout=40000)
        st=await srv.inspect();o=[x for x in listify(st['wo']['list']) if x['id']=='bank60'][0]
        R.check('war-order-claimed-on-server',o.get('claimed')==1,o)
        close=await P.reveal('.cq-dialog','[...document.querySelectorAll(".cq-dialog button")].find(b=>b.textContent==="CLOSE SUPPLY")')
        R.check('supply-close-reachable',close.get('ok'),close)
        await P.close_supply();await page.wait_for_timeout(1200)
        res['ticker']=(await P.js('__J.log.ticker.map(x=>x.t)'))[-6:]
        hud=await P.js('__J.hud()');res['hud']=hud
        R.check('contracts-line-after-first-order',hud['contracts'].startswith('WAR ORDERS'),hud)
        fit=await P.js('__J.hudFit()');res['hudFit']=fit
        R.check('hud-fits-full',not fit['count'] and not fit['overflowX'],fit)
        nav=await P.js('__J.navCover()');res['navCover']=nav
        R.check('next-chip-not-covered',not nav.get('hits') and not nav.get('error'),nav)
        res['hudCapture']=await P.shot('hud')
        # MORE: opens, its last button reachable
        await P.press(page.get_by_role('button',name='MORE',exact=True))
        await page.wait_for_function('!document.querySelector(".cq-more-panel").hidden',timeout=10000)
        more=await P.reveal('.cq-more-panel','__J.last(".cq-more-panel button")')
        more['panel']=await P.js('(()=>{const m=document.querySelector(".cq-more-panel"),r=m.getBoundingClientRect();return {buttons:[...m.querySelectorAll("button")].map(b=>b.textContent),rect:[r.left,r.top,r.right,r.bottom].map(Math.round),scrollH:m.scrollHeight,clientH:m.clientHeight,overflowY:getComputedStyle(m).overflowY,maxHeight:getComputedStyle(m).maxHeight,vh:innerHeight};})()')
        res['more']=more;R.check('more-last-button-reachable',more.get('ok'),more)
        res['moreCapture']=await P.shot('more')
        # LOOT & TROPHY HALL: the dialog's last button reachable
        loot=page.locator('.cq-loot-open');lr=await P.js('__J.reach(".cq-loot-open")')
        if not lr.get('ok'):lr=await P.reveal('.cq-more-panel','document.querySelector(".cq-loot-open")')
        if lr.get('ok'):await P.press(loot)
        else:R.check('more-loot-button-reachable',False,lr);await P.js('document.querySelector(".cq-loot-open").click()')   # to go on with the other checks
        await page.locator('.cq-dialog.cq-loot').wait_for(timeout=20000)
        lt=await P.reveal('.cq-dialog.cq-loot','__J.last(".cq-dialog.cq-loot button")')
        res['loot']=lt;R.check('loot-hall-last-button-reachable',lt.get('ok'),lt)
        res['lootCapture']=await P.shot('loot')
        await P.press(page.locator('.cq-dialog.cq-loot button',has_text='CLOSE').last)
        await page.wait_for_function('!document.querySelector(".cq-dialog")',timeout=20000)
        # the hub (back ‹): the WAR ORDERS card shows today's orders, the claimed one ticked
        await P.press(page.get_by_role('button',name='← RETURN TO CONQUEST',exact=True))
        await page.locator('.cq-hub-orders').wait_for(timeout=60000)
        await page.wait_for_timeout(1500)
        card=await P.reveal('.cq-hub-scroll','document.querySelector(".cq-hub-orders")')
        text=await page.locator('.cq-hub-orders').inner_text();res['hubCard']={'reach':card,'text':text}
        R.check('hub-war-orders-card',card.get('ok') and 'WAR ORDERS' in text.upper() and 'BANK 60 ALLOY · CLAIMED' in text.upper(),res['hubCard'])
        fit2=await P.js('(()=>{const de=document.documentElement;return {scrollW:Math.max(de.scrollWidth,document.body.scrollWidth),vw:innerWidth};})()')
        R.check('hub-no-horizontal-scroll',fit2['scrollW']<=fit2['vw']+1,fit2)
        res['ordersCapture']=await P.shot('orders')
        R.check('no-page-errors',not P.errors,P.errors[:5])
    except Exception as e:
        R.check('smoke-exception',False,{'error':repr(e),'trace':traceback.format_exc()[-1500:]})
        try:res['failureCapture']=await P.shot('failure')
        except Exception:pass
    finally:
        res['pageErrors']=P.errors[:10];await P.close();await srv.stop()
    return res

async def desktop_keys(pw,R,out):
    """3. 1366x768, real keyboard: WASD moves the tank; 1 uses a Repair Kit (the server's count drops)."""
    srv=await Server().start(pw);P=Pilot(pw,srv,1366,768,False,'keys-1366x768',onboarded=True,out=out);res={'size':'1366x768','touch':False}
    try:
        await P.open();page=P.page
        await srv.fixture({'position':SPAWN,'noEnemies':True,'hp':700,'inv':{'it':{'repair':1}}})
        await P.enter();await P.ready();await page.wait_for_timeout(1500)
        await P.js('document.querySelector(".cq-viewport")?.focus({preventScroll:true})')
        s0=await srv.inspect();v0=await P.js('({x:Conquest.view.p.x,z:Conquest.view.p.z,yaw:Conquest.view.yaw})')
        await page.keyboard.down('KeyW');await page.wait_for_timeout(2000);await page.keyboard.up('KeyW')
        await page.wait_for_timeout(3000)
        s1=await srv.inspect();v1=await P.js('({x:Conquest.view.p.x,z:Conquest.view.p.z})')
        dv=math.hypot(v1['x']-v0['x'],v1['z']-v0['z']);ds=math.hypot(s1['position']['x']-s0['position']['x'],s1['position']['z']-s0['position']['z'])
        res['wasd']={'view':[v0,v1],'server':[s0['position'],s1['position']],'viewMoved':round(dv,2),'serverMoved':round(ds,2),'northward':round(s0['position']['z']-s1['position']['z'],2)}
        R.check('wasd-2s-moves-tank',dv>3 and ds>3 and s1['position']['z']<s0['position']['z'],res['wasd'])
        n0=s1['inv']['it'].get('repair',0);hp0=s1['hp']
        await page.keyboard.press('Digit1')
        n1=n0;s2=s1
        for _ in range(40):
            await page.wait_for_timeout(750);s2=await srv.inspect();n1=s2['inv']['it'].get('repair',0)
            if n1<n0:break
        res['key1']={'repairBefore':n0,'repairAfter':n1,'hpBefore':hp0,'ticker':(await P.js('__J.log.ticker.map(x=>x.t)'))[-3:]}
        R.check('key1-uses-repair-kit',n0==1 and n1==0,res['key1'])
        for _ in range(40):   # the kit mends +40% hull over 6 s of simulated play (software GL runs the sim at ~0.5x here)
            s3=await srv.inspect()
            if s3['hp']>hp0+100:break
            await page.wait_for_timeout(750)
        res['key1']['hpAfter']=s3['hp'];R.check('repair-kit-mends-hull',s3['hp']>hp0+100,res['key1'])
        res['capture']=await P.shot('keys')
        R.check('no-page-errors',not P.errors,P.errors[:5])
    except Exception as e:
        R.check('keys-exception',False,{'error':repr(e),'trace':traceback.format_exc()[-1500:]})
    finally:
        res['pageErrors']=P.errors[:10];await P.close();await srv.stop()
    return res

async def main():
    ap=argparse.ArgumentParser();ap.add_argument('--only',default='journey,route,smoke,keys');ap.add_argument('--sizes',default='390x700,320x568,1366x768,1920x1080');ap.add_argument('--out',default=str(ROOT/'docs/conquest/session6'));ap.add_argument('--merge',action='store_true',help='keep the other runs already in journey.json')
    a=ap.parse_args();only=a.only.split(',');out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
    report={'scope':__doc__.strip().split('\n')[0],'source':'working tree','started':time.strftime('%Y-%m-%dT%H:%M:%S'),'runs':{}}
    runs=[];kept={}
    if a.merge and (out/'journey.json').exists():
        try:kept=json.loads((out/'journey.json').read_text()).get('runs',{})
        except Exception:kept={}
    async with async_playwright() as pw:
        if 'journey' in only:
            R=Run('journey-390x844');runs.append(R);t=time.monotonic();res=await journey(pw,R,out);res['realSeconds']=round(time.monotonic()-t);report['runs']['journey-390x844']={**res,'checks':R.checks,'notes':R.notes}
        if 'route' in only:
            R=Run('route-390x844');runs.append(R);t=time.monotonic();res=await scan_route(pw,R,out);res['realSeconds']=round(time.monotonic()-t);report['runs']['route-390x844']={**res,'checks':R.checks,'notes':R.notes}
        if 'smoke' in only:
            for sz in a.sizes.split(','):
                w,h=map(int,sz.split('x'));R=Run('smoke-'+sz);runs.append(R);t=time.monotonic();res=await smoke(pw,w,h,w<800,R,out);res['realSeconds']=round(time.monotonic()-t);report['runs']['smoke-'+sz]={**res,'checks':R.checks,'notes':R.notes}
        if 'keys' in only:
            R=Run('keys-1366x768');runs.append(R);t=time.monotonic();res=await desktop_keys(pw,R,out);res['realSeconds']=round(time.monotonic()-t);report['runs']['keys-1366x768']={**res,'checks':R.checks,'notes':R.notes}
    for k,v in kept.items():report['runs'].setdefault(k,v)
    report['runs']=dict(sorted(report['runs'].items(),key=lambda kv:['journey','route','smoke','keys'].index(kv[0].split('-')[0]) if kv[0].split('-')[0] in ['journey','route','smoke','keys'] else 9))
    j=report['runs'].get('journey-390x844',{});m=j.get('moments',{})
    report['firstHour']={'unit':'simulated minutes (Worker s.an.p) / real seconds since ENTER CONQUEST','targetTownMin':TOWN_TARGET_MIN,
        'moments':{k:m.get(k) for k in ['first-fight','first-kill','first-loot','first-loot-item','first-loot-drop-row','first-bank','first-scan','starter-vein','ferrite-banked','second-mission','first-plate','first-town'] if k in m}}
    fails=[{'run':name,'check':k,'detail':v['detail']} for name,run in report['runs'].items() for k,v in (run.get('checks') or {}).items() if not v['pass']]
    report['status']='PASS' if not fails else 'FAIL';report['failures']=fails
    for R in runs:
        for k,v in R.checks.items():print(('PASS' if v['pass'] else 'FAIL'),R.name,k)
    report['summary']={name:{k:('PASS' if v['pass'] else 'FAIL') for k,v in (run.get('checks') or {}).items()} for name,run in report['runs'].items()}
    (out/'journey.json').write_text(json.dumps(report,indent=1,default=str)+'\n')
    print(json.dumps({'status':report['status'],'firstHour':report['firstHour'],'failures':[{'run':f['run'],'check':f['check']} for f in fails]},indent=1))
    sys.exit(0 if not fails else 1)

if __name__=='__main__':asyncio.run(main())
