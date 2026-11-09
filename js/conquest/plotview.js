/* Your town (Session 5 base builder, 5B Town Defense, 5C Base UX + "your town in the world"). The pilot's private town as
   the HOME SECTOR: the live world around the tank (full scale, the site's terrain, every wall, turret, home, crew and rover),
   entered through the Command Gate. The pilot drives inside it (collision with walls, buildings and homes; gates open for
   the owner) and leaves through the town's own gate. BUILD MODE IS A CAMERA: the bottom sheet (drag it: CLOSED = drive,
   PEEK, HALF, FULL; js/conquest/sheet.js) lifts the camera to the overhead build view over the same scene. Five tabs: HOME
   (status card, coach, town look, visits), BUILD (economy and support buildings), WEAPONS (eleven turrets, gate, shield),
   WALLS (blend picker, LINE/RECT/RING/ERASE, Foundry, layouts) and DEFEND (Defense Drill, report, log, raid protection).
   Presentation only: every change is a Worker action (worker/src/conquest-plot.js) validated with the shared rules
   (js/conquest/plot.js); driving in your town is a private presentation (the shared-world position stays at your gate).
   Renders through the Conquest view's own renderer (one WebGL context, the shared style programs, the same light counts),
   drawn with js/conquest/townkit.js; the 2D setting gets a top-down canvas town with the same controls (no drive mode). */
(function(root){
'use strict';
const P=root.ConquestPlot;
const TK=()=>root.ConquestTownKit,CS=()=>root.ConquestSheet;
let X=null;   // the open town
const fmt=n=>typeof fmtNum==='function'?fmtNum(n):String(n);
const LABEL={cp:'CP',alloy:'ALLOY',biomass:'BIOMASS',helium:'HELIUM-3',cm:'COMPOSITE',fe:'FERRITE',il:'ILMENITE',ar:'ARMALCOLITE',tq:'TRANQ.',se:'SELENITE',mh:'MOONHEART'};
const price=c=>Object.entries(c||{}).filter(([,n])=>n>0).map(([k,n])=>fmt(n)+' '+LABEL[k]).join(' + ');
const dur=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return s<60?s+'s':s<3600?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';};
const GLYPH={cc:'◆',refinery:'⚙',storage:'▦',reactor:'⚡',foundry:'▤',biodome:'✿',hangar:'⌂',helium:'⛽',radar:'◎',shield:'⛨',lab:'⚗',uplink:'⇡',trophy:'♛',cannon:'●',mg:'⁞',laser:'✦',rocket:'⁂',missile:'➹',mortar:'◉',flame:'♨',siege:'■',tesla:'ϟ',lasercannon:'✷',railgun:'═',gate:'▯'};
const ORE_LOOK=[[0x8a8676,0x8fb4d0,.45],[0x7a4a2c,0xd8b48a,.5],[0x23262c,0x5fa8ff,.75],[0x55657e,0x22e6ff,1],[0x3a2420,0xff7a3d,1.1],[0xbab2e8,0xf6f0ff,1.5],[0x10141f,0x9fe8ff,2.2]];
const hex=n=>'#'+n.toString(16).padStart(6,'0');
const romanOf=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n]||String(n);
const ownerUI=()=>typeof isOwnerUI==='function'&&isOwnerUI();
const devOn=()=>!!X?.ctx.view.authority?.state?.dev?.on;
const hasWallet=k=>((typeof save!=='undefined'&&save.mn?.[k])||0)>0;
const reduced=()=>!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TABS=[['home','⌂','HOME'],['build','▦','BUILD'],['weapons','◎','WEAPONS'],['walls','▥','WALLS'],['defend','⛨','DEFEND']];
const multOf=cc=>(root.CQ_BASE_MULT||[1,1.05,1.1,1.15,1.2,1.25])[P.tierOf(cc)]||1;
const townName=p=>p?.name||((P.SITES[p?.site]?.name||'')+' TOWN');
function storesOf(s,p){const bm=(typeof save!=='undefined'&&save.bmn)||s?.airdrop?.view?.bmn||{},sp=p?.mnSpent||{},o={};for(const k of P.MNS)o[k]=Math.max(0,(bm[k]||0)-(sp[k]||0));return o;}
// The coach: one clear step at a time in plain words (owner: nothing overwhelming), the tab it points at, "step k of n".
function guideStep(p,s){if(!p)return null;const has=t=>Object.values(p.b).some(b=>b.t===t&&(b.l>0||p.job?.id&&p.b[p.job.id]===b)),walls=Object.values(p.w||{}),fe=(storesOf(s,p).fe||0)>0||hasWallet('fe');
 const steps=[['refinery','build',()=>has('refinery'),'BUILD A REFINERY: it turns rock and scrap from your town into alloy. Open BUILD.'],
  ['cannon','weapons',()=>P.TURRETS.some(has),'PLACE A CANNON: your first turret. Open WEAPONS.'],
  ['wall','walls',()=>walls.length>0,'BUILD YOUR FIRST WALL: open WALLS, pick RING and drag outward from your Command Center. You start with '+P.COMPOSITE.start+' composite, one per wall cell.'],
  ['reactor','build',()=>has('reactor'),'PLACE A VITAL: build a REACTOR inside your walls. VITAL: raiders hunt these; lose the Command Center and the raid wins.'],
  ...(fe?[['blend','walls',()=>walls.some(c=>P.wdecode(c).o>0),'YOUR FIRST BLEND: in WALLS pick FERRITE · LIGHT and draw over your wall. Ore makes walls stronger, tougher and reflective.']]:[]),
  ['drill','defend',()=>(p.log||[]).length>0,'RUN A DEFENSE DRILL: open DEFEND and watch raiders attack your whole town. Drills are practice: no rewards, no damage.'],
  ['cc','home',()=>p.cc>=2,'UPGRADE THE COMMAND CENTER TO CC2: tap it on the map. Your town grows and unlocks the Foundry, Biodome and Laser.']];
 const k=steps.findIndex(st=>!st[2]());if(k<0)return null;const st=steps[k];return {id:st[0],tab:st[1],text:st[3],k:k+1,n:steps.length};}
function unlockLine(p){const cc=p.cc,next=Object.entries(P.BUILDINGS).filter(([,B])=>B.cc===cc+1).map(([,B])=>B.n),ores=P.ORES.filter((m,o)=>P.ORE_CC[o+1]===cc+1).map(m=>P.ORE_NAME[m]+' blends');
 return cc>=P.CC.max?'COMMAND CENTER AT MAXIMUM':'NEXT AT CC'+(cc+1)+': town '+P.townSide(cc+1)+'×'+P.townSide(cc+1)+', '+P.wallBase(cc+1)+' walls, '+P.TURRET_CAP[cc]+' turrets'+([...next,...ores].length?', '+[...next,...ores].join(', '):'');}

// ------------------------------------------------------------------- scene ---------------------------------------------
// Firing effects by turret type: amber tracers, cyan beams, white-blue rails, violet arcs, flame cones, rocket/shell blasts.
const FX_OF={cannon:'tracer',mg:'tracer',laser:'beam',rocket:'blast',missile:'blast',mortar:'blast',flame:'flame',siege:'shell',tesla:'arc',lasercannon:'burst',railgun:'rail'};
const FX_LOOK={tracer:[0xffb347,.16,2.4],beam:[0x22e6ff,.12,2.6],rail:[0xd8f6ff,.18,3],arc:[0xb08cff,.1,3],flame:[0xff7a2d,.9,2.2],blast:[0xff5a2a,.3,2.6],shell:[0xffd36b,.34,2.8],burst:[0xff6ae0,.36,3]};
function scene3d(view){const S=view.style,T=view.T;if(!S||view.renderer.isConquestCanvas||!TK())return null;const k=TK().kit(S),town=new (TK().Scene)(S,k),sc=new T.Scene();sc.background=new T.Color(0x05070d);sc.fog=new T.Fog(0x06070f,320,1150);
 // The same light counts as the world scene (hemi + sun + rim): the style programs are shared, no new program variants.
 const lights=[new T.HemisphereLight(0x3a5a9c,0x16131f,1.5),new T.DirectionalLight(0xe4ecff,2.9),new T.DirectionalLight(0x52c6ff,1.25)];lights[1].position.set(200,400,150);lights[2].position.set(-300,200,-200);sc.add(...lights,town.root);
 const cam=new T.PerspectiveCamera(50,1,.5,2000);const g={holo:new T.Group(),fx:new T.Group(),actors:new T.Group(),portal:new T.Group()};for(const v of Object.values(g))sc.add(v);
 const im=(geo,n)=>{const m=new T.InstancedMesh(geo,S.MAT.solid,n);m.count=0;m.frustumCulled=false;m.visible=false;return m;};
 const crewN=S.low?8:16,crew=new T.InstancedMesh(k.person(),S.MAT.solid,crewN),rovers=new T.InstancedMesh(k.rover(),S.MAT.solid,S.low?2:4);crew.frustumCulled=rovers.frustumCulled=false;g.actors.add(crew,rovers);
 const foes={r:im(k.foe('r'),80),s:im(k.foe('s'),48),d:im(k.foe('d'),40),w:im(k.foe('w'),160),b:im(k.foe('b'),16)};for(const m of Object.values(foes))g.actors.add(m);
 const fx={};for(const [n,[col,w,em]] of Object.entries(FX_LOOK)){const b=new S.Bld();if(n==='flame')b.add(S.G.cone6,k.M(0,0,.5,Math.PI/2,0,0,.5,1,.5),new T.Color(col),em);else b.box(0,0,.5,w,w,1,new T.Color(col),em);fx[n]=im(b.geometry(),48);g.actors.add(fx[n]);}
 const puffs=TK().puffs?TK().puffs(S,S.low?24:48):null;if(puffs)g.fx.add(puffs.mesh);
 return {S,T,k,town,sc,cam,g,crew,rovers,foes,fx,puffs,lights,camPos:new T.Vector3(),camLook:new T.Vector3(),camInit:false};}

// ------------------------------------------------------------------- open / close --------------------------------------
// ctx: {view, panel, el, button, actions?, mode?: 'build' (ENTER BASE) | 'drive' (drove in through the gate)}
function open(ctx){if(X)return;const {view,panel,el,button}=ctx;const st=()=>view.authority?.state;
 panel.classList.add('cq-in-plot');const d=el('section','cq-dialog cq-plot',null,panel);d.setAttribute('role','dialog');d.setAttribute('aria-label','Your town');
 X={ctx,d,tab:'home',mode:'view',sel:null,place:null,draw:null,cam:{x:0,z:6,dist:110,tilt:.78,yaw:0},drill:null,clock:0,lastKey:'',busy:false,tool:'ring',blend:{o:0,l:0},draft:[],clip:null,pan:false,snap:'half',snapMem:{},sheetH:0,sheetTarget:0,drive:null};
 const top=el('div','cq-plot-top',null,d);X.top=top;const leave=button('‹',()=>close(),'cq-plot-leave');leave.setAttribute('aria-label','LEAVE BASE');top.append(leave);
 const title=el('div','cq-plot-title',null,top);X.title=el('b','cq-plot-name','',title);X.sub=el('small','cq-plot-subtitle','',title);X.chips=el('div','cq-plot-chips',null,top);
 d.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});   // the app-wide touchmove guard must not block the menu's native scroll (iPhone)
 X.stage=el('div','cq-plot-stage',null,d);X.msg=el('p','cq-plot-msg','',d);X.msg.setAttribute('aria-live','polite');
 const sh=el('div','cq-plot-sheet',null,d);X.sheet=sh;const grab=el('div','cq-sheet-grab',null,sh);el('i','',null,grab);grab.setAttribute('role','slider');grab.setAttribute('aria-label','Menu height: drag up or down');grab.tabIndex=0;X.grab=grab;
 X.tabsEl=el('div','cq-plot-tabs',null,sh);X.coach=el('p','cq-plot-coach','',sh);X.coach.setAttribute('role','status');X.body=el('div','cq-plot-body',null,sh);
 const s=st();if(!s?.base?.tier){sitePicker();return;}
 X.R=scene3d(view);if(!X.R){X.cv=el('canvas','cq-plot-canvas',null,X.stage);}else X.spr=TK().spriteJob(X.R.S,X.R.k,view.renderer);
 const p=s.plot;frameTown(p,true);X.portal=portalOf(p);
 input();sheetInput();driveHud();
 const drive=ctx.mode==='drive'&&!!X.R;X.snap=drive?'closed':CS().snapOf('home',X.snapMem);
 render();measureBar();snapTo(X.snap,true);(root.requestAnimationFrame||setTimeout)(()=>{if(!X)return;measureBar();snapTo(X.snap,true);});
 if(X.R)enterDrive(drive);}
function close(){if(!X)return;tankOut();X.ctx.panel.classList.remove('cq-in-plot');const R=X.R;if(R){R.town.dispose();R.sc.traverse(o=>{if(o.isMesh||o.isInstancedMesh){if(!o.geometry?.userData?.hfShared)o.geometry?.dispose?.();if(o.isInstancedMesh)o.dispose?.();}});X.spr?.dispose();}
 const after=X.onClose;X.d.remove();X=null;after?.();}
function isOpen(){return !!X;}
const say=t=>{if(X){X.msg.textContent=t;X.msgAt=Date.now();}};
async function act(action,plot,label){if(!X||X.busy)return false;X.busy=true;say(label||'SENDING ORDER…');try{const ok=await X.ctx.view.requestAction(action,plot===undefined?{}:{plot});say(ok?(label?label.replace('…',' ✓'):'DONE'):(X?.ctx.view.authority?.error||'Online verification required.').replace(/^conquest: /,'').toUpperCase());if(ok&&X){if(X.place)endAutoPeek();X.place=null;X.sel=action==='plot-remove'?null:X.sel;}render();return ok;}finally{if(X)X.busy=false;}}
// world actions at the gate (Daily Base Yield, BANK SALVAGE, REPAIR HULL): the old BASE TERMINAL, now on the HOME card
async function worldAct(action,label){if(!X||X.busy)return false;X.busy=true;say(label);try{const ok=await X.ctx.view.requestAction(action,{});say(ok?label.replace('…',' ✓'):(X?.ctx.view.authority?.error||'Online verification required.').replace(/^conquest: /,'').toUpperCase());render();return ok;}finally{if(X)X.busy=false;}}

// first build: pick one of seven sites, then claim the plot (the existing first-base recipe)
function sitePicker(){const {el,button,view}=X.ctx,s=view.authority?.state,D=root.ConquestCombat.baseDefinition,L=s?.ledger;X.title.textContent='CLAIM YOUR TOWN';X.sub.textContent='';X.d.classList.add('cq-plot-claim');X.stage.className='cq-plot-stage cq-plot-sites';X.sheet.hidden=true;
 el('p','cq-plot-intro','Your own private town. It grows with your Command Center (45×45 cells now, 77×77 at CC10). Pick its site: it shapes your economy and your whole defense. You can change it once for free.',X.stage);let pick='ridge';const cards=[];
 for(const id of P.SITE_IDS){const S=P.SITES[id],c=button('',()=>{pick=id;cards.forEach(x=>x.classList.toggle('on',x.dataset.site===id));},'cq-site-card');c.dataset.site=id;el('b','',S.name+' · '+S.lanes.length+' LANES',c);el('small','',S.bonus,c);if(id===pick)c.classList.add('on');cards.push(c);X.stage.append(c);}
 const foot=el('div','cq-plot-claimbar',null,X.d);const need=s?.dev?.on?'DEV MODE · UNLIMITED · the claim costs nothing':Object.entries(D.recipe).map(([k,n])=>Math.min(n,k==='cp'?L?.cp||0:L?.banked?.[k]||0)+'/'+n+' '+LABEL[k]).join(' · ');el('p','cq-plot-need',need+' · you start with '+P.COMPOSITE.start+' wall composite',foot);
 if(ownerUI()){const on=!!s?.dev?.on,box=el('div','cq-plot-dev',null,foot);el('b','',on?'DEV MODE · UNLIMITED RESOURCES':'DEV MODE · OFF',box);el('small','','Owner only. Turning it on makes this a test record: no Conquest airdrop points, no rankings.',box);box.append(button(on?'TURN OFF':'TURN ON UNLIMITED',async()=>{if(X.busy)return;X.busy=true;let ok=false;try{ok=await view.requestAction(on?'dev-off':'dev-on');}finally{if(X)X.busy=false;}if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx=X.ctx;close();open(ctx);},'cq-plot-primary'));}
 const claim=button('CLAIM PLOT · '+price(D.recipe),async()=>{if(X.busy)return;X.busy=true;try{const ok=await view.requestAction('build-base',{plot:{site:pick}});if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx={...X.ctx,mode:'build'};close();open(ctx);say('TOWN CLAIMED · '+P.SITES[pick].name);}finally{if(X)X.busy=false;}},'cq-plot-primary');foot.append(claim);}

