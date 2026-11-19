/* Shared Conquest controls: physical movement, manual target/fire and Arcade-derived abilities. */
(function(root){
'use strict';
const W=root.ConquestWorld,C=root.ConquestCombat,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Match the existing3D primary projectile conversion; Arcade rules remain unchanged.
const SUPER_WORLD_SCALE=3;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const CONFIG=Object.freeze({dashTime:.4,dashSpeed:5.1,dashCooldown:DASH_CD,shieldTime:SHIELD_T,shieldCooldown:SHIELD_CD,shieldDamage:SHIELD_MULT,superMax:SUPER_MAX,superWorldScale:SUPER_WORLD_SCALE});
function ensure(B){for(const [k,v] of Object.entries({charge:0,turretYaw:0,dashCd:0,shieldCd:0,shieldT:0}))if(!Number.isFinite(B[k]))B[k]=v;B.superShells=B.superShells||[];}
function visible(B,p,e,range=C.engineeringValues(B.playerStats,B.engineering).range){return e&&e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<=range&&C.lineClear({x:p.x,y:p.y+2.2,z:p.z},{x:e.x,y:e.y+2.2,z:e.z});}
function aim(B,p,input,dt){
 ensure(B);const locked=B.enemies.find(e=>e.id===input.lockId);
 B.lockId=visible(B,p,locked)?locked.id:null;
 let lx=locked&&locked.x,lz=locked&&locked.z;
 if(B.lockId!==null&&B.playerStats.rm&&B.playerStats.rm.predictor){const tof=Math.hypot(locked.x-p.x,locked.z-p.z)/Math.max(1,C.engineeringValues(B.playerStats,B.engineering).velocity)*B.playerStats.rm.predictor.lead;lx+=(locked.vx||0)*tof;lz+=(locked.vz||0)*tof;}   // Predictor Gyro (Session 6B): lead the locked target
 const want=B.lockId!==null?Math.atan2(lx-p.x,lz-p.z):input.aimYaw||0;
 const turn=STAT.turn*(B.playerStats.turnM||1)*dt;B.turretYaw=wrap(B.turretYaw+clamp(wrap(want-B.turretYaw),-turn,turn));
 const pitch=B.lockId!==null?Math.atan2(locked.y-p.y,Math.hypot(locked.x-p.x,locked.z-p.z)):input.aimPitch||0;
 return {x:p.x+Math.sin(B.turretYaw)*160,y:p.y+2.2+Math.tan(clamp(pitch,-1.2,1.2))*160,z:p.z+Math.cos(B.turretYaw)*160};
}
// src: 0 the pilot; otherwise the friendly unit firing its own super (Session 6C): its kill, its damage flag (e.ad), never the pilot's
function hurt(B,e,amount,src=0){B.alert?.(e);if(e.sh&&e.sh.t>B.time)amount*=1+e.sh.k*e.sh.n;const f=src?B.friendById?.(src):null;if(e.core>0){if(src)amount=0;else{const c=Math.min(e.core,amount);e.core-=c;amount-=c;}}   // a general's shield core: the pilot's own damage only
 if(src){e.ad=1;B.allyDmg=(B.allyDmg||0)+Math.min(e.hp,amount);}else{e.pd=1;B.pilotDmg=(B.pilotDmg||0)+Math.min(e.hp,amount);}const old=e.hp;e.hp=Math.max(0,e.hp-amount);if(old>0&&!e.hp){if(src)B.friendKill?.(e,f);else{B.kills++;B.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7,at:B.time});}}B.effects.push({kind:'impact',x:e.x,y:e.y+2,z:e.z,life:.25,...(src?{a:1}:{})});}
