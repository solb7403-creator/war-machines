"""Matched actual baseline/current game capture; resource-rich render fixtures only.
Mapping is separate so the A/B reviewer can inspect labels without seeing version.
"""
import asyncio,argparse,json,os,pathlib,shutil
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-session-2/matched'
async def capture(root,label):
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs','--preview',cwd=root,stdout=asyncio.subprocess.PIPE,env={**os.environ,'CQ_PREVIEW_PORT':'0'})
 ready=json.loads(await server.stdout.readline());base=ready['url'].split('/index.html')[0]
 try:
  async with async_playwright() as p:
   b=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);page=await b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.request.post(base+'/fixture',data={'position':[1080,1160],'baseFunds':True});await page.goto(ready['url']);await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();save.gfx="low"');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0');await page.evaluate('Conquest.view.distance=75;Conquest.view.pitch=.82;Conquest.view.yaw=-.8');await page.locator('#cq-base-access').click();await page.get_by_role('button',name='CONSTRUCT BASE I',exact=False).click()
   for tier in range(1,6):
    await page.wait_for_function('(tier)=>Conquest.view.authority.state.base.tier===tier',arg=tier)
    if tier in [1,5]:
     await page.get_by_role('button',name='CLOSE BASE',exact=True).click();await page.wait_for_timeout(350);await page.screenshot(path=str(OUT/f'{label}-tier{tier}.png'));await page.locator('#cq-base-access').click()
    if tier<5:await page.get_by_role('button',name='BUILD TIER '+str(tier+1),exact=False).click()
   assert not errors,errors;stats=await page.evaluate('Conquest.view.performanceReport()');await b.close();return stats
 finally:server.terminate();await server.wait()
async def main():
 OUT.mkdir(parents=True,exist_ok=True);baseline=pathlib.Path('/tmp/lunar-baseline');assert (baseline/'index.html').exists();stats={};stats['A']=await capture(ROOT,'A');stats['B']=await capture(baseline,'B');(OUT/'mapping.json').write_text(json.dumps({'scope':__doc__,'camera':{'distance':75,'pitch':.82,'yaw':-.8},'viewport':[390,844],'fixtures':'same physical Command Base pad, richbank, canonicalstarter, realauthenticatedbuildI-V, no equipped cosmetic','A':'current Session2 branch','B':'Session1 baseline1ce9135','stats':stats},indent=2));print('PASS matched actual baseline/current BaseI/V render captures; version labels separated')
asyncio.run(main())
