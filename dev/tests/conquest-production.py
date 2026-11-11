"""Release smoke: verified published bytes + anonymous browser; no live-account writes/rewards.
The proxy-compatible browser route delivers TLS-fetched production assets at their real origin.
"""
import asyncio,json,pathlib,subprocess,hashlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest-session-032';PAGES='https://solb7403-creator.github.io/war-machines/';WORKER='https://lunar-api.solb7403.workers.dev/'
ASSETS=['version.json','css/conquest.css','js/conquest/app.js','js/conquest/view.js','js/conquest/combat.js','js/conquest/controls.js','js/conquest/session.js','js/vendor/three.lunar.min.js']
def fetch(url):return subprocess.run(['curl','--fail','--silent','--show-error','--retry','2','--max-time','45',url],check=True,capture_output=True).stdout
async def main():
 version=json.loads((ROOT/'version.json').read_text())['v'];hashes=[];cache={}
 for base in [PAGES,WORKER]:
  for asset in ASSETS+(['index.html'] if base==PAGES else ['web/boot.js','web/play.html']):
   data=await asyncio.to_thread(fetch,base+asset+'?release='+version);expected=(ROOT/asset).read_bytes();assert data==expected,(base,asset,'published bytes differ');cache[base+asset]=data;hashes.append({'url':base+asset,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
 unauth=subprocess.run(['curl','--silent','--show-error','--max-time','30','--write-out','\n%{http_code}','-H','Content-Type: application/json','--data','{"gv":5}',WORKER+'api/conquest/session'],check=True,capture_output=True).stdout.decode();assert unauth.rstrip().endswith('401'),unauth
 private=subprocess.run(['curl','--silent','--show-error','--max-time','30','--write-out','\n%{http_code}','https://warmachines-a6034-default-rtdb.firebaseio.com/conquest.json'],check=True,capture_output=True).stdout.decode();assert private.rstrip().endswith('401'),private
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);page=await browser.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);errors=[];writes=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
  async def route(r):
   if r.request.method!='GET':writes.append(r.request.url);return await r.abort()
   u=urlparse(r.request.url);url=u.scheme+'://'+u.netloc+u.path
   if not url.startswith(PAGES):return await r.abort()
   if url not in cache:cache[url]=await asyncio.to_thread(fetch,r.request.url)
   import mimetypes
   return await r.fulfill(body=cache[url],content_type=mimetypes.guess_type(u.path)[0] or 'application/octet-stream')
  await page.route('**/*',route);await page.goto(PAGES+'index.html?v='+version);await page.wait_for_function('typeof Conquest!=="undefined"');await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click();button=page.locator('.cq-story-start');await button.wait_for();r=await button.bounding_box();assert r['y']+r['height']<=844;await page.screenshot(path=str(OUT/'production-story.png'));await page.touchscreen.tap(r['x']+r['width']/2,r['y']+r['height']/2);await page.wait_for_function('Conquest.view?.pending===0',timeout=60000)
  assert await page.evaluate('!Conquest.view.authority'),'anonymous smoke must not open a valuable account session'
  for selector in ['#cq-fire','#cq-super','#cq-dash','#cq-shield']:
   r=await page.locator(selector).bounding_box();assert r['y']+r['height']<=844 and r['width']>=44
  for selector in ['#cq-shield','#cq-dash','#cq-fire']:
   r=await page.locator(selector).bounding_box();await page.touchscreen.tap(r['x']+r['width']/2,r['y']+r['height']/2)
  await page.wait_for_function('Conquest.view.encounter.shieldCd>0&&Conquest.view.encounter.dashCd>0&&Conquest.view.encounter.shots>0');await page.screenshot(path=str(OUT/'production-hud.png'));assert not writes,writes;assert not errors,errors;await browser.close()
 result={'version':version,'assetParity':hashes,'unauthenticatedAPI':unauth,'privateFirebase':private,'browser':'390x844 Chromium; production bytes fetched via curl and delivered at real production origin; anonymous local practice, all mutation requests blocked','physicalIPhoneTelegramVerified':False,'attemptedBrowserWrites':writes,'errors':errors};(OUT/'production-results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'version':version,'assetsMatched':len(hashes),'unauthenticatedAPI':401,'privateFirebase':401,'errors':errors}))
asyncio.run(main())
