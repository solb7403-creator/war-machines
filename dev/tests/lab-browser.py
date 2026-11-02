# The garage in the Telegram Mini App, on the real page with the isolated Worker + fake database (harness). Every flow
# writes through the server-checked lab save: two bays, select, compare then commit (gear, core, mod, look, paint,
# upgrade), rename, equip, Free Test, inspect sheet, progressive unlocks, rev conflict reload, offline rollback, the
# match ticket for both bays, share card, and the 3D stage's static fallbacks.
import asyncio,os,json,time
from harness import start_dev,open_game,dev
from playwright.async_api import async_playwright
UID=int(time.time()*1000)%1000000000
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/garage';os.makedirs(OUT,exist_ok=True)
async def main():
 server=start_dev()
 try:
  async with async_playwright() as p:
   b,pg,errs=await open_game(p,390,844,eco='server',user={'id':UID,'first_name':'Garage'})
   await pg.wait_for_function('!!save.lab');await pg.wait_for_timeout(500)
   K='eco/tg_'+str(UID)
   rec=lambda:dev('/__dump')['eco']['tg_'+str(UID)]
   async def sync():await pg.evaluate('async()=>{await doSync(false);}');await pg.wait_for_timeout(150)
   async def idle():await pg.evaluate('()=>gIdle()');await pg.wait_for_timeout(120)
   await pg.evaluate('()=>{save.welcomed=true;closeAll();setGfx("high");setTab("garage");}');await pg.wait_for_timeout(900)
   # 1. two bays, A and B, the active one deploys; a new pilot (match 0) sees Upgrades and Mods locked
   assert await pg.locator('.gbay').count()==2
   assert 'BAY A' in await pg.locator('.gbay').nth(0).inner_text() and 'BAY B' in await pg.locator('.gbay').nth(1).inner_text()
   assert await pg.locator('#gs-up.locked').count()==1 and await pg.locator('#gs-fit.locked').count()==1
   assert 'Unlocks after 2 matches' in await pg.locator('#gs-up').inner_text() and 'Unlocks after 5 matches' in await pg.locator('#gs-fit').inner_text()
   for k in ['loadout','cores','style']:assert await pg.locator('#gs-'+k+'.locked').count()==0
   assert await pg.evaluate('()=>!!(gShowroom&&gShowroom.renderer)'),'live 3D stage on High'
   await pg.screenshot(path=OUT+'/tg-match0.png')
   # 2. pick Bay B; the live stage follows it; Bay A keeps its own spec
   await pg.locator('.gbay-pick').nth(1).click();await pg.wait_for_timeout(300)
   assert await pg.evaluate('()=>gBayId()')=='m_spare'
   assert await pg.locator('#g-stage-slot .g-stage').count()==1,'one live stage'
   assert await pg.evaluate('()=>document.querySelectorAll("#s-garage canvas[data-art^=lab]").length')==2,'both bay cards keep a static picture'
   # grant a full arsenal on the server (another device's purchases) and sync
   S=rec();S['wOwn']={k:[0,1,2] for k in ['pulse','twin','siege']};S['cOwn']={k:[0,1,2] for k in ['scout','vanguard','titan']}
   S['roll']={k+':'+str(t):1.08 for k in [*S['wOwn'],*S['cOwn']] for t in range(3)};S['paints']={'stock':1,'ember':1};S['pts']=60000
   dev('/__set',{'path':K,'value':S});await sync()
   # 3. Loadout: tap a weapon -> compare (no save yet) -> commit -> saved to Bay B only
   await pg.locator('#gs-loadout [data-act="gear"][data-arg="w"]').click();await pg.wait_for_timeout(250)
   rev0=await pg.evaluate('()=>save.lab.rev')
   await pg.locator('[data-act="gcmp"][data-arg="w|siege:2"]').click();await pg.wait_for_timeout(200)
   cmp=await pg.locator('.sheet .gcmp').inner_text();assert 'Firepower' in cmp and 'Toughness' in cmp and 'Power' in cmp,cmp
   assert await pg.evaluate('()=>save.lab.rev')==rev0,'compare does not save'
   assert await pg.locator('.sheet .gcmp .gd.up').count()>=1,'a better stat shows green'
   await pg.screenshot(path=OUT+'/tg-compare.png')
   await pg.locator('.sheet [data-act="labinspect"][data-arg="weapon"]').last.click();await pg.wait_for_timeout(250)
   t=await pg.locator('#lab-item-art').locator('..').inner_text();assert 'Titanfall' in t and 'Back to the Garage' in t and 'Epic' in t,t
   await pg.locator('[data-act="labinspectclose"]').click()
   await pg.locator('.sheet [data-act="gequip"]').click();await idle()
   specs=await pg.evaluate('()=>({a:save.lab.machines.m_legacy.spec,b:save.lab.machines.m_spare.spec})')
   assert specs['b']['w']=={'a':'siege','t':2,'s':False},specs;assert specs['a']['w']['a']=='pulse'
   assert rec()['lab']['machines']['m_spare']['spec']['w']['a']=='siege','server has it'
   # 4. Cores: socket 1 -> Speed (compare, then commit; the core that was there swaps)
   await pg.locator('#gs-cores .gsec-h').click();await pg.locator('#gs-cores [data-act="core"][data-arg="0"]').click();await pg.wait_for_timeout(200)
   await pg.locator('[data-act="gcmp"][data-arg="core|0|spd"]').click();assert 'Speed' in await pg.locator('.sheet .gcmp').inner_text()
   await pg.locator('.sheet .gcmp [data-act="gcore"]').click();await idle()
   assert await pg.evaluate('()=>save.lab.machines.m_spare.spec.cores[0]')=='spd' and await pg.evaluate('()=>save.lab.machines.m_legacy.spec.cores[0]')=='dmg'
   # 5. progressive unlock: 5 matches on the server -> both sections open, a badge on the Garage tab, "New: unlocked" once
   dev('/__set',{'path':K+'/mp','value':5});await sync();await pg.evaluate('()=>uiDirty()');await pg.wait_for_timeout(200)
   assert await pg.locator('#gs-up.new .newchip').count()==1 and await pg.locator('#gs-fit.new').count()==1
   assert await pg.locator('.tab[data-arg="garage"].alert').count()==1,'Garage tab badge'
   await pg.screenshot(path=OUT+'/tg-unlocked.png')
   # 6. Upgrades (shared by both bays): compare, then buy
   await pg.locator('#gs-up .gsec-h').click();await pg.wait_for_timeout(150)
   assert 'Shared by both bays' in await pg.locator('#gs-up').inner_text()
   assert await pg.locator('#gs-cores .gsec-b').count()==0,'phones: one section open at a time'
   await pg.locator('[data-act="gupc"][data-arg="hull"]').click();assert 'Toughness' in await pg.locator('#gs-up .gcmp').inner_text()
   await pg.locator('#gs-up .gcmp [data-act="up"]').click();await pg.wait_for_timeout(500)
   assert await pg.evaluate('()=>save.up.hull')==1
   assert await pg.locator('#gs-up.new').count()==0,'New shown once'
   # 7. Mods: plain-words trade-offs from FITS, budget, options that don't fit are disabled with the reason
   await pg.locator('#gs-fit .gsec-h').click();await pg.wait_for_timeout(150)
   txt=await pg.locator('#gs-fit').inner_text();assert 'Reinforced plates' in txt and '+6% health, −4% speed' in txt,txt
   await pg.locator('[data-act="gcmp"][data-arg="fit|hull|plates"]').click();await pg.locator('#gs-fit .gcmp [data-act="gfit"]').click();await idle()
   assert await pg.evaluate('()=>save.lab.machines.m_spare.spec.mods.hull')=='plates'
   dis=await pg.evaluate('()=>[...document.querySelectorAll("#gs-fit .gopt:disabled")].map(b=>b.dataset.arg+": "+b.innerText)')
   assert any('mount|hardened' in d and 'Doesn’t fit' in d for d in dis),dis
   await pg.screenshot(path=OUT+'/tg-mods.png',full_page=False)
   # 8. Style: owned paint and a look apply at once (looks only); Lunar Skin shows its rules bonus
   await pg.locator('#gs-style .gsec-h').click();await pg.wait_for_timeout(150)
   assert 'Looks only' in await pg.locator('#gs-style').inner_text() and 'Legendary' in await pg.locator('#gs-style .gskin').inner_text()
   await pg.locator('#gs-style [data-act="paint"][data-arg="ember"]').click();await idle()
   await pg.locator('#gs-style [data-act="glook"][data-arg="mount|firing"]').click();await idle()
   sb=await pg.evaluate('()=>save.lab.machines.m_spare.spec');assert sb['paint']=='ember' and sb['looks']['mount']=='firing',sb
   # 9. rename, persisted on the server
   await pg.locator('#g-name').fill('Siege Wall');await pg.locator('#g-name').press('Enter');await idle()
   assert rec()['lab']['machines']['m_spare']['name']=='Siege Wall'
   # 10. rev conflict: another device saved meanwhile -> the bay reloads and this change still lands
   dev('/__set',{'path':K+'/lab/rev','value':rec()['lab']['rev']+3})
   await pg.evaluate('()=>ACT.glook("hull|light")');await idle();await pg.wait_for_timeout(300)
   assert rec()['lab']['machines']['m_spare']['spec']['looks']['hull']=='light','change applied after conflict reload'
   # 11. offline: optimistic change rolls back with the reason
   await pg.route('**/api/act',lambda r:r.abort())
   assert await pg.evaluate('()=>{ACT.glook("hull|plates");return save.lab.machines.m_spare.spec.looks.hull;}')=='plates','optimistic: the screen shows it at once'
   await idle();await pg.wait_for_timeout(200)
   assert await pg.evaluate('()=>save.lab.machines.m_spare.spec.looks.hull')=='light','rolled back'
   assert 'no connection' in (await pg.locator('#toast').inner_text()).lower()
   await pg.unroute('**/api/act')
   # 12. Legendary showcase: Moonbeam (owned after a purchase) shows its edge vs the best Epic, from the rules
   dev('/__set',{'path':K+'/moonbeam','value':True});await sync()
   await pg.evaluate('()=>{closeAll();openBayGear(true);}');await pg.wait_for_timeout(200)
   await pg.locator('[data-act="gcmp"][data-arg="w|moon"]').click();e=await pg.locator('.sheet .gcmp .gedge').inner_text()
   assert 'Legendary' in e and 'best Epic' in e and 'firepower' in e,e
   await pg.screenshot(path=OUT+'/tg-legendary.png')
   await pg.evaluate('()=>closeAll()')
   # 13. one source of truth: each bay, once equipped, is exactly what the match ticket fields (labLoadout -> setLoadout)
   for bay in ['m_spare','m_legacy']:
    await pg.evaluate('id=>ACT.labequip(id)',bay);await idle()
    o=await pg.evaluate('''async id=>{closeAll();save.gtype='arena';save.mode='1v1';prepareMatch();await mTicket.p;const spec=save.lab.machines[id].spec,L=ecoLoadout(save,spec);
      const r={active:save.lab.active,me:{w:me.wtype,cls:me.cls,mhp:me.mhp},want:{w:L.w.a,cls:L.c.c,mhp:tankOf(L,me.mhp/tankOf(L,1).mhp).mhp},L};state='menu';exitBattle&&0;return r;}''',bay)
    srvL=rec()['L'];assert o['active']==bay,o
    for k in ['w','c','cores','mods','paint']:assert srvL[k]==o['L'][k],(bay,k,srvL[k],o['L'][k])
    assert o['me']['w']==o['want']['w'] and o['me']['cls']==o['want']['cls'],o
   await pg.evaluate('()=>{state="menu";closeAll();setTab("garage");}')
   # 14. Free Test tests the selected bay as saved
   await pg.evaluate('()=>{gSelect("m_spare");uiDirty();}');await pg.wait_for_timeout(200)
   await pg.locator('.gbay').nth(1).locator('[data-act="rangecard"]').click();await pg.wait_for_timeout(400)
   assert 'Siege Wall' in await pg.locator('.sheet').last.inner_text()
   await pg.evaluate('()=>closeAll()')
   # 15. share card: picture + call sign + power + league + tag + the pilot's own invite link; Telegram shares via shareRef
   await pg.locator('[data-act="gshare"]').click();await pg.wait_for_timeout(500)
   assert await pg.locator('.gshare-img').count()==1
   await pg.screenshot(path=OUT+'/tg-share.png')
   await pg.locator('[data-act="gsharego"]').click();opened=await pg.evaluate('()=>window.__opened')
   assert opened and 't.me/share/url' in opened and ('ref_'+str(UID)) in opened and 'airdrop' not in opened.lower() and '%24LUNAR' not in opened,opened
   await pg.evaluate('()=>closeAll()')
   # 16. the battle roster on Play points to the garage
   await pg.evaluate('()=>setTab("play")');assert 'Edit either build in the Garage.' in await pg.locator('#s-play').inner_text()
   # 17. static picture on 2D and Low (no live canvas)
   for g in ['2d','low']:
    await pg.evaluate('g=>{setGfx(g);setTab("garage");}',g);await pg.wait_for_timeout(500)
    assert await pg.evaluate('()=>!gShowroom&&document.querySelector(".g-stage.static .g-scene canvas")!==null'),g
   await pg.evaluate('()=>setGfx("high")');await pg.wait_for_timeout(300)
   await pg.reload();await pg.wait_for_function('save.lab?.active==="m_legacy"')
   assert await pg.evaluate('()=>save.lab.machines.m_spare.name')=='Siege Wall','survives reload'
   assert not errs,errs
   await b.close()
   # 18. reduced motion and no WebGL: the static picture, no errors
   for init in ["matchMedia=(q=>({matches:/reduce/.test(q),addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));",
                "const o=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return String(t).includes('webgl')?null:o.call(this,t,...a);};"]:
    b,pg,errs=await open_game(p,390,844,eco='server',user={'id':UID+1,'first_name':'Fallback'},init=init)
    await pg.wait_for_function('!!save.lab');await pg.evaluate('()=>{save.welcomed=true;closeAll();setGfx("high");setTab("garage");}');await pg.wait_for_timeout(900)
    assert await pg.evaluate('()=>!gShowroom&&!!document.querySelector(".g-stage.static canvas")'),'static fallback'
    await pg.screenshot(path=OUT+'/tg-fallback.png');assert not errs,errs;await b.close()
   print('PASS garage: two bays, compare+commit (gear/core/mod/look/paint/upgrade), rename, unlocks, conflict reload, offline rollback, legendary, ticket = bay for both bays, Free Test, share, fallbacks')
 finally:
  if server:server.terminate();server.wait()
asyncio.run(main())
