# Batch 12 test: the match ticket. A dropped ticket request is retried, so the match still counts; a server that
# refuses gives its real reason on the results screen instead of "no connection"; no ticket at all still says so.
import os, asyncio, sys, json, random
RUN=random.randint(100,899)*1000
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    async with async_playwright() as p:
        U={'id':RUN+921,'username':'ticketer'}
        b,pg,errs=await open_game(p,390,740,user=U,eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}");await pg.wait_for_timeout(800)
        mode={'fail':0,'seen':0}
        async def tick(r):
            mode['seen']+=1
            if mode['fail']>0:
                mode['fail']-=1;return await r.abort()
            if mode.get('refuse'):return await r.fulfill(status=400,content_type='application/json',body=json.dumps({'error':'mode'}))
            return await r.fallback()
        await pg.route('**/api/match/start',tick)
        # 1) the first two requests drop: the retry gets the ticket
        mode.update(fail=2,seen=0)
        await pg.evaluate("()=>{save.gtype='royale';save.mode='1v1';save.map='longshot';store();prepareMatch();}")
        await pg.wait_for_timeout(4500)
        r=await pg.evaluate("()=>({tok:!!(mTicket&&mTicket.tok),err:mTicket&&mTicket.err})")
        check(r['tok'] and mode['seen']==3,'dropped ticket requests are retried: ticket after '+str(mode['seen'])+' tries '+json.dumps(r))
        # 2) the server refuses: the reason, not "no connection"
        mode.update(fail=0,seen=0,refuse=True)
        await pg.evaluate("()=>{clearInterval(vsTimer);closeAll();state='menu';prepareMatch();}")
        await pg.wait_for_timeout(1500)
        r=await pg.evaluate("()=>({tok:!!(mTicket&&mTicket.tok),err:mTicket&&mTicket.err,why:MATCH_WHY[mTicket&&mTicket.err]})")
        check(not r['tok'] and r['err']=='mode' and mode['seen']==1 and 'mode' in (r['why'] or ''),'a refusal is not retried and keeps its reason '+json.dumps(r))
        # 3) no answer at all for the whole window: still "no connection", and it gives up in time
        mode.update(fail=99,seen=0,refuse=False)
        await pg.evaluate("()=>{clearInterval(vsTimer);closeAll();state='menu';prepareMatch();window.__tdone=0;mTicket.p.then(()=>window.__tdone=Date.now());window.__t0=Date.now();}")
        await pg.wait_for_timeout(9000)
        r=await pg.evaluate("()=>({err:mTicket&&mTicket.err,done:window.__tdone?window.__tdone-window.__t0:0})")
        check(r['err']=='offline' and 0<r['done']<8000 and mode['seen']>=3,'no answer: retried, then gives up as no connection '+json.dumps(r)+' tries '+str(mode['seen']))
        check(not errs,'no page errors '+json.dumps(errs[:3]))
        await b.close()
    print('\nFAILS:',len(fails));[print(' -',f) for f in fails]
    sys.exit(1 if fails else 0)
asyncio.run(main())
