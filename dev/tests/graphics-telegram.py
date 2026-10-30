# Actual Telegram entry and shared art renderer with a signed disposable SDK/user fixture; no production traffic.
import asyncio,pathlib,mimetypes,json,time,hmac,hashlib,urllib.parse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path('/workspace/graphics-session4-evidence');BASE='https://solb7403-creator.github.io/war-machines';FIX='http://127.0.0.1:8797';API='https://lunar-api.solb7403.workers.dev'
async def main():
 user={'id':91002941,'first_name':'Fixture','username':'visual_fixture'};q={'auth_date':str(int(time.time())),'user':json.dumps(user,separators=(',',':'))};data='\n'.join(k+'='+q[k] for k in sorted(q));secret=hmac.new(b'WebAppData',b'123:fixture',hashlib.sha256).digest();q['hash']=hmac.new(secret,data.encode(),hashlib.sha256).hexdigest();init=urllib.parse.urlencode(q)
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);ctx=await b.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='no-preference');errors=[];calls=[]
  await ctx.add_init_script('window.Telegram={WebApp:{initData:'+json.dumps(init)+',initDataUnsafe:{user:'+json.dumps(user)+'},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};')
  async def route(r):
   u=r.request.url
   if u=='https://telegram.org/js/telegram-web-app.js':return await r.fulfill(body='/* local injected SDK fixture */',content_type='application/javascript')
   if u.startswith('https://warmachines-a6034-default-rtdb.firebaseio.com/'):
    assert r.request.method=='GET' and urllib.parse.urlparse(u).path=='/lb.json','No fake service writes or unknown DB paths';return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'https://solb7403-creator.github.io'})
   if u.startswith(API+'/'):
    entry={'path':u[len(API):],'method':r.request.method};calls.append(entry);res=await r.fetch(url=FIX+u[len(API):]);entry['status']=res.status;return await r.fulfill(response=res)
   assert u.startswith(BASE+'/'),'Blocked external fallback: '+u
   f=ROOT/u[len(BASE)+1:].split('?')[0];assert f.is_file(),f;body=f.read_bytes();
   if f.name=='graphics.js':body=body.replace(b'enabled:false',b'enabled:true')
   await r.fulfill(body=body,content_type=mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
  await ctx.route('**/*',route);pg=await ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));await pg.goto(BASE+'/index.html')
  try:await pg.wait_for_function('()=>typeof save!=="undefined"&&!!save?.lab&&typeof Environment3D!=="undefined"&&Environment3D.active()',timeout=20000)
  except Exception:
   diag=await pg.evaluate('()=>({inTG:typeof IN_TG!=="undefined"&&IN_TG,hasLab:typeof save!=="undefined"&&!!save?.lab,ready:typeof R3!=="undefined"?R3:null,hf:typeof Equipment3D!=="undefined"?Equipment3D.stats():null,enabled:typeof Equipment3D!=="undefined"&&Equipment3D.enabled,syncFails:typeof syncFails!=="undefined"?syncFails:null})');(OUT/'telegram-diagnostic.json').write_text(json.dumps({'state':diag,'calls':calls,'errors':errors},indent=2));raise
  await pg.evaluate('()=>{save.welcomed=true;closeAll();passState();setGfx("high");setTab("garage");}')
  original=await pg.evaluate('JSON.stringify(ecoCopy())');bays=await pg.evaluate('JSON.stringify(save.lab)');await pg.screenshot(path=str(OUT/'telegram-garage-390.png'));n=len(calls)
  await pg.evaluate('()=>{const original=drawEquipmentIdle;drawEquipmentIdle=function(...args){const result=original(...args);const A=artR();window.__engineerArt={stage:!!A.envStage,stageKind:A.envStage?.kind,calls:A.r.info.render.calls,triangles:A.r.info.render.triangles,error:A.r.getContext().getError()};return result;};}')
  await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.select_option('#lab-chassis','vanguard:0');await pg.select_option('#lab-weapon','moon:2');await pg.wait_for_timeout(80);await pg.screenshot(path=str(OUT/'telegram-engineer-390.png'));assert await pg.evaluate('GraphicsRelease.enabled&&!window.LUNAR_HF_SAMPLE&&!!AR.preview?.T.motion');root=await pg.evaluate('AR.preview.T.g.uuid');await pg.wait_for_timeout(300);assert await pg.evaluate('AR.preview.T.g.uuid')==root,'idle preview must retain its actual model'
  art=await pg.evaluate('''()=>{const A=artR(),c=document.getElementById('lab-preview');return {IN_TG,webEdition:WEB_EDITION,...window.__engineerArt,q:Equipment3D.quality,width:c.clientWidth,height:c.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth};}''');assert art['IN_TG'] and not art['webEdition'] and art['stage'] and art['stageKind']=='engineer' and art['error']==0 and not art['overflow'],art
  assert await pg.evaluate('JSON.stringify(save.lab)')==bays and json.loads(await pg.evaluate('JSON.stringify(ecoCopy())'))==json.loads(original)
  assert not any(x['method']=='POST' and any(s in x['path'] for s in ['/api/act','/api/match','/api/pvp','/api/pay','/api/ghost']) for x in calls[n:]);assert not errors,errors
  (OUT/'telegram-rc.json').write_text(json.dumps({'art':art,'errors':errors,'fixture':'Signed fake Mini App SDK/identity, local real Worker with fake storage; no physical Telegram/iPhone'},indent=2));await b.close();print('PASS actual Telegram entry, signed synthetic identity, shared Engineer/Garage environment art, unchanged bays/economy',art,flush=True)
asyncio.run(main())
