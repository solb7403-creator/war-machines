# Batch 3 test: map objects, best-of-3, events, fast-forward. Screenshots go to $SHOTS
import os, asyncio, sys, json, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b3/';os.makedirs(OUT,exist_ok=True)
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        if not c: fails.append(msg)
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,390,740,scale=2,user={'id':990301,'username':'pilotb3','first_name':'T'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=12;store();closeAll();}")
        await pg.wait_for_timeout(300)
        # 1) every map renders with its objects (2v2 arena, 7s in)
        for mp in ['classic','overpass','longshot','craters']:
            await pg.evaluate("(mp)=>{exitBattle();save.gtype='arena';save.mode='2v2';save.map=mp;store();prepareMatch();startMatch();for(let i=0;i<30*7;i++)update(1/30);}",mp)
            await pg.wait_for_timeout(350)
            await pg.screenshot(path=OUT+'map_'+mp+'.png')
        # 2) crates break, nav rebuilds, maybe a box
        r=await pg.evaluate("""()=>{exitBattle();save.map='craters';store();prepareMatch();startMatch();const n0=crates.length,w0=walls.length,c=crates[0];
            hitCrate(c,9999);return {n0,n1:crates.length,w0,w1:walls.length,inWalls:walls.includes(c),nav:nav.length}}""")
        check(r['n1']==r['n0']-1 and r['w1']==r['w0']-1 and not r['inWalls'],'crate did not break cleanly '+json.dumps(r))
        # 3) meteor shower: warnings, hits, bots dodge
        await pg.evaluate("()=>{startEvent('meteor');for(let i=0;i<30*2.2;i++)update(1/30);}")
        await pg.wait_for_timeout(250);await pg.screenshot(path=OUT+'event_meteor.png')
        w=await pg.evaluate("()=>({warns:warns.length,evt:evt&&evt.k})")
        check(w['evt']=='meteor','meteor event not running '+json.dumps(w))
        await pg.evaluate("()=>{for(let i=0;i<30*10;i++)update(1/30);}")
        # 4) solar flare doubles super charge
        f=await pg.evaluate("()=>{startEvent('flare');return flareMult()}")
        check(f==2,'flare multiplier wrong')
        # 5) fast-forward after you die in a team match
        await pg.evaluate("()=>{exitBattle();save.gtype='arena';save.mode='3v3';save.map='classic';store();prepareMatch();startMatch();for(let i=0;i<30*3;i++)update(1/30);takeHit(me,99999,null);update(1/30);}")
        on=await pg.evaluate("()=>ffBtnOn()")
        check(on,'fast-forward button not offered when dead')
        await pg.wait_for_timeout(200)
        F=await pg.evaluate("()=>ffBtn()")
        await pg.mouse.click(F['x']+F['w']/2,F['y']+F['h']/2);await pg.wait_for_timeout(300)
        ff=await pg.evaluate("()=>ffwd")
        check(ff,'fast-forward tap did not toggle')
        await pg.screenshot(path=OUT+'fastforward.png')
        # 6) 1v1 Arena best of 3: round screen, chassis swap, 2-0, points x2
        await pg.evaluate("()=>{exitBattle();save.cOwn.scout=[0];save.cOwn.titan=[0];save.cTier.scout=0;save.cTier.titan=0;save.streak=0;save.gtype='arena';save.mode='1v1';save.map='craters';store();}")
        await pg.evaluate("()=>{prepareMatch();startMatch();}")
        s1=await pg.evaluate("()=>({series:!!series,t:Math.round(timeLeft)})")
        check(s1['series'] and s1['t']==90,'1v1 arena should be a best of 3 with 90s rounds '+json.dumps(s1))
        await pg.evaluate("()=>{units.filter(u=>u.team===1).forEach(u=>u.hp=0);update(1/30);}")
        await pg.wait_for_timeout(1100)
        rm=await pg.evaluate("()=>({state,modal:!!document.querySelector('.modal.rm'),w:series.w})")
        check(rm['state']=='round' and rm['modal'] and rm['w']==[1,0],'round screen missing '+json.dumps(rm))
        await pg.screenshot(path=OUT+'round_screen.png')
        btns=await pg.evaluate("()=>document.querySelectorAll('[data-act=rswap]').length")
        check(btns==3,'chassis swap buttons missing: '+str(btns))
        await pg.click('[data-act=rswap][data-arg=titan]',force=True);await pg.wait_for_timeout(200)
        cls=await pg.evaluate("()=>me.cls")
        check(cls=='titan','swap between rounds failed: '+cls)
        if await pg.evaluate("()=>state==='round'"):await pg.click('[data-act=nextround]',timeout=5000,force=True)   # it also starts by itself after 4 s
        await pg.wait_for_timeout(300)
        r2=await pg.evaluate("()=>({state,round:series.round,hp:me.hp===me.mhp,crates:crates.length})")
        check(r2['state']=='play' and r2['round']==2 and r2['hp'],'round 2 did not start clean '+json.dumps(r2))
        await pg.evaluate("()=>{for(let i=0;i<30*2;i++)update(1/30);}")
        await pg.screenshot(path=OUT+'round2_hud.png')
        await pg.evaluate("()=>{units.filter(u=>u.team===1).forEach(u=>u.hp=0);update(1/30);}")
        await pg.wait_for_timeout(1600)
        res=await pg.evaluate("()=>({res:!!document.querySelector('.full.res'),r:lastResult&&{won:lastResult.won,base:lastResult.base,series:lastResult.series,pts:lastResult.pts,lm:lastResult.leagueMult,sb:lastResult.streakBonus}})")
        rr=res['r'] or {}
        check(res['res'] and rr.get('won') and rr.get('base')==250 and rr.get('series',{}).get('w')==[2,0],'series result wrong '+json.dumps(res))
        await pg.screenshot(path=OUT+'series_results.png')
        # 7) setup sheet shows the new map
        await pg.evaluate("()=>{exitBattle();setTab('play');}");await pg.wait_for_timeout(300)
        await pg.click('[data-act=setup]');await pg.wait_for_timeout(450)
        await pg.screenshot(path=OUT+'setup_maps.png')
        print('fails:',fails,'errors:',errs[:6])
        await b.close()
    print('RESULT','PASS' if not fails and not errs else 'FAIL')
asyncio.run(main())
