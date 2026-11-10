"""Owner report (Nov 10): "in live matches the AI fires its super every 1-2 s, 3-5x faster than my own". Measures it in a real
browser at phone size on the shipped client (AI matches run on the phone): every super by every tank, in sim time and in wall
time as the player sees it, supers per AI a minute vs the player's own under the same rules, total AI supers a second, the
fast-forward while the player is dead, frame rate. The player is a maximal pilot (the game's own bot drives it and fires the
instant the super is charged). usage: [LUNAR_SRC=<checkout, default this repo>] [CPU=<throttle 1..6>] python3 dev/tests/arcade-supers-browser.py [out.json]
"""
import asyncio,json,os,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(os.environ.get('LUNAR_SRC') or pathlib.Path(__file__).resolve().parents[2]).resolve();HERE=pathlib.Path(__file__).resolve().parents[2]
LEGEND={'w':{'a':'moon','t':2,'q':1,'s':False},'c':{'c':'titan','t':2,'q':1.1,'s':False},'up':{'hull':4,'cannon':4,'engine':2,'target':2,'reactor':2},'cores':['dmg','rof','arm'],'gl':{'dmg':4,'rof':4,'arm':4,'spd':4,'lck':4,'reg':4},'skin':'lunar','paint':'gold','chs':[{'c':'scout','t':1,'q':1.08,'s':False},{'c':'vanguard','t':2,'q':1.08,'s':False},{'c':'titan','t':2,'q':1.1,'s':False}]}
HOOK='''(L)=>{window.myLoadout=()=>JSON.parse(JSON.stringify(L));save.mp=50;save.lwr=0.5;
 window.__log=[];window.__frames=[];if(window.__hooked){let last=performance.now();const f=()=>{const n=performance.now();__frames.push(n-last);last=n;if(typeof state!=='undefined'&&state==='play')requestAnimationFrame(f);};requestAnimationFrame(f);return;}window.__hooked=1;const us=useSuper;window.useSuper=(r,a)=>{const sp=r.sp,ok=us(r,a);if(ok)__log.push({t:performance.now(),e:elapsed,id:r.id,me:r===me,sp,dead:me&&me.hp<=0,ff:ffwd,flare:!!(evt&&evt.k==='flare')});return ok;};
 let last=performance.now();const f=()=>{const n=performance.now();__frames.push(n-last);last=n;if(typeof state!=='undefined'&&state==='play')requestAnimationFrame(f);};requestAnimationFrame(f);}'''
START='''([g,m])=>{save.mode=m;save.gtype=g;prepareMatch();startMatch();me.ctl='pilot';me.hum=true;me.brain=newBrain();me.strafe=1;me.strafeT=1.5;if(!window.__upd){window.__upd=update;window.update=function(dt){__upd(dt);if(typeof me!=='undefined'&&me&&me.hp>0&&me.ctl==='pilot'){botAI(dt,me);if(me.sp>=SUPER_MAX&&!me.sup)useSuper(me);}};}window.__t0=performance.now();window.__meId=me.id;return {lg:battleLg,aiP:aiLv&&aiLv.p,pw:battlePower,n:units.length,roster:units.map(u=>({id:u.id,team:u.team,cls:u.cls,w:u.wtype,hp:u.mhp,dps:Math.round(u.wdps),fillM:u.fillM,boss:!!u.boss}))};}'''
async def run(pg,g,m,secs):
 info=await pg.evaluate(START,[g,m]);await pg.wait_for_function('state!=="play"',timeout=secs*1000+90000)
 r=await pg.evaluate('''()=>{const L=__log,fr=__frames,t0=__t0,t1=performance.now(),wall=(t1-t0)/1000;const by={};for(const x of L){(by[x.id]=by[x.id]||[]).push(x);}
  const stat=(a)=>{a.sort((p,q)=>p.t-q.t);const gw=[],gs=[];for(let i=1;i<a.length;i++){gw.push((a[i].t-a[i-1].t)/1000);gs.push(a[i].e-a[i-1].e);}const med=v=>v.length?v.slice().sort((p,q)=>p-q)[v.length>>1]:null;return {n:a.length,perWallMin:+(a.length/wall*60).toFixed(2),perSimMin:+(a.length/Math.max(1,elapsedTotal)*60).toFixed(2),minGapWall:gw.length?+Math.min(...gw).toFixed(2):null,medGapWall:gw.length?+med(gw).toFixed(2):null,minGapSim:gs.length?+Math.min(...gs).toFixed(2):null,lowSp:Math.min(...a.map(x=>x.sp)),whileDead:a.filter(x=>x.dead).length,duringFF:a.filter(x=>x.ff).length,flare:a.filter(x=>x.flare).length};};
  const elapsedTotal=L.length?Math.max(...L.map(x=>x.e)):0;const out={wall:+wall.toFixed(1),simSecs:elapsedTotal,fps:+(1000/(fr.reduce((a,b)=>a+b,0)/Math.max(1,fr.length))).toFixed(1),worstFrameMs:+Math.max(...fr).toFixed(0),units:{}};
  for(const id in by){const u=units[id];out.units[id]=Object.assign({team:u.team,me:+id===__meId,boss:!!u.boss},stat(by[id]));}
  const ai=L.filter(x=>!x.me&&units[x.id].team!==units[__meId].team),mine=L.filter(x=>x.me);out.me=stat(mine);out.enemyAI={total:ai.length,perWallSec:+(ai.length/wall).toFixed(3),perTankWallMin:+(ai.length/wall*60/Math.max(1,units.filter(u=>u.team!==units[__meId].team&&!u.boss).length)).toFixed(2)};
  out.ratioEnemyTankVsMe=out.me.n?+(out.enemyAI.perTankWallMin/out.me.perWallMin).toFixed(2):null;out.ratioAllEnemiesVsMe=out.me.n?+((ai.length/wall*60)/out.me.perWallMin).toFixed(2):null;
  const deadWall=(()=>{let d=0;for(let i=1;i<L.length;i++)if(L[i].dead)d+=L[i].t-L[i-1].t;return +(d/1000).toFixed(1);})();out.secsDeadApprox=deadWall;out.deaths=me.deaths||0;out.result=typeof outcome==='function'?(outcome(me).won?'win':outcome(me).drawn?'draw':'loss'):null;return out;}''')
 r['setup']=info;return r