// ------------------------------------------------------------------- the sheet ----------------------------------------
// One CSS variable (--cq-sheet-h) sizes the sheet; the map stage ends where the sheet begins, and the renderer's viewport,
// scissor and cellAt() read the stage's rect every frame, so taps land on the cell under the finger at every height.
function hostH(){const r=X.d.getBoundingClientRect(),t=X.top.getBoundingClientRect();return Math.max(200,r.height-t.height);}
function measureBar(){if(!X)return;X.barH=Math.round((X.grab.offsetHeight||24)+(X.tabsEl.offsetHeight||52)+2);X.d.style.setProperty('--cq-top-h',Math.round(X.top.offsetHeight||54)+'px');}
function snaps(){return CS().heights(hostH(),{bar:X.barH||70});}
function allowed(){const a=['peek','half','full'];if(X.R&&!X.place&&!X.draw&&!X.draft.length)a.unshift('closed');return a;}
function setSheet(h){X.sheetH=h;X.d.style.setProperty('--cq-sheet-h',Math.round(h)+'px');}
function snapTo(name,instant){if(!X)return;if(!allowed().includes(name))name=name==='closed'?'peek':name;const was=X.snap;X.snap=name;X.sheetTarget=snaps()[name];if(instant||reduced()||!X.sheetH)setSheet(X.sheetTarget);
 X.d.classList.toggle('cq-plot-drive',name==='closed');X.grab.setAttribute('aria-valuetext',name.toUpperCase());if(name!=='closed'&&!X.place)X.snapMem[X.tab]=name;if((was==='closed')!==(name==='closed'))X.glide=.8;}
function sheetStep(dt){if(!X||X.sheetTarget===undefined||X.dragging)return;if(Math.abs(X.sheetH-X.sheetTarget)<.5)return;const r=CS().approach(X.sheetH,X.sheetTarget,dt);setSheet(r.h);}
// placing a blueprint or drawing walls drops the sheet to PEEK; it comes back when the order is confirmed or cancelled
function autoPeek(){if(!X||X.autoFrom)return;if(X.snap==='peek'||X.snap==='closed')return;X.autoFrom=X.snap;snapTo('peek');}
function endAutoPeek(){if(!X?.autoFrom)return;const s=X.autoFrom;X.autoFrom=null;if(!X.place&&!X.draft.length)snapTo(s);}
function sheetInput(){const zones=[X.grab,X.tabsEl];let st=null;
 for(const z of zones){z.addEventListener('pointerdown',e=>{if(e.button>0)return;st={y:e.clientY,h:X.sheetH,samples:[{t:performance.now(),h:X.sheetH}],id:e.pointerId,z,moved:false};});}
 const move=e=>{if(!st||e.pointerId!==st.id)return;const dy=st.y-e.clientY;if(!st.moved&&Math.abs(dy)<7)return;if(!st.moved){st.moved=true;X.dragging=true;try{st.z.setPointerCapture(e.pointerId);}catch(_){}}
  const hs=snaps(),h=CS().drag(st.h+dy,hs,allowed().map(k=>k));setSheet(h);st.samples.push({t:performance.now(),h});if(st.samples.length>12)st.samples.shift();e.preventDefault?.();};
 const up=e=>{if(!st||e.pointerId!==st.id)return;const was=st;st=null;X.dragging=false;if(!was.moved)return;X.swallow=performance.now();const hs=snaps(),name=CS().settle(X.sheetH,CS().velocity(was.samples),hs,allowed());if(name==='closed')enterDrive(true);snapTo(name);if(name!=='closed'&&X.drive?.on)enterDrive(false);render();};
 X.sheet.addEventListener('pointermove',move);X.sheet.addEventListener('pointerup',up);X.sheet.addEventListener('pointercancel',up);
 X.sheet.addEventListener('click',e=>{if(X.swallow&&performance.now()-X.swallow<350&&X.tabsEl.contains(e.target)){e.stopPropagation();e.preventDefault();}},true);   // a drag that started on a tab is not a tap
 X.grab.addEventListener('keydown',e=>{const order=allowed(),i=order.indexOf(X.snap);if(e.key==='ArrowUp'&&i<order.length-1){snapTo(order[i+1]);if(X.drive?.on)enterDrive(false);render();}if(e.key==='ArrowDown'&&i>0){const n=order[i-1];if(n==='closed')enterDrive(true);snapTo(n);render();}});
 X.onResize=()=>{if(!X)return;measureBar();X.sheetTarget=snaps()[X.snap];setSheet(X.sheetTarget);};root.addEventListener('resize',X.onResize);const prev=X.onClose;X.onClose=()=>{root.removeEventListener('resize',X._rs);prev?.();};X._rs=X.onResize;}
function selectTab(tab){if(!X)return;if(X.tab===tab&&X.snap!=='closed'&&X.R){X.snapMem[tab]=X.snap;enterDrive(true);snapTo('closed');render();return;}   // tapping the open tab again: back to driving
 if(X.snap!=='closed'&&X.tab)X.snapMem[X.tab]=X.snap;X.tab=tab;X.mode=tab==='walls'?'walls':tab==='defend'?'drill':tab==='home'?'view':'build';X.place=null;X.draw=null;X.erase=null;X.autoFrom=null;
 if(X.drive?.on)enterDrive(false);snapTo(CS().snapOf(tab,X.snapMem));render();}

// ------------------------------------------------------------------- UI --------------------------------------------------
function header(s,p){const {el}=X.ctx;X.title.textContent=(X.visit?'VISITING · ':'')+townName(p).toUpperCase()+' · CC'+p.cc;const m=multOf(p.cc);X.sub.textContent=(X.visit?X.visit.base.n+' · ':'')+P.SITES[p.site].name+(m>1&&!X.visit?' · points ×'+m.toFixed(2):'');
 const use=P.powerUse(p),sup=P.powerSupply(p),def=X.visit?(X.visit.base.dr||P.defenseRating(p)):P.defenseRating(p);X.chips.replaceChildren();const a=el('span','cq-chip'+(use>sup?' cq-chip-bad':''),'⚡ '+use+'/'+sup,X.chips);a.title='Power used / supply';a.setAttribute('aria-label','Power '+use+' of '+sup+(use>sup?', short':''));const b=el('span','cq-chip','🛡 DEF '+fmt(def),X.chips);b.setAttribute('aria-label','Defense rating '+def);}
function render(){if(!X||X.d.classList.contains('cq-plot-claim'))return;const p=plotOf();if(!p)return;const {el,button,view}=X.ctx,s=view.authority.state,L=s.ledger,now=Date.now(),body=X.body;
 // keep what the pilot had open (closed sections, scroll) across a re-render; a designer in progress is only rebuilt by a state change
 const openNow=new Set([...body.querySelectorAll('details[open]>summary')].map(x=>x.textContent)),scroll=body.scrollTop;if(body.childNodes.length)X.openFolds=openNow;
 header(s,p);const g=X.visit?null:guideStep(p,s);X.guide=g;
 X.coach.replaceChildren();X.coach.hidden=!g||X.snap==='closed';if(g){el('span','cq-coach-step','STEP '+g.k+' OF '+g.n,X.coach);X.coach.append(document.createTextNode(' '+g.text));}
 X.tabsEl.replaceChildren();for(const [m,ic,lab] of TABS){const b=button('',()=>selectTab(m),'cq-plot-tab'+(X.tab===m&&X.snap!=='closed'?' on':'')+(g?.tab===m&&X.tab!==m?' cq-plot-glow':''));el('span','cq-tab-ico',ic,b);el('span','cq-tab-lab',lab,b);b.setAttribute('aria-pressed',String(X.tab===m&&X.snap!=='closed'));b.dataset.tab=m;if(X.visit&&m!=='home')b.disabled=true;X.tabsEl.append(b);}
 body.replaceChildren();devBar(body,s,p);
 if(X.visit)visitUi(body);
 else{const sel=X.sel&&p.b[X.sel];if(sel&&X.tab!=='walls')selCard(body,s,p,X.sel,sel);
  if(X.tab==='home')homeTab(body,s,p,L,now);else if(X.tab==='build')buildTab(body,s,p,'build');else if(X.tab==='weapons')buildTab(body,s,p,'weapons');else if(X.tab==='walls')wallTab(body,s,p);else drillTab(body,s,p);}
 for(const dd of body.querySelectorAll('details'))if(X.openFolds?.has(dd.querySelector('summary')?.textContent))dd.open=true;body.scrollTop=X.place&&!X.wasPlace?0:scroll;X.wasPlace=!!X.place;   // a new blueprint: CONFIRM BUILD at the top, on screen
 fab(s,p);X.d.classList.toggle('cq-plot-walls',X.tab==='walls');sync();}
// While drawing walls the map is big and the menu small: UNDO and CONFIRM float on the map so the primary action is always
// on screen (owner rule: primary actions stay on screen).
function fab(s,p){const {button}=X.ctx;if(!X.fab){X.fab=document.createElement('div');X.fab.className='cq-plot-fab';X.stage.append(X.fab);}const plan=X.tab==='walls'&&!X.visit?draftPlan(p):null;X.fab.replaceChildren();X.fab.hidden=!plan;if(!plan)return;
 const ok=button('CONFIRM WALLS · '+plan.cells.length,async()=>{if(await act('plot-wall',{s:X.draft.map(d=>d.sec)},'BUILDING WALLS…')&&X){X.draft=[];endAutoPeek();render();}},'cq-plot-primary');ok.disabled=!!plan.err;ok.title=plan.err||price(plan.cost);X.fab.append(button('↶ UNDO',()=>{X.draft.pop();if(!X.draft.length)endAutoPeek();render();}),ok);}
// Once a second: only the live numbers change (builder countdown, production, yield), never the open sections or a designer in progress.
function tickUi(){if(!X||X.visit)return;const s=X.ctx.view.authority?.state,p=s?.plot;if(!p)return;const now=Date.now(),j=p.job,box=X.body.querySelector('.cq-plot-job');
 if(j&&box){const b=box.querySelector('b'),pr=box.querySelector('progress'),B=j.t==='cc'?{n:'Command Center'}:j.t==='repair'?{n:'Repairs'}:P.BUILDINGS[j.t];if(b)b.textContent='BUILDER · '+B.n.toUpperCase()+' '+romanOf(j.l)+' · '+dur(j.ready-now);if(pr)pr.value=Math.max(0,Math.min(1,1-(j.ready-now)/Math.max(1,j.ready-j.at)));}
 const pe=X.body.querySelector('.cq-plot-prod span');if(pe)pe.textContent=prodText(p,now)||pe.textContent;
 const dr=[...X.body.querySelectorAll('.cq-plot-primary')].find(b=>/CREWS RESET/.test(b.textContent));if(dr){const w=Math.max(0,(p.drillAt||0)+60000-now);if(w>0)dr.textContent='CREWS RESET · '+dur(w);else render();}}
function prodText(p,now){const q={...p,st:{...(p.st||{})}},st=P.accrue(q,now),c=P.caps(p),r=P.rates(p);   // live preview of the Worker's accrual on a copy
 const parts=['alloy','biomass','helium','fe'].filter(k=>r[k]>0||st[k]>0).map(k=>Math.floor(st[k]||0)+'/'+c[k]+' '+LABEL[k]+' (+'+(Math.round(r[k]*100)/100)+'/h)');
 if(c.fh)parts.push('COMPOSITE '+Math.floor(q.cm||0)+'/'+c.cm+(q.fh>=.25?' (+'+r.cm+'/h from '+Math.floor(q.fh*10)/10+' alloy loaded)':' (load alloy in the Foundry, WALLS tab)'));return parts.join(' · ');}
// Owner dev mode (owner only, server-verified; conquest.js DEV_ACTIONS): unlimited resources, composite, ores, extensions, instant builds.
function devBar(body,s,p){if(!ownerUI()||X.visit)return;const {el,button}=X.ctx,on=!!s.dev?.on,box=el('div','cq-plot-dev'+(on?' on':''),null,body);
 el('b','',on?'DEV · UNLIMITED · INSTANT BUILDS':'DEV MODE · OFF',box);box.append(button(on?'TURN OFF':'TURN ON',()=>act(on?'dev-off':'dev-on',undefined,on?'DEV MODE OFF…':'UNLIMITED ON…')));
 if(!on)el('small','','Owner only: unlimited resources, composite, ores and wall extensions, instant builds. Makes this a test record (no Conquest airdrop points, never ranked).',box);
 else if(p.job)box.append(button('FINISH NOW',()=>act('dev-finish',undefined,'FINISHING…')));}
function resLine(el,parent,s,p){if(s.dev?.on){el('p','cq-plot-res cq-plot-dev-res','BANKED · ∞ UNLIMITED (DEV MODE) · COMPOSITE ∞ · ORES ∞',parent);return;}const L=s.ledger,o=storesOf(s,p),stores=P.MNS.filter(k=>o[k]>0).map(k=>o[k]+' '+LABEL[k]).join(' · ');
 el('p','cq-plot-res','BANKED · '+fmt(L.cp)+' CP · '+fmt(L.banked.alloy)+' ALLOY · '+fmt(L.banked.biomass)+' BIOMASS · '+fmt(L.banked.helium)+' HELIUM-3',parent);el('p','cq-plot-res','WALL COMPOSITE · '+fmt(Math.floor(p.cm||0))+' · BASE STORES · '+(stores||'empty (ore blends use minerals from here)'),parent);}
