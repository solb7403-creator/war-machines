"""Session 5E-2b2b: the cost of a frame with a jackpot super filling the view, on the software renderer (a RELATIVE check
between two builds on the same machine: not a phone frame rate). The frame loop is stopped; for each super the scene of
super-vfx-capture.py is set up, the super is fired with a jackpot, and the frame 0.1 s after it lands is drawn 12 times with
a one-pixel readback (so the renderer has to finish it); the median is reported next to the same scene with no effect on screen.
usage: [REPO=<another checkout>] python3 dev/tests/super-frame-time.py [out.json] [--quality high|low] [--only siege2,moon]
"""
import asyncio, json, os, sys
REPO=os.environ.get('REPO',os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')))
sys.path.insert(0,REPO+'/dev/tests')
from harness import start_dev, open_game
from playwright.async_api import async_playwright
QUALITY=sys.argv[sys.argv.index('--quality')+1] if '--quality' in sys.argv else 'high'
OUT=next((a for a in sys.argv[1:] if a.endswith('.json')),None)
KEYS=['pulse0','pulse2','twin0','twin2','siege0','siege2','moon']
if '--only' in sys.argv:KEYS=sys.argv[sys.argv.index('--only')+1].split(',')   # one super only (a fix to one super is checked alone)
SCENE='''([key,quality])=>{
 const arch=key==='moon'?'moon':key.slice(0,-1),tier=key==='moon'?2:+key.slice(-1);
 window.myLoadout=()=>({w:{a:arch,t:tier,q:1,s:false},c:{c:'vanguard',t:Math.min(2,tier),q:1,s:false},up:{hull:0,cannon:0,engine:0,target:0,reactor:0},cores:['dmg','rof','arm'],gl:{},skin:'default',paint:'stock'});
 save.mp=50;save.mode='1v1';save.gtype='arena';save.map='craters';save.sound=false;if(gfxMode()!==quality)setGfx(quality);
 closeAll();prepareMatch();startMatch();window.requestAnimationFrame=()=>0;
 const e=units.find(u=>u.team!==me.team);walls.length=0;rocks.length=0;
 const put=(u,x,y)=>{u.x=x;u.y=y;u.px=x;u.py=y;u.ox=x;u.oy=y;u.sx=x;u.sy=y;u.vx=u.vy=0;u.avx=u.avy=0;u.claim=null;};
 put(me,10,21);put(e,10.5,arch==='twin'?19.2:17.5);e.hum=true;e.ctl='net';e.mhp=e.hp=9e5;me.ang=-Math.PI/2;me.hd=-Math.PI/2;timeLeft=85;
 window.__step=(n)=>{for(let i=0;i<n;i++){me.cd=99;e.cd=99;timeLeft=85;update(1/30);fxTick(1/30);}nums.length=0;pops.length=0;drawBattle();return {sup:!!me.sup,shells:shells.length};};
 window.__time=(n)=>{const gl=RR.getContext(),px=new Uint8Array(4),ts=[];for(let i=0;i<n;i++){const t0=performance.now();drawBattle();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);ts.push(performance.now()-t0);}ts.sort((a,b)=>a-b);return +ts[n>>1].toFixed(1);};
 return true;}'''
async def main():
    start_dev();res={}
    async with async_playwright() as p:
        for name,(w,h) in (('phone',(390,844)),('desktop',(1920,1080))):
            b,pg,errs=await open_game(p,w,h,scale=1)
            await pg.wait_for_function('typeof prepareMatch==="function"&&typeof save!=="undefined"',timeout=60000)
            await pg.evaluate('closeAll();save.welcomed=true;uiDirty();')
            try:await pg.wait_for_function('typeof use3D==="function"&&(R3.ready||R3.failed)',timeout=90000)
            except Exception:pass
            for key in KEYS:
                await pg.evaluate(SCENE,[key,QUALITY])
                for _ in range(40):await pg.evaluate('__step(1)')
                idle=await pg.evaluate('__time(12)')
                await pg.evaluate('(()=>{me.sp=SUPER_MAX;me.supN=0;useSuper(me,-Math.PI/2);supEnd(me,2);})()')
                fired=False
                for _ in range(90):
                    st=await pg.evaluate('__step(1)')
                    if not st['sup'] and st['shells']==0:fired=True;break
                await pg.evaluate('__step(3)');ms=await pg.evaluate('__time(12)')
                res[name+' '+key]={'idle':idle,'jackpot':ms,'fired':fired};print(name,key,'idle',idle,'ms  jackpot',ms,'ms',flush=True)
            res[name+' errors']=errs;await b.close()
    if OUT:json.dump(res,open(OUT,'w'),indent=1)
asyncio.run(main())
