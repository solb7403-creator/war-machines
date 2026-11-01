// Lunar Skin overlay evidence: real-renderer screenshots (menu art, Garage, Shop, battle), paint/skin switching,
// cache/leak counters and battle frame times. Not pass/fail for looks; asserts only the mechanical checks.
// Usage: node dev/tests/lunar-overlay.cjs <repoRoot> <outDir> [shots|perf|switch|all]
// Runs against any checkout (main for "before", the branch for "after"): it only uses existing game globals.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.resolve(process.argv[2]||'.'),OUT=path.resolve(process.argv[3]||'/tmp/lunar-overlay'),WHAT=process.argv[4]||'all';fs.mkdirSync(OUT,{recursive:true});
const TYPES={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml'};
async function open(b,{w=390,h=844,reduced=false,gfx='high',save=null}={}){
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,reducedMotion:reduced?'reduce':'no-preference'});
 await ctx.route('**/*',async r=>{const u=r.request().url();if(!u.startsWith('http://127.0.0.1:8899/'))return r.abort();const f=path.resolve(ROOT,decodeURIComponent(u.split(':8899/')[1].split('?')[0]));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.abort();return r.fulfill({body:fs.readFileSync(f),contentType:TYPES[path.extname(f)]||'application/octet-stream'});});
 await ctx.addInitScript(`window.LUNAR_NO_PVP=1;window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_AUTOGFX=1;try{const s=JSON.parse(localStorage.getItem('wm_save_v1')||'{}');s.gfx=${JSON.stringify(gfx)};localStorage.setItem('wm_save_v1',JSON.stringify(s));}catch(e){}`);
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto('http://127.0.0.1:8899/index.html');
 await p.waitForFunction(()=>typeof R3!=='undefined'&&(R3.ready||R3.failed),null,{timeout:30000});
 await p.evaluate(g=>setGfx(g),gfx);
 await p.waitForFunction(()=>use3D()&&(!Equipment3D.enabled||Equipment3D.status(Equipment3D.quality)==='ready'),null,{timeout:30000});
 await p.evaluate(()=>{closeAll();save.paints=Object.assign(save.paints||{},{gold:1,nebula:1,void:1,ember:1,arctic:1});save.cores=['dmg','rof','arm'];});
 return {ctx,p,errs};
}
const png=(file,data)=>fs.writeFileSync(path.join(OUT,file),Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
// one contact sheet per class: rows = paint (+/- Lunar), columns = tiers 0/1/2, drawn by the game's own menu renderer (artTank)
const SHEET=eval(`(async (o)=>{
 const rows=o.rows,tile=o.tile,lh=26,cols=3,W=150+cols*tile[0],H=44+rows.length*(tile[1]+lh);
 const c=document.createElement('canvas');c.width=W*o.k;c.height=H*o.k;const x=c.getContext('2d');x.scale(o.k,o.k);x.fillStyle='#0a0e17';x.fillRect(0,0,W,H);
 x.fillStyle='#e8eef6';x.font='600 18px sans-serif';x.fillText(o.title,12,28);
 rows.forEach((rw,i)=>{const y=44+i*(tile[1]+lh);x.fillStyle=rw.lunar?'#e2c27a':'#9fb3c8';x.font='600 15px sans-serif';x.fillText((rw.lunar?'LUNAR + ':'')+PAINTS[rw.paint].n,12,y+lh+tile[1]/2);
  for(let t=0;t<cols;t++){const sp=Object.assign(mySpec(),{cls:o.cls,ct:t,arch:o.arch,wt:t,paint:rw.paint,lunar:rw.lunar,team:TC[0],gems:'dmg,rof,arm',fits:undefined,vl:0,vt:0});
   const cv=document.createElement('canvas');cv.width=tile[0]*o.k;cv.height=tile[1]*o.k;const cx=cv.getContext('2d');cx.scale(o.k,o.k);
   artTank(cx,tile[0],tile[1],sp,3,{az:o.az,environment:'garage',t:o.t});x.drawImage(cv,150+t*tile[0],y+lh,tile[0],tile[1]);
   if(i===0){x.fillStyle='#9fb3c8';x.font='600 14px sans-serif';x.fillText('Tier '+t,150+t*tile[0]+8,y+18);}}});
 return c.toDataURL('image/png');
})`);
const PAINT_ROWS=[['gold',1],['stock',1],['nebula',1],['void',1],['gold',0],['stock',0],['nebula',0],['void',0]].map(([paint,l])=>({paint,lunar:!!l}));
async function shots(b,tag){
 const res={};
 for(const [gfx,reduced] of [['high',false],['low',false],['high',true]]){
  const label=gfx+(reduced?'-reduced':'');const {ctx,p,errs}=await open(b,{gfx,reduced});
  for(const cls of ['scout','vanguard','titan'])png(`${tag}-sheet-${cls}-${label}.png`,await p.evaluate(SHEET,{title:`${tag.toUpperCase()} · ${cls} · ${label} · menu renderer`,cls,arch:cls==='titan'?'siege':cls==='scout'?'twin':'pulse',rows:PAINT_ROWS,tile:[260,190],k:1,az:.95,t:1.3}));
  // Garage close-up (390 px), Lunar + Gold Plate equipped
  await p.evaluate(()=>{save.skin='lunar';save.paint='gold';setTab('garage');});await p.waitForTimeout(900);await p.screenshot({path:path.join(OUT,`${tag}-garage-lunar-gold-${label}.png`)});
  if(gfx==='high'&&!reduced){
   for(const [paint,skin] of [['stock','lunar'],['nebula','lunar'],['void','lunar'],['gold','default']]){await p.evaluate(([a,s])=>{save.skin=s;save.paint=a;setTab('play');setTab('garage');},[paint,skin]);await p.waitForTimeout(700);await p.screenshot({path:path.join(OUT,`${tag}-garage-${skin}-${paint}.png`)});}
   await p.evaluate(()=>{save.skin='default';save.paint='nebula';setTab('shop');});await p.waitForTimeout(900);
   const card=await p.$('button.premium[data-arg=skin]');if(card){await card.scrollIntoViewIfNeeded();await p.waitForTimeout(400);await card.screenshot({path:path.join(OUT,`${tag}-shop-lunar-card.png`)});}
   // big Garage-style hero close-up of one tank per class (menu renderer at 2x)
   png(`${tag}-closeup.png`,await p.evaluate(`(async()=>{const c=document.createElement('canvas'),w=1200,h=420;c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#0a0e17';x.fillRect(0,0,w,h);
    const L=[['scout',2,'twin','nebula'],['vanguard',1,'pulse','gold'],['titan',2,'siege','void']];L.forEach(([cls,t,arch,paint],i)=>{const sp=Object.assign(mySpec(),{cls,ct:t,arch,wt:t,paint,lunar:true,team:TC[0],gems:'dmg,rof,arm',fits:undefined,vl:0,vt:0});const cv=document.createElement('canvas'),k=dpr;cv.width=400*k;cv.height=400*k;const cc=cv.getContext('2d');cc.scale(k,k);artTank(cc,400,400,sp,3,{az:.95,environment:'garage',t:1.3});x.drawImage(cv,i*400,10,400,400);x.fillStyle='#e2c27a';x.font='600 16px sans-serif';x.fillText('Lunar + '+PAINTS[paint].n+' · '+cls+' T'+t,i*400+12,24);});return c.toDataURL('image/png');})()`));
  }
  // Play tab hero: the player's own tank drawn live in 3D (Lunar + Gold Plate)
  await p.evaluate(()=>{save.skin='lunar';save.paint='gold';setTab('play');});await p.waitForTimeout(1500);await p.screenshot({path:path.join(OUT,`${tag}-hero-lunar-gold-${label}.png`),clip:{x:0,y:0,width:390,height:520}});
  if(gfx==='high'&&!reduced){await p.evaluate(()=>{save.paint='nebula';});await p.waitForTimeout(900);await p.screenshot({path:path.join(OUT,`${tag}-hero-lunar-nebula.png`),clip:{x:0,y:0,width:390,height:520}});
   await p.evaluate(()=>{save.skin='default';});await p.waitForTimeout(900);await p.screenshot({path:path.join(OUT,`${tag}-hero-default-nebula.png`),clip:{x:0,y:0,width:390,height:520}});}
  // battle (3v3 AI arena), several Lunar tanks with mixed paints, 390 px
  await p.evaluate(()=>{window.onMatchEnd=()=>{};save.gtype='arena';save.mode='3v3';save.map='classic';save.skin='lunar';save.paint='gold';document.body.classList.add('battle');fit();newMatch();
   const paints=['gold','stock','nebula','void','ember','arctic'];units.forEach((u,i)=>{if(i<5){u.skin='lunar';u.paint=paints[i%6];}});for(let i=0;i<240;i++)update(1/60);});
  for(let i=0;i<6;i++)await p.evaluate(()=>{update(1/60);drawBattle();});
  await p.screenshot({path:path.join(OUT,`${tag}-battle-${label}.png`)});
  res[label]={errs:errs.slice(0,5),hf:await p.evaluate(()=>Equipment3D.active()),q:await p.evaluate(()=>R3.q)};
  await ctx.close();
 }
 return res;
}
// visible colour split per tank (pixels of the real menu render, studio stage hidden): paint hue vs graphite vs gold vs blue
async function measure(b){
 const {ctx,p}=await open(b,{gfx:'high'});
 const r=await p.evaluate(()=>{const envActive=Environment3D.active;Environment3D.active=()=>false;const out={};
  const hsv=(r,g,b)=>{r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,mx?d/mx:0,mx];};
  for(const cls of ['scout','vanguard','titan'])for(let t=0;t<3;t++)for(const lunar of [false,true]){
   const sp=Object.assign(mySpec(),{cls,ct:t,arch:'pulse',wt:t,paint:'nebula',lunar,team:TC[0],gems:'',fits:undefined,vl:0,vt:0});const c=document.createElement('canvas');c.width=360;c.height=300;artTank(c.getContext('2d'),360,300,sp,3,{az:.95,t:1.3});
   const d=c.getContext('2d').getImageData(0,0,360,300).data,n={paint:0,graphite:0,gold:0,energy:0,other:0};let tot=0;
   for(let i=0;i<d.length;i+=4){if(d[i+3]<250)continue;tot++;const [h,sat,v]=hsv(d[i],d[i+1],d[i+2]);
    if(h>=235&&h<=305&&sat>.16)n.paint++;else if(h>=22&&h<=62&&sat>.28&&v>.28)n.gold++;else if(h>=175&&h<=228&&sat>.30&&v>.42)n.energy++;else if(v<.48&&sat<.30)n.graphite++;else n.other++;}
   for(const k in n)n[k]=+(100*n[k]/tot).toFixed(1);out[cls+t+(lunar?'L':'')]=n;}
  Environment3D.active=envActive;return out;});
 await ctx.close();return r;
}
async function perf(b){
 const out={};
 for(const gfx of ['high','low']){
  const {ctx,p}=await open(b,{gfx,w:390,h:844});const cdp=await ctx.newCDPSession(p);
  const r={};
  for(const lun of [0,6]){
   const row=await p.evaluate(n=>{window.onMatchEnd=()=>{};save.gtype='arena';save.mode='3v3';save.map='classic';document.body.classList.add('battle');fit();newMatch();
    const paints=['gold','stock','nebula','void','ember','arctic'];units.forEach((u,i)=>{u.skin=i<n?'lunar':'default';u.paint=paints[i%6];});
    for(let i=0;i<120;i++){update(1/60);drawBattle();}
    const td=[];let calls=0,tris=0;for(let i=0;i<300;i++){update(1/60);const a=performance.now();drawBattle();RR.getContext().finish();td.push(performance.now()-a);calls+=RR.info.render.calls;tris+=RR.info.render.triangles;}
    td.sort((a,b)=>a-b);return {lunarTanks:n,medianMs:+td[150].toFixed(2),p95Ms:+td[285].toFixed(2),meanMs:+(td.reduce((a,b)=>a+b,0)/td.length).toFixed(2),drawCalls:Math.round(calls/300),triangles:Math.round(tris/300),particles:PSA.live.length,mem:{...RR.info.memory}};},lun);
   r['lunar'+lun]=row;
  }
  out[gfx]=r;await ctx.close();
 }
 return out;
}
async function switching(b){
 const {ctx,p,errs}=await open(b,{gfx:'high'});await p.evaluate(n=>{window.__N=n;},+(process.env.CYCLES||4));
 const r=await p.evaluate(async()=>{
  const sig=(paint,skin)=>{save.paint=paint;save.skin=skin;const sp=mySpec({cls:'vanguard',ct:1,arch:'pulse',wt:1,team:TC[0],gems:'dmg,rof,arm',fits:undefined,vl:0,vt:0});const c=document.createElement('canvas');c.width=200;c.height=150;artTank(c.getContext('2d'),200,150,sp,3,{az:.95,environment:'garage',t:1.3});
   const d=c.getContext('2d').getImageData(0,0,200,150).data;let h=0,R=0,G=0,B=0,n=0;for(let i=0;i<d.length;i+=4){h=(h*31+d[i]+d[i+1]*7+d[i+2]*13)>>>0;if(d[i+3]>200){R+=d[i];G+=d[i+1];B+=d[i+2];n++;}}return {h,avg:[R/n|0,G/n|0,B/n|0]};};
  const seq=[['stock','default'],['gold','default'],['gold','lunar'],['nebula','lunar'],['void','lunar'],['stock','lunar'],['nebula','default'],['gold','lunar'],['stock','default']];
  const before={hf:Equipment3D.stats().geometry,mem:{...AR?.r.info.memory}};const sigs=[];
  for(let k=0;k<(window.__N||4);k++)for(const [a,s] of seq)sigs.push(sig(a,s));
  const after={hf:Equipment3D.stats().geometry,mem:{...AR.r.info.memory}};
  const first=sigs.slice(0,seq.length),again=sigs.slice(seq.length*3);
  return {seq,first,repeatable:first.every((s,i)=>s.h===again[i].h),stockMatchesAfterRoundTrip:first[0].h===first[8].h,before,after};});
 r.errs=errs;await ctx.close();return r;
}
(async()=>{
 const b=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const tag=process.env.TAG||'after',result={root:ROOT,tag};
 try{
  if(WHAT==='all'||WHAT==='shots')result.shots=await shots(b,tag);
  if(WHAT==='all'||WHAT==='switch')result.switching=await switching(b);
  if(WHAT==='all'||WHAT==='perf')result.perf=await perf(b);
  if(WHAT==='all'||WHAT==='measure'){result.measure=await measure(b);console.table(result.measure);}
 }finally{await b.close();}
 fs.writeFileSync(path.join(OUT,tag+'-result.json'),JSON.stringify(result,null,1));console.log(JSON.stringify(result,null,1).slice(0,4000));
})().catch(e=>{console.error(e);process.exit(1);});