// A card picture: the 3D sprite once rendered (this session), the glyph until then (and on the 2D setting).
function spr(el,parent,kind,a,b2,cls){const box=el('span','cq-plot-ico'+(cls?' '+cls:''),null,parent),url=X.spr?.want(kind,a,b2);if(url){const im=document.createElement('img');im.src=url;im.alt='';im.className='cq-plot-spr';box.append(im);box.classList.add('cq-has-spr');}else box.textContent=kind==='w'?'▥':GLYPH[a]||'◆';box.dataset.spr=TK()?.spriteKey(kind,a,b2)||'';return box;}
// ---- HOME: one status card, the coach (in the sheet head), then closed sections ----
function homeTab(body,s,p,L,now){const {el,button}=X.ctx,card=el('div','cq-plot-status',null,body),head=el('div','cq-status-head',null,card);spr(el,head,'b','cc',Math.min(10,p.cc),'cq-status-spr');
 const ht=el('div','cq-status-title',null,head);el('b','',townName(p).toUpperCase()+' · CC'+p.cc+' · '+P.SITES[p.site].name,ht);el('small','','TOWN SCORE '+fmt(p.power||P.power(p))+(multOf(p.cc)>1?' · points ×'+multOf(p.cc).toFixed(2):'')+' · DEFENSE RATING '+fmt(P.defenseRating(p)),ht);
 const use=P.powerUse(p),sup=P.powerSupply(p),pw=el('div','cq-status-power'+(use>sup?' short':''),null,card);el('span','','⚡ POWER '+use+' / '+sup+(use>sup?' · SHORT: build a Reactor':''),pw);const m=el('meter','',null,pw);m.min=0;m.max=Math.max(1,sup);m.value=Math.min(use,Math.max(1,sup));m.setAttribute('aria-label','Power used of supply');
 const prod=el('div','cq-plot-prod',null,card);el('b','','PRODUCTION · stops when the store is full',prod);el('span','',prodText(p,now)||'Build a Refinery, Biodome or Helium Extractor to produce.',prod);
 const st=P.accrue({...p,st:{...(p.st||{})}},now);if(['alloy','biomass','helium','fe'].some(k=>(st[k]||0)>=1))prod.append(button('COLLECT PRODUCTION',()=>act('plot-collect',{},'COLLECTING…'),'cq-plot-primary'));
 const job=p.job;if(job){const B=job.t==='cc'?{n:'Command Center'}:job.t==='repair'?{n:'Repairs'}:P.BUILDINGS[job.t],left=job.ready-now,box=el('div','cq-plot-job',null,card);el('b','','BUILDER · '+B.n.toUpperCase()+' '+romanOf(job.l)+' · '+dur(left),box);const pr=el('progress','',null,box);pr.max=1;pr.value=Math.max(0,Math.min(1,1-left/Math.max(1,job.ready-job.at)));}
 else el('small','cq-status-free','BUILDER FREE · '+(X.sel?'':'tap a building on the map to upgrade it'),card);
 damageCard(card,s,p);
 // Daily Base Yield, BANK SALVAGE and REPAIR HULL (world actions at your gate)
 const A=X.ctx.actions?.(s)||null,row=el('div','cq-status-acts',null,card);if(A?.yield){const y=A.yield,yb=el('div','cq-yield',null,card);el('h3','cq-yield-head','DAILY BASE YIELD · '+y.pct+'%'+(y.fill>=1?' · FULL':''),yb);el('small','',y.line,yb);const bar=el('progress','cq-yield-bar',null,yb);bar.max=1;bar.value=Math.round(y.fill*1000)/1000;bar.setAttribute('aria-label','Daily Base Yield fill');card.insertBefore(yb,row);}
 const yb=button(A?.yield?'COLLECT DAILY YIELD · '+A.yield.pct+'%':'COLLECT DAILY YIELD',()=>worldAct('base-claim','COLLECTING YIELD…'),'cq-plot-primary');yb.disabled=!A?.yield?.ready;row.append(yb);
 const bk=button('BANK SALVAGE',()=>worldAct('bank','BANKING…'));bk.disabled=!A?.bank;if(!A?.bank)bk.title='Build a Storage Depot to bank salvage here';row.append(bk);row.append(button('REPAIR HULL',()=>worldAct('repair','REPAIRING HULL…')));
 if(!X.sel)el('p','cq-plot-hint','Tap a building to upgrade, move or inspect it. Drag the map to pan, pinch to zoom; ⌖ frames your town.',body);
 el('p','cq-plot-next',unlockLine(p),body);
 const look=el('details','cq-map-fold',null,body);el('summary','','TOWN LOOK · NAME, BANNER, LIGHTS, DECORATIONS, SHARE',look);look.ontoggle=()=>{if(look.open&&!look.dataset.built){look.dataset.built='1';designer(look,p,s);}};
 const vis=el('details','cq-map-fold',null,body);el('summary','','VISIT TOWNS · TOP 20, SQUAD, BASE OF THE WEEK',vis);vis.ontoggle=()=>{if(vis.open&&!vis.dataset.built){vis.dataset.built='1';visitList(vis);}};
 if(P.STORE.checkout){const shop=el('details','cq-map-fold',null,body);el('summary','','TOWN STORE · CAPACITY, COSMETICS AND TIME',shop);storeList(shop);}
 resLine(el,body,s,p);}
// Raid damage persists (owner addendum): what is damaged, and one REPAIR order (composite for walls, alloy/CP for buildings, builder time).
function damageCard(body,s,p){const plan=P.repairPlan(p);if(!plan.keys.length)return;const {el,button}=X.ctx,box=el('div','cq-plot-job cq-plot-damage',null,body),ruinedN=plan.keys.filter(k=>P.ruined(p,k)).length;
 el('b','','RAID DAMAGE · '+plan.keys.length+' STRUCTURES'+(ruinedN?' ('+ruinedN+' ruined: no output until repaired)':''),box);const b=button(p.job?'BUILDER BUSY':'REPAIR ALL · '+(devOn()?'FREE':price(plan.cost))+' · '+dur(plan.ms),()=>act('plot-repair',{},'REPAIRING…'),'cq-plot-primary');b.disabled=!!p.job;box.append(b);}
// Layout slots: save the town as it stands, switch back in one tap (buildings and walls move; nothing is rebuilt or charged).
function layoutFold(body,s,p){const {el,button}=X.ctx,f=el('details','cq-map-fold',null,body),stored=Object.values(p.ws||{}).reduce((a,n)=>a+(n|0),0);el('summary','','TOWN LAYOUTS · '+P.LAYOUT.slots+' SLOTS'+(stored?' · '+stored+' WALLS IN STORAGE':''),f);
 el('small','','Save walls, turrets and vitals positions; APPLY moves everything in one tap. Nothing is rebuilt or charged: walls move as a stock of cells by blend, and cells a layout has no room for wait in storage (place them again for free with the wall tools).'+(Object.keys(p.dmg||{}).length?' Repair your town before switching.':''),f);
 for(let k=0;k<P.LAYOUT.slots;k++){const L=p.lay?.['s'+k],row=el('div','cq-plot-row',null,f);el('small','',String.fromCharCode(65+k)+' · '+(L?'CC'+L.cc+', '+Math.floor((L.w||'').length/4)+' walls, saved '+new Date(L.at).toLocaleDateString():'empty'),row);
  row.append(button('SAVE '+String.fromCharCode(65+k),()=>act('plot-layout',{op:'save',k},'SAVING LAYOUT…')));const ap=button('APPLY '+String.fromCharCode(65+k),()=>act('plot-layout',{op:'apply',k},'SWITCHING LAYOUT…'),'cq-plot-primary');ap.disabled=!L;row.append(ap);}}
// Raid hooks shown now, used by player raids later: loot protection, peace shield, garrison slots, attack alerts.
function raidFold(body,s,p){const {el}=X.ctx,f=el('details','cq-map-fold',null,body),L=P.loot(p),sh=Math.max(0,(p.shieldUntil||0)-Date.now());el('summary','','RAID PROTECTION · DEFENSE RATING '+fmt(P.defenseRating(p)),f);
 el('small','','Player raids are coming. Banked goods are never raidable. Your Storage Depot protects '+Math.round(L.protect*100)+'% of the production store and composite; raidable now: '+(['alloy','biomass','helium','cm'].filter(k=>L.raidable[k]>0).map(k=>L.raidable[k]+' '+LABEL[k]).join(' · ')||'nothing')+'.',f);
 el('small','',(sh?'PEACE SHIELD · '+dur(sh)+' left (no new raids)':'PEACE SHIELD · none (a raided town gets a timed shield)')+' · GARRISON · '+(p.gar?.n||P.garrisonSlots(p))+' Hangar slots for defending tanks',f);
 const al=(p.alerts||[]).slice(0,3);if(al.length)el('small','','ALERTS · '+al.map(e=>new Date(e.at).toLocaleTimeString()+' '+String(e.kind).toUpperCase()+' by '+e.by+': '+String(e.outcome).toUpperCase()).join(' · '),f);}
// Foundry (composite), its research and the wall extensions: wall tooling, one closed section in WALLS.
function foundryFold(body,s,p){const {el,button}=X.ctx,c=P.caps(p),ex=P.extParts(p,devOn()),fd=el('details','cq-map-fold cq-plot-foundry',null,body);el('summary','','FOUNDRY · COMPOSITE '+fmt(Math.floor(p.cm||0))+' · WALL EXTENSIONS +'+ex.total+'%',fd);
 if(!c.fh){el('small','','Build a Foundry (unlocks at CC2): load alloy and it turns it into wall composite ('+P.COMPOSITE.perAlloy+' per alloy, '+P.COMPOSITE.rate+'/h per level).',fd);}
 else{const room=Math.max(0,Math.floor(c.fh-(p.fh||0)));el('small','','HOPPER · '+(Math.floor((p.fh||0)*10)/10)+'/'+c.fh+' alloy loaded → '+P.COMPOSITE.perAlloy+' composite each · STOCK '+Math.floor(p.cm||0)+'/'+c.cm,fd);
  const row=el('div','cq-plot-row',null,fd);for(const n of [10,30])row.append(button('LOAD '+n+' ALLOY',()=>act('plot-feed',{n},'LOADING THE FOUNDRY…')));row.append(button('LOAD ALL',()=>act('plot-feed',{n:Math.max(1,Math.min(room,Math.floor(s.ledger.banked.alloy||0)))},'LOADING THE FOUNDRY…')));for(const b of row.children)b.disabled=room<1;
  const k=p.ext?.r|0,step=P.EXT.research[k];if(step){const lock=P.levelOf(p,'foundry')<step.fl,b=button((lock?'LOCKED · FOUNDRY '+romanOf(step.fl)+' · ':'')+'RESEARCH REINFORCED LATTICE '+romanOf(k+1)+' · +'+step.pct+'% WALL CAPACITY · '+price(step.cost),()=>act('plot-research',{},'RESEARCHING…'),'cq-plot-primary');b.disabled=lock;fd.append(b);
   const short=!lock&&storesShort(s,p,step.cost);if(short)fd.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));}else el('small','','All Foundry research done.',fd);}
 el('small','','WALL EXTENSIONS (up to +'+P.EXT.max+'% of your level\'s base cap): research +'+ex.research+'% · drill milestones +'+ex.drill+'% · base defenses +'+ex.defense+'%'+(ex.bought?' · bought +'+ex.bought+'%':'')+(ex.dev?' · DEV +'+ex.dev+'%':'')+'. Hold a Defense Drill at CC'+P.EXT.drill.map(m=>m.cc).join('/')+' (+'+P.EXT.drill[0].pct+'% each); win 3 and 10 real base defenses (+5% each).',fd);}
