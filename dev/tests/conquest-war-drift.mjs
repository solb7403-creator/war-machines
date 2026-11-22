// Session 7 owner decision 5: the drift simulation, tuned through the garrison, general and LDF numbers (js/conquest/war.js WAR):
// a front left alone drifts toward the Parasites about one territory every 2-3 days, never past the limits; a pilot who fights about
// half the assaults and fortifies the threatened territory each day pushes it back within a week. The real shared clock (advance),
// many seeds, the pilot looking in every 6 hours (so the front never freezes); fights the pilot joins are won (begin + settle).
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{War:WR}}=await import('../../worker/src/sim.gen.js');const WAR=WR.WAR,H=3600000,T0=Date.UTC(2026,10,23,0),SEEDS=600;
function run(seed,policy,startP=4){const w=WR.fresh(T0);w.sc={n:9,done:1};for(const id of ['crossroads','helium','oxygen','ridge','western'].slice(0,startP-4))w.o[id]='p';
 const day=[];let lastFort=-1,bad=0;for(let h=6;h<=7*24;h+=6){const now=T0+h*H;
  if(policy==='active'){for(const e of WR.joinable(w,now))if(!e.go&&e.k==='a'&&WR.u32('half:'+seed+':'+e.id)%2===0){WR.begin(w,e.id,1,now);WR.settle(w,e.id,true,now,1);}   // about half the assaults, won in person
   const d=Math.floor(h/24);if(d!==lastFort){const th=w.ev.filter(e=>e.k==='a'&&WR.BY[e.t].cap&&w.o[e.t]==='h'&&(w.f[e.t]||0)<5).sort((a,b)=>a.l-b.l)[0];if(th){w.f[th.t]=(w.f[th.t]||0)+1;lastFort=d;}}}   // the threatened territory, a level a day
  WR.advance(w,now,'drift:'+policy+':'+seed,{},now-1000);const P=WR.parasiteHeld(w);if(P<3||P>8)bad++;if(h%24===0)day.push(P);}
 return {day,bad};}
const mean=(policy,startP)=>{let sum=0,bad=0,lower=0;for(let s=0;s<SEEDS;s++){const r=run(s,policy,startP);sum+=r.day[6];bad+=r.bad;if(r.day[6]<startP)lower++;}return {p7:sum/SEEDS,bad,lower:lower/SEEDS};};
const alone=mean('alone'),perTerritory=7/(alone.p7-4);
assert(perTerritory>=2&&perTerritory<=3,'left alone the front loses one territory every '+perTerritory.toFixed(2)+' days (owner: about every 2-3)');assert.equal(alone.bad,0,'never past the limits');
console.log('PASS left alone: Parasites '+alone.p7.toFixed(2)+' after a week from 4 = one territory every '+perTerritory.toFixed(2)+' days; never past the limits');
const back=mean('active',7);assert(back.p7<=5.5&&back.lower>=.8,'from a drifted front (7) an active pilot ends the week at '+back.p7.toFixed(2)+' ('+Math.round(back.lower*100)+'% of pilots lower)');
const hold=mean('active',4);assert(hold.p7<=alone.p7-1.5,'from the start an active pilot holds the line ('+hold.p7.toFixed(2)+' vs '+alone.p7.toFixed(2)+' alone)');
console.log('PASS half the assaults fought + the threatened territory fortified daily: a drifted front (7 Parasite) is pushed back to '+back.p7.toFixed(2)+' within a week ('+Math.round(back.lower*100)+'% of pilots); from the start it holds at '+hold.p7.toFixed(2)+' (alone '+alone.p7.toFixed(2)+')');
