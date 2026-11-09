/* Command Base town view (Session 5 base builder, Session 5B Town Defense). The pilot's private town on the phone: site
   choice at first build, build mode (top-down camera, pinch zoom, two-finger pan, grid snapping, rotate, move, hologram
   preview with valid/invalid tint, turret range rings), the fast wall tools (line, rectangle, ring, copy/paste, erase, undo)
   with the ore-blend picker and live wall count/cost, live construction (scaffolding and drones), settler homes, crew and
   rovers, the whole-town raid replay (Defense Drill: breaches, fallen structures, vitals) and the town status.
   Presentation only: every change is a Worker action (worker/src/conquest-plot.js) validated with the shared rules
   (js/conquest/plot.js). Renders through the Conquest view's own renderer (one WebGL context, shared style programs; walls,
   turrets, homes and raiders are instanced); the 2D setting gets a top-down canvas town with the same controls. */
(function(root){
'use strict';
const P=root.ConquestPlot;
let X=null;   // the open town view
const fmt=n=>typeof fmtNum==='function'?fmtNum(n):String(n);
const LABEL={cp:'CP',alloy:'ALLOY',biomass:'BIOMASS',helium:'HELIUM-3',cm:'COMPOSITE',fe:'FERRITE',il:'ILMENITE',ar:'ARMALCOLITE',tq:'TRANQ.',se:'SELENITE',mh:'MOONHEART'};
const price=c=>Object.entries(c||{}).filter(([,n])=>n>0).map(([k,n])=>fmt(n)+' '+LABEL[k]).join(' + ');
const dur=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return s<60?s+'s':s<3600?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';};
const ICON={cc:'◆',refinery:'⚙',storage:'▦',reactor:'⚡',foundry:'▤',biodome:'✿',hangar:'⌂',helium:'⛽',radar:'◎',shield:'⛨',lab:'⚗',uplink:'⇡',trophy:'♛',cannon:'●',mg:'⁞',laser:'✦',rocket:'⁂',missile:'➹',mortar:'◉',flame:'♨',siege:'■',tesla:'ϟ',lasercannon:'✷',railgun:'═',gate:'▯'};
// wall look per ore (index 0 = composite): body colour, accent colour, accent glow
const ORE_LOOK=[[0x8a8676,0x5c5a50,0],[0x7a4a2c,0xb7a28a,.15],[0x23262c,0x5fa8ff,.55],[0x55657e,0x22e6ff,1],[0x3a2420,0xff7a3d,1.1],[0xbab2e8,0xf6f0ff,1.5],[0x10141f,0x9fe8ff,2.2]];
const hex=n=>'#'+n.toString(16).padStart(6,'0');
const romanOf=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n]||String(n);
const ownerUI=()=>typeof isOwnerUI==='function'&&isOwnerUI();
const devOn=()=>!!X?.ctx.view.authority?.state?.dev?.on;
const hasWallet=k=>((typeof save!=='undefined'&&save.mn?.[k])||0)>0;
function storesOf(s,p){const bm=(typeof save!=='undefined'&&save.bmn)||s?.airdrop?.view?.bmn||{},sp=p?.mnSpent||{},o={};for(const k of P.MNS)o[k]=Math.max(0,(bm[k]||0)-(sp[k]||0));return o;}
function guideStep(p,s){// one clear step at a time, never a wall of options (owner: nothing overwhelming)
 if(!p)return null;const has=t=>Object.values(p.b).some(b=>b.t===t&&(b.l>0||p.job?.id&&p.b[p.job.id]===b)),walls=Object.values(p.w||{});
 if(!has('refinery'))return {id:'refinery',tab:'build',text:'STEP 1 · BUILD A REFINERY: it smelts plot regolith and scrap into alloy. Tap BUILD.'};
 if(!P.TURRETS.some(has))return {id:'cannon',tab:'build',text:'STEP 2 · PLACE A CANNON TURRET: your first defense.'};
 if(!walls.length)return {id:'wall',tab:'walls',text:'STEP 3 · YOUR FIRST WALL: open WALLS, pick RING and drag from your Command Center outward. Composite is free to start (200).'};
 if(!has('reactor'))return {id:'reactor',tab:'build',text:'STEP 4 · PLACE A VITAL: build a REACTOR inside your walls. Raiders hunt vitals; if it falls, turrets slow down.'};
 const fe=(storesOf(s,p).fe||0)>0||hasWallet('fe');
 if(fe&&!walls.some(c=>P.wdecode(c).o>0))return {id:'blend',tab:'walls',text:'STEP 5 · YOUR FIRST BLEND: in WALLS pick FERRITE · LIGHT and draw over your wall. Ore makes walls stronger, tougher and reflective.'};
 if(!(p.log||[]).length)return {id:'drill',tab:'drill',text:'STEP '+(fe?6:5)+' · RUN A DEFENSE DRILL: watch Parasites raid your whole town (no rewards).'};
 if(p.cc<2)return {id:'cc',tab:'view',text:'NEXT · UPGRADE THE COMMAND CENTER TO CC2: the town grows and unlocks the Foundry, Biodome and Laser.'};
 return null;}
function unlockLine(p){const cc=p.cc,next=Object.entries(P.BUILDINGS).filter(([,B])=>B.cc===cc+1).map(([,B])=>B.n),ores=P.ORES.filter((m,o)=>P.ORE_CC[o+1]===cc+1).map(m=>P.ORE_NAME[m]+' blends');
 return cc>=P.CC.max?'COMMAND CENTER AT MAXIMUM':'NEXT AT CC'+(cc+1)+': town '+P.townSide(cc+1)+'×'+P.townSide(cc+1)+', '+P.wallBase(cc+1)+' walls, '+P.TURRET_CAP[cc]+' turrets'+([...next,...ores].length?', '+[...next,...ores].join(', '):'');}

// ------------------------------------------------------------------- 3D models (style kit) -----------------------------
function kit(S){const T=S.T,K=S.K,G=S.G,lin=h=>new T.Color(h),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3();
 const M=(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{_e.set(rx,ry,rz);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));};
 const C={rust:lin(0x7a4a2c),sand:lin(0x8f7c62),moss:lin(0x3f5a2a),plant:lin(0x3fae4a),glass:lin(0x9fd8ff),furnace:lin(0xff8a3d),steel:lin(0x6d7884),timber:lin(0x6a4a2e),timberD:lin(0x4a3220),comp:lin(0x8a8676),warm:lin(0xffc47a),
  paint:[lin(0xb8553a),lin(0x5a7a8a),lin(0xc9a04a),lin(0x6a8a4a),lin(0x8a5a7a),lin(0xd8c8a0)],gold:K.gold,cyan:K.cyan,amber:K.amber,dark:K.dark,dark2:K.dark2,mid:K.mid,panel:K.panelA,panelB:K.panelB,roof:K.roof,violet:K.violet,red:K.red,teal:K.teal,ice:K.ice,mag:K.mag};
 const LIGHT={cyan:K.cyan,amber:K.amber,violet:K.violet,green:K.teal,red:K.red};let themeLight=null;
 const accent=l=>l>=5?C.gold:themeLight||(l>=3?C.teal:C.cyan);
 // A building at the local origin, footprint centred, facing +z; every level visibly changes it.
 function building(type,l,theme){themeLight=theme?.light?LIGHT[theme.light]||null:null;const b=new S.Bld(),fin=theme?.finish==='sand'?C.sand:theme?.finish==='graphite'?C.dark:C.steel,s=P.sizeOf(type),W=s.w*P.GRID.cell,D=s.d*P.GRID.cell,L=Math.max(1,l),a=accent(L),hw=W/2,hd=D/2;
  const pad=()=>{b.box(0,.15,0,W-.4,.3,D-.4,C.dark2);b.box(0,.32,hd-.35,W-.8,.05,.08,a,.7);};
  const vital=()=>{if(P.VITALS[type])for(const sx of [-1,1])b.box(sx*(hw-.5),.36,-hd+.5,.6,.08,.6,C.gold,1.3);};   // gold corner marks: a vital
  switch(type){
   case 'cc':{pad();let y=.3;const tiers=Math.min(10,L);for(let k=0;k<tiers;k++){const r=6.6-k*.48,h=1.5+(k%2)*.5;b.add(G.oct,M(0,y,0,0,k*.2,0,r,h,r),k%2?C.mid:fin);b.add(G.torus,M(0,y+h,0,Math.PI/2,0,0,r*.98,r*.98,r*.98),a,.8);y+=h;}
    b.add(G.cyl,M(0,y,0,0,0,0,.25,6+L*.4,.25),C.panel);b.box(0,y+6.2+L*.4,0,.7,.7,.7,L>=9?C.gold:C.ice,1.6);if(L>=5)for(const sx of [-1,1])for(const sz of [-1,1]){b.box(sx*5.6,2.2,sz*5.6,1.6,4.4+L*.25,1.6,C.dark);b.box(sx*5.6,4.5+L*.25,sz*5.6,1.8,.2,1.8,a,1);}
    if(L>=9){b.add(G.torus,M(0,y+2,0,Math.PI/2,0,0,4.2,4.2,4.2),C.gold,1.2);}for(const sx of [-1,1])for(const sz of [-1,1])b.box(sx*7.4,.4,sz*7.4,.8,.1,.8,C.gold,1.5);break;}
   case 'refinery':{pad();b.box(-hw*.35,2.2,-hd*.2,W*.5,4.4,D*.55,fin);b.box(-hw*.35,4.5,-hd*.2,W*.52,.25,D*.57,C.roof);
    b.add(G.cyl,M(hw*.42,0,-hd*.35,0,0,0,1.5,6+L*.8,1.5),C.mid);b.add(G.cyl,M(hw*.42,5.8+L*.8,-hd*.35,0,0,0,1.65,.3,1.65),a,1);b.add(G.cyl,M(hw*.42,2,-hd*.35,0,0,0,1.55,.6,1.55),C.furnace,1.5);
    b.box(hw*.12,1.1,hd*.25,1,.25,D*.5,C.dark);b.box(hw*.12,1.25,hd*.25,.8,.06,D*.5,C.amber,.6);b.box(-hw*.2,1.6,hd*.62,2.2,2.2,1.6,C.rust);
    if(L>=2)b.add(G.cyl,M(-hw*.75,0,hd*.45,0,0,0,.6,4+L,.6),C.dark);if(L>=3)b.add(G.cyl,M(hw*.42,0,hd*.1,0,0,0,1.1,4+L*.6,1.1),C.mid);if(L>=4)b.box(-hw*.35,5,-hd*.2,W*.3,1.2,D*.3,C.panel);if(L>=5)b.add(G.cyl,M(hw*.42,0,hd*.42,0,0,0,.9,8,.9),C.gold,.3);break;}
   case 'storage':{pad();vital();for(let k=0;k<Math.min(5,L)+1;k++){const x=-hw+1.8+(k%3)*3.6,z=-hd+2+Math.floor(k/3)*4.5;b.add(G.cyl,M(x,.3,z,0,0,0,1.4,2.6+L*.4,1.4),k%2?fin:C.mid);b.add(G.torus,M(x,2.95+L*.4,z,Math.PI/2,0,0,1.42,1.42,1.42),a,.7);}
    for(let k=0;k<3+L;k++)b.box(-hw+1+(k%4)*1.6,.7+Math.floor(k/4)*.9,hd-1.4,1.3,.85,1.3,k%2?C.rust:C.sand);break;}
   case 'reactor':{pad();vital();b.add(G.cyl,M(0,.3,0,0,0,0,3.6,3+L*.6,3.6),C.dark);const top=3.3+L*.6;for(let k=0;k<L+1;k++)b.add(G.torus,M(0,1+k*(top-1)/(L+1),0,Math.PI/2,0,0,3.75,3.75,3.75),C.cyan,1.1);b.add(G.ico,M(0,top+.8,0,0,0,0,1.3,1.3,1.3),C.ice,2);
    if(L>=3)for(const sx of [-1,1])b.add(G.cyl,M(sx*(hw-1.4),.3,-hd+1.4,0,0,0,1,4+L*.5,1),fin);break;}
   case 'foundry':{pad();b.box(0,2,-hd*.15,W-1.6,4,D*.6,fin);b.box(0,4.1,-hd*.15,W-1.4,.25,D*.62,C.roof);b.add(G.cyl,M(-hw*.45,0,-hd*.4,0,0,0,.7,6+L,.7),C.dark);b.add(G.cyl,M(-hw*.45,5.6+L,-hd*.4,0,0,0,.8,.25,.8),C.furnace,1.4);
    b.add(G.cyl,M(hw*.3,.3,hd*.25,0,0,0,1.2,1.6,1.2),C.rust);b.add(G.cyl,M(hw*.3,1.9,hd*.25,0,0,0,1.25,.15,1.25),C.furnace,1.8);   // the crucible
    for(let k=0;k<2+L;k++)b.box(-hw+1.2+(k%3)*1.3,.55+Math.floor(k/3)*.75,hd-1.1,1.1,.7,1.1,C.comp);b.box(0,2.2,hd*.15+.05,W-3,1.2,.1,C.amber,1);break;}
   case 'biodome':{pad();b.add(G.hex,M(0,.3,0,0,0,0,hw-.4,.8,hd-.4),C.dark2);const R=Math.min(hw,hd)-.8,h=2.4+L*.7;for(let k=0;k<8;k++){const ang=k/8*Math.PI*2;b.add(G.box,M(Math.cos(ang)*R*.5,1.1+h*.45,Math.sin(ang)*R*.5,0,-ang,Math.PI/2-.9,.12,R*1.25,.12),C.panel);}
    b.add(G.ico,M(0,1.1,0,0,0,0,R*.98,h,R*.98),C.glass,.18);for(let k=0;k<4+L*2;k++){const ang=k*2.4,r=(k%3+1)*R*.22;b.add(G.cone6,M(Math.cos(ang)*r,1.1,Math.sin(ang)*r,0,ang,0,.5,.8+L*.35+(k%2)*.4,.5),k%2?C.plant:C.moss,.25);}break;}
   case 'hangar':{pad();b.box(0,3,-hd*.15,W-1,6,D*.7,fin);b.box(0,6.1,-hd*.15,W-.8,.3,D*.72,C.roof);b.box(0,3,hd*.2+.1,W-2.4,5.2,.2,C.dark);for(let k=0;k<Math.min(4,L);k++){const x=-hw+2.5+k*((W-5)/Math.max(1,Math.min(4,L)-1||1));b.box(x,.9,hd*.35,2.2,1,3.2,C.mid);b.box(x,1.7,hd*.3,1.4,.6,1.6,C.dark2);b.box(x,1.75,hd*.3+1.4,.18,.18,1.8,C.dark);}
    b.box(0,5.9,hd*.21,W-2.4,.2,.15,a,1);break;}
   case 'helium':{pad();for(const sx of [-1,1])for(const sz of [-1,1])b.seg(new T.Vector3(sx*1.8,.3,sz*1.8),new T.Vector3(0,6+L,0),.18,C.panel);b.add(G.cyl,M(0,.3,0,0,0,0,.45,4,.45),C.dark);for(let k=0;k<Math.min(4,L);k++)b.add(G.cyl,M(-hw+1.2+k*1.9,.3,hd-1.2,0,0,0,.8,1.8,.8),C.ice,.25);b.box(0,6+L,0,.5,.5,.5,a,1.4);break;}
   case 'radar':{pad();b.add(G.cyl,M(0,.3,0,0,0,0,.5,3+L*.5,.5),C.mid);b.box(0,.8,0,3,1,3,C.dark);break;}
   case 'shield':{pad();b.add(G.hex,M(0,.3,0,0,0,0,1.8,1.4,1.8),C.dark);b.add(G.cone6,M(0,1.7,0,0,0,0,.9,3+L*.6,.9),C.mid);b.add(G.ico,M(0,5+L*.6,0,0,0,0,.7,.7,.7),C.cyan,2);break;}
   case 'lab':{pad();vital();b.box(0,2,0,W-1.4,4,D-1.4,fin);b.box(0,4.1,0,W-1.2,.25,D-1.2,C.roof);b.add(G.cyl,M(0,4.2,0,0,0,0,1.6,.4+L*.4,1.6),C.violet,.8);b.box(0,2.4,hd-.65,W-3,1.4,.1,C.violet,1);break;}
   case 'uplink':{pad();const h=6+L*1.6;for(const sx of [-1,1])for(const sz of [-1,1])b.seg(new T.Vector3(sx*1.4,.3,sz*1.4),new T.Vector3(sx*.25,h,sz*.25),.12,C.panel);for(let k=1;k<4;k++)b.box(0,h*k/4,0,2.8*(1-k/4)+.3,.08,.08,C.mid);b.box(0,h+.3,0,.35,.6,.35,C.red,2);break;}
   case 'trophy':{pad();b.box(0,2.2,-hd*.2,W-1.4,4.4,D*.55,C.dark2);b.add(G.cone5,M(0,4.4,-hd*.2,0,Math.PI/4,0,W*.5,1.6,D*.4),C.gold,.2);for(let k=0;k<3+L*2;k++){const x=-hw+1.4+(k%5)*((W-2.8)/4),z=hd-1.8+Math.floor(k/5)*-1.2;b.box(x,.7,z,.8,.8,.8,C.dark);b.add(G.octa,M(x,1.5,z,0,k,0,.3,.4,.3),k%3?C.gold:C.ice,1.4);}break;}
   case 'gate':{b.box(0,1.8,0,3.8,3.6,3.8,C.dark);b.box(0,1.6,1.95,2.4,3,.1,C.amber,.8);b.box(0,3.65,0,4,.15,4,C.cyan,1);break;}
   default:{const B=P.BUILDINGS[type];if(B?.turret){const big=B.pw>1;b.add(G.hex,M(0,0,0,0,0,0,big?1.85:1.6,.6,big?1.85:1.6),C.dark2);b.add(G.cyl,M(0,.6,0,0,0,0,big?1.05:.9,.6+L*.15,big?1.05:.9),fin);b.add(G.torus,M(0,1.25+L*.15,0,Math.PI/2,0,0,.95,.95,.95),a,.7);for(let k=1;k<L;k++)b.box(0,.62+k*.12,big?1.1:.95,.5,.05,.05,C.gold,1);}}}
  return b;}
 // The rotating head of every turret type (and the radar dish): its own silhouette, so each role reads at a glance.
 function head(type,l){const b=new S.Bld(),L=Math.max(1,l),a=accent(L);
  switch(type){
   case 'cannon':b.box(0,0,0,1.4,.9,1.6,C.mid);b.add(G.cyl,M(0,.15,.6,Math.PI/2,0,0,.18,2.2+L*.2,.18),C.dark);b.box(0,.48,-.79,1,.1,.04,a,.9);break;
   case 'mg':b.box(0,0,-.1,1.1,.75,1.2,C.mid);for(const sx of [-.24,.24]){b.add(G.cyl,M(sx,.12,.4,Math.PI/2,0,0,.09,1.9+L*.15,.09),C.dark);b.add(G.cyl,M(sx,.12,2.2+L*.15,Math.PI/2,0,0,.13,.25,.13),C.dark2);}b.box(.7,-.05,-.1,.35,.5,.7,C.amber,.25);break;
   case 'laser':b.add(G.ico,M(0,.2,0,0,0,0,.75,.75,.75),C.dark);b.add(G.cyl,M(0,.2,.4,Math.PI/2,0,0,.28,1.4,.28),C.panel);b.box(0,.2,1.85,.32,.32,.1,C.cyan,2.2);break;
   case 'rocket':b.box(0,.3,0,1.7,1.2,1.4,C.mid);for(let k=0;k<6;k++)b.add(G.cyl,M(-.5+(k%3)*.5,.05+Math.floor(k/3)*.5,.72,Math.PI/2,0,0,.18,.12,.18),C.dark2);for(let k=0;k<6;k++)b.box(-.5+(k%3)*.5,.05+Math.floor(k/3)*.5,.79,.16,.16,.02,C.furnace,1.2);b.box(0,.95,0,1.5,.08,1.2,a,.6);break;
   case 'missile':b.box(0,.3,0,1.6,1,1.4,C.mid);for(let k=0;k<4;k++)b.box(-.4+(k%2)*.8,.1+Math.floor(k/2)*.45,.72,.35,.35,.12,C.red,1);break;
   case 'mortar':b.add(G.cyl,M(0,0,0,-.7,0,0,.45,1.8+L*.15,.45),C.dark);b.add(G.cyl,M(0,0,0,0,0,0,.7,.4,.7),C.mid);break;
   case 'flame':b.add(G.cyl,M(0,.1,-.5,0,0,0,.45,1.1,.45),C.rust);b.add(G.cyl,M(0,.15,.2,Math.PI/2,0,0,.22,1.3,.22),C.dark);b.add(G.cone6,M(0,.15,1.5,Math.PI/2,0,0,.32,.4,.32),C.dark2);b.box(0,.15,1.72,.14,.14,.06,C.furnace,2.4);break;
   case 'siege':b.box(0,.1,-.2,1.9,1.2,2.1,C.mid);b.add(G.cyl,M(0,.25,.7,Math.PI/2,0,0,.32,3.2+L*.3,.32),C.dark);b.add(G.cyl,M(0,.25,3.9+L*.3,Math.PI/2,0,0,.42,.5,.42),C.dark2);for(const sx of [-.7,.7])b.add(G.cyl,M(sx,.05,.3,Math.PI/2,0,0,.12,1.4,.12),C.panel);b.box(0,.75,-1.25,1.2,.1,.04,a,1);break;
   case 'tesla':b.add(G.cyl,M(0,-.2,0,0,0,0,.5,2.2,.5),C.dark);for(let k=0;k<3+Math.min(2,L>>1);k++)b.add(G.torus,M(0,.1+k*.42,0,Math.PI/2,0,0,.62-k*.06,.62-k*.06,.62-k*.06),C.panel,.3);b.add(G.ico,M(0,2.25,0,0,0,0,.42,.42,.42),C.violet,2.6);break;
   case 'lasercannon':b.box(0,0,-.3,1.5,1,1.6,C.dark);b.add(G.cone6,M(0,.15,.9,-Math.PI/2,0,0,.9,.7,.9),C.panelB);b.add(G.torus,M(0,.15,.95,0,0,0,.72,.72,.72),C.mag,1.8);b.box(0,.15,1.05,.3,.3,.1,lin(0xffd0f4),2.6);break;
   case 'railgun':b.box(0,0,-.6,1.4,.9,1.6,C.mid);for(const sx of [-.28,.28])b.box(sx,.2,1.4,.14,.32,3.8+L*.25,C.dark);b.box(0,.2,1.4,.06,.06,3.6+L*.25,C.cyan,2);b.box(0,.6,-.6,1,.12,1.2,a,.9);break;
   case 'radar':b.add(G.cone6,M(0,.4,0,Math.PI*.38,0,0,1.6+l*.25,.6,1.6+l*.25),C.panelB);b.box(0,.2,0,.3,.6,.3,a,1.2);break;}
  return b;}
 // One wall cell (4 m square) with its blend look: composite concrete; ore tints, sheen bands, veins, Selenite glass glint,
 // a deep Moonheart glow; heavier blends stand taller with more veins. LOW keeps the body, cap and one band.
 function wallGeo(code,low){const b=new S.Bld(),{o,l}=P.wdecode(code),q=P.blendQ(o,l),h=2.6+1.3*q,W=4.02,[body,acc,glow]=ORE_LOOK[o],bc=lin(body),ac=lin(acc);
  b.box(0,h/2,0,W,h,W,bc);b.box(0,h+.08,0,W+.06,.16,W+.06,o>=5?ac:o?bc.clone().multiplyScalar(1.35):C.dark2,o>=5?glow*.6:0);
  if(!o){b.box(0,h*.55,0,W+.03,.08,W+.03,lin(0x5c5a50));return b.geometry();}
  for(let k=0;k<(low?1:Math.max(1,l-1));k++)b.box(0,h*(.34+.26*k),0,W+.04,o>=4?.14+.04*l:.1,W+.04,ac,glow*(.55+.25*l));
  if(low)return b.geometry();
  if(o===1)for(let k=0;k<l*2;k++)b.box(-1.4+k*.9,h*.7,W/2+.02,.25,.25,.05,ac,.1);
  if(o===4)for(let k=0;k<l*2;k++)b.add(G.cone5,M(-1.2+(k%3)*1.2,h+.12,-1+Math.floor(k/3)*1.6,.15,k,0,.18,.6+.2*l,.18),ac,1.3);
  if(o===5){b.box(0,h+.2,0,W*.9,.04,.3,lin(0xffffff),2.4,Math.PI/4);if(l>=2)b.box(0,h*.5,W/2+.03,.12,h*.8,.04,lin(0xffffff),1.8,0);}
  if(o===6)b.box(0,h+.22,0,W*.5,.06,W*.5,ac,glow*1.2);
  return b.geometry();}
 // Settler homes and town structures (Session 5 settler kit look: painted prefab domes, timber porches, habitat blocks,
 // water towers, greenhouses, market stalls; warm amber lights). A 2x2 lot (8 m), centred at the origin.
 function home(kind,low){const b=new S.Bld(),pc=C.paint;switch(kind){
   case 'dome':b.box(0,.15,0,7,.3,7,C.dark2);b.add(G.hex,M(0,.3,-.5,0,0,0,2.6,1.6,2.6),pc[1]);b.add(G.dome,M(0,1.9,-.5,0,0,0,2.55,2,2.55),pc[0]);b.add(G.hex,M(0,1.2,-.5,0,0,0,2.62,.35,2.62),C.warm,.8);
    b.box(0,.45,2.3,3.4,.3,1.8,C.timber);for(const sx of [-1,1])b.box(sx*1.5,1.3,3.1,.18,2.2,.18,C.timberD);b.box(0,2.45,2.4,3.6,.14,2,C.comp);if(!low)b.add(G.cyl,M(1.4,2.6,-1.4,0,0,0,.22,1.6,.22),C.rust);break;
   case 'block':b.box(0,.15,0,7,.3,7,C.dark2);b.box(0,1.6,0,5.6,3,5,pc[5]);b.box(.3,4.1,-.2,4.8,2,4.2,pc[2]);for(const y of [1.6,4.1])b.box(0,y,2.52,4.6,.45,.06,C.warm,.7);b.box(0,3.2,2.7,3.4,.16,1,C.timber);
    if(!low){b.box(-2.85,1.4,0,.06,1.2,3,pc[4],.5);b.add(G.cyl,M(0,5.1,0,0,0,0,1.1,1.5,1.1),pc[3]);b.add(G.cone6,M(0,6.6,0,0,0,0,1.2,.5,1.2),C.roof);}break;
   case 'tower':b.box(0,.15,0,7,.3,7,C.dark2);for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.seg(new T.Vector3(sx*2.2,.3,sz*2.2),new T.Vector3(sx*1.1,6.5,sz*1.1),.2,C.rust);b.add(G.cyl,M(0,6.4,0,0,0,0,2.2,2.4,2.2),pc[3]);b.add(G.cyl,M(0,7.2,0,0,0,0,2.25,.5,2.25),pc[0]);b.add(G.cone6,M(0,8.8,0,0,0,0,2.3,.7,2.3),C.roof);b.box(0,9.6,0,.3,.3,.3,C.amber,1.6);break;
   case 'green':b.box(0,.15,0,7,.3,7,C.dark2);b.box(0,.6,0,6,.6,4.6,C.moss);b.add(G.cyl,M(0,.9,0,0,0,Math.PI/2,2.3,6,2.3),C.glass,.25);for(let k=-2;k<=2;k++)b.box(k*1.3,2.1,0,.12,2.4,4.8,pc[(k+5)%6]);if(!low)for(let k=0;k<6;k++)b.add(G.cone6,M(-2.2+k*.9,.9,(k%2-.5)*1.6,0,k,0,.4,1,.4),C.plant,.25);break;
   default:b.box(0,.15,0,7,.3,7,C.dark2);b.box(0,1.8,-.8,6,3.4,4,pc[2]);b.box(0,1.3,1.25,5.2,2.2,.1,C.warm,.8);for(let k=0;k<6;k++)b.box(-2.5+k,3.5,1.8,1,.12,1.4,k%2?lin(0xd8c8a0):pc[0]);
    if(!low)for(let k=0;k<4;k++)b.box(-2.6+(k%2)*.95,.45+Math.floor(k/2)*.85,2.6,.85,.85,.85,k%2?C.timber:C.rust);}
  return b.geometry();}
 function person(){const b=new S.Bld();b.box(0,.55,0,.35,.7,.25,C.amber);b.box(0,1.08,0,.24,.26,.24,C.panelB);return b.geometry();}
 function rover(){const b=new S.Bld();b.box(0,.6,0,1.2,.5,2,C.sand);b.box(0,1,-.3,.9,.4,.9,C.dark2);for(const sx of [-1,1])for(const sz of [-.7,.7])b.add(G.cylC,M(sx*.7,.35,sz,0,0,Math.PI/2,.35,.25,.35),C.dark);b.box(0,1.25,-.3,.2,.1,.2,C.cyan,1.5);return b.geometry();}
 function foe(kind){const b=new S.Bld();if(kind==='d'){b.add(G.blob1,M(0,0,0,0,0,0,1.3,.55,1.3),K.chitin);b.box(0,0,0,3.4,.1,.4,K.mag,2.2);b.add(G.octa,M(0,.5,0,0,0,0,.4,.4,.4),K.magHot,2.4);}
  else if(kind==='w'){b.add(G.blob1,M(0,.5,0,0,0,0,.8,.55,1.1),K.chitin);b.box(0,.6,.8,.5,.12,.12,K.mag,2.4);}
  else if(kind==='b'){b.add(G.blob1,M(0,2.2,0,0,0,0,3.4,2.4,3.8),K.chitinD||K.chitin);for(const sx of [-1,1])b.box(sx*2.4,2.4,.6,.9,2.6,2.8,K.dark2);b.box(0,3.2,3.4,2.2,.4,.3,K.mag,2.4);b.add(G.octa,M(0,4.8,0,0,0,0,.7,.9,.7),K.magHot,2.2);}
  else{const s=kind==='s'?2.6:1.7;b.add(G.blob1,M(0,s*.7,0,0,0,0,s,s*.7,s*1.3),K.chitin);b.box(0,s*.95,s*1.15,s*.6,s*.18,.18,K.mag,2.4);b.add(G.octa,M(0,s*1.6,0,0,0,0,.35*s,.45*s,.35*s),K.magHot,2.2);}return b.geometry();}
 // Banner: mast + two-colour flag in the chosen shape, emblem as a small lit mark. Shared by the base and the tank.
 function banner(bn,scale=1){const b=new S.Bld(),c1=new T.Color(bn.colors[0]),c2=new T.Color(bn.colors[1]),h=6*scale,w=2.6*scale,fh=1.7*scale;b.box(0,h/2,0,.16*scale,h,.16*scale,C.dark);
  if(bn.shape==='pennant'){b.add(G.cone5,M(w/2,h-fh/2,0,0,0,-Math.PI/2,fh/2,w,.08*scale),c1);b.box(w*.25,h-fh/2,0,w*.5,fh*.18,.1*scale,c2);}
  else if(bn.shape==='chevron'){b.box(w/2,h-fh/2,0,w,fh,.08*scale,c1);b.box(w/2,h-fh*.5,0,w*.7,fh*.2,.1*scale,c2,0,0);b.add(G.box,M(w*.75,h-fh*.62,0,0,0,.6,w*.45,fh*.16,.1*scale),c2);}
  else if(bn.shape==='square'){b.box(w/2,h-fh/2,0,w,fh,.08*scale,c1);b.box(w/2,h-fh/2,0,w*.9,fh*.12,.1*scale,c2);}
  else{b.box(w/2,h-fh*.45,0,w,fh*.9,.08*scale,c1);b.add(G.cone5,M(w/2,h-fh*.9,0,Math.PI,0,0,w*.5,fh*.4,.07*scale),c1);b.box(w/2,h-fh*.45,0,w*.12,fh*.9,.1*scale,c2);}
  b.add(G.octa,M(w/2,h-fh*.45,.08*scale,0,0,0,.28*scale,.28*scale,.06*scale),c2,1.6);return b;}
 function decor(list,x0,z0,W,D,light){const b=new S.Bld(),L=LIGHT[light]||C.cyan;list.forEach((d,i)=>{const a=i/Math.max(1,list.length)*Math.PI*2,x=x0+Math.cos(a)*(W/2+3),z=z0+Math.sin(a)*(D/2+3);
  if(d==='lamps'){b.box(x,1.6,z,.18,3.2,.18,C.dark);b.box(x,3.3,z,.5,.3,.5,L,2);}else if(d==='crates'){b.box(x,.45,z,.9,.9,.9,C.rust);b.box(x+.8,.4,z+.3,.8,.8,.8,C.sand);}
  else if(d==='antenna'){b.box(x,2.5,z,.12,5,.12,C.panel);b.box(x,5,z,.3,.3,.3,C.red,2);}else if(d==='plants'){b.add(G.cone6,M(x,0,z,0,i,0,.6,1.4,.6),C.plant,.2);b.add(G.cone6,M(x+.8,0,z+.4,0,i,0,.45,1,.45),C.moss,.2);}
  else if(d==='statue'){b.box(x,.5,z,1.6,1,1.6,C.dark2);b.add(G.ico,M(x,1.8,z,0,0,0,.7,1,.7),C.gold,.5);}else if(d==='flags'){for(const k of [-1,1]){b.box(x+k*.6,1.8,z,.1,3.6,.1,C.dark);b.box(x+k*.6+.45,3.2,z,.9,.6,.05,L,.6);}}});return b;}
 return {T,M,C,building,head,wallGeo,home,person,rover,foe,lin,banner,decor};}

