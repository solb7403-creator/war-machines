# Quest rewards + core points prices on screen (Checkpoint 38, owner Nov 14 2026), on the server economy (the real Worker through
# the local stand-in), at a phone (390x740), a small phone (320x568) and a desktop (1366x768):
#  1. Quests: every daily quest +3,500, every weekly quest +12,500, the all-4 bonus +1,000, the weekly chest 5,000 (no login
#     streak yet, so no boost); claiming a finished daily pays 3,500 on the server;
#  2. Points shop: gem caches 30K / 60K / 180K, chosen cores "from 43,750", the Epic cache sheet "Use 180,000 points";
#     the chosen-core sheet (points) 43,750 / 87,500 / 262,500 and its "175 points a Star" line;
#  3. Store: gem caches still 250 / 500 / 1,500 Stars, chosen cores 375 / 750 / 2,250 Stars, the Epic cache sheet's
#     "Or 180,000 points in the Points shop";
#  4. a core already at level 5 shows "Max" on its chosen-core tile (Store and Points shop) and can't be opened;
#  5. the wiki shows the new quest rewards and Points shop prices;
#  6. every screen fits the width, no page errors.
# usage: CHROMIUM_PATH=... SCALE=2 python3 dev/tests/quest-prices-ui.py   (screens in $SHOTS/quest-prices/)
import os, sys, asyncio, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT = os.environ.get('SHOTS', '/tmp/lunar-shots') + '/quest-prices/'; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print('PASS' if c else 'FAIL', m)
    if not c: fails.append(m)
import random
UID = random.randint(9907000, 9907999); PID = 'tg_%d' % UID   # a fresh pilot every run (a reused dev server keeps old records)
async def wide(pg):
    return await pg.evaluate("()=>{const W=innerWidth;return [...document.querySelectorAll('#screen *,.sheet *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.right>W+1||r.left<-1)&&getComputedStyle(e).position!=='fixed';}).map(e=>e.className).slice(0,5)}")