function selCard(body,s,p,id,b){const {el,button}=X.ctx,isCC=b.t==='cc',B=isCC?{n:'Command Center',desc:'Gates every unlock and the town size'+(multOf(p.cc)>1?'; your Conquest points ×'+multOf(p.cc).toFixed(2):'')+'. A VITAL: if it falls, the raid wins.'}:P.BUILDINGS[b.t],l=isCC?p.cc:b.l,box=el('div','cq-plot-sel',null,body);
 const hd=el('div','cq-plot-card-head',null,box);spr(el,hd,'b',b.t,Math.max(1,l));el('b','',B.n.toUpperCase()+' '+(isCC?'CC'+l:romanOf(l))+(P.VITALS[b.t]?' · ◆ VITAL':''),hd);hd.append(button('✕',()=>{X.sel=null;render();},'cq-plot-x'));hd.lastChild.setAttribute('aria-label','Close');
 const hpL=P.hpLeft(p,id),hpM=P.maxHpOf(p,id);if(hpL<hpM)el('small','cq-plot-vital-lost',(hpL<=0?'RUINED · output cut until repaired':'DAMAGED')+' · '+fmt(hpL)+'/'+fmt(hpM)+' HP',box);el('small','',B.desc+(B.turret?' Range '+Math.round(B.turret.range*P.SITES[p.site].range*(1+.04*(l-1)))+' m.':'')+(B.prod?' Produces '+Object.entries(B.prod).map(([k,v])=>Math.round(v*Math.max(1,l)*100)/100+' '+LABEL[k]+'/h').join(', ')+'.':''),box);
 if(X.visit)return;const nl=l+1,err=P.buildCheck(p,isCC?'cc':b.t,nl,isCC?null:id),cost=nl<=(isCC?P.CC.max:B.max)?P.costOf(isCC?'cc':b.t,nl):null;
 if(cost){const up=button((err?'LOCKED · '+err.toUpperCase():'UPGRADE TO '+(isCC?'CC'+nl:romanOf(nl))+' · '+(devOn()?'FREE · INSTANT':price(cost)+' · '+dur(P.timeOf(isCC?'cc':b.t,nl)))),()=>act('plot-upgrade',{id},'UPGRADING…'),'cq-plot-primary');up.disabled=!!err||!!p.job;box.append(up);if(isCC&&!err)el('small','','CC'+nl+': the town grows to '+P.townSide(nl)+'×'+P.townSide(nl)+' cells, '+P.wallBase(nl)+' walls, '+P.TURRET_CAP[nl-1]+' turrets.',box);const short=!err&&storesShort(s,p,cost);if(short)box.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));}else el('small','','MAXIMUM LEVEL',box);
 const row=el('div','cq-plot-row',null,box);row.append(button('MOVE / ROTATE',()=>{X.tab=B.turret||['gate','shield'].includes(b.t)?'weapons':isCC?'home':'build';X.mode='build';X.place={type:b.t,id,i:b.i,j:b.j,r:b.r|0};autoPeek();render();}));
 if(!['cc','storage'].includes(b.t)){const rm=button(B.turret?'REMOVE (50% OF ITS COST BACK)':'REMOVE (no refund)',()=>{if(rm.dataset.sure){act('plot-remove',{id},'REMOVING…');}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE';}},'cq-plot-danger');row.append(rm);}}
const ROLE={vault:'STORES',hangar:'REPAIRS HULL',radar:'LONGER SCAN',defense:'LESS DAMAGE',uplink:'+YIELD CP'};
function roleOf(k,B){if(B.turret){const t=B.turret;return B.role+' · '+t.range+' m';}if(B.power)return '+'+B.power+' ⚡ POWER';if(B.prod)return Object.entries(B.prod).map(([r,v])=>'+'+v+' '+(LABEL[r]||r).toUpperCase()+'/H').join(' ');if(k==='foundry')return 'COMPOSITE';if(k==='lab')return 'RESEARCH';if(k==='trophy')return 'TROPHIES';if(B.gate)return 'OPENS FOR YOU';return ROLE[B.mod]||'';}
// damage class in words (no hidden numbers): steady damage per second, with area, chains, lines and burns counted in
function dpsWord(B){const t=B.turret;if(!t)return '';let d=t.dmg*(t.salvo||1)/t.rof;if(t.splash)d*=1.8;if(t.chain)d*=2.4;if(t.line)d*=1.8;if(t.burn)d*=1.5;return d<30?'LIGHT DAMAGE':d<50?'MEDIUM DAMAGE':d<70?'HEAVY DAMAGE':'EXTREME DAMAGE';}
const WEAPON_KEYS=()=>[...P.TURRETS,'gate','shield'];
const BUILD_KEYS=()=>Object.keys(P.BUILDINGS).filter(k=>!P.BUILDINGS[k].turret&&k!=='gate'&&k!=='shield');
function buildTab(body,s,p,which){const {el,button}=X.ctx;if(X.place){placeCard(body,s,p);return;}
 const g=X.guide,dev=devOn(),keys=which==='weapons'?WEAPON_KEYS():BUILD_KEYS(),tcap=P.TURRET_CAP[p.cc-1],tcount=P.turretCount(p);
 if(which==='weapons'){// placed-turret summary: counts by type and the shared cap
  const sum=el('div','cq-plot-wsum',null,body);el('b','','TURRETS '+tcount+' / '+tcap,sum);const by={};for(const b of Object.values(p.b))if(P.BUILDINGS[b.t]?.turret)by[b.t]=(by[b.t]||0)+1;
  const chips=el('div','cq-plot-wchips',null,sum);for(const [t,n] of Object.entries(by))el('span','cq-chip',(GLYPH[t]||'')+' '+n+' '+P.BUILDINGS[t].n.replace(/ Turret$/,'').toUpperCase(),chips);if(!tcount)el('small','','No turrets yet: place a Cannon first.',sum);}
 else el('p','cq-plot-res','⚡ '+P.powerUse(p)+'/'+P.powerSupply(p)+' POWER · economy and support buildings',body);
 const sorted=keys.map(k=>[k,P.BUILDINGS[k]]).sort((a,b)=>(a[1].cc>p.cc)-(b[1].cc>p.cc)||a[1].cc-b[1].cc),box=el('div','cq-plot-list',null,body);
 for(const [k,B] of sorted){const locked=B.cc>p.cc,err=locked?null:P.buildCheck(p,k,1),n=P.countOf(p,k),cap=B.turret?null:P.countCap(k,p.cc),c=button('',()=>{if(locked)return;const at=P.autoPlace(p,k)||{i:37,j:37,r:0};X.place={type:k,...at};X.cam.x=P.cellX(at.i);X.cam.z=P.cellZ(at.j);autoPeek();render();},'cq-plot-card'+(locked?' cq-plot-locked':'')+(g&&(g.id===k)?' cq-plot-glow':''));c.dataset.type=k;
  const head=el('span','cq-plot-card-head',null,c);spr(el,head,'b',k,1);el('b','',B.n,head);el('span','cq-plot-tag',(B.vital?'◆ VITAL · ':'')+roleOf(k,B),head);
  el('small','cq-plot-desc',(B.turret?dpsWord(B)+' · ':'')+(B.desc||''),c);
  el('small','cq-plot-cost',locked?'🔒 UNLOCKS AT CC'+B.cc:(err?'✕ '+err.toUpperCase():dev?'FREE · INSTANT':price(B.cost[0])+' · '+dur(P.timeOf(k,1)))+' · '+(B.turret?n+' PLACED · TURRETS '+tcount+'/'+tcap:n+'/'+cap+' PLACED')+' · SIZE '+B.w+'×'+B.d+(B.pw?' · USES ⚡'+B.pw:''),c);
  c.disabled=locked||!!err;if(locked)c.setAttribute('aria-disabled','true');box.append(c);}
 el('p','cq-plot-next',unlockLine(p),body);}
function placeCard(body,s,p){const {el,button}=X.ctx,q=X.place,B=q.type==='cc'?{n:'Command Center'}:P.BUILDINGS[q.type],err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):(P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r));
 // the primary action first, so it stays on screen at PEEK (owner rule: every screen fits or scrolls)
 const row=el('div','cq-plot-row',null,body);row.append(button('↻ ROTATE',()=>{q.r=(q.r+1)%4;render();}),button('CANCEL',()=>{X.place=null;endAutoPeek();render();}));const ok=button(q.id?'CONFIRM MOVE':'CONFIRM BUILD',()=>q.id?act('plot-move',{id:q.id,i:q.i,j:q.j,r:q.r},'MOVING…'):act('plot-build',{type:q.type,i:q.i,j:q.j,r:q.r},'CONSTRUCTION ORDERED…'),'cq-plot-primary');ok.disabled=!!err||(!q.id&&!!p.job);row.append(ok);
 el('b','',(q.id?'MOVE · ':'PLACE · ')+B.n.toUpperCase()+(P.VITALS[q.type]?' · ◆ VITAL':''),body);el('small','',err?'✕ '+err.toUpperCase():'✓ VALID · tap the ground to move the blueprint'+(q.id?'':' · '+(devOn()?'FREE · INSTANT':price(P.costOf(q.type,1))+' · '+dur(P.timeOf(q.type,1)))),body);
 if(P.VITALS[q.type])el('small','','VITAL: raiders hunt these. Spread them out for coverage, or cluster them behind your strongest walls.',body);}
// ---- WALLS: blend picker first, tools, draft and confirm, live stats, then the Foundry and layouts ----
const ORE_LINES=['Composite\n(no ore)','Ferrite','Ilmenite','Armal-\ncolite','Tranquil-\nlityite','Selenite\nGlass','Moon-\nheart'];
const TOOLS=[['line','LINE','drag: a solid straight wall'],['rect','RECT','drag corner to corner: a rectangle'],['ring','RING','drag from the centre outward: a ring'],['erase','ERASE','drag over walls to remove them']];
const MORE_TOOLS=[['copy','COPY','drag a box over walls to copy them'],['paste','PASTE','tap to paste the copied walls']];
function draftPlan(p){return X.draft.length?P.wallPlan(p,X.draft.map(d=>d.sec),{dev:devOn()}):null;}
function wallTab(body,s,p){const {el,button}=X.ctx,dev=devOn(),cap=P.wallCapOf(p,dev),base=P.wallBase(p.cc),n=Object.keys(p.w).length,plan=draftPlan(p);
 const stor=Object.values(P.stockOf(p)).reduce((a,v)=>a+v,0);el('b','cq-plot-wallcount','WALLS '+n+(stor?' (+'+stor+' STORED)':'')+(plan?.fresh?' + '+plan.fresh:'')+' / '+base+(cap>base?' (+EXT '+(cap-base)+')':'')+' · COMPOSITE '+(dev?'∞':fmt(Math.floor(p.cm||0))),body);
 // the draft and its CONFIRM come first when there is one (primary action on screen; it also floats on the map)
 if(plan){const sk=plan.skip,skipped=sk.outside+sk.blocked+sk.occupied+sk.same,box=el('div','cq-plot-draft',null,body);
  el('b','',X.draft.length+' SECTION'+(X.draft.length>1?'S':'')+' · '+plan.cells.length+' CELLS'+(skipped?' ('+skipped+' skipped: '+[sk.same&&sk.same+' same',sk.occupied&&sk.occupied+' buildings',sk.blocked&&sk.blocked+' blocked',sk.outside&&sk.outside+' outside'].filter(Boolean).join(', ')+')':''),box);
  el('small','',plan.err?'✕ '+plan.err.toUpperCase():'COST · '+(dev?'FREE (DEV MODE)':price(plan.cost)||'nothing'),box);
  const r=el('div','cq-plot-row',null,box);r.append(button('↶ UNDO',()=>{X.draft.pop();if(!X.draft.length)endAutoPeek();render();}),button('CLEAR',()=>{X.draft=[];endAutoPeek();render();}));const ok=button('CONFIRM WALLS',async()=>{if(await act('plot-wall',{s:X.draft.map(d=>d.sec)},'BUILDING WALLS…')&&X){X.draft=[];endAutoPeek();render();}},'cq-plot-primary');ok.disabled=!!plan.err;r.append(ok);
  const short=!plan.err&&storesShort(s,p,plan.cost);if(short)box.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));
  if(!dev&&(plan.cost.cm||0)>Math.floor(p.cm||0))el('small','','Not enough composite: load alloy in the FOUNDRY below.',box);}
 if(X.tool!=='erase'&&X.tool!=='copy'){// the blend picker: big swatches with the ore's full name, level, live stats
  const st=storesOf(s,p),bp=el('div','cq-plot-blend',null,body),ores=el('div','cq-plot-ores',null,bp);
  for(let o=0;o<=6;o++){const m=P.ORES[o-1],lock=p.cc<P.ORE_CC[o],look=ORE_LOOK[o],name=o?P.ORE_NAME[m]:'Composite',b=button('',()=>{X.blend={o,l:o?(X.blend.l||1):0};render();},'cq-plot-ore'+(X.blend.o===o?' on':''));b.style.setProperty('--ore',hex(look[0]));b.style.setProperty('--acc',hex(look[1]));
   const sw=el('i','',null,b);const u=X.spr?.want('w',P.wcode(o,o?2:0));if(u){const im=document.createElement('img');im.src=u;im.alt='';sw.append(im);sw.classList.add('cq-has-spr');}
   el('span','cq-ore-name',ORE_LINES[o]||name,b);el('small','',lock?'🔒 CC'+P.ORE_CC[o]:o?(dev?'∞':st[m]+' in stores'):(dev?'∞':Math.floor(p.cm||0)+' cells'),b);b.disabled=lock;b.setAttribute('aria-label',(o?P.ORE_NAME[m]:'Composite only')+(lock?' (unlocks at CC'+P.ORE_CC[o]+')':''));b.setAttribute('aria-pressed',String(X.blend.o===o));ores.append(b);}
  if(X.blend.o){const lv=el('div','cq-plot-row cq-plot-levels',null,bp);for(let l=1;l<=3;l++){const b=button(P.BLEND_NAME[l],()=>{X.blend.l=l;render();},X.blend.l===l?'on':'');b.setAttribute('aria-pressed',String(X.blend.l===l));lv.append(b);}}}
 const tr=el('div','cq-plot-row cq-plot-tools',null,body);for(const [id,lab,tip] of TOOLS){const b=button(lab,()=>{X.tool=id;X.draw=null;X.erase=null;render();},X.tool===id?'on':'');b.title=tip;b.setAttribute('aria-pressed',String(X.tool===id));tr.append(b);}
 const more=el('details','cq-map-fold cq-plot-more',null,body);el('summary','','MORE · COPY / PASTE',more);const mr=el('div','cq-plot-row cq-plot-tools',null,more);for(const [id,lab,tip] of MORE_TOOLS){const b=button(lab,()=>{X.tool=id;X.draw=null;X.erase=null;render();},X.tool===id?'on':'');b.title=tip;if(id==='paste')b.disabled=!X.clip;mr.append(b);}if(['copy','paste'].includes(X.tool))more.open=true;
 el('small','cq-plot-tooltip',([...TOOLS,...MORE_TOOLS].find(t=>t[0]===X.tool)||TOOLS[0])[2].toUpperCase()+' · two fingers (or ✥) pan the map',body);
 if(!plan&&X.tool!=='erase'&&X.tool!=='copy')el('p','cq-plot-hint','Draw on the map: sections collect here, UNDO takes the last one back, CONFIRM builds them all at once.',body);
 if(X.tool!=='erase'&&X.tool!=='copy'){const code=P.wcode(X.blend.o,X.blend.l),w=P.wallStats(code,p.site),bars=el('div','cq-plot-stats',null,body),best=P.wallStats(19,p.site);
  for(const [lab,v,mx,txt] of [['STRENGTH',w.hp,best.hp,fmt(w.hp)+' HP'],['DURABILITY',w.dr,.4,Math.round(w.dr*100)+'% less damage'],['REFLECT',w.refl,.35,Math.round(w.refl*100)+'% bounced back']]){const r=el('div','cq-plot-stat',null,bars);el('span','',lab,r);const m=el('meter','',null,r);m.min=0;m.max=mx;m.value=v;el('small','',txt,r);}
  const per=X.blend.o?P.ORE_UNITS[X.blend.o]*P.BLEND_UNITS[X.blend.l]/40:0;el('small','',P.blendName(code).toUpperCase()+' · a cell: 1 composite'+(per?' + '+(per>=1?per:'1 per '+Math.round(1/per)+' cells of')+' '+P.ORE_NAME[P.ORES[X.blend.o-1]]:'')+(X.blend.o>=3?' · rare ores are earn-only':''),body);}
 if(X.tool==='erase'&&X.erase){const m=X.erase;el('b','',m.keys.length+' WALL CELLS SELECTED · '+P.wallRefund(m.keys.length)+' composite comes back (50%; the ore does not)',body);const r=el('div','cq-plot-row',null,body);r.append(button('CANCEL',()=>{X.erase=null;render();}));const rm=button('REMOVE '+m.keys.length+' WALLS',()=>{if(rm.dataset.sure){act('plot-remove',{w:[m.sec]},'REMOVING WALLS…').then(ok=>{if(ok&&X)X.erase=null;});}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE '+m.keys.length;}},'cq-plot-danger');r.append(rm);}
 if(X.tool==='copy'||X.tool==='paste')el('small','',X.clip?'COPIED '+X.clip.cells.length+' wall cells. PASTE, then tap where the top-left corner goes.':'COPY: drag a box over walls you built.',body);
 foundryFold(body,s,p);layoutFold(body,s,p);}
function storesShort(s,p,cost){if(s?.dev?.on)return null;const o2=storesOf(s,p),o={};for(const k of P.MNS)if(cost[k]&&o2[k]<cost[k])o[k]=cost[k]-o2[k];return Object.keys(o).length?o:null;}
async function moveStores(mn){if(typeof baseStore!=='function'){say('UPDATE THE GAME TO MOVE MINERALS');return;}say('MOVING MINERALS FROM YOUR WALLET…');const ok=await baseStore(mn);say(ok?'MINERALS IN BASE STORES':'NOT MOVED');render();}
// ---- DEFEND: the drill, its report and tips, the base log, raid protection ----
function drillTab(body,s,p){const {el,button}=X.ctx;
 const wait=Math.max(0,(p.drillAt||0)+60000-Date.now()),b=button(X.drill?'DRILL RUNNING…':wait?'CREWS RESET · '+dur(wait):'START DEFENSE DRILL',async()=>{if(await act('plot-drill',{},'DRILL CREWS DEPLOYING…'))startReplay();},'cq-plot-primary');b.disabled=!!X.drill||!!X.simulating||wait>0;body.append(b);
 el('p','cq-plot-hint','Practice raid on your whole town at threat '+p.cc+' ('+P.SITES[p.site].lanes.length+' lanes). Raiders head for your Command Center through the weakest wall and hit everything on the way; the raid wins if the Command Center falls. Drills pay no rewards and leave no damage. Watch from your tank (drag the menu down) or from above.',body);
 if(X.drillResult){const r=X.drillResult,name=t=>t==='cc'?'Command Center':P.BUILDINGS[t]?.n||t,box=el('div','cq-plot-report',null,body);
  const L=r.log&&r.log.seed===r.seed?r.log:null,same=!L||L.outcome===r.outcome&&L.kills===r.kills,o=L?L.outcome:r.outcome;   // the Worker's log is the result; the phone's replay is the picture
  el('b','cq-plot-result '+o,(o==='breached'?'COMMAND CENTER FELL · RAID WON':o==='repelled'?'REPELLED':'HELD')+' · '+(L?L.kills:r.kills)+'/'+(L?L.spawned:r.spawned)+' RAIDERS DOWN · COMMAND CENTER '+(L?L.core:r.core)+'%',box);
  const vit=L?(L.vitals||[]):r.vitals,br=L?L.breaches|0:r.breaches.length;el('small','','BREACHES · '+(br?br+' ('+(L?L.walls|0:r.wallsLost)+' wall cells lost; red rings on the map)':'none')+' · HOMES LOST '+(L?L.homes|0:r.homesLost)+(same&&r.power<100?' · POWER '+r.power+'%':''),box);
  if(vit.length)el('small','cq-plot-vital-lost','◆ VITALS LOST · '+vit.map(t=>name(t)+': '+(P.VITAL_EFFECT[t]||'')).join(' · '),box);
  if(same&&r.fell.length)el('small','','FELL · '+r.fell.map(f=>name(f.t)).join(', '),box);
  const e=p.log?.[0];if(e?.ext)el('small','cq-plot-next','MILESTONE · +'+e.ext+'% WALL CAPACITY EARNED',box);}
 el('small','cq-plot-tips','TIPS · raiders gather at the red chevrons outside your town edge. Wall across them, blend the walls they hit first, keep turrets covering the breach points and your vitals behind walls.',body);
 const log=el('details','cq-map-fold',null,body);el('summary','','BASE LOG · '+(p.log||[]).length+' DRILLS',log);for(const e of p.log||[])el('p','',new Date(e.at).toLocaleString()+' · '+e.outcome.toUpperCase()+' · '+e.kills+'/'+e.spawned+' · '+(e.breaches|0)+' breaches · '+e.lost+' lost · CC '+e.core+'%',log);
 raidFold(body,s,p);}

// ------------------------------------------------------------------- scene sync / frame -------------------------------
const fromSnap=v=>({site:v.site,cc:v.cc|0,power:v.pw|0,name:v.tn||'',b:Object.fromEntries(Object.entries(v.b||{}).map(([id,a])=>[id,{t:a[0],i:a[1],j:a[2],r:a[3],l:a[4]}])),w:v.w||{},banner:v.bn||null,theme:v.th||null,log:[],st:{}});
const plotOf=()=>X?.visit?X.visit.plot:X?.ctx.view.authority?.state?.plot;
function sync(){const R=X?.R,p=plotOf();if(!p)return;if(!R){draw2d();return;}R.town.sync(p);
 if(X.portalKey!==p.site+':'+p.cc+':'+!!X.visit){X.portalKey=p.site+':'+p.cc+':'+!!X.visit;X.portal=portalOf(p);portalMesh();}
 X.solid=null;if(X.drill)for(const id of X.drill.gone)R.town.hide(id,p);holo();}
// hologram blueprint, the wall tool preview, the draft, erase/copy selections, the selected building, breach markers, and a
// 13x13 blueprint grid around the blueprint or the drawing finger (fading out; never the whole town)
function holoMesh(R,cellsList,ok,ring,site){const {S}=R,X2=new S.Fx(),c=P.GRID.cell,reg=S.AT.SOLID||S.AT.BLOB,cols=Array.isArray(ok)?ok:null;
 cellsList.forEach(([i,j],n)=>{const x=P.cellX(i),z=P.cellZ(j),y=(site?P.groundY(site,i,j):0)+.2,good=cols?cols[n]:ok,col=good===2?[1,.75,.2]:good?[.1,.9,.45]:[1,.18,.22];X2.flat(x,y,z,c*.47,c*.47,reg,col.map(v=>v*.35),0);for(const [dx,dz,w,d] of [[0,-c/2,c/2,.06],[0,c/2,c/2,.06],[-c/2,0,.06,c/2],[c/2,0,.06,c/2]])X2.flat(x+dx,y+.04,z+dz,w,d,reg,col,0);});
 if(ring)X2.ringGlow(ring.x,ring.z,.6+(ring.y||0),ring.r,.5,ring.col||(ok?[.1,.75,1]:[1,.3,.3]),64);return X2.mesh();}
function localGrid(R,p,ci,cj){const {S}=R,X2=new S.Fx(),c=P.GRID.cell,reg=S.AT.SOLID||S.AT.BLOB,R2=6.5;
 for(let a=-6;a<=7;a++){const f=Math.max(0,1-Math.abs(a-.5)/7.5),col=[.05*f,.45*f,.6*f];for(const [vert] of [[true],[false]]){for(let b=-6;b<=6;b++){const fi=Math.max(0,1-Math.hypot(a-.5,b)/R2)*.9;if(fi<=.02)continue;const i=vert?ci+a:ci+b,j=vert?cj+b:cj+a;if(!P.inGrid(i,j))continue;
   const x=vert?P.cellX(ci+a)-c/2:P.cellX(i),z=vert?P.cellZ(j):P.cellZ(cj+a)-c/2,y=P.groundY(p.site,Math.min(78,Math.max(0,i)),Math.min(78,Math.max(0,j)))+.16;X2.flat(x,y,z,vert?.05:c/2,vert?c/2:.05,reg,col.map(v=>v*fi*1.4),0);}}}
 for(let a=-6;a<=6;a++)for(let b=-6;b<=6;b++){const i=ci+a,j=cj+b;if(!P.inGrid(i,j)||Math.hypot(a,b)>R2)continue;if(P.NOBUILD[P.terrainAt(p.site,i,j)]||!P.inTown(p.cc,i,j))X2.flat(P.cellX(i),P.groundY(p.site,i,j)+.15,P.cellZ(j),c*.36,c*.36,reg,[.28,.03,.06].map(v=>v*(1-Math.hypot(a,b)/R2)),0);}
 return X2.mesh();}
function holo(){const R=X?.R,p=plotOf();if(!R||!p)return;const g=R.g;R.town.wipe(g.holo);
 if(X.place){const q=X.place,err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r),B=P.BUILDINGS[q.type],cl=P.cells({t:q.type,i:q.i,j:q.j,r:q.r}),s2=P.sizeOf(q.type,q.r);
  const ring=B?.turret?{x:P.cellX(q.i),z:P.cellZ(q.j),y:P.groundY(p.site,q.i,q.j),r:B.turret.range*P.SITES[p.site].range}:null;g.holo.add(localGrid(R,p,q.i+Math.floor(s2.w/2),q.j+Math.floor(s2.d/2)),holoMesh(R,cl,!err,ring,p.site));}
 if(X.tab==='walls'){const dcells=[];for(const d of X.draft)for(const c of P.shapeCells(d.sec)||[])dcells.push(c);if(dcells.length)g.holo.add(holoMesh(R,dcells,2,null,p.site));
  if(X.draw?.cells?.length){g.holo.add(holoMesh(R,X.draw.cells,X.draw.ok,null,p.site));const f=X.draw.b||X.draw.a;g.holo.add(localGrid(R,p,f[0],f[1]));}if(X.erase)g.holo.add(holoMesh(R,X.erase.keys.map(k=>k.split(',').map(Number)),false,null,p.site));}
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=P.BUILDINGS[b.t];g.holo.add(holoMesh(R,P.cells(b),true,B?.turret?{x:P.cellX(b.i),z:P.cellZ(b.j),y:P.groundY(p.site,b.i,b.j),r:B.turret.range*P.SITES[p.site].range*(1+.04*(b.l-1))}:null,p.site));}
 if(X.tab==='defend'&&X.drillResult&&!X.drill){for(const [i,j,n] of X.drillResult.breaches)g.holo.add(holoMesh(R,[[i,j]],false,{x:P.cellX(i),z:P.cellZ(j),y:P.groundY(p.site,i,j)+1,r:9+Math.min(12,2*n),col:[1.4,.2,.25]},p.site));}}
