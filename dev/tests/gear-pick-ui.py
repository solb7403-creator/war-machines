# Weapon caches and chassis crates priced like gem caches + chosen gear (Checkpoint 39, owner Nov 14 2026), on the server economy
# (the real Worker through the local stand-in), at a phone (390x740), a small phone (320x568) and a desktop (1366x768):
#  1. Points shop: weapon caches and chassis crates 30K / 60K / 180K (Epic buyable), the Epic weapon cache sheet "Use 180,000
#     points"; next to them a chosen-weapon and a chosen-chassis grid "from 43,750 points", 9 items each, owned items "Owned";
#  2. Store: crates 250 / 500 / 1,500 Stars, chosen items 375 / 750 / 2,250 Stars next to them;
#  3. real purchases on the server: a chosen weapon and a chosen chassis with points (tap the tile, tap Use ... points) and with
#     Stars (tap the tile, tap Buy -> the server's invoice -> Telegram's payment webhook -> the grant): exactly the item picked,
#     rolled 105-110%, the price taken, the tile then says Owned and opens nothing; a points buy leaves the Stars price alone,
#     a Stars buy steps its crate's price up like a crate buy;
#  4. the crate sheet lists each item not owned yet with a "Pick it" button;
#  5. the wiki's prices; every screen fits the width; no page errors.
# usage: CHROMIUM_PATH=... SCALE=2 python3 dev/tests/gear-pick-ui.py   (screens in $SHOTS/gear-pick/)
import os, sys, asyncio, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT = os.environ.get('SHOTS', '/tmp/lunar-shots') + '/gear-pick/'; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print('PASS' if c else 'FAIL', m)
    if not c: fails.append(m)
UID = random.randint(9908000, 9908999); PID = 'tg_%d' % UID   # a fresh pilot every run
SIZES = [(390, 740, 'phone'), (320, 568, 'small'), (1366, 768, 'desktop')]
async def wide(pg):
    return await pg.evaluate("()=>{const W=innerWidth;return [...document.querySelectorAll('#screen *,.sheet *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.right>W+1||r.left<-1)&&getComputedStyle(e).position!=='fixed';}).map(e=>e.className||e.tagName).slice(0,4)}")
def eco(): return dev('/__dump')['eco'][PID]
def tiles_js(tk):
    return "()=>[...document.querySelectorAll('.gpicks[aria-label=\"Chosen %s\"] .gpick')].map(e=>e.dataset.arg.split(':').slice(0,2).join(':')+'='+e.dataset.act+'='+e.querySelector('span').textContent)" % tk
