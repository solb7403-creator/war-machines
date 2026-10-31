'use strict';
// Deliberately no core/net/pvp/ui/main boot: no identity, account or persistent state.
window.LUNAR_HF_SAMPLE=true;
window.BUILD='practice-rc1';
const $=s=>document.querySelector(s),TG=null;
const save={gfx:'auto',sound:true,haptics:false,mp:99};
const RCOL=['#9fb3c8','#b78bff','#ffcf4a','#7be3e0'];
const ACT=Object.create(null),pvpOn=()=>false,pvpLag=()=>false,uiDirty=()=>{},pushBack=()=>{},dropBack=()=>{};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const fmtNum=n=>Math.round(n||0).toLocaleString('en-US');
const myLoadout=()=>rangeRun?.cfg.L||STOCK_L;
// Only HF material manifest/texture reads may use fetch. Even same-origin service calls are rejected.
const previewAssetFetch=window.fetch.bind(window);
window.fetch=(input,options={})=>{
 const u=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(u.origin!==location.origin||method!=='GET'||!/^\/js\/assets\/hf-v1\/(manifest\.json|(?:base|normal|orm)-(?:high|low)\.png)$/.test(u.pathname))return Promise.reject(new Error('Practice blocks service requests'));
 return previewAssetFetch(input,{...options,credentials:'omit'});
};
for(const key of ['XMLHttpRequest','WebSocket','EventSource'])window[key]=class{constructor(){throw Error('Practice has no service connections');}};
navigator.sendBeacon=()=>false;
