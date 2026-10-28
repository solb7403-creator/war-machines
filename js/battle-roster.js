'use strict';
// Play-screen roster: exactly the two server-owned Laboratory machines.
// This is presentation only. The server still decides the effective loadout from the
// authoritative account's active Lab slot; the client never grants inventory.
function battleRosterHtml(){
 const lab=save&&save.lab;
 if(!lab||!lab.machines||!lab.slots)return '';
 const ids=Object.values(lab.slots).filter(id=>lab.machines[id]).slice(0,2);
 if(ids.length!==2)return '';
 return '<section class="battle-roster" aria-label="Your battle machines">'+
  '<div class="battle-roster-title"><b>YOUR BATTLE MACHINES</b><small>Select one before entering a match</small></div>'+
  '<div class="battle-roster-grid">'+ids.map((id,i)=>{
   const M=lab.machines[id],L=ecoLoadout(save,M.spec),active=id===lab.active;
   const chassis=(L.c.s?'Salvaged ':'')+(CNAMES[L.c.c]?.[Math.max(0,L.c.t)]||CH[L.c.c].n);
   const weapon=L.w.a==='moon'?'Moonbeam':(L.w.s?'Salvaged ':'')+(WNAMES[L.w.a]?.[Math.max(0,L.w.t)]||WEAPONS[L.w.a].n);
   return '<div class="battle-roster-card'+(active?' selected':'')+'">'+
    '<div class="battle-roster-bay">BAY '+(i+1)+(active?' · DEPLOYING':' · READY')+'</div>'+
    '<canvas data-art="lab:'+esc(id)+'" aria-label="'+esc(M.name)+' preview"></canvas>'+
    '<b class="battle-roster-name">'+esc(M.name)+'</b>'+
    '<div class="battle-roster-items">'+esc(chassis)+' · '+esc(weapon)+'</div>'+
    '<div class="battle-roster-power">POWER '+powerOf(L)+'</div>'+
    '<button class="btn '+(active?'btn-quiet':'btn-go')+'" data-act="labequip" data-arg="'+esc(id)+'"'+(active?' disabled':'')+'>'+
     (active?'Selected':'Deploy this machine')+'</button></div>';
  }).join('')+'</div>'+
  '<p class="battle-roster-rule">Your selected machine is locked for the full match, including Arena rounds. Edit either build in Garage.</p>'+
  '</section>';
}
