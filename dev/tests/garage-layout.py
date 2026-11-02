# Garage layout QA in the Telegram Mini App page at 360, 390, 768 and 1366 px: every section open in turn (and every
# picker sheet with a compare card), no sideways scroll, no clipped text, tap targets of at least 44 px, keyboard-only
# section toggling. Runs the economy on the phone (local), which now has the same two bays as the server.
# Also writes the contact-sheet pictures to $SHOTS/garage-sheet/.   python3 dev/tests/garage-layout.py
import asyncio,os,sys,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev,open_game
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/garage-sheet/';os.makedirs(OUT,exist_ok=True)
SIZES=[(360,780,'android-360',True),(390,844,'phone-390',True),(768,1024,'tablet-768',True),(1366,900,'desktop-1366',False)]
AUDIT="""(where)=>{const out=[],W=innerWidth;if(document.documentElement.scrollWidth>W+1)out.push(where+': sideways scroll '+document.documentElement.scrollWidth);
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
 for(const e of document.querySelectorAll('#s-garage button,#s-garage input,.sheet button,.sheet a')){if(!vis(e)||e.classList.contains('info'))continue;const r=e.getBoundingClientRect();if(r.height<43.5||r.width<43.5)out.push(where+': small target "'+(e.textContent.trim().slice(0,22)||e.className)+'" '+Math.round(r.width)+'x'+Math.round(r.height));}
 for(const e of document.querySelectorAll('#s-garage *,.sheet *')){if(!vis(e))continue;const cs=getComputedStyle(e);if(!e.children.length&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+2&&cs.overflow!=='visible'&&cs.textOverflow!=='ellipsis')out.push(where+': clipped "'+e.textContent.trim().slice(0,26)+'"');
  const r=e.getBoundingClientRect();if(r.right>W+1&&cs.position!=='fixed')out.push(where+': off-screen '+e.className+' '+Math.round(r.right));}
 return out;}"""
async def run(p,w,h,tag,touch,uid):
 b,pg,errs=await open_game(p,w,h,user={'id':uid,'first_name':'Layout'})
 issues=[]
 async def press(sel):
  if touch:await pg.locator(sel).first.click()
  else:await pg.locator(sel).first.focus();await pg.keyboard.press('Enter')
  await pg.wait_for_timeout(260)
 await pg.evaluate("()=>{save.welcomed=true;save.mp=0;store();closeAll();setGfx('high');setTab('garage');}");await pg.wait_for_timeout(900)
 assert await pg.evaluate('()=>!!save.lab&&gIds().length===2'),'local economy has two bays'
 issues+=await pg.evaluate(AUDIT,tag+' match0');await pg.screenshot(path=OUT+tag+'-match0.png')
 # match 5+: every section open in turn
 await pg.evaluate("()=>{save.mp=6;save.pts=40000;save.moonbeam=true;save.wOwn={pulse:[0,1,2],twin:[0,1],siege:[0,2]};save.cOwn={scout:[0,1],vanguard:[0,1,2],titan:[0,2]};save.paints={stock:1,ember:1,gold:1,hyper:1};save.vg=0;store();uiDirty();}");await pg.wait_for_timeout(400)
 await pg.screenshot(path=OUT+tag+'-match5.png')
 for k in ['loadout','cores','up','fit','style']:
  shut=not await pg.locator('#gs-'+k+' .gsec-b').count()
  if shut:await press('#gs-'+k+' .gsec-h')
  assert await pg.locator('#gs-'+k+' .gsec-b').count()==1,(tag,k)
  if not touch and shut:assert await pg.evaluate("k=>!!document.activeElement.closest('#gs-'+k)",k),(tag,'keyboard focus',k)
  await pg.evaluate("k=>document.querySelector('#gs-'+k).scrollIntoView({block:'start'})",k);await pg.wait_for_timeout(150)
  issues+=await pg.evaluate(AUDIT,tag+' '+k);await pg.screenshot(path=OUT+tag+'-sec-'+k+'.png')
 if w<768:assert await pg.locator('.gsec-b').count()==1,'phones: one section open at a time'
 # compare cards: a mod (inline), the weapon sheet with the Legendary showcase, a core socket
 if not await pg.locator('#gs-fit .gsec-b').count():await press('#gs-fit .gsec-h')
 await press('#gs-fit [data-act="gcmp"][data-arg="fit|hull|light"]');issues+=await pg.evaluate(AUDIT,tag+' mod compare');await pg.screenshot(path=OUT+tag+'-compare-mod.png')
 await pg.evaluate("()=>{gCmp=null;openBayGear(true);}");await pg.wait_for_timeout(300)
 await press('.sheet [data-act="gcmp"][data-arg="w|moon"]');await pg.wait_for_timeout(250)
 assert 'Legendary' in await pg.locator('.sheet .gcmp').inner_text()
 issues+=await pg.evaluate(AUDIT,tag+' weapon sheet');await pg.screenshot(path=OUT+tag+'-legendary.png')
 await pg.evaluate("()=>{closeAll();openBayCore(1);}");await pg.wait_for_timeout(300);await press('.sheet [data-act="gcmp"][data-arg="core|1|spd"]')
 issues+=await pg.evaluate(AUDIT,tag+' core sheet');await pg.screenshot(path=OUT+tag+'-compare-core.png')
 await pg.evaluate("()=>{closeAll();ACT.gshare();}");await pg.wait_for_timeout(500);issues+=await pg.evaluate(AUDIT,tag+' share');await pg.screenshot(path=OUT+tag+'-share.png')
 await pg.evaluate("()=>{closeAll();setGfx('low');setTab('garage');}");await pg.wait_for_timeout(500)
 assert await pg.evaluate('()=>!gShowroom&&!!document.querySelector(".g-stage.static canvas")'),'Low: static picture'
 await pg.screenshot(path=OUT+tag+'-low.png')
 await b.close()
 return issues,errs
async def main():
 start_dev();bad=[]
 async with async_playwright() as p:
  for i,(w,h,tag,touch) in enumerate(SIZES):
   iss,errs=await run(p,w,h,tag,touch,993100+i);u=sorted(set(iss))
   print(tag,'issues:',len(u));[print('   ',x) for x in u[:30]]
   if errs:print('   ERRORS',errs[:5])
   bad+=u+errs
 print('RESULT','PASS' if not bad else 'FAIL');sys.exit(1 if bad else 0)
asyncio.run(main())