function superDamage(B,e,base,t=B.playerStats){return base*(t.wmult||TIER_MULT[Math.max(0,t.wtier||0)])*dmgMult(t)*cmult(t,e.stats)*(e.stats.supTk||1)*(1-armor(e.stats));}
function fireSuper(B,s,T=B.playerStats,src=0){
 const raw=SUP[s.weapon],spec={...raw,dmg:SUP_CQ[s.weapon]*SUP_OC[s.oc||0]};for(const k of ['w','len','r','spd','range'])if(Number.isFinite(spec[k]))spec[k]*=SUPER_WORLD_SCALE;const p=s.origin,dx=Math.sin(s.yaw),dz=Math.cos(s.yaw);
 if(spec.kind==='shell'){
  const speed=spec.spd*(1+gsum(T,'vel'));
  B.superShells.push({x:p.x,y:p.y+2.2,z:p.z,vx:dx*speed,vz:dz*speed,vy:Math.tan(s.pitch)*speed,life:spec.range/speed,range:spec.r,damage:spec.dmg*projectileImpactMult(T),k:s.k,oc:s.oc||0,...(src?{src}:{})});return;
 }
 if(spec.kind==='nova'){
  for(const e of B.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y,e.z-p.z);if(e.hp>0&&d<spec.r+2&&visible(B,p,e,spec.r+2))hurt(B,e,superDamage(B,e,spec.dmg*(1-.4*d/(spec.r+2)),T),src);}
  B.effects.push({kind:'nova',x:p.x,y:p.y+2,z:p.z,r:spec.r,life:.45,k:s.k,oc:s.oc||0,at:B.time,...(src?{a:1}:{})});return;
 }
 // Pulse retains Arcade cover penetration; elevation blocks beams at the ground. Moonfall also stops at structures.
 const start={x:p.x,y:p.y+2.2,z:p.z};let length=spec.len;
 for(let d=.3;d<length;d+=.3)if(s.weapon==='pulse'?start.y+Math.tan(s.pitch)*d<=W.groundAt(start.x+dx*d,start.z+dz*d)+.08:C.blocked(start.x+dx*d,start.y+Math.tan(s.pitch)*d,start.z+dz*d)){length=d;break;}
 for(const e of B.enemies){const ex=e.x-p.x,ez=e.z-p.z,along=ex*dx+ez*dz,side=Math.abs(ex*dz-ez*dx),ey=p.y+Math.tan(s.pitch)*along;
 if(e.hp>0&&along>0&&along<=length&&side<spec.w+1.2&&Math.abs(e.y-ey)<3)hurt(B,e,superDamage(B,e,spec.dmg,T),src);}
 B.effects.push({kind:'beam',x:start.x,y:start.y,z:start.z,ex:start.x+dx*length,ey:start.y+Math.tan(s.pitch)*length,ez:start.z+dz*length,life:.4,weapon:s.weapon,k:s.k,oc:s.oc||0,w:spec.w,at:B.time,...(src?{a:1}:{})});
}
// Session 6C: a friendly unit's super (combat.js friendStep decides when: a full meter of its own damage, the minimum spacing).
// Its weapon's Conquest super, a normal hit (no timing bar for the AI), aimed from the unit at its target.
C.Battle.prototype.allySuper=function(f,T,aim){const weapon=T.wtype,yaw=Math.atan2(aim.x-f.x,aim.z-f.z),pitch=Math.atan2(aim.y-f.y-2.2,Math.max(1,Math.hypot(aim.x-f.x,aim.z-f.z)));
 fireSuper(this,{weapon,k:supKey(weapon,T.wtier),oc:1,yaw,pitch,origin:{x:f.x,y:f.y,z:f.z}},T,f.id);};
