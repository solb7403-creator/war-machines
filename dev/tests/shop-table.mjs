// Session 8 (owner, Nov 26, 2026; brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md): the one price table (js/rules.js SHOP).
// Every price and limit on sale lives there; dollar prices convert like the Lab store's (Stars = ceil(USD x 77), GRAM = USD x 1.25 to
// 2 decimals); the Conquest store (js/conquest/plot.js STORE) and the collection (js/conquest/catalog.js) read their prices from it;
// the owner's numbers are pinned here so a drift fails the build; rare-or-better ore is sold only for walls; nothing sold gives points.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Plot:P,Catalog:C}=CONQUEST;
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;console.log('PASS '+m);};
const J=JSON.stringify,cents=u=>Math.round(u*100);
// 1. the conversion rule, with integer cents (no float drift) for every dollar price on sale
const usdAll=[...Object.values(R.SHOP.cq).map(q=>q.usd),...Object.values(R.SHOP.cos),...Object.values(R.SHOP.mn).map(m=>m.usd),...Object.values(R.SHOP.ore).map(o=>o.usd)];
ok(usdAll.length===7+20+2+4&&usdAll.every(u=>{const p=R.usdPrice(u),c=cents(u);return p&&p.stars===Math.ceil(c*77/100-1e-9)&&p.ton===Math.round(c*1.25)/100&&p.usd===c/100;}),'every dollar price converts like the Lab store: Stars = ceil(USD x 77), GRAM = USD x 1.25 to 2 decimals ('+usdAll.length+' prices)');
ok(J(R.usdPrice(2.99))===J({usd:2.99,stars:231,ton:3.74})&&J(R.usdPrice(9.99))===J({usd:9.99,stars:770,ton:12.49})&&J(R.usdPrice(14.99))===J({usd:14.99,stars:1155,ton:18.74})&&R.usdPrice(0)===null,'worked examples: $2.99 = 231 Stars / 3.74 GRAM; $9.99 = 770 / 12.49; $14.99 = 1,155 / 18.74');
ok(R.RS_STARS_USD===77&&R.RS_TON_USD===1.25&&R.SHOP.rate.stars===77&&R.SHOP.rate.gram===1.25,'rates unchanged: 77 Stars and 1.25 GRAM a dollar');
// 2. the owner's prices and limits (Nov 26, 2026), pinned
const cq={'wall-ext-10':2.99,'skin-gilded':4.99,'skin-turret-neon':4.99,'foundry-rush':1.99,'builder-2':9.99,'theme-aurora':3.99,'layout-slot':1.99};
ok(J(Object.fromEntries(Object.entries(R.SHOP.cq).map(([k,q])=>[k,q.usd])))===J(cq),'the Conquest store at the owner\'s prices: '+Object.entries(cq).map(([k,u])=>k+' $'+u).join(', '));
ok(R.SHOP.cq['wall-ext-10'].step===10&&R.EXT_MAX_PCT===P.EXT.max&&P.EXT.max===50&&R.SHOP.cq['foundry-rush'].ms===86400000&&R.SHOP.cq['foundry-rush'].x===4,'the wall extension pack is +10% up to the +50% cap (the plot\'s own EXT.max); the Foundry speed-up is 4x for 24 h');
const cos={'base-bastion':7.99,'base-lancer':12.99,'base-cathedral':19.99,'base-orbital':24.99,'base-monolith':29.99,'fire-sunlance':3.99,'fire-ionwake':5.99,'fire-prism':7.99,'fire-siege':9.99,'fire-twin':14.99,'armor-brass':4.99,'armor-ceramic':7.99,'armor-radiant':9.99,'armor-vector':12.99,'armor-obsidian':19.99,'command-standard':2.99,'command-wings':4.99,'command-orrery':7.99,'command-beacon':9.99,'command-parasite':9.99};
ok(J(R.SHOP.cos)===J(cos),'the collection pieces at their proposed prices (the values catalog.js held before Session 8)');
ok(J(R.SHOP.mn.fe.give)===J({fe:150})&&R.SHOP.mn.fe.usd===1.99&&R.SHOP.mn.fe.day===2&&!R.SHOP.mn.fe.week&&J(R.SHOP.mn.il.give)===J({il:60,fe:30})&&R.SHOP.mn.il.usd===4.99&&R.SHOP.mn.il.day===1&&R.SHOP.mn.il.week===4,'minerals: Ferrite Crate 150 Ferrite $1.99, at most 2 a day; Ilmenite Crate 60 Ilmenite + 30 Ferrite $4.99, at most 1 a day and 4 a week');
ok(J(Object.fromEntries(Object.entries(R.SHOP.ore).map(([k,o])=>[k,[o.usd,o.day]])))===J({ar:[4.99,1],tq:[7.99,1],se:[9.99,1],mh:[14.99,1]})&&Object.values(R.SHOP.ore).every(o=>Number.isInteger(o.q)&&o.q>0),'wall-only ore crates: Armalcolite $4.99, Tranquillityite $7.99, Selenite $9.99, Moonheart $14.99, at most 1 of each a day (amounts '+Object.entries(R.SHOP.ore).map(([k,o])=>k+' '+o.q).join(', ')+')');
ok(J(R.SHOP.cfin)===J({usdH:0.22,exp:0.85,minUsd:0.1,stepMs:300000})&&R.SHOP.cfin===R.RS_FIN,'construction speed-ups use the Lab\'s instant-finish curve: $0.22 x hours^0.85, 5-minute steps, $0.10 minimum');
ok(R.RS_LEG_PRICE.stars===1500&&R.RS_LEG_PRICE.ton===23&&R.RS_LEG_WEEK===1&&R.SHOP.lab.leg===R.RS_LEG_PRICE,'Legendary set mods: 1,500 Stars / 23 GRAM each (the Epic crate\'s price), at most one a UTC week');
ok(J(Object.fromEntries(Object.entries(R.RS_PACKS).map(([k,p])=>[k,[p.stars,p.ton,p.each]])))===J({kit:[99,1.6,1],crate:[249,4,3],cache:[599,9.6,8]})&&R.SHOP.lab.packWeek===1,'research packs unchanged: Field kit 99 / 1.6, Lab crate 249 / 4, Research cache 599 / 9.6, one of each a UTC week');
ok(R.RSTARS[2]===1500&&R.RPRICE[2]===23,'the Epic crate is 1,500 Stars / 23 GRAM (the Legendary set mod matches it)');
ok(R.PASS_PRICE.stars===799&&R.PASS_PRICE.ton===13&&R.SHOP.sold.pass===R.PASS_PRICE,'the Lunar Pass stays 799 Stars / 13 GRAM');
// 3. one table: the Conquest store and the collection read their prices from SHOP; no price literal left in those files
ok(P.STORE.items.length===7&&P.STORE.items.every(i=>i.usd===R.SHOP.cq[i.id].usd&&i.name===R.SHOP.cq[i.id].n),'ConquestPlot.STORE shows the SHOP rows (prices and names from the one table)');
ok(C.items.filter(i=>!i.earnOnly).every(i=>i.proposedUsd===R.SHOP.cos[i.id])&&C.items.filter(i=>i.earnOnly).every(i=>i.proposedUsd===null)&&C.items.filter(i=>!i.earnOnly).length===20,'the collection reads its 20 prices from SHOP.cos; earn-only pieces are never priced');
{const pl=readFileSync('js/conquest/plot.js','utf8'),cat=readFileSync('js/conquest/catalog.js','utf8');
 ok(!/usd:\s*\d/.test(pl)&&!/,\d+\.99\)/.test(cat),'no dollar literal left in plot.js or catalog.js (the one table holds them)');}