// ------------------------------------------------------------------- scene ---------------------------------------------
// Firing effects by turret type: amber tracers, cyan beams, white-blue rails, violet arcs, flame cones, rocket/shell blasts.
const FX_OF={cannon:'tracer',mg:'tracer',laser:'beam',rocket:'blast',missile:'blast',mortar:'blast',flame:'flame',siege:'shell',tesla:'arc',lasercannon:'burst',railgun:'rail'};
const FX_LOOK={tracer:[0xffb347,.16,2.4],beam:[0x22e6ff,.12,2.6],rail:[0xd8f6ff,.18,3],arc:[0xb08cff,.1,3],flame:[0xff7a2d,.9,2.2],blast:[0xff5a2a,.3,2.6],shell:[0xffd36b,.34,2.8],burst:[0xff6ae0,.36,3]};
function scene3d(view){const S=view.style,T=view.T;if(!S||view.renderer.isConquestCanvas)return null;const k=kit(S),sc=new T.Scene();sc.background=new T.Color(0x05070d);sc.fog=new T.Fog(0x06070f,300,1100);
 // The same light counts as the world scene (hemi + sun + rim): the style programs are shared, no new program variants.
 const lights=[new T.HemisphereLight(0x3a5a9c,0x16131f,1.5),new T.DirectionalLight(0xe4ecff,2.9),new T.DirectionalLight(0x52c6ff,1.25)];lights[1].position.set(200,400,150);lights[2].position.set(-300,200,-200);sc.add(...lights);
 const cam=new T.PerspectiveCamera(50,1,.5,2000);const g={terrain:new T.Group(),build:new T.Group(),walls:new T.Group(),turrets:new T.Group(),homes:new T.Group(),holo:new T.Group(),grid:new T.Group(),fx:new T.Group(),actors:new T.Group()};for(const v of Object.values(g))sc.add(v);
 const im=(geo,n)=>{const m=new T.InstancedMesh(geo,S.MAT.solid,n);m.count=0;m.frustumCulled=false;m.visible=false;return m;};
 const crewN=S.low?8:16,crew=new T.InstancedMesh(k.person(),S.MAT.solid,crewN),rovers=new T.InstancedMesh(k.rover(),S.MAT.solid,S.low?2:4);crew.frustumCulled=rovers.frustumCulled=false;g.actors.add(crew,rovers);
 const foes={r:im(k.foe('r'),80),s:im(k.foe('s'),48),d:im(k.foe('d'),40),w:im(k.foe('w'),160),b:im(k.foe('b'),16)};for(const m of Object.values(foes))g.actors.add(m);
 const fx={};for(const [n,[col,w,em]] of Object.entries(FX_LOOK)){const b=new S.Bld();if(n==='flame')b.add(S.G.cone6,k.M(0,0,.5,Math.PI/2,0,0,.5,1,.5),new T.Color(col),em);else b.box(0,0,.5,w,w,1,new T.Color(col),em);fx[n]=im(b.geometry(),48);g.actors.add(fx[n]);}
 return {S,T,k,sc,cam,g,crew,rovers,foes,fx,meshes:new Map(),tur:new Map(),wim:new Map(),him:new Map(),wgeo:new Map(),hgeo:new Map(),tgeo:new Map(),keys:{},anim:[]};}
