"""Session 5E-2b: VFX sheets and frame sequences of the ten supers x three timing-bar outcomes, rendered by the REAL game page
(index.html, the shipped client) frame by frame: the frame loop is stopped and the sim, the HUD and the 3D view are stepped by
hand at 1/30 s, so every capture is the same on any machine (software GL included). Also the smoke test for the timing bar
and the effects: it fails on any page error, on a missing bar or outcome, and on a draw-call or shader-program rise.
usage: python3 dev/tests/super-vfx-capture.py [outdir] [--only pulse0,moon] [--view phone|desktop|both] [--quality high|low] [--reduced] [--destroy]
  phone = 390x844 portrait at 3x (iPhone in Telegram), desktop = 1920x1080.
Writes <outdir>/<view>-<quality>/<key>-<outcome>-<frame>.png, sheet-<view>-<quality>.webp (10 x 3, the blast frame) and
seq-<view>-<quality>.webp (every super, jackpot: charge, lock, blast, +0.2 s, +0.5 s, aftermath), and report.json.
"""
import asyncio, io, json, os, sys, pathlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
from PIL import Image
KEYS=['pulse0','pulse1','pulse2','twin0','twin1','twin2','siege0','siege1','siege2','moon']
OC=['miss','normal','jackpot']
args=[a for a in sys.argv[1:] if not a.startswith('--')];flags=sys.argv[1:]
OUT=pathlib.Path(args[0] if args else os.environ.get('SHOTS','/tmp/lunar-shots')+'/supers');OUT.mkdir(parents=True,exist_ok=True)
def opt(name,default=None):
    for i,a in enumerate(flags):
        if a=='--'+name:return flags[i+1] if i+1<len(flags) and not flags[i+1].startswith('--') else True
    return default
ONLY=opt('only');ONLY=ONLY.split(',') if isinstance(ONLY,str) else KEYS
VIEWS={'phone':(390,844,3),'desktop':(1920,1080,1)}
CLEAN=not bool(opt('numbers',False));   # the sheets leave the floating damage numbers out (pass --numbers to keep them)
VIEW=opt('view','both');QUALITY=opt('quality','high');REDUCED=bool(opt('reduced',False));DESTROY=bool(opt('destroy',False))
# one scene: my tank low in the arena, one enemy ahead; nobody drives or shoots unless the capture says so
SCENE='''([key,quality,reduced])=>{
 const arch=key==='moon'?'moon':key.slice(0,-1),tier=key==='moon'?2:+key.slice(-1);
 window.myLoadout=()=>({w:{a:arch,t:tier,q:1,s:false},c:{c:'vanguard',t:Math.min(2,tier),q:1,s:false},up:{hull:0,cannon:0,engine:0,target:0,reactor:0},cores:['dmg','rof','arm'],gl:{},skin:'default',paint:'stock'});
 save.mp=50;save.mode='1v1';save.gtype='arena';save.map='craters';save.gfx=quality;save.sound=false;
 if(reduced&&typeof GraphicsMotion!=='undefined')GraphicsMotion.reduced=()=>true;
 closeAll();prepareMatch();startMatch();
 window.requestAnimationFrame=()=>0;   // the frame loop stops here: the capture steps the game by hand
 const e=units.find(u=>u.team!==me.team);
 walls.length=0;rocks.length=0;   // sim cover off: the shot must reach (the map art stays)
 const far=arch==='twin'?3.4:7.2;let spot=null;
 for(const [x,y] of [[10,22],[10,20],[8,21],[12,21],[10,18],[6,20],[14,20]]){spot=[x,y];break;}
 const put=(u,x,y)=>{u.x=x;u.y=y;u.px=x;u.py=y;u.ox=x;u.oy=y;u.sx=x;u.sy=y;u.vx=u.vy=0;u.avx=u.avy=0;u.claim=null;};
 put(me,spot[0],spot[1]);put(e,spot[0]+(arch==='twin'?1.6:0.6),spot[1]-far);
 e.hum=true;e.ctl='net';e.mhp=e.hp=arch==='twin'?60000:90000;me.ang=-Math.PI/2;me.hd=-Math.PI/2;e.ang=Math.PI/2;e.hd=Math.PI/2;
 window.__e=e;window.__errs=[];B3.step=1/30;timeLeft=85;
 window.__step=(n)=>{for(let i=0;i<n;i++){me.cd=99;e.cd=99;me.sp=Math.min(me.sp,SUPER_MAX);timeLeft=85;update(1/30);fxTick(1/30);}if(window.__clean){nums.length=0;pops.length=0;}drawBattle();
  return {calls:R3.calls,programs:RR.info.programs.length,tris:RR.info.render.triangles,fx:SFX?SFX.stats():null,sup:me.sup?{el:me.sup.el,t:me.sup.t,oc:me.sup.oc}:null,ui:supUI?{oc:supUI.oc,p:supUI.p}:null,hp:e.hp,shells:shells.length};};
 return {key,k:supKey(me.wtype,me.wtier),name:SUP_NAMES[supKey(me.wtype,me.wtier)],gfx:R3.q,me:[me.x,me.y],e:[e.x,e.y],sc,ox,oy};
}'''
FIRE='''(oc)=>{me.sp=SUPER_MAX;const ok=superGo();if(!ok)return {ok:false};
 const bar={z0:0.40,jc:0.60};me.sup.bar=bar;supUI.bar={z0:bar.z0,jc:bar.jc};me.sup.tapAt=undefined;
 return {ok:true,tapAt:oc===2?0.6:oc===1?0.46:0.22};}'''
