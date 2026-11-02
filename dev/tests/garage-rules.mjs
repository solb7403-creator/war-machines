// Garage rules: build tags (every tag reachable, stable under small changes), unlock gating, compare deltas and the
// Legendary showcase. Pure rules only. Run: node dev/tests/garage-rules.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const R=new Function(readFileSync('js/rules.js','utf8')+'\nreturn {STOCK_L,BUILD_TAGS,buildTag,buildAxes,garageOpen,GARAGE_UP_AT,GARAGE_FIT_AT,machineView,machineDelta,machineMetrics,powerOf,tankOf,legendaryEdge,ecoNorm,labEnsure,ecoLoadout,FITS,FIT_ORDER,FIT_BUDGET,fittingStats,UORDER,GORDER,WORDER,CHORDER,BUILD_MAX,GTYPES,LEAGUES,TIERS,PAINTS,ROLL_MAX};')();
const core=readFileSync('js/core.js','utf8');
const names=src=>[...src.matchAll(/'([^']+)'/g)].map(m=>m[1].toLowerCase());
const CNAMES=names(core.match(/const CNAMES=\{[^\n]+/)[0]),WNAMES=names(core.match(/const WNAMES=\{[^\n]+/)[0]);
const reserved=new Set([...CNAMES,...WNAMES,...Object.values(R.GTYPES).map(g=>g.label.toLowerCase()),...R.LEAGUES.map(s=>s.toLowerCase()),
 ...R.TIERS.map(s=>s.toLowerCase()),...Object.values(R.PAINTS).map(p=>p.n.toLowerCase()),'moonbeam','lunar','legendary','epic','rare','common']);

// 1. names: 8-12 tags, unique, no clash with chassis, weapon, mode, league, tier or paint names
const tags=Object.values(R.BUILD_TAGS).map(t=>t.n);
assert.ok(tags.length>=8&&tags.length<=12,'8-12 tags');
assert.equal(new Set(tags).size,tags.length,'unique tag names');
for(const n of tags){assert.ok(!reserved.has(n.toLowerCase()),'tag clashes: '+n);for(const w of n.toLowerCase().split(' '))assert.ok(!reserved.has(w)||w==='iron','tag word clashes: '+n);}

// every legal build shape: chassis x weapon x upgrade spread (budget) x mods (budget) x core types
const L0=JSON.parse(JSON.stringify(R.STOCK_L));
const mk=(c,w,up,mods,cores)=>({...L0,c:{c,t:0,q:1,s:false},w:{a:w,t:w==='moon'?2:0,q:1,s:false},up,mods,cores,gl:{}});
const mods=[];for(const hull of Object.keys(R.FITS.hull))for(const mobility of Object.keys(R.FITS.mobility))for(const mount of Object.keys(R.FITS.mount)){const f=R.fittingStats({hull,mobility,mount});if(f.weight<=R.FIT_BUDGET.weight&&f.power<=R.FIT_BUDGET.power)mods.push({hull,mobility,mount});}
const ups=[];(function rec(i,acc,left){if(i===R.UORDER.length){ups.push({...acc});return;}for(let v=0;v<=Math.min(4,left);v++){acc[R.UORDER[i]]=v;rec(i+1,acc,left-v);}})(0,{},R.BUILD_MAX);
const coreSets=[];const G=R.GORDER;for(let a=0;a<G.length;a++)for(let b=a+1;b<G.length;b++)for(let c=b+1;c<G.length;c++)coreSets.push([G[a],G[b],G[c]]);
let seed=12345;const rand=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};const rnd=n=>Math.floor(rand()*n);
const pick=a=>a[rnd(a.length)];
const upsBy=[];for(const u of ups){const n=Object.values(u).reduce((a,b)=>a+b,0);(upsBy[n]=upsBy[n]||[]).push(u);}
const randomBuild=()=>mk(pick(R.CHORDER),pick([...R.WORDER,'moon']),{...pick(pick(upsBy))},{...pick(mods)},[...pick(coreSets)]);   // upgrade totals 0-14 equally likely

// 2. every tag is reachable, and the starter tank is Balanced
const seen={};for(let i=0;i<40000;i++){const L=randomBuild(),t=R.buildTag(L);seen[t.id]=(seen[t.id]||0)+1;}
for(const id of Object.keys(R.BUILD_TAGS))assert.ok(seen[id]>0,'tag never reached: '+id);
assert.equal(R.buildTag(L0).id,'balanced','starter tank is Balanced');
// hand-made examples, one per tag (also the report's "how to reach it")
const up=(o)=>({hull:0,cannon:0,engine:0,target:0,reactor:0,...o}),stock={hull:'stock',mobility:'stock',mount:'stock'};
const examples={
 crit:mk('vanguard','pulse',up({target:4}),stock,['dmg','rof','arm']),
 charger:mk('vanguard','pulse',up({reactor:4}),stock,['dmg','rof','arm']),
 jugg:mk('titan','pulse',up({hull:2,cannon:2}),stock,['dmg','rof','arm']),
 skirm:mk('scout','pulse',up({engine:2,cannon:2}),stock,['dmg','rof','arm']),
 glass:mk('vanguard','pulse',up({cannon:2}),stock,['dmg','rof','spd']),
 wall:mk('titan','pulse',up({hull:2}),stock,['arm','reg','dmg']),
 intercept:mk('scout','pulse',up({engine:2}),stock,['spd','dmg','arm']),
 sniper:mk('vanguard','siege',up({cannon:1}),stock,['dmg','arm','reg']),
 brawler:mk('vanguard','twin',up({hull:2}),stock,['arm','dmg','rof']),
 balanced:L0};
for(const [id,L] of Object.entries(examples))assert.equal(R.buildTag(L).id,id,'example for '+id+' gave '+R.buildTag(L).id);

// 3. stability: rarity, rolls, core levels, paint, looks and the skin never change the tag
for(let i=0;i<3000;i++){
 const L=randomBuild(),t=R.buildTag(L).id;
 const v=[{...L,w:{...L.w,t:L.w.a==='moon'?2:2,q:R.ROLL_MAX}},{...L,c:{...L.c,t:2,q:1.08}},{...L,gl:{dmg:5,rof:5,arm:5,spd:5,lck:5,reg:5}},{...L,paint:'gold'},{...L,skin:'lunar'},{...L,looks:{hull:'plates',mobility:'sprint',mount:'firing'}}];
 for(const x of v)assert.equal(R.buildTag(x).id,t,'cosmetic or rarity change flipped the tag');
}
// a single small change (one upgrade level, one core swap or one mod) flips the tag in a minority of cases only,
// and a full upgrade path (buying 14 levels one at a time) changes it only a few times
let changes=0,flips=0;
for(let i=0;i<6000;i++){
 const L=randomBuild(),t=R.buildTag(L).id,kind=rnd(3);let N;
 if(kind===0){const k=pick(R.UORDER);if(L.up[k]>=4)continue;const u={...L.up,[k]:L.up[k]+1};if(Object.values(u).reduce((a,b)=>a+b,0)>R.BUILD_MAX)continue;N={...L,up:u};}
 else if(kind===1){const i2=rnd(3),k=pick(R.GORDER);if(L.cores.includes(k))continue;const c=L.cores.slice();c[i2]=k;N={...L,cores:c};}
 else{N={...L,mods:{...pick(mods)}};const d=R.FIT_ORDER.filter(k=>N.mods[k]!==L.mods[k]).length;if(d!==1)continue;}
 changes++;if(R.buildTag(N).id!==t)flips++;
}
const flipRate=flips/changes;assert.ok(flipRate<0.30,'single-change flip rate '+flipRate.toFixed(3));
let maxPath=0,sumPath=0;
for(let i=0;i<2000;i++){
 let L=mk(pick(R.CHORDER),pick([...R.WORDER,'moon']),up({}),{...pick(mods)},[...pick(coreSets)]),t=R.buildTag(L).id,n=0;
 // a pilot with a plan: two or three favourite upgrades, bought one level at a time
 const fav=[pick(R.UORDER),pick(R.UORDER),pick(R.UORDER)];
 for(let s=0;s<R.BUILD_MAX;s++){const k=fav.find(f=>L.up[f]<4)||R.UORDER.find(f=>L.up[f]<4);L={...L,up:{...L.up,[k]:L.up[k]+1}};const t2=R.buildTag(L).id;if(t2!==t)n++;t=t2;}
 maxPath=Math.max(maxPath,n);sumPath+=n;
}
assert.ok(sumPath/2000<=2.5&&maxPath<=6,'upgrade path tag changes avg '+(sumPath/2000)+' max '+maxPath);

// 4. unlock gating: section thresholds, and owned or bought things never lock
const S=n=>({mp:n,up:{hull:0,cannon:0,engine:0,target:0,reactor:0},rsCr:0});
assert.equal(R.GARAGE_UP_AT,2);assert.equal(R.GARAGE_FIT_AT,5);
for(const sec of ['loadout','cores','style'])assert.ok(R.garageOpen(S(0),sec),sec+' open from match 0');
assert.ok(!R.garageOpen(S(1),'up')&&R.garageOpen(S(2),'up'),'Upgrades open after 2 matches');
assert.ok(!R.garageOpen(S(4),'fit')&&R.garageOpen(S(5),'fit'),'Mods open after 5 matches');
assert.ok(R.garageOpen({...S(0),up:{...S(0).up,hull:1}},'up'),'bought levels keep Upgrades open');
assert.ok(R.garageOpen({...S(0),rsCr:1},'up'),'a paid reset keeps Upgrades open');
const fitted={...S(0),lab:{machines:{a:{spec:{mods:{hull:'plates'}}},b:{spec:{mods:{}}}}}};
assert.ok(R.garageOpen(fitted,'fit'),'a fitted mod keeps Mods open');
assert.ok(!R.garageOpen({...S(0),lab:{machines:{a:{spec:{mods:{hull:'stock'}}}}}},'fit'),'stock mods do not unlock');

// 5. compare deltas come straight from machineMetrics / powerOf / tankOf
const A=examples.balanced,B={...A,up:{...A.up,hull:1}},d=R.machineDelta(A,B),mA=R.machineMetrics(A),mB=R.machineMetrics(B);
assert.equal(d.tough,mB.hp-mA.hp);assert.ok(d.tough>0);assert.equal(d.fire,0);assert.equal(d.speed,0);assert.equal(d.power,R.powerOf(B)-R.powerOf(A));
const swap=R.machineDelta(A,{...A,c:{c:'scout',t:0,q:1,s:false}});assert.ok(swap.tough<0&&swap.speed>0,'Scout: less toughness, more speed');
const crit=R.machineDelta(A,{...A,up:{...A.up,target:1}});assert.equal(crit.crit,Math.round(R.tankOf({...A,up:{...A.up,target:1}},1).critB*100));
const v=R.machineView(A);assert.equal(v.tough,mA.hp);assert.equal(v.fire,mA.dps);assert.equal(v.speed,mA.spd);
for(const k of Object.keys(v))assert.ok(Number.isFinite(v[k]),'finite '+k);
assert.deepEqual(Object.values(R.machineDelta(A,A)).filter(x=>x!==0),[],'no change, no delta');

// 6. Legendary showcase vs the best Epic option, on an owned build
const E={mp:0,pts:0,up:{hull:0,cannon:0,engine:0,target:0,reactor:0},moonbeam:true,skin:'lunar',paints:{stock:1}};R.ecoNorm(E);
const spec={w:{a:'moon',t:2,s:false},c:{c:'vanguard',t:0,s:false},cores:['dmg','rof','arm'],paint:'stock',mods:{},looks:{}};
const moon=R.legendaryEdge(E,spec,'moon');assert.ok(R.WORDER.includes(moon.vs));assert.ok(moon.d.fire>0,'Moonbeam out-fires the best Epic: '+JSON.stringify(moon));
const skin=R.legendaryEdge(E,spec,'skin');assert.ok(skin.d.tough>0&&skin.d.fire>0&&skin.d.speed===0,'Lunar Skin: more health and damage');

console.log('PASS garage rules:',JSON.stringify({tags:tags.length,reach:seen,flipRate:+flipRate.toFixed(3),upgradePath:{avg:+(sumPath/2000).toFixed(2),max:maxPath},moonEdge:moon,skinEdge:skin.d}));