// Dispose a group's own geometries before clearing it (shared style geometries and cached kit geometries are kept).
function wipe(g,keep){for(const o of [...g.children]){o.traverse(q=>{if(q.geometry&&!q.geometry.userData?.hfShared&&!keep?.has(q.geometry))q.geometry.dispose();if(q.isInstancedMesh)q.dispose?.();});}g.clear();}
const TCOL={ground:[.1,.1,.105],lush:[.09,.14,.06],ash:[.07,.066,.07],pass:[.12,.1,.09],ice:[.42,.55,.62],rim:[.075,.07,.07],cliff:[.06,.06,.065],water:[.03,.08,.14],rock:[.08,.075,.07],crevasse:[.02,.04,.06],vent:[.2,.08,.04],deposit:[.24,.12,.06]};
function terrainMesh(R,site,cc){const {S,T,k}=R,b=new S.Bld(),n=P.GRID.n,c=P.GRID.cell,half=n*c/2,step=4,ext=60,H0=P.townH(cc);
 const col=(x,z)=>{const i=Math.round(x/c+(n-1)/2),j=Math.round(z/c+(n-1)/2);if(Math.abs(x)>half+2||Math.abs(z)>half+2)return [.04,.04,.05];const t=P.terrainAt(site,i,j),base=TCOL[t]||TCOL.ground,inside=P.cheb(i,j)<=H0;
  const f=inside?1:.45,tint=site==='delta'&&t==='ground'?[.8,.95,.6]:site==='crater'?[1.05,.95,.85]:site==='plateau'?[1.1,1,.9]:[1,1,1.05];return [base[0]*f*tint[0],base[1]*f*tint[1],base[2]*f*tint[2]];};
 const H=(x,z)=>Math.abs(x)>half+2||Math.abs(z)>half+2?P.heightAt(site,Math.sign(x)*Math.min(Math.abs(x),half),Math.sign(z)*Math.min(Math.abs(z),half))+(site==='canyon'?8:2)+((Math.abs(x)+Math.abs(z))%23)*.05:P.heightAt(site,x,z);
 for(let x=-half-ext;x<half+ext;x+=step)for(let z=-half-ext;z<half+ext;z+=step){const q=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]].map(([a,bb])=>[a,H(a,bb),bb]),cc2=col(x+step/2,z+step/2),tc=new T.Color(cc2[0],cc2[1],cc2[2]);b.quad(q[0],q[3],q[2],q[1],tc,0);}
 const m=b.mesh();R.g.terrain.add(m);
 // rocks, vents and deposits get props; water and ice a surface; the town edge a cyan line; lanes red chevrons
 const pr=new S.Bld(),wc=new T.Color(.05,.16,.26),ic=new T.Color(.55,.72,.82);for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=P.terrainAt(site,i,j),x=P.cellX(i),z=P.cellZ(j),y=P.groundY(site,i,j);
  if(t==='water')pr.box(x,-.35,z,c,.1,c,wc,.35);else if(t==='ice')pr.box(x,y+.06,z,c,.08,c,ic,.12);else if(t==='rock'&&(i+j)%2===0)pr.add(S.G.rock,k.M(x+1,y+.6,z+1,0,i*j,0,2.2,1.6,2.2),k.C.rust.clone().multiplyScalar(.6));else if(t==='vent')pr.add(S.G.cone6,k.M(x,y,z,0,i,0,1.6,1.4,1.6),k.C.furnace,.8);}
 if(site==='crater')for(const d of P.RIM_DEPOSITS){for(let k2=0;k2<6;k2++)pr.add(S.G.rock,k.M(P.cellX(d.i)+2+(k2%3-1)*1.6,.4,P.cellZ(d.j)+2+(k2>2?1.2:-1.2),0,k2,0,1.1,.8,1.1),k.C.rust);pr.box(P.cellX(d.i)+2,.05,P.cellZ(d.j)+2,7,.08,7,k.C.amber,.5);}
 const e=(H0+.5)*c;for(const [x,z,w,d] of [[0,-e,2*e,.25],[0,e,2*e,.25],[-e,0,.25,2*e],[e,0,.25,2*e]])pr.box(x,.5,z,w,.12,d,k.C.cyan,.9);
 for(const cl of P.spawnCells(site,cc))for(const [i,j] of cl)pr.box(P.cellX(i),P.groundY(site,i,j)+.08,P.cellZ(j),c*.8,.06,c*.8,k.C.red,1.1);
 if(pr.n)R.g.terrain.add(pr.mesh());
 const earth=new S.Bld();earth.add(S.G.ico,k.M(-560,300,-1100,0,0,0,100,100,100),new T.Color(.06,.16,.34),.9);earth.add(S.G.ico,k.M(-580,316,-1080,0,0,0,70,70,70),new T.Color(.12,.24,.12),.5);R.g.terrain.add(earth.mesh());}
function gridMesh(R,site,cc){const {S}=R,X2=new S.Fx(),c=P.GRID.cell,h=P.townH(cc),half=(h+.5)*c,ring=S.AT.SOLID||S.AT.BLOB;for(let i=-h;i<=h+1;i++){const v=(i-.5)*c;X2.flat(v,.12,0,.04,half,ring,[.02,.1,.13],0);X2.flat(0,.12,v,half,.04,ring,[.02,.1,.13],0);}
 for(let i=P.MID-h;i<=P.MID+h;i++)for(let j=P.MID-h;j<=P.MID+h;j++)if(P.NOBUILD[P.terrainAt(site,i,j)]&&Math.abs(P.groundY(site,i,j))<3)X2.flat(P.cellX(i),P.groundY(site,i,j)+.14,P.cellZ(j),c*.42,c*.42,ring,[.16,.03,.05],0);R.g.grid.add(X2.mesh());}
function holoMesh(R,cellsList,ok,ring,site){const {S}=R,X2=new S.Fx(),c=P.GRID.cell,reg=S.AT.SOLID||S.AT.BLOB,cols=Array.isArray(ok)?ok:null;
 cellsList.forEach(([i,j],n)=>{const x=P.cellX(i),z=P.cellZ(j),y=(site?P.groundY(site,i,j):0)+.2,good=cols?cols[n]:ok,col=good===2?[1,.75,.2]:good?[.1,.9,.45]:[1,.18,.22];X2.flat(x,y,z,c*.47,c*.47,reg,col.map(v=>v*.35),0);for(const [dx,dz,w,d] of [[0,-c/2,c/2,.06],[0,c/2,c/2,.06],[-c/2,0,.06,c/2],[c/2,0,.06,c/2]])X2.flat(x+dx,y+.04,z+dz,w,d,reg,col,0);});
 if(ring)X2.ringGlow(ring.x,ring.z,.6+(ring.y||0),ring.r,.5,ring.col||(ok?[.1,.75,1]:[1,.3,.3]),64);return X2.mesh();}

// ------------------------------------------------------------------- open / close --------------------------------------
function open(ctx){if(X)return;const {view,panel,el,button}=ctx;const st=()=>view.authority?.state;
 panel.classList.add('cq-in-plot');const d=el('section','cq-dialog cq-plot',null,panel);d.setAttribute('role','dialog');d.setAttribute('aria-label','Command Base town');
 X={ctx,d,mode:'view',sel:null,place:null,draw:null,cam:{x:0,z:6,dist:170,tilt:.95,yaw:0},drill:null,clock:0,lastKey:'',busy:false,tool:'ring',blend:{o:0,l:0},draft:[],clip:null,pan:false};
 const top=el('div','cq-plot-top',null,d),title=el('div','cq-plot-title','',top);top.append(button('LEAVE BASE',()=>close(),'cq-plot-leave'));X.title=title;
 d.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});   // the app-wide touchmove guard must not block the menu's native scroll (iPhone)
 X.stage=el('div','cq-plot-stage',null,d);X.coach=el('p','cq-plot-coach','',d);X.coach.setAttribute('role','status');
 X.sheet=el('div','cq-plot-sheet',null,d);X.msg=el('p','cq-plot-msg','',d);X.msg.setAttribute('aria-live','polite');
 const s=st();if(!s?.base?.tier){sitePicker();return;}
 X.R=scene3d(view);if(!X.R){X.cv=el('canvas','cq-plot-canvas',null,X.stage);}
 const h=P.townH(s.plot?.cc||1);X.cam.dist=Math.min(300,110+h*2.6);
 input();render();}
function close(){if(!X)return;X.ctx.panel.classList.remove('cq-in-plot');const R=X.R;if(R){R.sc.traverse(o=>{if(o.isMesh||o.isInstancedMesh){if(!o.geometry?.userData?.hfShared)o.geometry?.dispose?.();if(o.isInstancedMesh)o.dispose?.();}});for(const m of [R.wgeo,R.hgeo,R.tgeo])for(const gq of m.values())gq.dispose?.();}X.d.remove();X=null;}
function isOpen(){return !!X;}
const say=t=>{if(X){X.msg.textContent=t;X.msgAt=Date.now();}};
async function act(action,plot,label){if(!X||X.busy)return false;X.busy=true;say(label||'SENDING ORDER…');try{const ok=await X.ctx.view.requestAction(action,plot===undefined?{}:{plot});say(ok?(label?label.replace('…',' ✓'):'DONE'):(X?.ctx.view.authority?.error||'Online verification required.').replace(/^conquest: /,'').toUpperCase());if(ok&&X){X.place=null;X.sel=action==='plot-remove'?null:X.sel;}render();return ok;}finally{if(X)X.busy=false;}}

// first build: pick one of seven sites, then claim the plot (the existing first-base recipe)
function sitePicker(){const {el,button,view}=X.ctx,s=view.authority?.state,D=root.ConquestCombat.baseDefinition,L=s?.ledger;X.title.textContent='CLAIM YOUR TOWN';X.stage.className='cq-plot-stage cq-plot-sites';
 el('p','cq-plot-intro','Your own private town. It grows with your Command Center (45×45 cells now, 77×77 at CC10). Pick its site: it shapes your economy and your whole defense. You can change it once for free.',X.stage);let pick='ridge';const cards=[];
 for(const id of P.SITE_IDS){const S=P.SITES[id],c=button('',()=>{pick=id;cards.forEach(x=>x.classList.toggle('on',x.dataset.site===id));},'cq-site-card');c.dataset.site=id;el('b','',S.name+' · '+S.lanes.length+' LANES',c);el('small','',S.bonus,c);if(id===pick)c.classList.add('on');cards.push(c);X.stage.append(c);}
 const need=s?.dev?.on?'DEV MODE · UNLIMITED · the claim costs nothing':Object.entries(D.recipe).map(([k,n])=>Math.min(n,k==='cp'?L?.cp||0:L?.banked?.[k]||0)+'/'+n+' '+LABEL[k]).join(' · ');el('p','cq-plot-need',need+' · you start with '+P.COMPOSITE.start+' wall composite',X.sheet);
 if(ownerUI()){const on=!!s?.dev?.on,box=el('div','cq-plot-dev',null,X.sheet);el('b','',on?'DEV MODE · UNLIMITED RESOURCES':'DEV MODE · OFF',box);el('small','','Owner only. Turning it on makes this a test record: no Conquest airdrop points, no rankings.',box);box.append(button(on?'TURN OFF':'TURN ON UNLIMITED',async()=>{if(X.busy)return;X.busy=true;let ok=false;try{ok=await view.requestAction(on?'dev-off':'dev-on');}finally{if(X)X.busy=false;}if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx=X.ctx;close();open(ctx);},'cq-plot-primary'));}
 const claim=button('CLAIM PLOT · '+price(D.recipe),async()=>{if(X.busy)return;X.busy=true;try{const ok=await view.requestAction('build-base',{plot:{site:pick}});if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx=X.ctx;close();open(ctx);say('TOWN CLAIMED · '+P.SITES[pick].name);}finally{if(X)X.busy=false;}},'cq-plot-primary');X.sheet.append(claim);}