C.Battle.prototype.abilityStep=function(dt){
 ensure(this);const T=this.playerStats,rm=T.rm,mf=rm?this.modState():null;
 // research mods (Session 6B, rules.js mf*): Overdrive's dash charges, Capacitor Bank's faster shield, Aegis Matrix when the shield ends
 {const od=rm&&rm.overdrive?mfDashTick(T,mf,dt,C.engineeringValues(T,this.engineering).dashCooldown):null;this.dashCd=od===null?Math.max(0,this.dashCd-dt):od;}
 this.shieldCd=Math.max(0,this.shieldCd-dt*(mf?mfShieldRate(T,mf):1));{const was=this.shieldT>0;this.shieldT=Math.max(0,this.shieldT-dt);if(was&&!(this.shieldT>0)&&rm&&rm.aegis)mfShieldEnd(T,mf,this.playerMax);}
 // Session 6 consumables (rules.js CQ_ITEMS), started by the Worker's use-item action and stepped here on both sides:
 // a Repair Kit mends over its seconds; a Decoy Beacon counts down (combat.js lure() reads it).
 if(this.mend){const h=Math.min(this.mend.t,dt);if(h>0&&this.playerHp>0)this.playerHp=Math.min(this.playerMax,this.playerHp+this.mend.rate*h);this.mend.t-=h;if(!(this.mend.t>1e-8))this.mend=null;}
 if(this.decoy){this.decoy.t-=dt;if(!(this.decoy.t>1e-8))this.decoy=null;}
 if(this.dashState){this.dashState.t-=dt;if(this.dashState.t<=1e-8){this.dashState=null;const ram=mfRam(T);if(ram&&this.playerHp>0){let e=null,bd=1e9;for(const v of this.enemies){if(v.hp<=0)continue;const d=Math.hypot(v.x-this.player.x,v.z-this.player.z);if(d<5.8&&Math.abs(v.y+2.2-this.player.y)<4&&d<bd){bd=d;e=v;}}   // Ram Servo: a dash that ends against a Parasite
   if(e){this.modHurt(e,ram.dmg*this.modDps());e.cd=Math.max(e.cd||0,0)+ram.jam;mfCue(mf,'ram');this.effects.push({kind:'destroy',k:'pulse0',oc:0,x:e.x,y:e.y+2,z:e.z,r:3.5,life:.4,at:this.time});}}}}
 // the timing bar (Session 5E-2b, rules.js SUP_BAR_T...): the first SUPER press starts the charge and the sweep, a second
 // press stops it (advance() below); nobody pressing by the end of the sweep is a MISS. It fires SUP_REL after the stop
 if(this.superAttack){const sa=this.superAttack;if(sa.el===undefined||!sa.bar){sa.el=sa.el||0;sa.oc=1;}   // a super saved mid-charge by an older build fires as it was (a normal hit)
  sa.el+=dt;if(sa.oc===undefined&&sa.el>=SUP_BAR_T_CQ){sa.oc=0;sa.t=SUP_REL;}}
 if(this.superAttack){this.superAttack.t-=dt;if(this.superAttack.t<=0){this.superAttack.origin={x:this.player.x,y:this.player.y-2.2,z:this.player.z};fireSuper(this,this.superAttack);this.superAttack=null;}}
 for(const q of this.superShells){const n=Math.max(1,Math.ceil(Math.hypot(q.vx,q.vz)*dt/.3));for(let i=0;i<n&&q.life>0;i++){q.x+=q.vx*dt/n;q.z+=q.vz*dt/n;q.y+=q.vy*dt/n;
 const hit=this.enemies.some(e=>e.hp>0&&Math.hypot(e.x-q.x,e.z-q.z)<2.5&&Math.abs(e.y+2.2-q.y)<3);
 if(hit||C.blocked(q.x,q.y,q.z)||q.life<=dt){const T=q.src?C.friendStats(this.friendById(q.src)||{kit:null}):this.playerStats;for(const e of this.enemies){const d=Math.hypot(e.x-q.x,e.y+2.2-q.y,e.z-q.z);if(e.hp>0&&d<q.range+2&&C.lineClear(q,{x:e.x,y:e.y+2.2,z:e.z}))hurt(this,e,superDamage(this,e,q.damage*(1-.65*d/(q.range+2)),T),q.src||0);}this.effects.push({kind:'destroy',x:q.x,y:q.y,z:q.z,life:.5,k:q.k,oc:q.oc||0,r:q.range,at:this.time});q.life=0;}}
 q.life-=dt;}
 this.superShells=this.superShells.filter(q=>q.life>0).slice(-4);
};
function baseBlocked(B,p){if(!B.baseTier)return false;const D=C.baseDefinition,x=p.x-D.x,z=p.z-D.z;
 if(Math.abs(x)>22||Math.abs(z)>21)return false;
 if(Math.abs(Math.abs(x)-17)<3&&Math.abs(z)<18||Math.abs(z-16)<3&&Math.abs(x)<18)return true;
 if(B.baseTier>=2&&(x>1&&x<17&&z>1&&z<17||Math.hypot(x+7,z-8)<8))return true;
 if(B.baseTier>=3&&[-15,15].some(a=>Math.abs(x-a)<4&&Math.abs(z+13)<4))return true;
 return false;
}
function advance(B,p,input,dt,exploration){
 ensure(B);dt=clamp(dt,0,.25);if(B.playerHp<=0||B.state!=='active')return p;
 const values=C.engineeringValues(B.playerStats,B.engineering);if(input.shield&&B.shieldCd<=0){B.shieldT=values.shieldDuration;B.shieldCd=values.shieldCooldown;}
 let x=Number(input.x)||0,z=Number(input.z)||0,n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;
 const T=B.playerStats,mf=T.rm?B.modState():null;
 if(input.dash&&!B.dashState&&(mf?mfDashReady(T,mf,B.dashCd):B.dashCd<=0)){const l=Math.hypot(x,z),yaw=l>.2?Math.atan2(x,z):B.heading??B.turretYaw;B.dashState={t:values.dashTime,x:Math.sin(yaw),z:Math.cos(yaw)};B.dashCd=values.dashCooldown;if(mf){mfDash(T,mf,values.dashCooldown);if(T.rm.overdrive)B.dashCd=mf.dq>0?0:mf.dr;}}   // Overdrive: a charge left; Traction: the boost
 let left=dt,first=true;while(left>1e-8&&B.state==='active'&&B.playerHp>0){const h=Math.min(left,1/60,.35/(B.combatSpeed*values.dashSpeed),B.dashState?.t??Infinity);left-=h;const old=p,speed=B.dashState?B.combatSpeed*values.dashSpeed:(exploration?B.combatSpeed*2:B.combatSpeed)*(mf?mfSpeed(T,mf):1);
 const q=W.advance(p,(B.dashState?.x??x)*speed*h,(B.dashState?.z??z)*speed*h);
 if(!baseBlocked(B,q)&&!B.enemies.some(e=>e.hp>0&&Math.hypot(q.x-e.x,q.z-e.z)<3.8&&Math.abs(q.y-e.y)<3))p=q;
 if(p!==old)B.heading=Math.atan2(p.x-old.x,p.z-old.z);
 const target=aim(B,p,input,h);
 if(first&&input.order&&B.squadOrder)B.squadOrder(input.order);   // Session 6C COMMAND: an order is an edge, decided where the lock stands now
 // SUPER is an edge: it acts once, on the first slice of the command it arrives in. No super charging: it starts one (the bar
 // is drawn from the battle clock, the same on the phone and on the Worker that replays the command). A bar sweeping: it stops
 // it. A command is STEP long, so the stop is judged at the middle of the step it arrived in (fair to an early and a late thumb)
 if(first&&input.super){
  if(B.superAttack){const sa=B.superAttack;if(sa.oc===undefined&&sa.bar){sa.oc=supJudge(sa.bar,sa.el+STEP/2,SUP_BAR_T_CQ);sa.t=Math.max(SUP_REL,SUP[sa.weapon].charge-sa.el);}}
  else if(B.charge>=SUPER_MAX){B.charge=0;const weapon=B.playerStats.wtype;let h=(Math.round(B.time*1000)*2654435761+(B.kills|0)*40503)>>>0;const rnd=()=>{h=(Math.imul(h^(h>>>15),0x2c1b3c6d)+0x9e3779b9)>>>0;return ((h^(h>>>13))>>>0)/4294967296;};
   B.superAttack={weapon,k:supKey(weapon,B.playerStats.wtier),t:SUP_BAR_T_CQ+SUP_REL,el:0,bar:supBar(rnd,1),yaw:B.turretYaw,pitch:Math.atan2(target.y-p.y-2.2,160),origin:{...p}};}}
 B.tick(h,p,{aim:target,fire:(!!input.fire||first&&!!input.tapFire)&&!(B.superAttack&&B.superAttack.oc!==undefined)});first=false;   // the cannon keeps firing while the timing bar sweeps; it holds only for the release
 }
 return p;
}
// Fixed simulation quantum shared with the Worker (STEP_MS). The client predicts in exactly these steps with exactly the
// normalized command the Worker replays, so reconciliation reproduces the prediction instead of correcting it.
const STEP=.05;
function command(c){let x=Number(c.x)||0,z=Number(c.z)||0;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l;}const yaw=Number.isFinite(c.aimYaw)?c.aimYaw:0,pitch=Number.isFinite(c.aimPitch)?clamp(c.aimPitch,-.4,.5):0;
 const o={x,z,aimPitch:pitch||0,aimYaw:Math.atan2(Math.sin(yaw),Math.cos(yaw)),lockId:Number.isSafeInteger(c.lockId)&&c.lockId>=1&&c.lockId<=1e9?c.lockId:null,fire:!!c.fire,tapFire:!!c.tapFire,super:!!c.super,dash:!!c.dash,shield:!!c.shield,gather:!!c.gather,scan:!!c.scan};if(Number.isInteger(c.order)&&c.order>=1&&c.order<=5)o.order=c.order;return o;}   // order: Session 6C COMMAND (sent only when given)
