// Session 6B owner decision 6: the POWER chip (a generic rating chip FORCE and DEFENSE reuse) on the Conquest HUD and hub with a one-
// line delta on change, Refuge Supply opening on BANK, REPAIR and the plating cards (ledger lines below), the engineering bonuses as
// one line with their real values, and zone bands on the region map and every briefing computed from the authored danger tiers,
// informational only (no enemy reads them). Run: node dev/tests/conquest-power-chip.mjs
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W}=CONQUEST;
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
// ---- the chip: a minimal DOM and localStorage ----
{const store={};const mk=(tag,cls)=>{const n={tag,className:cls||'',children:[],dataset:{},attrs:{},textContent:'',classList:{s:new Set((cls||'').split(' ').filter(Boolean)),toggle(c,on){on?this.s.add(c):this.s.delete(c);},remove(...c){c.forEach(x=>this.s.delete(x));},contains(c){return this.s.has(c);}},
  setAttribute(k,v){this.attrs[k]=v;},querySelector(sel){const c=sel.replace('.','');const f=x=>{for(const ch of x.children){if(ch.className.split(' ').includes(c))return ch;const r=f(ch);if(r)return r;}return null;};return f(this);}};return n;};
 const el=(tag,cls,text,parent)=>{const n=mk(tag,cls);if(text)n.textContent=text;if(parent)parent.children.push(n);return n;};
 const ctx=vm.createContext({globalThis:{},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}},Date});ctx.globalThis=ctx;vm.runInContext(fs.readFileSync('js/conquest/rating.js','utf8'),ctx);const Rt=ctx.ConquestRating;
 const root=mk('div'),c=Rt.chip(el,root,{key:'power',label:'POWER',value:92});ok(c.querySelector('.cq-rating-v').textContent==='92'&&c.dataset.label==='POWER','the chip shows its label and number');
 Rt.update(c,94);ok(c.querySelector('.cq-rating-v').textContent==='92 → 94'&&c.classList.contains('up'),'a change shows the one-line delta "POWER 92 → 94"');
 const c2=Rt.chip(el,mk('div'),{key:'power',label:'POWER',value:96});ok(c2.querySelector('.cq-rating-v').textContent==='94 → 96','a chip drawn later shows the change since the last value this device saw (a mod fitted in the garage)');
 {const doc={createElement:t=>mk(t)},host=mk('div'),p=Rt.chip(el,host,{key:'pend',label:'POWER',value:59});p.ownerDocument=doc;p.append=n=>{n.remove=()=>{p.children=p.children.filter(x=>x!==n);};p.children.push(n);};
  Rt.update(p,59,{next:60,note:'at the Refuge'});const line=p.children.find(n=>n.className==='cq-rating-next');
  ok(line&&line.textContent==='→ 60 at the Refuge'&&/POWER 59 · → 60 at the Refuge/.test(p.attrs['aria-label']),'a pending value shows as "→ 60 at the Refuge" (and in the screen-reader label)');
  Rt.update(p,60,{next:60});ok(!p.children.some(n=>n.className==='cq-rating-next')&&p.querySelector('.cq-rating-v').textContent==='59 → 60','the pending line goes once the chip reaches it, and the chip shows its rise "59 → 60"');}
 const f=Rt.chip(el,mk('div'),{key:'force',label:'FORCE',value:40});ok(f.querySelector('.cq-rating-v').textContent==='40'&&JSON.parse(store['lunar-rating-chips-v1']).power===96,'generic: another rating (FORCE, DEFENSE) keeps its own value');}