// ------------------------------------------------------------------- UI --------------------------------------------------
function render(){if(X?.visit){visitUi();return;}if(!X||!X.ctx.view.authority?.state?.plot)return;const {el,button,view}=X.ctx,s=view.authority.state,p=s.plot,L=s.ledger,now=Date.now(),sh=X.sheet;
 // keep what the pilot had open (closed sections, scroll) across a re-render; a designer in progress is only rebuilt by a state change
 const openNow=new Set([...sh.querySelectorAll('details[open]>summary')].map(x=>x.textContent)),scroll=sh.scrollTop;if(sh.childNodes.length)X.openFolds=openNow;
 X.title.textContent='MY BASE · TOWN CC'+p.cc+' · '+P.SITES[p.site].name+' · ⚡'+P.powerUse(p)+'/'+P.powerSupply(p)+' · POWER '+fmt(p.power||P.power(p));
 const g=guideStep(p,s),ct=g?g.text:'';if(X.coach.textContent!==ct)X.coach.textContent=ct;X.coach.hidden=!g;
 sh.replaceChildren();const tabs=el('div','cq-plot-tabs',null,sh);for(const [m,lab] of [['view','BASE'],['build','BUILD'],['walls','WALLS'],['drill','DRILL']]){const b=button(lab,()=>{X.mode=m;X.place=null;X.draw=null;X.sel=null;render();},(X.mode===m?'on':'')+(g?.tab===m&&X.mode!==m?' cq-plot-glow':''));b.setAttribute('aria-pressed',String(X.mode===m));tabs.append(b);}
 const body=el('div','cq-plot-body',null,sh);devBar(body,s,p);
 const job=p.job;if(job){const B=job.t==='cc'?{n:'Command Center'}:P.BUILDINGS[job.t],left=job.ready-now,box=el('div','cq-plot-job',null,body);el('b','','BUILDER · '+B.n.toUpperCase()+' '+romanOf(job.l)+' · '+dur(left),box);const pr=el('progress','',null,box);pr.max=1;pr.value=Math.max(0,Math.min(1,1-left/Math.max(1,job.ready-job.at)));
  el('small','','SECOND BUILDER and SPEED-UPS: store items, unavailable until payments are certified.',box);}
 if(X.mode==='view')viewTab(body,s,p,L,now);else if(X.mode==='build')buildTab(body,s,p,L);else if(X.mode==='walls')wallTab(body,s,p);else drillTab(body,s,p);
 for(const d of sh.querySelectorAll('details'))if(X.openFolds?.has(d.querySelector('summary')?.textContent))d.open=true;sh.scrollTop=X.place&&!X.wasPlace?0:scroll;X.wasPlace=!!X.place;   // a new blueprint: CONFIRM BUILD at the top, on screen
 layout();sync();}
// Once a second: only the live numbers change (builder countdown, production), never the open sections or a designer in progress.
function tickUi(){if(!X||X.visit)return;const s=X.ctx.view.authority?.state,p=s?.plot;if(!p)return;const now=Date.now(),j=p.job,box=X.sheet.querySelector('.cq-plot-job');
 if(j&&box){const b=box.querySelector('b'),pr=box.querySelector('progress'),B=j.t==='cc'?{n:'Command Center'}:P.BUILDINGS[j.t];if(b)b.textContent='BUILDER · '+B.n.toUpperCase()+' '+romanOf(j.l)+' · '+dur(j.ready-now);if(pr)pr.value=Math.max(0,Math.min(1,1-(j.ready-now)/Math.max(1,j.ready-j.at)));}
 const pe=X.sheet.querySelector('.cq-plot-prod span');if(pe)pe.textContent=prodText(p,now)||pe.textContent;
 const dr=[...X.sheet.querySelectorAll('.cq-plot-primary')].find(b=>/CREWS RESET/.test(b.textContent));if(dr){const w=Math.max(0,(p.drillAt||0)+60000-now);if(w>0)dr.textContent='CREWS RESET · '+dur(w);else render();}}
function prodText(p,now){const q={...p,st:{...(p.st||{})}},st=P.accrue(q,now),c=P.caps(p),r=P.rates(p);   // live preview of the Worker's accrual on a copy
 const parts=['alloy','biomass','helium','fe'].filter(k=>r[k]>0||st[k]>0).map(k=>Math.floor(st[k]||0)+'/'+c[k]+' '+LABEL[k]+' (+'+(Math.round(r[k]*100)/100)+'/h)');
 if(c.fh)parts.push('COMPOSITE '+Math.floor(q.cm||0)+'/'+c.cm+(q.fh>=.25?' (+'+r.cm+'/h from '+Math.floor(q.fh*10)/10+' alloy loaded)':' (load alloy in the Foundry)'));return parts.join(' · ');}
// Owner dev mode (owner only, server-verified; conquest.js DEV_ACTIONS): unlimited resources, composite, ores, extensions, instant builds.
function devBar(body,s,p){if(!ownerUI())return;const {el,button}=X.ctx,on=!!s.dev?.on,box=el('div','cq-plot-dev'+(on?' on':''),null,body);
 el('b','',on?'DEV · UNLIMITED · INSTANT BUILDS':'DEV MODE · OFF',box);box.append(button(on?'TURN OFF':'TURN ON',()=>act(on?'dev-off':'dev-on',undefined,on?'DEV MODE OFF…':'UNLIMITED ON…')));
 if(!on)el('small','','Owner only: unlimited resources, composite, ores and wall extensions, instant builds. Makes this a test record (no Conquest airdrop points, never ranked).',box);
 else if(p.job)box.append(button('FINISH NOW',()=>act('dev-finish',undefined,'FINISHING…')));}
function resLine(el,parent,s,p){if(s.dev?.on){el('p','cq-plot-res cq-plot-dev-res','BANKED · ∞ UNLIMITED (DEV MODE) · COMPOSITE ∞ · ORES ∞',parent);return {stores:'∞'};}const L=s.ledger,o=storesOf(s,p),stores=P.MNS.filter(k=>o[k]>0).map(k=>o[k]+' '+LABEL[k]).join(' · ');
 el('p','cq-plot-res','BANKED · '+fmt(L.cp)+' CP · '+fmt(L.banked.alloy)+' ALLOY · '+fmt(L.banked.biomass)+' BIOMASS · '+fmt(L.banked.helium)+' HELIUM-3',parent);el('p','cq-plot-res','WALL COMPOSITE · '+fmt(Math.floor(p.cm||0))+' · BASE STORES · '+(stores||'empty (ore blends use minerals from here)'),parent);return {stores};}
function viewTab(body,s,p,L,now){const {el,button}=X.ctx;resLine(el,body,s,p);
 const prod=el('div','cq-plot-prod',null,body);el('b','','PRODUCTION · stops when the store is full',prod);el('span','',prodText(p,now)||'Build a Refinery, Biodome or Helium Extractor to produce.',prod);
 const st=P.accrue({...p,st:{...(p.st||{})}},now);if(['alloy','biomass','helium','fe'].some(k=>(st[k]||0)>=1))prod.append(button('COLLECT PRODUCTION',()=>act('plot-collect',{},'COLLECTING…'),'cq-plot-primary'));
 const sel=X.sel&&p.b[X.sel];if(sel){selCard(body,s,p,X.sel,sel);}else el('p','cq-plot-hint','Tap a building to upgrade, move or inspect it. One finger pans, two fingers pinch to zoom.',body);
 foundryFold(body,s,p);
 const term=el('details','cq-map-fold',null,body);el('summary','','BASE TERMINAL · YIELD, BANKING, DEFENSE',term);X.ctx.terminal?.(term);
 const look=el('details','cq-map-fold',null,body);el('summary','','BANNER & THEME',look);look.ontoggle=()=>{if(look.open&&!look.dataset.built){look.dataset.built='1';designer(look,p);}};
 const vis=el('details','cq-map-fold',null,body);el('summary','','VISIT BASES · TOP 20, SQUAD, BASE OF THE WEEK',vis);vis.ontoggle=()=>{if(vis.open&&!vis.dataset.built){vis.dataset.built='1';visitList(vis);}};
 body.append(button('SHARE MY BASE',()=>shareCard(s,p)));
 const shop=el('details','cq-map-fold',null,body);el('summary','','BASE STORE · CAPACITY, COSMETICS AND TIME',shop);storeList(shop);}
// Foundry (composite), its research and the wall extensions: one closed section, opened when needed.
function foundryFold(body,s,p){const {el,button}=X.ctx,c=P.caps(p),ex=P.extParts(p,devOn()),fd=el('details','cq-map-fold cq-plot-foundry',null,body);el('summary','','FOUNDRY · COMPOSITE '+fmt(Math.floor(p.cm||0))+' · WALL EXTENSIONS +'+ex.total+'%',fd);
 if(!c.fh){el('small','','Build a Foundry (unlocks at CC2): load alloy and it turns it, with plot regolith, into wall composite ('+P.COMPOSITE.perAlloy+' per alloy, '+P.COMPOSITE.rate+'/h per level).',fd);}
 else{const room=Math.max(0,Math.floor(c.fh-(p.fh||0)));el('small','','HOPPER · '+(Math.floor((p.fh||0)*10)/10)+'/'+c.fh+' alloy loaded → '+P.COMPOSITE.perAlloy+' composite each · STOCK '+Math.floor(p.cm||0)+'/'+c.cm,fd);
  const row=el('div','cq-plot-row',null,fd);for(const n of [10,30])row.append(button('LOAD '+n+' ALLOY',()=>act('plot-feed',{n},'LOADING THE FOUNDRY…')));row.append(button('LOAD ALL',()=>act('plot-feed',{n:Math.max(1,Math.min(room,Math.floor(s.ledger.banked.alloy||0)))},'LOADING THE FOUNDRY…')));for(const b of row.children)b.disabled=room<1;
  const k=p.ext?.r|0,step=P.EXT.research[k];if(step){const lock=P.levelOf(p,'foundry')<step.fl,b=button((lock?'LOCKED · FOUNDRY '+romanOf(step.fl)+' · ':'')+'RESEARCH REINFORCED LATTICE '+romanOf(k+1)+' · +'+step.pct+'% WALL CAPACITY · '+price(step.cost),()=>act('plot-research',{},'RESEARCHING…'),'cq-plot-primary');b.disabled=lock;fd.append(b);
   const short=!lock&&storesShort(s,p,step.cost);if(short)fd.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));}else el('small','','All Foundry research done.',fd);}
 el('small','','WALL EXTENSIONS (up to +'+P.EXT.max+'% of your level\'s base cap): research +'+ex.research+'% · drill milestones +'+ex.drill+'% · base defenses +'+ex.defense+'%'+(ex.bought?' · bought +'+ex.bought+'%':'')+(ex.dev?' · DEV +'+ex.dev+'%':'')+'. Hold a Defense Drill at CC'+P.EXT.drill.map(m=>m.cc).join('/')+' (+'+P.EXT.drill[0].pct+'% each); win 3 and 10 real base defenses (+5% each). Extension packs in the BASE STORE add capacity only.',fd);}
