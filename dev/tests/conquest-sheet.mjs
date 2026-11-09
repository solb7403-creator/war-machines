// Session 5C bottom sheet (js/conquest/sheet.js): snap heights at the three phone sizes of the brief, inertia (a flick moves
// on to the next snap), release lands on the nearest snap, PEEK never hides the handle and the tabs, tap cycles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={performance:{now:()=>Date.now()}};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/conquest/sheet.js','utf8'),ctx);
const S=ctx.ConquestSheet;let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};
// free height = viewport minus the town header (~48 px) at 390x700, 390x844 and 320x568
for(const [w,h] of [[390,700],[390,844],[320,568]]){const H=h-48,hs=S.heights(H,74);
 ok(hs.peek<hs.half&&hs.half<hs.full,w+'x'+h+' snaps ordered '+JSON.stringify(hs));
 ok(Math.abs(hs.half-H*.5)<=1&&Math.abs(hs.full-H*.88)<=1,w+'x'+h+' HALF = 50%, FULL = 88% of the free height');
 ok(hs.peek>=74&&hs.peek>=Math.round(H*.18)-1,w+'x'+h+' PEEK is about 18% and never hides the handle + tabs');
 ok(H-hs.full>=50,w+'x'+h+' FULL still leaves a strip of map ('+(H-hs.full)+' px)');
 // slow releases land on the nearest snap
 for(const k of S.ORDER){ok(S.settle(hs[k]+6,0,H,74)===k&&S.settle(hs[k]-6,0,H,74)===k,w+'x'+h+' slow release near '+k+' stays '+k);}
 ok(S.settle((hs.peek+hs.half)/2+10,0,H,74)==='half'&&S.settle((hs.peek+hs.half)/2-10,0,H,74)==='peek','midpoint between PEEK and HALF splits correctly');
 // flicks carry on one snap in their direction, never past the ends
 ok(S.settle(hs.peek+8,1.2,H,74)==='half','a firm flick up from PEEK reaches HALF');
 ok(S.settle(hs.half+8,1.2,H,74)==='full','a firm flick up from HALF reaches FULL');
 ok(S.settle(hs.full-8,-1.2,H,74)==='half','a firm flick down from FULL reaches HALF');
 ok(S.settle(hs.half-8,-1.2,H,74)==='peek','a firm flick down from HALF reaches PEEK');
 ok(S.settle(hs.full,3,H,74)==='full'&&S.settle(hs.peek,-3,H,74)==='peek','flicks never pass the ends');
 ok(S.clamp(hs.full+500,hs)===hs.full&&S.clamp(-50,hs)===hs.peek,'heights clamp to PEEK..FULL');}
// a short screen: PEEK is raised to fit the tabs but never above HALF
{const hs=S.heights(200,140);ok(hs.peek===100&&hs.half===100,'tiny screen: PEEK capped at HALF '+JSON.stringify(hs));}
ok(S.next('peek')==='half'&&S.next('half')==='full'&&S.next('full')==='peek','a tap on the handle cycles PEEK -> HALF -> FULL -> PEEK');
// the town screen wires it: one CSS variable sizes the sheet, the stage takes the rest, the handle is touch-action:none
const pv=fs.readFileSync('js/conquest/plotview.js','utf8'),css=fs.readFileSync('css/conquest.css','utf8');
ok(pv.includes('ConquestSheet?.attach(')&&pv.includes("'--cq-sheet'"),'plotview drives the sheet through --cq-sheet');
ok(/\.cq-plot-drawer\{flex:0 0 var\(--cq-sheet\)/.test(css)&&/\.cq-plot-stage\{[^}]*flex:1 1 auto/.test(css),'the drawer is sized by --cq-sheet and the stage takes the rest');
ok(/\.cq-plot-grab\{[^}]*touch-action:none/.test(css)&&/\.cq-plot-sheet\{[^}]*touch-action:pan-y/.test(css),'handle drags (touch-action:none), the list scrolls (pan-y)');
ok(!/vh[;})]/.test(css.split('.cq-plot-drawer')[1]?.split('}')[0]||''),'no vh sizing in the sheet (Telegram vh is taller than the visible area)');
for(const [m,k] of Object.entries({home:'half',build:'half',weapons:'half',walls:'peek',defend:'half'}))ok(new RegExp(m+":'"+k+"'").test(pv),'default snap '+m+' = '+k.toUpperCase());
for(const f of ['index.html','web/boot.js'])ok(fs.readFileSync(f,'utf8').includes('conquest/sheet'),'sheet.js loads on '+f);
console.log('PASS conquest-sheet ('+n+' checks): snap heights at 390x700/390x844/320x568, nearest-snap release, flick inertia, tap cycle, CSS wiring');
