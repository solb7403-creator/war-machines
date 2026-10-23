# Batch 7 test: Untouchable (health floor), 4 daily quests with swaps, weekly quests, the login-streak quest bonus,
# the weekly chest, and the daily shop deal (prices, card, crate sheet)
import os, asyncio, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b7/';os.makedirs(OUT,exist_ok=True)
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        if not c: fails.append(msg)
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,390,740,scale=1,user={'id':990701,'username':'pilotb7','first_name':'Q'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=12;store();closeAll();window.syncPlayer=()=>{};window.__onME=onMatchEnd;window.onMatchEnd=()=>{};}")

        # 1) Untouchable: win without dropping below 75% health. 20% lost counts, 30% lost doesn't
        async def clean_run(lost):
            return await pg.evaluate("""(lost)=>{save.q.q_clean=undefined;save.gtype='arena';save.mode='2v2';save.map='classic';prepareMatch();startMatch();
             takeHit(me,me.mhp*lost,units[2],null,0,false,true,0);me.hp=me.mhp;
             units.filter(u=>u.team!==me.team).forEach(u=>u.hp=0);update(1/30);
             return {won:lastResult.won,low:mstat.low,done:!!(save.q.q_clean&&save.q.q_clean.done)};}""",lost)
        r=await clean_run(0.2);print('untouchable 20% lost',r)
        check(r['won'] and abs(r['low']-0.8)<0.01 and r['done'],'Untouchable should count at 80% health '+json.dumps(r))
        r=await clean_run(0.3);print('untouchable 30% lost',r)
        check(r['won'] and not r['done'],'Untouchable counted at 70% health '+json.dumps(r))
        r=await pg.evaluate("()=>QUESTS.find(q=>q.id==='q_clean')")
        check('75%' in r['d'] and r['pts']==1500,'Untouchable text/reward '+json.dumps(r))

        # 2) daily quests: 4 a day (easy, easy, medium, hard), same for the same pilot and day; old saves move over
        r=await pg.evaluate("""()=>{save.dq={d:dayNum(),ids:['win3','play5','dmg6k'],p:{win3:2},c:{},all:false};const a=dailyQuests();
         const ids=a.map(q=>q.id),lv=a.map(q=>q.lv);save.dq=null;const b=dailyQuests().map(q=>q.id);
         return {ids,lv,same:JSON.stringify(ids)===JSON.stringify(b),uniq:new Set(ids).size,pool:DQ_POOL.length,lvN:[0,1,2].map(l=>DQ_POOL.filter(q=>q.lv===l).length)};}""")
        print('dailies',r)
        check(len(r['ids'])==4 and r['lv']==[0,0,1,2] and r['same'] and r['uniq']==4,'daily quest pick '+json.dumps(r))
        check(r['pool']>=24 and min(r['lvN'])>=8,'daily pool size '+json.dumps(r))

        # 3) swaps: 1 a day, same difficulty, never a quest you already had today; the premium pass adds 1
        r=await pg.evaluate("""()=>{save.dq=null;const a=dailyQuests(),o=a[3];const s0=swapsLeft();const N=swapDaily(o.id);const s1=swapsLeft();
         const again=swapDaily(dailyQuests()[0].id);passState().prem=true;const s2=swapsLeft();const N2=swapDaily(dailyQuests()[3].id);
         const ids=dailyQuests().map(q=>q.id);passState().prem=false;
         return {s0,s1,s2,lv:N&&N.lv,newId:N&&N.id,old:o.id,blocked:again===null,back:N2&&N2.id===o.id,n:ids.length,inList:ids.includes(N2&&N2.id)};}""")
        print('swaps',r)
        check(r['s0']==1 and r['s1']==0 and r['blocked'] and r['lv']==2 and r['newId']!=r['old'],'swap rules '+json.dumps(r))
        check(r['s2']==1 and not r['back'] and r['n']==4 and r['inList'],'pass swap '+json.dumps(r))

        # 4) progress: totals, best match (mx) and distinct days/modes (weekly); a done quest can't be swapped
        r=await pg.evaluate("""()=>{save.dq={v:2,d:dayNum(),ids:['kill4','win2','kill4m','row3'],p:{},c:{},all:false,sw:0};
         dqProgress({kills:3,wins:1,streak:1});dqProgress({kills:2,wins:1,streak:2});dqProgress({kills:1,wins:0,streak:0});
         const p1={...save.dq.p};const sw=swapDaily('kill4');
         save.wk={w:weekNum(),ids:['wdays','wmodes','wrow5','wkill50','wbox30'],p:{},u:{},c:{}};
         dqProgress({day:100,winMode:'arena',streak:2,kills:4});dqProgress({day:100,winMode:'zone',streak:4,kills:1});dqProgress({day:101,winMode:'arena',streak:0,boxes:2});dqProgress({day:102,winMode:null});
         return {p1,sw,p2:save.wk.p,w:weeklyQuests().map(q=>q.id)};}""")
        print('progress',r)
        check(r['p1']=={'kill4':6,'win2':2,'kill4m':3,'row3':2},'daily progress '+json.dumps(r['p1']))
        check(r['sw'] is None,'swapped a finished quest')
        check(r['p2']=={'wdays':3,'wmodes':2,'wrow5':4,'wkill50':5,'wbox30':2},'weekly progress '+json.dumps(r['p2']))
        r=await pg.evaluate("()=>{save.wk=null;const w=weeklyQuests();return {ids:w.map(q=>q.id),n:new Set(w.map(q=>q.id)).size,pool:WQ_POOL.length,same:JSON.stringify(weeklyIds(weekNum()))===JSON.stringify(w.map(q=>q.id)),other:weeklyIds(weekNum()+1),src:weeklyIds.toString().includes('playerKey')};}")
        print('weekly pick',r)
        check(len(r['ids'])==5 and r['ids'][:2]==['wdays','wquick30'] and r['n']==5 and r['pool']>=14 and r['same'] and not r['src'],'weekly pick '+json.dumps(r))
        check(r['other'][:2]==['wdays','wquick30'] and r['other']!=r['ids'],'next week rotates '+json.dumps(r))
        r=await pg.evaluate("()=>{save.wk={w:weekNum(),ids:['wdays','wls2','wquick8','wsup25','wcap15'],p:{wquick8:8},u:{},c:{}};const w=weeklyQuests();const out={n:w.length,done:w.filter(q=>q.done).map(q=>q.id)};save.wk=null;return out;}")
        check(r=={'n':5,'done':['wquick8']},'a list started before the update still shows '+json.dumps(r))
        # multi-day weeklies: a day counts once it reaches its daily amount, once per day
        r=await pg.evaluate("""()=>{const d=dayNum();save.wk={w:weekNum(),ids:['wdays','wquick30','wls3d','wclean4d','wcap30'],p:{},u:{},c:{}};
         dqProgress({day:d-2,royaleWins:1,cleanWins:1});dqProgress({day:d-2,cleanWins:1,royaleWins:1});const a={...save.wk.p};
         dqProgress({day:d,royaleWins:1,cleanWins:1});const rows=weeklyQuests();const ls=rows.find(q=>q.id==='wls3d'),cl=rows.find(q=>q.id==='wclean4d');
         return {a,p:save.wk.p,ls:[ls.p,ls.today],cl:[cl.p,cl.today],sub:[wkSub(ls),wkSub(cl)],pts:[WQ_BY.wquick30.pts,WQ_BY.wls3d.pts,WQ_BY.wclean4d.pts]};}""")
        print('multi-day weeklies',r)
        check(r['a']=={'wdays':1,'wls3d':1,'wclean4d':1} and r['ls']==[2,1] and r['cl']==[1,1],'per-day progress '+json.dumps(r))
        check(r['sub'][0]=='2 / 3 days. Today done' and r['sub'][1]=='1 / 4 days. Today 1 / 2','per-day progress text '+json.dumps(r['sub']))
        check(r['pts']==[5000,4000,4000],'weekly rewards scaled '+json.dumps(r['pts']))

        # 5) streak bonus: +5% a streak day after the first, max +30%, only once today's reward is claimed
        r=await pg.evaluate("""()=>{const d=dayNum(),out={};
         save.login={last:d-1,n:6};out.before=questBoost();out.next=streakBoost(loginState().next);claimLogin();out.after=questBoost();
         save.login={last:d,n:1};out.d1=questBoost();save.login={last:d,n:3};out.d3=questBoost();save.login={last:d,n:20};out.d20=questBoost();
         save.login={last:d-3,n:9};out.broken=loginState().next;
         save.login={last:d,n:7};save.dailyPts=0;save.dq={v:2,d,ids:['kill4','win2','kill4m','row3'],p:{kill4:9,win2:9,kill4m:9,row3:9},c:{},all:false,sw:0};
         const pts0=save.pts;out.c1=claimDaily('kill4');out.c2=claimDaily('win2');claimDaily('kill4m');out.c4=claimDaily('row3');out.gain=save.pts-pts0;
         out.wq=save.wq.n;return out;}""")
        print('streak bonus',r)
        check(r['before']==0 and abs(r['next']-0.3)<1e-9 and abs(r['after']-0.3)<1e-9,'login unlocks the bonus '+json.dumps(r))
        check(r['d1']==0 and abs(r['d3']-0.1)<1e-9 and abs(r['d20']-0.3)<1e-9 and r['broken']==1,'bonus steps '+json.dumps(r))
        check(r['c1']==650 and r['c2']==650,'boosted quest points (500 x 1.3) '+json.dumps(r))
        check(r['c4']==round(500*1.3)+round(1000*1.3),'all-4 bonus on the last claim '+json.dumps(r))

        # 6) weekly quest claim and the 20-daily chest
        r=await pg.evaluate("""()=>{save.login={last:dayNum(),n:1};save.wk={w:weekNum(),ids:['wdays','wmodes','wrow5','wkill50','wbox30'],p:{wdays:5},u:{},c:{}};
         const xp0=passState().xp;const a=claimWeeklyQuest('wdays'),b=claimWeeklyQuest('wdays'),c=claimWeeklyQuest('wmodes');const xp=passState().xp-xp0;
         save.wq={w:weekNum(),n:19,claimed:false};const no=claimWeekly();save.wq.n=20;const yes=claimWeekly();
         return {a,b,c,xp,no:no===null,yes:yes&&yes.pts,gem:yes&&yes.reveal&&yes.reveal.tk};}""")
        print('weekly',r)
        check(r['a']==1500 and r['b']==0 and r['c']==0 and r['xp']==150,'weekly quest claim '+json.dumps(r))
        check(r['no'] and r['yes']==5000 and r['gem']=='gem','weekly chest at 20 '+json.dumps(r))

        # 7) a real match feeds the weekly list and the results screen names it
        await pg.evaluate("()=>{window.onMatchEnd=window.__onME;}")
        r=await pg.evaluate("""()=>{save.wk={w:weekNum(),ids:['wdays','wmodes','wrow5','wkill50','wbox30'],p:{wdays:4},u:{wdays:[1,2,3,4]},c:{}};
         save.gtype='arena';save.mode='2v2';prepareMatch();startMatch();units.filter(u=>u.team!==me.team).forEach(u=>u.hp=0);update(1/30);
         return {q:lastResult.quests,p:save.wk.p};}""")
        print('match feeds weeklies',r)
        check('Play on 5 different days' in r['q'] and r['p'].get('wmodes')==1,'weekly progress from a match '+json.dumps(r))
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=OUT+'results.png')
        await pg.evaluate("()=>{closeAll();exitBattle();state='menu';}")

        # 8) deals: first rare/epic gem cache of the day 30% off, one epic crate a week 25% off; Founder pack
        r=await pg.evaluate("""()=>{save.buys={};save.dealD=0;save.dealW=0;const P=(tk,ri)=>[boxPrice(tk,ri),boxStars(tk,ri),dealOf(tk,ri)];
         const a={rg:P('gem',1),eg:P('gem',2),ew:P('weapon',2),ec:P('chassis',2),rw:P('weapon',1),cg:P('gem',0)};
         grantPurchase({kind:'box',tk:'gem',ri:1,price:a.rg[0],deal:'d'});closeAll();save.buys={};
         const b={rg:P('gem',1),eg:P('gem',2),ew:P('weapon',2)};
         grantPurchase({kind:'box',tk:'weapon',ri:2,price:b.ew[0],deal:'w'});closeAll();save.buys={};
         const c={eg:P('gem',2),ec:P('chassis',2)};save.dealD=0;save.dealW=0;save.buys={};return {a,b,c};}""")
        print('deals',r)
        check(r['a']['rg']==[5.6,350,'d'] and r['a']['eg']==[16.1,1050,'d'] and r['a']['ew']==[17.25,1125,'w'] and r['a']['ec']==[17.25,1125,'w'],'deal prices '+json.dumps(r['a']))
        check(r['a']['rw']==[8,500,None] and r['a']['cg']==[4,250,None],'no deal on rare gear or common caches '+json.dumps(r['a']))
        check(r['b']['rg']==[8,500,None] and r['b']['eg']==[17.25,1125,'w'] and r['b']['ew']==[17.25,1125,'w'],'daily deal used once '+json.dumps(r['b']))
        check(r['c']['eg']==[23,1500,None] and r['c']['ec']==[23,1500,None],'weekly deal used once '+json.dumps(r['c']))
        r2=await pg.evaluate("""()=>{save.dealD=dayNum();save.dealW=weekNum();return [boxPrice('gem',2),boxStars('gem',2),dealOf('chassis',2)];}""")
        check(r2==[23,1500,None],'both deals used: full price '+json.dumps(r2))
        await pg.evaluate("()=>{save.dealD=0;save.dealW=0;save.founder=false;if(save.paints)delete save.paints.founder;save.payCur='stars';store();closeAll();setTab('shop');}");await pg.wait_for_timeout(400)
        r=await pg.evaluate("""()=>({deals:[...document.querySelectorAll('.deals .deal')].map(d=>d.innerText),dealf:document.querySelectorAll('.crate .dealf').length,
          founder:(document.querySelector('.founder')||{}).innerText||''})""")
        print('shop',r)
        check(len(r['deals'])==2 and '30% off' in r['deals'][0] and '25% off' in r['deals'][1] and r['dealf']==4,'deal cards '+json.dumps(r))
        check('Founder pack' in r['founder'] and '1,199' in r['founder'] and 'buy $LUNAR' in r['founder'],'founder card '+json.dumps(r['founder']))
        await pg.screenshot(path=OUT+'shop.png')
        await pg.click('.deal[data-arg=w]');await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>{const ov=document.querySelector('.sheet');return {n:ov.querySelectorAll('.crate').length,off:[...ov.querySelectorAll('.crate .dealf')].map(x=>x.innerText)}}")
        check(r['n']==3 and r['off']==['25% off','25% off','30% off'],'weekly deal sheet '+json.dumps(r))
        await pg.screenshot(path=OUT+'deal_sheet.png')
        await pg.evaluate("()=>{closeAll();openCrate('weapon',2);}");await pg.wait_for_timeout(300)
        r=await pg.evaluate("()=>{const n=document.querySelector('.dealnote');const b=[...document.querySelectorAll('[data-act=buybox]')].map(x=>x.innerText);return {note:n&&n.innerText,b}}")
        print('crate sheet',r)
        check(r['note']=='Weekly epic deal: 25% off. Normally 1,500 ⭐.' and r['b']==['Buy for 1,125 ⭐'],'crate sheet deal '+json.dumps(r))
        r=await pg.evaluate("""()=>{closeAll();grantPurchase({kind:'founder'});closeAll();const first={f:save.founder,p:save.paint,own:!!save.paints.founder};
         const w0=Object.keys(save.wOwn||{}).filter(k=>(save.wOwn[k]||[]).includes(2)).length;grantPurchase({kind:'founder'});closeAll();uiDirty();
         return {first,again:Object.keys(save.wOwn||{}).filter(k=>(save.wOwn[k]||[]).includes(2)).length===w0,bots:BOT_PAINTS.includes('founder'),loadout:tankOf(myLoadout(),1).paint};}""")
        await pg.wait_for_timeout(300)
        r['card']=await pg.evaluate("()=>!!document.querySelector('.founder')")
        print('founder',r)
        check(r['first']=={'f':True,'p':'founder','own':True} and r['again'] and not r['bots'] and r['loadout']=='founder' and not r['card'],'founder pack grant '+json.dumps(r))
        await pg.evaluate("()=>closeAll()")

        # 9) quests tab: 4 dailies with tags, swap button, bonus line, 5 weeklies and the chest
        await pg.evaluate("()=>{save.dq=null;save.wk=null;save.login={last:dayNum(),n:4};save.wq={w:weekNum(),n:7,claimed:false};dailyQuests();save.dq.p[save.dq.ids[0]]=1e9;store();setTab('quests');}");await pg.wait_for_timeout(400)
        r=await pg.evaluate("""()=>({lv:document.querySelectorAll('.q .lv').length,swap:document.querySelectorAll('[data-act=swapdq]').length,wq:document.querySelectorAll('[data-act=claimwq]').length,
         boost:(document.querySelector('.boost')||{}).innerText,chest:!!document.querySelector('[data-act=weekly]'),alert:questsAlert()})""")
        print('quests tab',r)
        check(r['lv']==4 and r['swap']==3 and r['wq']==5 and r['chest'] and '+15%' in r['boost'] and r['alert'],'quests tab '+json.dumps(r))
        await pg.screenshot(path=OUT+'quests.png',full_page=True)
        await pg.evaluate("()=>{const b=document.querySelector('[data-act=swapdq]');b.click();}");await pg.wait_for_timeout(300)
        r=await pg.evaluate("()=>({swap:document.querySelectorAll('[data-act=swapdq]').length,left:swapsLeft()})")
        check(r['swap']==0 and r['left']==0,'swap buttons hide when none left '+json.dumps(r))
        await pg.evaluate("()=>{const e=document.querySelector('.view')||document.scrollingElement;}")
        # play tab nudge for the deal (after login, quests and pass)
        r=await pg.evaluate("()=>{save.dq.c={};save.dq.p={};save.wk.p={};save.dealSeen=0;save.wdealSeen=0;save.featSeen=dayNum();save.gtype=featuredMode();save.pass.xp=0;const a=playNudge();save.wdealSeen=weekNum();const b=playNudge();save.dealSeen=dayNum();const c=playNudge();return [a&&a.act+':'+a.arg,b&&b.act+':'+b.arg,c&&c.act];}")
        check(r[0]=='deals:w' and r[1]=='deals:d' and r[2]!='deals','deal nudges '+str(r))
        await b.close()
    print('fails:',fails,'errors:',errs)
    print('RESULT','PASS' if not fails and not errs else 'FAIL')
asyncio.run(main())
