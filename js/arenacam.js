'use strict';
// =====================================================================
// ArenaCam: the Arcade chase camera (Session 5E-2b2a). A perspective camera in the style of the Conquest view
// (js/conquest/view.js): it follows your tank from behind and above, so the arena reads as real 3D (heights, depth, the
// space under a bridge). Presentation only: it never reads the sim's random(), the save or the network, and nothing here
// changes a rule. The same rig runs for every player; a live match turns the map so each side looks north from its own
// end (js/pvp.js), so nobody is given more of the field than anybody else. Bots never use it.
//
// Pure math, no three.js: js/render3d.js copies pos / target / fov into its PerspectiveCamera, js/render.js uses project()
// and ground() for the 2D overlay and for input, and dev/tests/arena-cam.mjs runs it in node.
// World: x east, y south (the sim's ground axes), h up.  Screen: css pixels, y down.
//
// What the camera does (docs/conquest/IMPLEMENTATION_CHECKPOINT.md, Checkpoint 35, has the research and the reasons):
//   follow     the tank sits a little below the middle of the screen; a critically damped follow removes jitter
//   lead       a short look-ahead along your travel, and a pull towards the enemies you are fighting, so a fight stays in frame
//   sides      the view never shows more than a strip of out-of-bounds: it stops panning near the arena's sides
//   sight      if a wall or the bridge would hide your tank the camera swings up over it; under a deck it drops down and
//              in, and looks along the tunnel. Nothing is ever faded or made see-through
//   moments    a short crane shot at the start of a match, a wider view while you wait to respawn, and the screen shake the
//              game already had. Reduced motion: no crane, no shake, cuts instead of swings
// =====================================================================
const ArenaCam=(()=>{
 const VERSION='arenacam-1',AW=20,AH=32,RAD=Math.PI/180;
 const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,f)=>a+(b-a)*f,sst=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 // The rig. Angles in degrees. P: portrait (a phone held upright), L: landscape (a desktop, a phone on its side).
 //  fov     vertical field of view            pitch   how far the camera looks down from level
 //  halfW   ground the frame must show to each side of the tank at the tank's own depth (portrait is limited by this)
 //  halfH   the same up and down the screen, measured across the view (landscape is limited by this)
 //  down    how far below the screen centre the tank sits, as a fraction of half the screen height
 //  side    how much out-of-bounds may show beside the arena before the camera stops panning
 const DEF={fovP:46,fovL:30,pitchP:48,pitchL:44,halfW:6.8,halfH:7.6,downP:0.16,downL:0.06,side:1.6,
  follow:0.1,leadT:0.24,leadMax:1.1,leadTime:0.45,pull:0.3,pullX:2.0,pullY:2.6,pullR:10.5,pullTime:0.6,
  pitchTime:0.3,sightLead:0.3,pitchMin:14,pitchMax:74,lowDist:0.6,heightTime:0.22,
  southKeep:0.42,northKeep:0.82,introT:1.9,introHold:0.22,introPitch:17,introDist:0.36,deadDist:1.16,deadPitch:4,deadTime:0.7,
  near:1.2,far:420};
 const P=Object.assign({},DEF);
 function tune(o){if(o)for(const k in o)if(k in DEF&&Number.isFinite(+o[k]))P[k]=+o[k];return P;}
 // critically damped follow, never overshoots (the SmoothDamp form). s: {v: value, d: velocity}
 function damp(s,target,time,dt){if(!(dt>0))return s.v;const w=2/Math.max(1e-4,time),x=w*dt,e=1/(1+x+0.48*x*x+0.235*x*x*x),ch=s.v-target,tmp=(s.d+w*ch)*dt;s.d=(s.d-w*tmp)*e;s.v=target+(ch+tmp)*e;return s.v;}
 const sv=v=>({v,d:0});
 // what a screen of this shape gets
 function rig(vw,vh){
  vw=Math.max(1,vw||1);vh=Math.max(1,vh||1);const a=vw/vh,t=sst(0.62,1.5,a),fov=lerp(P.fovP,P.fovL,t),th=Math.tan(fov*RAD/2);
  return {vw,vh,a,t,fov,th,pitch:lerp(P.pitchP,P.pitchL,t),dist:Math.max(P.halfW/(th*a),P.halfH/th),down:lerp(P.downP,P.downL,t)};
 }
 // ---------- state ----------
 const S={ready:false,vw:1,vh:1,fx:sv(AW/2),fy:sv(AH/2),fh:sv(0),lx:sv(0),ly:sv(0),qx:sv(0),qy:sv(0),pitch:sv(52),dist:sv(26),fov:40,yaw:0,
  intro:0,introOn:false,dead:sv(0),lpx:0,lpy:0,vx:0,vy:0,t:0,shx:0,shy:0,key:null,sightP:null,under:false};
 // the solved frame: camera position, axes, focal length in pixels
 const C={x:0,h:0,y:0,tx:0,th:0,ty:0,rx:1,rh:0,ry:0,ux:0,uh:1,uy:0,fx:0,fh:0,fy:-1,f:1,cx:0,cy:0,fov:40,pitch:52,dist:26,near:1.2,far:420};
 // ---------- the map: what can stand between the camera and a tank ----------
 // boxes [x0,y0,x1,y1,h0,h1] in world units. The heights are the props' own (js/arenaprops.js); a little generous is fine.
 const WALL_H={ctr:1.25,cmd:1.35,pylon:1.9,lander:1.2,cliff:1.9,canyon:1.75,fin:1.2,bulk:1.5,door:1.6,pillar:2.3,turbine:1.35,lift:0.45,console:1.0,crate:0.9};
 const ROCK_H={dome:1.0,rock:1.05,boulder:1.05,spire:2.2,tank:1.5};
 let OCC=[],DECK=null,PX0=0,PX1=AW;   // PX0..PX1: the part of the arena's width a tank can reach (Longshot's lane, the Canyon's rille)
 // map: a MAPS entry (js/game.js); deckTop / deckUnder: the art's deck surface and its underside (ArenaProps.DECK, DECK_UNDER)
 function setMap(map,deckTop,deckUnder){
  OCC=[];DECK=null;PX0=0;PX1=AW;if(!map)return;
  {let w0=1e9,e0=1e9;for(let y=0.5;y<AH;y+=1){let a=0,b=0;for(const w of map.walls||[]){if(y<w[1]||y>w[1]+w[3])continue;if(w[0]<=0.01)a=Math.max(a,w[0]+w[2]);if(w[0]+w[2]>=AW-0.01)b=Math.max(b,AW-w[0]);}w0=Math.min(w0,a);e0=Math.min(e0,b);}
   PX0=Math.min(w0,AW/2-3);PX1=AW-Math.min(e0,AW/2-3);}   // boundary walls that run the whole length narrow the field: the view pans inside what is left
  for(const w of map.walls||[]){const hh=WALL_H[w[4]]||1.1;if(hh>0.6)OCC.push([w[0],w[1],w[0]+w[2],w[1]+w[3],0,hh]);}
  for(const r of map.rocks||[]){const hh=(ROCK_H[r[3]]||1)*Math.max(0.8,r[2]),q=r[2]*0.8;OCC.push([r[0]-q,r[1]-q,r[0]+q,r[1]+q,0,hh]);}
  for(const c of map.crates||[])OCC.push([c[0],c[1],c[0]+c[2],c[1]+c[3],0,WALL_H.crate]);
  if(map.bridge){const [dx,dy,dw,dh]=map.bridge.deck,top=deckTop||2,under=deckUnder===undefined?top-0.3:deckUnder;DECK={x0:dx,y0:dy,x1:dx+dw,y1:dy+dh,top,under,tunnels:map.bridge.tunnels.map(t=>[t[0],t[0]+t[1]])};
   OCC.push([dx,dy,dx+dw,dy+dh,under,top+0.12]);   // the slab
   let x0=dx;for(const [tx,tw] of map.bridge.tunnels){OCC.push([x0,dy,tx,dy+dh,0,under]);x0=tx+tw;}OCC.push([x0,dy,dx+dw,dy+dh,0,under]);   // the piers between the tunnels
   for(const [rx,ry,rw,rh,o] of map.bridge.ramps)for(let i=0;i<3;i++){const f0=i/3,f1=(i+1)/3,z0=ry+rh*f0,z1=ry+rh*f1,hi=top*(o<0?f0:1-f1);if(hi>0.1)OCC.push([rx-0.2,z0,rx+rw+0.2,z1,0,hi]);}}   // ramps: three steps, each as high as its LOW edge (a tank on the ramp stands on top of them, never inside)
 }
 // is the straight line from a to b free of every box? (a slab test per box; the last stretch by the tank is not tested)
 function clearLine(ax,ah,ay,bx,bh,by){
  const dx=bx-ax,dh=bh-ah,dy=by-ay,len=Math.hypot(dx,dh,dy)||1,t1=Math.max(0,1-0.45/len);
  for(let i=0;i<OCC.length;i++){const b=OCC[i];let lo=0,hi=t1;
   if(Math.abs(dx)<1e-9){if(ax<b[0]||ax>b[2])continue;}else{let u=(b[0]-ax)/dx,v=(b[2]-ax)/dx;if(u>v){const s=u;u=v;v=s;}if(u>lo)lo=u;if(v<hi)hi=v;if(lo>hi)continue;}
   if(Math.abs(dy)<1e-9){if(ay<b[1]||ay>b[3])continue;}else{let u=(b[1]-ay)/dy,v=(b[3]-ay)/dy;if(u>v){const s=u;u=v;v=s;}if(u>lo)lo=u;if(v<hi)hi=v;if(lo>hi)continue;}
   if(Math.abs(dh)<1e-9){if(ah<b[4]||ah>b[5])continue;}else{let u=(b[4]-ah)/dh,v=(b[5]-ah)/dh;if(u>v){const s=u;u=v;v=s;}if(u>lo)lo=u;if(v<hi)hi=v;if(lo>hi)continue;}
   return false;}
  return true;
 }
 const underDeckAt=(x,y,h)=>!!DECK&&h<DECK.under-0.4&&x>DECK.x0&&x<DECK.x1&&y>DECK.y0&&y<DECK.y1;
 // the distance the rig uses at a pitch: it moves in as it drops, so the tunnel shot stays a close shot
 const distAt=(G,pitch)=>G.dist*lerp(P.lowDist,1,sst(P.pitchMin,G.pitch,pitch));
 const downAt=(G,pitch)=>G.down*sst(20,G.pitch-4,pitch);
 // where the camera would stand for a focus point and a pitch (out: [x,h,y])
 function standAt(G,fx,fh,fy,pitch,dist,out){const p=pitch*RAD,cp=Math.cos(p),sp=Math.sin(p),sy=Math.sin(S.yaw),cy=Math.cos(S.yaw);out[0]=fx+sy*cp*dist;out[1]=fh+sp*dist;out[2]=fy+cy*cp*dist;return out;}
 // the focus for a tank at (x,y,h): ahead of it, so the tank sits below the screen centre
 function aheadOf(G,pitch,dist){return downAt(G,pitch)*dist*G.th/Math.max(0.3,Math.sin(pitch*RAD));}
 const T3=[0,0,0];
 // is a ground tank at (x,y) in a tunnel's lane, under the deck or just beyond its far (north) mouth? There the camera looks
 // along the tunnel from the near side, both on the way in and on the way out, instead of jumping over the deck and back
 const LANE_N=1.5;
 const inLane=(x,y,h)=>!!DECK&&h<DECK.under-0.4&&y>DECK.y0-LANE_N&&y<DECK.y1&&DECK.tunnels.some(t=>x>t[0]&&x<t[1]);
 // the pitch at which the tank at (x,y,h) is in clear view: the rig's own if nothing is in the way, else the nearest that is.
 // (ox,oy): how far the view is led off the tank (look-ahead, the fight)
 function sightPitch(G,x,y,h,ox,oy){
  const lane=inLane(x,y,h),th=h+0.62,test=p=>{const d=distAt(G,p);focusFor(G,x+ox,y+oy,p,d,0,F2);standAt(G,F2[0],h,F2[1],p,d,T3);return clearLine(T3[0],T3[1],T3[2],x,th,y)&&clearLine(T3[0],T3[1],T3[2],x,h+0.2,y+0.35);};
  if(test(G.pitch))return G.pitch;
  if(lane){for(let p=G.pitch-3;p>=P.pitchMin;p-=3)if(test(p))return Math.max(P.pitchMin,p-2);if(underDeckAt(x,y,h))return P.pitchMin;}
  for(let p=G.pitch+3;p<=P.pitchMax;p+=3)if(test(p))return Math.min(P.pitchMax,p+2);
  return lane?P.pitchMin:P.pitchMax;
 }
 // ---------- one frame ----------
 // I: {vw,vh, me:{x,y,h,alive} or null, foes:[{x,y,w}] (who to keep in frame; w: weight), quiet (reduced motion), shx,shy (shake, px)}
 function update(dt,I){
  const G=rig(I.vw,I.vh),quiet=!!I.quiet,me=I.me;S.vw=I.vw;S.vh=I.vh;S.t+=dt;S.shx=I.shx||0;S.shy=I.shy||0;
  const snap=!S.ready||dt>0.4||!Number.isFinite(S.fx.v+S.fy.v+S.fh.v+S.pitch.v);   // dt = 0 (a second draw in one tick) holds the frame; a broken state (a zero-sized screen) is cut clean
  let px=AW/2,py=AH/2,ph=0,alive=false;if(me){px=me.x;py=me.y;ph=me.h||0;alive=me.alive!==false;}
  // your travel (from positions: a live match predicts and corrects them, the camera only ever sees where the tank is drawn)
  if(me&&!snap){const jump=Math.hypot(px-S.lpx,py-S.lpy);if(jump<1.2&&dt>0){const k=1-Math.exp(-dt/0.12);S.vx+=((px-S.lpx)/dt-S.vx)*k;S.vy+=((py-S.lpy)/dt-S.vy)*k;}else{S.vx=0;S.vy=0;}}
  const tele=me&&Math.hypot(px-S.lpx,py-S.lpy)>4;S.lpx=px;S.lpy=py;
  // waiting to respawn (or watching): a wider view of whoever is still fighting
  const dead=!me||!alive;damp(S.dead,dead?1:0,dead?P.deadTime:0.3,snap||quiet?1e3:dt);if(snap||quiet)S.dead.v=dead?1:0;
  let wx=px,wy=py;
  if(dead&&I.foes&&I.foes.length){let sx=0,sy=0,n=0;for(const f of I.foes){sx+=f.x;sy+=f.y;n++;}wx=lerp(px,sx/n,0.6);wy=lerp(py,sy/n,0.6);}
  // look-ahead along the travel, and a pull towards the fight
  let lx=0,ly=0,qx=0,qy=0;
  if(!dead){const sp=Math.hypot(S.vx,S.vy),k=sp>1e-3?Math.min(P.leadMax,sp*P.leadT)/sp:0;lx=S.vx*k;ly=S.vy*k;
   if(I.foes&&I.foes.length){let sx=0,sy=0,sw=0;for(const f of I.foes){const d=Math.hypot(f.x-px,f.y-py);if(d>P.pullR)continue;const w=(f.w||1)*(1-0.5*d/P.pullR);sx+=(f.x-px)*w;sy+=(f.y-py)*w;sw+=w;}
    if(sw>0){qx=clamp(sx/sw*P.pull,-P.pullX,P.pullX);qy=clamp(sy/sw*P.pull,-P.pullY,P.pullY);}}}
  if(quiet){lx=ly=0;}
  if(snap||tele){S.lx.v=lx;S.ly.v=ly;S.qx.v=qx;S.qy.v=qy;S.lx.d=S.ly.d=S.qx.d=S.qy.d=0;}
  else{damp(S.lx,lx,P.leadTime,dt);damp(S.ly,ly,P.leadTime,dt);damp(S.qx,qx,P.pullTime,dt);damp(S.qy,qy,P.pullTime,dt);}
  const ox=S.lx.v+S.qx.v,oy=S.ly.v+S.qy.v;
  // pitch: the rig's own, unless something would hide the tank
  let pT=G.pitch;S.under=false;
  if(!dead){pT=sightPitch(G,px,py,ph,ox,oy);S.under=inLane(px,py,ph);
   // a tank driving at a tunnel is in it a moment later: the camera starts its move now, so the tank is not lost on the way in
   const fx2=px+S.vx*P.sightLead,fy2=py+S.vy*P.sightLead;if(DECK&&(S.vx||S.vy)&&(S.under||inLane(fx2,fy2,ph))){const p2=sightPitch(G,fx2,fy2,ph,ox,oy);if(p2<pT){pT=p2;S.under=true;}}}
  else pT=Math.min(P.pitchMax,G.pitch+P.deadPitch*S.dead.v);
  S.sightP=pT;
  if(snap||tele||quiet){S.pitch.v=pT;S.pitch.d=0;}else damp(S.pitch,pT,S.under?P.pitchTime*0.6:P.pitchTime,dt);
  let pitch=S.pitch.v,dist=distAt(G,pitch)*lerp(1,P.deadDist,S.dead.v);
  // the opening crane shot: low behind the tank, then up to the playing view
  let e=0;if(S.introOn){S.intro+=dt/P.introT;if(S.intro>=1||quiet||dead){S.introOn=false;S.intro=1;}else{const u=clamp((S.intro-P.introHold)/(1-P.introHold),0,1);e=1-u*u*u*(u*(u*6-15)+10);}}
  if(e>0){pitch=lerp(pitch,Math.min(P.introPitch,G.fov/2-11),e);dist=lerp(dist,G.dist*P.introDist,e);}   // low enough for the skyline and the Earth to stand above the far ridge
  // focus: the tank, the way ahead, the fight; kept inside the arena's sides
  focusFor(G,wx+ox*(1-e),wy+oy*(1-e),pitch,dist,e,F2);const tx=F2[0],ty=F2[1];
  if(snap||tele){S.fx.v=tx;S.fy.v=ty;S.fh.v=ph;S.fx.d=S.fy.d=S.fh.d=0;}
  else{const ft=lerp(P.follow,0.5,S.dead.v);damp(S.fx,tx,ft,dt);damp(S.fy,ty,ft,dt);damp(S.fh,dead?0:ph,P.heightTime,dt);}
  S.ready=true;
  solve(G,S.fx.v,S.fh.v+lerp(0,1.7,e),S.fy.v,pitch,dist,C);   // the crane shot looks over the tank, at the arena: the tank stands in the lower third
  return C;
 }
 // where the camera looks for a point of interest (the tank, moved by the look-ahead and the fight): ahead of it, so the tank
 // sits below the screen centre, and kept inside the arena's sides and ends
 const F2=[0,0];
 function focusFor(G,wx,wy,pitch,dist,e,out){
  const ah=aheadOf(G,pitch,dist)*(1-e),half=dist*G.th*G.a,lo=PX0+half-P.side,hi=PX1-(half-P.side),mid=(PX0+PX1)/2;let tx=wx,ty=wy-ah;
  if(lo<hi){const soft=Math.min(1.2,(hi-lo)/2);tx=tx<lo+soft?lo+soft*softIn((tx-lo)/soft):tx>hi-soft?hi-soft*softIn((hi-tx)/soft):tx;}   // eases to a stop near the sides
  else tx=mid+(tx-mid)*0.3;   // a screen wider than the field: the view drifts a little with the tank, for parallax
  if(e<1){const sMax=AH-P.southKeep*G.dist*G.th,soft=2;if(ty>sMax-soft)ty=lerp(sMax-soft+soft*easeOut((ty-(sMax-soft))/soft),ty,e);}   // near your own end the view stops sliding south: no screen is spent on the ground behind the arena
  if(e<1){const nMin=P.northKeep*G.dist*G.th,soft=2;if(ty<nMin+soft)ty=lerp(nMin+soft-soft*easeOut((nMin+soft-ty)/soft),ty,e);}   // and the same at the far end: the screen is not spent on the ground beyond it
  out[0]=tx;out[1]=clamp(ty,-3,AH+2);return out;
 }
 // an edge that eases to a stop instead of hitting it: 0..1 in, 0..1 out, flat at 0
 const easeOut=u=>u<=0?u:u>=2?1:u-u*u/4;   // slope 1 at 0, flat at 2: a limit that is approached, not hit
 function softIn(u){u=clamp(u,-1,1);return u<=-1?0:u>=1?1:0.25*(u+1)*(u+1);}
 function solve(G,fx,fh,fy,pitch,dist,C){
  const p=pitch*RAD,cp=Math.cos(p),sp=Math.sin(p),sy=Math.sin(S.yaw),cy=Math.cos(S.yaw);
  C.tx=fx;C.th=fh;C.ty=fy;C.x=fx+sy*cp*dist;C.h=fh+sp*dist;C.y=fy+cy*cp*dist;
  C.fx=-sy*cp;C.fh=-sp;C.fy=-cy*cp;C.rx=cy;C.rh=0;C.ry=-sy;
  C.ux=-sy*sp;C.uh=cp;C.uy=-cy*sp;   // up = back x right
  C.fov=G.fov;C.pitch=pitch;C.base=G.pitch;C.dist=dist;C.f=G.vh/2/G.th;C.cx=G.vw/2;C.cy=G.vh/2;   // screen shake is not in here: the renderer shifts its frustum and the overlay its canvas by the same pixels
  C.near=clamp(dist*0.18,P.near,8);C.far=P.far;C.aspect=G.a;   // the near plane rides out with the camera: depth precision for the ground decals, also on 16-bit depth buffers
 }
 // a new match (or a new round): cut to the tank and, unless motion is reduced, play the crane shot
 function begin(o){S.ready=false;S.vx=S.vy=0;S.dead.v=0;S.dead.d=0;S.intro=0;S.introOn=!(o&&o.quiet)&&!(o&&o.noIntro);}
 const introLeft=()=>S.introOn?Math.max(0,1-S.intro)*P.introT:0;
 // ---------- screen <-> world ----------
 const OUT={x:0,y:0,k:1,d:1,ok:true};
 // a world point on the screen. k: pixels per world unit at that depth; ok: in front of the camera
 function project(x,y,h,out){
  out=out||OUT;const vx=x-C.x,vh=(h||0)-C.h,vy=y-C.y,d=vx*C.fx+vh*C.fh+vy*C.fy;out.d=d;
  if(d<C.near*0.5){out.ok=false;out.x=C.cx;out.y=C.cy+1e5;out.k=0;return out;}
  const k=C.f/d;out.k=k;out.x=C.cx+(vx*C.rx+vh*C.rh+vy*C.ry)*k;out.y=C.cy-(vx*C.ux+vh*C.uh+vy*C.uy)*k;out.ok=true;return out;
 }
 // the ground point (at height h) under a screen pixel: [x,y], or null if the pixel looks above the horizon
 function ground(sx,sy,h,out,F){
  const C=F||ArenaCam.C,a=sx-C.cx,b=-(sy-C.cy),dx=C.fx*C.f+C.rx*a+C.ux*b,dh=C.fh*C.f+C.rh*a+C.uh*b,dy=C.fy*C.f+C.ry*a+C.uy*b;
  if(dh>-1e-6)return null;const t=((h||0)-C.h)/dh;out=out||[0,0];out[0]=C.x+dx*t;out[1]=C.y+dy*t;return out;
 }
 // a direction on the screen (a joystick, a key) as a direction on the ground, same length. Measured with the rig's own pitch
 // (not the pitch of the moment: the stick must not change its meaning while the camera drops into a tunnel), at the middle of the
 // view, so the stick means the same thing wherever the tank is on the screen: up is away from the camera, right is right
 function steer(dx,dy,out){
  out=out||[0,0];const m=Math.hypot(dx,dy);if(m<1e-9){out[0]=0;out[1]=0;return out;}
  const s=Math.max(0.5,Math.sin((C.base||C.pitch)*RAD)),gx=dx,gy=dy/s,n=Math.hypot(gx,gy),cy=Math.cos(S.yaw),sy=Math.sin(S.yaw),ex=gx/n*m,ey=gy/n*m;
  out[0]=ex*cy+ey*sy;out[1]=-ex*sy+ey*cy;return out;
 }
 // ---------- ground shapes for the 2D overlay: drawn through the camera, clipped where they pass behind it ----------
 const PA={x:0,y:0,k:1,d:1,ok:true},CL=[];
 // pts: flat [x,y,h, x,y,h, ...] in world units. Adds one sub-path to ctx (moveTo / lineTo); closed polygons are clipped
 // against the near plane, open lines are cut there. Returns the number of points written.
 function path(ctx,pts,closed){
  const n=pts.length/3,nd=C.near;CL.length=0;
  const dep=i=>(pts[i*3]-C.x)*C.fx+(pts[i*3+2]-C.h)*C.fh+(pts[i*3+1]-C.y)*C.fy;
  const put=(x,y,h)=>{CL.push(x,y,h);};
  const cut=(i,j,di,dj)=>{const t=(nd-di)/(dj-di);put(pts[i*3]+(pts[j*3]-pts[i*3])*t,pts[i*3+1]+(pts[j*3+1]-pts[i*3+1])*t,pts[i*3+2]+(pts[j*3+2]-pts[i*3+2])*t);};
  let w=0;
  if(closed){
   for(let i=0;i<n;i++){const j=(i+1)%n,di=dep(i),dj=dep(j);if(di>=nd)put(pts[i*3],pts[i*3+1],pts[i*3+2]);if((di>=nd)!==(dj>=nd))cut(i,j,di,dj);}
   for(let i=0;i<CL.length;i+=3){project(CL[i],CL[i+1],CL[i+2],PA);if(i)ctx.lineTo(PA.x,PA.y);else ctx.moveTo(PA.x,PA.y);w++;}
   if(w)ctx.closePath();return w;
  }
  let pen=false;
  for(let i=0;i<n;i++){const di=dep(i);
   if(i>0){const dp=dep(i-1);if((dp>=nd)!==(di>=nd)){CL.length=0;cut(i-1,i,dp,di);project(CL[0],CL[1],CL[2],PA);if(pen)ctx.lineTo(PA.x,PA.y);else ctx.moveTo(PA.x,PA.y);pen=di>=nd;w++;}}
   if(di>=nd){project(pts[i*3],pts[i*3+1],pts[i*3+2],PA);if(pen)ctx.lineTo(PA.x,PA.y);else{ctx.moveTo(PA.x,PA.y);pen=true;}w++;}else pen=false;}
  return w;
 }
 const ARC=[];
 // a circle (or an arc of one) lying on the ground at height h
 function arc(ctx,x,y,r,a0,a1,ccw,h){
  const full=a0===undefined||Math.abs(a1-a0)>=Math.PI*2-1e-6;if(full){a0=0;a1=Math.PI*2;}
  let da=a1-a0;if(!full){if(ccw){while(da>0)da-=Math.PI*2;if(da<-Math.PI*2)da=-Math.PI*2;}else{while(da<0)da+=Math.PI*2;if(da>Math.PI*2)da=Math.PI*2;}}
  const n=Math.max(6,Math.min(44,Math.ceil(Math.abs(da)/(Math.PI*2)*(16+r*5))));ARC.length=0;
  for(let i=0;i<(full?n:n+1);i++){const a=a0+da*i/n;ARC.push(x+Math.cos(a)*r,y+Math.sin(a)*r,h||0);}
  return path(ctx,ARC,full);
 }
 const QD=[];
 // a rectangle on the ground from (x,y) along angle a: len long, hw to each side (a super's lane)
 function lane(ctx,x,y,a,len,hw,h,r0){
  const c=Math.cos(a),s=Math.sin(a),o=r0||0;QD.length=0;h=h||0;
  QD.push(x+c*o+s*hw,y+s*o-c*hw,h,x+c*len+s*hw,y+s*len-c*hw,h,x+c*len-s*hw,y+s*len+c*hw,h,x+c*o-s*hw,y+s*o+c*hw,h);
  return path(ctx,QD,true);
 }
 // ---------- off-screen indicators ----------
 // Where on the frame's edge to point at something that is outside it. box: {l,t,r,b} the part of the screen left clear by
 // the HUD and the buttons. Returns null if (sx,sy) is inside the box, else {x,y,a} on the box's edge on the line from its
 // middle (or from (ax,ay), your tank) to the thing, with a the direction to it.
 function edge(sx,sy,box,ax,ay,out){
  if(sx>=box.l&&sx<=box.r&&sy>=box.t&&sy<=box.b)return null;
  const cx=ax===undefined?(box.l+box.r)/2:clamp(ax,box.l+1,box.r-1),cy=ay===undefined?(box.t+box.b)/2:clamp(ay,box.t+1,box.b-1),dx=sx-cx,dy=sy-cy;let t=1e9;
  if(dx>1e-6)t=Math.min(t,(box.r-cx)/dx);else if(dx<-1e-6)t=Math.min(t,(box.l-cx)/dx);
  if(dy>1e-6)t=Math.min(t,(box.b-cy)/dy);else if(dy<-1e-6)t=Math.min(t,(box.t-cy)/dy);
  out=out||{x:0,y:0,a:0};out.x=cx+dx*t;out.y=cy+dy*t;out.a=Math.atan2(dy,dx);return out;
 }
 // the same for a world point, wherever it is (also behind the camera, where a projection is meaningless): the direction
 // comes from the ground, through the camera's own axes
 const PB={x:0,y:0,k:1,d:1,ok:true};
 function pointer(x,y,h,box,ax,ay,out){
  project(x,y,h,PB);
  if(PB.ok)return edge(PB.x,PB.y,box,ax,ay,out);
  const g=ground(ax===undefined?(box.l+box.r)/2:ax,ay===undefined?(box.t+box.b)/2:ay,h||0)||[C.tx,C.ty],dx=x-g[0],dy=y-g[1];
  const sx=dx*C.rx+dy*C.ry,sy=-(dx*C.ux+dy*C.uy),m=Math.hypot(sx,sy)||1;
  return edge((ax===undefined?(box.l+box.r)/2:ax)+sx/m*1e5,(ay===undefined?(box.t+box.b)/2:ay)+sy/m*1e5,box,ax,ay,out);
 }
 // the ground the screen can show from anywhere the camera may stand, in any of its shots: what the map's ground and far
 // terrain must cover. Worked out by standing the camera at the arena's corners, edges and middle in every shot it has
 // (play, waiting to respawn, swung up over a wall, down in a tunnel, the opening crane) and casting the screen's corners
 // onto the ground. Past `horizon` the mountains stand, so rays are stopped there.
 function cover(vw,vh,horizon){
  const G=rig(vw,vh),F={},g=[0,0],hz=horizon===undefined?-33:horizon,k0=PX0,k1=PX1;let x0=0,x1=AW,z1=AH;PX0=0;PX1=AW;   // whatever map is up, the cover is for the full width
  const shots=[[G.pitch,G.dist,0],[Math.min(P.pitchMax,G.pitch+P.deadPitch),G.dist*P.deadDist,0],[P.pitchMax,G.dist,0],[P.pitchMin,distAt(G,P.pitchMin),0],[Math.min(P.introPitch,G.fov/2-11),G.dist*P.introDist,1]];
  for(const [pitch,dist,e] of shots)for(const px of [0,AW/2,AW])for(const py of [0,AH/2,AH])for(const ox of [-3.2,3.2])for(const oy of [-3.8,3.8]){
   focusFor(G,px+ox*(1-e),py+oy*(1-e),pitch,dist,e,F2);solve(G,F2[0],0,F2[1],pitch,dist,F);
   for(const sx of [0,vw])for(const sy of [0,vh]){
    const a=sx-F.cx,b=-(sy-F.cy),dx=F.fx*F.f+F.rx*a+F.ux*b,dh=F.fh*F.f+F.rh*a+F.uh*b,dy=F.fy*F.f+F.ry*a+F.uy*b;let X,Z;
    const t=dh<-1e-6?-F.h/dh:1e9;Z=F.y+dy*t;X=F.x+dx*t;
    if(!(Z>hz)||t>=1e9){if(dy>=0)continue;const u=(hz-F.y)/dy;X=F.x+dx*u;Z=hz;}   // over the ridge: where the ray crosses the mountains' line
    if(X<x0)x0=X;if(X>x1)x1=X;if(Z>z1)z1=Z;}}
  const q=v=>Math.round(v/4)*4;PX0=k0;PX1=k1;
  return {x0:Math.max(-46,q(x0-3)),x1:Math.min(AW+46,q(x1+3)),z0:hz-7,z1:Math.min(AH+18,q(z1+3)),horizon:hz,fine:{x0:-2.5,x1:AW+2.5,z0:-2.5,z1:AH+2.5},G};
 }
 return {VERSION,DEF,P,tune,rig,update,begin,introLeft,setMap,project,ground,steer,path,arc,lane,edge,pointer,cover,sightPitch,focusFor,inLane,clearLine,underDeckAt,damp,S,C,WALL_H,ROCK_H,AW,AH,
  get occluders(){return OCC;},get deck(){return DECK;},get field(){return [PX0,PX1];}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ArenaCam;
