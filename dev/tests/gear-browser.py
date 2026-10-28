import asyncio,json,pathlib,os,time
from harness import start_dev,open_game,dev
from playwright.async_api import async_playwright
OUT=pathlib.Path(os.environ.get('SHOTS','/tmp/lunar-equipment'));OUT.mkdir(parents=True,exist_ok=True);UID=int(time.time()*1000)%1000000000
async def main():
 server=start_dev()
 try:
  async with async_playwright() as p:
   b,pg,errs=await open_game(p,320,740,eco='server',user={'id':UID,'first_name':'Equipment'})
   await pg.wait_for_function('!!save.lab');await pg.wait_for_timeout(500)
   S=dev('/__dump')['eco']['tg_'+str(UID)]
   S['wOwn']={k:[0,1,2] for k in ['pulse','twin','siege']};S['cOwn']={k:[0,1,2] for k in ['scout','vanguard','titan']};S['roll']={k+':'+str(t):1.1 for k in [*S['wOwn'],*S['cOwn']] for t in range(3)};S['moonbeam']=True
   dev('/__set',{'path':'eco/tg_'+str(UID),'value':S})
   await pg.evaluate('async()=>{await doSync(false);closeAll();save.welcomed=true;setTab("garage");}')
   await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click();await pg.wait_for_timeout(250)
   rows=[]
   for key,ks in [('weapon',['pulse','twin','siege']),('chassis',['scout','vanguard','titan'])]:
    for k in ks:
     for t in range(3):
      await pg.locator('#lab-'+key).select_option(k+':'+str(t))
      await pg.locator('[data-act="labinspect"][data-arg="'+key+'"]').click()
      row=await pg.evaluate('''key=>{const sp=labFormSpec(),L=ecoLoadout(save,sp),actual=key==='weapon'?weaponOf(L.w.a,L.w.t,L.w.q,L.w.s):chassisOf(L.c.c,L.c.t,L.c.q,L.c.s);return {key,text:document.querySelector('#lab-item-art').parentElement.innerText,actual,bar:labItemBars(key,sp)};}''',key)
      assert 'undefined' not in row['text'] and 'NaN' not in row['bar'];assert ['Common','Rare','Epic'][t] in row['text']
      expected=await pg.evaluate('''key=>{const L=ecoLoadout(save,labFormSpec());return key==='weapon'?WNAMES[L.w.a][L.w.t]:CNAMES[L.c.c][L.c.t];}''',key)
      assert expected in row['text'],(expected,row['text']);rows.append(row)
      await pg.locator('[data-act="labinspectclose"]').click()
   await pg.locator('#lab-weapon').select_option('moon:2');await pg.locator('[data-act="labinspect"][data-arg="weapon"]').click()
   text=await pg.locator('#lab-item-art').locator('..').inner_text();assert 'Legendary' in text and '118' in text and '592' in text and 'Super wind-up' in text
   await pg.screenshot(path=str(OUT/'moonbeam-320.png'));await pg.locator('[data-act="labinspectclose"]').click()
   await pg.locator('#lab-fit-hull').select_option('light');await pg.locator('#lab-fit-mobility').select_option('sprint')
   await pg.locator('#lab-name').fill('Fast Moonbeam');await pg.locator('[data-act="labsave"]').click();await pg.wait_for_function('save.lab.machines.m_spare.name==="Fast Moonbeam"')
   await pg.locator('[data-act="labequip"][data-arg="m_spare"]').click();await pg.wait_for_timeout(400)
   await pg.reload();await pg.wait_for_function('save.lab?.active==="m_spare"')
   out=await pg.evaluate('()=>({active:save.lab.active,a:save.lab.machines.m_legacy.spec,b:save.lab.machines.m_spare.spec})')
   assert out['a']['w']['a']=='pulse' and out['b']['w']['a']=='moon' and out['b']['mods']['mobility']=='sprint'
   await pg.evaluate('()=>{closeAll();setTab("garage");}');await pg.screenshot(path=str(OUT/'bays-320.png'))
   for width in [390,430]:
    await pg.set_viewport_size({'width':width,'height':844});await pg.evaluate('()=>{closeAll();setGfx("high");setTab("garage");}');await pg.wait_for_timeout(100)
    assert await pg.locator('[data-act="labedit"]').count()==2
   await pg.evaluate('()=>{setGfx("2d");setTab("garage");}');await pg.wait_for_timeout(100)
   assert not errs,errs
   print(json.dumps({'inspected':len(rows)+1,'independent_save_reload':out,'page_errors':errs}));(OUT/'browser.json').write_text(json.dumps(rows,indent=2));await b.close()
   b,fb,ferr=await open_game(p,320,740,eco='server',user={'id':UID+1,'first_name':'Fallback'},init="const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return String(t).includes('webgl')?null:orig.call(this,t,...args);};")
   await fb.wait_for_function('!!save.lab');await fb.evaluate('()=>{closeAll();setTab("garage");}')
   assert await fb.evaluate('()=>R3.failed'),'No-WebGL fallback'
   assert await fb.locator('[data-act="labedit"]').count()==2
   assert not ferr,ferr;await b.close();print('PASS 320/390/430px, 2D/3D and no-WebGL fallback')
 finally:
  if server:server.terminate();server.wait()
asyncio.run(main())
