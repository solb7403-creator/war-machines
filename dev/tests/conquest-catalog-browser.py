"""Supplemental actual catalog art preview. This is NOT a gameplay journey or phone GPU test."""
import asyncio,json,pathlib
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/conquest-session-2/catalog'
async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':900,'height':1100},device_scale_factor=1,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content('<style>body{background:#0a1420;color:#dfd9c6;font:13px sans-serif;margin:10px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.card{background:#162736;padding:5px;border:1px solid #456}canvas{width:100%;height:175px}p{min-height:30px}</style><h1>LUNAR · Permanent earned cosmetic art previews</h1><p>Actual Three.js runtime geometry. Supplemental catalog preview, not an in-game screenshot. Checkout disabled.</p><main></main>')
  await page.add_script_tag(path=str(ROOT/'js/vendor/three.lunar.min.js'));await page.add_script_tag(path=str(ROOT/'js/conquest/catalog.js'))
  results=await page.evaluate('''()=>{
   const T=THREE,r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(220,175);r.setPixelRatio(1);r.setClearColor(0x102130,1);const results=[];
   for(const i of ConquestCatalog.items){const s=new T.Scene(),c=new T.PerspectiveCamera(45,220/175,.1,200),g=ConquestCatalog.build(T,i.id,{low:true,reducedMotion:true});s.add(g);s.add(new T.HemisphereLight(0xecf4ff,0x273444,2));const l=new T.DirectionalLight(0xffedc9,3);l.position.set(20,40,15);s.add(l);let pos=i.slot==='base'?[45,33,47]:i.slot==='armor'?[9,8,10]:i.slot==='trail'?[8,6,9]:[10,9,12];c.position.set(...pos);c.lookAt(i.slot==='trail'?2:0,i.slot==='base'?4:i.slot==='commander'?3:1,0);r.render(s,c);const div=document.createElement('div');div.className='card';const canvas=document.createElement('canvas');canvas.width=220;canvas.height=175;canvas.getContext('2d').drawImage(r.domElement,0,0);div.append(canvas);const label=document.createElement('p');label.textContent=i.name+' · '+i.earnText;div.append(label);document.querySelector('main').append(div);results.push({id:i.id,calls:r.info.render.calls,triangles:r.info.render.triangles,geometries:r.info.memory.geometries,glError:r.getContext().getError()});const geometries=new Set,materials=new Set;g.traverse(m=>{if(m.geometry)geometries.add(m.geometry);if(m.material)materials.add(m.material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
   const after={...r.info.memory};r.dispose();return {results,after};}''')
  assert not errors,errors
  assert all(r['glError']==0 for r in results['results']),results
  assert results['after']['geometries']==0,results
  await page.screenshot(path=str(OUT/'twenty-threejs-previews.png'),full_page=True)
  for width in [320,390,430]:
   await page.set_viewport_size({'width':width,'height':844});await page.add_style_tag(content='main{grid-template-columns:repeat(2,1fr)}canvas{height:140px}');assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(OUT/f'catalog-{width}.png'),full_page=True)
  results.update(environment='Headless Chromium SwiftShader software renderer; NOT physical iPhone performance or in-game gameplay proof',errors=errors)
  (OUT/'budgets.json').write_text(json.dumps(results,indent=2));await browser.close();print('PASS actual Three render of all20 products; 320/390/430 previews; zero GL errors; geometry allocations return to zero; checkout disabled')
asyncio.run(main())
