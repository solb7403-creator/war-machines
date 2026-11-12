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
let AC=null,master=null,noiseBuf=null;const lastSnd={};
function audioInit(){
 if(AC)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  try{if(navigator.audioSession)navigator.audioSession.type='ambient';}catch(e){}   // obey the silent switch, don't stop the player's music
  AC=new C();master=AC.createGain();master.gain.value=0.5;
  // a limiter at the end, so stacked explosions get loud without crackling
  let out=AC.destination;try{const L=AC.createDynamicsCompressor();L.threshold.value=-10;L.knee.value=6;L.ratio.value=12;L.attack.value=0.003;L.release.value=0.2;L.connect(AC.destination);out=L;}catch(e){}
  master.connect(out);
 }catch(e){AC=null;}
}
function audioResume(){if(!save||save.sound===false)return;audioInit();if(AC&&AC.state==='suspended')AC.resume().catch(()=>{});}
addEventListener('pointerdown',audioResume,true);   // iOS only starts audio after a tap
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden)AC.suspend().catch(()=>{});else if(save&&save.sound!==false)AC.resume().catch(()=>{});});
function noise(){
 if(!noiseBuf){noiseBuf=AC.createBuffer(1,Math.floor(AC.sampleRate*0.6),AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
 return noiseBuf;
}
function tone(f0,f1,dur,type,vol,delay){   // one oscillator with a pitch sweep
 const t=AC.currentTime+(delay||0),o=AC.createOscillator(),gn=AC.createGain();
 o.type=type||'square';o.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
 gn.gain.setValueAtTime(0.0001,t);gn.gain.exponentialRampToValueAtTime(vol,t+0.008);gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 o.connect(gn);gn.connect(master);o.start(t);o.stop(t+dur+0.03);
}
function burst(dur,vol,fc,delay){   // filtered noise: impacts, explosions, dust
 const t=AC.currentTime+(delay||0),s=AC.createBufferSource(),f=AC.createBiquadFilter(),gn=AC.createGain();
 s.buffer=noise();f.type='lowpass';f.frequency.setValueAtTime(fc,t);f.frequency.exponentialRampToValueAtTime(Math.max(60,fc*0.15),t+dur);
 gn.gain.setValueAtTime(vol,t);gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 s.connect(f);f.connect(gn);gn.connect(master);s.start(t);s.stop(t+dur+0.03);
}
const SND={
 shot_pulse:()=>tone(820,240,0.08,'square',0.035),
 shot_twin:()=>tone(1300,620,0.045,'square',0.025),
 shot_siege:()=>{tone(170,60,0.16,'sawtooth',0.05);burst(0.12,0.06,900);},
 shot_moon:()=>tone(1700,900,0.1,'sine',0.045),
 hit:()=>burst(0.05,0.07,1800),
 crit:()=>{tone(1500,2300,0.07,'triangle',0.05);burst(0.05,0.07,2600);},
 hurt:()=>tone(210,110,0.11,'sawtooth',0.05),
 boom:()=>{burst(0.45,0.18,1100);tone(110,40,0.4,'sine',0.14);},
 kill:()=>{burst(0.5,0.24,1400);tone(130,40,0.45,'sine',0.17);tone(660,990,0.12,'triangle',0.05,0.1);},
 die:()=>{burst(0.55,0.24,900);tone(280,60,0.65,'sawtooth',0.08);},
 ready:()=>tone(320,1250,0.35,'sawtooth',0.04),
 // supers: a sharp crack over a deep bass drop when one fires, a heavy boom where it lands
 super:()=>{burst(0.08,0.32,7000);tone(62,30,0.55,'sine',0.34);tone(190,48,0.28,'sawtooth',0.1);burst(0.45,0.16,1800,0.05);},
 // the timing bar: a rising gold chime with a heavy thump on a jackpot, a clean tick on a hit, a dull drop on a miss
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
 buy:()=>[659,880,1175].forEach((f,i)=>tone(f,f,0.12,'triangle',0.07,i*0.07))};
const SND_GAP={impact:0.09,crystal:0.05,shot_pulse:0.07,shot_twin:0.06,shot_siege:0.1,shot_moon:0.07,hit:0.05,crit:0.05,hurt:0.12,warn:0.12,boom:0.08,meteor:0.08,dash:0.1};
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
  const S=AMB_SPEC[id],t=AC.currentTime,out=AC.createGain(),src=[];out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(1,t+2);out.connect(master);
  const band=(type,fc,q,g,lfo)=>{const n=AC.createBufferSource(),f=AC.createBiquadFilter(),gn=AC.createGain();n.buffer=ambBuf;n.loop=true;n.playbackRate.value=0.8+Math.random()*0.4;f.type=type;f.frequency.value=fc;f.Q.value=q;gn.gain.value=g;n.connect(f);f.connect(gn);gn.connect(out);n.start(t,Math.random()*2);src.push(n);
   if(lfo){const o=AC.createOscillator(),og=AC.createGain();o.frequency.value=lfo;og.gain.value=g*0.6;o.connect(og);og.connect(gn.gain);o.start(t);src.push(o);}};
  band('lowpass',S.rum[0],0.7,S.rum[1],0.05);if(S.air)band('bandpass',S.air[0],S.air[1],S.air[2],0.09);
  for(const h of [S.hum,S.hum2])if(h){const o=AC.createOscillator(),gn=AC.createGain();o.type='sine';o.frequency.value=h[0];gn.gain.value=h[1];o.connect(gn);gn.connect(out);o.start(t);src.push(o);}
  const a={id,out,src,timer:0};
  if(S.clank){const go=()=>{if(AMB!==a)return;try{if(AC.state==='running'){burst(0.3,0.022,260,0);tone(190,95,0.22,'triangle',0.008,0.02);}}catch(e){}a.timer=setTimeout(go,6000+Math.random()*9000);};a.timer=setTimeout(go,4000+Math.random()*5000);}
  AMB=a;
 }catch(e){AMB=null;}
}
function sfx(n){
 if(!save||save.sound===false||!SND[n])return;
 audioInit();if(!AC||AC.state!=='running')return;
 const now=AC.currentTime;if(SND_GAP[n]&&now-(lastSnd[n]||0)<SND_GAP[n])return;lastSnd[n]=now;
 try{SND[n]();}catch(e){}
}
function fx(name,arg){
 switch(name){
  case 'hit':{const now=performance.now();if(now-lastHitFx>140){lastHitFx=now;haptic('i',arg>60?'medium':'light');}sfx('hurt');break;}
  case 'dealt':sfx(arg?'crit':'hit');break;
  case 'shot':sfx('shot_'+(arg||'pulse'));break;
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
  case 'tap':case 'tick':haptic('s');sfx('tap');break;
 }
}
