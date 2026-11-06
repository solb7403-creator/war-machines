"""Real vendored Three.js + downloaded GLB smoke at phone and desktop sizes."""
from pathlib import Path
import subprocess, json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
server=subprocess.Popen(['python3','-m','http.server','8769','--bind','127.0.0.1'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
out=root/'docs/conquest-session-2-assets';out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  evidence=[]
  for width in [390,1280]:
   page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8769/dev/assets/conquest/preview.html');page.wait_for_function('window.assetReady===true')
   for name in ['command','raid','smoke']:
    page.select_option('#asset',name);page.wait_for_function('window.assetReady===true');page.screenshot(path=str(out/f'{name}-{width}.png'))
    stats=page.evaluate('window.assetStats');assert stats['triangles']>12;assert not errors,errors
    evidence.append({'viewport':width,'asset':name,'renderer':'Chromium SwiftShader software','stats':stats})
   page.close()
  browser.close()
 (out/'browser-proof.json').write_text(json.dumps(evidence,indent=2)+'\n')
 print('Three.js GLB smoke/command/raid renders PASS at 390/1280; software GPU, not physical iPhone')
finally:server.terminate();server.wait()