// The Worker's validateCommands mapping, verbatim. Predict and replay with validated(sent) so both sides compute bit-identical
// steps (re-wrapping an angle is not always idempotent in floating point).
function validated(c){return {x:c.x,z:c.z,aimPitch:c.aimPitch||0,aimYaw:Math.atan2(Math.sin(c.aimYaw||0),Math.cos(c.aimYaw||0)),lockId:c.lockId??null,fire:!!c.fire,tapFire:!!c.tapFire,super:!!c.super,dash:!!c.dash,shield:!!c.shield,gather:!!c.gather,scan:!!c.scan,order:c.order|0};}
// Presentation only: where the hull will be after a partial step with the current input. Never mutates the battle.
function preview(B,p,input,dt,exploration){
 if(!(dt>0)||B.playerHp<=0||B.state!=='active')return p;const values=C.engineeringValues(B.playerStats,B.engineering);
 let x=Number(input.x)||0,z=Number(input.z)||0,n=Math.max(1,Math.hypot(x,z));x/=n;z/=n;let left=Math.min(dt,STEP),dash=B.dashState?{...B.dashState}:null;
 const tk=B.playerStats.rm&&B.mf?mfSpeed(B.playerStats,B.mf):1;while(left>1e-8){const h=Math.min(left,1/60,.35/(B.combatSpeed*values.dashSpeed),dash?.t??Infinity);left-=h;const speed=dash?B.combatSpeed*values.dashSpeed:(exploration?B.combatSpeed*2:B.combatSpeed)*tk;
 const q=W.advance(p,(dash?.x??x)*speed*h,(dash?.z??z)*speed*h);if(!baseBlocked(B,q)&&!B.enemies.some(e=>e.hp>0&&Math.hypot(q.x-e.x,q.z-e.z)<3.8&&Math.abs(q.y-e.y)<3))p=q;
 if(dash){dash.t-=h;if(dash.t<=1e-8)dash=null;}}
 return p;
}
function carry(from,to){ensure(from);for(const k of ['playerShots','engineering','heat','heatOverflow','overheated','cooldown','charge','turretYaw','dashCd','shieldCd','shieldT','dashState','superAttack','superShells','mend','decoy','mf'])to[k]=JSON.parse(JSON.stringify(from[k]??null));if(to.mf===null)delete to.mf;ensure(to);}   // mf: the research mods' state (Session 6B)
root.ConquestControl=Object.freeze({advance,aim,visible,carry,ensure,baseBlocked,command,validated,preview,STEP,CONFIG});
})(globalThis);
