'use strict';
// =====================================================================
// fx: phone vibration (Telegram haptics). Sound effects arrive in batch 4.
// =====================================================================
let lastHitFx=0;
function haptic(kind,style){
 if(!save||!save.haptics)return;
 try{const H=TG&&TG.HapticFeedback;if(!H)return;
  if(kind==='i')H.impactOccurred(style);else if(kind==='n')H.notificationOccurred(style);else H.selectionChanged();}catch(e){}
}
function fx(name,arg){
 switch(name){
  case 'hit':{const now=performance.now();if(now-lastHitFx>140){lastHitFx=now;haptic('i',arg>60?'medium':'light');}break;}
  case 'kill':haptic('i','heavy');break;
  case 'die':haptic('n','error');break;
  case 'boom':break;
  case 'super':haptic('i','rigid');break;
  case 'box':haptic('i','soft');break;
  case 'cap':haptic('n','success');break;
  case 'event':haptic('n','warning');break;
  case 'win':haptic('n','success');break;
  case 'lose':case 'draw':haptic('n','warning');break;
  case 'buy':case 'claim':haptic('n','success');break;
  case 'tap':case 'tick':haptic('s');break;
 }
}
