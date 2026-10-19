# Batch 6 test: salvage ladder, crate rolls, tune-up, Lunar Pass, paints, featured mode, terms check,
# and the three new modes (Crystal Rush, Bounty, Last Standing) with their menus, results and quest hooks
import os, asyncio, sys, json, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b6/';os.makedirs(OUT,exist_ok=True)
BOT="if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}"
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        if not c: fails.append(msg)
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,390,740,scale=1,user={'id':990601,'username':'pilotb6','first_name':'T'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=12;store();closeAll();window.syncPlayer=()=>{};window.__onME=onMatchEnd;window.__onMS=onMatchStart;window.onMatchEnd=()=>{};window.onMatchStart=()=>{};}")
        fm=await pg.evaluate("()=>featuredMode()")
        print('featured today:',fm)

        # 1) salvage ladder: every salvaged item is weaker than every crate item
        r=await pg.evaluate("""()=>{
         save.pts=1e9;const lo={1:9,2:9},hi={1:0,2:0};
         for(let i=0;i<300;i++)for(const ri of [1,2]){const k=WORDER[i%3];save.salv={};const x=buySalvage('weapon',ri);const v=salvOf(x.item.k,ri);lo[ri]=Math.min(lo[ri],v);hi[ri]=Math.max(hi[ri],v);}
         let cmin=9,cmax=0;
         for(let i=0;i<200;i++){save.wOwn={pulse:[0],twin:[],siege:[]};save.roll={};const o=doOpenBox('weapon',0);const v=rollOf(o.item.k,0);cmin=Math.min(cmin,v);cmax=Math.max(cmax,v);}
         return {lo,hi,cmin,cmax,price:SALV_PTS};}""")
        print('salvage ladder',r)
        check(r['lo']['1']>=1.01 and r['hi']['1']<=1.03,'salvaged rare out of range '+json.dumps(r))
        check(r['lo']['2']>=1.031 and r['hi']['2']<=1.044,'salvaged epic out of range '+json.dumps(r))
        check(r['cmin']>=1.05 and r['cmax']<=1.10,'crate roll out of 105-110% '+json.dumps(r))
        check(r['hi']['2']<r['cmin'],'a salvaged epic beat a common crate item')
        check(r['price']==[0,10000,20000],'salvage prices '+str(r['price']))
        # paid gear wins equipBest over salvage of a higher rarity
        r=await pg.evaluate("""()=>{save.wOwn={pulse:[0],twin:[0],siege:[]};save.roll={'twin:0':1.05};save.salv={'twin:2':1.044};equipBest(true,'twin');return [save.wTier.twin,!!save.wSal.twin,getW('twin').mult];}""")
        check(r[0]==0 and r[1]==False,'equipBest picked salvage over a crate item '+str(r))

        # 2) tune-up: crate items only, costs, keeps the better roll
        r=await pg.evaluate("""()=>{
         save.wOwn={pulse:[0],twin:[0,1],siege:[]};save.roll={'twin:1':1.06};save.pts=100000;
         const starter=tuneItem(true,'pulse',0);const p0=save.pts;const a=tuneItem(true,'twin',1);const spent=p0-save.pts;
         save.roll['twin:1']=1.10;const capped=tuneItem(true,'twin',1);
         return {starter,spent,better:a&&a.roll>=a.old?a.better:null,kept:rollOf('twin',1),capped,costs:TUNE_PTS};}""")
        print('tune-up',r)
        check(r['starter'] is None,'starter gear could be tuned')
        check(r['spent']==10000,'rare tune-up cost '+str(r['spent']))
        check(r['capped'] is None,'tune-up allowed at the 110% cap')
        check(r['costs']==[3000,10000,30000],'tune-up prices '+str(r['costs']))

        # 3) Lunar Pass: XP per match, free claims, premium locked until bought, season rollover
        r=await pg.evaluate("""()=>{
         save.pass=null;const P=passState();P.xp=0;
         save.gtype='arena';save.mode='2v2';save.map='classic';
         prepareMatch();startMatch();units.filter(u=>u.team===1).forEach(u=>u.hp=0);update(1/30);const xpWin=passState().xp;
         prepareMatch();startMatch();me.hp=0;units.filter(u=>u.team===0).forEach(u=>u.hp=0);update(1/30);const xpLoss=passState().xp-xpWin;
         P.xp=PASS_XP*3;const pts0=save.pts;const c1=claimPass('f',1);const again=claimPass('f',1);const prem=claimPass('p',1);const future=claimPass('f',4);
         grantPurchase({kind:'pass'});const prem2=claimPass('p',1);
         const s1=seasonNo();save.pass.s=s1-1;const fresh=passState();
         return {xpWin,xpLoss,c1:c1&&c1.pts,again,prem,future,premOk:!!(prem2&&prem2.reveal),paint:save.paints.eclipse,freshXp:fresh.xp,freshPrem:fresh.prem,tierXp:PASS_XP};}""")
        print('pass',r)
        check(r['xpWin']==40 and r['xpLoss']==20,'pass XP per match '+json.dumps(r))
        check(r['c1']==150 and r['again'] is None and r['future'] is None,'free pass claims wrong '+json.dumps(r))
        check(r['prem'] is None and r['premOk'] and r['paint']==1,'premium track gating wrong '+json.dumps(r))
        check(r['freshXp']==0 and r['freshPrem']==False,'new season did not reset the pass')

        # 4) paints: purchase grants and equips, menus show them; terms check before the first purchase
        r=await pg.evaluate("""()=>{grantPurchase({kind:'paint',id:'gold'});const a=[save.paints.gold,save.paint];closeAll();
         save.termsOk=0;save.payCur='stars';pay(2.4,{kind:'paint',id:'nebula'});const shown=!!document.querySelector('[data-act=termsok]');return {a,shown};}""")
        check(r['a']==[1,'gold'],'paint purchase not granted '+str(r))
        check(r['shown'],'terms check did not show before the first purchase')
        await pg.wait_for_timeout(300);await pg.screenshot(path=OUT+'terms.png')
        await pg.click('[data-act=termsok]');await pg.wait_for_timeout(300)
        ok=await pg.evaluate("()=>!!save.termsOk&&!document.querySelector('[data-act=termsok]')")
        check(ok,'agreeing to the terms did not stick')
        await pg.evaluate("()=>{closeAll();setTab('shop')}");await pg.wait_for_timeout(400)
        n=await pg.evaluate("()=>document.querySelectorAll('#s-shop .paint').length")
        check(n==6,'shop paints shown: '+str(n))
        has=await pg.evaluate("()=>!!document.querySelector('#s-shop .passbuy')===!passState().prem")
        check(has,'pass card visibility wrong in the shop')
        await pg.evaluate("()=>{setTab('garage');}");await pg.wait_for_timeout(300)
        await pg.click('[data-act=paints]');await pg.wait_for_timeout(400)
        n=await pg.evaluate("()=>document.querySelectorAll('.sheet .paint').length")
        check(n==11,'paint picker count '+str(n))   # 10 paints + Founder (shown while the Founder pack is on sale)
        await pg.screenshot(path=OUT+'paints.png')
        await pg.click('.sheet .paint[data-arg=stock]');await pg.wait_for_timeout(200)
        check(await pg.evaluate("()=>save.paint==='stock'"),'equipping an owned paint failed')

        # 5) setup sheet: 6 game types, featured badge, Last Standing has no team size
        await pg.evaluate("()=>{closeAll();setTab('play');openSetup()}");await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>({n:document.querySelectorAll('.sheet [data-act=gtype]').length,feat:(document.querySelector('.sheet .mode .feat')||{}).parentElement?document.querySelector('.sheet .mode .feat').parentElement.dataset.arg:null})")
        check(r['n']==6 and r['feat']==fm,'setup sheet modes '+json.dumps(r))
        await pg.click('.sheet [data-act=gtype][data-arg=royale]');await pg.wait_for_timeout(250)
        solo=await pg.evaluate("()=>!!document.querySelector('.sheet .seg button.solo')&&!document.querySelector('.sheet [data-act=mode]')")
        check(solo,'Last Standing still shows team sizes')
        await pg.screenshot(path=OUT+'setup_royale.png')

        # 6) the three new modes, fast-forwarded with the AI driving you
        RUN="""(c)=>{closeAll();save.gtype=c.g;save.mode=c.m;save.map=c.map;save.dailyPts=0;store();prepareMatch();startMatch();"""+BOT+"""
         let t=0;while(state==='play'&&t<400){if(me.hp>0)botAI(1/30,me);update(1/30);t+=1/30;}
         return {t:Math.round(t),state,won:lastResult.won,drawn:lastResult.drawn,place:lastResult.place,score:lastResult.score,base:lastResult.base,modeX:lastResult.modeX,pts:lastResult.pts,feat:lastResult.featured};}"""
        for g,m,mp in [('crystal','2v2','overpass'),('crystal','3v3','classic'),('bounty','1v1','longshot'),('bounty','3v3','craters'),('royale','1v1','overpass'),('royale','1v1','classic')]:
            r=await pg.evaluate(RUN,{'g':g,'m':m,'map':mp})
            print(g,m,mp,r)
            check(r['state']=='over','%s did not finish'%g)
            if g=='crystal':
                check(r['modeX']=={'2v2':2.4,'3v3':2.1}[m] and r['feat']==(fm=='crystal'),'crystal pay multipliers '+json.dumps(r))
                check(r['t']<=181,'crystal ran past its time limit '+str(r['t']))
            if g=='bounty':
                check(r['t']>=119,'bounty ended early '+str(r['t']))
                check(sum(r['score'])>=4,'bounty: too few kills '+str(r['score']))
            if g=='royale':
                check(1<=r['place']<=6 and r['base']==[260,200,140,100,60,30][r['place']-1],'royale place pay '+json.dumps(r))

        # featured mode pays x1.25 on top of everything else
        r=await pg.evaluate("""(fm)=>{save.streak=0;save.gtype=fm;save.mode='2v2';save.map='classic';prepareMatch();startMatch();
         if(cry){me.cry=CRY_GOAL;crystalTick(1/30);cry.cd.t=0.001;}else if(storm)units.slice(1).forEach(u=>u.hp=0);else timeLeft=0;if(gzones)gscore=[50,0];if(matchG==='bounty')gscore=[3,0];update(1/30);
         return {feat:lastResult.featured,x:lastResult.featX,base:lastResult.base,pts:lastResult.pts,lm:lastResult.leagueMult,sb:lastResult.streakBonus};}""",fm)
        print('featured',r)
        check(r['feat']==True and r['x']==1.25 and r['pts']==int(r['base']*1.25*r['lm']+0.5)+r['sb'],'featured bonus wrong '+json.dumps(r))
        # crystal mechanics: carriers drop everything; countdown wins
        r=await pg.evaluate("""()=>{save.gtype='crystal';save.mode='2v2';save.map='classic';prepareMatch();startMatch();
         const u=units[1];u.cry=4;takeHit(u,1e6,units[2]);const dropped=cry.loose.length,cleared=u.cry;
         units[0].cry=10;crystalTick(1/30);const cdTeam=cry.cd&&cry.cd.team;cry.cd.t=0.001;update(1/30);
         return {dropped,cleared,cdTeam,won:lastResult.won,cryStat:lastResult.stats.cry};}""")
        print('crystal rules',r)
        check(r['dropped']==4 and r['cleared']==0,'crystals not dropped on death '+json.dumps(r))
        check(r['cdTeam']==0 and r['won']==True,'crystal countdown win '+json.dumps(r))
        # bounty: stars and bounty growth
        r=await pg.evaluate("""()=>{save.gtype='bounty';save.mode='2v2';save.map='classic';prepareMatch();startMatch();
         const v=units.find(u=>u.team===1);v.bty=5;takeHit(v,1e6,me);const a=[gscore[0],me.bty,v.bty,mstat.stars];
         me.bty=7;const v2=units.filter(u=>u.team===1)[1];takeHit(v2,1e6,me);return {a,cap:me.bty,score:gscore[0]};}""")
        print('bounty rules',r)
        check(r['a']==[5,3,2,5],'bounty kill accounting '+json.dumps(r))
        check(r['cap']==7 and r['score']==7,'bounty cap '+json.dumps(r))
        # Last Standing: storm hurts outside the ring, placement when you go down
        r=await pg.evaluate("""()=>{save.gtype='royale';save.map='craters';prepareMatch();startMatch();
         elapsed=95;stormTick(0.01);const R0=storm.r;const u=units[2];u.x=storm.x+storm.r+3;u.y=storm.y;u.x=Math.min(W-1,u.x);const h0=u.hp;for(let i=0;i<60;i++)stormTick(1/30);const lost=h0-u.hp;
         units[3].hp=0;units[4].hp=0;me.hp=0;update(1/30);return {R0,lost:Math.round(lost),place:lastResult.place,n:units.length,mhp:u.mhp};}""")
        print('royale rules',r)
        check(abs(r['R0']-2.5)<0.01,'final ring size '+str(r['R0']))
        check(abs(r['lost']-r['mhp']*0.08)<r['mhp']*0.03,'storm damage per second off '+json.dumps(r))
        check(r['n']==6 and r['place']==4,'royale placement '+json.dumps(r))

        # 7) quest hooks: the new daily quests count the new stats
        r=await pg.evaluate("""()=>{dailyQuests();save.dq.ids=['cry10','bnt5','top3'];save.dq.p={};
         dqProgress({crystals:4,stars:3,top3:1});return save.dq.p;}""")
        check(r=={'cry10':4,'bnt5':3,'top3':1},'quest hooks '+json.dumps(r))

        # 8) live screens: VS with 6 tanks, HUD, results for each mode
        await pg.wait_for_timeout(1300)   # let the result timers from the fast matches above run out first
        await pg.evaluate("()=>{window.onMatchEnd=window.__onME;window.onMatchStart=window.__onMS;}")
        for g,m,mp,end in [('royale','1v1','longshot',"units.slice(1).forEach(u=>u.hp=0)"),('crystal','3v3','overpass',"me.hp=me.mhp;me.cry=CRY_GOAL;crystalTick(1/30);cry.cd.t=0.001"),('bounty','2v2','classic',"timeLeft=0")]:
            await pg.evaluate("(c)=>{closeAll();exitBattle();state='menu';save.gtype=c[0];save.mode=c[1];save.map=c[2];store();beginMatch();}",[g,m,mp]);await pg.wait_for_timeout(500)
            if g=='royale':
                nv=await pg.evaluate("()=>document.querySelectorAll('.vs .unit').length")
                check(nv==6,'VS shows %d tanks in Last Standing'%nv)
            await pg.screenshot(path=OUT+'vs_'+g+'.png')
            await pg.evaluate("()=>vsGo()")
            await pg.evaluate("()=>{"+BOT+"for(let i=0;i<30*20&&state==='play';i++){me.hp=me.mhp;botAI(1/30,me);update(1/30);}}");await pg.wait_for_timeout(200)
            await pg.screenshot(path=OUT+'hud_'+g+'.png')
            await pg.evaluate("()=>{"+end+";update(1/30);}");await pg.wait_for_timeout(1400)
            sub=await pg.evaluate("()=>{const e=[...document.querySelectorAll('.res .sub')].pop();return e?e.textContent:''}")
            print('results:',sub)
            want={'royale':'Last Standing, 1st of 6','crystal':'Crystal Rush 3v3','bounty':'Bounty 2v2'}[g]
            check(want in sub,'results subtitle for %s: %s'%(g,sub))
            await pg.screenshot(path=OUT+'results_'+g+'.png')
        # 9) pull a sheet down to close it; scrolling, small or upward moves never close it
        SW='''(c)=>new Promise(res=>{closeAll();setTab('play');eval(c.open);setTimeout(()=>{
         const box=[...document.querySelectorAll('.sheet,.modal')].pop();if(c.scroll)box.scrollTop=c.scroll;
         const r=box.getBoundingClientRect(),x=r.left+r.width/2,y0=r.top+(c.y0||120);
         const T=y=>new Touch({identifier:1,target:box,clientX:x,clientY:y});
         const fire=(type,y)=>box.dispatchEvent(new TouchEvent(type,{cancelable:true,bubbles:true,touches:type==='touchend'?[]:[T(y)],targetTouches:type==='touchend'?[]:[T(y)],changedTouches:[T(y)]}));
         fire('touchstart',y0);let i=0;const steps=10;
         const step=()=>{i++;fire('touchmove',y0+c.dy*i/steps);if(i<steps)setTimeout(step,c.slow?60:16);else{fire('touchend',y0+c.dy);setTimeout(()=>res(!box.classList.contains('show')),350);}};
         setTimeout(step,16);},450);})'''
        for name,cfg,want in [('pull down closes',{'open':"openSetup()",'dy':180},True),
                              ('scrolled page does not close',{'open':"openPass()",'scroll':400,'dy':180},False),
                              ('small slow pull does not close',{'open':"openSetup()",'dy':60,'slow':True},False),
                              ('upward scroll does not close',{'open':"openSetup()",'dy':-150},False),
                              ('grab bar closes a scrolled sheet',{'open':"openPass()",'scroll':400,'dy':200,'y0':12},True),
                              ('popup closes too',{'open':"askTerms(()=>{})",'dy':200,'y0':40},True)]:
            closed=await pg.evaluate(SW,cfg)
            print('swipe:',name,closed)
            check(closed==want,'swipe-to-close: '+name)
        print('fails:',fails,'errors:',errs[:6])
        await b.close()
    print('RESULT','PASS' if not fails and not errs else 'FAIL')
asyncio.run(main())
