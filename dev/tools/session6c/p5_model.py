R='./'
f='dev/tools/economy-model.mjs'
s=open(R+f).read()
def rep(old,new):
    global s
    n=s.count(old);assert n==1,(n,old[:150]);s=s.replace(old,new)
rep("""export const MODEL = { P, PROFILES, timelines, dailyIncome, firstHour: hour, firstBaseMinute, researchModel };""","""// ===================================================================================================================
// Session 6C Battalion (owner prompt Nov 18): Hangar fielding, recruits, ranks, command chips, Role Core jobs, Science Lab IV.
// Report numbers, never pinned targets. The town ladder is the audit's (docs/conquest/audit/model/audit-economy.json: casual =
// 2 x 15 min, regular = 60 min, grinder = 4 h; 120 min is the log-midpoint of regular and grinder); a Hangar or Science Lab level
// stands at its Command Center day plus its build time (Hangar L needs CC 2L-1; the Science Lab IV needs CC7 and builds in 6 h).
// Pilots: the wingman in the first hour; one RECRUIT job (8 h, Worker clock) a session plus the day's BEACON EXTRACTION win
// from day 1 (rescueFrom); chips: one a UTC day from the day's first win with a pilot fielded (from day 0); levels 2-5 of a Role
// Core cost 2 / 4 / 5 / 9 chips (20 a role), 8 h each in the Lab's slots. XP: an operation won pays its danger (STANDARD 1, HARD 2,
// VETERAN 3) to every pilot fielded (Wing 2 in field missions, Platoon 4 in raids, defenses and strikes), one rank at most an op.
// ===================================================================================================================
const AUDIT_ALL = JSON.parse(read('docs/conquest/audit/model/audit-economy.json')).profiles;
function ladderOf(minutes) { const g = k => AUDIT_ALL[k].base.hit; if (minutes <= 30) return Object.fromEntries(Object.entries(g('casual')).map(([k, v]) => [k, v.day]));
  if (minutes <= 60) return Object.fromEntries(Object.entries(g('regular')).map(([k, v]) => [k, v.day]));
  const t = Math.min(1, Math.log(minutes / 60) / Math.log(4)); return Object.fromEntries(Object.keys(g('regular')).map(k => [k, Math.round(Math.exp(Math.log(g('regular')[k].day) * (1 - t) + Math.log(g('grinder')[k].day) * t) * 10) / 10])); }
export function battalionModel({ minutes = 60, packChips = 0, rescueFrom = 1, days = 400 } = {}) {
  const BT = { FIELD: [1, 2, 4, 5, 7, 9], RC: [0, 0, 2, 4, 5, 9], RC_MS: 8, RANK_XP: [0, 4, 12, 25, 45, 75, 115, 170, 240, 330], ROSTER: 16 }, L = ladderOf(minutes), H = [15 / 3600, 3 / 60, 20 / 60, 2, 6];
  const hangarDay = lv => L['CC' + (2 * lv - 1 === 1 ? 2 : 2 * lv - 1)] + H[lv - 1] / 24, lab4 = L.CC7 + 6 / 24;
  // pilots: the wingman (minute ~4), then a RECRUIT job each session once a Hangar stands (8 h: done by the next day) and the day's
  // rescue win from rescueFrom (BEACON EXTRACTION is HARD: most new pilots clear it from their second day)
  const pilotsBy = d => { let n = 1; const h1 = hangarDay(1); if (d >= h1 + 8 / 24) n += Math.floor(d - h1 - 8 / 24) + 1; if (d >= rescueFrom) n += Math.floor(d - rescueFrom) + 1; return Math.min(BT.ROSTER, n); };
  const dayWith = (pilots, lv) => { let d = Math.max(0, lv ? hangarDay(lv) : 0); while (pilotsBy(d) < pilots && d < days) d += 1 / 24; return Math.round(d * 10) / 10; };
  const stage = { wingman: 0, wing: dayWith(2, 1), platoon: dayWith(4, 2), battalion: dayWith(9, 5), rosterFull: dayWith(16, 1) };
  // Role Cores: chips bank from day 0 (held earned chips cap at 50); the first role, then all six, in 8 h jobs once Science Lab IV stands
  const chipsBy = d => Math.floor(d) + 1 + Math.floor((d + 1) / 7) * packChips; let spent = 0, t = lab4, first = null, all = null; const rc = Array(6).fill(1);
  for (let role = 0; role < 6; role++) for (let lv = 2; lv <= 5; lv++) { const need = spent + BT.RC[lv]; let d = t; while (chipsBy(d) < need && d < days) d = Math.floor(d) + 1; t = Math.max(t, d) + BT.RC_MS / 24; spent = need; rc[role] = lv; if (role === 0 && lv === 5) first = Math.round(t * 10) / 10; if (role === 5 && lv === 5) all = Math.round(t * 10) / 10; }
  // ranks: one pilot always fielded; and the force at the top (9 pilots rank 9; the whole roster rank 10) with rotation
  const xpDay = d => { const o = opsOfDay(minutes, d), field = Math.max(0, 0.45 * minutes / A.field.par * (d < 1 ? 1 : d < 7 ? .5 : d < 30 ? .2 : .1)); return { field, raids: o.raids, strikes: o.strikes }; };
  const lvAt = d => [5, 4, 3, 2, 1].find(lv => d >= hangarDay(lv)) || 0;
  let xp = 0, top = 0, rank = 1; const at = {}, pool = { xp: 0 }; let nine = null, sixteen = null;
  for (let d = 0; d < days && (sixteen === null || !at[10]); d++) { const x = xpDay(d), raidXp = x.raids * (d < 30 ? 2 : 2.5) + x.strikes * 2, fieldXp = x.field * 1.2; xp += raidXp + fieldXp;   // one pilot in every fight
    for (let r = 2; r <= 10; r++) if (!at[r] && xp >= BT.RANK_XP[r - 1]) at[r] = d + 1;
    const cap = BT.FIELD[lvAt(d)], seats = Math.min(cap, 4) * (x.raids + x.strikes) * (d < 30 ? 2 : 2.5) + Math.min(cap, 2) * fieldXp; pool.xp += seats;   // pilot-XP the whole roster earns a day
    if (nine === null && pool.xp >= 9 * BT.RANK_XP[8] && pilotsBy(d) >= 9) nine = d + 1; if (sixteen === null && pool.xp >= 16 * BT.RANK_XP[9] && pilotsBy(d) >= 16) sixteen = d + 1; }
  return { minutes, ladder: { CC2: L.CC2, CC3: L.CC3, CC5: L.CC5, CC7: L.CC7, CC9: L.CC9 }, stage, scienceLabIV: Math.round(lab4 * 10) / 10, packChips, roleCores: { firstMaxed: first, allSix: all, chips: 120 }, ranks: { onePilot: at, ninePilotsRank9: nine, rosterRank10: sixteen } };
}
export const MODEL = { P, PROFILES, timelines, dailyIncome, firstHour: hour, firstBaseMinute, researchModel, battalionModel };""")
rep("""if (isMain) console.log(out.join('\\n'));""","""const battalion = { light: battalionModel({ minutes: 30 }), free: battalionModel({ minutes: 60 }), heavy: battalionModel({ minutes: 120 }), pack: battalionModel({ minutes: 60, packChips: 5 }) };
const BLAB = { light: '30 min/day', free: '60 min/day', heavy: '120 min/day', pack: '60 min/day + the chip pack every week (PROPOSAL: 5 chips)' };
out.push('\\n## Battalion (Session 6C): the day of each stage, Role Cores and ranks (report numbers, regular pilot; days from the first session)\\n');
out.push('| Pilot | First wingman | Wing (2) | Platoon (4) | Battalion (9) | Roster of 16 | Science Lab IV | First role maxed | All six maxed | Pilot rank 3 / 6 / 9 / 10 (always fielded) | 9 pilots rank 9 | Roster rank 10 |'); out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|');
for (const [k, b] of Object.entries(battalion)) out.push(`| ${BLAB[k]} | minute ~4 | ${b.stage.wing} | ${b.stage.platoon} | ${b.stage.battalion} | ${b.stage.rosterFull} | ${b.scienceLabIV} | ${b.roleCores.firstMaxed} | ${b.roleCores.allSix} | ${[3, 6, 9, 10].map(r => b.ranks.onePilot[r] ?? '>400').join(' / ')} | ${b.ranks.ninePilotsRank9 ?? '>400'} | ${b.ranks.rosterRank10 ?? '>400'} |`);
if (isMain) console.log(out.join('\\n'));""")
rep("""proposal: P, kitModel: KIT_MODEL, arcadePpm, conquestPpm, settled: SETTLED, platingPower, researchPower, reference, timelines, dailyIncome, firstHour: hour, firstBaseMinute, research,""","""proposal: P, kitModel: KIT_MODEL, arcadePpm, conquestPpm, settled: SETTLED, platingPower, researchPower, reference, timelines, dailyIncome, firstHour: hour, firstBaseMinute, research, battalion,""")
open(R+f,'w').write(s)
print('model ok')
