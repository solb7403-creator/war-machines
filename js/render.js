'use strict';
// =====================================================================
// render: battle canvas (arena, tanks, effects, HUD), shared art (tanks, crates, map thumbnails), battle input
// =====================================================================
const cv=document.getElementById('c'),g=cv.getContext('2d');
const dpr=Math.min(devicePixelRatio||1,2);
const HUD=2.6;
let sc=1,ox=0,oy=0,vw=0,vh=0,SAB=0;
function fit(){vw=cv.clientWidth||innerWidth;vh=cv.clientHeight||innerHeight;cv.width=vw*dpr;cv.height=vh*dpr;
 const pr=document.getElementById('sab');SAB=pr?pr.offsetHeight:0;   // home-indicator height (probe element sized by CSS env())
 sc=Math.min(vw/W,vh/(H+HUD));ox=(vw-W*sc)/2;oy=(vh-(H+HUD)*sc)/2+HUD*sc;}
addEventListener('resize',fit);fit();
const X=x=>ox+x*sc,Y=y=>oy+y*sc;
const FONT_FAMILY='"Chakra Petch","Arial Narrow",system-ui,sans-serif';
const font=s=>'600 '+s+'px '+FONT_FAMILY;
const C={floor:'#1d2330',grid:'#283042',wall:'#4a4e5e',wallTop:'#6e7490',star:'#ffffff'};
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function diamond(ctx,x,y,s,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*0.7,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*0.7,y);ctx.closePath();ctx.fill();}

