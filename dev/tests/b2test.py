# Batch 2 browser test: new menus, first-time flow, VS, results, sheets. Screenshots go to $SHOTS
import os, asyncio, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b2/';os.makedirs(OUT,exist_ok=True)
async def run(p,w,h,tag,uid):
    b,pg,errs=await open_game(p,w,h,scale=2,user={'id':uid,'username':'pilot'+str(uid),'first_name':'Test'})
    shot=lambda n: pg.screenshot(path=OUT+'after_'+tag+'_'+n+'.png')
    fails=[]
    def check(c,msg):
        if not c: fails.append(msg)
    await pg.wait_for_timeout(600)
    # 1) first open: welcome card
    has=await pg.evaluate("()=>!!document.querySelector('.full.welcome')")
    check(has,'welcome card missing on first open')
    await shot('01_welcome')
    # 2) start the first match from the welcome card: no VS screen, tutorial on
    await pg.click('[data-act=firstfight]')
    await pg.wait_for_timeout(400)
    st=await pg.evaluate("()=>({state,battle:document.body.classList.contains('battle'),tut:!!tut,vs:!!document.querySelector('.full.vs')})")
    check(st['state']=='play' and st['battle'] and st['tut'] and not st['vs'],'first match should start straight away with coaching: '+json.dumps(st))
    # drive a little so the coach moves on
    await pg.mouse.move(w/2,h*0.7);await pg.mouse.down();await pg.mouse.move(w/2,h*0.55,steps=8);await pg.wait_for_timeout(500)
    await shot('02_first_match')
    await pg.mouse.up()
    # 3) finish it: win
    await pg.evaluate("()=>{units.filter(u=>u.team===1).forEach(u=>u.hp=0);}")
    await pg.wait_for_timeout(1700)
    res=await pg.evaluate("()=>({res:!!document.querySelector('.full.res'),gain:(document.querySelector('.res .gain')||{}).textContent,mp:save.mp})")
    check(res['res'] and res['mp']==1,'results screen missing: '+json.dumps(res))
    await shot('03_results_win')
    # 4) menu -> play screen with nudge (daily reward)
    await pg.click('.res [data-act=menu]');await pg.wait_for_timeout(500)
    m=await pg.evaluate("()=>({battle:document.body.classList.contains('battle'),nudge:!!document.querySelector('.nudge'),fight:!!document.querySelector('#s-play .fight')})")
    check(not m['battle'] and m['fight'],'menu after results broken: '+json.dumps(m))
    await shot('04_play')
    # fight button visible without scrolling
    fb=await pg.evaluate("()=>{const r=document.querySelector('#s-play .fight').getBoundingClientRect();return {top:r.top,bottom:r.bottom,vh:innerHeight}}")
    check(fb['bottom']<=fb['vh'] and fb['top']>0,'FIGHT not fully visible: '+json.dumps(fb))
    # claim daily reward from the nudge
    if m['nudge']:
        before=await pg.evaluate("()=>save.pts")
        await pg.click('.nudge');await pg.wait_for_timeout(400)
        after=await pg.evaluate("()=>save.pts")
        check(after>before,'nudge claim did not pay')
        await pg.wait_for_timeout(900)
        if await pg.evaluate("()=>!!document.querySelector('[data-act=remindno]')"):
            await pg.click('[data-act=remindno]');await pg.wait_for_timeout(300)
    # pickers
    await pg.click('[data-act=setup]');await pg.wait_for_timeout(400)
    await pg.click('.sheet [data-act=gtype][data-arg=zone]');await pg.wait_for_timeout(100)
    await pg.click('.sheet [data-act=mode][data-arg="2v2"]');await pg.wait_for_timeout(100)
    await pg.click('.sheet [data-act=map][data-arg=overpass]');await pg.wait_for_timeout(300)
    sel=await pg.evaluate("()=>[save.gtype,save.mode,save.map]")
    check(sel==['zone','2v2','overpass'],'picker selection failed '+str(sel))
    await shot('05_setup_sheet')
    await pg.click('[data-act=setupdone]');await pg.wait_for_timeout(400)
    await shot('05b_play_zone_2v2')
    # 5) FIGHT -> VS screen (2nd match), swap chassis disabled unless owned; start
    await pg.click('#s-play .fight');await pg.wait_for_timeout(500)
    vs=await pg.evaluate("()=>({vs:!!document.querySelector('.full.vs'),state,units:units.length})")
    check(vs['vs'] and vs['state']=='vs' and vs['units']==4,'VS screen wrong '+json.dumps(vs))
    await shot('06_vs')
    await pg.click('[data-act=vsstart]');await pg.wait_for_timeout(300)
    st=await pg.evaluate("()=>({state,battle:document.body.classList.contains('battle')})")
    check(st['state']=='play' and st['battle'],'VS start failed '+json.dumps(st))
    await pg.evaluate("()=>{for(let i=0;i<30*20;i++)update(1/30)}");await pg.wait_for_timeout(300)
    await shot('07_zone_match')
    # leave via Escape (back button stand-in): confirm modal pauses
    await pg.keyboard.press('Escape');await pg.wait_for_timeout(300)
    lv=await pg.evaluate("()=>({modal:!!document.querySelector('.modal'),paused})")
    check(lv['modal'] and lv['paused'],'leave confirm missing '+json.dumps(lv))
    await shot('08_leave')
    await pg.click('[data-act=leaveok]');await pg.wait_for_timeout(400)
    st=await pg.evaluate("()=>({state,battle:document.body.classList.contains('battle'),streak:save.streak,mp:save.mp})")
    check(st['state']=='menu' and not st['battle'] and st['mp']==2,'forfeit failed '+json.dumps(st))
    # 6) Garage + pickers
    await pg.click('[data-act=tab][data-arg=garage]');await pg.wait_for_timeout(400);await shot('09_garage')
    await pg.click('[data-act=core][data-arg="0"]');await pg.wait_for_timeout(400);await shot('10_core_picker')
    await pg.click('[data-act=coreset][data-arg="0:spd"]');await pg.wait_for_timeout(300)
    cores=await pg.evaluate("()=>save.cores.slice()")
    check(cores[0]=='spd' and cores[3]=='dmg' and len(set([c for c in cores if c]))==len([c for c in cores if c]),'core swap wrong '+str(cores))
    await pg.click('[data-act=gear][data-arg=w]');await pg.wait_for_timeout(400);await shot('11_weapon_picker')
    await pg.evaluate("()=>closeAll()");await pg.wait_for_timeout(300)
    # 7) Shop
    await pg.click('[data-act=tab][data-arg=shop]');await pg.wait_for_timeout(500);await shot('12_shop')
    await pg.click('[data-act=crate][data-arg="weapon:1"]');await pg.wait_for_timeout(450);await shot('13_crate_sheet')
    await pg.evaluate("()=>{closeAll();save.pts+=30000;store();}");await pg.wait_for_timeout(250)
    await pg.click('[data-act=crate][data-arg="gem:0"]');await pg.wait_for_timeout(400)
    await pg.click('[data-act=buypts]');await pg.wait_for_timeout(250);await shot('14_reveal_shake')
    await pg.wait_for_timeout(800);await shot('15_reveal_open')
    await pg.click('[data-act=revealok]');await pg.wait_for_timeout(400)
    # stars purchase outside the real Telegram invoice: invoice opens
    await pg.click('[data-act=starter]');await pg.wait_for_timeout(800)
    inv=await pg.evaluate("()=>!!window.__invoice")
    check(inv,'Stars invoice did not open for starter pack')
    # 8) Quests + Ranks
    await pg.click('[data-act=tab][data-arg=quests]');await pg.wait_for_timeout(600);await shot('16_quests')
    await pg.evaluate("()=>document.querySelector('#s-quests').scrollTop=2000");await pg.wait_for_timeout(200);await shot('17_quests_bottom')
    dev('/__cron');await pg.evaluate("()=>loadLB(true)");await pg.wait_for_timeout(500)
    await pg.click('[data-act=tab][data-arg=ranks]');await pg.wait_for_timeout(600);await shot('18_ranks')
    # 9) settings + info
    await pg.click('#btnSettings');await pg.wait_for_timeout(400);await shot('19_settings')
    await pg.click('[data-act=info][data-arg=howto]');await pg.wait_for_timeout(400);await shot('20_howto')
    await pg.evaluate("()=>closeAll()");await pg.wait_for_timeout(300)
    # 10) a loss with a counter tip
    await pg.click('[data-act=tab][data-arg=play]');await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{save.gtype='arena';save.mode='2v2';save.map='classic';store();prepareMatch();units.filter(u=>u.team===1).forEach(u=>u.cls=beatenBy(me.cls));startMatch();units.filter(u=>u.team===0).forEach(u=>u.hp=0);}")
    await pg.wait_for_timeout(1500);await shot('21_results_loss')
    print(tag,'fails:',fails,'errors:',errs[:6])
    await b.close()
    return fails,errs
async def main():
    start_dev()
    async with async_playwright() as p:
        r1=await run(p,390,740,'i14',880001)
        r2=await run(p,375,590,'se',880002)
    bad=r1[0]+r1[1]+r2[0]+r2[1]
    print('RESULT', 'PASS' if not bad else 'FAIL')
asyncio.run(main())
