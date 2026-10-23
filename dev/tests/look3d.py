# quick visual check of the 3D view: a battle on each map, the garage and the shop (screenshots only)
import os, asyncio, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/look3d/';os.makedirs(OUT,exist_ok=True)
async def main():
    start_dev()
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,390,740,init="window.LUNAR_NO_AUTOGFX=1;")
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=15000)
        print('3D', await pg.evaluate("()=>({ready:R3.ready,failed:R3.failed,GK})"))
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();uiDirty();}")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=OUT+'play.png')
        for mp,gt,md in [('classic','arena','2v2'),('overpass','zone','2v2'),('longshot','crystal','2v2'),('craters','royale','1v1'),('classic','zone','3v3'),('craters','bounty','2v2'),('classic','boss','2v2')]:
            await pg.evaluate("(c)=>{closeAll();save.gtype=c[1];save.mode=c[2];save.map=c[0];store();prepareMatch();startMatch();}",[mp,gt,md])
            await pg.evaluate("()=>{if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}for(let i=0;i<150;i++){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);}}")
            for i in range(25):
                await pg.evaluate("()=>{if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);drawBattle();}")
            await pg.screenshot(path=OUT+'battle_'+mp+'_'+gt+'.png')
            await pg.evaluate("()=>{state='menu';exitBattle();}")
        await pg.evaluate("()=>{save.gtype='arena';save.mode='2v2';save.map='classic';store();beginMatch();}");await pg.wait_for_timeout(900)
        await pg.screenshot(path=OUT+'vs.png')
        await pg.evaluate("()=>{closeAll();state='menu';exitBattle();}")
        await pg.evaluate("()=>setTab('garage')");await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT+'garage.png')
        await pg.evaluate("()=>setTab('shop')");await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT+'shop.png',full_page=True)
        print('errors',errs[:5])
        print('calls',await pg.evaluate("()=>R3.calls"))
        await b.close()
asyncio.run(main())
