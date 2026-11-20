"""The Command Base in the real game and Worker, from a disclosed rich-bank fixture (a fully built town).
No combat or victory proof is inferred from these authored visual states.
Session 5E-2d1: --quality high|low (default low), --out DIR, and --mouse = a keyboard-and-mouse computer (no touch). The base is
captured from above and from beside its wall, and the map is opened, at 390x844, 320x568, 390x700 and 430x932 (touch) or at
1366x768 and 1920x1080 (--mouse). The base is claimed and upgraded in the town now, so nothing is built step by step here.
"""
import asyncio,json,pathlib,shutil,argparse
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('--quality',default='low');ap.add_argument('--out',default='');ap.add_argument('--mouse',action='store_true');A=ap.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path(A.out) if A.out else ROOT/'docs/conquest-session-2/presentation';W0,H0=(1366,768) if A.mouse else (390,844)
async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs','--preview',cwd=ROOT,stdout=asyncio.subprocess.PIPE,env={**__import__('os').environ,'CQ_PREVIEW_PORT':'8791'})
 ready=json.loads(await server.stdout.readline());evidence=[]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);page=await browser.new_page(viewport={'width':W0,'height':H0},is_mobile=not A.mouse,has_touch=not A.mouse,reduced_motion='reduce');page.set_default_timeout(240000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   # Session 5E-2d1: the base is claimed and upgraded in the town now (the old "CONSTRUCT BASE I" terminal is gone), on timers.
   # The fixture hands the pilot a fully built town (the same one conquest-town-captures.py uses): the world then draws the
   # Command Base with that town's model on its pad.
   await page.request.post('http://127.0.0.1:8791/fixture',data={'position':[1080,1160],'baseFunds':True,'plotFull':'ridge'})
   await page.goto(ready['url']);await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();save.gfx='+json.dumps(A.quality));await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0&&ConquestAssets.status.state==="ready"',timeout=900000)
   cam='Conquest.view.distance=75;Conquest.view.pitch=.82;Conquest.view.yaw=-.8;Conquest.view.camSnap=true'
   await page.evaluate(cam);top=await page.evaluate('Conquest.view.authority.state.base.tier');assert top>=1,'the fixture town has a Command Base'
   settle='()=>new Promise(r=>{let n=0;const f=()=>++n<4?requestAnimationFrame(f):r();requestAnimationFrame(f);})'
   domclick='t=>{const b=[...document.querySelectorAll("button")].find(b=>!b.hidden&&b.offsetParent&&b.textContent.trim().toUpperCase().startsWith(t));if(b)b.click();return !!b;}'   # the HUD redraws while frames are slow, so a button is clicked through the page, not by pointer
   for width,height in ([(1366,768),(1920,1080)] if A.mouse else [(390,844),(320,568),(390,700),(430,932)]):
    await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(600)
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'no sideways scroll at '+str(width)
    # the Command Base from above (the town's model on its pad), then from a low angle beside the wall and gate
    for name,c in (('base-above',cam),('base-side','Conquest.view.distance=46;Conquest.view.pitch=.34;Conquest.view.yaw=-2.2;Conquest.view.camSnap=true')):
     await page.evaluate(c);await page.wait_for_timeout(1500);await page.evaluate(c);await page.evaluate(settle)
     await page.screenshot(path=str(OUT/f'{width}x{height}-{name}.png'),timeout=240000)
    evidence.append({'viewport':[width,height],'render':await page.evaluate('Conquest.view.performanceReport()')})
    # the map at this size (layout: nothing cut off, nothing overlapping)
    if await page.evaluate(domclick,'MAP'):
     await page.wait_for_timeout(1500);await page.screenshot(path=str(OUT/f'{width}x{height}-map.png'),timeout=240000)
     if not await page.evaluate(domclick,'CLOSE'):await page.keyboard.press('Escape')
     await page.wait_for_timeout(500)
   assert not errors,errors
   (OUT/('evidence-mouse.json' if A.mouse else 'evidence.json')).write_text(json.dumps({'scope':'Fixture town (fully built, as conquest-town-captures.py); the Command Base as the view draws it; not earned combat or phone hardware proof','viewports':evidence,'errors':errors},indent=2));await browser.close();print('PASS in-game Command Base (above and beside) and the map at every size')
 finally:server.terminate();await server.wait()
asyncio.run(main())