// ---- Crystal tank, top-down: hull follows movement, turret + cannon follow the aim ----
function drawTankPx(ctx,px,py,r,hd,ang,col,gems,wtype,flash,parts,paint){
 const fl=flash||null,P=paint||PAINTS.stock;parts=parts||3;   // 1 = hull only, 2 = turret only, 3 = whole tank. Paint colors the plates; team color stays on tracks and core
 if(parts&1){
 ctx.save();ctx.translate(px,py);ctx.rotate(hd);
 for(const sd of [-1,1]){                           // tracks with a glow stripe
  ctx.fillStyle='#0f151c';ctx.fillRect(-1.2*r,sd*0.64*r-0.3*r,2.4*r,0.6*r);
  ctx.globalAlpha=0.85;ctx.fillStyle=col;ctx.fillRect(-1*r,sd*0.64*r-0.05*r,2*r,0.1*r);ctx.globalAlpha=1;
 }
 ctx.fillStyle=fl||P.hull;ctx.beginPath();           // hull plate
 ctx.moveTo(-1.05*r,-0.56*r);ctx.lineTo(0.85*r,-0.56*r);ctx.lineTo(1.12*r,-0.26*r);ctx.lineTo(1.12*r,0.26*r);ctx.lineTo(0.85*r,0.56*r);ctx.lineTo(-1.05*r,0.56*r);ctx.closePath();ctx.fill();
 if(P.shine&&!fl){   // metallic paints: a highlight sweeps across the plate
  ctx.save();ctx.clip();const k=((performance.now()/1700)%1)*3.4-1.7,gr=ctx.createLinearGradient((k-0.4)*r,-r,(k+0.4)*r,r);
  gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(0.5,'rgba(255,255,255,.34)');gr.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gr;ctx.fillRect(-1.2*r,-0.7*r,2.5*r,1.4*r);ctx.restore();}
 ctx.strokeStyle=P.trim;ctx.lineWidth=Math.max(1,r*0.09);ctx.stroke();
 [[-0.8,-0.36],[-0.8,0],[-0.8,0.36]].forEach(([sx,sy],i)=>{   // 3 core sockets, lit all match
  const gk=gems&&gems[i],cx=sx*r,cy=sy*r;
  ctx.fillStyle='#0f151c';ctx.beginPath();ctx.arc(cx,cy,0.17*r,0,7);ctx.fill();
  if(gk&&GEM[gk]){ctx.globalAlpha=0.3;ctx.fillStyle=GEM[gk].c;ctx.beginPath();ctx.arc(cx,cy,0.28*r,0,7);ctx.fill();ctx.globalAlpha=1;
   ctx.fillStyle=GEM[gk].c;ctx.beginPath();ctx.moveTo(cx,cy-0.16*r);ctx.lineTo(cx+0.11*r,cy);ctx.lineTo(cx,cy+0.16*r);ctx.lineTo(cx-0.11*r,cy);ctx.closePath();ctx.fill();}
 });
 ctx.restore();
 }
 if(!(parts&2))return;
 ctx.save();ctx.translate(px,py);ctx.rotate(ang);        // turret layer
 const wt=wtype||'pulse';
 if(wt==='twin'){
  ctx.fillStyle='#141b24';ctx.fillRect(0.2*r,-0.26*r,1.5*r,0.15*r);ctx.fillRect(0.2*r,0.11*r,1.5*r,0.15*r);
  ctx.fillStyle=col;ctx.fillRect(0.25*r,-0.21*r,1.4*r,0.05*r);ctx.fillRect(0.25*r,0.16*r,1.4*r,0.05*r);
  ctx.fillStyle='#e9f1f7';ctx.fillRect(1.5*r,-0.31*r,0.28*r,0.25*r);ctx.fillRect(1.5*r,0.06*r,0.28*r,0.25*r);
 }else if(wt==='siege'){
  ctx.fillStyle='#141b24';ctx.fillRect(0.2*r,-0.27*r,1.5*r,0.54*r);
  ctx.fillStyle=col;ctx.fillRect(0.25*r,-0.07*r,1.4*r,0.14*r);
  ctx.fillStyle='#e9f1f7';ctx.fillRect(1.5*r,-0.35*r,0.3*r,0.7*r);
  ctx.fillStyle=col;ctx.fillRect(1.74*r,-0.19*r,0.1*r,0.38*r);
 }else if(wt==='moon'){
  ctx.fillStyle='#141b24';ctx.fillRect(0.2*r,-0.2*r,1.7*r,0.4*r);
  const gr=ctx.createLinearGradient(0,-0.2*r,0,0.2*r);gr.addColorStop(0,'#fff8dd');gr.addColorStop(0.5,'#ffcf4a');gr.addColorStop(1,'#c98f1b');
  ctx.fillStyle=gr;ctx.fillRect(0.25*r,-0.08*r,1.6*r,0.16*r);
  ctx.fillStyle='#e8f4ff';ctx.beginPath();ctx.arc(1.9*r,0,0.18*r,0,7);ctx.fill();
 }else{
  ctx.fillStyle='#141b24';ctx.fillRect(0.2*r,-0.17*r,1.55*r,0.34*r);
  ctx.fillStyle=col;ctx.fillRect(0.25*r,-0.04*r,1.4*r,0.08*r);
  ctx.fillStyle='#e9f1f7';ctx.fillRect(1.5*r,-0.23*r,0.3*r,0.46*r);
  ctx.fillStyle=col;ctx.fillRect(1.74*r,-0.12*r,0.1*r,0.24*r);
 }
 ctx.fillStyle=fl||P.tur;ctx.beginPath();ctx.arc(0,0,0.56*r,0,7);ctx.fill();
 ctx.strokeStyle=P===PAINTS.stock?'#e9f1f7':P.trim;ctx.lineWidth=Math.max(1,r*0.09);ctx.stroke();
 ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0.32*r,0);ctx.lineTo(0,0.26*r);ctx.lineTo(-0.32*r,0);ctx.lineTo(0,-0.26*r);ctx.closePath();ctx.fill();   // core crystal
 ctx.restore();
}
function star5(ctx,x,y,r,c){ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*0.45:r;ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}ctx.closePath();ctx.fill();}
function drawTank(b,col){
 const px=X(b.x),py=Y(b.y),r=R*sc*(b.dscale||1),hd=b.hd===undefined?b.ang:b.hd;
 const fl=b.flash>0?(armor(b)>0?BUFF.arm.c:'#ffe27a'):null;
 drawTankPx(g,px,py,r,hd,b.ang,col,b.gems,b.wtype,fl,3,PAINTS[b.paint]);
 if(b.mhp){   // health bar (team colored) with the super meter as a thin strip underneath
  const bw=2.6*r,bx=px-bw/2,by=py-2.25*r,hh=Math.max(4,0.36*r),sh=Math.max(2,0.16*r),hf=Math.max(0,b.hp/b.mhp),f=b.sp/SUPER_MAX;
  g.fillStyle='rgba(0,0,0,.65)';g.fillRect(bx-1.5,by-1.5,bw+3,hh+sh+4);
  g.fillStyle=b.team!==0?'#ff4d5e':b.isPlayer?'#5fe3a1':'#4d9fff';g.fillRect(bx,by,bw*hf,hh);
  g.fillStyle=f>=1?(Math.floor(performance.now()/150)%2?'#ff4d4d':'#ffb3b3'):'#ffcf4a';g.fillRect(bx,by+hh+1,bw*f,sh);
  // what this tank is worth: crystals carried (Crystal Rush) or its bounty (Bounty)
  const n=cry&&b.cry>0?b.cry:matchG==='bounty'&&b.bty?b.bty:0;
  if(n){const isC=!!cry,fs=Math.max(10,Math.round(sc*0.56)),ty=by-fs*0.75;g.font=font(fs);g.textBaseline='middle';
   const tw=g.measureText(String(n)).width,ic=fs*0.5,w2=tw+ic*2+10,x2=px-w2/2;
   g.fillStyle='rgba(8,12,18,.82)';rr(g,x2,ty-fs*0.62,w2,fs*1.24,fs*0.5);g.fill();
   if(isC)diamond(g,x2+5+ic*0.7,ty,ic,'#c79bff');else star5(g,x2+5+ic*0.8,ty,ic*0.95,'#ffcf4a');
   g.fillStyle=isC?'#e2d0ff':'#ffe08a';g.textAlign='left';g.fillText(String(n),x2+7+ic*1.6,ty+1);g.textBaseline='top';}
 }
}
// ---- crate art: riveted steel supply crates, themed per crate type ----
function drawCrateArt(ctx,x,y,w,h,tk,ri){
 const col=tk==='salvage'?SALV_COL:RCOL[ri],cx=x+w/2,cy=y+h/2;
 ctx.save();
 ctx.shadowColor=col;ctx.shadowBlur=ri===0?8:ri===1?16:26;   // rarity glow
 const grad=ctx.createLinearGradient(0,y,0,y+h);
 grad.addColorStop(0,'#2b3543');grad.addColorStop(.55,'#1a222d');grad.addColorStop(1,'#11161d');
 ctx.fillStyle=grad;rr(ctx,x,y,w,h,Math.min(10,w*0.12));ctx.fill();
 ctx.shadowBlur=0;
 ctx.lineWidth=ri===2?3:2;ctx.strokeStyle=col;rr(ctx,x,y,w,h,Math.min(10,w*0.12));ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(x+5,y+h*0.3);ctx.lineTo(x+w-5,y+h*0.3);ctx.stroke();
 ctx.fillStyle='rgba(255,255,255,.28)';
 const rs=Math.max(1.5,w*0.03);
 [[x+rs*2.4,y+rs*2.4],[x+w-rs*2.4,y+rs*2.4],[x+rs*2.4,y+h-rs*2.4],[x+w-rs*2.4,y+h-rs*2.4]].forEach(([px,py])=>{ctx.beginPath();ctx.arc(px,py,rs,0,7);ctx.fill();});
 ctx.fillStyle='rgba(255,255,255,.06)';
 ctx.beginPath();ctx.moveTo(x+w*0.15,y);ctx.lineTo(x+w*0.38,y);ctx.lineTo(x+w*0.2,y+h);ctx.lineTo(x+w*0.02,y+h);ctx.closePath();ctx.fill();
 const sh=h*0.15;
 ctx.save();rr(ctx,x+3,y+h-sh-3,w-6,sh,3);ctx.clip();
 for(let i=-10;i<w+10;i+=10){
  ctx.fillStyle=((i/10)|0)%2?'rgba(255,207,74,.55)':'rgba(18,22,29,.95)';
  ctx.beginPath();ctx.moveTo(x+i,y+h-3);ctx.lineTo(x+i+6,y+h-3);ctx.lineTo(x+i+2,y+h-sh-3);ctx.lineTo(x+i-4,y+h-sh-3);ctx.closePath();ctx.fill();
 }
 ctx.restore();
 const s=Math.min(w,h);
 ctx.shadowColor=col;ctx.shadowBlur=10;
 if(tk==='gem'){
  diamond(ctx,cx,cy-s*0.08,s*0.30,col);
  diamond(ctx,cx-s*0.32,cy+s*0.22,s*0.13,'#8fa3b8');
  diamond(ctx,cx+s*0.32,cy+s*0.22,s*0.13,'#8fa3b8');
 }else if(tk==='weapon'){
  const bw2=s*0.62,bh2=s*0.10;
  ctx.fillStyle='#0b0f14';
  ctx.fillRect(cx-bw2/2,cy-bh2-s*0.03,bw2,bh2);ctx.fillRect(cx-bw2/2,cy+s*0.03,bw2,bh2);
  ctx.fillStyle=col;
  ctx.fillRect(cx-bw2/2,cy-bh2-s*0.03+bh2*0.3,bw2*0.9,bh2*0.4);ctx.fillRect(cx-bw2/2,cy+s*0.03+bh2*0.3,bw2*0.9,bh2*0.4);
  ctx.fillStyle='#e9f1f7';
  ctx.fillRect(cx+bw2/2-2,cy-bh2-s*0.03-2,5,bh2+4);ctx.fillRect(cx+bw2/2-2,cy+s*0.03-2,5,bh2+4);
  ctx.fillStyle='#0b0f14';rr(ctx,cx-bw2/2-7,cy-s*0.17,11,s*0.34,2);ctx.fill();
 }else{
  ctx.fillStyle='#0b0f14';rr(ctx,cx-s*0.34,cy+s*0.10,s*0.68,s*0.16,4);ctx.fill();
  ctx.fillStyle='#232d3a';rr(ctx,cx-s*0.26,cy-s*0.14,s*0.52,s*0.22,4);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,s*0.03);rr(ctx,cx-s*0.26,cy-s*0.14,s*0.52,s*0.22,4);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.35)';
  for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(cx+i*s*0.2,cy+s*0.18,s*0.045,0,7);ctx.fill();}
  diamond(ctx,cx+s*0.17,cy-s*0.03,s*0.06,col);
 }
 ctx.restore();
}
// ---- small top-down picture of a map, for the map picker ----
function drawMapThumb(ctx,w,h,id){
 const m=MAPS[id],s=Math.min(w/W,h/H),x0=(w-W*s)/2,y0=(h-H*s)/2;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#1d2330';ctx.fillRect(x0,y0,W*s,H*s);
 if(m.isRandom){ctx.fillStyle='rgba(223,231,242,.75)';ctx.font=font(Math.round(h*0.32));ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',w/2,h/2+1);return;}
 ctx.fillStyle='rgba(255,77,94,.16)';ctx.fillRect(x0,y0,W*s,5*s);
 ctx.fillStyle='rgba(77,159,255,.16)';ctx.fillRect(x0,y0+(H-5)*s,W*s,5*s);
 if(m.bridge){const [dx,dy,dw,dh]=m.bridge.deck;ctx.fillStyle='#596088';ctx.fillRect(x0+dx*s,y0+dy*s,dw*s,dh*s);
  ctx.fillStyle='#3a405c';for(const [rx,ry,rw,rh] of m.bridge.ramps)ctx.fillRect(x0+rx*s,y0+ry*s,rw*s,rh*s);}
 for(const [x,y,r] of (m.craters||[])){ctx.fillStyle='#121722';ctx.beginPath();ctx.arc(x0+x*s,y0+y*s,r*s,0,7);ctx.fill();ctx.strokeStyle='rgba(223,231,242,.18)';ctx.lineWidth=1;ctx.stroke();}
 for(const [x,y,ww,hh,st] of m.walls){ctx.fillStyle=THUMB_COL[st]||'#7d859f';ctx.fillRect(x0+x*s,y0+y*s,ww*s,hh*s);}
 ctx.fillStyle=THUMB_COL.crate;for(const [x,y,ww,hh] of (m.crates||[]))ctx.fillRect(x0+x*s,y0+y*s,ww*s,hh*s);
 for(const [x,y,r,st] of (m.rocks||[])){ctx.fillStyle=THUMB_COL[st]||'#6b7385';ctx.beginPath();ctx.arc(x0+x*s,y0+y*s,r*s,0,7);ctx.fill();}
}
const THUMB_COL={ctr:'#7d859f',cmd:'#9aa4bb',cliff:'#3a4152',pylon:'#3fd0c9',lander:'#b8963e',crate:'#b07a3a',rock:'#6b7385',dome:'#b9c3d3'};
// ---- map objects, drawn with a little height (2.5D): top face lifted, front face below, shadow to the lower right ----
const ELEV=0.38,CTR_COLS=['#3d4c61','#5b4637','#40564c','#4b4f63'];
const hash2=(x,y)=>{const v=Math.sin(x*12.9898+y*78.233)*43758.5453;return v-Math.floor(v);};
function shade(hex,k){const n=parseInt(hex.slice(1),16),f=c=>Math.max(0,Math.min(255,Math.round(c*k)));return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';}
function drawSolid(ctx,wl,sc,X,Y){
 const [x,y,w,h,st]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc;
 if(st==='cliff'){   // canyon wall: rough rock face along the inside edge
  ctx.fillStyle='#1f2531';ctx.fillRect(px,py,pw,ph);
  const inner=x<W/2?px+pw:px,dir=x<W/2?-1:1;
  ctx.fillStyle='#2b3241';ctx.beginPath();ctx.moveTo(inner,py);
  for(let yy=0;yy<=h;yy+=0.8){const j=0.25+hash2(x+yy,yy)*0.55;ctx.lineTo(inner+dir*j*sc,Y(y+yy));}
  ctx.lineTo(inner,Y(y+h));ctx.lineTo(inner+dir*pw,Y(y+h));ctx.lineTo(inner+dir*pw,py);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(223,231,242,.14)';ctx.lineWidth=1.5;ctx.beginPath();
  for(let yy=0;yy<=h;yy+=0.8){const j=0.25+hash2(x+yy,yy)*0.55;const xx=inner+dir*j*sc,yv=Y(y+yy);if(yy===0)ctx.moveTo(xx,yv);else ctx.lineTo(xx,yv);}
  ctx.stroke();return;
 }
 ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(px+e*0.7,py+e*0.3,pw,ph);   // shadow
 let top='#4a4e5e';
 if(st==='ctr')top=CTR_COLS[Math.floor(hash2(x,y)*CTR_COLS.length)];
 else if(st==='cmd')top='#4c5870';else if(st==='pylon')top='#2d3445';else if(st==='lander')top='#8f7230';else if(st==='crate')top=wl.flash>0?'#e8d2b0':'#7a5530';
 ctx.fillStyle=shade(top.startsWith('#')?top:'#7a5530',0.62);ctx.fillRect(px,py+ph-e,pw,e);   // front face
 ctx.fillStyle=top;ctx.fillRect(px,py-e,pw,ph);   // top face
 ctx.fillStyle='rgba(255,255,255,.13)';ctx.fillRect(px,py-e,pw,Math.max(1.5,sc*0.08));   // lit top edge
 const ty=py-e;
 if(st==='ctr'){   // corrugated container: ribs across the short side
  ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;ctx.beginPath();
  if(w>=h)for(let k=0.45;k<w-0.2;k+=0.45){ctx.moveTo(px+k*sc,ty+2);ctx.lineTo(px+k*sc,ty+ph-2);}
  else for(let k=0.45;k<h-0.2;k+=0.45){ctx.moveTo(px+2,ty+k*sc);ctx.lineTo(px+pw-2,ty+k*sc);}
  ctx.stroke();
 }else if(st==='cmd'){   // command module: hatch + hazard band on the front
  ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px+pw/2,ty+ph/2,Math.min(pw,ph)*0.28,0,7);ctx.stroke();
  ctx.fillStyle='rgba(223,231,242,.18)';ctx.beginPath();ctx.arc(px+pw/2,ty+ph/2,Math.min(pw,ph)*0.12,0,7);ctx.fill();
  ctx.save();ctx.beginPath();ctx.rect(px,py+ph-e,pw,e);ctx.clip();
  for(let k=-e;k<pw+e;k+=e*1.2){ctx.fillStyle='rgba(255,207,74,.55)';ctx.beginPath();ctx.moveTo(px+k,py+ph);ctx.lineTo(px+k+e*0.6,py+ph);ctx.lineTo(px+k+e*1.2,py+ph-e);ctx.lineTo(px+k+e*0.6,py+ph-e);ctx.closePath();ctx.fill();}
  ctx.restore();
 }else if(st==='pylon'){   // energy pylon: glowing core
  const pulse=0.55+0.45*Math.sin(performance.now()/350);
  ctx.save();ctx.shadowColor='#3fd0c9';ctx.shadowBlur=12*pulse;ctx.fillStyle='rgba(63,208,201,'+(0.55+0.4*pulse)+')';
  ctx.fillRect(px+pw*0.38,ty+ph*0.15,pw*0.24,ph*0.7);ctx.restore();
 }else if(st==='lander'){   // crashed lander: foil body, splayed legs
  ctx.strokeStyle='rgba(255,236,170,.25)';ctx.lineWidth=1;ctx.beginPath();
  for(let k=0.3;k<w;k+=0.55){ctx.moveTo(px+k*sc,ty+2);ctx.lineTo(px+(k+0.2)*sc,ty+ph-2);}ctx.stroke();
  ctx.strokeStyle='#1a1f29';ctx.lineWidth=Math.max(2,sc*0.12);ctx.beginPath();
  ctx.moveTo(px+2,ty+ph);ctx.lineTo(px-sc*0.35,py+ph+sc*0.25);ctx.moveTo(px+pw-2,ty+ph);ctx.lineTo(px+pw+sc*0.35,py+ph+sc*0.25);ctx.stroke();
 }else if(st==='crate'){   // breakable supply crate: frame, straps, cracks as it takes damage
  ctx.strokeStyle='rgba(255,220,170,.35)';ctx.lineWidth=Math.max(1.5,sc*0.08);ctx.strokeRect(px+2,ty+2,pw-4,ph-4);
  ctx.beginPath();ctx.moveTo(px+3,ty+3);ctx.lineTo(px+pw-3,ty+ph-3);ctx.moveTo(px+pw-3,ty+3);ctx.lineTo(px+3,ty+ph-3);ctx.stroke();
  const f=wl.hp/wl.mhp;
  if(f<0.7){ctx.strokeStyle='rgba(20,12,4,.85)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px+pw*0.2,ty+ph*0.15);ctx.lineTo(px+pw*0.45,ty+ph*0.5);ctx.lineTo(px+pw*0.35,ty+ph*0.85);
   if(f<0.4){ctx.moveTo(px+pw*0.8,ty+ph*0.2);ctx.lineTo(px+pw*0.6,ty+ph*0.55);ctx.lineTo(px+pw*0.75,ty+ph*0.9);}ctx.stroke();}
  if(f<1){const bw=pw,bh=Math.max(3,sc*0.16);ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(px,ty-bh-3,bw,bh);ctx.fillStyle='#ffb347';ctx.fillRect(px,ty-bh-3,bw*Math.max(0,f),bh);}
 }
}
const ROCK_SHAPE={};
function drawRock(ctx,rk,sc,X,Y){
 const [x,y,r,st]=rk,px=X(x),py=Y(y),pr=r*sc,e=ELEV*sc*0.7;
 ctx.fillStyle='rgba(0,0,0,.36)';ctx.beginPath();ctx.ellipse(px+e*0.8,py+e*0.5,pr*1.02,pr*0.92,0,0,7);ctx.fill();
 if(st==='dome'){   // habitat dome: base ring, lit dome, window band
  ctx.fillStyle='#2f3848';ctx.beginPath();ctx.arc(px,py,pr,0,7);ctx.fill();
  const gr=ctx.createRadialGradient(px+pr*0.35,py-e-pr*0.4,pr*0.1,px,py-e,pr*0.95);gr.addColorStop(0,'#e4ebf4');gr.addColorStop(0.45,'#9aa6b8');gr.addColorStop(1,'#4a5568');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(px,py-e,pr*0.88,0,7);ctx.fill();
  ctx.strokeStyle='rgba(10,14,23,.45)';ctx.lineWidth=Math.max(1,sc*0.06);ctx.beginPath();ctx.arc(px,py-e,pr*0.55,0,7);ctx.stroke();
  ctx.fillStyle='rgba(255,207,74,.75)';for(let k=0;k<5;k++){const a=Math.PI*(0.15+k*0.175);ctx.beginPath();ctx.arc(px+Math.cos(a)*pr*0.72,py-e+Math.sin(a)*pr*0.72,Math.max(1,sc*0.07),0,7);ctx.fill();}
  return;
 }
 const key=x+','+y;   // boulder: lumpy outline, lit from the top right
 if(!ROCK_SHAPE[key])ROCK_SHAPE[key]=Array.from({length:9},(_,i)=>0.82+hash2(x+i,y-i)*0.3);
 const sh=ROCK_SHAPE[key];
 ctx.beginPath();sh.forEach((k,i)=>{const a=i/sh.length*Math.PI*2,xx=px+Math.cos(a)*pr*k,yy=py-e*0.6+Math.sin(a)*pr*k*0.95;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);});ctx.closePath();
 const gr=ctx.createLinearGradient(px+pr,py-pr,px-pr,py+pr);gr.addColorStop(0,'#6f788b');gr.addColorStop(0.5,'#454d5e');gr.addColorStop(1,'#262c38');
 ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='rgba(10,14,23,.6)';ctx.lineWidth=1.5;ctx.stroke();
 ctx.fillStyle='rgba(10,14,23,.28)';ctx.beginPath();ctx.ellipse(px-pr*0.25,py+pr*0.15,pr*0.22,pr*0.14,0.4,0,7);ctx.fill();
}
function drawCrater(ctx,cr,sc,X,Y){
 const [x,y,r]=cr,px=X(x),py=Y(y),pr=r*sc;
 const gr=ctx.createRadialGradient(px-pr*0.2,py+pr*0.2,pr*0.1,px,py,pr);gr.addColorStop(0,'#10141c');gr.addColorStop(0.75,'#161b25');gr.addColorStop(1,'#232a37');
 ctx.fillStyle=gr;ctx.beginPath();ctx.arc(px,py,pr,0,7);ctx.fill();
 ctx.lineWidth=Math.max(2,sc*0.14);ctx.strokeStyle='rgba(223,231,242,.16)';ctx.beginPath();ctx.arc(px,py,pr,-Math.PI*0.95,Math.PI*0.05);ctx.stroke();
 ctx.strokeStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(px,py,pr,Math.PI*0.05,Math.PI*1.05);ctx.stroke();
}
// ---- menu art: hero tank on a patch of moon rock, gear icons, cores, VS cards ----
const HERO_STARS=Array.from({length:26},()=>({x:Math.random(),y:Math.random()*0.55,r:Math.random()*1.1+0.3,p:Math.random()*6.28}));
const HERO_DUST=Array.from({length:14},()=>({x:Math.random(),y:0.55+Math.random()*0.4,s:0.2+Math.random()*0.6,p:Math.random()*6.28}));
function myTankColor(){return save.skin==='lunar'?'#e8f4ff':TC[0];}
function drawHeroScene(ctx,w,h,t){
 ctx.clearRect(0,0,w,h);
 const room=h-58;   // the name + loadout line sits in the bottom 58px
 for(const s of HERO_STARS){ctx.globalAlpha=0.2+0.5*Math.abs(Math.sin(t*0.7+s.p));ctx.fillStyle='#dfe7f2';ctx.beginPath();ctx.arc(s.x*w,s.y*room*1.1,s.r,0,7);ctx.fill();}
 ctx.globalAlpha=1;
 const r=Math.max(16,Math.min(w*0.12,room*0.2)),cx=w/2,cy=room*0.62;
 // the moon: a big lit dome the tank stands on
 const top=cy-r*0.55,Rm=Math.max(w*0.9,h*1.1),my=top+Rm;
 const halo=ctx.createRadialGradient(cx,top,0,cx,top,w*0.7);halo.addColorStop(0,'rgba(223,231,242,.13)');halo.addColorStop(1,'rgba(223,231,242,0)');
 ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
 const body=ctx.createRadialGradient(cx+Rm*0.18,top+Rm*0.06,Rm*0.02,cx,my,Rm);
 body.addColorStop(0,'#566175');body.addColorStop(0.18,'#384256');body.addColorStop(0.55,'#1f2737');body.addColorStop(1,'#121824');
 ctx.fillStyle=body;ctx.beginPath();ctx.arc(cx,my,Rm,0,7);ctx.fill();
 ctx.strokeStyle='rgba(223,231,242,.32)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,my,Rm,Math.PI*1.2,Math.PI*1.8);ctx.stroke();
 ctx.save();ctx.beginPath();ctx.arc(cx,my,Rm,0,7);ctx.clip();
 const cr=[[-0.34,0.25,0.07],[0.3,0.18,0.05],[-0.12,0.55,0.09],[0.42,0.62,0.06],[0.08,0.32,0.035],[-0.45,0.8,0.05]];
 for(const [dx,dy,rr2] of cr){const x=cx+dx*w,y=top+dy*(h-top),R2=rr2*w;
  ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(x,y,R2,R2*0.38,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(223,231,242,.10)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y+R2*0.06,R2,R2*0.38,0,0.1,Math.PI-0.1);ctx.stroke();}
 ctx.restore();
 for(const d of HERO_DUST){const x=((d.x+t*0.012*d.s)%1)*w,y=top+(d.y-0.55)*2*(h-top)*0.5+Math.sin(t*0.8+d.p)*3;ctx.globalAlpha=0.15+0.2*d.s;ctx.fillStyle='#c9d3e0';ctx.beginPath();ctx.arc(x,y,0.8+d.s,0,7);ctx.fill();}
 ctx.globalAlpha=1;
 const col=myTankColor(),hd=-Math.PI/2+0.42,ang=hd-0.25+Math.sin(t*0.55)*0.42;
 ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(cx+r*0.3,cy+r*0.6,r*1.5,r*0.6,0,0,7);ctx.fill();
 ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(cx,cy+r*0.4,r*1.7,r*0.72,0,0,7);ctx.fill();ctx.restore();
 drawTankPx(ctx,cx,cy,r,hd,ang,col,(save.cores||[]).filter(Boolean),getW(save.weapon).arch||'pulse',null,3,myPaint());
}
function drawGearIcon(ctx,w,h,isW,it){   // the whole tank; the part this slot is about is lit, the rest is ghosted
 ctx.clearRect(0,0,w,h);
 const col=gcol(it),r=Math.min(w,h)*0.27,a=-Math.PI/4,cx=w*0.47,cy=h*0.55;
 const gems=(save.cores||[]).filter(Boolean),wt=isW?(it.arch||'pulse'):(getW(save.weapon).arch||'pulse');
 const ga=ctx.globalAlpha;
 ctx.globalAlpha=ga*(isW?0.28:1);drawTankPx(ctx,cx,cy,r,a,a,col,gems,wt,null,1,myPaint());
 ctx.globalAlpha=ga*(isW?1:0.28);drawTankPx(ctx,cx,cy,r,a,a,col,gems,wt,null,2,myPaint());
 ctx.globalAlpha=ga;
}
function drawGemArt(ctx,w,h,k){
 ctx.clearRect(0,0,w,h);const c=GEM[k]?GEM[k].c:'#8a97ab',s=Math.min(w,h);
 ctx.save();ctx.shadowColor=c;ctx.shadowBlur=s*0.25;diamond(ctx,w/2,h/2,s*0.3,c);ctx.restore();
 ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.moveTo(w/2,h/2-s*0.3);ctx.lineTo(w/2+s*0.21,h/2);ctx.lineTo(w/2,h/2-s*0.04);ctx.closePath();ctx.fill();
}
function drawUnitArt(ctx,w,h,u){
 ctx.clearRect(0,0,w,h);if(!u)return;
 const col=u.isPlayer?myTankColor():tcol(u.team),r=Math.min(w,h)*0.2*(u.dscale||1),a=u.team===0?-Math.PI/2:Math.PI/2;
 ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(w/2,h/2+r*0.8,r*1.3,r*0.5,0,0,7);ctx.fill();ctx.restore();
 drawTankPx(ctx,w/2,h/2,r,a,a,col,u.gems,u.wtype,null,3,PAINTS[u.paint]);
}

