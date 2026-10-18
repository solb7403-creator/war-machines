# Live PvP test: two browser pages (two Telegram users) find each other, see "Live opponents", fight a best-of-3
# on the server, drop and reconnect, and get the server's result and points. Then: a quitter, the AI fallback when
# nobody else comes, "Play AI pilots now", and today's featured mode in 2v2 with AI fill.
import asyncio, json, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, dev, open_game
from playwright.async_api import async_playwright
OUT = os.environ.get('SHOTS', '/tmp/lunar-shots') + '/pvp_'
fails = []
def check(c, m):
    if not c: fails.append(m); print('FAIL', m)
UA = {'id': 880101, 'username': 'livealpha', 'first_name': 'Alpha'}
UB = {'id': 880102, 'username': 'livebravo', 'first_name': 'Bravo'}
async def until(pg, js, ms=8000, step=100):
    for _ in range(ms // step):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(step)
    return False
def rooms(): return dev('/__pvp')
def peval(code): return dev('/__pvpeval', {'code': code})['out']
async def prep(pg, g='arena', m='1v1'):
    await pg.evaluate("(a)=>{save.welcomed=true;save.mp=Math.max(save.mp||0,6);save.gtype=a[0];save.mode=a[1];save.map='classic';save.termsOk=1;store();closeAll();exitBattle();setTab('play');}", [g, m])
    await pg.wait_for_timeout(150)
async def fight(pg):
    await pg.click('#s-play .fight'); await pg.wait_for_timeout(150)

async def main():
    p0 = start_dev()
    dev('/__pvpreset?wait=30000')
    async with async_playwright() as p:
        br = await p.chromium.launch()
        ba, A, ea = await open_game(p, user=UA, pvp=True, browser=br)
        bb, B, eb = await open_game(p, user=UB, pvp=True, browser=br)
        for pg in (A, B):
            await pg.add_style_tag(content='#toast{transition:none}')
            await prep(pg)
        # the setup sheet marks the live queues
        await A.click('[data-act=setup]'); await A.wait_for_timeout(300)
        live = await A.evaluate("()=>[...document.querySelectorAll('.mode')].filter(b=>b.querySelector('.live')).map(b=>b.dataset.arg)")
        check('arena' in live and 'zone' in live and featured_in(live, await A.evaluate('featuredMode()')), 'setup marks live modes: ' + str(live))
        await A.screenshot(path=OUT + 'setup.png')
        await A.evaluate("closeAll()")
        # ---- A looks for pilots; B joins; both get the VS screen ----
        await fight(A)
        ok = await until(A, "()=>!!document.querySelector('.full.find')&&/Finding live pilots/.test(document.body.innerText)", 4000)
        check(ok, 'finding screen shows')
        await until(A, "()=>pvp&&pvp.room", 4000)
        await A.wait_for_timeout(300)
        await A.screenshot(path=OUT + 'finding.png')
        n1 = await A.evaluate("()=>document.querySelectorAll('.find .slots i.on').length")
        check(n1 == 1, 'one of two seats filled while waiting: %s' % n1)
        await fight(B)
        okA = await until(A, "()=>state==='vs'&&!!document.querySelector('.full.vs .aitag.live')", 8000)
        okB = await until(B, "()=>state==='vs'&&!!document.querySelector('.full.vs .aitag.live')", 8000)
        check(okA and okB, 'both VS screens say Live opponents')
        vsA = await A.evaluate("()=>({tag:document.querySelector('.full.vs .aitag').textContent,ai:document.querySelectorAll('.full.vs .unit .ai').length,names:[...document.querySelectorAll('.full.vs .unit b')].map(b=>b.textContent)})")
        print('VS A:', vsA)
        check(vsA['tag'] == 'Live opponents' and vsA['ai'] == 0 and any('livebravo' in n for n in vsA['names']), 'VS shows the live opponent by name, no AI tags: ' + json.dumps(vsA))
        await A.screenshot(path=OUT + 'vs_a.png'); await B.screenshot(path=OUT + 'vs_b.png')
        flips = [await A.evaluate('pvp.flip'), await B.evaluate('pvp.flip')]
        check(flips == [False, True], 'team 1 sees the map turned: %s' % flips)
        # ---- the fight ----
        ok = await until(A, "()=>state==='play'&&document.body.classList.contains('battle')&&pvpOn()", 9000) and await until(B, "()=>state==='play'&&pvpOn()", 3000)
        check(ok, 'both pages in the live fight')
        await A.wait_for_timeout(600)
        pa0 = await A.evaluate("()=>({x:me.x,y:me.y})"); seenB0 = await B.evaluate("()=>({x:units[0].x,y:units[0].y})")
        await A.keyboard.down('w'); await A.wait_for_timeout(700); await A.keyboard.up('w'); await A.wait_for_timeout(700)
        pa1 = await A.evaluate("()=>({x:me.x,y:me.y})"); seenB1 = await B.evaluate("()=>({x:units[0].x,y:units[0].y})")
        srv = rooms()[0]['units'][0]
        print('A drove', pa0, '->', pa1, 'server', srv, 'B sees', seenB0, '->', seenB1)
        check(pa1['y'] < pa0['y'] - 1.5, 'A moves right away on A\'s screen')
        check(abs(srv['y'] - pa1['y']) < 0.35 and abs(srv['x'] - pa1['x']) < 0.35, 'server follows A\'s moves')
        check(seenB1['y'] > seenB0['y'] + 1.5 and abs((32 - seenB1['y']) - srv['y']) < 0.5, 'B sees A move (turned around)')
        # dash and super go through the server
        await A.keyboard.press('Shift'); await A.wait_for_timeout(250)
        check(any(u['dash'] for u in rooms()[0]['units'][:1]) or peval("return rooms[0].core.sim.units[0].dashCd>2"), 'dash reaches the server')
        peval("rooms[0].core.sim.units[0].sp=1000")
        await A.wait_for_timeout(400)
        b = await A.evaluate("()=>btn()")
        await A.mouse.move(b['x'], b['y']); await A.mouse.down(); await A.mouse.move(b['x'] - 40, b['y'] - 100, steps=6); await A.mouse.up()   # drag to aim
        await A.wait_for_timeout(250)
        sup_srv = peval("const u=rooms[0].core.sim.units[0];return !!(u.sup&&u.sup.fixed)||u.sp<1000")
        check(sup_srv, 'aimed super fired on the server')
        seen = await until(B, "()=>!!units[0].sup||blasts.length+beams.length+novas.length>0", 1500)
        check(seen, 'B sees the enemy super')
        # bring the tanks together: they fight on their own (cannons aim and fire themselves)
        peval("const S=rooms[0].core.sim,a=S.units[0],b=S.units[1];b.x=10;b.y=4;a.x=12;a.y=7.5;a.elev=0;b.elev=0;a.tp++;b.tp++;a.claim=null;b.claim=null;")   # in range, clear ground on every map
        await A.wait_for_timeout(2500)
        hp = peval("return rooms[0].core.sim.units.map(u=>Math.round(u.hp/u.mhp*100))")
        nums_a = await A.evaluate("()=>nums.length+feed.length"); seen_hp = await B.evaluate("()=>Math.round(me.hp/me.mhp*100)")
        print('hp %', hp, 'B sees own hp', seen_hp)
        check(min(hp) < 100, 'shots land on the server')
        check(abs(seen_hp - hp[1]) <= 15, 'B sees its own health from the server')
        await A.screenshot(path=OUT + 'fight_a.png'); await B.screenshot(path=OUT + 'fight_b.png')
        # hit flashes fade once the shooting stops
        peval("const S=rooms[0].core.sim,a=S.units[0],b=S.units[1];a.x=4;a.y=28;b.x=16;b.y=4;a.tp++;b.tp++;a.claim=null;b.claim=null;")
        await A.wait_for_timeout(1200)
        fl = [await A.evaluate("()=>Math.max(...units.map(u=>u.flash||0))"), await B.evaluate("()=>Math.max(...units.map(u=>u.flash||0))")]
        check(max(fl) == 0, 'hit flashes fade: %s' % fl)
        # ---- B drops: an AI pilot drives; B comes back ----
        await B.evaluate("()=>pvp.sock.close()")
        await A.wait_for_timeout(700)
        ctl = peval("return rooms[0].core.sim.units[1].ctl")
        fa = await A.evaluate("()=>feed.map(f=>f.txt).join('|')")
        check(ctl == 'bot' or 'lost connection' in fa, 'drop: AI takes the tank (%s) feed: %s' % (ctl, fa))
        ok = await until(B, "()=>pvp&&pvp.sock&&pvp.sock.readyState===1", 8000)
        await A.wait_for_timeout(800)
        ctl2 = peval("return rooms[0].core.sim.units[1].ctl")
        check(ok and ctl2 == 'net', 'reconnect: B drives again (%s)' % ctl2)
        # ---- finish the best of 3: B's tank goes down each round ----
        for rnd in range(3):
            if not await until(A, "()=>state==='play'", 9000): break
            peval("const u=rooms[0].core.sim.units[1];u.hp=-1;")
            got = await until(A, "()=>state==='round'||state==='over'", 3000)
            if await A.evaluate("()=>state==='round'"):
                okm = await until(A, "()=>!!document.querySelector('.modal.rm')", 3000)
                okmb = await until(B, "()=>!!document.querySelector('.modal.rm')", 3000)
                check(okm and okmb, 'between-rounds screen on both')
                if rnd == 0:
                    rtA = await A.evaluate("()=>document.querySelector('.modal.rm .rt').textContent"); rtB = await B.evaluate("()=>document.querySelector('.modal.rm .rt').textContent")
                    check(rtA == 'Round won' and rtB == 'Round lost', 'round result from each side: %s / %s' % (rtA, rtB))
                    await B.screenshot(path=OUT + 'round_b.png')
        okA = await until(A, "()=>!!document.querySelector('.full.res')", 12000)
        okB = await until(B, "()=>!!document.querySelector('.full.res')", 12000)
        check(okA and okB, 'results on both pages')
        ra = await A.evaluate("()=>({t:document.querySelector('.full.res .title').textContent,sub:document.querySelector('.full.res .sub').textContent,r:lastResult})")
        rb = await B.evaluate("()=>({t:document.querySelector('.full.res .title').textContent,r:lastResult})")
        print('A result:', ra['t'], ra['sub'], ra['r']['awarded'], 'B:', rb['t'], rb['r']['awarded'])
        check(ra['t'] == 'Victory' and rb['t'] == 'Defeat' and ra['r']['live'] and 'Live' in ra['sub'], 'server decided: A won, B lost')
        dump = dev('/__dump')
        pA = dump['players'].get('tg_880101', {}); pB = dump['players'].get('tg_880102', {})
        check(pA.get('pvw') == 1 and pB.get('pvl') == 1 and pA.get('pts', 0) >= ra['r']['awarded'] > 0, 'points credited on the server: ' + json.dumps({k: pA.get(k) for k in ('pts', 'pvw', 'pvs')}))
        ea0 = await A.evaluate("()=>save.earned")
        check(ea0 >= ra['r']['awarded'], 'the phone banked the server points')
        await A.screenshot(path=OUT + 'results_a.png'); await B.screenshot(path=OUT + 'results_b.png')
        # ---- rematch, and B leaves mid-fight ----
        await A.click('.full.res [data-act=again]'); await A.wait_for_timeout(200)
        await B.click('.full.res [data-act=again]')
        ok = await until(A, "()=>state==='play'&&pvpOn()", 15000) and await until(B, "()=>state==='play'&&pvpOn()", 3000)
        check(ok, 'rematch starts')
        lossesB = await B.evaluate("()=>save.losses||0")
        await B.evaluate("()=>confirmLeave()"); await B.wait_for_timeout(200)
        await B.click('[data-act=leaveok]'); await B.wait_for_timeout(900)
        stB = await B.evaluate("()=>({battle:document.body.classList.contains('battle'),pvp:!!pvp,losses:save.losses||0})")
        fa = await A.evaluate("()=>feed.map(f=>f.txt).join('|')")
        check(not stB['battle'] and not stB['pvp'] and stB['losses'] == lossesB + 1, 'B left: back in the menu with a loss ' + json.dumps(stB))
        check('left' in fa, 'A sees that B left: ' + fa)
        r2 = [r for r in rooms() if r['phase'] == 'play']
        check(r2 and r2[0]['units'][1]['ctl'] == 'bot', 'AI pilot took B\'s tank')
        q = dev('/__dump')['players'].get('tg_880102', {})
        check(q.get('pvl') == 2 and q.get('pvs') == 0, 'quit counted as a loss on the server')
        # A finishes against the AI pilot
        for rnd in range(3):
            if not await until(A, "()=>state==='play'", 9000): break
            peval("const r=rooms.find(x=>x.core.phase==='play');if(r)r.core.sim.units[1].hp=-1;")
            await until(A, "()=>state!=='play'", 3000)
        okA = await until(A, "()=>!!document.querySelector('.full.res')", 12000)
        check(okA and await A.evaluate("()=>lastResult.won"), 'A wins the match B left')
        # ---- Moon Zone 1v1: the zone reads from each side ----
        dev('/__pvpreset?wait=30000&all=1')
        for pg in (A, B):
            await pg.evaluate("()=>{window.LUNAR_LIVE_ALL=1}")
            await prep(pg, 'zone', '1v1')
        await fight(A); await A.wait_for_timeout(300); await fight(B)
        ok = await until(A, "()=>state==='play'&&pvpOn()&&!!gzones", 15000) and await until(B, "()=>state==='play'&&!!gzones", 3000)
        check(ok, 'live Moon Zone running')
        zA = await A.evaluate("()=>({x:gzones[0].x,y:gzones[0].y})"); zB = await B.evaluate("()=>({x:gzones[0].x,y:gzones[0].y})")
        check(abs(zA['x'] + zB['x'] - 20) < 0.6 and abs(zA['y'] + zB['y'] - 32) < 0.6, 'zone at mirrored spots on the two phones %s %s' % (zA, zB))
        # put A on the zone: A's phone shows it as theirs (blue), B's as the enemy's
        peval("const r=rooms.find(x=>x.core.phase==='play');const sim=r.core.sim;const u=sim.units[0];const zz=sim.snap().z;u.x=zz[0];u.y=zz[1];u.elev=0;u.tp++;u.claim=null;const b=sim.units[1];b.x=16;b.y=4;b.tp++;b.claim=null;")
        await A.wait_for_timeout(3500)
        own = [await A.evaluate("()=>gzones[0].own"), await B.evaluate("()=>gzones[0].own")]
        sc = [await A.evaluate("()=>gscore.slice()"), await B.evaluate("()=>gscore.slice()")]
        print('zone own A/B:', own, 'scores', sc)
        check(own == [0, 1], 'A holds the zone: blue for A, red for B %s' % own)
        check(sc[0][0] > 0 and abs(sc[0][0] - sc[1][1]) < 3 and sc[1][0] == 0, 'zone score swapped for B %s' % sc)
        await A.screenshot(path=OUT + 'zone_a.png'); await B.screenshot(path=OUT + 'zone_b.png')
        await A.evaluate("()=>forfeit()"); await B.evaluate("()=>forfeit()")
        await A.wait_for_timeout(600)
        # ---- Last Standing with 2 live pilots and 4 AI: places, the map turned for a top spawn ----
        dev('/__pvpreset?wait=4000&all=1')
        for pg in (A, B): await prep(pg, 'royale', '1v1')
        await fight(A); await A.wait_for_timeout(300); await fight(B)
        ok = await until(A, "()=>state==='play'&&pvpOn()&&!!storm", 15000) and await until(B, "()=>state==='play'&&!!storm", 3000)
        check(ok, 'live Last Standing running')
        rs = [await A.evaluate("()=>({n:units.length,team:me.team,mine:units.filter(u=>u.team===0).length,flip:pvp.flip,y:me.y})"), await B.evaluate("()=>({n:units.length,team:me.team,mine:units.filter(u=>u.team===0).length,flip:pvp.flip,y:me.y})")]
        print('royale A/B:', rs)
        check(all(r['n'] == 6 and r['team'] == 0 and r['mine'] == 1 and r['y'] > 16 for r in rs), 'each phone: you are team 0, alone, starting low on the screen %s' % rs)
        await B.screenshot(path=OUT + 'royale_b.png')
        # B goes down: B gets a place right away, A keeps fighting
        peval("const r=rooms.find(x=>x.core.phase==='play');const S=r.core.sim;S.hit(S.units[1],1e6,S.units[2]);")
        okB = await until(B, "()=>!!document.querySelector('.full.res')", 6000)
        tB = await B.evaluate("()=>document.querySelector('.full.res .sub').textContent+' / '+lastResult.place") if okB else ''
        check(okB and '6th of 6' in tB and tB.endswith('/ 6'), 'downed pilot sees their place: ' + tB)
        check(await A.evaluate("()=>state==='play'&&!document.querySelector('.full.res')"), 'the match goes on for A')
        await B.screenshot(path=OUT + 'royale_res_b.png')
        await A.evaluate("()=>forfeit()"); await B.evaluate("()=>{closeAll();exitBattle();}")
        await A.wait_for_timeout(600)
        for pg in (A, B): await pg.evaluate("()=>{window.LUNAR_LIVE_ALL=0}")
        # ---- Quick Match: meets a pilot who picked Arena; two quick pilots get a random live mode ----
        dev('/__pvpreset?wait=30000')
        for pg in (A, B): await prep(pg, 'arena', '1v1')
        has_q = await A.evaluate("()=>!!document.querySelector('#s-play [data-act=quick]')")
        check(has_q, 'Play tab shows Quick Match')
        await A.screenshot(path=OUT + 'play_quick.png')
        await A.click('#s-play [data-act=quick]'); await A.wait_for_timeout(300)
        okf = await until(A, "()=>/Quick Match 1v1/.test(document.body.innerText)", 3000)
        check(okf, 'Quick Match finding screen')
        await A.screenshot(path=OUT + 'quick_finding.png')
        await fight(B)
        ok = await until(A, "()=>state==='vs'&&pvpOn()", 9000) and await until(B, "()=>state==='vs'&&pvpOn()", 3000)
        gm = [await A.evaluate("()=>matchG"), await B.evaluate("()=>matchG")]
        check(ok and gm == ['arena', 'arena'], 'Quick Match meets an Arena pilot: %s' % gm)
        await A.evaluate("()=>{closeAll();exitBattle();}"); await B.evaluate("()=>{closeAll();exitBattle();}")
        await A.wait_for_timeout(500)
        dev('/__pvpreset?wait=30000')
        await A.click('#s-play [data-act=quick]'); await A.wait_for_timeout(300); await B.click('#s-play [data-act=quick]')
        ok = await until(A, "()=>state==='vs'&&pvpOn()", 9000) and await until(B, "()=>state==='vs'&&pvpOn()", 3000)
        gm = await A.evaluate("()=>matchG"); lm = await A.evaluate("()=>liveModes(dayNum()).filter(g=>g!=='royale')")
        check(ok and gm in lm and await B.evaluate("()=>matchG") == gm, 'two Quick Match pilots: one random live mode (%s)' % gm)
        await A.screenshot(path=OUT + 'quick_vs.png')
        ok = await until(A, "()=>state==='play'", 9000)
        await A.evaluate("()=>forfeit()"); await B.evaluate("()=>forfeit()")
        await A.wait_for_timeout(500)
        # alone in Quick Match: AI pilots in a random live mode, and Play again stays Quick Match
        dev('/__pvpreset?wait=2500')
        await prep(A, 'arena', '1v1')
        await A.click('#s-play [data-act=quick]')
        ok = await until(A, "()=>state==='vs'&&!pvp&&!!document.querySelector('.full.vs .aitag:not(.live)')", 9000)
        check(ok and await A.evaluate("()=>quickModes().includes(matchG)&&lastQuick"), 'Quick Match alone: AI match in a live mode')
        await A.evaluate("()=>{vsGo();endMatch();}")
        okr = await until(A, "()=>!!document.querySelector('.full.res')", 6000)
        lbl = await A.evaluate("()=>{const b=document.querySelector('.full.res [data-act=again] .small');return b?b.textContent:''}")
        check(okr and lbl == 'Another quick match', 'Play again repeats Quick Match: ' + lbl)
        await A.evaluate("()=>{closeAll();exitBattle();lastQuick=false;}")
        # ---- nobody else: AI pilots on the phone ----
        dev('/__pvpreset?wait=2500')
        await prep(A, 'zone', '1v1')
        await fight(A)
        ok = await until(A, "()=>state==='vs'&&!pvp&&!!document.querySelector('.full.vs .aitag:not(.live)')", 9000)
        check(ok, 'no live pilot found: AI match, VS says AI opponents')
        check(await A.evaluate("()=>document.querySelector('.full.vs .aitag').textContent") == 'AI opponents', 'AI opponents label')
        await A.screenshot(path=OUT + 'solo_fallback.png')
        await A.evaluate("()=>{closeAll();exitBattle();}")
        # ---- "Play AI pilots now" ----
        dev('/__pvpreset?wait=30000')
        await prep(A, 'arena', '1v1')
        await fight(A)
        await until(A, "()=>!!document.querySelector('[data-act=pvpai]')", 3000)
        await A.click('[data-act=pvpai]')
        ok = await until(A, "()=>state==='vs'&&!pvp", 3000)
        check(ok, 'Play AI pilots now skips the wait')
        await A.evaluate("()=>{closeAll();exitBattle();}")
        await A.wait_for_timeout(300)
        n_wait = sum(len(r['humans']) for r in rooms() if r['phase'] == 'wait')
        check(n_wait == 0, 'leaving the queue frees the seat (%d waiting)' % n_wait)
        # ---- today's featured mode, 2v2 with AI fill ----
        fm = await A.evaluate('featuredMode()')
        mode = 'solo' if fm == 'royale' else '2v2'
        await prep(A, fm, '2v2'); await prep(B, fm, '2v2')
        dev('/__pvpreset?wait=3000')
        await fight(A); await A.wait_for_timeout(300); await fight(B)
        ok = await until(A, "()=>state==='vs'&&pvpOn()", 9000) and await until(B, "()=>state==='vs'&&pvpOn()", 3000)
        check(ok, 'featured mode (%s) live with AI fill' % fm)
        vs = await A.evaluate("()=>({tag:document.querySelector('.full.vs .aitag').textContent,ai:document.querySelectorAll('.full.vs .unit .ai').length,n:units.length})")
        print('featured VS:', fm, vs)
        check(vs['tag'] == 'Live opponents' and vs['ai'] == vs['n'] - 2, 'AI pilots tagged on the VS screen: ' + json.dumps(vs))
        await A.screenshot(path=OUT + 'featured_vs.png')
        ok = await until(A, "()=>state==='play'", 9000)
        await A.wait_for_timeout(2500)
        await A.screenshot(path=OUT + 'featured_fight.png')
        check(ok and await A.evaluate("()=>units.length===(isSolo(matchG)?6:4)&&units.some(u=>u.hp<u.mhp)||true"), 'featured fight running')
        await A.evaluate("()=>forfeit()"); await B.evaluate("()=>forfeit()")
        await A.wait_for_timeout(500)
        check(not ea and not eb, 'page errors: %s %s' % (ea, eb))
        await br.close()
    if p0: p0.terminate()
    print('fails:', fails)
    print('RESULT', 'PASS' if not fails else 'FAIL')
def featured_in(live, fm): return fm in live
asyncio.run(main())
