// Gate 1 harness: renders original vs LIGHT vs FULL in the game's own Three.js build and writes PNGs.
// node dev/assets/meshy/proof/gate.mjs <item-id> <built-dir> <source-glb> <out-dir>
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..'),[id,built,source,out]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]),f=u.startsWith('/__built/')?path.join(built,u.slice(9)):u==='/__source.glb'?source:path.join(root,u);
 fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});s.end(d);});});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
const manifest=JSON.parse(fs.readFileSync(path.join(built,'manifest.json'))),rec=manifest.items[id];
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
page.on('console',m=>{if(m.type()==='error')console.log('page error:',m.text());});page.on('pageerror',e=>console.log('pageerror',e.message));
await page.goto(`http://127.0.0.1:${port}/dev/assets/meshy/proof/gate.html`);await page.waitForFunction('window.ready');
const info={};
info.original=await page.evaluate(([m])=>load('original','/__source.glb',m,false),[rec.sourceToGame]);
info.light=await page.evaluate(([i])=>load('light',`/__built/${i}-light.glb`,null,true),[id]);
info.full=await page.evaluate(([i])=>load('full',`/__built/${i}-full.glb`,null,true),[id]);
// sizes: [name, w, h, pxPerUnit, elevation]; pxPerUnit for battle = arena 20 units across a 390 px phone at DPR 1.5, tank drawn x0.7x1.12
// each view is rendered supersampled (ss x ss) and box-filtered down by ssim.py, for the original and the baked models alike:
// a 2.9M-triangle original at 60 px is sub-pixel noise otherwise and no comparison against it means anything.
const L=rec.length||2.6,views=[['battle',160,160,390/20*1.5*.7*1.12,52,8],['garage',780,620,780*.86/L,24,3],['desktop',1920,1080,1920*.62/L,22,2]];
const yaws=[35,215];
for(const [vn,w,h,ppu,el,ss] of views)for(const yaw of yaws)for(const [name,mode] of [['original','flat'],['light','normal'],['full','normal'],['full','full']]){
 const url=await page.evaluate(a=>shot(...a),[name,mode,w*ss,h*ss,ppu*ss,yaw,el,[0,rec.height?rec.height/2:.4,0]]);
 fs.writeFileSync(path.join(out,`${id}_${vn}_${yaw}_${name}_${mode}.png`),Buffer.from(url.split(',')[1],'base64'));}
info.views=Object.fromEntries(views.map(v=>[v[0],{w:v[1],h:v[2],pxPerUnit:v[3],elevation:v[4],supersample:v[5]}]));fs.writeFileSync(path.join(out,`${id}_info.json`),JSON.stringify(info,null,1));console.log(JSON.stringify(info));
await browser.close();srv.close();
