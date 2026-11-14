# WEAPON SOUNDS in the real game page (Session 5E-2b3). The offline test (weapon-sounds.cjs) measures every sound; this one checks
# the game plays them at the right moments, on a phone and a desktop size:
#  1. the first tap starts the audio (iOS rule) and every tank's shot reaches the engine: yours always, the others within a budget
#     (about 9 a second, never a wall of noise), quieter with distance;
#  2. every one of the ten Arcade supers, at miss / hit / jackpot, plays charge -> verdict -> fire -> impact in that order with its
#     own key and the bar's outcome, and the charge stops when the super fires; another tank's super is heard as a warning;
#  3. Sound off silences all of it (and stops a charge in flight);
#  4. the owner's sound test page: every button plays, no page errors, it fits or scrolls (a real finger swipe) at 390x700,
#     320x568 and desktop, nothing wider than the screen.
# usage: CHROMIUM_PATH=... python3 dev/tests/weapon-sounds-browser.py   (screens in $SHOTS/sounds/)
import os, sys, asyncio, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
OUT = os.environ.get('SHOTS', '/tmp/lunar-shots') + '/sounds/'; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    if not c: fails.append(m); print('FAIL', m)
INSTR = """()=>{window.__lw=[];for(const k of ['shot','charge','lock','fire','impact','hit']){const f=LW[k];LW[k]=function(){__lw.push([k].concat([].slice.call(arguments,0,4).map(v=>typeof v==='number'?Math.round(v*100)/100:v)));return f.apply(this,arguments);};}}"""
async def main():
    start_dev()
    async with async_playwright() as p:
        b, pg, errs = await open_game(p, 390, 740, scale=float(os.environ.get('SCALE', 1)), user={'id': 990511, 'username': 'pilotsnd', 'first_name': 'S'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=12;save.sound=true;store();closeAll();}")
        await pg.mouse.click(12, 300); await pg.wait_for_timeout(250)
        ok(await pg.evaluate("()=>AC&&AC.state==='running'"), 'the first tap starts the audio')
        await pg.evaluate(INSTR)
        # 1. a 1v1 Arena match, 12 s of sim: shots from both tanks
        st = await pg.evaluate("""()=>{window.LUNAR_NO_CAM_INTRO=1;save.gtype='arena';save.mode='1v1';save.map='craters';store();prepareMatch();startMatch();
          const m0=LW.stats().made;units[1].x=10;units[1].y=16;me.x=10;me.y=22;
          const T0=AC.currentTime;for(let i=0;i<360;i++)update(1/30);
          const own=__lw.filter(c=>c[0]==='shot'&&c[2]===true).length,other=__lw.filter(c=>c[0]==='shot'&&c[2]===false).length,m1=LW.stats().made;
          return {own,other,madeOwn:m1.shot-m0.shot,madeOther:m1.other-m0.other,keys:[...new Set(__lw.filter(c=>c[0]==='shot').map(c=>c[1]))]};}""")
        print('shots', st)
        ok(st['own'] >= 8 and st['other'] >= 4, 'both tanks fire with their weapon sounds ' + json.dumps(st))
        ok(st['madeOwn'] >= 1, 'your shots make sound ' + json.dumps(st))
        # the sim ran 12 s in one burst of script time: the other-tank budget (9 a second, bursts of 4) caps what plays
        ok(st['madeOther'] <= 4 + 9 * 2, 'other tanks stay inside the shot budget ' + json.dumps(st))
        # the same match in real time (the game's own loop): every one of your rounds plays, the other tank stays in budget
        rt0 = await pg.evaluate("()=>{const m=LW.stats().made;__lw.length=0;units[1].x=10;units[1].y=16;me.x=10;me.y=22;me.hp=me.mhp=1e6;units[1].hp=units[1].mhp=1e6;return m;}")
        await pg.wait_for_timeout(4000)
        rt = await pg.evaluate("(m0)=>{const m=LW.stats().made;return {calls:__lw.filter(c=>c[0]==='shot'&&c[2]===true).length,own:m.shot-m0.shot,other:m.other-m0.other,state};}", rt0)
        print('real time', rt)
        ok(rt['calls'] >= 3 and rt['own'] >= rt['calls'] * 0.9, 'real time: your shots all play ' + json.dumps(rt))
        ok(rt['other'] <= 4 + 9 * 4.5, 'real time: the other tank stays in the shot budget ' + json.dumps(rt))
        # 2. every super at every outcome
        res = await pg.evaluate("""async()=>{const out=[];const W=k=>k==='moon'?['moon',2]:[k.replace(/\\d$/,''),+k.slice(-1)];
          for(const k of LW.KEYS)for(const oc of [0,1,2]){
            exitBattle();save.gtype='arena';save.mode='1v1';save.map='craters';prepareMatch();startMatch();for(let i=0;i<4;i++)update(1/30);
            const [w,t]=W(k);me.wtype=w;me.wtier=t;me.x=10;me.y=22;me.ang=-Math.PI/2;const e=units[1];e.x=10;e.y=14;e.hp=e.mhp=99999;me.hp=me.mhp=99999;me.supN=0;me.sp=SUPER_MAX;e.sp=0;
            __lw.length=0;if(!superGo(-Math.PI/2)){out.push({k,oc,err:'no press'});continue;}
            const bar=me.sup.bar,J=SUP_JACK_W/2,tap=oc===2?bar.jc:oc===1?(Math.abs(bar.z0+0.04-bar.jc)>J+0.04?bar.z0+0.04:bar.z0+SUP_ZONE_W-0.06):null;
            for(let i=0;i<200&&me.sup;i++){update(1/60);if(tap!==null&&me.sup&&me.sup.oc===undefined&&me.sup.el>=tap*SUP_BAR_T)supStop();}
            for(let i=0;i<120;i++)update(1/60);
            await new Promise(r=>setTimeout(r,0));
            const seq=__lw.filter(c=>c[0]!=='shot'&&c[0]!=='hit'&&(c[0]!=='charge'||c[2]===me.id||c[3]===true));
            out.push({k,oc,seq:seq.map(c=>c.slice(0,3)),charging:LW.stats().charging});}
          return out;}""")
        for r in res:
            k, oc = r['k'], r['oc']
            if 'err' in r: ok(False, k + ' ' + str(oc) + ': ' + r['err']); continue
            kinds = [c[0] for c in r['seq']]
            want = ['charge', 'lock', 'fire', 'impact']
            idx = [kinds.index(x) if x in kinds else -1 for x in want]
            ok(all(i >= 0 for i in idx) and idx == sorted(idx), k + ' oc ' + str(oc) + ': charge, verdict, fire, impact in order ' + json.dumps(r['seq']))
            ok(all(c[1] == k for c in r['seq'] if c[0] in want), k + ' oc ' + str(oc) + ': every stage uses the super\'s own key ' + json.dumps(r['seq']))
            lk = [c for c in r['seq'] if c[0] == 'lock']; fi = [c for c in r['seq'] if c[0] == 'fire']
            ok(bool(lk) and lk[0][2] == oc, k + ': the verdict sound has the bar\'s outcome ' + str(oc) + ' ' + json.dumps(lk))
            ok(bool(fi) and fi[0][2] == oc, k + ': the fire has the bar\'s outcome ' + str(oc) + ' ' + json.dumps(fi))
            ok(r['charging'] == 0, k + ' oc ' + str(oc) + ': the charge stopped when the super fired')
        # another tank's super is a warning you hear (its charge, not full level)
        en = await pg.evaluate("""()=>{exitBattle();prepareMatch();startMatch();for(let i=0;i<4;i++)update(1/30);const e=units[1];e.x=10;e.y=14;me.x=10;me.y=20;e.sp=SUPER_MAX;e.supN=0;__lw.length=0;
          useSuper(e,Math.PI/2);for(let i=0;i<90;i++)update(1/60);return __lw.filter(c=>c[0]==='charge'||c[0]==='fire').map(c=>[c[0],c[1],c[3]===undefined?c[2]:c[3]]);}""")
        ok(any(c[0] == 'charge' for c in en) and any(c[0] == 'fire' for c in en), 'an enemy super is heard (charge and fire) ' + json.dumps(en))
        # 3. Sound off
        mute = await pg.evaluate("""()=>{exitBattle();prepareMatch();startMatch();me.sp=SUPER_MAX;me.supN=0;superGo(-Math.PI/2);update(1/60);const c0=LW.stats().charging;
          save.sound=false;ACT.sound&&0;LW.stopAll();const m0=LW.stats().made;for(let i=0;i<300;i++)update(1/30);const m1=LW.stats().made;save.sound=true;
          return {c0,charging:LW.stats().charging,made:[m1.shot-m0.shot,m1.other-m0.other,m1.sup-m0.sup]};}""")
        ok(mute['c0'] == 1 and mute['charging'] == 0 and mute['made'] == [0, 0, 0], 'Sound off: nothing plays and the charge stops ' + json.dumps(mute))
        # the Settings toggle stops a charge in flight too
        tog = await pg.evaluate("""()=>{exitBattle();prepareMatch();startMatch();me.sp=SUPER_MAX;me.supN=0;superGo(-Math.PI/2);update(1/60);const a=LW.stats().charging;ACT.sound();const b=LW.stats().charging,off=save.sound===false;ACT.sound();exitBattle();return {a,b,off,back:save.sound!==false};}""")
        ok(tog['a'] == 1 and tog['b'] == 0 and tog['off'] and tog['back'], 'the Sound toggle stops a charge and comes back on ' + json.dumps(tog))
        # voice limits (review): 20 other tanks' supers at once stay under the cap and yours still plays; shots too far to hear cost the shared budget nothing
        cap = await pg.evaluate("""()=>{exitBattle();prepareMatch();startMatch();LW.stopAll();me.x=10;me.y=22;
          for(let i=0;i<20;i++)LW.fire('moon',1,1000+i,false,10+(i%5),20-(i%4));const a=LW.stats().active.sup,s0=LW.stats().made.sup;
          LW.fire('pulse0',2,me.id,true,me.x,me.y);const s1=LW.stats().made.sup,b=LW.stats().active.sup,m0=LW.stats().made.other;
          for(let i=0;i<6;i++)LW.shot('siege0',false,me.x+60,me.y+60);const m1=LW.stats().made.other;LW.shot('siege0',false,me.x+1,me.y);const m2=LW.stats().made.other;LW.stopAll();
          return {a,b,own:s1-s0,far:m1-m0,near:m2-m1};}""")
        ok(cap['a'] <= 8 and cap['b'] <= 8 and cap['own'] == 1 and cap['far'] == 0 and cap['near'] == 1, 'voice limits: supers capped at 8 with yours playing, far shots free ' + json.dumps(cap))
        # 4. the owner's sound test page
        for (w, h, nm) in [(390, 700, 'phone'), (320, 568, 'small'), (1366, 768, 'desktop')]:
            await pg.set_viewport_size({'width': w, 'height': h})
            # a pilot who is not the owner: the page never opens, the button never shows
            await pg.evaluate("()=>{exitBattle();closeAll();setTab('play');}"); await pg.wait_for_timeout(600)
            gate = await pg.evaluate("()=>{openSoundLab();return {open:!!document.querySelector('.sndlab'),btn:sndLabBtn()===''};}")
            ok(not gate['open'] and gate['btn'], nm + ': not the owner: no sound test ' + json.dumps(gate))
            await pg.evaluate("()=>{closeAll();sndLabSheet();}"); await pg.wait_for_timeout(400)   # the page itself (the owner sees this)
            ok(await pg.evaluate("()=>!!document.querySelector('.sndlab')"), nm + ': the sound test page draws')
            n = await pg.evaluate("()=>document.querySelectorAll('[data-act=sndshot],[data-act=sndburst],[data-act=sndsup]').length")
            ok(n == 50, nm + ': 10 shots x 2 and 10 supers x 3 buttons (' + str(n) + ')')
            wide = await pg.evaluate("()=>{const W=innerWidth;return [...document.querySelectorAll('.sheet *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>W+1||r.left<-1);}).length}")
            ok(wide == 0, nm + ': nothing wider than the screen (' + str(wide) + ')')
            small = await pg.evaluate("()=>[...document.querySelectorAll('.sndlab button')].filter(e=>e.getBoundingClientRect().height<43.5).length")
            ok(small == 0, nm + ': every button at least 44 px tall')
            await pg.screenshot(path=OUT + 'lab_' + nm + '_top.png')
            if nm != 'desktop':
                stop0 = await pg.evaluate("()=>{const r=document.querySelector('[data-act=sndstop]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}")
                ok(stop0, nm + ': Stop is on screen before any scroll (pinned to the bottom)')
                ctx = pg.context; cdp = await ctx.new_cdp_session(pg)
                sx, sy = w / 2, h * 0.7
                for _ in range(8):
                    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': sx, 'y': sy}]})
                    for k in range(1, 13):
                        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': sx, 'y': sy - k * 30}]}); await pg.wait_for_timeout(12)
                    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(150)
                vis = await pg.evaluate("()=>{const b=[...document.querySelectorAll('.sndlab [data-act=sndsup]')].pop(),r=b.getBoundingClientRect(),s=document.querySelector('[data-act=sndstop]').getBoundingClientRect();return r.top>=0&&r.bottom<=s.top+1&&s.bottom<=innerHeight;}")
                ok(vis, nm + ': a finger swipe reaches the last super button, clear of the pinned Stop')
                await pg.screenshot(path=OUT + 'lab_' + nm + '_bottom.png')
            else:
                await pg.evaluate("()=>document.querySelector('[data-act=sndstop]').scrollIntoView()")
                await pg.screenshot(path=OUT + 'lab_desktop_bottom.png')
        # every button plays (desktop size, mouse)
        made0 = await pg.evaluate("()=>LW.stats().made")
        btns = await pg.evaluate("()=>[...document.querySelectorAll('[data-act=sndshot],[data-act=sndburst],[data-act=sndsup]')].map(e=>e.dataset.act+'|'+e.dataset.arg)")
        for bt in btns:
            act, arg = bt.split('|')
            await pg.evaluate("([a,g])=>document.querySelector('[data-act=\"'+a+'\"][data-arg=\"'+g+'\"]').scrollIntoView({block:'center'})", [act, arg])
            await pg.click('[data-act="%s"][data-arg="%s"]' % (act, arg))
            dt = await pg.evaluate("(k)=>(WEAPONS[LW.archOf(k)]||WEAPONS.pulse).shot", arg.split(':')[0])
            await pg.wait_for_timeout(2400 if act == 'sndsup' else int(8 * dt * 1000) + 300 if act == 'sndburst' else 150)
        made1 = await pg.evaluate("()=>LW.stats().made")
        ok(made1['shot'] - made0['shot'] >= 10 * 9 * 0.8 and made1['sup'] - made0['sup'] >= 30 * 4 * 0.9, 'every sound test button plays ' + json.dumps([made0, made1]))
        await pg.click('[data-act=sndstop]'); await pg.wait_for_timeout(100)
        ok(await pg.evaluate("()=>LW.stats().charging===0"), 'Stop leaves nothing charging')
        ok(not errs, 'no page errors: ' + json.dumps(errs[:5]))
        await b.close()
    print('RESULT', 'PASS' if not fails else 'FAIL (%d)' % len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