// 4. guardrails: rare-or-better ore only for walls; nothing in the loot tables, no points, no consumable on its own
ok(['ar','tq','se','mh'].every(k=>!Object.values(R.SHOP.mn).some(m=>m.give[k]))&&J(R.SHOP.oreOrder)===J(['ar','tq','se','mh']),'rare-or-better ore is never in the mineral wallet crates (wall-only crates only)');
{const loot=J(R.LOOT),ids=[...Object.keys(R.SHOP.cq),...Object.keys(R.SHOP.cos)];ok(ids.every(id=>!loot.includes('"'+id+'"')),'no store item is in the loot tables');}
{const src=readFileSync('js/rules.js','utf8'),g=src.slice(src.indexOf('function cqGrant('),src.indexOf('function cqRefund('));ok(g.length>200&&!/ecoAward|\.pts\b|earned|dailyPts|ptsRaw|cqd\b/.test(g),'the Conquest store grant never gives points');}
ok(!R.SHOP.cq.ward&&!JSON.stringify(R.SHOP).includes('repair')&&!JSON.stringify(R.SHOP).includes('gambit'),'no consumable on its own and no Gambit is sold');
ok(R.DAILY_CAP===50000,'DAILY_CAP stays 50,000');
// 4b. a PAID crate's duplicate (bought in any currency, the Starter / Founder packs, the premium pass track) pays no points: it becomes a
// gem cache of its rarity; a crate bought with earned points still refunds its DUP_PTS (points in, points out)
{const S=R.ecoNorm({});for(const k of ['pulse','twin','siege']){S.wOwn[k]=[0,1,2];S.roll[k+':1']=1.1;}const X={day:20000,week:2857,rnd:()=>0.5},b=J([S.pts,S.earned,S.dailyPts,S.weeklyPts,S.days]);
 const o=R.ecoOpenBox(S,'weapon',1,X,undefined,true);ok(o.gem&&o.swap==='weapon'&&J([S.pts,S.earned,S.dailyPts,S.weeklyPts,S.days])===b,'a paid Rare weapon crate with every Rare weapon owned gives a Rare gem cache, never points or a day played');
 const o2=R.ecoOpenBox(S,'weapon',1,X,undefined,false);ok(o2.kind==='dup'&&o2.pts>0,'a crate bought with earned points still refunds DUP_PTS of them');
 const src=readFileSync('js/rules.js','utf8');ok(/ecoOpenBox\(S,r\.tk,r\.ri,X,c,prem\)/.test(src)&&/ecoOpenBox\(S,d\.tk,d\.ri,X,d\.c,true\)/.test(src)&&/ecoOpenBox\(S,'weapon',1,X,undefined,true\),ecoOpenBox\(S,'chassis',1,X,undefined,true\)/.test(src)&&/ecoOpenBox\(S,'weapon',2,X,undefined,true\)/.test(src),'every paid crate source opens as paid: a bought crate, the Starter and Founder packs, the premium pass track');}
