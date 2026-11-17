# Weather frame cost (Session 5E-2e): the same seeded match, drawn clear and with hazard + vision, on a phone and a desktop
# view, HIGH and LOW. Prints the median frame time and the draw calls of each. The test browser draws WebGL on the CPU, so the
# numbers are RELATIVE only (owner rule, Nov 13): what matters is the weather's cost next to the clear match, not the value.
#   python3 dev/tests/weather-perf.py [--maps classic,canyon,...]
import os, asyncio, sys, json, argparse
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('--maps',default='classic,overpass,longshot,craters,canyon,bunker');A=ap.parse_args()
RUN="""([map,k,q])=>{setGfx(q);let s=1;while(wxRoll(s).k!==k)s++;window.LUNAR_WX=s;closeAll();save.gtype='bounty';save.mode='2v2';save.map=map;store();__seedAll(77);prepareMatch();startMatch();paused=true;banner=null;
 if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}
 const T=[];let calls=0,n=0;
 while(elapsed<34&&state==='play'){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);
  if(elapsed>12&&(n++%3)===0){const t0=performance.now();drawBattle();RR.getContext().finish();T.push(performance.now()-t0);calls=Math.max(calls,R3.calls||0);}}
 T.sort((a,b)=>a-b);const r={ms:+T[T.length>>1].toFixed(2),p90:+T[Math.floor(T.length*0.9)].toFixed(2),calls,frames:T.length,k:wx?wx.P.k:0};paused=false;state='menu';exitBattle();return r;}"""
async def run(p,name,w,h,scale):
    b,pg,errs=await open_game(p,w,h,scale=scale,init="window.LUNAR_NO_AUTOGFX=1;")
    await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=30000)
    await pg.evaluate("()=>{save.welcomed=true;save.mp=5;save.wxTip={meteor:3,train:3,arc:3,vent:3,tornado:3,laser:3};store();closeAll();window.__seedAll=(s)=>{let a=s;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};}")
    await pg.wait_for_timeout(1000)
    for q in ('high','low'):
        for mp in A.maps.split(','):
            c=await pg.evaluate(RUN,[mp,0,q]);v=await pg.evaluate(RUN,[mp,3,q])
            print(name,q,mp.ljust(9),'clear %.2f ms (%d calls) | weather %.2f ms (%d calls) | +%.0f%%, +%d calls'%(c['ms'],c['calls'],v['ms'],v['calls'],(v['ms']/c['ms']-1)*100,v['calls']-c['calls']),flush=True)
    print(name,'errors',errs[:5]);await b.close()
async def main():
    start_dev()
    async with async_playwright() as p:
        await run(p,'phone 390x844',390,844,2)
        await run(p,'desktop 1920x1080',1920,1080,1)
asyncio.run(main())
