import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {buildSim} from '../../../worker/build-sim.mjs';import {fakeRec} from './fakerec.mjs';
buildSim();const {RULES:R,createSim}=await import('../../../worker/src/sim.gen.js');const {RoomCore}=await import('../../../worker/src/pvp.js');const {checkProof}=await import('../../../worker/src/proof.js');
const mods={hull:'plates',mobility:'stable',mount:'stock'},L={...structuredClone(R.STOCK_L),mods};L.chs=[L.c,{c:'scout',t:0,q:1,s:false}];
for(const g of R.GT_ORDER){
 const scale=g==='royale'?2:g==='boss'?1.5:g==='bounty'?.5:1;
 const io={now:()=>1000,day:()=>20000,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},credit:async()=>({})};
 const room=new RoomCore(io,{MAP:'craters'});room.seatPlayer({pid:'one',name:'One',q:{g,m:g==='royale'?'solo':'1v1'},L,power:R.powerOf(L),league:0});room.startVs();
 assert.equal(room.sim.units[0].mhp,Math.round(1700*scale*1.06));assert.equal(room.sim.units[0].wdps,73.5);
 const sock={send(){},close(){}};room.connect('one',sock);room.onMessage('one',sock,JSON.stringify({k:'c',c:'scout'}));assert.equal(room.sim.units[0].cls,'scout');assert.equal(room.sim.units[0].spdM,1.1375);
 const frozen=JSON.stringify(room.seats[0].L);L.mods.hull='light';assert.equal(JSON.stringify(room.seats[0].L),frozen);L.mods.hull='plates';
 const pf=fakeRec({g,m:'1v1',dur:120,won:true,place:g==='royale'?1:0,mhp:Math.round(1700*scale*1.06)});
 assert.ok(checkProof(pf,{g,m:'1v1',map:'classic',secs:125,won:true,drawn:false,place:g==='royale'?1:0,series:g==='arena',min:12,st:{dmg:0},variants:[{ci:1,mhp:Math.round(1700*scale*1.06),spdM:.91}]}).ok,g);
}
const ghostSim=createSim({random:()=>0,ev(){},end(){},round(){},death(){}});
ghostSim.setup({g:'arena',m:'1v1',map:'craters',series:true,seats:[{pid:'one',name:'One',L:structuredClone(R.STOCK_L)},null],ghosts:[{id:'ghost',n:'Ghost',L:{...structuredClone(R.STOCK_L),c:{c:'scout',t:0,q:1,s:false},mods:{mobility:'stable'}}}]});
ghostSim.start();ghostSim.units[1].hp=0;ghostSim.step(1/30);assert.equal(ghostSim.units[1].cls,'titan');assert.equal(ghostSim.units[1].spdM,.85*.95,'fitted ghost retains speed cost during counterpick');
function trial(seed,g,w,c,mods){const sim=createSim({seed,ev(){},end(){},round(){},death(){}}),load={...structuredClone(R.STOCK_L),w:{a:w,t:0,q:1,s:false},c:{c,t:0,q:1,s:false},mods};
 sim.setup({g,m:'1v1',map:'craters',series:false,seats:Array.from({length:g==='royale'?6:2},(_,i)=>i?null:{pid:'one',name:'One',L:load})});sim.start();sim.setCtl(sim.units[0],'bot');for(let i=0;i<5400&&sim.state==='play';i++)sim.step(1/30);return {out:sim.outcome(sim.units[0]),secs:sim.snap().el,hp:sim.units.map(u=>Math.round(u.hp))};}
const rows=[];for(const [g,w,c] of [['arena','pulse','scout'],['zone','twin','vanguard'],['boss','siege','titan'],['royale','pulse','titan']])for(const seed of [19,43,77])for(const [build,mods] of [['stock',{}],['heavy',{hull:'plates',mobility:'stable'}],['light',{hull:'light',mount:'firing'}]])rows.push({g,w,c,seed,build,...trial(seed,g,w,c,mods)});
assert.deepEqual(trial(19,'arena','pulse','scout',{}),trial(19,'arena','pulse','scout',{}));
writeFileSync('/tmp/lunar-session3-balance.json',JSON.stringify(rows,null,2));
for(const build of ['stock','heavy','light']){const a=rows.filter(x=>x.build===build);console.log(build,JSON.stringify({runs:a.length,wins:a.filter(x=>x.out.won).length,draws:a.filter(x=>x.out.drawn).length,meanSecs:+(a.reduce((s,x)=>s+x.secs,0)/a.length).toFixed(1)}));}
console.log('PASS fitted PvP snapshots/counterpick and proof contracts in six modes; 36 paired seeded representative matches');
