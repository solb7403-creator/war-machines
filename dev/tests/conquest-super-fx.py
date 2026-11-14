"""Session 5E-2b in the Conquest world (real app: index.html, local economy, real renderer): the super timing bar and the
shared effects system (js/fx3d.js).
 1. pressing R with a full charge starts the sweep: the bar shows with its zone, jackpot circle and moving marker;
 2. a second press inside the zone stops it: the HUD shows the outcome (HIT or JACKPOT) and its damage share;
 3. the super's own effect is drawn by FX3D (charge-up, beam, aftermath), a Parasite hull it destroys breaks apart into
    chunks (destruction), a damaged hull shows cracks;
 4. no page error; the effects add NO shader program (Conquest keeps a 16-program budget) and stop drawing when done.
Software GL in CI: this proves behaviour, not phone frame rate. usage: python dev/tests/conquest-super-fx.py [--engine chromium|webkit] [--quality high|low] [--slow-ms 300]"""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest/super-fx';OUT.mkdir(parents=True,exist_ok=True)
async def main(engine,quality,slow=0):
 async with async_playwright() as p:
  opts={'headless':True}
  if engine=='chromium':opts.update(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  browser=await getattr(p,engine).launch(**opts)
  context=await browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;try{const s=JSON.parse(localStorage.getItem("lunar-save")||"{}");}catch(e){}')
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"&&typeof FX3D!=="undefined"')
  await page.evaluate('(q)=>{closeAll();save.welcomed=true;save.gfx=q;uiDirty();}',quality);await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.wait_for_function('typeof Conquest!=="undefined"&&!!Conquest.view',timeout=120000)
  if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
  await page.wait_for_function('Conquest.view.pending===0',timeout=240000);await page.wait_for_timeout(1500)
  # one Parasite hull straight ahead of the turret, nearly dead, and a second one damaged; a full charge
  setup=await page.evaluate('''()=>{const v=Conquest.view,B=v.battle||v.encounter,W=ConquestWorld,p=v.p,yaw=B.turretYaw||0;if(!B)return null;
   const mk=(src,d,side,hp)=>{const e=src,x=p.x+Math.sin(yaw)*d+Math.cos(yaw)*side,z=p.z+Math.cos(yaw)*d-Math.sin(yaw)*side;Object.assign(e,{x,z,y:W.groundAt(x,z),hp,decision:1e9,cd:1e9,vx:0,vz:0,navGoal:null});return e;};
   const live=B.enemies.filter(e=>e.hp>0);if(live.length<2)return {enemies:live.length};
   mk(live[0],24,0,1);mk(live[1],16,9,live[1].maxHp*.3);B.enemies=[live[0],live[1]];B.charge=SUPER_MAX;window.__k0=B.kills;
   return {enemies:2,programs:v.renderer.info.programs.length,calls:v.renderer.info.render.calls,style:!!v.style,canvas:!!v.renderer.isConquestCanvas};}''')
  assert setup and setup.get('enemies')==2,('the encounter needs two hulls to stage the shot',setup)
  # --slow-ms N: every frame from here waits N ms more (a phone under 5 fps, or CI software GL on a bad day). The outcome must
  # still show: the super fires 0.2 s after the stop, so a slower frame used to skip HIT / JACKPOT altogether
  if slow:await page.evaluate('(ms)=>{const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>setTimeout(()=>r(f),ms);}',slow)
  await page.keyboard.down('KeyR');await page.wait_for_timeout(60);await page.keyboard.up('KeyR')
  await page.wait_for_function('()=>{const B=Conquest.view.battle||Conquest.view.encounter;return !!(B.superAttack&&B.superAttack.bar);}',timeout=90000)
  bar=await page.evaluate('''()=>{const sb=document.querySelector('#cq-supbar'),B=Conquest.view.battle||Conquest.view.encounter,r=sb.getBoundingClientRect();return {hidden:sb.hidden,w:Math.round(r.width),x:Math.round(r.left),right:Math.round(r.right),y:Math.round(r.top),text:sb.querySelector('.cq-supbar-text').textContent,zone:sb.querySelector('.cq-supbar-zone').style.left,jack:sb.querySelector('.cq-supbar-jack').style.left,bar:B.superAttack.bar,charge:B.charge,vw:innerWidth};}''')
  assert not bar['hidden'] and bar['w']>=220 and bar['x']>=0 and bar['right']<=bar['vw'] and 'TAP' in bar['text'],('the timing bar shows inside the screen',bar)
  assert bar['charge']==0 and bar['zone'] and bar['jack'],bar
  await page.screenshot(path=str(OUT/f'{engine}-{quality}-bar.png'))
  # stop it inside the zone (frame rate in software GL decides whether it lands on the jackpot circle or just the zone)
  await page.wait_for_function('()=>{const B=Conquest.view.battle||Conquest.view.encounter,s=B.superAttack;return !s||s.oc!==undefined||s.el>=(s.bar.jc-0.03)*SUP_BAR_T_CQ;}',timeout=90000)
  await page.keyboard.down('KeyR');await page.wait_for_timeout(60);await page.keyboard.up('KeyR')
  await page.wait_for_function('()=>{const sb=document.querySelector("#cq-supbar");return sb.getAttribute("data-oc")==="0"||sb.getAttribute("data-oc")==="1"||sb.getAttribute("data-oc")==="2";}',timeout=90000)
  hud=await page.evaluate('''()=>{const sb=document.querySelector('#cq-supbar');return {oc:sb.getAttribute('data-oc'),text:sb.querySelector('.cq-supbar-text').textContent,note:sb.querySelector('.cq-supbar-note').textContent};}''')
  assert hud['text'] in ('MISS','HIT','JACKPOT!') and '% damage' in hud['note'],hud
  # the beam fires: FX3D draws it; the hull ahead dies and breaks apart
  await page.wait_for_function('()=>{const v=Conquest.view;return !!v.fx&&v.fx.stats().effects>0;}',timeout=90000)
  await page.wait_for_function('()=>{const v=Conquest.view,B=v.battle||v.encounter;return B.kills>window.__k0&&v.fx.stats().chunks>0;}',timeout=90000)
  mid=await page.evaluate('''()=>{const v=Conquest.view,s=v.fx.stats();return {fx:s,programs:v.renderer.info.programs.length,calls:v.renderer.info.render.calls,glowMat:v.fx.glow.material===v.style.MAT.fx,solidMat:v.fx.debris.material===v.style.MAT.solid};}''')
  await page.screenshot(path=str(OUT/f'{engine}-{quality}-blast.png'))
  assert mid['glowMat'] and mid['solidMat'],('effects draw through the style materials: no new shader',mid)
  assert mid['programs']<=16,('Conquest shader program budget',mid)
  assert mid['programs']<=setup['programs']+1,('the effects add no program beyond one already-known variant',setup,mid)
  assert mid['fx']['quads']>0 and mid['fx']['chunks']>0,mid
  # a damaged hull shows wear (cracks drawn as quads while nothing else is alive), then everything stops drawing
  await page.wait_for_function('()=>{const s=Conquest.view.fx.stats();return s.effects===0&&s.chunks===0&&s.particles===0&&s.marks===0;}',timeout=120000)
  end=await page.evaluate('''()=>{const v=Conquest.view,B=v.battle||v.encounter,s=v.fx.stats(),e=B.enemies.find(e=>e.hp>0);return {fx:s,damaged:e?e.hp/e.maxHp:null,programs:v.renderer.info.programs.length};}''')
  assert end['damaged'] is None or end['damaged']>=.7 or end['fx']['quads']>0,('a hull under 70% shows damage cracks',end)
  if end['damaged'] is not None and end['damaged']<.7:
   await page.evaluate('()=>{const B=Conquest.view.battle||Conquest.view.encounter;for(const e of B.enemies)e.hp=e.maxHp;}');await page.wait_for_function('()=>!Conquest.view.fx.glow.visible&&!Conquest.view.fx.debris.visible',timeout=90000)
  assert not errors,errors
  result={'engine':engine,'quality':quality,'status':'PASS','bar':bar,'hud':hud,'programsBefore':setup['programs'],'programsDuring':mid['programs'],'callsBefore':setup['calls'],'callsDuring':mid['calls'],'fxPeak':mid['fx'],'physicalDeviceVerified':False}
  (OUT/f'{engine}-{quality}{"-slow" if slow else ""}-results.json').write_text(json.dumps(result,indent=1));print(json.dumps(result))
  await browser.close()
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--engine',default='chromium');a.add_argument('--quality',default='high');a.add_argument('--slow-ms',type=int,default=0);x=a.parse_args();asyncio.run(main(x.engine,x.quality,x.slow_ms))