function selCard(body,s,p,id,b){const {el,button}=X.ctx,isCC=b.t==='cc',B=isCC?{n:'Command Center',desc:'Gates every unlock, the town size and the points multiplier (tier '+romanOf(P.tierOf(p.cc))+', ×'+(root.CQ_BASE_MULT||[1,1.05,1.1,1.15,1.2,1.25])[P.tierOf(p.cc)]+'). The primary vital: if it falls, the raid wins.'}:P.BUILDINGS[b.t],l=isCC?p.cc:b.l,box=el('div','cq-plot-sel',null,body);
 el('b','',(ICON[b.t]||'')+' '+B.n.toUpperCase()+' '+romanOf(l)+(P.VITALS[b.t]?' · ◆ VITAL':''),box);el('small','',B.desc+(B.turret?' Range '+Math.round(B.turret.range*P.SITES[p.site].range*(1+.04*(l-1)))+' m.':'')+(B.prod?' Produces '+Object.entries(B.prod).map(([k,v])=>Math.round(v*Math.max(1,l)*100)/100+' '+LABEL[k]+'/h').join(', ')+'.':''),box);
 const nl=l+1,err=P.buildCheck(p,isCC?'cc':b.t,nl,isCC?null:id),cost=nl<=(isCC?P.CC.max:B.max)?P.costOf(isCC?'cc':b.t,nl):null;
 if(cost){const up=button((err?'LOCKED · '+err.toUpperCase():'UPGRADE TO '+romanOf(nl)+' · '+(devOn()?'FREE · INSTANT':price(cost)+' · '+dur(P.timeOf(isCC?'cc':b.t,nl)))),()=>act('plot-upgrade',{id},'UPGRADING…'),'cq-plot-primary');up.disabled=!!err||!!p.job;box.append(up);if(isCC&&!err)el('small','','CC'+nl+': the town grows to '+P.townSide(nl)+'×'+P.townSide(nl)+' cells, '+P.wallBase(nl)+' walls, '+P.TURRET_CAP[nl-1]+' turrets.',box);const short=!err&&storesShort(s,p,cost);if(short)box.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));}else el('small','','MAXIMUM LEVEL',box);
 box.append(button('MOVE / ROTATE',()=>{X.mode='build';X.place={type:b.t,id,i:b.i,j:b.j,r:b.r|0};render();}));
 if(!['cc','storage'].includes(b.t)){const rm=button('REMOVE (no refund)',()=>{if(rm.dataset.sure){act('plot-remove',{id},'REMOVING…');}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE';}},'cq-plot-danger');box.append(rm);}}
const BUILD_GROUPS=[['ECONOMY · makes and stores resources',k=>['refinery','biodome','helium','reactor','storage','foundry','uplink'].includes(k)],['DEFENSE · turrets, shields and gates',(k,B)=>!!B.turret||['shield','gate'].includes(k)],['SUPPORT · repairs, scanning, research',()=>true]];
const ROLE={vault:'STORES',hangar:'REPAIRS HULL',radar:'LONGER SCAN',defense:'LESS DAMAGE',uplink:'+YIELD CP'};
function roleOf(k,B){if(B.turret){const t=B.turret;return B.role+' · '+t.range+' m';}if(B.power)return '+'+B.power+' ⚡ POWER';if(B.prod)return Object.entries(B.prod).map(([r,v])=>'+'+v+' '+(LABEL[r]||r).toUpperCase()+'/H').join(' ');if(k==='foundry')return 'COMPOSITE';if(k==='lab')return 'RESEARCH';if(k==='trophy')return 'TROPHIES';if(B.gate)return 'OPENS';return ROLE[B.mod]||'';}
function buildTab(body,s,p,L){const {el,button}=X.ctx;if(X.place){const q=X.place,B=q.type==='cc'?{n:'Command Center'}:P.BUILDINGS[q.type],err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):(P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r));
  // the primary action first, so it stays on screen even with the bigger map (owner rule: every screen fits or scrolls)
  const row=el('div','cq-plot-row',null,body);row.append(button('↻ ROTATE',()=>{q.r=(q.r+1)%4;render();}),button('CANCEL',()=>{X.place=null;render();}));const ok=button(q.id?'CONFIRM MOVE':'CONFIRM BUILD',()=>q.id?act('plot-move',{id:q.id,i:q.i,j:q.j,r:q.r},'MOVING…'):act('plot-build',{type:q.type,i:q.i,j:q.j,r:q.r},'CONSTRUCTION ORDERED…'),'cq-plot-primary');ok.disabled=!!err||(!q.id&&!!p.job);row.append(ok);
  el('b','',(q.id?'MOVE · ':'PLACE · ')+B.n.toUpperCase()+(P.VITALS[q.type]?' · ◆ VITAL':''),body);el('small','',err?'✕ '+err.toUpperCase():'✓ VALID · tap the ground to move the blueprint'+(q.id?'':' · '+(devOn()?'FREE · INSTANT':price(P.costOf(q.type,1))+' · '+dur(P.timeOf(q.type,1)))),body);
  if(P.VITALS[q.type])el('small','','Vitals are what raiders hunt. Spread them out for coverage, or cluster them behind your strongest walls.',body);return;}
 const g=guideStep(p,s),avail=([k,B])=>p.cc>=B.cc&&(B.turret?P.turretCount(p)<P.TURRET_CAP[p.cc-1]:P.countOf(p,k)<P.countCap(k,p.cc)),list=Object.entries(P.BUILDINGS).filter(avail);
 // One full-width card per building, grouped by what it is for: role tag, description, footprint and power, cost and time.
 const dev=devOn();el('p','cq-plot-res','TURRETS '+P.turretCount(p)+'/'+P.TURRET_CAP[p.cc-1]+' · ⚡ '+P.powerUse(p)+'/'+P.powerSupply(p)+' POWER',body);if(!list.length)el('p','cq-plot-hint','Everything available at CC'+p.cc+' is placed.',body);const used=new Set();
 for(const [title,f] of BUILD_GROUPS){const items=list.filter(([k])=>!used.has(k)&&f(k,P.BUILDINGS[k]));if(!items.length)continue;items.forEach(([k])=>used.add(k));el('b','cq-plot-group',title,body);const box=el('div','cq-plot-list',null,body);
  for(const [k,B] of items){const err=P.buildCheck(p,k,1),c=button('',()=>{const at=P.autoPlace(p,k)||{i:37,j:37,r:0};X.place={type:k,...at};X.cam.x=P.cellX(at.i);X.cam.z=P.cellZ(at.j);render();},'cq-plot-card'+(g?.id===k||g?.id==='cannon'&&k==='cannon'?' cq-plot-glow':''));
   const head=el('span','cq-plot-card-head',null,c);el('span','cq-plot-ico',ICON[k]||'',head);el('b','',B.n,head);el('span','cq-plot-tag',(B.vital?'◆ VITAL · ':'')+roleOf(k,B),head);
   el('small','cq-plot-desc',B.desc||'',c);el('small','cq-plot-cost',(err?'✕ '+err.toUpperCase():dev?'FREE · INSTANT':price(B.cost[0])+' · '+dur(P.timeOf(k,1)))+' · SIZE '+B.w+'×'+B.d+(B.pw?' · USES ⚡'+B.pw:''),c);c.disabled=!!err;box.append(c);}}
 const locked=Object.entries(P.BUILDINGS).filter(([,B])=>B.cc>p.cc);if(locked.length){const lf=el('details','cq-map-fold',null,body);el('summary','','LOCKED · '+locked.length+' MORE UNLOCK WITH THE COMMAND CENTER',lf);for(const [k,B] of locked)el('small','',(ICON[k]||'')+' '+B.n+' · CC'+B.cc+(B.turret?' · '+B.role:''),lf);}
 el('p','cq-plot-next',unlockLine(p),body);}
// ---- walls: tools, blend picker, draft (undo) and confirm ----
const TOOLS=[['line','LINE','drag: a solid straight wall'],['rect','RECT','drag corner to corner: a rectangle'],['ring','RING','drag from the centre outward: a ring'],['copy','COPY','drag a box over walls to copy them'],['paste','PASTE','tap to paste the copied walls'],['erase','ERASE','drag over walls to remove them']];
function draftPlan(p){return X.draft.length?P.wallPlan(p,X.draft.map(d=>d.sec),{dev:devOn()}):null;}
function wallTab(body,s,p){const {el,button}=X.ctx,dev=devOn(),cap=P.wallCapOf(p,dev),base=P.wallBase(p.cc),n=Object.keys(p.w).length,plan=draftPlan(p);
 el('b','cq-plot-wallcount','WALLS '+n+(plan?.fresh?' + '+plan.fresh:'')+' / '+base+(cap>base?' (+EXT '+(cap-base)+')':'')+' · COMPOSITE '+(dev?'∞':fmt(Math.floor(p.cm||0))),body);
 const tr=el('div','cq-plot-row cq-plot-tools',null,body);for(const [id,lab,tip] of TOOLS){const b=button(lab,()=>{X.tool=id;X.draw=null;render();},X.tool===id?'on':'');b.title=tip;b.setAttribute('aria-pressed',String(X.tool===id));if(id==='paste')b.disabled=!X.clip;tr.append(b);}
 el('small','cq-plot-tooltip',(TOOLS.find(t=>t[0]===X.tool)||TOOLS[0])[2].toUpperCase()+' · two fingers (or ✥) pan the map',body);
 if(X.tool!=='erase'&&X.tool!=='copy'){// the blend picker: ore chips, level, live stats
  const st=storesOf(s,p),bp=el('div','cq-plot-blend',null,body),ores=el('div','cq-plot-ores',null,bp);
  for(let o=0;o<=6;o++){const m=P.ORES[o-1],lock=p.cc<P.ORE_CC[o],look=ORE_LOOK[o],b=button('',()=>{X.blend={o,l:o?(X.blend.l||1):0};render();},'cq-plot-ore'+(X.blend.o===o?' on':''));b.style.setProperty('--ore',hex(look[0]));b.style.setProperty('--acc',hex(look[1]));
   el('i','',null,b);el('span','',['COMP','FERR','ILME','ARMA','TRAN','SELE','MOON'][o],b);el('small','',lock?'CC'+P.ORE_CC[o]:o?(dev?'∞':st[m]+''):(dev?'∞':Math.floor(p.cm||0)+''),b);b.disabled=lock;b.setAttribute('aria-label',(o?P.ORE_NAME[m]:'Composite only')+(lock?' (unlocks at CC'+P.ORE_CC[o]+')':''));ores.append(b);}
  if(X.blend.o){const lv=el('div','cq-plot-row cq-plot-levels',null,bp);for(let l=1;l<=3;l++){const b=button(P.BLEND_NAME[l],()=>{X.blend.l=l;render();},X.blend.l===l?'on':'');b.setAttribute('aria-pressed',String(X.blend.l===l));lv.append(b);}}
  const code=P.wcode(X.blend.o,X.blend.l),w=P.wallStats(code,p.site),bars=el('div','cq-plot-stats',null,bp),best=P.wallStats(19,p.site);
  for(const [lab,v,mx,txt] of [['STRENGTH',w.hp,best.hp,fmt(w.hp)+' HP'],['DURABILITY',w.dr,.4,Math.round(w.dr*100)+'% less damage'],['REFLECT',w.refl,.35,Math.round(w.refl*100)+'% bounced back']]){const r=el('div','cq-plot-stat',null,bars);el('span','',lab,r);const m=el('meter','',null,r);m.min=0;m.max=mx;m.value=v;el('small','',txt,r);}
  const per=X.blend.o?P.ORE_UNITS[X.blend.o]*P.BLEND_UNITS[X.blend.l]/40:0;el('small','',P.blendName(code).toUpperCase()+' · a cell: 1 composite'+(per?' + '+(per>=1?per:'1 per '+Math.round(1/per)+' cells of')+' '+P.ORE_NAME[P.ORES[X.blend.o-1]]:'')+(X.blend.o>=3?' · rare ores are earn-only':''),bp);}
 if(X.tool==='erase'&&X.erase){const m=X.erase;el('b','',m.keys.length+' WALL CELLS SELECTED · their composite comes back (ore does not)',body);const r=el('div','cq-plot-row',null,body);r.append(button('CANCEL',()=>{X.erase=null;render();}));const rm=button('REMOVE '+m.keys.length+' WALLS',()=>{if(rm.dataset.sure){act('plot-remove',{w:[m.sec]},'REMOVING WALLS…').then(ok=>{if(ok&&X)X.erase=null;});}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE '+m.keys.length;}},'cq-plot-danger');r.append(rm);}
 if(X.tool==='copy'||X.tool==='paste')el('small','',X.clip?'COPIED '+X.clip.cells.length+' wall cells. PASTE, then tap where the top-left corner goes.':'COPY: drag a box over walls you built.',body);
 if(plan){const sk=plan.skip,skipped=sk.outside+sk.blocked+sk.occupied+sk.same,box=el('div','cq-plot-draft',null,body);
  el('b','',X.draft.length+' SECTION'+(X.draft.length>1?'S':'')+' · '+plan.cells.length+' CELLS'+(skipped?' ('+skipped+' skipped: '+[sk.same&&sk.same+' same',sk.occupied&&sk.occupied+' buildings',sk.blocked&&sk.blocked+' blocked',sk.outside&&sk.outside+' outside'].filter(Boolean).join(', ')+')':''),box);
  el('small','',plan.err?'✕ '+plan.err.toUpperCase():'COST · '+(dev?'FREE (DEV MODE)':price(plan.cost)||'nothing'),box);
  const r=el('div','cq-plot-row',null,box);r.append(button('↶ UNDO',()=>{X.draft.pop();render();}),button('CLEAR',()=>{X.draft=[];render();}));const ok=button('CONFIRM WALLS',async()=>{if(await act('plot-wall',{s:X.draft.map(d=>d.sec)},'BUILDING WALLS…')&&X){X.draft=[];render();}},'cq-plot-primary');ok.disabled=!!plan.err;r.append(ok);
  const short=!plan.err&&storesShort(s,p,plan.cost);if(short)box.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));
  if(!dev&&(plan.cost.cm||0)>Math.floor(p.cm||0))el('small','','Not enough composite: load alloy in the FOUNDRY (BASE tab).',box);}
 else if(X.tool!=='erase'&&X.tool!=='copy')el('p','cq-plot-hint','Draw on the map: sections collect here, UNDO takes the last one back, CONFIRM builds them all at once.',body);}
function storesShort(s,p,cost){if(s?.dev?.on)return null;const o2=storesOf(s,p),o={};for(const k of P.MNS)if(cost[k]&&o2[k]<cost[k])o[k]=cost[k]-o2[k];return Object.keys(o).length?o:null;}
async function moveStores(mn){if(typeof baseStore!=='function'){say('UPDATE THE GAME TO MOVE MINERALS');return;}say('MOVING MINERALS FROM YOUR WALLET…');const ok=await baseStore(mn);say(ok?'MINERALS IN BASE STORES':'NOT MOVED');render();}
function drillTab(body,s,p){const {el,button}=X.ctx;el('p','cq-plot-hint','A simulated Parasite raid on your whole town at threat '+p.cc+' ('+P.SITES[p.site].lanes.length+' lanes). Raiders path to your Command Center through the weakest wall and hit everything on the way; the raid wins if the Command Center falls. Drills never pay rewards.',body);
 const wait=Math.max(0,(p.drillAt||0)+60000-Date.now()),b=button(X.drill?'DRILL RUNNING…':wait?'CREWS RESET · '+dur(wait):'START DEFENSE DRILL',async()=>{if(await act('plot-drill',{},'DRILL CREWS DEPLOYING…')){say('SIMULATING THE RAID…');setTimeout(startReplay,40);}},'cq-plot-primary');b.disabled=!!X.drill||wait>0;body.append(b);
 if(X.drillResult){const r=X.drillResult,name=t=>t==='cc'?'Command Center':P.BUILDINGS[t]?.n||t,box=el('div','cq-plot-report',null,body);
  el('b','cq-plot-result '+r.outcome,(r.outcome==='breached'?'COMMAND CENTER FELL · RAID WON':r.outcome==='repelled'?'REPELLED':'HELD')+' · '+r.kills+'/'+r.spawned+' PARASITES DOWN · COMMAND CENTER '+r.core+'%',box);
  el('small','','BREACHES · '+(r.breaches.length?r.breaches.length+' ('+r.wallsLost+' wall cells lost; red rings on the map)':'none')+' · HOMES LOST '+r.homesLost+(r.power<100?' · POWER '+r.power+'%':''),box);
  if(r.vitals.length)el('small','cq-plot-vital-lost','◆ VITALS LOST · '+r.vitals.map(t=>name(t)+': '+(P.VITAL_EFFECT[t]||'')).join(' · '),box);
  if(r.fell.length)el('small','','FELL · '+r.fell.map(f=>name(f.t)).join(', '),box);
  const e=p.log?.[0];if(e?.ext)el('small','cq-plot-next','MILESTONE · +'+e.ext+'% WALL CAPACITY EARNED',box);
  if(r.outcome==='breached')el('small','','TIP · raiders gather at the red lane marks outside your town edge. Wall across them, blend the walls they hit first, keep turrets covering the breach points and vitals behind walls.',box);}
 const log=el('details','cq-map-fold',null,body);el('summary','','BASE LOG · '+(p.log||[]).length+' DRILLS',log);for(const e of p.log||[])el('p','',new Date(e.at).toLocaleString()+' · '+e.outcome.toUpperCase()+' · '+e.kills+'/'+e.spawned+' · '+(e.breaches|0)+' breaches · '+e.lost+' lost · CC '+e.core+'%',log);}

// ------------------------------------------------------------------- scene sync / frame -------------------------------
const fromSnap=v=>({site:v.site,cc:v.cc|0,power:v.pw|0,b:Object.fromEntries(Object.entries(v.b||{}).map(([id,a])=>[id,{t:a[0],i:a[1],j:a[2],r:a[3],l:a[4]}])),w:v.w||{},banner:v.bn||null,theme:v.th||null,log:[],st:{}});
const plotOf=()=>X?.visit?X.visit.plot:X?.ctx.view.authority?.state?.plot;
const cached=(m,key,make)=>{let g=m.get(key);if(!g){g=make();m.set(key,g);}return g;};
const keepSet=R=>new Set([...R.wgeo.values(),...R.hgeo.values(),...R.tgeo.values()]);
const footY=(site,b)=>{const s=P.sizeOf(b.t,b.r|0);return P.heightAt(site,P.cellX(b.i)+(s.w-1)*P.GRID.cell/2,P.cellZ(b.j)+(s.d-1)*P.GRID.cell/2);};
const _m=[];
function inst(R,geo,n){const m=new R.T.InstancedMesh(geo,R.S.MAT.solid,Math.max(1,n));m.count=n;m.frustumCulled=false;return m;}
function sync(){const R=X?.R,p=plotOf();if(!p)return;if(!R){draw2d();return;}const {S,T,k,g}=R,low=!!S.low||!!R.far,M4=R._sm||(R._sm=new T.Matrix4()),keep=keepSet(R);
 if(R.keys.ter!==p.site+':'+p.cc){R.keys.ter=p.site+':'+p.cc;wipe(g.terrain);wipe(g.grid);terrainMesh(R,p.site,p.cc);gridMesh(R,p.site,p.cc);}
 g.grid.visible=X.mode==='build'||X.mode==='walls';
 const want=new Set(),turs=[],theme=p.theme;R.anim=[];
 for(const [id,b] of Object.entries(p.b)){const building=p.job?.id===id||p.job?.t==='cc'&&b.t==='cc',lvl=b.t==='cc'?p.cc:b.l,B=P.BUILDINGS[b.t];
  if(B?.turret&&lvl>0&&!building){turs.push([id,b]);continue;}
  const key=[b.t,lvl,b.i,b.j,b.r|0,building?1:0,theme?.finish||'',theme?.light||''].join(':');want.add(id);let e=R.meshes.get(id);
  if(!e||e.key!==key){if(e){g.build.remove(e.o);e.o.traverse(o=>{if(!keep.has(o.geometry))o.geometry?.dispose?.();});}const o=new T.Group(),s2=P.sizeOf(b.t,b.r|0);o.position.set(P.cellX(b.i)+(s2.w-1)*P.GRID.cell/2,footY(p.site,b),P.cellZ(b.j)+(s2.d-1)*P.GRID.cell/2);o.rotation.y=-(b.r|0)*Math.PI/2;
   if(lvl>0||building){const m=k.building(b.t,Math.max(1,lvl),theme).mesh();m.userData.id=id;o.add(m);}
   const hd=B?.turret||b.t==='radar'?k.head(b.t,Math.max(1,lvl)).mesh():null;if(hd){hd.position.y=b.t==='radar'?3.3+lvl*.5:1.4+lvl*.15;o.add(hd);o.userData.head=hd;o.userData.radar=b.t==='radar';}
   if(building){const sc=new S.Bld(),s3=P.sizeOf(b.t),W=s3.w*P.GRID.cell,D=s3.d*P.GRID.cell,h=b.t==='cc'?10+p.cc:6;for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])sc.box(x*W/2,h/2,z*D/2,.18,h,.18,k.C.amber,.6);for(let y=1.5;y<h;y+=2.2){sc.box(0,y,-D/2,W,.12,.12,k.C.amber,.5);sc.box(0,y,D/2,W,.12,.12,k.C.amber,.5);sc.box(-W/2,y,0,.12,.12,D,k.C.amber,.5);sc.box(W/2,y,0,.12,.12,D,k.C.amber,.5);}
    o.add(sc.mesh());const dr=new S.Bld();for(let q=0;q<3;q++)dr.box(Math.cos(q*2.1)*W*.6,h+1.5,Math.sin(q*2.1)*D*.6,.8,.25,.8,k.C.cyan,2);const drm=dr.mesh();o.add(drm);o.userData.drones=drm;}
   g.build.add(o);e={o,key,id};R.meshes.set(id,e);}
  if(e.o.userData.drones)R.anim.push(e.o);}
 for(const [id,e] of R.meshes)if(!want.has(id)){g.build.remove(e.o);e.o.traverse(o=>{if(!keep.has(o.geometry))o.geometry?.dispose?.();});R.meshes.delete(id);}
 // complete turrets: one base and one head draw per turret type and level (a CC10 town has up to 42 turrets)
 const tk=JSON.stringify([turs.map(([id,b])=>[id,b.t,b.l,b.i,b.j]),theme?.finish,theme?.light]);if(R.keys.tur!==tk){R.keys.tur=tk;wipe(g.turrets,keep);R.tur.clear();const groups=new Map();
  for(const [id,b] of turs){const kk=b.t+':'+b.l;if(!groups.has(kk))groups.set(kk,[]);groups.get(kk).push([id,b]);}
  for(const [kk,list] of groups){const [t,l]=kk.split(':'),tk2=kk+':'+(theme?.finish||'')+(theme?.light||''),bg=cached(R.tgeo,tk2+':b',()=>k.building(t,+l,theme).geometry()),hg=cached(R.tgeo,tk2+':h',()=>k.head(t,+l).geometry()),base=inst(R,bg,list.length),hd=inst(R,hg,list.length);
   const items=list.map(([id,b],n)=>{const x=P.cellX(b.i),z=P.cellZ(b.j),y=P.groundY(p.site,b.i,b.j);M4.makeTranslation(x,y,z);base.setMatrixAt(n,M4);return {id,x,y:y+1.4+(+l)*.15,z,n,spin:(b.i*7+b.j*3)%6};});
   base.instanceMatrix.needsUpdate=true;g.turrets.add(base,hd);R.tur.set(kk,{base,hd,items});}}
 // walls: one instanced draw per blend look (up to 3,000 cells at CC10 with extensions)
 const wk=JSON.stringify(p.w)+low;if(R.keys.walls!==wk){R.keys.walls=wk;wipe(g.walls,keep);R.wim.clear();R.wcell=new Map();const by=new Map();for(const [kk,c] of Object.entries(p.w)){if(!by.has(c|0))by.set(c|0,[]);by.get(c|0).push(kk);}
  for(const [c,keys] of by){const geo=cached(R.wgeo,c+':'+low,()=>k.wallGeo(c,low)),m=inst(R,geo,keys.length);keys.forEach((kk,n)=>{const [i,j]=kk.split(',').map(Number);M4.makeTranslation(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j));m.setMatrixAt(n,M4);R.wcell.set(kk,[m,n]);});m.instanceMatrix.needsUpdate=true;g.walls.add(m);R.wim.set(c,m);}}
 // settler homes: one instanced draw per home kind
 const hl=P.homes(p),hk=hl.map(h=>h.id).join()+p.site+p.cc+low;if(R.keys.homes!==hk){R.keys.homes=hk;wipe(g.homes,keep);R.him.clear();R.hcell=new Map();const by=new Map();for(const h of hl){if(!by.has(h.k))by.set(h.k,[]);by.get(h.k).push(h);}
  for(const [kind,list] of by){const m=inst(R,cached(R.hgeo,kind+low,()=>k.home(kind,low)),list.length),_q=new T.Quaternion(),_v=new T.Vector3(),_one=new T.Vector3(1,1,1);list.forEach((h,n)=>{const x=P.cellX(h.i)+P.GRID.cell/2,z=P.cellZ(h.j)+P.GRID.cell/2;_q.setFromAxisAngle(new T.Vector3(0,1,0),(h.seed%4)*Math.PI/2);M4.compose(_v.set(x,P.heightAt(p.site,x,z),z),_q,_one);m.setMatrixAt(n,M4);R.hcell.set(h.id,[m,n]);});m.instanceMatrix.needsUpdate=true;g.homes.add(m);R.him.set(kind,m);}}
 const ck=JSON.stringify([p.banner,p.theme,p.b.cc?.i,p.b.cc?.j,p.site]);if(R.keys.deco!==ck){R.keys.deco=ck;if(R.deco){g.build.remove(R.deco);R.deco.traverse(o=>{if(!o.geometry?.userData?.hfShared)o.geometry?.dispose?.();});}R.deco=new T.Group();const c=p.b.cc,x0=P.cellX(c.i)+6,z0=P.cellZ(c.j)+6;R.deco.position.y=footY(p.site,c);
  if(p.banner){const m=k.banner(p.banner,1.6).mesh();m.position.set(x0+7,0,z0-7);R.deco.add(m);}if(p.theme?.decor?.length)R.deco.add(k.decor(p.theme.decor,x0,z0,16,16,p.theme.light).mesh());g.build.add(R.deco);}
 if(X.drill)for(const id of X.drill.gone)hideStruct(id,p);
 holo();}
