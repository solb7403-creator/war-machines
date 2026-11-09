// Session 5C player-facing copy: no roadmap jargon ("Session 7", "payments certified"), one thing called POWER (the town's
// score is TOWN SCORE), one level system in the UI (CC1-10, no "Tier I-V" / "Base I"), no "plot regolith", and the retired
// fortress-defense controls stay out of the UI. Scans string literals only (comments may keep their history).
import fs from 'node:fs';import assert from 'node:assert/strict';
// string literals of a JS file (single, double, template), skipping comments; regex literals are rare in these files and
// contain no quotes that matter here
function strings(src){const out=[];let i=0,line=1;const n=src.length;while(i<n){const ch=src[i];if(ch==='\n'){line++;i++;continue;}
 if(ch==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n')i++;continue;}if(ch==='/'&&src[i+1]==='*'){const e=src.indexOf('*/',i+2);for(let k=i;k<(e<0?n:e);k++)if(src[k]==='\n')line++;i=e<0?n:e+2;continue;}
 if(ch==="'"||ch==='"'||ch==='`'){let j=i+1,s='';while(j<n&&src[j]!==ch){if(src[j]==='\\'){s+=src[j+1];j+=2;continue;}if(src[j]==='\n')line++;s+=src[j];j++;}out.push({s,line});i=j+1;continue;}
 i++;}return out;}
const FILES=['js/conquest/plotview.js','js/conquest/app.js','js/conquest/hub.js','js/conquest/view.js','js/conquest/townkit.js','js/conquest/sheet.js','js/conquest/plot.js'];   // plot.js: descriptions, vital effects and Worker error texts are shown to players
const BAD=[[/\bSession\s*\d/i,'roadmap session number'],[/\bTIER \d|UPGRADE TO TIER|your fortress/i,'tier / fortress wording (one level system: CC1-10, a town)'],[/certified/i,'payments certified'],[/\broadmap\b/i,'roadmap'],[/COMMAND POWER/i,'Command Power (now TOWN SCORE)'],[/\bTier [IVX]+\b|\bBASE [IVX]+\b|\bBase [IVX]+\b/,'tier / Base I-V wording (one level system: CC1-10)'],[/plot regolith/i,'plot regolith'],[/DEPLOY BASE DEFENSE|REPAIR FORTRESS|PARASITE DEFENSE/,'retired fortress-defense UI']];
let n=0;const hits=[];
for(const f of FILES){for(const {s,line} of strings(fs.readFileSync(f,'utf8'))){n++;for(const [re,why] of BAD)if(re.test(s))hits.push(f+':'+line+' '+why+': '+JSON.stringify(s.slice(0,90)));}}
// building descriptions are player text too (cards, selection)
{const src=fs.readFileSync('js/conquest/plot.js','utf8');for(const m of src.matchAll(/desc:'([^']*)'/g)){n++;for(const [re,why] of BAD)if(re.test(m[1]))hits.push('js/conquest/plot.js desc '+why+': '+m[1].slice(0,90));}}
assert.deepEqual(hits,[],'player-facing text is clean:\n'+hits.join('\n'));
// the base screen shows the new names
const pv=fs.readFileSync('js/conquest/plotview.js','utf8');for(const t of ["'HOME'","'BUILD'","'WEAPONS'","'WALLS'","'DEFEND'",'TOWN SCORE','STEP ',' OF ','FRAME','🛡 DEF '])assert.ok(pv.includes(t),'base screen copy has '+t);
console.log('PASS conquest-copy: '+n+' player strings in '+(FILES.length+1)+' files, no roadmap jargon, one POWER (TOWN SCORE), CC levels only, no retired defense UI');