async def main():
    start_dev()
    async with async_playwright() as p:
        b, pg, errs = await open_game(p, 390, 740, scale=float(os.environ.get('SCALE', 1)), eco='server', user={'id': UID, 'username': 'gearui', 'first_name': 'G'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_function('save&&save.migOk&&save.lab', timeout=30000)
        cur = eco()
        cur.update({'pts': 1000000, 'earned': 1000000, 'mp': 30, 'wOwn': {'pulse': [0], 'twin': [1]}, 'cOwn': {'vanguard': [0], 'titan': [1]}, 'roll': {'twin:1': 1.07, 'titan:1': 1.06}})
        dev('/__set', {'path': 'eco/' + PID, 'value': cur})
        await pg.evaluate("()=>{save.welcomed=true;save.termsOk=true;save.payCur='stars';store();doSync(false);}")
        await pg.wait_for_function("save.pts===1000000&&(save.wOwn.twin||[]).includes(1)&&(save.cOwn.titan||[]).includes(1)", timeout=20000)
        # 1. the Points shop
        for (w, h, nm) in SIZES:
            await pg.set_viewport_size({'width': w, 'height': h})
            await pg.evaluate("()=>{closeAll();shopTab='pts';setTab('shop');}"); await pg.wait_for_timeout(400)
            ps = await pg.evaluate("""()=>({crates:[...document.querySelectorAll('[data-act=ptscrate]:not([data-arg^="gem:"]) .p')].map(e=>e.textContent),
              heads:[...document.querySelectorAll('.ptsh')].map(e=>e.textContent).filter(t=>/Chosen (weapon|chassis)/.test(t)),epicNote:/Epic weapons and chassis come from/.test(document.body.textContent)})""")
            wt, ct = await pg.evaluate(tiles_js('weapons')), await pg.evaluate(tiles_js('chassis'))
            ok(ps['crates'] == ['30K', '60K', '180K'] * 2 and ps['heads'] == ['Chosen weapon · pick it, no random roll · from 43,750 points', 'Chosen chassis · pick it, no random roll · from 43,750 points'] and not ps['epicNote'],
               nm + ': Points shop: weapon caches and chassis crates 30K / 60K / 180K (Epic too), chosen weapon and chassis headers from 43,750 ' + json.dumps(ps))
            ok(len(wt) == 9 and len(ct) == 9 and 'pulse:0=gnop=Owned' in wt and 'twin:1=gnop=Owned' in wt and 'siege:2=gearpick=262.5K' in wt and 'twin:0=gearpick=43.75K' in wt and 'vanguard:0=gnop=Owned' in ct and 'titan:1=gnop=Owned' in ct and 'scout:1=gearpick=87.5K' in ct,
               nm + ': 9 chosen weapons and 9 chosen chassis, owned ones say Owned and open nothing, the rest 43.75K / 87.5K / 262.5K ' + json.dumps([wt, ct]))
            ok(not await wide(pg), nm + ': Points shop fits the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>[...document.querySelectorAll('.sec')].find(e=>/Weapon caches/.test(e.textContent)).scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=OUT + nm + '_points_weapons.png')
            await pg.evaluate("()=>[...document.querySelectorAll('.sec')].find(e=>/Chassis crates/.test(e.textContent)).scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=OUT + nm + '_points_chassis.png')
            await pg.click('.gpick[data-arg="pulse:0:p"]', force=True); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("()=>!findOv('gearpick')"), nm + ': tapping an Owned tile opens nothing')
            await pg.click('[data-act=ptscrate][data-arg="weapon:2"]'); await pg.wait_for_timeout(400)
            t = await pg.evaluate("()=>({buy:(document.querySelector('[data-act=buypts]')||{}).textContent||'',picks:[...document.querySelectorAll('.sheet [data-act=gearpick]')].map(e=>e.dataset.arg+'='+e.textContent)})")
            ok(t['buy'].startswith('Use 180,000 points') and len(t['picks']) == 3 and all('Pick it · 262.5K' in x for x in t['picks']), nm + ': the Epic weapon cache sheet: Use 180,000 points, and Pick it for each item ' + json.dumps(t))
            ok(not await wide(pg), nm + ': the crate sheet fits the width')
            await pg.screenshot(path=OUT + nm + '_points_epic_weapon_sheet.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
            await pg.evaluate("()=>document.querySelector('.gpick[data-arg=\"siege:2:p\"]').scrollIntoView({block:'center'})"); await pg.click('.gpick[data-arg="siege:2:p"]'); await pg.wait_for_timeout(400)
            sh = await pg.evaluate("()=>({h:(document.querySelector('.sheet h3')||{}).textContent,btn:(document.querySelector('[data-act=buygearpts]')||{}).textContent||'',txt:document.querySelector('.sheet').textContent})")
            ok(sh['h'] == 'Titanfall' and sh['btn'].startswith('Use 262,500 points') and 'about 1.46× the points of a random epic weapon cache (180,000 points)' in sh['txt'] and '105 to 110%' in sh['txt'], nm + ': the chosen-weapon sheet (points): Titanfall, 262,500 points ' + json.dumps(sh)[:300])
            ok(not await wide(pg), nm + ': the chosen-weapon sheet fits the width')
            await pg.screenshot(path=OUT + nm + '_pick_points_sheet.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
        await pg.set_viewport_size({'width': 390, 'height': 740})
        # 3a. real purchases with points: a chosen weapon (Epic Titanfall) and a chosen chassis (Rare Strider)
        stars0 = await pg.evaluate("()=>[boxStars('weapon',2,true),boxStars('chassis',1,true)]")
        for (arg, k, ri, cost, name, own) in [('siege:2', 'siege', 2, 262500, 'Titanfall', 'wOwn'), ('scout:1', 'scout', 1, 87500, 'Strider', 'cOwn')]:
            await pg.evaluate("()=>{closeAll();shopTab='pts';setTab('shop');}"); await pg.wait_for_timeout(400)
            e0 = eco()
            await pg.evaluate("(a)=>document.querySelector('.gpick[data-arg=\"'+a+':p\"]').scrollIntoView({block:'center'})", arg); await pg.click('.gpick[data-arg="%s:p"]' % arg); await pg.wait_for_timeout(400)
            await pg.click('[data-act=buygearpts]'); await pg.wait_for_function("save.pts<%d" % e0['pts'], timeout=15000); await pg.wait_for_timeout(700)
            e1 = eco(); roll = e1['roll'].get('%s:%d' % (k, ri))
            rv = await pg.evaluate("()=>(document.querySelector('.reveal')||{}).textContent||''")
            ok(e0['pts'] - e1['pts'] == cost and ri in e1[own].get(k, []) and roll and 1.05 <= roll <= 1.10 and json.dumps(e1.get('buys') or {}) == json.dumps(e0.get('buys') or {}) and ('New ' + ['Common', 'Rare', 'Epic'][ri] + ': ' + name) in rv,
               'points purchase on the server: %s for %d points, exactly that item, roll %s, no money price step; the reveal says so %s' % (name, cost, roll, json.dumps(rv[:120])))
            await pg.screenshot(path=OUT + 'phone_reveal_points_' + k + '.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(300)
            await pg.evaluate("()=>{shopTab='pts';setTab('shop');}"); await pg.wait_for_timeout(300)
            tt = await pg.evaluate("(a)=>{const e=document.querySelector('.gpick[data-arg^=\"'+a+'\"]');return e.dataset.act+'='+e.textContent}", arg)
            ok(tt.startswith('gnop=') and tt.endswith('Owned'), 'after the purchase the tile says Owned and opens nothing ' + tt)
        ok(await pg.evaluate("()=>[boxStars('weapon',2,true),boxStars('chassis',1,true)]") == stars0, 'points purchases left the Stars prices of their crates alone ' + json.dumps(stars0))
        # the server refuses a second points buy of an owned item
        p0 = eco()['pts']; r = await pg.evaluate("()=>api('/api/act',{a:'gear',k:'siege',ri:2}).then(r=>r.out)")
        ok(r.get('err') == 'owned' and eco()['pts'] == p0, 'the server refuses to sell an owned chosen item again, nothing taken ' + json.dumps(r))
        # 2. the Store
        for (w, h, nm) in SIZES:
            await pg.set_viewport_size({'width': w, 'height': h})
            await pg.evaluate("()=>{closeAll();shopTab='store';setTab('shop');}"); await pg.wait_for_timeout(400)
            st = await pg.evaluate("""()=>({crates:[...document.querySelectorAll('[data-act=crate]:not([data-arg^="gem:"])')].map(e=>e.dataset.arg+'='+e.querySelector('.p').textContent),
              heads:[...document.querySelectorAll('.ptsh')].map(e=>e.textContent).filter(t=>/Chosen (weapon|chassis)/.test(t)),full:[0,1,2].map(ri=>boxStars('weapon',ri,true)),now:['weapon','chassis'].flatMap(tk=>[0,1,2].map(ri=>tk+':'+ri+'='+fmtNum(boxStars(tk,ri))+' ⭐'))})""")
            wt, ct = await pg.evaluate(tiles_js('weapons')), await pg.evaluate(tiles_js('chassis'))
            ok(st['full'] == [250, 500, 1500] and st['crates'] == st['now'] and st['heads'] == ['Chosen weapon · pick it, no random roll · from 375 ⭐', 'Chosen chassis · pick it, no random roll · from 375 ⭐'],
               nm + ': Store: weapon caches 250 / 500 / 1,500 Stars full price (unchanged; the weekly epic deal may show), chosen items from 375 Stars ' + json.dumps(st))
            ok('twin:2=gearpick=2,250 ⭐' in wt and 'pulse:1=gearpick=750 ⭐' in wt and 'siege:2=gnop=Owned' in wt and 'scout:1=gnop=Owned' in ct and 'vanguard:2=gearpick=2,250 ⭐' in ct and 'scout:0=gearpick=375 ⭐' in ct,
               nm + ': chosen items in Stars at 1.5x their crate (375 / 750 / 2,250), the ones bought with points Owned ' + json.dumps([wt, ct]))
            ok(not await wide(pg), nm + ': Store fits the width ' + json.dumps(await wide(pg)))
            await pg.evaluate("()=>[...document.querySelectorAll('.sec')].find(e=>/Weapon caches/.test(e.textContent)).scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=OUT + nm + '_store_weapons.png')
            await pg.evaluate("()=>[...document.querySelectorAll('.sec')].find(e=>/Chassis crates/.test(e.textContent)).scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200)
            await pg.screenshot(path=OUT + nm + '_store_chassis.png')
            await pg.evaluate("()=>document.querySelector('.gpick[data-arg=\"twin:2\"]').scrollIntoView({block:'center'})"); await pg.click('.gpick[data-arg="twin:2"]'); await pg.wait_for_timeout(400)
            sh = await pg.evaluate("()=>({h:(document.querySelector('.sheet h3')||{}).textContent,btn:(document.querySelector('[data-act=buygear]')||{}).textContent||'',txt:document.querySelector('.sheet').textContent})")
            ok(sh['h'] == 'Helix Repeater' and sh['btn'] == 'Buy for 2,250 ⭐' and '1.5× the epic weapon cache’s price right now (1,500 ⭐' in sh['txt'] and 'Also sold for 262,500 points' in sh['txt'], nm + ': the chosen-weapon sheet (Stars): Helix Repeater, 2,250 Stars ' + json.dumps(sh)[:300])
            ok(not await wide(pg), nm + ': the Stars chosen-weapon sheet fits the width')
            await pg.screenshot(path=OUT + nm + '_pick_store_sheet.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(250)
        await pg.set_viewport_size({'width': 390, 'height': 740})
        # 3b. real purchases with Stars: tap Buy -> the server's invoice -> Telegram's payment webhook -> the server grants it
        for (n, (k, ri, name, own, title)) in enumerate([('twin', 2, 'Helix Repeater', 'wOwn', 'Epic chosen weapon: Helix Repeater'), ('vanguard', 2, 'Paladin', 'cOwn', 'Epic chosen chassis: Paladin')]):
            tk = 'weapon' if own == 'wOwn' else 'chassis'
            await pg.evaluate("()=>{closeAll();shopTab='store';setTab('shop');}"); await pg.wait_for_timeout(400)
            m0 = await pg.evaluate("(tk)=>boxMult(tk,2)", tk); e0 = eco()
            await pg.evaluate("(a)=>document.querySelector('.gpick[data-arg=\"'+a+'\"]').scrollIntoView({block:'center'})", '%s:%d' % (k, ri)); await pg.click('.gpick[data-arg="%s:%d"]' % (k, ri)); await pg.wait_for_timeout(400)
            n0 = len([c for c in dev('/__tg') if c[0] == 'createInvoiceLink'])
            await pg.click('[data-act=buygear]'); await pg.wait_for_function("window.__invoice", timeout=15000); await pg.wait_for_timeout(300)
            inv = [c for c in dev('/__tg') if c[0] == 'createInvoiceLink']; iv = inv[-1][1] if len(inv) > n0 else {}; pl = json.loads(iv.get('payload') or '{}')
            ok(iv.get('title') == title and iv['prices'][0]['amount'] == 2250 and pl.get('k') == 'gear' and pl.get('t') == k and pl.get('r') == ri, 'Stars invoice from the server: ' + title + ', 2,250 Stars ' + json.dumps(pl))
            dev('/__webhook', {'message': {'from': {'id': UID, 'username': 'gearui'}, 'chat': {'id': UID, 'type': 'private'}, 'successful_payment': {'total_amount': iv['prices'][0]['amount'], 'telegram_payment_charge_id': 'gp39.%d.%d' % (UID, n), 'invoice_payload': iv['payload']}}})
            await pg.evaluate("()=>{const cb=window.__invoice[1];window.__invoice=null;cb('paid');}")
            await pg.wait_for_function("(save.%s.%s||[]).includes(%d)" % (own, k, ri), timeout=20000); await pg.wait_for_timeout(900)
            e1 = eco(); roll = e1['roll'].get('%s:%d' % (k, ri)); rv = await pg.evaluate("()=>(document.querySelector('.reveal')||{}).textContent||''")
            m1 = await pg.evaluate("(tk)=>boxMult(tk,2)", tk)
            ok(ri in e1[own].get(k, []) and roll and 1.05 <= roll <= 1.10 and e1['pts'] == e0['pts'] and ('New Epic: ' + name) in rv and m1 == min(3, m0 + 1),
               'Stars purchase granted by the server: exactly ' + name + ', roll %s, no points taken, its crate x%s -> x%s; the reveal: %s' % (roll, m0, m1, json.dumps(rv[:100])))
            await pg.screenshot(path=OUT + 'phone_reveal_stars_' + k + '.png')
            await pg.evaluate("()=>closeAll()"); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{closeAll();shopTab='store';setTab('shop');}"); await pg.wait_for_timeout(400)
        wt = await pg.evaluate(tiles_js('weapons'))
        ok('twin:2=gnop=Owned' in wt and 'pulse:2=gearpick=4,500 ⭐' in wt, 'after the Stars buy: Helix Repeater Owned; the next Epic chosen weapon follows its crate (x2: 4,500 Stars) ' + json.dumps(wt))
        r = await pg.evaluate("()=>api('/api/stars-invoice',{kind:'gear',tk:'twin',ri:2}).then(r=>r,e=>({error:String(e&&e.message)}))")
        ok('owned' in json.dumps(r), 'no Stars invoice for a chosen item already owned ' + json.dumps(r))
        # 5. the wiki
        for (w, h, nm) in [(390, 740, 'phone'), (1366, 768, 'desktop')]:
            wp = await pg.context.new_page(); await wp.set_viewport_size({'width': w, 'height': h})
            await wp.goto(pg.url.split('index.html')[0] + 'wiki.html'); await wp.wait_for_timeout(500)
            await wp.add_style_tag(content='html{scroll-behavior:auto!important}')
            txt = await wp.evaluate("()=>document.body.innerText")
            ok('weapon caches and chassis crates the same 30,000 / 60,000 / 180,000 (Epic included)' in txt and 'chosen weapons and chassis 43,750 / 87,500 / 262,500' in txt and '20,000 / 80,000' not in txt and 'Chosen weapon or chassis' in txt,
               nm + ': the wiki shows the new crate and chosen-gear prices')
            await wp.evaluate("()=>[...document.querySelectorAll('p')].find(e=>/Points shop prices/.test(e.textContent)).scrollIntoView({block:'center'})"); await wp.wait_for_timeout(600)
            await wp.screenshot(path=OUT + nm + '_wiki_prices.png')
            await wp.evaluate("()=>[...document.querySelectorAll('td')].find(e=>/Chosen weapon or chassis/.test(e.textContent)).scrollIntoView({block:'center'})"); await wp.wait_for_timeout(600)
            await wp.screenshot(path=OUT + nm + '_wiki_table.png')
            await wp.close()
        ok(not errs, 'no page errors: ' + json.dumps(errs[:5]))
        await b.close()
    print('RESULT', 'PASS' if not fails else 'FAIL (%d)' % len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
