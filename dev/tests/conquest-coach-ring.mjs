// Session 7T-P decision 3 (owner brief docs/conquest/audit/SESSION_07TP_BRIEF.md): the town coach's step that has the pilot close a first
// wall ring before Command Center level 4. The ring rule (ConquestTown.ringOf, shared by the phone's coach and the models): closed when
// raiders gathering outside the town cannot reach the Command Center or a vital without breaking a wall; the coach step (the town view's
// guideStep, js/conquest/plotview.js) and its red marker; the real wall order on the Worker closes it. The REPAIR re-measure is in
// dev/tests/conquest-fortress.mjs (f) (the long simulations' job).
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Plot:P,Town:TN}=CONQUEST;
const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');const {townPilot}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const centre=p=>{const c=p.b.cc,sz=P.sizeOf('cc',c.r|0);return [Math.round(c.i+(sz.w-1)/2),Math.round(c.j+(sz.d-1)/2)];};
const draw=(p,sec)=>{const pl=P.wallPlan(p,[sec]);assert.ok(!pl.err,pl.err);for(const x of pl.cells)p.w[x.i+','+x.j]=x.code;return pl;};
const ring=(p,r)=>{const [i,j]=centre(p);return {k:'ring',a:[i,j],b:[i+r,j],o:0,l:0};};
// ---- 1. the ring rule ----
{const p=P.newPlot('ridge',0),r=TN.ringOf(p);ok(!r.closed&&r.open==='cc'&&r.walls===0&&r.gap===null,'a new town is open: raiders walk to the Command Center (no walls, no marker yet)');}
{const rows=[];for(const site of P.SITE_IDS.filter(x=>x!=='ice')){const p=P.newPlot(site,0);let R0=0;for(let r=6;r<=14&&!R0;r++){const q=structuredClone(p);draw(q,ring(q,r));if(TN.ringOf(q).closed)R0=r;}rows.push(site+' R'+R0);ok(R0>=6&&R0<=12,site+': a RING from the Command Center out past the Storage Depot closes the town (radius '+R0+', inside the 200 starting composite)');}}
{const p=P.newPlot('ice',0);draw(p,ring(p,10));const r=TN.ringOf(p);ok(!r.closed&&r.gap&&P.terrainAt('ice',...r.gap)==='ice','ICE BASIN: a RING across the frozen lake stays open (walls cannot stand on ice) and the marker sits on the ice');
 const q=P.newPlot('ice',0);const pl=draw(q,{k:'rect',a:[29,31],b:[46,41],o:0,l:0});ok(TN.ringOf(q).closed&&pl.cells.length<=200,'ICE BASIN: a RECT along the shore closes it ('+pl.cells.length+' cells)');}
{const p=P.newPlot('ridge',0);draw(p,ring(p,10));const [i,j]=centre(p);ok(TN.ringOf(p).closed,'a closed ring');const gap=[[i+10,j],[i+10,j+1]].filter(([a,b])=>p.w[a+','+b]);for(const [a,b] of gap)delete p.w[a+','+b];
 const r=TN.ringOf(p);ok(!r.closed&&r.open==='cc'&&r.gap&&Math.hypot(r.gap[0]-(i+10),r.gap[1]-j)<=2,'two cells taken out: open, and the marker is at the gap ('+r.gap+' for the hole at '+(i+10)+','+j+')');
 const b=P.autoPlace(p,'refinery');p.b.x1={t:'refinery',...b,l:1};const q=structuredClone(p);for(const [a,c] of gap)q.b['blk'+a+c]={t:'refinery',i:a,j:c,r:0,l:1};ok(!TN.ringOf(q).closed,'a building in the gap never closes a ring (raiders wreck it)');
 const d=structuredClone(p);for(const [a,c] of gap)d.w[a+','+c]=1;d.dmg={['w:'+gap[0][0]+','+gap[0][1]]:599};ok(TN.ringOf(d).closed,'a damaged wall still counts (REPAIR restores it)');}
{const p=P.newPlot('ridge',0);draw(p,ring(p,4));const r=TN.ringOf(p);ok(!r.closed&&r.open==='storage'&&r.gap&&r.gap[0]>=31&&r.gap[0]<=33,'a ring around the Command Center alone leaves the Storage Depot outside: open, the marker on it ('+r.gap+')');}
{const p=P.newPlot('plateau',0);const pl=draw(p,ring(p,10));ok(TN.ringOf(p).closed&&pl.skip.blocked>0,'HIGHLAND PLATEAU: the summit ring\'s natural walls close the ring with the pilot\'s walls ('+pl.skip.blocked+' cells are rock)');}
{const p=P.newPlot('crater',0),t0=performance.now();for(let k=0;k<200;k++)TN.ringOf(p);ok((performance.now()-t0)/200<5,'cheap enough for every render of the town view ('+((performance.now()-t0)/200).toFixed(2)+' ms)');}
// ---- 2. the coach step (js/conquest/plotview.js guideStep) ----
{const req=createRequire(import.meta.url);globalThis.ConquestPlot=P;globalThis.ConquestTown=TN;for(const f of ['townkit','sheet','plotview'])req('../../js/conquest/'+f+'.js');const G=globalThis.ConquestPlotView.guideStep;
 const town=(cc=1)=>{const p=P.newPlot('ridge',0);p.cc=cc;p.b.cc.l=cc;p.b.r1={t:'refinery',...P.autoPlace(p,'refinery'),l:1};p.b.t1={t:'cannon',...P.autoPlace(p,'cannon'),l:1};return p;},S={};
 let p=town();ok(G(p,S).id==='wall'&&G(p,S).k===3,'steps 1-3 as before: the first wall is step 3');
 draw(p,{k:'line',a:[30,30],b:[36,30],o:0,l:0});let g=G(p,S);ok(g.id==='ring'&&g.k===4&&g.n===7&&g.tab==='walls'&&/CLOSE YOUR WALL RING before CC4/.test(g.text)&&g.gap,'a wall that does not close the town: STEP 4 OF 7, CLOSE YOUR WALL RING (WALLS glows, the red marker)');
 ok(/LINE over the red marker/.test(g.here)&&/open WALLS/.test(g.short),'the map pill: "'+g.short+'", in WALLS: "'+g.here+'"');
 draw(p,ring(p,10));g=G(p,S);ok(g.id==='reactor'&&g.k===5,'the ring closed: the coach moves on (STEP 5: the Reactor inside your walls)');
 const out=structuredClone(p);out.b.re={t:'reactor',i:60,j:37,r:0,l:1};g=G(out,S);ok(g.id==='ring'&&/RING IN YOUR REACTOR/.test(g.text)&&g.gap,'a Reactor built outside the walls: the step comes back, RING IN YOUR REACTOR');
 const cc4=structuredClone(out);cc4.cc=4;cc4.b.cc.l=4;ok(G(cc4,S)?.id!=='ring','from CC4 the coach no longer asks (the step is for the first ring, before CC4)');
 const done=structuredClone(p);done.b.re={t:'reactor',...P.autoPlace(done,'reactor'),l:1};done.log=[{at:1}];done.cc=2;done.b.cc.l=2;ok(TN.ringOf(done).closed&&G(done,S)===null,'every step done with the ring closed: no coach');
 const open2=structuredClone(done);for(const k of Object.keys(open2.w).slice(0,6))delete open2.w[k];ok(!TN.ringOf(open2).closed&&G(open2,S)?.id==='ring','at CC2-3 an open ring brings the step back even after the chain ended');}
// ---- 3. the real wall order on the Worker closes it ----
{const t=Date.UTC(2026,10,23,12);let s=townPilot(CONQUEST,R,createState,t,{cc:2});ok(!TN.ringOf(s.plot).closed,'a claimed CC2 town on the Worker starts open');const [i,j]=centre(s.plot);
 s=applyAction(s,{seq:s.seq+1,action:'plot-wall',plot:{s:[{k:'ring',a:[i,j],b:[i+10,j],o:0,l:0}]}},t+1000);ok(TN.ringOf(s.plot).closed&&Object.keys(s.plot.w).length>=60,'the coach\'s RING through the real plot-wall action closes it ('+Object.keys(s.plot.w).length+' cells, composite left '+Math.floor(s.plot.cm)+')');}
console.log('PASS the first wall ring coach step (7T-P decision 3): '+pass+' checks');
