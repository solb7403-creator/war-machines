// Map layout checks for every real map (node dev/tests/map-layout.mjs [mapId...] [--ascii]):
// point symmetry, clear spawns, no bot traps (gaps between solids a line of sight fits through but a tank doesn't),
// no unreachable pockets, room for the crystal mine / moving zone / boxes, and nav graph size (AI cost on phones).
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
const root=new URL('../../',import.meta.url);let seed=7;
const ctx=createContext({console,HOST:{random(){seed=(seed*16807)%2147483647;return seed/2147483647;},ev(){}}});
for(const f of ['js/rules.js','js/game.js'])runInContext(readFileSync(new URL(f,root),'utf8'),ctx);
const G=k=>runInContext(k,ctx);
const args=process.argv.slice(2),ascii=args.includes('--ascii'),only=args.filter(a=>!a.startsWith('--'));
const ids=only.length?only:G('MAP_REAL');
const W=G('W'),H=G('H'),R=G('R');
// maps made after the original four are held to every rule; the originals keep their approved layouts
const STRICT=new Set(['canyon','bunker']);
const rectGap=(a,b)=>{const dx=Math.max(a[0]-(b[0]+b[2]),b[0]-(a[0]+a[2]),0),dy=Math.max(a[1]-(b[1]+b[3]),b[1]-(a[1]+a[3]),0);return Math.hypot(dx,dy);};
const rectPt=(a,x,y)=>{const dx=Math.max(a[0]-x,x-(a[0]+a[2]),0),dy=Math.max(a[1]-y,y-(a[1]+a[3]),0);return Math.hypot(dx,dy);};
let failed=0;
for(const id of ids){
 G(`setMap(${JSON.stringify(id)})`);
 const M=G('MAPS')[id],strict=STRICT.has(id),out=[];const bad=m=>{out.push(m);};
 const walls=G('walls').map(w=>w.slice(0,4)),rocks=G('rocks').map(r=>r.slice(0,3)),BR=G('BR');
 const solids=[...walls.map(w=>({k:'w',w})),...rocks.map(r=>({k:'r',r}))];
 // 1. point symmetry about the centre
 if(strict){
  const key=a=>a.map(v=>Math.round(v*100)/100).join(',');
  for(const [name,list,mir] of [['walls',M.walls,w=>[W-w[0]-w[2],H-w[1]-w[3],w[2],w[3]]],['crates',M.crates||[],w=>[W-w[0]-w[2],H-w[1]-w[3],w[2],w[3]]],['rocks',M.rocks||[],r=>[W-r[0],H-r[1],r[2]]],['craters',M.craters||[],r=>[W-r[0],H-r[1],r[2]]]]){
   const set=new Set(list.map(a=>key(a.slice(0,mir([0,0,0,0]).length))));
   for(const a of list)if(!set.has(key(mir(a))))bad(name+' not symmetric: '+a);
  }
 }
 // 2. spawns: team seats, the boss, Last Standing's fixed seat
 const free=(x,y,m=0.1)=>x>R&&x<W-R&&y>R&&y<H-R&&!walls.some(w=>rectPt(w,x,y)<R+m)&&!rocks.some(r=>Math.hypot(x-r[0],y-r[1])<r[2]+R+m);
 for(const [x,y] of [[10,28],[6,26],[14,26],[10,4],[6,6],[14,6],[10,5]])if(!free(x,y,0.15))bad('spawn blocked '+x+','+y);
 const roy=G('royaleSpawns()');roy.forEach((p,i)=>{if(!free(p.x,p.y,0))bad('royale spawn '+i+' not free');});
 // 3. traps: two solids (or a solid and the edge) with a gap a sight line fits through but a tank (1.4 wide) does not
 if(strict){
  const MIN=2.2;
  for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){
   const a=solids[i],b=solids[j];let g;
   if(a.k==='w'&&b.k==='w')g=rectGap(a.w,b.w);
   else if(a.k==='r'&&b.k==='r')g=Math.hypot(a.r[0]-b.r[0],a.r[1]-b.r[1])-a.r[2]-b.r[2];
   else{const w=a.k==='w'?a.w:b.w,r=a.k==='r'?a.r:b.r;g=rectPt(w,r[0],r[1])-r[2];}
   if(g>0.02&&g<MIN-1e-6)bad('tight gap '+g.toFixed(2)+' between '+JSON.stringify(a.w||a.r)+' and '+JSON.stringify(b.w||b.r));
  }
  for(const s of solids){
   const gs=s.k==='w'?[s.w[0],W-s.w[0]-s.w[2],s.w[1],H-s.w[1]-s.w[3]]:[s.r[0]-s.r[2],W-s.r[0]-s.r[2],s.r[1]-s.r[2],H-s.r[1]-s.r[2]];
   const cx=s.k==='w'?s.w[0]+s.w[2]/2:s.r[0],cy=s.k==='w'?s.w[1]+s.w[3]/2:s.r[1];
   const mids=[[gs[0]/2,cy],[W-gs[1]/2,cy],[cx,gs[2]/2],[cx,H-gs[3]/2]];   // the middle of the strip between it and the edge
   gs.forEach((g,i)=>{if(g>0.02&&g<MIN&&!walls.some(w=>rectPt(w,mids[i][0],mids[i][1])===0))bad('tight edge gap '+g.toFixed(2)+' at '+JSON.stringify(s.w||s.r));});
  }
 }
 // 4. reachability of the ground level (flood fill over tank-centre positions)
 const S=0.1,nx=Math.round(W/S),ny=Math.round(H/S),grid=new Uint8Array(nx*ny);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)grid[j*nx+i]=free((i+0.5)*S,(j+0.5)*S,0)?1:0;
 const comp=new Int32Array(nx*ny).fill(-1),sizes=[];
 for(let s=0;s<nx*ny;s++){if(!grid[s]||comp[s]>=0)continue;const c=sizes.length;let n=0;const st=[s];comp[s]=c;
  while(st.length){const p=st.pop();n++;const i=p%nx,j=(p/nx)|0;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=ny)continue;const q=b*nx+a;if(grid[q]&&comp[q]<0){comp[q]=c;st.push(q);}}}
  sizes.push(n);}
 const main=comp[Math.floor(28/S)*nx+Math.floor(10/S)];
 const pockets=sizes.map((n,c)=>[c,n*S*S]).filter(([c,a])=>c!==main&&a>0.05);
 // on a bridge map the ground under the deck is split by the solid deck blocks: tunnels join it, so only flag pockets off the deck
 for(const [c,a] of pockets){let inDeck=false;if(BR){for(let s=0;s<nx*ny;s++)if(comp[s]===c){const x=(s%nx+0.5)*S,y=((s/nx|0)+0.5)*S;const [dx,dy,dw,dh]=BR.deck;inDeck=x>dx-1.5&&x<dx+dw+1.5&&y>dy-1.5&&y<dy+dh+1.5;break;}}
  if(!inDeck)bad('unreachable pocket of '+a.toFixed(2)+' sq units');}
 // 5. objectives: mine crystals, zone spots, boxes all find room
 let mine=0,zone=0;for(let k=0;k<200;k++){if(G('freeSpot(10,16,CRY_MINE_R)'))mine++;const z=G('zoneSpot(null)');if(!(z.x===10&&z.y===16))zone++;}
 if(mine<190)bad('crystal mine spots '+mine+'/200');if(zone<190)bad('zone spots '+zone+'/200');
 // 6. AI cost: nav nodes and the open area
 const nodes=G('nav.length'),openA=sizes[main]*S*S;
 if(strict&&nodes>150)bad('nav graph too big: '+nodes+' nodes');
 console.log((out.length?'FAIL ':'ok   ')+id.padEnd(9)+' walls '+String(walls.length).padStart(2)+' rocks '+String(rocks.length).padStart(2)+' nav '+String(nodes).padStart(3)+' open '+openA.toFixed(0)+' sq'+(out.length?'\n   - '+out.join('\n   - '):''));
 if(out.length)failed++;
 if(ascii){const cs=0.5;let s='';for(let y=cs/2;y<H;y+=cs){for(let x=cs/2;x<W;x+=cs){let ch='.';
   if(BR&&x>BR.deck[0]&&x<BR.deck[0]+BR.deck[2]&&y>BR.deck[1]&&y<BR.deck[1]+BR.deck[3])ch=BR.tunnels.some(([tx,tw])=>x>tx&&x<tx+tw)?'_':'=';
   if(BR&&BR.ramps.some(r=>x>r[0]&&x<r[0]+r[2]&&y>r[1]&&y<r[1]+r[3]))ch='/';
   if((M.craters||[]).some(c=>Math.hypot(x-c[0],y-c[1])<c[2]))ch='~';
   const wl=G('walls').find(w=>x>w[0]&&x<w[0]+w[2]&&y>w[1]&&y<w[1]+w[3]);if(wl&&ch!=='='&&ch!=='_')ch=wl[4]==='crate'?'c':'#';
   if(rocks.some(r=>Math.hypot(x-r[0],y-r[1])<r[2]))ch='o';
   s+=ch;}s+='\n';}console.log(s);}
}
assert.equal(failed,0,failed+' map(s) failed the layout checks');
console.log('map layouts ok');
