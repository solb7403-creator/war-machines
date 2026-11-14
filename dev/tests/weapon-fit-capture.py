"""Session 5E-2b2b: every weapon on every chassis, drawn by the game's own tank builder (render3d.js buildTank: the Meshy models,
the fit scale and the mount the match uses) under the chase camera's own angle and lens: phone = pitch 48, 46 degree lens,
desktop = pitch 44, 30 degree lens (js/arenacam.js). One tank per tile, the hull pointing up the screen as it does in a match,
turret forward. Plus a level side view (orthographic) for the proportions, and measurements.json: for each of the 90 pairs the
weapon scale, the turret body's width and height against the hull's, how far the barrel passes the nose, and the gap or
overlap between the weapon's underside and the hull deck.
usage: python3 dev/tests/weapon-fit-capture.py [outdir] [--only moon,pulse] [--tile 260]
Writes fit-<phone|desktop>-<class>.webp (10 weapons x 3 tiers), fit-side-<class>.webp and measurements.json. Not pass / fail.
"""
import os, sys, asyncio, json, base64, io, pathlib
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
args=[a for a in sys.argv[1:] if not a.startswith('--')];flags=sys.argv[1:]
def opt(name,default=None):
    for i,a in enumerate(flags):
        if a=='--'+name:return flags[i+1] if i+1<len(flags) and not flags[i+1].startswith('--') else True
    return default
OUT=pathlib.Path(args[0] if args else os.environ.get('SHOTS','/tmp/lunar-shots')+'/weapon-fit');OUT.mkdir(parents=True,exist_ok=True)
TILE=int(opt('tile',260))
WEAPONS=[('pulse',0,'Pulse Cannon'),('pulse',1,'Arc Pulse'),('pulse',2,'Nova Pulse'),('twin',0,'Twin Repeater'),('twin',1,'Storm Repeater'),('twin',2,'Helix Repeater'),
 ('siege',0,'Siege Breaker'),('siege',1,'Rail Breaker'),('siege',2,'Titanfall'),('moon',2,'Moonbeam')]
