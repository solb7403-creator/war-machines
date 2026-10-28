# Real page + isolated Worker/fake DB. All nonlocal/nonmocked routes aborted by harness.
import asyncio,os,json,time
from harness import start_dev,open_game,dev
from playwright.async_api import async_playwright
UID=int(time.time()*1000)%1000000000
OUT=os.environ.get('SHOTS','/tmp/lunar-session3-shots');os.makedirs(OUT,exist_ok=True)
async def main():
 server=start_dev()
 try:
  async with async_playwright() as p:
   b,pg,errs=await open_game(p,320,740,eco='server',user={'id':UID,'first_name':'Engineer'})
   await pg.wait_for_timeout(700)
   assert await pg.evaluate('()=>!!save.lab'),'server Lab arrived'
   await pg.evaluate('()=>{save.welcomed=true;closeAll();setTab("garage");}')
   await pg.wait_for_timeout(400)
   assert await pg.locator('[data-act="labedit"]').count()==2,'two machine cards'
   await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.wait_for_timeout(300)
   await pg.locator('#lab-name').fill('MK-II Scout')
   await pg.locator('#lab-core-0').select_option('spd')
   await pg.locator('#lab-fit-hull').select_option('plates')
   await pg.locator('#lab-fit-mobility').select_option('stable')
   assert 'Weight 3/3' in await pg.locator('#lab-metrics').inner_text()
   await pg.locator('#lab-fit-mount').select_option('hardened')
   assert await pg.locator('[data-act="labsave"]').is_disabled()
   await pg.locator('#lab-fit-mount').select_option('stock')
   await pg.screenshot(path=OUT+'/engineer-320.png',full_page=True)
   await pg.locator('[data-act="labsave"]').click();await pg.wait_for_timeout(600)
   assert await pg.evaluate('()=>save.lab.machines.m_spare.spec.cores[0]')=='spd'
   assert await pg.evaluate('()=>save.lab.machines.m_legacy.spec.cores[0]')=='dmg'
   await pg.locator('[data-act="labequip"][data-arg="m_spare"]').click();await pg.wait_for_timeout(600)
   assert await pg.evaluate('()=>save.cores[0]')=='spd'
   assert await pg.evaluate('()=>myLoadout().mods.hull')=='plates'
   assert await pg.evaluate('()=>save.lab.machines.m_legacy.spec.mods?.hull||"stock"')=='stock'
   await pg.screenshot(path=OUT+'/garage-320.png',full_page=True)
   await pg.reload();await pg.wait_for_timeout(2000)
   assert await pg.evaluate('()=>save.lab.active')=='m_spare'
   # A server-side upgrade from another device changes stats without lab revision.
   dev('/__set',{'path':f'eco/tg_{UID}/up/hull','value':1})
   actual=await pg.evaluate('async()=>{save.up.hull=0;prepareMatch();await mTicket.p;return me.mhp;}')
   assert actual==1946,actual
   await pg.evaluate('()=>{state="menu";}')
   dev('/__set',{'path':f'eco/tg_{UID}/up/hull','value':0})
   await pg.evaluate('()=>doSync(false)')
   # Older account reply cannot erase later selection.
   assert await pg.evaluate('()=>{const E=ecoCopy();E._rev=0;E.lab.active="m_legacy";applyEco(E);return save.lab.active;}')=='m_spare'
   # Actual fight object and counterpick use captured equipment, not mutated garage.
   for g in ['arena','zone','crystal','bounty','royale','boss']:
    o=await pg.evaluate('''g=>{closeAll();save.gtype=g;save.mode='1v1';prepareMatch();const hp=me.mhp,w=me.wtype;save.up.hull=4;save.weapon='moon';switchChassis('vanguard');return {same:me.mhp===hp&&me.wtype===w,g:matchG};}''',g)
    assert o['same'],o
    await pg.evaluate('()=>{state="menu";save.up.hull=0;save.weapon="pulse";}')
   round_end=await pg.evaluate("""()=>{state='menu';save.gtype='arena';save.mode='1v1';save.mp=25;prepareMatch();startMatch();const rnd=Math.random;Math.random=()=>0;units[1].cls='scout';units[1].hp=0;update(1/30);Math.random=rnd;return {state,k:PR.k,hp:PR.buf[(PR.k-1)*PR.sz+5]};}""")
   assert round_end['state']=='round' and round_end['hp']==0,round_end
   await pg.evaluate('()=>{state="menu";closeAll();}')
   for gfx in ['2d','high']:
    await pg.set_viewport_size({'width':390,'height':844});await pg.evaluate('g=>{document.body.classList.remove("battle");setGfx(g);setTab("garage");}',gfx);await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT+'/garage-'+gfx+'.png',full_page=True)
   assert not errs,errs
   print('PASS modular browser budget/preview/save/reload, two slots, edit/equip/reload, stale reply, six-mode frozen counterpick, 320/390px 2D/3D')
   await b.close()
   b,fb,ferr=await open_game(p,320,740,eco='server',user={'id':UID+1,'first_name':'Fallback'},init="const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return String(t).includes('webgl')?null:original.call(this,t,...args);};")
   await fb.wait_for_timeout(700)
   await fb.evaluate("async()=>{save.welcomed=true;closeAll();const M=save.lab.machines.m_legacy;await labRequest('lab_save',{id:'m_legacy',rev:save.lab.rev,name:'Fallback',spec:{...M.spec,mods:{hull:'light',mount:'firing'},catalog:1}});setTab('garage');}")
   await fb.wait_for_timeout(300)
   assert await fb.evaluate('()=>R3.failed'),'WebGL unavailable uses fallback'
   await fb.screenshot(path=OUT+'/fallback-320.png',full_page=True)
   assert not ferr,ferr
   await b.close()
 finally:
  if server:server.terminate();server.wait()
asyncio.run(main())
