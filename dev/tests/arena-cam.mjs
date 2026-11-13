// The Arcade chase camera (Session 5E-2b2a, js/arenacam.js): pure math, run here without a browser.
// What it holds true on phones and desktops, for every map:
//  - screen <-> ground: a point projected and cast back lands where it started; the stick steers the way it points
//  - framing: your tank is inside the clear part of the screen, with your weapon's range in view to both sides and ahead
//  - fairness: the rig is a function of the screen's shape only (never of a team or a player), and it is left-right even
//  - sight: wherever a tank can stand, the camera has a clear line to it (it swings up over walls and the bridge, drops down
//    in a tunnel); nothing is faded to get there
//  - the ground the map bakes covers everything any shot can show
//  - ground shapes and edge markers stay finite when something is behind the camera
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
const root=new URL('../../',import.meta.url),ctx=createContext({console,Math,HOST:{random(){throw Error('authoritative RNG consumed by the camera');}}});
for(const f of ['js/rules.js','js/game.js','js/arenacam.js'])runInContext(readFileSync(new URL(f,root),'utf8'),ctx);
runInContext('globalThis.C=ArenaCam;globalThis.maps=MAPS;globalThis.snap=JSON.stringify(MAPS);globalThis.RANGE=STAT.range;globalThis.RR=R;',ctx);
const {C,maps}=ctx,W=20,H=32,RANGE=ctx.RANGE,R=ctx.RR,IDS=['classic','overpass','longshot','craters','canyon','bunker'];
const SCREENS={'phone 320x568':[320,568],'phone 390x844':[390,844],'phone 430x932':[430,932],'telegram 390x700':[390,700],'tablet 768x1024':[768,1024],'phone landscape 844x390':[844,390],'laptop 1366x768':[1366,768],'desktop 1920x1080':[1920,1080],'ultrawide 2560x1080':[2560,1080]};
const DECK=2.1,UNDER=1.8;
const settle=(vw,vh,me,foes,n=90)=>{C.begin({noIntro:true});let c;for(let i=0;i<n;i++)c=C.update(1/30,{vw,vh,me,foes:foes||[],quiet:false});return c;};
const near=(a,b,e,msg)=>assert.ok(Math.abs(a-b)<=e,msg+': '+a+' vs '+b);
let checks=0;

// ---- the rig ----
for(const [name,[vw,vh]] of Object.entries(SCREENS)){
 const G=C.rig(vw,vh);
 assert.ok(G.fov>=28&&G.fov<=50,name+' fov '+G.fov);assert.ok(G.pitch>=42&&G.pitch<=56,name+' pitch '+G.pitch);
 assert.ok(G.dist*G.th*G.a>=C.P.halfW-1e-6,name+': the frame is at least 2 x '+C.P.halfW+' units wide at the tank');
 assert.ok(G.dist*G.th>=C.P.halfH-1e-6,name+': and tall enough');
 const px=(vh/2/G.th)/G.dist;assert.ok(px*2*R*1.12>=28,name+': a tank is at least 28 px wide ('+(px*2*R*1.12).toFixed(1)+')');checks+=4;
}
// nothing but the screen's shape goes in
assert.deepEqual(Object.keys(C.rig(390,844)).sort(),['a','dist','down','fov','pitch','t','th','vh','vw'].sort());

