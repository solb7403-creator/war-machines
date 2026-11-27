// Science Lab store on the phone. Session 6B (owner decision 8) built the entries; Session 8 (owner brief
// docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md section 3, Nov 26, 2026) opens them (LAB_STORE_OPEN true): the entries show in the
// Shop (Telegram and the website) and in the Conquest Science Lab with their prices in the surface's currency (Telegram: Stars, and GRAM
// while the server's switch is on; the website: GRAM and SOL at the live rate). Every live button opens a SERVER QUOTE (js/checkout.js
// checkout(desc)) with exactly the Lab kind it shows; the Worker checks every rule again. Limits shown honestly: one of each pack a UTC
// week, one Legendary set mod a UTC week (1,500 Stars / 23 GRAM), a Legendary only after its track's set mod, owned and being-researched
// ones never for sale. With the store CLOSED (the switch off) every Lab button is disabled and has no action (checked too).
// Run: node dev/tests/lab-store-ui.mjs
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};const J=JSON.stringify;
const read=f=>fs.readFileSync(f,'utf8');
const ui=read('js/ui.js'),net=read('js/net.js'),co=read('js/checkout.js'),store=read('js/conquest/labstore.js');
const grab=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert(a>=0&&b>a,'found '+start);return src.slice(a,b);};
// a world: the rules, the price labels (js/checkout.js curLabel and the rails), the Shop's Lab section (js/ui.js) and labstore.js.
// mode 'tg' | 'web'; rails: the server's (setPayRails), or null for the surface's own rule before the first sync; open: LAB_STORE_OPEN
function world(mode,{rails=null,open=true,cur=null,buys=null}={}){const ctx=vm.createContext({console,Math,JSON,Object,Number,String,Array,Set,Map,Date,RegExp,globalThis:{}});ctx.globalThis=ctx;
 vm.runInContext(read('js/rules.js').replace(/^const LAB_STORE_OPEN=(true|false);/m,'const LAB_STORE_OPEN='+open+';'),ctx);
 vm.runInContext(`var IN_TG=${mode==='tg'},IN_WEB=${mode==='web'},CRYPTO_PAY=true,px={ton:3,sol:150,t:1},fetched=0,checkouts=[];function fetchPrices(){fetched++;}function store(){}
  const fmtNum=n=>Math.round(n||0).toLocaleString('en-US');function solFor(ton){if(!px.ton||!px.sol)return 0;const v=ton*px.ton/px.sol;return v>=1?Math.round(v*1000)/1000:Math.round(v*10000)/10000;}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const sec=(t,a)=>'<h3 class="sec">'+t+(a?'<span class="aside">'+a+'</span>':'')+'</h3>';
  function ecoX(){const t=Date.now(),day=Math.floor(t/864e5);return {day,week:Math.floor((day+3)/7),now:t};}
  function checkout(desc){checkouts.push(desc);}
  var save={rm:{vent:1,overclock:1,heatsink:1,inferno:1},lsm:{starfall:1},buys:${JSON.stringify(buys||{})},payCur:${JSON.stringify(cur)}};`,ctx);
 vm.runInContext(grab(co,'const CUR_NAME=','\nconst ERR_TXT='),ctx);
 if(rails)vm.runInContext('setPayRails('+JSON.stringify(rails)+')',ctx);
 vm.runInContext(grab(net,'function labPriceLabel(p){','\nfunction priceLabel('),ctx);
 vm.runInContext(grab(ui,'const buyBtn=','\nfunction labShopSec(){'),ctx);
 vm.runInContext(grab(ui,'function labShopSec(){','\n// Session 8 (owner, Nov 26, 2026): the Conquest store'),ctx);
 vm.runInContext(store,ctx);return ctx;}
