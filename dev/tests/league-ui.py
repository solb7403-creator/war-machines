# Leagues on screen (display only): the top-bar chip on every tab, the Ranks league card, the All leagues ladder, a league
# pill on every leaderboard row (All time, Today, This week, your pinned row), and the promoted/dropped line on results.
# Every number must equal the rules (myLeague, leagueRating, leagueInfo) and the server record. Layout at 360/390/768/1366.
#   python3 dev/tests/league-ui.py
import os, asyncio, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/league/';os.makedirs(OUT,exist_ok=True)
FAIL=[]
def t(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok: FAIL.append(msg)
# power is patched for the test only (powerOf is the rules' function): it puts the pilot in any league with the same code path
SETPW="""(a)=>{if(!window.__pw0)window.__pw0=powerOf;window.powerOf=a.pw==null?window.__pw0:(L=>a.pw);
 Object.assign(save,{lwr:a.lwr,mp:a.mp,lgi:a.lgi});store();closeAll();uiDirty();}"""
VIEW="""()=>{renderUI();const v=myLeagueView(),c=document.querySelector('#lgChip');
 return {i:v.L.i,n:v.L.n,rt:v.rt,toNext:v.toNext,aboveDrop:v.aboveDrop,form:v.form,chip:c.textContent,chipC:c.style.getPropertyValue('--lc'),
  rules:leagueIdx(leagueRating(calcPower(),save.lwr,save.mp),save.lgi)}}"""
AUDIT="""(where)=>{const out=[],W=innerWidth;if(document.documentElement.scrollWidth>W+1)out.push(where+': sideways scroll');
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
 for(const e of document.querySelectorAll('.topbar *, .screen.on *, .ovl *')){if(!vis(e))continue;const cs=getComputedStyle(e);
  if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+2&&cs.overflow!=='visible'&&cs.textOverflow!=='ellipsis')out.push(where+': clipped "'+e.textContent.trim().slice(0,24)+'"');
  const r=e.getBoundingClientRect();if(r.right>W+1&&cs.position!=='fixed')out.push(where+': off-screen '+e.className+' '+Math.round(r.right));}
 for(const s of ['.topbar button','#s-ranks .lgcard button','.sheet [data-act="leagues"]']){for(const b of document.querySelectorAll(s)){if(!vis(b))continue;const r=b.getBoundingClientRect();if(r.height<43.5||r.width<43.5)out.push(where+': small target '+(b.id||b.className)+' '+Math.round(r.width)+'x'+Math.round(r.height));}}
 const bar=document.querySelector('.topbar').getBoundingClientRect(),st=document.querySelector('#btnSettings').getBoundingClientRect(),pt=document.querySelector('.topbar .pts').getBoundingClientRect();
 if(st.right>bar.right+1||pt.left<bar.left-1)out.push(where+': top bar pushed a button off');
 return out;}"""
async def main():
    harness.start_dev()
    chrome=os.environ.get('CHROMIUM_PATH') or '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
    os.environ['CHROMIUM_PATH']=chrome
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=chrome,args=['--no-sandbox'])
        # ---- 1. the server record: the chip shows the league the server keeps (eco on the server, as in Telegram) ----
        b,pg,errs=await harness.open_game(p,390,844,user={'id':880001,'username':'lgsrv','first_name':'Lg'},eco='server',browser=browser)
        await pg.wait_for_function("()=>typeof save!=='undefined'&&save&&save.lab",timeout=20000)
        await pg.wait_for_timeout(1200)
        rec=harness.dev('/__dump').get('eco',{}).get('tg_880001',{})
        v=await pg.evaluate(VIEW)
        t(rec.get('lgi')==v['i'] and v['chip']==['Rookie','Pilot','Veteran','Ace','Elite','Master','Lunar Legend'][rec.get('lgi',0)],'chip = server record league '+json.dumps({'rec':rec.get('lgi'),'lg':rec.get('lg'),'chip':v['chip']}))
        await pg.context.close()
        # ---- 2. every league + a demotion edge, through the same code path the server rule uses ----
        b,pg,errs=await harness.open_game(p,390,844,user={'id':880002,'username':'lgloc','first_name':'Lg'},browser=browser)
        await pg.evaluate("()=>{save.welcomed=true;closeAll();}")
        LG_AT=await pg.evaluate("LG_AT")
        cases=[]
        for i in range(7):
            lo=LG_AT[i-1] if i else 0; hi=LG_AT[i] if i<6 else lo*1.1
            cases.append(('league %d'%i,{'pw':round((lo+hi)/2),'lwr':0.5,'mp':30,'lgi':i},i))   # form 0.5: rating = power
        edge=LG_AT[2]*(1-0.04)   # Ace keeps Ace down to 4% under its line
        cases.append(('demotion edge: just above the drop line',{'pw':int(edge)+1,'lwr':0.5,'mp':30,'lgi':3},3))
        cases.append(('demotion edge: just under the drop line',{'pw':int(edge),'lwr':0.5,'mp':30,'lgi':3},2))
        cases.append(('form not counted before the 10th match',{'pw':120,'lwr':1,'mp':3,'lgi':0},2))
        for name,a,want in cases:
            await pg.evaluate(SETPW,a);v=await pg.evaluate(VIEW)
            rt=a['pw']*(0.8+0.4*(0.5 if a['mp']<10 else a['lwr']))
            t(v['i']==want==v['rules'] and abs(v['rt']-rt)<1e-9 and v['chip'] in (v['n'],v['n'].split(' ')[-1]),name+' '+json.dumps(v))
            await pg.evaluate("()=>setTab('ranks')");await pg.wait_for_timeout(120)
            card=await pg.evaluate("()=>document.querySelector('#s-ranks .lgcard').textContent")
            t(v['n']+' league' in card and ('%.1f'%v['rt']) in card,name+': Ranks card names the league and rating')
            if want==3 and 'above' in name:
                t(v['aboveDrop'] is not None and 0<=v['aboveDrop']<=1 and ('%.1f'%v['aboveDrop'])+' above the drop line' in card,'card shows how far above the drop line '+str(v['aboveDrop']))
            if a['mp']<10: t('Form 50% until your 10th match' in card,'form explained before the 10th match')
        await pg.evaluate(SETPW,{'pw':110,'lwr':0.62,'mp':40,'lgi':2})
        card=await pg.evaluate("()=>{renderUI();return document.querySelector('#s-ranks .lgcard').textContent}")
        t('Form 62%: recent results' in card,'form as a plain percentage')
        # ---- 3. the ladder sheet: 7 rungs, Lunar Legend on top, You on yours, the rules' numbers ----
        await pg.evaluate("()=>document.querySelector('#s-ranks .lgcard [data-act=\"leagues\"]').click()");await pg.wait_for_timeout(250)
        lad=await pg.evaluate("""()=>[...document.querySelectorAll('.sheet .lgrung')].map(r=>({n:r.querySelector('.ln').firstChild.textContent.trim(),you:r.classList.contains('you'),x:[...r.querySelectorAll('.lgx b')].map(b=>b.textContent),s:r.querySelector('.mut').textContent}))""")
        want=await pg.evaluate("""()=>LEAGUE.map((L,i)=>({n:L.n,x:['×'+LG_BASE_PAY[i].toFixed(2),'×'+LG_MULT[i].toFixed(2),i?'+'+Math.round((LG_AI[i]-1)*100)+'%':'Base'],at:i?(Math.round(LG_AT[i-1]*10)/10).toFixed(1):null})).reverse()""")
        t(len(lad)==7 and [r['n'] for r in lad]==[w['n'] for w in want] and all(r['x']==w['x'] for r,w in zip(lad,want)),'ladder: 7 rungs top to bottom with pay, bonus, AI '+json.dumps([r['x'] for r in lad]))
        t(all((w['at'] is None) or ('From '+w['at']) in r['s'] for r,w in zip(lad,want)),'ladder: each rung starts at its line')
        t([r['n'] for r in lad if r['you']]==['Veteran'],'ladder: You on your league')
        txt=await pg.evaluate("()=>document.querySelector('.sheet').textContent")
        t('League = tank power × form' in txt and 'drop 4% below it' in txt and 'Tougher AI' in txt,'ladder: the one-line rule and the reused info text')
        # the chip and the garage ? open the same sheet
        await pg.evaluate("()=>{closeAll();setTab('play');document.querySelector('#lgChip').click()}");await pg.wait_for_timeout(200)
        t(await pg.evaluate("()=>!!findOv('leagues')"),'top-bar chip opens the ladder')
        await pg.evaluate("()=>closeAll()")
        await pg.focus('#lgChip');await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
        t(await pg.evaluate("()=>!!findOv('leagues')"),'keyboard: Enter on the chip opens the ladder')
        await pg.evaluate("()=>closeAll()")
        # ---- 4. the leaderboard: a pill on every row, in every scope, nothing for a pilot with no league ----
        day=await pg.evaluate("ecoDay()") if await pg.evaluate("typeof ecoDay==='function'") else None
        dump=harness.dev('/__dump')
        keys=['ROOKIE','PILOT','VETERAN','ACE','ELITE','MASTER','LUNAR']
        for i,k in enumerate(keys): harness.dev('/__set',{'path':'players/tg_99%02d'%i,'value':{'pts':50000-i*1000,'name':'Rival'+k.title(),'days':3,'league':k}})
        harness.dev('/__set',{'path':'players/tg_9950','value':{'pts':100,'name':'NoLeague','days':1}})
        await pg.evaluate("()=>{lbCacheT=0;loadLB(true)}");await pg.wait_for_timeout(100)
        harness.dev('/__cron');lb=harness.dev('/__dump')['lb']
        d,w=lb['d'],lb['w']
        # today's and this week's tables: one pilot inside the top read (league from the record), one outside it (the row's copy)
        harness.dev('/__set',{'path':'dly/%d'%d,'value':{'tg_9903':{'s':900,'n':'RivalAce'},'tg_9960':{'s':800,'n':'DailyOnly','l':'MASTER'},'tg_9961':{'s':700,'n':'DailyNone'}}})
        harness.dev('/__set',{'path':'wly/%d'%w,'value':{'tg_9906':{'s':900,'n':'RivalLunar'},'tg_9961':{'s':600,'n':'DailyNone','l':'nonsense'}}})
        harness.dev('/__cron');lb=harness.dev('/__dump')['lb']
        t(['tg_9903','RivalAce',900,'ACE'] in lb['daily'] and ['tg_9960','DailyOnly',800,'MASTER'] in lb['daily'] and ['tg_9961','DailyNone',700,''] in lb['daily'],'worker: daily rows carry the league key '+json.dumps(lb['daily']))
        t(['tg_9906','RivalLunar',900,'LUNAR'] in lb['weekly'] and ['tg_9961','DailyNone',600,''] in lb['weekly'],'worker: weekly rows carry the league key, unknown keys dropped')
        t(any(r[0]=='tg_9950' and r[4]=='' for r in lb['top']),'worker: a pilot with no league gets an empty key')
        await pg.evaluate(SETPW,{'pw':110,'lwr':0.5,'mp':40,'lgi':2})
        await pg.evaluate("()=>{lbCacheT=0;loadLB(true);setTab('ranks')}");await pg.wait_for_timeout(600)
        for sc in ['overall','daily','weekly']:
            await pg.evaluate("(s)=>{lbScope=s;uiDirty('ranks');renderUI()}",sc);await pg.wait_for_timeout(80)
            rows=await pg.evaluate("""()=>[...document.querySelectorAll('#s-ranks .lb .r')].map(r=>({n:r.querySelector('.nm').textContent,me:r.classList.contains('me'),pill:(r.querySelector('.lgpill')||{}).textContent||'',c:(r.querySelector('.lgpill')||{style:{getPropertyValue:()=>''}}).style.getPropertyValue('--lc')}))""")
            html=await pg.evaluate("()=>document.querySelector('#s-ranks').innerHTML")
            t('undefined' not in html and 'null' not in html,sc+': no "undefined" anywhere')
            exp={'RivalAce':'Ace','RivalLunar':'Lunar Legend','DailyOnly':'Master','DailyNone':'','NoLeague':'','RivalRookie':'Rookie','RivalElite':'Elite'}
            bad=[r for r in rows if r['n'] in exp and r['pill']!=exp[r['n']]]
            mine=[r for r in rows if r['me']]
            t(rows and not bad,sc+': every row shows its pilot\'s league '+json.dumps(bad or rows[:4]))
            t(mine and all(r['pill']=='Veteran' for r in mine),sc+': your row (or pinned row) shows your league now '+json.dumps(mine))
        await pg.evaluate("()=>{lbScope='overall';uiDirty('ranks');renderUI();document.querySelector('#s-ranks').scrollTop=0}")
        await pg.screenshot(path=OUT+'ranks-390.png',full_page=False)
        await pg.evaluate("()=>{const e=document.querySelector('#s-ranks .lb.list');e.scrollIntoView({block:'start'})}");await pg.wait_for_timeout(100)
        await pg.screenshot(path=OUT+'board-390.png')
        # ---- 5. the promotion line on results, once, and the chip follows ----
        line=LG_AT[2]   # Ace's line: a win from form 0.5 lifts the rating over it
        pw=line/(0.8+0.4*0.5)-0.4
        await pg.evaluate(SETPW,{'pw':pw,'lwr':0.5,'mp':30,'lgi':2})
        await pg.evaluate("()=>{closeAll();save.gtype='arena';save.mode='2v2';save.map='classic';store();beginMatch();vsGo();}");await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{units.filter(u=>u.team===1).forEach(u=>u.hp=0);for(let i=0;i<60;i++)update(1/30)}");await pg.wait_for_timeout(1800)
        res=await pg.evaluate("()=>{const l=document.querySelector('.res .lgchg');return {line:l&&l.textContent,lg:myLeague().n,chip:document.querySelector('#lgChip').textContent,won:lastResult&&lastResult.won,from:lastResult&&lastResult.league.n}}")
        t(res['won'] and res['line']=='Promoted to Ace' and res['lg']=='Ace' and res['chip']=='Ace','promotion line on results and the chip updates '+json.dumps(res))
        await pg.screenshot(path=OUT+'promoted-390.png')
        await pg.evaluate("()=>{exitBattle();closeAll();save.gtype='arena';save.mode='2v2';store();beginMatch();vsGo();}");await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{units.filter(u=>u.team===1).forEach(u=>u.hp=0);for(let i=0;i<60;i++)update(1/30)}");await pg.wait_for_timeout(1800)
        t(await pg.evaluate("()=>!document.querySelector('.res .lgchg')"),'the next match shows no line (once per change)')
        # a drop: a loss under the drop line
        await pg.evaluate("()=>{exitBattle();closeAll();}")
        await pg.evaluate(SETPW,{'pw':int(LG_AT[1]*(1-0.04)/(0.8+0.4*0.3))+0.3,'lwr':0.3,'mp':30,'lgi':2})
        pre=await pg.evaluate("()=>myLeague().n")
        await pg.evaluate("()=>{save.gtype='arena';save.mode='2v2';store();beginMatch();vsGo();}");await pg.wait_for_timeout(300)
        await pg.evaluate("()=>{units.filter(u=>u.team===0).forEach(u=>u.hp=0);for(let i=0;i<60;i++)update(1/30)}");await pg.wait_for_timeout(1800)
        res=await pg.evaluate("()=>{const l=document.querySelector('.res .lgchg');return {line:l&&l.textContent,lg:myLeague().n,won:lastResult&&lastResult.won}}")
        t(pre=='Veteran' and res['line']=='Dropped to Pilot' and res['lg']=='Pilot','drop line on results '+json.dumps(res))
        await pg.screenshot(path=OUT+'dropped-390.png')
        await pg.evaluate("()=>{exitBattle();closeAll();}")
        t(not errs,'no page errors '+json.dumps(errs))
        await pg.context.close()
        # ---- 6. layout: the bar, the card, the ladder and the board at every size, the longest names ----
        for (w,h,tag) in [(360,780,'360'),(390,844,'390'),(768,1024,'768'),(1366,900,'1366')]:
            b,pg,errs=await harness.open_game(p,w,h,user={'id':880100+w,'username':'lgl'+tag,'first_name':'Lg'},browser=browser)
            await pg.evaluate("()=>{save.welcomed=true;save.mp=40;save.pts=48250;save.earned=2000000;store();closeAll();}")
            for lg in [6,2]:
                await pg.evaluate(SETPW,{'pw':[0,0,110,0,0,0,240][lg],'lwr':0.5,'mp':40,'lgi':lg})
                for tab in ['play','garage','shop','quests','ranks']:
                    await pg.evaluate("(t)=>{closeAll();setTab(t)}",tab);await pg.wait_for_timeout(150)
                    chip=await pg.evaluate("()=>({t:document.querySelector('#lgChip').textContent,ico:document.querySelector('#lgChip').classList.contains('ico'),vis:document.querySelector('#lgChip').getBoundingClientRect().width>0})")
                    t(chip['vis'] and not chip['ico'] and chip['t'] in (['Lunar Legend','Legend'] if lg==6 else ['Veteran']),tag+' '+tab+': chip shows '+json.dumps(chip))
                    bad=await pg.evaluate(AUDIT,tag+' '+tab);t(not bad,tag+' '+tab+' layout '+json.dumps(bad))
                    if tab=='play' and lg==6: await pg.screenshot(path=OUT+'topbar-'+tag+'.png',clip={'x':0,'y':0,'width':w,'height':70})
                if lg==6:
                    await pg.evaluate("()=>document.querySelector('#s-ranks').scrollTop=0");await pg.screenshot(path=OUT+'card-'+tag+'.png')
                await pg.evaluate("()=>openLeagues()");await pg.wait_for_timeout(300)
                bad=await pg.evaluate(AUDIT,tag+' ladder');t(not bad,tag+' ladder layout '+json.dumps(bad))
                if lg==6: await pg.screenshot(path=OUT+'ladder-'+tag+'.png')
            # a huge point total on the narrowest phone: the league keeps its name (the tier chip gives way first)
            await pg.evaluate("()=>{closeAll();setTab('play');save.pts=9876543;uiDirty();renderUI()}");await pg.evaluate(SETPW,{'pw':110,'lwr':0.5,'mp':40,'lgi':2})
            chip=await pg.evaluate("()=>{renderUI();return {t:document.querySelector('#lgChip').textContent,ico:document.querySelector('#lgChip').classList.contains('ico')}}")
            t(chip['t']=='Veteran' and not chip['ico'],tag+' 9,876,543 points: league name still shown '+json.dumps(chip))
            bad=await pg.evaluate(AUDIT,tag+' big points');t(not bad,tag+' big points layout '+json.dumps(bad))
            t(not errs,tag+' no page errors '+json.dumps(errs))
            await pg.context.close()
        await browser.close()
    print('league-ui:',len(FAIL),'failures')
    sys.exit(1 if FAIL else 0)
asyncio.run(main())