// ---- screen <-> ground, steering ----
for(const [name,[vw,vh]] of Object.entries(SCREENS)){
 C.setMap(maps.classic,DECK,UNDER);
 const c=settle(vw,vh,{x:7,y:20,h:0,alive:true});
 for(const [x,y,h] of [[7,20,0],[2,12,0],[18,25,0],[10,16,2.1],[0,0,0],[20,32,0]]){
  const p=C.project(x,y,h,{});if(!p.ok)continue;const g=C.ground(p.x,p.y,h);assert.ok(g,name+' ground');near(g[0],x,1e-6,name+' round trip x');near(g[1],y,1e-6,name+' round trip y');assert.ok(p.k>0);checks+=2;}
 // the tank is drawn where the camera says: up on the stick is north on the ground, right is east, and the push keeps its size
 const up=C.steer(0,-1),rt=C.steer(1,0),dg=C.steer(0.6,-0.6);
 near(up[0],0,1e-9,'up x');assert.ok(up[1]<-0.999,'up is north');near(rt[0],1,1e-9,'right is east');near(rt[1],0,1e-9,'right y');
 near(Math.hypot(dg[0],dg[1]),Math.hypot(0.6,0.6),1e-9,'a diagonal push keeps its length');assert.ok(dg[0]>0&&dg[1]<0);
 // a finger above the tank on the screen aims north of it; to its right, east
 const me=C.project(7,20,0,{}),a=C.ground(me.x,me.y-80,0),b=C.ground(me.x+80,me.y,0);
 assert.ok(a[1]<20&&Math.abs(a[0]-7)<0.6,name+': a finger above the tank is north of it');assert.ok(b[0]>7&&Math.abs(b[1]-20)<1e-6,name+': a finger right of the tank is east of it');checks+=8;
}

// ---- framing: the tank and its weapon's range are on the screen ----
for(const [name,[vw,vh]] of Object.entries(SCREENS)){
 C.setMap(maps.classic,DECK,UNDER);
 for(let x=1;x<=19;x+=3)for(let y=1;y<=31;y+=3){
  const c=settle(vw,vh,{x,y,h:0,alive:true}),p=C.project(x,y,0,{});
  assert.ok(p.ok&&p.x>vw*0.12&&p.x<vw*0.88,name+': tank x on screen at '+x+','+y+' ('+p.x.toFixed(0)+')');
  assert.ok(p.y>vh*0.2&&p.y<vh*0.8,name+': tank y in the clear part of the screen at '+x+','+y+' ('+(p.y/vh).toFixed(2)+')');
  // the range: to each side (unless that side is the arena's edge), and ahead
  for(const [dx,dy] of [[-RANGE,0],[RANGE,0],[0,-RANGE]]){const tx=x+dx,ty=y+dy;if(tx<0||tx>W||ty<0)continue;const q=C.project(tx,ty,0,{});
   assert.ok(q.ok&&q.x>=-1&&q.x<=vw+1&&q.y>=-1&&q.y<=vh+1,name+': range point '+dx+','+dy+' from '+x+','+y+' is on screen ('+q.x.toFixed(0)+','+q.y.toFixed(0)+')');checks++;}
  // behind: at least 4 units (an enemy further back gets an edge marker)
  if(y+4<=H){const q=C.project(x,y+4,0,{});assert.ok(q.ok&&q.y<=vh+1,name+': 4 units behind the tank are on screen at '+x+','+y);}
  checks+=2;}
}
// left-right even: the same tank mirrored gives the mirrored view
for(const [vw,vh] of [[390,844],[1920,1080]]){
 C.setMap(null);   // an open floor: the maps themselves are point-symmetric, not left-right
 const a=settle(vw,vh,{x:4,y:18,h:0,alive:true}),ax=a.x,ay=a.y,ah=a.h,ap=a.pitch,b=settle(vw,vh,{x:W-4,y:18,h:0,alive:true});
 near(b.x,W-ax,1e-6,'mirrored camera x');near(b.y,ay,1e-6,'mirrored camera y');near(b.h,ah,1e-6,'mirrored camera height');near(b.pitch,ap,1e-9,'mirrored pitch');checks+=4;
}
// boundary walls that run the whole length narrow the field: the view stays on the lane (Longshot), not on the cliff tops
{C.setMap(maps.longshot,DECK,UNDER);assert.deepEqual(Array.from(C.field),[4,16],'Longshot: the lane is x 4..16');
 for(const x of [4.8,10,15.2]){const c=settle(390,844,{x,y:16,h:0,alive:true});assert.ok(Math.abs(c.tx-10)<1.2,'Longshot phone: the view stays near the lane\'s middle ('+c.tx.toFixed(2)+')');const p=C.project(x,16,0,{});assert.ok(p.x>390*0.1&&p.x<390*0.9);checks+=2;}
 C.setMap(maps.canyon,DECK,UNDER);assert.deepEqual(Array.from(C.field),[1.5,18.5]);C.setMap(maps.classic,DECK,UNDER);assert.deepEqual(Array.from(C.field),[0,20]);checks+=3;}
