// Dev-only: capture one style option's six subjects at 390x844 portrait and 1280x800 desktop, HIGH and LOW.
// usage: node dev/conquest-style/capture.mjs <option> [--subjects refuge,raid] [--views 390,1280] [--q high,low] [--out DIR]
// Output: <out>/<subject>-<width>-<quality>.jpg + stats.json (SwiftShader software GL: relative cost, not phone FPS).
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch(_){playwright=require('/opt/node-tools/node_modules/playwright');}
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),opt=args[0]||'current',flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const subjects=flag('subjects','refuge,raid,tank,enemy,props,map').split(','),views=flag('views','390,1280').split(',').map(Number),qualities=flag('q','high,low').split(',');
const out=path.resolve(flag('out',path.join(ROOT,'docs/conquest-graphics/phase1',opt)));fs.mkdirSync(out,{recursive:true});
const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.woff2':'font/woff2','.ttf':'font/ttf','.bin':'application/octet-stream','.ktx2':'image/ktx2','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://x').pathname),file=path.join(ROOT,p);if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/dev/conquest-style/lab.html';
const browser=await playwright.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--disable-accelerated-2d-canvas']});
const results=[];let failures=0;
try{
 for(const width of views){const mobile=width<600,viewport=mobile?{width:390,height:844}:{width:1280,height:800};
  for(const q of qualities)for(const subject of subjects){
   const context=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message||e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   const url=base+'?opt='+encodeURIComponent(opt)+'&subject='+subject+'&q='+q+'&t=3.2';const started=Date.now();
   try{await page.goto(url);await page.waitForFunction('window.labReady===true||!!window.labError',null,{timeout:240000});
    const err=await page.evaluate('window.labError||null');if(err)throw Error(err);
    const file=path.join(out,subject+'-'+width+'-'+q+'.jpg');await page.screenshot({path:file,type:'jpeg',quality:84});
    const stats=await page.evaluate('window.labStats');results.push({...stats,file:path.relative(ROOT,file),ms:Date.now()-started,errors});
    console.log('OK',opt,subject,width,q,JSON.stringify(stats));
   }catch(e){failures++;results.push({option:opt,subject,width,quality:q,error:String(e.message||e),errors});console.log('FAIL',opt,subject,width,q,String(e.message||e),errors.slice(0,3).join(' | '));}
   await context.close();}
 }
}finally{await browser.close();server.close();}
fs.writeFileSync(path.join(out,'stats.json'),JSON.stringify({option:opt,generated:new Date().toISOString(),renderer:'Chromium SwiftShader (software) in a cloud container; relative cost only, never iPhone FPS',results},null,1));
console.log(failures?'CAPTURE FINISHED WITH '+failures+' FAILURES':'CAPTURE OK',out);process.exit(failures?1:0);