const N=(W,id)=>vm.runInContext('rmodOf('+JSON.stringify(id)+').F.n',W),R0=world('tg');
ok(vm.runInContext('LAB_STORE_OPEN',R0)===true&&vm.runInContext('RS_LEG_PRICE.stars',R0)===1500&&vm.runInContext('RS_LEG_PRICE.ton',R0)===23&&vm.runInContext('RS_LEG_WEEK',R0)===1,'the Lab store is open (owner, Nov 26): a Legendary set mod 1,500 Stars / 23 GRAM, at most one a UTC week');
// ---- the Shop section, both surfaces ----
for(const mode of ['tg','web']){const W=world(mode,{rails:mode==='tg'?{stars:true,gram:true,sol:false}:{stars:false,gram:true,sol:true}}),h=W.labShopSec(),btns=h.match(/<button[^>]*>[^<]*<\/button>/g)||[];
 ok(['Field kit','Lab crate','Research cache'].every(n=>h.includes(n))&&['Sunfire','Hyperdrive','Aegis Prime'].every(n=>h.includes(n))&&h.includes(N(W,'starfall'))&&/Instant finish/.test(h),mode+': the Shop lists the three part packs, the four Legendary set mods and instant finish');
 const live=btns.filter(b=>/data-act="labbuy"/.test(b));
 ok(live.length===4&&live.every(b=>!/ disabled/.test(b))&&J(live.map(b=>/data-arg="([^"]+)"/.exec(b)[1]))===J(['rspack:kit','rspack:crate','rspack:cache','rsleg:sunfire']),mode+': four live buttons: the three packs and Sunfire (its set mod researched); each names exactly its Lab kind');
 ok(/Purchases never give points/.test(h)&&/one of each a week/.test(h)&&/Legendary set mods · one a week/.test(h),mode+': says purchases never give points, and the weekly limits');
 ok(h.includes(N(W,'starfall')+'</b><span>Ballistics · Owned')&&h.includes(N(W,'sunfire')+'</b><span>Thermal · A step stronger than '+N(W,'inferno'))&&h.includes(N(W,'hyperdrive')+'</b><span>Drive · Needs '+N(W,'overdrive')+' first'),mode+': Legendary lines follow the server record (owned; on sale after its set mod; needs its set mod first)');
 if(mode==='tg')ok(/>99 ⭐</.test(h)&&/>1,500 ⭐</.test(h)&&!/GRAM|SOL/.test(h.replace(/LUNAR/g,'')),'Telegram starts on Stars: '+(h.match(/>[\d,]+ ⭐</g)||[]).slice(0,4).join(' '));
 else ok(/>1\.6 GRAM</.test(h)&&/>23 GRAM</.test(h)&&!/⭐/.test(h)&&!/\bTON\b/.test(h),'the website starts on GRAM (never TON, no Stars): 1.6 GRAM a Field kit, 23 GRAM a Legendary');}
// ---- the currency the player picks: GRAM in Telegram while the switch is on, SOL on the website at the live rate ----
{const W=world('tg',{rails:{stars:true,gram:true,sol:false},cur:'ton'}),h=W.labShopSec();ok(/>23 GRAM</.test(h)&&/>1\.6 GRAM</.test(h),'Telegram with GRAM picked (switch on): 23 GRAM a Legendary, 1.6 GRAM a Field kit');}
{const W=world('tg',{rails:{stars:true,gram:false,sol:false},cur:'ton'}),h=W.labShopSec();ok(/>1,500 ⭐</.test(h)&&!/GRAM</.test(h)&&vm.runInContext('save.payCur',W)==='stars','the GRAM switch off in Telegram: a GRAM pick falls back to Stars');}
{const W=world('tg'),h=W.labShopSec();ok(/>1,500 ⭐</.test(h)&&!/GRAM</.test(h),'Telegram before the first sync: Stars only (the server\'s rails come with the sync)');}
{const W=world('web',{rails:{stars:false,gram:true,sol:true},cur:'sol'}),h=W.labShopSec();ok(/>0\.032 SOL</.test(h)&&/>0\.46 SOL</.test(h),'the website with SOL picked: 1.6 GRAM = 0.032 SOL and 23 GRAM = 0.46 SOL at $3 / $150');
 vm.runInContext('px={ton:0,sol:0,t:0};fetched=0;',W);const h2=W.labShopSec();ok(/… SOL/.test(h2)&&W.fetched>0,'the website asks for the live SOL rate when it has none yet (and never shows a made-up SOL price)');}
{const W=world('web',{rails:{stars:false,gram:true,sol:true},cur:'stars'});vm.runInContext('labShopSec()',W);ok(vm.runInContext('save.payCur',W)==='ton','the website never keeps a Stars pick (Stars are paid in Telegram)');}
// ---- the limits: this week's packs and Legendary bought ----
{const X=vm.runInContext('ecoX()',R0),wk=vm.runInContext('rsLegWeekKey(ecoX())',R0),pk=vm.runInContext("rsPackKey('kit',ecoX())",R0),W=world('tg',{rails:{stars:true,gram:true,sol:false},buys:{[wk]:1,[pk]:1}}),h=W.labShopSec(),live=(h.match(/data-arg="([^"]+)"/g)||[]).map(s=>s.slice(10,-1));
 ok(X.week>0&&J(live)===J(['rspack:crate','rspack:cache'])&&/Field kit<\/b><span>\+1 of every research part · bought this week: the next one in /.test(h)&&/One Legendary a week: the next one in /.test(h),'this week\'s Field kit and a Legendary bought: those buttons give way to when the next one opens (the other packs stay on sale)');}
// ---- the Conquest Science Lab rows (labstore.js) ----
function rows(W){const mk=(tag,cls)=>({tag,className:cls||'',children:[],attrs:{},dataset:{},textContent:'',disabled:false,setAttribute(k,v){this.attrs[k]=v;},append(c){this.children.push(c);}});
 const el=(tag,cls,text,parent)=>{const n=mk(tag,cls);if(text)n.textContent=text;if(parent)parent.children.push(n);return n;};
 const button=(text,fn,cls)=>{const b=mk('button',cls);b.textContent=text;b.onclick=fn;return b;};
 const all=n=>[n,...n.children.flatMap(all)],state={rs:{done:{vent:1,overclock:1,heatsink:1,inferno:1},jobs:[{mod:'aegisp'}]}};
 const run=(kind,info)=>{const r=mk('div');W.ConquestLabStore.row(r,kind,info,{el,button,state});return all(r);};return {run};}
{const W=world('tg',{rails:{stars:true,gram:true,sol:false}}),{run}=rows(W);
 const f=run('rsfin',{job:{id:'j2'},left:2*3600e3}),b1=f.find(n=>n.tag==='button');b1.onclick();
 ok(b1&&!b1.disabled&&/FINISH NOW · 31 ⭐/.test(b1.textContent)&&f.some(n=>/priced by the time left · free in 2 h 0 min/.test(n.textContent))&&J(vm.runInContext('checkouts.at(-1)',W))===J({kind:'rsfin',job:'j2'}),'a running job: FINISH NOW · 31 ⭐ (2 h left) with the free time beside it; it asks the server for a quote of that job (the Worker prices it from the real time left)');
 const s=run('rsleg',{id:'sunfire'}),b2=s.find(n=>n.tag==='button');b2.onclick();
 ok(b2&&!b2.disabled&&/BUY · LEGENDARY · 1,500 ⭐/.test(b2.textContent)&&s.some(n=>/one Legendary a week · or research it free/.test(n.textContent))&&J(vm.runInContext('checkouts.at(-1)',W))===J({kind:'rsleg',tk:'sunfire'}),'Sunfire (Inferno researched): BUY · LEGENDARY · 1,500 ⭐, one a week, or research it free');
 const hd=run('rsleg',{id:'hyperdrive'});ok(hd.filter(n=>n.tag==='button').every(n=>n.disabled)&&hd.some(n=>n.tag==='button')&&hd.some(n=>n.textContent.includes('only after '+N(W,'overdrive'))),'Hyperdrive before Overdrive: shown, disabled, only after its set mod');
 ok(run('rsleg',{id:'starfall'}).some(n=>/OWNED/.test(n.textContent))&&!run('rsleg',{id:'starfall'}).some(n=>n.tag==='button'),'an owned Legendary says so, with no button');
 ok(run('rsleg',{id:'aegisp'}).some(n=>/Being researched/.test(n.textContent))&&!run('rsleg',{id:'aegisp'}).some(n=>n.tag==='button'),'a Legendary being researched is not for sale (one ownership, two ways in)');
 const p=run('rspack',{}),bs=p.filter(n=>n.tag==='button');bs.forEach(b=>b.onclick());
 ok(bs.length===3&&bs.every(b=>!b.disabled)&&J(vm.runInContext('checkouts.slice(-3)',W))===J([{kind:'rspack',tk:'kit'},{kind:'rspack',tk:'crate'},{kind:'rspack',tk:'cache'}])&&p.some(n=>/One of each pack a week/.test(n.textContent)),'the Lab store fold: three live packs, one of each a week, each a quote of its own kind');}
{const wk=vm.runInContext('rsLegWeekKey(ecoX())',R0),W=world('tg',{buys:{[wk]:1}}),{run}=rows(W),s=run('rsleg',{id:'sunfire'});ok(!s.some(n=>n.tag==='button')&&s.some(n=>/One Legendary set mod a week: the next one opens Monday 00:00 UTC/.test(n.textContent)),'a Legendary already bought this week: no button, the honest reset time');}
// ---- the store closed (the switch off): nothing can be bought ----
{const W=world('tg',{open:false}),h=W.labShopSec(),btns=h.match(/<button[^>]*>/g)||[];ok(btns.length>=3&&btns.every(b=>/ disabled/.test(b)&&!/data-act=/.test(b))&&/Not on sale right now/.test(h),'closed: every Shop Lab button is disabled, with no action');
 const {run}=rows(W),all=[...run('rsfin',{job:{id:'j2'},left:3600e3}),...run('rsleg',{id:'sunfire'}),...run('rspack',{})],bs=all.filter(n=>n.tag==='button');bs.forEach(b=>b.onclick());
 ok(bs.length===5&&bs.every(b=>b.disabled)&&vm.runInContext('checkouts.length',W)===0,'closed: the Science Lab rows are disabled and pressing them sends nothing');}
// ---- the client paths ----
{const src=[ui,net,store,read('js/core.js'),read('js/conquest/app.js'),read('js/conquest/plotview.js'),read('js/conquest/lab.js')].join('\n');
 ok(!/(payWithStars|payWithTon|payWithSol|starsInvoice|stars-invoice|pay-log)[^;\n]{0,80}\b(rspack|rsleg|rsfin)\b/.test(src)&&/labbuy:a=>\{const \[k,id\]=a\.split\(':'\);if\(k==='rspack'&&RS_PACKS\[id\]\)checkout\(\{kind:'rspack',tk:id\}\);else if\(k==='rsleg'&&rsLegSet\(id\)\)checkout\(\{kind:'rsleg',tk:id\}\);\}/.test(ui),'the Lab kinds go only through checkout() (the server quote), never an old payment path');
 const lab=read('js/conquest/lab.js');ok(/ctx\.store\(box,'rsfin'/.test(lab)&&/ctx\.store\(row,'rsleg'/.test(lab)&&/ctx\.store\(d,'rspack'/.test(lab),'the Science Lab screen shows all three store rows');
 ok(/'conquest\/labstore'/.test(read('web/boot.js'))&&/js\/conquest\/labstore\.js/.test(read('index.html'))&&/'checkout'/.test(read('web/boot.js'))&&/js\/checkout\.js/.test(read('index.html')),'labstore.js and checkout.js load in Telegram and on the website');}
console.log('PASS lab-store-ui ('+passed+' checks)');
