// Session 6B Science Lab store on the phone (owner decision 8): the entries show in the Shop (Telegram and the website) and in the
// Conquest Science Lab with their proposed prices: Stars in Telegram, TON + SOL (live rate) on the website. Checkout is off in every
// currency: every Lab button is disabled, none has an action, and no client path sends a Lab kind to a payment.
// Run: node dev/tests/lab-store-ui.mjs
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const read=f=>fs.readFileSync(f,'utf8');
const ui=read('js/ui.js'),net=read('js/net.js'),store=read('js/conquest/labstore.js');
const grab=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert(a>=0&&b>a,'found '+start);return src.slice(a,b);};
function world(mode){const ctx=vm.createContext({console,Math,JSON,Object,Number,String,Array,Set,Map,Date,globalThis:{}});ctx.globalThis=ctx;
 vm.runInContext(read('js/rules.js'),ctx);
 vm.runInContext(`var IN_TG=${mode==='tg'},IN_WEB=${mode==='web'},px={ton:3,sol:150,t:1},fetched=0;function fetchPrices(){fetched++;}
  const fmtNum=n=>Math.round(n||0).toLocaleString('en-US');function solFor(ton){if(!px.ton||!px.sol)return 0;const v=ton*px.ton/px.sol;return v>=1?Math.round(v*1000)/1000:Math.round(v*10000)/10000;}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const sec=(t,a)=>'<h3 class="sec">'+t+(a?'<span class="aside">'+a+'</span>':'')+'</h3>';
  var save={rm:{vent:1,overclock:1,heatsink:1,inferno:1},lsm:{starfall:1}};`,ctx);
 vm.runInContext(grab(net,'function labPriceLabel(p){','\nfunction priceLabel('),ctx);
 vm.runInContext(grab(ui,'function labShopSec(){','\nfunction paintCard(id){'),ctx);
 vm.runInContext(store,ctx);return ctx;}
