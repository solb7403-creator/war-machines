# Per-chassis cores and upgrades + the Points shop on screen (Session 5E-2b3), on the server economy (the real Worker through the
# local stand-in), at a phone (390x740), a small phone (320x568) and a desktop (1366x768):
#  1. the Shop has a Store / Points shop switch; the Store has no salvage yard; both have "Cores for" (owned chassis only), the gem
#     caches and the seven chosen cores; the Points shop has every gem cache for points (Epic too) at one points-per-Star rate,
#     chosen cores, weapon / chassis crates for points, the salvage yard and the per-chassis builds;
#  2. buying with points lands on the chassis picked: an Epic gem cache (36,000) for the Titan, a Rare chosen core for the Titan;
#     the Vanguard's cores never move; free caches follow the pick;
#  3. a chosen core sold for money: the invoice names the core, the size and the chassis, at 1.5x the cache;
#  4. the Garage: the Upgrades section shows one chassis's build with chips for every owned chassis, a level bought for the
#     Titan from a Vanguard bay lands on the Titan only, the reset is per chassis; the Cores section names its chassis;
#  5. every screen fits or scrolls (a finger swipe reaches the bottom), nothing wider than the screen, no page errors.
# usage: CHROMIUM_PATH=... python3 dev/tests/chassis-ui.py   (screens in $SHOTS/chassis/)
import os, sys, asyncio, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT = os.environ.get('SHOTS', '/tmp/lunar-shots') + '/chassis/'; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    if not c: fails.append(m); print('FAIL', m)
UID = 990601; PID = 'tg_%d' % UID
async def swipe_to_bottom(pg, w, h, times=10):
    cdp = await pg.context.new_cdp_session(pg); sx, sy = w / 2, h * 0.72
    for _ in range(times):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': sx, 'y': sy}]})
        for k in range(1, 13):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': sx, 'y': sy - k * 34}]}); await pg.wait_for_timeout(10)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(120)
async def wide(pg):
    return await pg.evaluate("()=>{const W=innerWidth;return [...document.querySelectorAll('#screen *,.sheet *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.right>W+1||r.left<-1)&&getComputedStyle(e).position!=='fixed';}).map(e=>e.className).slice(0,5)}")
