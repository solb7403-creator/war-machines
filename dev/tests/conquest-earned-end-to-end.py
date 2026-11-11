"""Continue exact legitimate starter earning+defense save through real HTTP/Worker.
No bank/position/equipment/health fixtures. Earlier combat was authoritative input
replay; this continuation uses native keys/UI, bank/equip, concurrent HTTP and reload.
"""
import asyncio,importlib.util,json,os,pathlib,shutil
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-session-2/earned-browser'
spec=importlib.util.spec_from_file_location('flagship_journey',ROOT/'dev/tests/conquest-flagship-browser.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
async def main():
 OUT.mkdir(parents=True,exist_ok=True);save=pathlib.Path('/tmp/lunar-earned-defense.json');earned=json.loads(save.read_text());initial=earned['final'];assert initial['base']['defense']['wins']==1 and initial['loadout']['w']['a']=='pulse'
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs','--preview',cwd=ROOT,stdout=asyncio.subprocess.PIPE,env={**os.environ,'CQ_PREVIEW_PORT':'0','CQ_EARNED_SAVE':str(save)})
 ready=json.loads(await server.stdout.readline());base=ready['url'].split('/index.html')[0]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']);context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,reduced_motion='reduce');page=await context.new_page();requests=[];page.on('request',lambda r:requests.append(r.url));j=module.Journey(page,base,390,844,'earned-http')
   async def enter():
    await page.goto(ready['url']);await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();save.gfx="2d"');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
    if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').tap()
    await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0');await page.evaluate('Conquest.view.distance=70;Conquest.view.pitch=.9;Conquest.view.yaw=-.8')
   await enter();assert await page.evaluate('Conquest.view.authority.state.ledger.cp')==initial['ledger']['cp']
   await page.screenshot(path=str(OUT/'earned-defense-retained.png'))
   await j.travel({'x':1080,'z':1140},stop=6);await j.travel({'x':1174,'z':1168},stop=7)
   before=await page.evaluate('Conquest.view.authority.state.ledger')
   await page.locator('#cq-supply-access').click();await page.get_by_role('button',name='BANK SALVAGE',exact=True).click();await page.wait_for_function('Object.values(Conquest.view.authority.state.ledger.cargo).every(n=>n===0)');after=await page.evaluate('Conquest.view.authority.state.ledger');assert all(after['banked'][k]==before['banked'][k]+before['cargo'][k] for k in ['alloy','biomass','helium']);await page.screenshot(path=str(OUT/'earned-defense-salvage-banked.png'));await page.get_by_role('button',name='CLOSE SUPPLY',exact=True).click()
   await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='PERMANENT COLLECTION',exact=True).click();await page.locator('.cq-product-section summary').filter(has_text='COMMANDER').click();row=page.locator('.cq-product').filter(has=page.get_by_role('heading',name='First Defense Standard',exact=True));await row.get_by_role('button',name='PREVIEW · First Defense Standard',exact=True).click();await row.get_by_role('button',name='EQUIP',exact=True).click();await page.wait_for_function('Conquest.view.authority.state.cosmetics.equipped.commander==="command-standard"');await page.screenshot(path=str(OUT/'naturally-earned-standard-equipped.png'));await page.get_by_role('button',name='CLOSE COLLECTION',exact=True).click()
   retained=await page.evaluate('({cp:Conquest.view.authority.state.ledger.cp,banked:Conquest.view.authority.state.ledger.banked,owned:Conquest.view.authority.state.cosmetics.owned,completed:Conquest.view.authority.state.completed,defense:Conquest.view.authority.state.base.defense})')
   await page.evaluate('Conquest.view.reset();Conquest.view.authority.dispose()');inspected=await (await page.request.post(base+'/inspect',data={})).json();s=inspected['state'];body={'gv':5,'initData':ready.get('initData',''),'seq':s['seq']+1,'action':'equip-cosmetic','item':'command-standard'}
   # Preview deliberately does not publish initData in its ready message. Reuse the
   # actual signed test login already present in the browser, never production auth.
   body['initData']=await page.evaluate('Telegram.WebApp.initData');replies=await asyncio.gather(*[page.request.post(base+'/api/conquest/action',data=body) for _ in range(2)]);payload=[await r.json() for r in replies];assert all(r.status==200 for r in replies),payload;assert any(r.get('replayed') for r in payload),payload
   await enter();reloaded=await page.evaluate('({cp:Conquest.view.authority.state.ledger.cp,banked:Conquest.view.authority.state.ledger.banked,owned:Conquest.view.authority.state.cosmetics.owned,completed:Conquest.view.authority.state.completed,defense:Conquest.view.authority.state.base.defense})');assert retained==reloaded,(retained,reloaded);assert await page.evaluate('Conquest.view.authority.state.cosmetics.equipped.commander==="command-standard"');assert not j.errors,j.errors;assert all(u.startswith(base) or u.startswith('data:') for u in requests),requests
   await page.screenshot(path=str(OUT/'native-bank-equip-concurrent-reload.png'));(OUT/'evidence.json').write_text(json.dumps({'scope':__doc__,'initialSource':'conquest-earned-journey -> conquest-earned-defense exact save; no direct resource/loadout/position grant','baseMinute':earned['baseMinute'],'nativeMovementAndUI':True,'realHTTPAuthWorker':True,'concurrentIdenticalActionsExactlyOnce':True,'persistent':retained,'errors':j.errors,'physicalIPhoneVerified':False},indent=2));await browser.close();print('PASS naturally earned starter fight/mission/bank/base/defense continuation: native drive+bank+earned cosmetic, real HTTP auth/CAS, concurrent replay and reload; no production or direct grants')
 finally:server.terminate();await server.wait()
asyncio.run(main())