async def main():
    start_dev()
    async with async_playwright() as p:
        b, pg, errs = await open_game(p, 390, 740, scale=float(os.environ.get('SCALE', 1)), eco='server', user={'id': UID, 'username': 'questui', 'first_name': 'Q'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_function('save&&save.migOk&&save.lab', timeout=30000)
        # a pilot with two chassis, points to spend; the Titan's Damage core at level 5 (the "Max" tile)
        cur = dev('/__dump')['eco'][PID]
        cur.update({'pts': 600000, 'earned': 600000, 'mp': 30, 'cOwn': {'scout': [1], 'vanguard': [0], 'titan': [1]}, 'roll': {'scout:1': 1.07, 'titan:1': 1.06}, 'coreFor': 'titan'})
        cur.setdefault('glc', {}).setdefault('titan', {})['dmg'] = 5
        dev('/__set', {'path': 'eco/' + PID, 'value': cur})
        await pg.evaluate("()=>{save.welcomed=true;save.termsOk=true;save.payCur='stars';store();doSync(false);}")
        await pg.wait_for_function("save.pts===600000&&(save.cOwn.titan||[]).includes(1)&&save.glc&&save.glc.titan&&save.glc.titan.dmg===5", timeout=20000)
        await pg.evaluate("()=>{save.coreFor='titan';}")
        # 1. Quests
        await pg.evaluate("()=>{closeAll();setTab('quests');}"); await pg.wait_for_timeout(500)
        q = await pg.evaluate("""()=>({boost:questBoost(),daily:[...document.querySelectorAll('[data-act=claimdq]')].map(b=>b.textContent),weekly:[...document.querySelectorAll('[data-act=claimwq]')].map(b=>b.textContent),
          all:[...document.querySelectorAll('.q .num')].map(e=>e.textContent),chest:[...document.querySelectorAll('.q .p')].map(e=>e.textContent).find(t=>/points and a rare gem cache/.test(t))||''})""")
        ok(q['boost'] == 0 and q['daily'] == ['+3,500'] * 4 and len(q['weekly']) == 5 and all(t == '+12,500' for t in q['weekly']) and '+1,000' in q['all'] and q['chest'].find('5,000 points') >= 0,
           'quest cards: 4 dailies +3,500, 5 weeklies +12,500, all-4 +1,000, chest 5,000 ' + json.dumps(q))
        for (w, h, nm) in [(390, 740, 'phone'), (320, 568, 'small'), (1366, 768, 'desktop')]:
            await pg.set_viewport_size({'width': w, 'height': h}); await pg.evaluate("()=>{closeAll();setTab('quests');}"); await pg.wait_for_timeout(300)
            ok(not await wide(pg), nm + ': Quests fit the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>[...document.querySelectorAll('.sec')].find(e=>/Today/.test(e.textContent)).scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_quests_daily.png')
            await pg.evaluate("()=>[...document.querySelectorAll('.sec')].find(e=>/Weekly quests/.test(e.textContent)).scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_quests_weekly.png')
            await pg.evaluate("()=>[...document.querySelectorAll('.q .t')].find(e=>/Weekly chest/.test(e.textContent)).scrollIntoView({block:'end'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_quests_chest.png')   # the weekly chest row (the all-4 row is in _quests_daily on desktop, _quests_bonus on phones)
            await pg.evaluate("()=>[...document.querySelectorAll('.q .t')].find(e=>/Finish all/.test(e.textContent)).scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_quests_bonus.png')
        await pg.set_viewport_size({'width': 390, 'height': 740})
        # a finished daily pays 3,500 on the server
        dq = await pg.evaluate("()=>JSON.parse(JSON.stringify(save.dq))"); did = dq['ids'][0]
        dq['c'] = {}; dq['all'] = False; dq.setdefault('p', {})[did] = 99   # finished, nothing claimed yet
        e = dev('/__dump')['eco'][PID]; e['dq'] = dq; e['rev'] = (e.get('rev') or 0) + 1; dev('/__set', {'path': 'eco/' + PID, 'value': e})   # a newer revision, so the phone takes it
        await pg.evaluate("()=>doSync(false)"); await pg.wait_for_function("save.dq&&save.dq.p&&save.dq.p['%s']>=1" % did, timeout=20000)
        await pg.evaluate("()=>{closeAll();setTab('quests');}"); await pg.wait_for_timeout(300)
        p0 = dev('/__dump')['eco'][PID]['pts']
        for _ in range(3):   # the server checks the progress set above; a tap during a re-render can miss, so try up to three times
            await pg.click('[data-act=claimdq][data-arg="%s"]' % did)
            try: await pg.wait_for_function("save.pts>%d" % p0, timeout=6000); print("claim taps:", _ + 1); break
            except Exception: pass
        p1 = dev('/__dump')['eco'][PID]['pts']
        ok(p1 - p0 == 3500, 'claiming a daily quest pays 3,500 on the server (%d -> %d)' % (p0, p1))
        await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + 'phone_quests_claimed.png')
        # 2. Points shop
        for (w, h, nm) in [(390, 740, 'phone'), (320, 568, 'small'), (1366, 768, 'desktop')]:
            await pg.set_viewport_size({'width': w, 'height': h})
            await pg.evaluate("()=>{closeAll();shopTab='pts';setTab('shop');}"); await pg.wait_for_timeout(400)
            ps = await pg.evaluate("""()=>({gem:[...document.querySelectorAll('[data-act=ptscrate][data-arg^="gem:"] .p')].map(e=>e.textContent),from:[...document.querySelectorAll('.ptsh')].map(e=>e.textContent).find(t=>/Chosen core/.test(t))||'',
              gear:[...document.querySelectorAll('[data-act=ptscrate]:not([data-arg^="gem:"]) .p')].map(e=>e.textContent),max:[...document.querySelectorAll('.cpick.is-max')].map(e=>e.dataset.arg+':'+e.dataset.act+':'+(e.textContent.endsWith('Max')?'Max':e.textContent))})""")
            ok(ps['gem'] == ['30K', '60K', '180K'] and 'from 43,750 points' in ps['from'] and ps['gear'] == ['20K', '80K', '20K', '80K'] and ps['max'] == ['dmg:p:gnop:Max'],
               nm + ': Points shop: gem caches 30K / 60K / 180K, chosen cores from 43,750, crates 20K / 80K unchanged, the maxed Damage core shows Max ' + json.dumps(ps))
            ok(not await wide(pg), nm + ': Points shop fits the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>document.querySelector('.corefor').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_points_cores.png')
            await pg.click('.cpick.is-max', force=True); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("()=>!document.querySelector('.sheet .cprow')"), nm + ': Points shop: tapping the Max tile opens no chosen-core sheet')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(200)
            # the Epic gem cache sheet (points)
            await pg.click('[data-act=ptscrate][data-arg="gem:2"]'); await pg.wait_for_timeout(400)
            t = await pg.evaluate("()=>(document.querySelector('[data-act=buypts]')||{}).textContent||''")
            ok(t.startswith('Use 180,000 points'), nm + ': the Epic gem cache sheet: Use 180,000 points ' + json.dumps(t))
            await pg.screenshot(path=OUT + nm + '_points_epic_sheet.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
            # the chosen-core sheet (points)
            await pg.evaluate("()=>document.querySelector('.cpick[data-arg=\"rof:p\"]').scrollIntoView({block:'center'})"); await pg.click('.cpick[data-arg="rof:p"]'); await pg.wait_for_timeout(400)
            sh = await pg.evaluate("()=>({btn:[...document.querySelectorAll('[data-act=buycorepts]')].map(b=>b.textContent),txt:document.querySelector('.cphead .mut').textContent,cache:[...document.querySelectorAll('.cprow .d')].map(e=>e.textContent.split('A random ')[1]||'')})")
            ok(sh['btn'] == ['43,750', '87,500', '262,500'] and 'about 1.46× the points of a random gem cache' in sh['txt'] and [c.endswith(x + ' points.') for c, x in zip(sh['cache'], ['30,000', '60,000', '180,000'])] == [True] * 3,
               nm + ': the chosen-core sheet (points): 43,750 / 87,500 / 262,500 (about 1.46x a random cache), next to 30,000 / 60,000 / 180,000 caches ' + json.dumps(sh))
            ok(not await wide(pg), nm + ': the chosen-core sheet fits the width')
            await pg.screenshot(path=OUT + nm + '_corepick_points.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
            # 3. the Store
            await pg.evaluate("()=>{closeAll();shopTab='store';setTab('shop');}"); await pg.wait_for_timeout(400)
            st = await pg.evaluate("""()=>({full:[0,1,2].map(ri=>boxStars('gem',ri,true)),gem:[...document.querySelectorAll('[data-act=crate][data-arg^="gem:"] .p')].map(e=>e.textContent),now:[0,1,2].map(ri=>fmtNum(boxStars('gem',ri))+' ⭐'),max:[...document.querySelectorAll('.cpick.is-max')].map(e=>e.dataset.arg+':'+e.dataset.act+':'+(e.textContent.endsWith('Max')?'Max':e.textContent))})""")
            ok(st['full'] == [250, 500, 1500] and st['gem'] == st['now'] and st['max'] == ['dmg:gnop:Max'], nm + ': Store: gem caches 250 / 500 / 1,500 Stars full price (unchanged; the day\'s deal may show), the maxed Damage core shows Max ' + json.dumps(st))
            ok(not await wide(pg), nm + ': Store fits the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>document.querySelector('.corefor').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_store_cores.png')
            await pg.click('[data-act=crate][data-arg="gem:2"]'); await pg.wait_for_timeout(400)
            lk = await pg.evaluate("()=>({buy:(document.querySelector('[data-act=buybox]')||{}).textContent||'',or:(document.querySelector('.sheet [data-act=ptscrate]')||{}).textContent||''})")
            ok(lk['or'] == 'Or 180,000 points in the Points shop' and lk['buy'] == 'Buy for ' + st['now'][2], nm + ': the Store Epic gem cache sheet: its Stars price, or 180,000 points ' + json.dumps(lk))
            await pg.screenshot(path=OUT + nm + '_store_epic_sheet.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
            await pg.evaluate("()=>document.querySelector('.cpick[data-arg=\"arm\"]').scrollIntoView({block:'center'})"); await pg.click('.cpick[data-arg="arm"]'); await pg.wait_for_timeout(400)
            price = await pg.evaluate("()=>[...document.querySelectorAll('[data-act=buycore]')].map(b=>b.textContent)")
            ok(price == ['375 ⭐', '750 ⭐', '2,250 ⭐'], nm + ': chosen cores in Stars unchanged (375 / 750 / 2,250) ' + json.dumps(price))
            await pg.screenshot(path=OUT + nm + '_corepick_store.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
            # 4. the Max tile does nothing
            await pg.evaluate("()=>document.querySelector('.cpick.is-max').scrollIntoView({block:'center'})"); await pg.click('.cpick.is-max', force=True); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("()=>!document.querySelector('.sheet .cprow')"), nm + ': tapping a Max tile opens no chosen-core sheet')
            await pg.evaluate("()=>closeAll()")
        # 5. the wiki
        for (w, h, nm) in [(390, 740, 'phone'), (1366, 768, 'desktop')]:
            wp = await pg.context.new_page(); await wp.set_viewport_size({'width': w, 'height': h})
            await wp.goto(pg.url.split('index.html')[0] + 'wiki.html'); await wp.wait_for_timeout(500)
            await wp.add_style_tag(content='html{scroll-behavior:auto!important}')   # the wiki scrolls smoothly: a capture right after scrollIntoView caught it mid-scroll (review round 1)
            txt = await wp.evaluate("()=>document.body.innerText")
            ok('Every daily quest pays 3,500 points' in txt and 'every weekly quest pays 12,500' in txt and 'gem caches 30,000 / 60,000 / 180,000 points' in txt and 'chosen cores 43,750 / 87,500 / 262,500' in txt and 'about 12 weeks' in txt and '6,000 / 12,000' not in txt,
               nm + ': the wiki shows the new quest rewards and Points shop prices')
            await wp.evaluate("()=>[...document.querySelectorAll('p')].find(e=>/Every daily quest pays/.test(e.textContent)).scrollIntoView({block:'center'})"); await wp.wait_for_timeout(600)
            await wp.screenshot(path=OUT + nm + '_wiki_quests.png')
            await wp.evaluate("()=>[...document.querySelectorAll('p')].find(e=>/Points shop prices/.test(e.textContent)).scrollIntoView({block:'center'})"); await wp.wait_for_timeout(600)
            ok(await wp.evaluate("()=>{const e=[...document.querySelectorAll('p')].find(e=>/Points shop prices/.test(e.textContent)).getBoundingClientRect();return e.top<innerHeight&&e.bottom>0;}"), nm + ': the wiki prices paragraph is on screen in its capture')
            await wp.screenshot(path=OUT + nm + '_wiki_prices.png')
            await wp.close()
        ok(not errs, 'no page errors: ' + json.dumps(errs[:5]))
        await b.close()
    print('RESULT', 'PASS' if not fails else 'FAIL (%d)' % len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
