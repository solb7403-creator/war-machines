"""Real app onboarding bounds/native-input regression. Browser engines are not physical Telegram."""
import argparse,asyncio,json,pathlib,shutil
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest-ios-onboarding';OUT.mkdir(exist_ok=True)
SIZES=[(320,568),(360,640),(390,844),(393,852)]
LABEL='ACKNOWLEDGE · BEGIN EXPLORATION'
async def main(engine):
 async with async_playwright() as p:
  opts={'headless':True}
  if engine=='chromium':opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  browser=await getattr(p,engine).launch(**opts);results=[]
  for width,height in SIZES:
   context=await browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,reduced_motion='reduce')
   page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;')
   async def route(r):
    from urllib.parse import urlparse
    u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
    if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
    await r.abort()
   await page.route('**/*',route)
   async def enter():
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
   async def button_bounds():
    # No locator.click(): Playwright would scroll an offscreen button into view and hide this bug.
    return await page.get_by_role('button',name=LABEL,exact=True).evaluate('''e=>{const r=e.getBoundingClientRect(),v=visualViewport;return {x:r.x,y:r.y,w:r.width,h:r.height,top:v.offsetTop,bottom:v.offsetTop+v.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e};}''')
   async def assert_tappable():
    r=await button_bounds();assert r['y']>=r['top'] and r['y']+r['h']<=r['bottom'] and r['h']>=44 and r['hit'],(engine,width,height,'button offscreen/covered',r)
    return r
   await enter();await page.get_by_role('heading',name='THE LAST AIR WE BREATHE').wait_for()
   first=await assert_tappable()
   await page.screenshot(path=str(OUT/f'{engine}-{width}x{height}-initial.png'))
   # Tap immediately at visible coordinates, with no scrolling first.
   await page.touchscreen.tap(first['x']+first['w']/2,first['y']+first['h']/2)
   await page.wait_for_function('!document.querySelector(".cq-transmission")&&Conquest.view?.pending===0',timeout=60000)
   assert await page.evaluate('localStorage.getItem("lunar-conquest-onboarding-v1")==="1"')
   before=await page.evaluate('Conquest.view.p.x');await page.keyboard.down('w');await page.wait_for_timeout(400);await page.keyboard.up('w');assert await page.evaluate('Conquest.view.p.x')>before,'dismissal must enter responsive exploration'
   await enter();await page.wait_for_function('Conquest.view?.pending===0',timeout=60000);assert await page.locator('.cq-transmission').count()==0,'dismissal must persist across reload'
   await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='HELP',exact=True).click();await page.get_by_role('button',name='REPLAY OPENING TRANSMISSION').click()
   body=page.locator('.cq-transmission-scroll');await body.wait_for()
   assert await body.evaluate('e=>e.scrollTop')==0
   # Confirm the surrounding app's document touchmove guard no longer cancels this region.
   assert await body.evaluate('''e=>{const t=new Event('touchmove',{bubbles:true,cancelable:true});e.dispatchEvent(t);return !t.defaultPrevented;}'''),'global touchmove preventDefault blocks story scrolling'
   # Larger text + a keyboard-like visual viewport reduction must leave the footer available.
   await page.add_style_tag(content='.cq-transmission-scroll p,.cq-transmission-scroll blockquote{font-size:26px!important;line-height:1.8!important}.cq-story-start{font-size:22px!important}')
   await page.set_viewport_size({'width':width,'height':min(height,420)});await page.wait_for_function("document.querySelector('.cq-story-start').getBoundingClientRect().bottom<=visualViewport.offsetTop+visualViewport.height");await assert_tappable()
   await page.evaluate("document.documentElement.style.setProperty('--tg-safe-area-inset-top','24px');document.documentElement.style.setProperty('--tg-safe-area-inset-bottom','34px')")
   safe=await assert_tappable();assert safe['y']+safe['h']<=safe['bottom']-34,'Telegram safe-area footer clearance'
   rect=await body.bounding_box()
   if engine=='chromium':
    cdp=await context.new_cdp_session(page)
    x=rect['x']+rect['width']/2;y=rect['y']+rect['height']*.8
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
    for step in range(1,13):
     await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x,'y':y-step*10}]});await page.wait_for_timeout(20)
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   else:
    # Playwright cannot inject swipes or wheel events into mobile WebKit.
    # Exercise native keyboard scrolling and separately check uncancelled touch dispatch.
    await body.focus();await page.keyboard.press('PageDown')
   await page.wait_for_function('document.querySelector(".cq-transmission-scroll").scrollTop>0')
   await assert_tappable()
   await page.locator('.cq-transmission').focus();await page.keyboard.press('Tab');assert await page.evaluate('document.activeElement.classList.contains("cq-transmission-scroll")')
   old=await body.evaluate('e=>e.scrollTop');await page.keyboard.press('ArrowDown');await page.wait_for_function('(old)=>document.querySelector(".cq-transmission-scroll").scrollTop>old',arg=old);await page.wait_for_timeout(300);old=await body.evaluate('e=>e.scrollTop');await page.keyboard.press('PageDown');await page.wait_for_function('(old)=>document.querySelector(".cq-transmission-scroll").scrollTop>old',arg=old)
   await page.keyboard.press('Tab');assert await page.get_by_role('button',name=LABEL,exact=True).evaluate('e=>document.activeElement===e')
   await page.screenshot(path=str(OUT/f'{engine}-{width}x{height}-large-text.png'))
   await page.keyboard.press('Enter');await page.wait_for_function('!document.querySelector(".cq-transmission")')
   await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='HELP',exact=True).click();await page.get_by_role('button',name='REPLAY OPENING TRANSMISSION').click();await page.keyboard.press('Escape');assert await page.locator('.cq-transmission').count()==0
   assert not errors,errors;results.append({'viewport':f'{width}x{height}','initialButton':first,'scroll':'native touch' if engine=='chromium' else 'native keyboard + uncancelled touchmove event','keyboard':'Tab/ArrowDown/PageDown/Enter/Escape','largeText':True,'reducedViewportHeight':min(height,420),'errors':errors});await context.close()
  await browser.close();result={'engine':engine,'status':'PASS','physicalTelegramVerified':False,'cases':results};(OUT/f'{engine}-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--engine',choices=['chromium','webkit'],default='chromium');asyncio.run(main(a.parse_args().engine))
