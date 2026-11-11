// Sharpness before/after (Session 5E-2a): render resolution, anti-aliasing, frame time and memory in the real app (index.html,
// local economy, no network) for an Arcade battle and the Conquest world, on two profiles:
//   desktop 1920x1080 (device ratio 1 and 2)  and  mid phone 390x844 at 3x, touch, CPU throttled 4x.
// The page is told it runs on a GPU (the WebGL renderer string is spoofed) so the CPU-rasterizer fallback does not hide what a
// real device gets; frame times are still SwiftShader numbers (relative before/after on the same machine, never phone FPS).
//   node dev/assets/meshy/proof/sharpness.mjs <checkout root> <label> <out.json>
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const [root,label,outFile]=process.argv.slice(2);if(!root||!outFile){console.log('usage: sharpness.mjs <root> <label> <out.json>');process.exit(2);}
// framebufferMB: colour + depth (8 bytes a pixel), plus the multisample buffers when anti-aliased (an estimate of GPU memory)
const PROFILES=[{name:'desktop-1920',viewport:{width:1920,height:1080},deviceScaleFactor:1},{name:'desktop-1920-retina',viewport:{width:1920,height:1080},deviceScaleFactor:2,noConquest:true},
 {name:'mid-phone-390',viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,throttle:4}];
const SPOOF=`(()=>{for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){if(p===0x9246)return 'ANGLE (Apple, Apple M-series GPU, OpenGL 4.1)';if(p===0x1F01)return 'WebKit WebGL';return g.call(this,p);};}})();`;
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const report={label,root:path.resolve(root),environment:'Chromium + SwiftShader (software GL) with a GPU renderer string; index.html, local economy',profiles:{}};
async function page(P,gfx){
 const ctx=await browser.newContext({viewport:P.viewport,deviceScaleFactor:P.deviceScaleFactor,isMobile:!!P.isMobile,hasTouch:!!P.hasTouch,reducedMotion:'reduce'});
 await ctx.addInitScript(SPOOF+`window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;try{const s=JSON.parse(localStorage.getItem('lunar')||'null');}catch(e){}`);
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());const f=path.join(root,decodeURIComponent(u.pathname));if(u.host==='lunar.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({path:f});return r.abort();});
 const pg=await ctx.newPage();const errors=[];pg.on('pageerror',e=>errors.push(String(e)));
 await pg.goto('https://lunar.test/index.html');await pg.waitForFunction(()=>typeof save!=='undefined'&&typeof setGfx==='function',null,{timeout:60000});
 await pg.evaluate(g=>{save.welcomed=true;closeAll();setGfx(g);},gfx);
 if(P.throttle){const cdp=await ctx.newCDPSession(pg);await cdp.send('Emulation.setCPUThrottlingRate',{rate:P.throttle});}
 return {ctx,pg,errors};
}
const mem=pg=>pg.evaluate(()=>({jsHeapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null}));
for(const P of PROFILES){
 const R=report.profiles[P.name]={};
 const guard=async(k,fn)=>{try{await fn();}catch(e){R[k]={error:String(e.message||e).split('\n')[0]};}};
 // ---- Arcade battle, manual HIGH (fixed ceiling) ----
 await guard('battleHigh',async()=>{const {ctx,pg,errors}=await page(P,'high');
  await pg.evaluate(()=>{save.mode='1v1';save.gtype='arena';prepareMatch();startMatch();});await pg.waitForFunction(()=>typeof RR!=='undefined'&&RR&&state==='play',null,{timeout:60000});await pg.waitForTimeout(4000);
  R.battleHigh=await pg.evaluate(()=>{const gl=RR.getContext(),t=[];for(let i=0;i<24;i++){const a=performance.now();drawBattle();gl.finish();t.push(performance.now()-a);}t.sort((a,b)=>a-b);const at=gl.getContextAttributes(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,ms=at.antialias?(gl.getParameter(gl.SAMPLES)||4):1;
   return {pixelRatio:RR.getPixelRatio(),antialias:at.antialias,samples:ms,drawingBuffer:[w,h],framebufferMB:+(w*h*8*(1+(at.antialias?ms:0))/1048576).toFixed(1),frameMsMedian:+t[12].toFixed(2),frameMsP90:+t[21].toFixed(2),calls:RR.info.render.calls,textures:RR.info.memory.textures};});
  Object.assign(R.battleHigh,await mem(pg),{errors});await ctx.close();});
 // ---- Arcade battle, AUTO: the governor's path over 20 s ----
 await guard('battleAuto',async()=>{const {ctx,pg,errors}=await page(P,'auto');
  await pg.evaluate(()=>{save.mode='1v1';save.gtype='arena';prepareMatch();startMatch();});await pg.waitForFunction(()=>typeof RR!=='undefined'&&RR&&state==='play',null,{timeout:60000});
  const path_=[];for(let i=0;i<10;i++){await pg.waitForTimeout(2000);path_.push(await pg.evaluate(()=>({q:R3.q,pr:RR.getPixelRatio()})));}
  R.battleAuto={startQuality:path_[0].q,ratioEvery2s:path_.map(x=>x.pr),qualityEvery2s:path_.map(x=>x.q),errors};await ctx.close();});
 // ---- Conquest world, manual HIGH ----
 if(!P.noConquest)await guard('conquestHigh',async()=>{const {ctx,pg,errors}=await page(P,'high');
  await pg.locator('[data-act="conquest"]').click();await pg.getByRole('button',{name:'ENTER CONQUEST',exact:true}).click();
  await pg.waitForFunction(()=>typeof Conquest!=='undefined'&&Conquest.view,null,{timeout:120000});
  if(await pg.locator('.cq-transmission').count())await pg.locator('.cq-story-start').click();
  await pg.waitForFunction(()=>Conquest.view.pending===0,null,{timeout:300000});await pg.waitForTimeout(6000);
  R.conquestHigh=await pg.evaluate(()=>{const v=Conquest.view,r=v.renderer,gl=r.getContext(),at=gl.getContextAttributes(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,ms=at.antialias?(gl.getParameter(gl.SAMPLES)||4):1,p=v.performanceReport();
   return {pixelRatio:r.getPixelRatio(),antialias:at.antialias,samples:ms,drawingBuffer:[w,h],framebufferMB:+(w*h*8*(1+(at.antialias?ms:0))/1048576).toFixed(1),frameMsMedian:p.frameMedian&&+p.frameMedian.toFixed(1),frameMsP95:p.frameP95&&+p.frameP95.toFixed(1),drawCalls:p.drawCalls,programs:p.programs,textures:p.textures,heapMB:p.heapBytes?+(p.heapBytes/1048576).toFixed(1):null,autoLow:p.autoLow};});
  R.conquestHigh.errors=errors;await ctx.close();});
 console.log(label,P.name,JSON.stringify(R));fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(report,null,1));
}
fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(report,null,1));await browser.close();
