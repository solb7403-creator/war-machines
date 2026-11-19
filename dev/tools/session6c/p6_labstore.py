R='./'
f='js/conquest/labstore.js'
s=open(R+f).read()
old=""" return null;}
root.ConquestLabStore=Object.freeze({row,OFF});"""
assert s.count(old)==1
s=s.replace(old,""" // Session 6C Battalion store (checkout off: the Worker refuses every kind, BAT_STORE_OPEN false): the RECRUIT job's instant finish,
 // a livery, the command chip pack (one a UTC week, its own chip total outside the one-a-day limit). Never points.
 if(kind==='rcfin'){const left=Number(info?.left)||0,p=rsFinPrice(left);if(!p)return null;return offer(el,button,parent,'FINISH NOW',p,'priced by the time left');}
 if(kind==='livery'){const L=typeof LIVERIES==='object'&&LIVERIES[info?.tk];if(!L)return null;return offer(el,button,parent,'BUY',{stars:L.stars,ton:L.ton},'looks only');}
 if(kind==='chippack'){if(typeof CHIP_PACK!=='object')return null;const a=el('article','cq-lab-node cq-lab-pack cq-bat-chippack',null,parent);el('h3','',CHIP_PACK.n.toUpperCase(),a);
  el('p','cq-lab-what','+'+CHIP_PACK.chips+' command chips for your Role Cores (one pack a week; they do not count toward the one-a-day chip)',a);offer(el,button,a,'BUY',{stars:CHIP_PACK.stars,ton:CHIP_PACK.ton});return a;}
 return null;}
root.ConquestLabStore=Object.freeze({row,OFF});""")
s=s.replace("""/* Science Lab store rows (owner decision 8, Nov 16, 2026):""","""/* Science Lab store rows (owner decision 8, Nov 16, 2026; Session 6C adds the Battalion kinds: RECRUIT finish, liveries, the chip pack):""")
open(R+f,'w').write(s)
print('labstore ok')