// ---- battle input: floating joystick, SUPER button, keyboard ----
const btn=()=>({x:vw-62,y:vh-96-SAB,r:40});
const dashBtn=()=>({x:vw-150,y:vh-70-SAB,r:30});
let aim=null;   // {id,sx,sy,x,y,on}: dragging from SUPER to aim it
const aimAng=()=>aim&&aim.on?Math.atan2(aim.y-aim.sy,aim.x-aim.sx):null;
const ffBtnOn=()=>state==='play'&&me&&me.hp<=0&&!respawns()&&!storm&&aliveCount(0)>0;
const ffBtn=()=>({x:vw/2-80,y:vh-74-SAB,w:160,h:44});
const joy={on:false,id:null,sx:0,sy:0,x:0,y:0,dx:0,dy:0},keys={};
const loc=e=>{const rc=cv.getBoundingClientRect();return {x:e.clientX-rc.left,y:e.clientY-rc.top};};
cv.addEventListener('pointerdown',e=>{
 if(state!=='play'||!me)return;
 const L=loc(e);
 if(ffBtnOn()){const F=ffBtn();if(L.x>=F.x&&L.x<=F.x+F.w&&L.y>=F.y&&L.y<=F.y+F.h){ffwd=!ffwd;if(typeof fx==='function')fx('tap');return;}}
 const B=btn();if(me.hp>0&&Math.hypot(L.x-B.x,L.y-B.y)<=B.r+16){
  if(me.sp<SUPER_MAX||me.sup){nums.push({x:me.x,y:me.y-1.6,t:0.9,z:1,txt:'Super '+Math.round(me.sp/SUPER_MAX*100)+'%',c:'#ff9d9d'});return;}
  aim={id:e.pointerId,sx:L.x,sy:L.y,x:L.x,y:L.y,on:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}
 const D=dashBtn();if(me.hp>0&&Math.hypot(L.x-D.x,L.y-D.y)<=D.r+12){const [ix,iy]=inputVec();useDash(me,ix,iy);return;}
 if(joy.on)return;joy.on=true;joy.id=e.pointerId;joy.sx=joy.x=L.x;joy.sy=joy.y=L.y;joy.dx=joy.dy=0;try{cv.setPointerCapture(e.pointerId);}catch(_){}
});
cv.addEventListener('pointermove',e=>{
 if(aim&&e.pointerId===aim.id){const L=loc(e);aim.x=L.x;aim.y=L.y;if(Math.hypot(L.x-aim.sx,L.y-aim.sy)>18)aim.on=true;return;}
 if(!joy.on||e.pointerId!==joy.id)return;
 const max=55;const L=loc(e);let dx=L.x-joy.sx,dy=L.y-joy.sy,d=Math.hypot(dx,dy);
 if(d>max){dx=dx/d*max;dy=dy/d*max;d=max;}
 joy.x=joy.sx+dx;joy.y=joy.sy+dy;joy.dx=dx/max;joy.dy=dy/max;
 if(tut)tut.moved=(tut.moved||0)+d*0.001;
});
const joyUp=e=>{
 if(aim&&e.pointerId===aim.id){const a=aimAng();aim=null;if(state==='play'&&me)useSuper(me,e.type==='pointercancel'?undefined:a);return;}
 if(e.pointerId===joy.id){joy.on=false;joy.dx=joy.dy=0;}};
cv.addEventListener('pointerup',joyUp);cv.addEventListener('pointercancel',joyUp);
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1;if(e.key===' '&&state==='play')useSuper(me);if(e.key==='Shift'&&state==='play'&&me){const [ix,iy]=inputVec();useDash(me,ix,iy);}});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0;});
function inputVec(){
 let x=joy.dx,y=joy.dy;
 if(keys.a||keys.arrowleft)x-=1;if(keys.d||keys.arrowright)x+=1;
 if(keys.w||keys.arrowup)y-=1;if(keys.s||keys.arrowdown)y+=1;
 const m=Math.hypot(x,y);return m>1?[x/m,y/m]:[x,y];
}

