// Session 5B balance fixtures: a legal CC1 starter town and a legal CC10 town (power within supply), with walls of a given
// blend. Scenario placements for the balance model (dev/tests/conquest-town-balance.mjs), never production data.
export function starterTown(P,site,{blend=[1,1],R=7,turrets=['cannon','cannon','mg']}={}){const p=P.newPlot(site,0),c=p.b.cc,ci=c.i+2,cj=c.j+2;
 const spots=[[ci-4,cj-4],[ci+3,cj+3],[ci+3,cj-4],[ci-4,cj+3]];turrets.forEach((t,k)=>{let [i,j]=spots[k];for(let d=0;d<4&&P.placeError(p,t,i,j,0);d++)i+=k%2?1:-1;if(!P.placeError(p,t,i,j,0))p.b['t'+k]={t,i,j,r:0,l:1};});
 const pl=P.wallPlan(p,[{k:'ring',a:[ci,cj],b:[ci+R,cj],o:blend[0],l:blend[1]}]);for(const x of pl.cells)p.w[x.i+','+x.j]=x.code;return {p,cost:pl.cost};}
// A CC10 town: vitals next to the Command Center, production, three shields, 42 turrets of all eleven types on two rings,
// then wall rings from radius `inner` outward in the given blends until `cells` walls.
export function cc10Town(P,site,{blends=[[6,3],[5,3],[4,3],[3,3]],cells=2000,inner=18,ext=false}={}){const p=P.newPlot(site,0);p.cc=10;p.b.cc.l=10;if(ext)p.ext={r:5,d:31,w:12};
 const put=(t,l,n=1)=>{for(let k=0;k<n;k++){const at=P.autoPlace(p,t);if(at)p.b['b'+(++p.n)]={t,...at,l};}};
 for(const b of Object.values(p.b))if(b.t==='storage')b.l=5;put('reactor',5,5);put('refinery',5,2);put('biodome',5,2);put('helium',5,1);put('foundry',5,1);put('shield',5,3);put('lab',3,1);
 const heavy=new Set(P.TURRETS.filter(t=>P.BUILDINGS[t].pw>1));let n=0;
 for(let k=0;P.turretCount(p)<42&&k<600;k++){const t=P.TURRETS[n%11],R=k%2?16:12,a=k*2.399,i=Math.round(P.MID+Math.cos(a)*R),j=Math.round(P.MID+Math.sin(a)*R);if(!P.placeError(p,t,i,j,0)){p.b['b'+(++p.n)]={t,i,j,r:0,l:heavy.has(t)?4:5};n++;}}
 const cap=P.wallCapOf(p);for(let r=inner,ring=0;Object.keys(p.w).length<Math.min(cells,cap)&&r<=P.townH(10);r++,ring++){const [o,l]=blends[ring%blends.length];const pl=P.wallPlan({...p,devx:1},[{k:'rect',a:[P.MID-r,P.MID-r],b:[P.MID+r,P.MID+r],o,l}],{dev:true});for(const x of pl.cells){if(Object.keys(p.w).length>=Math.min(cells,cap))break;p.w[x.i+','+x.j]=x.code;}}
 return p;}
