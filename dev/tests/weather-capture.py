# Arcade weather + hazard captures (Session 5E-2e): every map's hazard at its warning, its hit and after, and its vision
# effect, on a phone and a desktop, HIGH and LOW. Not pass/fail by itself: it writes the review sheets and prints what the
# sim reported (hits, takedowns, errors). The weather roll is fixed with window.LUNAR_WX (the phone's own roll: no server).
#   python3 dev/tests/weather-capture.py [--out DIR] [--maps ...] [--views phone,desk,...] [--quality high|low] [--kinds haz,vis,both]
import os, asyncio, sys, pathlib, argparse, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev, REPO
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('--out',default=os.environ.get('SHOTS','/tmp/lunar-shots')+'/weather');ap.add_argument('--maps',default='classic,overpass,longshot,craters,canyon,bunker')
ap.add_argument('--views',default='p390x844,d1920');ap.add_argument('--quality',default='high');ap.add_argument('--kinds',default='both');ap.add_argument('--soft',action='store_true');ap.add_argument('--mode',default='2v2')
A=ap.parse_args();OUT=pathlib.Path(A.out);OUT.mkdir(parents=True,exist_ok=True)
VIEWS={'p390x844':(390,844,2),'p390x700':(390,700,2),'p320x568':(320,568,2),'d1366':(1366,768,1),'d1920':(1920,1080,1)}
async def ov(u):
    if not A.soft and u.split('?')[0].endswith('js/graphics.js'):
        return ((pathlib.Path(REPO)/'js/graphics.js').read_text().replace("function software(){","function software(){return false;").encode(),'application/javascript')
    return None
# drive the real sim to a round time (the pilot's tank is flown by the game's own AI so there is a fight on screen)
RUN="""(to)=>{if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}
 let n=0;while(elapsed<to&&state==='play'&&n++<6000){if(me.hp>0&&!window.__hold)botAI(1/30,me);update(1/30);fxTick(1/30);if(to-elapsed<1.1&&n%2===0)drawBattle();}   // only the last second is drawn (the particles of that second), the rest is simulated
 for(let i=0;i<3;i++)drawBattle();return {t:elapsed,state};}"""
async def run(p,name):
    w,h,scale=VIEWS[name]
    b,pg,errs=await open_game(p,w,h,scale=scale,init="window.LUNAR_NO_AUTOGFX=1;"+("" if A.soft else "window.LUNAR_SOFT_GL=false;"),override=ov)
    await pg.add_style_tag(content='#toast{display:none!important}')
    await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=30000)
    await pg.evaluate("(g)=>{save.welcomed=true;save.mp=5;save.wxTip={meteor:3,train:3,arc:3,vent:3,tornado:3,laser:3};store();closeAll();uiDirty();setGfx(g);}",A.quality)
    await pg.wait_for_timeout(1500)
    for mp in A.maps.split(','):
        for kind in A.kinds.split(','):
            k={'vis':1,'haz':2,'both':3}[kind]
            seed=await pg.evaluate("(k)=>{for(let s=1;;s++)if(wxRoll(s).k===k)return s;}",k)
            await pg.evaluate("([c,s,m])=>{closeAll();window.LUNAR_WX=s;window.__hold=0;save.gtype='bounty';save.mode=m;save.map=c;store();prepareMatch();startMatch();paused=true;banner=null;}",[mp,seed,A.mode])
            P=await pg.evaluate("()=>({haz:wx.P.haz,vis:wx.P.vis,hz:wx.P.hz.filter(z=>!z.soft).slice(0,3).map(z=>({k:z.k,w:z.w,t:z.t,e:wxEnd(z),x:z.x,y:z.y})),win:wx.P.win.slice(0,1),clouds:wx.P.clouds.length})")
            tag=mp+'_'+kind+'_'+name+('' if A.quality=='high' else '_low')
            shots=[]
            if P['hz']:
                z=P['hz'][0];warn=z['t']-z['w']
                # put the pilot where the strike will be seen: near it, looking at it
                await pg.evaluate("(z)=>{let p=z.k==='c'?[z.x,z.y]:z.k==='a'?[10,22]:z.k==='t'?[10,21.5]:z.k==='l'?[10,z.y+4]:null;if(z.k==='n'){const q=wxPos(wx.P.hz[0],z.t+3);p=[q[0]+1.5,q[1]+4.5];}if(p){me.x=Math.max(1,Math.min(19,p[0]+(z.k==='c'?1.5:0)));me.y=Math.min(30.5,p[1]+(z.k==='c'?4.5:0));me.px=me.x;me.py=me.y;window.__hold=1;}}",z)
                shots+=[('1warn-start',z['w']+warn*0.25),('2warn-late',z['w']+warn*0.85),('3hit',z['t']+(0.12 if z['k'] in 'ca' else 1.25 if z['k']=='l' else 3.0 if z['k']=='n' else 0.45)),('4after',(z['t']+7 if z['k']=='n' else z['e']+0.9))]
            if P['win']: shots+=[('5vision',P['win'][0]['t0']+4)]
            elif P['clouds']: shots+=[('5vision',max(12,(P['hz'][0]['t']+2.5) if P['hz'] else 12))]
            shots.sort(key=lambda s:s[1])
            for nm,t in shots:
                r=await pg.evaluate(RUN,t)
                if r['state']!='play': print(tag,nm,'match ended at',r);break
                await pg.wait_for_timeout(120);await pg.evaluate("()=>{banner=null;for(let i=0;i<2;i++)drawBattle();}")
                await pg.screenshot(path=str(OUT/(tag+'_'+nm+'.png')))
            st=await pg.evaluate("()=>({t:+elapsed.toFixed(1),td:me.st?me.st.td:0,hits:units.map(u=>Math.round(u.mhp-u.hp)),chip:WeatherFX.chip(),calls:R3.calls,q:R3.q,arena:!!(B3.map&&B3.map.arena)})")
            print(tag,json.dumps(P['hz'][:1]),json.dumps(st))
            await pg.evaluate("()=>{paused=false;state='menu';exitBattle();}")
    print(name,'errors',errs[:8]);await b.close()
async def main():
    start_dev()
    async with async_playwright() as p:
        for d in A.views.split(','):await run(p,d)
asyncio.run(main())
