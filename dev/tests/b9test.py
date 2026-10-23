# Batch 9 test: build budget (14 levels, reset build for half back), Survival (megatank), ghosts (offline pilots'
# tanks in AI seats, the owner's report), Last Standing pay, and the channel quest's "join first" message.
import os, asyncio, sys, json, time, random
RUN=random.randint(100,899)*1000   # fresh pilots every run (the dev server keeps its database)
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b9/';os.makedirs(OUT,exist_ok=True)
BOT="if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}"
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    dump=lambda:dev('/__dump')
    async with async_playwright() as p:
        # ---------- Telegram (server economy): build budget and reset ----------
        U={'id':RUN+901,'username':'builder','first_name':'Bea'};pid='tg_'+str(RUN+901)
        b,pg,errs=await open_game(p,390,740,user=U,eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}")
        dev('/__set',{'path':'eco/'+pid+'/pts','value':120000});dev('/__set',{'path':'eco/'+pid+'/earned','value':120000})
        await pg.evaluate("()=>doSync(false)");await pg.wait_for_timeout(700)
        await pg.evaluate("()=>setTab('garage')");await pg.wait_for_timeout(300)
        r=await pg.evaluate("()=>({aside:[...document.querySelectorAll('#s-garage h3.sec')].map(h=>h.textContent).join('|'),pips:document.querySelectorAll('.bar14 i').length,pts:save.pts})")
        check('Build' in r['aside'] and '0 of 14 levels' in r['aside'] and r['pips']==14 and r['pts']==120000,'garage shows the build budget '+json.dumps(r))
        for k,n in [('hull',4),('cannon',4),('engine',4),('target',2)]:
            for i in range(n):
                await pg.evaluate("(k)=>ACT.up(k)",k);await pg.wait_for_timeout(260)
        await pg.wait_for_timeout(500)
        pw14=await pg.evaluate("()=>calcPower()")
        r=await pg.evaluate("()=>({up:save.up,pts:save.pts,full:[...document.querySelectorAll('#s-garage .ups .mut')].map(e=>e.textContent),aside:[...document.querySelectorAll('#s-garage h3.sec')].map(h=>h.textContent).join('|')})")
        check(sum(r['up'].values())==14 and r['pts']==120000-62500 and '14 of 14 levels' in r['aside'] and 'Budget full' in r['full'],'14 levels bought, the rest say Budget full '+json.dumps(r))
        await pg.screenshot(path=OUT+'garage_full.png',full_page=True)
        await pg.evaluate("()=>ACT.up('reactor')");await pg.wait_for_timeout(500)
        r=await pg.evaluate("()=>({re:save.up.reactor,pts:save.pts})");e=dump()['eco'][pid]
        check(r['re']==0 and e['up']['reactor']==0 and e['pts']==120000-62500,'15th level refused (phone and server) '+json.dumps(r))
        await pg.evaluate("()=>ACT.respec()");await pg.wait_for_timeout(300)
        txt=await pg.evaluate("()=>{const o=findOv('respec');return o?o.box.textContent:''}")
        check('31,250' in txt and 'Reset your build' in txt,'reset build asks first, shows the refund: '+txt[:140])
        await pg.screenshot(path=OUT+'respec_confirm.png')
        await pg.evaluate("()=>ACT.respecok()");await pg.wait_for_timeout(900)
        r=await pg.evaluate("()=>({up:save.up,pts:save.pts,earned:save.earned,pw:calcPower()})");e=dump()['eco'][pid]
        check(sum(r['up'].values())==0 and r['pts']==120000-62500+31250 and e['pts']==r['pts'] and r['earned']==120000 and r['pw']<pw14,'reset: all levels back to 0, half the points back, rank untouched, power down '+json.dumps(r))
        r=await pg.evaluate("()=>{let m=null;const st=window.showToast;window.showToast=x=>m=x;ecoErr({err:'join'});window.showToast=st;return m;}")
        check(r=='Join the channel first, then claim.','channel quest: join-first message')
        await b.close()

        # ---------- ghosts: an offline pilot's tank fills an AI seat; the owner gets the report ----------
        V={'id':RUN+902,'username':'visitor','first_name':'Vic'};vid='tg_'+str(RUN+902)
        b,pg,errs2=await open_game(p,390,740,user=V,eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}")
        pw=dump()['players'][vid]['power']
        Lg=await pg.evaluate("()=>{const L=JSON.parse(JSON.stringify(STOCK_L));L.up.hull=3;L.up.cannon=2;L.paint='ember';L.c={c:'titan',t:0,q:1,s:false};return L;}")
        dev('/__set',{'path':'gh','value':None})   # only this run's ghost in the pool
        dev('/__set',{'path':'gh/tg_'+str(RUN+903)+'','value':{'n':'Sleepy','L':Lg,'pw':pw,'t':int(time.time()*1000)-30*60000}})
        await pg.evaluate("()=>{window.__ms=onMatchStart;save.gtype='arena';save.mode='2v2';save.map='classic';prepareMatch();showVS();}")
        await pg.wait_for_timeout(1500)
        r=await pg.evaluate("()=>({names:units.map(u=>u.name),gh:units.filter(u=>u.gh).map(u=>({n:u.name,team:u.team,cls:u.cls,paint:u.paint,mhp:u.mhp})),vs:(findOv('vs')||{box:{textContent:''}}).box.textContent})")
        check(len(r['gh'])==1 and r['gh'][0]['n']=='Ghost of Sleepy' and r['gh'][0]['team']==1 and r['gh'][0]['cls']=='titan' and 'Ghost of Sleepy' in r['vs'],'VS screen: a ghost takes an enemy AI seat, labeled '+json.dumps(r)[:300])
        await pg.screenshot(path=OUT+'vs_ghost.png')
        await pg.evaluate("()=>vsGo()");await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT+'match_ghost.png')
        await pg.evaluate("()=>{me.mhp=me.hp=1e6;}")
        await pg.wait_for_timeout(10500)
        await pg.evaluate("()=>{units.filter(u=>u.team!==me.team).forEach(u=>u.hp=0);update(1/30);}")
        await pg.wait_for_timeout(2500)
        L=await pg.evaluate("()=>({won:lastResult.won,pts:lastResult.pts,awarded:lastResult.awarded,note:lastResult.note})")
        want=await pg.evaluate("()=>Math.round(winBase('arena','2v2'))+streakPts('arena','2v2',1)")
        d=dump();gr=(d.get('ghr') or {}).get('tg_'+str(RUN+903))
        check(L['won'] and L['awarded']==want,'beating a ghost pays the normal AI rate '+json.dumps(L))
        check(gr and gr.get('m')==1 and gr.get('l')==1 and not (d.get('eco') or {}).get('tg_'+str(RUN+903)),'ghost owner gets a report and no points '+json.dumps(gr))
        mine=(d.get('gh') or {}).get(vid)
        check(not mine and d['eco'][vid]['mp']<3,'a brand-new pilot (under 3 matches) is not in the ghost pool yet')
        await b.close()
        G={'id':RUN+903,'username':'sleepy','first_name':'Sleepy'}
        b,pg,errs3=await open_game(p,390,740,user=G,eco='server')
        await pg.wait_for_timeout(2600)
        txt=await pg.evaluate("()=>{const o=findOv('ghost');return o?o.box.textContent:''}")
        check('Your ghost fought while you were away' in txt and 'Ghost matches pay no points' in txt,'owner sees the offline report: '+txt[:200])
        await pg.screenshot(path=OUT+'ghost_report.png')
        await pg.evaluate("()=>doSync(false)");await pg.wait_for_timeout(800)
        check(not (dump().get('ghr') or {}).get('tg_'+str(RUN+903)),'report cleared after it was shown')
        await b.close()

        # ---------- Survival (local economy) ----------
        b,pg,errs4=await open_game(p,390,740,scale=1,user={'id':RUN+904,'username':'boss','first_name':'B'})
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=12;store();closeAll();setTab('play');openSetup();}");await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>[...document.querySelectorAll('.sheet [data-act=gtype]')].map(e=>e.dataset.arg)")
        check(r==['arena','zone','crystal','bounty','royale','boss','random'],'setup sheet: Survival sits with the other modes '+json.dumps(r))
        await pg.click('.sheet [data-act=gtype][data-arg=boss]');await pg.wait_for_timeout(250)
        await pg.screenshot(path=OUT+'setup_survival.png')
        await pg.evaluate("()=>{closeAll();window.syncPlayer=()=>{};save.gtype='boss';save.mode='2v2';save.map='classic';prepareMatch();showVS();}");await pg.wait_for_timeout(500)
        r=await pg.evaluate("()=>({n:units.length,boss:units.filter(u=>u.boss).length,allies:units.filter(u=>u.team===0).length,vs:findOv('vs').box.textContent})")
        check(r['n']==3 and r['boss']==1 and r['allies']==2 and 'Megatank' in r['vs'] and 'Boss' in r['vs'],'Survival 2v2: you, a wingman and the megatank '+json.dumps(r)[:200])
        await pg.screenshot(path=OUT+'vs_survival.png')
        await pg.evaluate("()=>vsGo()")
        await pg.evaluate("()=>{"+BOT+"let t=0;while(state==='play'&&t<14){if(me.hp>0)botAI(1/30,me);update(1/30);t+=1/30;}boss.bt.bar=0;for(let i=0;i<8;i++)update(1/30);}")
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'survival_fight.png')
        r=await pg.evaluate("()=>({warns:warns.length,hud:true,bossHp:boss.hp,mhp:boss.mhp,state})")
        check(r['state']=='play' and r['warns']>=1 and r['bossHp']<r['mhp'],'megatank shells the team, takes damage '+json.dumps(r))
        await pg.evaluate("()=>{units.forEach(u=>{if(u.team===0)u.hp=u.mhp;});timeLeft=0;update(1/30);}")
        await pg.wait_for_timeout(2500)
        r=await pg.evaluate("()=>({won:lastResult.won,drawn:lastResult.drawn,title:(findOv('res')||{box:{textContent:''}}).box.textContent.slice(0,60),base:lastResult.base})")
        check(not r['won'] and r['drawn'] and r['title'].startswith('Survived') and 'Survival 2v2' in r['title'] and r['base']==round(100*2.4),'clock runs out with the team alive: Survived (draw pay) '+json.dumps(r))
        await pg.screenshot(path=OUT+'survival_result.png')
        # a full bot-driven Survival, solo
        r=await pg.evaluate("()=>{closeAll();save.gtype='boss';save.mode='1v1';prepareMatch();startMatch();"+BOT+"let t=0;while(state==='play'&&t<200){if(me.hp>0)botAI(1/30,me);update(1/30);t+=1/30;}return {t:Math.round(t),state,won:lastResult.won,drawn:lastResult.drawn,base:lastResult.base,score:lastResult.score};}")
        check(r['state']=='over' and r['base'] in (375,180,90),'solo Survival plays to an end '+json.dumps(r))
        # Last Standing pays the most for a win
        r=await pg.evaluate("()=>({ls:winBase('royale','1v1'),best:Math.max(...GT_ORDER.filter(g=>g!=='royale').flatMap(g=>Object.keys(MODES).map(m=>winBase(g,m))))})")
        check(r['ls']>r['best'],'Last Standing pays the most for a win '+json.dumps(r))
        await b.close()
        allerr=errs+errs2+errs3+errs4
        check(not allerr,'no page errors '+json.dumps(allerr[:3]))
    print('fails:',fails)
    print('RESULT','PASS' if not fails else 'FAIL')
asyncio.run(main())
