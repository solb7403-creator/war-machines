// Run with node dev/tests/battle-roster.mjs
// Verifies the two owned-Laboratory machines, full-build lock UI, and source contract.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = p => readFileSync(p,'utf8');
const roster=src('js/battle-roster.js'),ui=src('js/ui.js'),match=src('js/match.js'),
 game=src('js/game.js'),worker=src('worker/src/pvp.js'),index=src('index.html'),
 version=JSON.parse(src('version.json'));
for(const code of [roster,ui,match,game])new Function(code);
assert.ok(index.includes('js/battle-roster.js?v='+version.v),'Load the exact cache-versioned roster module');
assert.ok(index.indexOf('js/battle-roster.js?v=')<index.indexOf('js/ui.js?v='),'Roster module must load before Play UI');
assert.ok(ui.includes('battleRosterHtml()'),'Play must show the machine roster');
assert.ok(ui.includes("labRequest('lab_activate'"),'Selections require authoritative Lab activation');
const pure=ui.slice(ui.indexOf('function vsBuild()'),ui.indexOf('function showVS('));
const rounds=ui.slice(ui.indexOf('function roundHTML('),ui.indexOf('function onRoundEnd('));
assert.ok(!pure.includes('data-act="swapcls"'),'VS must not offer owned chassis bypass');
assert.ok(!rounds.includes('data-act="rswap"'),'Arena rounds must not offer owned chassis bypass');
assert.ok(match.includes('function switchChassis(_cls){return false;}'),'Local battle cannot bypass machine lock');
assert.ok(!worker.includes('case "c":'),'Worker must reject legacy arbitrary chassis messages');
assert.ok(worker.includes('chs: [s.L.c.c]'),'Server must disclose only the locked chassis');
assert.ok(!game.includes('random()<0.5){const o=units.find(v=>v.team!==u.team)'),'Bots cannot dodge the machine commitment either');

const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const save={lab:{active:'machine_1',slots:{base_1:'machine_1',base_2:'machine_2'},machines:{
 machine_1:{name:'Moon Rover',spec:{w:{a:'pulse',t:0,s:false},c:{c:'vanguard',t:0,s:false}}},
 machine_2:{name:'Colossus <img>',spec:{w:{a:'moon',t:2,s:false},c:{c:'titan',t:2,s:false}}}}}};
const ecoLoadout=(_,spec)=>spec;
const powerOf=L=>L.c.c==='titan'?195:90;
const WNAMES={pulse:['Pulse Cannon']},CNAMES={vanguard:['Vanguard'],titan:['Titan','Bulwark','Colossus']};
const WEAPONS={pulse:{n:'Pulse Cannon'},moon:{n:'Moonbeam'}},CH={vanguard:{n:'Vanguard'},titan:{n:'Titan'}};
const result=new Function('save','ecoLoadout','powerOf','WNAMES','CNAMES','WEAPONS','CH','esc',roster+'\nreturn battleRosterHtml()')(save,ecoLoadout,powerOf,WNAMES,CNAMES,WEAPONS,CH,esc);
assert.equal((result.match(/class="battle-roster-card/g)||[]).length,2,'Exactly two independent machine choices');
assert.ok(result.includes('Moon Rover')&&result.includes('Colossus &lt;img&gt;'),'Names must be escaped');
assert.ok(result.includes('data-arg="machine_1"')&&result.includes('data-arg="machine_2"'),'Both machine identities must be preserved');
assert.ok(result.includes('POWER 195')&&result.includes('POWER 90'),'Stats must reflect each complete build');
assert.equal((result.match(/data-act="labequip"/g)||[]).length,2,'Both use the existing server-owned activation');
assert.equal((result.match(/ disabled/g)||[]).length,1,'Only the active machine is disabled');
assert.ok(result.includes('locked for the full match'));

console.log('PASS battle roster: two machine cards, activation, full-build locking, server rejection');
