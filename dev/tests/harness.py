# Shared Playwright harness: real game page + local LUNAR server/database stand-in
import asyncio, json, os, subprocess, time, urllib.request, sys
DEV='http://127.0.0.1:8787'
REPO=os.environ.get('REPO',os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..'))).replace(os.sep,'/')
REPO_URL='file://'+REPO+'/'
GAME='http://127.0.0.1:8899/index.html'
os.makedirs(os.environ.get('SHOTS','/tmp/lunar-shots'),exist_ok=True)
def start_dev():
    try: urllib.request.urlopen(DEV+'/__dump',timeout=1);return None
    except Exception: pass
    p=subprocess.Popen(['node',os.path.join(os.path.dirname(os.path.abspath(__file__)),'devserver.mjs')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(50):
        try: urllib.request.urlopen(DEV+'/__dump',timeout=1);return p
        except Exception: time.sleep(0.1)
    raise RuntimeError('devserver failed')
def dev(path,data=None):
    req=urllib.request.Request(DEV+path,data=json.dumps(data).encode() if data is not None else None,method='POST' if data is not None else 'GET')
    return json.loads(urllib.request.urlopen(req).read())
def tg_mock(user,start_param=None,pvp=False,eco='local',autogfx=False):
    idata=dev('/__initdata?user='+urllib.parse.quote(json.dumps(user))+('&sp='+urllib.parse.quote(start_param) if start_param else ''))['initData']
    sp=(",start_param:"+json.dumps(start_param)) if start_param else ''
    # live matches are off unless a test asks for them (pvp=True points the game's socket at the local server)
    live="window.LUNAR_WS_BASE='ws://127.0.0.1:8787';" if pvp else "window.LUNAR_NO_PVP=1;"
    # the economy: 'local' (the phone runs the shared rules on its own save, for the rule and UI tests) or 'server'
    # (Telegram as shipped: the server owns points and gear; b8test)
    if eco!='server': live+="window.LUNAR_LOCAL_ECO=1;"
    # the test browser draws 3D in software (no GPU), so the automatic graphics step-down stays off unless a test asks for it
    if not autogfx: live+="window.LUNAR_NO_AUTOGFX=1;"
    return live+"""
window.__cs={};window.__opened=null;window.__haptic=[];
window.Telegram={WebApp:{initData:%s,initDataUnsafe:{user:%s%s},platform:'ios',version:'8.0',
 ready(){},expand(){},isVersionAtLeast(v){return true},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},
 openLink(u){window.__opened=u},openTelegramLink(u){window.__opened=u},openInvoice(l,cb){window.__invoice=[l,cb]},onEvent(){},offEvent(){},
 requestWriteAccess(cb){window.__wa=1;cb&&cb(true)},shareToStory(){},
 HapticFeedback:{impactOccurred(s){__haptic.push('i:'+s)},notificationOccurred(s){__haptic.push('n:'+s)},selectionChanged(){__haptic.push('s')}},
 CloudStorage:{setItem(k,v,cb){__cs[k]=v;cb&&cb(null,true)},getItem(k,cb){cb(null,__cs[k]||'')},getItems(ks,cb){const o={};ks.forEach(k=>o[k]=__cs[k]||'');cb(null,o)}}}};
""" % (json.dumps(idata), json.dumps(user), sp)
import urllib.parse
async def open_game(p, w=390, h=740, user=None, start_param=None, scale=1, url=GAME, color_scheme='dark', pvp=False, browser=None, eco='local', init=None, autogfx=False, override=None):
    # override: async fn(url) -> None (serve normally), 'abort', or (bytes, content type): lets a test play an old build or go offline
    user=user or {'id':777001,'username':'jaketest','first_name':'Jake'}
    b=browser or await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=scale,color_scheme=color_scheme)
    pg=await ctx.new_page()
    errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    mock=tg_mock(user,start_param,pvp,eco,autogfx)
    async def route(r):
        u=r.request.url
        if 'telegram-web-app' in u: return await r.fulfill(body=mock,content_type='application/javascript')
        if u.startswith('https://lunar-api.solb7403.workers.dev/'):
            path=u.split('workers.dev',1)[1]
            resp=await r.fetch(url=DEV+path)
            return await r.fulfill(response=resp)
        if u.startswith('https://warmachines-a6034-default-rtdb.firebaseio.com/'):
            path=u.split('firebaseio.com',1)[1].split('?')[0]
            resp=await r.fetch(url=DEV+'/db'+path)
            return await r.fulfill(response=resp)
        if override and u.startswith('http://127.0.0.1:8899/'):
            o=await override(u)
            if o=='abort': return await r.abort()
            if o: return await r.fulfill(body=o[0],content_type=o[1])
        if u.startswith('http://127.0.0.1:8899/'):
            import pathlib, mimetypes
            target=(pathlib.Path(REPO)/u.split(':8899/',1)[1].split('?',1)[0]).resolve()
            if pathlib.Path(REPO).resolve() not in target.parents or not target.is_file(): return await r.abort()
            return await r.fulfill(body=target.read_bytes(),content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
        if u.startswith('file:'): return await r.continue_()
        if 'fonts.googleapis.com' in u or 'fonts.gstatic.com' in u: return await r.abort()
        return await r.abort()
    await ctx.route('**/*',route)
    if init: await ctx.add_init_script(init)   # runs before the game's scripts (a save already on the device, say)
    await pg.goto(url)
    await pg.wait_for_timeout(1500)
    return b,pg,errs
