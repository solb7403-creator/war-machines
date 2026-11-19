import re
R='./'
def patch(f,pairs):
    s=open(R+f).read()
    for old,new in pairs:
        n=s.count(old);assert n==1,(f,n,old[:140]);s=s.replace(old,new)
    open(R+f,'w').write(s)
# Science Lab IV: max level 4 on the lab's existing curve, its own build times (planning pick: 30 s / 10 min / 1 h / 6 h)
patch('js/conquest/plot.js',[
 ("const TIME=[15*SEC,3*MIN,20*MIN,2*HOUR,6*HOUR],TIME3=[30*SEC,10*MIN,HOUR];","const TIME=[15*SEC,3*MIN,20*MIN,2*HOUR,6*HOUR],TIME3=[30*SEC,10*MIN,HOUR],TIME_LAB=[30*SEC,10*MIN,HOUR,6*HOUR];   // the Science Lab's own list (Session 6C: level IV builds in 6 h); the Trophy Hall keeps TIME3"),
 ("lab:T({n:'Science Lab',w:3,d:3,max:3,cc:3,pw:2,count:[[3,1]],cost:grow({cp:320,alloy:18,biomass:8,helium:3},2.4,3),time:TIME3,","lab:T({n:'Science Lab',w:3,d:3,max:4,cc:3,pw:2,count:[[3,1]],cost:grow({cp:320,alloy:18,biomass:8,helium:3},2.4,4),time:TIME_LAB,"),
])
# the shared Battalion rules load after combat.js and controls.js, on the phone and in the Worker's CONQUEST bundle
patch('worker/build-sim.mjs',[
 ("    read('js/conquest/controls.js').replace(/\\}\\)\\(globalThis\\);/g, '})(conquestRoot);') +\n","    read('js/conquest/controls.js').replace(/\\}\\)\\(globalThis\\);/g, '})(conquestRoot);') +\n    read('js/conquest/battalion.js').replace(/\\}\\)\\(globalThis\\);/g, '})(conquestRoot);') +\n"),
 ("Plot:conquestRoot.ConquestPlot,tankOf,machineSpeed};","Plot:conquestRoot.ConquestPlot,Battalion:conquestRoot.ConquestBattalion,tankOf,machineSpeed};"),
])
patch('index.html',[('<script src="js/conquest/controls.js?v=','<script src="js/conquest/controls.js?v=')])
s=open(R+'index.html').read();m=re.search(r'<script src="js/conquest/controls.js\?v=(\d+)"></script>\n',s);s=s.replace(m.group(0),m.group(0)+'<script src="js/conquest/battalion.js?v='+m.group(1)+'"></script>\n');open(R+'index.html','w').write(s)
patch('web/boot.js',[("'conquest/combat','conquest/controls',","'conquest/combat','conquest/controls','conquest/battalion',")])
print('wiring ok')