// The default build camera: a 3/4 view framed on the Command Center (CC1 ~95 m, CC10 ~120 m, tilt ~0.78).
function frameTown(p,keepYaw){if(!p)return;const c=p.b?.cc,h=P.townH(p.cc);X.cam={x:c?P.cellX(c.i)+6:0,z:c?P.cellZ(c.j)+6:6,dist:Math.round(95+(h-22)/16*25),tilt:.78,yaw:keepYaw&&X.cam?X.cam.yaw:0};}
function frame(dt){if(!X)return;X.clock+=dt;const s=X.ctx.view.authority?.state;if(s?.plot&&!X.visit&&(s!==X.lastState||Date.now()-(X.lastUi||0)>1000)){X.lastState=s;const key=JSON.stringify([s.plot.b,s.plot.job,s.plot.cc,s.plot.site,s.plot.banner,s.plot.theme,s.plot.name,Object.keys(s.plot.w).length,s.plot.cm|0,s.plot.fh,s.plot.ext,s.plot.st&&Math.floor((s.plot.st.alloy||0)+(s.plot.st.biomass||0)),s.ledger?.cp,(s.plot.log||[]).length,s.dev?.on,Object.keys(s.plot.dmg||{}).length]);if(key!==X.lastKey){X.lastKey=key;X.lastUi=Date.now();if(!X.d.classList.contains('cq-plot-claim'))render();}else if(Date.now()-(X.lastUi||0)>1000){X.lastUi=Date.now();tickUi();}}
 if(X.msgAt&&Date.now()-X.msgAt>5000){X.msg.textContent='';X.msgAt=0;}
 sheetStep(dt);
 // The world waits while you build: when the builder's time is up, re-open the session (the Worker settles the job) at most every 3 s.
 const job=s?.plot?.job,au=X.ctx.view.authority;if(job&&Date.now()>job.ready+250&&!X.syncing&&Date.now()-(X.syncAt||0)>3000&&au&&!X.busy){X.syncing=true;X.syncAt=Date.now();au.connect().finally(()=>{if(X)X.syncing=false;});}
 const R=X.R;if(!R){if(X.drill)drillStep(dt);draw2d();return;}const {view}=X.ctx,T=R.T,host=view.host;if(!plotOf())return;
 // Draw only inside the visible stage with its own aspect, so cellAt() (stage rect) matches the picture exactly.
 const hr=host.getBoundingClientRect(),sr=X.stage.getBoundingClientRect(),w=Math.max(1,sr.width||390),h=Math.max(1,sr.height||400);if(R.cam.aspect!==w/h){R.cam.aspect=w/h;R.cam.updateProjectionMatrix();}
 if(X.drive?.on)driveStep(dt);
 cameraStep(dt);
 // distance LOD: walls near the focus (your tank, or the build camera's target when zoomed in) get the full model
 if(X.drive?.on)R.town.setFocus(X.drive.x,X.drive.z,72);else{X.lodFar=X.lodFar?X.cam.dist>100:X.cam.dist>120;R.town.setFocus(X.cam.x,X.cam.z,X.lodFar?0:95);}
 R.town.setFar(R.town.far?X.cam.dist>165&&!X.drive?.on:X.cam.dist>195&&!X.drive?.on,plotOf());
 R.town.heads(X.clock,X.drive?.on?X.drive:null);crewStep(R,plotOf());if(X.drill)drillStep(dt);damageStep(R,plotOf(),dt);
 R.S.U.uTime.value=(R.S.U.uTime.value||0)+dt;const r=view.renderer,vx=sr.left-hr.left,vy=hr.bottom-sr.bottom;
 // brighter hemisphere light inside the town (the shared ambient uniforms, restored after this draw: no new program)
 const U=R.S.U,up=U.uAmbUp.value.clone(),dn=U.uAmbDn.value.clone();U.uAmbUp.value.multiplyScalar(1.75);U.uAmbDn.value.multiplyScalar(1.5);
 try{r.setScissorTest(false);r.clear();if(X.spr&&X.snap!=='closed'&&X.spr.queue.length&&X.frames>3){if(X.spr.run(2).length)X.sprDirty=true;}R.S.viewLights(R.cam);r.setViewport(vx,vy,w,h);r.setScissor(vx,vy,w,h);r.setScissorTest(true);r.render(R.sc,R.cam);r.setScissorTest(false);r.setViewport(0,0,hr.width||w,hr.height||h);}
 finally{U.uAmbUp.value.copy(up);U.uAmbDn.value.copy(dn);}
 if(X.sprDirty&&!X.spr.queue.length){X.sprDirty=false;refreshSprites();}
 if((X.frames=(X.frames||0)+1)%30===1)X.info={calls:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs?.length||0};}
// cards that were waiting for their pictures get them in place (no re-render: open sections and scroll stay)
function refreshSprites(){if(!X)return;for(const box of X.d.querySelectorAll('[data-spr]')){if(box.classList.contains('cq-has-spr'))continue;const url=TK()?.SPRITES.get(box.dataset.spr);if(!url)continue;box.textContent='';const im=document.createElement('img');im.src=url;im.alt='';im.className='cq-plot-spr';box.append(im);box.classList.add('cq-has-spr');}
 for(const b of X.d.querySelectorAll('.cq-plot-ore')){const i=b.querySelector('i');if(i&&!i.classList.contains('cq-has-spr')){const idx=[...b.parentNode.children].indexOf(b),url=TK()?.SPRITES.get(TK().spriteKey('w',P.wcode(idx,idx?2:0)));if(url){const im=document.createElement('img');im.src=url;im.alt='';i.append(im);i.classList.add('cq-has-spr');}}}}
// Camera: the build view (overhead 3/4), the drive view (chasing your tank) or the first-entry town tour; switching glides.
function cameraStep(dt){const R=X.R,T=R.T,c=X.cam,want=new T.Vector3(),look=new T.Vector3(),p=plotOf();
 if(X.tour){X.tour.t+=dt;const tt=X.tour.t/X.tour.dur,side=P.townSide(p.cc)*P.GRID.cell,cc=p.b?.cc,cx=cc?P.cellX(cc.i)+6:0,cz=cc?P.cellZ(cc.j)+6:0,a=X.tour.a0+tt*2.2,rad=side*.62-tt*side*.18;
  want.set(cx+Math.sin(a)*rad,30+side*.28-tt*side*.1,cz+Math.cos(a)*rad);look.set(cx,6,cz);if(tt>=1){X.tour=null;X.glide=1;X.tourBtn?.remove();}}
 else if(X.drive?.on){const d=X.drive,dist=d.dist,pt=d.pitch;look.set(d.x,d.y+2.6,d.z);want.set(d.x+Math.sin(d.yaw)*Math.cos(pt)*dist,d.y+2.6+Math.sin(pt)*dist,d.z+Math.cos(d.yaw)*Math.cos(pt)*dist);
  const g=TK().groundAt(p.site,want.x,want.z)+2.2;if(want.y<g)want.y=g;}
 else{const tilt=c.tilt;want.set(c.x+Math.sin(c.yaw)*Math.cos(tilt)*c.dist,Math.sin(tilt)*c.dist,c.z+Math.cos(c.yaw)*Math.cos(tilt)*c.dist);look.set(c.x,0,c.z);}
 if(!R.camInit||reduced()){R.camPos.copy(want);R.camLook.copy(look);R.camInit=true;}
 else{X.glide=Math.max(0,(X.glide||0)-dt);const k=1-Math.exp(-dt*(X.glide>0?4.5:X.tour?3:26));R.camPos.lerp(want,k);R.camLook.lerp(look,k);}
 R.cam.position.copy(R.camPos);R.cam.lookAt(R.camLook);}
// crew walk between buildings, rovers drive the lanes (presentation)
function crewStep(R,p){if(!p)return;const T=R.T,mt=R._m||(R._m=new T.Matrix4()),bs=Object.values(p.b).filter(b=>b.l>0||b.t==='cc');if(!bs.length)return;const pos=b=>[P.cellX(b.i)+2,P.cellZ(b.j)+2];
 for(let n=0;n<R.crew.count;n++){const a=bs[n%bs.length],b=bs[(n*7+3)%bs.length],[x0,z0]=pos(a),[x1,z1]=pos(b),L=Math.hypot(x1-x0,z1-z0)||1,ph=((X.clock*1.3+n*11)%(2*L))/L,f=ph>1?2-ph:ph,x=x0+(x1-x0)*f+(n%3-1)*1.2,z=z0+(z1-z0)*f+5;mt.makeRotationY(Math.atan2(x1-x0,z1-z0)+(ph>1?Math.PI:0));mt.setPosition(x,P.heightAt(p.site,x,z),z);R.crew.setMatrixAt(n,mt);}
 R.crew.instanceMatrix.needsUpdate=true;const sp=P.spawnCells(p.site,p.cc);for(let n=0;n<R.rovers.count;n++){const L=sp[n%sp.length][0],t=((X.clock*.05+n*.33)%1),x=P.cellX(L[0])*(1-t)+6*t,z=P.cellZ(L[1])*(1-t)+6*t;mt.makeRotationY(Math.atan2(6-P.cellX(L[0]),6-P.cellZ(L[1])));mt.setPosition(x,P.heightAt(p.site,x,z),z);R.rovers.setMatrixAt(n,mt);}R.rovers.instanceMatrix.needsUpdate=true;}
// Damage you can see: damaged walls smoke, ruined turrets and buildings spark (presentation of plot.dmg; drills never write it).
function damageStep(R,p,dt){const pf=R.puffs;if(!pf||!p)return;const key=JSON.stringify(p.dmg||{})+p.site;if(R.dmgKey!==key){R.dmgKey=key;R.dmgEm=TK().damageEmitters(p,1,0,0,0);}pf.step(R.dmgEm,X.clock,dt);}

