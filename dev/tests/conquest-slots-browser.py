"""Session 5E-2d1 (owner, Nov 19): a Meshy model listed for a slot replaces the code-built model, in the real game.
Shipped client (index.html, local economy), real renderer, HIGH:
 1. by default every world slot is code-built (no slot draw in the colony, the farm batch holds the two grain silos)
 2. ConquestWorldKit.swap('settler-silo','town-storage') = what editing "model" in js/conquest/slots.js does: the world redraws,
    the two silos leave the merged farm batch and stand as one instanced draw of the owner's Meshy storage depot, each fitted
    inside the silo's own box (7 x 7 footprint, the lot's height) and standing on the ground; collision is untouched
 3. clearing it brings the code-built silos back, triangle for triangle
 4. the same for an instanced kind (tree-conifer -> town-shield -> back): the forest's conifer draw becomes the Meshy model
Software GL: behaviour only."""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session5e2d1/slots';OUT.mkdir(parents=True,exist_ok=True)
STAT='''(()=>{const v=Conquest.view,S=v.style,tri=m=>m&&m.geometry?(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1):0,out={slots:[],farm:0,programs:v.renderer.info.programs.length,rebuilds:v.kitRebuilds||0};
 for(const G of [v.colony,v.terra])if(G)G.traverse(o=>{if(o.name==='cq-colony-farm')out.farm=tri(o);if(o.isInstancedMesh&&o.userData.slot&&o.material!==S.MAT.solid){const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox,M=new THREE.Matrix4(),p=new THREE.Vector3(),inst=[];
   for(let i=0;i<o.count;i++){o.getMatrixAt(i,M);const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){p.set(x,y,z).applyMatrix4(M);[p.x,p.y,p.z].forEach((q,k)=>{lo[k]=Math.min(lo[k],q);hi[k]=Math.max(hi[k],q);});}inst.push({lo,hi});}
   out.slots.push({slot:o.userData.slot,count:o.count,meshy:!!o.userData.meshyTown,inst:inst.slice(0,4)});}});return out;})()'''
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  ctx=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True,reduced_motion='reduce')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_STYLE_QUALITY="high";try{localStorage.setItem("lunar-conquest-onboarding-v1","1")}catch(e){}')
  async def route(r):
   u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
   if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
   await r.abort()
  await page.route('**/*',route)
  await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof closeAll==="function"')
  await page.evaluate('closeAll();save.welcomed=true;save.gfx="high";uiDirty();');await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
  await page.wait_for_function('typeof Conquest!=="undefined"&&!!Conquest.view',timeout=120000)
  if await page.locator('.cq-transmission').count():await page.locator('.cq-story-start').click()
  await page.wait_for_function('Conquest.view.pending===0&&!!Conquest.view.colony',timeout=240000)
  silos=await page.evaluate('ConquestWorld.COLONY.lots.filter(l=>l.k==="silo").map(l=>({x:l.x,z:l.z,w:l.w,d:l.d,h:l.h,g:ConquestWorld.groundAt(l.x,l.z)}))');assert len(silos)==2,silos
  await page.evaluate('(()=>{const v=Conquest.view;v.jump(919,1097);v.yaw=Math.atan2(0,1);v.pitch=.2;v.distance=24;v.camSnap=true;})()');await page.wait_for_timeout(1500)
  R={};R['code']=a=await page.evaluate(STAT);assert a['farm']>2000 and not a['slots'],('every world slot is code-built by default',a)
  solid=await page.evaluate('[ConquestWorld.solidAt(919,1080),ConquestWorld.solidAt(919,1090)]')
  await page.screenshot(path=str(OUT/'silo-code-built.png'))
  # ---- 2: list the owner's Meshy storage depot for the silo slot ----
  await page.evaluate('ConquestWorldKit.swap("settler-silo","town-storage")')
  await page.wait_for_function('(()=>{let n=0;Conquest.view.colony&&Conquest.view.colony.traverse(o=>{if(o.isInstancedMesh&&o.userData.slot==="settler-silo"&&o.userData.meshyTown)n=o.count;});return n===2;})()',timeout=180000)
  await page.wait_for_timeout(1200);R['swapped']=b=await page.evaluate(STAT);await page.screenshot(path=str(OUT/'silo-swapped-to-meshy-storage.png'))
  s=[x for x in b['slots'] if x['slot']=='settler-silo'];assert len(s)==1 and s[0]['count']==2 and s[0]['meshy'],('one instanced draw of the Meshy model for the slot',b['slots'])
  assert b['farm']<a['farm']-1500,('the code-built silos left the merged farm batch',a['farm'],b['farm'])
  for inst in s[0]['inst']:
   lot=min(silos,key=lambda l:abs((inst['lo'][0]+inst['hi'][0])/2-l['x'])+abs((inst['lo'][2]+inst['hi'][2])/2-l['z']));cx=(inst['lo'][0]+inst['hi'][0])/2;cz=(inst['lo'][2]+inst['hi'][2])/2
   assert abs(cx-lot['x'])<.6 and abs(cz-lot['z'])<.6,('centred on the slot',inst,lot)
   # the lot is turned 0.15 rad: its 7 x 7 box seen axis-aligned is at most 7 * (cos + sin) wide
   assert inst['hi'][0]-inst['lo'][0]<=7*1.14+.1 and inst['hi'][2]-inst['lo'][2]<=7*1.14+.1,('inside the slot footprint',inst)
   assert abs(inst['lo'][1]-lot['g'])<.25 and inst['hi'][1]-inst['lo'][1]<=lot['h']+.1 and inst['hi'][1]-inst['lo'][1]>2,('standing on the ground, inside the slot height',inst,lot)
  assert await page.evaluate('[ConquestWorld.solidAt(919,1080),ConquestWorld.solidAt(919,1090)]')==solid,'collision comes from the slot, never from the model'
  # ---- 3: clear it: the code-built silos are back, triangle for triangle ----
  await page.evaluate('ConquestWorldKit.swap("settler-silo",null)')
  await page.wait_for_function('(()=>{let n=0;Conquest.view.colony&&Conquest.view.colony.traverse(o=>{if(o.isInstancedMesh&&o.userData.slot==="settler-silo"&&o.userData.meshyTown)n++;});return n===0&&!!Conquest.view.colony;})()',timeout=60000)
  await page.wait_for_timeout(800);R['back']=c=await page.evaluate(STAT);assert c['farm']==a['farm'] and not [x for x in c['slots'] if x['slot']=='settler-silo'],('swapping back restores the code-built model exactly',a['farm'],c)
  # ---- 4: an instanced kind ----
  await page.evaluate('ConquestWorldKit.swap("tree-conifer","town-shield")')
  await page.wait_for_function('(()=>{let n=0;Conquest.view.terra&&Conquest.view.terra.traverse(o=>{if(o.isInstancedMesh&&o.userData.slot==="tree-conifer"&&o.userData.meshyTown)n+=o.count;});return n>20;})()',timeout=180000)
  await page.evaluate('(()=>{const v=Conquest.view;v.jump(998,1216);v.yaw=Math.atan2(1,0);v.pitch=.24;v.distance=26;v.camSnap=true;})()');await page.wait_for_timeout(1500)
  R['trees']=d=await page.evaluate(STAT);await page.screenshot(path=str(OUT/'conifers-swapped-to-meshy-shield.png'))
  t=[x for x in d['slots'] if x['slot']=='tree-conifer'];assert t and all(x['meshy'] for x in t),('the forest conifer draws are the Meshy model',d['slots'])
  for x in t:
   for inst in x['inst']:assert inst['hi'][1]-inst['lo'][1]<=7.6*1.6 and inst['hi'][0]-inst['lo'][0]<=4.6*1.9,('each tree instance keeps the slot box at its own scale',inst)
  await page.evaluate('ConquestWorldKit.swap("tree-conifer",null)')
  await page.wait_for_function('(()=>{let n=0;Conquest.view.terra&&Conquest.view.terra.traverse(o=>{if(o.isInstancedMesh&&o.userData.meshyTown)n++;});return n===0&&!!Conquest.view.terra;})()',timeout=60000)
  R['end']=await page.evaluate(STAT);assert not R['end']['slots'],R['end']
  assert not errors,errors
  (OUT/'results.json').write_text(json.dumps(R,indent=1));await browser.close()
  print('PASS conquest-slots-browser: settler-silo -> the owner\'s Meshy storage depot and back (farm batch '+str(a['farm'])+' -> '+str(b['farm'])+' -> '+str(c['farm'])+' triangles, 2 instances fitted in the slot box on the ground, collision unchanged); tree-conifer -> Meshy shield and back ('+str(sum(x['count'] for x in t))+' instances); programs '+str(a['programs'])+' / '+str(b['programs'])+' / '+str(R['end']['programs'])+'; rebuilds '+str(R['end']['rebuilds']))
asyncio.run(main())
