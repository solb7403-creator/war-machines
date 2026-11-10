# Desktop keyboard driving in Conquest on the REAL website build (web/play.html -> boot.js -> game), a real mouse/keyboard
# focus flow (tabbar -> ENTER CONQUEST -> ACKNOWLEDGE), no touch, no evaluate() before the keys. Also a narrow desktop window
# (Telegram Desktop mini-app size). Session 5D (owner, Nov 8: "on a computer, players cannot move their tank with the keyboard").
# Run from the repository root: node worker/build-web.mjs && python3 dev/tests/conquest-desktop-keys.py
import asyncio,json,pathlib,subprocess,time,os,shutil
from playwright.async_api import async_playwright
OUT=pathlib.Path('docs/conquest/session5d');OUT.mkdir(parents=True,exist_ok=True)
BASE='https://lunar.test';FIX='http://127.0.0.1:8791'
USER_ID=int(time.time()*1000)%1000000000
CHROME=shutil.which('chromium') or '/opt/pw-browsers/chromium'
async def route(r):
 if r.request.url.startswith(BASE):
  res=await r.fetch(url=FIX+r.request.url[len(BASE):]);return await r.fulfill(response=res)
 return await r.abort()
async def journey(b,width,height,label,results):
 ctx=await b.new_context(viewport={'width':width,'height':height},device_scale_factor=1,bypass_csp=True)   # bypass_csp: the test's own evaluate() only. A computer: no touch, no mobile emulation
 await ctx.route('**/*',route);pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 # a real website account: call sign + password on the login page (the Worker's /auth/acct routes, disposable fixture database)
 await pg.goto(BASE+'/web/login.html');await pg.locator('#su-cs').fill('pilot'+str(USER_ID)[-6:]+label.replace('-','')[:3]);await pg.locator('#su-pw').fill('desk-keys-test-pw');await pg.locator('#su-go').click()
 await pg.wait_for_url('**/web/play.html**',timeout=30000);await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&typeof Conquest!=="undefined"',timeout=30000)
 await pg.evaluate('()=>{save.welcomed=true;closeAll();uiDirty&&uiDirty();}')
 assert await pg.evaluate('SRV_ECO&&IN_WEB&&!IN_TG'),'website edition'
 # the real flow: mouse on the Conquest tab, ENTER CONQUEST, ACKNOWLEDGE the briefing. Nothing focuses anything for the test.
 await pg.locator('[data-act="conquest"]:visible').first.click();await pg.locator('.cq-enter').first.click()   # the sidebar button on a wide window, the tabbar's on a narrow one (the other is display:none)
 await pg.locator('.cq-story-start').click(timeout=30000)
 await pg.wait_for_timeout(400);hint0=await pg.evaluate('!!document.querySelector(".cq-keys")')
 try:
  await pg.wait_for_function('Conquest.view?.authority?.connected',timeout=90000)
  try:await pg.wait_for_function('Conquest.view.pending<=2',timeout=150000)   # terrain streaming (slow under software GL): on the CI runner a key held with 34 chunks still pending moved nothing in 8 s, so wait for the world first
  except Exception:pass
 except Exception as e:
  diag=await pg.evaluate('''()=>({view:!!Conquest.view,auth:!!Conquest.view?.authority,status:Conquest.view?.authority?.status,error:Conquest.view?.authority?.error,connected:Conquest.view?.authority?.connected,pending:Conquest.view?.pending,net:document.querySelector('.cq-net')?.textContent,load:document.querySelector('.cq-load')?.textContent,account:typeof ACCOUNT_OK!=='undefined'&&ACCOUNT_OK,session:typeof ConquestSession})''')
  await pg.screenshot(path=str(OUT/f'desktop-keys-{label}-stuck.png'));raise AssertionError('Conquest authority never connected on the website: '+json.dumps(diag)+' errors '+json.dumps(errs[:3])) from e
 await pg.wait_for_timeout(600)
 STATE='''()=>({active:document.activeElement?.tagName+(document.activeElement?.className?'.'+document.activeElement.className:''),dialogs:document.querySelectorAll(".cq .cq-dialog").length,prompts:document.querySelectorAll(".lw-prompt-wrap").length,connected:!!Conquest.view.authority.connected,keys:Object.keys(Conquest.view.keys),p:{x:Conquest.view.p.x,z:Conquest.view.p.z},hint:!!document.querySelector(".cq-keys")})'''
 state=lambda:pg.evaluate(STATE)
 held={}
 async def drive(code,ms=8000):
  # hold the key until the tank has moved (software GL renders a few frames a second here and can stall for a second); dead = nothing in 4 s
  p0=await pg.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z})');await pg.keyboard.down(code);await pg.wait_for_timeout(300)
  held[code]=await pg.evaluate('({keys:Object.keys(Conquest.view.keys),stalled:!!Conquest.view.authority?.stalled,connected:!!Conquest.view.authority?.connected,resume:Conquest.view.resume,hidden:document.hidden,dialogs:document.querySelectorAll(".cq .cq-dialog").length,prompts:document.querySelectorAll(".lw-prompt-wrap").length,active:document.activeElement?.tagName,pending:Conquest.view.pending,fps:Conquest.view.fps})')
  try:await pg.wait_for_function('p0=>Math.hypot(Conquest.view.p.x-p0.x,Conquest.view.p.z-p0.z)>1',arg=p0,timeout=ms)
  except Exception:pass
  await pg.keyboard.up(code);await pg.wait_for_timeout(150)
  p1=await pg.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z})');return ((p1['x']-p0['x'])**2+(p1['z']-p0['z'])**2)**.5
 s0=await state();assert s0['active'].startswith('DIV.cq-viewport'),f'{label}: focus after ACKNOWLEDGE sits on {s0["active"]}'
 moved={c:await drive(c) for c in ['KeyW','ArrowLeft','KeyS','KeyD','ArrowUp']}
 # what the view and the authority saw during the drive (printed always: the CI runner once reported W registered, connected, 0 m, 540 fps)
 diag=await pg.evaluate('''()=>{const v=Conquest.view,A=v.authority,S=A?.state;return {yaw:v.yaw,speed:v.speed,p:v.p,fps:v.fps,blocked:v.blocked,stepAcc:v.stepAcc,stepped:v.controlStepped,fallback:!!v.fallback2d||!!v.canvasFallback,nudge:!!v.nudge,resume:v.resume,connected:!!A?.connected,stalled:!!A?.stalled,queue:A?.queue?.length,pushed:A?.pushed,sent:A?.sent,credit:A?.credit?.(),authPos:S?.position,stuckMs:S?.stuckMs,recoveryAt:S?.recoveryAt,death:!!S?.death?.active,mission:S?.mission,battle:S?.battle?.state,hidden:document.hidden,webgl:!!v.renderer?.getContext?.()&&!v.renderer.getContext().isContextLost?.()};}''')
 print('DRIVE DIAG',label,json.dumps({'moved':moved,'held':held,'diag':diag},default=str),flush=True)
 await pg.screenshot(path=str(OUT/f'desktop-keys-{label}.png'))
 # abilities by key: Space fires (no page navigation, no button click), Shift (either side) dashes, F shield, C scan
 url=pg.url;await pg.keyboard.down('Space');await pg.wait_for_timeout(400);fired=await pg.evaluate('!!Conquest.view.keys.Space');await pg.keyboard.up('Space')
 await pg.keyboard.press('ShiftRight')   # a tap: latched at keydown, consumed by the next tick (software GL renders a few frames a second here)
 try:await pg.wait_for_function('(Conquest.view.battle||Conquest.view.encounter)?.dashCd>0',timeout=4000);dashR=True
 except Exception:dashR=False
 assert pg.url==url,'a key must never leave the page: '+pg.url
 # the account prompt timer (web/account-prompts.js) ticks every 4 s: after 10 s nothing may have taken the keyboard
 await pg.wait_for_timeout(10000);s1=await state();later=await drive('KeyW')
 await pg.keyboard.press('Escape');await pg.wait_for_timeout(300)
 results.append({'label':label,'held':held,'viewport':[width,height],'before':s0,'moved':moved,'spaceFires':fired,'shiftRightDash':dashR,'after10s':s1,'movedAfter10s':later,'pageErrors':errs[:3]})
 for c,d in moved.items():
  assert c in (held.get(c) or {}).get('keys',[]),f'{label}: {c} never reached the Conquest view; while held {json.dumps(held.get(c))}; state {json.dumps(s0)}'
  if c in ('KeyW','ArrowUp'):assert d>1,f'{label}: {c} did not move the tank ({d:.2f} m); moved {json.dumps(moved)}; while held {json.dumps(held.get(c))}; state {json.dumps(s0)}; diag {json.dumps(diag,default=str)}'
 assert later>1,f'{label}: keyboard dead after 10 s (moved {later:.2f}); while held {json.dumps(held.get("KeyW"))}; state {json.dumps(s1)}'
 assert fired and dashR,f'{label}: Space fire {fired}, right Shift dash {dashR}'
 assert s1['prompts']==0 or 'INPUT' not in s1['active'],f'{label}: a website prompt took the keyboard: {json.dumps(s1)}'
 assert hint0,f'{label}: desktop key hint not shown on a keyboard device right after the briefing'
 assert not errs,errs
 await ctx.close()
async def main():
 subprocess.run(['node','worker/build-web.mjs'],check=True)   # the website build of the current tree (worker/site-assets)
 srv=subprocess.Popen(['node','dev/tests/webserver.mjs'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 try:
  for _ in range(200):
   line=srv.stdout.readline()
   if 'ready' in line:break
  async with async_playwright() as p:
   b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   results=[]
   await journey(b,1440,900,'1440',results)
   await journey(b,420,700,'420-desktop',results)   # Telegram Desktop-like window: narrow, still a mouse and a keyboard
   await b.close()
  (OUT/'desktop-keys.json').write_text(json.dumps(results,indent=1))
  print('PASS desktop keyboard driving on the website build:',json.dumps([{k:v for k,v in r.items() if k in('label','moved','movedAfter10s','spaceFires','shiftRightDash')} for r in results]))
 finally:
  srv.terminate()
asyncio.run(main())
