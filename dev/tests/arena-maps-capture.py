# Arcade map sheets (Session 5E-2c): every map on a phone (390x844 at 3x) and a desktop (1920x1080), from the gameplay
# camera and a wide three-quarter shot, next to the owner's reference. Not pass/fail: it writes the review sheets.
#   python3 dev/tests/arena-maps-capture.py [--out DIR] [--maps classic,overpass,...] [--devices phone,desk]
#                                           [--quality high|low] [--reduced] [--battle] [--soft]
# The test browser draws WebGL on the CPU, where the game holds resolution at 1x and uses a lighter ground bake; unless
# --soft is given this tool tells the game it has a GPU so the sheets show what a phone or a desktop draws.
import os, asyncio, sys, pathlib, argparse
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev, REPO
from playwright.async_api import async_playwright
from PIL import Image
ap=argparse.ArgumentParser();ap.add_argument('--out',default=os.environ.get('SHOTS','/tmp/lunar-shots')+'/arena-maps');ap.add_argument('--maps',default='classic,overpass,longshot,craters,canyon,bunker')
ap.add_argument('--devices',default='phone,desk');ap.add_argument('--quality',default='high');ap.add_argument('--reduced',action='store_true');ap.add_argument('--battle',action='store_true');ap.add_argument('--soft',action='store_true');ap.add_argument('--nosheet',action='store_true')
A=ap.parse_args();OUT=pathlib.Path(A.out);OUT.mkdir(parents=True,exist_ok=True)
REF={'classic':'01-arcade-moonbase.png','overpass':'02-arcade-overpass.png','longshot':'03a-arcade-canyon-rockwalls.png','craters':'06-ground-closeup.png','canyon':'03b-arcade-canyon-grey.png','bunker':'04-arcade-underground-bunker.png'}
VIEWS={'phone':(390,844,3),'desk':(1920,1080,1)}
async def ov(u):
    if not A.soft and u.split('?')[0].endswith('js/graphics.js'):
        return ((pathlib.Path(REPO)/'js/graphics.js').read_text().replace("function software(){","function software(){return false;").encode(),'application/javascript')
    return None
WIDE="""(on)=>{const c=document.getElementById('c');c.style.visibility=on?'hidden':'';if(!on){R3.devCam=null;if(B3.map&&B3.map.sky)B3.map.sky.group.visible=true;return;}
 const port=vw<vh,cam=new THREE.PerspectiveCamera(port?44:30,vw/vh,1,600);if(port){cam.position.set(10,37,16+33);cam.lookAt(10,0,16.6);}else{cam.position.set(10,25,16+37);cam.lookAt(10,0,14.6);}
 cam.updateProjectionMatrix();R3.devCam=cam;if(B3.map&&B3.map.sky)B3.map.sky.group.visible=false;}"""
async def run(p,name):
    w,h,scale=VIEWS[name]
    b,pg,errs=await open_game(p,w,h,scale=scale,init="window.LUNAR_NO_AUTOGFX=1;"+("" if A.soft else "window.LUNAR_SOFT_GL=false;"),override=ov)
    if A.reduced: await pg.emulate_media(reduced_motion='reduce')
    await pg.add_style_tag(content='#toast{display:none!important}')
    await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=30000)
    await pg.evaluate("(g)=>{save.welcomed=true;save.mp=5;store();closeAll();uiDirty();setGfx(g);}",A.quality)
    await pg.wait_for_timeout(1500)
    for mp in A.maps.split(','):
        await pg.evaluate("(c)=>{closeAll();save.gtype='arena';save.mode='2v2';save.map=c;store();prepareMatch();startMatch();}",mp)
        if A.battle:
            await pg.evaluate("()=>{if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}for(let i=0;i<120;i++){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);drawBattle();}}")
        await pg.evaluate("()=>{paused=true;if(typeof banner!=='undefined')banner=null;for(let i=0;i<8;i++)drawBattle();}")
        await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{for(let i=0;i<3;i++)drawBattle();}")
        tag=mp+'_'+name+('' if A.quality=='high' else '_low')+('_reduced' if A.reduced else '')
        await pg.screenshot(path=str(OUT/(tag+'_play.png')))
        await pg.evaluate(WIDE,True);await pg.evaluate("()=>{for(let i=0;i<3;i++)drawBattle();}");await pg.wait_for_timeout(200)
        await pg.screenshot(path=str(OUT/(tag+'_wide.png')))
        await pg.evaluate(WIDE,False)
        print(tag,await pg.evaluate("()=>({calls:R3.calls,tris:RR.info.render.triangles,progs:RR.info.programs.length,q:R3.q,pr:RR.getPixelRatio(),arena:!!(B3.map&&B3.map.arena),st:B3.map&&B3.map.stats})"))
        if not await pg.evaluate("()=>!!(B3.map&&B3.map.arena)"): raise SystemExit('the Arena3D map did not build for '+mp+' (see the browser console)')
        await pg.evaluate("()=>{paused=false;state='menu';exitBattle();}")
        if not A.nosheet:   # reference | gameplay | wide, all 1000 px tall
            ims=[Image.open(pathlib.Path(REPO)/'docs/art/references'/REF[mp]).convert('RGB'),Image.open(OUT/(tag+'_play.png')).convert('RGB'),Image.open(OUT/(tag+'_wide.png')).convert('RGB')]
            ims=[i.resize((int(i.width*1000/i.height),1000),Image.LANCZOS) for i in ims];sh=Image.new('RGB',(sum(i.width for i in ims)+16,1000),(12,12,14));x=0
            for i in ims:sh.paste(i,(x,0));x+=i.width+8
            sh.save(OUT/(tag+'_sheet.jpg'),quality=90)
    print('errors',errs[:6]);await b.close()
async def main():
    start_dev()
    async with async_playwright() as p:
        for d in A.devices.split(','):await run(p,d)
asyncio.run(main())
