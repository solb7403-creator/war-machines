# The Telegram Mini App side of call signs: a Telegram pilot without one is asked (prefilled from their Telegram name,
# never during a battle or before a brand-new pilot's first match), and a pilot who signed up on the website can
# "Log in with your call sign" inside Telegram to use the same account. Local server stand-in; no live accounts.
import os, asyncio, sys, json, hashlib, base64, time
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
import urllib.request
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/cs/';os.makedirs(OUT,exist_ok=True)
def put(path,value):
    req=urllib.request.Request('http://127.0.0.1:8787/__set',data=json.dumps({'path':path,'value':value}).encode(),method='POST')
    return urllib.request.urlopen(req).read()
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    # a website account (call sign + password), made the way the server stores it
    pid='ln_1888000111222';salt=os.urandom(16);h=hashlib.pbkdf2_hmac('sha256',b'mini moon 55',salt,100000,32)
    put('lunarAccounts/'+pid,{'id':pid,'name':'WebMini','created':int(time.time()*1000),'type':'password','source':'web','pw':{'v':1,'it':100000,'s':base64.b64encode(salt).decode(),'h':base64.b64encode(h).decode()}})
    key='WebMini'.lower().encode().hex()
    put('csk/'+key,{'p':pid,'n':'WebMini','t':int(time.time()*1000)});put('cs/'+pid,{'n':'WebMini','k':key,'t':int(time.time()*1000),'c':0})
    async with async_playwright() as p:
        # 1) a Telegram pilot: asked after the welcome, prefilled from the Telegram name
        A={'id':990001,'username':'mini_ace','first_name':'Mini'}
        b,pg,errs=await open_game(p,390,780,user=A,eco='server',cs=True)
        await pg.wait_for_timeout(2500)
        check(await pg.locator('#cs-in').count()==0,'brand-new pilot: no name form before the coached first match')
        await pg.evaluate("()=>{save.welcomed=true;save.mp=1;store();closeAll();}")
        await pg.wait_for_selector('#cs-in',timeout=12000)
        check(await pg.input_value('#cs-in')=='mini_ace','prefilled from the Telegram name')
        await pg.wait_for_function("()=>/available/.test(document.querySelector('#cs-note').textContent)",timeout=8000)
        await pg.screenshot(path=OUT+'telegram-callsign.png')
        await pg.fill('#cs-in','Mini Ace');await pg.wait_for_timeout(150)
        check('No spaces' in await pg.text_content('#cs-note'),'friendly hint for spaces')
        await pg.fill('#cs-in','WebMini');await pg.wait_for_function("()=>/taken/.test(document.querySelector('#cs-note').textContent)",timeout=8000)
        check(await pg.locator('#cs-ideas button').count()==3,'taken: three free suggestions')
        await pg.fill('#cs-in','Mini@Ace');await pg.wait_for_function("()=>/Mini@Ace is available/.test(document.querySelector('#cs-note').textContent)",timeout=8000)
        await pg.click('[data-act="cssave"]');await pg.wait_for_function("()=>tgName(TG_USER)==='Mini@Ace'",timeout=8000)
        d=dev('/__dump');check(d['cs']['tg_990001']['n']=='Mini@Ace','saved on the server exactly as typed')
        await pg.evaluate("()=>doSync(false)");await pg.wait_for_timeout(1200)
        d=dev('/__dump');check(d['eco']['tg_990001']['nm']=='Mini@Ace' and d['players']['tg_990001']['name']=='Mini@Ace','public name everywhere is the call sign')
        check(not errs,'no page errors '+json.dumps(errs))
        await b.close()
        # 2) signed up on the website: log in with the call sign inside Telegram -> the same account
        B={'id':990002,'username':'fresh_tg','first_name':'Fresh'}
        b,pg,errs=await open_game(p,390,780,user=B,eco='server',cs=True)
        await pg.wait_for_timeout(1500);await pg.evaluate("()=>{save.welcomed=true;store();closeAll();}")
        await pg.wait_for_selector('[data-act="cslogin"]',timeout=12000)
        await pg.click('[data-act="cslogin"]');await pg.wait_for_selector('#tl-cs')
        await pg.fill('#tl-cs','webmini');await pg.fill('#tl-pw','wrong pass 1');await pg.click('[data-act="tglinkgo"]')
        await pg.wait_for_function("()=>/Wrong call sign or password/.test(document.querySelector('#tl-note').textContent)",timeout=8000)
        await pg.screenshot(path=OUT+'telegram-login.png')
        await pg.fill('#tl-pw','mini moon 55');await pg.click('[data-act="tglinkgo"]')
        await pg.wait_for_timeout(2500);await pg.wait_for_function("()=>typeof save!=='undefined'&&!!save&&typeof VERIFIED_PID!=='undefined'&&VERIFIED_PID==='"+pid+"'",timeout=15000)
        check(await pg.evaluate("()=>tgName(TG_USER)")=='WebMini','after reload: the website account, same call sign')
        d=dev('/__dump');check(d['telegramLinks']['990002']==pid,'Telegram linked to the website account')
        check(not (d.get('eco') or {}).get('tg_990002'),'no second account left behind')
        check(not errs,'no page errors '+json.dumps(errs))
        await b.close()
    print('fails:',fails);print('RESULT','PASS' if not fails else 'FAIL')
asyncio.run(main())
