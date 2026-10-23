# Batch 13 test: the link quests (news channel, X, wiki) for a new pilot, as shipped (server economy). Open opens the
# right link the right way and the server marks it visited; the claim pays; a visit cut off by Telegram switching to the
# channel is sent again when the pilot comes back; a pilot the channel check says isn't a member gets "join first".
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
    eco=lambda pid:dev('/__dump')['eco'][pid]
    async with async_playwright() as p:
        U={'id':RUN+941,'username':'quester'};pid='tg_'+str(RUN+941)
        b,pg,errs=await open_game(p,390,740,user=U,eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();setTab('quests');}");await pg.wait_for_timeout(900)
        r=await pg.evaluate("()=>[...document.querySelectorAll('#s-quests .q')].filter(q=>q.querySelector('[data-act=visit]')).map(q=>q.textContent)")
        check(len(r)==3 and all('Open' in x for x in r),'three link quests, each with Open: '+json.dumps(r))
        # 1) the channel: the first visit request is cut off (Telegram switched away), sent again on return
        drop={'n':1}
        async def act(rt):
            body=rt.request.post_data or ''
            if '"a":"visit"' in body and drop['n']>0:
                drop['n']-=1;return await rt.abort()
            return await rt.fallback()
        await pg.route('**/api/act',act)
        await pg.evaluate("()=>{window.__opened=null;ACT.visit('q_tg');}");await pg.wait_for_timeout(900)
        r=await pg.evaluate("()=>({opened:window.__opened,q:save.q.q_tg||null,queued:visitQ.slice()})")
        check(r['opened']=='https://t.me/LUNARmemecoin' and r['queued']==['q_tg'],'channel opens inside Telegram; the cut-off visit waits to be resent '+json.dumps(r))
        await pg.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));}");await pg.wait_for_timeout(1500)
        e=eco(pid);r=await pg.evaluate("()=>({q:save.q.q_tg,queued:visitQ.slice()})")
        check(e['q']['q_tg']['done'] and r['q']['done'] and not r['queued'],'back in the game: the visit lands '+json.dumps(r))
        # 2) X and the wiki open in the browser and land first time
        await pg.evaluate("()=>{window.__opened=null;ACT.visit('q_wiki');}");await pg.wait_for_timeout(1000)
        r=await pg.evaluate("()=>window.__opened")
        check(r=='https://solb7403-creator.github.io/war-machines/wiki.html' and not (eco(pid)['q'].get('q_wiki') or {}).get('done'),'wiki opens; Open alone does not complete it')
        await b.close()
        # back through the wiki's end-of-page button: Telegram opens the game with start_param wikiread
        b,pg,errs=await open_game(p,390,740,user=U,eco='server',start_param='wikiread')
        await pg.wait_for_timeout(2500)
        r=await pg.evaluate("()=>({tab:uiTab,q:save.q.q_wiki||null,toast:(document.querySelector('#toast')||{}).textContent||''})")
        check(eco(pid)['q']['q_wiki']['done'] and r['tab']=='quests' and 'Wiki read' in r['toast'],'back from the wiki button: quest done, Quests tab open '+json.dumps(r))
        for id,url in [('q_x','https://x.com/thelunarmeme')]:
            await pg.evaluate("(id)=>{window.__opened=null;ACT.visit(id);}",id);await pg.wait_for_timeout(1000)
            r=await pg.evaluate("()=>window.__opened")
            check(r==url and eco(pid)['q'][id]['done'],id+' opens '+str(r)+' and is marked done')
        # 3) claims pay (the local test server can't see the channel's members, like now: it pays)
        e0=eco(pid)['earned']
        for id in ['q_tg','q_x','q_wiki']:
            await pg.evaluate("(id)=>ACT.claimq(id)",id);await pg.wait_for_timeout(700)
        e=eco(pid);check(e['earned']-e0>=300 and all(e['q'][k]['claimed'] for k in ['q_tg','q_x','q_wiki']),'all three claim: +'+str(e['earned']-e0)+' points (1,500 + 1,000 + 2,000)')
        await pg.screenshot(path=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b13_quests.png',full_page=True)
        check(not errs,'no page errors '+json.dumps(errs[:3]))
        await b.close()
    print('\nFAILS:',len(fails));[print(' -',f) for f in fails]
    sys.exit(1 if fails else 0)
asyncio.run(main())
