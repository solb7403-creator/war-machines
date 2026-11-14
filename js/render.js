'use strict';
// =====================================================================
// render: battle canvas (arena, tanks, effects, HUD), shared art (tanks, crates, map thumbnails), battle input
// =====================================================================
const cv=document.getElementById('c'),g=cv.getContext('2d');
const dpr=Math.min(devicePixelRatio||1,2);
const HUD=2.6;
let sc=1,ox=0,oy=0,vw=0,vh=0,SAB=0,SAT=0,GK=1,KEYHINT=false;   // GK: how much the ground squashes vertically (1 in 2D; the tilted 3D camera's cosine in 3D)
function fit(){vw=cv.clientWidth||innerWidth;vh=cv.clientHeight||innerHeight;cv.width=vw*dpr;cv.height=vh*dpr;
 const pr=document.getElementById('sab');SAB=pr?pr.offsetHeight:0;   // home-indicator height (probe element sized by CSS env())
 {let pt=document.getElementById('sat');if(!pt&&document.body){pt=document.createElement('div');pt.id='sat';pt.style.cssText='position:fixed;left:0;top:0;width:1px;height:var(--sat,0px);visibility:hidden;pointer-events:none';document.body.appendChild(pt);}SAT=pt?pt.offsetHeight:0;}   // the notch / Telegram header, for the chase camera's HUD
 sc=Math.min(vw/W,vh/(H*GK+HUD));ox=(vw-W*sc)/2;oy=(vh-(H*GK+HUD)*sc)/2+HUD*sc;
 KEYHINT=vw>=900&&typeof matchMedia==='function'&&matchMedia('(pointer:fine)').matches;   // a keyboard is likely: the chase HUD names the keys on its buttons
 if(typeof setPR==='function')setPR();}
addEventListener('resize',fit);fit();
const X=x=>ox+x*sc,Y=y=>oy+y*sc*GK;
const D3on=()=>typeof use3D==='function'&&use3D();
const liftOf=b=>D3on()?heightAt(b)*GSN*sc:0;   // a tank on the Overpass deck sits higher on screen in 3D
// ---- where the world is on the screen ----
// 2D and the fixed tilted 3D view: one scale and one squash (X, Y). The Arcade chase camera (js/arenacam.js, Session 5E-2b2a)
// is a perspective view: WP(x,y,h) puts a world point on the screen (WPx, WPy) with the pixels per world unit at its depth
// (WPk), and ground shapes (rings, lanes) are drawn through the camera. Everything the overlay draws goes through these.
const CAM=()=>typeof chaseOn==='function'&&chaseOn();
let WPx=0,WPy=0,WPk=1;const WPo={x:0,y:0,k:1,d:1,ok:true};
function WP(x,y,h){if(CAM()){ArenaCam.project(x,y,h||0,WPo);WPx=WPo.x;WPy=WPo.y;WPk=WPo.k;return WPo.ok;}WPx=X(x);WPy=Y(y)-(h?h*GSN*sc:0);WPk=sc;return true;}
const hOf=b=>D3on()?heightAt(b):0;   // how high a tank stands (the deck, a ramp)
const HPT={x:0,y:0,elev:1};
// how high the surface a falling thing lands on is at (x,y): the deck or a ramp where there is one (a meteor hits the tank
// on the deck, never one in the tunnel below it), else the ground
const hTop=(x,y)=>D3on()&&BR&&(inDeck(x,y)||rampAt(x,y))?(HPT.x=x,HPT.y=y,heightAt(HPT)):0;
// the height an enemy's super is drawn at for you: your own level when it can reach you from another level (a lane fired
// from the deck is drawn on the ground you stand on, where it will hit you), else the shooter's
const hSup=r=>me&&me.hp>0&&r.team!==me.team&&(r.elev||0)!==(me.elev||0)&&lvOK(r,me)?hOf(me):hOf(r);
// A tank deep under a bridge deck is out of the camera's sight (the deck is solid, nothing is see-through): its health bar
// and marker hang under the lip of the tunnel's near mouth instead of floating on the deck as if it stood up there.
// Returns true when pinned. Your own tank is never pinned: the camera goes down to it.
let WPtop=0,WPslot=0;   // WPtop: where the tank's top is on the screen; WPslot: its place in the stack of bars hanging at one tunnel mouth
const pinned=b=>{if(!BR||b===me||(b.elev||0)!==0||b.hp<=0)return false;const d=BR.deck;return b.x>d[0]&&b.x<d[0]+d[2]&&b.y>d[1]&&b.y<d[1]+d[3]-0.9;};
function WPunit(b){
 if(CAM()&&ArenaCam.C.pitch>30&&pinned(b)){const d=BR.deck,t=BR.tunnels.find(t=>b.x>=t[0]&&b.x<=t[0]+t[1]);WPslot=0;for(const u of units)if(u!==b&&u.id<b.id&&pinned(u)&&(!t||u.x>=t[0]&&u.x<=t[0]+t[1]))WPslot++;
  WP(t?t[0]+t[1]/2:b.x,d[1]+d[3]+0.02,(typeof B3!=='undefined'&&B3.map&&B3.map.deckUnder||1.8)-0.1);WPtop=WPy;return true;}
 const h=hOf(b);if(CAM()){WP(b.x,b.y,h+1.1*(b.dscale||1)*(b.boss?1.5:1));WPtop=WPy;}WP(b.x,b.y,h);if(!CAM())WPtop=WPy;return false;
}
const KU=()=>CAM()?Math.max(sc*0.8,Math.min(sc*1.3,WPk)):sc;   // the size of a label by a tank: it follows the tank's depth, within limits, so far labels stay readable
const hudTop=()=>CAM()?SAT+Math.max(6,sc*0.3):oy-HUD*sc,hudY0=()=>hudTop()+HUD*sc,hudX0=()=>CAM()?Math.max(8,sc*0.4):X(0);   // the chase camera has no arena rectangle: the HUD hangs from the top of the screen
const gArc=(x,y,r,a0,a1,ccw,h)=>CAM()?ArenaCam.arc(g,x,y,r,a0,a1,ccw,h||0):g.ellipse(X(x),Y(y),Math.max(0,r*sc),Math.max(0,r*sc*GK),0,a0===undefined?0:a0,a1===undefined?Math.PI*2:a1,!!ccw);   // a circle lying on the ground
// floating text under the chase camera: where a text of width w and height fh centred at (x,y) may go. It is pushed clear of
// the minimap and the buttons, kept on the screen, and lifted line by line off texts already placed this frame (TXO: the result)
const TXR=[],TXO=[0,0];let TXN=0;
// a floating text's width at a font size: measured once per text (at 100 px), not every frame
function txtW(q,fs){if(q.w1===undefined||q.wt!==q.txt){const f=g.font;g.font=font(100);q.w1=g.measureText(q.txt).width/100;q.wt=q.txt;g.font=f;}return q.w1*fs;}
function txtAt(x,y,w,fh){
 const M=miniRect(),Z=btnZone(),hw=w/2+3;
 if(y<M.y+M.h+6&&x-hw<M.x+M.w+6)x=M.x+M.w+6+hw;
 if(y+fh>Z.y&&x+hw>Z.x)y=Z.y-fh;
 x=Math.max(hw+2,Math.min(vw-hw-2,x));
 for(let pass=0;pass<5;pass++){let hit=false;for(let i=0;i<TXN;i++){const r=TXR[i];if(Math.abs(x-r[0])<hw+r[2]&&Math.abs(y-r[1])<(fh+r[3])*0.5){y=r[1]-(fh+r[3])*0.5-1;hit=true;}}if(!hit)break;}
 const r=TXR[TXN]||(TXR[TXN]=[0,0,0,0]);r[0]=x;r[1]=y;r[2]=hw;r[3]=fh;TXN++;TXO[0]=x;TXO[1]=y;
}
// a super's lane on the ground under the chase camera: from (x,y) along a, len long, hw to each side; mid: its centre line
function gLane(x,y,h,a,len,hw,fill,mid,dash){
 if(fill){g.beginPath();ArenaCam.lane(g,x,y,a,len,hw,h);g.fill();}
 if(mid){LN[0]=x;LN[1]=y;LN[2]=h;LN[3]=x+Math.cos(a)*len;LN[4]=y+Math.sin(a)*len;LN[5]=h;g.beginPath();ArenaCam.path(g,LN,false);if(dash)g.setLineDash(dash);g.lineWidth=2;g.stroke();g.setLineDash([]);}
}
const LN=[0,0,0,0,0,0];
const FONT_FAMILY='"Chakra Petch","Arial Narrow",system-ui,sans-serif';
const font=s=>'600 '+s+'px '+FONT_FAMILY;
const C={floor:'#1d2330',grid:'#283042',wall:'#4a4e5e',wallTop:'#6e7490',star:'#ffffff'};
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function diamond(ctx,x,y,s,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*0.7,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*0.7,y);ctx.closePath();ctx.fill();}

