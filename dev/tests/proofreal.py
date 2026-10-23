# Proof of play against real matches: plays AI matches in the browser in every mode, team size and map, driving your
# tank through the joystick like a finger would (the bot AI picks where to go), with a stock and a maxed tank. Each
# match's record goes through the server's own check (worker/src/proof.js, via proofcheck.mjs). Every real match has
# to pass, and none may look like "nobody on the controls". Also prints the signal spread, to set the flag thresholds.
# python3 dev/tests/proofreal.py [matches per combo, default 1]
import os, asyncio, sys, json, subprocess
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
N=int(sys.argv[1]) if len(sys.argv)>1 else 1
PLAY="""(c)=>{
 window.__res=null;const ME=window.matchEnd;window.matchEnd=r=>{window.__res=r;};
 save.gfx='2d';if(typeof apply3D==='function')apply3D();
 closeAll();save.gtype=c.g;save.mode=c.m;save.map=c.map;save.mp=c.mp;
 if(c.max){save.up={hull:4,cannon:4,engine:2,target:2,reactor:2};}else save.up={hull:0,cannon:0,engine:0,target:0,reactor:0};
 store();prepareMatch();startMatch();
 if(!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}
 const dt=1/30;let t=0,sim=0;
 while(t<1200){
  if(state==='round'){startRound();continue;}
  if(state!=='play')break;
  if(me.hp>0&&me.ctl==='me'&&!me.dash){const x0=me.x,y0=me.y;botAI(dt,me);const dx=me.x-x0,dy=me.y-y0;me.x=x0;me.y=y0;
   const k=STAT.speed*spdMult(me)*(me.sup?0.6:1)*slowAt(me)*dt||1;let jx=dx/k,jy=dy/k;const m=Math.hypot(jx,jy);if(m>1){jx/=m;jy/=m;}
   joy.on=m>0.02;joy.dx=jx;joy.dy=jy;}
  else{joy.on=false;joy.dx=joy.dy=0;}
  update(dt);fxTick(dt);t+=dt;sim+=dt;
 }
 joy.on=false;joy.dx=joy.dy=0;
 window.matchEnd=ME;
 const r=window.__res;if(!r)return {err:'noend',state};
 const tk=tankOf(myLoadout(),1);
 return {c:{g:matchG,m:matchG==='royale'?'1v1':c.m,map:curMap,secs:Math.round(sim)+5,won:!!r.won,drawn:!!r.drawn,place:r.place||0,series:!!MM.series,spdM:tk.spdM,st:r.stats},pf:r.pf};
}"""
async def main():
    start_dev()
    recs=[]
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,390,740)
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=20000)
        await pg.evaluate("()=>{save.welcomed=true;closeAll();window.onMatchEnd=window.onMatchEnd;}")
        combos=[]
        for g in ['arena','zone','crystal','bounty','royale','boss']:
            for m in (['1v1'] if g=='royale' else ['1v1','2v2','3v3']):
                for mp in ['classic','overpass','longshot','craters']:
                    combos.append((g,m,mp))
        i=0
        for rep in range(N):
            for (g,m,mp) in combos:
                i+=1
                r=await pg.evaluate(PLAY,{'g':g,'m':m,'map':mp,'mp':5 if i%2 else 0,'max':bool(i%3==0)})
                if r.get('err'): print('no result',g,m,mp,r);continue
                recs.append(r)
        print('matches',len(recs),'page errors',errs[:3])
        await b.close()
    path=os.environ.get('PROOF_OUT','/tmp/proofreal.json')
    json.dump(recs,open(path,'w'))
    out=subprocess.run(['node',os.path.join(HERE,'wtest','proofcheck.mjs'),path],capture_output=True,text=True)
    print(out.stdout[-6000:],out.stderr[-2000:])
    sys.exit(out.returncode)
asyncio.run(main())
