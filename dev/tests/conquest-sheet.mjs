// Session 5C (docs/conquest/SESSION_05C_BASE_UX_FULL_PROMPT.md §B): the town screen's bottom sheet pulls up and down and
// settles on CLOSED (drive), PEEK (~18%), HALF (~50%) or FULL (~88%), keeps a release's momentum, rubber-bands past the
// ends and remembers a snap per tab (defaults HOME/BUILD/WEAPONS/DEFEND HALF, WALLS PEEK). Pure snap math (js/conquest/sheet.js).
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(fs.readFileSync('js/conquest/sheet.js','utf8'),c);const S=c.ConquestSheet;
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m);};
// screens below the header: 320x568, 390x700 (~Telegram visible area), 390x844, 430x932
for(const H of [568-54,700-54,844-54,932-54]){const h=S.heights(H,{bar:72});
 ok(h.closed<h.peek&&h.peek<h.half&&h.half<h.full&&h.full<H,'H '+H+': CLOSED '+h.closed+' < PEEK '+h.peek+' < HALF '+h.half+' < FULL '+h.full+' < screen');
 ok(Math.abs(h.half/H-.5)<.02&&Math.abs(h.full/H-.88)<.02&&(Math.abs(h.peek/H-.18)<.02||h.peek===118),'H '+H+': snaps near 18% / 50% / 88% of the screen (PEEK keeps at least the tabs + coach line: '+h.peek+' px)');
 ok(H-h.full>=56,'H '+H+': FULL leaves the map at least 56 px ('+(H-h.full)+')');
 // a slow release settles on the nearest snap
 for(const k of ['closed','peek','half','full'])ok(S.settle(h[k]+5,0,h)===k&&S.settle(h[k]-5,0,h)===k,'H '+H+': a release near '+k.toUpperCase()+' settles there');
 // momentum: a flick moves at least one snap the way it was thrown
 ok(S.settle(h.peek+4,1.2,h)==='half'&&S.settle(h.half+4,1.2,h)==='full'&&S.settle(h.full-3,1.2,h)==='full','H '+H+': an upward flick moves up one snap (and FULL stays FULL)');
 ok(S.settle(h.half-4,-1.2,h)==='peek'&&S.settle(h.peek-4,-1.2,h)==='closed'&&S.settle(h.closed+2,-1.2,h)==='closed','H '+H+': a downward flick moves down one snap (CLOSED = drive)');
 ok(S.settle(h.peek+30,.3,h)===(Math.abs(h.peek+30+.3*180-h.half)<Math.abs(h.peek+30+.3*180-h.peek)?'half':'peek'),'H '+H+': a gentle release projects ~180 ms ahead');
 // CLOSED only where drive mode exists (3D) and nothing is being placed or drawn
 ok(S.settle(h.closed,-2,h,['peek','half','full'])==='peek','H '+H+': without drive mode the lowest snap is PEEK');
 // rubber band past the ends
 const over=S.drag(h.full+100,h),under=S.drag(h.closed-60,h);ok(over>h.full&&over<h.full+50&&under<h.closed&&under>h.closed-30,'H '+H+': dragging past FULL or CLOSED rubber-bands (35%)');
 ok(S.drag(h.half,h)===h.half,'H '+H+': inside the range the sheet follows the finger exactly');}
// the settle animation arrives and never overshoots
{let h=100,steps=0;while(steps<200){const r=S.approach(h,400,1/60);assert.ok(r.h<=400.0001);h=r.h;steps++;if(r.done)break;}ok(h===400&&steps<40,'the settle animation arrives in '+steps+' frames at 60 fps without overshoot');}
// release velocity from the last ~90 ms of samples
{const v=S.velocity([{t:0,h:100},{t:100,h:110},{t:150,h:160},{t:190,h:200}]);ok(Math.abs(v-1)<.01,'velocity from the last ~90 ms: '+v.toFixed(2)+' px/ms');ok(S.velocity([{t:0,h:5}])===0,'one sample: no velocity');}
// remembered snap per tab, with the brief's defaults
ok(S.snapOf('home',{})==='half'&&S.snapOf('build',{})==='half'&&S.snapOf('weapons',{})==='half'&&S.snapOf('walls',{})==='peek'&&S.snapOf('defend',{})==='half','default snaps: HOME/BUILD/WEAPONS/DEFEND HALF, WALLS PEEK');
ok(S.snapOf('walls',{walls:'full'})==='full'&&S.snapOf('home',{walls:'full'})==='half','the last snap is remembered per tab');
console.log('conquest-sheet: '+n+' checks passed');
