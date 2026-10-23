# Batch 11 test: the Hyperspace Vault. The Shop card and bundles (priced by the server), Stars deposits granted by the
# webhook, the reveal, levels and unlocks (Hyperspace paint on at level 7), the Vault sheet, badges and gold names on
# the boards, the Vault board tab, the VS badge, and the looks in battle (gold tooth, trail, aura) in 3D and in 2D.
import os, asyncio, sys, json, random
RUN=random.randint(100,899)*1000   # fresh pilots every run (the dev server keeps its database)
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b11/';os.makedirs(OUT,exist_ok=True)
READY="()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)"
BOT="if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}"
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    eco=lambda pid:dev('/__dump')['eco'][pid]
    async with async_playwright() as p:
        U={'id':RUN+911,'username':'vaulter','first_name':'Vale'};uid=RUN+911;pid='tg_'+str(uid)
        b,pg,errs=await open_game(p,390,740,user=U,eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_function(READY,timeout=20000)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;save.termsOk=Date.now();save.payCur='stars';store();closeAll();}")
        await pg.wait_for_timeout(800)
        await pg.evaluate("()=>setTab('shop')");await pg.wait_for_timeout(500)
        r=await pg.evaluate("()=>{const v=document.querySelector('#s-shop .vaultbox');return v?{packs:[...v.querySelectorAll('.vpack')].map(x=>x.textContent),txt:v.textContent,top:document.querySelector('#s-shop p.dimtxt').textContent}:null}")
        check(r and len(r['packs'])==4 and '250 ⭐' in r['packs'][0] and '28,750 Gold' in r['packs'][3] and '25,000 ⭐' in r['packs'][3] and '+15% bonus' in r['packs'][3],'Shop: the Vault card with 4 bundles '+json.dumps(r and r['packs']))
        g=await pg.evaluate("()=>(document.querySelector('#s-shop .vaultbox .vgen')||{}).textContent||''")
        check('Genesis Gold' in g and 'limited-edition Genesis rewards' in g,'Shop: Genesis Gold explained: '+g[:160])
        await pg.evaluate("()=>{save.termsOk=0;askTerms(()=>{});}");await pg.wait_for_timeout(300)
        t=await pg.evaluate("()=>findOv('terms').box.textContent")
        check(t.startswith('Before your first purchaseEvery purchase backs LUNAR directly') and '25% goes into the $LUNAR launch liquidity pool' in t and 'other 75% funds development' in t and 'no cash value' in t,'purchase notice leads with what it funds: '+t[:200])
        await pg.screenshot(path=OUT+'terms_notice.png')
        await pg.evaluate("()=>{closeAll();save.termsOk=Date.now();store();}")
        check(r and 'other 75% funds the game' in r['top'],'Shop: says where the other 75% goes: '+(r and r['top'] or ''))
        el=await pg.query_selector('#s-shop .vaultbox');await el.scroll_into_view_if_needed();await pg.wait_for_timeout(300)
        await el.screenshot(path=OUT+'shop_vault_card.png')
        # TON prices
        await pg.evaluate("()=>{save.payCur='ton';uiDirty('shop');}");await pg.wait_for_timeout(300)
        r=await pg.evaluate("()=>[...document.querySelectorAll('#s-shop .vaultbox .vpack .p')].map(x=>x.textContent)")
        check(r==['4 TON','16 TON','80 TON','400 TON'],'TON prices '+json.dumps(r))
        await pg.evaluate("()=>{save.payCur='stars';store();uiDirty('shop');}")
        async def deposit(tk,ch):
            await pg.evaluate("(tk)=>ACT.vaultbuy(tk)",tk);await pg.wait_for_timeout(900)
            inv=[c for c in dev('/__tg') if c[0]=='createInvoiceLink'][-1][1];pl=json.loads(inv['payload'])
            dev('/__webhook',{'message':{'from':{'id':uid,'username':'vaulter'},'chat':{'id':uid,'type':'private'},'successful_payment':{'total_amount':inv['prices'][0]['amount'],'telegram_payment_charge_id':ch,'invoice_payload':inv['payload']}}})
            await pg.evaluate("()=>window.__invoice[1]('paid')");await pg.wait_for_timeout(1800)
            return inv,pl
        inv,pl=await deposit('chest','b11.1')
        check(inv['prices'][0]['amount']==1000 and pl.get('k')=='vault' and pl.get('t')=='chest' and 'Hyperspace Vault: Chest' in inv['title'],'Chest invoice priced by the server '+json.dumps(pl))
        r=await pg.evaluate("()=>({vg:save.vg,rv:(document.querySelector('.reveal')||{}).textContent||''})")
        check(r['vg']==1050 and eco(pid)['vg']==1050 and '+1,050 Gold' in r['rv'] and 'Vault level 2' in r['rv'],'Chest: 1,050 Gold, reveal shows the level '+json.dumps(r))
        await pg.screenshot(path=OUT+'reveal_chest.png')
        await pg.evaluate("()=>closeAll()");await pg.wait_for_timeout(400)
        inv,pl=await deposit('hyper','b11.2')
        r=await pg.evaluate("()=>({vg:save.vg,lv:vaultLevel(save.vg),paint:save.paint,rv:(document.querySelector('.reveal')||{}).textContent||''})")
        check(inv['prices'][0]['amount']==25000 and r['vg']==29800 and r['lv']==10 and r['paint']=='hyper','Hyperspace: level 10 and the Hyperspace paint goes on '+json.dumps(r))
        check('Unlocked' in r['rv'] and 'Hyperspace paint' in r['rv'] and 'gold aura' in r['rv'],'reveal lists what unlocked: '+r['rv'][:200])
        await pg.screenshot(path=OUT+'reveal_hyper.png')
        await pg.evaluate("()=>closeAll()");await pg.wait_for_timeout(400)
        e=eco(pid);check(e['paints'].get('hyper')==1 and abs(e['spendGram']-416)<1e-6,'server: paint owned, verified spending 416 TON value')
        # the Vault sheet
        await pg.evaluate("()=>{uiDirty('shop');ACT.vault();}");await pg.wait_for_timeout(700)
        r=await pg.evaluate("()=>{const o=findOv('vault');return o?{got:o.box.querySelectorAll('.vrew.got').length,all:o.box.querySelectorAll('.vrew').length,txt:o.box.textContent}:null}")
        check(r and r['got']==5 and r['all']==8 and 'Level 10' in r['txt'] and '(yours: 29,800)' in r['txt'] and 'other 75% funds development' in r['txt'] and 'never spent' in r['txt'],'Vault sheet: 5 of 7 rewards unlocked, money and rules explained '+json.dumps(r and [r['got'],r['all']]))
        await pg.screenshot(path=OUT+'vault_sheet.png',full_page=True)
        await pg.evaluate("()=>{const o=findOv('vault');o.box.scrollTop=9999;}");await pg.wait_for_timeout(200)
        await pg.screenshot(path=OUT+'vault_sheet_end.png')
        # boards: badge, gold name, the Vault tab
        dev('/__cron');await pg.evaluate("()=>{closeAll();loadLB(true);}");await pg.wait_for_timeout(1200)
        await pg.evaluate("()=>ACT.vaultboard()");await pg.wait_for_timeout(700)
        r=await pg.evaluate("()=>{const me=document.querySelector('#s-ranks .lb .r.me');return {scope:lbScope,tabs:[...document.querySelectorAll('#s-ranks .seg button')].map(b=>b.textContent),me:me?me.innerHTML:'',rows:document.querySelectorAll('#s-ranks .lb.list .r').length}}")
        check(r['scope']=='vault' and 'Vault' in r['tabs'] and 'vb t2' in r['me'] and 'gname' in r['me'] and '29,800' in r['me'],'Vault board: you, gold badge, gold name, lifetime Gold '+json.dumps(r)[:300])
        await pg.screenshot(path=OUT+'ranks_vault.png')
        await pg.evaluate("()=>ACT.lbscope('overall')");await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>{const me=document.querySelector('#s-ranks .lb .r.me');return me?me.innerHTML:''}")
        check('vb t2' in r and 'gname' in r,'points board shows the badge and gold name too')
        await pg.screenshot(path=OUT+'ranks_overall.png')
        # VS and battle: 3D
        await pg.evaluate("()=>{closeAll();save.gtype='arena';save.mode='2v2';save.map='classic';store();prepareMatch();showVS();}");await pg.wait_for_timeout(700)
        r=await pg.evaluate("()=>{const c=document.querySelector('.vs .unit.me');return c?c.innerHTML:''}")
        check('vb t2' in r,'VS screen: your badge')
        await pg.screenshot(path=OUT+'vs.png')
        r=await pg.evaluate("()=>{clearInterval(vsTimer);closeAll();prepareMatch();startMatch();document.body.classList.add('battle');fit();"+BOT+"for(let i=0;i<120;i++){if(me.hp>0)botAI(1/60,me);update(1/60);fxTick(1/60);drawBattle();}const o=B3.units.get(me);return {vl:me.vl,tooth:!!(o&&o.tooth),aura:!!(o&&o.varc),rear:!!(o&&o.rear),key:o&&o.key}}")
        check(r['vl']==10 and r['tooth'] and r['aura'] and r['rear'],'3D battle: your tank wears the tooth, aura and trail points '+json.dumps(r))
        await pg.screenshot(path=OUT+'battle_3d.png')
        # every chassis gets a tooth that sits on its hull
        r=await pg.evaluate("""()=>{const out=[];for(const cls of Object.keys(CH))for(const ct of [0,1,2]){const sp=Object.assign(mySpec(),{cls,ct});const T=buildTank(sp,MT);out.push([cls,ct,T.tooth?Math.round(T.tooth[1]*100)/100:null]);}return out;}""")
        badt=[x for x in r if x[2] is None or x[2]<0.2 or x[2]>1.6]
        check(not badt,'a tooth on every chassis at deck height '+json.dumps(badt or r[:3]))
        # 2D
        await pg.evaluate("()=>{setGfx('2d');}");await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{prepareMatch();startMatch();document.body.classList.add('battle');fit();"+BOT+"for(let i=0;i<120;i++){if(me.hp>0)botAI(1/60,me);update(1/60);fxTick(1/60);drawBattle();}}")
        await pg.screenshot(path=OUT+'battle_2d.png')
        await pg.evaluate("()=>{setGfx('auto');}")
        # menus: the hero tank and the paint card
        await pg.evaluate("()=>{exitBattle&&state==='play'&&(state='menu');document.body.classList.remove('battle');closeAll();setTab('play');}");await pg.wait_for_timeout(900)
        await pg.screenshot(path=OUT+'play_hero.png')
        await pg.evaluate("()=>ACT.paints()");await pg.wait_for_timeout(600)
        r=await pg.evaluate("()=>{const o=findOv('paints');return o?[...o.box.querySelectorAll('.paint')].map(x=>x.textContent).filter(t=>t.includes('Hyperspace')):[]}")
        check(r and 'Equipped' in r[0],'Hyperspace paint shows in Paints, equipped '+json.dumps(r))
        await pg.screenshot(path=OUT+'paints.png')
        print('errors',errs);check(not errs,'no page errors '+json.dumps(errs[:3]))
        await b.close()
        # a pilot without the Vault: the paint is locked and says how to get it
        b,pg,errs=await open_game(p,390,740,user={'id':RUN+912,'username':'plain'},eco='server')
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}");await pg.wait_for_timeout(600)
        r=await pg.evaluate("()=>{ACT.paint('hyper');const o=findOv('vault');return {paint:save.paint,sheet:!!o,lbl:paintCard('hyper')}}")
        check(r['paint']!='hyper' and r['sheet'] and 'Vault level 7' in r['lbl'],'no Vault: the Hyperspace paint is locked and opens the Vault '+json.dumps(r)[:200])
        await pg.evaluate("()=>{closeAll();setTab('shop');}");await pg.wait_for_timeout(500)
        el=await pg.query_selector('#s-shop .vaultbox');await el.scroll_into_view_if_needed();await el.screenshot(path=OUT+'shop_vault_new.png')
        check(not errs,'no page errors (new pilot) '+json.dumps(errs[:3]))
        await b.close()
    print('\nFAILS:',len(fails));[print(' -',f) for f in fails]
    sys.exit(1 if fails else 0)
asyncio.run(main())
