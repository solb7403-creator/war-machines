'use strict';
// =====================================================================
// ArenaProps: what stands on the six Arcade maps (Session 5E-2c). Presentation only. Layout comes from MAPS (js/game.js):
// every wall, rock, crater, crate and bridge is drawn on the footprint the rules use. Raised art stays on its footprint or
// outside the arena; anything tall on the camera's side of the arena (south) is kept low so it never hides a tank.
// Materials: 'rock' (stone, regolith, concrete), 'paint' (painted panels), 'metal' (bare steel, foil), 'glow' (lights).
// =====================================================================
const ArenaProps=(()=>{
 const W=20,H=32,TILT=0.6,GKC=Math.cos(TILT),GSN=Math.sin(TILT),PI=Math.PI,hs=Arena3D.hs;
 const HZ='#d9a92e',HZK='#1d1f23',CYAN='#4fe3ff',STEEL='#8d969e',STEEL_D='#3b424a',STEEL_L='#aab2b9';
 const THEMES={
  classic:{name:'Moonbase',tread:0.36,dustC:'#a9a9aa',ground:'#8a8b8e',dust:'#98999b',strata:['#7c7872','#8a857e','#6a6660','#807b74'],seed:3,pebbles:0.8,crate:'tan',crateMat:'crate',accent:CYAN,horizon:1},
  overpass:{name:'Overpass',tread:0.3,dustC:'#cfc9bf',ground:'#cbc4b9',dust:'#cfc9bf',strata:['#8e8a84','#9a958e'],seed:7,pebbles:0.4,relief:1.3,mottle:0.1,trackK:0.3,crate:'tan',crateMat:'crate',accent:'#35e0d2',horizon:1},
  longshot:{name:'Longshot',tread:0.36,dustC:'#aaa097',ground:'#8f847a',topGround:'#7d6e60',topKind:1,wallPeb:0.7,dust:'#978c82',strata:['#6b5848','#8e7660','#a58c72','#7a6654'],seed:11,pebbles:0.7,crate:'tan',crateMat:'crate',accent:'#ffc46a',horizon:1},
  craters:{name:'Crater Field',tread:0.36,dustC:'#a8a8aa',ground:'#898a8d',dust:'#98999b',strata:['#7c7872','#8a857e'],seed:17,pebbles:1.0,relief:1.7,crate:'tan',crateMat:'crate',accent:CYAN,horizon:1},
  canyon:{name:'Canyon',tread:0.36,dustC:'#b3b4b6',ground:'#a4a7ab',topGround:'#7c6e60',topKind:1,wallPeb:0.8,dust:'#9a958e',strata:['#6b5d50','#8a7a69','#a08e7a','#77685a'],seed:23,pebbles:0.8,relief:1.6,crate:'steel',crateMat:'metal',accent:'#ffb066',horizon:1},
  bunker:{name:'Underground Bunker',tread:0.16,dustC:null,ground:'#666a6f',topGround:'#6b6a6c',dust:null,strata:['#5a5a5e','#66666a'],seed:29,plates:true,pebbles:0.6,crate:'steel',crateMat:'metal',accent:CYAN,horizon:1}
 };
 const theme=id=>Object.assign({id},THEMES[id]||THEMES.classic);

 // ---------- shared pieces ----------
 // one shipping container, l long (along x if alongX), s wide
 function containerOne(B,X,Z,l,s,alongX,Hc,sd){
  const pal=[['#b9571a','#e2802c','#7c3a10'],['#b05216','#da7826','#74360f'],['#c06220','#e88e3a','#84400f'],['#a65320','#cf7a32','#6e3712']][Math.floor(hs(sd,1.7)*4)%4],[body,rib,frame]=pal,hi=B.high;
  const bx=(cls,c,lx,y,lz,sx,sy,sz,o)=>B.box(cls,c,alongX?X+lx:X+lz,y,alongX?Z+lz:Z+lx,alongX?sx:sz,sy,alongX?sz:sx,0,o);
  bx('paint',body,0,Hc/2+0.02,0,l-0.06,Hc-0.04,s-0.08,{dust:0.1});
  const st=hi?0.21:0.42;for(let t=-l/2+0.16;t<l/2-0.1;t+=st){for(const sg of [-1,1])bx('paint',rib,t,Hc*0.5+0.02,sg*(s/2-0.028),0.1,Hc*0.76,0.045,{ao:0.22,dust:0.1});   // side corrugation
   if(hi)bx('paint',rib,t+st/2,Hc+0.01,0,0.1,0.036,s-0.24,{ao:0,dust:0.1});}   // roof corrugation
  for(const a of [-1,1])for(const b of [-1,1])bx('paint',frame,a*(l/2-0.04),Hc/2,b*(s/2-0.04),0.08,Hc,0.08,{dust:0.12});   // corner posts
  for(const b of [-1,1]){bx('paint',frame,0,Hc-0.03,b*(s/2-0.035),l,0.07,0.07,{ao:0,dust:0.12});bx('paint',frame,0,0.05,b*(s/2-0.035),l,0.08,0.07);}
  for(const a of [-1,1])bx('paint',frame,a*(l/2-0.035),Hc-0.03,0,0.07,0.07,s,{ao:0,dust:0.12});
  // doors on one end: two leaves, lock rods, handles; the other end is corrugated
  const de=hs(sd,9)>0.5?1:-1;
  bx('paint',rib,de*(l/2-0.012),Hc/2+0.02,0,0.03,Hc*0.8,s-0.2,{dust:0.05});bx('paint',frame,de*(l/2+0.004),Hc/2+0.02,0,0.012,Hc*0.8,0.03);
  for(const v of [-0.34,-0.12,0.12,0.34])bx('metal',STEEL_L,de*(l/2+0.012),Hc/2+0.02,v*s,0.022,Hc*0.78,0.028,{ao:0.1});
  if(hi){for(const v of [-0.23,0.23])bx('metal',STEEL_D,de*(l/2+0.03),Hc*0.42,v*s,0.02,0.05,0.16,{ao:0});
   for(let t=-s/2+0.2;t<s/2-0.12;t+=0.21)bx('paint',rib,-de*(l/2-0.012),Hc/2+0.02,t,0.04,Hc*0.76,0.085,{ao:0.2});
   }
 }
 // a container wall of any footprint: stacks of 1-wide containers
 function containers(B,x,z,w,d,sd){
  const long=w>=d,L=long?w:d,S=long?d:w,nS=S>=1.9?2:1,nL=L>=5?2:1,l=L/nL,s=S/nS;
  for(let i=0;i<nL;i++)for(let j=0;j<nS;j++){const a=(i+0.5)*l,c=(j+0.5)*s;containerOne(B,long?x+a:x+c,long?z+c:z+a,l-0.05,s-0.05,long,1.02+0.06*hs(sd+i*3.1,j*7.7),sd+i*3+j*7);}
 }
 function boulder(B,x,z,r,sd,c){
  const cc=c||'#8f8b85';B.rock(cc,x,0,z,r*0.98,r*1.25,sd,{sx:1,sz:0.9});
  B.rock(c?c:'#837f79',x+r*0.62,0,z+r*0.5,r*0.36,r*0.42,sd+3);if(B.high)B.rock(cc,x-r*0.55,0,z+r*0.62,r*0.24,r*0.26,sd+5);
 }
 // loose stones round something (visual only: under tank-height, never a solid)
 function pebbleRing(B,x,z,r0,r1,n,sd,c){for(let i=0;i<n;i++){const a=hs(sd+i,3.3)*6.283,rr=r0+(r1-r0)*hs(i,sd*1.7),q=0.035+hs(i*2.1,sd)*0.06;B.rock(c||'#8b8782',x+Math.cos(a)*rr,0,z+Math.sin(a)*rr,q,q*1.3,sd+i,{ao:0.5,aoH:0.1});}}
 const oct=(hw,hd,ch)=>[[-hw+ch,-hd],[hw-ch,-hd],[hw,-hd+ch],[hw,hd-ch],[hw-ch,hd],[-hw+ch,hd],[-hw,hd-ch],[-hw,-hd+ch]];
 // hazard chevrons along a strip on a face: n slanted yellow bars on black
 function hazard(B,x0,z0,x1,z1,y,ht,nrm){   // strip from (x0,z0) to (x1,z1) at height y, ht tall, pushed out along nrm [nx,nz]
  const L=Math.hypot(x1-x0,z1-z0),n=Math.max(2,Math.round(L/0.34)),dx=(x1-x0)/L,dz=(z1-z0)/L,ry=-Math.atan2(dz,dx);
  B.box('paint',HZK,(x0+x1)/2+nrm[0]*0.006,y,(z0+z1)/2+nrm[1]*0.006,L,ht,0.012,ry,{ao:0,dust:0});
  for(let i=0;i<n;i+=2){const f=(i+0.5)/n;B.box('paint',HZ,x0+(x1-x0)*f+nrm[0]*0.013,y,z0+(z1-z0)*f+nrm[1]*0.013,L/n*0.92,ht,0.012,ry,{ao:0,dust:0});}
 }
 // the kerb and light strip that marks the arena edge wherever no wall stands on it. The south edge stays low.
 function border(B,M,o){
  o=o||{};const hi=B.high,walls=M.map.walls||[],c=o.c||'#96928b',gl=o.glow||M.theme.accent;
  const free=(a0,a1,test)=>{const out=[];let s=a0;const cuts=walls.filter(test.hit).map(test.span).sort((p,q)=>p[0]-q[0]);for(const [u,v] of cuts){if(u>s+0.05)out.push([s,Math.min(u,a1)]);s=Math.max(s,v);}if(s<a1-0.05)out.push([s,a1]);return out;};
  const N=free(0,W,{hit:w=>w[1]<0.01,span:w=>[w[0],w[0]+w[2]]}),S=free(0,W,{hit:w=>w[1]+w[3]>H-0.01,span:w=>[w[0],w[0]+w[2]]}),Wt=free(0,H,{hit:w=>w[0]<0.01,span:w=>[w[1],w[1]+w[3]]}),E=free(0,H,{hit:w=>w[0]+w[2]>W-0.01,span:w=>[w[1],w[1]+w[3]]});
  const kh=o.h||0.16,kw=0.44,ko=kw/2+0.02,stud=(x,z,cc)=>{B.box('metal',STEEL_D,x,kh+0.03,z,0.2,0.06,0.2,0,{ao:0,lit:1});B.glow(cc,x,kh+0.07,z,0.12,0.03,0.12);B.halo(x,kh+0.14,z,0.95,cc,0.5,1.1);};
  const seg=(x0,z0,x1,z1,cc,edge)=>{const lx=x1-x0,lz=z1-z0,X=(x0+x1)/2,Z=(z0+z1)/2,alongX=lx>lz;B.box('rock',c,X,kh/2,Z,alongX?lx+kw:kw,kh,alongX?kw:lz+kw,0,{ao:0.25,aoH:0.16,lit:1,dust:0.1});
   B.glow(cc,alongX?X:X+edge*0.13,kh+0.012,alongX?Z+edge*0.13:Z,alongX?lx-0.3:0.045,0.022,alongX?0.045:lz-0.3);M.aoBoxes.push([alongX?x0:x0-kw/2,alongX?z0-kw/2:z0,alongX?lx:kw,alongX?kw:lz]);
   const L=alongX?lx:lz,n=Math.max(1,Math.round(L/4));for(let i=0;i<=n;i++){const f=i/n;if(hi||i%2===0)stud(alongX?x0+lx*f:X,alongX?Z:z0+lz*f,cc);}};
  for(const [a,b] of N)seg(a,-ko,b,-ko,'#ff6a72',1);
  for(const [a,b] of S)seg(a,H+ko,b,H+ko,'#5aa8ff',-1);
  for(const [a,b] of Wt)seg(-ko,a,-ko,b,gl,1);
  for(const [a,b] of E)seg(W+ko,a,W+ko,b,gl,-1);
 }
 // the world outside the arena on open ground: rocks, a far ridge under the sky, base clutter. Darker with distance.
 function outland(B,M,o){
  o=o||{};const v=M.view,hi=B.high,sd=M.theme.seed*13.7,dimAt=(x,z)=>{const dx=Math.max(0,-x,x-W),dz=Math.max(0,-z,z-H);return 1-0.45*Math.min(1,Math.hypot(dx,dz)/14);};
  const clear=(x,z,r)=>x<-r-0.6||x>W+r+0.6||z<-r-0.6||z>H+r+0.6;
  const n=Math.round((hi?0.085:0.035)*((v.x1-v.x0)*(v.z1-v.z0)-W*H));
  for(let i=0;i<n;i++){const x=v.x0+hs(i,sd)*(v.x1-v.x0),z=Math.max(M.horizon+0.8,v.z0)+hs(sd,i*1.3)*(v.z1-Math.max(M.horizon+0.8,v.z0)),big=hs(i*3.7,sd)>0.86,r=big?0.5+hs(i,7)*0.7:0.1+hs(i,9)*0.22;
   if(!clear(x,z,r)||z>H+2&&r>0.3||(big&&(x>-5&&x<W+5&&z>-5)))continue;if(o.avoid&&o.avoid(x,z,r))continue;B.rock(o.rock||'#8a8681',x,0,z,r,r*(big?1.1:1.3),i,{dim:dimAt(x,z)});}
 }
 // the far ridge: a chain of low hills on the horizon line (north), so the ground ends in a silhouette under the stars
 function ridge(B,M,y0,c){
  const v=M.view,z=M.horizon;if((v.vis||v).z0>z-0.5)return;
  const n=Math.ceil((v.x1-v.x0)/1.1),far=c?Arena3D.mul(Arena3D.lin(c),0.34):Arena3D.lin('#2c2e33'),near=c?Arena3D.mul(Arena3D.lin(c),0.52):Arena3D.lin('#484b51');
  // two flat silhouette layers (unlit): far peaks, nearer low hills, each with a paler crest where the sun catches it
  for(let i=0;i<=n;i++){const x=v.x0+(v.x1-v.x0)*i/n+(hs(i,4.4)-0.5)*0.8;
   B.spire(far,x+0.5,y0||0,z-0.5,1.5+hs(i,3.3)*1.5,0.5+Math.pow(hs(i,7.7),1.6)*1.3,i+70,{cls:'glow',noShadow:1,top:Arena3D.mul(far,1.5)});
   B.rock(near,x,y0||0,z+0.3+hs(i,6)*0.4,1.0+hs(i,8.1)*1.2,0.16+Math.pow(hs(i*1.9,2.2),1.8)*0.5,i+40,{cls:'glow',sz:0.5,ry:0,noShadow:1,top:Arena3D.mul(near,1.45)});}
 }

 // ---------- Moonbase / Crater Field / Longshot props ----------
 function cmd(B,x,z,w,d,M){
  const X=x+w/2,Z=z+d/2,H1=0.6,body='#586b82',lt='#6f849c',dk='#313c4a',hi=B.high;
  B.prism('paint',dk,X,0,Z,oct(w/2-0.01,d/2-0.01,0.5),0.1,{bevel:0.02});
  B.prism('paint',body,X,0.08,Z,oct(w/2-0.06,d/2-0.06,0.52),H1,{bevel:0.06,top:lt});
  B.prism('paint',lt,X,H1+0.06,Z,oct(w/2-0.62,d/2-0.5,0.36),0.24,{bevel:0.05});
  B.prism('paint',dk,X-0.2,H1+0.3,Z,oct(0.62,0.5,0.2),0.07,{bevel:0.02});B.glow(CYAN,X,H1+0.19,Z+d/2-0.49,w-1.9,0.03,0.02);for(const sg of [-1,1])B.box('paint',HZ,X+sg*(w/2-0.9),H1+0.305,Z+0.2,0.1,0.012,1.2,0,{ao:0,dust:0});B.cyl('metal',STEEL,X-0.2,H1+0.39,Z,0.3,0.04,hi?14:8);   // roof hatch
  // windows: warm light on the camera-facing side and both flanks
  for(const t of [-1.5,-0.5,0.5,1.5]){B.box('paint',dk,X+t*0.62,0.42,Z+d/2-0.07,0.5,0.28,0.04,0,{ao:0});B.glow('#ffd46a',X+t*0.62,0.42,Z+d/2-0.048,0.4,0.19,0.02);}
  B.halo(X,0.5,Z+d/2+0.15,3.2,'#ffcf7a',0.42);if(M)M.glowSpots.push([X,Z+d/2+0.7,2.2,'255,205,110',0.42]);
  for(const sg of [-1,1]){B.glow('#ffd27a',X+sg*(w/2-0.075),0.42,Z+0.1,0.02,0.16,0.8);B.box('paint',dk,X+sg*(w/2-0.36),H1*0.55,Z-d/2+0.42,0.5,0.34,0.5,sg*0.78,{dust:0.25});}
  hazard(B,X-0.8,Z+d/2-0.02,X+0.8,Z+d/2-0.02,0.1,0.08,[0,1]);
  if(hi){for(const t of [-1.25,-0.75,0.85,1.3])B.box('paint',dk,X+t,H1+0.095,Z-0.05,0.03,0.012,d*0.6,0,{ao:0,dust:0.1});
   for(const sg of [-1,1])B.box('metal',STEEL,X+sg*1.05,H1+0.13,Z+0.55,0.5,0.1,0.34,0,{dust:0.3});B.box('metal',STEEL_D,X+1.0,H1+0.14,Z-0.75,0.6,0.12,0.4,0,{dust:0.3});}
  // antenna masts with a slow red blink, and a turning dish
  for(const [ax,az,ah] of [[X-1.45,Z-0.95,1.05],[X+1.5,Z-1.0,0.8]]){B.cyl('metal',STEEL_L,ax,H1+ah/2,az,0.022,ah,5,{ao:0});B.glow('#ff5a50',ax,H1+ah+0.03,az,0.06,0.06,0.06);B.halo(ax,H1+ah+0.03,az,0.75,'#ff4d44',0.6,2.2);}
  B.k.spin.push({p:[X+0.75,H1+0.32,Z-0.3],axis:'y',spd:0.6,build:b=>{b.cyl('metal',STEEL_D,0,0.09,0,0.05,0.18,6,{ao:0});b.cyl('metal','#c9d0d6',0,0.24,0,0.3,0.1,hi?14:8,{rt:0.25,rx:0.9,ao:0,dust:0});b.box('metal',STEEL_D,0.12,0.32,0,0.02,0.2,0.02,0,{ao:0,rz:-0.6});}});
 }
 function dome(B,x,z,r,M){
  const hi=B.high,seg=hi?22:12,R=r*0.9,sy=0.8;
  B.cyl('metal','#5c656e',x,0.08,z,r*0.98,0.16,seg,{dust:0.3});
  B.sph('paint','#f2efe6',x,0.15,z,R,R*sy,seg,true,{ao:0.18,aoH:0.4,dust:0.04,punch:0.1});B.sph('glow','#fff1d2',x,0.2,z,R*0.5,R*sy*0.52,hi?12:8,true);
  const nm=hi?6:3;for(let i=0;i<nm;i++)B.tor('metal','#8f989f',x,0.15,z,R*1.004,0.017,hi?24:14,{rx:0,ry:i*PI/nm,sy,ts:4,ao:0,dust:0});
  for(const f of hi?[0.36,0.72]:[0.5]){const a=f*PI/2;B.tor('metal','#8f989f',x,0.15+R*sy*Math.sin(a),z,R*Math.cos(a)*1.004,0.017,hi?24:14,{ts:4,ao:0,dust:0});}
  B.tor('glow','#ffe9c0',x,0.19,z,R*1.01,0.016,hi?28:14,{ts:4});B.halo(x,0.6,z,r*3.0,'#ffe6b8',0.34);if(M)M.glowSpots.push([x,z,r*2.3,'255,232,190',0.34]);
  B.box('paint','#aeb7be',x,0.22,z+r*0.76,0.52,0.44,0.34,0,{dust:0.3});B.glow(CYAN,x,0.3,z+r*0.76+0.175,0.3,0.2,0.012);B.halo(x,0.3,z+r*0.95,0.8,CYAN,0.35);
 }
 function lander(B,x,z,w,d,sd){
  const X=x+w/2,Z=z+d/2,hi=B.high,gold='#c89a2e',gold2='#a87c1e',fl=sd>10?-1:1;
  B.prism('metal',gold,X,0.3,Z,oct(0.58,d/2-0.06,0.2),0.42,{bevel:0.04,dust:0.1,ao:0.25});   // descent stage, gold foil
  if(hi)for(let i=0;i<6;i++){const a=hs(sd+i,2)*6.28;B.box('metal',gold2,X+Math.cos(a)*0.4,0.52+hs(i,sd)*0.14,Z+Math.sin(a)*(d/2-0.2),0.22,0.12,0.2,a,{ao:0,dust:0.1});}
  B.cyl('metal','#4a4f56',X,0.2,Z,0.2,0.2,10,{rt:0.55,ao:0.3});   // engine bell
  for(const a of [-1,1])for(const b of [-1,1]){const fx=X+a*(w/2-0.2),fz=Z+b*(d/2-0.14),mx=X+a*0.5,mz=Z+b*(d/2-0.2),L=Math.hypot(fx-mx,0.55,fz-mz);
   B.cyl('metal',STEEL_L,(fx+mx)/2,0.3,(fz+mz)/2,0.03,L,5,{rz:a*Math.atan2(Math.abs(fx-mx),0.55),rx:-b*Math.atan2(Math.abs(fz-mz),0.55)*0.6,ao:0.1});B.cyl('metal','#b9a36a',fx,0.03,fz,0.15,0.05,hi?10:6);}
  B.prism('paint','#aab1b8',X-0.05*fl,0.72,Z,oct(0.4,0.36,0.14),0.36,{bevel:0.05,dust:0.2});B.cyl('paint','#8f979e',X+0.3*fl,0.88,Z,0.2,0.3,hi?10:6,{rx:PI/2,dust:0.2});   // ascent stage
  B.glow('#ffd27a',X-0.05*fl,0.9,Z+0.366,0.26,0.1,0.012);B.halo(X,0.9,Z+0.5,0.9,'#ffcf7a',0.3);
  B.cyl('metal',STEEL_L,X-0.3*fl,1.2,Z-0.15,0.016,0.4,5,{ao:0});B.cyl('metal','#d5dade',X-0.3*fl,1.42,Z-0.15,0.2,0.07,hi?12:7,{rt:0.2,rx:0.5,rz:0.3,ao:0,dust:0});
  // what was unloaded beside it: a cargo pallet and a folded solar wing
  B.box('metal',STEEL_D,X+fl*(w/2-0.42),0.06,Z,0.7,0.1,d-0.2);B.box('paint','#b9a36a',X+fl*(w/2-0.5),0.28,Z-0.14,0.42,0.34,0.44,0.2);B.box('paint','#8f979e',X+fl*(w/2-0.3),0.22,Z+0.26,0.3,0.24,0.3,-0.3);
  B.box('metal','#2c3f66',X-fl*(w/2-0.4),0.34,Z,0.62,0.03,d-0.24,0,{rz:fl*0.35,ao:0,dust:0.15});B.box('metal',STEEL,X-fl*(w/2-0.4),0.16,Z,0.05,0.32,0.05);
  if(hi)for(let i=0;i<3;i++)B.box('metal','#9fb4d8',X-fl*(w/2-0.4),0.357,Z-0.28+i*0.28,0.6,0.008,0.012,0,{rz:fl*0.35,ao:0,dust:0});
 }
 function pylonOne(B,x,z,h,r,gl){
  const hi=B.high;B.cyl('metal',STEEL_D,x,0.2,z,r*1.5,0.06,hi?10:6);B.box('metal','#7d8791',x,0.2+h/2,z,r*1.15,h,r*0.8,0,{ao:0.3,aoH:0.5,dust:0.05});
  for(const s of [-1,1])B.box('metal',STEEL_L,x+s*r*0.62,0.2+h/2,z,r*0.16,h*0.96,r*0.95,0,{ao:0.2,dust:0});
  B.glow(gl,x,0.2+h*0.52,z+r*0.41,r*0.34,h*0.74,0.02);B.glow(gl,x,0.2+h*0.52,z-r*0.41,r*0.34,h*0.74,0.02);
  B.tor('metal',STEEL_L,x,0.2+h+r*0.5,z,r*0.52,r*0.14,hi?14:8,{rx:0,ao:0,dust:0});B.sph('glow',gl,x,0.2+h+r*0.5,z,r*0.36,r*0.36,hi?10:6);
  B.halo(x,0.2+h+r*0.5,z,r*7,gl,0.55,1.6);B.halo(x,0.2+h*0.5,z+r*0.5,r*4.5,gl,0.25);
 }
 function pylon(B,x,z,w,d,M){
  const X=x+w/2,Z=z+d/2,gl=M.theme.accent==='#ffc46a'?'#58e6d8':M.theme.accent,hi=B.high;
  B.prism('metal','#49525b',X,0,Z,oct(w/2-0.02,d/2-0.02,0.3),0.2,{bevel:0.04,dust:0.3});hazard(B,x+0.3,z+d-0.02,x+w-0.3,z+d-0.02,0.1,0.08,[0,1]);
  pylonOne(B,X,Z,1.25,0.17,gl);pylonOne(B,X-0.52,Z+0.95,0.8,0.13,gl);pylonOne(B,X+0.52,Z-0.95,0.8,0.13,gl);
  for(const [ax,az] of [[-0.52,0.95],[0.52,-0.95]]){const L=Math.hypot(ax,az);B.cyl('metal','#5d6770',X+ax/2,0.27,Z+az/2,0.045,L,6,{rx:PI/2,ry:Math.atan2(ax,az),ao:0});}
  if(hi)for(const s of [-1,1])B.box('metal','#5d6770',X+s*0.62,0.3,Z+s*0.3,0.34,0.2,0.5,0,{dust:0.3});
  B.k.spin.push({p:[X,1.0,Z],axis:'y',spd:1.1,build:b=>{b.tor('glow',gl,0,0,0,0.44,0.02,hi?24:12,{ts:4});b.tor('glow','#d8fbff',0,0.26,0,0.32,0.014,hi?20:10,{ts:4});}});
  B.k.anchors.vents.push([X,Z,0.6,1.5]);
 }
 // long rock walls of the Longshot alley: strata facing the lane, plateau on top, carried on beyond the arena
 function cliffs(B,M){
  const v=M.view,Hc=1.8,hz=M.horizon,th=M.theme;
  for(const side of [0,1]){const x0=side?16:0,open=side?{W:1}:{E:1};
   B.strata([x0,0,4,H],Hc,{open,seed:side*31+5,inset:0.3,lean:0.22});
   B.strata([x0,hz,4,-hz],Hc,{open,seed:side*31+9,inset:0.3,lean:0.22,dim:0.8});
   B.strata([x0,H,4,v.z1-H],Hc*0.2,{open,seed:side*31+13,inset:0.3,layers:1});   // the camera's side: a low step only
   // the plateau beyond the arena edge
   if(side)B.topRect(W,hz,v.x1,H,Hc);else B.topRect(v.x0,hz,0,H,Hc);
   const xo=side?W:v.x0,wo=side?v.x1-W:-v.x0;if(wo>0.05)B.box('rock',th.strata[0],xo+wo/2,Hc*0.5-0.01,H+0.02,wo,Hc-0.02,0.04,0,{ao:0.3});
   if(side)B.topRect(W,H,v.x1,v.z1,Hc*0.2);else B.topRect(v.x0,H,0,v.z1,Hc*0.2);
   // set dressing on the rim: boulders, spires, work lights looking down into the lane
   const n=B.high?9:4;for(let i=0;i<n;i++){const z=1.5+i*(H-3)/(n-1)+(hs(i,side)-0.5)*1.2,x=side?W-0.9-hs(i,3+side)*1.9:0.9+hs(i,3+side)*1.9,r=0.22+hs(i*1.7,side+5)*0.4;B.yb(Hc);if(hs(i,side+8)>0.55){for(let j=0;j<3;j++)B.rock(th.strata[(i+j)%4],x+(j-1)*r*0.62,Hc,z+(hs(i,j)-0.5)*r*0.6,r*0.42,r*(0.9+hs(j,i)*0.7),i*3+j,{sz:1.8,ry:0.35+0.2*hs(i,j+3)});}else B.rock(th.strata[i%4],x,Hc,z,r,r*1.1,i+side*9);B.yb(0);}
   for(const z of B.high?[5,11,21,27]:[8,24]){const x=side?16.5:3.5,s=side?-1:1;B.yb(Hc);B.box('metal',STEEL_D,x,Hc+0.3,z,0.08,0.6,0.08);B.box('metal',STEEL_D,x+s*0.2,Hc+0.6,z,0.5,0.06,0.1);B.glow('#ffd9a0',x+s*0.42,Hc+0.565,z,0.12,0.03,0.16);B.yb(0);B.halo(x+s*0.42,Hc+0.5,z,1.6,'#ffcf8a',0.4);
    M.glowSpots.push([x+s*1.4,z,2.4,'255,200,120',0.16]);B.k.anchors.sparks.push([x+s*0.42,Hc+0.5,z]);}
  }
 }

 // ---------- Overpass: the steel bridge, its ramps and tunnels ----------
 const DECK=1.0;
 function steelBridge(B,M,BRd){
  const [dx,dy,dw,dh]=BRd.deck,hi=B.high,slab='#6a6f74',slabD='#54595e',dark='#2c3136',CYAN=M.theme.accent;
  let x0=dx;const blocks=[];for(const [tx,tw] of BRd.tunnels){blocks.push([x0,tx-x0,true]);blocks.push([tx,tw,false]);x0=tx+tw;}blocks.push([x0,dx+dw-x0,true]);
  for(const [sx,sw,solid] of blocks){
   if(solid){
    B.box('rock','#8a8f94',sx+sw/2,(DECK-0.16)/2,dy+dh/2,sw-0.04,DECK-0.16,dh-0.24,0,{ao:0.4,dust:0});   // concrete piers
    for(let t=0.5;t<sw-0.2;t+=hi?1.0:2.0)for(const s of [-1,1])B.box('metal',dark,sx+t,(DECK-0.2)/2,dy+dh/2+s*(dh/2-0.1),0.14,DECK-0.2,0.08);
    B.box('metal',slab,sx+sw/2,DECK-0.08,dy+dh/2,sw,0.16,dh,0,{ao:0,dust:0.14});
    // deck plates: seams and a tread pattern
    if(hi){for(let t=1.2;t<sw-0.3;t+=1.2)B.box('metal',dark,sx+t,DECK+0.002,dy+dh/2,0.035,0.01,dh-0.5,0,{ao:0,dust:0});for(const fz of [0.3,0.7])B.box('metal',dark,sx+sw/2,DECK+0.002,dy+dh*fz,sw-0.1,0.01,0.03,0,{ao:0,dust:0});
     for(let t=0.6;t<sw-0.3;t+=2.4)B.box('metal',slabD,sx+t,DECK+0.004,dy+dh*0.5,0.7,0.008,dh*0.3,0,{ao:0,dust:0.1});}
   }else{
    // over a tunnel: a steel grating you can see through (bars, not glass), on two heavy beams
    for(const s of [-1,1])B.box('metal',slabD,sx+sw/2,DECK-0.1,dy+dh/2+s*(dh/2-0.09),sw,0.2,0.18,0,{ao:0,dust:0.1});
    const nb=Math.max(2,Math.round(sw/(hi?0.3:0.6)));for(let i=0;i<=nb;i++)B.box('metal',i%4===0?slab:slabD,sx+sw*i/nb,DECK-0.04,dy+dh/2,i%4===0?0.07:0.04,0.07,dh-0.3,0,{ao:0,dust:0});
    const nz=Math.max(2,Math.round(dh/(hi?0.62:1.25)));for(let j=1;j<nz;j++)B.box('metal',slab,sx+sw/2,DECK-0.035,dy+dh*j/nz,sw,0.06,0.07,0,{ao:0,dust:0});
    // portals: frames with a light bar on both mouths
    for(const s of [-1,1]){const zf=dy+dh/2+s*(dh/2+0.01);for(const e of [0.07,sw-0.07])B.box('metal',dark,sx+e,(DECK-0.1)/2,zf,0.14,DECK-0.1,0.14);B.box('metal',dark,sx+sw/2,DECK-0.24,zf,sw,0.12,0.12);B.glow(CYAN,sx+sw/2,DECK-0.31,zf+s*0.065,sw-0.4,0.03,0.02);if(s>0)B.halo(sx+sw/2,DECK-0.35,zf+0.2,2.2,CYAN,0.3);}
    M.stains.push([sx+0.05,dy+0.05,sw-0.1,dh-0.1,0.92]);M.glowSpots.push([sx+sw/2,dy+dh+0.6,1.9,'60,230,215',0.42]);M.glowSpots.push([sx+sw/2,dy-0.6,1.9,'60,230,215',0.34]);
   }
  }
  // edge beams with light strips; railings wherever no ramp joins
  const ramps=BRd.ramps;
  for(const s of [-1,1]){const zf=dy+dh/2+s*(dh/2-0.04);B.box('metal',slabD,dx+dw/2,DECK+0.05,zf,dw,0.1,0.08,0,{ao:0,dust:0.1});
   const gaps=ramps.filter(r=>(s<0?r[4]<0:r[4]>0)).map(r=>[r[0],r[0]+r[2]]).sort((a,b)=>a[0]-b[0]);let a=dx;const runs=[];for(const [u,v] of gaps){if(u>a)runs.push([a,u]);a=v;}if(a<dx+dw)runs.push([a,dx+dw]);
   for(const [u,v] of runs){B.glow(CYAN,(u+v)/2,DECK+0.105,zf,v-u-0.1,0.014,0.03);
    B.box('metal',STEEL_L,(u+v)/2,DECK+0.44,zf,v-u,0.035,0.035,0,{ao:0,dust:0});if(hi)B.box('metal',STEEL_L,(u+v)/2,DECK+0.27,zf,v-u,0.025,0.025,0,{ao:0,dust:0});
    const np=Math.max(1,Math.round((v-u)/(hi?0.8:1.6)));for(let i=0;i<=np;i++)B.box('metal',STEEL,u+(v-u)*i/np,DECK+0.27,zf,0.04,0.36,0.04,0,{ao:0,dust:0});
    for(let x=u+0.8;x<v-0.4;x+=hi?2.4:4.8)B.halo(x,DECK+0.14,zf,0.9,CYAN,0.3);}
  }
  for(const e of [dx+0.04,dx+dw-0.04]){B.box('metal',slabD,e,DECK+0.05,dy+dh/2,0.08,0.1,dh,0,{ao:0,dust:0.1});B.box('metal',STEEL_L,e,DECK+0.44,dy+dh/2,0.035,0.035,dh,0,{ao:0});for(let i=0;i<=4;i++)B.box('metal',STEEL,e,DECK+0.27,dy+dh*i/4,0.04,0.36,0.04,0,{ao:0});B.glow(CYAN,e,DECK+0.105,dy+dh/2,0.03,0.014,dh-0.2);}
  // ramps: a sloped plate between two rails (the rails are the solids the rules have), light strips down the sides
  for(const [rx,ry,rw,rh,o] of ramps){const lo=o<0?ry:ry+rh,hiZ=o<0?ry+rh:ry,ang=Math.atan2(DECK,rh)*(o<0?-1:1),len=Math.hypot(DECK,rh),zc=ry+rh/2;
   B.box('metal',slab,rx+rw/2,DECK/2-0.04,zc,rw,0.1,len,0,{rx:ang,ao:0.15,dust:0.16});
   for(const sg of [-1,1])B.box('paint',HZ,rx+rw/2+sg*(rw/2-0.2),DECK/2+0.014,zc,0.07,0.012,len-0.1,0,{rx:ang,ao:0,dust:0});B.box('metal',slabD,rx+rw/2,DECK/2+0.012,zc,0.03,0.012,len-0.1,0,{rx:ang,ao:0,dust:0});
   for(const s of [-1,1]){const xr=s<0?rx-0.1:rx+rw+0.1;
    B.box('rock','#8a8f94',xr,DECK/2*0.5,zc,0.2,0.3,len,0,{rx:ang,ao:0.2,yb:0});   // sloped concrete cheek
    for(let i=1;i<=4;i++){const f=i/4,zz=lo+(hiZ-lo)*(f-0.125);B.box('rock','#80858a',xr,f*DECK*0.5-0.06,zz,0.2,Math.max(0.02,f*DECK-0.12),Math.abs(hiZ-lo)/4,0,{ao:0.3});}   // stepped concrete under the cheek
    B.box('metal',STEEL_L,xr,DECK/2+0.42,zc,0.035,0.035,len,0,{rx:ang,ao:0,dust:0});for(let i=0;i<=3;i++){const f=i/3;B.box('metal',STEEL,xr,f*DECK+0.21,lo+(hiZ-lo)*f,0.04,0.42,0.04,0,{ao:0,dust:0});}
    B.glow(CYAN,xr+(s<0?0.11:-0.11),DECK/2+0.03,zc,0.02,0.05,len-0.2,0,{rx:ang});B.halo(xr,0.12,lo,1.1,CYAN,0.35);}
   M.aoBoxes.push([rx-0.2,ry,rw+0.4,rh]);
  }
 }

 // ---------- Canyon: walls, fins, spires, the mesa ----------
 function canyonWall(B,M,wl){
  const [x,z,w,d]=wl,v=M.view,Hc=1.6,onW=x<0.01,onE=x+w>W-0.01,onN=z<0.01,onS=z+d>H-0.01,hz=M.horizon;
  B.strata([x,z,w,d],Hc,{open:{W:!onW,E:!onE,N:!onN,S:!onS},seed:x*3.1+z*1.7,inset:0.26,lean:0.2});
  B.k.anchors.walls.push([onW?x+w:x,z+d*0.3],[onW?x+w:x,z+d*0.7]);
  // loose rocks and a spire or two on top
  const n=Math.max(1,Math.round(w*d/(B.high?4.5:10)));B.yb(Hc);for(let i=0;i<n;i++){const r=0.16+hs(i,x+z)*0.3,px=x+0.35+hs(x+i,z)*Math.max(0.01,w-0.7),pz=z+0.35+hs(z,i+x)*Math.max(0.01,d-0.7);
   if(hs(i,z*1.3)>0.72)B.spire(M.theme.strata[1],px,Hc,pz,r*0.75,0.45+r*1.5,i+x);else B.rock(M.theme.strata[(i+1)%4],px,Hc,pz,r,r*0.9,i+z);}B.yb(0);
 }
 function fin(B,M,wl){   // a fin of rock: a low base and a row of thin blades that lean the same way
  const [x,z,w,d]=wl,n=B.high?5:3,cs=M.theme.strata;B.strata([x,z,w,d],0.34,{seed:x+z*2,inset:0.1,layers:1,cap:false});
  for(let i=0;i<n;i++){const f=(i+0.5)/n,hh=0.62+0.5*hs(x,i+2);B.rock(cs[i%4],x+w*(0.12+0.76*f),0.2,z+d*(0.42+0.16*hs(i,z)),w/n*0.62,hh,i+Math.floor(x),{sx:1,sz:d*0.42/(w/n*0.62),ry:0.25+0.2*hs(i,5),ao:0.3});}
 }
 function spire(B,M,x,z,r,sd){const cs=M.theme.strata;B.spire(cs[1],x,0,z,r*0.92,r*2.35,sd,{top:'#9a8f83'});B.spire(cs[1],x+r*0.42,0,z+r*0.3,r*0.42,r*1.25,sd+1);B.spire(cs[3],x-r*0.4,0,z+r*0.38,r*0.33,r*0.85,sd+2);if(B.high)B.rock(cs[2],x+r*0.1,0,z-r*0.55,r*0.34,r*0.3,sd+3);}
 function scree(B,M,x,z,r){const n=B.high?26:10;for(let i=0;i<n;i++){const a=hs(i,x)*6.283,dd=Math.sqrt(hs(z,i))*r*0.95,q=0.04+hs(i,i+z)*0.075;B.rock(M.theme.strata[i%4],x+Math.cos(a)*dd,0,z+Math.sin(a)*dd,q,q*1.2,i+x,{ao:0.5,aoH:0.1});}}
 // the mesa: the same rules as the Overpass bridge, drawn as a rock table split by a cleft; a steel grating spans the cleft
 function mesa(B,M,BRd){
  const [dx,dy,dw,dh]=BRd.deck,cs=M.theme.strata,hi=B.high;let x0=dx;
  const blocks=[];for(const [tx,tw] of BRd.tunnels){blocks.push([x0,tx-x0,true]);blocks.push([tx,tw,false]);x0=tx+tw;}blocks.push([x0,dx+dw-x0,true]);
  for(const [sx,sw,solid] of blocks){
   if(solid)B.strata([sx,dy,sw,dh],DECK,{seed:sx*2.3,inset:0.14,lean:0.1,layers:hi?4:2,open:{N:1,S:1,W:sx<=dx+0.01,E:sx+sw>=dx+dw-0.01}});
   else{   // the cleft and its grating
    for(const s of [-1,1])B.box('metal','#4d545b',sx+sw/2,DECK-0.09,dy+dh/2+s*(dh/2-0.1),sw+0.3,0.18,0.2,0,{ao:0,dust:0.2});
    const nb=Math.max(2,Math.round(sw/(hi?0.3:0.6)));for(let i=0;i<=nb;i++)B.box('metal',i%4===0?'#5d646b':'#454b52',sx+sw*i/nb,DECK-0.035,dy+dh/2,i%4===0?0.07:0.04,0.07,dh-0.3,0,{ao:0,dust:0.1});
    const nz=Math.max(2,Math.round(dh/(hi?0.62:1.25)));for(let j=1;j<nz;j++)B.box('metal','#5d646b',sx+sw/2,DECK-0.03,dy+dh*j/nz,sw,0.06,0.07,0,{ao:0,dust:0.1});
    for(const s of [-1,1]){B.glow('#ffb066',sx+sw/2,DECK-0.24,dy+dh/2+s*(dh/2-0.02),sw-0.5,0.03,0.02);B.halo(sx+sw/2,DECK-0.3,dy+dh/2+s*(dh/2+0.15),1.9,'#ffa860',0.3);}
    M.stains.push([sx+0.05,dy+0.05,sw-0.1,dh-0.1,0.9]);M.glowSpots.push([sx+sw/2,dy+dh+0.5,1.4,'255,170,100',0.28]);M.glowSpots.push([sx+sw/2,dy-0.5,1.4,'255,170,100',0.2]);
   }
  }
  for(const [rx,ry,rw,rh,o] of BRd.ramps){const lo=o<0?ry:ry+rh,hiZ=o<0?ry+rh:ry;
   B.top([[rx,o<0?0:DECK,ry],[rx+rw,o<0?0:DECK,ry],[rx+rw,o<0?DECK:0,ry+rh],[rx,o<0?DECK:0,ry+rh]]);   // the ramp surface takes the baked ground
   M.rampTracks.push([rx+rw/2,ry-0.6,rx+rw/2,ry+rh+0.6]);
   for(const s of [-1,1]){const xr=s<0?rx-0.1:rx+rw+0.1;for(let t=0.2;t<rh;t+=hi?0.45:0.9){const zz=ry+t,f=Math.abs(zz-lo)/rh,r=0.15+hs(t,xr)*0.07;B.rock(cs[(Math.floor(t*3)+1)%4],xr,0,zz,r,DECK*f+0.2+r,Math.floor(t*7+xr),{ao:0.35});}}
   M.aoBoxes.push([rx-0.2,ry,rw+0.4,rh]);
  }
 }

 // ---------- Underground Bunker ----------
 const BW='#565d64',BW2='#41474d',BRIB='#7b848c',BCAP='#8f979e';
 function bulk(B,wl){
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,Hb=1.35,hi=B.high,long=w>=d;
  B.box('paint',BW,X,Hb/2,Z,w-0.04,Hb,d-0.04,0,{ao:0.4});B.box('metal',BCAP,X,Hb+0.03,Z,w,0.07,d,0,{ao:0});B.box('metal',BW2,X,Hb+0.075,Z,w-0.3,0.03,d-0.3,0,{ao:0});
  const L=long?w:d,n=Math.max(1,Math.round(L/(hi?0.9:1.8)));
  for(let i=0;i<=n;i++){const t=-L/2+L*i/n,tt=Math.max(-L/2+0.05,Math.min(L/2-0.05,t));for(const s of [-1,1])B.box('metal',BRIB,long?X+tt:X+s*(w/2-0.01),Hb/2,long?Z+s*(d/2-0.01):Z+tt,long?0.09:0.05,Hb,long?0.05:0.09,0,{ao:0.3});}
  if(long){if(z+d<H-0.01)hazard(B,x+0.05,z+d,x+w-0.05,z+d,0.13,0.15,[0,1]);
   for(let i=0;i<n;i++){const t=x+L*(i+0.5)/n;if(z+d<H-0.01){B.box('paint',BW2,t,0.72,z+d-0.012,L/n*0.7,0.5,0.02,0,{ao:0});B.glow('#ffe0a8',t,1.12,z+d+0.006,Math.min(0.7,L/n*0.55),0.045,0.02);B.halo(t,1.05,z+d+0.25,1.5,'#ffd590',0.3);}}}
  else{for(let i=0;i<n;i++){const t=z+L*(i+0.5)/n;for(const s of [-1,1]){if((s<0&&x<0.01)||(s>0&&x+w>W-0.01))continue;B.glow('#ffe0a8',X+s*(w/2+0.006),1.12,t,0.02,0.045,Math.min(0.7,L/n*0.55));}
    if(hi)B.box('metal',BW2,X,Hb+0.1,t,w*0.5,0.03,L/n*0.6,0,{ao:0});}
   if(hi){B.cyl('metal','#a9793a',X-w*0.18,Hb+0.13,Z,0.06,L-0.3,8,{rx:PI/2,ao:0});B.cyl('metal',STEEL,X+w*0.18,Hb+0.13,Z,0.05,L-0.3,8,{rx:PI/2,ao:0});}}
 }
 function door(B,wl){   // blast door: two posts, a slab with chevrons, a top beam, status lamps
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,Hd=1.45,hi=B.high;
  for(const u of [x+0.16,x+w-0.16])B.box('metal','#8b959e',u,(Hd+0.14)/2,Z,0.32,Hd+0.14,d,0,{ao:0.35});
  B.box('paint','#59646e',X,Hd/2,Z,w-0.6,Hd,d*0.6,0,{ao:0.4});B.box('metal','#3f4850',X,Hd+0.1,Z,w,0.16,d,0,{ao:0});
  const n=Math.max(4,Math.round((w-0.7)/(hi?0.26:0.5)));
  for(const s of [-1,1]){const zf=Z+s*(d*0.3+0.008);B.box('paint',HZK,X,0.72,zf,w-0.7,0.92,0.012,0,{ao:0});for(let i=0;i<n;i+=2)B.box('paint',HZ,x+0.35+(i+0.5)*(w-0.7)/n,0.72,zf+s*0.007,(w-0.7)/n*0.9,0.92,0.012,0,{rz:s*0.45,ao:0});
   B.box('metal','#3f4850',X,1.25,zf+s*0.012,w-0.66,0.1,0.03,0,{ao:0});B.box('metal','#3f4850',X,0.2,zf+s*0.012,w-0.66,0.12,0.03,0,{ao:0});
   B.glow('#ff5a46',x+0.16,1.3,Z+s*(d/2+0.012),0.13,0.13,0.02);B.glow('#5aff96',x+w-0.16,1.3,Z+s*(d/2+0.012),0.13,0.13,0.02);
   if(s>0){B.halo(x+0.16,1.3,Z+d/2+0.1,0.9,'#ff5040',0.5,2.6);B.halo(x+w-0.16,1.3,Z+d/2+0.1,0.9,'#50ff90',0.4);B.glow('#ffe0a8',X,1.36,zf+0.02,w-0.8,0.04,0.02);}}
 }
 function pillar(B,wl){
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,Hp=2.1,hi=B.high;
  B.prism('paint','#3d4650',X,0,Z,oct(w/2,d/2,0.16),0.16,{bevel:0.03});
  B.prism('paint','#5a6570',X,0.14,Z,oct(w/2-0.07,d/2-0.07,0.2),Hp-0.34,{bevel:0.03,ao:0.4,aoH:0.8});
  B.prism('metal',BCAP,X,Hp-0.22,Z,oct(w/2,d/2,0.18),0.22,{bevel:0.04,ao:0});
  for(const a of [-1,1])for(const b of [-1,1])B.box('metal',BRIB,X+a*(w/2-0.2),Hp/2,Z+b*(d/2-0.2),0.07,Hp-0.36,0.07,PI/4,{ao:0.3});
  hazard(B,x+0.2,z+d-0.07,x+w-0.2,z+d-0.07,0.42,0.2,[0,1]);
  B.glow('#ffe0a8',X,1.55,z+d-0.06,w*0.42,0.05,0.02);B.halo(X,1.5,z+d+0.2,1.5,'#ffd590',0.32);
  if(hi)for(const s of [-1,1])B.glow(CYAN,X+s*(w/2-0.065),1.0,Z,0.02,0.5,0.06);
 }
 function reactor(B,x,z,r,idx){
  const hi=B.high,seg=hi?18:10;
  B.cyl('metal','#39424b',x,0.09,z,r*1.08,0.18,seg);B.cyl('metal','#6f7b87',x,0.4,z,r*0.84,0.46,seg,{ao:0.3});
  B.cyl('glow','#3fd6ff',x,0.52,z,r*0.87,0.13,seg,{open:true});B.cyl('metal','#8a96a1',x,0.76,z,r*0.92,0.14,seg,{ao:0});
  const nf=hi?10:6;for(let i=0;i<nf;i++){const a=i/nf*PI*2;B.box('metal','#9aa5af',x+Math.cos(a)*r*0.94,0.42,z+Math.sin(a)*r*0.94,0.05,0.62,0.12,-a,{ao:0.2});}
  B.cyl('glow','#9af1ff',x,0.845,z,r*0.6,0.03,seg);B.cyl('metal','#39424b',x,0.87,z,r*0.22,0.1,hi?10:6,{ao:0});
  B.k.spin.push({p:[x,0.9,z],axis:'y',spd:idx%2?-2.4:2.4,build:b=>{for(let i=0;i<(hi?6:4);i++){const a=i/(hi?6:4)*PI*2;b.box('metal','#c4ccd3',Math.cos(a)*r*0.4,0,Math.sin(a)*r*0.4,r*0.56,0.03,0.11,-a,{rx:0.3,ao:0,dust:0});}b.cyl('metal','#59636d',0,0.03,0,r*0.16,0.08,8,{ao:0});}});
  B.halo(x,0.6,z,r*4.6,'#49dcff',0.5,1.9);B.halo(x,0.95,z,r*2.2,'#b8f6ff',0.35,3.1);
 }
 function turbine(B,wl,M){
  const [x,z,w,d]=wl,X=x+w/2,r=Math.min(w*0.47,d*0.235),zs=[z+d*0.26,z+d*0.74],hi=B.high;
  B.box('metal','#2f373f',X,0.05,z+d/2,w,0.1,d,0,{ao:0.2});
  zs.forEach((zz,i)=>reactor(B,X,zz,r,i+(x>10?1:0)));
  const wx=x<10?x+0.03:x+w-0.03;B.cyl('metal','#a9793a',wx,0.55,z+d/2,0.07,d*0.9,8,{rx:PI/2,ao:0});if(hi)B.cyl('metal',STEEL,wx,0.3,z+d/2,0.05,d*0.9,8,{rx:PI/2,ao:0});
  B.k.anims.push({type:'arc',a:[X,0.62,zs[0]+r*0.86],b:[X,0.62,zs[1]-r*0.86],c:'#aef3ff',w:0.05});
  M.glowSpots.push([X,z+d/2,3.6,'80,220,255',0.7]);B.k.anchors.vents.push([X,z+d/2,1.2,0.9]);B.k.anchors.sparks.push([X,0.7,z+d/2]);
 }
 function lift(B,wl,M){
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,north=z<0.01,hi=B.high,face=north?z+d:z;
  B.box('metal','#4a535c',X,0.16,Z,w,0.32,d,0,{ao:0.3});B.box('metal','#39424a',X,0.335,Z,w-0.36,0.03,d-0.3,0,{ao:0});
  const nx=hi?16:8;for(let i=0;i<=nx;i++)B.box('metal','#7a858f',x+0.24+(w-0.48)*i/nx,0.36,Z,0.035,0.03,d-0.36,0,{ao:0});for(let j=0;j<=3;j++)B.box('metal','#7a858f',X,0.365,z+0.2+(d-0.4)*j/3,w-0.44,0.03,0.035,0,{ao:0});
  hazard(B,x+0.02,face,x+w-0.02,face,0.19,0.22,[0,north?1:-1]);
  for(const s of [-1,1]){hazard(B,X+s*(w/2-0.1),z+0.04,X+s*(w/2-0.1),z+d-0.04,0.345,0.012,[0,0]);B.box('paint',HZ,X+s*(w/2-0.1),0.34,Z,0.16,0.02,d-0.06,0,{ao:0});}
  for(const s of [-1,1]){B.box('metal',HZ,X+s*(w/2-0.12),0.58,face+(north?-0.1:0.1),0.07,0.5,0.07,0,{ao:0});B.glow('#ffb347',X+s*(w/2-0.12),0.86,face+(north?-0.1:0.1),0.09,0.07,0.09);B.halo(X+s*(w/2-0.12),0.86,face,0.9,'#ffa840',0.5,2.0);}
  if(north){   // the shaft frame stands outside the arena, behind the platform
   for(const s of [-1,1])B.box('metal','#59636d',X+s*(w/2-0.2),1.5,-0.5,0.3,3.0,0.3,0,{ao:0.3});B.box('metal','#4a535c',X,2.95,-0.5,w,0.3,0.36,0,{ao:0});
   B.box('paint','#2c333a',X,1.45,-0.72,w-0.7,2.6,0.08,0,{ao:0.3});for(let i=0;i<5;i++)B.box('paint',i%2?HZ:HZK,X,0.62+i*0.5,-0.62,w-0.8,0.07,0.04,0,{ao:0});
   B.glow('#ffb347',X,2.72,-0.3,w-1,0.05,0.03);B.halo(X,2.6,-0.2,3.2,'#ffa840',0.3);}
  M.glowSpots.push([X,north?z+d+0.6:z-0.6,2.6,'255,180,90',0.22]);B.k.anchors.drops.push([X,Z]);
 }
 function consoleP(B,wl,M){
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,s=x<W/2?1:-1,hi=B.high;
  B.box('paint','#39424b',X,0.36,Z,w-0.04,0.72,d-0.04,0,{ao:0.4});B.box('metal','#5d6872',X,0.74,Z,w,0.05,d,0,{ao:0});
  const th=s*0.62,nx=-Math.sin(th),ny=Math.cos(th),hx=X-s*w*0.16,hy=0.93;   // a sloped screen bank: it faces up and into the hall, so the camera sees it
  B.box('paint','#2a3138',hx,hy,Z,w*0.62,0.1,d*0.9,0,{rz:th,ao:0});B.box('paint','#2a3138',X-s*(w/2-0.1),0.9,Z,0.16,0.36,d*0.9,0,{ao:0});
  for(const [f,c] of [[-0.29,'#58dcff'],[0.0,'#ffc65c'],[0.29,'#58dcff']])B.glow(c,hx+nx*0.056,hy+ny*0.056,Z+f*d,w*0.5,0.012,d*0.24,0,{rz:th});
  B.box('paint','#2a3138',X+s*(w/2-0.2),0.79,Z,0.34,0.05,d*0.8,0,{rz:s*-0.12,ao:0});if(hi)for(let i=0;i<6;i++)B.glow(i%3?'#5aff96':'#ff5a46',X+s*(w/2-0.2),0.83,z+0.25+i*(d-0.5)/5,0.05,0.02,0.05);
  B.halo(X,1.05,Z,2.3,'#58dcff',0.4,0.9);M.glowSpots.push([X+s*1.0,Z,1.7,'90,215,255',0.3]);
 }
 function fuelTank(B,x,z,r,M){
  const hi=B.high,seg=hi?20:10,Ht=1.45,R=r*0.9;
  B.cyl('metal','#3b444c',x,0.08,z,r*0.98,0.16,seg);B.cyl('paint','#d7dbde',x,0.16+Ht/2,z,R,Ht,seg,{ao:0.35,aoH:0.6});
  B.sph('paint','#e2e5e8',x,0.16+Ht,z,R,R*0.4,seg,true,{ao:0});B.cyl('metal',STEEL,x,0.16+Ht+R*0.4,z,R*0.22,0.08,hi?10:6,{ao:0});
  for(const y of [0.5,1.25])B.tor('metal','#59636c',x,y,z,R*1.01,0.035,seg,{ts:4,ao:0});
  B.cyl('paint',HZ,x,0.86,z,R*1.012,0.2,seg,{open:true,ao:0});if(hi)for(let i=0;i<seg;i+=2){const a=i/seg*PI*2;B.box('paint',HZK,x+Math.cos(a)*R*1.016,0.86,z+Math.sin(a)*R*1.016,0.012,0.2,R*0.3,-a,{ao:0});}
  const a=Math.atan2(16-z,10-x);B.cyl('metal',STEEL,x+Math.cos(a)*(R+0.07),0.75,z+Math.sin(a)*(R+0.07),0.045,1.3,6,{ao:0});
  B.glow('#ff8a3a',x+Math.cos(a)*R*1.02,1.4,z+Math.sin(a)*R*1.02,0.1,0.1,0.1);B.halo(x+Math.cos(a)*R,1.4,z+Math.sin(a)*R,1.0,'#ff8030',0.5,1.4);
 }
 function coolant(B,x,z,r,M){
  const seg=B.high?32:16;B.tor('metal','#333d46',x,0.03,z,r*0.98,0.06,seg,{ts:5,ao:0});B.cyl('glow','#1fa9c9',x,0.022,z,r*0.93,0.012,seg);B.cyl('glow','#5fe6ff',x-r*0.1,0.03,z-r*0.08,r*0.62,0.012,seg);B.cyl('glow','#c6f8ff',x-r*0.2,0.036,z-r*0.16,r*0.26,0.012,seg);
  B.halo(x,0.2,z,r*4.2,'#3fdcff',0.4,1.1);M.glowSpots.push([x,z,r*2.7,'70,220,255',0.6]);B.k.anchors.vents.push([x,z,r,0.1]);
  B.k.anims.push({type:'ripple',p:[x,0.045,z],r:r*0.9,c:'#d8fbff'});
 }
 // the bunker's shell: tall walls north, east and west, a low one on the camera's side; lunar surface beyond
 function bunkerShell(B,M){
  const v=M.view,hi=B.high,Hw=2.0,t=1.1,wall='#4b5259',cap='#7b848c';
  B.box('paint',wall,W/2,Hw/2,-t/2,W+2*t,Hw,t,0,{ao:0.4,aoH:0.9});B.box('metal',cap,W/2,Hw+0.03,-t/2,W+2*t,0.08,t+0.08,0,{ao:0});
  for(const s of [-1,1]){const xo=s<0?-t/2:W+t/2;B.box('paint',wall,xo,Hw/2,H/2+0.3,t,Hw,H+0.6,0,{ao:0.4,aoH:0.9});B.box('metal',cap,xo,Hw+0.03,H/2+0.3,t+0.08,0.08,H+0.6,0,{ao:0});
   B.cyl('metal','#a9793a',xo-s*0.2,Hw+0.14,H/2,0.07,H,8,{rx:PI/2,ao:0});B.cyl('metal',STEEL,xo+s*0.12,Hw+0.13,H/2,0.055,H,8,{rx:PI/2,ao:0});
   for(let z=2;z<H;z+=hi?4:8){B.box('metal','#59636d',xo-s*(t/2+0.06),Hw-0.12,z,0.3,0.08,0.5,0,{ao:0});B.glow('#ffe0a8',xo-s*(t/2+0.1),Hw-0.17,z,0.2,0.03,0.42);B.halo(xo-s*(t/2+0.1),Hw-0.25,z,2.0,'#ffd590',0.32);M.glowSpots.push([s<0?1.4:W-1.4,z,3.0,'255,214,150',0.34]);
    if(hi)B.box('metal','#59636d',xo,Hw+0.09,z+2,t*0.7,0.05,0.5,0,{ao:0});}}
  B.box('rock','#5b6068',W/2,0.17,H+t/2,W+2*t,0.34,t,0,{ao:0.2});hazard(B,-0.2,H+0.02,W+0.2,H+0.02,0.34,0.012,[0,0]);B.glow('#5aa8ff',W/2,0.36,H+0.2,W-1,0.02,0.05);
  // the north wall is the back of the stage: ribs, panels, pipes, work lamps
  for(let x=0;x<=W;x+=hi?2:4){B.box('metal',BRIB,x,Hw/2,0.03,0.16,Hw,0.07,0,{ao:0.3});}
  for(let x=1;x<W;x+=2){if(x>6.5&&x<13.5)continue;B.box('paint','#39424b',x,0.95,0.012,1.5,1.2,0.03,0,{ao:0.2});if(hi)B.box('paint','#525e69',x,0.95,0.03,1.1,0.8,0.02,0,{ao:0});}
  B.cyl('metal','#a9793a',W/2,1.72,0.1,0.07,W,8,{rz:PI/2,ao:0});B.cyl('metal',STEEL,W/2,1.55,0.08,0.05,W,8,{rz:PI/2,ao:0});
  for(const x of [3,17]){B.box('metal','#59636d',x,1.62,0.15,0.34,0.14,0.3,0,{ao:0});B.glow('#ffe9c0',x,1.54,0.18,0.24,0.03,0.22);B.halo(x,1.45,0.4,2.6,'#ffdca0',0.4);M.glowSpots.push([x,1.9,3.6,'255,220,160',0.42]);}
  hazard(B,0,0.02,7,0.02,0.12,0.14,[0,1]);hazard(B,13,0.02,W,0.02,0.12,0.14,[0,1]);
  for(let x=0;x<=W;x+=4){if(x>6.5&&x<13.5)continue;B.box('metal','#8f979e',x,Hw/2,0.045,0.5,Hw,0.09,0,{ao:0.3});B.box('metal',BW2,x,Hw-0.2,0.07,0.56,0.12,0.14,0,{ao:0});}
  for(const x of [6.9,13.1]){B.box('paint',HZ,x,Hw/2,0.05,0.22,Hw,0.1,0,{ao:0.2});for(let y=0.2;y<Hw;y+=0.4)B.box('paint',HZK,x,y,0.103,0.22,0.16,0.012,0,{rz:0.5,ao:0});}
  // the reactor hall's floor ring: a flush strip of light and four slow pulses
  B.tor('glow','#49dcff',10,0.016,16,2.55,0.02,hi?56:28,{ts:4});B.tor('glow','#2aa9cc',10,0.014,16,1.2,0.014,hi?40:20,{ts:4});for(let i=0;i<4;i++){const a=i*PI/2+PI/4;B.halo(10+Math.cos(a)*2.55,0.1,16+Math.sin(a)*2.55,1.5,'#49dcff',0.5,1.3+i*0.2);}
  // ground level outside the shell
  B.topRect(v.x0,M.horizon,v.x1,-t,Hw);B.topRect(v.x0,-t,-t,H+t,Hw);B.topRect(W+t,-t,v.x1,H+t,Hw);
  B.box('rock','#5a5a5e',(v.x0-t)/2,Hw/2-0.01,H+t,-t-v.x0,Hw-0.02,0.04,0,{ao:0.2});B.box('rock','#5a5a5e',(W+t+v.x1)/2,Hw/2-0.01,H+t,v.x1-W-t,Hw-0.02,0.04,0,{ao:0.2});
  B.topRect(v.x0,H+t,v.x1,v.z1,0.3);
  // surface clutter round the pit: vents, a hatch, antenna, cable runs
  if(hi||v.x0<-4){B.yb(Hw);for(const [x,z] of [[-3.2,5],[-4.5,19],[W+3.4,9],[W+4.8,24],[5,-3],[15,-3.4]]){if(x<v.x0+0.5||x>v.x1-0.5||z<M.horizon+1)continue;B.box('metal','#59636d',x,Hw+0.2,z,0.9,0.4,0.9,0.3,{ao:0.3});B.cyl('metal','#39424a',x,Hw+0.45,z,0.3,0.1,10,{ao:0});B.k.anchors.vents.push([x,z,0.4,Hw+0.5]);}B.yb(0);}
 }

 // ---------- crates (drawn per crate by the renderer): a unit crate, 1 x 1 x 1 ----------
 function crate(B,style){
  if(style==='steel'){const b='#b4babf',d='#59626a';B.box('metal',b,0,0.5,0,0.94,0.96,0.94,0,{ao:0.3,aoH:0.5});for(const y of [0.2,0.5,0.8]){B.box('metal',d,0,y,0.475,0.9,0.07,0.02,0,{ao:0});B.box('metal',d,0,y,-0.475,0.9,0.07,0.02,0,{ao:0});B.box('metal',d,0.475,y,0,0.02,0.07,0.9,0,{ao:0});B.box('metal',d,-0.475,y,0,0.02,0.07,0.9,0,{ao:0});}
   for(const a of [-1,1])for(const c of [-1,1])B.box('metal',d,a*0.455,0.5,c*0.455,0.1,1,0.1,0,{ao:0.2});B.box('metal','#c3c9ce',0,1.0,0,0.8,0.03,0.8,0,{ao:0});for(const a of [-0.24,0,0.24])B.box('metal',d,a,1.02,0,0.05,0.012,0.76,0,{ao:0});for(const a of [-0.25,0.25])B.box('metal',STEEL_D,a,0.62,0.49,0.1,0.14,0.03,0,{ao:0});return;}
  const b='#7d6a47',d='#4f422c',l='#927d55';   // a tan hard case: reinforced edges, a lid seam, two latches
  B.box('paint',b,0,0.5,0,0.92,0.96,0.92,0,{ao:0.3,aoH:0.5});B.box('paint',l,0,1.0,0,0.74,0.03,0.74,0,{ao:0});
  for(const a of [-1,1])for(const c of [-1,1])B.box('paint',d,a*0.44,0.5,c*0.44,0.14,1.0,0.14,0,{ao:0.25});
  for(const y of [0.06,0.94])for(const a of [-1,1]){B.box('paint',d,0,y,a*0.455,0.9,0.12,0.09,0,{ao:0});B.box('paint',d,a*0.455,y,0,0.09,0.12,0.9,0,{ao:0});}
  for(const a of [-1,1]){B.box('paint','#584a35',0,0.7,a*0.465,0.92,0.03,0.012,0,{ao:0});B.box('paint','#584a35',a*0.465,0.7,0,0.012,0.03,0.92,0,{ao:0});}
  for(const a of [-0.22,0.22])B.box('metal',STEEL_L,a,0.68,0.475,0.1,0.16,0.03,0,{ao:0});
 }

 // ---------- ground paint (2D canvas, world units): tracks in red, stains in blue, colour decals, glow pools ----------
 function track(lay,pts,o){   // a pair of tread prints along a smooth path
  o=o||{};const c=lay.paint,wd=o.w||0.62,tw=o.tw||0.17,a=o.a===undefined?0.85:o.a;
  const path=()=>{c.beginPath();c.moveTo(pts[0][0],pts[0][1]);if(o.curve)for(let i=1;i+2<pts.length;i+=3)c.bezierCurveTo(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],pts[i+2][0],pts[i+2][1]);else{for(let i=1;i<pts.length-1;i++)c.quadraticCurveTo(pts[i][0],pts[i][1],(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2);c.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);}};
  c.save();c.lineCap='butt';c.lineJoin='round';c.globalCompositeOperation='lighter';
  c.strokeStyle='rgba(255,0,0,'+a+')';c.lineWidth=wd;c.setLineDash([0.07,0.06]);path();c.stroke();
  c.globalCompositeOperation='destination-out';c.setLineDash([]);c.strokeStyle='rgba(0,0,0,1)';c.lineWidth=wd-2*tw;path();c.stroke();c.restore();
 }
 function stain(lay,x,z,rx,rz,a){const c=lay.paint;c.save();c.globalCompositeOperation='lighter';c.translate(x,z);c.scale(rx,rz);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(0,0,255,'+a+')');g.addColorStop(0.6,'rgba(0,0,255,'+a*0.6+')');g.addColorStop(1,'rgba(0,0,255,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,PI*2);c.fill();c.restore();}
 function pool(lay,x,z,r,rgb,a){const c=lay.glow,g=c.createRadialGradient(x,z,0,x,z,r);g.addColorStop(0,'rgba('+rgb+','+a+')');g.addColorStop(0.5,'rgba('+rgb+','+a*0.4+')');g.addColorStop(1,'rgba('+rgb+',0)');c.fillStyle=g;c.beginPath();c.arc(x,z,r,0,PI*2);c.fill();}
 function paint(lay,M){
  const id=M.id,d=lay.decal,sd=M.theme.seed;
  for(const s of M.stains){lay.paint.save();lay.paint.globalCompositeOperation='lighter';lay.paint.fillStyle='rgba(0,0,255,'+s[4]+')';lay.paint.fillRect(s[0],s[1],s[2],s[3]);lay.paint.restore();}
  for(const g of M.glowSpots)pool(lay,g[0],g[1],g[2],g[3],g[4]);
  for(const t of M.rampTracks)track(lay,[[t[0],t[1]],[t[0],(t[1]+t[3])/2],[t[2],t[3]]],{a:0.8});
  if(id==='overpass'){   // the reference: sweeping loops of tread marks round both halves, straight runs through the tunnels
   for(const zc of [7.2,24.8])for(const [rx,rz,a] of [[6.6,4.2,0.9],[5.2,3.2,0.7],[3.6,2.3,0.6]]){const k=0.5523,x=10+(hs(rx,zc)-0.5)*0.8;track(lay,[[x-rx,zc],[x-rx,zc-rz*k],[x-rx*k,zc-rz],[x,zc-rz],[x+rx*k,zc-rz],[x+rx,zc-rz*k],[x+rx,zc],[x+rx,zc+rz*k],[x+rx*k,zc+rz],[x,zc+rz],[x-rx*k,zc+rz],[x-rx,zc+rz*k],[x-rx,zc]],{curve:1,a});}
   for(const x of [7,13]){track(lay,[[x,3],[x+0.3,9],[x-0.2,13],[x,13.5],[x,18.5],[x+0.2,22],[x-0.3,26],[x,29.5]],{a:0.9});}
   for(const x of [4.25,15.75]){track(lay,[[x,3.5],[x,10.5]],{a:0.7});track(lay,[[x,21.5],[x,28.5]],{a:0.7});}
  }else if(id==='longshot'){
   for(const [x,a] of [[6.2,0.9],[9.2,0.6],[13.6,0.85],[11.1,0.5]])track(lay,[[x,-1],[x+(hs(x,1)-0.5),5],[x+(hs(x,2)-0.5)*1.4,9.2],[x<8?5.3:x>12?14.7:x,12.5],[x<8?5.3:x>12?14.7:x,19.5],[x+(hs(x,3)-0.5)*1.4,23],[x+(hs(x,4)-0.5),28],[x,33]],{a});
  }else if(id==='classic'){
   track(lay,[[6,29.5],[6.4,25.5],[9.6,24.4],[10,19.4],[10.5,18.2],[13.4,18],[13.6,15]],{a:0.8});track(lay,[[14,2.5],[13.6,6.5],[10.4,7.6],[10,12.6],[9.5,13.8],[6.6,14],[6.4,17]],{a:0.8});
   track(lay,[[1.4,3],[1.6,8],[1.3,13],[1.5,20],[1.2,27]],{a:0.55});track(lay,[[18.6,29],[18.4,24],[18.7,19],[18.5,12],[18.8,5]],{a:0.55});
   track(lay,[[3,29.6],[8,30.2],[13,29.8],[17,30.3]],{a:0.5});track(lay,[[17,2.4],[12,1.8],[7,2.2],[3,1.7]],{a:0.5});
  }else if(id==='craters'){
   track(lay,[[2,29],[4.6,25.8],[8.2,25.2],[11.6,26.2],[15.6,25],[18,28]],{a:0.7});track(lay,[[18,3],[15.4,6.2],[11.8,6.8],[8.4,5.8],[4.4,7],[2,4]],{a:0.7});
   track(lay,[[1.6,9],[2.4,13],[1.4,16],[2.2,20.5],[1.6,24]],{a:0.5});track(lay,[[18.4,23],[17.6,19],[18.6,16],[17.8,11.5],[18.4,8]],{a:0.5});
  }else if(id==='canyon'){
   track(lay,[[10,30.5],[9.2,26],[7.6,22.5],[7.6,21.5]],{a:0.75});track(lay,[[10,1.5],[10.8,6],[12.4,9.5],[12.4,10.5]],{a:0.75});
   track(lay,[[14.5,29],[16.2,24],[16.6,18],[16.9,13]],{a:0.55});track(lay,[[5.5,3],[3.8,8],[3.4,14],[3.1,19]],{a:0.55});track(lay,[[10,21],[10,11]],{a:0.8});
  }else if(id==='bunker'){
   // painted lanes, spawn boxes and the reactor ring, worn by tracks
   d.lineWidth=0.08;d.strokeStyle='rgba(222,176,58,0.4)';d.setLineDash([0.5,0.35]);for(const x of [5.4,14.6]){d.beginPath();d.moveTo(x,1.8);d.lineTo(x,8.2);d.moveTo(x,23.8);d.lineTo(x,30.2);d.stroke();}
   d.setLineDash([]);d.strokeStyle='rgba(205,214,222,0.5)';d.lineWidth=0.06;d.beginPath();d.ellipse(10,16,2.55,2.55,0,0,PI*2);d.stroke();d.beginPath();d.ellipse(10,16,1.2,1.2,0,0,PI*2);d.stroke();
   for(let i=0;i<12;i++){const a=i/12*PI*2;d.beginPath();d.moveTo(10+Math.cos(a)*1.2,16+Math.sin(a)*1.2);d.lineTo(10+Math.cos(a)*2.55,16+Math.sin(a)*2.55);d.stroke();}
   const br=(x0,z0,x1,z1,cc)=>{d.strokeStyle=cc;d.lineWidth=0.08;for(const [cx,cz,sx,sz] of [[x0,z0,1,1],[x1,z0,-1,1],[x1,z1,-1,-1],[x0,z1,1,-1]]){d.beginPath();d.moveTo(cx+sx*0.9,cz);d.lineTo(cx,cz);d.lineTo(cx,cz+sz*0.9);d.stroke();}};br(5.6,2.0,14.4,5.2,'rgba(255,90,100,0.38)');br(5.6,26.8,14.4,30.0,'rgba(90,160,255,0.38)');
   d.fillStyle='rgba(222,176,58,0.8)';for(const [x0,z0] of [[8.3,9.6],[8.3,22.25]])for(let i=0;i<9;i++){d.save();d.translate(x0+i*0.4,z0);d.transform(1,0,-0.6,1,0,0);d.fillRect(0,0,0.2,0.16);d.restore();}
   pool(lay,10,16,5.6,'90,215,255',0.5);pool(lay,10,16,2.2,'150,235,255',0.4);pool(lay,10,3.4,3.6,'255,120,110',0.14);pool(lay,10,28.6,3.6,'110,170,255',0.14);
   for(const [x,z,a] of [[10,5.5,0.5],[10,26.5,0.5],[2.2,10.5,0.4],[17.8,21.5,0.4],[7,16,0.35],[13,16,0.35]])stain(lay,x,z,2.2,1.4,a);
   for(const x of [8.6,11.4]){track(lay,[[x,30],[x+0.2,25],[x-0.1,20.5]],{a:0.5});track(lay,[[x,2],[x-0.2,7],[x+0.1,11.5]],{a:0.5});}
   track(lay,[[1.9,10],[2.1,13.5],[1.7,18.5],[1.9,22]],{a:0.45});track(lay,[[18.1,22],[17.9,18.5],[18.3,13.5],[18.1,10]],{a:0.45});
  }
  if(id!=='bunker'){   // spawn ends: a soft wash of each team's colour on the regolith
   pool(lay,W/2,1.6,5.5,'255,90,100',0.10);pool(lay,W/2,H-1.6,5.5,'90,160,255',0.10);
  }
 }

 // ---------- build one map ----------
 function build(id,B,M){
  const MP=M.map,th=M.theme,v=M.view,hi=B.high;
  M.horizon=th.horizon?Math.max(v.z0,-5.4):v.z0;M.stains=[];M.glowSpots=[];M.rampTracks=[];
  v.z0=Math.max(v.z0,M.horizon);   // the ground ends at the ridge; beyond it is sky
  th.paint=paint;
  const outdoor=id!=='bunker';
  for(const wl of MP.walls||[]){const [x,z,w,d,st]=wl,sd=x*7.3+z*3.1;
   if(st==='ctr')containers(B,x,z,w,d,sd);else if(st==='cmd')cmd(B,x,z,w,d,M);else if(st==='pylon')pylon(B,x,z,w,d,M);else if(st==='lander')lander(B,x,z,w,d,sd);
   else if(st==='cliff'){/* built together below */}else if(st==='canyon')canyonWall(B,M,wl);else if(st==='fin')fin(B,M,wl);
   else if(st==='bulk')bulk(B,wl);else if(st==='door')door(B,wl);else if(st==='pillar')pillar(B,wl);else if(st==='turbine')turbine(B,wl,M);else if(st==='lift')lift(B,wl,M);else if(st==='console')consoleP(B,wl,M);
   else B.box('paint','#5d6770',x+w/2,0.5,z+d/2,w,1,d);}
  if(id==='longshot')cliffs(B,M);
  for(const [x,z,r,st] of MP.rocks||[]){const sd=x*5.1+z*2.3;
   if(st==='dome')dome(B,x,z,r,M);else if(st==='spire')spire(B,M,x,z,r,sd);else if(st==='tank')fuelTank(B,x,z,r,M);else if(st==='boulder')boulder(B,x,z,r,sd,th.strata[1]);else boulder(B,x,z,r,sd);}
  for(const [x,z,r,st] of MP.craters||[]){if(st==='scree')scree(B,M,x,z,r);else if(st==='coolant')coolant(B,x,z,r,M);else{if(hi)pebbleRing(B,x,z,r*1.02,r*1.28,Math.round(r*9),x*3+z);B.k.anchors.vents.push([x,z,r,0.05]);
    if(id==='craters'&&r>2){B.cyl('metal',STEEL_D,x,0.012,z,0.2,0.024,12,{ao:0,noShadow:1});B.cyl('glow','#7df0ff',x,0.03,z,0.11,0.012,10);B.halo(x,0.12,z,2.4,'#39d8e8',0.6,1.5);B.halo(x,0.1,z,0.8,'#d8fbff',0.8,1.5);M.glowSpots.push([x,z,2.1,'57,216,232',0.5]);}}}
  if(MP.bridge){if(MP.bridge.look==='mesa')mesa(B,M,MP.bridge);else steelBridge(B,M,MP.bridge);B.k.anchors.rail=[[MP.bridge.deck[0],DECK,MP.bridge.deck[1]+MP.bridge.deck[3]/2],[MP.bridge.deck[0]+MP.bridge.deck[2],DECK,MP.bridge.deck[1]+MP.bridge.deck[3]/2]];}
  for(const c of MP.crates||[])M.aoBoxes.push([c[0],c[1],c[2],c[3]]);
  // the edge of the arena and the world beyond it
  if(id==='bunker')bunkerShell(B,M);
  else if(id==='canyon'){
   const Hc=1.6;border(B,M,{glow:th.accent});
   B.topRect(v.x0,M.horizon,0,H,Hc);B.topRect(W,M.horizon,v.x1,H,Hc);B.topRect(v.x0,H,0,v.z1,0.32);B.topRect(W,H,v.x1,v.z1,0.32);
   for(const s of [0,1]){const xo=s?W:v.x0,wo=s?v.x1-W:-v.x0;if(wo>0.05)B.box('rock',th.strata[0],xo+wo/2,Hc/2-0.01,H+0.02,wo,Hc-0.02,0.04,0,{ao:0.3});}
   // the rille runs on to the north between its walls
   B.strata([0,M.horizon,2,-M.horizon],Hc,{open:{E:1},seed:71,inset:0.3,dim:0.8});B.strata([18.5,M.horizon,1.5,-M.horizon],Hc,{open:{W:1},seed:73,inset:0.3,dim:0.8});
   for(let i=0;i<(hi?7:3);i++){const x=3+hs(i,7)*14,z=-0.9-hs(i,3)*3.2,r=0.3+hs(i,5)*0.5;B.rock(th.strata[i%4],x,0,z,r,r*1.2,i+90,{dim:0.8});}
   const n=hi?16:6;for(let i=0;i<n;i++){const s=i%2,x=s?W+0.8+hs(i,2)*(v.x1-W-1):v.x0+0.5+hs(i,2)*(-v.x0-1.3),z=M.horizon+1+hs(i,4)*(H-M.horizon-2),r=0.25+hs(i,6)*0.55;if(x<v.x0+0.3||x>v.x1-0.3)continue;B.yb(Hc);if(hs(i,8)>0.6)B.spire(th.strata[1],x,Hc,z,r*0.8,0.6+r*1.8,i);else B.rock(th.strata[i%4],x,Hc,z,r,r,i,{dim:0.85});B.yb(0);}
   B.k.anchors.rail=[[10,0,-1],[10,0,H+1]];
  }else if(id==='longshot'){
   border(B,M,{glow:'#58e6d8'});
   for(let i=0;i<(hi?8:3);i++){const x=4.6+hs(i,7)*10.8,z=-0.9-hs(i,3)*3.4,r=0.3+hs(i,5)*0.6;B.rock(th.strata[i%4],x,0,z,r,r*1.25,i+60,{dim:0.8});}
   B.k.anchors.rail=[[10,0,-1],[10,0,H+1]];
  }else{
   border(B,M,{});outland(B,M,{});
   if(id==='overpass'){B.k.anchors.rail=[[2,DECK,16],[18,DECK,16]];}
  }
  ridge(B,M,id==='canyon'?1.6:id==='longshot'?0:id==='bunker'?2.0:0,id==='bunker'?'#5e5d60':th.strata[0]);
  if(outdoor&&(id==='classic'||id==='craters'||id==='overpass'))baseClutter(B,M);
  B.k.anchors.area=[0,0,W,H];
  if(!B.k.anchors.drops.length)B.k.anchors.drops.push([W/2,H/2]);
  // ceiling-laser mounts for a later session: the bunker's side walls carry dormant emitter housings on their caps
  if(id==='bunker')for(const z of [6,16,26])for(const s of [-1,1]){const x=s<0?-0.1:W+0.1;B.k.anchors.lasers.push([x,2.05,z,-s,0]);if(hi){B.box('metal','#39424a',x,2.14,z,0.3,0.14,0.3,0,{ao:0});B.glow('#ff5a46',x-s*0.16,2.14,z,0.02,0.05,0.12);}}
 }
 // what a base leaves lying about beyond the arena edge (desktop sees the flanks; phones see a strip north and south)
 function baseClutter(B,M){
  const v=M.view,hi=B.high,id=M.id,dim=(x,z)=>{const dx=Math.max(0,-x,x-W),dz=Math.max(0,-z,z-H);return 1-0.4*Math.min(1,Math.hypot(dx,dz)/14);};
  const fits=(x,z,r)=>x-r>v.x0+0.2&&x+r<v.x1-0.2&&z-r>M.horizon+0.6&&z+r<v.z1-0.2&&(x+r<-0.8||x-r>W+0.8||z+r<-0.8||z-r>H+0.8);
  const put=(x,z,r,fn)=>{if(fits(x,z,r))fn(x,z,dim(x,z));};
  if(id==='classic'||id==='overpass'){
   put(-9.5,6.5,1.9,(x,z)=>containers(B,x-1.5,z-1,3,2,41));put(W+9.6,25,1.9,(x,z)=>containers(B,x-1.5,z-1,3,2,43));put(-13.5,24,1.5,(x,z)=>dome(B,x,z,1.3));put(W+13.5,7.5,1.5,(x,z)=>dome(B,x,z,1.3));
   put(W+8.2,2.6,1.2,(x,z)=>{B.cyl('metal',STEEL_D,x,0.1,z,0.5,0.2,10);B.cyl('metal',STEEL_L,x,1.3,z,0.03,2.4,5,{ao:0});B.glow('#ff5a50',x,2.53,z,0.07,0.07,0.07);B.halo(x,2.53,z,0.9,'#ff4d44',0.6,1.7);for(const a of [0,2.1,4.2])B.cyl('metal',STEEL,x+Math.cos(a)*0.5,0.9,z+Math.sin(a)*0.5,0.012,1.9,4,{rz:Math.cos(a)*0.5,rx:-Math.sin(a)*0.5,ao:0});});
   put(-16,13,2.4,(x,z)=>{B.cyl('rock','#7d8288',x,0.04,z,2.2,0.08,hi?24:12,{ao:0.1});B.tor('glow',CYAN,x,0.09,z,1.9,0.02,hi?32:16,{ts:4});for(let i=0;i<4;i++){const a=i*PI/2+0.4;B.glow('#ffd27a',x+Math.cos(a)*2.05,0.1,z+Math.sin(a)*2.05,0.12,0.03,0.12);B.halo(x+Math.cos(a)*2.05,0.15,z+Math.sin(a)*2.05,0.8,'#ffcf7a',0.4,1.2);}});
   put(W+15.5,18,2.4,(x,z)=>{for(let i=0;i<3;i++)for(let j=0;j<2;j++){B.box('metal','#2c3f66',x-1.4+i*1.4,0.5,z-0.7+j*1.4,1.2,0.04,1.1,0,{rx:-0.5,ao:0,dust:0.1});B.box('metal',STEEL,x-1.4+i*1.4,0.25,z-0.7+j*1.4,0.06,0.5,0.06);}});
  }
  if(id==='craters'){
   put(-10,9,1.6,(x,z)=>lander(B,x-1.5,z-0.6,3,1.2,55));put(W+10.5,22,1.6,(x,z)=>{B.box('metal',STEEL_D,x,0.3,z,1.5,0.24,0.9,0.4);for(const a of [-1,1])for(const c of [-1,1])B.cyl('metal','#2a2f35',x+a*0.55,0.2,z+c*0.5,0.2,0.14,10,{rx:PI/2,ry:0.4});B.box('metal','#c89a2e',x,0.52,z,0.8,0.2,0.6,0.4);B.cyl('metal',STEEL_L,x+0.3,0.9,z,0.02,0.7,5,{ao:0});B.cyl('metal','#d5dade',x+0.3,1.25,z,0.22,0.07,10,{rt:0.2,rx:0.6,ao:0});});
   put(-14,24,1,(x,z)=>{B.cyl('metal',STEEL_L,x,0.6,z,0.02,1.2,5,{ao:0});B.box('paint','#d8dde2',x+0.22,1.0,z,0.44,0.28,0.012,0,{ao:0,dust:0});B.box('paint','#c0392b',x+0.22,1.07,z+0.007,0.44,0.05,0.004,0,{ao:0,dust:0});});
  }
 }
 // sky: stars and the Earth, placed far below the ground along the view so terrain always covers them
 function sky(T,M,earth){
  const v=M.view,vis=v.vis||v,g=new T.Group(),k=GSN/GKC,top=Math.min(vis.z0,M.horizon-1),span=M.horizon-top;
  if(span<0.8)return {group:g,dispose(){},set(){}};
  const n=M.q==='low'?70:170,P=new Float32Array(n*3),C=new Float32Array(n*4),S=new Float32Array(n),Y=-40;
  for(let i=0;i<n;i++){const ex=vis.x0-2+hs(i,1.1)*(vis.x1-vis.x0+4),ez=top-1+hs(i,2.7)*(span+3),b=0.45+hs(i,5)*0.55;P[i*3]=ex;P[i*3+1]=Y;P[i*3+2]=ez+Y*k;C[i*4]=b;C[i*4+1]=b;C[i*4+2]=0.9+0.1*hs(i,8);C[i*4+3]=0.3+hs(i,9)*0.7;S[i]=0.05+Math.pow(hs(i,3),3)*0.13;}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(P,3));sg.setAttribute('rgba',new T.BufferAttribute(C,4));sg.setAttribute('size',new T.BufferAttribute(S,1));
  const sm=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uS:{value:20},uA:{value:1},uT:{value:0}},
   vertexShader:'attribute float size;attribute vec4 rgba;varying vec4 vC;uniform float uS;uniform float uT;void main(){vC=rgba;vC.a*=0.75+0.25*sin(uT*(0.6+rgba.a*1.7)+position.x*3.1);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=min(12.0,max(1.5,size*uS));}',
   fragmentShader:'varying vec4 vC;uniform float uA;void main(){vec2 d=gl_PointCoord-0.5;float r=length(d)*2.0;if(r>1.0)discard;gl_FragColor=vec4(vC.rgb,vC.a*uA*pow(1.0-r,1.6));}'});
  const stars=new T.Points(sg,sm);stars.frustumCulled=false;stars.renderOrder=-5;g.add(stars);
  // the Earth, over one shoulder of the arena
  const size=Math.min(2.5,Math.max(1.5,span*0.36)),ex=vis.x0+(vis.x1-vis.x0)*0.22,ez=top+Math.max(size*0.8,span*0.42),Ye=-30;
  const em=new T.MeshBasicMaterial({map:earth,transparent:true,depthWrite:false,toneMapped:false}),e=new T.Mesh(new T.PlaneGeometry(size,size),em);e.rotation.x=-(PI/2-TILT);e.position.set(ex,Ye,ez+Ye*k);e.renderOrder=-4;e.frustumCulled=false;g.add(e);
  return {group:g,stars:sm,earth:em,set(st,ea,t,pxs){sm.uniforms.uA.value=st;sm.uniforms.uT.value=t||0;if(pxs)sm.uniforms.uS.value=pxs;em.opacity=ea;e.visible=ea>0.01;stars.visible=st>0.01;},dispose(){sg.dispose();sm.dispose();e.geometry.dispose();em.dispose();}};
 }
 return {THEMES,theme,build,crate,sky,DECK,TILT};
})();
