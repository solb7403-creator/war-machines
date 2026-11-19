// Session 6C test helper: the Conquest record is split (worker/src/conquest-store.js): the hot part at conquest/<pid>, the cold part
// an immutable blob at cqc/<pid>/<cv>. cqLive(db, pid) puts the WHOLE record back at the hot path (no cv: the Worker reads it as
// it is and splits it again on its next write) and returns that stored object, so a test can read and poke any field in place,
// exactly as it did before the split. Only tests use it; the Worker never writes a whole record.
import {join} from '../../../worker/src/conquest-store.js';
export function cqLive(db,pid){const h=db.get('conquest/'+pid);if(!h||!h.cv)return h;const s=join(h,db.get('cqc/'+pid+'/'+h.cv));db.root.conquest[pid]=s;return s;}
