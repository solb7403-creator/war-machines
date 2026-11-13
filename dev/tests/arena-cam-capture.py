# Arcade chase camera sheets (Session 5E-2b2a): every map on a phone (390x844 at 3x) and a desktop (1920x1080) in real play:
# the opening crane shot, driving, a 1v1 and a 2v2 fight, a super, and on the two bridge maps the deck, a tunnel and an enemy
# under the deck. Not pass/fail: it writes the review sheets (docs/camera-5e2b2a/).
#   python3 dev/tests/arena-cam-capture.py [--out DIR] [--maps classic,overpass,...] [--devices phone,desk]
#       [--scenes intro,drive,fight1,fight2,super,deck,tunnel,under] [--quality high|low] [--reduced] [--soft] [--scale N]
#       [--legacy]   (the fixed tilted view the maps had before: window.LUNAR_CHASECAM=false)
# The test browser draws WebGL on the CPU, where the game holds resolution at 1x and uses a lighter ground bake; unless
# --soft is given this tool tells the game it has a GPU so the sheets show what a phone or a desktop draws.
import os, asyncio, sys, pathlib, argparse, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev, REPO
from playwright.async_api import async_playwright
from PIL import Image
ap=argparse.ArgumentParser();ap.add_argument('--out',default=os.environ.get('SHOTS','/tmp/lunar-shots')+'/arena-cam');ap.add_argument('--maps',default='classic,overpass,longshot,craters,canyon,bunker')
ap.add_argument('--devices',default='phone,desk');ap.add_argument('--quality',default='high');ap.add_argument('--scenes',default='intro,drive,fight1,fight2,super,deck,tunnel,under')
ap.add_argument('--reduced',action='store_true');ap.add_argument('--soft',action='store_true');ap.add_argument('--legacy',action='store_true');ap.add_argument('--scale',type=int,default=0);ap.add_argument('--nosheet',action='store_true');ap.add_argument('--tune',default='')
A=ap.parse_args();OUT=pathlib.Path(A.out);OUT.mkdir(parents=True,exist_ok=True)
VIEWS={'phone':(390,844,3),'desk':(1920,1080,1),'small':(320,568,2),'tg':(390,700,3),'land':(844,390,2),'laptop':(1366,768,1)}
async def ov(u):
    if not A.soft and u.split('?')[0].endswith('js/graphics.js'):
        return ((pathlib.Path(REPO)/'js/graphics.js').read_text().replace("function software(){","function software(){return false;").encode(),'application/javascript')
    return None
