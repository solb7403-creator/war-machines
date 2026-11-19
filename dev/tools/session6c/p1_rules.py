# rules.js: the Battalion store (checkout off), Role Core track opened at Science Lab IV, ECO_KEYS
p='./js/rules.js'
s=open(p).read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    assert n==count,(n,old[:160])
    s=s.replace(old,new)
rep(""" 'rm','lsm','bpt','rsx','rsj'];""",""" 'rm','lsm','bpt','rsx','rsj','bch','liv','rcx'];   // Session 6C: pack command chips (a monotonic total), liveries owned, RECRUIT instant-finish credits: written only by ecoGrant after a verified payment (checkout off)""")
# ecoPrice / ecoOwned
rep(""" if(d.kind==='rsfin')return rsFinPrice(d.left);   // the time left comes from the Conquest record's job on the Worker, never from the phone""",""" if(d.kind==='rsfin')return rsFinPrice(d.left);   // the time left comes from the Conquest record's job on the Worker, never from the phone
 if(d.kind==='chippack')return {ton:CHIP_PACK.ton,stars:CHIP_PACK.stars};
 if(d.kind==='livery'){const L=LIVERIES[d.tk];return L?{ton:L.ton,stars:L.stars}:null;}
 if(d.kind==='rcfin')return rsFinPrice(d.left);   // the RECRUIT job's time left, from the Conquest record on the Worker (Session 6C)""")
rep(""" if(d.kind==='rsfin')return !/^j\\d{1,6}$/.test(String(d.job||''))||!!(S.rsx&&S.rsx[d.job]);   // that job is already paid for""",""" if(d.kind==='rsfin')return !/^j\\d{1,6}$/.test(String(d.job||''))||!!(S.rsx&&S.rsx[d.job]);   // that job is already paid for
 if(d.kind==='chippack')return ((S.buys&&S.buys[chipPackKey(X)])|0)>=1;   // this week's one is bought
 if(d.kind==='livery')return !LIVERIES[d.tk]||!!(S.liv&&S.liv[d.tk]);
 if(d.kind==='rcfin')return !/^r\\d{1,6}$/.test(String(d.job||''))||!!(S.rcx&&S.rcx[d.job]);""")
# ecoGrant
rep(""" else if(d.kind==='rsfin'){if(labSaleOk(S,d,X)){S.rsx=S.rsx&&typeof S.rsx==='object'?S.rsx:{};S.rsx[d.job]=1;S.spendGram+=Number(d.price)||0;outs.push({tk:'rsfin',job:d.job});}}   // Conquest finishes that job once (conquest-research.js account)""",""" else if(d.kind==='rsfin'){if(labSaleOk(S,d,X)){S.rsx=S.rsx&&typeof S.rsx==='object'?S.rsx:{};S.rsx[d.job]=1;S.spendGram+=Number(d.price)||0;outs.push({tk:'rsfin',job:d.job});}}   // Conquest finishes that job once (conquest-research.js account)
 else if(d.kind==='chippack'){if(batSaleOk(S,d,X)){const bk=chipPackKey(X);S.buys[bk]=(S.buys[bk]||0)+1;S.bch=Math.min(1e5,(S.bch|0)+CHIP_PACK.chips);S.spendGram+=Number(d.price)||CHIP_PACK.ton;outs.push({tk:'chippack',chips:CHIP_PACK.chips});}}   // Session 6C: a separate chip total (never the daily limit's)
 else if(d.kind==='livery'){if(batSaleOk(S,d,X)){S.liv=S.liv&&typeof S.liv==='object'?S.liv:{};S.liv[d.tk]=1;S.spendGram+=Number(d.price)||LIVERIES[d.tk].ton;outs.push({tk:'livery',id:d.tk});}}   // looks only
 else if(d.kind==='rcfin'){if(batSaleOk(S,d,X)){S.rcx=S.rcx&&typeof S.rcx==='object'?S.rcx:{};S.rcx[d.job]=1;S.spendGram+=Number(d.price)||0;outs.push({tk:'rcfin',job:d.job});}}   // the Conquest record finishes that RECRUIT job once (conquest-battalion.js account)""")
