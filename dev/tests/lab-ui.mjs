// Focused garage UI regression: the production rules and the actual UI helpers (exact stats, mod text), plus the
// garage's structure (five sections, one editor, every change through the server-checked lab save).
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
assert.ok(begin>0&&end>begin,'UI helper anchors');
const funcs=ui.slice(begin,end);
// the garage: one editor (the sections), saved through the server-checked lab save; the Engineer sheet is gone
for(const gone of ['openLabEditor','labFormSpec','labeditor','labsave','rangedraft','Engineer'])assert.ok(!ui.includes(gone),'removed: '+gone);
assert.ok(/function baySave\(/.test(ui)&&ui.includes("labRequest('lab_save'")&&ui.includes("labRequest('lab_rename'")&&ui.includes("labRequest('lab_activate'"),'every change goes through the lab save');
assert.ok(ui.includes("G_SECS=[['loadout','Loadout'")&&ui.indexOf("['cores','Cores'")<ui.indexOf("['up','Upgrades'")&&ui.indexOf("['up','Upgrades'")<ui.indexOf("['fit','Mods'")&&ui.indexOf("['fit','Mods'")<ui.indexOf("['style','Style'"),'five sections in order');
assert.ok(ui.includes('Back to the Garage'),'inspect sheet points back to the garage');
// a mod's trade-off text comes from its FITS entry, including fields added later (generic)
const mt=ui.slice(ui.indexOf('const MOD_WORD='),ui.indexOf('function gBays('));
const modText=new Function('gNum','fmtNum',mt+'\nreturn modText;')(v=>String(v),v=>String(v));
assert.equal(modText({n:'Reinforced plates',hp:.06,spd:-.04,dps:0,weight:2,power:0}),'+6% health, −4% speed');
assert.equal(modText({n:'Stock',hp:0,spd:0,dps:0,weight:0,power:0}),'No change: the standard part');
assert.equal(modText({n:'X',hp:-.05,dashCd:-.2,ramDamage:40,fx:'Shrugs off the first hit',weight:1,power:1}),'+40 ram damage, −5% health, −20% dash cd, Shrugs off the first hit');
const test=`
const SUP={pulse:{dmg:350,charge:.7},twin:{dmg:350,charge:.55},siege:{dmg:375,charge:.7},moon:{dmg:400,charge:.8}};
const spec=(a,c)=>({w:{a,t:0,s:false},c:{c,t:0,s:false},
 cores:['dmg',null,null],mods:{hull:'stock',mobility:'stock',mount:'stock'},looks:{},paint:'stock'});
const save={gemLvl:{dmg:3},paints:{stock:true},lab:{active:'a',machines:{
 a:{name:'Scout Pilot',spec:spec('pulse','scout')},
 b:{name:'Titan Pilot',spec:spec('siege','titan')}}}};
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const CNAMES={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
const fmtNum=n=>String(n),WNAMES={pulse:['Pulse'],siege:['Siege'],twin:['Twin']};
ecoLoadout=(_,p)=>({...STOCK_L,w:{...p.w,q:1.06},c:{...p.c,q:1.07},
 cores:p.cores,mods:p.mods,looks:p.looks,gl:save.gemLvl});
const rowsA=labStatRows(save.lab.machines.a.spec),rowsB=labStatRows(save.lab.machines.b.spec);
if(rowsA[0][1]===rowsB[0][1])throw Error('Different chassis produced identical HP');
if(rowsA.some(r=>!Number.isFinite(r[1])||!Number.isFinite(r[2])||r[2]<=0))throw Error('Invalid telemetry');
// Shared stat scales must accommodate legal combined fittings, even on a stock preview.
const bounds=labStatRows(save.lab.machines.a.spec);
const legalDPS=290; // round(118 × 1.32 × 1.08 × 1.11 × 1.27 × 1.225)
const legalSpeed=10.8; // round to 0.1: 4.4 × 1.24 × 1.52 × 1.10 × 1.18
if(bounds[1][2]<legalDPS-1e-9)throw Error('DPS bar ceiling excludes legal stable/firing combination');
if(bounds[2][2]<legalSpeed-1e-9)throw Error('Speed bar ceiling excludes legal light/sprint combination');
const wf=labItemFacts('weapon',save.lab.machines.a.spec);
if(!wf.includes('Super wind-up')||wf.includes('Super charge time'))throw Error('Super wind-up mislabeled as meter charge time');
if(!wf.includes('17.38'))throw Error('Equipped hit damage omitted the actual core level');
if(!wf.includes('Equipped hit damage')||!wf.includes('Equipped fire rate'))throw Error('Missing upgraded weapon stats');
const canvas={clientWidth:160,clientHeight:120,getContext:()=>({setTransform(){},clearRect(){}})};
const calls=[],dpr=1,drawGearIcon=()=>calls.push('gear'),
 drawGemArt=()=>calls.push('core'),drawMachinePreview=()=>calls.push('machine');
const getW=(...a)=>a,getC=(...a)=>a;
for(const key of ['weapon','chassis','core0','fithull','lookhull','paint']){
 const p=save.lab.machines.a.spec;
 const facts=labItemFacts(key,p),bars=labItemBars(key,p);
 if(!facts.includes('lab-facts')||facts.includes('undefined')||bars.includes('NaN'))throw Error('Invalid item facts: '+key);
 if(key==='weapon'&&!facts.includes('Actual weapon DPS'))throw Error('Rolled weapon DPS missing');
 if(key==='chassis'&&!facts.includes('Actual HP multiplier'))throw Error('Actual chassis HP missing');
 if(key==='core0'&&!bars.includes('Core level'))throw Error('Core level bar missing');
 if(key==='fithull'&&!bars.includes('Weight'))throw Error('Fitting capacity missing');
 if(key==='weapon'&&!bars.includes('Weapon DPS'))throw Error('Weapon DPS gauge missing');
 if(key==='weapon'&&!facts.includes('Gear level'))throw Error('Weapon rarity level missing');
 labDrawSelectedItem(canvas,key,p);
}
if(calls.join(',')!=='gear,gear,core,machine,machine,machine')throw Error('Wrong equipment artwork');
return {inspected:6,actualHealth:[rowsA[0][1],rowsB[0][1]]};
`;
const result=new Function(rules+'\n'+funcs+'\n'+test)();
assert.ok(ui.includes('itemSheet.re=null'),'Artwork must survive UI refresh');
console.log('LUNAR garage UI: PASS',result);
