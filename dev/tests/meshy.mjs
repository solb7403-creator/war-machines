// Meshy model assets and loader contract (Session 5E-1). No browser: parses every shipped GLB with the game's own
// container reader and the vendored meshopt decoder, and checks it against the pipeline config and the game's canonical
// dimensions. Visual only: also asserts nothing here can reach rules, saves or the economy.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createContext,runInContext} from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(import.meta.url),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const Meshy3D=require(path.join(root,'js/meshy3d.js')),Decoder=require(path.join(root,'js/vendor/meshopt_decoder.js'));
const dir=path.join(root,'js/assets/meshy-v1'),manifest=JSON.parse(read('js/assets/meshy-v1/manifest.json')),config=JSON.parse(read('dev/assets/meshy/config.json'));
let checks=0;const ok=(c,m)=>{checks++;assert.ok(c,m);};

// ---- wiring: the module loads after the procedural models, never before the rules, and the page works without it
const index=read('index.html'),boot=read('web/boot.js');
ok(index.indexOf('js/equipment3d.js')<index.indexOf('js/meshy3d.js')&&index.indexOf('js/meshy3d.js')<index.indexOf('js/render3d.js'),'index.html load order');
ok(boot.indexOf("'equipment3d'")<boot.indexOf("'meshy3d'")&&boot.indexOf("'meshy3d'")<boot.indexOf("'render3d'"),'web/boot.js load order');
ok(!/meshopt_decoder/.test(index)&&!/meshopt_decoder/.test(boot),'the decoder is fetched with the first model, not with the page');
const src=read('js/meshy3d.js');
for(const word of ['save.','ecoRun','localStorage','WEAPONS[','CH[cls]','hp=','dmg=','fetch(\'/api','/api/'])ok(!src.includes(word),'meshy3d.js must not touch '+word);
ok(!/WebAssembly\./.test(read('js/vendor/meshopt_decoder.js')),'decoder is plain JavaScript (the website CSP forbids WebAssembly)');
// without THREE (2D fallback, tests, the Worker) every entry point answers "no model" and the procedural kit is used
ok(Meshy3D.chassisKit('vanguard',0,null,'#fff',[],false)===null&&Meshy3D.weaponKit('pulse',0,null,'#fff',false,'vanguard')===null,'no THREE -> procedural');
ok(Meshy3D.stamp('vanguard',0,'pulse',0)==='my00','readiness stamp');

// ---- canonical dimensions from the game's own tables
const c=createContext({console,THREE:{}});runInContext(read('js/rules.js')+';globalThis.PAINTS=PAINTS;',c);
const m3=read('js/models3d.js'),pick=name=>{const i=m3.indexOf('const '+name+'=');let depth=0,j=m3.indexOf('{',i);const s=j;for(;j<m3.length;j++){if(m3[j]==='{')depth++;else if(m3[j]==='}'&&--depth===0)break;}return Function('return '+m3.slice(s,j+1))();};
const CV=pick('CHASSIS_VISUALS'),WV=pick('WEAPON_VISUALS');
const want=[];for(const cls of Object.keys(CV))for(let t=0;t<3;t++)want.push('chassis-'+cls+'-'+t);for(const a of Object.keys(WV))for(let t=0;t<3;t++)want.push('weapon-'+a+'-'+t);want.push('weapon-moon');
for(const t of ['cc','reactor','refinery','lab','shield','storage','tesla','cannon','mg','rocket','laser','railgun'])want.push('town-'+t);
ok(manifest.version===Meshy3D.VERSION,'manifest version');
for(const id of want)ok(manifest.items[id]&&manifest.items[id].light&&manifest.items[id].full,'manifest has '+id+' light + full');
ok(Object.keys(manifest.items).length===want.length,'exactly the 31 game items ('+Object.keys(manifest.items).length+')');

// ---- files: only optimized outputs, never an original
const files=fs.readdirSync(dir);
ok(files.every(f=>f==='manifest.json'||/^[a-z0-9-]+-(light|full)\.glb$/.test(f)),'only <id>-light.glb / <id>-full.glb / manifest.json are shipped');
ok(files.filter(f=>f.endsWith('.glb')).length===want.length*2,'two files per item');
const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function view(G,i){const b=G.json.bufferViews[i],x=b.extensions.EXT_meshopt_compression,out=new Uint8Array(x.count*x.byteStride);Decoder.decodeGltfBuffer(out,x.count,x.byteStride,G.bin.subarray(x.byteOffset,x.byteOffset+x.byteLength),x.mode,x.filter||'NONE');return {out,stride:x.byteStride};}
function accessor(G,i){const a=G.json.accessors[i],{out,stride}=view(G,a.bufferView),C=CT[a.componentType],n=NC[a.type],dv=new DataView(out.buffer),r=new Float64Array(a.count*n),size=C.BYTES_PER_ELEMENT;
 const get=C===Uint32Array?p=>dv.getUint32(p,true):C===Uint16Array?p=>dv.getUint16(p,true):C===Int16Array?p=>dv.getInt16(p,true):C===Int8Array?p=>dv.getInt8(p):p=>dv.getUint8(p);
 for(let k=0;k<a.count;k++)for(let j=0;j<n;j++)r[k*n+j]=get(k*stride+j*size);return {r,n,count:a.count,a};}
