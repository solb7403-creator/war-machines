# Arcade map cost (Session 5E-2c): frame time, draw cost and map build time per map, HIGH and LOW, on a phone profile
# (390x844, CPU throttled 4x) and a desktop profile (1920x1080). Run it on two checkouts to compare:
#   REPO=/path/to/main python3 dev/tests/arena-perf.py --out main.json
#   python3 dev/tests/arena-perf.py --out branch.json
# The test browser draws WebGL on the CPU (SwiftShader): frame times are for comparing two builds on the same machine,
# they are not phone frame rates. --real lifts the game's 1x software clamp (3x phone canvas) to stress fill cost.
import os, asyncio, sys, json, argparse, pathlib
REPO=os.environ.get('REPO',os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')))
sys.path.insert(0,REPO+'/dev/tests')
from harness import open_game, start_dev
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('--out',default='');ap.add_argument('--maps',default='classic,overpass,longshot,craters,canyon,bunker');ap.add_argument('--devices',default='phone,desk');ap.add_argument('--quality',default='high,low');ap.add_argument('--real',action='store_true');ap.add_argument('--frames',type=int,default=150)
A=ap.parse_args()
async def ov(u):
    if A.real and u.split('?')[0].endswith('js/graphics.js'):
        return ((pathlib.Path(REPO)/'js/graphics.js').read_text().replace("function software(){","function software(){return false;").encode(),'application/javascript')
    return None
BOT="if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}"
RUN="""async(a)=>{const [mp,N]=a;closeAll();save.gtype='arena';save.mode='3v3';save.map=mp;store();
 const t0=performance.now();prepareMatch();startMatch();document.body.classList.add('battle');fit();drawBattle();RR.getContext().finish();const build=performance.now()-t0;
 """+BOT+"""
 paused=true;   // the sim is stepped here, at a fixed rate, so both builds draw the same kind of fight
 for(let i=0;i<120;i++){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);}
 const iv=[],dr=[],calls=[];let tris=0,last=0;
 await new Promise(done=>{let n=0;const f=t=>{if(last)iv.push(t-last);last=t;if(me.hp>0)botAI(1/60,me);update(1/60);fxTick(1/60);const a=performance.now();drawBattle();dr.push(performance.now()-a);calls.push(R3.calls);tris=Math.max(tris,RR.info.render.triangles);if(++n<N)requestAnimationFrame(f);else done();};requestAnimationFrame(f);});
 const q=(x,p)=>{const s=x.slice().sort((a,b)=>a-b);return +s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(2);};
 const r={map:mp,q:R3.q,pr:RR.getPixelRatio(),frame:q(iv,.5),frameP95:q(iv,.95),fps:+(1000/q(iv,.5)).toFixed(1),draw:q(dr,.5),drawP95:q(dr,.95),calls:q(calls,.5),callsMax:q(calls,1),tris,progs:RR.info.programs.length,buildMs:Math.round(build),arena:!!(B3.map&&B3.map.arena)};
 paused=false;state='menu';document.body.classList.remove('battle');exitBattle();return r;}"""
async def main():
    start_dev();out=[]
    async with async_playwright() as p:
        for dev in A.devices.split(','):
            w,h,scale,thr=(390,844,3,4) if dev=='phone' else (1920,1080,1,1)
            b,pg,errs=await open_game(p,w,h,scale=scale,init="window.LUNAR_NO_AUTOGFX=1;"+("window.LUNAR_SOFT_GL=false;" if A.real else ""),override=ov)
            await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=30000)
            await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();window.onMatchEnd=()=>{};}")
            cdp=await pg.context.new_cdp_session(pg);await cdp.send('Emulation.setCPUThrottlingRate',{'rate':thr})
            for q in A.quality.split(','):
                await pg.evaluate("(g)=>setGfx(g)",q);await pg.wait_for_timeout(800)
                for mp in A.maps.split(','):
                    r=await pg.evaluate(RUN,[mp,A.frames]);r['device']=dev;out.append(r);print(json.dumps(r))
            print('errors',errs[:4]);await b.close()
    if A.out:open(A.out,'w').write(json.dumps(out,indent=1)+'\n')
asyncio.run(main())
