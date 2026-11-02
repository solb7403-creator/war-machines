# Owner-only Epic gem caches in the admin sheet (Shop title tapped 5 times): the owner's account (Telegram admin linked
# to ln_6392735208728) sees "Open Epic gem cache (owner)", picks 1/5/10, gets the normal gem cache reveal for each, and
# the garage shows the server's core levels. Nobody else ever sees the button (other players, the admin username on
# another Telegram id), and a call they force is refused by the server.
import os, asyncio, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/owner/';os.makedirs(OUT,exist_ok=True)
OWNER='ln_6392735208728'
BTN='Open Epic gem cache (owner)'
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    dev('/__set',{'path':'cfg/admin/lunarbattle','value':999})
    dev('/__set',{'path':'telegramLinks/999','value':OWNER})
    dev('/__set',{'path':'lunarAccounts/'+OWNER,'value':{'id':OWNER,'type':'password','name':'Lunar','telegramId':999}})
    eco=lambda pid:(dev('/__dump').get('eco') or {}).get(pid) or {}
    sheet="()=>document.querySelector('.sheet')?document.querySelector('.sheet').textContent:''"
    async with async_playwright() as p:
        # 1) the owner, in Telegram: tap the Shop title 5 times
        b,pg,errs=await open_game(p,390,740,user={'id':999,'username':'LunarBattle'},eco='server')
        await pg.evaluate("()=>{save.welcomed=true;store();closeAll();}");await pg.wait_for_timeout(1200)
        r=await pg.evaluate("()=>({pk:playerKey(),own:isOwnerUI()})")
        check(r['pk']==OWNER and r['own'],'owner Telegram session is the linked account '+json.dumps(r))
        await pg.evaluate("()=>setTab('shop')");await pg.wait_for_timeout(300)
        for _ in range(5): await pg.click('#s-shop h2.title[data-act="devtap"]');await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(1200)
        txt=await pg.evaluate(sheet)
        check(BTN in txt and 'Owner test tools' in txt,'owner sees the button in the admin sheet')
        await pg.screenshot(path=OUT+'owner_sheet.png')
        lv0=eco(OWNER).get('gemLvl');sh0=eco(OWNER).get('gemShards');buys0=eco(OWNER).get('buys');sg0=eco(OWNER).get('spendGram');rev0=eco(OWNER).get('rev')
        await pg.click('.sheet button[data-act="ownergemn"][data-arg="5"]');await pg.wait_for_timeout(200)
        txt=await pg.evaluate(sheet);check(BTN+' ×5' in txt,'count picker: 5 selected')
        await pg.click('.sheet button[data-act="ownergem"]');await pg.wait_for_timeout(1500)
        e=eco(OWNER)
        check(e.get('grants',{}).get('owner_gem',{}).get('n')==5 and e.get('rev')==rev0+1,'server opened 5 in one write '+json.dumps(e.get('grants')))
        check(e.get('buys')==buys0 and e.get('spendGram')==sg0,'no buys or spend counted')
        seen=[]
        for i in range(5):
            t=await pg.evaluate("()=>{const x=document.querySelector('.reveal .ttl');return x?x.textContent:''}")
            seen.append(t)
            if i==0: await pg.wait_for_timeout(700);await pg.screenshot(path=OUT+'owner_reveal.png')
            await pg.click('.reveal button[data-act="revealok"]');await pg.wait_for_timeout(450)
        check(all('shard' in s for s in seen),'a gem cache reveal for each of the 5 '+json.dumps(seen))
        r=await pg.evaluate("()=>({gl:save.gemLvl,gs:save.gemShards})")
        check(r['gl']==e['gemLvl'] and r['gs']==e['gemShards'] and (r['gl']!=lv0 or r['gs']!=sh0),'the phone shows the server core levels '+json.dumps(r['gl']))
        await pg.evaluate("()=>{closeAll();setTab('garage');}");await pg.wait_for_timeout(600)
        print('errors',errs);check(not errs,'no page errors (owner) '+json.dumps(errs))
        await b.close()
        # 2) the admin username on another Telegram id (IS_DEV, admin sheet opens): no owner tools; a forced call is refused
        b,pg,errs=await open_game(p,390,740,user={'id':1000,'username':'LunarBattle'},eco='server')
        await pg.evaluate("()=>{save.welcomed=true;store();closeAll();openAdmin();}");await pg.wait_for_timeout(1200)
        txt=await pg.evaluate(sheet)
        check('Admin' in txt and BTN not in txt and 'Owner test tools' not in txt,'admin username on another id: sheet without the owner button')
        st=await pg.evaluate("()=>api('/api/admin',{a:'owner_gem_epic',n:10}).then(()=>'ok',e=>String(e.message))")
        check(st!='ok','forced call refused: '+st)
        await b.close()
        # 3) an ordinary player: the Shop title does nothing, and even a forced openAdmin() has no owner button
        b,pg,errs=await open_game(p,390,740,user={'id':4242,'username':'someone'},eco='server')
        await pg.evaluate("()=>{save.welcomed=true;store();closeAll();setTab('shop');}");await pg.wait_for_timeout(300)
        for _ in range(5): await pg.click('#s-shop h2.title[data-act="devtap"]');await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(500)
        txt=await pg.evaluate(sheet);check(BTN not in txt,'ordinary player: 5 taps open nothing')
        await pg.evaluate("()=>openAdmin()");await pg.wait_for_timeout(500)
        txt=await pg.evaluate("()=>document.body.textContent")
        check(BTN not in txt and not await pg.evaluate("()=>isOwnerUI()"),'ordinary player: no owner button anywhere')
        st=await pg.evaluate("()=>api('/api/owner',{a:'owner_gem_epic'}).then(()=>'ok',e=>String(e.message))")
        check(st!='ok','forced /api/owner refused: '+st)
        check(eco(OWNER).get('grants',{}).get('owner_gem',{}).get('n')==5,'owner record untouched by the others')
        await b.close()
    print('fails:',fails)
    print('RESULT','PASS' if not fails else 'FAIL')
    sys.exit(1 if fails else 0)
asyncio.run(main())