# n simulation steps with your own tank driven by the bot AI (no drawing), then k drawn frames at a fixed step
SIM="""(n)=>{if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}for(let i=0;i<n&&state==='play';i++){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);}}"""
DRAW="""(a)=>{B3.step=1/30;for(let i=0;i<a[0];i++){if(a[1]&&state==='play'){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);}drawBattle();}B3.step=0;}"""
START="""(a)=>{closeAll();save.gtype='arena';save.mode=a[1];save.map=a[0];store();prepareMatch();startMatch();paused=true;if(typeof banner!=='undefined')banner=null;}"""
PLACE={
 'deck':"()=>{me.x=BR.deck[0]+BR.deck[2]*0.42;me.y=BR.deck[1]+BR.deck[3]/2;me.elev=1;const e=units.find(u=>u.team!==me.team);e.x=BR.tunnels[0][0]+BR.tunnels[0][1]/2;e.y=BR.deck[1]+BR.deck[3]+2.2;e.elev=0;}",
 'tunnel':"()=>{const t=BR.tunnels[0];me.x=t[0]+t[1]/2;me.y=BR.deck[1]+BR.deck[3]*0.5;me.elev=0;}",
 'under':"()=>{const t=BR.tunnels[0];me.x=t[0]+t[1]/2+0.4;me.y=BR.deck[1]+BR.deck[3]+3.2;me.elev=0;const e=units.find(u=>u.team!==me.team);e.x=t[0]+t[1]/2;e.y=BR.deck[1]+BR.deck[3]-1.1;e.elev=0;}",
}
async def run(p,name):
    w,h,scale=VIEWS[name];scale=A.scale or scale
    init="window.LUNAR_NO_AUTOGFX=1;"+("" if A.soft else "window.LUNAR_SOFT_GL=false;")+("window.LUNAR_CHASECAM=false;" if A.legacy else "")
    b,pg,errs=await open_game(p,w,h,scale=scale,init=init,override=ov)
    if A.reduced: await pg.emulate_media(reduced_motion='reduce')
    await pg.add_style_tag(content='#toast{display:none!important}')
    await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=40000)
    await pg.evaluate("(g)=>{save.welcomed=true;save.mp=9;store();closeAll();uiDirty();setGfx(g);}",A.quality)
    await pg.wait_for_timeout(1500)
    if A.tune: await pg.evaluate("(t)=>ArenaCam.tune(JSON.parse(t))",A.tune)
    sfx=('' if A.quality=='high' else '_low')+('_reduced' if A.reduced else '')+('_legacy' if A.legacy else '')
    for mp in A.maps.split(','):
        shots=[]
        async def snap(scn):
            await pg.wait_for_timeout(250);await pg.evaluate("()=>{for(let i=0;i<2;i++)drawBattle();}")
            f=OUT/(mp+'_'+name+'_'+scn+sfx+'.png');await pg.screenshot(path=str(f));shots.append(f)
            print(f.name,json.dumps(await pg.evaluate("()=>({calls:R3.calls,tris:RR.info.render.triangles,progs:RR.info.programs.length,q:R3.q,pr:RR.getPixelRatio(),chase:!!R3.chase,st:B3.map&&B3.map.stats,cam:R3.chase?{pitch:+ArenaCam.C.pitch.toFixed(1),dist:+ArenaCam.C.dist.toFixed(1),fov:ArenaCam.C.fov}:null})")),flush=True)
        scenes=[s for s in A.scenes.split(',') if s]
        for mode in ['2v2','1v1']:
            want=[s for s in scenes if (s=='fight1')==(mode=='1v1')]
            if not want: continue
            await pg.evaluate(START,[mp,mode])
            if not await pg.evaluate("()=>{drawBattle();return !!(B3.map&&B3.map.arena);}"): raise SystemExit('the Arena3D map did not build for '+mp)
            if 'intro' in want and not A.legacy: await pg.evaluate(DRAW,[10,0]);await snap('intro')
            await pg.evaluate(DRAW,[80,0])   # the crane shot plays out
            if 'drive' in want: await pg.evaluate(SIM,60);await pg.evaluate(DRAW,[24,1]);await snap('drive')
            if 'fight2' in want or 'fight1' in want or 'super' in want:
                await pg.evaluate(SIM,300 if mode=='2v2' else 240);await pg.evaluate(DRAW,[26,1])
                if 'fight1' in want: await snap('fight1')
                if 'fight2' in want: await snap('fight2')
            if 'super' in want:
                await pg.evaluate("()=>{if(me.hp<=0){me.hp=me.mhp;me.dead=0;}me.sp=SUPER_MAX;me.sup=null;const e=units.filter(u=>u.team!==me.team&&u.hp>0).sort((a,b)=>Math.hypot(a.x-me.x,a.y-me.y)-Math.hypot(b.x-me.x,b.y-me.y))[0];superGo(e?Math.atan2(e.y-me.y,e.x-me.x):-Math.PI/2);}")
                await pg.evaluate(DRAW,[14,1]);await snap('charge')
                await pg.evaluate("()=>{supStop();}");await pg.evaluate(DRAW,[10,1]);await snap('super')
            has_bridge=await pg.evaluate("()=>!!BR")
            for scn in ['deck','tunnel','under']:
                if scn in want and has_bridge and not A.legacy:
                    await pg.evaluate("()=>{units.forEach(u=>{u.hp=u.mhp;u.dead=0;u.sup=null;});if(typeof supUI!=='undefined')supUI=null;}");await pg.evaluate(PLACE[scn]);await pg.evaluate(DRAW,[45,0]);await snap(scn)
            await pg.evaluate("()=>{paused=false;state='menu';exitBattle();}")
        if not A.nosheet and shots:   # one sheet per map and device: every scene side by side, 1000 px tall (desktop: two rows)
            ims=[Image.open(f).convert('RGB') for f in shots]
            if w<h:
                ims=[i.resize((int(i.width*1000/i.height),1000),Image.LANCZOS) for i in ims];sh=Image.new('RGB',(sum(i.width for i in ims)+8*(len(ims)-1),1000),(12,12,14));x=0
                for i in ims:sh.paste(i,(x,0));x+=i.width+8
            else:
                ims=[i.resize((960,int(i.height*960/i.width)),Image.LANCZOS) for i in ims];cols=min(4,len(ims));rows=(len(ims)+cols-1)//cols;ch=ims[0].height;sh=Image.new('RGB',(cols*968-8,rows*(ch+8)-8),(12,12,14))
                for n,i in enumerate(ims):sh.paste(i,((n%cols)*968,(n//cols)*(ch+8)))
            sh.save(OUT/(mp+'_'+name+sfx+'_sheet.jpg'),quality=88)
    print('errors',errs[:6]);await b.close()
async def main():
    start_dev()
    async with async_playwright() as p:
        for d in A.devices.split(','):await run(p,d)
asyncio.run(main())
