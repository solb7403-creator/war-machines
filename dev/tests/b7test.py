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

        # 1) Untouchable: win without dropping below 20% health. 75% lost counts, 85% lost doesn't
        async def clean_run(lost):
            return await pg.evaluate("""(lost)=>{save.q.q_clean=undefined;save.gtype='arena';save.mode='2v2';save.map='classic';prepareMatch();startMatch();
             takeHit(me,me.mhp*lost,units[2],null,0,false,true,0);me.hp=me.mhp;
             units.filter(u=>u.team!==me.team).forEach(u=>u.hp=0);update(1/30);
             return {won:lastResult.won,low:mstat.low,done:!!(save.q.q_clean&&save.q.q_clean.done)};}""",lost)
        r=await clean_run(0.75);print('untouchable 75% lost',r)
        check(r['won'] and abs(r['low']-0.25)<0.01 and r['done'],'Untouchable should count at 25% health '+json.dumps(r))
        r=await clean_run(0.85);print('untouchable 85% lost',r)
        check(r['won'] and not r['done'],'Untouchable counted at 15% health '+json.dumps(r))
        r=await pg.evaluate("()=>QUESTS.find(q=>q.id==='q_clean')")
        check('20%' in r['d'] and r['pts']==250,'Untouchable text/reward '+json.dumps(r))

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
        r=await pg.evaluate("()=>{save.wk=null;const w=weeklyQuests();return {ids:w.map(q=>q.id),n:new Set(w.map(q=>q.id)).size,pool:WQ_POOL.length};}")
        check(len(r['ids'])==5 and r['ids'][0]=='wdays' and r['n']==5 and r['pool']>=14,'weekly pick '+json.dumps(r))

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
        check(r['c1']==130 and r['c2']==156,'boosted quest points '+json.dumps(r))
        check(r['c4']==round(280*1.3)+round(250*1.3),'all-4 bonus on the last claim '+json.dumps(r))

        # 6) weekly quest claim and the 20-daily chest
        r=await pg.evaluate("""()=>{save.login={last:dayNum(),n:1};save.wk={w:weekNum(),ids:['wdays','wmodes','wrow5','wkill50','wbox30'],p:{wdays:5},u:{},c:{}};
         const xp0=passState().xp;const a=claimWeeklyQuest('wdays'),b=claimWeeklyQuest('wdays'),c=claimWeeklyQuest('wmodes');const xp=passState().xp-xp0;
         save.wq={w:weekNum(),n:19,claimed:false};const no=claimWeekly();save.wq.n=20;const yes=claimWeekly();
         return {a,b,c,xp,no:no===null,yes:yes&&yes.pts,gem:yes&&yes.reveal&&yes.reveal.tk};}""")
        print('weekly',r)
        check(r['a']==1500 and r['b']==0 and r['c']==0 and r['xp']==150,'weekly quest claim '+json.dumps(r))
        check(r['no'] and r['yes']==2000 and r['gem']=='gem','weekly chest at 20 '+json.dumps(r))

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

        # 8) daily deal: 30% off today's crate in TON and Stars, full price elsewhere; shop card and crate sheet
        r=await pg.evaluate("""()=>{const D=dealOn(dayNum()),o=['weapon','chassis','gem'].find(k=>k!==D.tk);save.buys={};
         return {D,t:boxPrice(D.tk,D.ri),s:boxStars(D.tk,D.ri),tf:boxPrice(D.tk,D.ri,true),sf:boxStars(D.tk,D.ri,true),ot:boxPrice(o,D.ri),os:boxStars(o,D.ri)};}""")
        print('deal',r)
        base=[4,8,23][r['D']['ri']];st=[250,500,1500][r['D']['ri']]
        check(abs(r['t']-round(base*0.7,2))<1e-6 and r['s']==round(st*0.7) and r['tf']==base and r['sf']==st,'deal prices '+json.dumps(r))
        check(r['ot']==base and r['os']==st,'deal leaked to another crate '+json.dumps(r))
        await pg.evaluate("()=>{save.payCur='stars';store();setTab('shop');}");await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>{const d=document.querySelector('.deal');return d?{txt:d.innerText,arg:d.dataset.arg,dealf:document.querySelectorAll('.crate .dealf').length}:null}")
        print('deal card',r)
        check(r and '30% off' in r['txt'] and r['dealf']==1,'deal card '+json.dumps(r))
        await pg.screenshot(path=OUT+'shop.png')
        await pg.click('.deal');await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>{const n=document.querySelector('.dealnote');const b=[...document.querySelectorAll('[data-act=buybox]')].map(x=>x.innerText);return {note:n&&n.innerText,b}}")
        print('deal sheet',r)
        check(r['note'] and 'Normally' in r['note'] and any(str(round(st*0.7)) in x.replace(',','') for x in r['b']),'deal sheet '+json.dumps(r))
        await pg.screenshot(path=OUT+'deal_sheet.png')
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
        r=await pg.evaluate("()=>{save.dq.c={};save.dq.p={};save.wk.p={};save.dealSeen=0;save.featSeen=dayNum();save.gtype=featuredMode();save.pass.xp=0;const n=playNudge();return n&&n.act;}")
        check(r=='deal','deal nudge '+str(r))
        await b.close()
    print('fails:',fails,'errors:',errs)
    print('RESULT','PASS' if not fails and not errs else 'FAIL')
asyncio.run(main())
