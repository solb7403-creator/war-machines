/* Personal, provisional client accomplishment only. Never grants currency or equipment. */
(function(root){
'use strict';let ready=false;
class Progress{
 constructor(key,getSave,persist){this.key=key;this.getSave=getSave;this.persist=persist;this.data={v:1,missions:{}};try{this.merge(JSON.parse(localStorage.getItem(key)));}catch(_){}this.merge(getSave()?.conquestProgress);}
 merge(data){if(data?.v!==1)return;for(const [id,m] of Object.entries(data.missions||{})){if(id!=='oxygen-line'||!m||!m.completed)continue;const old=this.data.missions[id];this.data.missions[id]={completed:true,completedAt:Math.min(old?.completedAt||Infinity,Number(m.completedAt)||Date.now()),provisional:true};}}
 completed(id){return !!this.data.missions[id]?.completed;}
 complete(id){if(id!=='oxygen-line')return;this.merge(this.getSave()?.conquestProgress);if(!this.completed(id))this.data.missions[id]={completed:true,completedAt:Date.now(),provisional:true};this.flush();}
 flush(){this.merge(this.getSave()?.conquestProgress);try{this.merge(JSON.parse(localStorage.getItem(this.key)));localStorage.setItem(this.key,JSON.stringify(this.data));}catch(_){}if(ready&&Object.keys(this.data.missions).length){const s=this.getSave();if(s&&JSON.stringify(s.conquestProgress)!==JSON.stringify(this.data)){s.conquestProgress=JSON.parse(JSON.stringify(this.data));this.persist();}}}
}
root.ConquestProgress={Progress,markReady(){ready=true;},create(){return new Progress((typeof SAVE_KEY==='string'?SAVE_KEY:'wm_save_v1')+':conquest-progress-v1',()=>typeof save!=='undefined'?save:null,()=>{if(typeof store==='function')store();});}};
})(globalThis);
