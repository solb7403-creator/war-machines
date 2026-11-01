# Squad / invites in a real browser at 390px.
# 1) Website: an invite link (?i=<code>) survives the landing page, the sign-in redirect and closing/reopening the
#    browser, and rides on the first sync (stubbed account routes; the server side is covered by wtest/referrals.mjs).
# 2) Telegram: the Squad section (phase, verified count, match bonus, 5% cap, held reason, research ranking) renders at
#    390px with no horizontal overflow, against the local server stand-in. Screenshots go to the scratch dir.
import asyncio,json,os,pathlib,sys
from playwright.async_api import async_playwright
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
OUT=pathlib.Path(os.environ.get('OUT','/tmp/squad-shots'));OUT.mkdir(parents=True,exist_ok=True)
REPO=pathlib.Path(harness.REPO);CHROME=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
SITE='https://lunar.test'
async def website(p):
 b=await p.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
 ctx=await b.new_context(viewport={'width':390,'height':844})
 syncs=[]
 async def route(r):
  u=r.request.url
  if not u.startswith(SITE):return await r.abort()
  path=u[len(SITE):].split('?')[0].split('#')[0]
  if path=='/auth/session':return await r.fulfill(status=401,body='{}',content_type='application/json')
  if path=='/api/sync':syncs.append(json.loads(r.request.post_data or '{}'));return await r.fulfill(status=500,body='{"error":"stub"}',content_type='application/json')
  if path.endswith('/'):path+='index.html'
  f=(REPO/path.lstrip('/')).resolve()
  if REPO.resolve() not in f.parents or not f.is_file():return await r.fulfill(status=404,body='')
  ct={'.html':'text/html','.js':'application/javascript','.css':'text/css'}.get(f.suffix,'application/octet-stream')
  return await r.fulfill(body=f.read_bytes(),content_type=ct)
 await ctx.route('**/*',route)
 pg=await ctx.new_page();await pg.goto(SITE+'/web/?i=abcd2345#play');await pg.wait_for_timeout(500)
 assert json.loads(await pg.evaluate("localStorage.getItem('lunar-invite')"))['c']=='abcd2345','landing keeps the invite'
 assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),'landing overflow at 390'
 await pg.close()   # closed Safari
 pg=await ctx.new_page();await pg.goto(SITE+'/web/login.html#play');await pg.wait_for_timeout(300)   # reopened later, no link
 assert json.loads(await pg.evaluate("localStorage.getItem('lunar-invite')"))['c']=='abcd2345','survives close/reopen'
 # the session stub says signed in for the boot page: its first sync must carry the code
 async def signed(r):
  return await r.fulfill(body=json.dumps({'csrf':'x','user':{'id':1},'pid':'ln_1000000000009'}),content_type='application/json')
 await ctx.route(SITE+'/auth/session',signed)
 await pg.goto(SITE+'/web/play.html#play');await pg.wait_for_timeout(800)
 assert syncs and syncs[0].get('inv')=='abcd2345',('first sync body',syncs)
 # a stale (15-day-old) code is not sent
 await pg.evaluate("localStorage.setItem('lunar-invite',JSON.stringify({c:'abcd2345',t:Date.now()-15*864e5}))");syncs.clear()
 await pg.reload();await pg.wait_for_timeout(800)
 assert syncs and 'inv' not in syncs[0],syncs
 await b.close();print('PASS website invite survives landing, sign-in redirect, close/reopen; expires after 14 days')
async def telegram(p):
 dev=harness.start_dev()
 try:
  user={'id':777321,'username':'squadlead','first_name':'Lead'}
  b,pg,errs=await harness.open_game(p,user=user,eco='server',scale=2)
  day=await pg.evaluate('dayNum()')
  for i,(vd,held) in enumerate([(6,False),(5,False),(3,False),(9,True)]):
   pid='tg_88800'+str(i)
   harness.dev('/__set',{'path':'players/'+pid,'value':{'name':['Nova','Orbit','Rookie','Twin'][i],'ref':'tg_777321','pts':vd*3000,'days':vd,'ld':day,'vd':vd,'vdl':day,'rb':vd*9000,'rms':[3,3][:min(2,vd//2)]}})
   if held:
    harness.dev('/__set',{'path':'fh/'+pid,'value':1});harness.dev('/__set',{'path':'flags/'+pid,'value':{'n':'Twin','r':{'alt':{'t':1,'v':'shares a device with referrer tg_777321'}}}})
  await pg.evaluate("()=>{save.welcomed=true;closeAll();squadT=0;loadSquad(true);setTab('quests')}")
  await pg.wait_for_function('()=>typeof squadInfo!=="undefined"&&squadInfo&&squadInfo.code',timeout=10000)
  await pg.evaluate("()=>{uiDirty('quests');renderScreen('quests');document.querySelector('.plate.squad').scrollIntoView()}");await pg.wait_for_timeout(400)
  txt=await pg.inner_text('.plate.squad')
  for want in ['launch bonus','Verified active','Match bonus','5% share today','On hold','research ranking, not a guarantee','t.me/LunarWarMachinesBot/play?startapp=ref_777321']:
   assert want in txt,(want,txt)
  assert 'guaranteed $LUNAR' not in txt
  assert await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),'squad overflow at 390'
  assert await pg.evaluate("[...document.querySelectorAll('.plate.squad *')].every(e=>e.getBoundingClientRect().right<=innerWidth+1)"),'squad element past the edge'
  await pg.screenshot(path=str(OUT/'squad-telegram-390.png'))
  assert not errs,errs
  await b.close();print('PASS telegram squad screen at 390px: phase, verified, bonus, cap, hold reason, research ranking, no overflow')
 finally:
  if dev:dev.terminate()
async def main():
 async with async_playwright() as p:
  await website(p);await telegram(p)
asyncio.run(main())
