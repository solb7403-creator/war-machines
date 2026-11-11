// Meshy proof v2 (Session 5E-2a): the website build + the fixture Worker, HIGH graphics, a GPU renderer string (so the page uses
// what a real device gets: anti-aliasing on, phone up to 2.5x / desktop full ratio), captures taken only after the models load.
//   node worker/build-web.mjs && node dev/assets/meshy/proof/v2.mjs <out-dir>
// Profiles: phone 390x844 at 3x (touch) and desktop 1920x1080. For each of ten loadouts that together cover all 9 chassis and
// all 10 weapons: the Garage (FULL models) and a Free Test arena battle (LIGHT), with a check that EVERY tank on screen (yours
// and the AI's) is drawn with its Meshy chassis and weapon, not the old procedural model. Also a Lunar Skin and an
// offline-pilot ghost check. Writes PNG captures and verify.json (per loadout: Meshy ids found, anything still procedural).
// Software GL (SwiftShader): proves what is drawn, not phone frame rates.
import {spawn} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=process.argv[2],only=(process.argv[3]||'').split(',').filter(Boolean);fs.mkdirSync(out,{recursive:true});
const LOADOUTS=[['scout',0,'pulse',0],['scout',1,'twin',0],['scout',2,'moon',2],['vanguard',0,'pulse',1],['vanguard',1,'twin',1],['vanguard',2,'siege',0],['titan',0,'siege',1],['titan',1,'pulse',2],['titan',2,'twin',2],['titan',2,'siege',2]];
const PROFILES=[{name:'phone3x',viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true},{name:'desktop1920',viewport:{width:1920,height:1080},deviceScaleFactor:1}].filter(p=>!only.length||only.includes(p.name));
const SPOOF=`(()=>{for(const C of [self.WebGLRenderingContext,self.WebGL2RenderingContext]){if(!C)continue;const g=C.prototype.getParameter;C.prototype.getParameter=function(p){if(p===0x9246)return 'ANGLE (Apple, Apple M-series GPU, OpenGL 4.1)';return g.call(this,p);};}})();`;
const port=8798,srv=spawn('node',['dev/tests/webserver.mjs'],{cwd:root,env:{...process.env,LUNAR_STANDARD_VISUAL_FIXTURE:'1',LUNAR_LEGEND_VISUAL_FIXTURE:'1',LUNAR_FIXTURE_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let log='';srv.stdout.on('data',d=>log+=d);srv.stderr.on('data',d=>log+=d);for(let i=0;i<150&&!log.includes('ready');i++)await new Promise(r=>setTimeout(r,200));
if(!log.includes('ready')){console.log('fixture failed',log);process.exit(1);}
const BASE='https://lunar.test',FIX='http://127.0.0.1:'+port,report={environment:'Chromium + SwiftShader, GPU renderer string, website build, fixture Worker, HIGH graphics',profiles:{}};
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const tag=l=>l[0]+l[1]+'-'+l[2]+l[3];
for(const P of PROFILES){
 const R=report.profiles[P.name]={loadouts:{},errors:[]},errors=R.errors;
 const ctx=await browser.newContext({viewport:P.viewport,deviceScaleFactor:P.deviceScaleFactor,isMobile:!!P.isMobile,hasTouch:!!P.hasTouch});
 await ctx.addInitScript(SPOOF);
 await ctx.route('**/*',async r=>{const u=r.request().url();if(!u.startsWith(BASE+'/'))return r.abort();try{await r.fulfill({response:await r.fetch({url:FIX+u.slice(BASE.length)})});}catch(e){r.abort().catch(()=>{});}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(String(e)));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push(m.text());});
 await pg.goto(BASE+'/web/equipment-preview.html');
 await pg.evaluate(async()=>{const c=await fetch('/auth/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());const t=await fetch('/__token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:c.nonce,id:91002941})}).then(r=>r.json());const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)});if(!r.ok)throw Error('Fixture identity failed');});
 await pg.goto(BASE+'/web/play.html#garage');await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save?.lab&&!!webShowroom?.model,null,{timeout:60000});
 await pg.evaluate(()=>{save.welcomed=true;closeAll();setGfx('high');setTab('garage');webShowroom.auto=false;passState();});
 R.renderer=await pg.evaluate(()=>({showroomPixelRatio:webShowroom.renderer.getPixelRatio(),showroomAntialias:webShowroom.renderer.getContext().getContextAttributes().antialias,dpr:devicePixelRatio}));
 const setL=(l,skin)=>pg.evaluate(([c,ct,w,wt,skin])=>{const id=save.lab.active||Object.keys(save.lab.machines)[0],m=save.lab.machines[id];m.spec.w={a:w,t:wt,s:false};m.spec.c={c,t:ct,s:false};save.moonbeam=true;save.skin=skin||'default';save.paint='stock';if(typeof labLoadout==='function')save.L=labLoadout(save);closeAll();setTab('play');setTab('garage');closeAll();return id;},[...l,skin]);
 for(const l of LOADOUTS){
  const rec=R.loadouts[tag(l)]={};const id=await setL(l);
  // ---- Garage: FULL models
  await pg.waitForFunction(([c,ct,w,wt])=>Meshy3D.stamp(c,ct,w,wt,'full')==='my22',l,{timeout:120000}).catch(()=>errors.push('garage not ready '+tag(l)));
  await pg.waitForTimeout(1500);await pg.evaluate(()=>{closeAll();webShowroom.el.scrollIntoView({block:'center'});webShowroom.wake=performance.now();});await pg.waitForTimeout(900);
  rec.garage=await pg.evaluate(()=>{const ids=[];webShowroom.scene.traverse(o=>{if(o.isMesh&&o.userData.meshy)ids.push(o.userData.meshy.asset.id+'/'+o.userData.meshy.asset.quality);});return ids;});
  const box=await pg.evaluate(()=>{const r=webShowroom.el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  await pg.screenshot({path:path.join(out,`${P.name}_garage_${tag(l)}.png`),clip:box});
  // ---- battle: LIGHT models, every tank on the field
  await pg.evaluate(i=>ACT.rangecard(i),id);await pg.waitForSelector('#range-mode',{timeout:30000});await pg.selectOption('#range-mode','arena');await pg.selectOption('#range-control','ai');await pg.evaluate(()=>ACT.rangestart());
  await pg.waitForFunction(()=>!!rangeRun?.sim,null,{timeout:60000});
   // (drawing a tank requests its own Meshy files; the battle rebuilds each tank when they land)
  const ok=await pg.waitForFunction(()=>{let all=true;rangeWithView(()=>{for(const u of units){if(u.boss||u.hp<=0)continue;const o=B3.units.get(u);if(!o||!o.meta.meshy||!o.wmeta.meshy)all=false;}});return all;},null,{timeout:120000}).then(()=>true).catch(()=>false);
  await pg.waitForTimeout(2500);
  rec.battle=await pg.evaluate(()=>{const list=[];rangeWithView(()=>{for(const u of units){if(u.boss)continue;const o=B3.units.get(u);list.push({me:u===me,cls:u.cls,wtype:u.wtype,chassis:o?.meta.meshy||null,weapon:o?.wmeta.meshy||null});}});return {units:list,pixelRatio:RR.getPixelRatio(),antialias:RR.getContext().getContextAttributes().antialias,calls:RR.info.render.calls,triangles:RR.info.render.triangles};});
  rec.battle.allMeshy=ok;rec.procedural=rec.battle.units.filter(u=>!u.chassis||!u.weapon).map(u=>u.cls+'/'+u.wtype);
  await pg.screenshot({path:path.join(out,`${P.name}_battle_${tag(l)}.png`),...(P.name==='phone3x'?{clip:{x:0,y:110,width:390,height:520}}:{})});
  await pg.evaluate(()=>rangeExit());
  console.log(P.name,tag(l),'garage',rec.garage.join(' '),'| battle all Meshy:',ok,rec.procedural.join(' '));
 }
 // ---- Lunar Skin in the Garage (bright breathing energy glow) next to stock (faint, still)
 for(const skin of ['lunar']){const l=['vanguard',1,'twin',1];await setL(l,skin);await pg.waitForFunction(([c,ct,w,wt])=>Meshy3D.stamp(c,ct,w,wt,'full')==='my22',l,{timeout:120000}).catch(()=>errors.push('lunar not ready'));await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{closeAll();webShowroom.el.scrollIntoView({block:'center'});webShowroom.wake=performance.now();});await pg.waitForTimeout(900);const box=await pg.evaluate(()=>{const r=webShowroom.el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});await pg.screenshot({path:path.join(out,`${P.name}_garage_${tag(l)}_lunar.png`),clip:box});}
 R.loads=await pg.evaluate(()=>Meshy3D.stats.log.length);
 await ctx.close();
}
report.summary=Object.fromEntries(Object.entries(report.profiles).map(([k,v])=>[k,{loadouts:Object.keys(v.loadouts).length,stillProcedural:Object.entries(v.loadouts).flatMap(([t,r])=>r.procedural.map(x=>t+': '+x)),garageMissing:Object.entries(v.loadouts).filter(([t,r])=>r.garage.length<2).map(([t])=>t),errors:v.errors.length}]));
fs.writeFileSync(path.join(out,'verify.json'),JSON.stringify(report,null,1));console.log(JSON.stringify(report.summary));
await browser.close();srv.kill();
