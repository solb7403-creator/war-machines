/* Base sheet snap math (Session 5C): the town screen's bottom sheet pulls up and down by finger or mouse and settles on a
   snap: CLOSED (drive mode: only the grab bar and the tabs show, the camera follows your tank), PEEK (about 18% of the
   screen), HALF (about 50%) and FULL (about 88%). A release keeps its momentum (a flick moves at least one snap the way it
   was thrown); dragging past the ends rubber-bands. Pure functions, tested in node (dev/tests/conquest-sheet.mjs); the
   town view (plotview.js) owns the DOM and sets one CSS variable (--cq-sheet-h) that the map stage and the renderer follow. */
(function(root){
'use strict';
const ORDER=Object.freeze(['closed','peek','half','full']);
const FRACTION=Object.freeze({peek:.18,half:.5,full:.88});
const DEFAULT_TAB=Object.freeze({home:'half',build:'half',weapons:'half',walls:'peek',defend:'half'});
// Snap heights in px for an available height H (the screen below the header). bar: the grab bar + tabs (CLOSED height);
// minPeek keeps the tabs and the coach line readable on a 320x568 phone.
function heights(H,o={}){const bar=Math.max(40,o.bar||68),minPeek=Math.max(bar+28,o.minPeek||118),h=Math.max(bar+60,H|0);
 const peek=Math.min(Math.round(h*.6),Math.max(minPeek,Math.round(h*FRACTION.peek))),half=Math.max(peek+40,Math.round(h*FRACTION.half)),full=Math.max(half+40,Math.min(h-56,Math.round(h*FRACTION.full)));
 return {closed:bar,peek,half,full};}
// While the finger is down: follow it, rubber-banding beyond the lowest/highest allowed snap.
function drag(h,hs,allowed=ORDER){const lo=hs[allowed[0]],hi=hs[allowed[allowed.length-1]];if(h<lo)return lo-(lo-h)*.35;if(h>hi)return hi+(h-hi)*.35;return h;}
// On release: v in px/ms, positive = upward (the sheet grows). The momentum projects the position about 180 ms ahead; a fast
// flick (|v| >= 0.5 px/ms) always moves at least one snap in its direction.
function settle(h,v,hs,allowed=ORDER){const list=allowed.filter(k=>hs[k]!==undefined).sort((a,b)=>hs[a]-hs[b]);if(!list.length)return 'half';
 if(v>=.5){for(const k of list)if(hs[k]>h+8)return k;return list[list.length-1];}
 if(v<=-.5){for(let i=list.length-1;i>=0;i--)if(hs[list[i]]<h-8)return list[i];return list[0];}
 const at=h+v*180;let best=list[0];for(const k of list)if(Math.abs(hs[k]-at)<Math.abs(hs[best]-at))best=k;return best;}
// One step of the settle animation (critically damped; dt in s). Returns the new height and whether it has arrived.
function approach(h,target,dt){const k=1-Math.exp(-dt*14),n=h+(target-h)*k;return Math.abs(target-n)<.6?{h:target,done:true}:{h:n,done:false};}
// Release velocity from the last ~90 ms of samples [{t,h}].
function velocity(samples){if(samples.length<2)return 0;const last=samples[samples.length-1];let first=samples[0];for(const s of samples)if(last.t-s.t<=90){first=s;break;}const dt=last.t-first.t;return dt>0?(last.h-first.h)/dt:0;}
const snapOf=(tab,memory)=>memory?.[tab]||DEFAULT_TAB[tab]||'half';
root.ConquestSheet=Object.freeze({ORDER,FRACTION,DEFAULT_TAB,heights,drag,settle,approach,velocity,snapOf});
})(globalThis);
