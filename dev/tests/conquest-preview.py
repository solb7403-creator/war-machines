"""Real local HTTP preview, no request routing or production services."""
import asyncio,json,os,pathlib,shutil
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs','--preview',cwd=ROOT,env={**os.environ,'CQ_PREVIEW_PORT':'0'},stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base=ready['url'].split('/index.html')[0]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
   page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);errors=[];requests=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
   await page.goto(ready['url']);await page.wait_for_function('typeof Conquest!=="undefined"')
   await page.evaluate('closeAll();save.welcomed=true;uiDirty()')
   await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').tap()
   await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
   expected=json.loads(pathlib.Path(os.environ['CQ_EARNED_SAVE']).read_text())['final'] if os.getenv('CQ_EARNED_SAVE') else {'ledger':{'cp':0},'base':{'tier':0}}
   assert await page.evaluate('Conquest.view.authority.state.ledger.cp')==expected['ledger']['cp']
   assert await page.evaluate('Conquest.view.authority.state.base.tier')==expected['base']['tier']
   before=await page.evaluate('Conquest.view.authority.state.position.x')
   await page.keyboard.down('w');await page.wait_for_timeout(1500);await page.keyboard.up('w');await page.wait_for_timeout(1500)
   assert await page.evaluate('Conquest.view.authority.state.position.x')>before+3
   assert not errors,errors
   assert all(u.startswith(base) or u.startswith('data:') for u in requests),[u for u in requests if not u.startswith(base)]
   assert (await page.request.get(base+'/.git/config')).status==404
   assert (await page.request.get(base+'/worker/src/index.js')).status==404
   assert (await page.request.get(base+'/js/../../worker/src/index.js')).status==404
   await page.screenshot(path=str(ROOT/('docs/conquest-living-war/chromium-local-earned-preview.png' if os.getenv('CQ_EARNED_SAVE') else 'docs/conquest-living-war/chromium-local-preview.png')))
   await browser.close();print('PASS real HTTP disposable preview, authenticated movement, no directly granted funds, no production network and restricted static paths')
 finally:
  server.terminate();await server.wait()
asyncio.run(main())