rep("""  else if(o.tk==='rsleg'){if(S.lsm)delete S.lsm[o.id];}""","""  else if(o.tk==='rsleg'){if(S.lsm)delete S.lsm[o.id];}
  else if(o.tk==='chippack'){S.bch=Math.max(0,(S.bch|0)-(o.chips|0));}
  else if(o.tk==='livery'){if(S.liv)delete S.liv[o.id];}""")
# the store constants, after the Lab store block
rep("""function ecoAddParts(S,n){""","""// ---- Session 6C Battalion store (owner prompt Nov 18): real entries with CHECKOUT OFF in every currency until Session 8 (gated like
// the Lab store: BAT_STORE_OPEN false; the Worker's descOf refuses every kind and ecoGrant enforces the sale rules itself, so no
// invoice, Telegram-confirmed payment, TON or SOL log can grant one). Prices are PROPOSALS at the shop's dollar rates (77 Stars,
// 1.25 TON a dollar; SOL at the live TON rate). Nothing here gives points; never sold: pilots, ranks, Role Core levels.
const BAT_STORE_OPEN=false;
// the chip pack: command chips for the Role Cores (the account's own total, S.bch, outside the one-a-day limit), one a UTC week
const CHIP_PACK=Object.freeze({n:'Command chip pack',chips:5,stars:299,ton:4.8});
const chipPackKey=X=>'chp|'+X.week;
// battalion liveries (blueprint §8 "Battalion colors and insignia: your paint and banner on every ally"), looks only, never power or
// points. Allies wear their stock paint by default; the LDF livery is only for LDF troops. 'colors' puts your own paint and your
// town banner on every ally; each plain set paints every ally one scheme (p: hull, a: trim). Ids never overlap a loot id.
const LIVERIES=Object.freeze({'liv-colors':Object.freeze({n:'Battalion colors',d:'Your paint and your banner on every ally',own:1,stars:399,ton:6.4}),
 'liv-arctic':Object.freeze({n:'Arctic livery',d:'Ice white and glacier blue on every ally',p:'#e6eef2',a:'#7fc8ff',stars:199,ton:3.2}),
 'liv-ember':Object.freeze({n:'Ember livery',d:'Charcoal and ember orange on every ally',p:'#2c2c31',a:'#ff7a3d',stars:199,ton:3.2}),
 'liv-verdant':Object.freeze({n:'Verdant livery',d:'Colony green and brass on every ally',p:'#3f6b4a',a:'#e0b85a',stars:199,ton:3.2}),
 'liv-nightfall':Object.freeze({n:'Nightfall livery',d:'Midnight blue and silver on every ally',p:'#1d2740',a:'#c8d4e8',stars:199,ton:3.2})});
const LIVERY_ORDER=Object.freeze(Object.keys(LIVERIES)),LDF_LIVERY=Object.freeze({p:'#5b646b',a:'#d9c27a'});
const BAT_KINDS=Object.freeze(['chippack','livery','rcfin']),batSaleOk=(S,d,X)=>BAT_STORE_OPEN&&!ecoOwned(S,d,X);
function ecoAddParts(S,n){""")
rep(""" order:['thermal','coil','servo','cap'],locked:{id:'role',n:'Role Cores',lab:4,d:'Coming with Science Lab level IV (battalions).'},""",""" order:['thermal','coil','servo','cap'],role:{id:'role',n:'Role Cores',lab:4,part:'chip',d:'Your pilots\\' roles: each level makes that role\\'s signature stronger on every pilot fitted with it.'},""")
rep("""cost:[2,4,5,9],timeMs:[0,1200000,7200000,28800000],passTime:0.75,slots:{base:1,lab3:1,pass:1},labMax:3,""","""cost:[2,4,5,9],timeMs:[0,1200000,7200000,28800000],passTime:0.75,slots:{base:1,lab3:1,pass:1},labMax:4,""")
open(p,'w').write(s)
print('rules ok')