// ---- Crystal tank, top-down: hull follows movement, turret + cannon follow the aim ----
function drawTankPx(ctx,px,py,r,hd,ang,col,gems,wtype,flash,parts,paint,fits,skin,ap){
 const fl=flash||null,P=skin==='lunar'?(paint&&paint.hull!=='#2c3a49'?{hull:paint.hull,tur:paint.tur,trim:'#bb914e',shine:true}:{hull:'#252b34',tur:'#333c47',trim:'#bb914e',shine:true}):paint||PAINTS.stock;parts=parts||3;   // 1 = hull only, 2 = turret only, 3 = whole tank. Paint colors the plates; team color stays on tracks and core
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
 if(skin==='lunar'){
  ctx.strokeStyle='#bd944e';ctx.lineWidth=Math.max(1,r*.035);for(const sd of [-1,1]){ctx.strokeRect(-.7*r,sd*.39*r-.08*r,.58*r,.16*r);for(let i=0;i<8;i++){ctx.fillStyle='#48505a';ctx.fillRect((-1.13+i*.3)*r,sd*.64*r-.29*r,.10*r,.58*r);}}
  ctx.beginPath();ctx.arc(.78*r,0,.16*r,.7,5.58);ctx.stroke();
 }
 if(Array.isArray(ap)&&ap.some(Boolean)&&!fl){   // Hull Plating: tier-colored plate outlines (FRONT glacis, side skirts) and a set glow ring
  const pc=t=>MINERALS[MN_ORDER[t-1]].c,lw=Math.max(1.2,r*.11);ctx.lineCap='round';
  if(ap[0]){ctx.strokeStyle=pc(ap[0]);ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(.88*r,-.5*r);ctx.lineTo(1.1*r,-.24*r);ctx.lineTo(1.1*r,.24*r);ctx.lineTo(.88*r,.5*r);ctx.stroke();}
  for(const [i,sd] of [[1,-1],[2,1]])if(ap[i]){ctx.strokeStyle=pc(ap[i]);ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(-.9*r,sd*.95*r);ctx.lineTo(.8*r,sd*.95*r);ctx.stroke();}
  if(ap[3]){ctx.fillStyle=pc(ap[3]);for(const sd of [-1,1])ctx.fillRect(-.12*r,sd*.42*r-.05*r,.42*r,.1*r);}
  const set=Math.min(ap[0]|0,ap[1]|0,ap[2]|0,ap[3]|0);if(set>=5){ctx.globalAlpha=.4;ctx.strokeStyle=pc(set);ctx.lineWidth=Math.max(1,r*.06);ctx.beginPath();ctx.arc(0,0,1.32*r,0,7);ctx.stroke();ctx.globalAlpha=1;}
 }
 [[-0.8,-0.36],[-0.8,0],[-0.8,0.36]].forEach(([sx,sy],i)=>{   // 3 core sockets, lit all match
  const gk=gems&&gems[i],cx=sx*r,cy=sy*r;
  ctx.fillStyle='#0f151c';ctx.beginPath();ctx.arc(cx,cy,0.17*r,0,7);ctx.fill();
  if(gk&&GEM[gk]){ctx.globalAlpha=0.3;ctx.fillStyle=GEM[gk].c;ctx.beginPath();ctx.arc(cx,cy,0.28*r,0,7);ctx.fill();ctx.globalAlpha=1;
   ctx.fillStyle=GEM[gk].c;ctx.beginPath();ctx.moveTo(cx,cy-0.16*r);ctx.lineTo(cx+0.11*r,cy);ctx.lineTo(cx,cy+0.16*r);ctx.lineTo(cx-0.11*r,cy);ctx.closePath();ctx.fill();}
 });
 if(fits){
  if(fits.hull==='plates'){ctx.fillStyle='#8f9bad';for(const side of [-1,1])ctx.fillRect(-.75*r,side*.5*r-.09*r,1.1*r,.18*r);}
  if(fits.hull==='light'){ctx.strokeStyle=col;ctx.lineWidth=r*.07;for(const x of [-.7,-.4,-.1]){ctx.beginPath();ctx.moveTo(x*r,-.38*r);ctx.lineTo((x+.2)*r,.38*r);ctx.stroke();}}
  if(fits.mobility==='sprint'){ctx.fillStyle=col;for(const side of [-1,1])ctx.fillRect(-1.3*r,side*.72*r-.06*r,.55*r,.12*r);}
  if(fits.mobility==='stable'){ctx.fillStyle='#99a9ba';for(const side of [-1,1])for(const x of [-.7,.7]){ctx.beginPath();ctx.arc(x*r,side*.83*r,.18*r,0,7);ctx.fill();}}
 }
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
  ctx.fillStyle='#182431';ctx.fillRect(-.35*r,-.28*r,2.65*r,.56*r);
  ctx.fillStyle='#1686f5';ctx.fillRect(-.35*r,-.085*r,2.64*r,.17*r);
  ctx.fillStyle='#b9edff';ctx.fillRect(-.35*r,-.023*r,2.64*r,.046*r);
  for(const sd of [-1,1]){ctx.fillStyle='#ced8e4';ctx.fillRect(-.4*r,sd*.22*r-.03*r,2.7*r,.06*r);}
  for(const x of [-.25,.43,1.04,1.65,2.22]){ctx.fillStyle='#c39a51';ctx.fillRect(x*r,-.28*r,.085*r,.56*r);ctx.fillStyle='#70cfff';ctx.fillRect((x+.09)*r,-.24*r,.036*r,.48*r);}
  ctx.fillStyle='#e3faff';ctx.fillRect(2.29*r,-.25*r,.065*r,.5*r);
 }else{
  ctx.fillStyle='#141b24';ctx.fillRect(0.2*r,-0.17*r,1.55*r,0.34*r);
  ctx.fillStyle=col;ctx.fillRect(0.25*r,-0.04*r,1.4*r,0.08*r);
  ctx.fillStyle='#e9f1f7';ctx.fillRect(1.5*r,-0.23*r,0.3*r,0.46*r);
  ctx.fillStyle=col;ctx.fillRect(1.74*r,-0.12*r,0.1*r,0.24*r);
 }
 if(fits&&fits.mount!=='stock'){ctx.fillStyle='#95a7b9';if(fits.mount==='hardened')ctx.fillRect(.35*r,-.38*r,.4*r,.76*r);else for(const x of [.6,.85,1.1])ctx.fillRect(x*r,-.3*r,.09*r,.6*r);}
 ctx.fillStyle=fl||P.tur;ctx.beginPath();ctx.arc(0,0,0.56*r,0,7);ctx.fill();
 ctx.strokeStyle=P===PAINTS.stock?'#e9f1f7':P.trim;ctx.lineWidth=Math.max(1,r*0.09);ctx.stroke();
 ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0.32*r,0);ctx.lineTo(0,0.26*r);ctx.lineTo(-0.32*r,0);ctx.lineTo(0,-0.26*r);ctx.closePath();ctx.fill();   // core crystal
 ctx.restore();
}
function star5(ctx,x,y,r,c){ctx.fillStyle=c;ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*0.45:r;ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}ctx.closePath();ctx.fill();}
function drawTank(b,col){
 const pin=WPunit(b),px=WPx,ku=KU(),r=R*(CAM()?Math.max(sc*0.62,Math.min(sc*1.9,WPk)):sc)*(b.dscale||1)*(pin?0.8:1),py=pin?WPy+r*(3.1+WPslot*2.1):CAM()?WPtop+r*1.2:WPy,hd=b.hd===undefined?b.ang:b.hd;   // chase camera: the bar hangs a fixed way above the tank's top, whatever the pitch
 const fl=b.flash>0?(armor(b)>0?BUFF.arm.c:'#ffe27a'):null;
 if(!D3on())drawTankPx(g,px,py,r,hd,b.ang,col,b.gems,b.wtype,fl,3,PAINTS[b.paint],b.fits,b.skin,b.ap);
 if(b.mhp){   // health bar (team colored) with the super meter as a thin strip underneath
  const bw=2.6*r,bx=px-bw/2,by=py-2.25*r,hh=Math.max(4,0.36*r),sh=Math.max(2,0.16*r),hf=Math.max(0,b.hp/b.mhp),f=b.sp/SUPER_MAX;
  g.fillStyle='rgba(0,0,0,.65)';g.fillRect(bx-1.5,by-1.5,bw+3,hh+sh+4);
  g.fillStyle=b.team!==0?'#ff4d5e':b===me?'#5fe3a1':'#4d9fff';g.fillRect(bx,by,bw*hf,hh);
  g.fillStyle=f>=1?(Math.floor(performance.now()/150)%2?'#ff4d4d':'#ffb3b3'):'#ffcf4a';g.fillRect(bx,by+hh+1,bw*f,sh);
  if(pin){const s=Math.max(6,r*0.7),cy=by+hh+sh+5;g.fillStyle=b.team!==0?'#ff4d5e':'#4d9fff';g.strokeStyle='rgba(0,0,0,.7)';g.lineWidth=1.5;for(const dx of [-s*1.3,0,s*1.3]){g.beginPath();g.moveTo(px+dx-s*0.55,cy);g.lineTo(px+dx+s*0.55,cy);g.lineTo(px+dx,cy+s*0.8);g.closePath();g.stroke();g.fill();}}   // three small arrows down: this tank is under the deck
  // the counter triangle, read from your side: a green ▲ by the bar of a tank you counter, a red ▼ on one that counters you
  if(me&&b!==me&&b.team!==me.team&&!b.boss&&!me.boss&&me.hp>0){const up=COUNTER[me.cls]===b.cls,dn=COUNTER[b.cls]===me.cls;
   if(up||dn){const s=Math.max(5,(hh+sh)*0.95),cx=bx-s-4,cy=by+(hh+sh+1)/2;g.beginPath();
    if(up){g.moveTo(cx,cy-s*0.8);g.lineTo(cx+s,cy+s*0.6);g.lineTo(cx-s,cy+s*0.6);}else{g.moveTo(cx,cy+s*0.8);g.lineTo(cx+s,cy-s*0.6);g.lineTo(cx-s,cy-s*0.6);}
    g.closePath();g.fillStyle=up?'#5fe3a1':'#ff6b5e';g.fill();g.lineWidth=1.5;g.strokeStyle='rgba(0,0,0,.7)';g.stroke();}}
  // what this tank is worth: crystals carried (Crystal Rush) or its bounty (Bounty)
  const n=cry&&b.cry>0?b.cry:matchG==='bounty'&&b.bty?b.bty:0;
  if(n){const isC=!!cry,fs=Math.max(10,Math.round(ku*0.56)),ty=by-fs*0.75;g.font=font(fs);g.textBaseline='middle';
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
// Canyon's mesa: the same deck, ramps and arch as the Overpass bridge (same rules), drawn as a rock plateau
function drawMesa2D(meUnder){
 const [dx,dy,dw,dh]=BR.deck,sd=91;
 let x0=dx;const spans=[];for(const [tx,tw] of BR.tunnels){spans.push([x0,tx-x0,1]);spans.push([tx,tw,0]);x0=tx+tw;}spans.push([x0,dx+dw-x0,1]);
 g.save();g.globalAlpha=meUnder?0.8:1;
 g.fillStyle='#3c322b';g.fillRect(X(dx),Y(dy+dh),dw*sc,Math.max(4,sc*0.45));   // cliff face below the plateau's south rim
 const gr=g.createLinearGradient(X(dx+dw),Y(dy),X(dx),Y(dy+dh));gr.addColorStop(0,'#8a735f');gr.addColorStop(1,'#5c4c40');
 for(const [sx,sw,solid] of spans){g.globalAlpha=solid?(meUnder?0.8:1):(meUnder?0.35:0.72);g.fillStyle=solid?gr:'#6a584a';g.fillRect(X(sx),Y(dy),sw*sc,dh*sc);}
 g.globalAlpha=meUnder?0.8:1;g.save();g.beginPath();g.rect(X(dx),Y(dy),dw*sc,dh*sc);g.clip();
 g.strokeStyle='rgba(30,22,16,.35)';g.lineWidth=Math.max(1,sc*0.06);for(let k=0;k<12;k++){const yy=dy+hsh(k,sd)*dh,xx=dx+hsh(sd,k)*dw,l=0.8+hsh(k,3)*1.4;g.beginPath();g.moveTo(X(xx-l),Y(yy));g.quadraticCurveTo(X(xx),Y(yy+0.2),X(xx+l),Y(yy));g.stroke();}
 g.restore();
 g.strokeStyle='rgba(255,220,180,.35)';g.lineWidth=Math.max(1.5,sc*0.09);g.strokeRect(X(dx),Y(dy),dw*sc,dh*sc);
 for(const [tx,tw] of BR.tunnels){g.strokeStyle='rgba(255,220,180,.4)';g.lineWidth=1.5;g.setLineDash([5,5]);g.strokeRect(X(tx),Y(dy),tw*sc,dh*sc);g.setLineDash([]);
  g.fillStyle='rgba(255,226,190,.6)';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*0.5));g.fillText('ARCH',X(tx+tw/2),Y(dy+dh*0.25));g.textBaseline='top';}
 for(const [rx,ry,rw,rh,o] of BR.ramps){   // a rock-cut ramp with rubble walls
  const grd=g.createLinearGradient(0,Y(o<0?ry:ry+rh),0,Y(o<0?ry+rh:ry));grd.addColorStop(0,'#4a3e35');grd.addColorStop(1,'#7a6553');
  g.fillStyle=grd;g.fillRect(X(rx),Y(ry),rw*sc,rh*sc);
  g.strokeStyle='rgba(255,220,180,.25)';g.lineWidth=1.5;for(let i=1;i<6;i++){const yy=Y(ry+rh*i/6);g.beginPath();g.moveTo(X(rx)+3,yy);g.lineTo(X(rx+rw)-3,yy);g.stroke();}
  g.fillStyle='#5a4a3e';g.fillRect(X(rx-0.2),Y(ry),0.2*sc,rh*sc);g.fillRect(X(rx+rw),Y(ry),0.2*sc,rh*sc);
  g.fillStyle='rgba(255,207,74,.8)';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*0.75));g.fillText(o<0?'▲':'▼',X(rx+rw/2),Y(o<0?ry+0.5:ry+rh-0.5));g.textBaseline='top';}
 g.restore();
}
// ---- small top-down picture of a map, for the map picker ----
function drawMapThumb(ctx,w,h,id){
 const m=MAPS[id],s=Math.min(w/W,h/H),x0=(w-W*s)/2,y0=(h-H*s)/2;
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#1d2330';ctx.fillRect(x0,y0,W*s,H*s);
 if(MAP_THEME[id]){ctx.fillStyle=MAP_THEME[id].floor;ctx.fillRect(x0,y0,W*s,H*s);}
 if(m.isRandom){ctx.fillStyle='rgba(223,231,242,.75)';ctx.font=font(Math.round(h*0.32));ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',w/2,h/2+1);return;}
 ctx.fillStyle='rgba(255,77,94,.16)';ctx.fillRect(x0,y0,W*s,5*s);
 ctx.fillStyle='rgba(77,159,255,.16)';ctx.fillRect(x0,y0+(H-5)*s,W*s,5*s);
 if(m.bridge){const [dx,dy,dw,dh]=m.bridge.deck,mesa=m.bridge.look==='mesa';ctx.fillStyle=mesa?'#7a6553':'#596088';ctx.fillRect(x0+dx*s,y0+dy*s,dw*s,dh*s);
  ctx.fillStyle=mesa?'#4a3e35':'#3a405c';for(const [rx,ry,rw,rh] of m.bridge.ramps)ctx.fillRect(x0+rx*s,y0+ry*s,rw*s,rh*s);
  if(mesa){ctx.fillStyle='#2a221d';for(const [tx,tw] of m.bridge.tunnels)ctx.fillRect(x0+tx*s,y0+dy*s,tw*s,dh*s);}}
 for(const [x,y,r,st] of (m.craters||[])){ctx.fillStyle=st==='coolant'?'#2a8fb0':st==='scree'?'#4d3f33':'#121722';ctx.beginPath();ctx.arc(x0+x*s,y0+y*s,r*s,0,7);ctx.fill();ctx.strokeStyle='rgba(223,231,242,.18)';ctx.lineWidth=1;ctx.stroke();}
 for(const [x,y,ww,hh,st] of m.walls){ctx.fillStyle=THUMB_COL[st]||'#7d859f';ctx.fillRect(x0+x*s,y0+y*s,ww*s,hh*s);}
 ctx.fillStyle=THUMB_COL.crate;for(const [x,y,ww,hh] of (m.crates||[]))ctx.fillRect(x0+x*s,y0+y*s,ww*s,hh*s);
 for(const [x,y,r,st] of (m.rocks||[])){ctx.fillStyle=THUMB_COL[st]||'#6b7385';ctx.beginPath();ctx.arc(x0+x*s,y0+y*s,r*s,0,7);ctx.fill();}
}
const THUMB_COL={ctr:'#7d859f',cmd:'#9aa4bb',cliff:'#3a4152',pylon:'#3fd0c9',lander:'#b8963e',crate:'#b07a3a',rock:'#6b7385',dome:'#b9c3d3',
 canyon:'#5c4c40',fin:'#6e5b4c',spire:'#8a735f',boulder:'#7a6553',bulk:'#5a6068',door:'#c9a03a',pillar:'#8a9199',turbine:'#4fa8c8',lift:'#b8963e',console:'#46607a',tank:'#9aa3ad'};
// ---- map objects, drawn with a little height (2.5D): top face lifted, front face below, shadow to the lower right ----
const ELEV=0.38,CTR_COLS=['#3d4c61','#5b4637','#40564c','#4b4f63'];
const hash2=(x,y)=>{const v=Math.sin(x*12.9898+y*78.233)*43758.5453;return v-Math.floor(v);};
function shade(hex,k){const n=parseInt(hex.slice(1),16),f=c=>Math.max(0,Math.min(255,Math.round(c*k)));return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';}
function drawSolid(ctx,wl,sc,X,Y){
 if(ART2D[wl[4]]){ART2D[wl[4]](ctx,wl,sc,X,Y);return;}
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
// ---- Canyon and Underground Bunker: their own 2D art (2D view, and the map picker without 3D). Looks only: every piece
// is drawn on the footprint the sim collides with ----
const MAP_THEME={
 canyon:{floor:'#2c2824',grid:null,space:null},
 bunker:{floor:'#24272c',grid:null,space:'#0b0d10'}
};
const hsh=(a,b)=>hash2(a*1.37+3.1,b*2.11-1.7);
function jagRect(ctx,x,y,w,h,X,Y,sc,amp,seed){   // a rock outline on [x,y,w,h]: edges inside the arena are ragged, edges on the arena border stay straight
 const pts=[],step=0.55,edge=(ax,ay,bx,by,nx,ny,open)=>{const L=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.round(L/step));
  for(let i=0;i<n;i++){const t=i/n,j=open&&i>0?hsh(ax+bx*t+seed,ay+by*t)*amp:0;pts.push([ax+(bx-ax)*t+nx*j,ay+(by-ay)*t+ny*j]);}};
 edge(x,y,x+w,y,0,1,y>0.01);edge(x+w,y,x+w,y+h,-1,0,x+w<W-0.01);edge(x+w,y+h,x,y+h,0,-1,y+h<H-0.01);edge(x,y+h,x,y,1,0,x>0.01);
 ctx.beginPath();pts.forEach(([px,py],i)=>{if(i)ctx.lineTo(X(px),Y(py));else ctx.moveTo(X(px),Y(py));});ctx.closePath();
}
function hazard(ctx,px,py,pw,ph,k,a){   // yellow/black chevron band
 ctx.save();ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.clip();ctx.fillStyle='rgba(20,18,12,'+(a||0.9)+')';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='rgba(240,190,50,'+(a||0.9)+')';
 for(let q=-ph;q<pw+ph;q+=k*2){ctx.beginPath();ctx.moveTo(px+q,py+ph);ctx.lineTo(px+q+k,py+ph);ctx.lineTo(px+q+k+ph,py);ctx.lineTo(px+q+ph,py);ctx.closePath();ctx.fill();}
 ctx.restore();
}
const ART2D={
 canyon(ctx,wl,sc,X,Y,fin){   // canyon wall: a lifted rock mass with ragged rims, strata lines and a sunlit lip
  const [x,y,w,h]=wl,e=ELEV*sc*(fin?1.5:2.2),sd=x*7+y;
  ctx.fillStyle='rgba(0,0,0,.42)';ctx.save();ctx.translate(e*0.9,e*0.35);jagRect(ctx,x,y,w,h,X,Y,sc,0.3,sd);ctx.fill();ctx.restore();
  ctx.fillStyle=fin?'#4a3e35':'#3c322b';jagRect(ctx,x,y,w,h,X,Y,sc,0.3,sd);ctx.fill();   // cliff face (seen below the lifted top)
  ctx.save();ctx.translate(0,-e);
  const gr=ctx.createLinearGradient(X(x+w),Y(y),X(x),Y(y+h));gr.addColorStop(0,fin?'#8a735f':'#7a6553');gr.addColorStop(1,fin?'#5c4c40':'#54453a');
  ctx.fillStyle=gr;jagRect(ctx,x,y,w,h,X,Y,sc,0.3,sd);ctx.fill();
  ctx.save();ctx.clip();ctx.strokeStyle='rgba(30,22,16,.38)';ctx.lineWidth=Math.max(1,sc*0.06);
  for(let k=0;k<Math.max(2,(w+h)*0.9);k++){const yy=y+hsh(k,sd)*h,xx=x+hsh(sd,k)*w,l=0.6+hsh(k+3,sd)*1.6;ctx.beginPath();ctx.moveTo(X(xx-l),Y(yy));ctx.quadraticCurveTo(X(xx),Y(yy+0.18),X(xx+l),Y(yy-0.05));ctx.stroke();}
  ctx.fillStyle='rgba(255,226,190,.07)';for(let k=0;k<(w*h)/1.5;k++){ctx.beginPath();ctx.arc(X(x+hsh(k,sd+1)*w),Y(y+hsh(sd+2,k)*h),Math.max(1,sc*0.12*hsh(k,k)),0,7);ctx.fill();}
  ctx.restore();
  ctx.strokeStyle='rgba(255,220,180,.28)';ctx.lineWidth=Math.max(1.5,sc*0.08);jagRect(ctx,x,y,w,h,X,Y,sc,0.3,sd);ctx.stroke();
  ctx.restore();
 },
 fin(ctx,wl,sc,X,Y){ART2D.canyon(ctx,wl,sc,X,Y,true);},
 bulk(ctx,wl,sc,X,Y){   // reinforced bulkhead: concrete core, steel cap, hazard band on its front face
  const [x,y,w,h]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc*1.5;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(px+e*0.7,py+e*0.3,pw,ph);
  ctx.fillStyle='#2e3238';ctx.fillRect(px,py+ph-e,pw,e);hazard(ctx,px,py+ph-e*0.55,pw,e*0.32,Math.max(4,sc*0.3),0.75);
  ctx.fillStyle='#565b63';ctx.fillRect(px,py-e,pw,ph);
  ctx.fillStyle='#6e747c';ctx.fillRect(px+sc*0.12,py-e+sc*0.12,pw-sc*0.24,ph-sc*0.24);
  ctx.strokeStyle='rgba(20,22,26,.5)';ctx.lineWidth=1;ctx.beginPath();
  const long=w>=h,n=Math.max(1,Math.round((long?w:h)/1.6));for(let i=1;i<n;i++){const t=i/n;if(long){ctx.moveTo(px+pw*t,py-e);ctx.lineTo(px+pw*t,py-e+ph);}else{ctx.moveTo(px,py-e+ph*t);ctx.lineTo(px+pw,py-e+ph*t);}}ctx.stroke();
  ctx.fillStyle='rgba(205,215,225,.5)';for(let i=0;i<n;i++){const t=(i+0.5)/n;for(const s of [0.22,0.78]){const bx=long?px+pw*t:px+pw*s,by=long?py-e+ph*s:py-e+ph*t;ctx.beginPath();ctx.arc(bx,by,Math.max(1,sc*0.06),0,7);ctx.fill();}}
  ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(px,py-e,pw,Math.max(1.5,sc*0.08));
 },
 door(ctx,wl,sc,X,Y){   // blast door, rolled back into its frame: thick frame posts, the slab with chevrons, status lamps
  const [x,y,w,h]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc*1.5,t=performance.now()/1000;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(px+e*0.7,py+e*0.3,pw,ph);
  ctx.fillStyle='#2b2f35';ctx.fillRect(px,py+ph-e,pw,e);
  ctx.fillStyle='#4a5058';ctx.fillRect(px,py-e,pw,ph);
  const fw=Math.min(pw*0.16,sc*0.45);ctx.fillStyle='#7b828b';ctx.fillRect(px,py-e,fw,ph);ctx.fillRect(px+pw-fw,py-e,fw,ph);
  hazard(ctx,px+fw+sc*0.08,py-e+ph*0.18,pw-2*fw-sc*0.16,ph*0.64,Math.max(4,sc*0.32),0.95);
  ctx.strokeStyle='rgba(15,16,20,.8)';ctx.lineWidth=Math.max(1,sc*0.07);ctx.strokeRect(px+fw+sc*0.08,py-e+ph*0.18,pw-2*fw-sc*0.16,ph*0.64);
  const on=0.55+0.45*Math.sin(t*4+x);ctx.fillStyle='rgba(255,90,70,'+on+')';ctx.beginPath();ctx.arc(px+fw/2,py-e+ph*0.5,Math.max(1.5,sc*0.1),0,7);ctx.fill();
  ctx.fillStyle='rgba(90,255,150,'+(1.1-on)+')';ctx.beginPath();ctx.arc(px+pw-fw/2,py-e+ph*0.5,Math.max(1.5,sc*0.1),0,7);ctx.fill();
 },
 pillar(ctx,wl,sc,X,Y){   // structural column: concrete, steel corner guards, hazard collar
  const [x,y,w,h]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc*2.4;
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(px+e*0.6,py+e*0.3,pw,ph);
  ctx.fillStyle='#3a3f46';ctx.fillRect(px,py+ph-e,pw,e);hazard(ctx,px,py+ph-e*0.3,pw,e*0.24,Math.max(3,sc*0.22));
  ctx.fillStyle='#7d838b';ctx.fillRect(px,py-e,pw,ph);ctx.fillStyle='#646a72';ctx.fillRect(px+pw*0.2,py-e+ph*0.2,pw*0.6,ph*0.6);
  ctx.fillStyle='#b4bcc5';const c=sc*0.16;for(const [cx,cy] of [[0,0],[1,0],[0,1],[1,1]])ctx.fillRect(px+cx*(pw-c),py-e+cy*(ph-c),c,c);
 },
 turbine(ctx,wl,sc,X,Y){   // turbine bank: housing, spinning rotors, glowing intake grilles
  const [x,y,w,h]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc*1.6,t=performance.now()/1000;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(px+e*0.7,py+e*0.3,pw,ph);
  ctx.fillStyle='#262b31';ctx.fillRect(px,py+ph-e,pw,e);
  ctx.fillStyle='#3f464f';ctx.fillRect(px,py-e,pw,ph);
  const n=Math.max(1,Math.round(h/1.4)),r=Math.min(pw,ph/n)*0.38;
  for(let i=0;i<n;i++){const cx=px+pw/2,cy=py-e+ph*(i+0.5)/n;
   ctx.fillStyle='#1a1e23';ctx.beginPath();ctx.arc(cx,cy,r*1.12,0,7);ctx.fill();ctx.strokeStyle='#8a929b';ctx.lineWidth=Math.max(1,sc*0.07);ctx.stroke();
   ctx.save();ctx.translate(cx,cy);ctx.rotate(t*(i%2?-5:5));ctx.fillStyle='#6f7882';for(let b=0;b<5;b++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.ellipse(r*0.5,0,r*0.5,r*0.16,0.4,0,7);ctx.fill();}ctx.restore();
   ctx.fillStyle='#4fd8ff';ctx.beginPath();ctx.arc(cx,cy,r*0.18,0,7);ctx.fill();}
  ctx.fillStyle='rgba(79,216,255,'+(0.35+0.25*Math.sin(t*3))+')';ctx.fillRect(px+pw-sc*0.18,py-e+sc*0.2,sc*0.1,ph-sc*0.4);
 },
 lift(ctx,wl,sc,X,Y){   // cargo lift platform against the back wall: hazard rim, chevrons, hydraulic rams
  const [x,y,w,h]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc;
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(px+e*0.7,py+e*0.3,pw,ph);
  ctx.fillStyle='#30353b';ctx.fillRect(px,py+ph-e,pw,e);
  hazard(ctx,px,py-e,pw,ph,Math.max(5,sc*0.4));
  ctx.fillStyle='#5a6068';ctx.fillRect(px+sc*0.25,py-e+sc*0.2,pw-sc*0.5,ph-sc*0.4);
  ctx.fillStyle='#8f969e';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(px+pw*(i+0.5)/4,py-e+ph*0.5,Math.max(2,sc*0.22),0,7);ctx.fill();}
 },
 console(ctx,wl,sc,X,Y){   // control console: dark cabinet, flickering screens
  const [x,y,w,h]=wl,px=X(x),py=Y(y),pw=w*sc,ph=h*sc,e=ELEV*sc*1.2,t=performance.now()/1000;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(px+e*0.7,py+e*0.3,pw,ph);
  ctx.fillStyle='#22262c';ctx.fillRect(px,py+ph-e,pw,e);ctx.fillStyle='#363c44';ctx.fillRect(px,py-e,pw,ph);
  for(let i=0;i<3;i++){const a=0.45+0.35*Math.abs(Math.sin(t*(1.3+i*0.7)+x+i));ctx.fillStyle=i===1?'rgba(255,200,80,'+a+')':'rgba(80,220,255,'+a+')';ctx.fillRect(px+pw*0.2,py-e+ph*(0.12+i*0.29),pw*0.6,ph*0.18);}
 }
};
const ROCK2D={
 spire(ctx,rk,sc,X,Y){   // a tall rock spire: wide shadow, stacked lumps lit from the upper right
  const [x,y,r]=rk,px=X(x),py=Y(y),pr=r*sc,e=ELEV*sc*2.2;
  ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(px+e*0.9,py+e*0.4,pr*1.1,pr*0.85,0,0,7);ctx.fill();
  for(let k=0;k<3;k++){const kk=1-k*0.28,yy=py-e*k*0.55,gr=ctx.createLinearGradient(px+pr,yy-pr,px-pr,yy+pr);gr.addColorStop(0,'#9a8068');gr.addColorStop(0.55,'#5f4e41');gr.addColorStop(1,'#2f2620');
   ctx.fillStyle=gr;ctx.beginPath();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,q=pr*kk*(0.82+hsh(x+i,y+k)*0.3);if(i)ctx.lineTo(px+Math.cos(a)*q,yy+Math.sin(a)*q*0.9);else ctx.moveTo(px+Math.cos(a)*q,yy+Math.sin(a)*q*0.9);}ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(25,18,12,.55)';ctx.lineWidth=1.2;ctx.stroke();}
 },
 boulder(ctx,rk,sc,X,Y){
  const [x,y,r]=rk,px=X(x),py=Y(y),pr=r*sc,e=ELEV*sc*0.8;
  ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(px+e*0.8,py+e*0.5,pr*1.02,pr*0.9,0,0,7);ctx.fill();
  const gr=ctx.createLinearGradient(px+pr,py-pr,px-pr,py+pr);gr.addColorStop(0,'#8f7864');gr.addColorStop(0.5,'#5a4a3e');gr.addColorStop(1,'#2c241e');ctx.fillStyle=gr;
  ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2,q=pr*(0.84+hsh(x-i,y+i)*0.28);if(i)ctx.lineTo(px+Math.cos(a)*q,py-e*0.6+Math.sin(a)*q*0.92);else ctx.moveTo(px+Math.cos(a)*q,py-e*0.6+Math.sin(a)*q*0.92);}ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(25,18,12,.6)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.strokeStyle='rgba(30,20,14,.5)';ctx.beginPath();ctx.moveTo(px-pr*0.3,py-e*0.6-pr*0.4);ctx.lineTo(px+pr*0.05,py-e*0.6);ctx.lineTo(px-pr*0.1,py-e*0.6+pr*0.45);ctx.stroke();
 },
 tank(ctx,rk,sc,X,Y){   // fuel tank seen from above: steel drum, rings, a glowing level gauge
  const [x,y,r]=rk,px=X(x),py=Y(y),pr=r*sc,e=ELEV*sc*2;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(px+e*0.7,py+e*0.35,pr,pr*0.95,0,0,7);ctx.fill();
  ctx.fillStyle='#3b4148';ctx.beginPath();ctx.arc(px,py,pr,0,7);ctx.fill();
  const gr=ctx.createRadialGradient(px+pr*0.3,py-e-pr*0.35,pr*0.1,px,py-e,pr);gr.addColorStop(0,'#c9cfd5');gr.addColorStop(0.6,'#7d858e');gr.addColorStop(1,'#4b525a');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(px,py-e,pr*0.96,0,7);ctx.fill();
  ctx.strokeStyle='rgba(20,22,26,.5)';ctx.lineWidth=Math.max(1,sc*0.06);for(const k of [0.72,0.45]){ctx.beginPath();ctx.arc(px,py-e,pr*k,0,7);ctx.stroke();}
  ctx.fillStyle='rgba(240,190,50,.85)';ctx.beginPath();ctx.arc(px,py-e,pr*0.2,0,7);ctx.fill();
 }
};
const CRATER2D={
 scree(ctx,cr,sc,X,Y){   // a scree slope of loose rubble: tracks bog down in it
  const [x,y,r]=cr,px=X(x),py=Y(y),pr=r*sc;
  const gr=ctx.createRadialGradient(px,py,pr*0.2,px,py,pr);gr.addColorStop(0,'rgba(120,98,78,.55)');gr.addColorStop(1,'rgba(120,98,78,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(px,py,pr*1.1,0,7);ctx.fill();
  for(let i=0;i<22;i++){const a=hsh(i,x)*6.283,d=Math.sqrt(hsh(y,i))*r,q=Math.max(1,sc*(0.06+hsh(i,i+x)*0.12));ctx.fillStyle=i%3?'#6d5948':'#9a8270';ctx.beginPath();ctx.arc(X(x+Math.cos(a)*d),Y(y+Math.sin(a)*d),q,0,7);ctx.fill();}
  ctx.strokeStyle='rgba(200,170,140,.18)';ctx.setLineDash([3,4]);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px,py,pr,0,7);ctx.stroke();ctx.setLineDash([]);
 },
 coolant(ctx,cr,sc,X,Y){   // a spilled coolant pool: slows tanks, glows and ripples
  const [x,y,r]=cr,px=X(x),py=Y(y),pr=r*sc,t=performance.now()/1000;
  const gr=ctx.createRadialGradient(px,py,pr*0.1,px,py,pr);gr.addColorStop(0,'rgba(90,240,255,.55)');gr.addColorStop(0.7,'rgba(40,170,210,.38)');gr.addColorStop(1,'rgba(40,170,210,.08)');
  ctx.fillStyle=gr;ctx.beginPath();for(let i=0;i<12;i++){const a=i/12*Math.PI*2,q=pr*(0.88+hsh(x+i,y)*0.2);if(i)ctx.lineTo(px+Math.cos(a)*q,py+Math.sin(a)*q);else ctx.moveTo(px+Math.cos(a)*q,py+Math.sin(a)*q);}ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(170,250,255,.35)';ctx.lineWidth=1.2;for(let k=0;k<2;k++){const f=((t*0.4+k*0.5)%1);ctx.globalAlpha=1-f;ctx.beginPath();ctx.arc(px,py,pr*(0.2+0.75*f),0,7);ctx.stroke();}ctx.globalAlpha=1;
 }
};
// the floor under Canyon and Bunker, painted once per size (the 2D view draws it every frame as one image)
const FLOOR2D={};
function floorPaint(c,id,u,w,h){   // u: px per unit
 let s0=id==='canyon'?913:271;const rnd=()=>{s0=(s0*16807)%2147483647;return s0/2147483647;};
 if(id==='canyon'){
  const gr=c.createLinearGradient(0,0,w,0);gr.addColorStop(0,'#3a322b');gr.addColorStop(0.5,'#2f2a25');gr.addColorStop(1,'#3a322b');c.fillStyle=gr;c.fillRect(0,0,w,h);
  for(let i=0;i<W*H*1.6;i++){const x=rnd()*w,y=rnd()*h,r=(0.04+rnd()*0.2)*u;c.fillStyle=rnd()<0.5?'rgba(15,11,8,.22)':'rgba(220,190,160,.07)';c.beginPath();c.arc(x,y,r,0,7);c.fill();}
  c.strokeStyle='rgba(200,165,130,.08)';c.lineWidth=Math.max(1,u*0.18);   // old lava flow lines down the rille
  for(let k=0;k<9;k++){const x0=(2.5+k*1.9)*u;c.beginPath();c.moveTo(x0,0);for(let y=0;y<=H;y+=2)c.lineTo(x0+Math.sin(y*0.35+k)*u*0.9,y*u);c.stroke();}
  for(let i=0;i<14;i++){const x=rnd()*w,y=rnd()*h,r=(0.3+rnd()*0.7)*u;c.strokeStyle='rgba(10,8,6,.35)';c.lineWidth=Math.max(1,u*0.07);c.beginPath();c.arc(x,y,r,0,7);c.stroke();c.strokeStyle='rgba(230,200,170,.1)';c.beginPath();c.arc(x-u*0.05,y-u*0.05,r,Math.PI,Math.PI*1.6);c.stroke();}
 }else{
  c.fillStyle='#2a2e34';c.fillRect(0,0,w,h);
  for(let j=0;j<H;j+=2)for(let i=0;i<W;i+=2){c.fillStyle='rgba('+(rnd()<0.5?'255,255,255,.025':'0,0,0,.08')+')';c.fillRect(i*u+1,j*u+1,2*u-2,2*u-2);}
  c.strokeStyle='rgba(10,12,15,.6)';c.lineWidth=Math.max(1,u*0.05);c.beginPath();for(let i=0;i<=W;i+=2){c.moveTo(i*u,0);c.lineTo(i*u,h);}for(let j=0;j<=H;j+=2){c.moveTo(0,j*u);c.lineTo(w,j*u);}c.stroke();
  for(let i=0;i<70;i++){c.fillStyle='rgba(0,0,0,'+(0.08+rnd()*0.12)+')';c.beginPath();c.ellipse(rnd()*w,rnd()*h,(0.2+rnd()*0.8)*u,(0.1+rnd()*0.4)*u,rnd()*3,0,7);c.fill();}   // oil stains
  c.setLineDash([u*0.6,u*0.4]);c.strokeStyle='rgba(240,190,50,.35)';c.lineWidth=Math.max(1,u*0.08);   // painted lanes down the side corridors and the hall
  c.beginPath();for(const x of [1.75,18.25,7,13]){c.moveTo(x*u,10*u);c.lineTo(x*u,22*u);}c.stroke();c.setLineDash([]);
  c.save();c.translate(10*u,16*u);   // reactor floor hatch under the hall's centre
  for(const [r,a] of [[3.4,'rgba(79,216,255,.10)'],[2.4,'rgba(79,216,255,.14)']]){c.fillStyle=a;c.beginPath();c.arc(0,0,r*u,0,7);c.fill();}
  c.strokeStyle='rgba(140,150,160,.35)';c.lineWidth=Math.max(1,u*0.08);for(const r of [3.4,2.4,1.2]){c.beginPath();c.arc(0,0,r*u,0,7);c.stroke();}
  for(let i=0;i<12;i++){c.rotate(Math.PI/6);c.beginPath();c.moveTo(1.2*u,0);c.lineTo(2.4*u,0);c.stroke();}c.restore();
  c.fillStyle='rgba(255,230,170,.05)';for(const [x,y] of [[10,4],[10,28],[2,16],[18,16],[10,11],[10,21]]){const g2=c.createRadialGradient(x*u,y*u,0,x*u,y*u,4*u);g2.addColorStop(0,'rgba(255,230,170,.10)');g2.addColorStop(1,'rgba(255,230,170,0)');c.fillStyle=g2;c.fillRect((x-4)*u,(y-4)*u,8*u,8*u);}   // pools of ceiling light
 }
}
function floorImage(id,pw,ph){
 const k=id+'|'+Math.round(pw)+'x'+Math.round(ph);let f=FLOOR2D[id];
 if(!f||f.k!==k){const cv2=document.createElement('canvas');cv2.width=Math.max(1,Math.round(pw));cv2.height=Math.max(1,Math.round(ph));floorPaint(cv2.getContext('2d'),id,cv2.width/W,cv2.width,cv2.height);f=FLOOR2D[id]={k,cv:cv2};}
 return f.cv;
}
const ROCK_SHAPE={};
function drawRock(ctx,rk,sc,X,Y){
 if(ROCK2D[rk[3]]){ROCK2D[rk[3]](ctx,rk,sc,X,Y);return;}
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
 if(CRATER2D[cr[3]]){CRATER2D[cr[3]](ctx,cr,sc,X,Y);return;}
 const [x,y,r]=cr,px=X(x),py=Y(y),pr=r*sc;
 const gr=ctx.createRadialGradient(px-pr*0.2,py+pr*0.2,pr*0.1,px,py,pr);gr.addColorStop(0,'#10141c');gr.addColorStop(0.75,'#161b25');gr.addColorStop(1,'#232a37');
 ctx.fillStyle=gr;ctx.beginPath();ctx.arc(px,py,pr,0,7);ctx.fill();
 ctx.lineWidth=Math.max(2,sc*0.14);ctx.strokeStyle='rgba(223,231,242,.16)';ctx.beginPath();ctx.arc(px,py,pr,-Math.PI*0.95,Math.PI*0.05);ctx.stroke();
 ctx.strokeStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(px,py,pr,Math.PI*0.05,Math.PI*1.05);ctx.stroke();
}
// ---- menu art: hero tank on a patch of moon rock, gear icons, cores, VS cards ----
const HERO_STARS=Array.from({length:26},()=>({x:Math.random(),y:Math.random()*0.55,r:Math.random()*1.1+0.3,p:Math.random()*6.28}));
const HERO_DUST=Array.from({length:14},()=>({x:Math.random(),y:0.55+Math.random()*0.4,s:0.2+Math.random()*0.6,p:Math.random()*6.28}));
function myTankColor(){return TC[0];}
function drawHeroScene(ctx,w,h,t,noTank){
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
 if(noTank)return;
 drawTankPx(ctx,cx,cy,r,hd,ang,col,(save.cores||[]).filter(Boolean),getW(save.weapon).arch||'pulse',null,3,myPaint(),fittingVisuals(myLoadout()),save.skin,apOf(save.ap));
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
// the gold tooth (LUNAR's mark), centered at x,y, s = height. Used by the Vault art and the 2D tank
function toothPath(ctx,x,y,s){const k=s/1.3,P=(a,b)=>[x+a*k,y+b*k];ctx.beginPath();ctx.moveTo(...P(-0.46,-0.3));
 const q=(a,b,c,d)=>ctx.quadraticCurveTo(...P(a,b),...P(c,d));
 q(-0.5,-0.64,-0.22,-0.6);q(0,-0.5,0.22,-0.6);q(0.5,-0.64,0.46,-0.3);q(0.42,0.05,0.3,0.55);q(0.2,0.7,0.12,0.5);q(0.06,0.18,0,0.16);q(-0.06,0.18,-0.12,0.5);q(-0.2,0.7,-0.3,0.55);q(-0.42,0.05,-0.46,-0.3);ctx.closePath();}
function goldTooth(ctx,x,y,s,glow){
 ctx.save();if(glow){ctx.shadowColor='#ffcf4a';ctx.shadowBlur=s*0.9;}
 const g=ctx.createLinearGradient(x-s*0.4,y-s*0.5,x+s*0.4,y+s*0.5);g.addColorStop(0,'#fff3c2');g.addColorStop(0.45,'#ffcf4a');g.addColorStop(1,'#b8861c');
 toothPath(ctx,x,y,s);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,s*0.05);ctx.strokeStyle='#7a5410';ctx.stroke();
 ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.ellipse(x-s*0.17,y-s*0.27,s*0.07,s*0.12,-0.4,0,7);ctx.fill();ctx.restore();}
