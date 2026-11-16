"""Session 6 owner fix (Nov 16): the Sortie chain meter and the after-action chain line on the shipped client, real Worker reducer.
At 390x844 (touch), 320x568 (touch), 1366x768 and 1920x1080 (keyboard): a pilot with a live two-link chain (scenario placement:
the chain record only) reads "SORTIE CHAIN ●●○ · NEXT WIN 20% BONUS ITEM · m:ss" inside the screen, then wins HOLD THE OXYGEN LINE
through the Worker and reads the chain line on the after-action ("SORTIE CHAIN ×2 · BONUS ITEM: ..." or "... 20% BONUS ITEM ROLL ·
NONE THIS TIME"), inside the result card. Captures: docs/conquest/session6/journey-chain-hud-WxH.png, journey-aar-chain-WxH.png;
report docs/conquest/session6/chain.json."""
import asyncio,importlib.util,json,pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('journey6',ROOT/'dev/tests/conquest-session6-journey.py');J=importlib.util.module_from_spec(spec);spec.loader.exec_module(J)
from playwright.async_api import async_playwright
OUT=ROOT/'docs/conquest/session6'
HUD=re.compile(r'^SORTIE CHAIN ●●○ · NEXT WIN 20% BONUS ITEM · \d+:\d\d$')
AAR=re.compile(r'^SORTIE CHAIN ×2 · (BONUS ITEM: (REPAIR KIT|SHIELD CELL|SCANNER CHARGE|DECOY BEACON)( \(STORAGE FULL\))?|20% BONUS ITEM ROLL · NONE THIS TIME)$')
INSIDE='''sel=>{const e=document.querySelector(sel);if(!e)return {found:false};const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
 return {found:true,text:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,inside:r.width>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,
  oneLine:r.height<=parseFloat(cs.lineHeight||'14')*1.6+2||e.scrollWidth<=e.clientWidth+1,clipped:e.scrollWidth>e.clientWidth+1};}'''
async def size(pw,w,h,mobile,report):
    R=J.Run(f'chain-{w}x{h}');srv=await J.Server().start(pw);P=J.Pilot(pw,srv,w,h,mobile,R.name,onboarded=True,out=OUT);res={'size':f'{w}x{h}','touch':mobile}
    try:
        await P.open();gv=await P.js('PVP_V')
        await srv.fixture({'chain':2});await P.enter();await P.ready()
        await P.page.wait_for_function('(document.querySelector(".cq-chain")?.textContent||"").startsWith("SORTIE CHAIN")',timeout=30000)
        hud=await P.js(INSIDE,'.cq-chain');res['hud']=hud
        R.check('hud-meter-copy',bool(HUD.match(hud.get('text',''))),hud.get('text'))
        R.check('hud-meter-inside-screen',hud.get('inside') and not hud.get('clipped'),hud)
        fit=await P.js('__J.hudFit()');res['hudFit']=fit;R.check('hud-fits',not fit['count'] and not fit['overflowX'],fit)
        res['hudCapture']=await P.shot('chain-hud')
        st=await srv.inspect();R.check('server-chain-two-links',(st.get('chain') or {}).get('n')==2,st.get('chain'))
        btn=await P.start_mission('oxygen-line','HOLD THE OXYGEN LINE');f=await P.fight('oxygen-line');res['fight']={k:f.get(k) for k in ['result','seconds','kills']}
        R.check('won-oxygen-line',f['result']=='victory',res['fight'])
        page=P.page;await page.wait_for_selector('.cq-result',timeout=90000)
        await page.wait_for_function('!document.querySelector(".cq-aar[data-pending]")&&!!document.querySelector(".cq-aar-chain")',timeout=60000)
        await page.wait_for_timeout(700)
        await page.locator('.cq-aar-chain').scroll_into_view_if_needed()
        line=await P.js(INSIDE,'.cq-aar-chain');res['aar']=line
        R.check('aar-chain-copy',bool(AAR.match(line.get('text',''))),line.get('text'))
        R.check('aar-chain-inside-screen',line.get('inside') and not line.get('clipped'),line)
        st=await srv.inspect();rc=(st.get('notice') or {}).get('chain') or {}
        res['receiptChain']=rc
        res['aarCapture']=await P.shot('aar-chain')
        res['errors']=P.errors;R.check('no-page-errors',not P.errors,P.errors)
    finally:
        await P.close();await srv.stop()
    report['runs'][R.name]={**res,'checks':R.checks};return R
async def main():
    report={'scope':__doc__.strip().split('\n')[0],'runs':{}};runs=[]
    async with async_playwright() as pw:
        for w,h,mobile in [(390,844,True),(320,568,True),(1366,768,False),(1920,1080,False)]:runs.append(await size(pw,w,h,mobile,report))
    fails=[{'run':R.name,**f} for R in runs for f in R.failures];report['status']='PASS' if not fails else 'FAIL';report['failures']=fails
    (OUT/'chain.json').write_text(json.dumps(report,indent=1,ensure_ascii=False,default=str)+'\n')
    print(json.dumps({'status':report['status'],'failures':fails},ensure_ascii=False,default=str)[:3000]);sys.exit(0 if not fails else 1)
if __name__=='__main__':asyncio.run(main())
