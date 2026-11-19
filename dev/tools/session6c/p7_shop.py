R='./'
f='js/ui.js'
s=open(R+f).read()
old="""  labShopSec()+"""
assert s.count(old)==1
s=s.replace(old,"""  labShopSec()+batShopSec()+""")
old="""function paintCard(id){"""
assert s.count(old)==1
s=s.replace(old,"""// Session 6C Battalion store (owner prompt Nov 18): the chip pack, the battalion liveries, the RECRUIT instant finish: CHECKOUT OFF in
// every currency (BAT_STORE_OPEN false; the Worker refuses every kind). Looks and speed only: never pilots, ranks or Role Core levels.
function batShopSec(){
 if(typeof CHIP_PACK!=='object'||typeof LIVERIES!=='object')return '';
 const off='<span class="labshop-off">Not on sale yet</span>',btn=p=>'<button class="btn sm btn-quiet" disabled aria-disabled="true">'+labPriceLabel(p)+'</button>';
 const liv=LIVERY_ORDER.map(id=>{const L=LIVERIES[id],own=!!(save.liv&&save.liv[id]);return '<div class="labshop-item"><div class="grow"><b>'+esc(L.n)+'</b><span>'+esc(L.d)+' · looks only</span></div>'+(own?'<span class="labshop-off">Owned</span>':btn(L)+off)+'</div>';}).join('');
 const f=labPriceLabel(rsFinPrice(8*3600e3));
 return sec('Battalion','Command chips · liveries')+'<div class="labshop panel"><p class="labshop-note">Not on sale yet: nothing in this section can be bought.</p><p class="mut">For your pilots in Conquest. Pilots, ranks and Role Core levels are never sold. Purchases never give points.</p>'+
  '<h4 class="ptsh">Command chip pack · one a week</h4><div class="labshop-item"><div class="grow"><b>'+esc(CHIP_PACK.n)+'</b><span>+'+CHIP_PACK.chips+' command chips for your Role Cores (on top of the one you earn each day)</span></div>'+btn(CHIP_PACK)+off+'</div>'+
  '<h4 class="ptsh">Battalion liveries · on every ally</h4>'+liv+
  '<h4 class="ptsh">Recruit instant finish · priced by the time left</h4><p class="mut">A full 8 h RECRUIT job: '+f+'. Shown on a running job in your HANGAR.</p></div>';
}
function paintCard(id){""")
open(R+f,'w').write(s)
print('shop ok')
