'use strict';
// Loaded only by range-engine.html. No account, Telegram, network or scoring hooks.
let rangeRandom=()=>{throw new Error('Practice seed not initialized');};
let rangeEvents=[],rangeForced=null,rangeStopped=false,rangeInput=[0,0];
const HOST={random:()=>rangeRandom(),ev:a=>{rangeEvents.push(a);},end:f=>{rangeForced=f;},round(){},death(){}};
const inputVec=()=>rangeInput;