// hologram blueprint, the wall tool preview, the draft, erase/copy selections, the selected building, breach markers
function holo(){const R=X?.R,p=plotOf();if(!R||!p)return;const g=R.g;wipe(g.holo);
 if(X.place){const q=X.place,err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r),B=P.BUILDINGS[q.type],cl=P.cells({t:q.type,i:q.i,j:q.j,r:q.r});
  const ring=B?.turret?{x:P.cellX(q.i),z:P.cellZ(q.j),y:P.groundY(p.site,q.i,q.j),r:B.turret.range*P.SITES[p.site].range}:null;g.holo.add(holoMesh(R,cl,!err,ring,p.site));}
 if(X.mode==='walls'){const dcells=[];for(const d of X.draft)for(const c of P.shapeCells(d.sec)||[])dcells.push(c);if(dcells.length)g.holo.add(holoMesh(R,dcells,2,null,p.site));
  if(X.draw?.cells?.length)g.holo.add(holoMesh(R,X.draw.cells,X.draw.ok,null,p.site));if(X.erase)g.holo.add(holoMesh(R,X.erase.keys.map(k=>k.split(',').map(Number)),false,null,p.site));}
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=P.BUILDINGS[b.t];g.holo.add(holoMesh(R,P.cells(b),true,B?.turret?{x:P.cellX(b.i),z:P.cellZ(b.j),y:P.groundY(p.site,b.i,b.j),r:B.turret.range*P.SITES[p.site].range*(1+.04*(b.l-1))}:null,p.site));}
 if(X.mode==='drill'&&X.drillResult&&!X.drill){for(const [i,j,n] of X.drillResult.breaches)g.holo.add(holoMesh(R,[[i,j]],false,{x:P.cellX(i),z:P.cellZ(j),y:P.groundY(p.site,i,j)+1,r:9+Math.min(12,2*n),col:[1.4,.2,.25]},p.site));}}
function frame(dt){if(!X)return;X.clock+=dt;const s=X.ctx.view.authority?.state;if(s?.plot&&!X.visit&&(s!==X.lastState||Date.now()-(X.lastUi||0)>1000)){X.lastState=s;const key=JSON.stringify([s.plot.b,s.plot.job,s.plot.cc,s.plot.site,s.plot.banner,s.plot.theme,Object.keys(s.plot.w).length,s.plot.cm|0,s.plot.fh,s.plot.ext,s.plot.st&&Math.floor((s.plot.st.alloy||0)+(s.plot.st.biomass||0)),s.ledger?.cp,(s.plot.log||[]).length,s.dev?.on]);if(key!==X.lastKey){X.lastKey=key;X.lastUi=Date.now();render();}else if(Date.now()-(X.lastUi||0)>1000){X.lastUi=Date.now();tickUi();}}
 if(X.msgAt&&Date.now()-X.msgAt>5000){X.msg.textContent='';X.msgAt=0;}
 // The world waits while you build: when the builder's time is up, re-open the session (the Worker settles the job) at most every 3 s.
 const job=s?.plot?.job,au=X.ctx.view.authority;if(job&&Date.now()>job.ready+250&&!X.syncing&&Date.now()-(X.syncAt||0)>3000&&au&&!X.busy){X.syncing=true;X.syncAt=Date.now();au.connect().finally(()=>{if(X)X.syncing=false;});}
 const R=X.R;if(!R){if(X.drill)drillStep(dt);draw2d();return;}const {view}=X.ctx,T=R.T,c=X.cam,host=view.host;
 // Draw only inside the visible stage with its own aspect, so cellAt() (stage rect) matches the picture exactly.
 const hr=host.getBoundingClientRect(),sr=X.stage.getBoundingClientRect(),w=Math.max(1,sr.width||390),h=Math.max(1,sr.height||400);if(R.cam.aspect!==w/h){R.cam.aspect=w/h;R.cam.updateProjectionMatrix();}
 const tilt=X.mode==='view'||X.mode==='drill'?Math.min(c.tilt,1.05):1.38,dist=c.dist;R.cam.position.set(c.x+Math.sin(c.yaw)*Math.cos(tilt)*dist,Math.sin(tilt)*dist,c.z+Math.cos(c.yaw)*Math.cos(tilt)*dist);R.cam.lookAt(c.x,0,c.z);
 for(const o of R.meshes.values()){const hd=o.o.userData.head;if(hd)hd.rotation.y=hd.userData.aim??(X.clock*(o.o.userData.radar?1:.4))%(Math.PI*2);}
 const M4=R._fm||(R._fm=new T.Matrix4()),_q=R._fq||(R._fq=new T.Quaternion()),_v=R._fv||(R._fv=new T.Vector3()),_s=R._fs||(R._fs=new T.Vector3()),up=R._up||(R._up=new T.Vector3(0,1,0));
 for(const t of R.tur.values()){for(const it of t.items){const a=it.aim??(X.clock*.4+it.spin)%(Math.PI*2);_q.setFromAxisAngle(up,a);M4.compose(_v.set(it.x,it.y,it.z),_q,_s.set(it.dead?0:1,it.dead?0:1,it.dead?0:1));t.hd.setMatrixAt(it.n,M4);}t.hd.instanceMatrix.needsUpdate=true;}
 for(const o of R.anim){const dr=o.userData.drones;dr.rotation.y=X.clock*1.4;dr.position.y=Math.sin(X.clock*3)*.4;}
 const far=c.dist>180;if(far!==!!R.far){R.far=far;sync();}   // distance LOD: the whole CC10 town in view draws the lighter wall and home geometry
 crewStep(R,plotOf());if(X.drill)drillStep(dt);
 R.S.viewLights(R.cam);R.S.U.uTime.value=(R.S.U.uTime.value||0)+dt;const r=view.renderer,vx=sr.left-hr.left,vy=hr.bottom-sr.bottom;r.setScissorTest(false);r.clear();r.setViewport(vx,vy,w,h);r.setScissor(vx,vy,w,h);r.setScissorTest(true);r.render(R.sc,R.cam);r.setScissorTest(false);r.setViewport(0,0,hr.width||w,hr.height||h);if((X.frames=(X.frames||0)+1)%30===1)X.info={calls:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs?.length||0};}
// crew walk between buildings, rovers drive the lanes (presentation)
function crewStep(R,p){if(!p)return;const T=R.T,mt=R._m||(R._m=new T.Matrix4()),bs=Object.values(p.b).filter(b=>b.l>0||b.t==='cc');if(!bs.length)return;const pos=b=>[P.cellX(b.i)+2,P.cellZ(b.j)+2];
 for(let n=0;n<R.crew.count;n++){const a=bs[n%bs.length],b=bs[(n*7+3)%bs.length],[x0,z0]=pos(a),[x1,z1]=pos(b),L=Math.hypot(x1-x0,z1-z0)||1,ph=((X.clock*1.3+n*11)%(2*L))/L,f=ph>1?2-ph:ph,x=x0+(x1-x0)*f+(n%3-1)*1.2,z=z0+(z1-z0)*f+5;mt.makeRotationY(Math.atan2(x1-x0,z1-z0)+(ph>1?Math.PI:0));mt.setPosition(x,P.heightAt(p.site,x,z),z);R.crew.setMatrixAt(n,mt);}
 R.crew.instanceMatrix.needsUpdate=true;const sp=P.spawnCells(p.site,p.cc);for(let n=0;n<R.rovers.count;n++){const L=sp[n%sp.length][0],t=((X.clock*.05+n*.33)%1),x=P.cellX(L[0])*(1-t)+6*t,z=P.cellZ(L[1])*(1-t)+6*t;mt.makeRotationY(Math.atan2(6-P.cellX(L[0]),6-P.cellZ(L[1])));mt.setPosition(x,P.heightAt(p.site,x,z),z);R.rovers.setMatrixAt(n,mt);}R.rovers.instanceMatrix.needsUpdate=true;}

// ------------------------------------------------------------------- raid replay (Defense Drill) -----------------------
// The phone replays the Worker's drill from its seed (same deterministic simulation): raiders, every turret type's firing
// effect, walls/homes/buildings falling, then the breach points and the fallen structures. The replay time is measured
// (X.drillMs) because the simulation runs once on the phone before the replay starts.
function startReplay(){const s=X?.ctx.view.authority?.state,p=s?.plot,e=p?.log?.[0];if(!e)return;const t0=performance.now(),r=P.drill(p,e.seed,{threat:e.threat});X.drillMs=Math.round(performance.now()-t0);X.drill={r,t:0,fi:0,ei:0,shots:[],gone:new Set()};X.drillResult=null;X.mode='drill';X.cam.dist=Math.min(320,140+P.townH(p.cc)*3);X.cam.x=0;X.cam.z=8;render();}
function hideStruct(id,p){const R=X.R;if(!R)return;if(id.startsWith('w:')){const e=R.wcell?.get(id.slice(2));if(e){const T=R.T,m=new T.Matrix4().makeScale(0,0,0);e[0].setMatrixAt(e[1],m);e[0].instanceMatrix.needsUpdate=true;}return;}
 const he=R.hcell?.get(id);if(he){he[0].setMatrixAt(he[1],new R.T.Matrix4().makeScale(0,0,0));he[0].instanceMatrix.needsUpdate=true;return;}
 for(const t of R.tur.values())for(const it of t.items)if(it.id===id){it.dead=true;t.base.setMatrixAt(it.n,new R.T.Matrix4().makeScale(0,0,0));t.base.instanceMatrix.needsUpdate=true;return;}
 const e=R.meshes.get(id);if(e)e.o.visible=false;}
