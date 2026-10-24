# Trailer capture: renders scripted shots of the real game frame by frame (virtual clock) into raw/<shot>/NNNNN.jpg
# Usage: python3 dev/trailer/capture.py OUTDIR [shot ...]
import os, sys, asyncio, json, time
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,os.path.join(HERE,'..','tests'))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
from shots import BATTLE, MENU

INIT="""window.LUNAR_NO_AUTOGFX=1;window.__VT=1000;performance.now=()=>window.__VT;
window.__rafq=[];window.requestAnimationFrame=f=>{window.__rafq.push(f);return 1;};
try{localStorage.clear();}catch(e){}"""
DIRJS=open(os.path.join(HERE,'director.js')).read()

async def boot(p,w,h,scale,uid):
    b,pg,errs=await open_game(p,w,h,scale=scale,init=INIT,user={'id':uid,'username':'LunarPilot','first_name':'Lunar'})
    for i in range(400):
        r=await pg.evaluate("()=>{window.__VT+=33.3;const q=window.__rafq;window.__rafq=[];q.forEach(f=>f(window.__VT));return typeof R3!=='undefined'&&(R3.ready||R3.failed)}")
        if r: break
        await pg.wait_for_timeout(40)
    await pg.evaluate(DIRJS)
    await pg.add_style_tag(content='#toast{display:none!important}')
    return b,pg,errs

async def run_shot(pg,name,S,out):
    d=os.path.join(out,name);os.makedirs(d,exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d,f))
    await pg.evaluate("()=>{DIR.cam=null;DIR.camf=null;DIR.pre=null;DIR.hud=true;DIR.ai=true;DIR.nonum=false;}")
    await pg.evaluate("()=>{"+S['setup']+"}")
    if S.get('warm'): await pg.evaluate("(s)=>DIR.sim(s)",S['warm'])
    if S.get('after'): await pg.evaluate("()=>{"+S['after']+"}")
    if S.get('wait'): await pg.wait_for_timeout(S['wait'])
    n=S['frames'];dt=S.get('dt',1/30);ev=S.get('events',{})
    t0=time.time()
    for i in range(n):
        if i in ev: await pg.evaluate("()=>{"+ev[i]+"}")
        if S.get('kind')=='menu':
            await pg.evaluate("(dt)=>{window.__VT+=dt*1000;"+S.get('each','')+";const q=window.__rafq;window.__rafq=[];q.forEach(f=>f(window.__VT));}",dt)
        else:
            await pg.evaluate("(a)=>{DIR.frameIdx=a[1];"+S.get('each','')+";DIR.step(a[0]);}",[dt,i])
        await pg.screenshot(path=os.path.join(d,'%05d.jpg'%i),type='jpeg',quality=94)
    json.dump({'fps':round(1/dt),'frames':n,'sim_dt':dt},open(os.path.join(d,'meta.json'),'w'))
    print(name,n,'frames',round(time.time()-t0,1),'s',flush=True)

async def main():
    out=sys.argv[1];want=set(sys.argv[2:])
    start_dev()
    async with async_playwright() as p:
        bt=[k for k in BATTLE if not want or k in want]
        mn=[k for k in MENU if not want or k in want]
        if bt:
            b,pg,errs=await boot(p,540,960,2,880901)
            for k in bt: await run_shot(pg,k,BATTLE[k],out)
            print('battle errors',errs[:4]);await b.close()
        if mn:
            b,pg,errs=await boot(p,360,640,3,880902)
            for k in mn: await run_shot(pg,k,MENU[k],out)
            print('menu errors',errs[:4]);await b.close()
asyncio.run(main())
