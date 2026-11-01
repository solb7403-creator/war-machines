# Live-match version check: a phone on an old build (older PVP_V) that taps a live mode is updated and put straight
# back in the same live queue (never an AI match); offline, it says "Update needed: reopen the game" with Retry.
# A current phone joins live normally and is seated in the same live room as the updated one (checked on the server's
# join answers; the match socket is a stub that stays connecting, so this runs where browser WebSockets don't).
# python3 dev/tests/pvp-update.py
import asyncio, json, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, dev, open_game, REPO
from playwright.async_api import async_playwright
fails = []
def check(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
UA = {'id': 880201, 'username': 'oldphone', 'first_name': 'Old'}
UB = {'id': 880202, 'username': 'newphone', 'first_name': 'New'}
OLD = '20200101000000'
CUR = json.load(open(os.path.join(REPO, 'version.json')))['v']
net = {'version': 'old', 'delay': 0}   # old: the phone opened before the release (version.json still names its build)
def old_index():
    s = open(os.path.join(REPO, 'index.html')).read()
    s = re.sub(r"window\.BUILD='[^']*'", "window.BUILD='" + OLD + "'", s)
    return re.sub(r'\.(css|js)\?v=[0-9A-Za-z-]+', r'.\1?v=' + OLD, s).encode()
async def old_build(u):   # the old phone: an old page and rules.js until it reloads to the newest build
    path = u.split(':8899/', 1)[1]
    if path.startswith('version.json'):
        if net['version'] == 'offline': return 'abort'
        if net['version'] == 'old': return (json.dumps({'v': OLD}).encode(), 'application/json')
        if net['delay']: await asyncio.sleep(net['delay'])
        return None
    if path == 'index.html': return (old_index(), 'text/html')
    if path.startswith('js/rules.js?v=' + OLD):
        s = open(os.path.join(REPO, 'js/rules.js')).read()
        s2 = re.sub(r'const PVP_V=\d+;', 'const PVP_V=1;', s); assert s2 != s
        return (s2.encode(), 'application/javascript')
    return None
async def until(pg, js, ms=8000, step=100):
    for _ in range(ms // step):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(step)
    return False
async def played(pg, uid):   # live play needs one match played: the server owns the count (Telegram economy)
    dev('/__set', {'path': 'eco/tg_%d/mp' % uid, 'value': 6})
    await pg.evaluate("()=>doSync(false)")
    await until(pg, "()=>(save.mp||0)>=1", 8000)
async def prep(pg):
    await pg.evaluate("()=>{save.welcomed=true;save.mp=Math.max(save.mp||0,6);save.gtype='arena';save.mode='1v1';save.map='classic';save.termsOk=1;store();closeAll();exitBattle();setTab('play');}")
    await pg.wait_for_timeout(150)
WSSTUB = "window.WebSocket=class{constructor(){this.readyState=0;}send(){}close(){}};"
SPY = "()=>{const f=pvpFallback;pvpFallback=function(){sessionStorage.setItem('fellback','1');return f.apply(this,arguments);};}"
async def main():
    start_dev(); dev('/__pvpreset?wait=30000')
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
        _, A, ea = await open_game(p, user=UA, pvp=True, browser=br, override=old_build, eco='server', init=WSSTUB)
        joins = []
        async def onresp(resp):
            if '/api/pvp/join' in resp.url:
                try: joins.append((resp.status, json.loads(await resp.text())))
                except Exception: joins.append((resp.status, {}))
        A.on('response', onresp)
        r = await A.evaluate("()=>({b:window.BUILD,v:PVP_V})")
        check(r == {'b': OLD, 'v': 1}, 'old phone runs an old build: ' + json.dumps(r))
        await played(A, UA['id']); await prep(A); await A.evaluate(SPY)
        # 1. offline: no newer build can be fetched -> a clear message with Retry, no AI match
        net['version'] = 'offline'
        await A.click('#s-play .fight')
        ok = await until(A, "()=>/Update needed: reopen the game/.test(document.body.innerText)&&!!document.querySelector('[data-act=pvpretry]')", 6000)
        check(ok, 'offline: "Update needed: reopen the game" with a Retry button')
        r = await A.evaluate("()=>({state,pvp:!!pvp,fell:sessionStorage.getItem('fellback'),resume:sessionStorage.getItem('lunar-pvp-resume')})")
        check(r['state'] == 'menu' and not r['pvp'] and not r['fell'] and not r['resume'], 'offline: no AI match, nothing queued: ' + json.dumps(r))
        # 2. back online: Retry -> "Updating..." -> reload to the newest build -> back in the same live queue
        net['version'] = 'ok'; net['delay'] = 1.0
        await A.click('[data-act=pvpretry]')
        ok = await until(A, "()=>/Updating to the latest version/.test(document.body.innerText)", 3000, 50)
        check(ok, 'shows "Updating to the latest version…"')
        await A.wait_for_url('**/index.html?v=' + CUR + '*', timeout=10000)
        await until(A, "()=>typeof PVP_V!=='undefined'", 10000)
        r = await A.evaluate("()=>({b:window.BUILD,v:PVP_V})")
        check(r['b'] == CUR and r['v'] == 2, 'reloaded to the newest build: ' + json.dumps(r))
        ok = await until(A, "()=>pvp&&pvp.phase==='find'&&pvp.room&&pvp.q.g==='arena'&&pvp.q.m==='1v1'", 10000)
        check(ok, 'rejoined the same live queue (Arena 1v1) after the update')
        await A.evaluate(SPY)
        st = [j[0] for j in joins]; aroom = joins[-1][1].get('room') if joins else None
        check(st[:2] == [409, 409] and st[-1] == 200 and joins[-1][1].get('seat') == 0, 'server: refused twice as "update" while old, seated after the update: ' + json.dumps(st))
        r = await A.evaluate("()=>({state,fell:sessionStorage.getItem('fellback'),resume:sessionStorage.getItem('lunar-pvp-resume')})")
        check(not r['fell'] and not r['resume'] and r['state'] == 'menu', 'no AI fallback; resume marker used up: ' + json.dumps(r))
        # 3. a current phone joins live normally and meets the updated phone
        _, B, eb = await open_game(p, user=UB, pvp=True, browser=br, eco='server', init=WSSTUB)
        bj = []
        async def onresp_b(resp):
            if '/api/pvp/join' in resp.url: bj.append((resp.status, json.loads(await resp.text())))
        B.on('response', onresp_b)
        r = await B.evaluate("()=>({b:window.BUILD,v:PVP_V})")
        check(r == {'b': CUR, 'v': 2}, 'current phone on the newest build: ' + json.dumps(r))
        await played(B, UB['id']); await prep(B); await B.evaluate(SPY)
        await B.click('#s-play .fight')
        await B.evaluate("()=>{lastQuick=false;beginMatch();}")   # what the Fight button runs
        await until(B, "()=>pvp&&pvp.phase==='find'&&!!pvp.room", 8000)
        check(bool(bj) and bj[-1][0] == 200 and bj[-1][1].get('room') == aroom and bj[-1][1].get('seat') == 1, 'current phone joins live normally, seated with the updated phone: ' + json.dumps([[x[0], x[1].get('room'), x[1].get('seat')] for x in bj]) + ' room ' + str(aroom))
        await A.wait_for_timeout(500)
        r = [await pg.evaluate("()=>({phase:pvp&&pvp.phase,state,fell:sessionStorage.getItem('fellback')})") for pg in (A, B)]
        check(all(x['phase'] == 'find' and x['state'] == 'menu' and not x['fell'] for x in r), 'both still in the live queue, no AI match: ' + json.dumps(r))
        check(not ea and not eb, 'no page errors ' + json.dumps(ea + eb))
        await br.close()
    print('fails:', fails); print('RESULT', 'FAIL' if fails else 'PASS'); sys.exit(1 if fails else 0)
asyncio.run(main())
