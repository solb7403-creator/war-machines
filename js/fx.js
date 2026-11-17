'use strict';
// =====================================================================
// fx: phone vibration (Telegram haptics) + sound effects synthesized live (no audio files to download)
// =====================================================================
let lastHitFx=0;
function haptic(kind,style){
 if(!save||!save.haptics)return;
 try{const H=TG&&TG.HapticFeedback;if(!H)return;
  if(kind==='i')H.impactOccurred(style);else if(kind==='n')H.notificationOccurred(style);else H.selectionChanged();}catch(e){}
}
// ---- sound ----
// The mix (Session 5E-2b3): master (0.5) -> limiter -> speakers. Weapon shots, other tanks' shots and supers each have a bus, so
// a super can duck the gunfire for a moment and other tanks' fire sits under your own. A shared echo send gives the epic and
// legendary sounds their space without a reverb per sound.
let AC=null,master=null,noiseBuf=null,BUS=null;const lastSnd={};
function mkBuses(ctx,out){
 const g=v=>{const n=ctx.createGain();n.gain.value=v;return n;};
 const shot=g(1),other=g(0.62),sup=g(1),echo=g(1),eOut=g(0.55);
 shot.connect(out);sup.connect(out);
 const olp=ctx.createBiquadFilter();olp.type='lowpass';olp.frequency.value=5200;olp.Q.value=0.5;other.connect(olp);olp.connect(out);   // other tanks: a little further away
 // echo: two feedback delays (left 0.11 s, right 0.17 s) with a darkening loop
 try{const mk=(dt,pan)=>{const d=ctx.createDelay(0.5),lp=ctx.createBiquadFilter(),fb=g(0.34);d.delayTime.value=dt;lp.type='lowpass';lp.frequency.value=2300;
   echo.connect(d);d.connect(lp);lp.connect(fb);fb.connect(d);let o=lp;if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;lp.connect(p);o=p;}o.connect(eOut);};
  mk(0.11,-0.6);mk(0.17,0.6);eOut.connect(out);}catch(e){}
 return {shot,other,sup,echo,out};
}
function audioInit(){
 if(AC)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  try{if(navigator.audioSession)navigator.audioSession.type='ambient';}catch(e){}   // obey the silent switch, don't stop the player's music
  AC=new C();master=AC.createGain();master.gain.value=0.5;
  // a limiter at the end, so stacked explosions get loud without crackling
  let out=AC.destination;try{const L=AC.createDynamicsCompressor();L.threshold.value=-10;L.knee.value=6;L.ratio.value=12;L.attack.value=0.003;L.release.value=0.2;L.connect(AC.destination);out=L;}catch(e){}
  master.connect(out);BUS=mkBuses(AC,master);
 }catch(e){AC=null;BUS=null;}
}
// iOS only starts audio inside a tap. Every kind of first touch, click or key resumes it, and the first one also plays one silent
// sample (older iOS needs a sound started inside the gesture). An interrupted context (a call, Siri) comes back on the next tap.
function audioResume(){
 if(!save||save.sound===false)return;audioInit();if(!AC)return;
 if(AC.state!=='running')AC.resume().catch(()=>{});
 if(!AC.__unl){AC.__unl=1;try{const b=AC.createBuffer(1,1,22050),s=AC.createBufferSource();s.buffer=b;s.connect(AC.destination);s.start(0);}catch(e){}}
}
for(const ev of ['pointerdown','pointerup','touchend','click','keydown'])addEventListener(ev,audioResume,{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden){LW.stopAll();AC.suspend().catch(()=>{});}else if(save&&save.sound!==false)AC.resume().catch(()=>{});});
function noise(){
 if(!noiseBuf){noiseBuf=AC.createBuffer(1,Math.floor(AC.sampleRate*0.6),AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
 return noiseBuf;
}
function tone(f0,f1,dur,type,vol,delay){   // one oscillator with a pitch sweep
 const t=AC.currentTime+(delay||0),o=AC.createOscillator(),gn=AC.createGain();gn.gain.value=0;   // SPIKE: silent before its first event
 o.type=type||'square';o.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
 gn.gain.setValueAtTime(0.0001,t);gn.gain.exponentialRampToValueAtTime(vol,t+0.008);gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 o.connect(gn);gn.connect(master);o.start(t);o.stop(t+dur+0.03);
}
function burst(dur,vol,fc,delay){   // filtered noise: impacts, explosions, dust
 const t=AC.currentTime+(delay||0),s=AC.createBufferSource(),f=AC.createBiquadFilter(),gn=AC.createGain();gn.gain.value=0;   // SPIKE: silent before its first event
 s.buffer=noise();f.type='lowpass';f.frequency.setValueAtTime(fc,t);f.frequency.exponentialRampToValueAtTime(Math.max(60,fc*0.15),t+dur);
 gn.gain.setValueAtTime(vol,t);gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 s.connect(f);f.connect(gn);gn.connect(master);s.start(t);s.stop(t+dur+0.03);
}
// the game's other sounds (hits, kills, rewards, menus). Weapon shots and the Arcade's supers are LW below. Conquest's supers keep
// the timing-bar chimes jackpot / supgood / supmiss and 'super' / 'impact' exactly as before (owner: Conquest supers unchanged).
const SND={
 hit:()=>burst(0.05,0.07,1800),
 crit:()=>{tone(1500,2300,0.07,'triangle',0.05);burst(0.05,0.07,2600);},
 hurt:()=>tone(210,110,0.11,'sawtooth',0.09),   // 0.05 -> 0.09 (5E-2b3): audible over your own, now fuller, gunfire
 boom:()=>{burst(0.45,0.18,1100);tone(110,40,0.4,'sine',0.14);},
 kill:()=>{burst(0.5,0.24,1400);tone(130,40,0.45,'sine',0.17);tone(660,990,0.12,'triangle',0.05,0.1);},
 die:()=>{burst(0.55,0.24,900);tone(280,60,0.65,'sawtooth',0.08);},
 ready:()=>tone(320,1250,0.35,'sawtooth',0.04),
 super:()=>{burst(0.08,0.32,7000);tone(62,30,0.55,'sine',0.34);tone(190,48,0.28,'sawtooth',0.1);burst(0.45,0.16,1800,0.05);},
 jackpot:()=>{tone(660,660,0.09,'triangle',0.09);tone(880,880,0.09,'triangle',0.09,0.07);tone(1320,1760,0.28,'triangle',0.10,0.14);tone(90,40,0.4,'sine',0.3);burst(0.12,0.2,6000);},
 supgood:()=>{tone(740,980,0.1,'triangle',0.07);burst(0.05,0.08,3000);},
 supmiss:()=>tone(240,120,0.18,'sawtooth',0.06),
 impact:()=>{tone(78,26,0.7,'sine',0.42);burst(0.1,0.38,5200);burst(0.75,0.24,1300,0.03);tone(260,55,0.2,'square',0.06);},
 box:()=>{tone(880,880,0.07,'triangle',0.07);tone(1320,1320,0.12,'triangle',0.07,0.07);},
 cap:()=>{tone(523,523,0.1,'triangle',0.07);tone(784,784,0.16,'triangle',0.07,0.09);},
 warn:()=>tone(980,980,0.05,'square',0.025),
 meteor:()=>{burst(0.42,0.2,850);tone(85,35,0.38,'sine',0.14);},
 crate:()=>{burst(0.22,0.14,1500);tone(210,90,0.18,'triangle',0.05);},
 dash:()=>burst(0.16,0.1,2800),
 event:()=>{tone(660,660,0.11,'square',0.04);tone(880,880,0.14,'square',0.04,0.16);},
 win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,f,0.18,'triangle',0.08,i*0.1)),
 lose:()=>[392,330,262].forEach((f,i)=>tone(f,f*0.97,0.22,'triangle',0.07,i*0.14)),
 draw:()=>{tone(440,440,0.18,'triangle',0.06);tone(440,440,0.18,'triangle',0.06,0.2);},
 tap:()=>tone(1150,950,0.03,'sine',0.025),
 claim:()=>{tone(988,988,0.07,'triangle',0.07);tone(1319,1319,0.14,'triangle',0.07,0.06);},
 crystal:()=>{tone(1568,1568,0.06,'sine',0.06);tone(2093,2093,0.1,'sine',0.05,0.05);},
 buy:()=>[659,880,1175].forEach((f,i)=>tone(f,f,0.12,'triangle',0.07,i*0.07)),
 // Session 6: Conquest loot by rarity (the Arcade ladder's language: each step adds a layer). 0 common .. 4 legendary
 loot0:()=>{tone(880,1046,0.07,'triangle',0.05);},
 loot1:()=>{tone(784,1046,0.08,'triangle',0.06);tone(1318,1318,0.1,'sine',0.04,0.06);},
 loot2:()=>{tone(988,1318,0.09,'triangle',0.07);tone(1568,2093,0.16,'sine',0.05,0.07);burst(0.06,0.05,5200,0.02);},
 loot3:()=>{[784,988,1318].forEach((f,i)=>tone(f,f,0.16,'triangle',0.06,i*0.06));tone(2093,2637,0.3,'sine',0.045,0.2);tone(110,55,0.3,'sine',0.08);},
 loot4:()=>{[659,880,1175,1568].forEach((f,i)=>tone(f,f,0.18,'triangle',0.07,i*0.07));tone(2349,3136,0.45,'sine',0.05,0.3);tone(90,40,0.45,'sine',0.16);burst(0.14,0.14,6500,0.05);},
 // Session 6B research mods (rules.js MOD_CUE): one sound per behavior, each its own shape, so a pilot hears which mod fired
 mVent:()=>{burst(0.32,0.2,950);tone(150,55,0.32,'sawtooth',0.09);burst(0.12,0.08,4200,0.03);},                 // thermal: a heavy vent whump
 mOver:()=>{tone(380,1500,0.42,'sawtooth',0.045);tone(760,3000,0.42,'sine',0.02);},                                // a rising breech whine
 mCool:()=>{burst(0.55,0.05,3200);tone(900,300,0.5,'sine',0.02);},                                                 // a cooling hiss
 mInferno:()=>{burst(0.65,0.14,1500);tone(85,190,0.55,'sawtooth',0.07);burst(0.4,0.07,5200,0.15);},               // ignition roar
 mRing:()=>{burst(0.42,0.2,1100);tone(230,70,0.36,'triangle',0.1);burst(0.25,0.06,6000,0.08);},                    // a heat ring: boom and sizzle
 mPierce:()=>{tone(2600,1700,0.05,'square',0.03);burst(0.07,0.06,7000);},                                          // ballistics: glass-crack through a shield
 mCrit:()=>{tone(1760,2640,0.09,'triangle',0.07);tone(3520,3520,0.05,'sine',0.03,0.04);},                           // a bright sure-crit ping
 mRail:()=>{tone(3200,280,0.13,'sawtooth',0.06);burst(0.09,0.12,8500);},                                            // an electric rail crack
 mTraction:()=>{tone(110,430,0.36,'sawtooth',0.06);burst(0.2,0.05,2400,0.05);},                                    // drive: an engine rev
 mRam:()=>{burst(0.26,0.24,700);tone(95,42,0.32,'square',0.1);},                                                    // a heavy ram clang
 mMomentum:()=>{tone(300,640,0.22,'sine',0.04);},                                                                   // a soft rising whoosh
 mDash2:()=>{tone(700,1150,0.08,'triangle',0.05);},                                                                 // a dash charge chirp
 mCharge:()=>{tone(110,220,0.4,'sine',0.04);tone(330,440,0.4,'sine',0.015);},                                       // field: a capacitor hum
 mReflect:()=>{tone(1900,620,0.1,'square',0.04);},                                                                  // a reflected zap
 mReflex:()=>{tone(520,1560,0.12,'triangle',0.07);burst(0.08,0.06,5000);},                                          // a shield snapping up
 mAegis:()=>{[1320,1760,2093].forEach((f,i)=>tone(f,f*1.01,0.16,'sine',0.04,i*0.05));},                             // an overshield shimmer
 mBreak:()=>{burst(0.22,0.1,5200);tone(1400,500,0.18,'triangle',0.03);},                                            // the overshield breaking
 // Session 6B UI and reward sounds (Conquest and the garage)
 rsDone:()=>{[523,659,784,1047,1319].forEach((f,i)=>tone(f,f,0.2,'triangle',0.07,i*0.08));tone(2093,2794,0.5,'sine',0.045,0.4);tone(65,33,0.6,'sine',0.14,0.05);burst(0.2,0.08,6500,0.38);},   // research complete: a rising fanfare
 rsStart:()=>{tone(440,880,0.16,'triangle',0.05);tone(660,1320,0.2,'sine',0.03,0.08);},                                                                      // a research job starts
 bank:()=>{[784,988,1175].forEach((f,i)=>tone(f,f,0.1,'triangle',0.06,i*0.05));burst(0.08,0.06,3000,0.12);},                                                  // salvage banked: coins in the vault
 built:()=>{burst(0.18,0.14,900);tone(196,392,0.25,'square',0.05,0.05);[523,784].forEach((f,i)=>tone(f,f,0.16,'triangle',0.06,0.18+i*0.08));},                // a build complete: thunk, then a chime
 plate:()=>{burst(0.14,0.18,1300);tone(140,70,0.2,'square',0.08);tone(1046,1046,0.18,'triangle',0.05,0.12);},                                                 // a plate mounted: a heavy clamp, then a click
 order:()=>{[659,880,1319].forEach((f,i)=>tone(f,f,0.14,'triangle',0.07,i*0.07));tone(1760,2093,0.3,'sine',0.04,0.2);},                                       // a War Order claimed
 // stingers: short musical moments for raids, invasions, strikes and victories
 stRaid:()=>{[220,262,330].forEach((f,i)=>tone(f,f*0.98,0.24,'sawtooth',0.05,i*0.12));tone(55,40,0.7,'sine',0.14);},
 stInvade:()=>{[330,311,294,277].forEach((f,i)=>tone(f,f,0.18,'square',0.035,i*0.14));tone(70,45,0.8,'sine',0.16);burst(0.5,0.08,800,0.1);},
 stStrike:()=>{tone(1200,200,0.7,'sawtooth',0.05);burst(0.9,0.16,700,0.3);tone(60,30,0.9,'sine',0.18,0.3);},
 stVictory:()=>{[392,523,659,784,1047].forEach((f,i)=>tone(f,f,0.24,'triangle',0.08,i*0.11));tone(1568,2093,0.6,'sine',0.05,0.55);tone(98,49,0.8,'sine',0.12,0.2);}};