ONLY=opt('only');CLS=opt('class');CLASSES=[c for c in ('scout','vanguard','titan') if not isinstance(CLS,str) or c in CLS.split(',')];WEAPONS=[w for w in WEAPONS if not isinstance(ONLY,str) or w[0] in ONLY.split(',')]
CN={'scout':['Scout','Strider','Phantom'],'vanguard':['Vanguard','Sentinel','Paladin'],'titan':['Titan','Bulwark','Colossus']}
JS=r"""async (o)=>{
 const cvs=document.createElement('canvas'),r=new THREE.WebGLRenderer({canvas:cvs,antialias:true,preserveDrawingBuffer:true,alpha:false});
 r.outputColorSpace=THREE.SRGBColorSpace;if(typeof Equipment3D!=='undefined')Equipment3D.configure(r);
 const mats=mkMats(),spec={cls:o.cls,ct:o.ct,arch:o.arch,wt:o.wt,paint:'stock',lunar:false,team:'#4d9fff',gems:'dmg,rof,arm',boss:false,ghost:false,vt:0};
 // the Meshy files arrive asynchronously: ask, then wait until both the hull and the weapon are the Meshy kit (or give up)
 let T=null;for(let i=0;i<80;i++){T=buildTank(spec,mats);if(T.meta.meshy&&T.wmeta.meshy)break;if(typeof Equipment3D!=='undefined')Equipment3D.releaseTree(T.g);if(typeof Meshy3D!=='undefined')Meshy3D.release(T.g);T=null;await new Promise(q=>setTimeout(q,150));}
 if(!T)T=buildTank(spec,mats);
 const k=R*CH[o.cls].ds*TANK_VIS;T.g.scale.setScalar(k);T.hull.rotation.y=Math.PI/2;T.tur.rotation.y=0;
 const s=new THREE.Scene();s.background=new THREE.Color('#5d6068');addLights(s);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({color:'#6e7178'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.002;s.add(ground);
 s.add(T.g);s.updateMatrixWorld(true);
 // measurements in MODEL space (the hull's own units): boxes of the hull meshes and of the weapon meshes
 const box=(root,skip)=>{const b={min:{x:1e9,y:1e9,z:1e9},max:{x:-1e9,y:-1e9,z:-1e9},expandByPoint(p){for(const k of ['x','y','z']){if(p[k]<this.min[k])this.min[k]=p[k];if(p[k]>this.max[k])this.max[k]=p[k];}}},v=new THREE.Vector3(),inv=new THREE.Matrix4().copy(T.body.matrixWorld).invert();let any=false;root.traverse(m=>{if(!m.isMesh||!m.geometry||!m.geometry.attributes.position)return;let p=m;while(p){if(p===skip)return;p=p.parent;}
   const a=m.geometry.attributes.position,st=Math.max(1,Math.floor(a.count/6000));for(let i=0;i<a.count;i+=st){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);b.expandByPoint(v);any=true;}});return any?b:null;};
 const hb=box(T.body,T.tur),wb=box(T.tur,null),f=x=>+x.toFixed(3);
 const meas=hb&&wb?{scale:f(T.ws),meshyHull:!!T.meta.meshy,meshyWeapon:!!T.wmeta.meshy,hullLen:f(hb.max.x-hb.min.x),hullW:f(hb.max.z-hb.min.z),hullH:f(hb.max.y),ring:f(T.meta.ty),
  wLen:f(wb.max.x-wb.min.x),wW:f(wb.max.z-wb.min.z),wTop:f(wb.max.y),wBottom:f(wb.min.y),wRear:f(wb.min.x),wTip:f(wb.max.x),
  widthRatio:f((wb.max.z-wb.min.z)/(hb.max.z-hb.min.z)),topRatio:f(wb.max.y/hb.max.y),pastNose:f(wb.max.x-hb.max.x),pastTail:f(hb.min.x-wb.min.x),lenRatio:f((wb.max.x-wb.min.x)/(hb.max.x-hb.min.x)),seat:f(wb.min.y-T.meta.ty)}:null;
 const out={},zf=(hb?hb.max.x-hb.min.x:1.84)*k/(1.84*R*.9*TANK_VIS);   // every class is framed the same: the camera backs off by the hull's own length
 for(const v of o.views){
  r.setPixelRatio(1);r.setSize(v.px,v.px,false);let cam;
  if(v.side){const hw=.9*zf;cam=new THREE.OrthographicCamera(-hw,hw,hw*.78,-hw*.78,.1,100);cam.position.set(20,.3*zf,0);cam.up.set(0,1,0);cam.lookAt(0,.25*zf,0);r.setSize(v.px,Math.round(v.px*.78),false);}
  else{const el=v.pitch*Math.PI/180,d=v.dist*zf;cam=new THREE.PerspectiveCamera(v.fov,1,.1,200);cam.position.set(0,Math.sin(el)*d+.2,Math.cos(el)*d-.1);cam.up.set(0,1,0);cam.lookAt(0,.2,-.1);}
  cam.updateProjectionMatrix();r.render(s,cam);out[v.name]=cvs.toDataURL('image/png');
 }
 if(typeof Equipment3D!=='undefined')Equipment3D.releaseTree(T.g);if(typeof Meshy3D!=='undefined')Meshy3D.release(T.g);r.dispose();
 return {out,meas};
}"""
async def main():
    start_dev()
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,900,900,init="window.LUNAR_NO_AUTOGFX=1;")
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=60000)
        # distance: the tank fills about 70% of a tile at each lens (a tile is a crop of the match view, not a different camera)
        views=[dict(name='phone',px=TILE,pitch=48,fov=46,dist=1.75),dict(name='desktop',px=TILE,pitch=44,fov=30,dist=2.7),dict(name='side',px=TILE,side=True)]
        meas={};tiles={}
        for cls in CLASSES:
            for ct in range(3):
                for arch,wt,wname in WEAPONS:
                    res=await pg.evaluate(JS,dict(cls=cls,ct=ct,arch=arch,wt=wt,views=views))
                    key=f'{cls}{ct}|{arch}{wt}';meas[key]=dict(chassis=CN[cls][ct],weapon=wname,**(res['meas'] or {}))
                    for v,data in res['out'].items():tiles[(v,cls,ct,arch,wt)]=Image.open(io.BytesIO(base64.b64decode(data.split(',',1)[1]))).convert('RGB')
                    m=res['meas'] or {};print(f"{CN[cls][ct]:9s} {wname:15s} scale {m.get('scale')} width {m.get('widthRatio')} top {m.get('topRatio')} len {m.get('lenRatio')} pastNose {m.get('pastNose')} seat {m.get('seat')} meshy {m.get('meshyHull')}/{m.get('meshyWeapon')}",flush=True)
        json.dump(meas,open(OUT/'measurements.json','w'),indent=1)
        lab=22
        for v in ('phone','desktop','side'):
            th=TILE if v!='side' else round(TILE*.78)
            for cls in CLASSES:
                sheet=Image.new('RGB',(TILE*len(WEAPONS)+90,(th+lab)*3+lab),(10,14,22));d=ImageDraw.Draw(sheet)
                for c,(arch,wt,wname) in enumerate(WEAPONS):d.text((90+c*TILE+6,4),wname,fill=(223,231,242))
                for ct in range(3):
                    d.text((4,lab+ct*(th+lab)+th//2),CN[cls][ct],fill=(223,231,242))
                    for c,(arch,wt,wname) in enumerate(WEAPONS):sheet.paste(tiles[(v,cls,ct,arch,wt)],(90+c*TILE,lab+ct*(th+lab)))
                sheet.save(OUT/(('fit-side-' if v=='side' else 'fit-'+v+'-')+cls+'.webp'),quality=88)
        print('errors',errs[:5]);await b.close()
asyncio.run(main())