async def main():
 out=sys.argv[1] if len(sys.argv)>1 else None;cpu=float(os.environ.get('CPU','1'))
 # the shipped client leaves to the website unless it runs inside Telegram: a Telegram stub + the local Worker fixture (match tickets, sync)
 import subprocess
 # the fixture Worker from this tree (tickets, sync); the client under test comes from ROOT
 srv=subprocess.Popen(['node','dev/tests/conquest-server.mjs'],cwd=str(HERE),stdout=subprocess.PIPE,text=True);ready=json.loads(srv.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
 async with async_playwright() as p:
  exe=shutil.which('chromium') or '/opt/pw-browsers/chromium'
  b=await p.chromium.launch(executable_path=exe,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True,is_mobile=True);pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.path.startswith('/api/'):
    try:
     resp=await pg.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'));return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
    except Exception:return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  TG='window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){}},themeParams:{}}};'
  await pg.route('**/*',route);await pg.add_init_script('window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;'+TG)
  if cpu>1:
   cdp=await ctx.new_cdp_session(pg);await cdp.send('Emulation.setCPUThrottlingRate',{'rate':cpu})
  await pg.goto('https://lunar.test/index.html');await pg.wait_for_function('typeof prepareMatch==="function"&&typeof save!=="undefined"');await pg.wait_for_timeout(800)
  await pg.evaluate('closeAll();save.welcomed=true;uiDirty();');await pg.evaluate(HOOK,LEGEND)
  R={'src':str(ROOT),'cpuThrottle':cpu,'build':await pg.evaluate('window.BUILD'),'gfx':await pg.evaluate('typeof gfxMode==="function"?gfxMode():null')}
  for (g,m,secs) in [('bounty','1v1',120),('arena','3v3',180),('arena','1v1',180)]:
   await pg.evaluate(HOOK,LEGEND);r=await run(pg,g,m,secs);R[g+' '+m]=r
   foes={k:v for k,v in r['units'].items() if not v['me'] and v['team']!=r['units'][str(r['setup']['roster'][0]['id'])]['team']} if r['units'] else {}
   print(g,m,json.dumps({k:r[k] for k in ('wall','simSecs','fps','worstFrameMs','me','enemyAI','ratioEnemyTankVsMe','ratioAllEnemiesVsMe','secsDeadApprox','deaths','result')}),'enemy tanks',json.dumps({k:{kk:v[kk] for kk in ('n','perWallMin','perSimMin','minGapSim','medGapWall','lowSp')} for k,v in foes.items()}),'lg',r['setup']['lg'],'aiP',r['setup']['aiP'],flush=True)
   await pg.evaluate('closeAll();exitBattle&&exitBattle();');await pg.wait_for_timeout(500)
  R['pageErrors']=errs;await b.close()
 srv.terminate()
 if out:pathlib.Path(out).write_text(json.dumps(R,indent=1))
asyncio.run(main())