// the Hyperspace Vault: a badge in the level's color (bronze, silver, gold, diamond, hyperspace) around a gold tooth
function drawVaultArt(ctx,w,h,lv){
 const s=Math.min(w,h),cx=w/2,cy=h/2,T=vaultTier(lv),r=s*0.4,t=performance.now()/1000;
 ctx.save();
 if(T.n==='Hyperspace'||lv<=0){for(let i=0;i<24;i++){const a=i*2.4,d=r*(0.7+((i*37)%50)/60);ctx.globalAlpha=0.25+0.25*Math.sin(t*2+i);ctx.fillStyle=i%3?'#c79bff':'#ffffff';ctx.beginPath();ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,s*0.008+(i%4)*s*0.003,0,7);ctx.fill();}ctx.globalAlpha=1;}
 ctx.shadowColor=T.c;ctx.shadowBlur=s*0.18;
 ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}ctx.closePath();
 const g=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
 if(T.n==='Hyperspace'){g.addColorStop(0,'#3a2a8a');g.addColorStop(0.5,'#7b5cff');g.addColorStop(1,'#ff7ad9');}else{g.addColorStop(0,'#1a1f2b');g.addColorStop(1,'#0c0f16');}
 ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.lineWidth=Math.max(2,s*0.035);ctx.strokeStyle=lv>0?T.c:'#5a6577';ctx.stroke();
 goldTooth(ctx,cx,cy-s*0.03,s*0.36,lv>=10);
 if(lv>0){const fs=Math.round(s*0.13);ctx.font=font(fs);ctx.textAlign='center';ctx.textBaseline='middle';
  const bw=fs*2.3,by=cy+r*0.78;ctx.fillStyle=T.c;rr(ctx,cx-bw/2,by-fs*0.62,bw,fs*1.24,fs*0.62);ctx.fill();ctx.fillStyle='#14100a';ctx.fillText('Lv '+lv,cx,by+1);}
 ctx.restore();
}
function drawUnitArt(ctx,w,h,u){
 ctx.clearRect(0,0,w,h);if(!u)return;
 const col=u===me?myTankColor():tcol(u.team),r=Math.min(w,h)*0.2*Math.min(1.3,u.dscale||1),a=u.team===0?-Math.PI/2:Math.PI/2;
 ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(w/2,h/2+r*0.8,r*1.3,r*0.5,0,0,7);ctx.fill();ctx.restore();
 drawTankPx(ctx,w/2,h/2,r,a,a,col,u.gems,u.wtype,null,3,PAINTS[u.paint],u.fits,u.skin,u.ap);
}

