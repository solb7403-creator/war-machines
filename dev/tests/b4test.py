# Batch 4 test: sound engine, drag-to-aim supers, dash, bot dodges, kill feed, damage vignette, reminders
import math
import os, asyncio, sys, json, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b4/';os.makedirs(OUT,exist_ok=True)
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        if not c: fails.append(msg)
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,390,740,scale=2,user={'id':990401,'username':'pilotb4','first_name':'T'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=12;store();closeAll();}")
        # count sounds played
        await pg.evaluate("()=>{window.__snd={};const o=window.sfx;window.sfx=function(n){__snd[n]=(__snd[n]||0)+1;return o(n);};}")
        await pg.mouse.click(10,300)   # a tap unlocks audio
        await pg.wait_for_timeout(200)
        ac=await pg.evaluate("()=>AC?AC.state:'none'")
        print('audio context:',ac)
        # 1) daily claim asks about reminders once; accepting registers with the server
        await pg.click('.nudge');await pg.wait_for_timeout(1000)
        has=await pg.evaluate("()=>!!document.querySelector('[data-act=remindyes]')")
        check(has,'reminder prompt missing after first daily claim')
        await pg.screenshot(path=OUT+'remind_prompt.png')
        if has:
            await pg.click('[data-act=remindyes]');await pg.wait_for_timeout(1200)
            ntf=dev('/__dump').get('ntf',{}).get('tg_990401')
            check(bool(ntf and ntf.get('on')==1),'server did not record the reminder opt-in: '+json.dumps(ntf))
        # 2) a 1v1 Arena round: dash, drag-to-aim super, kill feed, hurt vignette
        await pg.evaluate("()=>{window.LUNAR_NO_CAM_INTRO=1;save.gtype='arena';save.mode='1v1';save.map='craters';store();prepareMatch();startMatch();for(let i=0;i<30;i++)update(1/30);}")   # no opening crane shot: this test aims while the camera stands still
        await pg.wait_for_timeout(200)
        D=await pg.evaluate("()=>dashBtn()")
        await pg.mouse.click(D['x'],D['y']);await pg.wait_for_timeout(50)
        d=await pg.evaluate("()=>({dash:!!me.dash||me.dashCd>3.5,cd:me.dashCd})")
        check(d['dash'],'dash did not fire '+json.dumps(d))
        await pg.evaluate("()=>{me.sp=SUPER_MAX;}")
        B=await pg.evaluate("()=>btn()")
        # the super goes where the line from your tank to your finger points, on the ground: the finger is dragged to where a
        # ground point 2.5 east and 3.5 north of the tank is drawn (through the chase camera, or the fixed view's tilt), so the
        # shot must leave at exactly that bearing
        await pg.wait_for_timeout(500)
        F=await pg.evaluate("()=>{drawBattle();WP(me.x+2.5,me.y-3.5,hOf(me));return [WPx,WPy];}")
        await pg.mouse.move(B['x'],B['y']);await pg.mouse.down();await pg.mouse.move(F[0],F[1],steps=6);await pg.wait_for_timeout(120)
        await pg.screenshot(path=OUT+'aim_preview.png')
        exp=math.atan2(-3.5,2.5)
        await pg.mouse.up();await pg.wait_for_timeout(50)
        # ...and, measured the other way round with the camera as it stands at the release: the shot's own line on the ground, drawn
        # on the screen, passes under the finger (the tank and the view may have moved a little since the finger was placed)
        sp=await pg.evaluate("(f)=>{if(!me.sup)return null;const a=me.sup.ang,h=hOf(me);WP(me.x,me.y,h);const ax=WPx,ay=WPy;WP(me.x+Math.cos(a)*4,me.y+Math.sin(a)*4,h);const bx=WPx-ax,by=WPy-ay,fx=f[0]-ax,fy=f[1]-ay,l=Math.hypot(bx,by)||1;return {fixed:!!me.sup.fixed,ang:a,off:Math.abs(bx*fy-by*fx)/l,along:(bx*fx+by*fy)/l};}",F)
        check(sp and sp['fixed'] and abs(sp['ang']-exp)<0.12 and sp['off']<6 and sp['along']>24,'drag-aimed super wrong '+json.dumps(sp)+' expected '+str(exp))
        # tap = auto aim
        await pg.evaluate("()=>{for(let i=0;i<30;i++)update(1/30);me.sp=SUPER_MAX;me.sup=null;}")
        await pg.mouse.click(B['x'],B['y']);await pg.wait_for_timeout(50)
        sp2=await pg.evaluate("()=>me.sup?{fixed:!!me.sup.fixed}:'none'")
        print('tap super:',sp2)
        # hurt vignette + kill feed
        await pg.evaluate("()=>{takeHit(me,me.mhp*0.75,units[1]);units[1].hp=1;takeHit(units[1],50,me);}")
        await pg.wait_for_timeout(80);await pg.screenshot(path=OUT+'hurt_feed.png')
        fd=await pg.evaluate("()=>feed.map(f=>f.txt)")
        check(any('You destroyed' in t for t in fd),'kill feed missing: '+str(fd))
        # 3) bots dash out of telegraphed supers about half the time
        rate=await pg.evaluate("""()=>{let n=0,dodged=0;
          for(let k=0;k<60;k++){exitBattle();save.mode='1v1';save.map='craters';prepareMatch();startMatch();
            const bot=units[1];bot.x=10;bot.y=10;me.x=10;me.y=20;me.sp=SUPER_MAX;useSuper(me,-Math.PI/2);
            for(let i=0;i<6;i++)update(1/30);n++;if(bot.dash||bot.dashCd>0)dodged++;}
          return dodged/n;}""")
        print('bot dodge rate:',rate)
        check(0.25<rate<0.8,'bot dodge rate off: '+str(rate))
        snd=await pg.evaluate("()=>__snd")
        print('sounds:',snd)
        check(snd.get('dash',0)>=1 and snd.get('super',0)>=1,'sounds not triggered '+json.dumps(snd))
        # 4) settings: sound + reminder toggles
        await pg.evaluate("()=>{exitBattle();setTab('play');}")
        await pg.click('#btnSettings');await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT+'settings.png')
        await pg.click('[data-act=sound]');await pg.wait_for_timeout(100)
        so=await pg.evaluate("()=>save.sound")
        check(so==False,'sound toggle failed')
        print('fails:',fails,'errors:',errs[:6])
        await b.close()
    print('RESULT','PASS' if not fails and not errs else 'FAIL')
asyncio.run(main())
