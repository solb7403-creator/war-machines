"""World-kit model viewer (Session 5E-2d1): renders code-built slot models (js/conquest/kit/*.js) with the game's own
Conquest style shaders and lights, outside the game, so a model can be judged and iterated quickly.
One sheet per slot: HIGH from two angles + a game-distance view, and the LOW model, side by side, plus triangle counts.
usage: python3 dev/tests/conquest-kit-viewer.py [--slots a,b,c | --faction settler] [--out DIR] [--day 0|1] [--params JSON] [--seeds 1,2]
Software GL: relative look only."""
import argparse,asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
import sys
KIT=sorted(p.name for p in (ROOT/'js/conquest/kit').glob('*.js'))
if '--kit' in sys.argv:KIT=[k for k in KIT if k in sys.argv[sys.argv.index('--kit')+1].split(',')]   # only these kit files (others may be mid-edit)
PAGE='''<!doctype html><meta charset=utf-8><body style="margin:0;background:#111"><canvas id=sheet></canvas>
<script src="/js/vendor/three.lunar.min.js"></script><script src="/js/rules.js"></script><script src="/js/conquest/world.js"></script><script src="/js/conquest/combat.js"></script>
<script src="/js/conquest/slots.js"></script><script src="/js/conquest/worldkit.js"></script>'''+''.join(f'<script src="/js/conquest/kit/{k}"></script>' for k in KIT)+'''<script>/* --kit: a kit file left out (it may be mid-edit) gets grey placeholder models so the style still builds */for(const id in ConquestSlots.items)if(!ConquestWorldKit.MODELS[id])ConquestWorldKit.model(id,b=>b.box(0,0,0,.3,.3,.3,b.k.mat(0x808080)));</script><script src="/js/conquest/style.js"></script>
<script>
const T=THREE,CELL=460;const R=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R.setSize(CELL,CELL,false);R.setPixelRatio(1);
window.shoot=function(id,o,day,seed){const sheet=document.getElementById('sheet'),x2=sheet.getContext('2d');sheet.width=CELL*4;sheet.height=CELL+26;x2.fillStyle='#14161a';x2.fillRect(0,0,sheet.width,sheet.height);const info={};
 const views=[['high',.62,.42,1.0],['high',-2.35,.3,1.0],['high',.9,.5,2.6],['low',.62,.42,1.0]];
 for(const q of ['high','low']){const S=ConquestStyle.create(T,{low:q==='low'}),K=ConquestWorldKit.kit(S),scene=new T.Scene();S.environment(scene,R);
  // inside a terraformed zone (daylight) or on the barren Moon: the solid shader reads the zone from the world position
  const ox=day?990:1500,oz=day?1300:700;S.U.uOrigin.value.set(ox,oz);S.U.uAtmo.value=day?1:0;S.atmoApply&&S.atmoApply(scene,200,900);
  const box=ConquestSlots.items[id].size,par=Object.assign({w:box[0],h:box[1],d:box[2],seed:seed||1},o||{});
  const main=new S.Bld(),det=new S.Bld(),fx=new S.Fx();const b=K.place(id,{main,det,fx},new T.Matrix4(),par);
  const g=new T.Group();g.add(main.mesh(),det.mesh(),fx.mesh());scene.add(g);
  const gr=new S.Bld(),gm=day?K.mat(0x4a5a2c,'leaf',0):K.mat(0x3a3c42,'rock',0),e=Math.max(par.w,par.d)*3+30;const kb=new K.KB({aoH:.01,aoMin:1});kb.k=K;kb.quad([-e,-.02,-e],[e,-.02,-e],[e,-.02,e],[-e,-.02,e],gm,[0,-5,0]);
  const gg=new S.Bld();(function(){const src=kb.buf.main;for(let i=0;i<src.n;i++){gg.P.push(src.P[i*3],src.P[i*3+1],src.P[i*3+2]);gg.N.push(0,1,0);gg.A.push(src.A[i*4],src.A[i*4+1],src.A[i*4+2],src.A[i*4+3]);}gg.I.push(0,2,1,0,3,2);gg.n=4;})();scene.add(gg.mesh());
  const bb=new T.BufferGeometry();let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const src of [b.buf.main,b.buf.det])for(let i=0;i<src.n;i++)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],src.P[i*3+k]);hi[k]=Math.max(hi[k],src.P[i*3+k]);}
  info[q]={tris:b.tris(),main:b.tris('main'),det:b.tris('det'),box:lo.map(v=>+v.toFixed(2)).concat(hi.map(v=>+v.toFixed(2)))};
  const cx=(lo[0]+hi[0])/2,cy=(lo[1]+hi[1])/2,cz=(lo[2]+hi[2])/2,rad=Math.max(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])*.5+.5;
  views.forEach(([vq,yaw,pitch,dk],i)=>{if(vq!==q)return;const cam=new T.PerspectiveCamera(34,1,.1,3000),dist=rad/Math.tan(17*Math.PI/180)*1.12*dk;cam.position.set(cx+Math.sin(yaw)*Math.cos(pitch)*dist,cy+Math.sin(pitch)*dist,cz+Math.cos(yaw)*Math.cos(pitch)*dist);cam.lookAt(cx,cy,cz);
   S.update(0,1.3,{origin:{x:ox,z:oz},p:{x:ox,z:oz},renderer:R});S.U.uOrigin.value.set(ox,oz);S.viewLights(cam);R.render(scene,cam);x2.drawImage(R.domElement,i*CELL,0,CELL,CELL);});
  info.programs=R.info.programs.length;S.dispose();}
 x2.fillStyle='#cfd6dd';x2.font='13px monospace';x2.fillText(id+'  seed '+(seed||1)+'  '+(day?'terraformed day':'barren Moon')+'   HIGH '+info.high.tris+' tris (main '+info.high.main+' + detail '+info.high.det+')   LOW '+info.low.tris+' tris   box '+info.high.box.join(' ')+'   slot '+ConquestSlots.items[id].size.join(' x '),8,CELL+18);
 x2.fillStyle='#8aa';['HIGH front','HIGH back','HIGH at game distance','LOW front'].forEach((t,i)=>x2.fillText(t,i*CELL+8,16));return info;};
</script>'''
async def main(a):
 out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=await browser.new_page(viewport={'width':1840,'height':500});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:m.type=='error' and errors.append(m.text))
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.path=='/viewer':return await r.fulfill(body=PAGE,content_type='text/html')
   if f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route);await page.goto('https://lunar.test/viewer');await page.wait_for_function('typeof shoot==="function"&&typeof ConquestWorldKit!=="undefined"')
  slots=await page.evaluate('Object.entries(ConquestSlots.items).filter(([id])=>ConquestWorldKit.MODELS[id]).map(([id,s])=>[id,s.faction])')
  want=[i for i,f in slots if (not a.slots or i in a.slots.split(',')) and (not a.faction or f==a.faction)]
  res={}
  for sid in want:
   for seed in [int(s) for s in a.seeds.split(',')]:
    day=a.day if a.day is not None else (1 if dict(slots)[sid] in ('settler','nature','wreck') else 0)
    try:info=await page.evaluate('([id,o,day,seed])=>shoot(id,o,day,seed)',[sid,json.loads(a.params),day,seed])
    except Exception as e:print('FAIL',sid,str(e)[:600]);errors.append(sid);continue
    await page.locator('#sheet').screenshot(path=str(out/f'{sid}{"-s"+str(seed) if seed!=1 else ""}.png'));res[sid]=info;print(sid,seed,json.dumps(info),flush=True)
  print('errors',errors[:6]);await browser.close()
ap=argparse.ArgumentParser();ap.add_argument('--slots',default='');ap.add_argument('--faction',default='');ap.add_argument('--out',default='/tmp/cq-kit');ap.add_argument('--day',type=int,default=None);ap.add_argument('--params',default='{}');ap.add_argument('--seeds',default='1');ap.add_argument('--kit',default='')
asyncio.run(main(ap.parse_args()))