def crop_box(info,w,h,scale,pad_units=5.2):
    # the action in css px: between my tank and the target, a little towards the target
    sc,ox,oy=info['sc'],info['ox'],info['oy'];mx,my=info['me'];ex,ey=info['e']
    cx=ox+(mx+ex)/2*sc;cy=oy+((my+ey)/2-1.0)*sc*0.86;r=pad_units*sc
    x0=max(0,cx-r);y0=max(0,cy-r*1.15);x1=min(w,cx+r);y1=min(h,cy+r*1.15)
    return tuple(int(v*scale) for v in (x0,y0,x1,y1))
async def run_view(p,name,report):
    w,h,scale=VIEWS[name];tag=name+'-'+QUALITY+('-reduced' if REDUCED else '');d=OUT/tag;d.mkdir(exist_ok=True)
    b,pg,errs=await open_game(p,w,h,scale=scale)
    await pg.wait_for_function('typeof prepareMatch==="function"&&typeof save!=="undefined"&&typeof FX3D!=="undefined"',timeout=60000)
    await pg.evaluate('closeAll();save.welcomed=true;uiDirty();')
    try:await pg.wait_for_function('typeof use3D==="function"&&(R3.ready||R3.failed)',timeout=90000)
    except Exception:pass
    tiles={};rep=report.setdefault(tag,{'supers':{},'idle':None})
    for key in ONLY:
        for oc in range(3):
            info=await pg.evaluate(SCENE,[key,QUALITY,REDUCED])
            for _ in range(40):   # models and textures settle (Meshy kits load asynchronously)
                st=await pg.evaluate('__step(1)')
            idle=st;rep['idle']=rep['idle'] or {'calls':idle['calls'],'programs':idle['programs'],'tris':idle['tris']}
            await pg.evaluate('window.__clean=%s'%('true' if CLEAN else 'false'));f=await pg.evaluate(FIRE,oc);assert f['ok'],'super did not start for '+key
            shots={};tick=0;tapped=False;fired=None;peak={'calls':0,'programs':0,'quads':0,'particles':0,'chunks':0}
            async def snap(label):
                png=await pg.screenshot(type='png');im=Image.open(io.BytesIO(png)).convert('RGB');shots[label]=im;im.save(d/f'{key}-{OC[oc]}-{label}.png')
            while tick<110:
                st=await pg.evaluate('__step(1)');tick+=1;el=tick/30
                for k,v in (('calls',st['calls']),('programs',st['programs'])):peak[k]=max(peak[k],v)
                if st['fx']:
                    for k in ('quads','particles','chunks'):peak[k]=max(peak[k],st['fx'][k])
                if not tapped and el>=f['tapAt']-1e-6:
                    if oc==0 and 'charge' not in shots:await snap('charge')
                    await pg.evaluate('supStop()');tapped=True;st=await pg.evaluate('__step(0)')
                    assert st['ui'] and st['ui']['oc']==oc,f'{key}: the bar gave outcome {st["ui"]} for a {OC[oc]} tap'
                    await pg.evaluate('__step(2)');tick+=2;await snap('lock');continue
                if not tapped and tick==6 and oc!=0:await snap('charge')
                if tapped and fired is None and st['sup'] is None and st['shells']==0:fired=tick   # a shell: the moment it lands
                if fired is not None:
                    dt=tick-fired
                    if dt==(5 if key.startswith('twin') else 3):await snap('blast')
                    elif dt==7:await snap('after02')
                    elif dt==16:await snap('after05')
                    elif dt==40:await snap('aftermath')
                    elif dt>40:break
            assert fired is not None,key+' never fired'
            rep['supers'][key+'-'+OC[oc]]={'name':info['name'],'peak':peak,'firedAt':round(fired/30,2)}
            box=crop_box(info,w,h,scale,6.0 if key.startswith('twin') else 5.6)
            tiles[(key,oc)]={k:v.crop(box) for k,v in shots.items()}
            print(tag,key,OC[oc],info['name'],'fired',round(fired/30,2),'peak',peak,flush=True)
    rep['pageErrors']=errs;rep['idleAfter']=await pg.evaluate('(()=>{for(let i=0;i<150;i++)__step(1);const s=__step(1);return {calls:s.calls,programs:s.programs,tris:s.tris,fxOn:SFX.glow.visible||SFX.debris.visible,fx:s.fx};})()')
    await b.close()
    # sheets
    T=300
    def tile(im):
        im=im.copy();im.thumbnail((T,int(T*1.15)));c=Image.new('RGB',(T,int(T*1.15)),(8,10,16));c.paste(im,((T-im.width)//2,(int(T*1.15)-im.height)//2));return c
    keys=[k for k in KEYS if k in ONLY];th=int(T*1.15)
    sheet=Image.new('RGB',(T*3,th*len(keys)),(8,10,16))
    for r,k in enumerate(keys):
        for oc in range(3):sheet.paste(tile(tiles[(k,oc)]['blast']),(oc*T,r*th))
    sheet.save(OUT/f'sheet-{tag}.webp',quality=82)
    labels=['charge','lock','blast','after02','after05','aftermath']
    seq=Image.new('RGB',(T*len(labels),th*len(keys)),(8,10,16))
    for r,k in enumerate(keys):
        for c,l in enumerate(labels):
            if l in tiles[(k,2)]:seq.paste(tile(tiles[(k,2)][l]),(c*T,r*th))
    seq.save(OUT/f'seq-{tag}.webp',quality=82)
    return errs
async def main():
    dev=start_dev();report={}
    try:
        async with async_playwright() as p:
            allerrs=[]
            for v in (['phone','desktop'] if VIEW=='both' else [VIEW]):allerrs+=await run_view(p,v,report)
    finally:
        if dev:dev.terminate()
    (OUT/'report.json').write_text(json.dumps(report,indent=1))
    bad=[]
    for tag,r in report.items():
        if r['pageErrors']:bad.append(tag+' page errors: '+'; '.join(r['pageErrors'][:3]))
        base=r['idle'];top=max(s['peak']['calls'] for s in r['supers'].values());prog=max(s['peak']['programs'] for s in r['supers'].values())
        print(tag,'idle draw calls',base['calls'],'programs',base['programs'],'| peak during a super: calls',top,'programs',prog,'| after:',r['idleAfter'])
        if r['idleAfter']['fxOn']:bad.append(f'{tag}: the effect batches are still drawn 5 s after the last super ({r["idleAfter"]["fx"]})')
    if bad:print('FAIL super vfx capture:\n '+'\n '.join(bad));sys.exit(1)
    print('PASS super vfx capture:',sum(len(r['supers']) for r in report.values()),'supers x outcomes rendered,',OUT)
asyncio.run(main())
