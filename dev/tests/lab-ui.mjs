// Focused Laboratory UI regression: use the production rules and actual UI helpers.
// Run with node dev/tests/lab-ui.mjs. No network, account writes, or purchases.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rules=readFileSync('js/rules.js','utf8');
const ui=readFileSync('js/ui.js','utf8');
const index=readFileSync('index.html','utf8');
const version=JSON.parse(readFileSync('version.json','utf8'));
new Function(rules);
new Function(ui);
assert.ok(index.includes("window.BUILD='"+version.v+"'"),'Build must match version.json');
assert.ok(index.includes('js/ui.js?v='+version.v),'UI asset must be cache-busted');

const begin=ui.indexOf('const labStatRows=');
const end=ui.indexOf('function labInspect(key)',begin);
const cardsStart=ui.indexOf('function labCards(){',end);
const cardsEnd=ui.indexOf('function openLabEditor(',cardsStart);
assert.ok(begin>0&&end>begin&&cardsStart>end&&cardsEnd>cardsStart,'UI helper anchors');
const funcs=ui.slice(begin,end)+ui.slice(cardsStart,cardsEnd);
const test=`
const spec=(a,c)=>({w:{a,t:0,s:false},c:{c,t:0,s:false},
 cores:['dmg',null,null],mods:{hull:'stock',mobility:'stock',mount:'stock'},looks:{},paint:'stock'});
const save={gemLvl:{dmg:3},paints:{stock:true},lab:{active:'a',machines:{
 a:{name:'Scout Pilot',spec:spec('pulse','scout')},
 b:{name:'Titan Pilot',spec:spec('siege','titan')}}}};
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fmtNum=n=>String(n),WNAMES={pulse:['Pulse'],siege:['Siege'],twin:['Twin']};
ecoLoadout=(_,p)=>({...STOCK_L,w:{...p.w,q:1.06},c:{...p.c,q:1.07},
 cores:p.cores,mods:p.mods,looks:p.looks,gl:save.gemLvl});
const html=labCards();
const count=term=>(html.split(term).length-1);
if(count('class="panel labcard"')!==2||count('class="lab-stats"')!==2)throw Error('Need two bays with independent stat panels');
if(!html.includes('BAY A')||!html.includes('BAY B'))throw Error('Bay labels missing');
if(count('data-act="labedit"')!==2||count('data-art="lab:')!==2)throw Error('Each bay needs its own editor and visual');
const rowsA=labStatRows(save.lab.machines.a.spec),rowsB=labStatRows(save.lab.machines.b.spec);
if(rowsA[0][1]===rowsB[0][1])throw Error('Different chassis produced identical HP');
if(rowsA.some(r=>!Number.isFinite(r[1])||!Number.isFinite(r[2])||r[2]<=0))throw Error('Invalid telemetry');
if(count('style="width:100%"')>4)throw Error('Telemetry falsely appears maxed out');
const canvas={clientWidth:160,clientHeight:120,getContext:()=>({setTransform(){},clearRect(){}})};
const calls=[],dpr=1,drawGearIcon=()=>calls.push('gear'),
 drawGemArt=()=>calls.push('core'),drawMachinePreview=()=>calls.push('machine');
const getW=(...a)=>a,getC=(...a)=>a;
for(const key of ['weapon','chassis','core0','fithull','lookhull','paint']){
 const p=save.lab.machines.a.spec;
 const facts=labItemFacts(key,p),bars=labItemBars(key,p);
 if(!facts.includes('lab-facts')||facts.includes('undefined')||bars.includes('NaN'))throw Error('Invalid item facts: '+key);
 if(key==='weapon'&&!facts.includes('Owned weapon DPS'))throw Error('Rolled weapon DPS missing');
 if(key==='chassis'&&!facts.includes('Actual HP multiplier'))throw Error('Actual chassis HP missing');
 if(key==='core0'&&!bars.includes('Core level'))throw Error('Core level bar missing');
 if(key==='fithull'&&!bars.includes('Weight'))throw Error('Fitting capacity missing');
 labDrawSelectedItem(canvas,key,p);
}
if(calls.join(',')!=='gear,gear,core,machine,machine,machine')throw Error('Wrong equipment artwork');
return {cards:2,stats:2,inspected:6,actualHealth:[rowsA[0][1],rowsB[0][1]]};
`;
const result=new Function(rules+'\n'+funcs+'\n'+test)();
assert.ok(ui.includes('editorSheet.re=null'),'Draft must survive UI refresh');
assert.ok(ui.includes('itemSheet.re=null'),'Artwork must survive UI refresh');
assert.ok(ui.includes('labQuickRefreshers.forEach'),'All live item previews must update on change');
console.log('LUNAR Laboratory UI: PASS',result);