// ------------------------------------------------------------------- Home Sector: drive your town ----------------------
// The town's own gate (a portal just outside the town edge, away from every raider lane): you arrive here and leave by
// driving back into its ring. Collision: walls (rubble is passable), buildings (gates open for the owner, never for a
// visitor), settler homes, blocked terrain; outside the grid the ground is open up to the edge of the Home Sector.
function portalOf(p){const h=P.townH(p.cc)+4,lanes=P.spawnCells(p.site,p.cc).flat(),cands=[[0,h],[-h,h],[h,h],[0,-h],[-h,-h],[h,-h],[-h,0],[h,0]];
 for(const [u,v] of cands){const i=P.MID+u,j=P.MID+v;if(lanes.some(([a,b])=>Math.hypot(a-i,b-j)<8))continue;return {x:u*P.GRID.cell,z:v*P.GRID.cell};}return {x:0,z:h*P.GRID.cell};}
function solidGrid(p){const n=P.GRID.n,g=new Uint8Array(n*n),visit=!!X.visit;for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(P.BLOCKED[P.terrainAt(p.site,i,j)])g[i*n+j]=1;
 for(const k of Object.keys(p.w||{})){if(p.dmg&&P.ruined(p,'w:'+k))continue;const [i,j]=k.split(',').map(Number);if(P.inGrid(i,j))g[i*n+j]=1;}
 for(const b of Object.values(p.b||{})){if(b.t==='gate'&&!visit)continue;for(const [i,j] of P.cells(b))if(P.inGrid(i,j))g[i*n+j]=1;}
 for(const h of P.homes(p))for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]])if(P.inGrid(h.i+a,h.j+b))g[(h.i+a)*n+h.j+b]=1;return g;}
const LIMIT=200;
function solidAt(x,z){const p=plotOf();if(!p)return true;if(Math.abs(x)>LIMIT||Math.abs(z)>LIMIT)return true;const n=P.GRID.n,i=Math.round(x/P.GRID.cell+P.MID),j=Math.round(z/P.GRID.cell+P.MID);if(!P.inGrid(i,j))return false;if(!X.solid)X.solid=solidGrid(p);return X.solid[i*n+j]===1;}
function hits(x,z,r=1.7){if(solidAt(x,z))return true;for(let k=0;k<8;k++){const a=k*Math.PI/4;if(solidAt(x+Math.cos(a)*r,z+Math.sin(a)*r))return true;}return false;}
function freeNear(x,z){if(!hits(x,z))return {x,z};for(let r=4;r<80;r+=4)for(let k=0;k<16;k++){const a=k*Math.PI/8,qx=x+Math.cos(a)*r,qz=z+Math.sin(a)*r;if(!hits(qx,qz))return {x:qx,z:qz};}return {x,z};}
function portalMesh(){const R=X.R;if(!R||!X.portal)return;R.town.wipe(R.g.portal);const p=plotOf(),{S,k,T}=R,b=new S.Bld(),x=X.portal.x,z=X.portal.z,y=TK().groundAt(p.site,x,z),a=Math.atan2(-x,-z);
 const M=new T.Matrix4().makeRotationY(a);M.setPosition(x,y,z);for(const s of [-1,1]){b.box(s*6.2,4.4,0,1.4,8.8,1.8,k.C.dark);b.box(s*5.5,4.4,0,.12,8,1.2,k.C.cyan,1.2);}b.box(0,9.1,0,14,1.2,2.2,k.C.dark2);b.box(0,8.4,1.12,11.6,.14,.1,k.C.cyan,1.4);b.box(0,.08,0,12,.16,6,k.C.dark2);
 const m=b.mesh();m.applyMatrix4(M);R.g.portal.add(m);const X2=new S.Fx();X2.flat(x,y+.12,z,4.2,4.2,S.AT.RING,[.08,.6,.75],0);X2.flat(x,y+.1,z,3.6,3.6,S.AT.BLOB,[.03,.18,.24],0);X2.quadV(x,y+4.6,z,11,8,a,S.AT.BLOB,[.03,.2,.3]);R.g.portal.add(X2.mesh());}
function tankIn(){const v=X.ctx.view,veh=v.vehicle;if(!veh||!X.R||X.tankHome)return;X.tankHome={parent:veh.parent,pos:veh.position.clone(),q:veh.quaternion.clone(),vis:veh.visible};veh.visible=true;X.R.sc.add(veh);}
function tankOut(){if(!X?.tankHome)return;const veh=X.ctx.view.vehicle,h=X.tankHome;X.tankHome=null;if(!veh)return;(h.parent||X.ctx.view.scene).add(veh);veh.position.copy(h.pos);veh.quaternion.copy(h.q);veh.visible=h.vis;}
function spawnTank(){const p=plotOf();if(!p||!X.portal)return;const L=Math.hypot(X.portal.x,X.portal.z)||1,f=freeNear(X.portal.x-X.portal.x/L*12,X.portal.z-X.portal.z/L*12),head=Math.atan2(-f.x,-f.z);X.drive={...(X.drive||{}),on:!!X.drive?.on,x:f.x,z:f.z,y:TK().groundAt(p.site,f.x,f.z),heading:head,yaw:head+Math.PI,pitch:.5,dist:32,armed:false,speed:0};placeTank(0);}
// CLOSED sheet = drive (3D only). Entering for the first time plays a short town tour (skippable, never with reduced motion).
function enterDrive(on){if(!X?.R)return;if(!X.drive)spawnTank();tankIn();X.drive.on=!!on;X.d.classList.toggle('cq-plot-drive',!!on);X.glide=.9;
 if(on&&!X.visit&&!X.toured){X.toured=true;let seen=false;try{seen=localStorage.getItem('lunar-conquest-tour-v1')==='1';}catch(_){}if(!seen&&!reduced()){try{localStorage.setItem('lunar-conquest-tour-v1','1');}catch(_){}startTour();}}}
function startTour(){const p=plotOf();X.tour={t:0,dur:6,a0:Math.atan2(X.drive?.x||0,X.drive?.z||1)};const b=X.ctx.button('SKIP TOUR ›',()=>{X.tour=null;X.glide=1;b.remove();},'cq-hs-skip');X.stage.append(b);X.tourBtn=b;say('WELCOME TO '+townName(p).toUpperCase()+' · YOUR TOWN, LIVE');}
function driveHud(){if(!X.R)return;const {el,button}=X.ctx,stick=el('div','cq-hs-stick',null,X.stage);stick.setAttribute('aria-label','Drag to drive');el('span','','DRIVE',stick);const nub=el('i','',null,stick);let id=null;
 const upd=e=>{const r=stick.getBoundingClientRect(),x=(e.clientX-r.x-r.width/2)/40,z=-(e.clientY-r.y-r.height/2)/40,n=Math.max(1,Math.hypot(x,z));X.stick={x:x/n,z:z/n};nub.style.transform='translate('+x/n*30+'px,'+(-z/n*30)+'px)';};
 stick.onpointerdown=e=>{if(id!==null)return;e.preventDefault();e.stopPropagation();id=e.pointerId;stick.setPointerCapture?.(id);upd(e);if(X.tour){X.tour=null;X.glide=1;X.tourBtn?.remove();}};stick.onpointermove=e=>{if(id===e.pointerId)upd(e);};
 stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=e=>{if(e.pointerId!==id)return;id=null;X.stick={x:0,z:0};nub.style.transform='';};X.stickEl=stick;
 X.hint=el('p','cq-hs-hint','',X.stage);}
function driveStep(dt){const d=X.drive,p=plotOf(),v=X.ctx.view,keys=v.keys||{};if(!p)return;dt=Math.min(.1,dt);
 let sx=(X.stick?.x||0)+(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),sz=(X.stick?.z||0)+(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);const n=Math.max(1,Math.hypot(sx,sz));sx/=n;sz/=n;
 if(X.tour&&(sx||sz)){X.tour=null;X.glide=1;X.tourBtn?.remove();}
 const i=Math.round(d.x/P.GRID.cell+P.MID),j=Math.round(d.z/P.GRID.cell+P.MID),slow=P.inGrid(i,j)?(P.SLOW[P.terrainAt(p.site,i,j)]||1):1,speed=Math.max(9,Math.min(22,v.speed||13))*slow;
 const dx=(Math.cos(d.yaw)*sx-Math.sin(d.yaw)*sz)*speed*dt,dz=(-Math.sin(d.yaw)*sx-Math.cos(d.yaw)*sz)*speed*dt;let mx=0,mz=0;
 if(dx||dz){if(!hits(d.x+dx,d.z+dz)){mx=dx;mz=dz;}else if(!hits(d.x+dx,d.z)){mx=dx;}else if(!hits(d.x,d.z+dz)){mz=dz;}d.x+=mx;d.z+=mz;}
 const moved=Math.hypot(mx,mz);if(moved>1e-4){const want=Math.atan2(mx,mz),turn=Math.atan2(Math.sin(want-d.heading),Math.cos(want-d.heading));d.heading+=turn*Math.min(1,dt*10);}
 d.y=TK().groundAt(p.site,d.x,d.z);placeTank(dt,mx,mz);
 // the town's gate: arrive outside its ring, leave by driving back into it
 const pd=Math.hypot(d.x-X.portal.x,d.z-X.portal.z);if(pd>9)d.armed=true;if(d.armed&&pd<4.6&&!X.leaving){X.leaving=true;say('LEAVING '+townName(p).toUpperCase()+'…');setTimeout(()=>{if(X)close();},350);}
 const hint=pd<16?'DRIVE INTO THE RING TO LEAVE · ‹ ALSO LEAVES':X.drive.firstHint!==false&&X.clock<14?'DRIVE YOUR TOWN · TAP A TAB BELOW TO BUILD':'';if(X.hint&&X.hint.textContent!==hint)X.hint.textContent=hint;}
function placeTank(dt,mx=0,mz=0){const v=X.ctx.view,veh=v.vehicle,d=X.drive,p=plotOf();if(!veh||!d||!p)return;const T=X.R.T,g=(x,z)=>TK().groundAt(p.site,x,z),e=1.2,up=new T.Vector3(-(g(d.x+e,d.z)-g(d.x-e,d.z))/(2*e),1,-(g(d.x,d.z+e)-g(d.x,d.z-e))/(2*e)).normalize(),fw=new T.Vector3(Math.sin(d.heading),0,Math.cos(d.heading));
 fw.addScaledVector(up,-fw.dot(up)).normalize();const right=new T.Vector3().crossVectors(up,fw).normalize();veh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,fw));veh.position.set(d.x,d.y,d.z);
 if(v.motion&&dt>0){try{const L=v.loadout,tw=typeof M3!=='undefined'?M3.CHASSIS_VISUALS[L.c.c][M3.visualTier(L.c.t)].trackZ:.9;v.motion.step(dt,{dx:mx/1.65,dz:mz/1.65,heading:Math.PI/2-d.heading,trackHalfWidth:tw},false);}catch(_){}}}

// ------------------------------------------------------------------- raid replay (Defense Drill) -----------------------
// The phone replays the Worker's drill from its seed (same deterministic simulation): raiders, every turret type's firing
// effect, walls (to rubble), homes and buildings falling, then the breach points. The simulation runs in slices of about
// 8 ms (a generator), so the phone never freezes; X.drillMs is the wall clock and X.drillCpu the pure simulation time.
function startReplay(){const s=X?.ctx.view.authority?.state,p=s?.plot,e=p?.log?.[0];if(!e||X.simulating)return;const g=P.drillGen(p,e.seed,{threat:e.threat,yieldEvery:25}),t0=performance.now();let cpu=0;X.simulating=true;
 const pump=()=>{if(!X){return;}const a=performance.now();let r;do{r=g.next();}while(!r.done&&performance.now()-a<8);cpu+=performance.now()-a;
  if(!r.done){say('SIMULATING THE RAID… '+Math.round(100*r.value)+'%');setTimeout(pump,0);return;}
  X.simulating=false;X.drillMs=Math.round(performance.now()-t0);X.drillCpu=Math.round(cpu);say('');X.drill={r:r.value,log:e,t:0,fi:0,ei:0,shots:[],gone:new Set()};X.drillResult=null;X.tab='defend';X.mode='drill';if(!X.drive?.on){X.cam.dist=Math.min(320,140+P.townH(p.cc)*3);X.cam.x=0;X.cam.z=8;}render();};
 pump();}
function drillStep(dt){const D=X.drill,R=X.R,p=plotOf();D.t+=dt*1.6;const fr=D.r.frames;while(D.fi<fr.length-1&&fr[D.fi+1].t<=D.t)D.fi++;const a=fr[D.fi]||{f:[],s:[]},b=fr[Math.min(fr.length-1,D.fi+1)]||a,f=b.t>a.t?Math.max(0,Math.min(1,(D.t-a.t)/(b.t-a.t))):0;
 const bm=new Map(b.f.map(q=>[q[0],q]));D.now=a.f.map(q=>{const n=bm.get(q[0]);return n?[q[0],q[1],q[2]+(n[2]-q[2])*f,q[3]+(n[3]-q[3])*f]:q;});
 const ev=D.r.events;while(D.ei<ev.length&&ev[D.ei].t<=D.t){const e=ev[D.ei++];if(e.k==='shot')D.shots.push({...e,life:e.ty==='flame'?.35:.25});else if(e.k==='destroyed'){D.gone.add(e.id);R?.town.hide(e.id,p);}}D.shots=D.shots.filter(x=>(x.life-=dt)>0);
 if(R){const T=R.T,m=R._d||(R._d=new T.Matrix4()),sv=R._dv||(R._dv=new T.Vector3()),cnt={r:0,s:0,d:0,w:0,b:0};for(const [,kind,x,z] of D.now){const im=R.foes[kind];if(!im||cnt[kind]>=im.instanceMatrix.count)continue;m.makeRotationY(Math.atan2(-x,-z));m.setPosition(x,(kind==='d'?7:0)+P.heightAt(p.site,x,z),z);im.setMatrixAt(cnt[kind]++,m);}for(const [kk,im] of Object.entries(R.foes)){im.count=cnt[kk];im.visible=cnt[kk]>0;im.instanceMatrix.needsUpdate=true;}
  const fc={};for(const k2 of Object.keys(R.fx))fc[k2]=0;const from=id=>{const bb=p.b[id];return bb?[P.cellX(bb.i),P.groundY(p.site,bb.i,bb.j)+2,P.cellZ(bb.j)]:null;};
  const put=(kind,x0,y0,z0,x1,z1,scale=1)=>{const im=R.fx[kind];if(fc[kind]>=im.instanceMatrix.count)return;const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz)||1;m.makeRotationY(Math.atan2(dx,dz));m.scale(sv.set(scale,scale,L));m.setPosition(x0,y0,z0);im.setMatrixAt(fc[kind]++,m);};
  for(const sh of D.shots){const o=from(sh.from);if(!o)continue;const kind=FX_OF[sh.ty]||'tracer';
   if(kind==='arc'&&sh.ch){let [px,pz]=[o[0],o[2]];for(const [cx,cz] of sh.ch){put('arc',px,o[1],pz,cx,cz);px=cx;pz=cz;}}
   else if(kind==='flame')put('flame',o[0],o[1]-.5,o[2],sh.x,sh.z,4);
   else if(kind==='blast'||kind==='shell'){const k3=1-Math.max(0,sh.life)/.25;put(kind,o[0]+(sh.x-o[0])*k3,o[1]+2-k3,o[2]+(sh.z-o[2])*k3,sh.x,sh.z,1);}
   else put(kind,o[0],o[1],o[2],sh.x,sh.z,kind==='burst'||kind==='rail'?1.6:1);
   for(const t of R.town.tur.values())for(const it of t.items)if(it.id===sh.from)it.aim=Math.atan2(sh.x-it.x,sh.z-it.z);const e=R.town.meshes.get(sh.from);if(e?.o.userData.head)e.o.userData.head.userData.aim=Math.atan2(sh.x-o[0],sh.z-o[2])+(e.o.rotation.y||0);}
  for(const [k2,im] of Object.entries(R.fx)){im.count=fc[k2];im.visible=fc[k2]>0;im.instanceMatrix.needsUpdate=true;}}
 if(D.t>=D.r.time+1){X.drillResult={...D.r,log:D.log};X.drill=null;if(R){for(const im of [...Object.values(R.foes),...Object.values(R.fx)]){im.count=0;im.visible=false;}for(const e of R.town.meshes.values()){e.o.visible=true;if(e.o.userData.head)delete e.o.userData.head.userData.aim;}for(const t of R.town.tur.values())for(const it of t.items){delete it.aim;delete it.dead;}R.town.keys.walls=R.town.keys.homes=R.town.keys.tur=null;}render();}}

