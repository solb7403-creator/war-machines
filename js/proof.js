'use strict';
// =====================================================================
// proof of play: the phone keeps a small record of every AI match (twice a second: where each tank is, its health,
// your controls, your damage) and sends it with the result. The server checks it against the game's own limits before
// it scores the match (worker/src/proof.js). Live matches don't need one: the server runs those itself.
// Format v1, per sample: every unit [x*10, y*7.5, hp%], then for you [input x+100, input y+100, flags, damage (2 bytes),
// touches]. Flags: 1 touching, 2 dash, 4 shield, 8 super fired, 16 box, 32 on the deck, 64 new round, 128 fast forward.
// =====================================================================
const PROOF_DT=0.5,PROOF_MAX=1600;   // 0.5 s samples; 1,600 covers a 5-round best of 3
let PR=null;
function proofBegin(){
 PR=null;
 if(typeof pvpOn==='function'&&pvpOn())return;
 if(!me||!units.length)return;
 const n=units.length,sz=n*3+6;
 PR={n,sz,buf:new Uint8Array(sz*PROOF_MAX),k:0,t:0,next:PROOF_DT,ix:0,iy:0,w:0,tch:0,fl:0,tc:0,kc:0,dmg:0,sup:0,box:0,round:series?series.round:1,
  hdr:units.map(u=>[u.team,CHORDER.indexOf(u.cls),Math.round(u.mhp||0),(u.boss?1:0)|(u.gh?2:0)|(u===me?4:0)])};
 const st=me.st||{};PR.dmg=st.dmg||0;PR.sup=st.sup||0;PR.box=st.box||0;
}
// taps and keys during the match (the joystick, buttons, target taps)
(function(){
 const c=document.getElementById('c');
 if(c)c.addEventListener('pointerdown',()=>{if(PR)PR.tc++;},{passive:true});
 addEventListener('keydown',e=>{if(PR&&!e.repeat)PR.kc++;});
})();
function proofStep(dt){
 if(!PR||state!=='play'||!me)return;
 let ix=0,iy=0;
 if(me.ctl==='me'&&me.hp>0){const v=inputVec();ix=v[0];iy=v[1];}
 PR.ix+=ix*dt;PR.iy+=iy*dt;PR.w+=dt;
 if((typeof joy!=='undefined'&&joy.on)||(typeof aim!=='undefined'&&aim)||Object.values(keys||{}).some(Boolean))PR.tch=1;
 if(me.dash)PR.fl|=2;if(me.shieldT>0)PR.fl|=4;if(ffwd)PR.fl|=128;
 if(series&&series.round!==PR.round){PR.round=series.round;PR.fl|=64;}
 PR.t+=dt;
 while(PR.t>=PR.next){proofSample();PR.next+=PROOF_DT;}
}
function proofSample(){
 if(PR.k>=PROOF_MAX)return;
 const b=PR.buf,o=PR.k*PR.sz,cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.round(v)));
 units.forEach((u,i)=>{if(i>=PR.n)return;const j=o+i*3;b[j]=cl(u.x*10,0,255);b[j+1]=cl(u.y*7.5,0,255);b[j+2]=cl(Math.max(0,u.hp)/(u.mhp||1)*100,0,100);});
 const st=me.st||{},w=PR.w||1,p=o+PR.n*3,d=cl((st.dmg||0)-PR.dmg,0,65535);
 if((st.sup||0)>PR.sup)PR.fl|=8;if((st.box||0)>PR.box)PR.fl|=16;if((me.elev||0)===1)PR.fl|=32;
 b[p]=cl(PR.ix/w*100+100,0,200);b[p+1]=cl(PR.iy/w*100+100,0,200);b[p+2]=PR.fl|(PR.tch?1:0);b[p+3]=d>>8;b[p+4]=d&255;b[p+5]=cl(PR.tc+PR.kc,0,255);
 PR.dmg+=d;PR.sup=st.sup||0;PR.box=st.box||0;PR.ix=PR.iy=PR.w=0;PR.tch=0;PR.fl=0;PR.tc=PR.kc=0;
 PR.k++;
}
// the record that goes with the result (null outside an AI match)
function proofData(){
 if(!PR)return null;
 if(PR.t>0.05||!PR.k)proofSample();   // the final moment (the last kill can land between two samples)
 if(!PR.k)return null;
 const raw=PR.buf.subarray(0,PR.k*PR.sz);let s='';
 for(let i=0;i<raw.length;i+=0x8000)s+=String.fromCharCode.apply(null,raw.subarray(i,i+0x8000));
 const fin={gs:[Math.round(gscore[0]||0),Math.round(gscore[1]||0)],cry:cry?cry.cnt.slice():null,low:me.st&&typeof me.st.low==='number'?Math.round(me.st.low*1000)/1000:1};
 const out={v:1,n:PR.n,dt:PROOF_DT,h:PR.hdr,s:btoa(s),f:fin};
 PR=null;return out;
}
// every update of the sim feeds the record (game.js stays as it is)
(function(){const step=update;update=function(dt){step(dt);try{proofStep(dt);}catch(e){}};})();
// this phone, for spotting farms of accounts on one device: a random id kept on the device (not in Telegram's
// cloud storage, so two Telegram accounts on one phone share it) and a coarse device hash
function deviceId(){
 try{let d=localStorage.getItem('lwm_did');if(!/^[0-9a-f]{16}$/.test(d||'')){d=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('lwm_did',d);}return d;}catch(e){return '';}
}
function deviceHash(){
 let gpu='';try{const c=document.createElement('canvas'),g=c.getContext('webgl');const e=g&&g.getExtension('WEBGL_debug_renderer_info');gpu=e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'';}catch(e){}
 const s=[screen.width,screen.height,devicePixelRatio,navigator.language,(Intl.DateTimeFormat().resolvedOptions().timeZone||''),navigator.platform,navigator.hardwareConcurrency||0,navigator.deviceMemory||0,gpu].join('|');
 let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0).toString(16);
}
