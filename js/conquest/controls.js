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
 const want=B.lockId!==null?Math.atan2(locked.x-p.x,locked.z-p.z):input.aimYaw||0;
 const turn=STAT.turn*(B.playerStats.turnM||1)*dt;B.turretYaw=wrap(B.turretYaw+clamp(wrap(want-B.turretYaw),-turn,turn));
 const pitch=B.lockId!==null?Math.atan2(locked.y-p.y,Math.hypot(locked.x-p.x,locked.z-p.z)):input.aimPitch||0;
 return {x:p.x+Math.sin(B.turretYaw)*160,y:p.y+2.2+Math.tan(clamp(pitch,-1.2,1.2))*160,z:p.z+Math.cos(B.turretYaw)*160};
}
function hurt(B,e,amount){const old=e.hp;e.hp=Math.max(0,e.hp-amount);if(old>0&&!e.hp){B.kills++;B.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7});}B.effects.push({kind:'impact',x:e.x,y:e.y+2,z:e.z,life:.25});}
function superDamage(B,e,base){const t=B.playerStats;return base*(t.wmult||TIER_MULT[Math.max(0,t.wtier||0)])*dmgMult(t)*cmult(t,e.stats)*(e.stats.supTk||1)*(1-armor(e.stats));}
function fireSuper(B,s){
 const raw=SUP[s.weapon],spec={...raw};for(const k of ['w','len','r','spd','range'])if(Number.isFinite(spec[k]))spec[k]*=SUPER_WORLD_SCALE;const p=s.origin,dx=Math.sin(s.yaw),dz=Math.cos(s.yaw);
 if(spec.kind==='shell'){
  const speed=spec.spd*(1+gsum(B.playerStats,'vel'));
  B.superShells.push({x:p.x,y:p.y+2.2,z:p.z,vx:dx*speed,vz:dz*speed,vy:Math.tan(s.pitch)*speed,life:spec.range/speed,range:spec.r,damage:spec.dmg*projectileImpactMult(B.playerStats)});return;
 }
 if(spec.kind==='nova'){
  for(const e of B.enemies){const d=Math.hypot(e.x-p.x,e.y-p.y,e.z-p.z);if(e.hp>0&&d<spec.r+2&&visible(B,p,e,spec.r+2))hurt(B,e,superDamage(B,e,spec.dmg*(1-.4*d/(spec.r+2))));}
  B.effects.push({kind:'nova',x:p.x,y:p.y+2,z:p.z,r:spec.r,life:.45});return;
 }
 // Pulse retains Arcade cover penetration; elevation blocks beams at the ground. Moonfall also stops at structures.
 const start={x:p.x,y:p.y+2.2,z:p.z};let length=spec.len;
 for(let d=.3;d<length;d+=.3)if(s.weapon==='pulse'?start.y+Math.tan(s.pitch)*d<=W.groundAt(start.x+dx*d,start.z+dz*d)+.08:C.blocked(start.x+dx*d,start.y+Math.tan(s.pitch)*d,start.z+dz*d)){length=d;break;}
 for(const e of B.enemies){const ex=e.x-p.x,ez=e.z-p.z,along=ex*dx+ez*dz,side=Math.abs(ex*dz-ez*dx),ey=p.y+Math.tan(s.pitch)*along;
 if(e.hp>0&&along>0&&along<=length&&side<spec.w+1.2&&Math.abs(e.y-ey)<3)hurt(B,e,superDamage(B,e,spec.dmg));}
 B.effects.push({kind:'beam',x:start.x,y:start.y,z:start.z,ex:start.x+dx*length,ey:start.y+Math.tan(s.pitch)*length,ez:start.z+dz*length,life:.4,weapon:s.weapon});
}
C.Battle.prototype.abilityStep=function(dt){
 ensure(this);this.dashCd=Math.max(0,this.dashCd-dt);this.shieldCd=Math.max(0,this.shieldCd-dt);this.shieldT=Math.max(0,this.shieldT-dt);
 if(this.dashState){this.dashState.t-=dt;if(this.dashState.t<=1e-8)this.dashState=null;}
 if(this.superAttack){this.superAttack.t-=dt;if(this.superAttack.t<=0){this.superAttack.origin={x:this.player.x,y:this.player.y-2.2,z:this.player.z};fireSuper(this,this.superAttack);this.superAttack=null;}}
 for(const q of this.superShells){const n=Math.max(1,Math.ceil(Math.hypot(q.vx,q.vz)*dt/.3));for(let i=0;i<n&&q.life>0;i++){q.x+=q.vx*dt/n;q.z+=q.vz*dt/n;q.y+=q.vy*dt/n;
 const hit=this.enemies.some(e=>e.hp>0&&Math.hypot(e.x-q.x,e.z-q.z)<2.5&&Math.abs(e.y+2.2-q.y)<3);
 if(hit||C.blocked(q.x,q.y,q.z)||q.life<=dt){for(const e of this.enemies){const d=Math.hypot(e.x-q.x,e.y+2.2-q.y,e.z-q.z);if(e.hp>0&&d<q.range+2&&C.lineClear(q,{x:e.x,y:e.y+2.2,z:e.z}))hurt(this,e,superDamage(this,e,q.damage*(1-.65*d/(q.range+2))));}this.effects.push({kind:'destroy',x:q.x,y:q.y,z:q.z,life:.5});q.life=0;}}
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
 if(input.dash&&B.dashCd<=0&&!B.dashState){const l=Math.hypot(x,z),yaw=l>.2?Math.atan2(x,z):B.heading??B.turretYaw;B.dashState={t:values.dashTime,x:Math.sin(yaw),z:Math.cos(yaw)};B.dashCd=values.dashCooldown;}
 let left=dt,first=true;while(left>1e-8&&B.state==='active'&&B.playerHp>0){const h=Math.min(left,1/60,.35/(B.combatSpeed*values.dashSpeed),B.dashState?.t??Infinity);left-=h;const old=p,speed=B.dashState?B.combatSpeed*values.dashSpeed:exploration?B.combatSpeed*2:B.combatSpeed;
 const q=W.advance(p,(B.dashState?.x??x)*speed*h,(B.dashState?.z??z)*speed*h);
 if(!baseBlocked(B,q)&&!B.enemies.some(e=>e.hp>0&&Math.hypot(q.x-e.x,q.z-e.z)<3.8&&Math.abs(q.y-e.y)<3))p=q;
 if(p!==old)B.heading=Math.atan2(p.x-old.x,p.z-old.z);
 const target=aim(B,p,input,h);
 if(input.super&&B.charge>=SUPER_MAX&&!B.superAttack){B.charge=0;const weapon=B.playerStats.wtype;B.superAttack={weapon,t:SUP[weapon].charge,yaw:B.turretYaw,pitch:Math.atan2(target.y-p.y-2.2,160),origin:{...p}};}
 B.tick(h,p,{aim:target,fire:(!!input.fire||first&&!!input.tapFire)&&!B.superAttack});first=false;
 }
 return p;
}
function carry(from,to){ensure(from);for(const k of ['playerShots','engineering','heat','heatOverflow','overheated','cooldown','charge','turretYaw','dashCd','shieldCd','shieldT','dashState','superAttack','superShells'])to[k]=JSON.parse(JSON.stringify(from[k]??null));ensure(to);}
root.ConquestControl=Object.freeze({advance,aim,visible,carry,ensure,baseBlocked,CONFIG});
})(globalThis);
