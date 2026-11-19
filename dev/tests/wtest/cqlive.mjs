// Session 6C test helper: the Conquest record is split (worker/src/conquest-store.js): the hot part at conquest/<pid>, the cold part
// an immutable blob at cqc/<pid>/<cv>. cqLive(db, pid) puts the WHOLE record back at the hot path (no cv: the Worker reads it as
// it is and splits it again on its next write) and returns that stored object, so a test can read and poke any field in place,
// exactly as it did before the split. Only tests use it; the Worker never writes a whole record.
// It builds the shared sim first: worker/src/sim.gen.js is generated, not committed, the store reads it, and a static import is
// linked before the importing test's own buildSim() runs, so on a clean checkout (CI) the store's import would find nothing.
import {buildSim} from '../../../worker/build-sim.mjs';buildSim();
const {join}=await import('../../../worker/src/conquest-store.js');
export function cqLive(db,pid){const h=db.get('conquest/'+pid);if(!h||!h.cv)return h;const s=join(h,db.get('cqc/'+pid+'/'+h.cv));db.root.conquest[pid]=s;return s;}
