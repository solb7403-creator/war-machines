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
  AC=new C();master=AC.createGain();master.gain.value=0.5;master.connect(AC.destination);
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
 super:()=>{burst(0.38,0.2,3200);tone(95,45,0.38,'sine',0.17);},
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
const SND_GAP={crystal:0.05,shot_pulse:0.07,shot_twin:0.06,shot_siege:0.1,shot_moon:0.07,hit:0.05,crit:0.05,hurt:0.12,warn:0.12,boom:0.08,meteor:0.08,dash:0.1};
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