// ---- first-match coaching (tutorial) ----
let tut=null;   // {step, t, moved}
const TUT_STEPS=[
 {txt:'Drag anywhere to drive',done:()=>tut.moved>0.12},
 {txt:'Your cannon aims and fires by itself. Get in range!',done:()=>mstat&&mstat.dmg>250},
 {txt:'Grab the gold box for a power-up',done:()=>mstat&&mstat.box>0||!boxes.length&&tut.t>14},
 {txt:'Super ready: tap the red button!',done:()=>mstat&&mstat.sup>0,wait:()=>me.sp>=SUPER_MAX}];
function tutTick(dt){
 if(!tut)return;
 tut.t+=dt;
 const S=TUT_STEPS[tut.step];if(!S){tut=null;return;}
 if(S.done()){tut.step++;tut.t=0;if(typeof fx==='function')fx('tick');}
}

// ---- battle frame ----
function drawCrystal(c,i){   // a floating crystal; new ones grow in
 const px=X(c.x),py=Y(c.y)-sc*0.14*Math.sin(performance.now()/320+i),s=sc*0.4*Math.min(1,0.3+c.age*2);
 g.globalAlpha=0.22;g.fillStyle='#b98cff';g.beginPath();g.arc(px,py,s*1.5,0,7);g.fill();g.globalAlpha=1;
 diamond(g,px,py,s,'#b98cff');
 g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.moveTo(px,py-s);g.lineTo(px+s*0.42,py-s*0.08);g.lineTo(px,py-s*0.22);g.closePath();g.fill();
}
function drawBattle(){
 g.setTransform(dpr,0,0,dpr,0,0);
 let shx=0,shy=0;
 if(shakeT>0){const m=shakeM*Math.min(1,shakeT*3);shx=(Math.random()-0.5)*m;shy=(Math.random()-0.5)*m;}
 g.fillStyle='#0a0e17';g.fillRect(0,0,vw,vh);
 g.save();g.translate(shx,shy);
 // deep space background with stars
 if(!window._stars){window._stars=[];for(let i=0;i<70;i++)window._stars.push({x:Math.random(),y:Math.random(),r:Math.random()*1.4+0.4,tw:Math.random()*6.28});}
 const tnow=performance.now()/1000;
 g.fillStyle=C.star;
 for(const st of window._stars){g.globalAlpha=0.25+0.6*Math.abs(Math.sin(tnow*0.6+st.tw));g.beginPath();g.arc(st.x*vw,st.y*vh,st.r,0,7);g.fill();}
 g.globalAlpha=1;
 // arena floor (lunar surface)
 g.fillStyle=C.floor;g.fillRect(X(0),Y(0),W*sc,H*sc);
 g.save();g.beginPath();g.rect(X(0),Y(0),W*sc,H*sc);g.clip();
 g.strokeStyle=C.grid;g.lineWidth=1;g.beginPath();
 for(let i=0;i<=W;i+=2){g.moveTo(X(i),Y(0));g.lineTo(X(i),Y(H));}
 for(let j=0;j<=H;j+=2){g.moveTo(X(0),Y(j));g.lineTo(X(W),Y(j));}
 g.stroke();
 g.fillStyle='rgba(255,77,94,.07)';g.fillRect(X(0),Y(0),W*sc,5*sc);
 g.fillStyle='rgba(77,159,255,.07)';g.fillRect(X(0),Y(H-5),W*sc,5*sc);
 // ground: craters, the crystal mine, meteor warnings; then every object back to front
 for(const cr of craters)drawCrater(g,cr,sc,X,Y);
 if(cry){const mx=X(cry.mine.x),my=Y(cry.mine.y),t=performance.now()/1000;
  g.save();g.globalAlpha=0.1;g.fillStyle='#b98cff';g.beginPath();g.arc(mx,my,CRY_MINE_R*sc,0,7);g.fill();g.globalAlpha=0.45;g.strokeStyle='#c79bff';g.lineWidth=2;g.setLineDash([6,8]);g.lineDashOffset=-t*8;g.beginPath();g.arc(mx,my,CRY_MINE_R*sc,0,7);g.stroke();g.restore();}
 for(const wn of warns){const k=1-wn.t/wn.t0,px=X(wn.x),py=Y(wn.y),pr=wn.r*sc;
  g.fillStyle='rgba(255,77,94,'+(0.08+0.3*k)+')';g.beginPath();g.arc(px,py,pr,0,7);g.fill();
  g.strokeStyle='rgba(255,107,94,'+(0.5+0.5*Math.abs(Math.sin(performance.now()/90)))+')';g.lineWidth=2;g.setLineDash([5,4]);g.beginPath();g.arc(px,py,pr,0,7);g.stroke();g.setLineDash([]);
  g.strokeStyle='rgba(255,230,200,.8)';g.lineWidth=1.5;g.beginPath();g.arc(px,py,pr*(1-k),0,7);g.stroke();}
 {const objs=[];for(const wl of baseWalls)objs.push([wl[1]+wl[3],0,wl]);for(const rk of rocks)objs.push([rk[1]+rk[2],1,rk]);
  objs.sort((a,b)=>a[0]-b[0]);
  for(const [,k,o] of objs){if(k)drawRock(g,o,sc,X,Y);else drawSolid(g,o,sc,X,Y);}}
 if(BR){   // tunnel floors and ground shadow of the deck
  const [dx,dy,dw,dh]=BR.deck;
  g.fillStyle='rgba(0,0,0,.35)';g.fillRect(X(dx)+sc*0.35,Y(dy)+sc*0.5,dw*sc,dh*sc);
  for(const [tx,tw] of BR.tunnels)for(const my of [dy-0.7,dy+dh]){g.fillStyle='#07080c';g.fillRect(X(tx),Y(my),tw*sc,0.7*sc);g.strokeStyle='#8a92bd';g.lineWidth=2;g.strokeRect(X(tx),Y(my),tw*sc,0.7*sc);}
 }
 // your weapon range
 if(me&&me.hp>0){g.strokeStyle='rgba(77,159,255,.18)';g.lineWidth=1.5;g.setLineDash([6,6]);g.beginPath();g.arc(X(me.x),Y(me.y),STAT.range*sc,0,7);g.stroke();g.setLineDash([]);}
 // Moon Zone (and where it moves next)
 if(gzones&&gzones[0].next){const nz=gzones[0].next,k=Math.max(0,gzones[0].t)/ZONE_WARN,t=performance.now()/300;
  g.strokeStyle='#ffcf4a';g.globalAlpha=0.5+0.4*Math.sin(t);g.lineWidth=3;g.setLineDash([4,7]);g.beginPath();g.arc(X(nz.x),Y(nz.y),ZONE_R*sc,0,7);g.stroke();g.setLineDash([]);
  g.globalAlpha=0.9;g.lineWidth=4;g.beginPath();g.arc(X(nz.x),Y(nz.y),ZONE_R*sc+6,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-k));g.stroke();g.globalAlpha=1;
  g.fillStyle='#ffcf4a';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*0.95));g.fillText(Math.ceil(Math.max(0,gzones[0].t))+'',X(nz.x),Y(nz.y));g.textBaseline='top';}
 if(gzones)for(const z of gzones){const zx=X(z.x),zy=Y(z.y),zr=z.r*sc,t=performance.now()/600;
  const col=z.own===0?TC[0]:z.own===1?TC[1]:'#c9d6e3';
  g.globalAlpha=0.14+0.05*Math.sin(t*2);g.fillStyle=col;g.beginPath();g.arc(zx,zy,zr,0,7);g.fill();g.globalAlpha=1;
  g.strokeStyle=col;g.lineWidth=2;g.setLineDash([8,6]);g.lineDashOffset=-t*12;g.beginPath();g.arc(zx,zy,zr,0,7);g.stroke();g.setLineDash([]);g.lineDashOffset=0;
  if(Math.abs(z.cap)>0.01){g.strokeStyle=z.cap<0?TC[0]:TC[1];g.lineWidth=5;g.beginPath();g.arc(zx,zy,zr+4,-Math.PI/2,-Math.PI/2+Math.PI*2*z.cap,z.cap<0);g.stroke();}
  g.fillStyle=col;g.globalAlpha=0.8;g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*1.1));g.fillText('☾',zx,zy);g.globalAlpha=1;g.textBaseline='top';}
 if(cry)cry.loose.forEach((c,i)=>{if(c.l===0)drawCrystal(c,i);});
 for(const bxx of boxes){const bx=X(bxx.x),by=Y(bxx.y),sz=sc*0.9*(1+0.08*Math.sin(performance.now()/200));
  g.fillStyle='#ffcf4a';g.fillRect(bx-sz/2,by-sz/2,sz,sz);g.strokeStyle='#7a5a00';g.lineWidth=2;g.strokeRect(bx-sz/2,by-sz/2,sz,sz);
  g.fillStyle='#4a3500';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sz*0.8));g.fillText('?',bx,by+1);g.textBaseline='top';}
 for(const q of bullets){g.fillStyle=tcol(q.o.team);g.beginPath();g.arc(X(q.x),Y(q.y),Math.max(2.5,sc*0.16)*Math.min(1.8,q.dm),0,7);g.fill();}
 // super telegraphs (lane for beam/shell, danger ring for nova) and super effects
 for(const r of units){
  if(!r.sup||r.hp<=0)continue;
  const S=SUP[r.sup.w],k=1-r.sup.t/S.charge;
  if(S.kind==='nova'){g.globalAlpha=0.15+0.3*k;g.strokeStyle='#ff3b3b';g.lineWidth=3;g.beginPath();g.arc(X(r.x),Y(r.y),S.r*sc,0,7);g.stroke();g.globalAlpha=1;}
  else{const len=S.kind==='beam'?S.len:beamLen(r,r.sup.ang),wdt=S.kind==='beam'?S.w:1.2;
   g.save();g.translate(X(r.x),Y(r.y));g.rotate(r.sup.ang);g.globalAlpha=0.12+0.28*k;g.fillStyle='#ff3b3b';
   g.fillRect(0,-wdt*sc,len*sc,wdt*2*sc);g.globalAlpha=0.5+0.5*k;g.fillStyle='#ffb3b3';g.fillRect(0,-1,len*sc,2);g.restore();g.globalAlpha=1;}
 }
 for(const bm of beams){g.globalAlpha=Math.min(1,bm.t/0.15);g.strokeStyle=bm.c;g.lineWidth=Math.max(6,sc*0.9*(bm.w||1.25));g.lineCap='round';
  g.beginPath();g.moveTo(X(bm.ax),Y(bm.ay));g.lineTo(X(bm.bx),Y(bm.by));g.stroke();g.strokeStyle='#fff';g.lineWidth=Math.max(2,sc*0.3);g.stroke();g.lineCap='butt';g.globalAlpha=1;}
 for(const sh of shells){const sx=X(sh.x),sy=Y(sh.y),pr=sc*0.5*(1+0.15*Math.sin(performance.now()/60));
  g.fillStyle='#ff9d45';g.beginPath();g.arc(sx,sy,pr,0,7);g.fill();g.fillStyle='#ffcf4a';g.beginPath();g.arc(sx,sy,pr*0.55,0,7);g.fill();}
 for(const b of blasts){const k=1-b.t/b.t0,bx=X(b.x),by=Y(b.y),brad=b.r*sc*(0.3+0.7*k);
  g.globalAlpha=Math.max(0,b.t/b.t0);g.fillStyle=b.c;g.beginPath();g.arc(bx,by,brad,0,7);g.fill();
  g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.arc(bx,by,brad,0,7);g.stroke();g.globalAlpha=1;}
 for(const n of novas){const k=1-n.t/n.t0,nx=X(n.x),ny=Y(n.y);g.globalAlpha=Math.max(0,n.t/n.t0);
  for(let ring=0;ring<3;ring++){const rr2=n.r*sc*(0.25+0.75*k)*(1-ring*0.22);g.strokeStyle=n.c;g.lineWidth=4-ring;g.beginPath();
   for(let i=0;i<=26;i++){const a=i/26*Math.PI*2,vib=(Math.random()-0.5)*sc*0.35*(1-k*0.5);const px2=nx+Math.cos(a)*(rr2+vib),py2=ny+Math.sin(a)*(rr2+vib);if(i)g.lineTo(px2,py2);else g.moveTo(px2,py2);}
   g.stroke();}
  g.globalAlpha=1;}
 if(aim&&aim.on&&me&&me.hp>0){const S=SUP[me.wtype||'pulse'],a=aimAng(),px=X(me.x),py=Y(me.y);
  g.save();g.globalAlpha=0.5+0.2*Math.sin(performance.now()/100);
  if(S.kind==='nova'){g.strokeStyle='#ffd24a';g.lineWidth=3;g.setLineDash([6,5]);g.beginPath();g.arc(px,py,S.r*sc,0,7);g.stroke();}
  else{const len=S.kind==='beam'?S.len:Math.min(S.range,beamLen(me,a)),wd=S.kind==='beam'?S.w:0.5;
   g.translate(px,py);g.rotate(a);g.fillStyle='rgba(255,210,74,.22)';g.fillRect(0,-wd*sc,len*sc,wd*2*sc);
   g.strokeStyle='#ffd24a';g.lineWidth=2;g.setLineDash([8,6]);g.beginPath();g.moveTo(0,0);g.lineTo(len*sc,0);g.stroke();
   if(S.kind==='shell'){g.setLineDash([]);g.beginPath();g.arc(len*sc,0,S.r*sc,0,7);g.stroke();}}
  g.restore();}
 // tanks: ground level first (the bridge covers tanks in its tunnels)
 const drawOne=(b,col)=>{
  const px=X(b.x),py=Y(b.y),r=R*sc;
  g.save();g.globalAlpha=0.35;g.fillStyle=col;g.beginPath();g.ellipse(px,py+r*0.95,r*1.2,r*0.5,0,0,7);g.fill();g.restore();   // team underglow
  if(b.elev===1){g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(px+6,py+10,r*0.9,r*0.5,0,0,7);g.fill();}
  if(b.aura>0){const ac=b.aura>=3?'#e8f4ff':RCOL[b.aura],pl=b.aura>=2?0.5+0.5*Math.sin(performance.now()/420):0.5;   // rarity ring: rare, epic, legendary
   g.save();g.globalAlpha=0.3+0.3*pl;g.strokeStyle=ac;g.lineWidth=b.aura>=2?2.4:1.5;g.beginPath();g.ellipse(px,py+r*0.2,r*1.45,r*1.1,0,0,7);g.stroke();
   if(b.aura>=2){g.globalAlpha=0.07+0.07*pl;g.fillStyle=ac;g.fill();}g.restore();}
  if(b.isPlayer&&save.skin==='lunar'){g.strokeStyle='rgba(232,244,255,.6)';g.lineWidth=2;g.beginPath();g.arc(px,py,r*1.3,0,7);g.stroke();}
  b.buffs.forEach((bf,i)=>{const rr2=r*(1.6+0.22*i),left=Math.max(0,1-bf.taken/BUFF_LIFE);g.strokeStyle=BUFF[bf.k].c;g.lineWidth=2.5;
   g.globalAlpha=0.2;g.beginPath();g.arc(px,py,rr2,0,7);g.stroke();g.globalAlpha=1;
   g.beginPath();g.arc(px,py,rr2,-Math.PI/2,-Math.PI/2+Math.PI*2*left);g.stroke();});
  if((spdMult(b)>1||b.dash)&&b.trail){b.trail.forEach((t,i)=>{g.globalAlpha=0.08+0.05*i;g.fillStyle=col;g.beginPath();g.arc(X(t.x),Y(t.y),r*0.7,0,7);g.fill();});g.globalAlpha=1;}
  drawTank(b,b.isPlayer&&save.skin==='lunar'?'#e8f4ff':col);
 };
 for(const u of units)if(u.team!==0&&(u.elev||0)===0&&u.hp>0)drawOne(u,tcol(u.team));
 for(const u of units)if(u.team===0&&(u.elev||0)===0&&u.hp>0)drawOne(u,TC[0]);
 // the bridge goes OVER ground tanks; tunnel stretches are see-through so you can track tanks under it
 if(BR){
  const [dx,dy,dw,dh]=BR.deck,meUnder=me&&underDeck(me);
  let x0=dx;const spans=[];for(const [tx,tw] of BR.tunnels){spans.push([x0,tx-x0,1]);spans.push([tx,tw,0]);x0=tx+tw;}spans.push([x0,dx+dw-x0,1]);
  for(const [sx,sw,solid] of spans){g.globalAlpha=solid?(meUnder?0.8:1):(meUnder?0.35:0.72);g.fillStyle='#454b6c';g.fillRect(X(sx),Y(dy),sw*sc,dh*sc);}
  g.globalAlpha=1;
  g.strokeStyle='rgba(255,207,74,.55)';g.lineWidth=2;g.setLineDash([sc*0.7,sc*0.5]);g.beginPath();g.moveTo(X(dx+0.4),Y(dy+dh/2));g.lineTo(X(dx+dw-0.4),Y(dy+dh/2));g.stroke();g.setLineDash([]);
  g.fillStyle='#7a82ad';g.fillRect(X(dx),Y(dy),dw*sc,Math.max(3,sc*0.18));g.fillRect(X(dx),Y(dy+dh)-Math.max(3,sc*0.18),dw*sc,Math.max(3,sc*0.18));
  g.fillStyle='#2b2f45';g.fillRect(X(dx),Y(dy+dh),dw*sc,Math.max(4,sc*0.35));
  for(const [tx,tw] of BR.tunnels){g.strokeStyle='rgba(200,215,255,.35)';g.lineWidth=1.5;g.setLineDash([5,5]);g.strokeRect(X(tx),Y(dy),tw*sc,dh*sc);g.setLineDash([]);
   g.fillStyle='rgba(200,215,255,.55)';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*0.5));g.fillText('TUNNEL',X(tx+tw/2),Y(dy+dh*0.25));g.textBaseline='top';}
  for(const [rx,ry,rw,rh,o] of BR.ramps){
   const grd=g.createLinearGradient(0,Y(o<0?ry:ry+rh),0,Y(o<0?ry+rh:ry));grd.addColorStop(0,'#2e3247');grd.addColorStop(1,'#454b6c');
   g.fillStyle=grd;g.fillRect(X(rx),Y(ry),rw*sc,rh*sc);
   g.strokeStyle='rgba(255,207,74,.5)';g.lineWidth=1.5;
   for(let i=1;i<5;i++){const yy=Y(ry+rh*i/5);g.beginPath();g.moveTo(X(rx)+3,yy);g.lineTo(X(rx+rw)-3,yy);g.stroke();}
   g.fillStyle='#8a92bd';g.fillRect(X(rx-0.2),Y(ry),0.2*sc,rh*sc);g.fillRect(X(rx+rw),Y(ry),0.2*sc,rh*sc);
   g.fillStyle='rgba(255,207,74,.85)';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*0.75));g.fillText(o<0?'▲':'▼',X(rx+rw/2),Y(o<0?ry+0.5:ry+rh-0.5));g.textBaseline='top';
  }
 }
 if(cry)cry.loose.forEach((c,i)=>{if(c.l===1)drawCrystal(c,i);});   // crystals on the bridge deck
 for(const u of units)if(u.team!==0&&(u.elev||0)===1&&u.hp>0)drawOne(u,tcol(u.team));
 for(const u of units)if(u.team===0&&(u.elev||0)===1&&u.hp>0)drawOne(u,TC[0]);
 if(storm){   // Last Standing: everything outside the ring is storm
  const sx=X(storm.x),sy=Y(storm.y),srad=Math.max(0,storm.r*sc),t=performance.now()/1000;
  g.save();g.beginPath();g.rect(X(0),Y(0),W*sc,H*sc);g.moveTo(sx+srad,sy);g.arc(sx,sy,srad,0,Math.PI*2,true);g.fillStyle='rgba(104,48,184,.32)';g.fill('evenodd');
  g.strokeStyle='rgba(199,155,255,.9)';g.lineWidth=3;g.setLineDash([10,7]);g.lineDashOffset=-t*20;g.beginPath();g.arc(sx,sy,srad,0,7);g.stroke();g.setLineDash([]);g.lineDashOffset=0;g.restore();}
 g.restore();   // end arena clip
 g.strokeStyle='#59607a';g.lineWidth=2;g.strokeRect(X(0),Y(0),W*sc,H*sc);
 // floating text: labels stay on screen, damage numbers merge
 g.save();g.beginPath();g.rect(X(0),Y(0),W*sc,H*sc);g.clip();
 const lx=(x,txt)=>{const hw=g.measureText(txt).width/2+4;return Math.max(X(0)+hw,Math.min(X(W)-hw,x));};
 for(const q of pops){g.globalAlpha=Math.min(1,q.t);g.fillStyle=q.c;g.textAlign='center';g.font=font(Math.round(sc*0.8));g.fillText(q.txt,lx(X(q.x),q.txt),Math.max(Y(0)+4,Y(q.y)-sc*(1.4-q.t)*1.2-sc));g.globalAlpha=1;}
 for(const q of nums){if(!q.txt)continue;g.globalAlpha=Math.min(1,q.t/0.4)*(q.g?0.7:1);g.fillStyle=q.c;g.textAlign='center';g.font=font(Math.round(sc*0.66*(q.z||1)));g.fillText(q.txt,lx(X(q.x),q.txt),Math.max(Y(0)+4,Y(q.y)-sc*(0.9-q.t)*1.6));g.globalAlpha=1;}
 g.restore();
 g.restore();   // end shake
 drawHUD();
}
function drawHUD(){
 const top=oy-HUD*sc,mid=X(W/2),pad=Math.max(8,sc*0.4);
 const hy=top+sc*0.35,bh=Math.max(10,sc*0.62),bw=Math.min(sc*7.2,(vw-pad*2)/2-sc*2.6);
 g.textBaseline='middle';
 const n=MODES[modeKey()].n,solo=!!storm,topLine=!!(gzones||cry||storm||matchG==='bounty');
 const side=(t,left)=>{
  const x0=left?pad:vw-pad-bw,col=TC[t];
  let lbl=(t===0?'You':'Foes')+(n>1&&!solo?' ×'+aliveCount(t):'');
  if(solo&&t===1)lbl=units.filter(u=>u!==me&&u.hp>0).length+' left';
  g.font=font(Math.round(sc*0.78));g.fillStyle=col;g.textAlign=left?'left':'right';g.fillText(lbl,left?x0:x0+bw,hy+sc*0.45);
  if(series){const lw=g.measureText(lbl).width,pr=Math.max(3,sc*0.2);for(let i=0;i<2;i++){const cx=left?x0+lw+sc*0.55+i*pr*2.8:x0+bw-lw-sc*0.55-i*pr*2.8;
   g.beginPath();g.arc(cx,hy+sc*0.45,pr,0,7);if(series.w[t]>i){g.fillStyle=col;g.fill();}else{g.strokeStyle=col;g.lineWidth=1.5;g.stroke();}}}
  let frac,txt;const by=hy+sc*1.05;
  if(gzones){frac=gscore[t]/ZONE_WIN;txt=Math.floor(gscore[t])+'';}
  else if(cry){frac=cry.cnt[t]/CRY_GOAL;txt=cry.cnt[t]+(cry.cnt[t]===1?' crystal':' crystals');}
  else if(matchG==='bounty'){frac=gscore[t]/Math.max(10,gscore[0],gscore[1]);txt=gscore[t]+(gscore[t]===1?' star':' stars');}
  else if(solo&&t===1){   // tanks still in the fight, as pips
   const foes=units.filter(u=>u!==me),pr=Math.max(3.5,bh*0.42),gap=(bw-pr*2)/Math.max(1,foes.length-1);
   foes.forEach((u,i)=>{const cx=x0+bw-pr-i*gap;g.beginPath();g.arc(cx,by+bh/2,pr,0,7);if(u.hp>0){g.fillStyle=col;g.fill();}else{g.strokeStyle='rgba(255,77,94,.45)';g.lineWidth=1.5;g.stroke();}});
   return;}
  else if(solo){frac=me.hp/me.mhp;txt=Math.round(Math.max(0,me.hp))+'';}
  else{frac=teamHpFrac(t);txt=Math.round(units.filter(u=>u.team===t).reduce((a,u)=>a+Math.max(0,u.hp),0))+'';}
  g.fillStyle='rgba(255,255,255,.08)';rr(g,x0,by,bw,bh,bh/2);g.fill();
  const fw=Math.max(0,Math.min(1,frac))*bw;
  if(fw>0){g.fillStyle=col;g.save();rr(g,x0,by,bw,bh,bh/2);g.clip();g.fillRect(left?x0:x0+bw-fw,by,fw,bh);g.restore();}
  g.font=font(Math.round(bh*0.85));g.fillStyle='#fff';g.textAlign=left?'left':'right';g.fillText(txt,left?x0+6:x0+bw-6,by+bh/2+1);
 };
 side(0,true);side(1,false);
 // timer pill
 const tl=Math.max(0,Math.ceil(timeLeft)),mm=Math.floor(tl/60),ss=String(tl%60).padStart(2,'0');
 const tw=sc*3.6,th=sc*1.5;g.fillStyle='rgba(10,14,23,.85)';rr(g,mid-tw/2,hy,tw,th,th/2);g.fill();g.strokeStyle=tl<=10?'#ff6b5e':'rgba(223,231,242,.18)';g.lineWidth=1.5;rr(g,mid-tw/2,hy,tw,th,th/2);g.stroke();
 g.fillStyle=tl<=10?'#ff8a7e':'#dfe7f2';g.textAlign='center';g.font=font(Math.round(sc*1.05));g.fillText(mm+':'+ss,mid,hy+th/2+1);
 if(series){g.font=font(Math.round(sc*0.6));g.fillStyle='rgba(223,231,242,.7)';g.textAlign='center';g.fillText('Round '+series.round,mid,hy+th+sc*0.55);}
 else if(matchG==='bounty'&&me&&!evt){g.font=font(Math.round(sc*0.6));g.fillStyle='#ffcf4a';g.textAlign='center';g.fillText('Your bounty: '+(me.bty||BTY_START),mid,hy+th+sc*0.55);}
 if(evt&&evt.k!=='drop'){g.font=font(Math.round(sc*0.6));g.fillStyle=EVENTS[evt.k].c;g.textAlign='center';g.fillText((evt.k==='meteor'?'Meteor shower ':'Solar flare ')+Math.ceil(evt.t)+'s',mid,hy+th+sc*0.55);}
 const outRing=!!storm&&me&&me.hp>0&&Math.hypot(me.x-storm.x,me.y-storm.y)>storm.r;
 if(me&&me.hp>0&&state==='play'&&slowAt(me)<1&&!(me.rep>0)&&!outRing){g.fillStyle='#c9b48a';g.font=font(Math.round(sc*0.62));g.textAlign='center';g.fillText('crater: slowed',X(me.x),Y(me.y)+sc*1.4);}
 if(ffBtnOn()){const F=ffBtn();g.fillStyle=ffwd?'rgba(255,122,47,.92)':'rgba(10,14,23,.88)';rr(g,F.x,F.y,F.w,F.h,F.h/2);g.fill();g.strokeStyle=ffwd?'#ffb37a':'rgba(223,231,242,.4)';g.lineWidth=1.5;rr(g,F.x,F.y,F.w,F.h,F.h/2);g.stroke();
  g.fillStyle=ffwd?'#2a1004':'#dfe7f2';g.font=font(15);g.textAlign='center';g.fillText(ffwd?'Speeding up ×3':'Fast forward',F.x+F.w/2,F.y+F.h/2+1);}
 g.textAlign='center';
 if(gzones){const z=gzones[0];g.font=font(Math.round(sc*0.62));g.fillStyle=z.next?'#ffcf4a':'rgba(223,231,242,.6)';
  g.fillText((z.next?'Zone moving in ':'Zone moves in ')+Math.ceil(Math.max(0,z.t))+'s',mid,Y(0)+sc*0.6);}
 if(cry){if(cry.cd){const ours=cry.cd.team===0;g.font=font(Math.round(sc*0.95));g.fillStyle=ours?'#5fe3a1':'#ff6b5e';g.fillText((ours?'You win in ':'They win in ')+Math.ceil(Math.max(0,cry.cd.t)),mid,Y(0)+sc*0.75);}
  else{g.font=font(Math.round(sc*0.62));g.fillStyle='rgba(223,231,242,.6)';g.fillText('Hold 10 crystals for 15s to win',mid,Y(0)+sc*0.6);}}
 if(matchG==='bounty'){g.font=font(Math.round(sc*0.62));g.fillStyle='rgba(223,231,242,.6)';g.fillText('Most stars wins',mid,Y(0)+sc*0.6);}
 if(storm){const closing=elapsed>=STORM_T0;g.font=font(Math.round(sc*0.62));g.fillStyle=closing?'#c79bff':'rgba(223,231,242,.6)';
  g.fillText(closing?(storm.r>STORM_R1+0.01?'The ring is closing':'Final ring'):'Ring closes in '+Math.ceil(STORM_T0-elapsed)+'s',mid,Y(0)+sc*0.6);
  if(outRing){g.fillStyle='#e7cbff';g.font=font(Math.round(sc*0.72));g.fillText('Get inside the ring!',X(me.x),Y(me.y)+sc*1.45);}}
 if(respawns()){
  if(me.hp>0&&me.rep>0){g.fillStyle='#5fe3a1';g.font=font(Math.round(sc*0.62));g.fillText('+ repairing',X(me.x),Y(me.y)+sc*1.4);}
  if(me.hp<=0&&state==='play'){g.fillStyle='rgba(255,255,255,.92)';g.font=font(Math.round(sc*1.1));g.fillText('Back in '+Math.max(1,Math.ceil(respawnFor(me)-(me.dead||0))),mid,Y(H/2)-sc*2);}}
 // buff chips for you
 me.buffs.forEach((b,i)=>{const w=sc*1.9,h=sc*0.9,x=X(0)+4+i*(w+3),y=Y(0)+4;
  g.fillStyle=BUFF[b.k].c;rr(g,x,y,w,h,3);g.fill();g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,y+h-3,w*(1-b.taken/BUFF_LIFE),3);
  g.fillStyle='#10161d';g.textAlign='center';g.font=font(Math.round(sc*0.55));g.fillText(BUFF[b.k].n,x+w/2,y+h/2);});
 // counter banner
 if(banner){g.globalAlpha=Math.min(1,banner.t*2);g.font=font(Math.round(sc*0.72));const bw2=g.measureText(banner.txt).width+26,bh2=sc*1.3,bx2=mid-bw2/2,by2=Y(0)+sc*(topLine?1.5:0.5);
  g.fillStyle='rgba(8,12,18,.88)';rr(g,bx2,by2,bw2,bh2,bh2/2);g.fill();g.strokeStyle=banner.c;g.lineWidth=1.5;rr(g,bx2,by2,bw2,bh2,bh2/2);g.stroke();
  g.fillStyle=banner.c;g.textAlign='center';g.fillText(banner.txt,mid,by2+bh2/2+1);g.globalAlpha=1;}
 // joystick
 if(joy.on){g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=2;g.beginPath();g.arc(joy.sx,joy.sy,55,0,7);g.stroke();
  g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(joy.x,joy.y,22,0,7);g.fill();}
 // tutorial coaching
 if(tut&&state==='play'&&TUT_STEPS[tut.step]){const S=TUT_STEPS[tut.step];if(!S.wait||S.wait()){
  g.font=font(Math.round(Math.max(13,sc*0.8)));
  const maxW=vw-48;let lines=[S.txt];
  if(g.measureText(S.txt).width>maxW){const ws=S.txt.split(' ');let best=1,bd=1e9;for(let i=1;i<ws.length;i++){const a=ws.slice(0,i).join(' '),b=ws.slice(i).join(' '),d=Math.abs(g.measureText(a).width-g.measureText(b).width);if(d<bd){bd=d;best=i;}}lines=[ws.slice(0,best).join(' '),ws.slice(best).join(' ')];}
  const lh=Math.max(17,sc*1.0),tw2=Math.min(vw-24,Math.max(...lines.map(l=>g.measureText(l).width))+32),th2=lh*lines.length+sc*0.8,ty=Y(H)-sc*7.5;
  g.globalAlpha=0.92;g.fillStyle='#0a0e17';rr(g,mid-tw2/2,ty,tw2,th2,10);g.fill();g.globalAlpha=1;g.strokeStyle='#ff7a2f';g.lineWidth=2;rr(g,mid-tw2/2,ty,tw2,th2,10);g.stroke();
  g.fillStyle='#fff';g.textAlign='center';lines.forEach((l,i)=>g.fillText(l,mid,ty+sc*0.4+lh*(i+0.5)+1));}}
 // you got hit: red edges; low health: slow red pulse
 if(state==='play'&&me){const low=me.hp>0&&me.hp/me.mhp<0.3,k=Math.max((me.hurtT||0)/0.3*0.55,low?0.25+0.2*Math.sin(performance.now()/260):0);
  if(k>0.01){const vg=g.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*0.35,vw/2,vh/2,Math.max(vw,vh)*0.75);vg.addColorStop(0,'rgba(255,40,60,0)');vg.addColorStop(1,'rgba(255,40,60,'+k.toFixed(3)+')');g.fillStyle=vg;g.fillRect(0,0,vw,vh);}}
 // kill feed
 if(feed.length){g.textAlign='left';g.font=font(Math.round(Math.max(11,sc*0.6)));feed.forEach((f,i)=>{g.globalAlpha=Math.min(1,f.t);g.fillStyle='rgba(10,14,23,.75)';const tw3=g.measureText(f.txt).width+14,yy=Y(0)+sc*(topLine?3.0:2.0)+i*(sc*1.05+4);
  rr(g,X(0)+6,yy,tw3,sc*1.05,6);g.fill();g.fillStyle=f.c;g.fillText(f.txt,X(0)+13,yy+sc*0.53);});g.globalAlpha=1;}
 // DASH button with a cooldown ring
 if(state==='play'&&me.hp>0){const D=dashBtn(),cd=(me.dashCd||0)/DASH_CD,ready=cd<=0;
  g.fillStyle=ready?'rgba(77,159,255,.9)':'rgba(30,42,64,.9)';g.beginPath();g.arc(D.x,D.y,D.r,0,7);g.fill();
  if(!ready){g.strokeStyle='#4d9fff';g.lineWidth=4;g.beginPath();g.arc(D.x,D.y,D.r-3,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-cd));g.stroke();}
  g.fillStyle=ready?'#fff':'rgba(255,255,255,.5)';g.textAlign='center';g.font=font(Math.round(D.r*0.42));g.fillText('DASH',D.x,D.y+1);}
 // SUPER button with a charge ring
 if(state==='play'&&me.hp>0){const B=btn(),f=me.sp/SUPER_MAX,rdy=f>=1&&!me.sup&&me.hp>0;
  g.fillStyle=rdy?'#e0242f':'#3a1a1d';g.beginPath();g.arc(B.x,B.y,B.r,0,7);g.fill();
  g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=5;g.beginPath();g.arc(B.x,B.y,B.r-4,0,7);g.stroke();
  g.strokeStyle=rdy?'#fff':'#ff6b6b';g.beginPath();g.arc(B.x,B.y,B.r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,f));g.stroke();
  g.fillStyle=rdy?'#fff':'rgba(255,255,255,.55)';g.textAlign='center';g.font=font(Math.round(B.r*0.42));g.fillText('SUPER',B.x,B.y+1);
  if(rdy&&(save.mp||0)<6&&!aim){g.font=font(11);g.fillStyle='rgba(255,255,255,.7)';g.fillText('tap or drag to aim',B.x-6,B.y-B.r-12);}
  if(rdy){g.globalAlpha=0.25+0.25*Math.sin(performance.now()/120);g.strokeStyle='#ff4d4d';g.lineWidth=6;g.beginPath();g.arc(B.x,B.y,B.r+6,0,7);g.stroke();g.globalAlpha=1;}}
 g.textBaseline='top';
}