// ---- battle input: floating joystick, SUPER button, keyboard ----
const BS=()=>CAM()&&KEYHINT?1.3:1;   // the chase HUD on a desktop: buttons a third bigger (the critic: 60 px on a 1920 px screen)
const btn=()=>{const s=BS();return {x:vw-62*s,y:vh-96*s-SAB,r:40*s};};
const dashBtn=()=>{const s=BS();return {x:vw-150*s,y:vh-70*s-SAB,r:30*s};};
const shieldBtn=()=>{const s=BS();return {x:vw-142*s,y:vh-158*s-SAB,r:30*s};};
let aim=null;   // {id,sx,sy,x,y,on}: dragging from SUPER to aim it
let tapFocus=-1,tapCand=null;   // tap-to-target: unit id your cannon is locked onto, and the tap being tracked
function resetTapFocus(){tapFocus=-1;tapCand=null;}
function tapTarget(sx,sy){   // a quick tap on the field: lock onto an enemy (tap it again, or tap ground, to clear)
 if(state!=='play'||!me)return;
 let best=null,bd=1.4;
 if(CAM()){for(const u of units){if(u.team===me.team||u.hp<=0)continue;if(!WP(u.x,u.y,hOf(u)+0.4))continue;let d=Math.hypot(WPx-sx,WPy-sy)/Math.max(WPk,sc*0.9);
   if(WPunit(u)){const r=R*Math.max(sc*0.62,Math.min(sc*1.9,WPk))*0.8;d=Math.min(d,Math.hypot(WPx-sx,WPy+r*(0.85+WPslot*2.1)-sy)/Math.max(WPk,sc*0.9));}   // a tank under the deck: its bar at the tunnel mouth is the thing to tap
   if(d<bd){bd=d;best=u;}}}   // the same 1.4 units round a tank, measured where the tank is drawn (a far tank keeps a finger-sized target)
 else{const wx=(sx-ox)/sc,wy=(sy-oy)/(sc*GK);for(const u of units){if(u.team===me.team||u.hp<=0)continue;const d=Math.hypot(u.x-wx,u.y-wy);if(d<bd){bd=d;best=u;}}}
 tapFocus=best&&tapFocus!==best.id?best.id:-1;
 if(pvpOn()){if(typeof pvpTarget==='function')pvpTarget(tapFocus);}
 else me.focus=tapFocus>=0?best:null;
 if(typeof fx==='function')fx('tap');
}
const aimAng=()=>{if(!aim||!aim.on||!me)return null;if(CAM()){const h=hOf(me);WP(me.x,me.y,h);if(Math.hypot(aim.x-WPx,aim.y-WPy)<=24)return null;const p=ArenaCam.ground(aim.x,aim.y,h);return p?Math.atan2(p[1]-me.y,p[0]-me.x):Math.atan2(aim.y-WPy,aim.x-WPx);}const px=X(me.x),py=Y(me.y)-liftOf(me),dx=aim.x-px,dy=aim.y-py;return Math.hypot(dx,dy)>24?Math.atan2(dy/GK,dx):null;};   // aim is measured from the tank, not from the finger: the preview line is where the shot really goes
const ffBtnOn=()=>!(typeof rangeRun!=='undefined'&&rangeRun)&&state==='play'&&me&&me.hp<=0&&!respawns()&&!storm&&aliveCount(0)>0&&!pvpOn();   // live matches run on the server's clock
// your super and dash: straight into the sim in AI matches, to the server in live ones
const superFire=a=>typeof rangeRun!=='undefined'&&rangeRun?rangeRun.sim.action('super',a):pvpOn()?pvpSuper(a):useSuper(me,a);
// ---- the super timing bar (Session 5E-2b; rules.js SUP_BAR_T...). Pressing SUPER starts the charge and the sweep; a second
// tap (the SUPER button, the bar itself, or Space) stops the marker: MISS / HIT / JACKPOT. Driving is never blocked.
// supUI: {t0 (ms, my press), bar {z0,jc}, live, p (where the marker stopped), oc, at (ms, when it stopped)}
let supUI=null;
const supUsed=()=>me?Math.min(SUP_ROUND_CAP,me.supN||0):0;   // supers I have used this round (the sim's count; in a live match the server's)
const supBarOn=()=>!!supUI&&supUI.oc===undefined;
function superGo(a){
 if(supBarOn())return supStop();   // the same control stops the bar
 if(!superFire(a))return false;
 const live=pvpOn()&&!(typeof rangeRun!=='undefined'&&rangeRun),bar=live?me.nbar:me.sup&&me.sup.bar;
 if(bar)supUI={t0:performance.now(),bar:{z0:bar.z0,jc:bar.jc},live,k:supKey(me.wtype,me.wtier)};
 return true;
}
// seconds since the press: the sim's own clock where the sim runs on this phone (exactly what it will judge), mine in a live match
const supEl=()=>!supUI?0:supUI.live||!me||!me.sup||me.sup.el===undefined?(performance.now()-supUI.t0)/1000:me.sup.el;
function supStop(){
 if(!supBarOn()||!me)return false;
 const el=supEl();
 if(typeof rangeRun!=='undefined'&&rangeRun)rangeRun.sim.action('tap',el);else if(supUI.live)pvpTap(el);else supTap(me,el);
 if(supBarOn())supShow(supJudge(supUI.bar,el),el/SUP_BAR_T);   // live: shown at once; the server's verdict ('Z') replaces it if it differs
 return true;
}
// the bar's result: freeze the marker, flash, sound, haptic (Telegram). Called by my tap and by the sim's 'Z' event for my tank
function supShow(oc,p){
 if(!supUI)return;
 const first=supUI.oc===undefined;if(!first&&supUI.oc===oc)return;
 supUI.oc=oc;supUI.at=performance.now();if(p!==undefined)supUI.p=p;else if(supUI.p===undefined)supUI.p=Math.min(1,supEl()/SUP_BAR_T);
 if(typeof fx==='function')fx(oc===2?'jackpot':oc===1?'supgood':'supmiss');
}
function supUiTick(){   // drop the bar when its super is over (or never started: the server refused the press)
 if(!supUI)return;
 const now=performance.now();
 if(!me||me.hp<=0||state!=='play'){supUI=null;return;}
 if(supUI.oc!==undefined){if(now-supUI.at>900)supUI=null;return;}
 if(!supUI.live){if(!me.sup)supUI=null;return;}   // AI match: the sim on this phone ends the bar itself (its 'Z' event)
 if(!me.sup&&now-supUI.t0>(SUP_BAR_T+SUP_REL)*1000){supUI=null;return;}   // the server never started it (a slow link still gets the whole sweep to tap in)
 if(now-supUI.t0>(SUP_BAR_T+SUP_REL+0.6)*1000)supShow(0,1);   // live safety: nothing came back from the server
}
const supBarRect=()=>{const wide=vw>vh*1.2;if(CAM()&&!wide){const M=miniRect(),w=Math.min(300,vw-2*(M.x+M.w+14));return {x:(vw-w)/2,y:hudY0()+sc*1.25+38,w,h:22};}   // an upright phone under the chase camera: just under the HUD, clear of the fight round your tank
 const w=Math.min(300,vw-36);return {x:(vw-w)/2,y:wide?vh-150*BS()-SAB:vh-244-SAB,w,h:22};};
function drawSupBar(g){
 if(!supUI)return;
 const B=supBarRect(),now=performance.now(),quiet=typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced(),done=supUI.oc!==undefined;
 const p=done?supUI.p:Math.min(1,supEl()/SUP_BAR_T),age=done?(now-supUI.at)/1000:0,fade=done?Math.max(0,1-Math.max(0,age-0.55)/0.35):1;
 const zx=B.x+B.w*supUI.bar.z0,zw=B.w*SUP_ZONE_W,jx=B.x+B.w*supUI.bar.jc,jr=B.w*SUP_JACK_W/2,cy=B.y+B.h/2;   // the gold circle is EXACTLY as wide as the window that is judged (it used to be drawn up to a third wider: a marker inside the gold could score a HIT)
 g.save();g.globalAlpha=fade;
 // track
 g.fillStyle='rgba(6,10,18,.82)';g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2;rr(g,B.x-4,B.y-4,B.w+8,B.h+8,(B.h+8)/2);g.fill();g.stroke();
 // normal zone: a bright band
 g.fillStyle=done&&supUI.oc===0?'rgba(120,150,170,.55)':'rgba(96,226,255,.85)';rr(g,zx,B.y,zw,B.h,5);g.fill();
 g.fillStyle='rgba(255,255,255,.35)';g.fillRect(zx+2,B.y+2,zw-4,Math.max(2,B.h*0.28));
 // jackpot: a gold circle that stands proud of the track
 const pulse=quiet||done?1:1+0.10*Math.sin(now/90);
 // (Session 5E-2b2b: a capsule exactly as wide as the judged window and taller than the track, so it stays readable on a
 // 320 px phone where that width is under 15 px, and what is drawn is what is judged)
 {const jh=(B.h+12)*pulse,jw=2*jr;g.fillStyle='#1a1204';rr(g,jx-jr-2.5,cy-jh/2-2.5,jw+5,jh+5,Math.min(jr+2.5,9));g.fill();
  g.fillStyle=done&&supUI.oc!==2?'#b08a2e':'#ffcf4a';rr(g,jx-jr,cy-jh/2,jw,jh,Math.min(jr,7));g.fill();
  g.fillStyle='#fff6cf';rr(g,jx-jr*0.4,cy-jh*0.3,jw*0.4,jh*0.6,Math.min(jr*0.4,4));g.fill();
  if(!done&&!quiet){g.globalAlpha=fade*(0.35+0.35*Math.sin(now/90));g.strokeStyle='#ffe9a0';g.lineWidth=2;rr(g,jx-jr-5,cy-jh/2-5,jw+10,jh+10,Math.min(jr+5,11));g.stroke();g.globalAlpha=fade;}}
 // marker: a white needle with a dark edge, taller than the track
 const mx=B.x+B.w*p;
 // the marker is the thing to watch: the brightest, tallest shape on the bar, with an arrow above and below
 g.fillStyle='rgba(0,0,0,.8)';g.fillRect(mx-5.5,B.y-15,11,B.h+30);
 const mc=done?(supUI.oc===2?'#ffcf4a':supUI.oc===1?'#ffffff':'#ff8f8f'):'#ffffff';if(!done&&!quiet){g.shadowColor='#ffffff';g.shadowBlur=10;}
 g.fillStyle=mc;g.fillRect(mx-3.5,B.y-14,7,B.h+28);g.shadowBlur=0;
 g.beginPath();g.moveTo(mx-10,B.y-25);g.lineTo(mx+10,B.y-25);g.lineTo(mx,B.y-11);g.closePath();g.fill();
 // words
 g.textAlign='center';g.textBaseline='alphabetic';
 if(done){const big=supUI.oc===2,k=quiet?1:Math.min(1,age/0.12),sz=Math.round((big?30:22)*(quiet?1:1.35-0.35*k));
  g.font='700 '+sz+'px '+FONT_FAMILY;g.lineWidth=5;g.strokeStyle='rgba(0,0,0,.8)';const t=big?'JACKPOT!':supUI.oc===1?'HIT':'MISS',c=big?'#ffcf4a':supUI.oc===1?'#ffffff':'#ff8f8f';
  g.strokeText(t,vw/2,B.y-36);g.fillStyle=c;g.fillText(t,vw/2,B.y-36);
  g.font='700 14px '+FONT_FAMILY;g.lineWidth=4;g.strokeText(Math.round(SUP_OC[supUI.oc]*100)+'% DAMAGE',vw/2,B.y+B.h+30);g.fillStyle='#ffffff';g.fillText(Math.round(SUP_OC[supUI.oc]*100)+'% DAMAGE',vw/2,B.y+B.h+30);}
 else{g.font='700 15px '+FONT_FAMILY;g.lineWidth=4;g.strokeStyle='rgba(0,0,0,.75)';const t=(SUP_NAMES[supUI.k]||'SUPER').toUpperCase()+': TAP TO STOP';g.strokeText(t,vw/2,B.y-34);g.fillStyle='#ffffff';g.fillText(t,vw/2,B.y-34);
  if((save.mp||0)<8){g.font=font(11);g.fillStyle='rgba(255,255,255,.8)';g.fillText('blue zone = hit   gold circle = jackpot',vw/2,B.y+B.h+30);}}
 g.restore();
 // jackpot: one short gold flash over the screen edge (never with reduced motion; it does not cover the field)
 if(done&&supUI.oc===2&&!quiet&&age<0.25){const a=(1-age/0.25)*0.5,gr=g.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*0.35,vw/2,vh/2,Math.max(vw,vh)*0.75);gr.addColorStop(0,'rgba(255,207,74,0)');gr.addColorStop(1,'rgba(255,207,74,'+a+')');g.fillStyle=gr;g.fillRect(0,0,vw,vh);}
}
const dashGo=(x,y)=>typeof rangeRun!=='undefined'&&rangeRun?rangeRun.sim.action('dash',x,y):pvpOn()?pvpDash(x,y):useDash(me,x,y);
const shieldGo=()=>typeof rangeRun!=='undefined'&&rangeRun?rangeRun.sim.action('shield'):pvpOn()?pvpShield():useShield(me);
const ffBtn=()=>({x:vw/2-80,y:vh-74-SAB,w:160,h:44});
const joy={on:false,id:null,sx:0,sy:0,x:0,y:0,dx:0,dy:0},keys={};
const loc=e=>{const rc=cv.getBoundingClientRect();return {x:e.clientX-rc.left,y:e.clientY-rc.top};};
cv.addEventListener('pointerdown',e=>combatView(()=>{
 if(state!=='play'||!me)return;
 const L=loc(e);
 if(ffBtnOn()){const F=ffBtn();if(L.x>=F.x&&L.x<=F.x+F.w&&L.y>=F.y&&L.y<=F.y+F.h){ffwd=!ffwd;if(typeof fx==='function')fx('tap');return;}}
 const B=btn();
 if(supBarOn()&&me.hp>0){const R=supBarRect();if(Math.hypot(L.x-B.x,L.y-B.y)<=B.r+26||(L.x>=R.x-10&&L.x<=R.x+R.w+10&&L.y>=R.y-16&&L.y<=R.y+R.h+16)){supStop();return;}}   // second tap: stop the timing bar (the SUPER button or the bar itself)
 if(me.hp>0&&Math.hypot(L.x-B.x,L.y-B.y)<=B.r+16){
  if(supUsed()>=SUP_ROUND_CAP&&!me.sup){nums.push({x:me.x,y:me.y-1.6,t:1.1,z:1,txt:'All '+SUP_ROUND_CAP+' Supers used this round',c:'#c0cad4'});return;}
  if(me.sp<SUPER_MAX||me.sup){nums.push({x:me.x,y:me.y-1.6,t:0.9,z:1,txt:'Super '+Math.round(me.sp/SUPER_MAX*100)+'%',c:'#ff9d9d'});return;}
  aim={id:e.pointerId,sx:L.x,sy:L.y,x:L.x,y:L.y,on:false};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}
 const D=dashBtn();if(me.hp>0&&Math.hypot(L.x-D.x,L.y-D.y)<=D.r+12){const [ix,iy]=inputVec();dashGo(ix,iy);return;}
 const H=shieldBtn();if(me.hp>0&&Math.hypot(L.x-H.x,L.y-H.y)<=H.r+12){shieldGo();return;}
 tapCand={id:e.pointerId,sx:L.x,sy:L.y,x:L.x,y:L.y,t:performance.now()};   // any non-button touch might be a target tap; joyUp decides
 if(joy.on)return;joy.on=true;joy.id=e.pointerId;joy.sx=joy.x=L.x;joy.sy=joy.y=L.y;joy.dx=joy.dy=0;try{cv.setPointerCapture(e.pointerId);}catch(_){}
}));
cv.addEventListener('pointermove',e=>combatView(()=>{
 if(aim&&e.pointerId===aim.id){const L=loc(e);aim.x=L.x;aim.y=L.y;if(Math.hypot(L.x-aim.sx,L.y-aim.sy)>18)aim.on=true;return;}
 if(tapCand&&e.pointerId===tapCand.id){const L=loc(e);tapCand.x=L.x;tapCand.y=L.y;}
 if(!joy.on||e.pointerId!==joy.id)return;
 const max=55;const L=loc(e);let dx=L.x-joy.sx,dy=L.y-joy.sy,d=Math.hypot(dx,dy);
 if(d>max){dx=dx/d*max;dy=dy/d*max;d=max;}
 joy.x=joy.sx+dx;joy.y=joy.sy+dy;joy.dx=dx/max;joy.dy=dy/max;
 if(tut)tut.moved=(tut.moved||0)+d*0.001;
}));
const joyUp=e=>combatView(()=>{
 if(aim&&e.pointerId===aim.id){const a=aimAng();aim=null;if(state==='play'&&me)superGo(a);return;}   // a cancelled drag (iOS/Telegram took the touch) still fires where the preview pointed, never auto-aimed somewhere else (5E-2a)
 if(tapCand&&e.pointerId===tapCand.id){const c=tapCand;tapCand=null;if(e.type!=='pointercancel'&&performance.now()-c.t<300&&Math.hypot(c.x-c.sx,c.y-c.sy)<12)tapTarget(c.x,c.y);}
 if(e.pointerId===joy.id){joy.on=false;joy.dx=joy.dy=0;}});
