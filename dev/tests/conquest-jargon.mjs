// Session 5C (§D): no dev jargon or roadmap wording in player-facing text, one level system (CC1-10) and one thing called
// POWER. Scans every string literal (comments excluded) of the Conquest UI and the shared rules' player-visible text.
import fs from 'node:fs';import assert from 'node:assert/strict';
const FILES=['js/conquest/plotview.js','js/conquest/app.js','js/conquest/hub.js','js/conquest/plot.js','js/conquest/townkit.js','js/conquest/sheet.js'];
const BAD=[[/\bsession\s*\d/i,'roadmap session number'],[/payments?\s+(are\s+)?certif/i,'"payments certified"'],[/\bcertified\b/i,'"certified"'],[/\btier\s+([ivx]+|\d)\b/i,'legacy tier wording'],[/\bbase\s+(i{1,3}|iv|v)\b/i,'legacy "Base I-V" wording'],[/command\s+power/i,'"Command Power" (now TOWN SCORE)'],[/plot regolith/i,'"plot regolith"'],[/\broadmap\b/i,'roadmap wording']];
// string literals of a JavaScript source, skipping comments and regular expressions
function strings(src){const out=[];let i=0,prev='';const n=src.length,sig=c=>{if(!/\s/.test(c))prev=c;};
 while(i<n){const c=src[i],d=src[i+1];
  if(c==='/'&&d==='/'){while(i<n&&src[i]!=='\n')i++;continue;}
  if(c==='/'&&d==='*'){i=src.indexOf('*/',i+2);if(i<0)break;i+=2;continue;}
  if(c==="'"||c==='"'||c==='`'){let j=i+1,s='';while(j<n&&src[j]!==c){if(src[j]==='\\'){s+=src[j+1];j+=2;continue;}if(c==='`'&&src[j]==='$'&&src[j+1]==='{'){let depth=1;const at=j+2;j+=2;while(j<n&&depth){if(src[j]==='{')depth++;else if(src[j]==='}')depth--;j++;}out.push(...strings(src.slice(at,j-1)));continue;}s+=src[j++];}out.push(s);i=j+1;prev=c;continue;}
  if(c==='/'&&(prev===''||'(,=:[!&|?{};+-*%<>~^'.includes(prev))){let j=i+1,cls=false;while(j<n){const e=src[j];if(e==='\\'){j+=2;continue;}if(e==='[')cls=true;else if(e===']')cls=false;else if(e==='/'&&!cls)break;else if(e==='\n')break;j++;}i=j+1;while(/[a-z]/i.test(src[i]||''))i++;prev='/';continue;}
  sig(c);i++;}
 return out;}
let checked=0;const hits=[];
for(const f of FILES){const list=strings(fs.readFileSync(f,'utf8'));checked+=list.length;for(const s of list)for(const [re,why] of BAD)if(re.test(s))hits.push(f+': '+why+': "'+s.slice(0,90)+'"');}
assert.deepEqual(hits,[],'player-facing dev jargon:\n'+hits.join('\n'));
// the scanner itself sees literals and skips comments
const t=strings("const a='Session 7';// Session 8\n/* payments certified */const b=/Session 9/g,c=`x${'y'}z`;");assert.deepEqual(t.sort(),['Session 7','xz','y']);
console.log('PASS conquest-jargon: '+checked+' string literals in '+FILES.length+' files; no roadmap sessions, "payments certified", tier/Base I-V wording or "Command Power" in player text');