async def main():
    start_dev()
    async with async_playwright() as p:
        b, pg, errs = await open_game(p, 390, 740, scale=float(os.environ.get('SCALE', 1)), eco='server', user={'id': UID, 'username': 'chassisui', 'first_name': 'C'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_function('save&&save.migOk&&save.lab', timeout=30000)
        # a pilot with all three chassis, points to spend, past the garage unlocks
        cur = dev('/__dump')['eco'][PID]
        cur.update({'pts': 600000, 'earned': 600000, 'mp': 30, 'cOwn': {'scout': [1], 'vanguard': [0], 'titan': [1]}, 'roll': {'scout:1': 1.07, 'titan:1': 1.06}})
        dev('/__set', {'path': 'eco/' + PID, 'value': cur})
        await pg.evaluate("()=>{save.welcomed=true;store();doSync(false);}"); await pg.wait_for_function("save.pts===600000&&(save.cOwn.titan||[]).includes(1)", timeout=20000)
        for (w, h, nm) in [(390, 740, 'phone'), (320, 568, 'small'), (1366, 768, 'desktop')]:
            await pg.set_viewport_size({'width': w, 'height': h})
            # 1. the Store
            await pg.evaluate("()=>{closeAll();shopTab='store';setTab('shop');}"); await pg.wait_for_timeout(400)
            st = await pg.evaluate("""()=>({seg:document.querySelectorAll('.shopseg button').length,chips:[...document.querySelectorAll('.corefor .gchip')].map(b=>b.dataset.arg),
              gem:document.querySelectorAll('[data-act=crate][data-arg^="gem:"]').length,picks:document.querySelectorAll('.cpick').length,salv:!!document.querySelector('[data-act=salvage]'),link:!!document.querySelector('.ptslink')})""")
            ok(st['seg'] == 2 and st['chips'] == ['scout', 'vanguard', 'titan'] and st['gem'] == 3 and st['picks'] == 7 and not st['salv'] and st['link'], nm + ': the Store: switch, Cores for (owned chassis), 3 gem caches, 7 chosen cores, no salvage yard ' + json.dumps(st))
            ok(not await wide(pg), nm + ': Store fits the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>document.querySelector('.corefor').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_store_cores.png')
            # 2. the Points shop
            await pg.click('.shopseg [data-arg=pts]'); await pg.wait_for_timeout(400)
            ps = await pg.evaluate("""()=>({gem:[...document.querySelectorAll('[data-act=ptscrate][data-arg^="gem:"] .p')].map(e=>e.textContent),gear:document.querySelectorAll('[data-act=ptscrate]:not([data-arg^="gem:"])').length,
              salv:document.querySelectorAll('[data-act=salvage]').length,picks:document.querySelectorAll('.cpick').length,builds:document.querySelectorAll('.ptsbuilds>div').length,bal:(document.querySelector('.shopseg [data-arg=pts] small')||{}).textContent,card:!!document.querySelector('.ptsbal')})""")
            ok(ps['gem'] == ['6K', '12K', '36K'] and ps['gear'] == 4 and ps['salv'] == 4 and ps['picks'] == 7 and ps['builds'] == 3 and 'points' in (ps['bal'] or '') and not ps['card'], nm + ': the Points shop: gem caches 6K / 12K / 36K (Epic too), 4 gear crates, the salvage yard, chosen cores, 3 builds, the balance once (in its tab) ' + json.dumps(ps))
            ok(not await wide(pg), nm + ': Points shop fits the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>{document.querySelector('#screen')&&(document.querySelector('#screen').scrollTop=0);scrollTo(0,0);}"); await pg.wait_for_timeout(100)
            await pg.screenshot(path=OUT + nm + '_points_top.png')
            if nm != 'desktop':
                await swipe_to_bottom(pg, w, h)
                vis = await pg.evaluate("()=>{const e=document.querySelector('.ptsgarage .btn');const r=e.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0;}")
                ok(vis, nm + ': a finger swipe reaches the bottom of the Points shop (Open the Garage)')
                await pg.screenshot(path=OUT + nm + '_points_bottom.png')
            else:
                await pg.evaluate("()=>document.querySelector('.ptsgarage').scrollIntoView({block:'end'})"); await pg.wait_for_timeout(150); await pg.screenshot(path=OUT + nm + '_points_bottom.png')
        # 3. buying with points, for the Titan
        await pg.set_viewport_size({'width': 390, 'height': 740})
        await pg.evaluate("()=>{closeAll();shopTab='pts';setTab('shop');}"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>document.querySelector('.corefor [data-arg=titan]').scrollIntoView({block:'center'})"); await pg.click('.corefor [data-arg=titan]'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("()=>save.coreFor==='titan'&&coresFor()==='titan'"), 'picking Titan in Cores for sticks')
        before = await pg.evaluate("()=>({pts:save.pts,t:JSON.stringify([save.glc.titan,save.gsc.titan]),v:JSON.stringify([save.glc.vanguard,save.gsc.vanguard])})")
        await pg.evaluate("()=>document.querySelector('[data-act=ptscrate][data-arg=\"gem:2\"]').scrollIntoView({block:'center'})"); await pg.click('[data-act=ptscrate][data-arg="gem:2"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + 'phone_points_epic_sheet.png')
        await pg.click('[data-act=buypts][data-arg="gem:2"]'); await pg.wait_for_function("save.pts<%d" % before['pts'], timeout=15000); await pg.wait_for_timeout(400)
        after = await pg.evaluate("()=>({pts:save.pts,t:JSON.stringify([save.glc.titan,save.gsc.titan]),v:JSON.stringify([save.glc.vanguard,save.gsc.vanguard])})")
        ok(before['pts'] - after['pts'] == 36000 and after['t'] != before['t'] and after['v'] == before['v'], 'an Epic gem cache for 36,000 points: shards for the Titan, the Vanguard untouched ' + json.dumps([before['pts'], after['pts']]))
        await pg.screenshot(path=OUT + 'phone_reveal_epic.png')
        await pg.evaluate("()=>{closeAll();}"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>document.querySelector('.cpick[data-arg=\"rof:p\"]').scrollIntoView({block:'center'})"); await pg.click('.cpick[data-arg="rof:p"]'); await pg.wait_for_timeout(400)
        sheet = await pg.evaluate("()=>({h:document.querySelector('.sheet h3').textContent,rows:document.querySelectorAll('.cprow').length,btn:[...document.querySelectorAll('[data-act=buycorepts]')].map(b=>b.textContent)})")
        ok('Fire rate core for your Titan' in sheet['h'] and sheet['rows'] == 3 and sheet['btn'] == ['9,000', '18,000', '54,000'], 'the chosen-core sheet (points): the core, the chassis, three sizes at 9,000 / 18,000 / 54,000 ' + json.dumps(sheet))
        await pg.screenshot(path=OUT + 'phone_corepick_points.png')
        b2 = await pg.evaluate("()=>({pts:save.pts,s:(save.gsc.titan.rof|0)+100*save.glc.titan.rof,v:JSON.stringify(save.gsc.vanguard)})")
        await pg.click('[data-act=buycorepts][data-arg="rof:1"]'); await pg.wait_for_function("save.pts<%d" % b2['pts'], timeout=15000); await pg.wait_for_timeout(300)
        a2 = await pg.evaluate("()=>({pts:save.pts,s:(save.gsc.titan.rof|0)+100*save.glc.titan.rof,v:JSON.stringify(save.gsc.vanguard)})")
        ok(b2['pts'] - a2['pts'] == 18000 and a2['s'] != b2['s'] and a2['v'] == b2['v'], 'a Rare chosen core: 18,000 points, 4 Fire rate shards on the Titan ' + json.dumps([b2, a2]))
        await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(300)
        # 4. a chosen core for money: the invoice names the core, the size and the chassis, at 1.5x the cache
        await pg.evaluate("()=>{save.termsOk=true;save.payCur='stars';store();closeAll();shopTab='store';setTab('shop');}"); await pg.wait_for_timeout(300)
        await pg.evaluate("()=>document.querySelector('.cpick[data-arg=\"arm\"]').scrollIntoView({block:'center'})"); await pg.click('.cpick[data-arg="arm"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + 'phone_corepick_store.png')
        price = await pg.evaluate("()=>[...document.querySelectorAll('[data-act=buycore]')].map(b=>b.textContent)")
        ok(price == ['375 ⭐', '750 ⭐', '2,250 ⭐'], 'the chosen core in Stars: 1.5x each gem cache (375 / 750 / 2,250) ' + json.dumps(price))
        n0 = len([c for c in dev('/__tg') if c[0] == 'createInvoiceLink']) if isinstance(dev('/__tg'), list) else 0
        await pg.click('[data-act=buycore][data-arg="arm:2"]'); await pg.wait_for_timeout(1500)
        calls = dev('/__tg'); inv = [c for c in (calls if isinstance(calls, list) else calls.get('calls', [])) if c[0] == 'createInvoiceLink']
        pl = json.loads(inv[-1][1]['payload']) if inv else {}
        ok(pl.get('k') == 'core' and pl.get('t') == 'arm' and pl.get('r') == 2 and pl.get('c') == 'titan' and inv[-1][1]['prices'][0]['amount'] == 2250, 'the Stars invoice: an Epic chosen Armor core for the Titan, 2,250 Stars ' + json.dumps(pl))
        await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(300)
        # 5. the Garage: one chassis's build at a time
        for (w, h, nm) in [(390, 740, 'phone'), (1366, 768, 'desktop')]:
            await pg.set_viewport_size({'width': w, 'height': h})
            await pg.evaluate("()=>{closeAll();setTab('garage');gOpen.clear();gOpen.add('up');uiDirty();}"); await pg.wait_for_timeout(500)
            g = await pg.evaluate("()=>({bay:gM().spec.c.c,chips:[...document.querySelectorAll('.gupch .gchip')].map(b=>b.dataset.arg+':'+b.classList.contains('on'))})")
            ok(g['bay'] == 'vanguard' and g['chips'] == ['scout:false', 'vanguard:true', 'titan:false'], nm + ': Upgrades shows the bay\'s chassis (Vanguard) with a chip per owned chassis ' + json.dumps(g))
            await pg.evaluate("()=>document.querySelector('#gs-up').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=OUT + nm + '_garage_up_vanguard.png')
        await pg.set_viewport_size({'width': 390, 'height': 740})
        await pg.click('.gupch [data-arg=titan]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("()=>document.querySelector('.gupch .gchip.on').dataset.arg==='titan'&&/Titan's build/.test(document.querySelector('#gs-up .gshared').textContent)"), 'the Titan chip shows the Titan\'s build')
        u0 = await pg.evaluate("()=>({t:save.upc.titan.cannon,v:save.upc.vanguard.cannon,pts:save.pts})")
        await pg.click('#gs-up [data-act=gupc][data-arg=cannon]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + 'phone_garage_up_titan_compare.png')
        await pg.click('.gcmp [data-act=up]'); await pg.wait_for_function("save.upc.titan.cannon>%d" % u0['t'], timeout=15000)
        u1 = await pg.evaluate("()=>({t:save.upc.titan.cannon,v:save.upc.vanguard.cannon,pts:save.pts})")
        ok(u1['t'] == u0['t'] + 1 and u1['v'] == u0['v'] and u0['pts'] - u1['pts'] == 500, 'a Cannon level for the Titan from the Vanguard bay: Titan +1, Vanguard unchanged, 500 points ' + json.dumps([u0, u1]))
        await pg.screenshot(path=OUT + 'phone_garage_up_titan.png')
        # the reset is per chassis
        await pg.evaluate("()=>document.querySelector('#gs-up [data-act=respec]').scrollIntoView({block:'center'})"); await pg.click('#gs-up [data-act=respec]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("()=>/Titan/.test(document.querySelector('.modal h3').textContent)"), 'the reset dialog names the Titan')
        await pg.screenshot(path=OUT + 'phone_reset_titan.png')
        await pg.click('[data-act=respecok]'); await pg.wait_for_function("save.upc.titan.cannon===0", timeout=15000)
        ok(await pg.evaluate("()=>save.upc.vanguard.cannon===%d" % u0['v']), 'resetting the Titan leaves the Vanguard\'s build')
        # the Cores section names its chassis
        await pg.evaluate("()=>{closeAll();gOpen.clear();gOpen.add('cores');uiDirty();}"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("()=>/Vanguard's cores/.test(document.querySelector('#gs-cores').textContent)"), 'the Cores section names the bay\'s chassis')
        await pg.evaluate("()=>document.querySelector('#gs-cores').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(150)
        await pg.screenshot(path=OUT + 'phone_garage_cores.png')
        ok(not errs, 'no page errors: ' + json.dumps(errs[:5]))
        await b.close()
    print('RESULT', 'PASS' if not fails else 'FAIL (%d)' % len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
