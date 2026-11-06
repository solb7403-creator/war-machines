"""Actual game/Worker render inspection using disclosed rich-bank construction fixtures.
No combat/victory proof is inferred from these authored visual states.
"""
import asyncio,json,pathlib,shutil,argparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-session-2/presentation'
async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs','--preview',cwd=ROOT,stdout=asyncio.subprocess.PIPE,env={**__import__('os').environ,'CQ_PREVIEW_PORT':'8791'})
 ready=json.loads(await server.stdout.readline());evidence=[]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);page=await browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.request.post('http://127.0.0.1:8791/fixture',data={'position':[1080,1160],'baseFunds':True})
   await page.goto(ready['url']);await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();save.gfx="low"');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0&&ConquestAssets.status.state==="ready"',timeout=60000)
   await page.evaluate('Conquest.view.distance=75;Conquest.view.pitch=.82;Conquest.view.yaw=-.8')
   await page.locator('#cq-base-access').click()
   await page.get_by_role('button',name='CONSTRUCT BASE I',exact=False).click()
   for tier in range(1,6):
    await page.wait_for_function('(tier)=>Conquest.view.authority.state.base.tier===tier',arg=tier)
    await page.get_by_role('button',name='CLOSE BASE',exact=True).click();await page.wait_for_timeout(250)
    await page.screenshot(path=str(OUT/f'390-base-tier-{tier}.png'))
    if tier<5:
     await page.locator('#cq-base-access').click();await page.get_by_role('button',name='BUILD TIER '+str(tier+1),exact=False).click()
   await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='PERMANENT COLLECTION',exact=True).click()
   await page.get_by_role('button',name='PREVIEW · Command Monolith',exact=True).click();await page.screenshot(path=str(OUT/'390-monolith-preview.png'))
   row=page.locator('.cq-product').filter(has=page.get_by_role('heading',name='Command Monolith',exact=True));await row.get_by_role('button',name='EQUIP',exact=True).click();await page.get_by_role('button',name='CLOSE COLLECTION',exact=True).click()
   await page.wait_for_function('Conquest.view.authority.state.cosmetics.equipped.base==="base-monolith"');await page.wait_for_timeout(250)
   assert await page.evaluate('(()=>{let n=0;Conquest.view.baseGroup.traverse(g=>{if(g.userData.conquestAsset==="command")n++});return n>0})()'),'real Blender asset integrated'
   for width,height in [(320,568),(390,844),(430,932),(1280,800)]:
    await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(300);assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(OUT/f'{width}-tier5-equipped-in-game.png'));evidence.append({'viewport':[width,height],'render':await page.evaluate('Conquest.view.performanceReport()'),'assets':await page.evaluate('ConquestAssets.metrics')})
   await page.reload();await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty()');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();await page.wait_for_function('Conquest.view?.authority?.state?.cosmetics?.equipped?.base==="base-monolith"');assert not errors,errors
   (OUT/'evidence.json').write_text(json.dumps({'scope':'Rich-bank fixture; real authenticated build/upgrade/equip/reconnect actions and real in-game GLB; not earned combat or phone hardware proof','viewports':evidence,'errors':errors},indent=2));await browser.close();print('PASS actual in-game Blender BaseI-V, earned tier cosmetic equip/reload and320/390/430/desktop captures')
 finally:server.terminate();await server.wait()
asyncio.run(main())
