# Nine-chassis size lineup: every chassis at ONE fixed orthographic scale (no per-model zoom), so real size differences show.
# Views: front three-quarter, side, top, and the battle camera. "world" = battle size (R x class ds x TANK_VIS, exactly what a
# match draws); "model" = menu/garage size (model space, the same fixed framing for all nine). The magenta ring is the
# shot hit circle every tank uses in the sim (R + bullet radius, the same for every class): what's outside it can't be hit.
# Usage: python3 dev/tests/chassis-lineup.py [out_dir]   (screenshots + measurements.json; not pass/fail)
import os, sys, asyncio, json, base64
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev
from playwright.async_api import async_playwright
OUT=(sys.argv[1] if len(sys.argv)>1 else os.environ.get('SHOTS','/tmp/lunar-shots')+'/lineup')+'/';os.makedirs(OUT,exist_ok=True)
JS=r"""async (o)=>{
 const CN={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
 const cvs=document.createElement('canvas'),r=new THREE.WebGLRenderer({canvas:cvs,antialias:true,preserveDrawingBuffer:true,alpha:false});
 r.outputColorSpace=THREE.SRGBColorSpace;Equipment3D.configure(r);
 const mats=mkMats();
 const view=(name)=>({iso:{az:.95,el:.5},side:{az:0,el:0.001},front:{az:Math.PI/2,el:.001},top:{az:0,el:Math.PI/2-1e-4},battle:{az:0,el:Math.PI/2-TILT}})[name];
 const out={},meas={};
 const hfWas=Equipment3D.enabled;if(o.foundation)Equipment3D.enabled=false;
 const S=(cls,ct,extra)=>Object.assign({cls,ct,arch:o.arch||'pulse',wt:0,paint:o.paint||'stock',lunar:!!o.lunar,team:o.lunar?'#e8f4ff':'#4d9fff',gems:'dmg,rof,arm',boss:false,ghost:!!o.ghost,vt:o.vt|0,fits:o.fits},extra||{});
 function strip(specs,vname,ppu,wpx,hpx,opts){
  const s=new THREE.Scene();s.background=new THREE.Color('#141a26');addLights(s);
  const sp=opts.spacing,n=specs.length,x0=-(n-1)*sp/2;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshLambertMaterial({color:'#1d2433'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.002;s.add(ground);
  const gl=[];for(let i=-60;i<=60;i++){gl.push(i,0,-60,i,0,60,-60,0,i,60,0,i);}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(gl,3));s.add(new THREE.LineSegments(gg,new THREE.LineBasicMaterial({color:'#2b3448'})));
  const made=[];
  specs.forEach((spec,i)=>{
   const T=buildTank(spec,mats);if(!opts.weapon)T.tur.visible=false;
   const k=o.mode==='world'?R*CH[spec.cls].ds*TANK_VIS:1;T.g.scale.setScalar(k);const vv=view(vname),rx=Math.cos(vv.az),rz=-Math.sin(vv.az);T.g.position.set((x0+i*sp)*rx,0,(x0+i*sp)*rz);T.hull.rotation.y=opts.hd||0;T.tur.rotation.y=opts.ta||0;stepAnims(T.anims,0,1.3);s.add(T.g);made.push(T);
   if(opts.ring){const hb=CH[spec.cls].hb||1,rr=o.mode==='world'?R*hb+.12:(R*hb+.12)/(R*CH[spec.cls].ds*TANK_VIS);const ring=new THREE.Mesh(new THREE.RingGeometry(rr-.025,rr+.025,96),new THREE.MeshBasicMaterial({color:'#ff3df2',depthTest:opts.ringOnTop?false:true,transparent:true,opacity:.95}));ring.rotation.x=-Math.PI/2;ring.position.set((x0+i*sp)*Math.cos(view(vname).az),.012,-(x0+i*sp)*Math.sin(view(vname).az));ring.renderOrder=5;s.add(ring);}
  });
  s.updateMatrixWorld(true);
  const v=view(vname),cam=new THREE.OrthographicCamera(-wpx/2/ppu,wpx/2/ppu,hpx/2/ppu,-hpx/2/ppu,.1,400),d=100,cy=opts.cy||0;
  cam.position.set(Math.sin(v.az)*Math.cos(v.el)*d,Math.sin(v.el)*d+cy,Math.cos(v.az)*Math.cos(v.el)*d);
  if(vname==='top')cam.up.set(0,0,-1);else if(vname==='battle')cam.up.set(0,GSN,-GKC);else cam.up.set(0,1,0);
  cam.lookAt(0,cy,0);cam.updateProjectionMatrix();
  r.setPixelRatio(1);r.setSize(wpx,hpx,false);r.render(s,cam);
  const img=cvs.toDataURL('image/png');
  for(const T of made){Equipment3D.releaseTree(T.g);}
  return {img,made};
 }
 // bounds (model space, chassis only) for the measurement table
 for(const cls of ['scout','vanguard','titan'])for(let t=0;t<3;t++){
  const T=buildTank(S(cls,t),mats);T.tur.visible=false;T.g.updateMatrixWorld(true);const b={min:{x:1e9,y:1e9,z:1e9},max:{x:-1e9,y:-1e9,z:-1e9}},v=new THREE.Vector3();
  T.body.children.forEach(c=>{if(c===T.tur)return;c.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);for(const d of ['x','y','z']){b.min[d]=Math.min(b.min[d],v[d]);b.max[d]=Math.max(b.max[d],v[d]);}}});});
  const k=R*CH[cls].ds*TANK_VIS;
  meas[cls+t]={name:CN[cls][t],model:{len:+(b.max.x-b.min.x).toFixed(3),wid:+(b.max.z-b.min.z).toFixed(3),hgt:+b.max.y.toFixed(3),ring:T.meta.ty},
   world:{len:+((b.max.x-b.min.x)*k).toFixed(3),wid:+((b.max.z-b.min.z)*k).toFixed(3),hgt:+(b.max.y*k).toFixed(3),noseFromCenter:+(b.max.x*k).toFixed(3),tailFromCenter:+(-b.min.x*k).toFixed(3),sideFromCenter:+(Math.max(b.max.z,-b.min.z)*k).toFixed(3)},hitRadius:+(R*(CH[cls].hb||1)+.12).toFixed(3),hf:!!T.meta.hf};
  Equipment3D.releaseTree(T.g);
 }
 const rows=[];
 for(const cls of ['scout','vanguard','titan'])rows.push({label:cls.toUpperCase()+' CLASS',specs:[0,1,2].map(t=>S(cls,t)),names:CN[cls]});
 const W=o.w,ppu=o.ppu;
 for(const vname of o.views){
  const hh=vname==='top'?Math.round(ppu*3.2):vname==='battle'?Math.round(ppu*3.0):Math.round(ppu*2.4);
  const strips=rows.map(rw=>({rw,...strip(rw.specs,vname,ppu,W,hh,{spacing:o.spacing,weapon:o.weapon,ring:o.ring,ringOnTop:o.ringOnTop,cy:vname==='top'||vname==='battle'?0:.55*(o.mode==='world'?1:1.3)})}));
  // one canvas: three class strips at the same scale, labels
  const c=document.createElement('canvas'),lh=30;c.width=W;c.height=strips.length*(hh+lh)+44;const x=c.getContext('2d');x.fillStyle='#0a0e17';x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#dfe7f2';x.font='600 20px sans-serif';x.fillText(o.title+' — '+vname+' view, one fixed scale for all nine'+(o.ring?' · magenta = shot hit circle':''),12,28);
  let y=44;for(const st of strips){
   const im=new Image();im.src=st.img;await im.decode();
   x.fillStyle='#9fb3c8';x.font='600 17px sans-serif';
   st.rw.names.forEach((nm,i)=>{const cx=W/2+(i-1)*o.spacing*ppu;x.textAlign='center';x.fillText(nm,cx,y+21);});x.textAlign='left';x.fillText(st.rw.label,12,y+21);
   x.drawImage(im,0,y+lh);y+=hh+lh;
  }
  out[vname]=c.toDataURL('image/png');
 }
 // classes side by side (T0, T1, T2 rows), same scale: the direct class ladder
 if(o.ladder){
  const c=document.createElement('canvas'),hh=Math.round(ppu*2.6),lh=30;c.width=W;c.height=3*(hh+lh)+44;const x=c.getContext('2d');x.fillStyle='#0a0e17';x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#dfe7f2';x.font='600 20px sans-serif';x.fillText(o.title+' — class ladder per tier, one fixed scale',12,28);let y=44;
  for(let t=0;t<3;t++){const specs=['scout','vanguard','titan'].map(cls=>S(cls,t));const st=strip(specs,o.ladder,ppu,W,hh,{spacing:o.spacing,weapon:o.weapon,cy:.55});
   const im=new Image();im.src=st.img;await im.decode();x.fillStyle='#9fb3c8';x.font='600 17px sans-serif';
   ['scout','vanguard','titan'].forEach((cls,i)=>{x.textAlign='center';x.fillText(CN[cls][t],W/2+(i-1)*o.spacing*ppu,y+21);});x.textAlign='left';x.fillText('TIER '+t,12,y+21);
   x.drawImage(im,0,y+lh);y+=hh+lh;}
  out['ladder-'+o.ladder]=c.toDataURL('image/png');
 }
 r.dispose();Equipment3D.enabled=hfWas;
 return {out,meas};
}"""
async def main():
    start_dev()
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,900,900,init="window.LUNAR_NO_AUTOGFX=1;")
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=20000)
        await pg.wait_for_function("()=>typeof Equipment3D==='undefined'||!Equipment3D.enabled||Equipment3D.status(Equipment3D.quality)!=='loading'",timeout=20000)
        hf=await pg.evaluate("()=>typeof Equipment3D!=='undefined'&&Equipment3D.active()")
        print('HF active',hf)
        jobs=[
          ('world-chassis',dict(title='BATTLE SIZE, chassis only',mode='world',weapon=False,ring=True,views=['iso','side','front','top','battle'],w=1500,ppu=150,spacing=3.2,ladder='iso')),
          ('world-moonbeam',dict(title='BATTLE SIZE + Moonbeam',mode='world',weapon=True,arch='moon',views=['iso','side'],w=1500,ppu=150,spacing=3.2,ladder='side')),
          ('world-pulse',dict(title='BATTLE SIZE + Pulse Cannon',mode='world',weapon=True,arch='pulse',views=['iso'],w=1500,ppu=150,spacing=3.2)),
          ('world-lunar',dict(title='BATTLE SIZE, Lunar Skin',mode='world',weapon=True,arch='moon',lunar=True,views=['iso'],w=1500,ppu=150,spacing=3.2)),
          ('world-vault-fittings',dict(title='BATTLE SIZE, gold tooth (Vault) + fittings',mode='world',weapon=True,arch='siege',vt=2,fits={'hull':'plates','mobility':'stable','mount':'hardened'},views=['iso'],w=1500,ppu=150,spacing=3.2)),
          ('world-paint-ember',dict(title='BATTLE SIZE, Ember paint + Twin Repeater',mode='world',weapon=True,arch='twin',paint='ember',views=['iso'],w=1500,ppu=150,spacing=3.2)),
          ('world-fallback',dict(title='BATTLE SIZE, fallback renderer (HF off / ghost path)',mode='world',weapon=True,arch='pulse',foundation=True,views=['iso','top'],w=1500,ppu=150,spacing=3.2)),
          ('model-chassis',dict(title='GARAGE/MENU SIZE (model space), chassis only',mode='model',weapon=False,views=['iso','side','top'],w=1500,ppu=120,spacing=4.0)),
        ]
        allm={}
        for name,o in jobs:
            res=await pg.evaluate(JS,o)
            for v,data in res['out'].items():
                open(OUT+name+'-'+v+'.png','wb').write(base64.b64decode(data.split(',',1)[1]))
            allm=res['meas']
        allm['_hf']=hf
        json.dump(allm,open(OUT+'measurements.json','w'),indent=1)
        for k,v in allm.items():
            if k.startswith('_'):continue
            print(f"{v['name']:9s} model len {v['model']['len']:.2f} wid {v['model']['wid']:.2f} hgt {v['model']['hgt']:.2f} ring {v['model']['ring']:.3f} | world len {v['world']['len']:.2f} wid {v['world']['wid']:.2f} hgt {v['world']['hgt']:.2f} nose {v['world']['noseFromCenter']:.2f} side {v['world']['sideFromCenter']:.2f} (class hit {v['hitRadius']})")
        print('errors',errs[:5])
        await b.close()
asyncio.run(main())
