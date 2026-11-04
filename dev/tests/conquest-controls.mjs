import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),p=point(1500,1500),input={x:0,z:0,aimYaw:0};
const bare=()=>{const B=new C.Encounter(R.STOCK_L,p);B.enemies=[];return B;};
let counts=[];for(const fps of [15,30,60]){let B=bare(),q=p;for(let i=0;i<fps*3;i++)q=K.advance(B,q,{...input,fire:true},1/fps,true);counts.push(B.shots);assert.equal(B.lockId,null);assert.equal(B.charge,0);}assert.equal(new Set(counts).size,1,'real cadence invariant at15/30/60');
let B=bare();K.advance(B,p,{...input,tapFire:true},.05,true);assert.equal(B.shots,1);for(let i=0;i<40;i++)K.advance(B,p,input,.05,true);assert.equal(B.shots,1,'tap never leaves autofire');
B=bare();B.turretYaw=0;K.aim(B,p,{...input,aimYaw:Math.PI},1/60);assert(B.turretYaw<.1,'no snapping slow turret');
B=bare();let q=K.advance(B,p,{...input,x:1,dash:true},.2,true);assert(Math.abs(Math.hypot(q.x-p.x,q.z-p.z)-B.combatSpeed*3.4*.2)<.1);assert(Math.abs(B.dashCd-3.8)<1e-6);const cd=B.dashCd;K.advance(B,q,{...input,dash:true},.05,true);assert(B.dashCd<cd,'not repeated while cooldown');
B=bare();K.advance(B,p,{...input,shield:true},.05,true);assert(Math.abs(B.shieldT-2.95)<1e-6);assert(Math.abs(B.shieldCd-24.95)<1e-6);
const damage=shield=>{const B=bare();B.shieldT=shield;const e=new C.Encounter(R.STOCK_L,p).enemies[0],stats=e.stats;B.player={x:p.x,y:p.y+2.2,z:p.z};B.hit({...B.player,vx:1,vy:0,vz:0,team:'enemy',kind:'twin',stats},B.player,2.5);return B.playerMax-B.playerHp;};assert(Math.abs(damage(3)/damage(0)-.35)<1e-8);
for(const weapon of ['pulse','twin','siege','moon']){B=bare();B.playerStats.wtype=weapon;B.charge=1000;K.advance(B,p,{...input,super:true},.05,true);assert.equal(B.charge,0);assert.equal(B.superAttack.weapon,weapon);let seen=false;for(let i=0;i<20;i++){K.advance(B,p,input,.05,true);seen ||= weapon==='siege'?B.superShells.length>0:B.effects.some(e=>e.kind===(weapon==='twin'?'nova':'beam'));}assert(seen,weapon+' has distinct Arcade effect');}
for(const [x,z] of [[1351,1063],[1283,1104],[1163,1132]])for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){B=bare();q=point(x,z);for(let i=0;i<10;i++)q=K.advance(B,q,{...input,x:dx,z:dz},.05,true);assert(Math.hypot(q.x-x,q.z-z)>1,'reported ordinary slope traverses');}
console.log('PASS manual cadence, no auto-target, bounded turret, Dash speed/cooldown, Shield65%/3s/25s, all four Supers and reported slope coordinates',counts);
