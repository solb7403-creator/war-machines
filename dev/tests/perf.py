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
async def main():
    harness.start_dev()
    async with async_playwright() as p:
        b,pg,errs=await harness.open_game(p)
        await pg.evaluate("()=>{window.onMatchEnd=()=>{};document.body.classList.add('battle');fit();}")
        cdp=await pg.context.new_cdp_session(pg)
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        for st in sys.argv[1:] or ['arena:1v1:classic','arena:3v3:overpass','zone:3v3:overpass','zone:3v3:classic','arena:3v3:longshot','crystal:3v3:overpass','bounty:3v3:craters','royale:1v1:classic','zone:3v3:canyon','arena:3v3:bunker']:
            print(json.dumps(await pg.evaluate(JS,st)))
        print('errors',errs)
        await b.close()
asyncio.run(main())
