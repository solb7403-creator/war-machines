// Match records for the server tests (the format js/proof.js writes). A believable fight: your tank holds a spot near
// the enemies, deals the reported damage over the match, and the enemies lose that health (all of it on a win).
// opt: {g, m, won, drawn, place, dur (s), dmg, kills, bot (drives with nobody on the controls), steer (a fixed input
// pattern seed: the same seed gives the same controls), mhp}
const MODES = { '1v1': 1, '2v2': 2, '3v3': 3 };
export function fakeRec(o) {
  const g = o.g || 'arena', n0 = MODES[o.m] || 1, dur = Math.max(4, o.dur || 30), k = Math.round(dur / 0.5);
  const teams = g === 'royale' ? [0, 1, 2, 3, 4, 5] : g === 'boss' ? Array.from({ length: n0 }, () => 0).concat([1]) : Array.from({ length: n0 }, () => 0).concat(Array.from({ length: n0 }, () => 1));
  const n = teams.length, sz = n * 3 + 6, b = new Uint8Array(k * sz), mhp = o.mhp || 1700;
  const h = teams.map((t, i) => [t, 1, i === n - 1 && g === 'boss' ? 30000 : mhp, (i === 0 ? 4 : 0) | (i === n - 1 && g === 'boss' ? 1 : 0)]);
  const enemies = teams.map((t, i) => i > 0 && (g === 'royale' || t !== 0));
  const ne = enemies.filter(Boolean).length, dmg = Math.max(0, o.dmg || 0);
  // who goes down: everyone on a win; Last Standing: enough that your place is right
  const dies = enemies.map((e, i) => e && (o.won || (g === 'royale' && o.place > 1 && i >= o.place)));
  let seed = o.steer || 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let ang = 0;
  for (let s = 0; s < k; s++) {
    const f = (s + 1) / k, o0 = s * sz;
    teams.forEach((t, i) => {
      const x = i === 0 ? 10 + Math.sin(s / 5) * 0.15 : 9 + (i % 3) * 1.2, y = i === 0 ? 24 : t === 0 ? 25 : 20.5;
      b[o0 + i * 3] = Math.round(x * 10); b[o0 + i * 3 + 1] = Math.round(y * 7.5);
      let hp = 100;
      if (enemies[i]) { const lossShare = dies[i] ? 1 : 0.6; hp = Math.max(dies[i] && f >= 0.98 ? 0 : 1, Math.round(100 - lossShare * 100 * Math.min(1, f / 0.97))); if (!dies[i]) hp = Math.max(40, hp); }
      if (i === 0 && g === 'royale' && o.place > 1 && f >= 0.98) hp = 0;
      b[o0 + i * 3 + 2] = hp;
    });
    const p = o0 + n * 3, d = Math.min(65535, Math.round(dmg / k));
    if (o.bot) { b[p] = 100; b[p + 1] = 100; b[p + 2] = 0; b[p + 5] = 0; }
    else { ang += (rnd() - 0.5) * 1.4; const mg = 0.35 + rnd() * 0.6; b[p] = Math.round(100 + Math.cos(ang) * mg * 100); b[p + 1] = Math.round(100 + Math.sin(ang) * mg * 100); b[p + 2] = 1; b[p + 5] = rnd() < 0.3 ? 1 : 0; }
    b[p + 3] = d >> 8; b[p + 4] = d & 255;
  }
  // a bot-driven tank moves around with nobody on the controls
  if (o.bot) for (let s = 0; s < k; s++) { b[s * sz] = Math.round((10 + Math.sin(s / 3) * 1.6) * 10); b[s * sz + 1] = Math.round((24 + Math.cos(s / 4) * 0.8) * 7.5); }
  return { v: 1, n, dt: 0.5, h, s: Buffer.from(b).toString('base64'), f: { gs: [0, 0], low: 1 } };
}
