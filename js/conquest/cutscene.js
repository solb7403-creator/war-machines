/* Session 7B: the in-engine cutscene system (owner, Nov 14 and Nov 23): always skippable from the first frame (SKIP, Escape, Enter or
   Space; a tap on SKIP), full length on a tier's first attempt and shorter after (ConquestCitadel.cutOf: the Worker counts the launches
   in s.cit.cs), with a simple stand-in reveal for each of Citadel tiers I-III. The fight waits while it plays: the world view's combat
   step does not run (view.cinematic), so no command is sent and the Worker's assault clock does not move. The camera turns toward the
   fortress and back; a caption card per shot. SCRIPTS is the named hook the Fable Citadel session after 5E-2d2 fills with the real
   reveals (shots: {ms, kicker, title, line, cam: {yaw offset, pitch, distance}}). Tiers IV-IX (Session 11) add their scripts here. */
(function(root){
'use strict';
const CI=()=>root.ConquestCitadel;
const shot=(ms,kicker,title,line,cam)=>Object.freeze({ms,kicker,title,line,cam:Object.freeze(cam||{})});
function scriptOf(tier){const C=CI(),T=C?.TIERS?.[tier];if(!T)return [];const R=C.ROMAN,W=T.warden,unit={swarm:'THE SWARM: quick biters that pour from the vents. Frostline freezes them.',mortar:'THE SPORE MORTAR: it shells marked ground. Bunkers stop the shells.',dropship:'THE DROPSHIP: each one that lands unloads a wave. Lancers shoot it down.'}[T.unit]||'';
 const mech={1:'Three gate generators hold the shield gate. Break them and the gate falls.',2:'Every marked zone is shelled. Move from bunker to bunker.',3:'Dropships cross the deck mid-fight. Shoot them down before they land.'}[tier]||T.mech;
 return Object.freeze([shot(4000,'THE CITADEL · ACT I · THE OUTER WORKS','CITADEL '+R[tier]+' · '+T.name,T.brief,{yaw:0,pitch:.55,distance:150}),
  shot(5000,'NEW TACTIC',T.mech.toUpperCase(),mech,{yaw:.6,pitch:.42,distance:110}),
  shot(4500,'NEW PARASITE',T.unitName,unit,{yaw:-.5,pitch:.5,distance:90}),
  shot(4500,'THE WARDEN',W.name+' '+'★'.repeat(W.stars),'It '+W.tell+'. Only your tank breaks its shield core.',{yaw:0,pitch:.35,distance:70})]);}
// the short version (every later attempt): the name card and the warden
const shortOf=tier=>{const s=scriptOf(tier);return s.length?Object.freeze([{...s[0],ms:2500},{...s[3],ms:2500}]):[];};
const SCRIPTS=Object.freeze({1:()=>scriptOf(1),2:()=>scriptOf(2),3:()=>scriptOf(3)});
// play(panel, view, tier, {full, el, button, done}) -> a handle {skip(), done: Promise}
function play(panel,view,tier,{full=true,el,button,done}={}){const shots=full?(SCRIPTS[tier]?.()||[]):shortOf(tier);if(!panel||!shots.length){done?.();return {skip(){},done:Promise.resolve()};}
 const mk=el||((tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;if(parent)parent.append(e);return e;});
 const d=mk('section','cq-cutscene',null,panel);d.setAttribute('role','dialog');d.setAttribute('aria-label','Citadel reveal');d.tabIndex=-1;
 const card=mk('div','cq-cut-card',null,d),k=mk('p','cq-kicker','',card),h=mk('h2','','',card),p=mk('p','cq-cut-line','',card),bar=mk('div','cq-cut-bar',null,d),fill=mk('i','',null,bar);
 const skipB=button?button('SKIP ▸',()=>end(),'cq-cut-skip'):(()=>{const b=mk('button','cq-cut-skip','SKIP ▸',d);b.type='button';b.onclick=()=>end();return b;})();if(skipB.parentNode!==d)d.append(skipB);
 d.dataset.shots=String(shots.length);const total=shots.reduce((a,x)=>a+x.ms,0),cam0=view?{yaw:view.yaw,pitch:view.pitch,distance:view.distance}:null,C=CI(),c0=C?.centre?.(),t0=performance.now();let i=-1,raf=0,over=false,resolve;
 const fort=view&&c0?Math.atan2(-(c0.x-view.p.x),-(c0.z-view.p.z)):0;if(view)view.cinematic=true;panel.classList.add('cq-cinematic');   // the HUD strip and radio tips wait under the reveal
 const key=e=>{if(['Escape','Enter',' ','Spacebar'].includes(e.key)){e.preventDefault();end();}};document.addEventListener('keydown',key,true);
 function frame(){if(over)return;const t=performance.now()-t0;let acc=0,j=0;while(j<shots.length-1&&t>=acc+shots[j].ms){acc+=shots[j].ms;j++;}
  if(j!==i){i=j;const S=shots[j];k.textContent=S.kicker;h.textContent=S.title;p.textContent=S.line;d.dataset.shot=String(j);}
  fill.style.width=Math.min(100,100*t/total)+'%';
  if(view){const S=shots[j],u=Math.min(1,(t-acc)/Math.max(1,S.ms)),ease=u*u*(3-2*u),prev=j?shots[j-1].cam:{yaw:0,pitch:cam0.pitch,distance:cam0.distance};
   view.yaw=fort+(prev.yaw??0)+((S.cam.yaw??0)-(prev.yaw??0))*ease;view.pitch=(prev.pitch??.5)+((S.cam.pitch??.5)-(prev.pitch??.5))*ease;view.distance=(prev.distance??60)+((S.cam.distance??60)-(prev.distance??60))*ease;}
  if(t>=total){end();return;}raf=requestAnimationFrame(frame);}
 function end(){if(over)return;over=true;cancelAnimationFrame(raf);document.removeEventListener('keydown',key,true);d.remove();panel.classList.remove('cq-cinematic');if(view){view.cinematic=false;if(cam0)Object.assign(view,cam0);}done?.();resolve?.();}
 const promise=new Promise(r=>{resolve=r;});try{skipB.focus({preventScroll:true});}catch(_){}frame();   /* the first shot's words and camera on the first paint (a slow phone never shows an empty card) */
 return {skip:end,done:promise,shots:shots.length,ms:total};}
root.ConquestCutscene=Object.freeze({SCRIPTS,scriptOf,shortOf,play});
})(globalThis);
