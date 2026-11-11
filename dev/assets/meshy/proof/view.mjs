// Scripted studio shots of pipeline outputs through the game's own Meshy3D materials.
// node dev/assets/meshy/proof/view.mjs <built-dir> <out-dir> <shots.json | inline JSON array>
// shot: {name, parts:[{id,q,paint,lunar,pos,yaw,low,ch}], w,h, cam:{yaw,pitch,dist,target,fov}, ch:{driveL:..}}
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..'),[built,out,spec]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});const shots=JSON.parse(fs.existsSync(spec)?fs.readFileSync(spec,'utf8'):spec);
const mime={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]),f=u.startsWith('/__built/')?path.join(built,u.slice(9)):path.join(root,u);
 fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});s.end(d);});});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('page:',m.text());});page.on('pageerror',e=>console.log('pageerror',e.message));
await page.goto(`http://127.0.0.1:${port}/dev/assets/meshy/proof/viewer.html`);await page.waitForFunction('window.ready');
for(const s of shots){for(const p of s.parts)await page.evaluate(([i,q])=>load(i,q),[p.id,p.q||'light']);
 const url=await page.evaluate(x=>shot(x),s);fs.writeFileSync(path.join(out,s.name+'.png'),Buffer.from(url.split(',')[1],'base64'));console.log(s.name);}
await browser.close();srv.close();