// a fight pulls the view towards it, by no more than the rig allows; a far enemy does not
{C.setMap(maps.classic,DECK,UNDER);const me={x:10,y:16,h:0,alive:true},base=settle(390,844,me,[]),bx=base.tx,by=base.ty;
 const f=settle(390,844,me,[{x:10,y:21,w:1}]);assert.ok(f.ty>by+0.3&&f.ty<=by+C.P.pullY+1e-6,'an enemy behind pulls the view back ('+(f.ty-by).toFixed(2)+')');
 const g=settle(390,844,me,[{x:10,y:16+C.P.pullR+3,w:1}]);near(g.ty,by,1e-6,'a far enemy does not move the view');near(g.tx,bx,1e-6,'x');checks+=3;}

// ---- sight: a clear line to the tank, everywhere a tank can stand ----
const free=(M,x,y)=>!(M.walls||[]).some(w=>x>w[0]-R&&x<w[0]+w[2]+R&&y>w[1]-R&&y<w[1]+w[3]+R)&&!(M.rocks||[]).some(r=>Math.hypot(x-r[0],y-r[1])<r[2]+R)&&!(M.crates||[]).some(c=>x>c[0]-R&&x<c[0]+c[2]+R&&y>c[1]-R&&y<c[1]+c[3]+R);
const sight={};
for(const id of IDS){const M=maps[id],B=M.bridge;C.setMap(M,DECK,UNDER);
 for(const [name,[vw,vh]] of [['phone',[390,844]],['desktop',[1920,1080]]]){let n=0,clear=0,lifted=0,dropped=0,worst=0;const G=C.rig(vw,vh);
  for(let x=R+0.1;x<W-R;x+=0.9)for(let y=R+0.1;y<H-R;y+=0.9){
   if(!free(M,x,y))continue;let h=0,under=false;
   if(B){const [dx,dy,dw,dh]=B.deck,inD=x>dx&&x<dx+dw&&y>dy&&y<dy+dh,inT=inD&&B.tunnels.some(t=>x>t[0]+R&&x<t[0]+t[1]-R);
    if(B.ramps.some(r=>x>r[0]-0.2-R&&x<r[0]+r[2]+0.2+R&&y>r[1]-R&&y<r[1]+r[3]+R))continue;   // ramps are driven on the upper level
    if(inD&&!inT)continue;if(!inT&&x>dx-R&&x<dx+dw+R&&y>dy-R&&y<dy+dh+R&&!B.tunnels.some(t=>x>t[0]+R&&x<t[0]+t[1]-R))continue;   /* the piers are solid */under=inT;}
   const c=settle(vw,vh,{x,y,h,alive:true},[],40);n++;
   const ok=C.clearLine(c.x,c.h,c.y,x,h+0.62,y);if(ok)clear++;else worst=Math.max(worst,Math.abs(c.pitch-G.pitch));
   if(c.pitch>G.pitch+2)lifted++;if(c.pitch<G.pitch-2){dropped++;assert.ok(C.inLane(x,y,h),id+' '+name+': the camera only drops in a tunnel\'s lane ('+x.toFixed(1)+','+y.toFixed(1)+')');}
   if(under&&y<B.deck[1]+B.deck[3]-1.6)assert.ok(c.pitch<G.pitch-5,id+' '+name+': deep in a tunnel the camera drops to look along it ('+c.pitch.toFixed(1)+')');   // by its south mouth the tank is in plain view already
   assert.ok(c.pitch>=C.P.pitchMin-1e-6&&c.pitch<=C.P.pitchMax+1e-6,'pitch in range');assert.ok(c.h>0.8,'the camera stays above the ground');}
  sight[id+' '+name]={spots:n,clear,lifted,dropped};
  assert.ok(clear>=n*0.985,id+' '+name+': clear sight on '+clear+' of '+n+' spots');checks+=n;}
 // on the deck: the rig's own pitch, a clear line
 if(B){const [dx,dy,dw,dh]=B.deck,c=settle(390,844,{x:dx+dw/2,y:dy+dh/2,h:DECK,alive:true});near(c.pitch,C.rig(390,844).pitch,0.01,id+': on the deck the camera keeps its own pitch');assert.ok(C.clearLine(c.x,c.h,c.y,dx+dw/2,DECK+0.62,dy+dh/2));near(c.th,DECK,0.05,id+': the view rides up with the tank');checks+=3;}
}

