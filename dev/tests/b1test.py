import os, asyncio, json, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
from playwright.async_api import async_playwright
async def main():
    harness.start_dev()
    async with async_playwright() as p:
        b,pg,errs=await harness.open_game(p,start_param='ref_555123',scale=2,color_scheme='light')
        await pg.wait_for_timeout(1000)
        d=harness.dev('/__dump')
        print('boot record:',json.dumps(d.get('players',{}).get('tg_777001')))
        r=await pg.evaluate("()=>{awardPts(500);return save.earned}")
        await pg.wait_for_timeout(2500)
        d=harness.dev('/__dump');rec=d['players']['tg_777001']
        print('after award: pts',rec['pts'],'days',rec['days'],'ref',rec.get('ref'),'name',rec['name'])
        # play a full 1v1 match with the player driven by AI
        res=await pg.evaluate("""()=>{save.gtype='arena';save.mode='1v1';save.map='classic';newMatch();
          me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;
          let t=0;while(state==='play'&&t<200){if(me.hp>0)botAI(1/30,me);update(1/30);t+=1/30;}
          return {state,pts:lastResult.pts,awarded:lastResult.awarded,mp:save.mp,won:lastResult.won}}""")
        print('match:',res)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b1_over.png')
        # match screen in LIGHT phone mode: timer must be visible; HP bars on tanks
        await pg.evaluate("""()=>{save.gtype='arena';save.mode='3v3';save.map='overpass';newMatch();for(let i=0;i<30*14;i++)update(1/30);}""")
        await pg.wait_for_timeout(250)
        await pg.screenshot(path=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b1_match.png')
        await pg.evaluate("()=>{exitBattle();setTab('play')}")
        await pg.wait_for_timeout(9000)   # let the batched sync go out
        d=harness.dev('/__dump');print('server pts now',d['players']['tg_777001']['pts'],'local earned',await pg.evaluate('save.earned'))
        # leaderboard
        harness.dev('/__set',{'path':'players/tg_1001','value':{'pts':90000,'name':'RivalOne','days':4,'league':'ACE','ref':'tg_777001','ld':20743}})
        harness.dev('/__set',{'path':'players/tg_1002','value':{'pts':12000,'name':'RivalTwo','days':2,'league':'PILOT','ld':20740}})
        harness.dev('/__cron')
        lb=harness.dev('/__dump')['lb'];print('lb top:',lb['top'][:3])
        await pg.evaluate("()=>{lbCacheT=0;loadLB();squadT=0;loadSquad();exitBattle();setTab('ranks')}")
        await pg.wait_for_timeout(800)
        print('client lb:',await pg.evaluate("()=>lbCache&&lbCache.map(x=>[x.n,x.pts])"),'squad:',await pg.evaluate("()=>squadCache&&squadCache.map(x=>[x.n,x.pts,x.days])"))
        await pg.screenshot(path=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b1_ranks.png')
        await pg.evaluate("()=>{setTab('quests')}");await pg.wait_for_timeout(300)
        print('squad pending:',await pg.evaluate('refPending()'))
        # Stars recovery: a paid purchase the game never delivered
        harness.dev('/__set',{'path':'starsPaid/tg_777001/ch_1','value':{'k':'box','t':'gem','r':1,'g':8,'stars':500,'n':'abc12345','ts':1792280000000}})
        shards0=await pg.evaluate("()=>Object.values(save.gemShards).reduce((a,b)=>a+b,0)+Object.values(save.gemLvl).reduce((a,b)=>a+b,0)*100")
        await pg.evaluate("()=>doSync(true)");await pg.wait_for_timeout(800)
        shards1=await pg.evaluate("()=>Object.values(save.gemShards).reduce((a,b)=>a+b,0)+Object.values(save.gemLvl).reduce((a,b)=>a+b,0)*100")
        print('stars recovered:',shards1>shards0,'done:',await pg.evaluate('save.starsDone'))
        await pg.evaluate("()=>{closeAll();revealQ=[];doSync(true)}");await pg.wait_for_timeout(800)
        d=harness.dev('/__dump');print('acked:',d.get('starsAck'))
        shards2=await pg.evaluate("()=>Object.values(save.gemShards).reduce((a,b)=>a+b,0)+Object.values(save.gemLvl).reduce((a,b)=>a+b,0)*100")
        print('no double grant:',shards2==shards1)
        print('errors',errs)
        await b.close()
asyncio.run(main())