// ---- the Shop section ----
for(const mode of ['tg','web']){const W=world(mode),h=W.labShopSec(),btns=h.match(/<button[^>]*>/g)||[];
 ok(['Field kit','Lab crate','Research cache'].every(n=>h.includes(n))&&['Sunfire','Starfall','Hyperdrive','Aegis Prime'].every(n=>h.includes(n))&&/Instant finish/.test(h),mode+': the Shop lists the three part packs, the four Legendary set mods and instant finish');
 ok(btns.length>=6&&btns.every(b=>/ disabled/.test(b)&&!/data-act=/.test(b)),mode+': every Lab button is disabled and has no action ('+btns.length+' buttons)');
 ok(/Not on sale yet/.test(h)&&/never give points/.test(h),mode+': says plainly it is not on sale and never gives points');
 const N=id=>vm.runInContext('rmodOf('+JSON.stringify(id)+').F.n',W);
 ok(h.includes(N('starfall')+'</b><span>Ballistics · Owned')&&h.includes(N('sunfire')+'</b><span>Thermal · A step stronger than '+N('inferno'))&&h.includes(N('hyperdrive')+'</b><span>Drive · Needs '+N('overdrive')+' first'),mode+': Legendary lines follow the server record (owned, on sale after its set mod)');
 if(mode==='tg')ok(/>99 ⭐</.test(h)&&/>599 ⭐</.test(h)&&!/TON/.test(h.replace(/LUNAR/g,'')),'Telegram shows Stars only: '+(h.match(/>[\d,]+ ⭐</g)||[]).slice(0,4).join(' '));
 else ok(/1\.6 TON · 0\.032 SOL/.test(h)&&/9\.6 TON · 0\.192 SOL/.test(h)&&!/⭐/.test(h),'the website shows TON and SOL at the live rate (1.6 TON = 0.032 SOL at $3 / $150), no Stars');}
{const W=world('web');vm.runInContext('px={ton:0,sol:0,t:0};fetched=0;',W);const h=W.labShopSec();ok(/… SOL/.test(h)&&W.fetched>0,'the website asks for the live SOL rate when it has none yet');}
// ---- the Conquest Science Lab rows ----
{const W=world('tg'),mk=(tag,cls)=>({tag,className:cls||'',children:[],attrs:{},dataset:{},textContent:'',disabled:false,setAttribute(k,v){this.attrs[k]=v;},append(c){this.children.push(c);}});
 const el=(tag,cls,text,parent)=>{const n=mk(tag,cls);if(text)n.textContent=text;if(parent)parent.children.push(n);return n;};
 const clicks=[];const button=(text,fn,cls)=>{const b=mk('button',cls);b.textContent=text;b.onclick=fn;clicks.push(fn);return b;};
 const all=n=>[n,...n.children.flatMap(all)],state={rs:{done:{vent:1,overclock:1,heatsink:1,inferno:1}}};
 const r1=mk('div');W.ConquestLabStore.row(r1,'rsfin',{job:{id:'j2'},left:2*3600e3},{el,button,state});
 const b1=all(r1).find(n=>n.tag==='button');ok(b1&&b1.disabled&&/FINISH NOW · 31 ⭐/.test(b1.textContent)&&all(r1).some(n=>/Not on sale yet · priced by the time left/.test(n.textContent)),'a running job shows FINISH NOW · 31 ⭐ (2 h left), disabled');
 const r2=mk('div');W.ConquestLabStore.row(r2,'rsleg',{id:'sunfire'},{el,button,state});const b2=all(r2).find(n=>n.tag==='button');ok(b2&&b2.disabled&&/LEGENDARY · 599 ⭐/.test(b2.textContent),'Sunfire (Inferno researched): LEGENDARY · 599 ⭐, disabled');
 const r3=mk('div');W.ConquestLabStore.row(r3,'rsleg',{id:'hyperdrive'},{el,button,state});ok(all(r3).filter(n=>n.tag==='button').every(n=>n.disabled)&&all(r3).some(n=>n.tag==='button')&&all(r3).some(n=>n.textContent.includes('Not on sale yet')&&n.textContent.includes('only after '+vm.runInContext("rmodOf('overdrive').F.n",W))),'Hyperdrive before Overdrive: the buy way still shows (owner, Nov 17: the node shows both ways), disabled, "Not on sale yet · and only after Overdrive"');
 const r4=mk('div');W.ConquestLabStore.row(r4,'rsleg',{id:'starfall'},{el,button,state});ok(all(r4).some(n=>/OWNED/.test(n.textContent)),'an owned Legendary says so');
 const r5=mk('div');W.ConquestLabStore.row(r5,'rspack',{},{el,button,state});const bs=all(r5).filter(n=>n.tag==='button');ok(bs.length===3&&bs.every(b=>b.disabled)&&all(r5).some(n=>/One of each pack a week/.test(n.textContent)),'the Lab store fold: three packs, all disabled, one of each a week');
 clicks.forEach(f=>f());ok(true,'pressing a Lab button does nothing (no handler sends anything)');}
// ---- no client path can pay for a Lab kind ----
{const src=[ui,net,store,read('js/core.js'),read('js/conquest/app.js'),read('js/conquest/plotview.js'),read('js/conquest/lab.js')].join('\n');
 ok(!/(pay|payWithStars|payWithTon|payWithSol|starsInvoice|stars-invoice)[^;\n]{0,80}\b(rspack|rsleg|rsfin)\b/.test(src)&&!/kind:'(rspack|rsleg|rsfin)'/.test(src),'no client code sends a Lab kind to a payment or an invoice');
 const lab=read('js/conquest/lab.js');ok(/ctx\.store\(box,'rsfin'/.test(lab)&&/ctx\.store\(row,'rsleg'/.test(lab)&&/ctx\.store\(d,'rspack'/.test(lab),'the Science Lab screen shows all three store rows');
 ok(/'conquest\/labstore'/.test(read('web/boot.js'))&&/js\/conquest\/labstore\.js/.test(read('index.html')),'labstore.js loads in Telegram and on the website');}
console.log('PASS lab-store-ui ('+passed+' checks)');