const SND_GAP={impact:0.09,crystal:0.05,hit:0.05,crit:0.05,hurt:0.12,warn:0.12,boom:0.08,meteor:0.08,dash:0.1,mPierce:0.25,mReflect:0.25,mCrit:0.2,mRail:0.15,mRing:0.2,mCharge:1,mMomentum:1,mCool:0.5};

// =====================================================================
// LW: every weapon's shot and every Arcade super, synthesized (Session 5E-2b3, owner Nov 14 2026).
// Owner rules: each weapon its own sound; the Moonbeam an electrical laser, Moonfall a hyper-power electromagnet cannon loading
// up; guns that shoot physical rounds sound like guns (Twin Repeater, Siege Breaker), bombs like bombs (Siege Blast, Rail Blast,
// Titanfall). Rarity ladder: rare richer than common, epic richer than rare, Moonfall the most powerful sound of all; each weapon
// line keeps its identity (the same core layers) and a higher rarity ADDS layers on top. A super follows the timing bar: a miss is
// thinner (one layer fewer, duller, shorter, no echo), a normal hit is full, a jackpot the biggest and most layered.
// SPIKE (found by dev/tests/weapon-sounds.cjs): a GainNode holds its default 1.0 until its first automation event. When a source's
// start and that first event round to different samples (any start time like 0.29000000000000004 s) one sample goes out at full
// level: a click 6x louder than the sound. Every envelope here (and tone / burst above) is set to 0 before it is scheduled.
// A sound is a voice: a set of layers (oscillators and filtered noise, each with its own envelope) into one gain, then a bus.
// Keys are the weapon items: pulse0..2 (Pulse Cannon, Arc Pulse, Nova Pulse), twin0..2 (Twin, Storm, Helix Repeater),
// siege0..2 (Siege Breaker, Rail Breaker, Titanfall), moon (Moonbeam); the same keys name the ten supers (rules.js SUP_KEYS).
// LW.render() plays any of them into another context (dev/tests/weapon-sounds.py renders them offline and measures them).
// =====================================================================
const LW=(()=>{
 const FAM={pulse:'lance',twin:'nova',siege:'shell',moon:'moon'};
 const tierOf=k=>k==='moon'?3:Math.max(0,Math.min(2,+String(k).slice(-1)||0)),archOf=k=>k==='moon'?'moon':String(k).replace(/\d$/,'');
 // per-context assets, made once: white, brown and crackle noise (seeded, so offline renders repeat) and a soft-clip curve
 function assets(ctx){
  if(ctx.__lw)return ctx.__lw;
  let s=0x2f6b1d;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  const sr=ctx.sampleRate,buf=(sec,fill)=>{const b=ctx.createBuffer(1,Math.max(1,Math.floor(sr*sec)),sr);fill(b.getChannelData(0));return b;};
  const white=buf(1.5,d=>{for(let i=0;i<d.length;i++)d[i]=r()*2-1;});
  const brown=buf(2,d=>{let b=0;for(let i=0;i<d.length;i++){b=(b+0.02*(r()*2-1))/1.02;d[i]=b*3.5;}});
  const crk=buf(1.5,d=>{let i=0;while(i<d.length){i+=Math.floor(sr*(0.0015+r()*0.012));const a=(r()<0.5?-1:1)*(0.35+r()*0.65),n=Math.floor(sr*(0.0003+r()*0.0012));for(let j=0;j<n&&i+j<d.length;j++)d[i+j]=a*(1-j/n)*(0.5+r()*0.5);}});
  const curve=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/511.5-1;curve[i]=Math.tanh(2.6*x)/Math.tanh(2.6);}
  return ctx.__lw={white,brown,crk,curve};
 }
 // a voice: layers -> gain (g) -> optional dulling lowpass (a miss) -> bus, plus an echo send. ds stretches every layer's tail
 function voice(ctx,bus,t,o){
  o=o||{};const V={ctx,A:assets(ctx),t,ds:o.ds||1,srcs:[],gains:[],end:t,rnd:o.rnd||Math.random,n:0,alt:o.alt,jit:o.jit||1,stopped:false};
  V.in=ctx.createGain();V.in.gain.value=o.g||1;let head=V.in;
  if(o.lp){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;f.Q.value=0.5;V.in.connect(f);head=f;}
  head.connect(bus.node);
  if(o.echo&&bus.echo){const e=ctx.createGain();e.gain.value=o.echo;head.connect(e);e.connect(bus.echo);}
  return V;
 }
 const LN=V=>{V.n++;};   // layer count (the rarity-ladder test reads it)
 function envG(V,t,a,d,v,p){
  const g=V.ctx.createGain(),q=g.gain,pk=Math.max(0.0002,v);q.value=0;   // silent until its first event (SPIKE, above)
  q.setValueAtTime(Math.max(0.0001,pk*(p.from||0)),t);q.exponentialRampToValueAtTime(pk,t+a);
  if(p.hold)q.setValueAtTime(pk,t+a+p.hold);
  q.exponentialRampToValueAtTime(0.0001,t+a+(p.hold||0)+d);V.gains.push(g);return g;
 }
 function into(V,node,pan){
  if(pan&&V.ctx.createStereoPanner){const p=V.ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));node.connect(p);p.connect(V.in);return p;}
  node.connect(V.in);return null;
 }
 function track(V,src,t1){V.srcs.push(src);if(t1>V.end)V.end=t1;}
 function filt(V,n,p,t,a,d){
  const ty=p.lp?'lowpass':p.bp?'bandpass':p.hp?'highpass':null;if(!ty)return n;
  const f=V.ctx.createBiquadFilter();f.type=ty;f.frequency.setValueAtTime(p.lp||p.bp||p.hp,t);if(p.fq1)f.frequency.exponentialRampToValueAtTime(p.fq1,t+(p.fqd||a+d));f.Q.value=p.q||0.7;
  if(p.flfo)lfo(V,f.frequency,p.flfo,t,a+(p.hold||0)+d);n.connect(f);return f;
 }
 function sat(V,n,k){if(!k)return n;const pg=V.ctx.createGain(),w=V.ctx.createWaveShaper();pg.gain.value=k;w.curve=V.A.curve;n.connect(pg);pg.connect(w);return w;}
 // an LFO on any parameter: rate f0 -> f1 over the layer, depth dp (in the parameter's own units)
 function lfo(V,param,L,t,len){
  const o=V.ctx.createOscillator(),g=V.ctx.createGain();o.type=L.type||'sine';o.frequency.setValueAtTime(L.f0,t);if(L.f1&&L.f1!==L.f0)o.frequency.exponentialRampToValueAtTime(L.f1,t+(L.d||len));
  g.gain.value=L.dp;o.connect(g);g.connect(param);o.start(t);o.stop(t+len+0.05);track(V,o,t+len+0.05);
 }
 // amplitude pulsing: a gain swinging between 1-2*dp and 1
 function am(V,n,L,t,len){if(!L)return n;const g=V.ctx.createGain();g.gain.value=1-L.dp;lfo(V,g.gain,L,t,len);n.connect(g);return g;}
 // an oscillator layer: pitch f0 -> f1 (exponential, over fd), optional FM {r: ratio, i0 -> i1: index in Hz}, filter, soft clip
 function O(V,p){
  const c=V.ctx,t=V.t+(p.t||0),a=p.a||0.003,d=(p.d||0.1)*V.ds,len=a+(p.hold||0)+d,o=c.createOscillator();o.type=p.type||'sine';
  const f0=p.f0*(p.jit===false?1:V.jit),f1=(p.f1||p.f0)*(p.jit===false?1:V.jit),fd=p.fd||len;
  o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(10,f1),t+fd);if(p.det)o.detune.value=p.det;
  if(p.fm){const m=c.createOscillator(),mg=c.createGain();m.type=p.fm.type||'sine';m.frequency.setValueAtTime(f0*p.fm.r,t);if(f1!==f0)m.frequency.exponentialRampToValueAtTime(Math.max(10,f1*p.fm.r),t+fd);
   mg.gain.setValueAtTime(Math.max(1,p.fm.i0),t);mg.gain.exponentialRampToValueAtTime(Math.max(1,p.fm.i1||1),t+(p.fm.d||len));m.connect(mg);mg.connect(o.frequency);m.start(t);m.stop(t+len+0.05);track(V,m,t+len+0.05);}
  if(p.vib)lfo(V,o.frequency,p.vib,t,len);
  let n=filt(V,o,p,t,a,d);n=sat(V,n,p.sat);n=am(V,n,p.am,t,len);
  const g=envG(V,t,a,d,p.v,p);n.connect(g);const pn=into(V,g,p.pan);if(pn&&p.plfo)lfo(V,pn.pan,p.plfo,t,len);
  o.start(t);o.stop(t+len+0.05);track(V,o,t+len+0.05);LN(V);return g;
 }
 // a noise layer: white, brown or crackle (buf), through a filter that can sweep (f0 -> f1); rate: playback speed (crackle density)
 function N(V,p){
  const c=V.ctx,t=V.t+(p.t||0),a=p.a||0.002,d=(p.d||0.1)*V.ds,len=a+(p.hold||0)+d,s=c.createBufferSource(),B=V.A[p.buf||'white'];
  s.buffer=B;s.loop=true;if(p.rate){s.playbackRate.setValueAtTime(p.rate,t);if(p.rate1)s.playbackRate.exponentialRampToValueAtTime(p.rate1,t+(p.rd||len));}
  const f=c.createBiquadFilter();f.type=p.ft||'lowpass';f.frequency.setValueAtTime(p.f0||2000,t);if(p.f1)f.frequency.exponentialRampToValueAtTime(p.f1,t+(p.fd||len));f.Q.value=p.q||0.7;s.connect(f);
  if(p.flfo)lfo(V,f.frequency,p.flfo,t,len);
  let n=sat(V,f,p.sat);n=am(V,n,p.am,t,len);
  const g=envG(V,t,a,d,p.v,p);n.connect(g);const pn=into(V,g,p.pan);if(pn&&p.plfo)lfo(V,pn.pan,p.plfo,t,len);
  s.start(t,V.rnd()*(B.duration*0.8));s.stop(t+len+0.05);track(V,s,t+len+0.05);LN(V);return g;
 }
 // ---------------- weapon shots ----------------
 const SHOT={
  // Pulse Cannon line: an energy bolt ("thwump-pew"). Arc Pulse adds an arc of electricity; Nova Pulse a star-bright FM ring and a bass punch
  pulse:(V,t)=>{
   O(V,{type:'square',f0:560,f1:150,d:0.1,v:0.07,lp:2600});
   O(V,{type:'sawtooth',f0:566,f1:152,d:0.09,v:0.026,lp:1800});
   N(V,{ft:'bandpass',f0:2200,f1:700,q:0.9,d:0.06,v:0.06});
   O(V,{f0:1700,f1:900,d:0.02,v:0.02});
   if(t>=1){N(V,{buf:'crk',ft:'bandpass',f0:3400,q:1.2,d:0.09,v:0.24,rate:1.2});O(V,{f0:2900,f1:2300,d:0.05,v:0.03,fm:{r:3.1,i0:1800,i1:200}});}
   if(t>=2){O(V,{f0:2600,f1:2500,d:0.18,v:0.026,fm:{r:1.41,i0:2400,i1:60}});O(V,{f0:120,f1:50,d:0.12,v:0.08,sat:2});}
  },
  // Twin Repeater line: a gun (tracer rounds). Short and dry so rapid fire stays crisp; the two barrels alternate left and right and
  // every round is pitched a little differently. Storm Repeater adds a heavier body, the bolt's metal tick and a charged-tracer fizz;
  // Helix Repeater a rotary whirr and a bass punch
  twin:(V,t)=>{
   const p=V.alt?0.16:-0.16;
   N(V,{ft:'highpass',f0:2400,d:0.026,v:0.2,a:0.0008,pan:p});
   N(V,{ft:'bandpass',f0:V.alt?950:820,q:1.3,d:0.05,v:0.16,pan:p});
   O(V,{f0:190,f1:90,d:0.04,v:0.13,sat:1.5});
   if(t>=1){O(V,{type:'square',f0:3300,d:0.008,v:0.05,t:0.012,hp:2000});N(V,{ft:'bandpass',f0:700,q:1.2,d:0.06,v:0.15});N(V,{buf:'crk',ft:'highpass',f0:4200,d:0.035,v:0.2});}
   if(t>=2){O(V,{type:'sawtooth',f0:420,f1:560,d:0.05,v:0.09,bp:900,q:2});O(V,{f0:130,f1:60,d:0.05,v:0.2,sat:2});N(V,{ft:'highpass',f0:7000,d:0.02,v:0.08,pan:-p});}
  },
  // Siege Breaker line: a heavy cannon. Rail Breaker adds the rail's electric zing and a crackle; Titanfall a golden metal ring,
  // sub-bass, falling grit and an echo
  siege:(V,t)=>{
   N(V,{f0:3200,f1:380,d:0.22,v:0.12,a:0.001});
   O(V,{f0:155,f1:48,d:0.28,v:0.13,sat:2.4});
   N(V,{ft:'highpass',f0:3000,d:0.016,v:0.065,a:0.0005});
   O(V,{type:'triangle',f0:270,f1:180,d:0.06,v:0.036,t:0.09});
   if(t>=1){O(V,{f0:3400,f1:1500,d:0.08,v:0.06,fm:{r:2,i0:900,i1:40}});N(V,{buf:'crk',ft:'bandpass',f0:2600,q:1.2,d:0.09,v:0.16});}
   if(t>=2){O(V,{f0:190,d:0.45,v:0.042,fm:{r:2.76,i0:700,i1:40}});O(V,{f0:72,f1:32,d:0.4,v:0.11,sat:2.2});N(V,{buf:'crk',f0:1200,d:0.25,v:0.035,rate:0.5,t:0.04});}
  },
  // Moonbeam (legendary): an electrical laser. An FM laser sweep, an electric bite, crackling arcs (a coarse and a fine band), a power
  // hum on a fifth, a bass body, a buzzing tail and a stereo shimmer: the richest shot in the game
  moon:V=>{
   O(V,{f0:1850,f1:620,d:0.13,v:0.085,fm:{r:1.5,i0:650,i1:40}});
   O(V,{type:'sawtooth',f0:3200,f1:900,d:0.06,v:0.035,bp:2600,q:1.2});
   N(V,{buf:'crk',ft:'highpass',f0:2400,d:0.12,v:0.085,rate:1.4});
   N(V,{buf:'crk',ft:'bandpass',f0:6000,q:1.5,d:0.07,v:0.05,rate:2});
   O(V,{type:'sawtooth',f0:98,d:0.12,v:0.05,lp:900});O(V,{type:'sawtooth',f0:147,d:0.1,v:0.03,lp:900});
   O(V,{f0:140,f1:60,d:0.1,v:0.07,sat:1.8});
   O(V,{type:'sawtooth',f0:600,f1:300,d:0.08,v:0.022,bp:1200,q:1.5,t:0.03});
   O(V,{f0:4400,d:0.09,v:0.016,pan:-0.35,jit:false});O(V,{f0:4412,d:0.09,v:0.016,pan:0.35,jit:false});
  }};
 const SHOT_ECHO={pulse:[0,0,0.12],twin:[0,0,0],siege:[0,0.06,0.22],moon:[0.12]};   // no echo on rapid fire: it would smear
 // shot levels: your own fire is the most frequent sound in a match, so it sits under the damage cues (the 'hurt' sound stays within
 // a few dB of a Pulse shot, kills and supers above it: dev/tests/weapon-sounds.cjs). Twin fires ~11 rounds a second: each quieter
 const SHOT_G={pulse:0.63,twin:0.39,siege:0.66,moon:0.63};
 // where your own hits land: each weapon its own small confirmation (crits add the crit sparkle)
 const HIT={pulse:V=>{N(V,{ft:'bandpass',f0:1800,q:1,d:0.045,v:0.1});O(V,{f0:900,f1:400,d:0.045,v:0.04});},
  twin:V=>{N(V,{ft:'highpass',f0:3000,d:0.02,v:0.06});O(V,{type:'square',f0:2600,d:0.006,v:0.014,hp:1500});},
  siege:V=>{N(V,{f0:1400,f1:300,d:0.09,v:0.09});O(V,{f0:140,f1:70,d:0.08,v:0.07,sat:1.6});},
  moon:V=>{N(V,{buf:'crk',ft:'highpass',f0:3000,d:0.06,v:0.1,rate:1.3});O(V,{f0:2200,f1:1400,d:0.045,v:0.035});}};
 // ---------------- supers: charge (from the press), lock (the bar's verdict), fire, impact ----------------
 // T: the longest charge (the whole sweep and the release, rules.js SUP_BAR_T + SUP_REL); a voice is cut when its super fires
 const T=0.87;
 const CHARGE={
  // Pierce / Arc / Sunlance: a rail capacitor filling. Arc Lance adds arcing; Sunlance a rising solar chord and a sub swell
  lance:(V,t)=>{
   O(V,{f0:220,f1:1900,fd:T,a:T,d:0.5,v:0.06,from:0.08,am:{f0:8,f1:32,dp:0.45}});
   O(V,{type:'sawtooth',f0:70,f1:90,fd:T,a:T*0.7,d:0.6,v:0.055,from:0.1,lp:300,fq1:1400,fqd:T});
   if(t>=1){N(V,{buf:'crk',ft:'bandpass',f0:3000,q:1.2,a:T,d:0.4,v:0.26,from:0.05,rate:0.6,rate1:1.8});N(V,{ft:'bandpass',f0:3600,q:2,a:T,d:0.3,v:0.07,from:0.05,am:{type:'square',f0:20,f1:70,dp:0.5}});}
   if(t>=2){for(const [f,dt] of [[220,-6],[330,5],[440,0]])O(V,{type:'sawtooth',f0:f,a:T,d:0.5,v:0.02,det:dt,from:0.05,lp:600,fq1:3400,fqd:T});O(V,{f0:55,a:T,d:0.5,v:0.08,from:0.05,sat:1.6});}
  },
  // Static / Storm / Helix Nova: static building up around the hull. Storm adds a thunder roll; Helix a spiralling, swirling sweep
  nova:(V,t)=>{
   N(V,{ft:'bandpass',f0:400,f1:4000,fd:T,q:3,a:T,d:0.4,v:0.09,from:0.25});
   N(V,{buf:'crk',ft:'highpass',f0:1800,a:T,d:0.35,v:0.09,from:0.15,rate:0.5,rate1:2});
   O(V,{type:'square',f0:60,f1:120,fd:T,a:T,d:0.3,v:0.04,from:0.2,lp:420});
   if(t>=1)N(V,{buf:'brown',f0:300,a:T,d:0.6,v:0.22,from:0.1});
   if(t>=2){O(V,{type:'sawtooth',f0:300,f1:420,fd:T,a:T,d:0.4,v:0.12,from:0.1,bp:1200,q:3,flfo:{f0:3,f1:9,dp:700},plfo:{f0:2,f1:6,dp:0.7},pan:0.01});
    O(V,{type:'sawtooth',f0:302,f1:423,fd:T,a:T,d:0.4,v:0.09,from:0.1,bp:1800,q:3,flfo:{f0:4,f1:11,dp:600}});}
  },
  // Siege / Rail Blast / Titanfall: the big shell is loaded: two breech clanks and a hydraulic whine. Rail Blast adds the rail charging;
  // Titanfall a swelling golden gong and a sub swell
  shell:(V,t)=>{
   O(V,{type:'triangle',f0:180,f1:150,d:0.08,v:0.09});N(V,{ft:'bandpass',f0:1200,q:1.2,d:0.05,v:0.07});
   O(V,{type:'triangle',f0:140,f1:110,d:0.09,v:0.095,t:0.28});N(V,{ft:'bandpass',f0:900,q:1.2,d:0.06,v:0.07,t:0.28});
   O(V,{type:'sawtooth',f0:90,f1:260,fd:T,a:T,d:0.3,v:0.036,from:0.15,lp:500});
   if(t>=1){O(V,{f0:400,f1:2600,fd:T,a:T,d:0.3,v:0.055,from:0.05});N(V,{buf:'crk',ft:'bandpass',f0:2800,q:1.2,a:T,d:0.3,v:0.15,from:0.05,rate:0.7,rate1:1.6});}
   if(t>=2){O(V,{f0:110,a:T,d:0.6,v:0.05,from:0.03,fm:{r:1.99,i0:80,i1:420,d:T}});O(V,{f0:45,a:T,d:0.5,v:0.08,from:0.05,sat:1.8});}
  },
  // Moonfall: a hyper-power electromagnet cannon loading up. An electromagnetic hum climbing an octave as its filter opens, the magnet's
  // whine rising, capacitor pulses quickening, electric arcs thickening, a pulsing magnetic sub ("wub") and a lunar shimmer climbing
  moon:V=>{
   O(V,{type:'sawtooth',f0:55,f1:110,fd:T,a:T,d:0.5,v:0.1,from:0.25,lp:200,fq1:1600,fqd:T,sat:1.4});
   O(V,{type:'square',f0:55.5,f1:111,fd:T,a:T,d:0.5,v:0.045,from:0.25,lp:240,fq1:1200,fqd:T});
   O(V,{f0:180,f1:3200,fd:T,a:T,d:0.4,v:0.055,from:0.3});
   N(V,{ft:'bandpass',f0:1500,q:2,a:T,d:0.3,v:0.07,from:0.2,am:{type:'square',f0:6,f1:40,dp:0.5}});
   N(V,{buf:'crk',ft:'bandpass',f0:3500,q:1.2,a:T,d:0.4,v:0.09,from:0.1,rate:0.6,rate1:2.2});
   O(V,{f0:40,f1:52,fd:T,a:T,d:0.5,v:0.1,from:0.2,sat:2,am:{f0:4,f1:12,dp:0.45}});
   O(V,{f0:2200,f1:4400,fd:T,a:T,d:0.4,v:0.024,from:0.1,pan:-0.4,jit:false});O(V,{f0:2207,f1:4414,fd:T,a:T,d:0.4,v:0.024,from:0.1,pan:0.4,jit:false});
  }};
 // the timing bar's verdict, in the family's own voice: a miss drops dull, a hit clacks and chimes, a jackpot rings gold with a
 // power surge and a bass thump
 function lock(V,fam,oc){
  if(oc===0){O(V,{type:'triangle',f0:300,f1:120,d:0.2,v:0.08});N(V,{f0:900,f1:300,d:0.12,v:0.04});}
  else{N(V,{ft:'bandpass',f0:2600,q:1.4,d:0.03,v:0.08});O(V,{type:'triangle',f0:oc===2?1320:880,d:oc===2?0.28:0.13,v:0.06,jit:false});O(V,{f0:oc===2?2640:1760,d:0.06,v:0.02,jit:false});
   if(oc===2){O(V,{type:'triangle',f0:1760,d:0.3,v:0.06,t:0.05,jit:false});O(V,{f0:2640,d:0.3,v:0.025,t:0.08,fm:{r:1.5,i0:900,i1:20},jit:false});
    O(V,{type:'sawtooth',f0:110,f1:440,d:0.22,v:0.04,lp:500,fq1:3000});O(V,{f0:92,f1:40,d:0.3,v:0.15,sat:2});}}
  if(fam==='lance')O(V,{type:'square',f0:2200,d:0.012,v:0.03,hp:1200});
  else if(fam==='nova')N(V,{buf:'crk',ft:'highpass',f0:2500,d:0.06,v:0.06});
  else if(fam==='shell')O(V,{type:'triangle',f0:160,f1:120,d:0.07,v:0.07});
  else{O(V,{f0:72,f1:48,d:0.14,v:0.1,sat:1.8});N(V,{ft:'bandpass',f0:420,q:1,d:0.09,v:0.06});}
 }
 // fire. t: the item's rarity (every rarity layer plays at every outcome); a miss loses the crack and 40% of its punch (pk);
 // oc 2 adds the jackpot layers
 const FIRE={
  lance:(V,t,oc)=>{   // a rail beam: crack, an FM discharge, the beam's roar, a thump. Arc Lance: arcs along the beam; Sunlance: a solar flare chord and a shimmer
   const pk=oc>0?1:0.6;if(oc>0)N(V,{ft:'highpass',f0:2000,d:0.03,v:0.17,a:0.0008});
   O(V,{f0:1400,f1:300,d:0.25,v:0.11,fm:{r:2,i0:800,i1:100}});
   O(V,{type:'sawtooth',f0:90,d:0.45,v:0.08,lp:2400,fq1:500});O(V,{type:'sawtooth',f0:91.5,d:0.42,v:0.055,lp:2000,fq1:450});
   O(V,{f0:120,f1:45,d:0.25,v:0.2*pk,sat:2.2});
   if(t>=1){N(V,{ft:'bandpass',f0:3800,q:2,d:0.4,v:0.22,am:{type:'square',f0:60,f1:35,dp:0.5}});N(V,{buf:'crk',ft:'bandpass',f0:3000,q:1.2,d:0.4,v:0.4,rate:1.4});N(V,{buf:'crk',ft:'highpass',f0:6500,d:0.3,v:0.3,rate:2.2,pan:0.25});O(V,{f0:1100,f1:700,d:0.3,v:0.05,fm:{r:3.3,i0:3000,i1:300},pan:-0.25});}
   if(t>=2){for(const [f,dt] of [[220,-6],[330,5],[440,0]])O(V,{type:'sawtooth',f0:f,d:0.5,v:0.034,det:dt,lp:4000,fq1:800});O(V,{f0:3300,d:0.35,v:0.04,fm:{r:1.41,i0:2600,i1:40},jit:false});}
   if(oc===2){N(V,{ft:'highpass',f0:4500,d:0.06,v:0.09,t:0.01});O(V,{f0:2640,d:0.45,v:0.033,fm:{r:1.5,i0:1800,i1:30},jit:false});O(V,{f0:70,f1:30,d:0.5,v:0.17,sat:2});}
  },
  nova:(V,t,oc)=>{   // an electric discharge, the shockwave whooshing out, a thump, a buzz. Storm Nova: thunder; Helix Nova: a spiral sweep
   const pk=oc>0?1:0.6;N(V,{ft:'bandpass',f0:2000,q:0.8,d:0.12,v:0.2});if(oc>0)N(V,{buf:'crk',ft:'highpass',f0:1500,d:0.25,v:0.14,rate:1.3});
   N(V,{ft:'bandpass',f0:3000,f1:300,q:1.5,d:0.4,v:0.13});
   O(V,{f0:110,f1:40,d:0.3,v:0.24*pk,sat:2.2});
   O(V,{type:'square',f0:120,d:0.2,v:0.05,bp:900,q:1.5});O(V,{type:'square',f0:121.5,d:0.2,v:0.04,bp:900,q:1.5});
   if(t>=1){N(V,{buf:'brown',f0:420,f1:200,d:0.9,v:0.32,a:0.02});N(V,{ft:'highpass',f0:2500,d:0.05,v:0.16,t:0.07});}
   if(t>=2){O(V,{f0:4200,f1:2800,d:0.5,v:0.05,vib:{f0:9,f1:4,dp:400},plfo:{f0:7,f1:3,dp:0.9},pan:0.01});N(V,{ft:'highpass',f0:6500,d:0.45,v:0.12,plfo:{f0:5,f1:2,dp:0.9},pan:0.01});
    O(V,{type:'sawtooth',f0:600,f1:300,d:0.55,v:0.2,bp:1400,q:3,flfo:{f0:9,f1:3,dp:900},plfo:{f0:6,f1:2,dp:0.8},pan:0.01});O(V,{type:'sawtooth',f0:603,f1:302,d:0.55,v:0.15,bp:2000,q:3,flfo:{f0:11,f1:4,dp:700}});}
   if(oc===2){N(V,{buf:'crk',ft:'bandpass',f0:4200,q:1,d:0.5,v:0.1,rate:2});O(V,{f0:80,f1:32,d:0.5,v:0.19,sat:2});O(V,{f0:1980,d:0.4,v:0.033,fm:{r:1.5,i0:1500,i1:30},jit:false});}
  },
  shell:(V,t,oc)=>{   // the big shell leaves the barrel: a blast, a boom, a crack, and its whistle in flight. Rail Blast: the rail's zing; Titanfall: a metal ring and sub
   const pk=oc>0?1:0.6;N(V,{f0:3500,f1:350,d:0.3,v:0.22,a:0.001});
   O(V,{f0:130,f1:40,d:0.4,v:0.22*pk,sat:2.4});
   if(oc>0)N(V,{ft:'highpass',f0:2500,d:0.02,v:0.14,a:0.0005});
   O(V,{f0:1500,f1:900,d:0.55,v:0.016,a:0.04});
   if(t>=1){O(V,{f0:3200,f1:1200,d:0.1,v:0.1,fm:{r:2,i0:1000,i1:40}});N(V,{buf:'crk',ft:'bandpass',f0:2600,q:1.2,d:0.14,v:0.24});}
   if(t>=2){O(V,{f0:160,d:0.6,v:0.065,fm:{r:2.76,i0:600,i1:30}});O(V,{f0:60,f1:30,d:0.5,v:0.17,sat:2});}
   if(oc===2){N(V,{ft:'highpass',f0:4000,d:0.05,v:0.09});O(V,{f0:90,f1:35,d:0.45,v:0.13,sat:2,t:0.02});}
  },
  // Moonfall: the most powerful sound in the game. A crack, an EM discharge sweeping down and a second, higher rail discharge, the
  // beam's roar (three detuned saws), a sub boom, crackling arcs in both ears, a lunar chime and a rushing whoosh
  moon:(V,t,oc)=>{
   const pk=oc>0?1:0.6;if(oc>0)N(V,{ft:'highpass',f0:1500,d:0.05,v:0.19,a:0.0008});
   O(V,{f0:1000,f1:180,d:0.45,v:0.13,fm:{r:1.5,i0:1200,i1:80}});
   O(V,{f0:2600,f1:700,d:0.3,v:0.04,fm:{r:2,i0:1500,i1:60}});
   O(V,{type:'sawtooth',f0:55,d:0.9,v:0.095,lp:3000,fq1:400,sat:1.4});O(V,{type:'sawtooth',f0:55.4,d:0.85,v:0.07,lp:2600,fq1:380});O(V,{type:'sawtooth',f0:110.3,d:0.8,v:0.05,lp:3000,fq1:500});
   O(V,{f0:90,f1:28,d:0.7,v:0.24*pk,sat:2.4});
   N(V,{buf:'crk',ft:'bandpass',f0:3000,q:1.2,d:0.8,v:0.08,rate:1.6,pan:-0.35});N(V,{buf:'crk',ft:'bandpass',f0:3600,q:1.2,d:0.8,v:0.07,rate:1.9,pan:0.35});
   if(t>=2)O(V,{f0:1760,d:0.8,v:0.036,fm:{r:1.41,i0:1600,i1:40},jit:false});
   N(V,{ft:'bandpass',f0:600,f1:3000,fd:0.25,q:1.2,d:0.6,v:0.08});
   if(oc===2){N(V,{ft:'highpass',f0:5000,d:0.08,v:0.1});O(V,{f0:2349,d:0.9,v:0.028,fm:{r:1.5,i0:2000,i1:30},jit:false,pan:-0.4});O(V,{f0:2637,d:0.9,v:0.028,fm:{r:1.5,i0:2000,i1:30},jit:false,pan:0.4});
    O(V,{f0:60,f1:22,d:0.9,v:0.15,sat:2});N(V,{buf:'crk',ft:'highpass',f0:4000,d:0.9,v:0.075,rate:2.4});}
  }};
 // impact. hits: tanks hit by this super (beams); a shell's landing is a bomb
 const IMPACT={
  lance:(V,t,oc,hits)=>{   // where the beam bites: a pierce, a thump; Arc: a crackle; Sunlance: a shimmer
   N(V,{ft:'bandpass',f0:2500,q:1,d:0.12,v:0.1});O(V,{f0:220,f1:80,d:0.18,v:oc>0?0.13:0.08,sat:1.6});
   if(hits>0)O(V,{type:'square',f0:300,f1:150,d:0.08,v:0.05,lp:1500});
   if(t>=1)N(V,{buf:'crk',ft:'bandpass',f0:3500,q:1.2,d:0.22,v:0.22});
   if(t>=2)O(V,{f0:3520,d:0.3,v:0.026,fm:{r:1.41,i0:2000,i1:30},jit:false});
   if(oc===2)N(V,{f0:2000,f1:300,d:0.35,v:0.09});
  },
  nova:(V,t,oc)=>{   // the shockwave settling: a thud, crackle and (Storm, Helix) a rumble
   O(V,{f0:90,f1:40,d:0.25,v:0.1,sat:1.6});N(V,{buf:'crk',f0:2000,d:0.3,v:0.08,rate:0.8});
   if(t>=1)N(V,{buf:'brown',f0:260,d:0.55,v:0.18});
   if(oc===2)O(V,{f0:70,f1:30,d:0.4,v:0.1,sat:1.8});
  },
  // a bomb: the crack, a deep boom (soft-clipped so a phone speaker still plays its harmonics), the blast, falling debris and a
  // long rumble. Rail Blast adds electric crackle; Titanfall a golden metal ring, a bigger sub and an echo. A jackpot: a second blast
  shell:(V,t,oc)=>{
   N(V,{ft:'highpass',f0:1800,d:0.03,v:0.17,a:0.0005});
   O(V,{f0:95,f1:32,d:0.6,v:0.25,sat:2.6});
   N(V,{f0:2500,f1:200,d:0.5,v:0.21,a:0.002});
   if(oc>0)N(V,{buf:'crk',f0:1500,d:0.6,v:0.07,rate:0.5,t:0.05});
   N(V,{buf:'brown',f0:250,d:1.2,v:0.09,a:0.03});
   if(t>=1)N(V,{buf:'crk',ft:'bandpass',f0:2800,q:1.2,d:0.45,v:0.2,rate:1.2});
   if(t>=2){O(V,{f0:120,d:1.0,v:0.055,fm:{r:2.76,i0:500,i1:20}});O(V,{f0:70,f1:24,d:1.0,v:0.15,sat:2.2});}
   if(oc===2){N(V,{f0:2200,f1:180,d:0.45,v:0.14,t:0.12});O(V,{f0:80,f1:30,d:0.5,v:0.14,sat:2.2,t:0.12});N(V,{buf:'brown',f0:200,d:1.6,v:0.075,t:0.1});}
  },
  // Moonfall lands: a lunar crater boom, the blast, crystal chimes that ring on, crackling and an EM fizz settling
  moon:(V,t,oc,hits)=>{
   O(V,{f0:80,f1:25,d:1.0,v:0.25,sat:2.6});N(V,{f0:3000,f1:150,d:0.8,v:0.21,a:0.002});
   O(V,{f0:2093,d:1.8,v:0.028,fm:{r:1.41,i0:1400,i1:20},jit:false,pan:-0.3});O(V,{f0:2637,d:1.8,v:0.028,fm:{r:1.41,i0:1400,i1:20},jit:false,pan:0.3});
   N(V,{buf:'crk',ft:'bandpass',f0:2600,q:1,d:0.9,v:0.08,rate:1.2});
   if(oc>0){N(V,{buf:'crk',f0:1400,d:0.7,v:0.06,rate:0.5,t:0.06});N(V,{ft:'highpass',f0:3800,d:0.5,v:0.03,a:0.05});}
   N(V,{buf:'brown',f0:230,d:2.0,v:0.08,a:0.04});
   if(hits>0)N(V,{ft:'highpass',f0:2500,d:0.05,v:0.09});
   if(oc===2){O(V,{f0:3136,d:3.2,v:0.036,fm:{r:1.5,i0:1600,i1:20},jit:false});N(V,{buf:'brown',f0:220,d:3.0,v:0.12});O(V,{f0:55,f1:20,d:1.2,v:0.14,sat:2.2,t:0.08});}
  }};
 const OCM=[{g:0.8,lp:2600,ds:0.8,e:0},{g:1,lp:0,ds:1,e:0},{g:1.12,lp:0,ds:1.28,e:0.14}];   // miss / hit / jackpot
 const SUP_ECHO=[0,0.08,0.2,0.3];   // by rarity (Moonfall 0.3), plus the jackpot's 0.14
 // the stage's voice settings for a super key and outcome
 function supOpt(k,oc,stage){
  const t=tierOf(k),M=OCM[oc===undefined?1:oc];
  if(stage==='charge')return {t,g:1,ds:1,echo:t>=2?0.06:0};
  if(stage==='lock')return {t,g:1,ds:1,echo:oc===2?0.12:0};
  return {t,g:M.g,lp:M.lp,ds:M.ds,echo:oc===0?0:SUP_ECHO[t]+M.e};
 }
 // play one sound into ctx/bus at time t0. kind: shot | hit | charge | lock | fire | impact
 function play(ctx,bus,t0,kind,k,oc,o){
  o=o||{};const arch=archOf(k),fam=FAM[arch]||'lance',t=tierOf(k);
  if(kind==='shot'){const E=SHOT_ECHO[arch]||[0];const V=voice(ctx,bus,t0,{g:(o.g||1)*(SHOT_G[arch]||1),echo:o.noEcho?0:E[Math.min(E.length-1,t)],alt:o.alt,jit:o.jit,rnd:o.rnd});(SHOT[arch]||SHOT.pulse)(V,t);return V;}
  if(kind==='hit'){const V=voice(ctx,bus,t0,{g:o.g||1,rnd:o.rnd});(HIT[arch]||HIT.pulse)(V,t);if(o.crit){O(V,{type:'triangle',f0:1500,f1:2300,d:0.07,v:0.045,jit:false});N(V,{ft:'highpass',f0:2600,d:0.05,v:0.05});}return V;}
  const S=supOpt(k,oc,kind),V=voice(ctx,bus,t0,{g:(o.g||1)*S.g,lp:S.lp,ds:S.ds,echo:o.noEcho?0:S.echo,rnd:o.rnd});
  if(kind==='charge')CHARGE[fam](V,t);
  else if(kind==='lock')lock(V,fam,oc);
  else if(kind==='fire')FIRE[fam](V,S.t,oc);
  else IMPACT[fam](V,S.t,oc,o.hits|0);
  return V;
 }
 // cut a voice short (a charge when its super fires): a 40 ms fade, then its sources stop
 function stop(V,at){
  if(!V||V.stopped)return;V.stopped=true;const c=V.ctx,t=Math.max(at||c.currentTime,c.currentTime);V.end=Math.min(V.end||t+0.06,t+0.06);   // out of every count once it fades
  try{const p=V.in.gain;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(0,t+0.04);for(const s of V.srcs)try{s.stop(t+0.06);}catch(e){}}catch(e){}
 }
 // ---------------- live playback: buses, priorities, voice limits ----------------
 const st={act:{shot:[],other:[],sup:[]},charge:new Map(),tok:4,tokT:0,alt:false,imp:null,lastFire:null,duckT:0,made:{shot:0,other:0,sup:0}};
 const CAP={shot:6,other:6,sup:8},CAP_LITE={shot:4,other:3,sup:5};
 // LOW graphics (or 2D, picked for speed): fewer voices at once, no echo on your gun, a smaller budget for other tanks (review: Web Audio
 // costs ~2% of a desktop core typically, ~9% in a full Last Standing fight; older phones are several times slower). Same recipes
 const lite=()=>typeof R3!=='undefined'&&(R3.q==='low'||R3.auto==='2d'||(typeof gfxMode==='function'&&gfxMode()==='2d'));
 const capOf=cat=>(lite()?CAP_LITE:CAP)[cat];
 const ready=()=>!!(save&&save.sound!==false&&BUS&&AC&&AC.state==='running');
 function admit(cat,V){const a=st.act[cat],now=AC.currentTime;for(let i=a.length-1;i>=0;i--)if(a[i].end<now)a.splice(i,1);a.push(V);st.made[cat]++;}
 function full(cat){const a=st.act[cat],now=AC.currentTime;let n=0;for(const V of a)if(V.end>=now&&!V.stopped)n++;return n>=capOf(cat);}
 function busOf(cat){return {node:BUS[cat],echo:BUS.echo};}
 // supers at the cap (CAP.sup voices): yours always play and the farthest other tank's super stops for it; another tank's plays only if
 // it is nearer than the farthest one playing
 function supRoom(g,own){const a=st.act.sup,now=AC.currentTime;let n=0,far=null;for(const V of a)if(V.end>=now&&!V.stopped){n++;if(!V.own&&(!far||V.g<far.g))far=V;}
  if(n<capOf('sup'))return true;if(far&&(own||g>far.g)){stop(far);return true;}return !!own;}
 function admitS(V,g,own){V.g=g;V.own=!!own;admit('sup',V);return V;}
 // how loud another tank is from yours: full at your side, a quarter at ~14 units, never silent (it stays a cue)
 function near(x,y){if(typeof me==='undefined'||!me||x===undefined)return 0.5;const d=Math.hypot(x-me.x,y-me.y);return Math.max(0.07,1/(1+(d/8)*(d/8)));}
 // a super firing near you ducks the gunfire for a moment, so the moment reads
 function duck(amt){if(!BUS)return;const t=AC.currentTime;for(const b of [BUS.shot,BUS.other]){const p=b.gain,base=b===BUS.other?0.62:1;p.cancelScheduledValues(t);p.setTargetAtTime(base*(1-amt),t,0.015);p.setTargetAtTime(base,t+0.45,0.18);}}
 const gapOwn={pulse:0.06,twin:0.04,siege:0.1,moon:0.06},lastOwn={};
 function shot(k,own,x,y){
  if(!ready())return;const now=AC.currentTime,arch=archOf(k);
  if(own){if(now-(lastOwn[arch]||0)<(gapOwn[arch]||0.05))return;lastOwn[arch]=now;if(full('shot'))return;
   st.alt=!st.alt;admit('shot',play(AC,busOf('shot'),now+0.002,'shot',k,1,{alt:st.alt,jit:0.96+Math.random()*0.08,noEcho:lite()}));return;}
  // other tanks: a shared budget (about 9 shots a second, bursts of 4), quieter with distance. Too far to hear costs nothing from it
  const g=near(x,y);if(g<0.08)return;
  const L=lite();st.tok=Math.min(L?3:4,st.tok+(now-st.tokT)*(L?6:9));st.tokT=now;if(st.tok<1||full('other'))return;st.tok--;
  admit('other',play(AC,busOf('other'),now+0.002,'shot',k,1,{g,alt:Math.random()<0.5,jit:0.95+Math.random()*0.1,noEcho:true}));
 }
 function hit(k,crit){if(!ready())return;const now=AC.currentTime;if(now-(lastOwn.hit||0)<0.05)return;lastOwn.hit=now;if(full('shot'))return;admit('shot',play(AC,busOf('shot'),now+0.002,'hit',k,1,{crit}));}
 // supers. own: your tank (full level); id: the tank, so its charge can be cut when it fires
 function charge(k,id,own,x,y){
  if(!ready())return;stopCharge(id);const g=own?1:0.7*near(x,y);if(!own&&g<0.1)return;if(!supRoom(g,own))return;
  const V=play(AC,busOf('sup'),AC.currentTime+0.003,'charge',k,1,{g});st.charge.set(id,V);admitS(V,g,own);
 }
 function stopCharge(id,at){const V=st.charge.get(id);if(V){stop(V,at);st.charge.delete(id);}}
 function stopCharges(){for(const id of [...st.charge.keys()])stopCharge(id);}   // a match or round starts, or the battle is left: no charge carries over
 function lockS(k,oc,own,x,y){if(!ready())return;const g=own?1:0.6*near(x,y);if(!own&&(oc!==2||g<0.12))return;if(!supRoom(g,own))return;admitS(play(AC,busOf('sup'),AC.currentTime+0.002,'lock',k,oc,{g}),g,own);}
 function fire(k,oc,id,own,x,y){
  if(!ready()){st.charge.delete(id);return;}const now=AC.currentTime;stopCharge(id,now+0.01);
  const g=own?1:0.85*Math.pow(near(x,y),0.7);if(own){st.lastFire={k,t:now};duck(0.55);}else if(g>0.4)duck(0.3);
  if(!supRoom(g,own))return;admitS(play(AC,busOf('sup'),now+0.004,'fire',k,oc,{g}),g,own);
 }
 // every impact of one super lands in the same sim tick (a beam's end and each tank it hits): one sound, the hit count inside it
 function impact(k,oc,kind,x,y,team,own){
  if(!ready())return;
  if(!st.imp){st.imp=new Map();const flush=()=>{const m=st.imp;st.imp=null;for(const v of m.values())impactNow(v);};
   if(typeof queueMicrotask==='function')queueMicrotask(flush);else Promise.resolve().then(flush);}
  const key=k+'|'+oc+'|'+team,v=st.imp.get(key)||{k,oc,team,hits:0,shell:false,x,y,best:-1,own:!!own};
  if(kind===1)v.hits++;if(kind===2)v.shell=true;
  const g=near(x,y);if(g>v.best){v.best=g;v.x=x;v.y=y;}st.imp.set(key,v);
 }
 function impactNow(v){
  if(!ready())return;const now=AC.currentTime,L=st.lastFire;
  const own=v.own||!!(L&&L.k===v.k&&now-L.t<2.2&&typeof me!=='undefined'&&me&&v.team===me.team);
  const g=own?1:0.85*Math.pow(near(v.x,v.y),0.7);if(g<0.08)return;
  if(archOf(v.k)==='twin'&&!own&&g<0.2)return;if(!supRoom(g,own))return;
  admitS(play(AC,busOf('sup'),now+0.003,'impact',v.k,v.oc,{g,hits:v.hits}),g,own);
 }
 function stopAll(){for(const id of [...st.charge.keys()])stopCharge(id);for(const a of Object.values(st.act))for(const V of a)stop(V);for(const a of Object.values(st.act))a.length=0;}
 // offline rendering for the measurement test (and anything else that wants a sound in its own context)
 function render(ctx,out,kind,k,oc,o){const B=mkBuses(ctx,out);return play(ctx,{node:B[o&&o.bus||'sup'],echo:B.echo},(o&&o.t0)||0,kind,k,oc,Object.assign({rnd:()=>0.37},o||{}));}
 // the whole super as the Arcade plays it: press, the verdict at the tap (a miss runs the sweep out), the fire SUP_REL later
 // (never before the weapon's own telegraph), the impact (a shell after its flight). Returns the stage times in seconds
 function timeline(k,oc){
  const arch=archOf(k),chg={pulse:0.7,twin:0.55,siege:0.7,moon:0.8}[arch]||0.7,bar=typeof SUP_BAR_T==='number'?SUP_BAR_T:0.667,rel=typeof SUP_REL==='number'?SUP_REL:0.2;
  const tap=oc===0?bar:oc===2?0.47*bar+0.14:0.55*bar+0.12,fireT=Math.max(chg,tap+rel),imp=fireT+(arch==='siege'?0.7:0.02);
  return {lock:tap,fire:fireT,impact:imp};
 }
 const stats=()=>({made:{...st.made},charging:st.charge.size,chIds:[...st.charge.keys()],active:Object.fromEntries(Object.entries(st.act).map(([k,a])=>[k,a.filter(V=>AC&&V.end>=AC.currentTime&&!V.stopped).length]))});   // the browser test reads it
 return {shot,hit,charge,stopCharge,stopCharges,lock:lockS,fire,impact,stopAll,render,play,timeline,stats,tierOf,archOf,FAM,KEYS:['pulse0','pulse1','pulse2','twin0','twin1','twin2','siege0','siege1','siege2','moon']};
})();
// ---------- ambience (Session 5E-2c): a quiet bed under each Arcade map, synthesised (no downloads). Follows the Sound setting.
// rum: low rumble [cutoff Hz, gain]; air: band of moving air [centre Hz, Q, gain]; hum: machinery [Hz, gain]; clank: far-off metal
const AMB_SPEC={classic:{rum:[70,0.05],air:[520,0.9,0.011],hum:[110,0.005]},overpass:{rum:[80,0.045],air:[700,1.2,0.009],hum:[100,0.010]},longshot:{rum:[60,0.05],air:[380,0.7,0.018]},
 craters:{rum:[55,0.055],air:[450,0.8,0.013]},canyon:{rum:[60,0.05],air:[320,0.6,0.026]},bunker:{rum:[90,0.04],air:[1100,1.4,0.010],hum:[55,0.028],hum2:[110,0.011],clank:1}};
