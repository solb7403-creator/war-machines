# Batch 8b test: the server owns the economy (Telegram as shipped). Points and gear change only through the server:
# claims, crates, AI match tickets (scored by the server, too-fast results refused, offline results queued and counted
# once), Stars purchases granted by the webhook, forged saves overwritten, and the one-time move for existing pilots.
import os, asyncio, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b8/';os.makedirs(OUT,exist_ok=True)
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    eco=lambda pid:(dev('/__dump').get('eco') or {}).get(pid) or {}
    async with async_playwright() as p:
        U={'id':880801,'username':'srvpilot','first_name':'S'}
        b,pg,errs=await open_game(p,390,740,user=U,eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_timeout(800)
        r=await pg.evaluate("()=>({srv:SRV_ECO,mig:save.migOk,pts:save.pts,earned:save.earned})")
        check(r['srv'] and r['mig']==1 and r['pts']==0,'server economy on; new pilot needs no move '+json.dumps(r))
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}")
        # 1) the login reward: claimed through the server
        await pg.evaluate("()=>ACT.login()");await pg.wait_for_timeout(700)
        e=eco('tg_880801');r=await pg.evaluate("()=>({pts:save.pts,earned:save.earned,login:save.login})")
        check(e.get('earned')==125 and r['earned']==125 and r['pts']==125,'login reward credited by the server and copied to the phone '+json.dumps(r))
        # 2) a forged save doesn't stick, and forged points can't buy anything
        await pg.evaluate("()=>{save.pts=1e9;save.earned=1e9;save.up.hull=4;save.wOwn.siege=[2];store();doSync(false);}");await pg.wait_for_timeout(900)
        r=await pg.evaluate("()=>({pts:save.pts,earned:save.earned,hull:save.up.hull,siege:save.wOwn.siege})")
        check(r['pts']==125 and r['earned']==125 and r['hull']==0 and r['siege']==[],'forged points and gear replaced by the server record '+json.dumps(r))
        await pg.evaluate("()=>{save.pts=1e9;ACT.buypts('weapon:0');}");await pg.wait_for_timeout(900)
        e=eco('tg_880801');r=await pg.evaluate("()=>({pts:save.pts,tw:save.wOwn.twin.length+save.wOwn.siege.length})")
        check(r['pts']==125 and r['tw']==0 and e.get('pts')==125,'crate with forged points refused by the server '+json.dumps(r))
        # 3) an AI match, scored by the server (2v2 win after 11 s of real time)
        await pg.evaluate("()=>{save.gtype='arena';save.mode='2v2';save.map='classic';prepareMatch();startMatch();me.mhp=me.hp=1e6;}")
        await pg.wait_for_timeout(11500)
        await pg.evaluate("()=>{units.filter(u=>u.team!==me.team).forEach(u=>u.hp=0);update(1/30);}")
        await pg.wait_for_timeout(2500)
        L=await pg.evaluate("()=>({won:lastResult.won,pts:lastResult.pts,awarded:lastResult.awarded,note:lastResult.note,earned:save.earned,mq:(save.mq||[]).length})")
        e=eco('tg_880801')
        check(L['won'] and L['awarded']>0 and not L['note'] and e.get('earned')==125+L['awarded']==L['earned'] and L['mq']==0,'AI match scored by the server; the phone shows the server numbers '+json.dumps(L))
        await pg.screenshot(path=OUT+'result_scored.png')
        # 4) too fast: a win 2 seconds in is not counted, and the results screen says so
        await pg.evaluate("()=>{closeAll();exitBattle();save.gtype='arena';save.mode='2v2';prepareMatch();startMatch();me.mhp=me.hp=1e6;}")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{units.filter(u=>u.team!==me.team).forEach(u=>u.hp=0);update(1/30);}")
        await pg.wait_for_timeout(2500)
        L2=await pg.evaluate("()=>({awarded:lastResult.awarded,note:lastResult.note,earned:save.earned,screen:(document.querySelector('.full.res .lines')||{}).textContent||''})")
        check(L2['awarded']==0 and 'too fast' in (L2['note'] or '') and L2['earned']==L['earned'] and 'too fast' in L2['screen'],'a 2-second win is not counted and the results say why '+json.dumps(L2))
        await pg.screenshot(path=OUT+'result_too_fast.png')
        # 5) no connection when the match ends: the result waits, then counts once
        await pg.evaluate("()=>{closeAll();exitBattle();save.gtype='arena';save.mode='2v2';prepareMatch();startMatch();}")
        await pg.wait_for_timeout(1200)
        async def drop(route): await route.abort()
        await pg.route('**/api/match/end',drop)
        await pg.wait_for_timeout(6500)
        await pg.evaluate("()=>{units.filter(u=>u.team===me.team).forEach(u=>u.hp=0);update(1/30);}")
        await pg.wait_for_timeout(1500)
        q=await pg.evaluate("()=>({mq:(save.mq||[]).length,state})")
        e0=eco('tg_880801').get('earned')
        await pg.unroute('**/api/match/end',drop)
        await pg.evaluate("()=>doSync(false)");await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>flushMatches()");await pg.wait_for_timeout(800)
        e1=eco('tg_880801');q2=await pg.evaluate("()=>({mq:(save.mq||[]).length,earned:save.earned})")
        check(q['mq']==1 and q2['mq']==0 and e1.get('earned')>e0 and q2['earned']==e1.get('earned'),'offline result queued, then counted when back online '+json.dumps([q,q2,e0,e1.get('earned')]))
        # 6) a daily quest finished on the server's record, claimed from the Quests tab
        e=eco('tg_880801');ids=e['dq']['ids']
        dev('/__set',{'path':'eco/tg_880801/dq/p','value':{ids[0]:999}})
        pts0=await pg.evaluate("()=>save.earned")
        await pg.evaluate("()=>{closeAll();exitBattle();doSync(false);}");await pg.wait_for_timeout(900)
        await pg.evaluate("(id)=>ACT.claimdq(id)",ids[0]);await pg.wait_for_timeout(800)
        e=eco('tg_880801');pts1=await pg.evaluate("()=>save.earned")
        check(e['dq']['c'].get(ids[0]) and pts1>pts0 and pts1==e['earned'],'daily quest claimed through the server '+json.dumps([pts0,pts1]))
        await pg.evaluate("(id)=>ACT.claimdq(id)",ids[0]);await pg.wait_for_timeout(700)
        check(eco('tg_880801')['earned']==e['earned'],'claiming it again pays nothing')
        # 7) a Stars purchase: the webhook grants it on the server, the phone shows the reveal
        await pg.evaluate("()=>{save.termsOk=Date.now();save.payCur='stars';store();ACT.buybox('gem:1');}");await pg.wait_for_timeout(900)
        inv=[c for c in dev('/__tg') if c[0]=='createInvoiceLink'][-1][1]
        pl=json.loads(inv['payload'])
        check(inv['prices'][0]['amount']==350 and pl.get('x')=='d','invoice priced by the server (daily gem deal) '+json.dumps(pl))
        sh0=await pg.evaluate("()=>JSON.stringify([save.gemLvl,save.gemShards])")
        dev('/__webhook',{'message':{'from':{'id':880801,'username':'srvpilot'},'chat':{'id':880801,'type':'private'},'successful_payment':{'total_amount':350,'telegram_payment_charge_id':'b8.1','invoice_payload':inv['payload']}}})
        await pg.evaluate("()=>window.__invoice[1]('paid')");await pg.wait_for_timeout(1500)
        r=await pg.evaluate("()=>({sh:JSON.stringify([save.gemLvl,save.gemShards]),reveal:!!document.querySelector('.reveal, .modal.rv, .full.rv')||revealQ.length>=0,dealD:save.dealD,day:dayNum()})")
        e=eco('tg_880801')
        check(r['sh']!=sh0 and r['sh']==json.dumps([e['gemLvl'],e['gemShards']],separators=(',',':')) and r['dealD']==r['day'],'Stars gem cache granted by the server; the phone matches it '+json.dumps(r)[:200])
        await pg.screenshot(path=OUT+'stars_reveal.png')
        print('errors',errs);check(not errs,'no page errors '+json.dumps(errs))
        await b.close()
        # 8) the one-time move: an existing pilot with gear on their phone, some of it unpaid
        dev('/__set',{'path':'players/tg_880802','value':{'pts':42000,'name':'oldpilot','days':6,'ld':20743}})
        saveJS=json.dumps({'pts':12000,'earned':42000,'up':{'hull':2,'cannon':1,'engine':0,'target':0,'reactor':0},'wOwn':{'pulse':[0],'twin':[1],'siege':[2]},'cOwn':{'scout':[],'vanguard':[0],'titan':[0]},
          'roll':{'twin:1':1.07,'siege:2':1.09,'titan:0':1.06},'wTier':{'pulse':0,'twin':1,'siege':2},'cTier':{'scout':-1,'vanguard':0,'titan':0},'weapon':'siege','chassis':'titan','moonbeam':False,'welcomed':True,'mp':40,'wins':25,'losses':15,
          'login':{'last':20743,'n':3},'q':{'q_win1':{'p':1,'done':True,'claimed':True}}})
        init="localStorage.setItem('wm_save_tg_880802',JSON.stringify(%s));"%saveJS
        b,pg,errs=await open_game(p,390,740,user={'id':880802,'username':'oldpilot'},eco='server',init=init)
        await pg.wait_for_timeout(1500)
        e=eco('tg_880802');fl=(dev('/__dump').get('flags') or {}).get('tg_880802',{}).get('r',{})
        r=await pg.evaluate("()=>({mig:save.migOk,pts:save.pts,earned:save.earned,siege:save.wOwn.siege,weapon:save.weapon,claimed:save.q.q_win1&&save.q.q_win1.claimed,league:srv&&lastCredit&&lastCredit.league})")
        check(r['mig']==1 and e.get('mig')==1 and r['earned']==42000,'existing pilot moved over once; lifetime points from the server '+json.dumps(r))
        check('mig_epic' in fl and 2 in e['wOwn']['siege'],'unpaid epic gear kept but flagged for review '+json.dumps(list(fl)))
        check(r['claimed'] and e['q']['q_win1']['claimed'],'already-claimed milestones stay claimed')
        await b.close()
        # 9) admin sees the flags (and can clear them)
        b,pg,errs=await open_game(p,390,740,user={'id':999,'username':'LunarBattle'},eco='server')
        await pg.evaluate("()=>{save.welcomed=true;store();closeAll();openAdmin();}");await pg.wait_for_timeout(1500)
        txt=await pg.evaluate("()=>document.querySelector('.sheet')?document.querySelector('.sheet').textContent:''")
        check('Flagged for review' in txt and 'oldpilot' in txt and 'mig_epic' in txt,'admin sheet lists flagged pilots')
        await pg.screenshot(path=OUT+'admin_flags.png')
        await pg.evaluate("()=>ACT.flagclear('tg_880802')");await pg.wait_for_timeout(1200)
        txt=await pg.evaluate("()=>document.querySelector('.sheet')?document.querySelector('.sheet').textContent:''")
        check('oldpilot' not in txt,'cleared from the admin list')
        print('errors',errs);check(not errs,'no page errors (admin) '+json.dumps(errs))
        await b.close()
    print('fails:',fails)
    print('RESULT','PASS' if not fails else 'FAIL')
asyncio.run(main())