// ---- the ground a map bakes covers every shot ----
for(const [name,[vw,vh]] of Object.entries(SCREENS)){
 const cv=C.cover(vw,vh),G=cv.G;C.setMap(maps.overpass,DECK,UNDER);
 assert.ok(cv.x0>=-46&&cv.x1<=W+46&&cv.z1<=H+18&&cv.z0<cv.horizon,name+' cover within what the map builder allows');
 const B=maps.overpass.bridge,tun=B.tunnels[0];
 const spots=[[1,1,0],[19,1,0],[1,31,0],[19,31,0],[10,16,DECK],[tun[0]+tun[1]/2,B.deck[1]+2.5,0],[10,12.6,0]];
 for(const [x,y,h] of spots)for(const alive of [true,false]){const c=settle(vw,vh,{x,y,h,alive},[{x:W-x,y:H-y,w:1}]);
  for(const sx of [0,vw/2,vw])for(const sy of [0,vh/2,vh]){const g=C.ground(sx,sy,0);if(!g||g[1]<cv.horizon)continue;
   assert.ok(g[0]>=cv.x0-1e-6&&g[0]<=cv.x1+1e-6&&g[1]<=cv.z1+1e-6,name+': screen point '+sx+','+sy+' from '+x+','+y+' sees ground at '+g[0].toFixed(1)+','+g[1].toFixed(1)+' inside '+JSON.stringify([cv.x0,cv.x1,cv.z1]));checks++;}}
 // the opening crane shot too
 C.begin({});for(let i=0;i<4;i++)C.update(1/30,{vw,vh,me:{x:10,y:29.5,h:0,alive:true},foes:[]});
 assert.ok(C.C.pitch<G.fov/2,name+': the crane shot starts low enough to show the sky');assert.ok(C.introLeft()>1.2);
 for(const sx of [0,vw])for(const sy of [vh*0.5,vh]){const g=C.ground(sx,sy,0);if(!g||g[1]<cv.horizon)continue;assert.ok(g[0]>=cv.x0&&g[0]<=cv.x1&&g[1]<=cv.z1,name+': crane shot ground inside the cover');}
 for(let i=0;i<120;i++)C.update(1/30,{vw,vh,me:{x:10,y:29.5,h:0,alive:true},foes:[]});
 near(C.C.pitch,G.pitch,0.05,name+': the crane shot ends at the playing view');assert.equal(C.introLeft(),0);checks+=3;
}
// the stick keeps its meaning while the camera is down in a tunnel
{C.setMap(maps.overpass,DECK,UNDER);const t=maps.overpass.bridge.tunnels[0],d=maps.overpass.bridge.deck;settle(390,844,{x:10,y:26,h:0,alive:true});const a=C.steer(0.6,-0.6).slice();
 const c=settle(390,844,{x:t[0]+t[1]/2,y:d[1]+2.5,h:0,alive:true});assert.ok(c.pitch<30,'the camera is down in the tunnel');const b=C.steer(0.6,-0.6);near(b[0],a[0],1e-12,'steer x unchanged in a tunnel');near(b[1],a[1],1e-12,'steer y unchanged in a tunnel');checks+=3;}
// reduced motion: no crane shot, the camera cuts instead of swinging
{C.begin({quiet:true});C.update(1/30,{vw:390,vh:844,me:{x:10,y:29.5,h:0,alive:true},foes:[],quiet:true});near(C.C.pitch,C.rig(390,844).pitch,1e-9,'reduced motion: no crane');
 C.update(1/30,{vw:390,vh:844,me:{x:10,y:8,h:0,alive:true},foes:[],quiet:true});const p=C.project(10,8,0,{});assert.ok(p.ok&&p.y>0&&p.y<844,'reduced motion: the view cuts to the tank');checks+=2;}
