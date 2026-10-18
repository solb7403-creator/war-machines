# clean screenshots (no toasts) of the main screens for reports
import os, asyncio, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else os.environ.get('SHOTS','/tmp/lunar-shots')+'/b2/'
async def run(p,w,h,tag,uid):
    b,pg,errs=await open_game(p,w,h,scale=2,user={'id':uid,'username':'pilot'+str(uid),'first_name':'Test'})
    await pg.add_style_tag(content='#toast{display:none!important}')
    await pg.evaluate("()=>{save.welcomed=true;save.mp=6;save.wins=4;save.losses=2;save.pts=4200;save.earned=12650;save.login={last:dayNum()-1,n:3};save.up.hull=2;save.up.cannon=1;store();closeAll();uiDirty();}")
    await pg.wait_for_timeout(500)
    for t in ['play','garage','shop','quests','ranks']:
        await pg.evaluate("(t)=>setTab(t)",t);await pg.wait_for_timeout(450)
        await pg.screenshot(path=OUT+'clean_'+tag+'_'+t+'.png')
    print(tag,'errors',errs[:4]);await b.close()
async def main():
    start_dev()
    async with async_playwright() as p:
        await run(p,390,740,'i14',880101)
        await run(p,375,590,'se',880102)
asyncio.run(main())
