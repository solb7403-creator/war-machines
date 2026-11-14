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
 save.mp=50;save.mode='1v1';save.gtype='arena';save.map='craters';save.sound=false;if(gfxMode()!==quality)setGfx(quality);
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
 window.__scr=()=>{const P=u=>{WP(u.x,u.y,0);return [WPx,WPy];};return {me:P(me),e:P(e)};};   // where the two tanks are drawn (css px) under the camera of the moment
 return {key,k:supKey(me.wtype,me.wtier),name:SUP_NAMES[supKey(me.wtype,me.wtier)],gfx:R3.q,me:[me.x,me.y],e:[e.x,e.y]};
}'''
FIRE='''(oc)=>{me.sp=SUPER_MAX;const ok=superGo();if(!ok)return {ok:false};
 const bar={z0:0.40,jc:0.60};me.sup.bar=bar;supUI.bar={z0:bar.z0,jc:bar.jc};me.sup.tapAt=undefined;
 return {ok:true,tapAt:oc===2?0.4:oc===1?0.3:0.1334};}'''   # seconds after the press on the 0.667 s sweep: 60% (the jackpot), 45% (the zone), 20% (a miss), each on a 1/30 s step
def crop_box(scr,w,h,scale,nova=False):
    # the action in css px under the chase camera: from above the target to below my tank, one tile shape (1 : 1.15)
    (mx,my),(ex,ey)=scr['me'],scr['e'];d=max(60,abs(my-ey))
    top=ey-d*(1.5 if nova else 0.55);bot=my+d*(1.2 if nova else 0.3);hh=bot-top;ww=hh/1.15;cx=(mx+ex)/2
    if ww>w:ww=w;cx=w/2
    x0=min(max(0,cx-ww/2),w-ww);y0=max(0,top);y1=min(h,bot)
    return tuple(int(v*scale) for v in (x0,y0,x0+ww,y1))
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
            box=crop_box(await pg.evaluate('__scr()'),w,h,scale,key.startswith('twin'))
            rep['supers'][key+'-'+OC[oc]]['box']=list(box)   # the crop (device px) the sheets use: dev/tests/super-sheets.py
            tiles[(key,oc)]={k:v.crop(box) for k,v in shots.items()}
            print(tag,key,OC[oc],info['name'],'fired',round(fired/30,2),'peak',peak,flush=True)
    rep['pageErrors']=errs;rep['idleAfter']=await pg.evaluate('(()=>{for(const c of crates)c.hp=c.mhp;for(const u of units)u.hp=u.mhp;for(let i=0;i<150;i++)__step(1);const s=__step(1);return {calls:s.calls,programs:s.programs,tris:s.tris,fxOn:SFX.glow.visible||SFX.debris.visible,fx:s.fx};})()')
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
# ---- destruction sheets (--destroy): damage stages and the break-up of a tank, a crate and every material ----
MATS=['armor','metal','concrete','ferrite','ilmenite','armalcolite','tranq','selenite','moonheart','crate','rock','chitin']
DSETUP='''(mats)=>{const e=window.__e;const put=(u,x,y)=>{u.x=x;u.y=y;u.px=x;u.py=y;u.ox=x;u.oy=y;u.sx=x;u.sy=y;};put(me,10,29.5);put(e,10,3.2);e.mhp=e.hp=2000;
 const C={armor:0x4a5058,metal:0x6d737b,concrete:0x8b8f94,ferrite:0x7a5238,ilmenite:0x59647a,armalcolite:0x27365c,tranq:0x4a463f,selenite:0xbfe8ff,moonheart:0xd81e3c,crate:0x8a6a3a,rock:0x6f6a66,chitin:0x3a1c44};
 window.__blocks=mats.map((m,i)=>{const x=3.4+(i%4)*4.4,z=9+Math.floor(i/4)*5.2,mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1.1,2),new THREE.MeshLambertMaterial({color:C[m]}));mesh.position.set(x,.55,z);RS.add(mesh);return {m,x,z,mesh,hp:1,gone:false};});
 const b0=SFX.begin;SFX.begin=function(dt,t){b0(dt,t);for(const [i,b] of __blocks.entries())if(!b.gone&&b.hp<.7)SFX.wear(b.m,b.x,.55,b.z,1,.55,1,0,b.hp,i*7919+3);};
 window.__hp=(f)=>{for(const b of __blocks)b.hp=f;};
 window.__break=()=>{for(const b of __blocks){b.gone=true;b.mesh.visible=false;SFX.shatter(b.m,b.x,0,b.z,1.1,1.1,0,0);if(b.m==='armor'||b.m==='metal'||b.m==='chitin')SFX.blast(b.x,0,b.z,1.1,1);}};
 return __blocks.map(b=>[b.m,b.x,b.z]);}'''
async def run_destroy(p,name,report):
    from PIL import ImageDraw
    w,h,scale=VIEWS[name];tag=name+'-'+QUALITY+('-reduced' if REDUCED else '');d=OUT/tag;d.mkdir(exist_ok=True)
    b,pg,errs=await open_game(p,w,h,scale=scale)
    await pg.wait_for_function('typeof prepareMatch==="function"&&typeof save!=="undefined"&&typeof FX3D!=="undefined"',timeout=60000)
    await pg.evaluate('closeAll();save.welcomed=true;uiDirty();')
    try:await pg.wait_for_function('typeof use3D==="function"&&(R3.ready||R3.failed)',timeout=90000)
    except Exception:pass
    info=await pg.evaluate(SCENE,['pulse0',QUALITY,REDUCED])
    for _ in range(40):await pg.evaluate('__step(1)')
    await pg.evaluate('window.__clean=true');blocks=await pg.evaluate(DSETUP,MATS);sc,ox,oy=info['sc'],info['ox'],info['oy']
    frames=[]
    async def snap(label):
        png=await pg.screenshot(type='png');im=Image.open(io.BytesIO(png)).convert('RGB');im.save(d/f'destroy-{label}.png');frames.append((label,im))
    for label,hp in (('60% health: cracks',.6),('35%: scorch + sparks',.35),('15%: heavy cracks + smoke',.15)):
        await pg.evaluate('(f)=>{__hp(f);__e.hp=__e.mhp*f;}',hp);st=None
        for _ in range(24):st=await pg.evaluate('__step(1)')
        await snap(label)
    await pg.evaluate('()=>{__break();takeHit(__e,__e.hp+10,me,null,0);}')
    peak={'chunks':0,'particles':0,'debrisVerts':0,'calls':0}
    for t,label in ((3,'destroyed +0.1 s'),(12,'+0.5 s: debris bounces'),(30,'+1.5 s: settled'),(45,'+3 s: fading')):
        for _ in range(t):
            st=await pg.evaluate('__step(1)')
            for k in ('chunks','particles','debrisVerts'):peak[k]=max(peak[k],st['fx'][k])
            peak['calls']=max(peak['calls'],st['calls'])
        await snap(label)
    for _ in range(140):st=await pg.evaluate('__step(1)')
    report[tag+'-destroy']={'pageErrors':errs,'peak':peak,'after':st['fx'],'materials':MATS}
    await b.close()
    # one sheet: the whole arena for every stage, the material names on the first frame
    x0,x1=int((ox+1*sc)*scale),int((ox+19*sc)*scale);y0,y1=int((oy+1*sc*.86)*scale),int((oy+25*sc*.86)*scale)
    T=420;tiles=[]
    for label,im in frames:
        c=im.crop((x0,y0,x1,y1));c.thumbnail((T,T*2));dr=ImageDraw.Draw(c);dr.rectangle((0,0,c.width,16),fill=(8,10,16));dr.text((4,2),label,fill=(255,255,255));tiles.append(c)
    k=tiles[0].width/(x1-x0);dr=ImageDraw.Draw(tiles[0])
    for m,bx,bz in blocks:dr.text(((ox+bx*sc)*scale*k-x0*k-22,(oy+(bz+1.6)*sc*.86)*scale*k-y0*k),m,fill=(255,230,150))
    sheet=Image.new('RGB',(sum(t.width for t in tiles[:4]),tiles[0].height*2),(8,10,16));x=0
    for i,t in enumerate(tiles):
        if i==4:x=0
        sheet.paste(t,(x,0 if i<4 else tiles[0].height));x+=t.width
    sheet.save(OUT/f'destruction-{tag}.webp',quality=84)
    print(tag,'destruction peak',peak,'after',st['fx'],flush=True)
    return errs
async def main():
    dev=start_dev();report={}
    if DESTROY:
        try:
            async with async_playwright() as p:
                errs=[]
                for v in (['phone','desktop'] if VIEW=='both' else [VIEW]):errs+=await run_destroy(p,v,report)
        finally:
            if dev:dev.terminate()
        (OUT/'report-destroy.json').write_text(json.dumps(report,indent=1))
        bad=[k for k,r in report.items() if r['pageErrors'] or r['peak']['chunks']<=0 or r['after']['chunks'] or r['after']['particles']]
        if bad:print('FAIL destruction capture',bad,report);sys.exit(1)
        print('PASS destruction capture',OUT);return
    try:
        async with async_playwright() as p:
            allerrs=[]
            for v in (['phone','desktop'] if VIEW=='both' else [VIEW]):allerrs+=await run_view(p,v,report)
    finally:
        if dev:dev.terminate()
    if isinstance(opt('only'),str) and (OUT/'report.json').exists():   # a partial re-capture (--only) keeps the rest of an earlier report
        old=json.loads((OUT/'report.json').read_text())
        for tag,rep in report.items():
            if tag in old and isinstance(old[tag],dict) and 'supers' in old[tag]:merged=dict(old[tag]['supers']);merged.update(rep['supers']);rep['supers']=merged
        for tag in old:report.setdefault(tag,old[tag])
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