// a respawn jump cuts; ordinary driving follows without overshoot
{C.setMap(maps.classic,DECK,UNDER);settle(390,844,{x:10,y:8,h:0,alive:true});C.update(1/30,{vw:390,vh:844,me:{x:10,y:29,h:0,alive:true},foes:[]});const p=C.project(10,29,0,{});assert.ok(p.y>844*0.2&&p.y<844*0.8,'a respawn cuts to the tank');
 let x=10,last=C.C.tx,over=false;for(let i=0;i<90;i++){if(i<45)x+=4.4/30;C.update(1/30,{vw:390,vh:844,me:{x,y:29,h:0,alive:true},foes:[]});if(C.C.tx<last-1e-3&&i<45)over=true;last=C.C.tx;}
 assert.ok(!over,'the follow never runs backwards while the tank drives on');checks+=2;}

// ---- ground shapes and edge markers ----
{C.setMap(maps.classic,DECK,UNDER);settle(390,844,{x:10,y:2,h:0,alive:true});
 const rec=()=>{const o={n:0,bad:0,moveTo(x,y){this.n++;if(!Number.isFinite(x+y)||Math.abs(x)>1e6||Math.abs(y)>1e6)this.bad++;},lineTo(x,y){this.moveTo(x,y);},closePath(){}};return o;};
 for(const [x,y,r] of [[10,16,6],[10,16,40],[10,60,30],[10,2,2.4]]){const g=rec();C.arc(g,x,y,r);assert.ok(g.n>=3&&!g.bad,'a ring of '+r+' at '+x+','+y+' is finite ('+g.n+' points)');
  const g2=rec();C.arc(g2,x,y,r,-Math.PI/2,Math.PI/3,false,0);assert.ok(!g2.bad);const g3=rec();C.arc(g3,x,y,r,-Math.PI/2,-Math.PI,true,0);assert.ok(!g3.bad);checks+=3;}
 const g=rec();C.lane(g,10,2,Math.PI/2,80,1.2,0);assert.ok(g.n>=3&&!g.bad,'a lane that runs behind the camera is clipped, not thrown across the screen');
 const box={l:16,t:90,r:374,b:820};
 assert.equal(C.edge(200,400,box),null,'inside the frame: no marker');
 for(const [x,y] of [[10,31],[10,80],[-30,16],[50,16],[10,-20],[1,1]]){const e=C.pointer(x,y,0.5,box,195,500,{});if(!e){const p=C.project(x,y,0.5,{});assert.ok(p.ok&&p.x>=box.l&&p.x<=box.r&&p.y>=box.t&&p.y<=box.b);continue;}
  assert.ok(Number.isFinite(e.x+e.y+e.a),'marker finite');assert.ok(e.x>=box.l-1e-6&&e.x<=box.r+1e-6&&e.y>=box.t-1e-6&&e.y<=box.b+1e-6,'marker on the frame');
  assert.ok(Math.abs(e.x-box.l)<1e-6||Math.abs(e.x-box.r)<1e-6||Math.abs(e.y-box.t)<1e-6||Math.abs(e.y-box.b)<1e-6,'marker on an edge');checks+=3;}
 // something south of the tank (behind the camera) is marked on the bottom edge; east of it, on the right edge
 const s=C.pointer(10,90,0,box,195,500,{}),e=C.pointer(70,2,0,box,195,500,{});assert.ok(s&&Math.abs(s.y-box.b)<1e-6,'behind you: bottom edge');assert.ok(e&&Math.abs(e.x-box.r)<1e-6,'to your right: right edge');checks+=3;
}
assert.equal(JSON.stringify(maps),ctx.snap,'the camera never changes MAPS');
console.log('arena-cam: ok ('+checks+' checks)');console.log(JSON.stringify(sight));
