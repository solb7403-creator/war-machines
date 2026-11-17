# Arcade weather in the browser (Session 5E-2e), against the real Worker code (devserver.mjs). Pass / fail:
#  1. AI match, server economy: the ticket brings the server's weather seed, the phone plays exactly that plan, the result
#     goes back with it, and the takedown counter the phone shows afterwards is the server's own (never more than the sim saw)
#  2. the store: six hazard finishes with their progress, six LIVE entries that say "Not on sale yet"; tapping one opens a
#     sheet with no buy button and starts no checkout in any currency; the Shop and the sheet fit or scroll at phone sizes
#  3. a live 1v1: both phones get the room's seed, work out the same plan as the room's sim, and the room's takedown count is
#     what lands on each pilot's record
#   python3 dev/tests/weather-browser.py
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, dev, open_game, CHROME_ARGS
from playwright.async_api import async_playwright
OUT = os.environ.get('SHOTS', '/tmp/lunar-shots') + '/wxb_'
fails = []
def check(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
async def until(pg, js, ms=8000, step=100):
    for _ in range(ms // step):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(step)
    return False
def eco(uid): return (dev('/__dump').get('eco') or {}).get('tg_' + str(uid)) or {}
U1 = {'id': 885501, 'username': 'wxpilot', 'first_name': 'Wx'}
UA = {'id': 885511, 'username': 'wxalpha', 'first_name': 'Alpha'}
UB = {'id': 885512, 'username': 'wxbravo', 'first_name': 'Bravo'}
SOFT = "window.LUNAR_NO_AUTOGFX=1;"
async def main():
    start_dev()
    async with async_playwright() as p:
        # ---------- 1. AI match on the server's weather ----------
        b, pg, errs = await open_game(p, 390, 700, user=U1, eco='server', init=SOFT)
        await until(pg, "()=>typeof save!=='undefined'&&save.migOk!==undefined", 6000)
        dev('/__set', {'path': 'eco/tg_%d/mp' % U1['id'], 'value': 12})
        await pg.evaluate("()=>doSync(false)"); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{save.welcomed=true;save.termsOk=1;save.gtype='bounty';save.mode='1v1';save.map='longshot';save.wxTip={};store();closeAll();setGfx('2d');}")
        got = None
        same = []
        for i in range(3):   # abandoning the VS screen gets the same weather again: the seed only moves when a match is finished
            await pg.evaluate("()=>{exitBattle();prepareMatch();}"); await until(pg, "()=>battleWx!==null", 6000); same.append(await pg.evaluate("()=>battleWx"))
        check(same[0] is not None and same[0] == same[1] == same[2], 'three VS screens in a row without a finished match: the same server weather (%s)' % same[0])
        for i in range(14):   # a match count whose roll has the hazard (the test sets the server's count; a pilot gets there by playing)
            dev('/__set', {'path': 'eco/tg_%d/mp' % U1['id'], 'value': 13 + i})
            await pg.evaluate("()=>{exitBattle();prepareMatch();}")
            ok = await until(pg, "()=>battleWx!==null", 6000)
            if not ok: continue
            got = await pg.evaluate("()=>({wx:MM.wx,wxc:MM.wxc,k:wxRoll(MM.wx,MM.wxc).k,mp:save.mp})")
            if got['k'] >= 2: break
        check(got is not None and got['k'] >= 2, 'a ticket with the hazard in its roll arrived on the VS screen ' + json.dumps(got))
        nosrv = await pg.evaluate("async()=>{exitBattle();const f=window.fetch;window.fetch=function(u,o){if(/match\\/start/.test(String(u)))return new Promise(()=>{});return f.apply(this,arguments);};prepareMatch();await new Promise(r=>setTimeout(r,600));startMatch();const r={wx:typeof wx!=='undefined'&&wx?wx.P.k:null,mm:MM.wx};window.fetch=f;exitBattle();return r;}")
        check(nosrv['wx'] is None and nosrv['mm'] is None, 'a match that starts before the server answered has no weather (the phone never rolls its own on the server economy) ' + json.dumps(nosrv))
        await pg.evaluate("()=>{exitBattle();prepareMatch();}"); await until(pg, "()=>battleWx!==null", 6000)
        got = await pg.evaluate("()=>({wx:MM.wx,wxc:MM.wxc,k:wxRoll(MM.wx,MM.wxc).k,mp:save.mp})")
        T = eco(U1['id']).get('mt') or {}; hz0 = (eco(U1['id']).get('hz') or {}).get('longshot', 0)
        check(T.get('ws') == got['wx'] and not T.get('wc') and got['wxc'] is False, 'the phone plays the seed the server stored on the ticket (server %s, phone %s)' % (T.get('ws'), got['wx']))
        await pg.evaluate("()=>{startMatch();setCtl(me,'bot');me.st=me.st||mstat;window.__td=0;window.__hz=0;const o=onSimEv;onSimEv=function(a){if(a[0]==='D'&&units[a[1]]===me)__td++;if(a[0]==='h'&&a[3]===3)__hz++;return o(a);};}")
        plan = await pg.evaluate("()=>({haz:wx.P.haz,n:wx.P.hz.length,seed:wx.seed,chip:WeatherFX.chip()})")
        check(plan['haz'] == 'arc' and plan['seed'] == got['wx'] and plan['n'] > 0 and plan['chip'] and 'PYLON' in plan['chip']['txt'], 'Longshot plays the pylon overload from the server seed; the HUD says so ' + json.dumps(plan))
        await pg.wait_for_timeout(16500); await pg.screenshot(path=OUT + 'ai_2d_hazard.png')
        ok = await until(pg, "()=>state==='over'||!!findOv('res')", 150000, 500)
        check(ok, 'the bounty match ran its two minutes')
        await until(pg, "()=>!!findOv('res')", 8000, 100)
        await until(pg, "()=>lastResult&&lastResult.note===null&&!(save.mq&&save.mq.length)", 15000, 250); await pg.wait_for_timeout(300)
        r = await pg.evaluate("()=>({td:__td,hz:__hz,stat:lastResult&&lastResult.stats.td,note:lastResult&&lastResult.note,hzOff:lastResult&&lastResult.hzOff,save:(save.hz||{}).longshot||0,chip:!!(findOv('res')&&findOv('res').box.querySelector('.chip.hz')),line:((findOv('res')&&findOv('res').box.querySelector('.hzres'))||{}).innerText||''})")
        srv = (eco(U1['id']).get('hz') or {}).get('longshot', 0)
        print('AI match:', json.dumps(r), 'server hz', srv)
        check(r['hz'] > 0, 'the pylon hit tanks during the match (%d hazard hits)' % r['hz'])
        check(r['save'] == srv and srv - hz0 <= r['td'] and not r['hzOff'], 'the takedown counter on the phone is the server\'s (%d, +%d this match), never more than the sim saw (%d)' % (srv, srv - hz0, r['td']))
        check((r['td'] > 0) == r['chip'], 'the results screen shows hazard takedowns only when there were some')
        await pg.screenshot(path=OUT + 'ai_results.png')
        check(not errs, 'no page errors in the AI match ' + str(errs[:3]))
        # ---------- 2. the store ----------
        for (w, h) in [(390, 700), (320, 568), (1366, 768)]:
            await pg.set_viewport_size({'width': w, 'height': h}); await pg.evaluate("()=>{closeAll();exitBattle();setTab('shop');}"); await pg.wait_for_timeout(500)
            s = await pg.evaluate("""()=>{const cards=[...document.querySelectorAll('#s-shop .paint')],hz=cards.filter(c=>PAINT_HZ.includes(c.dataset.arg)),lv=cards.filter(c=>PAINT_LIVE.includes(c.dataset.arg));
              return {hz:hz.map(c=>c.querySelector('.p').innerText),lv:lv.map(c=>c.querySelector('.p').innerText),fx:lv.filter(c=>c.querySelector('.pfx')).length,price:lv.some(c=>/⭐|TON|SOL/.test(c.innerText))}}""")
            check(len(s['hz']) == 6 and all('/25' in t for t in s['hz']), '%dx%d: six hazard finishes with their progress %s' % (w, h, s['hz'][:2]))
            check(len(s['lv']) == 6 and all(t.strip().lower() == 'not on sale yet' for t in s['lv']) and s['fx'] == 6 and not s['price'], '%dx%d: six animated LIVE entries, each "Not on sale yet"' % (w, h))
            await pg.evaluate("()=>{window.__invoice=undefined;window.__opened=null;window.__pay=0;const f=window.fetch;window.fetch=function(u,o){if(/\\/api\\/(pay|invoice|buy|act)/.test(String(u)))window.__pay++;return f.apply(this,arguments);};}")
            await pg.evaluate("()=>{const c=document.querySelector('#s-shop .paint[data-arg=arc_live]');c.scrollIntoView({block:'center'});}"); await pg.wait_for_timeout(200)
            await pg.click('#s-shop .paint[data-arg=arc_live]'); await pg.wait_for_timeout(500)
            sh = await pg.evaluate("""()=>{const ov=findOv('finish'),b=ov&&ov.box;if(!b)return null;const r=b.getBoundingClientRect(),btns=[...b.querySelectorAll('[data-act]')].map(x=>x.dataset.act),last=b.querySelector('.btn:last-of-type')||b.lastElementChild;
              last.scrollIntoView({block:'end'});const lr=last.getBoundingClientRect();return {txt:b.innerText,btns,fits:lr.bottom<=innerHeight+1&&lr.top>=0,w:r.width,invoice:window.__invoice,opened:window.__opened,pay:window.__pay}}""")
            check(sh and 'not on sale yet' in sh['txt'].lower() and 'planned price' in sh['txt'].lower(), '%dx%d: the LIVE sheet says it is not on sale and shows the planned price' % (w, h))
            check(sh and not any(a in ('premium', 'buy', 'pay', 'paycur', 'crate') for a in sh['btns']) and sh['invoice'] is None and sh['opened'] is None and sh['pay'] == 0, '%dx%d: no buy button, no invoice, no checkout call %s' % (w, h, sh and sh['btns']))
            check(sh and sh['fits'], '%dx%d: the sheet\'s last button is reachable' % (w, h))
            await pg.screenshot(path=OUT + 'live_sheet_%d.png' % w)
            await pg.evaluate("()=>{closeAll();const s=document.querySelector('#s-shop .paint[data-arg=grid_live]');s.scrollIntoView({block:'end'});}"); await pg.wait_for_timeout(200)
            vis = await pg.evaluate("()=>{const r=document.querySelector('#s-shop .paint[data-arg=grid_live]').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0}")
            check(vis, '%dx%d: the last LIVE entry can be scrolled into view' % (w, h))
            await pg.screenshot(path=OUT + 'shop_%d.png' % w)
        # the server refuses to sell one, whatever the phone asks
        bad = await pg.evaluate("async()=>{const out=[];for(const id of ['arc_live','scorch_live','arc','grid']){try{const o=await apiTimed('/api/stars-invoice',{kind:'paint',tk:id},8000),r=o&&o.j;out.push(r&&(r.error||(r.link?'LINK':'ok')));}catch(e){out.push('err:'+e.message)}}return out}")
        owned = (eco(U1['id']).get('paints') or {})
        check(all(x == 'item' for x in bad) and 'arc_live' not in owned, 'the server refuses a Stars invoice for a finish or a LIVE finish (%s)' % json.dumps(bad))
        await b.close()
        # ---------- 3. a live 1v1 ----------
        dev('/__pvpreset?wait=30000')
        for u in (UA, UB): dev('/__set', {'path': 'eco/tg_%d/mp' % u['id'], 'value': 20})
        br = await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=CHROME_ARGS)
        ba, A, ea = await open_game(p, 390, 700, user=UA, pvp=True, browser=br, init=SOFT)   # the phone's own economy, as pvptest.py: the room credits the server's record either way
        bb, B, eb = await open_game(p, 390, 700, user=UB, pvp=True, browser=br, init=SOFT)
        for pg2 in (A, B):
            await pg2.evaluate("()=>{save.welcomed=true;save.mp=Math.max(save.mp||0,20);save.termsOk=1;save.gtype='arena';save.mode='1v1';save.map='classic';save.wxTip={};store();closeAll();exitBattle();setGfx('2d');setTab('play');}")
            await pg2.wait_for_timeout(200)
        ha0 = eco(UA['id']).get('hz') or {}; hb0 = eco(UB['id']).get('hz') or {}
        await A.click('#s-play .fight'); await until(A, "()=>pvp&&pvp.room", 6000); await B.click('#s-play .fight')
        ok = await until(A, "()=>pvp&&pvp.live&&state!=='menu'", 20000) and await until(B, "()=>pvp&&pvp.live&&state!=='menu'", 20000)
        check(ok, 'both pilots are in the live room')
        await until(A, "()=>state==='play'", 30000, 200); await until(B, "()=>state==='play'", 30000, 200); await A.wait_for_timeout(700)
        code = "const c=rooms[rooms.length-1].core,s=c.sim;return {wx:c.wx,wxc:c.wxc,map:s.map,k:s.wx?s.wx.P.k:null,plan:s.wx?JSON.stringify(s.wx.P.hz.map(z=>[z.id,z.k,z.w,z.t])):null}"
        srv = dev('/__pvpeval', {'code': code})['out']
        ja = await A.evaluate("()=>({wx:MM.wx,wxc:MM.wxc,map:curMap,flip:pvp.flip,k:wx?wx.P.k:null,plan:wx?JSON.stringify(wx.P.hz.map(z=>[z.id,z.k,z.w,z.t])):null})")
        jb = await B.evaluate("()=>({wx:MM.wx,wxc:MM.wxc,map:curMap,flip:pvp.flip,k:wx?wx.P.k:null,plan:wx?JSON.stringify(wx.P.hz.map(z=>[z.id,z.k,z.w,z.t])):null})")
        check(srv['wxc'] is False and ja['wx'] == srv['wx'] and jb['wx'] == srv['wx'] and ja['wxc'] is False, 'both phones got the room\'s weather seed (pilots past their first three matches: not clear)')
        check(ja['plan'] == srv['plan'] and jb['plan'] == srv['plan'] and ja['k'] == srv['k'] and ja['flip'] != jb['flip'], 'both phones work out the room sim\'s plan, strike for strike (roll %s on %s; one side sees the map turned)' % (srv['k'], srv['map']))
        dev('/__pvpeval', {'code': "const s=rooms[rooms.length-1].core.sim;for(const u of s.units)s.setCtl(u,'bot');return 1"})   # the room's AI flies both tanks to the end
        ok = await until(A, "()=>!!findOv('res')", 420000, 1000) and await until(B, "()=>!!findOv('res')", 20000, 500)
        check(ok, 'the live best of 3 finished')
        ra = await A.evaluate("()=>({td:lastResult&&lastResult.stats.td,save:(save.hz||{})[curMap]||0,map:curMap,live:lastResult&&lastResult.live})")
        rb = await B.evaluate("()=>({td:lastResult&&lastResult.stats.td,save:(save.hz||{})[curMap]||0,map:curMap,live:lastResult&&lastResult.live})")
        sa = (eco(UA['id']).get('hz') or {}).get(ra['map'], 0) - ha0.get(ra['map'], 0); sb = (eco(UB['id']).get('hz') or {}).get(rb['map'], 0) - hb0.get(rb['map'], 0)
        print('live:', json.dumps(ra), json.dumps(rb), 'server', sa, sb)
        check(ra['live'] and ra['td'] == sa and rb['td'] == sb, 'each pilot\'s record holds the room\'s own takedown count (A %s/%s, B %s/%s)' % (ra['td'], sa, rb['td'], sb))
        await A.screenshot(path=OUT + 'live_results.png')
        check(not ea and not eb, 'no page errors in the live match ' + str((ea + eb)[:3]))
        await br.close()
        # ---------- 4. a desktop: dodge a meteor with the real keyboard; stand still and take it; never a one-shot ----------
        b, pg, errs = await open_game(p, 1366, 768, user={'id': 885531, 'username': 'wxdesk', 'first_name': 'Desk'}, init=SOFT)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=9;save.termsOk=1;save.gtype='bounty';save.mode='1v1';save.map='classic';save.wxTip={};store();closeAll();setGfx('2d');let s=1;while(wxRoll(s).k!==2)s++;window.LUNAR_WX=s;}")
        async def meteor(dodge):
            await pg.evaluate("()=>{exitBattle();prepareMatch();startMatch();const z=wx.P.hz[0];window.__z=z;const foe=units[1];foe.x=10;foe.y=3;foe.hp=1e9;foe.mhp=1e9;foe.wdps=0;setCtl(foe,'bot');foe.brain.mode='hide';window.__freeze=setInterval(()=>{foe.x=10;foe.y=3;foe.cd=9;},30);}")
            await until(pg, "()=>state==='play'&&elapsed>=__z.w-0.3", 30000, 50)
            await pg.evaluate("()=>{me.x=__z.x;me.y=__z.y;push(me);me.px=me.x;me.py=me.y;me.hzT=0;window.__hp0=me.hp;window.__p0=[me.x,me.y];}")
            if dodge:
                await pg.mouse.move(683, 400); await pg.mouse.click(683, 400)   # the window has the keyboard, as after a real click
                key = await pg.evaluate("""()=>{const D={w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]},t=elapsed;let best='d',bs=-1e9;   // the open direction that stays clear of the salvo's other meteors
                  for(const k in D){let sc=0,ok=true;for(let i=1;i<=6;i++){const x=me.x+D[k][0]*i*0.6,y=me.y+D[k][1]*i*0.6;if(!groundOk(x,y)){ok=false;break;}}
                   const ex=me.x+D[k][0]*4,ey=me.y+D[k][1]*4;for(const q of wx.P.hz)if(q.w<t+3&&q.t>t)sc+=Math.min(4,Math.hypot(q.x-ex,q.y-ey));if(ok&&sc>bs){bs=sc;best=k;}}return best}""")
                await pg.keyboard.down(key); await pg.wait_for_timeout(1400); await pg.keyboard.up(key)
            await until(pg, "()=>elapsed>=__z.t+0.3", 8000, 50)
            r = await pg.evaluate("()=>{clearInterval(__freeze);return {lost:(__hp0-me.hp)/me.mhp,d:Math.hypot(me.x-__z.x,me.y-__z.y),r:__z.r,alive:me.hp>0,tip:(save.wxTip||{}).meteor||0,z:[__z.x,__z.y],keys:Object.keys(keys).filter(k=>keys[k]!==undefined).join('')}}")
            return r
        r1 = await meteor(True); r2 = await meteor(False)
        print('desktop meteor:', json.dumps(r1), json.dumps(r2))
        check(r1['lost'] == 0 and r1['d'] > r1['r'], 'desktop keyboard: driving off the landing spot during the warning dodges the meteor (moved %.1f, no hull lost)' % r1['d'])
        check(0.05 < r2['lost'] <= 0.34 and r2['alive'], 'standing still on the spot takes the hit: %.0f%% of the hull, never a one-shot' % (r2['lost'] * 100))
        check(r2['tip'] >= 1, 'the first meteors of a pilot show the how-to-dodge line')
        check(not errs, 'no page errors on the desktop ' + str(errs[:3]))
        await b.close()
        # ---------- 5. a hazard kill goes to the last attacker: the feed, the pop and the counter (phone, 3D) ----------
        b, pg, errs = await open_game(p, 390, 844, user={'id': 885541, 'username': 'wxkill', 'first_name': 'Kill'}, scale=2, init=SOFT)
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)", timeout=30000)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=9;save.termsOk=1;save.gtype='bounty';save.mode='1v1';save.map='longshot';save.wxTip={arc:3};store();closeAll();let s=1;while(wxRoll(s).k!==2)s++;window.LUNAR_WX=s;prepareMatch();startMatch();paused=true;banner=null;}")
        k = await pg.evaluate("""()=>{const z=wx.P.hz[0],foe=units[1];me.x=10;me.y=23;foe.x=8;foe.y=18.5;me.hzT=0;foe.hzT=0;foe.wdps=0;
          while(elapsed<z.t-0.6){me.x=10;me.y=23;foe.x=8;foe.y=18.5;update(1/30);fxTick(1/30);}
          takeHit(foe,60,me,null,0);foe.hp=Math.min(foe.hp,120);const k0=me.st.kills;
          for(let i=0;i<40;i++){me.x=10;me.y=23;if(foe.hp>0){foe.x=8;foe.y=18.5;}update(1/30);fxTick(1/30);if(i>10)drawBattle();}
          for(let i=0;i<3;i++)drawBattle();
          return {dead:foe.hp<=0,kills:me.st.kills-k0,td:me.st.td,feed:feed.map(f=>f.txt),meLost:me.mhp-me.hp,prog:WeatherFX.progress()}}""")
        await pg.wait_for_timeout(200); await pg.screenshot(path=OUT + 'kill_credit.png')
        print('kill credit:', json.dumps(k))
        check(k['dead'] and k['kills'] == 1 and k['td'] == 1 and any('finished' in f and 'pylon' in f for f in k['feed']), 'the pylon finishes a tank you hit: your kill, your takedown, and the feed says so ' + json.dumps(k['feed']))
        check(any('ARC CHARGE 1/25' in f for f in k['feed']) and k['prog']['have'] == 1, 'the takedown counter shows in the feed (ARC CHARGE 1/25)')
        check(k['meLost'] == 0, 'behind the container the pylon cannot reach you')
        check(not errs, 'no page errors in the kill-credit scene ' + str(errs[:3]))
        await b.close()
    print('FAILED %d' % len(fails) if fails else 'PASS arcade weather in the browser')
    sys.exit(1 if fails else 0)
asyncio.run(main())
