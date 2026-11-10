/* Draggable bottom sheet for the town screen (Session 5C). Three snap points over the space below the town header: PEEK
   (about 18%), HALF (50%) and FULL (88%). Real finger drag on the grab handle (pointer events, so it works through the
   app's touch guard on iPhone, and with a mouse), with inertia: a flick carries on to the next snap. The page never
   scrolls: the handle is touch-action:none and the sheet's own list scrolls inside it. Pure math (heights, settle) is
   separate from the DOM so node can test it (dev/tests/conquest-sheet.mjs). */
(function(root){
'use strict';
const SNAPS=Object.freeze({peek:.18,half:.5,full:.88}),ORDER=Object.freeze(['peek','half','full']);
// Snap heights in px for a free height H; PEEK never hides the handle and the tabs (minPeek).
function heights(H,minPeek=0){H=Math.max(0,+H||0);const hs={};for(const k of ORDER)hs[k]=Math.round(H*SNAPS[k]);hs.peek=Math.min(hs.half,Math.max(hs.peek,Math.round(minPeek)));return hs;}
const clamp=(h,hs)=>Math.max(hs.peek,Math.min(hs.full,h));
// Where a released drag lands: the snap nearest to where the sheet would coast (velocity v in px/ms, + = growing) in
// ~180 ms; a firm flick (|v| > .55 px/ms) always moves at least one snap in its direction.
function settle(h,v,H,minPeek=0){const hs=heights(H,minPeek),aim=clamp(h+(+v||0)*180,hs);let best='peek',d=Infinity;for(const k of ORDER){const e=Math.abs(hs[k]-aim);if(e<d){d=e;best=k;}}
 if(Math.abs(v)>.55){const at=ORDER.reduce((a,k)=>Math.abs(hs[k]-h)<Math.abs(hs[a]-h)?k:a,'peek'),i=ORDER.indexOf(at),dir=v>0?1:-1,next=ORDER[Math.max(0,Math.min(2,i+dir))];
  if(dir>0?hs[next]>h&&ORDER.indexOf(best)<ORDER.indexOf(next):hs[next]<h&&ORDER.indexOf(best)>ORDER.indexOf(next))best=next;}
 return best;}
// Tap on the handle (or Enter/Space): PEEK -> HALF -> FULL -> PEEK.
const next=k=>ORDER[(ORDER.indexOf(k)+1)%3];
// DOM controller. o: {handle, get H() px free height, minPeek() px, apply(px, animate), snapped(name)}.
function attach(o){const h=o.handle;let id=null,y0=0,h0=0,last=[],cur=0,moved=0;
 const now=()=>root.performance?performance.now():Date.now();
 h.addEventListener('pointerdown',e=>{if(id!==null)return;id=e.pointerId;h.setPointerCapture?.(id);y0=e.clientY;h0=cur=o.current();moved=0;last=[[now(),e.clientY]];o.apply(cur,false);e.preventDefault();});
 h.addEventListener('pointermove',e=>{if(e.pointerId!==id)return;const hs=heights(o.H(),o.minPeek());moved=Math.max(moved,Math.abs(e.clientY-y0));cur=Math.max(hs.peek*.8,Math.min(o.H()*.94,h0+(y0-e.clientY)));o.apply(cur,false);last.push([now(),e.clientY]);if(last.length>6)last.shift();e.preventDefault();});
 const end=e=>{if(e.pointerId!==id)return;id=null;const a=last[0],b=last[last.length-1],dt=Math.max(1,b[0]-a[0]),v=last.length>1&&now()-b[0]<120?(a[1]-b[1])/dt:0;
  o.snapped(moved<6?next(o.snap()):settle(cur,v,o.H(),o.minPeek()));};
 h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);h.addEventListener('lostpointercapture',e=>{if(e.pointerId===id)end(e);});
 h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();o.snapped(next(o.snap()));}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const i=ORDER.indexOf(o.snap());o.snapped(ORDER[Math.max(0,Math.min(2,i+(e.key==='ArrowUp'?1:-1)))]);}});}
root.ConquestSheet=Object.freeze({SNAPS,ORDER,heights,settle,next,clamp,attach});
})(globalThis);
