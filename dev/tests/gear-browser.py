# Every weapon and chassis through the garage picker: tap to compare, open its exact stats (labInspect), check the item
# name, rarity and numbers; Moonbeam's legendary values; save to Bay B, equip, reload; no-WebGL fallback.
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
   S['wOwn']={k:[0,1,2] for k in ['pulse','twin','siege']};S['cOwn']={k:[0,1,2] for k in ['scout','vanguard','titan']};S['roll']={k+':'+str(t):1.1 for k in [*S['wOwn'],*S['cOwn']] for t in range(3)};S['moonbeam']=True;S['mp']=6
   dev('/__set',{'path':'eco/tg_'+str(UID),'value':S})
   await pg.evaluate('async()=>{await doSync(false);closeAll();save.welcomed=true;setTab("garage");gSelect("m_spare");uiDirty();}');await pg.wait_for_timeout(300)
   rows=[]
   for key,slot,ks in [('weapon','w',['pulse','twin','siege']),('chassis','c',['scout','vanguard','titan'])]:
    await pg.evaluate('isW=>{closeAll();openBayGear(isW);}',slot=='w');await pg.wait_for_timeout(200)
    for k in ks:
     for t in range(3):
      iid=k+':'+str(t);eq=await pg.evaluate('isW=>gEqId(isW,gM().spec)',slot=='w')
      if iid!=eq:
       await pg.locator('.sheet [data-act="gcmp"][data-arg="'+slot+'|'+iid+'"]').click();await pg.wait_for_timeout(120)
       await pg.locator('.sheet .gcmp [data-act="labinspect"]').click()
      else:await pg.locator('.sheet [data-act="labinspect"][data-arg="'+key+'"]').first.click()
      await pg.wait_for_timeout(150)
      row=await pg.evaluate('''([key,slot,iid])=>{const spec=gCand(gM().spec,slot,iid),L=ecoLoadout(save,spec),actual=key==='weapon'?weaponOf(L.w.a,L.w.t,L.w.q,L.w.s):chassisOf(L.c.c,L.c.t,L.c.q,L.c.s);
        return {key,iid,text:document.querySelector('#lab-item-art').parentElement.innerText,actual,bar:labItemBars(key,spec),name:key==='weapon'?WNAMES[L.w.a][L.w.t]:CNAMES[L.c.c][L.c.t]};}''',[key,slot,iid])
      assert 'undefined' not in row['text'] and 'NaN' not in row['bar'] and 'NaN' not in row['text'],row
      assert ['Common','Rare','Epic'][t] in row['text'] and row['name'] in row['text'],(row['name'],row['text'][:200])
      rows.append(row);await pg.locator('[data-act="labinspectclose"]').click();await pg.evaluate('()=>{gCmp=null;uiDirty();}');await pg.wait_for_timeout(80)
   await pg.evaluate('()=>{closeAll();openBayGear(true);}');await pg.wait_for_timeout(200)
   await pg.locator('.sheet [data-act="gcmp"][data-arg="w|moon"]').click();await pg.locator('.sheet .gcmp [data-act="labinspect"]').click();await pg.wait_for_timeout(150)
   text=await pg.locator('#lab-item-art').locator('..').inner_text();assert 'Legendary' in text and '118' in text and '592' in text and 'Super wind-up' in text,text
   await pg.screenshot(path=str(OUT/'moonbeam-320.png'));await pg.locator('[data-act="labinspectclose"]').click()
   await pg.locator('.sheet .gcmp [data-act="gequip"]').click();await pg.evaluate('()=>gIdle()')
   for a in ['hull|light','mobility|sprint']:await pg.evaluate('a=>ACT.gfit(a)',a)
   await pg.evaluate('()=>gIdle()');await pg.evaluate('()=>ACT.labequip("m_spare")');await pg.evaluate('()=>gIdle()');await pg.wait_for_timeout(300)
   await pg.reload();await pg.wait_for_function('save.lab?.active==="m_spare"')
   out=await pg.evaluate('()=>({active:save.lab.active,a:save.lab.machines.m_legacy.spec,b:save.lab.machines.m_spare.spec})')
   assert out['a']['w']['a']=='pulse' and out['b']['w']['a']=='moon' and out['b']['mods']['mobility']=='sprint' and out['b']['mods']['hull']=='light',out
   await pg.evaluate('()=>{closeAll();save.welcomed=true;setTab("garage");}');await pg.screenshot(path=str(OUT/'bays-320.png'))
   for width in [390,430]:
    await pg.set_viewport_size({'width':width,'height':844});await pg.evaluate('()=>{closeAll();setGfx("high");setTab("garage");}');await pg.wait_for_timeout(150)
    assert await pg.locator('.gbay').count()==2 and await pg.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
   await pg.evaluate('()=>{setGfx("2d");setTab("garage");}');await pg.wait_for_timeout(100)
   assert not errs,errs
   print(json.dumps({'inspected':len(rows)+1,'independent_save_reload':out,'page_errors':errs}));(OUT/'browser.json').write_text(json.dumps(rows,indent=2));await b.close()
   b,fb,ferr=await open_game(p,320,740,eco='server',user={'id':UID+1,'first_name':'Fallback'},init="const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return String(t).includes('webgl')?null:orig.call(this,t,...args);};")
   await fb.wait_for_function('!!save.lab');await fb.evaluate('()=>{closeAll();save.welcomed=true;setTab("garage");}');await fb.wait_for_timeout(300)
   assert await fb.evaluate('()=>R3.failed'),'No-WebGL fallback'
   assert await fb.locator('.gbay').count()==2 and await fb.locator('.g-stage.static canvas').count()==1
   assert not ferr,ferr;await b.close();print('PASS every weapon/chassis compare + exact stats, Moonbeam legendary, save/equip/reload, 320/390/430px, 2D/3D and no-WebGL fallback')
 finally:
  if server:server.terminate();server.wait()
asyncio.run(main())
