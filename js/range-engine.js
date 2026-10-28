'use strict';
// Supported browser instance adapter for the ACTUAL rules.js/game.js, loaded in its own realm.
// Bump this identity whenever combat or this setup/controller policy changes. No backend interface.
const RANGE_ENGINE_VERSION='lunar-range-s4.2-equipment/fits-'+FIT_VERSION;
let rangeConfig=null,rangeSeconds=0,rangeOpponents=[];
function rangePreset(k){
 const L=JSON.parse(JSON.stringify(STOCK_L));
 if(k==='equipped'){L.w.t=1;L.c.t=1;L.w.q=L.c.q=1.05;L.up.hull=1;L.up.cannon=1;L.up.engine=1;}
 return L;
}
function rangeSetup(cfg){
 if(!cfg||!GT_ORDER.includes(cfg.g)||!MAP_REAL.includes(cfg.map)||!Number.isInteger(cfg.seed)||cfg.seed<1||cfg.seed>4294967295||!['standard','equipped'].includes(cfg.preset)||!['player','ai'].includes(cfg.control))throw new Error('Invalid trial conditions');
 if(!cfg.L||!fittingValid(cfg.L.mods)||!fittingValid(cfg.L.looks,true))throw new Error('Invalid fittings');
 const f=fittingStats(cfg.L.mods);if(f.weight>FIT_BUDGET.weight||f.power>FIT_BUDGET.power)throw new Error('Build exceeds budget');
 rangeConfig=JSON.parse(JSON.stringify(cfg));rangeRandom=rng32(cfg.seed);rangeEvents=[];rangeForced=null;rangeStopped=false;rangeSeconds=0;rangeInput=[0,0];
 matchG=cfg.g;setMap(cfg.map);MM={n:['zone','crystal','bounty','boss'].includes(matchG)?2:1,series:false,mp:99};
 const L=rangeConfig.L,hs=hpScale();
 me=Object.assign(tankOf(L,hs),{x:10,y:28,ang:-Math.PI/2,flash:0,cd:.3,lk:null,buffs:[],sp:0,sup:null,team:0,hum:true,ctl:'me',name:'You',pid:'practice'});me.hp=me.mhp;units=[me];
 const add=(team,x,y,name,preset)=>{const u=mkGhost(team,x,y,{n:name,L:rangePreset(preset)});delete u.gh;delete u.gid;u.name=name;units.push(u);};
 if(isSolo(matchG)){const sp=royaleSpawns();for(let i=1;i<6;i++)add(i,sp[i].x,sp[i].y,'AI '+i,cfg.preset);}
 else{
  for(let i=1;i<MM.n;i++)add(0,i===1?6:14,26,'Wingman '+i,'standard');
  if(matchG==='boss')units.push(mkBoss(me,MM.n));
  else for(let i=0;i<MM.n;i++)add(1,i?6:10,i?6:4,'Opponent '+(i+1),cfg.preset);
 }
 startMatch();mstat=me.st;
 rangeOpponents=units.filter(u=>u!==me).map(u=>({team:u.team,cls:u.cls,w:u.wtype,hp:u.mhp,dps:u.wdps,spd:u.spdM,boss:!!u.boss}));
 if(cfg.control==='ai')setCtl(me,'bot');
 return rangeView();
}
function rangeView(){return {curMap,BR,baseWalls,navWalls,walls,rocks,craters,crates,me,units,bullets,timeLeft,state,boxes,matchG,MM,series,evt,warns,elapsed,gzones,gscore,cry,storm,boss,shells,mstat};}
function rangeResult(){
 const o=outcome(me,rangeForced),s=me.st||{};
 return {outcome:rangeStopped?'stopped':o.won?'won':o.drawn?'drawn':'lost',duration:Math.round(rangeSeconds*100)/100,damage:Math.round(s.dmg||0),taken:Math.round(s.taken||0),kills:s.kills||0,deaths:me.deaths||0,control:rangeConfig.control,
  objective:matchG==='zone'?{score:o.score,captures:s.caps||0}:matchG==='crystal'?{score:cry.cnt.slice(),collected:s.cry||0}:matchG==='bounty'?{score:o.score,stars:s.stars||0}:matchG==='royale'?{place:o.place,of:units.length}:matchG==='boss'?{bossDown:o.score[0]}:{remaining:units.filter(u=>u.hp>0).map(u=>u.team)},
  // Boss scales with the tested tank under real Survival rules; include its actual baseline in comparisons.
  opponents:rangeOpponents.map(u=>({...u}))};
}
globalThis.RangeSim={version:RANGE_ENGINE_VERSION,stock:()=>JSON.stringify(STOCK_L),setup:rangeSetup,view:rangeView,
 step(dt,input){if(state!=='play')return;rangeInput=input||[0,0];rangeSeconds+=dt;update(dt);},
 action(k,a,b){if(state!=='play'||!me||rangeConfig.control!=='player')return false;if(k==='super')return useSuper(me,a);if(k==='dash')return useDash(me,a,b);if(k==='shield')return useShield(me);return false;},
 events(){const es=rangeEvents;rangeEvents=[];return es;},result:rangeResult,
 stop(){if(state==='play'){rangeStopped=true;state='over';}},
 dispose(){state='menu';me=null;units=[];bullets=[];boxes=[];rangeEvents=[];rangeConfig=null;rangeOpponents=[];}
};