// ------------------------------------------------------------------- 2D fallback ---------------------------------------
// One pixel per cell in an offscreen canvas (terrain, walls by blend, homes), drawn scaled with no smoothing; buildings,
// raiders and previews on top. Cheap on any phone at any town size. (No drive mode on the 2D setting.)
function draw2d(){if(!X?.cv)return;const cv=X.cv,p=plotOf();if(!p)return;const r=X.stage.getBoundingClientRect(),dpr=Math.min(2,root.devicePixelRatio||1);if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);}   // height too: the stage resizes whenever the sheet does
 const g=cv.getContext('2d'),n=P.GRID.n,cs=Math.min(cv.width,cv.height)/(P.townSide(p.cc)+4)*(170/X.cam.dist),ox=cv.width/2-X.cam.x/P.GRID.cell*cs,oy=cv.height/2-X.cam.z/P.GRID.cell*cs,X0=i=>ox+(i-(n-1)/2-.5)*cs,Y0=j=>oy+(j-(n-1)/2-.5)*cs;X.map2d={cs,ox,oy};
 X.l2=TK()?TK().layer2d(p,X.l2):null;g.fillStyle='#05070d';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;if(X.l2)g.drawImage(X.l2.c,X0(0),Y0(0),n*cs,n*cs);
 const h=P.townH(p.cc);g.strokeStyle='#22e6ff';g.lineWidth=2;g.strokeRect(X0(P.MID-h),Y0(P.MID-h),(2*h+1)*cs,(2*h+1)*cs);g.fillStyle='#ff3048';for(const cl of P.spawnCells(p.site,p.cc))for(const [i,j] of cl){g.beginPath();g.moveTo(X0(i)+cs*.5,Y0(j)+cs*.15);g.lineTo(X0(i)+cs*.85,Y0(j)+cs*.85);g.lineTo(X0(i)+cs*.15,Y0(j)+cs*.85);g.fill();}
 g.font=Math.round(cs*1.1)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';for(const [id,b] of Object.entries(p.b)){if(X.drill?.gone.has(id))continue;const s2=P.sizeOf(b.t,b.r|0),lvl=b.t==='cc'?p.cc:b.l;g.fillStyle=X.sel===id?'#ffd36b':P.VITALS[b.t]?'#6a5a3a':lvl>0?'#4a5664':'#6a4a2a';g.fillRect(X0(b.i)+1,Y0(b.j)+1,s2.w*cs-2,s2.d*cs-2);g.fillStyle='#e8f6ff';g.fillText((GLYPH[b.t]||'?')+(s2.w>1&&lvl>0?(b.t==='cc'?'CC'+lvl:romanOf(lvl)):''),X0(b.i)+s2.w*cs/2,Y0(b.j)+s2.d*cs/2);}
 const box=(cl,col)=>{g.strokeStyle=col;g.lineWidth=2;for(const [i,j] of cl)g.strokeRect(X0(i)+1,Y0(j)+1,cs-2,cs-2);};
 if(X.place)box(P.cells({t:X.place.type,i:X.place.i,j:X.place.j,r:X.place.r}),!(X.place.id?P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r,X.place.id):P.buildCheck(p,X.place.type,1)||P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r))?'#2dff8a':'#ff3048');
 if(X.tab==='walls'){for(const d of X.draft)box(P.shapeCells(d.sec)||[],'#ffb347');if(X.draw?.cells)box(X.draw.cells,'#2dff8a');if(X.erase)box(X.erase.keys.map(k=>k.split(',').map(Number)),'#ff3048');}
 if(X.place&&P.BUILDINGS[X.place.type]?.turret){g.strokeStyle='#22e6ff';g.beginPath();g.arc(X0(X.place.i)+cs/2,Y0(X.place.j)+cs/2,P.BUILDINGS[X.place.type].turret.range*P.SITES[p.site].range/P.GRID.cell*cs,0,7);g.stroke();}
 if(X.drill?.gone){g.fillStyle='#3a342c';for(const id of X.drill.gone)if(id.startsWith('w:')){const [i,j]=id.slice(2).split(',').map(Number);g.fillRect(X0(i),Y0(j),cs,cs);}}
 if(X.drill?.now){for(const [,kind,x,z] of X.drill.now){g.fillStyle=kind==='d'?'#ff7ae8':kind==='b'?'#ff5a2a':'#ff2bd6';g.beginPath();g.arc(ox+x/P.GRID.cell*cs,oy+z/P.GRID.cell*cs,kind==='s'||kind==='b'?cs*.5:kind==='w'?cs*.2:cs*.3,0,7);g.fill();}}
 if(X.tab==='defend'&&X.drillResult&&!X.drill){g.strokeStyle='#ff3048';g.lineWidth=3;for(const [i,j,k] of X.drillResult.breaches){g.beginPath();g.arc(X0(i)+cs/2,Y0(j)+cs/2,cs*(1.4+Math.min(3,k*.3)),0,7);g.stroke();}}}
// ------------------------------------------------------------------- personal & social ---------------------------------
const PALETTE=['#22e6ff','#ffb347','#ff3048','#2dffc4','#a07bff','#ffd36b','#f3f6fa','#1a2230','#3fae4a','#ff2bd6'];
const SHAPES=['shield','pennant','square','chevron'],EMBLEMS={moon:'☾',tank:'▰',star:'★',skull:'☠',gear:'⚙',wing:'❦',bolt:'ϟ',crown:'♛'};
function bannerCanvas(bn,w=120,h=150){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#0b1623';g.fillRect(0,0,w,h);g.fillStyle='#4a5664';g.fillRect(w*.12,h*.05,w*.05,h*.9);
 const x=w*.17,y=h*.08,W=w*.72,H=h*.55;g.fillStyle=bn.colors[0];g.beginPath();if(bn.shape==='pennant'){g.moveTo(x,y);g.lineTo(x+W,y+H/2);g.lineTo(x,y+H);}else if(bn.shape==='shield'){g.moveTo(x,y);g.lineTo(x+W,y);g.lineTo(x+W,y+H*.7);g.lineTo(x+W/2,y+H*1.1);g.lineTo(x,y+H*.7);}else if(bn.shape==='chevron'){g.moveTo(x,y);g.lineTo(x+W,y);g.lineTo(x+W*.8,y+H/2);g.lineTo(x+W,y+H);g.lineTo(x,y+H);}else g.rect(x,y,W,H);g.closePath();g.fill();
 g.fillStyle=bn.colors[1];g.fillRect(x,y+H*.42,W*(bn.shape==='pennant'?.55:1),H*.16);g.font='bold '+Math.round(H*.42)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(EMBLEMS[bn.emblem]||'★',x+W*.42,y+H*.5-H*.18);return c;}
function designer(box,p,s){const {el,button}=X.ctx;const bn=JSON.parse(JSON.stringify(p.banner||{shape:'shield',colors:['#22e6ff','#1a2230'],emblem:'moon'})),th=JSON.parse(JSON.stringify(p.theme||{light:'cyan',finish:'steel',decor:[]}));
 // the town name (Worker-validated: up to 16 characters, no profanity)
 el('small','','TOWN NAME (up to 16 letters, numbers, spaces, - and \')',box);const nr=el('div','cq-plot-row cq-plot-namerow',null,box),inp=document.createElement('input');inp.type='text';inp.maxLength=16;inp.value=p.name||'';inp.placeholder=P.SITES[p.site].name+' TOWN';inp.className='cq-plot-nameinput';inp.setAttribute('aria-label','Town name');inp.autocomplete='off';inp.spellcheck=false;nr.append(inp);
 const err=el('small','cq-plot-vital-lost','',box);inp.oninput=()=>{const v=P.townName(inp.value);err.textContent=v.ok?'':'✕ '+v.err.toUpperCase();};nr.append(button('SAVE NAME',()=>{const v=P.townName(inp.value);if(!v.ok){err.textContent='✕ '+v.err.toUpperCase();return;}act('plot-name',{name:v.name},'NAMING YOUR TOWN…');},'cq-plot-primary'));
 const prev=el('div','cq-banner-prev',null,box);const draw=()=>{prev.replaceChildren(bannerCanvas(bn));};draw();
 const row=(label,items,get,set,fmt2)=>{el('small','',label,box);const r=el('div','cq-plot-row',null,box);for(const it of items){const b=button(fmt2?fmt2(it):it.toUpperCase(),()=>{set(it);[...r.children].forEach(x=>x.classList.toggle('on',x===b));draw();},get()===it?'on':'');if(/^#/.test(it)){b.style.background=it;b.textContent='';b.setAttribute('aria-label',label+' '+it);}r.append(b);}};
 row('SHAPE',SHAPES,()=>bn.shape,v=>bn.shape=v);row('MAIN COLOR',PALETTE,()=>bn.colors[0],v=>bn.colors[0]=v);row('STRIPE COLOR',PALETTE,()=>bn.colors[1],v=>bn.colors[1]=v);row('EMBLEM',Object.keys(EMBLEMS),()=>bn.emblem,v=>bn.emblem=v,k=>EMBLEMS[k]);
 box.append(button('SAVE BANNER · on your town and your tank',()=>act('plot-banner',bn,'RAISING BANNER…'),'cq-plot-primary'));
 row('TOWN LIGHTS',['cyan','amber','violet','green','red'],()=>th.light,v=>th.light=v);row('FINISH',['steel','sand','graphite'],()=>th.finish,v=>th.finish=v);
 el('small','','DECORATIONS (up to 6)',box);const dr=el('div','cq-plot-row',null,box);for(const d of ['flags','lamps','crates','antenna','plants','statue']){const b=button(d.toUpperCase(),()=>{const i=th.decor.indexOf(d);if(i>=0)th.decor.splice(i,1);else if(th.decor.length<6)th.decor.push(d);b.classList.toggle('on',th.decor.includes(d));},th.decor.includes(d)?'on':'');dr.append(b);}
 box.append(button('SAVE THEME',()=>act('plot-theme',th,'REPAINTING…'),'cq-plot-primary'));el('small','','Names, banners, lights, finishes and these decorations are free.',box);
 box.append(button('SHARE MY TOWN',()=>shareCard(s,p),'cq-plot-share-btn'));}
async function visitList(box){const {el,button,view}=X.ctx;const wait=el('p','','LOADING…',box);let L;try{L=await view.authority.transport('/api/conquest/visit',{});}catch(e){wait.textContent='VISITS NEED A CONNECTION';return;}wait.remove();
 if(L.week)el('p','cq-plot-next','★ BASE OF THE WEEK · '+L.week.n+' · +'+fmt(L.week.g)+' TOWN SCORE THIS WEEK',box);
 const sec=(title,list)=>{el('b','',title,box);if(!list.length){el('small','','None yet.',box);return;}for(const x of list){box.append(button((x.n||'Pilot')+' · CC'+x.cc+' · '+(P.SITES[x.site]?.name||'')+' · '+fmt(x.pw),()=>visit(x.p,x.n)));}};
 sec('SQUAD',L.squad||[]);sec('TOP 20 BY TOWN SCORE',L.top||[]);if(L.week&&!(L.top||[]).some(x=>x.p===L.week.p))box.append(button('VISIT BASE OF THE WEEK · '+L.week.n,()=>visit(L.week.p,L.week.n)));}
// Visiting loads that town as a read-only Home Sector you can drive through (gates stay shut, nothing can be changed or taken).
async function visit(pid,name){const {view}=X.ctx;say('OPENING '+String(name||'BASE').toUpperCase()+'…');let r;try{r=await view.authority.transport('/api/conquest/visit',{pid});}catch(e){say(String(e.message||'').replace(/^conquest: /,'').toUpperCase()||'NOT AVAILABLE');return;}if(!X)return;
 X.visit={base:r.base,plot:fromSnap(r.base)};X.sel=null;X.tab='home';X.mode='view';X.place=null;X.draw=null;X.draft=[];X.solid=null;if(X.R){X.R.town.keys={};X.portalKey=null;}frameTown(X.visit.plot);sync();if(X.R){spawnTank();enterDrive(true);snapTo('closed');}render();}
function visitUi(body){const {el,button}=X.ctx,v=X.visit.base,p=X.visit.plot;
 el('p','cq-plot-hint','Read-only visit: drive through this town and look around. Its gates stay shut; nothing here can be changed or taken. Player raids are coming.',body);
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=b.t==='cc'?{n:'Command Center'}:P.BUILDINGS[b.t];el('b','',(GLYPH[b.t]||'')+' '+B.n.toUpperCase()+' '+(b.t==='cc'?'CC'+p.cc:romanOf(b.l)),body);}
 {const w=Object.values(p.w||{}),by={};for(const c of w){const n=P.blendName(c);by[n]=(by[n]||0)+1;}const tu={};for(const b of Object.values(p.b)){const B=P.BUILDINGS[b.t];if(B?.turret)tu[B.n]=(tu[B.n]||0)+1;}const vit=Object.values(p.b).filter(b=>P.VITALS[b.t]).map(b=>b.t==='cc'?'Command Center':P.BUILDINGS[b.t].n);
  el('p','cq-plot-res','WHAT YOU WOULD FACE · DEFENSE RATING '+fmt(v.dr||P.defenseRating(p))+' · '+w.length+' walls'+(w.length?' ('+Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n,k])=>k+' '+n).join(', ')+')':'')+' · '+(Object.entries(tu).map(([n,k])=>k+' '+n).join(', ')||'no turrets')+' · vitals: '+vit.join(', '),body);}
 if(v.bn)body.append(bannerCanvas(v.bn,90,110));body.append(button('RETURN TO MY TOWN',()=>{X.visit=null;X.sel=null;X.solid=null;if(X.R){X.R.town.keys={};X.portalKey=null;}const own=plotOf();frameTown(own);sync();if(X.R)spawnTank();render();},'cq-plot-primary'));}
