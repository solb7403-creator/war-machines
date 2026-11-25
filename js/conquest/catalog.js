/* Original LUNAR permanent cosmetic art. Presentation only: no combat or economy mutations. */
(function(root){
'use strict';
const freeze=o=>{Object.freeze(o);Object.values(o).forEach(v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);});return o;};
const checkout=freeze({enabled:false,blocker:'COMMERCE NOT YET AVAILABLE: Stars/TON/SOL Conquest SKU pricing, authenticated receipts, replay, refunds and cross-device entitlement delivery have not received end-to-end certification. No live purchase or acceleration is enabled.'});
const item=(id,name,slot,design,color,accent,earn,earnText,proposedUsd)=>({id,name,slot,design,color,accent,earn,earnText,proposedUsd,priceStatus:'Illustrative USD concept only; no live price or checkout',permanent:true,preview:true,competitive:false});
const POOL_NAME={c:'COMMON',u:'UNCOMMON',r:'RARE',e:'EPIC'};
const streakItem=(id,name,slot,design,color,accent,days)=>({id,name,slot,design,color,accent,earn:{streak:days},earnText:'A '+days+'-day return streak',earnOnly:true,proposedUsd:null,priceStatus:'Earn-only: never sold',permanent:true,preview:true,competitive:false});
// Session 7C STEP 4: the War Effort's cosmetic reward tiers (earn-only): a contributor of a won week earns the tier the bar reached (s.wet:
// I at 100% of the goal, II at 150%, III at 200%); stand-in looks from the existing designs until the Fable 7-V session draws them
const weItem=(id,name,slot,design,color,accent,tier)=>({id,name,slot,design,color,accent,earn:{we:tier},earnText:'Contribute to a won War Effort week at tier '+['','I','II','III'][tier]+' ('+[0,100,150,200][tier]+'% of the goal)',earnOnly:true,proposedUsd:null,priceStatus:'Earn-only: never sold',permanent:true,preview:true,competitive:false});
const frag=(id,name,slot,design,color,accent,pool)=>({id,name,slot,design,color,accent,earn:{frag:pool},earnText:'Ten '+POOL_NAME[pool].toLowerCase()+' blueprint fragments (loot drops)',pool,earnOnly:true,proposedUsd:null,priceStatus:'Earn-only: never sold',permanent:true,preview:true,competitive:false});
const items=freeze([
 item('base-bastion','Bastion Ramparts','base',0,0x283b4b,0xd2aa55,{base:1},'Build Command Base I',7.99),
 item('base-lancer','Lancer Gantries','base',1,0x334854,0x84d9d8,{base:2},'Build Command Base II',12.99),
 item('base-cathedral','Signal Cathedral','base',2,0x434252,0xc0a6ef,{base:3},'Build Command Base III',19.99),
 item('base-orbital','Orbital Crown','base',3,0x293f4a,0x78c5e7,{base:4},'Build Command Base IV',24.99),
 item('base-monolith','Command Monolith','base',4,0x494237,0xf3d38a,{base:5},'Build Command Base V',29.99),
 item('fire-sunlance','Sunlance Muzzle Halo','trail',0,0x9c6130,0xffcc73,{clears:1},'Complete one eligible raid',3.99),
 item('fire-ionwake','Ion Wake Vanes','trail',1,0x315a66,0x80e4ed,{clears:3},'Complete three eligible raids',5.99),
 item('fire-prism','Prism Convergence','trail',2,0x594c74,0xc6b0ff,{clears:5},'Complete five eligible raids',7.99),
 item('fire-siege','Siege Coil Rings','trail',3,0x674231,0xffa775,{clears:10},'Complete ten eligible raids',9.99),
 item('fire-twin','Twin Comet Fins','trail',4,0x294e5c,0xb4e8f6,{blueprint:1},'Earn the deterministic 25-raid blueprint',14.99),
 item('armor-brass','Brass Campaign Chevrons','armor',0,0xa2844d,0xead39d,{reputation:100},'Earn 100 Conquest reputation',4.99),
 item('armor-ceramic','Ceramic Shoulder Guards','armor',1,0xc6c5be,0x84b6c8,{reputation:500},'Earn 500 Conquest reputation',7.99),
 item('armor-radiant','Radiant Heat Sinks','armor',2,0x36414d,0xf1a75f,{reputation:1500},'Earn 1,500 Conquest reputation',9.99),
 item('armor-vector','Vector Sensor Fins','armor',3,0x4e5f65,0x8edbca,{reputation:3500},'Earn 3,500 Conquest reputation',12.99),
 item('armor-obsidian','Obsidian Honor Crest','armor',4,0x292b38,0xc9a9ee,{reputation:8000},'Earn 8,000 Conquest reputation',19.99),
 item('command-standard','First Defense Standard','commander',0,0x426171,0xe7c97e,{defenses:1},'Win one real base defense',2.99),
 item('command-wings','Guardian Wings','commander',1,0xadb8bd,0x6cd8e7,{defenses:3},'Win three real base defenses',4.99),
 item('command-orrery','Warfront Orrery','commander',2,0x4b5a6f,0xd2bbf8,{campaign:250},'Contribute 250 verified campaign score',7.99),
 item('command-beacon','Humanity Beacon','commander',3,0x5b563e,0xf7d580,{campaign:1000},'Contribute 1,000 verified campaign score',9.99),
 item('command-parasite','Captured Parasite Sigil','commander',4,0x493d59,0xb2e4a0,{eliteBlueprint:1},'Earn the disclosed rare raid blueprint (3.5% eligible raid chance)',9.99),
 // Session 6 loot v1: fragment pools (rules.js CQ_FRAG). EARN-ONLY: never priced, never sold, never in a store or crate (the
 // loot test checks it). Ten fragments of a pool give one piece of that pool, picked by the Worker without repeats.
 frag('frag-c-basalt','Basalt Matte Chevrons','armor',0,0x3d4146,0x8a9199,'c'),frag('frag-c-regolith','Regolith Matte Guards','armor',1,0x8b7d63,0xc9b68f,'c'),
 frag('frag-c-olive','Olive Drab Heat Sinks','armor',2,0x4f5a3c,0x9fae73,'c'),frag('frag-c-slate','Slate Matte Fins','armor',3,0x46505e,0x9db0c4,'c'),frag('frag-c-oxide','Oxide Matte Crest','armor',4,0x6b3f2c,0xc07a52,'c'),
 frag('frag-u-vanguard','Vanguard Field Standard','commander',0,0x2e4a3a,0x7fe0a0,'u'),frag('frag-u-aegis','Aegis Wings','commander',1,0x3b4656,0x9fd6ff,'u'),
 frag('frag-u-orbit','Lunar Orbit Standard','commander',2,0x353a52,0xb8c4ff,'u'),frag('frag-u-frontier','Frontier Beacon','commander',3,0x4c4632,0xffe08a,'u'),frag('frag-u-scarab','Scarab Sigil','commander',4,0x3d2f45,0xd99cff,'u'),
 frag('frag-r-ember','Ember Muzzle Halo','trail',0,0x7a2f22,0xff6a3d,'r'),frag('frag-r-tide','Tidal Wake Vanes','trail',1,0x1f4d5c,0x3df2ff,'r'),
 frag('frag-r-aurora','Aurora Convergence','trail',2,0x2f4a3a,0x9dff9a,'r'),frag('frag-r-solar','Solar Coil Rings','trail',3,0x6a4a1a,0xffd23d,'r'),frag('frag-r-void','Void Comet Fins','trail',4,0x231d3a,0xb06bff,'r'),
 frag('frag-e-dawn','Dawnline Ramparts','base',0,0x3a3038,0xffb070,'e'),frag('frag-e-glacier','Glacier Gantries','base',1,0x2b4656,0xbaf3ff,'e'),
 frag('frag-e-nebula','Nebula Cathedral','base',2,0x3c2c52,0xf08cff,'e'),frag('frag-e-titanbone','Titan-Bone Crown','base',3,0x4a463c,0xe8e0c8,'e'),frag('frag-e-umbra','Umbra Monolith','base',4,0x1e1f2a,0xffd36e,'e'),
 // Session 7T decision 11: the return streak's town decorations (days 30, 100, 365). EARN-ONLY, never priced or sold; until row 7-V
 // draws their own art they stand in as existing town ornament designs (ConquestTown.STREAK_ART.decor names them)
 streakItem('streak-beacon30','Day-30 Signal Beacon','base',1,0x24384a,0x7fe8ff,30),streakItem('streak-monument100','Day-100 Monument','base',2,0x3a3446,0xffd36e,100),
 streakItem('streak-monolith365','Day-365 Monolith','base',4,0x14161f,0xfff1b8,365),
 weItem('we-standard','War Effort Standard','commander',1,0x2a1838,0xc9a0ff,1),weItem('we-trail','War Effort Trail','trail',2,0x1d1430,0xffd96a,2),weItem('we-monument','War Effort Monument','base',3,0x251a35,0xffe9a8,3)
]);
const byId=freeze(Object.fromEntries(items.map(i=>[i.id,i]))),slots=freeze(['base','trail','armor','commander']),pools=freeze(Object.fromEntries(['c','u','r','e'].map(p=>[p,items.filter(i=>i.pool===p).map(i=>i.id)])));
function eligible(i,s){if(typeof i==='string')i=byId[i];if(!i||!s||i.pool)return false;   // fragment pieces are granted by the Worker's fragment rule only
 const e=i.earn,r=s.raidProgress||{};return Object.entries(e).every(([k,n])=>({base:s.base?.tier||0,clears:r.clears||0,blueprint:r.blueprint?1:0,eliteBlueprint:r.eliteBlueprint?1:0,reputation:s.reputation||0,defenses:s.base?.defense?.wins||0,campaign:s.campaignScore||0,streak:s.stk?.best|0,we:s.wet|0}[k]||0)>=n);}
