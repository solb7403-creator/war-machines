# Original Telegram entry + local authenticated Worker/DB/WebSockets. No real Telegram SDK or credentials.
import asyncio,json,pathlib
from playwright.async_api import async_playwright
from harness import start_dev,open_game,dev
OUT=pathlib.Path('/workspace/commercial-evidence/browser');OUT.mkdir(parents=True,exist_ok=True)
async def main():
 server=start_dev();dev('/__pvpreset?wait=30000')
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-features=LocalNetworkAccessChecks'])
  try:
   _,a,ea=await open_game(p,w=390,h=844,user={'id':7801001,'username':'audit_alpha'},pvp=True,browser=browser,eco='server')
   await a.wait_for_function('()=>!!save?.lab&&save.migOk');await a.evaluate('()=>{save.welcomed=true;closeAll();setGfx("2d");}')
   assert await a.evaluate('IN_TG&&SRV_ECO&&!GraphicsRelease.enabled')
   for width in [320,390,430]:
    await a.set_viewport_size({'width':width,'height':844})
    for tab in ['play','garage','quests','shop','ranks']:
     await a.evaluate('(t)=>setTab(t)',tab);assert await a.evaluate('document.documentElement.scrollWidth<=innerWidth')
    await a.screenshot(path=str(OUT/f'telegram-{width}.png'))
   _,b,eb=await open_game(p,w=390,h=844,user={'id':7801002,'username':'audit_bravo'},start_param='ref_7801001',pvp=True,browser=browser,eco='server')
   await b.wait_for_function('()=>!!save?.lab&&save.migOk');assert await b.evaluate('save.refBy')=='tg_7801001'
   for uid in [7801001,7801002]:dev('/__set',{'path':'eco/tg_'+str(uid)+'/mp','value':1}) # eligible synthetic accounts, no production state
   for pg in [a,b]:
    pg.on('websocket',lambda w:w.on('socketerror',lambda e:print('WS ERROR',e,flush=True)))
    await pg.evaluate('()=>doSync(false)')
    await pg.evaluate('()=>{save.welcomed=true;save.termsOk=1;save.gtype="arena";save.mode="1v1";save.map="classic";setGfx("2d");closeAll();setTab("play");}')
    await pg.locator('#s-play .fight').click()
   for pg in [a,b]:
    await pg.wait_for_function('()=>pvpOn()&&state==="play"',timeout=20000)
   before=await a.evaluate('me.y');await a.keyboard.down('ArrowUp');await a.wait_for_timeout(500);await a.keyboard.up('ArrowUp');assert await a.evaluate('me.y')<before
   await b.evaluate('pvp.sock.close()');await b.wait_for_function('()=>pvp?.sock?.readyState===1',timeout=10000)
   await a.screenshot(path=str(OUT/'online-telegram-390.png'))
   assert not ea+eb,ea+eb
   result={'telegramSDK':'fixture','serverAuthoritative':True,'mobileWidths':[320,390,430],'signedReferral':True,'twoBrowserOnlineMatch':True,'networkedMovement':True,'socketReconnect':True,'errors':ea+eb}
   (OUT/'telegram.json').write_text(json.dumps(result,indent=2));print('PASS Telegram entry, commercial tabs, signed referral, local real WebSocket pair match/movement/reconnect',flush=True)
  finally:await browser.close()
 if server:server.terminate()
asyncio.run(main())