// The share card: a 3D render of your town (the same scene, a beauty camera, read back in this task), its name, CC, defense
// rating and banner, plus the invite link. The 2D layer stands in on the 2D setting.
function townShot(W,H){const R=X?.R;if(!R)return null;const {view}=X.ctx,r=view.renderer,T=R.T,p=plotOf(),cc=p.b?.cc,cx=cc?P.cellX(cc.i)+6:0,cz=cc?P.cellZ(cc.j)+6:0,side=P.townSide(p.cc)*P.GRID.cell,cam=new T.PerspectiveCamera(42,W/H,.5,2000);
 const hr=view.host.getBoundingClientRect(),pr=r.getPixelRatio?.()||1,cw=Math.min(W,Math.floor((hr.width||W)*pr)),ch=Math.min(H,Math.floor((hr.height||H)*pr)),k=Math.min(cw/W,ch/H),w=Math.floor(W*k),h=Math.floor(H*k);
 cam.position.set(cx+side*.42,side*.46,cz+side*.62);cam.lookAt(cx,0,cz);cam.aspect=w/h;cam.updateProjectionMatrix();R.S.viewLights(cam);const gl=r.getContext(),buf=new Uint8Array(w*h*4),U=R.S.U,up=U.uAmbUp.value.clone(),dn=U.uAmbDn.value.clone();U.uAmbUp.value.multiplyScalar(1.75);U.uAmbDn.value.multiplyScalar(1.5);
 const vis=R.g.portal.visible,tv=view.vehicle?.visible;R.g.portal.visible=false;try{r.setScissorTest(true);r.setViewport(0,0,w/pr,h/pr);r.setScissor(0,0,w/pr,h/pr);r.clear();r.render(R.sc,cam);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);r.clear();r.setScissorTest(false);}finally{U.uAmbUp.value.copy(up);U.uAmbDn.value.copy(dn);R.g.portal.visible=vis;if(view.vehicle)view.vehicle.visible=tv;}
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),img=g.createImageData(w,h);for(let y=0;y<h;y++)img.data.set(buf.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);g.putImageData(img,0,0);return c;}
function shareCard(s,p){const {el,button}=X.ctx,c=document.createElement('canvas');c.width=720;c.height=900;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,900);grad.addColorStop(0,'#071426');grad.addColorStop(1,'#03060c');g.fillStyle=grad;g.fillRect(0,0,720,900);
 g.fillStyle='#22e6ff';g.font='700 34px sans-serif';g.fillText(townName(p).toUpperCase().slice(0,22),40,70);g.fillStyle='#e8f6ff';g.font='600 26px sans-serif';const name=(typeof save!=='undefined'&&(save.callsign||save.name))||'Pilot';g.fillText(String(name).slice(0,20)+' · '+P.SITES[p.site].name,40,112);
 g.fillStyle='#ffd36b';g.font='700 30px sans-serif';g.fillText('CC'+p.cc+' · DEFENSE '+fmt(P.defenseRating(p))+' · TOWN SCORE '+fmt(p.power||P.power(p)),40,156);
 const shot=townShot(640,560);if(shot){g.drawImage(shot,40,180,640,560);g.strokeStyle='#22e6ff66';g.lineWidth=2;g.strokeRect(40,180,640,560);}
 else{const L=TK()?.layer2d(p,null);if(L){const h=P.townH(p.cc),side=2*h+1,i0=P.MID-h;g.imageSmoothingEnabled=false;g.drawImage(L.c,i0,i0,side,side,40,180,640,560);}}
 if(p.banner)g.drawImage(bannerCanvas(p.banner,120,150),560,24);const link=typeof refLink==='function'?refLink():null;g.fillStyle='#ffb347';g.font='700 26px sans-serif';g.fillText('JOIN MY SQUAD · BUILD YOURS',40,808);g.fillStyle='#c9d6e2';g.font='500 24px sans-serif';g.fillText(link?link.replace(/^https?:\/\//,''):'LUNAR: War Machines · Telegram and web',40,850);
 const url=c.toDataURL('image/png'),box=el('div','cq-plot-share',null,X.body);X.body.scrollTop=X.body.scrollHeight;const img=document.createElement('img');img.src=url;img.alt=townName(p)+': CC'+p.cc+', defense rating '+P.defenseRating(p);img.className='cq-plot-share-img';box.append(img);
 const text='My LUNAR town '+townName(p)+': CC'+p.cc+' on a '+P.SITES[p.site].name+', defense rating '+fmt(P.defenseRating(p))+'. Join my squad and build yours.';
 box.append(button(typeof IN_TG!=='undefined'&&IN_TG?'SHARE IN TELEGRAM':'SHARE',async()=>{if(typeof IN_TG!=='undefined'&&IN_TG&&typeof shareRef==='function'){shareRef(text);return;}try{const blob=await (await fetch(url)).blob(),file=new File([blob],'lunar-town.png',{type:'image/png'}),data={title:'LUNAR: War Machines',text,...(link?{url:link}:{})};if(navigator.canShare?.({files:[file]}))data.files=[file];if(navigator.share)await navigator.share(data);else if(typeof shareRef==='function')shareRef(text);}catch(e){}},'cq-plot-primary'));
 const a=document.createElement('a');a.href=url;a.download='lunar-town.png';a.textContent='DOWNLOAD IMAGE';a.className='cq-plot-dl';box.append(a);X.shareShot=!!shot;}
// Revenue (owner MONEY RULE: what is sold and its limits live in ConquestPlot.STORE, one table). Hidden until checkout opens;
// every item already has its own preview picture so the store looks finished the day payments open.
function storeList(box){const {el,button}=X.ctx;el('small','','Capacity, cosmetics and time only. Never airdrop points; rare-or-better ores are earn-only.',box);
 for(const it of P.STORE.items){const b=button('',()=>{},'cq-plot-store');spr(el,b,'s',it.id);el('span','',it.name.toUpperCase()+' · '+it.what.toUpperCase()+(P.STORE.checkout?'':' · UNAVAILABLE'),b);b.disabled=!P.STORE.checkout;b.setAttribute('aria-disabled',String(!P.STORE.checkout));box.append(b);}}

// ------------------------------------------------------------------- input ---------------------------------------------
// The tapped cell, with the terrain: a ray against the ground plane at the height of the cell it lands on (3 refinements,
// so terraces, the plateau and the canyon floor all land exactly).
function cellAt(clientX,clientY){const r=X.stage.getBoundingClientRect(),p=plotOf();if(X.R){const T=X.R.T,v=new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,X.R.cam);const o=ray.ray.origin,d=ray.ray.direction;let y=0,c=null;
  for(let k=0;k<4;k++){const t=(y-o.y)/d.y;if(!(t>0))return c;const x=o.x+d.x*t,z=o.z+d.z*t;c=[Math.round(x/P.GRID.cell+P.MID),Math.round(z/P.GRID.cell+P.MID)];const ny=p&&P.inGrid(c[0],c[1])?P.groundY(p.site,c[0],c[1]):0;if(Math.abs(ny-y)<.05)break;y=ny;}return c;}
 const m=X.map2d,dpr=X.cv.width/r.width;if(!m)return null;return [Math.floor(((clientX-r.left)*dpr-m.ox)/m.cs+P.MID+.5),Math.floor(((clientY-r.top)*dpr-m.oy)/m.cs+P.MID+.5)];}
function tap(cx,cy){const p=plotOf(),c=cellAt(cx,cy);if(!p||!c)return;const [i,j]=c;if(X.visit){const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;render();return;}
 if(X.place){const s2=P.sizeOf(X.place.type,X.place.r);X.place.i=i-Math.floor((s2.w-1)/2);X.place.j=j-Math.floor((s2.d-1)/2);render();return;}
 if(X.tab==='walls')return;const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;
 if(X.sel&&(X.snap==='closed'||X.snap==='peek')){if(X.drive?.on)enterDrive(false);snapTo('half');}render();}
// wall tool gestures: a drag draws the current tool's shape; COPY/ERASE drag a box; PASTE taps an anchor
const box2=(a,b)=>{const out=[];for(let i=Math.min(a[0],b[0]);i<=Math.max(a[0],b[0]);i++)for(let j=Math.min(a[1],b[1]);j<=Math.max(a[1],b[1]);j++)out.push([i,j]);return out;};
function drawCells(a,b){return X.tool==='line'?P.line4(a,b):X.tool==='rect'?P.rectCells(a,b):X.tool==='ring'?P.ringCells(a,b):box2(a,b);}
function classify(p,cells){const occ=P.occupancy(p),code=P.wcode(X.blend.o,X.blend.l);return cells.map(([i,j])=>{if(!P.inTown(p.cc,i,j)||P.NOBUILD[P.terrainAt(p.site,i,j)])return false;const o=occ.get(P.key(i,j));if(o&&o!=='wall')return false;if(X.tool==='erase'||X.tool==='copy')return o==='wall'?2:false;return (p.w[P.key(i,j)]|0)===code?2:true;});}
function drawStart(c){const p=plotOf();if(!p||!c)return;if(X.tool==='paste'){pasteAt(c);return;}X.draw={a:c,b:c,cells:drawCells(c,c)};X.draw.ok=classify(p,X.draw.cells);holo();if(!X.R)draw2d();}
function drawMove(c){if(!X.draw||!c)return;const p=plotOf();if(c[0]===X.draw.b[0]&&c[1]===X.draw.b[1])return;if(X.tool==='ring'&&Math.hypot(c[0]-X.draw.a[0],c[1]-X.draw.a[1])>44)return;X.draw.b=c;X.draw.cells=drawCells(X.draw.a,c);X.draw.ok=classify(p,X.draw.cells);holo();if(!X.R)draw2d();}
function drawEnd(){const d=X.draw,p=plotOf();X.draw=null;if(!d||!p){render();return;}
 const ONE=1000;   // one order carries at most 1,200 cells and 9,000 characters: copy and erase up to 1,000 at a time
 if(X.tool==='copy'){const cells=d.cells.filter(([i,j])=>p.w[P.key(i,j)]).map(([i,j])=>[i-Math.min(d.a[0],d.b[0]),j-Math.min(d.a[1],d.b[1]),p.w[P.key(i,j)]|0]);if(cells.length>ONE){say('COPY UP TO '+ONE+' WALL CELLS AT A TIME ('+cells.length+' IN THAT BOX)');render();return;}X.clip=cells.length?{cells}:null;say(cells.length?'COPIED '+cells.length+' WALL CELLS · PASTE IS READY':'NO WALLS IN THAT BOX');if(cells.length)X.tool='paste';render();return;}
 if(X.tool==='erase'){const keys=d.cells.filter(([i,j])=>p.w[P.key(i,j)]).map(([i,j])=>P.key(i,j));if(keys.length>ONE){say('ERASE UP TO '+ONE+' WALL CELLS AT A TIME ('+keys.length+' IN THAT BOX)');X.erase=null;render();return;}X.erase=keys.length?{keys,sec:{k:'cells',c:keys.flatMap(k=>k.split(',').map(Number))}}:null;if(!keys.length)say('NO WALLS IN THAT BOX');render();return;}
 if(X.draft.length>=P.MAX_SECTIONS){say('CONFIRM THESE FIRST (UP TO '+P.MAX_SECTIONS+' SECTIONS AN ORDER)');render();return;}
 X.draft.push({sec:{k:X.tool,a:d.a,b:d.b,o:X.blend.o,l:X.blend.l}});autoPeek();render();}
function pasteAt(c){const p=plotOf();if(!X.clip||!p)return;const by=new Map();for(const [di,dj,code] of X.clip.cells){const i=c[0]+di,j=c[1]+dj;if(!P.inGrid(i,j))continue;if(!by.has(code))by.set(code,[]);by.get(code).push(i,j);}
 if(X.draft.length+by.size>P.MAX_SECTIONS){say('CONFIRM THE DRAFT FIRST (UP TO '+P.MAX_SECTIONS+' SECTIONS AN ORDER)');return;}for(const [code,flat] of by){const {o,l}=P.wdecode(code);X.draft.push({sec:{k:'cells',c:flat,o,l}});}autoPeek();say('PASTED · CONFIRM WALLS TO BUILD');render();}
function input(){const el=X.stage,pts=new Map();let start=null,moved=0,pinch=0,mid=null;
 const drawing=()=>X.tab==='walls'&&!X.pan&&!X.place&&!X.visit&&!X.drive?.on;
 el.addEventListener('pointerdown',e=>{if(e.target.closest?.('button,.cq-hs-stick'))return;   // map buttons and the drive stick sit on the map: tapping them never draws a wall cell
  if(X.tour){X.tour=null;X.glide=1;X.tourBtn?.remove();}
  el.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;
  if(pts.size===1){start={x:e.clientX,y:e.clientY,cx:X.cam.x,cz:X.cam.z,yaw:X.drive?.yaw,pitch:X.drive?.pitch};if(drawing())drawStart(cellAt(e.clientX,e.clientY));}
  else if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};start=null;if(X.draw){X.draw=null;holo();}}});
 const panBy=(dx,dy,cx,cz)=>{const k=X.cam.dist/((el.clientHeight||600)*.9),cs=Math.cos(X.cam.yaw),sn=Math.sin(X.cam.yaw),lim=(P.townH(plotOf()?.cc||1)+6)*P.GRID.cell;X.cam.x=Math.max(-lim,Math.min(lim,cx-(dx*cs+dy*sn)*k));X.cam.z=Math.max(-lim,Math.min(lim,cz-(-dx*sn+dy*cs)*k));};
 el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(X.drive?.on){if(pinch)X.drive.dist=Math.max(12,Math.min(70,X.drive.dist*pinch/d));pinch=d;return;}if(pinch)X.cam.dist=Math.max(45,Math.min(330,X.cam.dist*pinch/d));if(mid)panBy(m.x-mid.x,m.y-mid.y,X.cam.x,X.cam.z);pinch=d;mid=m;return;}
  if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;moved=Math.max(moved,Math.hypot(dx,dy));
  if(X.drive?.on){if(moved>6){X.drive.yaw=start.yaw-dx*.008;X.drive.pitch=Math.max(.12,Math.min(1.2,start.pitch+dy*.005));}return;}   // drive view: drag orbits around your tank
  if(drawing()){drawMove(cellAt(e.clientX,e.clientY));return;}
  if(moved>8)panBy(dx,dy,start.cx,start.cz);});
 const end=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);if(pts.size===0){if(drawing()&&X.draw)drawEnd();else if(start&&moved<8&&X.tab!=='walls')tap(e.clientX,e.clientY);else if(start&&moved<8&&X.drive?.on)tap(e.clientX,e.clientY);start=null;pinch=0;mid=null;}else if(pts.size===1)mid=null;};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('wheel',e=>{e.preventDefault();if(X.drive?.on){X.drive.dist=Math.max(12,Math.min(70,X.drive.dist*(e.deltaY>0?1.1:.9)));return;}X.cam.dist=Math.max(45,Math.min(330,X.cam.dist*(e.deltaY>0?1.1:.9)));},{passive:false});
 const tools=X.ctx.el('div','cq-plot-maptools',null,X.stage);
 const rot=X.ctx.button('⟲',()=>{X.cam.yaw=(X.cam.yaw+Math.PI/2)%(Math.PI*2);},'cq-plot-rot');rot.setAttribute('aria-label','Rotate view');tools.append(rot);
 const fr=X.ctx.button('⌖',()=>{frameTown(plotOf(),true);if(X.drive?.on){const d=X.drive;d.yaw=d.heading+Math.PI;d.pitch=.5;d.dist=32;}X.glide=.6;},'cq-plot-frame');fr.setAttribute('aria-label','Frame town');fr.title='FRAME TOWN';tools.append(fr);
 // In WALLS one finger draws; ✥ switches one finger to panning (two fingers always pan and pinch).
 const pan=X.ctx.button('✥',()=>{X.pan=!X.pan;pan.classList.toggle('on',X.pan);pan.setAttribute('aria-pressed',String(X.pan));},'cq-plot-pan');pan.setAttribute('aria-label','One finger pans the map');pan.setAttribute('aria-pressed','false');tools.append(pan);X.panBtn=pan;}

function tankBanner(view){const bn=view?.authority?.state?.plot?.banner,veh=view?.vehicle,S=view?.style;if(!veh||!S||view.renderer?.isConquestCanvas||!TK())return;const key=bn?JSON.stringify(bn):'';if(veh.userData.bannerKey===key)return;veh.userData.bannerKey=key;
 const old=veh.getObjectByName('cq-tank-banner');if(old){veh.remove(old);old.traverse(o=>o.geometry?.dispose?.());}if(!bn)return;const m=TK().kit(S).banner(bn,.42).mesh();m.name='cq-tank-banner';m.position.set(-2.1,1.1,-.9);m.rotation.y=Math.PI;m.userData.noPick=true;veh.add(m);}
root.ConquestPlotView=Object.freeze({open,close,frame,isOpen,render,get state(){return X;},probe:(x,z)=>X?hits(x,z):null,guideStep,unlockLine,tankBanner,bannerCanvas,townName,selectTab:t=>selectTab(t),snapTo:n=>{if(X){if(n==='closed')enterDrive(true);else if(X.drive?.on)enterDrive(false);snapTo(n);render();}}});
})(globalThis);