// 4c. the town screens use what was bought (review round 1): both builders, every layout slot, the pass's Fortify perks, wall-only ore
{const pv=readFileSync('js/conquest/plotview.js','utf8'),app=readFileSync('js/conquest/app.js','utf8'),wm=readFileSync('js/conquest/warmap.js','utf8');
 ok(!/[^.\w]p\.job\b(?!2)/.test(pv.replace(/p\.job2/g,''))&&(pv.match(/P\.freeSlot\(p\)/g)||[]).length>=5&&/!PL\.freeSlot\(p\)/.test(app),'the town screens start jobs on any free builder (P.freeSlot), never only builder 1');
 ok(!/P\.LAYOUT\.slots/.test(pv)&&(pv.match(/P\.layoutSlots\(p\)/g)||[]).length>=2,'TOWN LAYOUTS shows every slot the town has (P.layoutSlots: the store slot and the pass)');
 ok(/const pass=passOn\(\)/.test(wm)&&!/const pass=false/.test(wm),'the War Map applies the pass\'s Fortify perks (passOn)');
 ok(/function wallOreOf\(p\)/.test(pv)&&/storesShort\(s,p,plan\.cost,true\)/.test(pv),'the wall tools count the wall-only ore first');}
// 5. the switches (Session 8: turned on only once every certification check passes)
ok(typeof R.CRYPTO_OPEN==='boolean'&&typeof R.CQ_STORE_OPEN==='boolean'&&typeof R.LAB_STORE_OPEN==='boolean'&&R.BAT_STORE_OPEN===false,'the store switches exist; the Battalion store stays off (not in the Nov 26 sale list)');
{const core=readFileSync('js/core.js','utf8'),m=/const CRYPTO_PAY=(true|false);/.exec(core);ok(m&&(m[1]==='true')===R.CRYPTO_OPEN,'the phone\'s CRYPTO_PAY mirrors the Worker\'s CRYPTO_OPEN ('+R.CRYPTO_OPEN+')');}
ok(C.checkout.enabled===R.CQ_STORE_OPEN&&P.STORE.checkout===R.CQ_STORE_OPEN,'the catalog checkout and the town store follow CQ_STORE_OPEN ('+R.CQ_STORE_OPEN+')');
// 6. the wiki publishes the same prices and limits as the one table (its Conquest and Lab store cards; GRAM, never TON, for the coin)
{const w=readFileSync('wiki.html','utf8'),card=id=>{const i=w.indexOf('id="'+id+'"');return i<0?'':w.slice(i,w.indexOf('</div>',w.indexOf('</table>',w.lastIndexOf('<table',w.indexOf('</div>\n <div',i)>0?w.indexOf('</div>\n <div',i):w.length))));},cq=card('shop-conquest'),lab=card('shop-lab'),f=x=>x.toLocaleString('en-US'),g=x=>String(Math.round(x*100)/100);
 const row=(name,usd)=>{const p=R.usdPrice(usd);return cq.includes(name)&&cq.includes('<td class="n">'+f(p.stars)+' ⭐</td><td class="n">'+g(p.ton)+'</td><td class="n">$'+p.usd.toFixed(2)+'</td>');};
 const all=[...R.SHOP.cqOrder.map(id=>[R.SHOP.cq[id].n,R.SHOP.cq[id].usd]),...Object.values(R.SHOP.mn).map(m=>[m.n,m.usd]),...R.SHOP.oreOrder.map(k=>[R.SHOP.ore[k].n,R.SHOP.ore[k].usd]),...C.items.filter(i=>!i.earnOnly&&i.proposedUsd).map(i=>[i.name,i.proposedUsd])];
 const miss=all.filter(([nm,usd])=>!row(nm,usd));
 ok(cq&&!miss.length,'the wiki\'s Conquest store card lists all '+all.length+' items at the table\'s Stars / GRAM / USD prices'+(miss.length?': missing '+miss.map(x=>x[0]).join(', '):''));
 ok(R.SHOP.oreOrder.every(k=>cq.includes(R.SHOP.ore[k].q+' '+R.MINERALS[k].s+' for town walls only · at most '+R.SHOP.ore[k].day+' a day'))&&cq.includes('at most 2 a day')&&cq.includes('at most 1 a day and 4 a week'),'the wiki states every crate\'s amount and limit');
 ok(lab.includes('<td class="n">'+f(R.RS_LEG_PRICE.stars)+' ⭐</td><td class="n">'+g(R.RS_LEG_PRICE.ton)+'</td>')&&lab.includes('at most one a UTC week')&&R.RS_PACK_ORDER.every(k=>lab.includes(R.RS_PACKS[k].n)&&lab.includes('<td class="n">'+f(R.RS_PACKS[k].stars)+' ⭐</td>')),'the wiki\'s Lab store card: Legendary set mods '+f(R.RS_LEG_PRICE.stars)+' Stars / '+R.RS_LEG_PRICE.ton+' GRAM one a UTC week, and the three packs');
 const shopSec=w.slice(w.indexOf('<section id="shop">'),w.indexOf('</section>',w.indexOf('<section id="shop">')));ok(!/<th class="n">TON<\/th>/.test(w)&&/GRAM<\/b> \(formerly TON/.test(shopSec),'the wiki names the coin GRAM (once "formerly TON"), never a TON price column');}
console.log('PASS shop-table ('+n+' checks)');
