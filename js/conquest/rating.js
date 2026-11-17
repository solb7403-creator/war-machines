/* A generic rating chip (owner decision 6, blueprint §11 "a generic rating chip, so FORCE and DEFENSE reuse it"): a label and a
   number, and when the number changes a one-line delta ("POWER 92 → 94") for a few seconds. The last value a pilot saw is kept per
   key (this device), so a change made elsewhere (a mod fitted in the garage, a plate) shows as a delta the next time the chip draws.
   POWER is the tank's gear rating (rules.js powerOf: plating and research mods included); 6C adds FORCE, the town DEFENSE. */
(function(root){
'use strict';
const KEY='lunar-rating-chips-v1',SHOW_MS=4000;
let seen=null;const load=()=>{if(seen)return seen;try{seen=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){seen={};}return seen;};
const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(seen||{}));}catch(_){}};
// make a chip: {key, label, value, title}
function chip(el,parent,o){const c=el('span','cq-rating cq-rating-'+o.key,null,parent);c.dataset.key=o.key;c.dataset.label=o.label;if(o.title)c.title=o.title;c.setAttribute('role','status');el('b','',o.label,c);el('span','cq-rating-v','',c);update(c,o.value);return c;}
// a new value: the delta line while it is fresh, then the plain number
function update(c,value){if(!c||!Number.isFinite(value))return;const k=c.dataset.key,s=load(),was=Number(s[k]),now=Date.now();
 if(Number.isFinite(was)&&was!==Math.round(value)&&c.dataset.v!==String(Math.round(value))){c.dataset.from=String(was);c.dataset.until=String(now+SHOW_MS);c.classList.toggle('up',value>was);c.classList.toggle('down',value<was);}
 c.dataset.v=String(Math.round(value));s[k]=Math.round(value);keep();
 const fresh=Number(c.dataset.until||0)>now,txt=fresh?c.dataset.from+' → '+Math.round(value):String(Math.round(value)),v=c.querySelector('.cq-rating-v');
 if(v&&v.textContent!==txt)v.textContent=txt;if(!fresh&&(c.classList.contains('up')||c.classList.contains('down'))){c.classList.remove('up','down');}
 c.setAttribute('aria-label',c.dataset.label+' '+txt);}
root.ConquestRating=Object.freeze({chip,update});
})(globalThis);
