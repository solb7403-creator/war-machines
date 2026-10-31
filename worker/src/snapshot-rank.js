// Sortable composite value: descending existing credit, then ascending canonical ID.
// IEEE-754 positive finite encodings preserve numeric order without rounding legacy credit.
export const SNAPSHOT_INDEX_VERSION=1;
export function snapshotCredit(profile){
 const points=Number(profile?.pts)||0;
 return typeof profile?.ac==='number'&&Number.isFinite(profile.ac)&&profile.ac>=0?profile.ac:points;
}
export function snapshotRank(id,profile){
 const credit=snapshotCredit(profile);if(!Number.isFinite(credit)||credit<0)throw Error('snapshot_invalid_credit');
 const data=new DataView(new ArrayBuffer(8));data.setFloat64(0,credit===0?0:credit,false);
 let key='';for(let i=0;i<8;i++)key+=(255-data.getUint8(i)).toString(16).padStart(2,'0');
 return key+'_'+id;
}