function state(s){const c=s?.cosmetics||{},owned=c.owned||{},equipped=c.equipped||{};return {owned,equipped,available:items.filter(i=>owned[i.id]||eligible(i,s)),checkout};}
function build(T,id,options={}){
 const i=typeof id==='string'?byId[id]:id;if(!i||!byId[i.id])throw Error('unknown Conquest cosmetic');const g=new T.Group(),segments=options.low?6:12;
 const steel=new T.MeshStandardMaterial({color:i.color,metalness:.65,roughness:.5}),trim=new T.MeshStandardMaterial({color:i.accent,metalness:.45,roughness:.35}),glow=new T.MeshBasicMaterial({color:i.accent,transparent:true,opacity:.72,depthWrite:false});
 const mesh=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m;};
 const box=(x,y,z,w,h,d,mat=steel,ry=0,rz=0)=>mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,0,ry,rz);
 const cyl=(x,y,z,r,h,mat=steel,top=r)=>mesh(new T.CylinderGeometry(top,r,h,segments),mat,x,y,z);
 const ring=(x,y,z,r,t,rx=0,ry=0)=>mesh(new T.TorusGeometry(r,t,4,segments),glow,x,y,z,rx,ry);
 const cone=(x,y,z,r,h,mat=trim)=>mesh(new T.ConeGeometry(r,h,segments),mat,x,y,z);
 // Base art stays behind/beside the functional hull and never fills its +Z entrance corridor.
 if(i.slot==='base'){
  if(i.design===0){for(const s of [-1,1]){box(s*17,2,0,2,4,25);for(const z of [-11,-4,4,11])box(s*17,4.4,z,3,1.1,2.4,trim);}box(0,2,-13,32,4,2);box(0,4.3,-13,22,.6,2.2,trim);}
  if(i.design===1){for(const s of [-1,1]){box(s*16,4,-5,2,8,3);box(s*16,7,-5,5,1,3,trim);box(s*17,3,5,1,6,10);box(s*14,8,-6,8,1,2,steel,.1*s);}box(0,9,-10,30,1,2,trim);ring(0,9,-10,2.5,.15);}
  if(i.design===2){for(const s of [-1,1]){box(s*17,3,-4,3,6,17);for(const z of [-10,2]){cyl(s*17,7,z,1.2,5);cone(s*17,10,z,1.6,2.5);}}box(0,2,-14,30,4,2);cyl(0,7,-14,2,10,steel,1);ring(0,10,-14,3,.15);}
  if(i.design===3){for(const s of [-1,1]){cyl(s*16,4,-6,1.3,8);ring(s*16,8,-6,3,.25,Math.PI/2);box(s*16,2,7,3,4,6);box(s*17,4.5,7,5,.5,8,trim);}box(0,6,-14,32,1,2);ring(0,9,-14,5,.3);ring(0,9,-14,3,.15);}
  if(i.design===4){for(const s of [-1,1]){box(s*17,3,0,3,6,24);box(s*17,6.4,-5,3.5,.8,14,trim);box(s*15,8,-12,2,4,3);cone(s*15,11,-12,1.8,3);}box(0,6,-15,9,12,3);box(0,13,-15,6,2,4,trim);ring(0,8,-16.6,2,.25);}
 }else if(i.slot==='armor'){
  // Additive side trim leaves the canonical chassis/paint/weapon/Lunar Skin readable.
  if(i.design===0)for(const s of [-1,1]){box(0,1,s*3.2,3,.3,.55,trim,.35*s);box(1.2,1,s*2.8,1.6,.3,.5,steel,-.35*s);}
  if(i.design===1)for(const s of [-1,1]){box(0,1.2,s*3.3,3.2,.9,1.1,steel,.12*s);box(-1.4,1.4,s*3.2,.3,.4,1.3,trim);}
  if(i.design===2)for(const s of [-1,1])for(let n=0;n<4;n++)box(-1.4+n*.7,1.2,s*3.1,.25,1.2,1, n%2?trim:steel,0,.2);
  if(i.design===3)for(const s of [-1,1]){box(-1,1.5,s*3.3,.4,2.2,1.2,steel,0,-.45);box(-.8,2.5,s*3.3,.45,.3,1.3,trim);box(1,.9,s*3.4,2,.25,.5,trim);}
  if(i.design===4){for(const s of [-1,1]){box(-1,1,s*3.2,3,1,1.2);cone(-1,2.2,s*3.2,.65,1.8);box(1,1.3,s*3.2,1.3,.3,1.4,trim);}ring(-2,2.6,0,1,.12,0,Math.PI/2);}
 }else if(i.slot==='trail'){
  // Axis +X is the muzzle direction. Mount these alongside the real muzzle; no canonical beam replacement.
  if(i.design===0){ring(0,0,0,.55,.1,0,Math.PI/2);ring(1,0,0,.35,.08,0,Math.PI/2);for(const s of [-1,1])box(.3,s*.7,0,1.2,.12,.2,trim);}
  if(i.design===1)for(const s of [-1,1]){box(2,s*.4,0,4,.12,.2,glow,0,.04*s);box(.3,s*.65,0,1,.2,.4,steel);}
  if(i.design===2){for(let n=0;n<3;n++){const a=n*Math.PI*2/3;mesh(new T.BoxGeometry(2.5,.12,.2),glow,1,Math.sin(a)*.6,Math.cos(a)*.6, a,0,0);}ring(0,0,0,.7,.08,0,Math.PI/2);}
  if(i.design===3){for(let n=0;n<4;n++)ring(n*.6,0,0,.65-n*.1,.1,0,Math.PI/2);box(.6,0,-.8,2,.35,.2,steel);box(.6,0,.8,2,.35,.2,steel);}
  if(i.design===4)for(const s of [-1,1]){box(2,0,s*.4,4,.15,.2,glow,.04*s);box(.1,0,s*.65,1.2,.4,.2,steel,.15*s);ring(3,0,s*.4,.2,.06,0,Math.PI/2);}
 }else{
  box(0,.5,0,7,1,3);box(0,1.1,0,5,.2,2,trim);
  if(i.design===0){box(0,4,0,.35,6,.35,trim);box(1.6,5,0,3.2,2,.15,steel);box(1.6,5,.1,2,.35,.12,trim);}
  if(i.design===1){for(const s of [-1,1])for(let n=0;n<3;n++)box(s*(1.2+n*.8),2.2+n*.55,0,1.5,.4,.5,trim,0,s*.5);cyl(0,2.5,0,.5,3);}
  if(i.design===2){cyl(0,2,0,.35,2);ring(0,3.5,0,2,.16);ring(0,3.5,0,1.4,.12,Math.PI/2);mesh(new T.SphereGeometry(.55,segments,6),trim,0,3.5,0);}
  if(i.design===3){cyl(0,3,0,.7,4,steel,.4);cone(0,5.5,0,1.2,1.8);ring(0,5,0,2,.15,Math.PI/2);for(const s of [-1,1])box(s*1.5,3.3,0,.35,2,.7,trim,0,s*.4);}
  if(i.design===4){for(const s of [-1,1]){box(s*1.3,3.5,0,.8,4,.8,steel,0,s*.4);cone(s*1.7,5.5,0,.7,1.8,glow);}ring(0,3.7,0,1.5,.18);box(0,3.8,0,1.1,1.1,.7,trim,0,Math.PI/4);}
 }
 g.userData={cosmeticId:i.id,slot:i.slot,competitive:false,materialCount:3,reducedMotion:!!options.reducedMotion};return g;
}
function draw2D(ctx,id,x,y,scale=1){const i=typeof id==='string'?byId[id]:id;if(!i)return;const hex=n=>'#'+n.toString(16).padStart(6,'0');ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineWidth=2;ctx.strokeStyle=hex(i.accent);ctx.fillStyle=hex(i.color);
 if(i.slot==='base'){ctx.fillRect(-28,-13,7,27);ctx.fillRect(21,-13,7,27);ctx.fillRect(-24,-19,48,6);for(let n=0;n<i.design+2;n++){const px=-20+n*40/(i.design+1);ctx.beginPath();ctx.moveTo(px-3,-20);ctx.lineTo(px,-29-i.design*2);ctx.lineTo(px+3,-20);ctx.closePath();ctx.stroke();}ctx.strokeRect(-16,-11,32,16);}
 if(i.slot==='armor'){ctx.fillRect(-16,-9,32,18);for(const s of [-1,1]){ctx.strokeRect(-18,s*12-2,36,4);for(let n=0;n<i.design+2;n++){ctx.beginPath();ctx.moveTo(-12+n*7,s*12);ctx.lineTo(-8+n*7,s*(17+i.design));ctx.stroke();}}ctx.fillStyle='#15212b';ctx.fillRect(-9,-5,18,10);}
 if(i.slot==='trail'){ctx.fillRect(-26,-4,15,8);for(let n=0;n<i.design+2;n++){ctx.beginPath();ctx.ellipse(-5+n*8,0,3,6+n,0,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(27,0);ctx.stroke();}
 if(i.slot==='commander'){ctx.fillRect(-20,17,40,6);ctx.fillRect(-2,-18,4,36);for(let n=0;n<i.design+2;n++){ctx.beginPath();ctx.moveTo(-18+n*36/(i.design+1),-7);ctx.lineTo(0,-25+i.design);ctx.lineTo(18-n*36/(i.design+1),-7);ctx.stroke();}ctx.strokeRect(-6,-13,12,12);}
 ctx.restore();}
root.ConquestCatalog=freeze({items,byId,slots,pools,checkout,eligible,state,build,draw2D});
})(globalThis);