let totalLight=0,totalFull=0;const sums=[];
for(const id of want){const rec=manifest.items[id],item=config.items.find(i=>i.id===id);ok(item,'config has '+id);
 ok(!files.includes(rec.source),'original not shipped: '+rec.source);
 for(const q of ['light','full']){
  const f=path.join(dir,id+'-'+q+'.glb'),buf=fs.readFileSync(f),G=Meshy3D.container(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)),J=G.json,L=J.extras.lunar,st=rec[q];
  ok(buf.length===st.bytes,id+' '+q+' size matches manifest');
  ok(buf.length<=(q==='light'?1.25e6:7.5e6),id+' '+q+' transfer cap ('+buf.length+')');
  if(q==='light')totalLight+=buf.length;else totalFull+=buf.length;
  ok(J.meshes.length===1&&J.meshes[0].primitives.length===1,id+' '+q+' one primitive = one draw');
  ok(JSON.stringify(J.extensionsRequired.slice().sort())===JSON.stringify(['EXT_meshopt_compression','EXT_texture_webp','KHR_mesh_quantization']),id+' '+q+' extensions');
  ok(L.id===id&&L.quality===q&&L.kind===item.kind,id+' '+q+' identity');
  const prim=J.meshes[0].primitives[0],P=accessor(G,prim.attributes.POSITION),I=accessor(G,prim.indices),M=accessor(G,prim.attributes._MOT),node=J.nodes[0];
  const budget=(item.tris&&item.tris[q])||config.kinds[item.kind].tris[q];
  ok(I.count/3<=budget*1.3&&I.count/3>=budget*.5,id+' '+q+' triangles '+I.count/3+' within budget '+budget+' (part floors may add up to 30%)');
  ok(['normal','base','orm','mask'].every(k=>J.images.some(im=>im.name===k&&im.mimeType==='image/webp')),id+' '+q+' four WebP maps');
  // parts: every vertex belongs to a declared part; motion only uses channels the game feeds
  let mx=0;for(let k=0;k<M.count;k++)mx=Math.max(mx,M.r[k*4]);ok(mx<L.parts.length,id+' '+q+' part indices');
  for(const p of L.parts){ok(['static','screw','track'].includes(p.kind),id+' part kind');for(const d of [p.angle,p.slide,p.glow,p.travel])if(d&&d.ch)ok(d.ch in Meshy3D.CH,id+' channel '+d.ch);if(p.parent)ok(L.parts.some(x=>x.name===p.parent),id+' parent '+p.parent);
   if(p.kind==='track'){ok(p.path&&p.path.elems.length>=2&&p.path.length>0&&p.path.restError<2e-3,id+' belt path');}}
  // real size in game space
  let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let k=0;k<P.count;k++)for(let j=0;j<3;j++){const v=P.r[k*3+j]/65535*node.scale[j]+node.translation[j];if(v<lo[j])lo[j]=v;if(v>hi[j])hi[j]=v;}
  ok(Math.abs(lo[1])<.03,id+' '+q+' stands on the ground ('+lo[1].toFixed(3)+')');
  if(item.kind==='chassis'){const cv=CV[item.game.cls][item.game.tier];
   ok(Math.abs((hi[0]-lo[0])-cv.len)<cv.len*.02,id+' '+q+' length '+(hi[0]-lo[0]).toFixed(3)+' = today\'s '+cv.len);
   ok(L.meta.ty>.25&&L.meta.ty<1.3,id+' socket height');ok(L.parts.filter(p=>p.role==='belt').length>=2&&L.parts.filter(p=>p.role==='wheel').length>=4,id+' running gear parts');
   ok(L.parts.filter(p=>p.role==='belt').every(p=>p.travel&&(p.travel.ch==='driveL'||p.travel.ch==='driveR')),id+' belts follow the drive channels');
   ok(L.meta.sockets.cores.length===3&&L.meta.sockets.team.length===2&&L.meta.plateSockets.front&&L.meta.plateSockets.left&&L.meta.plateSockets.right,id+' add-on sockets');}
  if(item.kind==='weapon'){const wv=WV[item.game.arch][item.game.tier];
   ok(L.meta.tips.length>=1&&L.meta.tips.every(t=>Math.abs(t[0]-wv.tip)<.3),id+' '+q+' muzzle at today\'s tip distance '+wv.tip+' ('+L.meta.tips.map(t=>t[0].toFixed(2))+')');
   ok(L.parts.some(p=>p.name==='ring'&&p.angle&&p.angle.ch==='aim'),id+' base ring stays with the hull');
   ok(L.meta.barrels>=1&&L.parts.some(p=>p.name.startsWith('barrel')&&p.slide&&p.slide.ch),id+' barrels recoil');
   if(item.game.arch==='twin'&&item.game.tier!==1)ok(new Set(L.parts.filter(p=>p.name.startsWith('barrel')).map(p=>p.slide.ch)).size>=2,id+' twin barrels recoil in sequence');}
  if(q==='light'){ok(L.lowIndex&&prim.extras&&prim.extras.lowIndex!==undefined,id+' LOW index set');const lw=accessor(G,prim.extras.lowIndex);ok(lw.count<I.count,id+' LOW index is smaller');}
 }
 sums.push([id,rec.sourceTris,rec.light.tris,rec.full.tris,rec.sourceBytes,rec.light.bytes,rec.full.bytes]);
}
// Helix spins, Colossus pods ride their arms
{const L=JSON.parse(JSON.stringify(Meshy3D.container(fs.readFileSync(path.join(dir,'weapon-twin-2-light.glb')).buffer).json.extras.lunar));ok(L.parts.filter(p=>p.angle&&p.angle.ch==='spin').length===2,'Helix: two spinning clusters');}
{const b=fs.readFileSync(path.join(dir,'chassis-titan-2-light.glb')),L=Meshy3D.container(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)).json.extras.lunar;ok(L.parts.filter(p=>p.role==='belt').length===4,'Colossus: four track units');ok(L.parts.filter(p=>p.role==='belt'&&p.parent).length===4&&L.parts.filter(p=>p.angle&&p.angle.ch==='flex').length>=4,'Colossus: pods flex and carry their running gear');}
// ---- stock look (Session 5E-2a, owner): every chassis's stock look follows its chosen reference; energy lines are lit faintly
// and held still on stock and paints, the bright breathing glow is Lunar Skin's alone; paints tint armour only
{const G=Meshy3D.GLOW;ok(G&&G.stock>0&&G.stock<=G.lunar*.35,'stock energy lines are faint next to Lunar Skin ('+(G&&G.stock)+' vs '+(G&&G.lunar)+')');ok(G.breath>0,'Lunar Skin glow breathes');
 ok(/U\.uGlowAnim\.value\.set\(lunar\?1:0,lunar\?GLOW\.breath:0\)/.test(src),'chassis glow animation is switched on only for Lunar Skin');
 ok(/uCh\[int\(D\.x\+\.5\)\]\*uGlowAnim\.x/.test(src),'glow channels are multiplied by the animation switch in the shader');
 const lum=h=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
 for(const it of config.items.filter(i=>i.kind==='chassis')){const L={...config.looks[it.look],...(it.lookOverride||{})};
  ok(L.paintA&&L.paintB&&Math.max(lum(L.paintA),lum(L.paintB))/Math.max(1e-4,Math.min(lum(L.paintA),lum(L.paintB)))>=1.2,it.id+': the two armour tones are clearly distinct shades');
  for(const r of L.lines||[])if(r.kind==='glow'&&(L.lines||[]).some(t=>t.kind!=='glow'))ok(r.color.toLowerCase()!==((L.lines.find(t=>t.kind!=='glow').color)||'').toLowerCase(),it.id+': glow lines and trim lines use different shades');}
 const titan=config.items.find(i=>i.id==='chassis-titan-0');ok(!titan.regions.some(r=>r.region==='hazard'),'Titan plow follows its reference (bare plate, no hazard stripes)');}
ok(totalLight<22e6,'all LIGHT files together under 22 MB ('+(totalLight/1e6).toFixed(1)+')');
console.log('PASS meshy assets: '+want.length+' items x LIGHT/FULL, '+checks+' checks; LIGHT total '+(totalLight/1e6).toFixed(1)+' MB, FULL total '+(totalFull/1e6).toFixed(1)+' MB');
