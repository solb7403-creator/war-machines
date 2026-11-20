"""Actual game/Worker render inspection using disclosed rich-bank construction fixtures.
No combat/victory proof is inferred from these authored visual states.
Session 5E-2d1: --quality high|low (default low, as before), --out DIR, and --mouse = a keyboard-and-mouse computer (no touch):
the tier captures are taken at 1366x768 and the final ones at 1366x768 and 1920x1080; the touch run adds 390x700.
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
   # The fixture hands the pilot a fully built town (the same one conquest-town-captures.py uses); the five base tiers are then
   # SHOWN one after another by setting the tier the view draws (presentation only: the Worker's state is not touched).
   await page.request.post('http://127.0.0.1:8791/fixture',data={'position':[1080,1160],'baseFunds':True,'plotFull':'ridge'})
   await page.goto(ready['url']);await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();save.gfx='+json.dumps(A.quality));await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0&&ConquestAssets.status.state==="ready"',timeout=900000)
   cam='Conquest.view.distance=75;Conquest.view.pitch=.82;Conquest.view.yaw=-.8;Conquest.view.camSnap=true'
   await page.evaluate(cam);top=await page.evaluate('Conquest.view.authority.state.base.tier');assert top>=1,'the fixture town has a Command Base'
   settle='()=>new Promise(r=>{let n=0;const f=()=>++n<4?requestAnimationFrame(f):r();requestAnimationFrame(f);})'
   for tier in range(1,6):
    await page.evaluate('t=>{Conquest.view.authority.state.base.tier=t;}',tier);await page.wait_for_timeout(900);await page.evaluate('t=>{Conquest.view.authority.state.base.tier=t;}',tier);await page.evaluate(settle)
    await page.screenshot(path=str(OUT/f'{W0}-base-tier-{tier}.png'),timeout=240000)
   await page.evaluate('t=>{Conquest.view.authority.state.base.tier=t;}',5);await page.evaluate(settle)
   for width,height in ([(1366,768),(1920,1080)] if A.mouse else [(320,568),(390,700),(390,844),(430,932)]):
    await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(600);await page.evaluate('t=>{Conquest.view.authority.state.base.tier=t;}',5);await page.evaluate(cam);await page.evaluate(settle)
    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'no sideways scroll at '+str(width)
    await page.screenshot(path=str(OUT/f'{width}x{height}-tier5-in-game.png'),timeout=240000);evidence.append({'viewport':[width,height],'render':await page.evaluate('Conquest.view.performanceReport()')})
    # the map and the MORE menu at this size (layout: nothing cut off, nothing overlapping)
    await page.get_by_role('button',name='MAP',exact=True).click();await page.wait_for_timeout(900);await page.screenshot(path=str(OUT/f'{width}x{height}-map.png'),timeout=240000);await page.keyboard.press('Escape');await page.evaluate('document.querySelector(".cq-dialog [data-close],.cq-dialog .cq-close")?.click()');await page.wait_for_timeout(400)
    if await page.locator('.cq-dialog').count():
     for b in await page.get_by_role('button').all():
      if (await b.inner_text()).strip().upper().startswith('CLOSE'):await b.click();break
    await page.wait_for_timeout(300)
   assert not errors,errors
   (OUT/('evidence-mouse.json' if A.mouse else 'evidence.json')).write_text(json.dumps({'scope':'Fixture town (fully built, as conquest-town-captures.py); base tiers 1-5 shown by the view (presentation only); not earned combat or phone hardware proof','viewports':evidence,'errors':errors},indent=2));await browser.close();print('PASS in-game Command Base tiers 1-5, the tier 5 base, the map at every size')
 finally:server.terminate();await server.wait()
asyncio.run(main())
