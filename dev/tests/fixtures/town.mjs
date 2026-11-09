// Session 5B scenario fixtures (tests and the local conquest-server only): a fully built CC10 town for render budgets and
// raid-sim bounds, and a legal starter town. Scenario placements, never written to production.
export function fullTown(P,site='crater',{cells=2000,codes=[19,16,13,10,7],turrets=42,level=5,now=Date.now()}={}){
 const q=P.newPlot(site,now);q.cc=10;q.b.cc.l=10;q.siteFree=1;q.ext={r:5,d:31,w:12};
 for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.turret||B.gate)continue;for(let n=P.countOf(q,t);n<P.countCap(t,10);n++){const at=P.autoPlace(q,t);if(at)q.b['b'+(++q.n)]={t,...at,l:B.max};}}
 for(const b of Object.values(q.b))if(b.t!=='cc')b.l=P.BUILDINGS[b.t].max;
 // turrets on two rings inside the walls, every type in turn
 for(let n=0,tries=0;P.turretCount(q)<turrets&&tries<400;tries++,n++){const t=P.TURRETS[n%P.TURRETS.length],R=n%2?22:17,a=n*2.399,i=Math.round(P.MID+Math.cos(a)*R),j=Math.round(P.MID+Math.sin(a)*R);if(!P.placeError(q,t,i,j,0))q.b['b'+(++q.n)]={t,i,j,r:0,l:level};}
 // concentric wall rings from the town edge inward, heavy rare blends first
 const h=P.townH(10);let ring=0;for(let r=h-1;r>=24&&Object.keys(q.w).length<cells;r-=1,ring++){const {o,l}=P.wdecode(codes[ring%codes.length]);const plan=P.wallPlan({...q,devx:1},[{k:'rect',a:[P.MID-r,P.MID-r],b:[P.MID+r,P.MID+r],o,l}],{dev:true});
  for(const c of plan.cells){if(Object.keys(q.w).length>=cells)break;q.w[c.i+','+c.j]=c.code;}}
 q.power=P.power(q);return q;}