function drillStep(dt){const D=X.drill,R=X.R,p=plotOf();D.t+=dt*1.6;const fr=D.r.frames;while(D.fi<fr.length-1&&fr[D.fi+1].t<=D.t)D.fi++;const a=fr[D.fi]||{f:[],s:[]},b=fr[Math.min(fr.length-1,D.fi+1)]||a,f=b.t>a.t?Math.max(0,Math.min(1,(D.t-a.t)/(b.t-a.t))):0;
 const bm=new Map(b.f.map(q=>[q[0],q]));D.now=a.f.map(q=>{const n=bm.get(q[0]);return n?[q[0],q[1],q[2]+(n[2]-q[2])*f,q[3]+(n[3]-q[3])*f]:q;});
 const ev=D.r.events;while(D.ei<ev.length&&ev[D.ei].t<=D.t){const e=ev[D.ei++];if(e.k==='shot')D.shots.push({...e,life:e.ty==='flame'?.35:.25});else if(e.k==='destroyed'){D.gone.add(e.id);hideStruct(e.id,p);}}D.shots=D.shots.filter(x=>(x.life-=dt)>0);
 if(R){const T=R.T,m=R._d||(R._d=new T.Matrix4()),sv=R._dv||(R._dv=new T.Vector3()),cnt={r:0,s:0,d:0,w:0,b:0};for(const [,kind,x,z] of D.now){const im=R.foes[kind];if(!im||cnt[kind]>=im.instanceMatrix.count)continue;m.makeRotationY(Math.atan2(-x,-z));m.setPosition(x,(kind==='d'?7:0)+P.heightAt(p.site,x,z),z);im.setMatrixAt(cnt[kind]++,m);}for(const [kk,im] of Object.entries(R.foes)){im.count=cnt[kk];im.visible=cnt[kk]>0;im.instanceMatrix.needsUpdate=true;}
  const fc={};for(const k2 of Object.keys(R.fx))fc[k2]=0;const from=id=>{const bb=p.b[id];return bb?[P.cellX(bb.i),P.groundY(p.site,bb.i,bb.j)+2,P.cellZ(bb.j)]:null;};
  const put=(kind,x0,y0,z0,x1,z1,scale=1)=>{const im=R.fx[kind];if(fc[kind]>=im.instanceMatrix.count)return;const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz)||1;m.makeRotationY(Math.atan2(dx,dz));m.scale(sv.set(scale,scale,L));m.setPosition(x0,y0,z0);im.setMatrixAt(fc[kind]++,m);};
  for(const sh of D.shots){const o=from(sh.from);if(!o)continue;const kind=FX_OF[sh.ty]||'tracer';
   if(kind==='arc'&&sh.ch){let [px,pz]=[o[0],o[2]];for(const [cx,cz] of sh.ch){put('arc',px,o[1],pz,cx,cz);px=cx;pz=cz;}}
   else if(kind==='flame')put('flame',o[0],o[1]-.5,o[2],sh.x,sh.z,4);
   else if(kind==='blast'||kind==='shell'){const k3=1-Math.max(0,sh.life)/.25;put(kind,o[0]+(sh.x-o[0])*k3,o[1]+2-k3,o[2]+(sh.z-o[2])*k3,sh.x,sh.z,1);}
   else put(kind,o[0],o[1],o[2],sh.x,sh.z,kind==='burst'||kind==='rail'?1.6:1);
   for(const t of R.tur.values())for(const it of t.items)if(it.id===sh.from)it.aim=Math.atan2(sh.x-it.x,sh.z-it.z);const e=R.meshes.get(sh.from);if(e?.o.userData.head)e.o.userData.head.userData.aim=Math.atan2(sh.x-o[0],sh.z-o[2])+(e.o.rotation.y||0);}
  for(const [k2,im] of Object.entries(R.fx)){im.count=fc[k2];im.visible=fc[k2]>0;im.instanceMatrix.needsUpdate=true;}}
 if(D.t>=D.r.time+1){X.drillResult=D.r;X.drill=null;if(R){for(const im of [...Object.values(R.foes),...Object.values(R.fx)]){im.count=0;im.visible=false;}for(const e of R.meshes.values()){e.o.visible=true;if(e.o.userData.head)delete e.o.userData.head.userData.aim;}for(const t of R.tur.values())for(const it of t.items){delete it.aim;}R.keys.walls=R.keys.homes=R.keys.tur=null;}render();}}

// ------------------------------------------------------------------- 2D fallback ---------------------------------------
// One pixel per cell in an offscreen canvas (terrain, walls by blend, homes), drawn scaled with no smoothing; buildings,
// raiders and previews on top. Cheap on any phone at any town size.
function layer2d(p){const key=p.site+p.cc+JSON.stringify(p.w)+P.homes(p).length;if(X.l2?.key===key)return X.l2.c;const n=P.GRID.n,c=X.l2?.c||document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d'),img=g.createImageData(n,n),h=P.townH(p.cc);
 const put=(i,j,rgb)=>{const o=(j*n+i)*4;img.data[o]=rgb[0];img.data[o+1]=rgb[1];img.data[o+2]=rgb[2];img.data[o+3]=255;};
 const T2={ground:[43,47,54],lush:[32,58,28],ash:[34,32,36],pass:[58,34,32],ice:[120,160,180],rim:[42,42,48],cliff:[26,27,32],water:[18,58,92],rock:[46,40,36],crevasse:[10,20,30],vent:[110,44,20],deposit:[122,74,44]};
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=T2[P.terrainAt(p.site,i,j)]||T2.ground,f=P.cheb(i,j)<=h?1:.45;put(i,j,t.map(v=>Math.round(v*f)));}
 for(const hm of P.homes(p))for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]])put(hm.i+a,hm.j+b,[150,110,70]);
 for(const [kk,code] of Object.entries(p.w)){const [i,j]=kk.split(',').map(Number),{o,l}=P.wdecode(code),c0=ORE_LOOK[o][0],c1=ORE_LOOK[o][1],t=o?l/3*.6:0,mix=k=>Math.round(((c0>>k)&255)*(1-t)+((c1>>k)&255)*t);put(i,j,[mix(16),mix(8),mix(0)]);}
 g.putImageData(img,0,0);X.l2={key,c};return c;}
function draw2d(){if(!X?.cv)return;const cv=X.cv,p=plotOf();if(!p)return;const r=X.stage.getBoundingClientRect(),dpr=Math.min(2,root.devicePixelRatio||1);if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);}   // height too: the stage resizes whenever the menu does
 const g=cv.getContext('2d'),n=P.GRID.n,cs=Math.min(cv.width,cv.height)/(P.townSide(p.cc)+4)*(170/X.cam.dist),ox=cv.width/2-X.cam.x/P.GRID.cell*cs,oy=cv.height/2-X.cam.z/P.GRID.cell*cs,X0=i=>ox+(i-(n-1)/2-.5)*cs,Y0=j=>oy+(j-(n-1)/2-.5)*cs;X.map2d={cs,ox,oy};
 g.fillStyle='#05070d';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;g.drawImage(layer2d(p),X0(0),Y0(0),n*cs,n*cs);
 const h=P.townH(p.cc);g.strokeStyle='#22e6ff';g.lineWidth=2;g.strokeRect(X0(P.MID-h),Y0(P.MID-h),(2*h+1)*cs,(2*h+1)*cs);g.fillStyle='#ff3048';for(const cl of P.spawnCells(p.site,p.cc))for(const [i,j] of cl)g.fillRect(X0(i)+cs*.2,Y0(j)+cs*.2,cs*.6,cs*.6);
 g.font=Math.round(cs*1.1)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';for(const [id,b] of Object.entries(p.b)){if(X.drill?.gone.has(id))continue;const s2=P.sizeOf(b.t,b.r|0),lvl=b.t==='cc'?p.cc:b.l;g.fillStyle=X.sel===id?'#ffd36b':P.VITALS[b.t]?'#6a5a3a':lvl>0?'#4a5664':'#6a4a2a';g.fillRect(X0(b.i)+1,Y0(b.j)+1,s2.w*cs-2,s2.d*cs-2);g.fillStyle='#e8f6ff';g.fillText((ICON[b.t]||'?')+(s2.w>1&&lvl>0?romanOf(lvl):''),X0(b.i)+s2.w*cs/2,Y0(b.j)+s2.d*cs/2);}
 const box=(cl,col)=>{g.strokeStyle=col;g.lineWidth=2;for(const [i,j] of cl)g.strokeRect(X0(i)+1,Y0(j)+1,cs-2,cs-2);};
 if(X.place)box(P.cells({t:X.place.type,i:X.place.i,j:X.place.j,r:X.place.r}),!(X.place.id?P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r,X.place.id):P.buildCheck(p,X.place.type,1)||P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r))?'#2dff8a':'#ff3048');
 if(X.mode==='walls'){for(const d of X.draft)box(P.shapeCells(d.sec)||[],'#ffb347');if(X.draw?.cells)box(X.draw.cells,'#2dff8a');if(X.erase)box(X.erase.keys.map(k=>k.split(',').map(Number)),'#ff3048');}
 if(X.place&&P.BUILDINGS[X.place.type]?.turret){g.strokeStyle='#22e6ff';g.beginPath();g.arc(X0(X.place.i)+cs/2,Y0(X.place.j)+cs/2,P.BUILDINGS[X.place.type].turret.range*P.SITES[p.site].range/P.GRID.cell*cs,0,7);g.stroke();}
 if(X.drill?.gone){g.fillStyle='#05070d';for(const id of X.drill.gone)if(id.startsWith('w:')){const [i,j]=id.slice(2).split(',').map(Number);g.fillRect(X0(i),Y0(j),cs,cs);}}
 if(X.drill?.now){for(const [,kind,x,z] of X.drill.now){g.fillStyle=kind==='d'?'#ff7ae8':kind==='b'?'#ff5a2a':'#ff2bd6';g.beginPath();g.arc(ox+x/P.GRID.cell*cs,oy+z/P.GRID.cell*cs,kind==='s'||kind==='b'?cs*.5:kind==='w'?cs*.2:cs*.3,0,7);g.fill();}}
 if(X.mode==='drill'&&X.drillResult&&!X.drill){g.strokeStyle='#ff3048';g.lineWidth=3;for(const [i,j,k] of X.drillResult.breaches){g.beginPath();g.arc(X0(i)+cs/2,Y0(j)+cs/2,cs*(1.4+Math.min(3,k*.3)),0,7);g.stroke();}}}
// ------------------------------------------------------------------- personal & social (Phase 2) ---------------------
const PALETTE=['#22e6ff','#ffb347','#ff3048','#2dffc4','#a07bff','#ffd36b','#f3f6fa','#1a2230','#3fae4a','#ff2bd6'];
const SHAPES=['shield','pennant','square','chevron'],EMBLEMS={moon:'☾',tank:'▰',star:'★',skull:'☠',gear:'⚙',wing:'❦',bolt:'ϟ',crown:'♛'};
function bannerCanvas(bn,w=120,h=150){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#0b1623';g.fillRect(0,0,w,h);g.fillStyle='#4a5664';g.fillRect(w*.12,h*.05,w*.05,h*.9);
 const x=w*.17,y=h*.08,W=w*.72,H=h*.55;g.fillStyle=bn.colors[0];g.beginPath();if(bn.shape==='pennant'){g.moveTo(x,y);g.lineTo(x+W,y+H/2);g.lineTo(x,y+H);}else if(bn.shape==='shield'){g.moveTo(x,y);g.lineTo(x+W,y);g.lineTo(x+W,y+H*.7);g.lineTo(x+W/2,y+H*1.1);g.lineTo(x,y+H*.7);}else if(bn.shape==='chevron'){g.moveTo(x,y);g.lineTo(x+W,y);g.lineTo(x+W*.8,y+H/2);g.lineTo(x+W,y+H);g.lineTo(x,y+H);}else g.rect(x,y,W,H);g.closePath();g.fill();
 g.fillStyle=bn.colors[1];g.fillRect(x,y+H*.42,W*(bn.shape==='pennant'?.55:1),H*.16);g.font='bold '+Math.round(H*.42)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(EMBLEMS[bn.emblem]||'★',x+W*.42,y+H*.5-H*.18);return c;}
