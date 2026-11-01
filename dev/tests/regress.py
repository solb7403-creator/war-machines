import os, asyncio, json, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
from playwright.async_api import async_playwright
SIM="""(cfg)=>{
 const R0={n:0,len:0,win:0,stuck:0,deck:0,pts:0};
 for(let k=0;k<cfg.n;k++){
  save.dailyPts=0;save.gtype=cfg.g;save.mode=cfg.m;save.map=cfg.map;newMatch();
  me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;
  let t=0;
  while((state==='play'||state==='round')&&t<400){
   if(state==='round'){startRound();continue;}
   if(me.hp>0)botAI(1/30,me);
   if(me.sp>=SUPER_MAX&&me.hp>0){const e=nearestFoe(me);if(e&&Math.hypot(e.x-me.x,e.y-me.y)<8)useSuper(me);}
   for(const u of units){if(u.hp<=0)continue;
    if((u.elev||0)===0&&walls.some(([x,y,w,h])=>u.x>x+0.05&&u.x<x+w-0.05&&u.y>y+0.05&&u.y<y+h-0.05))R0.stuck++;
    if((u.elev||0)===0&&rocks.some(([x,y,r])=>Math.hypot(u.x-x,u.y-y)<r-0.05))R0.stuck++;
    if(u.elev===1){R0.deck+=1/30;if(!upOk(u.x,u.y))R0.stuck++;}}
   update(1/30);t+=1/30;
  }
  R0.n++;R0.len+=t;R0.win+=lastResult.won?1:0;R0.pts+=lastResult.pts;   // before the daily cap
 }
 state='menu';
 return {n:R0.n,avgLen:Math.round(R0.len/R0.n),winRate:Math.round(R0.win/R0.n*100),stuck:R0.stuck,deck:Math.round(R0.deck),ptsPerMin:Math.round(R0.pts/((R0.len+10*R0.n)/60))};
}"""
async def main():
    harness.start_dev()
    n=int(sys.argv[1]) if len(sys.argv)>1 else 4
    async with async_playwright() as p:
        b,pg,errs=await harness.open_game(p)
        await pg.evaluate("()=>{window.syncPlayer=()=>{};window.onMatchEnd=()=>{};window.onMatchStart=()=>{};window.onRoundEnd=()=>{};window.onRoundStart=()=>{};save.mp=50;}")
        for g in ['arena','zone','crystal','bounty','royale']:
            for m in (['1v1'] if g=='royale' else ['1v1','2v2','3v3']):
                for mp in ['classic','overpass','longshot','craters','canyon','bunker']:
                    r=await pg.evaluate(SIM,{'g':g,'m':m,'map':mp,'n':n})
                    print(g,m,mp,json.dumps(r),flush=True)
        print('errors',errs)
        print('note: today\'s featured mode pays x1.25, so its points per minute read 25% high')
        await b.close()
asyncio.run(main())
