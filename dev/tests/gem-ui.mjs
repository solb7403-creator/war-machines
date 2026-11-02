import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/ui.js','utf8'),core=readFileSync('js/core.js','utf8'),rules=readFileSync('js/rules.js','utf8');
const state={gemLvl:{dmg:2,reg:5},gemShards:{dmg:4,reg:123}};
const helpers=ui.slice(ui.indexOf('function gemIcon('),ui.indexOf('const G_BODY='));
assert.ok(helpers.includes('function gemProgress('),'shared gem presentation helpers exist');
const R=new Function('save',rules+"\nconst fmtCore="+core.match(/const fmtCore=([^;]+);/)[1]+"; const CORE_UNIT={dmg:'damage',rof:'fire rate',arm:'armor',spd:'speed',lck:'crit chance',reg:'repair per second',vel:'projectile travel speed'};\n"+helpers+'\nreturn {gemProgress,gemCollection};')(state);
let h=R.gemProgress('dmg');
assert.match(h,/4 \/ 6 shards/);assert.match(h,/aria-valuenow="4"/);assert.match(h,/66.666/);
h=R.gemProgress('reg');assert.match(h,/MAXED/);assert.match(h,/Surplus: 123 shards/);assert.ok(!h.includes('undefined'));
h=R.gemCollection({cores:['dmg',null,'reg']});
assert.equal((h.match(/class="gem-card/g)||[]).length,7);
assert.match(h,/Equipped · Socket 1/);assert.match(h,/Not equipped/);assert.match(h,/0.23%/);
const reveal=core.slice(core.indexOf('function revealOf('),core.indexOf('function afterGain('));
const revealOf=new Function('save',rules+'\n'+reveal+'\nreturn revealOf;')(state);
assert.equal(revealOf({gem:'dmg',lv:2,n:3,up:1}).up,1);
assert.equal(revealOf({gem:'dmg',lv:2,n:1,up:0}).up,0);
console.log('PASS gem UI: seven cores, exact progress, max surplus, bonuses, equipment, level-up metadata');

// The legacy socket locator must remain unique alongside the seven collection cards.
const coresSource=ui.slice(ui.indexOf('cores:(spec)=>'),ui.indexOf('\n up:(spec,L)=>'));
const renderCores=new Function('save',rules+'\nconst fmtCore='+core.match(/const fmtCore=([^;]+);/)[1]+"; const CORE_UNIT={};\n"+helpers+'\nreturn '+coresSource.slice('cores:'.length).replace(/,\s*$/,'' )+';')(state);
const openBayCoreCalls=[];
const actions=Object.fromEntries(['core','gemcore'].map(action=>{
 const source=ui.match(new RegExp(' '+action+':([^,]+),'));
 assert.ok(source,'action handler exists: '+action);
 return [action,new Function('openBayCore','return '+source[1])(i=>openBayCoreCalls.push(i))];
}));
for(const cores of [['dmg',null,'reg'],['dmg','rof','arm'],[null,null,null]]){
 const html=renderCores({cores});
 const buttons=[...html.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
 const sockets=buttons.filter(b=>b.includes('data-act="core"'));
 const cards=buttons.filter(b=>b.includes('class="gem-card'));
 assert.equal(sockets.length,3,'only sockets use the legacy core action');
 for(let i=0;i<3;i++)assert.equal(sockets.filter(b=>b.includes('data-arg="'+i+'"')).length,1,'unique socket '+i);
 assert.equal(cards.length,7);
 for(const [i,card] of cards.entries()){
  assert.ok(card.includes('data-act="gemcore"'),'collection has its own action');
  const arg=card.match(/data-arg="(\d+)"/)[1];
  const key=['dmg','rof','arm','spd','lck','reg','vel'][i],slot=cores.indexOf(key);
  assert.equal(+arg,slot>=0?slot:Math.max(0,cores.indexOf(null)),'preserve picker target');
  actions.gemcore(arg);assert.equal(openBayCoreCalls.at(-1),+arg);
 }
 for(let i=0;i<3;i++){actions.core(String(i));assert.equal(openBayCoreCalls.at(-1),i);}
}
console.log('PASS gem/socket selectors and shared picker routing for empty, partial and full loadouts');

const coreInfo=new Function('save',rules+'\nconst fmtCore='+core.match(/const fmtCore=([^;]+);/)[1]+';\n'+ui.slice(ui.indexOf('function coreInfo('),ui.indexOf('function showInfo('))+'\nreturn coreInfo;')(state);
for(const k of ['dmg','rof','arm','spd','lck','reg','vel'])assert.ok(!JSON.stringify(coreInfo(k)).includes('undefined'));
assert.match(JSON.stringify(coreInfo('vel')),/projectile travel speed/);
assert.match(h=R.gemCollection({cores:['vel',null,null]}),/Velocity/);
assert.match(h,/15% projectile travel speed/);
console.log('PASS all seven core descriptions and Velocity bonus');
