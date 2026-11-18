# Session 6B on the REAL website build (web/play.html -> boot.js -> the game; the Worker with a disposable database): a new account
# signs up with a call sign and password, then with a real mouse and keyboard only:
#   1. the Shop's Science Lab section shows every entry with its proposed TON price and SOL at the live rate (the website sells
#      TON/SOL; no Stars), every button disabled, "Not on sale yet",
#   2. Settings: a click on the Volume slider's thumb, ArrowLeft lowers it (saved), Shift+Tab to the Sound toggle, Space mutes
#      and disables the slider.
# The live SOL rate comes from the game's own server (/api/rates; the website's security policy allows nothing else), which the
# test server answers with a fixed rate (1 TON = $3, 1 SOL = $150) so the label is deterministic; nothing leaves the machine.
# Run from the repository root: python3 dev/tests/web-labstore.py  (builds worker/site-assets first)
import asyncio,json,pathlib,subprocess,time,shutil,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session6b';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://lunar.test';FIX='http://127.0.0.1:8791'
USER_ID=int(time.time()*1000)%1000000000
CHROME=shutil.which('chromium') or '/opt/pw-browsers/chromium'
async def route(r):
 u=r.request.url
 if u.startswith('https://api.coingecko.com/'):return await r.fulfill(body=json.dumps({'the-open-network':{'usd':3},'solana':{'usd':150}}),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
 if u.startswith(BASE):
  res=await r.fetch(url=FIX+u[len(BASE):]);return await r.fulfill(response=res)
 return await r.abort()
async def journey(b,w,h,out):
 ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
 await ctx.route('**/*',route);pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 await pg.goto(BASE+'/web/login.html');await pg.locator('#su-cs').fill('lab'+str(USER_ID)[-6:]+str(w)[:2]);await pg.locator('#su-pw').fill('lab-store-test-pw');await pg.locator('#su-go').click()
 await pg.wait_for_url('**/web/play.html**',timeout=30000);await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab',timeout=30000)
 await pg.evaluate('()=>{save.welcomed=true;closeAll();uiDirty&&uiDirty();}')
 R={'size':f'{w}x{h}','web':await pg.evaluate('IN_WEB&&!IN_TG')}
 # 1. the Shop (mouse)
 await pg.locator('[data-act="tab"][data-arg="shop"]:visible,[data-web-tab="shop"]:visible').first.click()
 await pg.wait_for_selector('.labshop',timeout=20000);await pg.wait_for_timeout(1200);await pg.evaluate('uiDirty("shop")');await pg.wait_for_timeout(600)
 await pg.locator('.labshop').scroll_into_view_if_needed();await pg.wait_for_timeout(300)
 R['shop']=await pg.evaluate('(()=>{const d=document.querySelector(".labshop");const b=[...d.querySelectorAll("button")];return {items:[...d.querySelectorAll(".labshop-item b")].map(n=>n.textContent),prices:b.map(x=>x.textContent),allDisabled:b.every(x=>x.disabled),finish:[...d.querySelectorAll("p.mut")].map(p=>p.textContent).find(t=>/20 min/.test(t))||null,note:document.querySelector(".web-shop-note")?.textContent||null,fits:document.documentElement.scrollWidth<=innerWidth+1};})()')
 await pg.locator('.labshop').screenshot(path=str(OUT/f'web-shop-lab-{w}x{h}.png'))
 # 2. Settings: the mouse picks the slider's thumb (at 100%), the keyboard moves it; Shift+Tab to the Sound toggle, Space mutes
 await pg.locator('[data-act="settings"]:visible').first.click();await pg.wait_for_selector('#vol-r',timeout=15000)
 bb=await pg.locator('#vol-r').bounding_box();await pg.mouse.click(bb['x']+bb['width']-4,bb['y']+bb['height']/2);await pg.wait_for_timeout(200)
 R['sliderFocusedByTab']=await pg.evaluate('document.activeElement?.id==="vol-r"')
 for _ in range(6):await pg.keyboard.press('ArrowLeft')
 await pg.wait_for_timeout(300)
 R['volume']=await pg.evaluate('({vol:save.vol,label:document.getElementById("vol-p")?.textContent})')
 for _ in range(6):
  await pg.keyboard.press('Shift+Tab');await pg.wait_for_timeout(80)
  if await pg.evaluate('document.activeElement?.dataset?.act==="sound"'):break
 R['soundFocused']=await pg.evaluate('document.activeElement?.dataset?.act==="sound"')
 await pg.keyboard.press('Space');await pg.wait_for_timeout(500)
 R['muted']=await pg.evaluate('({sound:save.sound,slider:document.getElementById("vol-r")?.disabled,label:document.getElementById("vol-p")?.textContent})')
 await pg.screenshot(path=str(OUT/f'web-settings-{w}x{h}.png'))
 R['errors']=errs[:5];out.append(R);await ctx.close()
async def main():
 subprocess.run(['node','worker/build-web.mjs'],check=True,cwd=ROOT)
 srv=subprocess.Popen(['node','dev/tests/webserver.mjs'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 out=[]
 try:
  for _ in range(200):
   if 'ready' in srv.stdout.readline():break
  async with async_playwright() as p:
   b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in [(1366,768),(1920,1080)]:await journey(b,w,h,out)
   await b.close()
 finally:srv.terminate()
 (OUT/'web-labstore.json').write_text(json.dumps(out,indent=1)+'\n')
 bad=[]
 for r in out:
  t=r['size'];s=r['shop']
  if not r['web']:bad.append(t+' not the website edition')
  if not (s['allDisabled'] and len(s['items'])>=7 and all('TON' in x and 'SOL' in x and '⭐' not in x for x in s['prices']) and s['fits']):bad.append(t+' shop '+json.dumps(s))
  if not (s['finish'] and 'TON' in s['finish']):bad.append(t+' instant finish line '+json.dumps(s['finish']))
  if not (r['sliderFocusedByTab'] and r['volume']['vol'] is not None and r['volume']['vol']<1):bad.append(t+' keyboard volume '+json.dumps(r['volume']))
  if not all('0.' in x.split('·')[1] for x in s['prices']):bad.append(t+' SOL at the live rate '+json.dumps(s['prices']))
  if not (r['muted']['sound'] is False and r['muted']['slider'] is True):bad.append(t+' keyboard mute '+json.dumps(r['muted']))
  if r['errors']:bad.append(t+' page errors '+json.dumps(r['errors']))
 print(json.dumps(out)[:3000])
 print(('FAIL web-labstore: '+' | '.join(bad)) if bad else 'PASS web-labstore ('+str(len(out))+' sizes)')
 sys.exit(1 if bad else 0)
asyncio.run(main())
