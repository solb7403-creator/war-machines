"""The consumables' icons (Session 5E-2d2; the 5E addendum's "drop sprites for consumables: four 64 px icons rendered from
simple meshes"). Renders the four item models (js/conquest/kit/items.js, slots item-*) with the game's own Conquest style
shaders and lights on a transparent background and writes img/conquest/item-<key>.png at 128 px (a 64 px icon at 2x).
Run it again whenever an item model changes: python3 dev/tests/conquest-item-sprites.py [--check]
--check renders and compares with the committed files (a tolerance: software GL differs a little between machines)."""
import asyncio,base64,io,pathlib,shutil,sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'img/conquest';ITEMS=['repair','shield','scanner','decoy'];PX=128
PAGE='''<!doctype html><meta charset=utf-8><body style="margin:0;background:transparent">
<script src="/js/vendor/three.lunar.min.js"></script><script src="/js/rules.js"></script><script src="/js/conquest/world.js"></script><script src="/js/conquest/combat.js"></script>
<script src="/js/conquest/slots.js"></script><script src="/js/conquest/worldkit.js"></script><script src="/js/conquest/kit/items.js"></script>
<script>/* the other kit files are not needed for four props: grey placeholders keep the style whole */for(const id in ConquestSlots.items)if(!ConquestWorldKit.MODELS[id])ConquestWorldKit.model(id,(b,o)=>b.box(0,0,0,o.w||1,o.h||1,o.d||1,b.k.mat(0x808080)));</script>
<script src="/js/conquest/style.js"></script>
<script>
const T=THREE,PX=__PX__,R=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});R.setSize(PX*2,PX*2,false);R.setPixelRatio(1);R.setClearColor(0x000000,0);
window.shoot=function(id){const S=ConquestStyle.create(T,{low:false}),K=ConquestWorldKit.kit(S),scene=new T.Scene();S.environment(scene,R);scene.traverse(o=>{if(o.isMesh)o.visible=false;});   // lights only: no sky, no ground
 const ox=1500,oz=700;S.U.uOrigin.value.set(ox,oz);S.U.uAtmo.value=0;const box=ConquestSlots.items[id].size,main=new S.Bld(),det=new S.Bld();K.place(id,{main,det},new T.Matrix4(),{w:box[0],h:box[1],d:box[2],seed:1});
 const g=new T.Group();g.add(main.mesh(),det.mesh());scene.add(g);const rad=Math.max(box[0],box[1],box[2])*.5+.12,cam=new T.PerspectiveCamera(30,1,.1,100),dist=rad/Math.tan(15*Math.PI/180)*1.08,yaw=.62,pitch=.42;
 cam.position.set(Math.sin(yaw)*Math.cos(pitch)*dist,box[1]/2+Math.sin(pitch)*dist,Math.cos(yaw)*Math.cos(pitch)*dist);cam.lookAt(0,box[1]/2,0);
 S.update(0,1.3,{origin:{x:ox,z:oz},p:{x:ox,z:oz},renderer:R});S.U.uOrigin.value.set(ox,oz);S.viewLights(cam);scene.background=null;scene.fog=null;R.setClearColor(0x000000,0);R.clear();R.render(scene,cam);
 // 2x supersample down to PX with a soft dark rim so the icon reads on any panel
 const c=document.createElement('canvas');c.width=c.height=PX;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.shadowColor='rgba(0,0,0,.55)';x.shadowBlur=PX/22;x.drawImage(R.domElement,0,0,PX,PX);const out=c.toDataURL('image/png');S.dispose();return out;};
</script>'''.replace('__PX__',str(PX))
async def main():
 check='--check' in sys.argv;OUT.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=await browser.new_page(viewport={'width':300,'height':300});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.path=='/sprites.html':return await r.fulfill(body=PAGE,content_type='text/html')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route);await page.goto('https://lunar.test/sprites.html');await page.wait_for_function('typeof shoot==="function"')
  bad=[]
  for k in ITEMS:
   data=base64.b64decode((await page.evaluate('shoot("item-%s")'%k)).split(',')[1]);f=OUT/('item-%s.png'%k)
   if check:
    from PIL import Image
    a=Image.open(io.BytesIO(data)).convert('RGBA');b=Image.open(f).convert('RGBA');assert a.size==b.size==(PX,PX),(k,a.size,b.size)
    d=sum(abs(x-y) for x,y in zip(a.tobytes(),b.tobytes()))/(PX*PX*4)
    if d>6:bad.append((k,round(d,2)))
   else:f.write_bytes(data)
   print(k,len(data),'bytes')
  assert not errors,errors;assert not bad,('icons differ from the item models: re-run without --check',bad)
  await browser.close()
 print('PASS conquest-item-sprites'+(' --check' if check else ': written to img/conquest/'))
asyncio.run(main())
