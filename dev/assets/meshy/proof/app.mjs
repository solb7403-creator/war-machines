// Real-app proof for the Meshy models: the website build + the fixture Worker (dev/tests/webserver.mjs), the game's own
// Garage (showroom) and Free Test battles, before (procedural) and after (Meshy), HIGH and LOW graphics.
//   node worker/build-web.mjs && node dev/assets/meshy/proof/app.mjs <out-dir> [garage,battle,paints,perf]
// Writes PNG captures plus app.json (load sizes and times, draw calls, triangles, frame times). Software GL (SwiftShader):
// frame times are comparisons on the same machine, never phone FPS.
import {spawn} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..'),out=process.argv[2],what=(process.argv[3]||'garage,battle,paints,perf').split(',');fs.mkdirSync(out,{recursive:true});
const LOADOUTS=[['scout',0,'pulse',0],['scout',1,'twin',0],['scout',2,'moon',2],['vanguard',0,'pulse',1],['vanguard',1,'twin',1],['vanguard',2,'siege',0],['titan',0,'siege',1],['titan',1,'pulse',2],['titan',2,'twin',2],['titan',2,'siege',2]];
const port=8797,srv=spawn('node',['dev/tests/webserver.mjs'],{cwd:root,env:{...process.env,LUNAR_STANDARD_VISUAL_FIXTURE:'1',LUNAR_LEGEND_VISUAL_FIXTURE:'1',LUNAR_FIXTURE_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);for(let i=0;i<150&&!log.includes('ready');i++)await new Promise(r=>setTimeout(r,200));
if(!log.includes('ready')){console.log('fixture failed',log);process.exit(1);}
const BASE='https://lunar.test',FIX='http://127.0.0.1:'+port,report={environment:'Chromium + SwiftShader (software GL), local fixture Worker, website build',runs:{}},errors=[];
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
async function session(meshy){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 await ctx.addInitScript('window.LUNAR_MESHY='+meshy+';');
 await ctx.route('**/*',async r=>{const u=r.request().url();if(!u.startsWith(BASE+'/'))return r.abort();try{await r.fulfill({response:await r.fetch({url:FIX+u.slice(BASE.length)})});}catch(e){r.abort().catch(()=>{});}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>errors.push((meshy?'after: ':'before: ')+e));pg.on('console',m=>{if(m.type()==='error')errors.push((meshy?'after: ':'before: ')+m.text());});
 await pg.goto(BASE+'/web/equipment-preview.html');
 await pg.evaluate(async()=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id:91002941})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('Fixture identity failed');});
 await pg.goto(BASE+'/web/play.html#garage');await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save?.lab&&!!webShowroom?.model,null,{timeout:40000});
 await pg.evaluate(()=>{save.welcomed=true;closeAll();setTab('garage');webShowroom.auto=false;passState();});
 const setL=(c,ct,w,wt,skin,paint)=>pg.evaluate(([c,ct,w,wt,skin,paint])=>{const id=save.lab.active||Object.keys(save.lab.machines)[0],m=save.lab.machines[id];m.spec.w={a:w,t:wt,s:false};m.spec.c={c,t:ct,s:false};save.moonbeam=true;save.skin=skin||'default';save.paint=paint||'stock';if(typeof labLoadout==='function')save.L=labLoadout(save);closeAll();setTab('play');setTab('garage');closeAll();return id;},[c,ct,w,wt,skin,paint]);
 const ready=(c,ct,w,wt,q)=>meshy?pg.waitForFunction(([c,ct,w,wt,q])=>Meshy3D.stamp(c,ct,w,wt,q)===(q==='full'?'my22':'my11'),[c,ct,w,wt,q],{timeout:60000}).catch(()=>errors.push('not ready '+[c,ct,w,wt,q])):Promise.resolve();
 return {ctx,pg,setL,ready};
}
const tag=l=>l[0]+l[1]+'-'+l[2]+l[3];
for(const meshy of [false,true]){
 const name=meshy?'after':'before',S=await session(meshy),{pg}=S,R=report.runs[name]={loadouts:{}};
 for(const gfx of ['high','low']){
  await pg.evaluate(g=>setGfx(g),gfx);
  for(const l of LOADOUTS){const rec=R.loadouts[tag(l)+'|'+gfx]={};
   const id=await S.setL(...l);
   if(what.includes('garage')){await S.ready(...l,gfx==='high'?'full':'light');await pg.waitForTimeout(1200);await pg.evaluate(()=>{closeAll();webShowroom.el.scrollIntoView({block:'center'});});await pg.waitForTimeout(500);
    const box=await pg.evaluate(()=>{const r=webShowroom.el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});await pg.screenshot({path:path.join(out,`garage_${name}_${gfx}_${tag(l)}.png`),clip:box});}
   if(what.includes('battle')){await pg.evaluate(i=>ACT.rangecard(i),id);await pg.waitForSelector('#range-mode',{timeout:20000});await pg.selectOption('#range-mode','arena');await pg.selectOption('#range-control','ai');await pg.evaluate(()=>ACT.rangestart());await pg.waitForFunction(()=>!!rangeRun?.sim,null,{timeout:40000});
    await S.ready(...l,'light');await pg.waitForTimeout(3500);await pg.screenshot({path:path.join(out,`battle_${name}_${gfx}_${tag(l)}.png`),clip:{x:0,y:150,width:390,height:420}});
    Object.assign(rec,await pg.evaluate(()=>{let o;rangeWithView(()=>{o=B3.units.get(me);});const t=[];for(let i=0;i<20;i++){const a=performance.now();rangeWithView(()=>drawBattle());RR.getContext().finish();t.push(performance.now()-a);}t.sort((a,b)=>a-b);return {meshyChassis:o?.meta.meshy||null,meshyWeapon:o?.wmeta.meshy||null,calls:RR.info.render.calls,triangles:RR.info.render.triangles,programs:RR.info.programs.length,geometries:RR.info.memory.geometries,textures:RR.info.memory.textures,frameMsMedian:+t[10].toFixed(2),frameMsP90:+t[18].toFixed(2)};}));
    await pg.evaluate(()=>rangeExit());}
   console.log(name,gfx,tag(l),JSON.stringify(rec));}
 }
 if(meshy)R.loads=await pg.evaluate(()=>Meshy3D.stats.log);
 if(what.includes('paints')){
  // every chassis x every paint + Lunar Skin through the game's own menu renderer (buildTank + artTank)
  await pg.evaluate(()=>setGfx('high'));
  for(const cls of ['scout','vanguard','titan'])for(let t=0;t<3;t++){
   if(meshy)await pg.evaluate(([c,t])=>{Meshy3D.request('chassis-'+c+'-'+t,'light');Meshy3D.request('weapon-pulse-0','light');},[cls,t]),await pg.waitForFunction(([c,t])=>Meshy3D.peek('chassis-'+c+'-'+t,'light')&&Meshy3D.peek('weapon-pulse-0','light'),[cls,t],{timeout:60000}).catch(()=>errors.push('paint sheet not ready '+cls+t));
   const url=await pg.evaluate(([cls,t])=>{const ids=[...Object.keys(PAINTS),'lunar'],W=220,H=150,cols=7,rows=Math.ceil(ids.length/cols),cv=document.createElement('canvas');cv.width=W*cols;cv.height=H*rows;const x=cv.getContext('2d');x.fillStyle='#0d141c';x.fillRect(0,0,cv.width,cv.height);
    ids.forEach((p,i)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');artTank(g,W,H,mySpec({cls,ct:t,arch:'pulse',wt:0,paint:p==='lunar'?'stock':p,team:'#4d9fff',lunar:p==='lunar'}),3,{hd:-.6});x.drawImage(c,(i%cols)*W,Math.floor(i/cols)*H);x.fillStyle='#ffd978';x.font='12px sans-serif';x.fillText(p==='lunar'?'Lunar Skin':PAINTS[p].n,(i%cols)*W+6,Math.floor(i/cols)*H+14);});return cv.toDataURL('image/png');},[cls,t]);
   fs.writeFileSync(path.join(out,`paints_${name}_${cls}${t}.png`),Buffer.from(url.split(',')[1],'base64'));console.log(name,'paints',cls,t);}
 }
 if(what.includes('perf')&&meshy){
  // mid-phone profile: CPU throttled 4x, 6-tank Last Standing style load is approximated by the arena match above; report JS-side memory
  const cdp=await S.ctx.newCDPSession(pg);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  R.memory=await pg.evaluate(()=>({jsHeapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,meshyStore:[...Meshy3D.store].filter(([,e])=>e.state==='ready').length,meshyBytesDownloaded:Meshy3D.stats.bytes}));
 }
 await S.ctx.close();
}
report.errors=errors;fs.writeFileSync(path.join(out,'app.json'),JSON.stringify(report,null,1));console.log('errors',errors.length,errors.slice(0,5));
await browser.close();srv.kill();
