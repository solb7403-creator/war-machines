# Load cost up to the first Arcade match (Session 5E-2c): what the page downloads and how long the device works before the
# first battle frame is on screen. Run it on two checkouts to compare:
#   REPO=/path/to/main python3 dev/tests/arena-load.py --out main.json ;  python3 dev/tests/arena-load.py --out branch.json
# Files come from the local checkout (no network), so download TIME is modelled from the gzip-9 size of text files and the
# raw size of binary files at two link speeds; the device time is measured (phone profile: CPU throttled 4x).
import os, asyncio, sys, json, argparse, pathlib, gzip
REPO=os.environ.get('REPO',os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')))
sys.path.insert(0,REPO+'/dev/tests')
from harness import open_game, start_dev
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('--out',default='');ap.add_argument('--map',default='classic');ap.add_argument('--real',action='store_true');A=ap.parse_args()
TEXT=('.js','.css','.html','.json','.svg','.txt')
async def ov(u):
    if A.real and u.split('?')[0].endswith('js/graphics.js'):
        return ((pathlib.Path(REPO)/'js/graphics.js').read_text().replace("function software(){","function software(){return false;").encode(),'application/javascript')
    return None
async def run(p,dev):
    w,h,scale,thr=(390,844,3,4) if dev=='phone' else (1920,1080,1,1)
    b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    seen=[]
    def onreq(r):
        u=r.url
        if u.startswith('http://127.0.0.1:8899/'):seen.append(u.split(':8899/',1)[1].split('?',1)[0])
    init="window.LUNAR_NO_AUTOGFX=1;window.__t0=performance.now();"+("window.LUNAR_SOFT_GL=false;" if A.real else "")
    # open_game navigates and waits 1.5 s; the clock below starts in the page itself
    import harness
    _,pg,errs=await open_game(p,w,h,scale=scale,browser=b,init=init,override=ov)
    pg.on('request',onreq)
    cdp=await pg.context.new_cdp_session(pg);await cdp.send('Emulation.setCPUThrottlingRate',{'rate':thr})
    await pg.reload();await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)&&typeof prepareMatch==='function'",timeout=60000)
    ready=await pg.evaluate("()=>performance.now()-window.__t0")
    r=await pg.evaluate("""async(mp)=>{save.welcomed=true;save.mp=5;closeAll();save.gtype='arena';save.mode='2v2';save.map=mp;store();
      const t0=performance.now();prepareMatch();startMatch();drawBattle();RR.getContext().finish();const first=performance.now()-t0;
      // the tanks' models stream in: wait until the scene has stopped changing for 30 frames (or 15 s)
      let t=performance.now(),same=0,last=-1;paused=true;await new Promise(done=>{const f=()=>{drawBattle();const n=RR.info.render.triangles;same=n===last?same+1:0;last=n;if(same>=30||performance.now()-t>15000)done();else requestAnimationFrame(f);};requestAnimationFrame(f);});paused=false;
      return {firstFrameMs:Math.round(first),settledMs:Math.round(performance.now()-t0),arena:!!(B3.map&&B3.map.arena),bake:B3.map&&B3.map.stats?B3.map.stats.bake:null};}""",A.map)
    files=sorted(set(seen));raw=0;wire=0;big=[]
    for f in files:
        fp=pathlib.Path(REPO)/f
        if not fp.is_file():continue
        d=fp.read_bytes();n=len(d);z=len(gzip.compress(d,9)) if f.endswith(TEXT) else n;raw+=n;wire+=z;big.append((z,f))
    big.sort(reverse=True)
    out={'device':dev,'requests':len(files),'rawBytes':raw,'wireBytes':wire,'readyMs':round(ready),**r,'at9Mbps_s':round(wire*8/9e6,2),'at1_6Mbps_s':round(wire*8/1.6e6,2),'largest':[(f,z) for z,f in big[:6]],'mapFiles':[(f,len(gzip.compress((pathlib.Path(REPO)/f).read_bytes(),9))) for f in files if any(k in f for k in ('mapenv','arena3d','arenaprops'))]}
    print(json.dumps(out));print('errors',errs[:3]);await b.close();return out
async def main():
    start_dev();res=[]
    async with async_playwright() as p:
        for d in ('phone','desk'):res.append(await run(p,d))
    if A.out:open(A.out,'w').write(json.dumps(res,indent=1)+'\n')
asyncio.run(main())
