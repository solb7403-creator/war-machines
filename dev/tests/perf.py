import os, asyncio, json, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
from playwright.async_api import async_playwright
JS="""(st)=>{
 const [g,m,mp]=st.split(':');save.gtype=g;save.mode=m;save.map=mp;newMatch();for(let i=0;i<300;i++)update(1/60);
 let tu=[],td=[];
 for(let i=0;i<120;i++){let a=performance.now();update(1/60);tu.push(performance.now()-a);a=performance.now();drawBattle();td.push(performance.now()-a);}
 const med=x=>{x.sort((a,b)=>a-b);return +x[60].toFixed(2)};const p95=x=>+x[114].toFixed(2);
 return {st,update:med(tu),updateP95:p95(tu),draw:med(td),drawP95:p95(td)};
}"""
GARAGE="""()=>new Promise(done=>{
 if(!(gShowroom&&gShowroom.renderer))return done({error:'no live showroom'});
 const iv=[],dr=[];let last=performance.now(),n=0;
 const f=t=>{iv.push(t-last);last=t;if(++n<180)requestAnimationFrame(f);else{
  for(let i=0;i<60;i++){const a=performance.now();gShowroom.draw();dr.push(performance.now()-a);}
  const q=(x,p)=>{x.sort((a,b)=>a-b);return +x[Math.floor(x.length*p)].toFixed(2);};
  done({st:'garage-showroom',frame:q(iv.slice(10),.5),frameP95:q(iv.slice(10),.95),showroomDraw:q(dr,.5),showroomDrawP95:q(dr,.95)});}};
 requestAnimationFrame(f);})"""
async def main():
    harness.start_dev()
    async with async_playwright() as p:
        b,pg,errs=await harness.open_game(p)
        await pg.evaluate("()=>{window.onMatchEnd=()=>{};document.body.classList.add('battle');fit();}")
        cdp=await pg.context.new_cdp_session(pg)
        if sys.argv[1:]==['garage']:   # the garage with its live 3D showroom: frame intervals and the showroom's own draw cost
            await pg.evaluate("()=>{document.body.classList.remove('battle');save.welcomed=true;closeAll();setGfx('high');setTab('garage');}");await pg.wait_for_timeout(1500)
            await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
            print(json.dumps({'phase':'spinning',**await pg.evaluate(GARAGE)}))
            await pg.wait_for_timeout(8500)   # 8 s after the last touch the stage settles and stops drawing
            print(json.dumps({'phase':'settled',**await pg.evaluate(GARAGE)}));print('errors',errs);await b.close();return
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        for st in sys.argv[1:] or ['arena:1v1:classic','arena:3v3:overpass','zone:3v3:overpass','zone:3v3:classic','arena:3v3:longshot','crystal:3v3:overpass','bounty:3v3:craters','royale:1v1:classic','zone:3v3:canyon','arena:3v3:bunker']:
            print(json.dumps(await pg.evaluate(JS,st)))
        print('errors',errs)
        await b.close()
asyncio.run(main())