function designer(box,p){const {el,button}=X.ctx;const bn=JSON.parse(JSON.stringify(p.banner||{shape:'shield',colors:['#22e6ff','#1a2230'],emblem:'moon'})),th=JSON.parse(JSON.stringify(p.theme||{light:'cyan',finish:'steel',decor:[]}));
 const prev=el('div','cq-banner-prev',null,box);const draw=()=>{prev.replaceChildren(bannerCanvas(bn));};draw();
 const row=(label,items,get,set,fmt2)=>{el('small','',label,box);const r=el('div','cq-plot-row',null,box);for(const it of items){const b=button(fmt2?fmt2(it):it.toUpperCase(),()=>{set(it);[...r.children].forEach(x=>x.classList.toggle('on',x===b));draw();},get()===it?'on':'');if(/^#/.test(it)){b.style.background=it;b.textContent='';b.setAttribute('aria-label',label+' '+it);}r.append(b);}};
 row('SHAPE',SHAPES,()=>bn.shape,v=>bn.shape=v);row('MAIN COLOR',PALETTE,()=>bn.colors[0],v=>bn.colors[0]=v);row('STRIPE COLOR',PALETTE,()=>bn.colors[1],v=>bn.colors[1]=v);row('EMBLEM',Object.keys(EMBLEMS),()=>bn.emblem,v=>bn.emblem=v,k=>EMBLEMS[k]);
 box.append(button('SAVE BANNER · on your base and your tank',()=>act('plot-banner',bn,'RAISING BANNER…'),'cq-plot-primary'));
 row('BASE LIGHTS',['cyan','amber','violet','green','red'],()=>th.light,v=>th.light=v);row('FINISH',['steel','sand','graphite'],()=>th.finish,v=>th.finish=v);
 el('small','','DECORATIONS (up to 6)',box);const dr=el('div','cq-plot-row',null,box);for(const d of ['flags','lamps','crates','antenna','plants','statue']){const b=button(d.toUpperCase(),()=>{const i=th.decor.indexOf(d);if(i>=0)th.decor.splice(i,1);else if(th.decor.length<6)th.decor.push(d);b.classList.toggle('on',th.decor.includes(d));},th.decor.includes(d)?'on':'');dr.append(b);}
 box.append(button('SAVE THEME',()=>act('plot-theme',th,'REPAINTING…'),'cq-plot-primary'));el('small','','Banners, lights, finishes and these decorations are free. Premium themes and skins are in the BASE STORE.',box);}
async function visitList(box){const {el,button,view}=X.ctx;const wait=el('p','','LOADING…',box);let L;try{L=await view.authority.transport('/api/conquest/visit',{});}catch(e){wait.textContent='VISITS NEED A CONNECTION';return;}wait.remove();
 if(L.week)el('p','cq-plot-next','★ BASE OF THE WEEK · '+L.week.n+' · +'+fmt(L.week.g)+' COMMAND POWER THIS WEEK',box);
 const sec=(title,list)=>{el('b','',title,box);if(!list.length){el('small','','None yet.',box);return;}for(const x of list){box.append(button((x.n||'Pilot')+' · CC'+x.cc+' · '+(P.SITES[x.site]?.name||'')+' · '+fmt(x.pw),()=>visit(x.p,x.n)));}};
 sec('SQUAD',L.squad||[]);sec('TOP 20 BY COMMAND POWER',L.top||[]);if(L.week&&!(L.top||[]).some(x=>x.p===L.week.p))box.append(button('VISIT BASE OF THE WEEK · '+L.week.n,()=>visit(L.week.p,L.week.n)));}
async function visit(pid,name){const {view}=X.ctx;say('OPENING '+String(name||'BASE').toUpperCase()+'…');let r;try{r=await view.authority.transport('/api/conquest/visit',{pid});}catch(e){say(String(e.message||'').replace(/^conquest: /,'').toUpperCase()||'NOT AVAILABLE');return;}
 X.visit={base:r.base,plot:fromSnap(r.base)};X.sel=null;X.mode='view';X.place=null;X.draw=null;X.draft=[];if(X.R){X.R.keys={};}X.cam={x:0,z:6,dist:Math.min(300,110+P.townH(r.base.cc)*2.6),tilt:.95,yaw:0};visitUi();}
function visitUi(){const {el,button}=X.ctx,v=X.visit.base,p=X.visit.plot;X.title.textContent='VISITING · '+v.n+' · '+(P.SITES[v.site]?.name||'')+' · CC'+v.cc+' · POWER '+fmt(v.pw);X.coach.hidden=true;const sh=X.sheet;sh.replaceChildren();
 el('p','cq-plot-hint','Read-only visit: look around this town, nothing here can be changed or taken. Raids on other towns arrive in Session 7.',sh);
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=b.t==='cc'?{n:'Command Center'}:P.BUILDINGS[b.t];el('b','',(ICON[b.t]||'')+' '+B.n.toUpperCase()+' '+romanOf(b.t==='cc'?p.cc:b.l),sh);}
 if(v.bn)sh.append(bannerCanvas(v.bn,90,110));sh.append(button('RETURN TO MY BASE',()=>{X.visit=null;X.sel=null;if(X.R){X.R.keys={};}X.cam={x:0,z:6,dist:170,tilt:.95,yaw:0};render();},'cq-plot-primary'));sync();}
function shareCard(s,p){const {el,button}=X.ctx,c=document.createElement('canvas');c.width=720;c.height=900;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,900);grad.addColorStop(0,'#071426');grad.addColorStop(1,'#03060c');g.fillStyle=grad;g.fillRect(0,0,720,900);
 g.fillStyle='#22e6ff';g.font='700 34px sans-serif';g.fillText('MY LUNAR TOWN',40,70);g.fillStyle='#e8f6ff';g.font='600 26px sans-serif';const name=(typeof save!=='undefined'&&(save.callsign||save.name))||'Pilot';g.fillText(String(name).slice(0,20)+' · '+P.SITES[p.site].name,40,112);
 g.fillStyle='#ffd36b';g.font='700 30px sans-serif';g.fillText('CC'+p.cc+' · '+Object.keys(p.w||{}).length+' WALLS · COMMAND POWER '+fmt(p.power||P.power(p)),40,156);
 const h=P.townH(p.cc),side=2*h+1,cs=Math.floor(600/side),i0=P.MID-h,ox=(720-side*cs)/2-i0*cs,oy=190-i0*cs;X.l2=null;g.imageSmoothingEnabled=false;g.drawImage(layer2d(p),i0,i0,side,side,ox+i0*cs,oy+i0*cs,side*cs,side*cs);X.l2=null;g.font=Math.max(9,cs)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';
 for(const b of Object.values(p.b||{})){const z=P.sizeOf(b.t,b.r|0);g.fillStyle=P.VITALS[b.t]?'#6a5a3a':'#4a5664';g.fillRect(ox+b.i*cs+1,oy+b.j*cs+1,z.w*cs-2,z.d*cs-2);if(z.w>1){g.fillStyle='#e8f6ff';g.fillText(ICON[b.t]||'',ox+(b.i+z.w/2)*cs,oy+(b.j+z.d/2)*cs);}}g.textAlign='left';g.textBaseline='alphabetic';
 if(p.banner)g.drawImage(bannerCanvas(p.banner,120,150),560,24);const link=typeof refLink==='function'?refLink():null;g.fillStyle='#ffb347';g.font='700 26px sans-serif';g.fillText('JOIN MY SQUAD · BUILD YOURS',40,818);g.fillStyle='#c9d6e2';g.font='500 24px sans-serif';g.fillText(link?link.replace(/^https?:\/\//,''):'LUNAR: War Machines · Telegram and web',40,858);
 const url=c.toDataURL('image/png'),box=el('div','cq-plot-share',null,X.sheet);X.sheet.scrollTop=X.sheet.scrollHeight;const img=document.createElement('img');img.src=url;img.alt='My Command Base: CC'+p.cc+', Command Power '+(p.power||0);img.className='cq-plot-share-img';box.append(img);
 const text='My LUNAR town: CC'+p.cc+' on a '+P.SITES[p.site].name+', '+fmt(p.power||0)+' Command Power. Join my squad and build yours.';
 box.append(button(typeof IN_TG!=='undefined'&&IN_TG?'SHARE IN TELEGRAM':'SHARE',async()=>{if(typeof IN_TG!=='undefined'&&IN_TG&&typeof shareRef==='function'){shareRef(text);return;}try{const blob=await (await fetch(url)).blob(),file=new File([blob],'lunar-base.png',{type:'image/png'}),data={title:'LUNAR: War Machines',text,...(link?{url:link}:{})};if(navigator.canShare?.({files:[file]}))data.files=[file];if(navigator.share)await navigator.share(data);else if(typeof shareRef==='function')shareRef(text);}catch(e){}},'cq-plot-primary'));
 const a=document.createElement('a');a.href=url;a.download='lunar-base.png';a.textContent='DOWNLOAD IMAGE';a.className='cq-plot-dl';box.append(a);}
// Revenue (fair, cosmetic or time only). Checkout stays disabled until payments are certified: shown honestly as unavailable.
const STORE=[['Aurora base lighting','theme'],['Gilded wall skin','skin'],['Animated war banner','banner'],['Commander statue','decoration'],['Second builder','two constructions at once'],['Speed-up','finish a construction sooner']];
// Revenue (owner MONEY RULE: what is sold and its limits live in ConquestPlot.STORE, one table). Checkout stays disabled
// until payments are certified: every tile is shown honestly as unavailable.
function storeList(box){const {el,button}=X.ctx;el('small','','Capacity, cosmetics and time only. Never airdrop points; rare-or-better ores are earn-only.',box);
 for(const it of P.STORE.items){const b=button(it.name.toUpperCase()+' · '+it.what.toUpperCase()+' · UNAVAILABLE',()=>{});b.disabled=true;b.setAttribute('aria-disabled','true');b.className='cq-plot-store';box.append(b);}
 el('small','','Checkout opens only after payments are certified (Session 8). Nothing here can be bought today. Everything a pack gives (wall capacity) can also be earned.',box);}

// ------------------------------------------------------------------- input ---------------------------------------------
// The tapped cell, with the terrain: a ray against the ground plane at the height of the cell it lands on (3 refinements,
// so terraces, the plateau and the canyon floor all land exactly).
function cellAt(clientX,clientY){const r=X.stage.getBoundingClientRect(),p=plotOf();if(X.R){const T=X.R.T,v=new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,X.R.cam);const o=ray.ray.origin,d=ray.ray.direction;let y=0,c=null;
  for(let k=0;k<4;k++){const t=(y-o.y)/d.y;if(!(t>0))return c;const x=o.x+d.x*t,z=o.z+d.z*t;c=[Math.round(x/P.GRID.cell+P.MID),Math.round(z/P.GRID.cell+P.MID)];const ny=p&&P.inGrid(c[0],c[1])?P.groundY(p.site,c[0],c[1]):0;if(Math.abs(ny-y)<.05)break;y=ny;}return c;}
 const m=X.map2d,dpr=X.cv.width/r.width;if(!m)return null;return [Math.floor(((clientX-r.left)*dpr-m.ox)/m.cs+P.MID+.5),Math.floor(((clientY-r.top)*dpr-m.oy)/m.cs+P.MID+.5)];}
function tap(cx,cy){const p=plotOf(),c=cellAt(cx,cy);if(!p||!c)return;const [i,j]=c;if(X.visit){const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;visitUi();return;}
 if(X.place){const s2=P.sizeOf(X.place.type,X.place.r);X.place.i=i-Math.floor((s2.w-1)/2);X.place.j=j-Math.floor((s2.d-1)/2);render();return;}
 if(X.mode==='walls')return;const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;if(X.mode!=='view'&&X.sel)X.mode='view';render();}
// wall tool gestures: a drag draws the current tool's shape; COPY/ERASE drag a box; PASTE taps an anchor
const box2=(a,b)=>{const out=[];for(let i=Math.min(a[0],b[0]);i<=Math.max(a[0],b[0]);i++)for(let j=Math.min(a[1],b[1]);j<=Math.max(a[1],b[1]);j++)out.push([i,j]);return out;};
function drawCells(a,b){return X.tool==='line'?P.line4(a,b):X.tool==='rect'?P.rectCells(a,b):X.tool==='ring'?P.ringCells(a,b):box2(a,b);}
function classify(p,cells){const occ=P.occupancy(p),code=P.wcode(X.blend.o,X.blend.l);return cells.map(([i,j])=>{if(!P.inTown(p.cc,i,j)||P.NOBUILD[P.terrainAt(p.site,i,j)])return false;const o=occ.get(P.key(i,j));if(o&&o!=='wall')return false;if(X.tool==='erase'||X.tool==='copy')return o==='wall'?2:false;return (p.w[P.key(i,j)]|0)===code?2:true;});}
function drawStart(c){const p=plotOf();if(!p||!c)return;if(X.tool==='paste'){pasteAt(c);return;}X.draw={a:c,b:c,cells:drawCells(c,c)};X.draw.ok=classify(p,X.draw.cells);holo();if(!X.R)draw2d();}
function drawMove(c){if(!X.draw||!c)return;const p=plotOf();if(c[0]===X.draw.b[0]&&c[1]===X.draw.b[1])return;if(X.tool==='ring'&&Math.hypot(c[0]-X.draw.a[0],c[1]-X.draw.a[1])>44)return;X.draw.b=c;X.draw.cells=drawCells(X.draw.a,c);X.draw.ok=classify(p,X.draw.cells);holo();if(!X.R)draw2d();}
function drawEnd(){const d=X.draw,p=plotOf();X.draw=null;if(!d||!p){render();return;}
 if(X.tool==='copy'){const cells=d.cells.filter(([i,j])=>p.w[P.key(i,j)]).map(([i,j])=>[i-Math.min(d.a[0],d.b[0]),j-Math.min(d.a[1],d.b[1]),p.w[P.key(i,j)]|0]);X.clip=cells.length?{cells}:null;say(cells.length?'COPIED '+cells.length+' WALL CELLS · PASTE IS READY':'NO WALLS IN THAT BOX');if(cells.length)X.tool='paste';render();return;}
 if(X.tool==='erase'){const keys=d.cells.filter(([i,j])=>p.w[P.key(i,j)]).map(([i,j])=>P.key(i,j));X.erase=keys.length?{keys,sec:{k:'cells',c:keys.flatMap(k=>k.split(',').map(Number))}}:null;if(!keys.length)say('NO WALLS IN THAT BOX');render();return;}
 if(X.draft.length>=P.MAX_SECTIONS){say('CONFIRM THESE FIRST (UP TO '+P.MAX_SECTIONS+' SECTIONS AN ORDER)');render();return;}
 X.draft.push({sec:{k:X.tool,a:d.a,b:d.b,o:X.blend.o,l:X.blend.l}});render();}
function pasteAt(c){const p=plotOf();if(!X.clip||!p)return;const by=new Map();for(const [di,dj,code] of X.clip.cells){const i=c[0]+di,j=c[1]+dj;if(!P.inGrid(i,j))continue;if(!by.has(code))by.set(code,[]);by.get(code).push(i,j);}
 if(X.draft.length+by.size>P.MAX_SECTIONS){say('CONFIRM THE DRAFT FIRST (UP TO '+P.MAX_SECTIONS+' SECTIONS AN ORDER)');return;}for(const [code,flat] of by){const {o,l}=P.wdecode(code);X.draft.push({sec:{k:'cells',c:flat,o,l}});}say('PASTED · CONFIRM WALLS TO BUILD');render();}
function input(){const el=X.stage,pts=new Map();let start=null,moved=0,pinch=0,mid=null;
 const drawing=()=>X.mode==='walls'&&!X.pan&&!X.place;
 el.addEventListener('pointerdown',e=>{el.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;
  if(pts.size===1){start={x:e.clientX,y:e.clientY,cx:X.cam.x,cz:X.cam.z};if(drawing())drawStart(cellAt(e.clientX,e.clientY));}
  else if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};start=null;if(X.draw){X.draw=null;holo();}}});
 const panBy=(dx,dy,cx,cz)=>{const k=X.cam.dist/((el.clientHeight||600)*.9),cs=Math.cos(X.cam.yaw),sn=Math.sin(X.cam.yaw),lim=(P.townH(plotOf()?.cc||1)+6)*P.GRID.cell;X.cam.x=Math.max(-lim,Math.min(lim,cx-(dx*cs+dy*sn)*k));X.cam.z=Math.max(-lim,Math.min(lim,cz-(-dx*sn+dy*cs)*k));};
 el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(pinch)X.cam.dist=Math.max(45,Math.min(330,X.cam.dist*pinch/d));if(mid)panBy(m.x-mid.x,m.y-mid.y,X.cam.x,X.cam.z);pinch=d;mid=m;return;}
  if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;moved=Math.max(moved,Math.hypot(dx,dy));
  if(drawing()){drawMove(cellAt(e.clientX,e.clientY));return;}
  if(moved>8)panBy(dx,dy,start.cx,start.cz);});
 const end=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);if(pts.size===0){if(drawing()&&X.draw)drawEnd();else if(start&&moved<8&&X.mode!=='walls')tap(e.clientX,e.clientY);start=null;pinch=0;mid=null;}else if(pts.size===1)mid=null;};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('wheel',e=>{e.preventDefault();X.cam.dist=Math.max(45,Math.min(330,X.cam.dist*(e.deltaY>0?1.1:.9)));},{passive:false});
 const rot=X.ctx.button('⟲',()=>{X.cam.yaw=(X.cam.yaw+Math.PI/2)%(Math.PI*2);},'cq-plot-rot');rot.setAttribute('aria-label','Rotate view');X.stage.append(rot);
 // Owner playtest (Nov 8): the menu felt tight. One tap swaps the split: bigger map (placing, walls) or bigger menu (browsing).
 const size=X.ctx.button('⤢',()=>{X.big=X.big==='map'?'menu':'map';layout();},'cq-plot-size');size.setAttribute('aria-label','Bigger map / bigger menu');X.stage.append(size);
 // In WALLS one finger draws; ✥ switches one finger to panning (two fingers always pan and pinch).
 const pan=X.ctx.button('✥',()=>{X.pan=!X.pan;pan.classList.toggle('on',X.pan);pan.setAttribute('aria-pressed',String(X.pan));},'cq-plot-pan');pan.setAttribute('aria-label','One finger pans the map');pan.setAttribute('aria-pressed','false');X.stage.append(pan);X.panBtn=pan;}
function layout(){if(!X)return;const want=X.big||(X.place||X.mode==='walls'?'map':'menu');X.d.classList.toggle('cq-plot-mapbig',want==='map');X.d.classList.toggle('cq-plot-menubig',want==='menu');X.d.classList.toggle('cq-plot-walls',X.mode==='walls');}

function tankBanner(view){const bn=view?.authority?.state?.plot?.banner,veh=view?.vehicle,S=view?.style;if(!veh||!S||view.renderer?.isConquestCanvas)return;const key=bn?JSON.stringify(bn):'';if(veh.userData.bannerKey===key)return;veh.userData.bannerKey=key;
 const old=veh.getObjectByName('cq-tank-banner');if(old){veh.remove(old);old.traverse(o=>o.geometry?.dispose?.());}if(!bn)return;const m=kit(S).banner(bn,.42).mesh();m.name='cq-tank-banner';m.position.set(-2.1,1.1,-.9);m.rotation.y=Math.PI;m.userData.noPick=true;veh.add(m);}
root.ConquestPlotView=Object.freeze({open,close,frame,isOpen,render,get state(){return X;},guideStep,unlockLine,tankBanner,bannerCanvas});
})(globalThis);