let AMB=null,ambBuf=null;
function ambience(id){
 if(!save||save.sound===false||!AMB_SPEC[id])id=null;
 if((AMB?AMB.id:null)===id)return;
 if(AMB){const a=AMB;AMB=null;clearTimeout(a.timer);try{const t=AC.currentTime;a.out.gain.cancelScheduledValues(t);a.out.gain.setValueAtTime(a.out.gain.value,t);a.out.gain.linearRampToValueAtTime(0,t+1.2);for(const n of a.src)n.stop(t+1.3);}catch(e){}}
 if(!id)return;audioInit();if(!AC||AC.state!=='running')return;   // not started yet (no tap): tried again next frame
 try{
  if(!ambBuf){ambBuf=AC.createBuffer(1,Math.floor(AC.sampleRate*2.6),AC.sampleRate);const d=ambBuf.getChannelData(0);let b=0;for(let i=0;i<d.length;i++){b=0.985*b+0.015*(Math.random()*2-1);d[i]=(Math.random()*2-1)*0.5+b*6;}}
  var src=[];const S=AMB_SPEC[id],t=AC.currentTime,out=AC.createGain();out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(1,t+2);out.connect(master);
  const band=(type,fc,q,g,lfo)=>{const n=AC.createBufferSource(),f=AC.createBiquadFilter(),gn=AC.createGain();n.buffer=ambBuf;n.loop=true;n.playbackRate.value=0.8+Math.random()*0.4;f.type=type;f.frequency.value=fc;f.Q.value=q;gn.gain.value=g;n.connect(f);f.connect(gn);gn.connect(out);n.start(t,Math.random()*2);src.push(n);
   if(lfo){const o=AC.createOscillator(),og=AC.createGain();o.frequency.value=lfo;og.gain.value=g*0.6;o.connect(og);og.connect(gn.gain);o.start(t);src.push(o);}};
  band('lowpass',S.rum[0],0.7,S.rum[1],0.05);if(S.air)band('bandpass',S.air[0],S.air[1],S.air[2],0.09);
  for(const h of [S.hum,S.hum2])if(h){const o=AC.createOscillator(),gn=AC.createGain();o.type='sine';o.frequency.value=h[0];gn.gain.value=h[1];o.connect(gn);gn.connect(out);o.start(t);src.push(o);}
  const a={id,out,src,timer:0};
  if(S.clank){const go=()=>{if(AMB!==a)return;try{if(AC.state==='running'){burst(0.3,0.022,260,0);tone(190,95,0.22,'triangle',0.008,0.02);}}catch(e){}a.timer=setTimeout(go,6000+Math.random()*9000);};a.timer=setTimeout(go,4000+Math.random()*5000);}
  AMB=a;
 }catch(e){AMB=null;try{for(const n of src||[])n.stop();}catch(_){}}   // nothing half-started is left playing
}
function sfx(n){
 if(!save||save.sound===false||!SND[n])return;
 audioInit();if(!AC||AC.state!=='running')return;
 const now=AC.currentTime;if(SND_GAP[n]&&now-(lastSnd[n]||0)<SND_GAP[n])return;lastSnd[n]=now;
 try{SND[n]();}catch(e){}
}
// a weapon item's sound key from a tank (or a weapon type and rarity): pulse0..siege2, moon (rules.js supKey)
const wsKey=(w,t)=>typeof supKey==='function'?supKey(w||'pulse',t|0):(w==='moon'?'moon':(w||'pulse')+Math.max(0,Math.min(2,t|0)));
const unitKey=u=>u?wsKey(u.wtype,u.wtier):'pulse0';
function lw(f){if(!save||save.sound===false)return;audioInit();try{f();}catch(e){}}
function fx(name,arg,arg2){
 switch(name){
  case 'hit':{const now=performance.now();if(now-lastHitFx>140){lastHitFx=now;haptic('i',arg>60?'medium':'light');}sfx('hurt');break;}
  // your shot landed: arg {cr: crit, k: your weapon} (older callers pass the crit flag alone)
  case 'dealt':{const o=arg&&typeof arg==='object'?arg:{cr:!!arg};if(o.k)lw(()=>LW.hit(o.k,!!o.cr));else sfx(o.cr?'crit':'hit');break;}
  // a weapon fired. arg: the tank (yours at full level, anyone else's by distance) or a weapon type with arg2 its rarity (Conquest: yours)
  case 'shot':{if(arg&&typeof arg==='object'){const u=arg,own=typeof me!=='undefined'&&u===me;lw(()=>LW.shot(unitKey(u),own,u.x,u.y));}else lw(()=>LW.shot(wsKey(arg||'pulse',arg2),true));break;}
  // the Arcade's supers (live and AI matches, the practice range). arg {u: the tank, k: super key, oc: 0 miss / 1 hit / 2 jackpot}
  case 'supcharge':{const u=arg&&arg.u,own=typeof me!=='undefined'&&u===me;if(own)haptic('i','rigid');lw(()=>LW.charge(arg.k||unitKey(u),u?u.id:-1,own,u&&u.x,u&&u.y));break;}
  case 'suplock':{const u=arg&&arg.u,own=typeof me!=='undefined'&&u===me,oc=arg.oc|0;if(own){if(oc===2){haptic('n','success');haptic('i','heavy');}else haptic('i',oc===1?'medium':'soft');}lw(()=>LW.lock(arg.k||unitKey(u),oc,own,u&&u.x,u&&u.y));break;}
  case 'supfire':{const u=arg&&arg.u,own=typeof me!=='undefined'&&u===me;lw(()=>LW.fire(arg.k||unitKey(u),arg.oc===undefined?1:arg.oc,u?u.id:-1,own,arg.x!==undefined?arg.x:u&&u.x,arg.y!==undefined?arg.y:u&&u.y));break;}
  case 'supimpact':{const o=arg||{};haptic('i','heavy');lw(()=>LW.impact(o.k||'pulse0',o.oc===undefined?1:o.oc,o.kind|0,o.x,o.y,o.team));break;}
  case 'supstop':lw(()=>arg==='all'?LW.stopCharges():LW.stopCharge(arg));break;
  case 'kill':haptic('i','heavy');sfx('kill');break;
  case 'die':haptic('n','error');sfx('die');break;
  case 'boom':sfx('boom');break;
  case 'super':haptic('i','rigid');sfx('super');break;
  case 'impact':haptic('i','heavy');sfx('impact');break;
  case 'jackpot':haptic('n','success');haptic('i','heavy');sfx('jackpot');break;
  case 'supgood':haptic('i','medium');sfx('supgood');break;
  case 'supmiss':haptic('i','soft');sfx('supmiss');break;
  case 'ready':haptic('i','light');sfx('ready');break;
  case 'box':haptic('i','soft');sfx('box');break;
  case 'crystal':haptic('i','soft');sfx('crystal');break;
  case 'cap':haptic('n','success');sfx('cap');break;
  case 'event':haptic('n','warning');sfx('event');break;
  case 'meteor':haptic('i','medium');sfx('meteor');break;
  case 'warn':sfx('warn');break;
  case 'crate':sfx('crate');break;
  case 'dash':haptic('i','light');sfx('dash');break;
  case 'shield':haptic('i','medium');sfx('ready');break;
  case 'win':haptic('n','success');sfx('win');break;
  case 'lose':haptic('n','warning');sfx('lose');break;
  case 'draw':haptic('n','warning');sfx('draw');break;
  case 'buy':haptic('n','success');sfx('buy');break;
  case 'claim':haptic('n','success');sfx('claim');break;
  // Session 6 (Conquest feel): a kill is a light haptic (owner brief); loot plays its rarity; a rare+ drop adds a success haptic
  case 'cqkill':haptic('i','light');sfx('kill');break;
  case 'loot':{const r=Math.max(0,Math.min(4,arg|0));if(r>=2)haptic('n','success');else haptic('i','soft');sfx('loot'+r);break;}
  case 'tap':case 'tick':haptic('s');sfx('tap');break;
  // Session 6B: a research mod triggered (arg: the rules.js MOD_CUE key); the bigger moments get a haptic too
  case 'mod':{const C=typeof MOD_CUE!=='undefined'&&MOD_CUE[arg];if(!C||!C.s)break;if(['vent','ring','ram','inferno','reflex','rail'].includes(arg))haptic('i',arg==='ram'||arg==='ring'?'medium':'light');sfx(C.s);break;}
  case 'research':haptic('n','success');sfx('rsDone');break;
  case 'rstart':haptic('i','light');sfx('rsStart');break;
  case 'bank':haptic('n','success');sfx('bank');break;
  case 'built':haptic('n','success');sfx('built');break;
  case 'plate':haptic('i','heavy');sfx('plate');break;
  case 'order':haptic('n','success');sfx('order');break;
  case 'sting':{const k={raid:'stRaid',invade:'stInvade',strike:'stStrike',victory:'stVictory'}[arg];if(k){haptic('n',arg==='victory'?'success':'warning');sfx(k);}break;}
 }
}
