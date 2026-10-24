import os,sys,asyncio,time
sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','tests'))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
OUT='/tmp/claude-0/-home-claude/fdd4a0b8-9b50-504b-a004-d2077330667b/scratchpad/proto/';os.makedirs(OUT,exist_ok=True)
INIT="""window.LUNAR_NO_AUTOGFX=1;window.__VT=1000;performance.now=()=>window.__VT;
window.__rafq=[];window.requestAnimationFrame=f=>{window.__rafq.push(f);return 1;};"""
async def main():
    start_dev()
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,540,960,scale=2,init=INIT)
        # pump boot frames until 3D is ready
        for i in range(200):
            r=await pg.evaluate("()=>{window.__VT+=33.3;const q=window.__rafq;window.__rafq=[];q.forEach(f=>f(window.__VT));return typeof R3!=='undefined'&&(R3.ready||R3.failed)}")
            if r:break
            await pg.wait_for_timeout(50)
        print('3D',await pg.evaluate("()=>({ready:R3.ready,failed:R3.failed})"))
        await pg.evaluate("()=>{save.welcomed=true;save.mp=40;store();closeAll();save.gtype='arena';save.mode='3v3';save.map='overpass';prepareMatch();startMatch();}")
        t0=time.time()
        for i in range(60):
            await pg.evaluate("()=>{window.__VT+=1000/30;if(me&&me.hp>0){if(!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};}botAI(1/30,me);}const q=window.__rafq;window.__rafq=[];q.forEach(f=>f(window.__VT));frame(window.__VT);window.__rafq=[];}")
            if i%10==0: await pg.screenshot(path=OUT+f'f{i:03d}.jpg',type='jpeg',quality=92)
        print('60 steps+6 shots',time.time()-t0)
        t0=time.time()
        for i in range(10): await pg.screenshot(path=OUT+f's{i}.jpg',type='jpeg',quality=92)
        print('10 shots',time.time()-t0, errs[:3])
asyncio.run(main())
