// Session 7T test helpers: a claimed town at a Command Center level, a town attack put on the clock the way the Worker's own
// clock announces one (two ticks ahead), and a strong town for held raids. Never used by the game.
import {cc10Town} from '../fixtures/balance-towns.mjs';
export function townPilot(CONQUEST,R,createState,now,{site='ridge',cc=2,claimed=now-4*864e5,strong=false}={}){const {Plot:P,Combat:C,World:W}=CONQUEST;
 const s=createState(R.STOCK_L,now);s.ledger.cp=50000;s.ledger.banked={alloy:2000,biomass:2000,helium:500};s.lseed=987654321;s.twsd=123456789;
 s.base={tier:P.tierOf(cc),modules:{},builtAt:claimed,claimedAt:claimed,pointsAt:claimed,defense:{config:'turret',damage:0,wins:0,alertAt:0,nextAt:now+864e9,active:false}};
 let p;if(strong){p=cc10Town(P,site,{blends:[[6,3]],cells:3000,ext:true});}else{p=P.newPlot(site,claimed);p.cc=cc;p.b.cc.l=cc;}
 p.at=claimed;p.st={alloy:200,biomass:150,helium:40,fe:20,at:now};p.cm=Math.max(p.cm||0,300);s.plot=p;
 s.position={x:C.baseDefinition.x,z:C.baseDefinition.z,y:W.groundAt(C.baseDefinition.x,C.baseDefinition.z),surface:'ground'};s.battle.enemies=[];s.war=CONQUEST.War.norm(s.war,now);s.war.sc={n:9,done:1};s.war.ev=[];s.war.go=null;
 s.lastWall=now;return s;}
// an attack on the town announced at this tick (lands two ticks later), like ConquestTown.step makes one
export function townAttack(CONQUEST,s,now,{g='kethra',ln=0,go=false}={}){const {War:WR,Town:TN}=CONQUEST;s.tw=TN.norm(s.tw,now);const k=WR.tickOf(now),e={id:go?'go'+Math.floor(now/864e5):'t'+(++s.tw.n),a:k,l:k+WR.warnTicks(),g,ln,...(go?{go:1}:{})};s.tw.k=Math.max(s.tw.k,k);s.tw.ev.push(e);return e;}
// a mid town (CC6: 17 turrets of eight types at levels 2-3 on two rings, three rings of Armalcolite walls): raids at mid levels can
// breach it or take it, so every outcome is reachable in a test
export function midTown(P,site){const p=P.newPlot(site,0);p.cc=6;p.b.cc.l=6;const put=(t,l,n=1)=>{for(let k=0;k<n;k++){const at=P.autoPlace(p,t);if(at)p.b['b'+(++p.n)]={t,...at,l};}};
 for(const b of Object.values(p.b))if(b.t==='storage')b.l=3;put('reactor',3,3);put('refinery',3,1);put('shield',3,1);
 const ts=['cannon','mg','laser','rocket','missile','mortar','flame','siege'];for(let k=0,n=0;n<17&&k<400;k++){const t=ts[n%ts.length],R=k%2?11:8,a=k*2.399,i=Math.round(P.MID+Math.cos(a)*R),j=Math.round(P.MID+Math.sin(a)*R);if(!P.placeError(p,t,i,j,0)){p.b['b'+(++p.n)]={t,i,j,r:0,l:2+(n%2)};n++;}}
 for(let r=14;r<=16;r++){const pl=P.wallPlan({...p,devx:1},[{k:'rect',a:[P.MID-r,P.MID-r],b:[P.MID+r,P.MID+r],o:3,l:2}],{dev:true});for(const x of pl.cells)p.w[x.i+','+x.j]=x.code;}return p;}