cv.addEventListener('pointerup',joyUp);cv.addEventListener('pointercancel',joyUp);
addEventListener('keydown',e=>combatView(()=>{keys[e.key.toLowerCase()]=1;if(e.key===' '&&!e.repeat&&state==='play'&&me)superGo();if(e.key==='Shift'&&state==='play'&&me){const [ix,iy]=inputVec();dashGo(ix,iy);}if(e.key.toLowerCase()==='e'&&state==='play'&&me)shieldGo();}));
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=0;});
function inputVec(){
 let x=joy.dx,y=joy.dy;
 if(CAM()&&(x||y)){const v=ArenaCam.steer(x,y);x=v[0];y=v[1];}   // the chase camera: up on the stick is away from the camera, on the ground
 else if(GK!==1&&(x||y)){const m=Math.hypot(x,y),wy=y/GK,n=Math.hypot(x,wy);x=x/n*m;y=wy/n*m;}   // the stick points where your finger points on the tilted ground
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
 {txt:'Super ready: tap the red button, then tap again in the blue zone!',done:()=>mstat&&mstat.sup>0,wait:()=>me.sp>=SUPER_MAX}];
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
 if(document.hidden)return;
 g.setTransform(dpr,0,0,dpr,0,0);
 let shx=0,shy=0;
 if(shakeT>0&&!(typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced())){const m=shakeM*Math.min(1,shakeT*3);shx=(Math.random()-0.5)*m;shy=(Math.random()-0.5)*m;}
 const D3=D3on(),AH=Y(H)-Y(0);   // D3: the world is drawn by render3d.js underneath; this canvas adds the overlay
 if(D3){g.clearRect(0,0,vw,vh);frame3D(shx,shy);}
 else{g.fillStyle='#0a0e17';g.fillRect(0,0,vw,vh);}
 g.save();g.translate(shx,shy);
 const tnow=performance.now()/1000;
 const TH=MAP_THEME[curMap];
 if(!D3&&TH&&TH.space){g.fillStyle=TH.space;g.fillRect(0,0,vw,vh);}   // underground: rock all round, no sky
 else if(!D3){
  // deep space background with stars
  if(!window._stars){window._stars=[];for(let i=0;i<70;i++)window._stars.push({x:Math.random(),y:Math.random(),r:Math.random()*1.4+0.4,tw:Math.random()*6.28});}
  g.fillStyle=C.star;
  for(const st of window._stars){g.globalAlpha=0.25+0.6*Math.abs(Math.sin(tnow*0.6+st.tw));g.beginPath();g.arc(st.x*vw,st.y*vh,st.r,0,7);g.fill();}
  g.globalAlpha=1;
  // arena floor (lunar surface)
  g.fillStyle=C.floor;g.fillRect(X(0),Y(0),W*sc,AH);
 }
 if(!D3&&TH)g.drawImage(floorImage(curMap,W*sc*dpr,AH*dpr),X(0),Y(0),W*sc,AH);
 const CH=CAM();   // the chase camera: no arena rectangle on the screen, everything is placed through the camera
 g.save();g.beginPath();if(CH)g.rect(-40,-40,vw+80,vh+80);else g.rect(X(0),Y(0)-(D3?sc*3:0),W*sc,AH+(D3?sc*3:0));g.clip();
 if(!D3){
  if(!TH){g.strokeStyle=C.grid;g.lineWidth=1;g.beginPath();
  for(let i=0;i<=W;i+=2){g.moveTo(X(i),Y(0));g.lineTo(X(i),Y(H));}
  for(let j=0;j<=H;j+=2){g.moveTo(X(0),Y(j));g.lineTo(X(W),Y(j));}
  g.stroke();}
  g.fillStyle='rgba(255,77,94,.07)';g.fillRect(X(0),Y(0),W*sc,5*sc);
  g.fillStyle='rgba(77,159,255,.07)';g.fillRect(X(0),Y(H-5),W*sc,5*sc);
  // ground: craters, the crystal mine; then every object back to front
  for(const cr of craters)drawCrater(g,cr,sc,X,Y);
  if(cry){const mx=X(cry.mine.x),my=Y(cry.mine.y),t=performance.now()/1000;
   g.save();g.globalAlpha=0.1;g.fillStyle='#b98cff';g.beginPath();g.arc(mx,my,CRY_MINE_R*sc,0,7);g.fill();g.globalAlpha=0.45;g.strokeStyle='#c79bff';g.lineWidth=2;g.setLineDash([6,8]);g.lineDashOffset=-t*8;g.beginPath();g.arc(mx,my,CRY_MINE_R*sc,0,7);g.stroke();g.restore();}
 }
 // meteor / stomp warnings: rings on the ground
 for(const wn of warns){const k=1-wn.t/wn.t0,wh=CH?hTop(wn.x,wn.y):0;
  g.fillStyle='rgba(255,77,94,'+(0.08+0.3*k)+')';g.beginPath();gArc(wn.x,wn.y,wn.r,undefined,undefined,false,wh);g.fill();
  g.strokeStyle='rgba(255,107,94,'+(0.5+0.5*Math.abs(Math.sin(performance.now()/90)))+')';g.lineWidth=2;g.setLineDash([5,4]);g.beginPath();gArc(wn.x,wn.y,wn.r,undefined,undefined,false,wh);g.stroke();g.setLineDash([]);
  g.strokeStyle='rgba(255,230,200,.8)';g.lineWidth=1.5;g.beginPath();gArc(wn.x,wn.y,wn.r*(1-k),undefined,undefined,false,wh);g.stroke();}
 if(!D3){
  {const objs=[];for(const wl of baseWalls)objs.push([wl[1]+wl[3],0,wl]);for(const rk of rocks)objs.push([rk[1]+rk[2],1,rk]);
   objs.sort((a,b)=>a[0]-b[0]);
   for(const [,k,o] of objs){if(k)drawRock(g,o,sc,X,Y);else drawSolid(g,o,sc,X,Y);}}
  if(BR){   // tunnel floors and ground shadow of the deck
   const [dx,dy,dw,dh]=BR.deck;
   g.fillStyle='rgba(0,0,0,.35)';g.fillRect(X(dx)+sc*0.35,Y(dy)+sc*0.5,dw*sc,dh*sc);
   for(const [tx,tw] of BR.tunnels)for(const my of [dy-0.7,dy+dh]){g.fillStyle='#07080c';g.fillRect(X(tx),Y(my),tw*sc,0.7*sc);g.strokeStyle=BR.look==='mesa'?'#8a735f':'#8a92bd';g.lineWidth=2;g.strokeRect(X(tx),Y(my),tw*sc,0.7*sc);}
  }
 }
 // your weapon range
 if(me&&me.hp>0){g.strokeStyle='rgba(77,159,255,'+(CH?0.42:D3?0.3:0.18)+')';g.lineWidth=CH?2:1.5;g.setLineDash([6,6]);g.beginPath();gArc(me.x,me.y,STAT.range,undefined,undefined,false,hOf(me));g.stroke();g.setLineDash([]);}
 // Moon Zone (and where it moves next)
 if(gzones&&gzones[0].next){const nz=gzones[0].next,k=Math.max(0,gzones[0].t)/ZONE_WARN,t=performance.now()/300;
  g.strokeStyle='#ffcf4a';g.globalAlpha=0.5+0.4*Math.sin(t);g.lineWidth=3;g.setLineDash([4,7]);g.beginPath();gArc(nz.x,nz.y,ZONE_R);g.stroke();g.setLineDash([]);
  g.globalAlpha=0.9;g.lineWidth=4;g.beginPath();gArc(nz.x,nz.y,ZONE_R+(CH?0.22:6/sc),-Math.PI/2,-Math.PI/2+Math.PI*2*(1-k));g.stroke();g.globalAlpha=1;
  WP(nz.x,nz.y,0);g.fillStyle='#ffcf4a';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(KU()*0.95));g.fillText(Math.ceil(Math.max(0,gzones[0].t))+'',WPx,WPy);g.textBaseline='top';}
 if(gzones)for(const z of gzones){WP(z.x,z.y,0);const zx=WPx,zy=WPy,zr=z.r*sc,t=performance.now()/600;
  const col=z.own===0?TC[0]:z.own===1?TC[1]:'#c9d6e3';
  if(!D3){g.globalAlpha=0.14+0.05*Math.sin(t*2);g.fillStyle=col;g.beginPath();g.arc(zx,zy,zr,0,7);g.fill();g.globalAlpha=1;
   g.strokeStyle=col;g.lineWidth=2;g.setLineDash([8,6]);g.lineDashOffset=-t*12;g.beginPath();g.arc(zx,zy,zr,0,7);g.stroke();g.setLineDash([]);g.lineDashOffset=0;}
  if(Math.abs(z.cap)>0.01){g.strokeStyle=z.cap<0?TC[0]:TC[1];g.lineWidth=5;g.beginPath();gArc(z.x,z.y,z.r+(CH?0.15:4/sc),-Math.PI/2,-Math.PI/2+Math.PI*2*z.cap,z.cap<0);g.stroke();}
  if(!D3){g.fillStyle=col;g.globalAlpha=0.8;g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sc*1.1));g.fillText('☾',zx,zy);g.globalAlpha=1;g.textBaseline='top';}}
 if(!D3){
  if(cry)cry.loose.forEach((c,i)=>{if(c.l===0)drawCrystal(c,i);});
  for(const bxx of boxes){const bx=X(bxx.x),by=Y(bxx.y),sz=sc*0.9*(1+0.08*Math.sin(performance.now()/200));
   g.fillStyle='#ffcf4a';g.fillRect(bx-sz/2,by-sz/2,sz,sz);g.strokeStyle='#7a5a00';g.lineWidth=2;g.strokeRect(bx-sz/2,by-sz/2,sz,sz);
   g.fillStyle='#4a3500';g.textAlign='center';g.textBaseline='middle';g.font=font(Math.round(sz*0.8));g.fillText('?',bx,by+1);g.textBaseline='top';}
  for(const q of bullets){const px=X(q.x),py=Y(q.y),arch=q.o.wtype||'pulse',r=Math.max(2.5,sc*.16)*Math.min(1.8,q.dm);g.fillStyle=tcol(q.o.team);g.beginPath();g.arc(px,py,r+1,0,7);g.fill();g.fillStyle=arch==='moon'?'#d8f5ff':arch==='siege'?'#ffd29a':arch==='twin'?'#fff4ce':'#b9efff';g.beginPath();g.arc(px,py,r*.50,0,7);g.fill();if(arch==='moon'||arch==='siege'){const v=Math.hypot(q.vx,q.vy)||1;g.strokeStyle=arch==='moon'?'#6ed5ff':'#edac65';g.lineWidth=Math.max(1,sc*.07);g.beginPath();g.moveTo(px,py);g.lineTo(px-q.vx/v*sc*.35,py-q.vy/v*sc*.35);g.stroke();}}
 }
 // super telegraphs (lane for beam/shell, danger ring for nova): on the ground, so they dodge the same in 2D and 3D
 for(const r of units){
  if(!r.sup||r.hp<=0)continue;
  const S=SUP[r.sup.w],k=Math.max(0,Math.min(1,r.sup.el===undefined?1-r.sup.t/S.charge:r.sup.el/Math.max(0.05,r.sup.el+r.sup.t)));   // 0 at the press, 1 as it fires
  const tc=me&&r.team===me.team&&typeof FX3D!=='undefined'&&FX3D.PAL[r.sup.k]?FX3D.PAL[r.sup.k].a:'#ff3b3b',tc2=tc==='#ff3b3b'?'#ffb3b3':'#ffffff';   // an enemy's lane is red (danger); your side's is the super's own colour
  if(S.kind==='nova'){g.globalAlpha=0.15+0.3*k;g.strokeStyle=tc;g.lineWidth=3;g.beginPath();gArc(r.x,r.y,S.r,undefined,undefined,false,hSup(r));g.stroke();g.globalAlpha=1;}
  else if(CH){const len=S.kind==='beam'?S.len:beamLen(r,r.sup.ang),wdt=S.kind==='beam'?S.w:1.2,hh=hSup(r);
   g.globalAlpha=0.12+0.28*k;g.fillStyle=tc;gLane(r.x,r.y,hh,r.sup.ang,len,wdt,true,false);g.globalAlpha=0.5+0.5*k;g.strokeStyle=tc2;gLane(r.x,r.y,hh,r.sup.ang,len,wdt,false,true);g.globalAlpha=1;}
  else{const len=S.kind==='beam'?S.len:beamLen(r,r.sup.ang),wdt=S.kind==='beam'?S.w:1.2;
   g.save();g.translate(X(r.x),Y(r.y)-liftOf(r));g.scale(1,GK);g.rotate(r.sup.ang);g.globalAlpha=0.12+0.28*k;g.fillStyle=tc;
   g.fillRect(0,-wdt*sc,len*sc,wdt*2*sc);g.globalAlpha=0.5+0.5*k;g.fillStyle=tc2;g.fillRect(0,-1,len*sc,2);g.restore();g.globalAlpha=1;}
 }
 if(!D3){
  for(const bm of beams){g.globalAlpha=Math.min(1,bm.t/0.15);g.strokeStyle=(bm.w||1.2)>=1.9?'#75d5ff':bm.c;g.lineWidth=Math.max(6,sc*0.9*(bm.w||1.25));g.lineCap='round';
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
 }
 if(aim&&aim.on&&me&&me.hp>0){const S=SUP[me.wtype||'pulse'],a=aimAng(),px=X(me.x),py=Y(me.y)-liftOf(me),hh=hOf(me);
  g.save();g.globalAlpha=0.5+0.2*Math.sin(performance.now()/100);
  if(S.kind==='nova'){g.strokeStyle='#ffd24a';g.lineWidth=3;g.setLineDash([6,5]);g.beginPath();gArc(me.x,me.y,S.r,undefined,undefined,false,hh);g.stroke();}
  else if(a!==null&&CH){const len=S.kind==='beam'?S.len:Math.min(S.range,beamLen(me,a)),wd=S.kind==='beam'?S.w:0.5;
   g.fillStyle='rgba(255,210,74,.22)';g.strokeStyle='#ffd24a';gLane(me.x,me.y,hh,a,len,wd,true,true,[8,6]);
   if(S.kind==='shell'){g.lineWidth=2;g.beginPath();gArc(me.x+Math.cos(a)*len,me.y+Math.sin(a)*len,S.r,undefined,undefined,false,hh);g.stroke();}}
  else if(a!==null){const len=S.kind==='beam'?S.len:Math.min(S.range,beamLen(me,a)),wd=S.kind==='beam'?S.w:0.5;
   g.translate(px,py);g.scale(1,GK);g.rotate(a);g.fillStyle='rgba(255,210,74,.22)';g.fillRect(0,-wd*sc,len*sc,wd*2*sc);
   g.strokeStyle='#ffd24a';g.lineWidth=2;g.setLineDash([8,6]);g.beginPath();g.moveTo(0,0);g.lineTo(len*sc,0);g.stroke();
   if(S.kind==='shell'){g.setLineDash([]);g.beginPath();g.arc(len*sc,0,S.r*sc,0,7);g.stroke();}}
  g.restore();}
 // tanks: ground level first (the bridge covers tanks in its tunnels)
 const drawOne=(b,col)=>{
  const pin=WPunit(b),px=WPx,py=WPy,ku=KU(),r=R*(CH?Math.max(sc*0.62,Math.min(sc*1.9,WPk)):sc),pt=CH&&!pin?WPtop+r*1.2:py;   // pt: labels hang from the tank's top under the chase camera
  if(!D3){
   g.save();g.globalAlpha=0.35;g.fillStyle=col;g.beginPath();g.ellipse(px,py+r*0.95,r*1.2,r*0.5,0,0,7);g.fill();g.restore();   // team underglow
   if(b===me){const pl=0.7+0.3*Math.sin(performance.now()/280);g.save();g.globalAlpha=pl;g.strokeStyle='#ffd24a';g.lineWidth=3;g.beginPath();g.ellipse(px,py+r*0.35,r*1.62,r*1.22,0,0,7);g.stroke();g.restore();}   // your tank wears a pulsing gold ring: find yourself in any cluster
   if(b.elev===1){g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(px+6,py+10,r*0.9,r*0.5,0,0,7);g.fill();}
   if(b.aura>0){const ac=b.aura>=3?'#e8f4ff':RCOL[b.aura],pl=b.aura>=2?0.5+0.5*Math.sin(performance.now()/420):0.5;   // rarity ring: rare, epic, legendary
    g.save();g.globalAlpha=0.3+0.3*pl;g.strokeStyle=ac;g.lineWidth=b.aura>=2?2.4:1.5;g.beginPath();g.ellipse(px,py+r*0.2,r*1.45,r*1.1,0,0,7);g.stroke();
    if(b.aura>=2){g.globalAlpha=0.07+0.07*pl;g.fillStyle=ac;g.fill();}g.restore();}
   if(b.vl>=10){const t=performance.now()/1000;g.save();g.globalAlpha=0.5+0.25*Math.sin(t*2.6);g.strokeStyle='#ffcf4a';g.lineWidth=2.5;g.setLineDash([r*0.7,r*0.45]);g.lineDashOffset=-t*r*1.4;   // Vault level 10: a gold aura ring
    g.beginPath();g.ellipse(px,py+r*0.2,r*1.9,r*1.45,0,0,7);g.stroke();g.restore();}
   if(b.vl>=5&&b.trail&&b.trail.length>2){const a=b.trail[0],z=b.trail[b.trail.length-1];if(Math.hypot(a.x-z.x,a.y-z.y)>0.25)b.trail.forEach((tp,i)=>{g.globalAlpha=0.12+0.08*i;g.fillStyle=i%2?'#fff3c2':'#ffcf4a';g.beginPath();g.arc(X(tp.x),Y(tp.y),r*(0.18+0.05*i),0,7);g.fill();});g.globalAlpha=1;}   // level 5: gold engine trail
  }
  if(!pin)b.buffs.forEach((bf,i)=>{const rr2=r*(1.6+0.22*i),left=Math.max(0,1-bf.taken/BUFF_LIFE);g.strokeStyle=BUFF[bf.k].c;g.lineWidth=2.5;
   g.globalAlpha=0.2;g.beginPath();g.arc(px,py,rr2,0,7);g.stroke();g.globalAlpha=1;
   g.beginPath();g.arc(px,py,rr2,-Math.PI/2,-Math.PI/2+Math.PI*2*left);g.stroke();});
  if(!D3&&(spdMult(b)>1||b.dash)&&b.trail){b.trail.forEach((t,i)=>{g.globalAlpha=0.08+0.05*i;g.fillStyle=col;g.beginPath();g.arc(X(t.x),Y(t.y),r*0.7,0,7);g.fill();});g.globalAlpha=1;}
  drawTank(b,col);
  if(!D3&&b.vl>0){const hd=b.hd===undefined?b.ang:b.hd;goldTooth(g,px+Math.cos(hd)*r*0.5,py+Math.sin(hd)*r*0.5*GK,r*0.5,b.vl>=10);   // Vault: the gold tooth on the hull
   if(b.vl>=25){const t=performance.now()/1000;for(let i=0;i<4;i++){const a=t*1.7+i*1.57,k=0.5+0.5*Math.sin(t*5+i*2);g.globalAlpha=k;star5(g,px+Math.cos(a)*r*1.25,py+Math.sin(a)*r*0.95,r*0.16,i%2?'#c79bff':'#fff3c2');}g.globalAlpha=1;}}   // level 25: hyperspace shimmer
  if(!D3&&b.shieldT>0){const pl=performance.now()/1000+(b.id||0)*1.7,br=r*4.0*(1+0.04*Math.sin(pl*7));   // plasma ball: a giant crackling blue sphere around the tank while the shield holds
   g.save();
   const gr=g.createRadialGradient(px,py,br*0.2,px,py,br);
   gr.addColorStop(0,'rgba(80,170,255,0.10)');gr.addColorStop(0.7,'rgba(60,150,255,0.16)');gr.addColorStop(0.93,'rgba(130,205,255,0.42)');gr.addColorStop(1,'rgba(130,205,255,0)');
   g.fillStyle=gr;g.beginPath();g.arc(px,py,br,0,7);g.fill();
   g.globalAlpha=0.16;g.strokeStyle='#4db2ff';g.lineWidth=10;g.beginPath();g.arc(px,py,br*0.96,0,7);g.stroke();
   g.globalAlpha=0.95;g.strokeStyle='#8fd0ff';g.lineWidth=3.5;g.beginPath();g.arc(px,py,br*0.97,0,7);g.stroke();
   g.strokeStyle='#e2f4ff';g.lineWidth=2;
   for(let i=0;i<3;i++){const a0=pl*(1.3+i*0.43)+i*2.1;g.globalAlpha=0.5+0.4*Math.sin(pl*9+i*2.4);g.beginPath();g.arc(px,py,br*(0.98-0.05*i),a0,a0+0.9+0.3*Math.sin(pl*5+i));g.stroke();}
   g.restore();}
  {const mine=b===me,bob=mine?Math.sin(performance.now()/300)*sc*0.09:0,fs=Math.round(ku*(mine?0.95:0.48));   // floating team chevron over every tank; yours is gold and bigger, the rest stay small and quiet so the map never looks cluttered
   g.save();g.globalAlpha=mine?1:0.55;g.fillStyle=mine?'#ffd24a':b.team!==0?'#ff4d5e':'#4d9fff';g.font=font(fs);g.textAlign='center';g.textBaseline='middle';
   if(!pin)g.fillText('▼',px,CH?pt-r*(mine?2.8:1.66)+bob:py-r*1.66*(D3&&b.boss?1.6:1)+bob);g.restore();}
  if(b.gh&&!b.boss){const fs=Math.max(9,Math.round(ku*0.42));g.font=font(fs);g.textAlign='center';g.textBaseline='middle';g.fillStyle=b.vl>=3?'#ffcf4a':'rgba(190,215,255,.8)';g.fillText(b.name,px,py+r*1.75+fs*0.6);g.textBaseline='top';}   // ghosts are always labeled
  if(b.boss){const fs=Math.max(11,Math.round(ku*0.62));g.font=font(fs);g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ff8a7e';g.fillText(b.bt&&b.bt.enr?'MEGATANK · ENRAGED':'MEGATANK',px,CH?pt-r*3.4-fs*0.6:py-r*2.0*(D3?1.6:1)-fs*0.6);g.textBaseline='top';}
  if(pvpOn()&&b!==me&&!b.ai){const fs=Math.max(10,Math.round(ku*0.5));g.font=font(fs);g.textAlign='center';g.textBaseline='middle';g.fillStyle=b.away?'rgba(223,231,242,.45)':b.vl>=3?'#ffcf4a':'rgba(223,231,242,.85)';g.fillText(b.name+(b.away?' (AI)':''),px,(CH?pt:py)-2.25*r*(b.dscale||1)-fs*(cry&&b.cry||matchG==='bounty'?1.9:0.9));g.textBaseline='top';}   // live pilots wear their name
 };
 for(const u of units)if(u.team!==0&&(u.elev||0)===0&&u.hp>0)drawOne(u,tcol(u.team));
 for(const u of units)if(u.team===0&&(u.elev||0)===0&&u.hp>0&&!(CH&&u===me))drawOne(u,TC[0]);
 // the bridge goes OVER ground tanks; tunnel stretches are see-through so you can track tanks under it
 if(BR&&!D3&&BR.look==='mesa')drawMesa2D(me&&underDeck(me));
 else if(BR&&!D3){
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
 if(cry&&!D3)cry.loose.forEach((c,i)=>{if(c.l===1)drawCrystal(c,i);});   // crystals on the bridge deck
 for(const u of units)if(u.team!==0&&(u.elev||0)===1&&u.hp>0)drawOne(u,tcol(u.team));
 for(const u of units)if(u.team===0&&(u.elev||0)===1&&u.hp>0&&!(CH&&u===me))drawOne(u,TC[0]);
 if(CH&&me&&me.hp>0&&me.team===0)drawOne(me,TC[0]);   // chase camera: your own tank's bar and chevron are drawn over every other
 const fu=tapFocus>=0?units.find(u=>u.id===tapFocus&&u.hp>0):null;   // your locked target wears gold brackets
 if(fu){WP(fu.x,fu.y,hOf(fu));const px=WPx,py=WPy,rr=R*(CH?Math.max(sc*0.62,Math.min(sc*1.9,WPk)):sc)*(fu.dscale||1)*1.5,k=rr*0.42;g.save();g.strokeStyle='#ffd24a';g.globalAlpha=0.72+0.28*Math.sin(performance.now()/160);g.lineWidth=3;g.beginPath();
  for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.moveTo(px+cx*rr,py+cy*rr-cy*k);g.lineTo(px+cx*rr,py+cy*rr);g.lineTo(px+cx*rr-cx*k,py+cy*rr);}
  g.stroke();g.restore();}
 if(storm){   // Last Standing: everything outside the ring is storm
  const t=performance.now()/1000;
  g.save();g.beginPath();if(CH){g.rect(-40,-40,vw+80,vh+80);gArc(storm.x,storm.y,Math.max(0.05,storm.r),undefined,undefined,false,me&&me.hp>0?hOf(me):0);}else{g.rect(X(0),Y(0),W*sc,AH);g.moveTo(X(storm.x)+Math.max(0,storm.r*sc),Y(storm.y));gArc(storm.x,storm.y,storm.r,0,Math.PI*2,true);}g.fillStyle='rgba(104,48,184,'+(D3?0.24:0.32)+')';g.fill('evenodd');
  g.strokeStyle='rgba(199,155,255,.9)';g.lineWidth=3;g.setLineDash([10,7]);g.lineDashOffset=-t*20;g.beginPath();gArc(storm.x,storm.y,storm.r,undefined,undefined,false,CH&&me&&me.hp>0?hOf(me):0);g.stroke();g.setLineDash([]);g.lineDashOffset=0;g.restore();}
 g.restore();   // end arena clip
 if(!D3){g.strokeStyle='#59607a';g.lineWidth=2;g.strokeRect(X(0),Y(0),W*sc,AH);}
 // floating text: labels stay on screen, damage numbers merge
 g.save();g.beginPath();if(CH)g.rect(-40,-40,vw+80,vh+80);else g.rect(X(0),Y(0)-(D3?sc*3:0),W*sc,AH+(D3?sc*3:0));g.clip();
 const lx=(x,txt)=>{const hw=g.measureText(txt).width/2+4;return CH?Math.max(hw+2,Math.min(vw-hw-2,x)):Math.max(X(0)+hw,Math.min(X(W)-hw,x));},ty0=CH?hudY0()+4:Y(0)+4;
 const up=D3?sc*0.6:0;   // in 3D, text floats from the top of the tanks
 TXN=0;   // chase camera: texts that would land on each other, on the minimap or under the buttons are moved clear (txtAt)
 for(const q of pops){WP(q.x,q.y,0);const ku=KU();g.globalAlpha=Math.min(1,q.t);g.fillStyle=q.c;g.textAlign='center';g.font=font(Math.round(ku*0.8));let tx,ty=Math.max(ty0,WPy-up-ku*(1.4-q.t)*1.2-ku);if(CH){txtAt(WPx,ty,txtW(q,ku*0.8),ku*0.8);tx=TXO[0];ty=TXO[1];}else tx=lx(WPx,q.txt);g.fillText(q.txt,tx,ty);g.globalAlpha=1;}
 for(const q of nums){if(!q.txt)continue;WP(q.x,q.y,0);const ku=KU();g.globalAlpha=Math.min(1,q.t/0.4)*(q.g?0.7:1);g.fillStyle=q.c;g.textAlign='center';g.font=font(Math.round((CH?Math.max(sc*0.62,Math.min(WPk,sc*1.05)):ku)*0.66*(q.z||1)));let tx,ty=Math.max(ty0,WPy-up-ku*(0.9-q.t)*1.6);if(CH){const fs=Math.max(sc*0.62,Math.min(WPk,sc*1.05))*0.66*(q.z||1);txtAt(WPx,ty,txtW(q,fs),fs);tx=TXO[0];ty=TXO[1];g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.55)';g.strokeText(q.txt,tx,ty);}else tx=lx(WPx,q.txt);g.fillText(q.txt,tx,ty);g.globalAlpha=1;}
 g.restore();
 if(CH)drawEdges();   // who and what is outside the frame
 else if(typeof pvpOn==='function'&&pvpOn()&&me)drawVeil();   // a live match without the chase camera: the same frame, drawn as a veil
 g.restore();   // end shake
 drawHUD();
}
// ---- off-screen indicators (chase camera, Session 5E-2b2a) ----
// The camera follows your tank, so a tank, an objective or a super can be outside the frame. Each gets a marker on the
// frame's edge, pointing at it: enemies a red wedge (bigger and brighter the closer they are, pulsing while you are inside
// their range), a super that is about to reach you a flashing warning, team mates a small blue dot, objectives a gold or
// purple diamond. Shape and colour both tell them apart. The frame is the screen minus the HUD and the buttons.
const EDGE={x:0,y:0,a:0},EDL=[];
const edgeWide=()=>vw>vh*1.2;
function edgeBox(){return {l:16,t:edgeWide()?14:hudY0()+sc*1.5,r:vw-16,b:vh-SAB-18};}   // a wide screen: the true top edge (the HUD only fills its corners and the middle)
const btnZone=()=>{const s=BS();return {x:vw-212*s,y:vh-SAB-214*s};};
function edgeFix(e){   // keep a marker off the buttons, the minimap and the HUD
 const Z=btnZone();if(e.x>Z.x&&e.y>Z.y){if(vw-16-e.x<vh-SAB-18-e.y)e.y=Z.y;else e.x=Z.x;}
 const M=miniRect();if(e.x<M.x+M.w+10&&e.y<M.y+M.h+10){if(e.x-M.x<e.y-M.y)e.y=M.y+M.h+10;else e.x=M.x+M.w+10;}
 if(edgeWide()&&e.y<hudY0()){const pad=Math.max(8,sc*0.4),bw=Math.min(sc*7.2,(vw-pad*2)/2-sc*2.6);if(e.x<pad+bw+14||e.x>vw-pad-bw-14||Math.abs(e.x-vw/2)<sc*2.6)e.y=hudY0()+6;}return e;}
// a marker whose tip touches the frame's edge. shape 0: a wedge (enemy), 1: a dot with a pointer (team mate), 2: a diamond
// (objective). Leaves the canvas translated to the marker's middle: the caller draws its extras, then g.restore()
function edgeChip(e,r,fill,line,shape,a){
 const cx=e.x-Math.cos(e.a)*(r+5),cy=e.y-Math.sin(e.a)*(r+5);g.save();g.globalAlpha=a;g.translate(cx,cy);
 g.fillStyle=fill;g.strokeStyle=line;g.lineWidth=2;g.lineJoin='round';g.save();g.rotate(e.a);g.beginPath();
 if(shape===0){g.moveTo(r+5,0);g.lineTo(-r*0.75,-r*0.92);g.lineTo(-r*0.3,0);g.lineTo(-r*0.75,r*0.92);g.closePath();}
 else if(shape===1){g.moveTo(r+4,0);g.lineTo(r*0.5,-r*0.72);g.arc(0,0,r*0.88,-0.96,0.96,true);g.closePath();}
 else{g.moveTo(r+5,0);g.lineTo(0,-r);g.lineTo(-r,0);g.lineTo(0,r);g.closePath();}
 g.stroke();g.fill();g.restore();
}
function drawEdges(){
 if(state!=='play'&&state!=='round')return;
 const B=edgeBox(),now=performance.now(),quiet=typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced(),alive=!!me&&me.hp>0,es=Math.max(1,Math.min(2.4,sc/17));   // es: markers grow with the HUD (a desktop's are nearly twice a phone's)
 let ax,ay;if(alive){WP(me.x,me.y,hOf(me));ax=WPx;ay=WPy;}
 const Z=btnZone();
 const at=(x,y,h)=>{const e=ArenaCam.pointer(x,y,h,B,ax,ay,EDGE);if(e)return edgeFix(e);
  if(WP(x,y,h)&&WPx>Z.x+8&&WPy>Z.y+8){if(WPx-Z.x<WPy-Z.y){EDGE.x=Z.x;EDGE.y=Math.min(WPy,vh-SAB-24);EDGE.a=0;}else{EDGE.x=Math.min(WPx,vw-24);EDGE.y=Z.y;EDGE.a=Math.PI/2;}return EDGE;}   // under your own buttons: marked on the edge of the button corner
  return null;};
 // enemies: the nearest four that are outside the frame
 EDL.length=0;if(me)for(const u of units){if(u.hp<=0||u===me||u.team===me.team)continue;EDL.push([Math.hypot(u.x-me.x,u.y-me.y),u]);}
 EDL.sort((a,b)=>a[0]-b[0]);let shown=0;
 for(const [d,u] of EDL){if(shown>=4)break;const e=at(u.x,u.y,hOf(u)+0.5);if(!e)continue;shown++;
  const near=1-Math.max(0,Math.min(1,(d-5)/14)),hot=alive&&d<=STAT.range+0.6,pulse=hot&&!quiet?0.5+0.5*Math.sin(now/110):hot?1:0,r=((u.boss?14:10)+4*near+2*pulse)*es;
  edgeChip(e,r,hot?'#ff3044':'#e8475a','rgba(8,10,16,.85)',0,0.55+0.4*near+0.05*pulse);
  if(hot){g.strokeStyle='rgba(255,255,255,'+(0.5+0.5*pulse)+')';g.lineWidth=2;g.beginPath();g.arc(0,0,r+6+2*pulse,0,7);g.stroke();}
  {const hf=Math.max(0,Math.min(1,u.hp/u.mhp));g.strokeStyle='rgba(8,10,16,.8)';g.lineWidth=4;g.beginPath();g.arc(0,0,r*0.46,0,7);g.stroke();g.strokeStyle='#ffffff';g.lineWidth=2;g.beginPath();g.arc(0,0,r*0.46,-Math.PI/2,-Math.PI/2+Math.PI*2*hf);g.stroke();}   // its health, as an arc
  g.restore();}
 // a super that will reach you from outside the frame
 if(alive)for(const r of units){if(!r.sup||r.hp<=0||r.team===me.team||!SUP[r.sup.w])continue;const S=SUP[r.sup.w];let hit=false;
  if(S.kind==='nova')hit=Math.hypot(me.x-r.x,me.y-r.y)<S.r+1.6;
  else{const len=S.kind==='beam'?S.len:S.range+(S.r||0),wd=(S.kind==='beam'?S.w:(S.r||1.2))+1.3,dx=me.x-r.x,dy=me.y-r.y,ca=Math.cos(r.sup.ang),sa=Math.sin(r.sup.ang),al=dx*ca+dy*sa,ac=Math.abs(-dx*sa+dy*ca);hit=al>-0.5&&al<len+1&&ac<wd;}
  if(!hit)continue;const e=at(r.x,r.y,hOf(r)+0.5);if(!e)continue;
  const f=quiet?1:0.5+0.5*Math.sin(now/70),rr2=(17+3*f)*es,cx=e.x-Math.cos(e.a)*(rr2+28),cy=e.y-Math.sin(e.a)*(rr2+28);
  g.save();g.globalAlpha=0.75+0.25*f;g.fillStyle='#ff2a3c';g.strokeStyle='#fff';g.lineWidth=2.5;g.beginPath();g.arc(cx,cy,rr2,0,7);g.fill();g.stroke();
  g.fillStyle='#fff';g.font='700 '+Math.round(rr2*1.3)+'px '+FONT_FAMILY;g.textAlign='center';g.textBaseline='middle';g.fillText('!',cx,cy+1);g.textBaseline='top';g.restore();}
 // a Siege shell in flight outside the frame (its lane ended when it left the barrel): the same warning while it can still land on you
 if(alive)for(const sh of shells){if(sh.owner&&sh.owner.team===me.team)continue;const lx=sh.vx!==undefined?sh.x+sh.vx*Math.max(0,sh.life||0):sh.x,ly=sh.vy!==undefined?sh.y+sh.vy*Math.max(0,sh.life||0):sh.y,R0=(sh.r||SUP.siege.r)+1.6;
  const dx=lx-sh.x,dy=ly-sh.y,L2=dx*dx+dy*dy,t=L2>1e-6?Math.max(0,Math.min(1,((me.x-sh.x)*dx+(me.y-sh.y)*dy)/L2)):0,near=Math.hypot(me.x-sh.x-dx*t,me.y-sh.y-dy*t);
  if(near>(sh.vx!==undefined?R0:9))continue;const e=at(sh.x,sh.y,1.2);if(!e)continue;
  const f=quiet?1:0.5+0.5*Math.sin(now/70),rr2=(15+3*f)*es,cx=e.x-Math.cos(e.a)*(rr2+28),cy=e.y-Math.sin(e.a)*(rr2+28);
  g.save();g.globalAlpha=0.75+0.25*f;g.fillStyle='#ff7a2f';g.strokeStyle='#fff';g.lineWidth=2.5;g.beginPath();g.arc(cx,cy,rr2,0,7);g.fill();g.stroke();g.fillStyle='#fff';g.font='700 '+Math.round(rr2*1.3)+'px '+FONT_FAMILY;g.textAlign='center';g.textBaseline='middle';g.fillText('!',cx,cy+1);g.textBaseline='top';g.restore();}
 // team mates: small and quiet, the nearest two
 if(me){EDL.length=0;for(const u of units){if(u.hp<=0||u===me||u.team!==me.team)continue;EDL.push([Math.hypot(u.x-me.x,u.y-me.y),u]);}EDL.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<EDL.length&&i<2;i++){const u=EDL[i][1],e=at(u.x,u.y,hOf(u)+0.5);if(!e)continue;edgeChip(e,7.5*es,'#4d9fff','rgba(8,10,16,.8)',1,0.75);g.restore();}}
 // objectives
 const obj=(x,y,h,fill,glyph,r,a)=>{const e=at(x,y,h);if(!e)return;r=(r||11)*es;edgeChip(e,r,fill,'rgba(8,10,16,.85)',2,a===undefined?0.9:a);if(glyph){g.fillStyle='#10161d';g.font='700 '+Math.round(r*1.05)+'px '+FONT_FAMILY;g.textAlign='center';g.textBaseline='middle';g.fillText(glyph,0,1);g.textBaseline='top';}g.restore();};
 if(gzones)for(const z of gzones){obj(z.x,z.y,0,z.own===0?TC[0]:z.own===1?TC[1]:'#dfe7f2','☾',12);if(z.next)obj(z.next.x,z.next.y,0,'#ffcf4a','☾',10,quiet?0.8:0.55+0.3*Math.sin(now/300));}
 if(cry)obj(cry.mine.x,cry.mine.y,0,'#c79bff','',11);
 if(alive&&boxes.length){let b=null,bd=1e9;for(const q of boxes){const d=Math.hypot(q.x-me.x,q.y-me.y);if(d<bd){bd=d;b=q;}}if(b)obj(b.x,b.y,0.5,'#ffcf4a','?',10,0.85);}
 if(storm&&alive&&Math.hypot(me.x-storm.x,me.y-storm.y)>storm.r)obj(storm.x,storm.y,0,'#c79bff','',12);
}
// ---- the veil: a live match without the chase camera (2D graphics, no WebGL, LUNAR_CHASECAM=false) ----
// Fairness: the chase camera shows part of the arena; these views show all of it. In a live match the part the chase camera
// would not show is veiled, and tanks under the veil are dots, which is what the chase camera's minimap gives. Both pilots
// then know the same things, whatever their graphics setting. AI matches are not veiled (a bot has no camera to be fair to).
const VME={x:0,y:0,h:0,alive:true},VIN={vw:0,vh:0,me:VME,foes:[],quiet:true},VP=[[0,0],[0,0],[0,0],[0,0]];let veilKey='',veilT=0;
function drawVeil(){
 if(typeof ArenaCam==='undefined'){if(!drawVeil.asked){drawVeil.asked=1;const s=document.createElement('script');s.src='js/arenacam.js?v='+(window.BUILD||'dev');s.dataset.arena='arenacam';s.addEventListener('load',()=>{s.dataset.ok=1;});s.addEventListener('error',()=>{s.dataset.ok=0;});document.head.appendChild(s);}return;}
 const key=curMap+'|'+(units?units.length:0);if(veilKey!==key){veilKey=key;ArenaCam.setMap(MAPS[curMap],typeof ArenaProps!=='undefined'?ArenaProps.DECK_UP:2.1);ArenaCam.begin({noIntro:true});}
 const now=performance.now(),dt=veilT?Math.min(0.05,(now-veilT)/1000):0.016;veilT=now;
 VME.x=me.x;VME.y=me.y;VME.h=0;VME.alive=me.hp>0;VIN.vw=vw;VIN.vh=vh;ArenaCam.update(dt,VIN);
 const top=SAT+Math.max(6,sc*0.3)+HUD*sc,C4=[[0,top],[vw,top],[vw,vh],[0,vh]];
 for(let i=0;i<4;i++){let q=null;for(let k=0;k<10&&!q;k++)q=ArenaCam.ground(C4[i][0],C4[i][1]+k*vh*0.06,0,VP[i]);if(!q)return;}   // a corner that looks over the horizon: the next ground point down the screen
 const inside=(x,y)=>{let s=0;for(let i=0;i<4;i++){const a=VP[i],b=VP[(i+1)%4],c=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(c>0)s++;else if(c<0)s--;}return s===4||s===-4;};
 g.save();g.beginPath();g.rect(-40,-40,vw+80,vh+80);g.moveTo(X(VP[0][0]),Y(VP[0][1]));for(let i=1;i<4;i++)g.lineTo(X(VP[i][0]),Y(VP[i][1]));g.closePath();g.fillStyle='rgba(5,8,14,.9)';g.fill('evenodd');
 g.strokeStyle='rgba(223,231,242,.25)';g.lineWidth=1;g.beginPath();g.moveTo(X(VP[0][0]),Y(VP[0][1]));for(let i=1;i<4;i++)g.lineTo(X(VP[i][0]),Y(VP[i][1]));g.closePath();g.stroke();
 for(const u of units){if(u.hp<=0||u===me||inside(u.x,u.y))continue;g.beginPath();g.arc(X(u.x),Y(u.y)-liftOf(u),Math.max(3,sc*0.2),0,7);g.fillStyle=u.team===me.team?'#4d9fff':'#ff4d5e';g.fill();g.lineWidth=1;g.strokeStyle='rgba(6,10,18,.9)';g.stroke();}
 g.restore();
}
// ---- the minimap (chase camera, Session 5E-2b2a) ----
// The camera follows your tank, so the whole arena is no longer on the screen at once. The minimap gives that back: the
// arena's solids, the bridge, objectives, every tank that is alive (the same things the full-map view always showed, to
// every player alike) and the part of the arena your screen is showing.
const miniRect=()=>{const u=sc<25?Math.max(2.3,sc*0.128):Math.min(9,sc*0.235);return {x:hudX0(),y:hudY0()+sc*0.45,w:W*u,h:H*u,u};};
const MG=[0,0],MINI={key:'',c:null};
function drawMini(){
 const M=miniRect(),u=M.u,mx=x=>M.x+x*u,my=y=>M.y+y*u,now=performance.now();
 g.save();
 g.fillStyle=u<4?'rgba(6,10,18,.56)':'rgba(6,10,18,.66)';rr(g,M.x-3,M.y-3,M.w+6,M.h+6,5);g.fill();g.strokeStyle='rgba(223,231,242,.22)';g.lineWidth=1;g.stroke();
 g.beginPath();g.rect(M.x,M.y,M.w,M.h);g.clip();
 {   // the solids are drawn once per map (and whenever a crate breaks) into a small picture
  const key=curMap+'|'+u.toFixed(2)+'|'+baseWalls.length+'|'+dpr;
  if(MINI.key!==key){MINI.key=key;const c=MINI.c||(MINI.c=document.createElement('canvas'));c.width=Math.ceil(M.w*dpr);c.height=Math.ceil(M.h*dpr);const x=c.getContext('2d');x.setTransform(dpr*u,0,0,dpr*u,0,0);x.clearRect(0,0,W,H);
   x.fillStyle='rgba(255,77,94,.10)';x.fillRect(0,0,W,5);x.fillStyle='rgba(77,159,255,.10)';x.fillRect(0,H-5,W,5);   // the two ends
   x.fillStyle='rgba(200,210,225,.42)';for(const w of baseWalls)x.fillRect(w[0],w[1],w[2],w[3]);
   for(const r of rocks){x.beginPath();x.arc(r[0],r[1],r[2],0,7);x.fill();}
   if(BR){const [dx,dy,dw,dh]=BR.deck;x.fillStyle='rgba(120,160,200,.5)';x.fillRect(dx,dy,dw,dh);x.fillStyle='rgba(6,10,18,.75)';for(const [tx,tw] of BR.tunnels)x.fillRect(tx,dy,tw,dh);
    x.fillStyle='rgba(120,160,200,.3)';for(const [rx,ry,rw,rh] of BR.ramps)x.fillRect(rx,ry,rw,rh);}}
  g.drawImage(MINI.c,M.x,M.y,M.w,M.h);}
 if(storm){g.fillStyle='rgba(104,48,184,.35)';g.beginPath();g.rect(M.x,M.y,M.w,M.h);g.arc(mx(storm.x),my(storm.y),Math.max(0.5,storm.r*u),0,Math.PI*2,true);g.fill('evenodd');g.strokeStyle='#c79bff';g.lineWidth=1;g.beginPath();g.arc(mx(storm.x),my(storm.y),Math.max(0.5,storm.r*u),0,7);g.stroke();}
 if(gzones)for(const z of gzones){const c=z.own===0?TC[0]:z.own===1?TC[1]:'#dfe7f2';g.strokeStyle=c;g.lineWidth=1.5;g.beginPath();g.arc(mx(z.x),my(z.y),z.r*u,0,7);g.stroke();g.globalAlpha=0.25;g.fillStyle=c;g.fill();g.globalAlpha=1;
  if(z.next){g.strokeStyle='#ffcf4a';g.setLineDash([2,2]);g.beginPath();g.arc(mx(z.next.x),my(z.next.y),ZONE_R*u,0,7);g.stroke();g.setLineDash([]);}}
 if(cry){diamond(g,mx(cry.mine.x),my(cry.mine.y),Math.max(3,u*1.3),'#c79bff');g.fillStyle='#e2d0ff';for(const c of cry.loose)g.fillRect(mx(c.x)-1,my(c.y)-1,2,2);}
 g.fillStyle='#ffcf4a';for(const b of boxes)g.fillRect(mx(b.x)-2,my(b.y)-2,4,4);
 // what your screen shows: the four corners of the screen, cast onto the ground
 if(typeof ArenaCam!=='undefined'){const P=[[0,hudY0()],[vw,hudY0()],[vw,vh],[0,vh]];let ok=true;g.beginPath();for(let i=0;i<4;i++){const q=ArenaCam.ground(P[i][0],P[i][1],0,MG);if(!q){ok=false;break;}if(i)g.lineTo(mx(q[0]),my(q[1]));else g.moveTo(mx(q[0]),my(q[1]));}
  if(ok){g.closePath();g.fillStyle='rgba(255,255,255,.07)';g.fill();g.strokeStyle='rgba(255,255,255,.4)';g.lineWidth=1;g.stroke();}}
 // tanks: enemies, then your side, then you
 const dot=(b,c,r)=>{g.beginPath();g.arc(mx(b.x),my(b.y),r,0,7);g.fillStyle=c;g.fill();g.lineWidth=1;g.strokeStyle='rgba(6,10,18,.9)';g.stroke();};
 const dr=Math.max(3,u*1.05);
 for(const b of units)if(b.hp>0&&b.team!==(me?me.team:0))dot(b,'#ff4d5e',b.boss?dr*1.9:dr);
 for(const b of units)if(b.hp>0&&b!==me&&b.team===(me?me.team:0))dot(b,'#4d9fff',dr);
 if(me&&me.hp>0){g.fillStyle='#10161d';g.beginPath();g.arc(mx(me.x),my(me.y),dr+2.2,0,7);g.fill();dot(me,'#ffd24a',dr+1);}
 g.restore();
}
let HUDG=null;   // the band behind the team bars on sunlit maps (built once per layout)
function drawHUD(){
 const CH=CAM(),top=hudTop(),mid=CH?vw/2:X(W/2),pad=Math.max(8,sc*0.4),HY=hudY0(),HX=hudX0();
 let mx=0,my=0,mk=sc;if(me){if(CH){WP(me.x,me.y,hOf(me));mx=WPx;my=WPy;mk=KU();}else{mx=X(me.x);my=Y(me.y);}}   // where your tank is on the screen (notes that hang under it)
 const hy=top+sc*0.35,bh=Math.max(10,sc*0.62),bw=Math.min(sc*7.2,(vw-pad*2)/2-sc*2.6);
 g.textBaseline='middle';
 // sunlit maps (Session 5E-2c): a soft dark band behind the team bars so they read over bright ground. It ends at the
 // arena's north edge, so no tank is ever under it
 if(D3on()&&typeof B3!=='undefined'&&B3.map&&B3.map.arena){const y0=top-sc*1.6,y1=top+sc*(HUD+(CH?1.1:0));if(!HUDG||HUDG.y0!==y0||HUDG.y1!==y1){const gr=g.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,'rgba(6,8,13,0)');gr.addColorStop(0.3,'rgba(6,8,13,0.5)');gr.addColorStop(0.68,'rgba(6,8,13,0.5)');gr.addColorStop(1,'rgba(6,8,13,0)');HUDG={y0,y1,gr};}g.fillStyle=HUDG.gr;g.fillRect(0,y0,vw,y1-y0);}
 const n=MM.n,solo=!!storm,topLine=!!(gzones||cry||storm||matchG==='bounty');
 const side=(t,left)=>{
  const x0=left?pad:vw-pad-bw,col=TC[t];
  let lbl=(t===0?'You':boss?'Megatank':'Foes')+(n>1&&!solo&&!(boss&&t===1)?' ×'+aliveCount(t):'');
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
 if(CH)drawMini();
 // timer pill
 const tl=Math.max(0,Math.ceil(timeLeft)),mm=Math.floor(tl/60),ss=String(tl%60).padStart(2,'0');
 const tw=sc*3.6,th=sc*1.5;g.fillStyle='rgba(10,14,23,.85)';rr(g,mid-tw/2,hy,tw,th,th/2);g.fill();g.strokeStyle=tl<=10?'#ff6b5e':'rgba(223,231,242,.18)';g.lineWidth=1.5;rr(g,mid-tw/2,hy,tw,th,th/2);g.stroke();
 g.fillStyle=tl<=10?'#ff8a7e':'#dfe7f2';g.textAlign='center';g.font=font(Math.round(sc*1.05));g.fillText(mm+':'+ss,mid,hy+th/2+1);
 if(series){g.font=font(Math.round(sc*0.6));g.fillStyle='rgba(223,231,242,.7)';g.textAlign='center';g.fillText('Round '+series.round,mid,hy+th+sc*0.55);}
 else if(matchG==='bounty'&&me&&!evt){g.font=font(Math.round(sc*0.6));g.fillStyle='#ffcf4a';g.textAlign='center';g.fillText('Your bounty: '+(me.bty||BTY_START),mid,hy+th+sc*0.55);}
 if(evt&&evt.k!=='drop'){g.font=font(Math.round(sc*0.6));g.fillStyle=EVENTS[evt.k].c;g.textAlign='center';g.fillText((evt.k==='meteor'?'Meteor shower ':'Solar flare ')+Math.ceil(evt.t)+'s',mid,hy+th+sc*0.55);}
 const outRing=!!storm&&me&&me.hp>0&&Math.hypot(me.x-storm.x,me.y-storm.y)>storm.r;
 if(me&&me.hp>0&&state==='play'&&slowAt(me)<1&&!(me.rep>0)&&!outRing){g.fillStyle='#c9b48a';g.font=font(Math.round(sc*0.62));g.textAlign='center';if(CH){g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.7)';g.strokeText('crater: slowed',mx,my+mk*1.4);g.fillStyle='#f0dcae';}g.fillText('crater: slowed',mx,my+mk*1.4);}
 if(ffBtnOn()){const F=ffBtn();g.fillStyle=ffwd?'rgba(255,122,47,.92)':'rgba(10,14,23,.88)';rr(g,F.x,F.y,F.w,F.h,F.h/2);g.fill();g.strokeStyle=ffwd?'#ffb37a':'rgba(223,231,242,.4)';g.lineWidth=1.5;rr(g,F.x,F.y,F.w,F.h,F.h/2);g.stroke();
  g.fillStyle=ffwd?'#2a1004':'#dfe7f2';g.font=font(15);g.textAlign='center';g.fillText(ffwd?'Speeding up ×3':'Fast forward',F.x+F.w/2,F.y+F.h/2+1);}
 g.textAlign='center';
 if(gzones){const z=gzones[0];g.font=font(Math.round(sc*0.62));g.fillStyle=z.next?'#ffcf4a':'rgba(223,231,242,.6)';
  g.fillText((z.next?'Zone moving in ':'Zone moves in ')+Math.ceil(Math.max(0,z.t))+'s',mid,HY+sc*0.6);}
 if(cry){if(cry.cd){const ours=cry.cd.team===0;g.font=font(Math.round(sc*0.95));g.fillStyle=ours?'#5fe3a1':'#ff6b5e';g.fillText((ours?'You win in ':'They win in ')+Math.ceil(Math.max(0,cry.cd.t)),mid,HY+sc*0.75);}
  else{g.font=font(Math.round(sc*0.62));g.fillStyle='rgba(223,231,242,.6)';g.fillText('Hold 10 crystals for 15s to win',mid,HY+sc*0.6);}}
 if(matchG==='bounty'){g.font=font(Math.round(sc*0.62));g.fillStyle='rgba(223,231,242,.6)';g.fillText('Most stars wins',mid,HY+sc*0.6);}
 if(storm){const closing=elapsed>=STORM_T0;g.font=font(Math.round(sc*0.62));g.fillStyle=closing?'#c79bff':'rgba(223,231,242,.6)';
  g.fillText(closing?(storm.r>STORM_R1+0.01?'The ring is closing':'Final ring'):'Ring closes in '+Math.ceil(STORM_T0-elapsed)+'s',mid,HY+sc*0.6);
  if(outRing){g.fillStyle='#e7cbff';g.font=font(Math.round(sc*0.72));g.fillText('Get inside the ring!',mx,my+mk*1.45);}}
 if(respawns()){
  if(me.hp>0&&me.rep>0){g.fillStyle='#5fe3a1';g.font=font(Math.round(sc*0.62));g.fillText('+ repairing',mx,my+mk*1.4);}
  if(me.hp<=0&&state==='play'){g.fillStyle='rgba(255,255,255,.92)';g.font=font(Math.round(sc*1.1));g.fillText('Back in '+Math.max(1,Math.ceil(respawnFor(me)-(me.dead||0))),mid,CH?vh*0.4:Y(H/2)-sc*2);}}
 // buff chips for you
 me.buffs.forEach((b,i)=>{const w=sc*1.9,h=sc*0.9,x=HX+(CH?0:4)+i*(w+3),y=CH?miniRect().y+miniRect().h+6:HY+4;
  g.fillStyle=BUFF[b.k].c;rr(g,x,y,w,h,3);g.fill();g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,y+h-3,w*(1-b.taken/BUFF_LIFE),3);
  g.fillStyle='#10161d';g.textAlign='center';g.font=font(Math.round(sc*0.55));g.fillText(BUFF[b.k].n,x+w/2,y+h/2);});
 // counter banner
 if(banner){g.globalAlpha=Math.min(1,banner.t*2);g.font=font(Math.round(sc*0.72));const bw2=g.measureText(banner.txt).width+26,bh2=sc*1.3,bx2=mid-bw2/2,by2=HY+sc*(topLine?1.5:0.5);
  g.fillStyle='rgba(8,12,18,.88)';rr(g,bx2,by2,bw2,bh2,bh2/2);g.fill();g.strokeStyle=banner.c;g.lineWidth=1.5;rr(g,bx2,by2,bw2,bh2,bh2/2);g.stroke();
  g.fillStyle=banner.c;g.textAlign='center';g.fillText(banner.txt,mid,by2+bh2/2+1);g.globalAlpha=1;}
 if(pvpLag()){const tw4=sc*6,th4=sc*1.2,yy=CH?vh*0.3:Y(H/2)-sc*4;g.fillStyle='rgba(10,14,23,.88)';rr(g,mid-tw4/2,yy,tw4,th4,th4/2);g.fill();g.strokeStyle='#ffcf4a';g.lineWidth=1.5;rr(g,mid-tw4/2,yy,tw4,th4,th4/2);g.stroke();
  g.fillStyle='#ffcf4a';g.textAlign='center';g.font=font(Math.round(sc*0.62));g.fillText('Reconnecting…',mid,yy+th4/2+1);}
 // joystick
 if(joy.on){g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=2;g.beginPath();g.arc(joy.sx,joy.sy,55,0,7);g.stroke();
  g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(joy.x,joy.y,22,0,7);g.fill();}
 // tutorial coaching
 if(tut&&state==='play'&&TUT_STEPS[tut.step]){const S=TUT_STEPS[tut.step];if(!S.wait||S.wait()){
  g.font=font(Math.round(Math.max(13,sc*0.8)));
  const maxW=vw-48;let lines=[S.txt];
  if(g.measureText(S.txt).width>maxW){const ws=S.txt.split(' ');let best=1,bd=1e9;for(let i=1;i<ws.length;i++){const a=ws.slice(0,i).join(' '),b=ws.slice(i).join(' '),d=Math.abs(g.measureText(a).width-g.measureText(b).width);if(d<bd){bd=d;best=i;}}lines=[ws.slice(0,best).join(' '),ws.slice(best).join(' ')];}
  const lh=Math.max(17,sc*1.0),tw2=Math.min(vw-24,Math.max(...lines.map(l=>g.measureText(l).width))+32),th2=lh*lines.length+sc*0.8,ty=CH?vh-SAB-Math.max(292,sc*7.6)-th2:Y(H)-sc*7.5;
  g.globalAlpha=0.92;g.fillStyle='#0a0e17';rr(g,mid-tw2/2,ty,tw2,th2,10);g.fill();g.globalAlpha=1;g.strokeStyle='#ff7a2f';g.lineWidth=2;rr(g,mid-tw2/2,ty,tw2,th2,10);g.stroke();
  g.fillStyle='#fff';g.textAlign='center';lines.forEach((l,i)=>g.fillText(l,mid,ty+sc*0.4+lh*(i+0.5)+1));}}
 // you got hit: red edges; low health: slow red pulse
 if(state==='play'&&me){const low=me.hp>0&&me.hp/me.mhp<0.3,k=Math.max((me.hurtT||0)/0.3*0.55,low?0.25+0.2*Math.sin(performance.now()/260):0);
  if(k>0.01){const vg=g.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*0.35,vw/2,vh/2,Math.max(vw,vh)*0.75);vg.addColorStop(0,'rgba(255,40,60,0)');vg.addColorStop(1,'rgba(255,40,60,'+k.toFixed(3)+')');g.fillStyle=vg;g.fillRect(0,0,vw,vh);}}
 // kill feed
 if(feed.length){g.textAlign='left';g.font=font(Math.round(Math.max(11,sc*0.6)));feed.forEach((f,i)=>{g.globalAlpha=Math.min(1,f.t);g.fillStyle='rgba(10,14,23,.75)';const tw3=g.measureText(f.txt).width+14,yy=(CH?miniRect().y+miniRect().h+6+sc*1.1:HY+sc*(topLine?3.0:2.0))+i*(sc*1.05+4);
  rr(g,HX+(CH?0:6),yy,tw3,sc*1.05,6);g.fill();g.fillStyle=f.c;g.fillText(f.txt,HX+(CH?7:13),yy+sc*0.53);});g.globalAlpha=1;}
 // DASH button with a cooldown ring
 if(state==='play'&&me.hp>0){const D=dashBtn(),cd=(me.dashCd||0)/(DASH_CD*(me.dashCdM||1)),ready=cd<=0;
  g.fillStyle=ready?'rgba(77,159,255,.9)':'rgba(30,42,64,.9)';g.beginPath();g.arc(D.x,D.y,D.r,0,7);g.fill();
  if(!ready){g.strokeStyle='#4d9fff';g.lineWidth=4;g.beginPath();g.arc(D.x,D.y,D.r-3,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-cd));g.stroke();}
  g.fillStyle=ready?'#fff':'rgba(255,255,255,.5)';g.textAlign='center';g.font=font(Math.round(D.r*0.42));g.fillText('DASH',D.x,D.y+1-(CH&&KEYHINT?D.r*0.14:0));if(CH&&KEYHINT){g.font=font(Math.round(D.r*0.28));g.globalAlpha=0.7;g.fillText('SHIFT',D.x,D.y+D.r*0.4);g.globalAlpha=1;}}
 // SHIELD button with a cooldown ring
 if(state==='play'&&me.hp>0){const H=shieldBtn(),cd=(me.shieldCd||0)/(SHIELD_CD*(me.shieldCdM||1)),on=(me.shieldT||0)>0,ready=cd<=0;
  g.fillStyle=on?'rgba(64,224,208,.95)':ready?'rgba(26,94,104,.9)':'rgba(24,38,52,.9)';g.beginPath();g.arc(H.x,H.y,H.r,0,7);g.fill();
  if(!ready){g.strokeStyle='#40e0d0';g.lineWidth=4;g.beginPath();g.arc(H.x,H.y,H.r-3,-Math.PI/2,-Math.PI*2*(1-cd)-Math.PI/2);g.stroke();}
  g.fillStyle=ready||on?'#fff':'rgba(255,255,255,.5)';g.textAlign='center';g.font=font(Math.round(H.r*0.34));g.fillText('SHIELD',H.x,H.y+1-(CH&&KEYHINT?H.r*0.14:0));if(CH&&KEYHINT){g.font=font(Math.round(H.r*0.28));g.globalAlpha=0.7;g.fillText('E',H.x,H.y+H.r*0.4);g.globalAlpha=1;}}
 // SUPER button with a charge ring
 if(state==='play'&&me.hp>0){const B=btn(),used=supUsed(),out=used>=SUP_ROUND_CAP&&!me.sup,f=out?0:me.sp/SUPER_MAX,rdy=f>=1&&!me.sup&&me.hp>0;
  g.fillStyle=rdy?'#e0242f':out?'#22262c':'#3a1a1d';g.beginPath();g.arc(B.x,B.y,B.r,0,7);g.fill();
  g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=5;g.beginPath();g.arc(B.x,B.y,B.r-4,0,7);g.stroke();
  g.strokeStyle=rdy?'#fff':'#ff6b6b';g.beginPath();g.arc(B.x,B.y,B.r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,f));g.stroke();
  if(supBarOn()){const q=typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced()?1:0.5+0.5*Math.sin(performance.now()/70);g.fillStyle='#ffcf4a';g.beginPath();g.arc(B.x,B.y,B.r,0,7);g.fill();g.strokeStyle='rgba(255,255,255,'+(0.5+0.5*q)+')';g.lineWidth=5;g.beginPath();g.arc(B.x,B.y,B.r+5,0,7);g.stroke();
   g.fillStyle='#2a1c00';g.textAlign='center';g.font='700 '+Math.round(B.r*0.5)+'px '+FONT_FAMILY;g.fillText('TAP!',B.x,B.y+1);}
  else{g.fillStyle=rdy?'#fff':out?'rgba(255,255,255,.4)':'rgba(255,255,255,.55)';g.textAlign='center';g.font=font(Math.round(B.r*0.42));g.fillText('SUPER',B.x,B.y+1-(out||(CH&&KEYHINT)?B.r*0.14:0));
   if(out){g.font=font(Math.round(B.r*0.25));g.globalAlpha=0.75;g.fillText('NONE LEFT',B.x,B.y+B.r*0.4);g.globalAlpha=1;}else if(CH&&KEYHINT){g.font=font(Math.round(B.r*0.25));g.globalAlpha=0.7;g.fillText('SPACE',B.x,B.y+B.r*0.4);g.globalAlpha=1;}}
  // the round's supers (rules.js SUP_ROUND_CAP): one pip each along the top of the button; a spent one is hollow
  {const n=SUP_ROUND_CAP,pr=Math.max(3.5,B.r*0.115),a0=-Math.PI/2,da=0.36;for(let i=0;i<n;i++){const a=a0+(i-(n-1)/2)*da,x=B.x+Math.cos(a)*(B.r+pr+5),y=B.y+Math.sin(a)*(B.r+pr+5);
    g.fillStyle='rgba(6,10,18,.85)';g.beginPath();g.arc(x,y,pr+2,0,7);g.fill();
    if(i<n-used){g.fillStyle='#ffcf4a';g.beginPath();g.arc(x,y,pr,0,7);g.fill();g.fillStyle='#fff6cf';g.beginPath();g.arc(x-pr*0.25,y-pr*0.25,pr*0.38,0,7);g.fill();}
    else{g.strokeStyle='rgba(255,255,255,.38)';g.lineWidth=1.5;g.beginPath();g.arc(x,y,pr-0.5,0,7);g.stroke();}}}
  if(rdy&&(save.mp||0)<6&&!aim){g.font=font(11);g.fillStyle='rgba(255,255,255,.7)';g.fillText('tap or drag to aim',B.x-6,B.y-B.r-26);}
  if(rdy){g.globalAlpha=0.25+0.25*Math.sin(performance.now()/120);g.strokeStyle='#ff4d4d';g.lineWidth=6;g.beginPath();g.arc(B.x,B.y,B.r+6,0,7);g.stroke();g.globalAlpha=1;}}
 supUiTick();drawSupBar(g);
 g.textBaseline='top';
}

function drawMachinePreview(ctx,w,h,L){
 ctx.clearRect(0,0,w,h);
 if(typeof machineArt3D==='function'&&machineArt3D(ctx,w,h,L))return;
 drawTankPx(ctx,w/2,h*.55,Math.min(w/6,h/3.7),-.6,-.8,TC[0],L.cores,L.w.a,null,3,PAINTS[L.paint],fittingVisuals(L),L.skin,L.ap);
}