// ---- POWER is the gear rating, plating and research mods included ----
{const L={...structuredClone(R.STOCK_L)},p0=R.powerOf(L),p1=R.powerOf({...L,ap:[2,2,2,2]}),p2=R.powerOf({...L,mods:{mount:'rail'}});ok(p1>p0&&p2>p0,'POWER counts plating ('+p0+' -> '+p1+') and research mods ('+p0+' -> '+p2+')');}
// ---- zone bands: from the authored danger tiers, informational only ----
{const B=C.zoneBands();ok([1,2,3,4,5].every(r=>Array.isArray(B[r])&&B[r][0]<B[r][1]),'a band for every ring: '+[1,2,3,4,5].map(r=>W.RINGS[r]+' '+B[r].join('–')).join(', '));
 ok([2,3,4,5].every(r=>B[r][0]>=B[r-1][0]&&B[r][1]>=B[r-1][1])&&B[1][1]<B[3][1]&&B[3][1]<B[4][1],'bands follow the authored ring tiers: they never fall from the Heartland to the Inner Ring');
 ok(W.zones.every(z=>C.zoneBand(z.ring)===B[z.ring]),'every zone on the region map has its ring\'s band');
 const fresh=R.powerOf(R.ecoLoadout(R.ecoNorm({})));ok(fresh>=B[1][0]&&fresh<B[3][0],'a brand-new account (power '+fresh+') is in band in the Heartland and below the Frontier: the map shows where to grow');
 const vet=Object.values(C.operations).find(o=>o.danger==='VETERAN'),fld=C.operations['oxygen-line'],st=C.operations['strike-1'];ok(C.operationBand(vet)[0]>=140&&C.operationBand(fld)[0]<=55&&C.operationBand(fld)[1]<=100&&C.operationBand(st)===C.DANGER_BAND.HARD,'briefings show their own operation\'s tier: a VETERAN raid asks '+C.operationBand(vet).join('–')+', the first field mission '+C.operationBand(fld).join('–')+', a meteor strike '+C.operationBand(st).join('–'));
 const src=fs.readFileSync('js/conquest/combat.js','utf8'),body=src.slice(0,src.indexOf('const DANGER_BAND'))+src.slice(src.indexOf('root.ConquestCombat=Object.freeze'));
 ok(!/zoneBand|operationBand|DANGER_BAND/.test(body.replace(/root\.ConquestCombat=Object\.freeze\(\{[^}]*\}/,'')),'no Parasite, spawn or reward code reads a zone band (they are shown, never used)');
 ok(!/powerOf\(/.test(fs.readFileSync('js/conquest/combat.js','utf8')),'the Conquest combat engine never reads the pilot\'s gear rating');}
// ---- Refuge Supply: BANK, REPAIR and the plating cards first, the ledger lines below; the engineering line ----
{const app=fs.readFileSync('js/conquest/app.js','utf8'),sup=app.slice(app.indexOf('function supply(){'),app.indexOf('function engineeringLine('));
 const at=k=>sup.indexOf(k);ok(at("['bank','BANK SALVAGE']")>0&&at("['bank','BANK SALVAGE']")<at('platingCards(d,s)')&&at('platingCards(d,s)')<at("CP SECURED")&&at('CP SECURED')<at("'LUNAR ALLOY'"),'Refuge Supply opens on BANK and REPAIR, then the plating cards; the ledger lines are below');
 ok(at('engineeringLine(s)')>at('platingCards(d,s)')&&at('engineeringLine(s)')<at('CP SECURED'),'the engineering bonus line sits with the actions, above the ledger');
 const eng=app.slice(app.indexOf('function engineeringLine('),app.indexOf('function engineeringLine(')+1400);ok(/engineeringValues\(B\.playerStats,s\?\.engineering/.test(eng)&&/engineeringDefaults\(\{\}\)/.test(eng),'its values are the real tuned values against an untuned tank');
 // the real numbers for a tuned pilot
 const B=new C.Encounter(R.STOCK_L,{x:1500,z:1500,y:W.groundAt(1500,1500),surface:'ground'}),e={ranks:{heatCapacity:2,bulletRange:1},tuning:{}};const v=C.engineeringValues(B.playerStats,e),b=C.engineeringValues(B.playerStats,C.engineeringDefaults({}));
 ok(Math.round((v.capacity/b.capacity-1)*100)===18&&Math.round((v.range/b.range-1)*100)===9,'two heat-capacity ranks and one range rank read +18% heat capacity, +9% range (the line\'s numbers)');}
// ---- the HUD and the hub carry the chip ----
{const app=fs.readFileSync('js/conquest/app.js','utf8'),hub=fs.readFileSync('js/conquest/hub.js','utf8');ok(/ConquestRating\?\.chip\(el,hull,\{key:'power-field',label:'POWER'/.test(app)&&/ConquestRating\.chip\(el,copy,\{key:'power'/.test(hub),'the POWER chip is on the Conquest HUD (the tank in the field) and the hub (the garage), each with its own last-seen value');
 ok(/update\(pc,tankPower\(state\),\{next:fitPending\(state\),note:'at the Refuge'\}\)/.test(app),'a mod fitted away from the Refuge shows as a pending line until the terminal refits the tank');
 ok(/refitStep\(state\)/.test(app)&&/refitAsk\.n>=3\|\|now-refitAsk\.at<5000/.test(app)&&/Math\.hypot\(p\.x-T0\.x,p\.z-T0\.z\)<=11/.test(app),'at the Refuge terminal a pending refit asks the server for one sync (three tries, five seconds apart; inside the server\'s 12 m)');
 ok(/ZONE '\+Bd\[0\]\+'–'\+Bd\[1\]/.test(app)&&/ZONE BANDS/.test(app),'zone bands on every briefing and on the region map');}
console.log('PASS conquest-power-chip ('+passed+' checks)');
