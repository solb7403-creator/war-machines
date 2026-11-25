/* Session 7C STEP 3: the Hive Titan's STAND-IN look (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md: a stand-in through named
   hooks for a later Fable session; ConquestTitan.HOOKS names each piece). The Titan is the view's own Parasite heavy, enlarged 2.4x with
   a violet halo at its feet; while it burrows the halo stays on the eruption point. Its charge lanes, slam and eruption rings and plasma
   rain are the battle's marked zones (B.hazards), which the view and the 2D canvas already draw. Presentation only: nothing here is read
   back by the fight. One extra mesh on HIGH and LOW (well inside the LOW budget). */
(function(root){
'use strict';
const SCALE=2.4,HALO=0xb36bff;
// js/conquest/view.js enemyModel asks this first (beside the Citadel's stand-ins): the Titan, or null for every other unit
function model(view,e){if(!e?.titan||!view?.T||typeof view.enemyModel!=='function')return null;const g=view.enemyModel({...e,titan:0});if(!g)return null;g.scale.multiplyScalar(SCALE);
 try{const T=view.T,ring=new T.Mesh(new T.RingGeometry(1.1,1.5,40),new T.MeshBasicMaterial({color:HALO,transparent:true,opacity:.55,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.15;ring.userData.hook=root.ConquestTitan?.HOOKS.model||'hive-titan';g.add(ring);g.userData.titanHalo=ring;}catch(_){}
 g.userData.hook=root.ConquestTitan?.HOOKS.model||'hive-titan';return g;}
root.ConquestTitanView=Object.freeze({model,SCALE});
})(globalThis);
